/**
 * Mode Middleware
 * Detects the application mode (DEBUG, TEST, PROD) from environment
 * and attaches it to the request object for use in routes and other middlewares
 */

const appConfig = require('../config/appConfig');

// Mode constants
const MODES = {
  DEBUG: 'debug',
  TEST: 'test',
  PROD: 'production'
};

// Output types
const OUTPUT_TYPES = {
  JSON: 'json',
  XML: 'xml',
  TEXT: 'text'
};

const modeMiddleware = (req, res, next) => {
  // Get current mode and config from appConfig
  const mode = appConfig.getMode();
  const config = appConfig.getConfig();
  
  // Attach mode to request object
  req.appMode = mode;
  req.appConfig = config;
  
  // Add mode details with constants
  req.isDebugMode = mode === MODES.DEBUG;
  req.isTestMode = mode === MODES.TEST;
  req.isProductionMode = mode === MODES.PROD;
  
  // Add output type
  req.outputType = config.outputType || OUTPUT_TYPES.JSON;
  
  // Add mode constants for use in routes
  req.MODES = MODES;
  req.OUTPUT_TYPES = OUTPUT_TYPES;
  
  // Add mode to response headers for debugging
  if (mode !== MODES.PROD) {
    res.set('X-App-Mode', mode.toUpperCase());
    res.set('X-Output-Type', req.outputType.toUpperCase());
  }
  
  next();
};

module.exports = modeMiddleware;
module.exports.MODES = MODES;
module.exports.OUTPUT_TYPES = OUTPUT_TYPES;
