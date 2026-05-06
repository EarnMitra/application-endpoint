require('dotenv').config();
const express = require('express');
const cors = require('cors');

const appConfig = require('./src/config/appConfig');
const databaseConfig = require('./src/config/databaseConfig');
const { 
  modeMiddleware, 
  responseMiddleware, 
  databaseMiddleware,
  databaseLoggingMiddleware,
  databaseHealthMiddleware
} = require('./src/middlewares');
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/user');
const rateLimiter = require('./src/routes/auth/rateLimiter'); // BUG FIX #4: Import for shutdown

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize Application Configuration (runs just after server loads)
const config = appConfig.initialize(NODE_ENV, PORT, 'json');

// Initialize Database Connection Pool
try {
  databaseConfig.initialize();
  // BUG FIX #14: Test connection on startup to ensure database is accessible
  databaseConfig.testConnection().then((isConnected) => {
    if (isConnected) {
      console.log('✓ Database connection test passed');
    } else {
      console.warn('⚠ Database connection test failed - will retry on first request');
    }
  }).catch((error) => {
    console.warn('⚠ Database connection test error:', error.message);
  });
} catch (error) {
  console.error('Failed to initialize database:', error);
  process.exit(1);
}

// Global Middleware

// CORS Configuration - Allow all origins for API access
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-App-Mode', 'X-Output-Type'],
  credentials: false, // Set to true if you need cookies
  optionsSuccessStatus: 200
}));

// Security Headers Middleware
app.use((req, res, next) => {
  // Allow cross-origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-App-Mode, X-Output-Type');
  
  // Security headers (not too strict for API)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer'); // Change from strict to no-referrer for APIs
  
  // Cache headers for API responses
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  next();
});

app.use(express.json());

// Application Mode Middleware (must be first to set req.appMode)
app.use(modeMiddleware);

// Response Structure Middleware
app.use(responseMiddleware);

// Database Middleware (attaches db to req)
app.use(databaseMiddleware);

// Database Logging Middleware (only in development, not in live/prod)
if (process.env.NODE_ENV !== 'live' && process.env.NODE_ENV !== 'prod' && process.env.NODE_ENV !== 'production') {
  app.use(databaseLoggingMiddleware);
}

// Database Health Middleware
app.use(databaseHealthMiddleware);

// Auth Routes
app.use('/api/auth', authRoutes);

// User Routes
app.use('/api/user', userRoutes);

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

/**
 * Connection Status Endpoint
 * Returns detailed database connection pool statistics
 */
app.get('/api/connection-status', (req, res) => {
  try {
    const stats = databaseConfig.getPoolStats();
    res.success(
      {
        ...stats,
        timestamp: new Date().toISOString(),
        keepAliveEnabled: true,
        keepAliveInterval: '30 seconds',
        healthCheckInterval: '5 minutes'
      },
      'Connection pool status retrieved',
      200
    );
  } catch (error) {
    res.error(
      { error: error.message },
      'Failed to get connection status',
      500
    );
  }
});

/**
 * CORS Check Endpoint
 * Diagnostic endpoint to verify CORS configuration is working
 */
app.get('/api/cors-check', (req, res) => {
  res.success(
    {
      corsEnabled: true,
      allowedOrigins: '*',
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-App-Mode', 'X-Output-Type'],
      credentials: false,
      headers: {
        'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin'),
        'Access-Control-Allow-Methods': res.getHeader('Access-Control-Allow-Methods'),
        'Access-Control-Allow-Headers': res.getHeader('Access-Control-Allow-Headers'),
        'Referrer-Policy': res.getHeader('Referrer-Policy'),
        'X-Content-Type-Options': res.getHeader('X-Content-Type-Options'),
        'X-Frame-Options': res.getHeader('X-Frame-Options'),
        'Cache-Control': res.getHeader('Cache-Control')
      },
      requestHeaders: {
        origin: req.get('origin'),
        referer: req.get('referer'),
        userAgent: req.get('user-agent')
      },
      timestamp: new Date().toISOString()
    },
    'CORS configuration verified',
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
  
  // Handle database connection errors gracefully
  if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') {
    console.error('⚠️ Database connection error - attempting to recover...');
    return res.status(503).json({
      success: false,
      message: 'Database connection temporarily unavailable. The server will auto-recover.',
      error: {
        code: err.code,
        message: 'Connection reset by database server'
      }
    });
  }
  
  if (req.isLiveMode) {
    res.error(null, 'Internal server error', 500);
  } else {
    res.error({ error: err.message }, err.message, 500, {
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
  ║ Database: ${databaseConfig.getConfig().user}@${databaseConfig.getConfig().host}:${databaseConfig.getConfig().port}/${databaseConfig.getConfig().database}
  ║ Timestamp: ${config.timestamp}
  ╚════════════════════════════════════════╝
  `);

  // BUG FIX #4: Rate limiter cleanup is now initialized with interval management
  // No need to initialize here as rateLimiter singleton already schedules cleanup



  // Log CORS Configuration
  console.log('\n🌐 CORS Configuration:');
  console.log('   ✓ Allow Origins: * (All origins)');
  console.log('   ✓ Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS');
  console.log('   ✓ Headers: Content-Type, Authorization, X-Requested-With, X-App-Mode, X-Output-Type');
  console.log('   ✓ Referrer Policy: no-referrer');
  console.log('   ✓ Credentials: false');
  console.log('   📊 Check CORS: GET http://localhost:' + PORT + '/api/cors-check\n');

  // Log database connection status
  console.log('\n🔌 Database Connection Status:');
  console.log('   ✓ Keep-Alive: ENABLED (every 30 seconds)');
  console.log('   ✓ Health Check: ENABLED (every 5 minutes)');
  console.log('   ✓ Idle Timeout: 15 minutes');
  console.log('   ✓ Auto-Recovery: ENABLED\n');
});

// Terminal Commands Listener (interactive CLI)
const startTerminalCommands = require('./src/utils/terminalCommands');
startTerminalCommands(app, databaseConfig);

// Graceful Shutdown Handler
process.on('SIGTERM', async () => {
  console.log('\n⏹️ SIGTERM signal received: closing HTTP server');
  
  try {
    // BUG FIX #4: Stop rate limiter cleanup interval
    rateLimiter.stopCleanupInterval();
    console.log('✓ Rate limiter cleanup stopped');
    
    // Close database connection pool
    await databaseConfig.close();
    console.log('✓ Database connection pool closed');
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n⏹️ SIGINT signal received: closing HTTP server');
  
  try {
    // BUG FIX #4: Stop rate limiter cleanup interval
    rateLimiter.stopCleanupInterval();
    console.log('✓ Rate limiter cleanup stopped');
    
    // Close database connection pool
    await databaseConfig.close();
    console.log('✓ Database connection pool closed');
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
  
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
