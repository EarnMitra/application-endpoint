/**
 * User Route Helpers
 * Helper functions for user profile management
 */

/**
 * Get registration status and check if user is stuck
 */
const getRegistrationStatus = (user) => {
  const steps = {
    0: { step: 'not_started', description: 'Registration not started', nextStep: 'phone_verification' },
    1: { step: 'phone_verified', description: 'Phone verified', nextStep: 'add_email', required: ['phone_verified'] },
    2: { step: 'email_added', description: 'Email added', nextStep: 'verify_email', required: ['email_verified'] },
    3: { step: 'email_verified', description: 'Email verified', nextStep: 'complete_profile', required: ['first_name', 'last_name'] },
    4: { step: 'profile_completed', description: 'Profile completed', nextStep: 'kyc_submission', required: ['gender', 'date_of_birth'] },
    5: { step: 'kyc_submitted', description: 'KYC submitted', nextStep: 'kyc_verification' }
  };

  const currentStepInfo = steps[user.registration_step] || steps[0];
  const isComplete = user.status === 'active';

  return {
    currentStep: user.registration_step,
    stepInfo: currentStepInfo,
    isStuck: !isComplete && user.status !== 'inreview',
    status: user.status,
    phoneVerified: user.phone_verified,
    emailVerified: user.email_verified,
    message: isComplete 
      ? 'User registration is complete' 
      : `User is at step ${user.registration_step}: ${currentStepInfo.description}`
  };
};

/**
 * Fetch user profile info
 */
