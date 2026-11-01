const AuditLog = require('../models/AuditLog');
const logger = require('./logger');

const SECRET_KEY = /pass|token|secret|hash|authorization|storageKey/i;

// Deep-copies `value`, dropping anything that looks like a credential, and trims long strings.
function sanitize(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (depth > 4) return '[truncated]';
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitize(v, depth + 1));
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') return String(value);
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SECRET_KEY.test(k)) continue;
      out[k] = sanitize(v, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string') return value.length > 300 ? `${value.slice(0, 300)}…` : value;
  return value;
}

/**
 * Records a sensitive administrative action. Failure to write the audit entry is logged but
 * never breaks the request that triggered it.
 */
async function record(req, { action, targetType, targetId, hospitalId, summary, changes }) {
  try {
    const entry = {
      actorId: req.user?._id,
      actorRole: req.user?.role,
      action,
      targetType,
      targetId,
      hospitalId,
      summary,
      changes: sanitize(changes),
      ip: req.ip,
    };
    await AuditLog.create(entry);
    logger.audit(action, { actorId: String(req.user?._id || ''), targetType, targetId: String(targetId || '') });
  } catch (err) {
    logger.error('Failed to write audit log', { action, message: err.message });
  }
}

module.exports = { record, sanitize };
