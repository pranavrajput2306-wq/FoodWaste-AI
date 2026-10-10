const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { validateEnv } = require('./src/config/env');

// Validate environment early before starting resources
validateEnv();

const app = require('./src/app');
const { testConnection } = require('./src/config/database');
const { initializeSchema } = require('./src/config/schema');

const PORT = parseInt(process.env.PORT, 10) || 5000;

async function startServer() {
  try {
    // 1. Verify DB connectivity
    await testConnection();

    // 2. Run schema initialisation (idempotent — safe every startup)
    await initializeSchema();

    // 3. Start HTTP server
    const server = app.listen(PORT, () => {
      console.log(`\n🚀 Server running on http://localhost:${PORT}`);
      console.log(`   Environment : ${process.env.NODE_ENV}`);
      console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use by another process.`);
      } else {
        console.error('❌ Server startup error:', err.message);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();
