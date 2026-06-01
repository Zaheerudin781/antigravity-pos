const Restaurant = require('../models/Restaurant');
const MenuItem = require('../models/MenuItem');
const { broadcastOrderUpdate } = require('../config/socket');

exports.getWebsiteStatus = async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ tenantId: req.tenantId });
    res.json({ success: true, isPublished: restaurant?.isWebsitePublished || false, slug: restaurant?.websiteSlug || '', businessName: restaurant?.businessName || '' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.toggleWebsite = async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ tenantId: req.tenantId });
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });
    restaurant.isWebsitePublished = !restaurant.isWebsitePublished;
    await restaurant.save();
    res.json({ success: true, isPublished: restaurant.isWebsitePublished, slug: restaurant.websiteSlug, url: `http://localhost:3000/menu/${restaurant.websiteSlug}` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getPublicMenuPage = async (req, res) => {
  try {
    const { slug } = req.params;
    const restaurant = await Restaurant.findOne({ websiteSlug: slug, isWebsitePublished: true });
    if (!restaurant) return res.status(404).json({ success: false, message: 'Menu not found or not published' });
    const items = await MenuItem.find({ tenantId: restaurant.tenantId, isAvailable: true }).sort({ category: 1 });
    res.json({ success: true, restaurant: { businessName: restaurant.businessName, currency: restaurant.currency, currencySymbol: restaurant.currencySymbol }, items });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createPublicOrder = async (req, res) => {
  try {
    const { slug } = req.params;
    const { items, orderType, customerName, customerPhone, deliveryAddress, notes } = req.body;
    
    const restaurant = await Restaurant.findOne({ websiteSlug: slug, isWebsitePublished: true });
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found or ordering is disabled' });

    const Order = require('../models/Order');
    const taxRate = restaurant.taxRate || 0;

    const subtotal = items.reduce((sum, i) => {
      const modTotal = (i.modifiers || []).reduce((ms, m) => ms + (m.price || 0), 0);
      return sum + (i.price + modTotal) * i.quantity;
    }, 0);
    const taxAmount = parseFloat((subtotal * taxRate / 100).toFixed(2));
    const totalAmount = parseFloat((subtotal + taxAmount).toFixed(2));

    // Web order prefix
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    const orderNumber = `Web-${timeStr}`;

    const enrichedItems = items.map(i => ({
      ...i,
      subtotal: parseFloat(((i.price + (i.modifiers || []).reduce((s, m) => s + m.price, 0)) * i.quantity).toFixed(2)),
    }));

    const order = await Order.create({
      tenantId: restaurant.tenantId,
      orderNumber,
      tableName: `Online (${orderType})`,
      orderType,
      customerName,
      customerPhone,
      deliveryAddress,
      items: enrichedItems,
      staffName: 'Online Customer',
      subtotal,
      taxRate,
      taxAmount,
      totalAmount,
      notes,
      status: 'pending',
    });

    broadcastOrderUpdate(restaurant.tenantId);

    res.status(201).json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getPublicOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const Order = require('../models/Order');
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({
      success: true,
      status: order.status,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      items: order.items,
      totalAmount: order.totalAmount,
      isPaid: order.isPaid,
      customerName: order.customerName,
      orderType: order.orderType,
      tableName: order.tableName
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

