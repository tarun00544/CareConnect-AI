const mongoose = require('mongoose');
const logger = require('./logger');

// Transactions need a replica set / sharded cluster. A standalone `mongod` (common in local
// development) rejects them, so we detect that and fall back to a non-transactional run in
// which the caller performs its own compensation (see services/doctorAdminService.js).
function isTransactionUnsupported(err) {
  const msg = String(err?.message || '');
  return (
    err?.code === 20 ||
    /Transaction numbers are only allowed|replica set member|does not support transactions|transactions? (is|are) not supported|not supported|autocommit|startTransaction|commitTransaction|abortTransaction|no such command/i.test(msg)
  );
}

/**
 * runInTransaction(work) — `work(session)` receives a session when transactions are available,
 * or `null` when they are not.
 */
async function runInTransaction(work) {
  let session;
  try {
    session = await mongoose.startSession();
  } catch (err) {
    if (!isTransactionUnsupported(err)) throw err;
    return work(null);
  }
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (err) {
    if (isTransactionUnsupported(err)) {
      logger.warn('MongoDB transactions unavailable; running with manual compensation');
      return work(null);
    }
    throw err;
  } finally {
    session.endSession();
  }
}

module.exports = { runInTransaction, isTransactionUnsupported };
