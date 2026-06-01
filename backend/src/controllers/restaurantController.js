const Restaurant = require('../models/Restaurant');

exports.getRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ tenantId: req.tenantId });
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });
    res.json({ success: true, restaurant });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findOneAndUpdate(
      { tenantId: req.tenantId },
      { $set: req.body },
      { new: true, upsert: true }
    );
    res.json({ success: true, restaurant });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
