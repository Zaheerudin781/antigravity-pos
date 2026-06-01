const mongoose = require('mongoose');

const modifierSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, default: 0 },
});

const menuItemSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  costPrice: { type: Number, default: 0, min: 0 },
  description: { type: String, default: '' },
  modifiers: [modifierSchema],
  isAvailable: { type: Boolean, default: true },
  imageUrl: { type: String, default: '' },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

menuItemSchema.index({ tenantId: 1, category: 1 });

module.exports = mongoose.model('MenuItem', menuItemSchema);
