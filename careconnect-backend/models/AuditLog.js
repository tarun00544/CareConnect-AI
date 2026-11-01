const mongoose = require('mongoose');

// Append-only trail of sensitive administrative actions. Never store secrets here —
// utils/auditService.js strips password/token/hash-like keys before writing.
const auditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    actorRole: { type: String },
    action: { type: String, required: true, index: true },
    targetType: { type: String, required: true }, // 'User' | 'Doctor' | 'Department'
    targetId: { type: mongoose.Schema.Types.ObjectId, index: true },
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', index: true },
    summary: { type: String, maxlength: 300 },
    changes: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
