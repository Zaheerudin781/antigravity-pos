const Restaurant = require('../models/Restaurant');
const User = require('../models/User');

exports.getAccount = async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ tenantId: req.tenantId });
    const user = await User.findById(req.user.userId).select('-passwordHash');
    res.json({ success: true, account: { tenantId: req.tenantId, subscriptionTier: restaurant?.subscriptionTier || 'Pro', subscriptionExpiry: restaurant?.subscriptionExpiry, businessName: restaurant?.businessName, adminUser: user } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateCredentials = async (req, res) => {
  try {
    const { name, email, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.userId);
    if (currentPassword) {
      const match = await user.comparePassword(currentPassword);
      if (!match) return res.status(401).json({ success: false, message: 'Current password is incorrect' });
      user.passwordHash = newPassword;
    }
    if (name) user.name = name;
    if (email) user.email = email;
    await user.save();
    res.json({ success: true, message: 'Credentials updated successfully' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.backupData = async (req, res) => {
  try {
    const Order = require('../models/Order');
    const MenuItem = require('../models/MenuItem');
    const Table = require('../models/Table');
    const Staff = require('../models/Staff');

    const [orders, menu, tables, staff, restaurant] = await Promise.all([
      Order.find({ tenantId: req.tenantId }),
      MenuItem.find({ tenantId: req.tenantId }),
      Table.find({ tenantId: req.tenantId }),
      Staff.find({ tenantId: req.tenantId }).select('-pin'),
      Restaurant.findOne({ tenantId: req.tenantId }),
    ]);

    const backup = { exportedAt: new Date().toISOString(), tenantId: req.tenantId, restaurant, orders, menu, tables, staff };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=backup-${req.tenantId}-${new Date().toISOString().split('T')[0]}.json`);
    res.send(JSON.stringify(backup, null, 2));
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateAvatar = async (req, res) => {
  try {
    const { avatarUrl } = req.body;
    await User.findByIdAndUpdate(req.user.userId, { avatarUrl });
    res.json({ success: true, avatarUrl });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

