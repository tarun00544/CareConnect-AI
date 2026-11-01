const express = require('express');
const router = express.Router();
const bedController = require('../controllers/bedController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const { ROLES } = require('../config/constants');

router.use(authenticate);

router.get('/available', bedController.listAvailableBeds);
router.get('/rooms', bedController.listRooms); // convenience alias, primary mount is /api/rooms
router.post('/allocate', authorize(ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.SUPER_ADMIN), bedController.allocateBed);
router.patch('/:id/status', authorize(ROLES.HOSPITAL_ADMIN, ROLES.SUPER_ADMIN), bedController.updateBedStatus);
router.post('/release', authorize(ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.SUPER_ADMIN), bedController.releaseBed);

module.exports = router;
