require('dotenv').config();
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
    app.listen(PORT, () => {
      console.log(`\n🚀 Server running on http://localhost:${PORT}`);
      console.log(`   Environment : ${process.env.NODE_ENV}`);
      console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();