const fetchUserProfile = async (db, userId) => {
  try {
    const result = await db.query(
      `SELECT uid, referral_code, occupation, years_of_experience, 
              languages, city_of_operation, created_at, updated_at
       FROM user_profiles WHERE uid = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return {
      referralCode: result.rows[0].referral_code,
      occupation: result.rows[0].occupation,
      yearsOfExperience: result.rows[0].years_of_experience,
      languages: result.rows[0].languages,
      cityOfOperation: result.rows[0].city_of_operation
    };
  } catch (error) {
    console.error('[FETCH_USER_PROFILE_ERROR]', error.message);
    return null;
  }
};

/**
 * Fetch user wallet info
 */
const fetchWalletInfo = async (db, userId) => {
  try {
    const result = await db.query(
      `SELECT wallet_id, balance, currency, total_credited, total_debited, 
              coins_balance, total_coins_earned, total_coins_spent, 
              pending_withdrawal, total_withdrawn, monthly_bonus, 
              freeze_amount, status, status_message, last_transaction_at
       FROM user_wallets WHERE uid = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const wallet = result.rows[0];
    return {
      walletId: wallet.wallet_id,
      balance: parseFloat(wallet.balance),
      currency: wallet.currency,
      totalCredited: parseFloat(wallet.total_credited),
      totalDebited: parseFloat(wallet.total_debited),
      coinsBalance: wallet.coins_balance,
      totalCoinsEarned: wallet.total_coins_earned,
      totalCoinsSpent: wallet.total_coins_spent,
      pendingWithdrawal: parseFloat(wallet.pending_withdrawal),
      totalWithdrawn: parseFloat(wallet.total_withdrawn),
      monthlyBonus: parseFloat(wallet.monthly_bonus),
      freezeAmount: parseFloat(wallet.freeze_amount),
      status: wallet.status,
      statusMessage: wallet.status_message,
      lastTransactionAt: wallet.last_transaction_at
    };
  } catch (error) {
    console.error('[FETCH_WALLET_ERROR]', error.message);
    return null;
  }
};

/**
 * Fetch user bank account info
 */
const fetchBankAccount = async (db, userId) => {
  try {
    const result = await db.query(
      `SELECT bid, bank_account_number, ifsc_code, bank_name, branch_name, created_at, updated_at
       FROM bank_accounts WHERE uid = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const bank = result.rows[0];
    return {
      bid: bank.bid,
      accountNumber: bank.bank_account_number,
      ifscCode: bank.ifsc_code,
      bankName: bank.bank_name,
      branchName: bank.branch_name
    };
  } catch (error) {
    console.error('[FETCH_BANK_ACCOUNT_ERROR]', error.message);
    return null;
  }
};

/**
 * Fetch user KYC info
 */
const fetchKYCInfo = async (db, userId) => {
  try {
    const result = await db.query(
      `SELECT kycid, pan_number, pan_image_url, aadhaar_number, 
              aadhaar_front_image_url, aadhaar_back_image_url, kyc_selfie_url, 
              kyc_video_url, face_match_score, full_address, city, state, 
              postal_code, country, kyc_status, verification_notes, 
              verified_at, submitted_at, created_at, updated_at
       FROM kyc_documents WHERE uid = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const kyc = result.rows[0];
    return {
      kycId: kyc.kycid,
      panNumber: kyc.pan_number,
      panImageUrl: kyc.pan_image_url,
      aadhaarNumber: kyc.aadhaar_number,
      aadhaarFrontImageUrl: kyc.aadhaar_front_image_url,
      aadhaarBackImageUrl: kyc.aadhaar_back_image_url,
      kycSelfieUrl: kyc.kyc_selfie_url,
      kycVideoUrl: kyc.kyc_video_url,
      faceMatchScore: kyc.face_match_score,
      fullAddress: kyc.full_address,
      city: kyc.city,
      state: kyc.state,
      postalCode: kyc.postal_code,
      country: kyc.country,
      kycStatus: kyc.kyc_status,
      verificationNotes: kyc.verification_notes,
      verifiedAt: kyc.verified_at,
      submittedAt: kyc.submitted_at
    };
  } catch (error) {
    console.error('[FETCH_KYC_ERROR]', error.message);
    return null;
  }
};

/**
 * Fetch last login info
 */
const fetchLastLogin = async (db, userId) => {
  try {
    const result = await db.query(
      `SELECT lhid, login_status, ip_address, device_name, os_type, 
              browser_type, location, latitude, longitude, login_at, logout_at
       FROM login_history WHERE uid = $1 
       ORDER BY login_at DESC LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const login = result.rows[0];
    return {
      loginHistoryId: login.lhid,
      status: login.login_status,
      ipAddress: login.ip_address,
      deviceName: login.device_name,
      osType: login.os_type,
      browserType: login.browser_type,
      location: login.location,
      latitude: login.latitude,
      longitude: login.longitude,
      loginAt: login.login_at,
      logoutAt: login.logout_at
    };
  } catch (error) {
    console.error('[FETCH_LAST_LOGIN_ERROR]', error.message);
    return null;
  }
};

/**
 * Fetch user verification history (phone & email)
 */
const fetchVerificationHistory = async (db, userId) => {
  try {
    const result = await db.query(
      `SELECT vid, type, target_value, is_verified, device_name, os_type, 
              browser_type, ip_address, location, verified_at
       FROM user_verified WHERE uid = $1 
       ORDER BY verified_at DESC LIMIT 10`,
      [userId]
    );

    if (result.rows.length === 0) {
      return [];
    }

    return result.rows.map(row => ({
      vid: row.vid,
      type: row.type,
      targetValue: row.target_value,
      isVerified: row.is_verified,
      deviceName: row.device_name,
      osType: row.os_type,
      browserType: row.browser_type,
      ipAddress: row.ip_address,
      location: row.location,
      verifiedAt: row.verified_at
    }));
  } catch (error) {
    console.error('[FETCH_VERIFICATION_HISTORY_ERROR]', error.message);
    return [];
  }
};

module.exports = {
  getRegistrationStatus,
  fetchUserProfile,
  fetchWalletInfo,
  fetchBankAccount,
  fetchKYCInfo,
  fetchLastLogin,
  fetchVerificationHistory
};
