const express = require('express');
const router = express.Router();
const Restaurant = require('../models/Restaurant');
const Order = require('../models/Order');
const User = require('../models/User');
const { authMiddleware, requireRole } = require('../middleware/auth');

// GET /api/restaurant/billing-status — get current restaurant billing tier and monthly usage count
router.get('/restaurant/billing-status', authMiddleware, requireRole('Admin'), async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ tenantId: req.tenantId });
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const orderCount = await Order.countDocuments({
      tenantId: req.tenantId,
      createdAt: { $gte: startOfMonth }
    });

    const tier = restaurant.subscriptionTier || 'Free';
    let limit = 50;
    if (tier === 'Small') limit = 700;
    else if (tier === 'Medium') limit = 1200;
    else if (tier === 'Large') limit = Infinity;

    res.json({
      success: true,
      billing: {
        tier,
        billingInterval: restaurant.billingInterval || 'monthly',
        status: restaurant.subscriptionExpiry && now > new Date(restaurant.subscriptionExpiry) ? 'expired' : (restaurant.subscriptionStatus || 'trial'),
        expiry: restaurant.subscriptionExpiry,
        monthlyOrdersCount: orderCount,
        limit
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/restaurant/subscription — Admin upgrade/change plan self-checkout
router.put('/restaurant/subscription', authMiddleware, requireRole('Admin'), async (req, res) => {
  try {
    const { tier, billingInterval } = req.body;
    if (!['Free', 'Small', 'Medium', 'Large'].includes(tier)) {
      return res.status(400).json({ success: false, message: 'Invalid subscription tier' });
    }
    if (!['monthly', 'yearly'].includes(billingInterval)) {
      return res.status(400).json({ success: false, message: 'Invalid billing interval' });
    }

    const restaurant = await Restaurant.findOne({ tenantId: req.tenantId });
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });

    // Set expiration date based on interval
    const durationDays = billingInterval === 'yearly' ? 365 : 30;
    const expiryDate = tier === 'Free'
      ? new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000) // far future for Free
      : new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

    restaurant.subscriptionTier = tier;
    restaurant.billingInterval = billingInterval;
    restaurant.subscriptionStatus = tier === 'Free' ? 'trial' : 'active';
    restaurant.subscriptionExpiry = expiryDate;
    await restaurant.save();

    res.json({ success: true, message: `Successfully upgraded to ${tier} Plan (${billingInterval})`, restaurant });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/saas/ceo-metrics — Aggregated metrics for SaaS CEO
router.get('/saas/ceo-metrics', authMiddleware, requireRole('CEO'), async (req, res) => {
  try {
    const restaurants = await Restaurant.find({}).sort({ createdAt: -1 });
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const tenants = [];
    let totalMRR = 0;
    let freeCount = 0;
    let smallCount = 0;
    let mediumCount = 0;
    let largeCount = 0;
    let activeCount = 0;
    let expiredCount = 0;
    let trialCount = 0;

    for (const r of restaurants) {
      // Calculate orders this month for each restaurant
      const monthlyOrders = await Order.countDocuments({
        tenantId: r.tenantId,
        createdAt: { $gte: startOfMonth }
      });

      // Calculate revenue Contribution
      let mrrContrib = 0;
      if (r.subscriptionStatus !== 'expired' && r.subscriptionTier !== 'Free') {
        const isYearly = r.billingInterval === 'yearly';
        if (r.subscriptionTier === 'Small') mrrContrib = isYearly ? (290 / 12) : 29;
        else if (r.subscriptionTier === 'Medium') mrrContrib = isYearly ? (590 / 12) : 59;
        else if (r.subscriptionTier === 'Large') mrrContrib = isYearly ? (1290 / 12) : 129;
      }
      totalMRR += mrrContrib;

      // Plan counters
      if (r.subscriptionTier === 'Free') freeCount++;
      else if (r.subscriptionTier === 'Small') smallCount++;
      else if (r.subscriptionTier === 'Medium') mediumCount++;
      else if (r.subscriptionTier === 'Large') largeCount++;

      // Status counters
      const isExpired = r.subscriptionExpiry && now > new Date(r.subscriptionExpiry);
      const status = r.subscriptionTier === 'Free' ? 'Free' : (isExpired ? 'expired' : r.subscriptionStatus);
      if (status === 'expired') expiredCount++;
      else if (status === 'trial') trialCount++;
      else if (status === 'active') activeCount++;

      tenants.push({
        _id: r._id,
        tenantId: r.tenantId,
        businessName: r.businessName,
        email: r.email,
        phone: r.phone,
        subscriptionTier: r.subscriptionTier,
        billingInterval: r.billingInterval,
        subscriptionStatus: status,
        subscriptionExpiry: r.subscriptionExpiry,
        createdAt: r.createdAt,
        monthlyOrdersCount: monthlyOrders
      });
    }

    const totalOrders = await Order.countDocuments({});

    res.json({
      success: true,
      metrics: {
        totalRestaurants: restaurants.length,
        mrr: Math.round(totalMRR),
        arr: Math.round(totalMRR * 12),
        totalOrders,
        plans: { Free: freeCount, Small: smallCount, Medium: mediumCount, Large: largeCount },
        status: { active: activeCount, expired: expiredCount, trial: trialCount }
      },
      restaurants: tenants
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/saas/update-restaurant-subscription — CEO override of restaurant subscription details
router.put('/saas/update-restaurant-subscription', authMiddleware, requireRole('CEO'), async (req, res) => {
  try {
    const { restaurantId, tier, billingInterval, status, expiryDays } = req.body;
    if (!restaurantId) return res.status(400).json({ success: false, message: 'Restaurant ID required' });

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });

    if (tier) restaurant.subscriptionTier = tier;
    if (billingInterval) restaurant.billingInterval = billingInterval;
    if (status) restaurant.subscriptionStatus = status;
    if (expiryDays !== undefined) {
      restaurant.subscriptionExpiry = new Date(Date.now() + parseInt(expiryDays) * 24 * 60 * 60 * 1000);
    }

    await restaurant.save();
    res.json({ success: true, message: 'Restaurant subscription updated successfully', restaurant });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
