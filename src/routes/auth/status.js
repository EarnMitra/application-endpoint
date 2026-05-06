/**
 * Registration Status Route
 * Check user registration progress
 */

const express = require('express');
const router = express.Router();
const helpers = require('./helpers');

/**
 * Check Registration Status
 * GET /api/auth/status?phone=9876543210
 */
router.get('/status', async (req, res) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      return res.error(
        { field: 'phone' },
        'Phone number is required',
        400
      );
    }

    const cleanPhone = helpers.cleanPhone(phone);

    // BUG FIX #8: Validate phone format before database query
    if (!helpers.validatePhone(cleanPhone)) {
      return res.error(
        { field: 'phone' },
        'Invalid phone number format',
        400
      );
    }

    const userRecord = await req.db.query(
      'SELECT uid, registration_step, phone_verified, email_verified, first_name, email FROM users WHERE phone = $1',
      [cleanPhone]
    );

    if (userRecord.rows.length === 0) {
      return res.error(
        { field: 'phone' },
        'User not found',
        404
      );
    }

    const user = userRecord.rows[0];
    const steps = {
      0: 'not_started',
      1: 'phone_verified',
      2: 'email_added',
      3: 'email_verified',
      4: 'profile_complete'
    };

    // BUG FIX #10: Validate registration_step is within bounds
    if (user.registration_step < 0 || user.registration_step > 4) {
      throw new Error(`Invalid registration step: ${user.registration_step}`);
    }

    res.success(
      {
        uid: user.uid,
        currentStep: user.registration_step,
        stepName: steps[user.registration_step],
        phoneVerified: user.phone_verified,
        emailVerified: user.email_verified,
        email: user.email,
        firstName: user.first_name,
        isRegistrationComplete: user.registration_step === 4
      },
      'Registration status retrieved',
      200
    );
  } catch (error) {
    // BUG FIX #15: Add fallback for phone variable in error log
    console.error('[STATUS_CHECK_ERROR]', {
      timestamp: new Date().toISOString(),
      endpoint: '/api/auth/status',
      phone: phone || 'not_provided',
      errorCode: error.code,
      errorMessage: error.message,
      errorDetail: error.detail,
      stack: error.stack
    });

    console.error('[ERROR] Status check failed:', error.message);
    if (error.code) console.error('   PostgreSQL Code:', error.code);

    res.error(
      { code: error.code || 'UNKNOWN_ERROR' },
      'Failed to check status. Please try again.',
      500
    );
  }
});

module.exports = router;
