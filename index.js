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
app.use(cors());
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
 * Database Health Endpoint
 * Checks database connection status and pool statistics
 */
app.get('/api/db-health', async (req, res) => {
  try {
    const health = await req.dbHealth();
    
    if (health.connected) {
      res.success(
        health,
        'Database connection healthy',
        200
      );
    } else {
      res.error(
        health,
        'Database connection failed',
        503
      );
    }
  } catch (error) {
    res.error(
      { error: error.message },
      'Failed to check database health',
      500
    );
  }
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

  // Log available endpoints for other branches
  if (config.isDebug || config.isTest) {
    console.log('\n📝 Available Configuration Endpoints:');
    console.log(`   GET /api/health - Server health check`);
    console.log(`   GET /api/config - Application configuration`);
    console.log(`   GET /api/db-health - Database connection status`);
    console.log(`   GET /api/app-state - Complete app state with modes`);
    console.log(`   GET /api/connection-status - Connection pool statistics\n`);
  }

  // Log database connection status
  console.log('\n🔌 Database Connection Status:');
  console.log('   ✓ Keep-Alive: ENABLED (every 30 seconds)');
  console.log('   ✓ Health Check: ENABLED (every 5 minutes)');
  console.log('   ✓ Idle Timeout: 15 minutes');
  console.log('   ✓ Auto-Recovery: ENABLED\n');
});

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
