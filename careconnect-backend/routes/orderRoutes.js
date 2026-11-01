const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const { mongoIdParam } = require('../validators/commonValidators');
const validate = require('../middleware/validate');
const { ROLES } = require('../config/constants');

router.use(authenticate);

router.get('/', authorize(ROLES.PHARMACY_ADMIN, ROLES.SUPER_ADMIN), orderController.listOrders);
router.post('/', authorize(ROLES.PATIENT), orderController.createOrder);
router.get('/my', authorize(ROLES.PATIENT), orderController.getMyOrders);
router.get('/:id', mongoIdParam(), validate, orderController.getOrder);
router.patch('/:id/status', authorize(ROLES.PHARMACY_ADMIN, ROLES.SUPER_ADMIN), mongoIdParam(), validate, orderController.updateOrderStatus);
router.patch('/:id/delivery', authorize(ROLES.PHARMACY_ADMIN, ROLES.SUPER_ADMIN), mongoIdParam(), validate, orderController.updateDeliveryStatus);

module.exports = router;
