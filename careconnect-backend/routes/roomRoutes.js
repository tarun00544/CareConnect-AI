const express = require('express');
const router = express.Router();
const bedController = require('../controllers/bedController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, bedController.listRooms);

module.exports = router;
