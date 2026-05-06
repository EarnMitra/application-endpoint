/**
 * User Registration Status Routes
 * Handles user registration status checks
 */

const express = require('express');
const router = express.Router();
const helpers = require('./helpers');

/**
 * Get Registration Status
 * GET /api/user/registration-status
 * Headers: { Authorization: "Bearer <session_token>" }
 * 
 * Returns current registration step and whether user is stuck
 */
router.get('/registration-status', async (req, res) => {
  try {
    const authHeader = req.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.error(
        { field: 'Authorization' },
        'Valid session token required in Authorization header',
        401
      );
    }

    const sessionToken = authHeader.substring(7);

    const userId = await helpers.validateSessionToken(req.db, sessionToken);
    if (!userId) {
      return res.error(
        { field: 'Authorization' },
        'Invalid or expired session token',
        401
      );
    }

    const userResult = await req.db.query(
      `SELECT registration_step, status, email_verified, phone_verified 
       FROM users WHERE uid = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.notFound('User not found');
    }

    const user = userResult.rows[0];
    const registrationStatus = helpers.getRegistrationStatus(user);

    res.success(
      registrationStatus,
      'Registration status fetched successfully',
      200
    );

  } catch (error) {
    console.error('[REGISTRATION_STATUS_ERROR]', {
      timestamp: new Date().toISOString(),
      endpoint: '/api/user/registration-status',
      errorMessage: error.message
    });

    res.error(
      { code: error.code || 'UNKNOWN_ERROR' },
      'Failed to fetch registration status. Please try again.',
      500
    );
  }
});

module.exports = router;
