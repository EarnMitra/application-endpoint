/**
 * Application Configuration and State
 * Stores application mode, settings, and parameters
 * Accessible by all routes and branches
 */

class AppConfig {
  constructor() {
    this.initialized = false;
    this.mode = null;
    this.modeConstants = {
      DEBUG: 'debug',
      TEST: 'test',
      PROD: 'production'
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
   * @param {string} nodeEnv - NODE_ENV value
   * @param {string} port - Server port
   * @param {string} outputType - Default output type
   */
  initialize(nodeEnv, port, outputType = 'json') {
    const env = nodeEnv || 'development';
    const normalizedEnv = env.toLowerCase();

    // Determine mode
    if (normalizedEnv === 'debug') {
      this.mode = this.modeConstants.DEBUG;
    } else if (normalizedEnv === 'test') {
      this.mode = this.modeConstants.TEST;
    } else {
      this.mode = this.modeConstants.PROD;
    }

    this.config = {
      mode: this.mode,
      port: port,
      outputType: outputType.toLowerCase(),
      nodeEnv: env,
      timestamp: new Date().toISOString(),
      isDebug: this.mode === this.modeConstants.DEBUG,
      isTest: this.mode === this.modeConstants.TEST,
      isProd: this.mode === this.modeConstants.PROD,
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
