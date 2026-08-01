import { createServer, Server as HTTPServer } from 'http';
import app from './app';
import config from './config';
import { initiateSuperAdmin } from './app/db/db';
import { seedMethod } from './app/modules/paymethod/paymethod.route';
import { disconnectRedis } from './lib/redis';
import { setupWebSocket } from './app/helpers/webSocket';
// Start BullMQ email worker ONLY in the worker container.
// The app container sets IS_WORKER=false and the worker container sets
// IS_WORKER=true in docker-compose, preventing duplicate workers/sends.
// For local dev, set IS_WORKER=true in your .env to run the worker here.
if (process.env.IS_WORKER === 'true') {
  require('./app/helpers/worker/emailWorker');
}


const port = config.port || 5000;

// Declare server outside main to make it accessible globally
let server: HTTPServer | undefined;

async function main() {
  server = createServer(app);

  try {
    // Seed data (await to ensure completion before listen)
    // console.log('🌱 Seeding super admin data...');
    await initiateSuperAdmin();
    await seedMethod();

    console.log(`🚀 Starting server on port ${port}...`);
    server.listen(port, () => {
      console.log(`✅ Server is running on port ${port}`);
    });

    // WebSocket setup (after listen)
    console.log('🔌 Setting up WebSocket...');
    await setupWebSocket(server);
    console.log('✅ WebSocket setup complete!');
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown (improved: handle SIGINT/SIGTERM)
const gracefulShutdown = async (signal: string) => {
  console.log(`🛑 Received ${signal}. Closing server...`);

  // Disconnect Redis gracefully (drains in-flight queue jobs)
  await disconnectRedis().catch(err =>
    console.error('Redis disconnect error:', err),
  );

  if (server) {
    server.close(err => {
      if (err) {
        console.error('⚠️ Server close error:', err);
        process.exit(1);
      }
      console.log('✅ Server closed successfully');
      process.exit(0);
    });
  } else {
    console.log('ℹ️ No server to close');
    process.exit(0);
  }
};

// Event listeners
process.on('uncaughtException', error => {
  console.error('💥 Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', error => {
  console.error('💥 Unhandled Rejection:', error);
  gracefulShutdown('unhandledRejection');
});

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

main();
