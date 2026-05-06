/**
 * Database Configuration Manager
 * Handles PostgreSQL connection pool and configuration
 * Manages database initialization and connection lifecycle
 */

const { Pool } = require('pg');

class DatabaseConfig {
  constructor() {
    this.pool = null;
    this.initialized = false;
    this.connectionConfig = {};
  }

  /**
   * Initialize database connection pool
   * @param {Object} options - Configuration options
   * @returns {Pool} - Initialized connection pool
   */
  initialize(options = {}) {
    const {
      host = process.env.DB_HOST || 'localhost',
      port = parseInt(process.env.DB_PORT, 10) || 5432,
      database = process.env.DB_NAME || 'earnmitra_db',
      user = process.env.DB_USER || 'postgres',
      password = process.env.DB_PASSWORD || '',
      min = parseInt(process.env.DB_POOL_MIN, 10) || 2,
      max = parseInt(process.env.DB_POOL_MAX, 10) || 10,
      idleTimeoutMillis = parseInt(process.env.DB_POOL_IDLE_TIMEOUT, 10) || 900000, // 15 minutes
      connectionTimeoutMillis = parseInt(process.env.DB_CONNECTION_TIMEOUT, 10) || 5000,
      statementTimeoutMillis = parseInt(process.env.DB_STATEMENT_TIMEOUT, 10) || 30000,
      ssl = process.env.DB_SSL === 'true' ? true : false,
      rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' ? true : false,
      keepalives = process.env.DB_KEEPALIVES === 'true' ? true : true,
      keepalivesIdleSeconds = parseInt(process.env.DB_KEEPALIVES_IDLE_SECONDS, 10) || 30
    } = options;

    this.connectionConfig = {
      host,
      port,
      database,
      user,
      password,
      min,
      max,
      idleTimeoutMillis,
      connectionTimeoutMillis,
      statement_timeout: statementTimeoutMillis,
      ssl: ssl ? { rejectUnauthorized } : false,
      keepalives,
      keepalivesIdle: keepalivesIdleSeconds
    };

    try {
      this.pool = new Pool(this.connectionConfig);

      // Handle pool errors
      this.pool.on('error', (err) => {
        console.error('⚠️  Database connection error:', err.message);
        // Connection will be automatically recreated on next query
      });

      // Handle pool connect
      this.pool.on('connect', () => {
        console.log('✓ New database connection established');
      });

      // Log successful pool creation
      console.log(`✓ Database connection pool initialized (${min}-${max} connections)`);
      console.log(`✓ Keep-alive enabled: TCP keep-alive every ${keepalivesIdleSeconds}s`);
      this.initialized = true;
      
      // Start health check interval
      this.startHealthCheck();

      return this.pool;
    } catch (error) {
      console.error('Failed to initialize database connection pool:', error);
      throw error;
    }
  }

  /**
   * Get the connection pool
   * @returns {Pool} - Database connection pool
   */
  getPool() {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call initialize() first.');
    }
    return this.pool;
  }

  /**
   * Get a single client from the pool
   * @returns {Promise<Client>} - Database client
   */
  async getClient() {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call initialize() first.');
    }
    return await this.pool.connect();
  }

  /**
   * Execute a query on the pool
   * @param {string} query - SQL query string
   * @param {Array} params - Query parameters
   * @returns {Promise<Result>} - Query result
   */
  async query(query, params = []) {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call initialize() first.');
    }
    
    try {
      const startTime = Date.now();
      const result = await this.pool.query(query, params);
      const duration = Date.now() - startTime;
      
      // Only log queries in dev mode (not in production/live)
      if (process.env.NODE_ENV !== 'live' && process.env.NODE_ENV !== 'prod' && process.env.NODE_ENV !== 'production') {
        console.log(`[DB Query] ${duration}ms - ${query.substring(0, 100)}`);
      }
      
      return result;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  /**
   * Execute multiple queries in a transaction
   * @param {Function} callback - Function containing transaction queries
   * @returns {Promise} - Transaction result
   */
  async transaction(callback) {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Transaction failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get connection pool statistics
   * @returns {Object} - Pool statistics
   */
  getPoolStats() {
    if (!this.pool) {
      return null;
    }
    
    return {
      waitingCount: this.pool.waitingCount,
      idleCount: this.pool.idleCount,
      totalCount: this.pool.totalCount,
      activeCount: this.pool.totalCount - this.pool.idleCount,
      config: {
        min: this.connectionConfig.min,
        max: this.connectionConfig.max
      }
    };
  }

  /**
   * Test database connection
   * @returns {Promise<boolean>} - Connection status
   */
  async testConnection() {
    try {
      const result = await this.query('SELECT NOW()');
      console.log('✓ Database connection test successful');
      return true;
    } catch (error) {
      console.error('✗ Database connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Close the connection pool
   * @returns {Promise<void>}
   */
  async close() {
    this.stopHealthCheck();
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.initialized = false;
      console.log('✓ Database connection pool closed');
    }
  }

  /**
   * Get connection configuration (without password)
   * @returns {Object} - Safe connection config
   */
  getConfig() {
    const { password, ...safeConfig } = this.connectionConfig;
    return safeConfig;
  }

  /**
   * Start health check interval to keep connection alive
   * Sends periodic queries to maintain connection and detect issues
   */
  startHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Run health check every 5 minutes
    this.healthCheckInterval = setInterval(async () => {
      try {
        const result = await this.query('SELECT NOW() as time');
        const stats = this.getPoolStats();
        console.log('✓ Health check passed', {
          time: new Date().toISOString(),
          activeConnections: stats.activeCount,
          idleConnections: stats.idleCount
        });
      } catch (error) {
        console.error('✗ Health check failed:', error.message);
      }
    }, 300000); // 5 minutes

    console.log('✓ Database health check started (every 5 minutes)');
  }

  /**
   * Stop health check interval
   */
  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('✓ Database health check stopped');
    }
  }

  /**
   * Check if database is initialized
   * @returns {boolean}
   */
  isInitialized() {
    return this.initialized;
  }
}

// Singleton instance
const databaseConfig = new DatabaseConfig();

module.exports = databaseConfig;
