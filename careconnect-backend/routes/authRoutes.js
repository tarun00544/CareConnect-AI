const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const { registerValidator, loginValidator, refreshValidator } = require('../validators/authValidators');

router.post('/register', authLimiter, registerValidator, validate, authController.register);
router.post('/login', authLimiter, loginValidator, validate, authController.login);
router.post('/refresh', authLimiter, refreshValidator, validate, authController.refresh);
router.get('/invitations/:token', authLimiter, authController.getInvitation);
router.post('/accept-invitation', authLimiter, authController.acceptInvitation);
router.get('/me', authenticate, authController.me);
router.post('/logout', authenticate, authController.logout);

module.exports = router;
