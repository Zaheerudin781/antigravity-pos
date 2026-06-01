const express = require('express');
const router = express.Router();
const { register, login, staffPinLogin, getMe } = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/staff-pin', staffPinLogin);
router.get('/me', authMiddleware, getMe);

module.exports = router;
