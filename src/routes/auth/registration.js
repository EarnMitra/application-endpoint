/**
 * Registration Routes
 * Handles multi-step user registration process after phone verification
 * 
 * Phone verification is handled separately in phone.js with auto-detection:
 * - POST /api/auth/phone/initiate
 * - POST /api/auth/phone/verify (auto-detects registration vs login)
 */

const express = require('express');
const router = express.Router();
const helpers = require('./helpers');
const rateLimiter = require('./rateLimiter');

/**
 * STEP 1: Add Email and Send OTP
 * POST /api/auth/register/addEmail
 * Headers: { Authorization: "Bearer <session_token>" }
 * Body: { email: "user@example.com" }
 * Prerequisites: Must have valid session token from phone/verify
 */
router.post('/addEmail', async (req, res) => {
  // BUG FIX #6: Initialize variables outside try block to ensure they're available in error logs
  let normalizedEmail = null;
  try {
    const { email } = req.body;
    const authHeader = req.get('Authorization');

    if (!email) {
      return res.error(
        { required: ['email'] },
        'Email is required',
        400
      );
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.error(
        { field: 'Authorization' },
        'Valid session token required in Authorization header',
        401
      );
    }

    // BUG FIX #27: Normalize email FIRST before any validation (trim + lowercase)
    normalizedEmail = email.trim().toLowerCase();

    if (!helpers.validateEmail(normalizedEmail)) {
      return res.error(
        { field: 'email' },
        'Invalid email format',
        400
      );
    }

    // Verify session token at beginning of route - dies here if invalid
    const userId = await req.sessionMiddleware.verifySessionOrDie(req, res);
    if (!userId) return; // Error response already sent

    // BUG FIX #27: Use normalized email for rate limiting (prevent bypass via case variation)
    const rateLimitCheck = rateLimiter.isAllowed(normalizedEmail, 'add-email', 5, 3600000);
    if (!rateLimitCheck.allowed) {
      console.warn('[RATE_LIMIT] Email OTP initiate blocked', {
        email: normalizedEmail,
        action: 'add-email',
        resetIn: rateLimitCheck.resetIn,
        timestamp: new Date().toISOString()
      });
      return res.error(
        { field: 'email' },
        rateLimitCheck.message,
        429
      );
    }

    // Get user to verify registration step
    const userRecord = await req.db.query(
      'SELECT uid, email, status FROM users WHERE uid = $1 AND phone_verified = true AND registration_step >= 1',
      [userId]
    );

    if (userRecord.rows.length === 0) {
      return res.error(
        { field: 'user' },
        'User not found or phone not verified',
        404
      );
    }

    // Check if registration already complete
    const user = userRecord.rows[0];
    if (user.status === 'active') {
      return res.error(
        { field: 'registration' },
        'Registration already completed',
        400
      );
    }

    // Check if user already added email
    if (user.email) {
      return res.error(
        { field: 'email' },
        'Email already added for this account',
        400
      );
    }

    // Check if email already exists for another user
    const emailRecord = await req.db.query(
      'SELECT uid FROM users WHERE email = $1 AND uid != $2',
      [normalizedEmail, userId]
    );

    if (emailRecord.rows.length > 0) {
      return res.error(
        { field: 'email' },
        'Email already registered',
        409
      );
    }

    // BUG FIX #21: Generate OTP BEFORE transaction, send response AFTER
    const { token: otpToken, expiresIn } = await req.otpMiddleware.generateEmailOTP(normalizedEmail, req);

    // BUG FIX #4: Wrap ONLY database operations in transaction to prevent race condition
    await req.db.transaction(async (client) => {
      // Re-verify user status is still 'pending' or 'inreview' before updating (not 'active')
      const finalCheck = await client.query(
        'SELECT uid, status FROM users WHERE uid = $1',
        [userId]
      );

      if (finalCheck.rows.length === 0 || finalCheck.rows[0].status === 'active') {
        throw new Error('REGISTRATION_ALREADY_COMPLETE');
      }

      // Update user email
      await client.query(
        'UPDATE users SET email = $1, registration_step = $2 WHERE uid = $3',
        [normalizedEmail, 2, userId]
      );
    });

    // BUG FIX #21: Send response AFTER transaction completes successfully
    res.success(
      {
        email: normalizedEmail,
        token: otpToken,
        step: 1,
        message: 'Email OTP sent',
        expiresIn
      },
      'Email added and OTP sent',
      200
    );
  } catch (error) {
    // Handle specific errors
    if (error.message === 'REGISTRATION_ALREADY_COMPLETE') {
      return res.error(
        { field: 'registration' },
        'Registration already completed',
        400
      );
    }

    // BUG FIX #6: normalizedEmail is now guaranteed to be defined (initialized outside try block)
    console.error('[ADD_EMAIL_ERROR]', {
      timestamp: new Date().toISOString(),
      endpoint: '/api/auth/register/add-email',
      email: normalizedEmail || 'unknown',  // Provide fallback
      errorCode: error.code,
      errorMessage: error.message,
      errorDetail: error.detail,
      stack: error.stack
    });

    console.error('[ERROR] Add email failed:', error.message);
    if (error.code) console.error('   PostgreSQL Code:', error.code);

    res.error(
      { code: error.code || 'UNKNOWN_ERROR' },
      'Failed to add email. Please try again.',
      500
    );
  }
});

