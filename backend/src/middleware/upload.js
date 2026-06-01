const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// Destination folder (ensure it exists)
const uploadFolder = path.join(__dirname, '../../uploads');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadFolder);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const filename = crypto.randomBytes(16).toString('hex') + ext;
    cb(null, filename);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png/;
  const mime = allowed.test(file.mimetype);
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  if (mime && ext) {
    cb(null, true);
  } else {
    cb(new Error('Only .png, .jpg and .jpeg images are allowed'));
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 2 * 1024 * 1024 } }); // 2MB limit

module.exports = upload;
