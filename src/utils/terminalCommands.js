const readline = require('readline');
const os = require('os');

/**
 * Terminal Command Listener for Express Server
 * Provides interactive commands in terminal: health, db, routes, mem, env, quit, help
 */

module.exports = function startTerminalCommands(app, databaseConfig) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });

  const startTime = Date.now();
  const divider = '─'.repeat(60);

  // ─────────────────────────────────────────
  // COMMAND HANDLERS
  // ─────────────────────────────────────────

  const commands = {
    help: {
      description: 'Show all available commands',
      fn: () => {
        console.log(`\n${divider}`);
        console.log('[COMMANDS] AVAILABLE COMMANDS:');
        console.log(`${divider}`);
        Object.entries(commands).forEach(([cmd, meta]) => {
          console.log(`  ${cmd.padEnd(12)} >> ${meta.description}`);
        });
        console.log(`${divider}\n`);
      }
    },

    health: {
      description: 'Server health status (uptime, memory, version)',
      fn: () => {
        const uptime = Date.now() - startTime;
        const uptimeStr = formatUptime(uptime);
        const memUsage = process.memoryUsage();
        const heapPercent = ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2);
        const heapStatus = heapPercent > 80 ? '[ERROR]' : heapPercent > 50 ? '[WARN]' : '[OK]';

        console.log(`\n${divider}`);
        console.log('[HEALTH] SERVER HEALTH STATUS');
        console.log(`${divider}`);
        console.log(`[OK] Status: Running`);
        console.log(`[UPTIME] ${uptimeStr}`);
        console.log(`${heapStatus} Memory: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB / ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)}MB (${heapPercent}%)`);
        console.log(`[VERSION] Node: ${process.version}`);
        console.log(`[PID] Process: ${process.pid}`);
        console.log(`[ENV] Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`[PLATFORM] ${os.platform()} (${os.arch()})`);
        console.log(`${divider}\n`);
      }
    },

    db: {
      description: 'Database connection status and ping',
      fn: async () => {
        console.log(`\n${divider}`);
        console.log('[DB] DATABASE STATUS');
        console.log(`${divider}`);

        try {
          // Get config
          const config = databaseConfig.getConfig?.() || {};
          console.log(`[HOST] ${config.host || 'N/A'}`);
          console.log(`[PORT] ${config.port || 'N/A'}`);
          console.log(`[NAME] ${config.database || 'N/A'}`);
          console.log(`[USER] ${config.user || 'N/A'}`);

          // Try to test connection
          if (typeof databaseConfig.testConnection === 'function') {
            const isConnected = await databaseConfig.testConnection();
            console.log(`${isConnected ? '[OK]' : '[ERROR]'} Connection: ${isConnected ? 'Connected' : 'Disconnected'}`);
          } else if (databaseConfig.query) {
            // Try a simple query
            try {
              const result = await databaseConfig.query('SELECT NOW()');
              console.log(`[OK] Connection: Connected (Query test successful)`);
              console.log(`[TIME] ${result.rows[0]?.now || 'N/A'}`);
            } catch (err) {
              console.log(`[ERROR] Connection: Failed`);
              console.log(`   ${err.message}`);
            }
          } else {
            console.log(`[WARN] Connection: Status unknown (cannot test)`);
          }
        } catch (error) {
          console.log(`[ERROR] Database:`, error.message);
        }

        console.log(`${divider}\n`);
      }
    },

    mem: {
      description: 'Detailed memory usage breakdown',
      fn: () => {
        const mem = process.memoryUsage();
        const osFreeMem = os.freemem();
        const osTotalMem = os.totalmem();
        const osUsedMem = osTotalMem - osFreeMem;

        console.log(`\n${divider}`);
        console.log('[MEMORY] DETAILED MEMORY USAGE');
        console.log(`${divider}`);
        console.log(`\nNode.js Process:`);
        console.log(`  heapUsed:    ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  heapTotal:   ${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  rss:         ${(mem.rss / 1024 / 1024).toFixed(2)} MB (resident set size)`);
        console.log(`  external:    ${(mem.external / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  arrayBuffers:${(mem.arrayBuffers / 1024 / 1024).toFixed(2)} MB`);

        const heapPercent = ((mem.heapUsed / mem.heapTotal) * 100).toFixed(2);
        const heapStatus = heapPercent > 80 ? '[ERROR]' : heapPercent > 50 ? '[WARN]' : '[OK]';
        console.log(`  ${heapStatus} Heap Usage: ${heapPercent}%`);

        console.log(`\nSystem Memory:`);
        console.log(`  Total:       ${(osTotalMem / 1024 / 1024 / 1024).toFixed(2)} GB`);
        console.log(`  Used:        ${(osUsedMem / 1024 / 1024 / 1024).toFixed(2)} GB`);
        console.log(`  Free:        ${(osFreeMem / 1024 / 1024 / 1024).toFixed(2)} GB`);

        const sysPercent = ((osUsedMem / osTotalMem) * 100).toFixed(2);
        const sysStatus = sysPercent > 80 ? '[ERROR]' : sysPercent > 50 ? '[WARN]' : '[OK]';
        console.log(`  ${sysStatus} System Usage: ${sysPercent}%`);

        console.log(`${divider}\n`);
      }
    },

    quit: {
      description: 'Gracefully shutdown the server',
      fn: async () => {
        console.log(`\n${divider}`);
        console.log('[STOP] SHUTTING DOWN SERVER');
        console.log(`${divider}\n`);

        rl.close();
        process.exit(0);
      }
    }
  };

  // ─────────────────────────────────────────
  // HELPER FUNCTIONS
  // ─────────────────────────────────────────

  function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  // ─────────────────────────────────────────
  // READLINE SETUP
  // ─────────────────────────────────────────

  console.log('\n[READY] Terminal commands ready. Type "help" for commands.\n');

  rl.on('line', async (input) => {
    const cmd = input.trim().toLowerCase();

    if (!cmd) {
      rl.prompt();
      return;
    }

    if (commands[cmd]) {
      try {
        await commands[cmd].fn();
      } catch (error) {
        console.error(`\n[ERROR] Failed executing "${cmd}":`, error.message, '\n');
      }
    } else {
      console.log(`\n[ERROR] Unknown command: "${cmd}". Type "help" for available commands.\n`);
    }

    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });

  rl.setPrompt('> ');
  rl.prompt();
};
