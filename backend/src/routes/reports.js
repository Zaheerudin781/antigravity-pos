const express = require('express');
const router = express.Router();
const { getSalesReport, getStaffReport, getTopItems, exportCSV } = require('../controllers/reportsController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);
router.get('/sales', getSalesReport);
router.get('/staff', getStaffReport);
router.get('/top-items', getTopItems);
router.get('/export', exportCSV);

module.exports = router;
