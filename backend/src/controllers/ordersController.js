const Order = require('../models/Order');
const Table = require('../models/Table');
const Restaurant = require('../models/Restaurant');
const { broadcastOrderUpdate } = require('../config/socket');

const freeTableIfNoActiveOrders = async (tableId, tableName, tenantId) => {
  let table = null;
  if (tableId) {
    table = await Table.findOne({ _id: tableId, tenantId });
  } else if (tableName) {
    table = await Table.findOne({ name: tableName, tenantId });
  }
  if (!table) return;

  // Check if there are any other unpaid Dine-In orders for this table
  const activeOrder = await Order.findOne({
    tenantId,
    $or: [
      { tableId: table._id },
      { tableName: table.name }
    ],
    isPaid: false,
    status: { $nin: ['paid', 'cancelled'] }
  });

  if (!activeOrder) {
    table.status = 'available';
    table.currentOrderId = null;
    await table.save();
  } else {
    table.currentOrderId = activeOrder._id;
    table.status = 'occupied';
    await table.save();
  }
};

// GET /api/orders
exports.getOrders = async (req, res) => {
  try {
    const { status, date } = req.query;
    let query = { tenantId: req.tenantId };
    if (status) query.status = status;
    if (date) {
      const start = new Date(date); start.setHours(0, 0, 0, 0);
      const end = new Date(date); end.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: start, $lte: end };
    }
    const orders = await Order.find(query).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, orders });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// POST /api/orders
exports.createOrder = async (req, res) => {
  try {
    let { tableId, tableName, items, notes, staffId, staffName, orderType, customerName, customerPhone, deliveryAddress } = req.body;
    if (!tableId || tableId === '') tableId = null;
    if (!staffId || staffId === '') staffId = null;

    const restaurant = await Restaurant.findOne({ tenantId: req.tenantId });
    const taxRate = restaurant?.taxRate || 0;

    const subtotal = items.reduce((sum, i) => {
      const modTotal = (i.modifiers || []).reduce((ms, m) => ms + (m.price || 0), 0);
      return sum + (i.price + modTotal) * i.quantity;
    }, 0);
    const taxAmount = parseFloat((subtotal * taxRate / 100).toFixed(2));
    const totalAmount = parseFloat((subtotal + taxAmount).toFixed(2));

    const orderNumber = `Order ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
    const enrichedItems = items.map(i => ({
      ...i,
      subtotal: parseFloat(((i.price + (i.modifiers || []).reduce((s, m) => s + m.price, 0)) * i.quantity).toFixed(2)),
    }));

    const order = await Order.create({
      tenantId: req.tenantId, orderNumber, tableId, tableName, items: enrichedItems,
      staffId, staffName, subtotal, taxRate, taxAmount, totalAmount, notes,
      orderType, customerName, customerPhone, deliveryAddress
    });

    // Update table status
    if (tableId) {
      await Table.findByIdAndUpdate(tableId, { status: 'occupied', currentOrderId: order._id });
    } else if (tableName) {
      await Table.findOneAndUpdate(
        { name: tableName, tenantId: req.tenantId },
        { status: 'occupied', currentOrderId: order._id }
      );
    }

    broadcastOrderUpdate(req.tenantId, 'create');

    res.status(201).json({ success: true, order });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// PATCH /api/orders/:id
exports.updateOrder = async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (updateData.tableId === '') updateData.tableId = null;
    if (updateData.staffId === '') updateData.staffId = null;

    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { $set: updateData },
      { new: true }
    );
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // If paid or cancelled, free up table
    if (req.body.isPaid || req.body.status === 'paid' || req.body.status === 'cancelled') {
      await freeTableIfNoActiveOrders(order.tableId, order.tableName, req.tenantId);
    }

    const isPayment = req.body.isPaid || req.body.status === 'paid';
    broadcastOrderUpdate(req.tenantId, isPayment ? 'payment' : 'update');

    res.json({ success: true, order });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// DELETE /api/orders/:id
exports.deleteOrder = async (req, res) => {
  try {
    const order = await Order.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    
    await freeTableIfNoActiveOrders(order.tableId, order.tableName, req.tenantId);

    broadcastOrderUpdate(req.tenantId, 'update');

    res.json({ success: true, message: 'Order deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// POST /api/orders/:id/payment
exports.processPayment = async (req, res) => {
  try {
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { $set: { isPaid: true, status: 'paid', paidAt: new Date() } },
      { new: true }
    );
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    
    await freeTableIfNoActiveOrders(order.tableId, order.tableName, req.tenantId);

    // Update staff total sales
    if (order.staffId) {
      const Staff = require('../models/Staff');
      await Staff.findByIdAndUpdate(order.staffId, { $inc: { totalSales: order.totalAmount } });
    }

    broadcastOrderUpdate(req.tenantId, 'payment');

    res.json({ success: true, order });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
