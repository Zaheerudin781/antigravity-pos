const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

categorySchema.index({ tenantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);
