/**
 * Session Middleware
 * Centralized session management and validation
 * Handles session creation, validation, and token verification
 */

/**
 * Validate session token - returns user ID or null silently (for internal checks)
 * @param {object} client - Database client
 * @param {string} token - Session token from Authorization header
 * @returns {Promise<string|null>} - User ID if valid, null if invalid/expired
 */
const validateSessionToken = async (client, token) => {
  try {
    if (!token || !client) {
      return null;
    }

    const result = await client.query(
      'SELECT uid FROM sessions WHERE session_token = $1 AND status = $2 AND expires_at > NOW()',
      [token, 'active']
    );
    return result.rows.length > 0 ? result.rows[0].uid : null;
  } catch (error) {
    console.error('[SESSION_VALIDATION_ERROR]', {
      timestamp: new Date().toISOString(),
      errorMessage: error.message,
      errorCode: error.code
    });
    return null;
  }
};

/**
 * Verify session token and immediately stop request if invalid
 * Dies right here if auth fails, otherwise continues
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @returns {Promise<string|null>} - User ID if valid, null if already sent error response
 */
const verifySessionOrDie = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    // Check Authorization header exists and has Bearer token
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.error(
        { field: 'Authorization' },
        'Valid session token required in Authorization header',
        401
      );
      return null;
    }

    const sessionToken = authHeader.substring(7); // Remove "Bearer "

    // Validate token against database
    const userId = await validateSessionToken(req.db, sessionToken);

    // If token is invalid or expired - DIE HERE with error response
    if (!userId) {
      // Check if token is expired
      const expiredCheck = await req.db.query(
        'SELECT uid FROM sessions WHERE session_token = $1 AND status = $2 AND expires_at <= NOW()',
        [sessionToken, 'active']
      );

      const isExpired = expiredCheck.rows.length > 0;

      res.error(
        { 
          field: 'Authorization',
          token_status: isExpired ? 'expired' : 'invalid'
        },
        isExpired 
          ? 'Session token has expired. Please use refresh token to get new session.'
          : 'Invalid or missing session token',
        401
      );
      return null;
    }

    // Authorization successful - return userId to continue route
    return userId;

  } catch (error) {
    console.error('[SESSION_VERIFICATION_ERROR]', {
      timestamp: new Date().toISOString(),
      errorMessage: error.message,
      stack: error.stack
    });
    res.error(
      { code: 'SESSION_VERIFICATION_FAILED' },
      'Failed to verify session. Please login again.',
      500
    );
    return null;
  }
};

/**
 * Generate a session token (secure random 64 hex chars)
 */
const generateSessionToken = () => {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex'); // 32 bytes = 64 hex chars
};

/**
 * Generate a refresh token (secure random 16 hex chars)
 */
const generateRefreshToken = () => {
  const crypto = require('crypto');
  return crypto.randomBytes(8).toString('hex'); // 8 bytes = 16 hex chars
};

/**
 * Create a session in the database (used inside transaction)
 * BUG FIX #2: CRITICAL - Properly throw errors so transaction can rollback
 * 
 * REFRESH TOKEN DESIGN:
 * - Session token expires after SESSION_EXPIRATION_SECONDS (default 1 day = 86400 seconds)
 * - Refresh token is LIFETIME (never expires by time, only by status)
 * - When refresh token is used, old session is immediately revoked
 * - Revoked refresh tokens cannot be used again (status != 'active')
 * 
 * Configure via .env: SESSION_EXPIRATION_SECONDS=2592000 (30 days recommended)
 * 
 * @param {object} client - Database transaction client
 * @param {string} userId - User ID
 * @param {object} deviceInfo - Device information object
 * @returns {object} - { sessionToken, refreshToken }
 * @throws {Error} - If session creation fails (allows transaction rollback)
 */
const createUserSession = async (client, userId, deviceInfo) => {
  const sessionToken = generateSessionToken();
  const refreshToken = generateRefreshToken();
  // Default: 1 day (86400 seconds), Configure via SESSION_EXPIRATION_SECONDS in .env
  const sessionExpirationSeconds = parseInt(process.env.SESSION_EXPIRATION_SECONDS, 10) || 86400;
  const sessionExpires = new Date(Date.now() + sessionExpirationSeconds * 1000);

  try {
    await client.query(
      `INSERT INTO sessions (uid, session_token, refresh_token, device_name, device_fingerprint, os_type, browser_type, ip_address, user_agent, location, latitude, longitude, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [userId, sessionToken, refreshToken, deviceInfo.device_name, deviceInfo.device_fingerprint, deviceInfo.os_type, deviceInfo.browser_type, deviceInfo.ip_address, deviceInfo.user_agent, deviceInfo.location, deviceInfo.latitude, deviceInfo.longitude, 'active', sessionExpires]
    );
  } catch (sessionError) {
    console.error('[SESSION_CREATION_ERROR]', {
      uid: userId,
      error: sessionError.message,
      errorCode: sessionError.code,
      timestamp: new Date().toISOString()
    });
    // CRITICAL FIX: Throw error so transaction can ROLLBACK on failure
    throw new Error(`SESSION_CREATION_FAILED: ${sessionError.message}`);
  }

  return { sessionToken, refreshToken };
};

/**
 * Session Middleware
 * Attaches all session utilities to request object
 * This makes them accessible in routes via req.sessionMiddleware
 */
const sessionMiddleware = (req, res, next) => {
  // Attach all session functions to request object
  req.sessionMiddleware = {
    validateSessionToken,
    verifySessionOrDie,
    generateSessionToken,
    generateRefreshToken,
    createUserSession
  };
  
  next();
};

// Export as both middleware and named exports
module.exports = sessionMiddleware;
module.exports.validateSessionToken = validateSessionToken;
module.exports.verifySessionOrDie = verifySessionOrDie;
module.exports.generateSessionToken = generateSessionToken;
module.exports.generateRefreshToken = generateRefreshToken;
module.exports.createUserSession = createUserSession;
