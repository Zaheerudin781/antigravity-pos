const express = require('express');
const router = express.Router();
const { getMenu, createItem, updateItem, deleteItem, toggleAvailability, getPublicMenu } = require('../controllers/menuController');
const { authMiddleware } = require('../middleware/auth');

router.get('/public/:tenantId', getPublicMenu);
router.use(authMiddleware);
router.get('/', getMenu);
router.post('/', createItem);
router.patch('/:id', updateItem);
router.delete('/:id', deleteItem);
router.patch('/:id/toggle', toggleAvailability);

module.exports = router;
