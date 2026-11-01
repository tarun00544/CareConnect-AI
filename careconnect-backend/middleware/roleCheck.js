const ApiError = require('../utils/ApiError');

// Role-based authorization gate. Must run after `authenticate`.
// Usage: router.get('/x', authenticate, authorize('DOCTOR', 'SUPER_ADMIN'), handler)
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden('You do not have permission to perform this action'));
    }
    next();
  };
}

module.exports = { authorize };
