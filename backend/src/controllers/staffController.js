const Staff = require('../models/Staff');
const bcrypt = require('bcryptjs');

exports.getStaff = async (req, res) => {
  try {
    const staff = await Staff.find({ tenantId: req.tenantId }).select('-pin').sort({ role: 1, name: 1 });
    res.json({ success: true, staff });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createStaff = async (req, res) => {
  try {
    const member = await Staff.create({ ...req.body, tenantId: req.tenantId });
    const safe = member.toObject(); delete safe.pin;
    res.status(201).json({ success: true, staff: safe });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateStaff = async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.pin) updates.pin = await bcrypt.hash(updates.pin, 10);
    const member = await Staff.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { $set: updates }, { new: true }
    ).select('-pin');
    if (!member) return res.status(404).json({ success: false, message: 'Staff not found' });
    res.json({ success: true, staff: member });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteStaff = async (req, res) => {
  try {
    await Staff.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    res.json({ success: true, message: 'Staff member deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
