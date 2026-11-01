const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const { getPagination, buildPaginatedResult } = require('../utils/pagination');
const audit = require('../utils/auditService');
const AuditLog = require('../models/AuditLog');
const svc = require('../services/userAdminService');

const list = asyncHandler(async (req, res) => {
  const pg = getPagination(req.query);
  const { items, total } = await svc.listUsers(req.query, pg);
  new ApiResponse(200, buildPaginatedResult(items, total, pg.page, pg.limit)).send(res);
});

const get = asyncHandler(async (req, res) => {
  new ApiResponse(200, await svc.getUser(req.params.id)).send(res);
});

const update = asyncHandler(async (req, res) => {
  const r = await svc.updateUser(req.user, req.params.id, req.body || {});
  if (Object.keys(r.changes).length) {
    await audit.record(req, { action: r.roleChanged ? 'USER_ROLE_CHANGED' : 'USER_UPDATED', targetType: 'User', targetId: r.user._id, hospitalId: r.user.hospitalId, summary: r.roleChanged ? `Role changed to ${r.user.role}` : 'Updated user', changes: r.changes });
  }
  new ApiResponse(200, r.user, Object.keys(r.changes).length ? 'User updated' : 'No changes').send(res);
});

const setStatus = asyncHandler(async (req, res) => {
  const r = await svc.setStatus(req.user, req.params.id, req.body?.status);
  if (r.changed) {
    await audit.record(req, { action: 'USER_STATUS_CHANGED', targetType: 'User', targetId: r.user._id, hospitalId: r.user.hospitalId, summary: `Status ${r.previous} → ${r.user.status}`, changes: { previous: r.previous, current: r.user.status, affectedUpcomingAppointments: r.affectedUpcomingAppointments } });
  }
  new ApiResponse(200, { user: r.user, affectedUpcomingAppointments: r.affectedUpcomingAppointments || 0 }, r.changed ? 'User status updated' : 'Status unchanged').send(res);
});

const remove = asyncHandler(async (req, res) => {
  const r = await svc.deleteUser(req.user, req.params.id, req.body || {});
  await audit.record(req, { action: 'USER_DELETED', targetType: 'User', targetId: r.user._id, summary: 'User anonymised (soft delete)', changes: { ...r.audit, retained: r.retained, affectedUpcomingAppointments: r.affectedUpcomingAppointments } });
  new ApiResponse(200, { user: r.user, retained: r.retained, affectedUpcomingAppointments: r.affectedUpcomingAppointments }, 'User deleted. Personal details were anonymised; clinical and billing history was retained.').send(res);
});

const auditLogs = asyncHandler(async (req, res) => {
  const pg = getPagination(req.query);
  const filter = {};
  if (req.query.action) filter.action = String(req.query.action).slice(0, 60);
  if (req.query.targetId && /^[a-f\d]{24}$/i.test(req.query.targetId)) filter.targetId = req.query.targetId;
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit).populate('actorId', 'name role'),
    AuditLog.countDocuments(filter),
  ]);
  new ApiResponse(200, buildPaginatedResult(items, total, pg.page, pg.limit)).send(res);
});

module.exports = { list, get, update, setStatus, remove, auditLogs };
