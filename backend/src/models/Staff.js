const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const staffSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true },
  pin: { type: String, required: true },
  role: { type: String, enum: ['Admin', 'Waiter', 'Chef', 'Cashier'], default: 'Waiter' },
  isActive: { type: Boolean, default: true },
  totalSales: { type: Number, default: 0 },
  color: { type: String, default: '#2196f3' },
}, { timestamps: true });


staffSchema.pre('save', async function () {
  if (!this.isModified('pin')) return;
  this.pin = await bcrypt.hash(this.pin, 10);
});

staffSchema.methods.comparePin = async function (pin) {
  return bcrypt.compare(pin, this.pin);
};

module.exports = mongoose.model('Staff', staffSchema);
