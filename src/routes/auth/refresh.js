/**
 * Token Refresh Route
 * Handles refresh token validation and new session token generation
 * 
 * REFRESH TOKEN LIFETIME DESIGN:
 * - Refresh tokens are LIFETIME - never expire by time
 * - Only expire when explicitly revoked (status changed to 'revoked')
 * - When a refresh token is used, the old session is immediately revoked
 * - Returns new session_token (expires in 1 day default) and new refresh_token (lifetime)
 * - Old refresh_token cannot be used again after revocation
 * 
 * Configure session duration: SESSION_EXPIRATION_SECONDS in .env (default 86400 = 1 day)
 */

const express = require('express');
const router = express.Router();

/**
 * Refresh Session Token
 * POST /api/auth/refresh-token
 * Body: { refresh_token: "...", device_fingerprint: "..." (optional) }
 * Returns: { session_token, refresh_token, refresh_token_updated, expires_at, expires_in }
 */
router.post('/refresh-token', async (req, res) => {
  try {
    const { refresh_token, device_fingerprint } = req.body;

    if (!refresh_token) {
      return res.error(
        { required: ['refresh_token'] },
        'Refresh token is required',
        400
      );
    }

    // Validate refresh token exists (NO expiration check - refresh tokens are lifetime)
    const tokenRecord = await req.db.query(
      `SELECT uid FROM sessions 
       WHERE refresh_token = $1 
       AND status = $2`,
      [refresh_token, 'active']
    );

    if (tokenRecord.rows.length === 0) {
      console.warn('[REFRESH_TOKEN_INVALID]', {
        timestamp: new Date().toISOString(),
        refresh_token: refresh_token.substring(0, 10) + '...',
        ip: req.ip,
        reason: 'Token not found or already revoked'
      });

      return res.error(
        { field: 'refresh_token' },
        'Invalid or revoked refresh token',
        401
      );
    }

    const userId = tokenRecord.rows[0].uid;

    // Get full session data for device info
    const fullSessionRecord = await req.db.query(
      `SELECT device_name, os_type, browser_type, 
              ip_address, user_agent, location, latitude, longitude
       FROM sessions 
       WHERE refresh_token = $1`,
      [refresh_token]
    );

    if (fullSessionRecord.rows.length === 0) {
      throw new Error('SESSION_DATA_NOT_FOUND');
    }

    const session = fullSessionRecord.rows[0];

    // Use provided fingerprint or generate new one from current request
    const finalFingerprint = device_fingerprint && device_fingerprint.trim() 
      ? device_fingerprint.trim() 
      : require('../../routes/auth/helpers').generateDeviceFingerprint(req.get('user-agent'), {});

    // Create device info object from stored session data + fingerprint param
    const deviceInfo = {
      device_name: session.device_name,
      device_fingerprint: finalFingerprint,
      os_type: session.os_type,
      browser_type: session.browser_type,
      ip_address: session.ip_address,
      user_agent: session.user_agent,
      location: session.location,
      latitude: session.latitude,
      longitude: session.longitude
    };

    // Generate new session token using sessionMiddleware
    let newSessionToken;
    let newRefreshToken;
    let refreshTokenUpdated = false;
    // Default: 1 day (86400 seconds), Configure via SESSION_EXPIRATION_SECONDS in .env
    const sessionExpirationSeconds = parseInt(process.env.SESSION_EXPIRATION_SECONDS, 10) || 86400;
    const newSessionExpires = new Date(Date.now() + sessionExpirationSeconds * 1000);

    // Create new session in database
    await req.db.transaction(async (client) => {
      // Verify refresh token still valid in transaction
      const verifyToken = await client.query(
        `SELECT uid FROM sessions 
         WHERE refresh_token = $1 
         AND status = $2`,
        [refresh_token, 'active']
      );

      if (verifyToken.rows.length === 0) {
        throw new Error('REFRESH_TOKEN_REVOKED');
      }

      // Create new session using sessionMiddleware
      const result = await req.sessionMiddleware.createUserSession(client, userId, deviceInfo);
      newSessionToken = result.sessionToken;
      newRefreshToken = result.refreshToken;
      refreshTokenUpdated = true; // Always true since createUserSession generates new refresh token

      // IMPORTANT: Revoke old session immediately when refresh token is used
      // This invalidates the old refresh token
      await client.query(
        `UPDATE sessions SET status = $1 WHERE refresh_token = $2`,
        ['revoked', refresh_token]
      );
    });

    console.log('[REFRESH_TOKEN_SUCCESS]', {
      timestamp: new Date().toISOString(),
      userId: userId,
      ip: req.ip,
      fingerprintProvided: !!device_fingerprint,
      newTokenPreview: newSessionToken.substring(0, 10) + '...'
    });

    res.success(
      {
        session_token: newSessionToken,
        refresh_token: newRefreshToken,
        refresh_token_updated: refreshTokenUpdated
      },
      'Session token refreshed successfully',
      200
    );
  } catch (error) {
    if (error.message === 'REFRESH_TOKEN_REVOKED') {
      return res.error(
        { field: 'refresh_token' },
        'Refresh token has been revoked. Please login again.',
        401
      );
    }

    if (error.message === 'SESSION_DATA_NOT_FOUND') {
      return res.error(
        { field: 'refresh_token' },
        'Session data not found. Please login again.',
        401
      );
    }

    console.error('[REFRESH_TOKEN_ERROR]', {
      timestamp: new Date().toISOString(),
      endpoint: '/api/auth/refresh-token',
      errorMessage: error.message,
      errorCode: error.code,
      errorDetail: error.detail,
      stack: error.stack
    });

    console.error('❌ Token refresh failed:', error.message);
    if (error.code) console.error('   PostgreSQL Code:', error.code);

    res.error(
      { code: error.code || 'UNKNOWN_ERROR' },
      'Failed to refresh token. Please login again.',
      500
    );
  }
});

module.exports = router;
