const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  modifiers: [{ name: String, price: Number }],
  notes: { type: String, default: '' },
  subtotal: { type: Number, required: true },
});

const orderSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  orderNumber: { type: String, required: true },
  tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', default: null },
  tableName: { type: String, default: '' },
  orderType: { type: String, enum: ['Dine-In', 'Takeaway', 'Delivery'], default: 'Dine-In' },
  customerName: { type: String, default: '' },
  customerPhone: { type: String, default: '' },
  deliveryAddress: { type: String, default: '' },
  items: [orderItemSchema],
  status: {
    type: String,
    enum: ['pending', 'preparing', 'ready', 'served', 'paid', 'cancelled'],
    default: 'pending',
  },
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  staffName: { type: String, default: 'Manager' },
  subtotal: { type: Number, default: 0 },
  taxRate: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  isPaid: { type: Boolean, default: false },
  paidAt: { type: Date, default: null },
}, { timestamps: true });

orderSchema.index({ tenantId: 1, status: 1 });
orderSchema.index({ tenantId: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
