const mongoose = require('mongoose');
const { ROLES, USER_STATUS } = require('../config/constants');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    phone: { type: String, trim: true },
    role: { type: String, enum: Object.values(ROLES), required: true, default: ROLES.PATIENT },
    status: { type: String, enum: Object.values(USER_STATUS), default: USER_STATUS.ACTIVE },
    tokenVersion: { type: Number, default: 0 },
    // Scoping fields for admin-role isolation (hospital/pharmacy admins are
    // scoped to a single hospital/pharmacy).
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', default: null },

    // --- account lifecycle (added for doctor/user management) ---
    emailVerified: { type: Boolean, default: false },
    lastLoginAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Invitation workflow: only a SHA-256 hash of the one-time token is stored.
    inviteTokenHash: { type: String, select: false, default: null },
    inviteExpiresAt: { type: Date, select: false, default: null },
    // Soft deletion / anonymisation marker (see services/userAdminService.js)
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ role: 1, status: 1 });
userSchema.index({ inviteTokenHash: 1 }, { sparse: true });

module.exports = mongoose.model('User', userSchema);