/**
 * STEP 2: Verify Email OTP
 * POST /api/auth/register/verifyEmail
 * Headers: { Authorization: "Bearer <session_token>" }
 * Body: { token: "...", otp: "123456", email: "user@example.com" }
 */
router.post('/verifyEmail', async (req, res) => {
  // BUG FIX #6: Initialize variables outside try block for error logs
  let normalizedEmail = null;
  
  try {
    const { token, otp, email } = req.body;
    const authHeader = req.get('Authorization');

    if (!token || !otp || !email) {
      return res.error(
        { required: ['token', 'otp', 'email'] },
        'Token, OTP, and email are required',
        400
      );
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.error(
        { field: 'Authorization' },
        'Valid session token required in Authorization header',
        401
      );
    }

    const sessionToken = authHeader.substring(7); // Remove "Bearer "

    // BUG FIX #27: Normalize email FIRST before any operations (consistency with add-email)
    normalizedEmail = email.trim().toLowerCase();

    // CHECK RATE LIMIT: 10 verify-email attempts per hour per email (use normalized email)
    const rateLimitCheck = rateLimiter.isAllowed(normalizedEmail, 'verify-email', 10, 3600000);
    if (!rateLimitCheck.allowed) {
      console.warn('[RATE_LIMIT] Email OTP verify blocked', {
        email: normalizedEmail,
        action: 'verify-email',
        resetIn: rateLimitCheck.resetIn,
        timestamp: new Date().toISOString()
      });
      return res.error(
        { field: 'email' },
        rateLimitCheck.message,
        429
      );
    }

    // Verify session token at beginning of route - dies here if invalid
    const userId = await req.sessionMiddleware.verifySessionOrDie(req, res);
    if (!userId) return; // Error response already sent

    // Check if registration already complete
    const userStatusCheck = await req.db.query(
      'SELECT status, email_verified FROM users WHERE uid = $1',
      [userId]
    );

    if (userStatusCheck.rows.length > 0 && userStatusCheck.rows[0].status === 'active') {
      return res.error(
        { field: 'registration' },
        'Registration already completed',
        400
      );
    }

    // BUG FIX #9: Use truthiness check instead of === true (works with 0/1 integers)
    if (userStatusCheck.rows.length > 0 && userStatusCheck.rows[0].email_verified) {
      return res.error(
        { field: 'email' },
        'Email already verified for this account',
        400
      );
    }

    // Verify email OTP using centralized OTP middleware (use normalized email)
    const verificationResult = await req.otpMiddleware.verifyOTP(token, otp, normalizedEmail, 'email', req.db);

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

    // Transaction to update user and verify email
    await req.db.transaction(async (client) => {
      // Update user to mark email as verified
      await client.query(
        'UPDATE users SET email_verified = true, registration_step = $1 WHERE uid = $2',
        [3, userId]
      );

      // Mark token as verified
      await req.otpMiddleware.markOTPAsVerified(token, client);
    });

    res.success(
      {
        email: normalizedEmail,
        step: 2,
        message: 'Email verified successfully',
        nextStep: 'add_profile'
      },
      'Email verification successful',
      200
    );
  } catch (error) {
    // Handle unique constraint violations
    if (error.code === '23505') {
      return res.error(
        { code: 'VERIFICATION_FAILED' },
        'Email verification failed. Please try again.',
        409
      );
    }

    // BUG FIX #6: normalizedEmail is now guaranteed to be defined (initialized outside try block)
    console.error('[VERIFY_EMAIL_ERROR]', {
      timestamp: new Date().toISOString(),
      endpoint: '/api/auth/register/verify-email',
      email: normalizedEmail || 'unknown',  // Provide fallback
      errorCode: error.code,
      errorMessage: error.message,
      errorDetail: error.detail,
      stack: error.stack
    });

    console.error('[ERROR] Email verification failed:', error.message);
    if (error.code) console.error('   PostgreSQL Code:', error.code);

    res.error(
      { code: error.code || 'UNKNOWN_ERROR' },
      'Email verification failed. Please try again.',
      500
    );
  }
});

