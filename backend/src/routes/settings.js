const express = require('express');
const router = express.Router();
const { getRestaurant, updateRestaurant } = require('../controllers/restaurantController');
const { getWebsiteStatus, toggleWebsite, getPublicMenuPage, createPublicOrder, getPublicOrderStatus } = require('../controllers/websiteController');
const { getAccount, updateCredentials, backupData, updateAvatar } = require('../controllers/accountController');
const { authMiddleware } = require('../middleware/auth');

// Restaurant
router.get('/restaurant', authMiddleware, getRestaurant);
router.patch('/restaurant', authMiddleware, updateRestaurant);

// Website
router.get('/website', authMiddleware, getWebsiteStatus);
router.post('/website/toggle', authMiddleware, toggleWebsite);
router.get('/public-menu/:slug', getPublicMenuPage);
router.post('/public-menu/:slug/order', createPublicOrder);
router.get('/public-menu/:slug/order/:orderId/status', getPublicOrderStatus);

// Account
router.get('/account', authMiddleware, getAccount);
router.patch('/account/credentials', authMiddleware, updateCredentials);
router.patch('/account/avatar', authMiddleware, updateAvatar);
router.get('/account/backup', authMiddleware, backupData);

module.exports = router;
