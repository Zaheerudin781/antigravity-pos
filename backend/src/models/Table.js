const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  section: { type: String, default: 'Main Room' },
  capacity: { type: Number, default: 4 },
  status: {
    type: String,
    enum: ['available', 'ordering', 'occupied', 'bill-requested'],
    default: 'available',
  },
  currentOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  position: { x: { type: Number, default: 0 }, y: { type: Number, default: 0 } },
}, { timestamps: true });

tableSchema.index({ tenantId: 1, section: 1 });

module.exports = mongoose.model('Table', tableSchema);
