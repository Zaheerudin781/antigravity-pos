const path = require('path');

/**
 * POST /api/upload
 * Accepts a single image file (field name: "image")
 * Returns a public URL for the uploaded file.
 */
exports.uploadImage = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded or invalid file type. Only JPEG/PNG allowed.' });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ success: true, url: fileUrl });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
