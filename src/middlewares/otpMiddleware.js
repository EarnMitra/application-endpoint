/**
 * OTP Middleware
 * Centralized OTP generation, logging, and verification logic
 * Handles both phone and email OTP flows
 */

const helpers = require('../routes/auth/helpers');

/**
 * Generate and send OTP for email registration
 * BUG FIX #15: Use environment variable for OTP expiration
 * BUG FIX #13: Validate deviceInfo before use
 * Logs OTP to terminal only (dev mode)
 * @param {string} email - Target email address
 * @param {object} req - Express request object
 * @returns {object} { otp, token, expiresAt, expiresIn }
 */
const generateEmailOTP = async (email, req) => {
  try {
    // Validate input
    if (!email || typeof email !== 'string' || !email.trim()) {
      throw new Error('Invalid email: must be a non-empty string');
    }
    if (!req || !req.db) {
      throw new Error('Invalid request object');
    }

    // Generate 6-digit OTP
    const otp = helpers.generateOTP();

    // Generate verification token
    const token = helpers.generateVerificationToken();

    // BUG FIX #15: Use env var for OTP expiration (default 10 minutes if not set)
    const expirationMinutes = parseInt(process.env.OTP_EXPIRATION_MINUTES, 10) || 10;
    const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);
    const expiresIn = expirationMinutes * 60; // in seconds

    // BUG FIX #13: Validate deviceInfo before use
    const rawDeviceInfo = req.body?.deviceInfo || {};
    if (typeof rawDeviceInfo !== 'object' || Array.isArray(rawDeviceInfo)) {
      throw new Error('Invalid deviceInfo: must be a valid JSON object');
    }

    // Extract device information
    const deviceInfo = helpers.extractDeviceInfo(req, rawDeviceInfo);

    // Ensure device_fingerprint is always valid (fallback for safety)
    const deviceFingerprint = deviceInfo.device_fingerprint || helpers.generateDeviceFingerprint('unknown', {});

    // Insert verification token into database
    await req.db.query(
      `INSERT INTO verification_tokens (token, target_value, type, otp, expires_at, status, ip_address, user_agent, device_fingerprint)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [token, email, 'email', otp, expiresAt, 'pending', deviceInfo.ip_address, deviceInfo.user_agent, deviceFingerprint]
    );

    // Log OTP to terminal ONLY in dev mode (not in response)
    if (req.isDevMode) {
      console.log(`[OTP_EMAIL_GENERATED] Email: ${email}, OTP: ${otp}, Token: ${token}, ExpiresIn: ${expiresIn}s`);
    }

    return {
      otp, // For internal use only
      token,
      expiresAt,
      expiresIn
    };
  } catch (error) {
    console.error('[OTP_EMAIL_GENERATION_ERROR]', {
      timestamp: new Date().toISOString(),
      email: email,
      errorMessage: error.message,
      errorCode: error.code
    });
    throw error;
  }
};

/**
 * Generate and send OTP for phone authentication
 * BUG FIX #15: Use environment variable for OTP expiration
 * BUG FIX #13: Validate deviceInfo before use
 * Logs OTP to terminal only (dev mode)
 * @param {string} phone - Target phone number
 * @param {object} req - Express request object
 * @returns {object} { otp, token, expiresAt, expiresIn }
 */
const generatePhoneOTP = async (phone, req) => {
  try {
    // Validate input
    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      throw new Error('Invalid phone: must be a non-empty string');
    }
    if (!req || !req.db) {
      throw new Error('Invalid request object');
    }

    // Generate 6-digit OTP
    const otp = helpers.generateOTP();

    // Generate verification token
    const token = helpers.generateVerificationToken();

    // BUG FIX #15: Use env var for OTP expiration (default 10 minutes if not set from env)
    const expirationMinutes = parseInt(process.env.OTP_EXPIRATION_MINUTES, 10) || 10;
    const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);
    const expiresIn = expirationMinutes * 60; // in seconds

    // BUG FIX #13: Validate deviceInfo before use
    const rawDeviceInfo = req.body?.deviceInfo || {};
    if (typeof rawDeviceInfo !== 'object' || Array.isArray(rawDeviceInfo)) {
      throw new Error('Invalid deviceInfo: must be a valid JSON object');
    }

    // Extract device information
    const deviceInfo = helpers.extractDeviceInfo(req, rawDeviceInfo);

    // Ensure device_fingerprint is always valid (fallback for safety)
    const deviceFingerprint = deviceInfo.device_fingerprint || helpers.generateDeviceFingerprint('unknown', {});

    // Insert verification token into database
    await req.db.query(
      `INSERT INTO verification_tokens (token, target_value, type, otp, expires_at, status, ip_address, user_agent, device_fingerprint)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [token, phone, 'mobile', otp, expiresAt, 'pending', deviceInfo.ip_address, deviceInfo.user_agent, deviceFingerprint]
    );

    // Log OTP to terminal ONLY in dev mode (not in response)
    if (req.isDevMode) {
      console.log(`[OTP_PHONE_GENERATED] Phone: ${phone}, OTP: ${otp}, Token: ${token}, ExpiresIn: ${expiresIn}s`);
    }

    return {
      otp, // For internal use only
      token,
      expiresAt,
      expiresIn
    };
  } catch (error) {
    console.error('[OTP_PHONE_GENERATION_ERROR]', {
      timestamp: new Date().toISOString(),
      phone: phone,
      errorMessage: error.message,
      errorCode: error.code
    });
    throw error;
  }
};

