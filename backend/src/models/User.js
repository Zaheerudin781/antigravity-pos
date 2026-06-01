const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  pin: { type: String, default: null },
  role: { type: String, enum: ['Admin', 'Waiter', 'Chef', 'Cashier'], default: 'Waiter' },
  isActive: { type: Boolean, default: true },
  avatarUrl: { type: String, default: '' },
}, { timestamps: true });

userSchema.index({ tenantId: 1, email: 1 }, { unique: true });

userSchema.pre('save', async function () {
  if (!this.isModified('passwordHash')) return;
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
});

userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);
