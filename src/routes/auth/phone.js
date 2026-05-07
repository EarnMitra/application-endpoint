/**
 * Phone OTP Routes
 * Handles phone OTP for registration and login flows
 * With rate limiting to prevent brute force attacks
 */

const express = require('express');
const router = express.Router();
const helpers = require('./helpers');
const rateLimiter = require('./rateLimiter');

/**
 * Initiate Phone OTP
 * POST /api/auth/phone/initiate
 * Body: { phone: "9876543210" }
 * Automatically detects registration vs login based on whether phone exists
 * Rate Limited: 5 attempts per hour per phone number
 */
router.post('/initiate', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.error(
        { field: 'phone' },
        'Phone number is required',
        400
      );
    }

    if (!helpers.validatePhone(phone)) {
      return res.error(
        { field: 'phone' },
        'Please enter a valid phone number',
        400
      );
    }

    const cleanPhone = helpers.cleanPhone(phone);

    // CHECK RATE LIMIT: 5 initiate attempts per hour per phone
    const rateLimitCheck = rateLimiter.isAllowed(cleanPhone, 'initiate', 5, 3600000);
    if (!rateLimitCheck.allowed) {
      console.warn('[RATE_LIMIT] Phone OTP initiate blocked', {
        phone: cleanPhone,
        action: 'initiate',
        resetIn: rateLimitCheck.resetIn,
        timestamp: new Date().toISOString()
      });
      return res.error(
        { field: 'phone', rateLimitResetIn: rateLimitCheck.resetIn },
        `Too many OTP requests. Please try again in ${rateLimitCheck.resetIn} seconds.`,
        429
      );
    }

    // Check if user exists to auto-detect registration vs login
    const userExists = await req.db.query(
      'SELECT uid FROM users WHERE phone = $1',
      [cleanPhone]
    );

    // Determine purpose based on whether user exists
    const purpose = userExists.rows.length > 0 ? 'login' : 'registration';

    // Generate OTP using centralized OTP middleware
    const { token, expiresIn } = await req.otpMiddleware.generatePhoneOTP(cleanPhone, req);

    // Build response without debug OTP (OTP only logged to terminal)
    const successResponse = {
      token,
      purpose,
      message: `OTP sent for ${purpose}`,
      expiresIn
    };

    res.success(
      successResponse,
      'OTP sent successfully',
      200
    );
  } catch (error) {
    // Comprehensive error logging
    console.error('[PHONE_INITIATE_ERROR]', {
      timestamp: new Date().toISOString(),
      endpoint: '/api/auth/phone/initiate',
      phone: phone,
      errorCode: error.code,
      errorMessage: error.message,
      errorDetail: error.detail,
      stack: error.stack
    });

    // Log to console in readable format
    console.error('❌ Phone OTP initiate failed:', error.message);
    if (error.code) console.error('   PostgreSQL Code:', error.code);
    if (error.detail) console.error('   Details:', error.detail);

    // Send user-friendly error response
    res.error(
      { code: error.code || 'UNKNOWN_ERROR' },
      'Failed to send OTP. Please try again.',
      500
    );
  }
});

/**
 * Verify Phone OTP
 * POST /api/auth/phone/verify
 * Body: { token: "...", otp: "123456", phone: "9876543210" }
 * Automatically detects registration vs login based on whether phone exists
 * Rate Limited: 10 verify attempts per hour per phone number
 */
