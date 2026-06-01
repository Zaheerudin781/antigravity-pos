const express = require('express');
const router = express.Router();
const { getStaff, createStaff, updateStaff, deleteStaff } = require('../controllers/staffController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);
router.get('/', getStaff);
router.post('/', createStaff);
router.patch('/:id', updateStaff);
router.delete('/:id', deleteStaff);

module.exports = router;
