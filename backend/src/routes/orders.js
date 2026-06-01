const express = require('express');
const router = express.Router();
const { getOrders, createOrder, updateOrder, deleteOrder, processPayment } = require('../controllers/ordersController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);
router.get('/', getOrders);
router.post('/', createOrder);
router.patch('/:id', updateOrder);
router.delete('/:id', deleteOrder);
router.post('/:id/payment', processPayment);

module.exports = router;
