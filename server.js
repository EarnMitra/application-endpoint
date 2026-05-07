require('dotenv').config();
const cluster = require('cluster');
const os = require('os');
const express = require('express');
const cors = require('cors');
const compression = require('compression'); // OPTIMIZATION #3: Response compression

const appConfig = require('./src/config/appConfig');
const databaseConfig = require('./src/config/databaseConfig');
const middlewares = require('./src/middlewares');
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/user');
const rateLimiter = require('./src/routes/auth/rateLimiter'); // BUG FIX #4: Import for shutdown

// OPTIMIZATION #1: Enable clustering for multi-core utilization
const NUM_WORKERS = process.env.NODE_CLUSTER_WORKERS || os.cpus().length;

// Auto-discover middleware conditions based on naming conventions
const getMiddlewareCondition = (middlewareName) => {
  // Logging middleware only in development
  if (middlewareName.includes('Logging')) {
    return process.env.NODE_ENV !== 'live' && process.env.NODE_ENV !== 'prod' && process.env.NODE_ENV !== 'production';
  }
  // All others run by default
  return true;
};

// Automatically build middleware config from exported middlewares
const middlewareConfig = Object.keys(middlewares)
  .filter(key => typeof middlewares[key] === 'function' && key.endsWith('Middleware'))
  .map(name => ({
    name,
    condition: getMiddlewareCondition(name)
  }));

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
      console.log('[DATABASE] Connection test passed');
    } else {
      console.warn('[DATABASE] Connection test failed - will retry on first request');
    }
  }).catch((error) => {
    console.warn('[DATABASE] Connection test error:', error.message);
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

app.use(express.json({ limit: '50mb' })); // OPTIMIZATION #4: Increased JSON payload limit

// OPTIMIZATION #3: Enable response compression for bandwidth optimization
app.use(compression({
  filter: (req, res) => {
    // Don't compress responses with this request header
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Use compression filter function
    return compression.filter(req, res);
  },
  level: 6 // Balance between speed and compression ratio
}));

// Dynamically apply all registered middlewares
middlewareConfig.forEach(({ name, condition }) => {
  if (condition && middlewares[name]) {
    app.use(middlewares[name]);
    if (process.env.NODE_ENV === 'dev' || process.env.NODE_ENV === 'development') {
      console.log(`[MIDDLEWARE] ${name} loaded successfully`);
    }
  } else if (!middlewares[name]) {
    console.warn(`[MIDDLEWARE] Warning: "${name}" not found in src/middlewares`);
  }
});

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
    console.error('[ERROR] Database connection error - attempting to recover...');
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

// OPTIMIZATION #1: Cluster setup for multi-core processing
if (cluster.isMaster) {
  console.log(`
  ╔════════════════════════════════════════╗
  ║   EarnMitra Server - MASTER PROCESS    ║
  ╠════════════════════════════════════════╣
  ║ Spawning ${NUM_WORKERS} worker processes
  ║ Port: ${PORT}
  ║ Environment: ${config.nodeEnv}
  ╚════════════════════════════════════════╝
  `);

  // Fork workers
  for (let i = 0; i < NUM_WORKERS; i++) {
    cluster.fork();
  }

  // Handle worker crashes - auto restart
  cluster.on('exit', (worker, code, signal) => {
    console.log(`[CLUSTER] Worker ${worker.process.pid} died (${signal || code}). Restarting...`);
    cluster.fork();
  });

} else {
  // Worker process
  app.listen(PORT, () => {
    console.log(`
  ╔════════════════════════════════════════╗
  ║   EarnMitra Server Worker Started      ║
  ╠════════════════════════════════════════╣
  ║ Worker PID: ${process.pid}
  ║ URL: http://localhost:${PORT}
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
    console.log('\n[CORS] Configuration enabled:');
    console.log('[CORS] Allow Origins: * (All origins)');
    console.log('[CORS] Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS');
    console.log('[CORS] Headers: Content-Type, Authorization, X-Requested-With, X-App-Mode, X-Output-Type');
    console.log('[CORS] Referrer Policy: no-referrer');
    console.log('[CORS] Credentials: false');
    console.log('[CORS] Diagnostic: GET http://localhost:' + PORT + '/api/cors-check');

    // Log database connection status
    console.log('\n[DATABASE] Connection pool status:');
    console.log('[DATABASE] Keep-Alive: ENABLED (10 second interval)');
    console.log('[DATABASE] Health Check: ENABLED (5 minute interval)');
    console.log('[DATABASE] Idle Timeout: 10 minutes');
    console.log('[DATABASE] Auto-Recovery: ENABLED');
    console.log('[CLUSTERING] Worker PID: ' + process.pid);
    console.log('[SERVER] Ready to accept requests\n');

    // Terminal Commands Listener (interactive CLI)
    const startTerminalCommands = require('./src/utils/terminalCommands');
    startTerminalCommands(app, databaseConfig);
  });
}
process.on('SIGTERM', async () => {
  console.log('\n[SHUTDOWN] SIGTERM signal received - closing server');
  
  try {
    // BUG FIX #4: Stop rate limiter cleanup interval
    rateLimiter.stopCleanupInterval();
    console.log('[SHUTDOWN] Rate limiter cleanup stopped');
    
    // Close database connection pool
    await databaseConfig.close();
    console.log('[SHUTDOWN] Database connection pool closed');
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n[SHUTDOWN] SIGINT signal received - closing server');
  
  try {
    // BUG FIX #4: Stop rate limiter cleanup interval
    rateLimiter.stopCleanupInterval();
    console.log('[SHUTDOWN] Rate limiter cleanup stopped');
    
    // Close database connection pool
    await databaseConfig.close();
    console.log('[SHUTDOWN] Database connection pool closed');
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
  
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[ERROR] Uncaught Exception:', error.message);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