router.post('/verify', async (req, res) => {
  let phone; // Define outside try block for access in catch
  try {
    const { token, otp } = req.body;
    phone = req.body.phone;

    if (!token || !otp || !phone) {
      return res.error(
        { required: ['token', 'otp', 'phone'] },
        'Token, OTP, and phone are required',
        400
      );
    }

    // Validate phone format
    if (!helpers.validatePhone(phone)) {
      return res.error(
        { field: 'phone' },
        'Please enter a valid phone number',
        400
      );
    }

    const cleanPhone = helpers.cleanPhone(phone);

    // BUG FIX #13: Validate deviceInfo before using it
    const rawDeviceInfo = req.body.deviceInfo || {};
    if (typeof rawDeviceInfo !== 'object' || Array.isArray(rawDeviceInfo)) {
      return res.error(
        { field: 'deviceInfo' },
        'Device info must be a valid JSON object',
        400
      );
    }

    // Extract device information once - reuse throughout endpoint
    const deviceInfo = helpers.extractDeviceInfo(req, rawDeviceInfo);

    // CHECK RATE LIMIT: 10 verify attempts per hour per phone
    const rateLimitCheck = rateLimiter.isAllowed(cleanPhone, 'verify', 10, 3600000);
    if (!rateLimitCheck.allowed) {
      console.warn('[RATE_LIMIT] Phone OTP verify blocked', {
        phone: cleanPhone,
        action: 'verify',
        resetIn: rateLimitCheck.resetIn,
        timestamp: new Date().toISOString()
      });
      return res.error(
        { field: 'phone', rateLimitResetIn: rateLimitCheck.resetIn },
        `Too many verification attempts. Please try again in ${rateLimitCheck.resetIn} seconds.`,
        429
      );
    }

    // Verify OTP using centralized OTP middleware
    const verificationResult = await req.otpMiddleware.verifyOTP(token, otp, cleanPhone, 'mobile', req.db);

    if (!verificationResult.valid) {
      // Map error codes to HTTP status codes
      const statusCode = 
        verificationResult.code === 'OTP_EXPIRED' ? 400 :
        verificationResult.code === 'TOO_MANY_ATTEMPTS' ? 429 :
        verificationResult.code === 'INVALID_OTP' ? 400 :
        verificationResult.code === 'INVALID_TOKEN' ? 400 : 400;

      return res.error(
        { field: verificationResult.code === 'INVALID_OTP' ? 'otp' : verificationResult.code === 'TOO_MANY_ATTEMPTS' ? 'otp' : 'token' },
        verificationResult.message,
        statusCode
      );
    }

    // Extract record from verification result for later use
    const record = verificationResult.record;

    let userId;
    let referralCode;
    let sessionToken;
    let refreshToken;
    let isLogin = false;

    // BUG FIX #C6: Wrap user detection in transaction to prevent race condition
    // Check and create/authenticate must be atomic to prevent two concurrent requests
    // from both creating the same user
    let userStatus;
    
    await req.db.transaction(async (client) => {
      // Check if user exists (inside transaction for atomicity)
      const userRecord = await client.query(
        'SELECT uid, status FROM users WHERE phone = $1',
        [cleanPhone]
      );

      if (userRecord.rows.length > 0) {
        // LOGIN: User exists
        isLogin = true;
        userId = userRecord.rows[0].uid;
        userStatus = userRecord.rows[0].status;
      }
    });

    if (!isLogin) {
      // REGISTRATION: Create new user (outside transaction first)
      // Generate UID using helper function
      userId = helpers.generateUID();

      // BUG FIX #4: Validate verificationResult has required record before accessing
      if (!verificationResult.record) {
        throw new Error('Verification record not found');
      }

      await req.db.transaction(async (client) => {
        // Create new user with registration_step = 1
        const createResult = await client.query(
          `INSERT INTO users (uid, phone, phone_verified, registration_step, status)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING uid`,
          [userId, cleanPhone, true, 1, 'pending']
        );

        userId = createResult.rows[0].uid;

        // Mark verification token as verified
        await client.query(
          `UPDATE verification_tokens 
           SET status = $1, used_at = CURRENT_TIMESTAMP, verified_on_attempt = $2
           WHERE token = $3`,
          ['verified', record.attempt_count + 1, token]
        );

        // Create verified record with full device tracking
        // deviceInfo already extracted at start of verify endpoint
        // BUG FIX #14: Wrap JSON.stringify in try-catch to handle circular references
        let deviceInfoJSON;
        try {
          deviceInfoJSON = JSON.stringify(deviceInfo);
        } catch (e) {
          throw new Error('Device info contains non-serializable data');
        }
        
        // BUG FIX #M4: Validate record.vid exists before inserting
        if (!record.vid) {
          throw new Error('Verification record ID (vid) is required but missing');
        }
        
        await client.query(
          `INSERT INTO user_verified (vid, uid, type, target_value, is_verified, device_info, device_name, os_type, browser_type, ip_address, user_agent, location, latitude, longitude, verified_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)`,
          [record.vid, userId, 'mobile', cleanPhone, true, deviceInfoJSON, deviceInfo.device_name, deviceInfo.os_type, deviceInfo.browser_type, deviceInfo.ip_address, deviceInfo.user_agent, deviceInfo.location, deviceInfo.latitude, deviceInfo.longitude]
        );

        // Generate unique 8-digit referral code with max retry limit
        const referralCode = await helpers.generateUniqueReferralCode(client);

        // Create user profile with referral code
        await client.query(
          `INSERT INTO user_profiles (uid, referral_code)
           VALUES ($1, $2)`,
          [userId, referralCode]
        );

        // Create user wallet with initial balance of 0
        await client.query(
          `INSERT INTO user_wallets (uid, balance, currency, total_credited, total_debited, coins_balance, total_coins_earned, total_coins_spent, pending_withdrawal, total_withdrawn, monthly_bonus, freeze_amount, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [userId, 0.00, 'INR', 0.00, 0.00, 0, 0, 0, 0.00, 0.00, 0.00, 0.00, 'active']
        );

        // Create login history for first-time registration
        try {
          await client.query(
            `INSERT INTO login_history (uid, login_status, device_name, os_type, browser_type, device_fingerprint, ip_address, user_agent, location, latitude, longitude, login_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)`,
            [userId, 'success', deviceInfo.device_name, deviceInfo.os_type, deviceInfo.browser_type, deviceInfo.device_fingerprint, deviceInfo.ip_address, deviceInfo.user_agent, deviceInfo.location, deviceInfo.latitude, deviceInfo.longitude]
          );
        } catch (historyError) {
          console.error('[REGISTRATION_LOGIN_HISTORY_ERROR]', {
            uid: userId,
            error: historyError.message
          });
          // Don't fail registration if login history fails
        }

        // Create session for immediate login
        const { sessionToken: regSessionToken, refreshToken: regRefreshToken } = await req.sessionMiddleware.createUserSession(client, userId, deviceInfo);
        sessionToken = regSessionToken;
        refreshToken = regRefreshToken;
      });

      res.success(
        {
          uid: userId,
          step: 1,
          purpose: 'registration',
          session_token: sessionToken,
          refresh_token: refreshToken,
          message: 'Phone verified successfully',
          nextStep: 'add_email'
        },
        'Phone verification successful - Registration started',
        200
      );
    } else {
      // LOGIN: Authenticate existing user
      // userId and userStatus already fetched inside transaction above
      // Validate account status - check if allowed to login
      const statusValidation = helpers.validateAccountStatus(userStatus);
      if (!statusValidation.allowed) {
        return res.error(
          { status: userStatus },
          statusValidation.message || 'Account login not allowed',
          403
        );
      }

      // Transaction to mark token as verified and create session
      // deviceInfo already extracted at start of verify endpoint
      await req.db.transaction(async (client) => {
        // Mark verification token as verified
        await client.query(
          `UPDATE verification_tokens 
           SET status = $1, used_at = CURRENT_TIMESTAMP, verified_on_attempt = $2
           WHERE token = $3`,
          ['verified', record.attempt_count + 1, token]
        );

        // Log login history with full device tracking
        try {
          await client.query(
            `INSERT INTO login_history (uid, login_status, device_name, os_type, browser_type, device_fingerprint, ip_address, user_agent, location, latitude, longitude, login_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)`,
            [userId, 'success', deviceInfo.device_name, deviceInfo.os_type, deviceInfo.browser_type, deviceInfo.device_fingerprint, deviceInfo.ip_address, deviceInfo.user_agent, deviceInfo.location, deviceInfo.latitude, deviceInfo.longitude]
          );
        } catch (historyError) {
          // Log history error but don't fail the login
          console.error('[LOGIN_HISTORY_ERROR]', {
            uid: userId,
            error: historyError.message,
            timestamp: new Date().toISOString()
          });
        }

        // Create session for login
        const { sessionToken: loginSessionToken, refreshToken: loginRefreshToken } = await req.sessionMiddleware.createUserSession(client, userId, deviceInfo);
        sessionToken = loginSessionToken;
        refreshToken = loginRefreshToken;
      });

      res.success(
        {
          uid: userId,
          purpose: 'login',
          session_token: sessionToken,
          refresh_token: refreshToken,
          message: 'Logged in successfully',
          nextStep: 'dashboard'
        },
        'Phone verified successfully - Logged in',
        200
      );
    }
  } catch (error) {
    // Handle unique constraint violations
    if (error.code === '23505') {
      // Unique constraint violation (e.g., phone already registered)
      const constraint = error.constraint || 'unknown';
      console.warn('[UNIQUE_CONSTRAINT_VIOLATION]', {
        timestamp: new Date().toISOString(),
        phone: phone,
        constraint: constraint,
        message: error.message
      });

      // BUG FIX #7: Use exact constraint name match instead of fragile includes()
      if (constraint === 'users_phone_key') {
        return res.error(
          { field: 'phone', code: 'PHONE_ALREADY_REGISTERED' },
          'This phone number is already registered',
          409
        );
      }

      return res.error(
        { code: 'UNIQUE_CONSTRAINT_VIOLATION' },
        'This data is already registered',
        409
      );
    }

    // Comprehensive error logging for other errors
    console.error('[PHONE_VERIFY_ERROR]', {
      timestamp: new Date().toISOString(),
      endpoint: '/api/auth/phone/verify',
      phone: phone,
      errorCode: error.code,
      errorMessage: error.message,
      errorDetail: error.detail,
      stack: error.stack
    });

    // Log to console in readable format
    console.error('❌ Phone verification failed:', error.message);
    if (error.code) console.error('   PostgreSQL Code:', error.code);
    if (error.detail) console.error('   Details:', error.detail);

    // Send user-friendly error response
    res.error(
      { code: error.code || 'UNKNOWN_ERROR' },
      'Phone verification failed. Please try again.',
      500
    );
  }
});

module.exports = router;
