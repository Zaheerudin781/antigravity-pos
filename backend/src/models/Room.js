const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
}, { timestamps: true });

roomSchema.index({ tenantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Room', roomSchema);
