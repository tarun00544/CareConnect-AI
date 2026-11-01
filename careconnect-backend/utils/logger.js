// Minimal audit-friendly logger. Swap for winston/pino in production;
// interface kept stable so callers don't need to change.
function baseLog(level, message, meta = {}) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(entry));
}

module.exports = {
  info: (message, meta) => baseLog('info', message, meta),
  warn: (message, meta) => baseLog('warn', message, meta),
  error: (message, meta) => baseLog('error', message, meta),
  audit: (action, meta) => baseLog('audit', action, meta),
};
