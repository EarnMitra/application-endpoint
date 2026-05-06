/**
 * Application Configuration and State
 * Stores application mode, settings, and parameters
 * Accessible by all routes and branches
 * 
 * Modes: 'dev' (development) or 'live' (production)
 */

class AppConfig {
  constructor() {
    this.initialized = false;
    this.mode = null;
    this.modeConstants = {
      DEV: 'dev',
      LIVE: 'live'
    };
    this.outputTypes = {
      JSON: 'json',
      XML: 'xml',
      TEXT: 'text'
    };
    this.config = {};
  }

  /**
   * Initialize application configuration
   * @param {string} nodeEnv - NODE_ENV value (development, production, etc.)
   * @param {string} port - Server port
   * @param {string} outputType - Default output type
   */
  initialize(nodeEnv, port, outputType = 'json') {
    const env = nodeEnv || 'dev';
    const normalizedEnv = env.toLowerCase();

    // Determine mode: only 'dev' or 'live'
    if (normalizedEnv === 'prod' || normalizedEnv === 'live') {
      this.mode = this.modeConstants.LIVE;
    } else {
      this.mode = this.modeConstants.DEV;
    }

    this.config = {
      mode: this.mode,
      port: port,
      outputType: outputType.toLowerCase(),
      nodeEnv: env,
      timestamp: new Date().toISOString(),
      isDev: this.mode === this.modeConstants.DEV,
      isLive: this.mode === this.modeConstants.LIVE,
      version: '1.0.0',
      name: 'EarnMitra Server',
      author: 'SK Sharma'
    };

    this.initialized = true;
    return this.config;
  }

  /**
   * Get full configuration as JSON
   */
  getConfig() {
    return {
      ...this.config,
      modes: this.modeConstants,
      outputTypes: this.outputTypes
    };
  }

  /**
   * Get current mode
   */
  getMode() {
    return this.mode;
  }

  /**
   * Check if specific mode
   */
  isMode(modeCheck) {
    return this.mode === modeCheck;
  }

  /**
   * Get configuration value
   */
  get(key) {
    return this.config[key];
  }
}

// Export singleton instance
module.exports = new AppConfig();
