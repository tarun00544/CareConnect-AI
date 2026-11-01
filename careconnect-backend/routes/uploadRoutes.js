const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { authenticate } = require('../middleware/auth');
const { uploadReport, uploadProfileImage } = require('../middleware/upload');

router.use(authenticate);

router.post('/report', uploadReport.single('report'), uploadController.uploadReport);
router.post('/profile-image', uploadProfileImage.single('image'), uploadController.uploadProfileImage);

module.exports = router;
