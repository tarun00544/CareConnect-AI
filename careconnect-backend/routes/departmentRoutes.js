const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');

router.get('/', departmentController.listDepartments);
router.get('/:id', departmentController.getDepartment);

module.exports = router;
