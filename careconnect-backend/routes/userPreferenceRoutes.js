const express = require('express');
const router = express.Router();
const userPreferenceController = require('../controllers/userPreferenceController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', userPreferenceController.getPreferences);
router.put('/', userPreferenceController.updatePreferences);

module.exports = router;
