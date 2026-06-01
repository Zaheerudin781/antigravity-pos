const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { uploadImage } = require('../controllers/uploadController');
const { authMiddleware } = require('../middleware/auth');

// POST /api/upload  (requires auth)
router.post('/', authMiddleware, upload.single('image'), uploadImage);

module.exports = router;
