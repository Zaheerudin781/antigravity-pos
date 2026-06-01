const express = require('express');
const router = express.Router();
const { getRooms, createRoom, updateRoom, deleteRoom } = require('../controllers/roomController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);
router.get('/', getRooms);
router.post('/', createRoom);
router.patch('/:id', updateRoom);
router.delete('/:id', deleteRoom);

module.exports = router;
