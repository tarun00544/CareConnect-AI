const http = require('http');
const app = require('./app');
const env = require('./config/env');
const connectDB = require('./config/db');
const initSockets = require('./sockets');
const notificationService = require('./services/notificationService');
const logger = require('./utils/logger');

async function start() {
  await connectDB();

  const server = http.createServer(app);
  const io = initSockets(server);

  // Give notificationService a reference to the live Socket.IO instance so
  // it can push realtime notifications; also expose io on the app for
  // controllers that need to emit directly (e.g. chatController REST fallback).
  notificationService.setIo(io);
  app.set('io', io);

  server.listen(env.port, () => {
    logger.info(`CareConnect AI backend listening on port ${env.port}`, { env: env.nodeEnv });
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { reason: String(reason) });
  });
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => process.exit(0));
  });
}

start();
