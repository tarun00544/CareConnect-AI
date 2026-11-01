const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');
const { authenticate } = require('../middleware/auth');
const { mongoIdParam } = require('../validators/commonValidators');
const validate = require('../middleware/validate');

router.use(authenticate);

router.post('/session', videoController.createSession);
router.get('/session/:id', mongoIdParam(), validate, videoController.getSession);
router.get('/ice-servers', videoController.getIceServers);
router.post('/session/:appointmentId/end', mongoIdParam('appointmentId'), validate, videoController.endSession);

module.exports = router;