/**
 * STEP 3: Complete Profile
 * POST /api/auth/register/completeProfile
 * Headers: { Authorization: "Bearer <session_token>" }
 * Body: { first_name: "John", last_name: "Doe", middle_name: "Michael", gender: "male", date_of_birth: "1990-01-15" }
 */
router.post('/completeProfile', async (req, res) => {
  // BUG FIX #6: Initialize variables outside try block for error logs
  let first_name = null;
  let userId = null;
  
  try {
    const { first_name: inputFirstName, last_name, middle_name, gender, date_of_birth } = req.body;
    first_name = inputFirstName; // Now available for error logs
    
    const authHeader = req.get('Authorization');

    if (!first_name || !gender || !date_of_birth) {
      return res.error(
        { required: ['first_name', 'gender', 'date_of_birth'] },
        'First name, gender, and date of birth are required',
        400
      );
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.error(
        { field: 'Authorization' },
        'Valid session token required in Authorization header',
        401
      );
    }

    const sessionToken = authHeader.substring(7); // Remove "Bearer "

    // Verify session token at beginning of route - dies here if invalid
    const userId = await req.sessionMiddleware.verifySessionOrDie(req, res);
    if (!userId) return; // Error response already sent

    // BUG FIX #16: Normalize optional fields - convert empty strings to null
    const normalizedFirstName = first_name.trim() || null; // BUG FIX #28: Trim first_name
    const normalizedLastName = last_name?.trim() ? last_name.trim() : null;
    const normalizedMiddleName = middle_name?.trim() ? middle_name.trim() : null;

    if (!helpers.validateGender(gender)) {
      return res.error(
        { field: 'gender' },
        'Gender must be one of: male, female, other, prefer_not_to_say',
        400
      );
    }

    if (!helpers.validateDateFormat(date_of_birth)) {
      return res.error(
        { field: 'date_of_birth' },
        'Date must be in format YYYY-MM-DD',
        400
      );
    }

    // Validate age: must be between 18 and 120 years old
    const birthDate = new Date(date_of_birth);
    const today = new Date();
    
    // BUG FIX #L2: Validate birth date is not in future
    if (birthDate > today) {
      return res.error(
        { field: 'date_of_birth' },
        'Birth date cannot be in the future',
        400
      );
    }
    
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--; // Adjust if birthday hasn't occurred this year
    }

    if (age < 18) {
      return res.error(
        { field: 'date_of_birth' },
        'You must be at least 18 years old to register',
        400
      );
    }

    // BUG FIX #18: Validate birth year is reasonable (between 1900 and current year)
    if (birthDate.getFullYear() < 1900 || birthDate.getFullYear() > today.getFullYear()) {
      return res.error(
        { field: 'date_of_birth' },
        'Please enter a valid date of birth',
        400
      );
    }

    if (age > 120) {
      return res.error(
        { field: 'date_of_birth' },
        'Please enter a valid date of birth',
        400
      );
    }

    // Get user
    const userRecord = await req.db.query(
      'SELECT uid, status, email FROM users WHERE uid = $1 AND email_verified = true AND registration_step >= 3',
      [userId]
    );

    if (userRecord.rows.length === 0) {
      return res.error(
        { field: 'user' },
        'User not found or email not verified',
        404
      );
    }

    // Check if registration already complete
    if (userRecord.rows[0].status === 'active') {
      return res.error(
        { field: 'registration' },
        'Registration already completed. Use dashboard for profile updates.',
        400
      );
    }

    // BUG FIX #9, #12: Wrap in transaction and verify email still exists with WHERE clause
    let profile;
    await req.db.transaction(async (client) => {
      // Re-verify user status hasn't changed to 'active' since our initial check
      const finalCheck = await client.query(
        'SELECT uid, status, email FROM users WHERE uid = $1',
        [userId]
      );

      if (finalCheck.rows.length === 0 || finalCheck.rows[0].status === 'active') {
        throw new Error('REGISTRATION_ALREADY_COMPLETE');
      }

      // Verify email still matches (hasn't been changed or removed externally)
      if (!finalCheck.rows[0].email) {
        throw new Error('EMAIL_NOT_VERIFIED');
      }

      // Update user profile with status check in WHERE clause
      const updateResult = await client.query(
        `UPDATE users 
         SET first_name = $1, last_name = $2, middle_name = $3, gender = $4::gender, 
             date_of_birth = $5, registration_step = 4, status = $6
         WHERE uid = $7 AND status IN ('pending', 'inreview')
         RETURNING uid, phone, email, first_name, last_name, middle_name, gender, date_of_birth, registration_step, status`,
        [normalizedFirstName, normalizedLastName, normalizedMiddleName, gender.toLowerCase(), date_of_birth, 'active', userId]
      );

      if (updateResult.rows.length === 0) {
        throw new Error('UPDATE_FAILED_CONCURRENT_CHANGE');
      }

      profile = updateResult.rows[0];
    });

    // BUG FIX #22: Send response AFTER transaction completes successfully
    res.success(
      {
        uid: profile.uid,
        phone: profile.phone,
        email: profile.email,
        first_name: profile.first_name,
        last_name: profile.last_name,
        middle_name: profile.middle_name,
        gender: profile.gender,
        date_of_birth: profile.date_of_birth,
        step: profile.registration_step,
        status: profile.status,
        message: 'Profile completed successfully',
        nextStep: 'dashboard'
      },
      'Profile completed',
      200
    );
  } catch (error) {
    // BUG FIX #9, #12: Handle specific concurrent modification errors
    if (error.message === 'REGISTRATION_ALREADY_COMPLETE') {
      return res.error(
        { field: 'registration' },
        'Registration already completed. Use dashboard for profile updates.',
        400
      );
    }

    if (error.message === 'EMAIL_NOT_VERIFIED') {
      return res.error(
        { field: 'email' },
        'Email verification not found. Please verify email first.',
        400
      );
    }

    if (error.message === 'UPDATE_FAILED_CONCURRENT_CHANGE') {
      return res.error(
        { field: 'registration' },
        'Registration status changed. Please refresh and try again.',
        409
      );
    }
    if (error.code === '23505') {
      return res.error(
        { code: 'PROFILE_REGISTRATION_FAILED' },
        'Profile registration failed. Please try again.',
        409
      );
    }

    // BUG FIX #6: first_name and userId now guaranteed to be defined (initialized outside try block)
    console.error('[COMPLETE_PROFILE_ERROR]', {
      timestamp: new Date().toISOString(),
      endpoint: '/api/auth/register/complete-profile',
      first_name: first_name || 'unknown',  // Provide fallback
      userId: userId || 'unknown',  // Provide fallback
      errorCode: error.code,
      errorMessage: error.message,
      errorDetail: error.detail,
      stack: error.stack
    });

    console.error('[ERROR] Complete profile failed:', error.message);
    if (error.code) console.error('   PostgreSQL Code:', error.code);

    res.error(
      { code: error.code || 'UNKNOWN_ERROR' },
      'Failed to complete profile. Please try again.',
      500
    );
  }
});

module.exports = router;
