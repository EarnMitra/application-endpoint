/**
 * User Details Routes
 * Handles user profile details and information retrieval
 */

const express = require('express');
const router = express.Router();
const helpers = require('./helpers');

/**
 * Fetch All User Details
 * GET /api/user/details
 * Headers: { Authorization: "Bearer <session_token>" }
 * 
 * Returns:
 * - If user is stuck in registration: { step_info with current step }
 * - If user is complete: { all user details including profile, wallet, bank, kyc }
 */
router.get('/details', async (req, res) => {
  try {
    const authHeader = req.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.error(
        { field: 'Authorization' },
        'Valid session token required in Authorization header',
        401
      );
    }

    const sessionToken = authHeader.substring(7); // Remove "Bearer "

    // Validate session token and get user ID
    const userId = await helpers.validateSessionToken(req.db, sessionToken);
    if (!userId) {
      return res.error(
        { field: 'Authorization' },
        'Invalid or expired session token',
        401
      );
    }

    // Fetch user basic info
    const userResult = await req.db.query(
      `SELECT uid, username, email, phone, first_name, last_name, middle_name, gender, 
              date_of_birth, profile_picture, phone_verified, email_verified, 
              registration_step, status, created_at, updated_at 
       FROM users WHERE uid = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.notFound('User not found');
    }

    const user = userResult.rows[0];

    // CHECK REGISTRATION STATUS
    const registrationStatus = helpers.getRegistrationStatus(user);
    
    // If user is stuck in a step, return step info instead of all data
    if (registrationStatus.isStuck) {
      return res.success(
        {
          uid: userId,
          registration_status: registrationStatus
        },
        `Registration incomplete. User stuck at ${registrationStatus.currentStep}`,
        200
      );
    }

    // User is complete, fetch all details
    const [userProfile, wallet, bankAccount, kyc, lastLogin, verificationHistory] = await Promise.all([
      helpers.fetchUserProfile(req.db, userId),
      helpers.fetchWalletInfo(req.db, userId),
      helpers.fetchBankAccount(req.db, userId),
      helpers.fetchKYCInfo(req.db, userId),
      helpers.fetchLastLogin(req.db, userId),
      helpers.fetchVerificationHistory(req.db, userId)
    ]);

    // Build complete user details response
    const userDetails = {
      user: {
        uid: user.uid,
        username: user.username,
        email: user.email,
        phone: user.phone,
        firstName: user.first_name,
        lastName: user.last_name,
        middleName: user.middle_name,
        gender: user.gender,
        dateOfBirth: user.date_of_birth,
        profilePicture: user.profile_picture,
        phoneVerified: user.phone_verified,
        emailVerified: user.email_verified,
        registrationStep: user.registration_step,
        status: user.status
      },
      profile: userProfile,
      wallet: wallet,
      bankAccount: bankAccount,
      kyc: kyc,
      lastLogin: lastLogin,
      verificationHistory: verificationHistory
    };

    res.success(
      userDetails,
      'User details fetched successfully',
      200
    );

  } catch (error) {
    console.error('[FETCH_USER_DETAILS_ERROR]', {
      timestamp: new Date().toISOString(),
      endpoint: '/api/user/details',
      errorCode: error.code,
      errorMessage: error.message,
      errorDetail: error.detail,
      stack: error.stack
    });

    console.error('❌ Fetch user details failed:', error.message);

    res.error(
      { code: error.code || 'UNKNOWN_ERROR' },
      'Failed to fetch user details. Please try again.',
      500
    );
  }
});

module.exports = router;
