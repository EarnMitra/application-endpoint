/**
 * Database Middleware
 * Attaches database connection pool to request object
 * Provides database query methods to routes
 */

const databaseConfig = require('../config/databaseConfig');

/**
 * Database middleware factory
 * Initializes database if not already done
 */
const databaseMiddleware = (req, res, next) => {
  // Initialize database pool if not already initialized
  if (!databaseConfig.isInitialized()) {
    try {
      databaseConfig.initialize();
    } catch (error) {
      console.error('Failed to initialize database:', error);
      return res.error(
        process.env.NODE_ENV === 'development' ? { error: error.message } : null,
        'Database initialization failed',
        500
      );
    }
  }

  // Check if response middleware is available
  if (!res.error || !res.success) {
    console.error('Response middleware not initialized. Ensure responseMiddleware is loaded before databaseMiddleware.');
    return res.status(500).json({
      success: false,
      message: 'Server configuration error'
    });
  }

  // Attach database config to request object
  req.db = {
    // Execute a query on the pool
    query: async (queryStr, params = []) => {
      try {
        return await databaseConfig.query(queryStr, params);
      } catch (error) {
        console.error('Database query error:', error);
        throw error;
      }
    },

    // Get a client from the pool for complex operations
    getClient: async () => {
      try {
        return await databaseConfig.getClient();
      } catch (error) {
        console.error('Failed to get database client:', error);
        throw error;
      }
    },

    // Execute transaction
    transaction: async (callback) => {
      try {
        return await databaseConfig.transaction(callback);
      } catch (error) {
        console.error('Transaction error:', error);
        throw error;
      }
    },

    // Get pool statistics
    getStats: () => {
      // BUG FIX #21: Improved pool stats validation with better null/undefined checks
      try {
        const stats = databaseConfig.getPoolStats();
        if (!stats || typeof stats !== 'object') {
          return {
            error: 'Database pool not initialized',
            waitingCount: 0,
            idleCount: 0,
            totalCount: 0
          };
        }
        return stats;
      } catch (error) {
        console.error('Error getting pool stats:', error);
        return {
          error: error.message,
          waitingCount: 0,
          idleCount: 0,
          totalCount: 0
        };
      }
    },

    // Get connection configuration
    getConfig: () => {
      // BUG FIX #5: Add null check for config existence
      try {
        const config = databaseConfig.getConfig();
        if (!config) {
          return {
            error: 'Database config not available'
          };
        }
        return config;
      } catch (error) {
        console.error('Error getting config:', error);
        return {
          error: error.message
        };
      }
    }
  };

  next();
};

/**
 * Async middleware to handle database errors
 * Wraps route handlers to catch database errors
 */
const asyncDatabaseHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      console.error('Unhandled database error:', error);
      
      // Send appropriate error response using response middleware
      if (error.code === '23505') {
        // Unique constraint violation
        return res.error(
          { constraint: error.constraint, detail: error.detail },
          'Duplicate entry - this record already exists',
          409
        );
      }
      
      if (error.code === '23503') {
        // Foreign key constraint violation
        return res.error(
          { constraint: error.constraint, detail: error.detail },
          'Referenced data not found or invalid',
          400
        );
      }
      
      if (error.code === '22P02') {
        // Invalid text representation
        return res.error(
          { detail: error.message },
          'Invalid data format provided',
          400
        );
      }

      if (error.code === '42P01') {
        // Undefined table
        return res.error(
          { table: error.message },
          'Database table not found',
          500
        );
      }

      if (error.code === '42703') {
        // Undefined column
        return res.error(
          { column: error.message },
          'Database column not found',
          500
        );
      }

      // Generic database error
      res.error(
        process.env.NODE_ENV === 'development' ? { error: error.message } : null,
        'Database operation failed',
        500
      );
    });
  };
};

/**
 * Middleware to log database operations
 */
const databaseLoggingMiddleware = (req, res, next) => {
  const originalQuery = req.db?.query;

  if (originalQuery) {
    req.db.query = async function(queryStr, params = []) {
      const startTime = Date.now();
      
      try {
        const result = await originalQuery.call(this, queryStr, params);
        const duration = Date.now() - startTime;
        
        if (process.env.ENABLE_REQUEST_LOGGING === 'true') {
          console.log(`[${new Date().toISOString()}] [DB] ${duration}ms - ${queryStr.substring(0, 80)}`);
        }
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[${new Date().toISOString()}] [DB ERROR] ${duration}ms - ${error.message}`);
        throw error;
      }
    };
  }

  next();
};

/**
 * Health check endpoint for database
 */
const databaseHealthMiddleware = (req, res, next) => {
  req.dbHealth = async () => {
    try {
      const isConnected = await databaseConfig.testConnection();
      const stats = databaseConfig.getPoolStats();
      
      return {
        connected: isConnected,
        stats: stats,
        config: databaseConfig.getConfig()
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message
      };
    }
  };

  next();
};

module.exports = {
  databaseMiddleware,
  asyncDatabaseHandler,
  databaseLoggingMiddleware,
  databaseHealthMiddleware
};