/**
 * Verify OTP and update token status
 * BUG FIX #1, #3, #10: Improved error handling and consistency
 * @param {string} token - Verification token
 * @param {string} otp - OTP provided by user
 * @param {string} targetValue - Email or phone being verified
 * @param {string} type - 'email' or 'mobile'
 * @param {object} client - Database client (transaction or pool wrapper)
 * @returns {object} { valid: boolean, message: string, record: object }
 */
const verifyOTP = async (token, otp, targetValue, type, client) => {
  try {
    // Validate inputs
    if (!token || !otp || !targetValue || !type) {
      throw new Error('Missing required parameters for OTP verification');
    }
    if (!client) {
      throw new Error('Database client is required');
    }

    // BUG FIX #M3: Validate OTP format FIRST before any database operations
    // Must be exactly 6 digits - validate input before wasting DB operations
    if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      throw new Error('OTP must be exactly 6 digits');
    }

    // BUG FIX #1: Ensure client has query method (both transaction and pool wrapper have it)
    if (typeof client.query !== 'function') {
      throw new Error('Invalid database client: missing query method');
    }

    // Get verification token record
    const tokenRecord = await client.query(
      `SELECT * FROM verification_tokens 
       WHERE token = $1 AND target_value = $2 AND type = $3 AND status = $4`,
      [token, targetValue, type, 'pending']
    );

    if (tokenRecord.rows.length === 0) {
      return {
        valid: false,
        message: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      };
    }

    const record = tokenRecord.rows[0];
    
    // BUG FIX #5: Validate record exists and has required fields (race condition protection)
    if (!record || !record.expires_at) {
      return {
        valid: false,
        message: 'Invalid verification record',
        code: 'INVALID_TOKEN'
      };
    }

    // Check if OTP expired
    if (new Date() > new Date(record.expires_at)) {
      await client.query(
        `UPDATE verification_tokens SET status = $1 WHERE token = $2`,
        ['expired', token]
      );
      return {
        valid: false,
        message: 'OTP has expired',
        code: 'OTP_EXPIRED'
      };
    }

    // Check attempt count
    if (record.attempt_count >= 5) {
      await client.query(
        `UPDATE verification_tokens SET status = $1 WHERE token = $2`,
        ['failed', token]
      );
      return {
        valid: false,
        message: 'Too many failed attempts',
        code: 'TOO_MANY_ATTEMPTS'
      };
    }

    // BUG FIX #6: Check OTP value directly (no need for redundant toString())
    if (record.otp !== otp) {
      await client.query(
        `UPDATE verification_tokens SET attempt_count = attempt_count + 1 WHERE token = $1`,
        [token]
      );
      return {
        valid: false,
        message: 'Invalid OTP',
        code: 'INVALID_OTP'
      };
    }

    // OTP is valid - return record for caller to update status inside transaction
    return {
      valid: true,
      message: 'OTP verified successfully',
      code: 'OTP_VALID',
      record  // Return full record so caller has all info needed
    };
  } catch (error) {
    console.error('[OTP_VERIFICATION_ERROR]', {
      timestamp: new Date().toISOString(),
      token: token,
      targetValue: targetValue,
      type: type,
      errorMessage: error.message,
      errorCode: error.code
    });
    throw error;
  }
};

/**
 * Mark OTP as verified
 * @param {string} token - Verification token
 * @param {object} client - Database client
 */
const markOTPAsVerified = async (token, client) => {
  try {
    // Validate inputs
    if (!token || !client) {
      throw new Error('Token and database client are required');
    }

    await client.query(
      `UPDATE verification_tokens 
       SET status = $1, used_at = CURRENT_TIMESTAMP
       WHERE token = $2`,
      ['verified', token]
    );
  } catch (error) {
    console.error('[MARK_OTP_VERIFIED_ERROR]', {
      timestamp: new Date().toISOString(),
      token: token,
      errorMessage: error.message
    });
    throw error;
  }
};

module.exports = {
  generateEmailOTP,
  generatePhoneOTP,
  verifyOTP,
  markOTPAsVerified
};
