const MenuItem = require('../models/MenuItem');

exports.getMenu = async (req, res) => {
  try {
    const items = await MenuItem.find({ tenantId: req.tenantId }).sort({ category: 1, sortOrder: 1, name: 1 });
    res.json({ success: true, items });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getPublicMenu = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const items = await MenuItem.find({ tenantId, isAvailable: true }).sort({ category: 1 });
    res.json({ success: true, items });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createItem = async (req, res) => {
  try {
    const item = await MenuItem.create({ ...req.body, tenantId: req.tenantId });
    res.status(201).json({ success: true, item });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateItem = async (req, res) => {
  try {
    const item = await MenuItem.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { $set: req.body }, { new: true }
    );
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, item });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteItem = async (req, res) => {
  try {
    await MenuItem.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    res.json({ success: true, message: 'Item deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.toggleAvailability = async (req, res) => {
  try {
    const item = await MenuItem.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    item.isAvailable = !item.isAvailable;
    await item.save();
    res.json({ success: true, item });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
