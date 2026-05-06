/**
 * Mode Middleware
 * Detects the application mode (dev or live) from environment
 * and attaches it to the request object for use in routes and other middlewares
 */

const appConfig = require('../config/appConfig');

// Mode constants - matches appConfig.js
const MODES = {
  DEV: 'dev',
  LIVE: 'live'
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
  req.isDevMode = mode === MODES.DEV;
  req.isLiveMode = mode === MODES.LIVE;
  
  // Add output type
  req.outputType = config.outputType || OUTPUT_TYPES.JSON;
  
  // Add mode constants for use in routes
  req.MODES = MODES;
  req.OUTPUT_TYPES = OUTPUT_TYPES;
  
  // Add mode to response headers (only in dev mode)
  if (mode === MODES.DEV) {
    res.set('X-App-Mode', mode.toUpperCase());
    res.set('X-Output-Type', req.outputType.toUpperCase());
  }
  
  next();
};

module.exports = modeMiddleware;
module.exports.MODES = MODES;
module.exports.OUTPUT_TYPES = OUTPUT_TYPES;
