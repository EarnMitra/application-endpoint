require('dotenv').config();
const express = require('express');
const cors = require('cors');

const appConfig = require('./src/config/appConfig');
const { modeMiddleware, responseMiddleware } = require('./src/middlewares');

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize Application Configuration (runs just after server loads)
const config = appConfig.initialize(NODE_ENV, PORT, 'json');

// Global Middleware
app.use(cors());
app.use(express.json());

// Application Mode Middleware (must be first to set req.appMode)
app.use(modeMiddleware);

// Response Structure Middleware
app.use(responseMiddleware);

// Routes
app.get('/api/health', (req, res) => {
  res.success(
    { status: 'Server is running', mode: req.appMode },
    'Health check passed',
    200
  );
});

/**
 * Configuration Endpoint
 * Exposes app configuration for branches to consume
 * Other branches/routes can access this configuration
 */
app.get('/api/config', (req, res) => {
  res.success(
    req.appConfig,
    'Application configuration retrieved',
    200
  );
});

/**
 * App State Endpoint
 * Returns complete app state including modes and output types
 */
app.get('/api/app-state', (req, res) => {
  res.success(
    {
      config: req.appConfig,
      modes: req.MODES,
      outputTypes: req.OUTPUT_TYPES,
      headers: {
        'X-App-Mode': req.get('X-App-Mode') || 'PROD',
        'X-Output-Type': req.get('X-Output-Type') || 'JSON'
      }
    },
    'Application state retrieved',
    200
  );
});

// 404 Handler
app.use((req, res) => {
  res.error('Route not found', 404);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  
  if (req.isProductionMode) {
    res.error('Internal server error', 500);
  } else {
    res.error(err.message, 500, {
      stack: err.stack,
      details: err
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════╗
  ║   EarnMitra Server Started Successfully ║
  ╠════════════════════════════════════════╣
  ║ URL:  http://localhost:${PORT}
  ║ Mode: ${config.mode.toUpperCase()}
  ║ Environment: ${config.nodeEnv}
  ║ Output Type: ${config.outputType.toUpperCase()}
  ║ Version: ${config.version}
  ║ Timestamp: ${config.timestamp}
  ╚════════════════════════════════════════╝
  `);

  // Log available endpoints for other branches
  if (config.isDebug || config.isTest) {
    console.log('\n📝 Available Configuration Endpoints:');
    console.log(`   GET /api/config - Application configuration`);
    console.log(`   GET /api/app-state - Complete app state with modes\n`);
  }
});
