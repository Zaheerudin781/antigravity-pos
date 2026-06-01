const Table = require('../models/Table');
const Order = require('../models/Order');

exports.getTables = async (req, res) => {
  try {
    const tables = await Table.find({ tenantId: req.tenantId }).sort({ section: 1, name: 1 });
    res.json({ success: true, tables });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createTable = async (req, res) => {
  try {
    const table = await Table.create({ ...req.body, tenantId: req.tenantId });
    res.status(201).json({ success: true, table });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateTable = async (req, res) => {
  try {
    const table = await Table.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { $set: req.body }, { new: true }
    );
    if (!table) return res.status(404).json({ success: false, message: 'Table not found' });
    res.json({ success: true, table });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteTable = async (req, res) => {
  try {
    await Table.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    res.json({ success: true, message: 'Table deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getTableOrder = async (req, res) => {
  try {
    const table = await Table.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!table || !table.currentOrderId) return res.json({ success: true, order: null });
    const order = await Order.findById(table.currentOrderId);
    res.json({ success: true, order });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
