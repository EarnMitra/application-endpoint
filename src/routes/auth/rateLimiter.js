/**
 * Rate Limiter for Phone OTP
 * Prevents brute force attacks on OTP endpoints
 */

class RateLimiter {
  constructor() {
    this.attempts = {}; // { phone: [{ timestamp, action }, ...] }
    this.cleanupInterval = null; // BUG FIX #4: Store interval ID for cleanup on shutdown
  }

  /**
   * Check if request is allowed
   * @param {string} phone - Phone number
   * @param {string} action - 'initiate' or 'verify'
   * @param {number} maxAttempts - Max attempts allowed
   * @param {number} windowMs - Time window in milliseconds
   * @returns {object} { allowed: boolean, remaining: number, resetIn: number }
   */
  isAllowed(phone, action, maxAttempts = 5, windowMs = 3600000) {
    // 3600000ms = 1 hour default
    const now = Date.now();
    const key = `${phone}:${action}`;

    // Initialize if not exists
    if (!this.attempts[key]) {
      this.attempts[key] = [];
    }

    // Remove old attempts outside the window
    this.attempts[key] = this.attempts[key].filter(
      (attempt) => now - attempt.timestamp < windowMs
    );

    const currentAttempts = this.attempts[key].length;

    if (currentAttempts >= maxAttempts) {
      // Rate limited
      const oldestAttempt = this.attempts[key][0];
      const resetIn = Math.ceil(
        (oldestAttempt.timestamp + windowMs - now) / 1000
      ); // in seconds

      return {
        allowed: false,
        remaining: 0,
        resetIn,
        message: `Too many ${action} attempts. Try again in ${resetIn} seconds.`
      };
    }

    // Record this attempt
    this.attempts[key].push({ timestamp: now });

    return {
      allowed: true,
      remaining: maxAttempts - currentAttempts - 1,
      resetIn: 0,
      message: `Request allowed. ${maxAttempts - currentAttempts - 1} attempts remaining.`
    };
  }

  /**
   * Reset rate limit for a phone number
   */
  reset(phone, action = null) {
    if (action) {
      const key = `${phone}:${action}`;
      delete this.attempts[key];
    } else {
      // Reset all actions for this phone
      Object.keys(this.attempts).forEach((key) => {
        if (key.startsWith(`${phone}:`)) {
          delete this.attempts[key];
        }
      });
    }
  }

  /**
   * Get current stats for a phone number
   */
  getStats(phone, action) {
    const key = `${phone}:${action}`;
    return {
      attempts: this.attempts[key] ? this.attempts[key].length : 0,
      key
    };
  }

  /**
   * Cleanup old entries (call periodically)
   */
  cleanup() {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    // BUG FIX #24: Use Object.entries() for better performance than Object.keys()
    Object.entries(this.attempts).forEach(([key, attempts]) => {
      const filtered = attempts.filter((attempt) => attempt.timestamp > oneHourAgo);
      if (filtered.length === 0) {
        delete this.attempts[key];
      } else {
        this.attempts[key] = filtered;
      }
    });
  }

  /**
   * BUG FIX #4: Initialize cleanup interval and return ID for later clearing
   * BUG FIX #27: Make cleanup interval configurable via env var
   */
  initializeCleanupInterval() {
    if (this.cleanupInterval) {
      return; // Already initialized
    }
    // BUG FIX #27: Use env var for cleanup interval (default 10 minutes if not set)
    const cleanupIntervalMinutes = parseInt(process.env.RATE_LIMITER_CLEANUP_INTERVAL_MINUTES, 10) || 10;
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, cleanupIntervalMinutes * 60 * 1000);
  }

  /**
   * BUG FIX #4: Stop cleanup interval on shutdown
   */
  stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Create singleton instance
const rateLimiter = new RateLimiter();

// BUG FIX #4: Initialize cleanup interval
rateLimiter.initializeCleanupInterval();

// BUG FIX #M5: Add shutdown handler to stop cleanup interval and prevent memory leaks
process.on('SIGTERM', () => {
  console.log('[SHUTDOWN] Stopping rate limiter cleanup interval...');
  rateLimiter.stopCleanupInterval();
});

process.on('SIGINT', () => {
  console.log('[SHUTDOWN] Stopping rate limiter cleanup interval...');
  rateLimiter.stopCleanupInterval();
});

module.exports = rateLimiter;
