const express = require('express');
const router = express.Router();
const deviceTokenController = require('../controllers/deviceTokenController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.post('/register', deviceTokenController.registerDevice);
router.put('/token', deviceTokenController.refreshDeviceToken);
router.delete('/:token', deviceTokenController.removeDevice);
router.get('/', deviceTokenController.getMyDevices);

module.exports = router;
