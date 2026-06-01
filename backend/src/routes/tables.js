const express = require('express');
const router = express.Router();
const { getTables, createTable, updateTable, deleteTable, getTableOrder } = require('../controllers/tablesController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);
router.get('/', getTables);
router.post('/', createTable);
router.patch('/:id', updateTable);
router.delete('/:id', deleteTable);
router.get('/:id/order', getTableOrder);

module.exports = router;
