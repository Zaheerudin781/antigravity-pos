const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const Staff = require('../models/Staff');
const Category = require('../models/Category');
const Room = require('../models/Room');

const generateToken = (user) =>
  jwt.sign(
    { userId: user._id, tenantId: user.tenantId, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

// POST /api/auth/register — creates tenant + admin user
exports.register = async (req, res) => {
  try {
    const { businessName, name, email, password, currency = 'USD', currencySymbol = '$' } = req.body;
    if (!businessName || !name || !email || !password)
      return res.status(400).json({ success: false, message: 'All fields required' });

    // Derive tenantId from businessName slug + timestamp
    const tenantId = `${businessName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

    // Create restaurant + admin user in parallel
    const [restaurant, user] = await Promise.all([
      Restaurant.create({ tenantId, businessName, currency, currencySymbol, websiteSlug: tenantId }),
      User.create({ tenantId, name, email, passwordHash: password, role: 'Admin' }),
    ]);

    const Table = require('../models/Table');
    const MenuItem = require('../models/MenuItem');

    // Seed all default data in parallel (rooms, categories, tables, staff, menu)
    await Promise.all([
      Staff.create({ tenantId, name, pin: '1234', role: 'Admin' }),
      Room.insertMany([
        { tenantId, name: 'Main Room', description: 'Main Dining Area' },
        { tenantId, name: 'Patio', description: 'Outdoor Patio' },
        { tenantId, name: 'Bar', description: 'Lounge and Bar area' },
      ]),
      Category.insertMany([
        { tenantId, name: 'Starters', description: 'Appetizers and snacks', sortOrder: 1 },
        { tenantId, name: 'Pizza', description: 'Freshly baked pizzas', sortOrder: 2 },
        { tenantId, name: 'Salads', description: 'Healthy greens and salads', sortOrder: 3 },
        { tenantId, name: 'Mains', description: 'Hearty main course dishes', sortOrder: 4 },
        { tenantId, name: 'Beverages', description: 'Soft drinks, juices, and hot beverages', sortOrder: 5 },
        { tenantId, name: 'Desserts', description: 'Sweet treats and dessert items', sortOrder: 6 },
      ]),
      Table.insertMany([
        { tenantId, name: 'T1', section: 'Main Room' },
        { tenantId, name: 'T2', section: 'Main Room' },
        { tenantId, name: 'T3', section: 'Main Room' },
        { tenantId, name: 'T4', section: 'Patio' },
        { tenantId, name: 'T5', section: 'Patio' },
        { tenantId, name: 'B1', section: 'Bar' },
      ]),
      MenuItem.insertMany([
        { tenantId, name: 'Margherita Pizza', category: 'Pizza', price: 12.99, costPrice: 4.00, modifiers: [{ name: 'Extra Cheese', price: 1.50 }, { name: 'Gluten Free Base', price: 2.00 }] },
        { tenantId, name: 'Pepperoni Pizza', category: 'Pizza', price: 14.99, costPrice: 4.50, modifiers: [{ name: 'Extra Cheese', price: 1.50 }] },
        { tenantId, name: 'Caesar Salad', category: 'Salads', price: 8.99, costPrice: 2.50, modifiers: [{ name: 'Add Chicken', price: 3.00 }, { name: 'No Croutons', price: 0 }] },
        { tenantId, name: 'Ribeye Steak', category: 'Mains', price: 28.99, costPrice: 9.50, modifiers: [{ name: 'Medium Rare', price: 0 }, { name: 'Well Done', price: 0 }, { name: 'Add Sauce', price: 2.00 }] },
        { tenantId, name: 'Grilled Salmon', category: 'Mains', price: 22.99, costPrice: 7.50, modifiers: [{ name: 'Lemon Butter', price: 0 }] },
        { tenantId, name: 'Coca-Cola', category: 'Beverages', price: 2.99, costPrice: 0.80, modifiers: [] },
        { tenantId, name: 'Fresh Orange Juice', category: 'Beverages', price: 4.99, costPrice: 1.20, modifiers: [] },
        { tenantId, name: 'Chocolate Lava Cake', category: 'Desserts', price: 6.99, costPrice: 2.00, modifiers: [{ name: 'Add Ice Cream', price: 1.50 }] },
        { tenantId, name: 'Tiramisu', category: 'Desserts', price: 5.99, costPrice: 1.80, modifiers: [] },
        { tenantId, name: 'Garlic Bread', category: 'Starters', price: 4.99, costPrice: 1.50, modifiers: [{ name: 'Extra Garlic', price: 0.50 }] },
      ]),
    ]);

    const token = generateToken(user);
    res.status(201).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, tenantId: user.tenantId },
      restaurant,
    });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'Email already registered for this tenant' });
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/login — email + password login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const restaurant = await Restaurant.findOne({ tenantId: user.tenantId });
    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, tenantId: user.tenantId },
      restaurant,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/staff-pin — PIN-based staff login
exports.staffPinLogin = async (req, res) => {
  try {
    const { pin, tenantId } = req.body;
    if (!pin || !tenantId) return res.status(400).json({ success: false, message: 'PIN and tenantId required' });

    const staffList = await Staff.find({ tenantId, isActive: true });
    let matchedStaff = null;
    for (const s of staffList) {
      const ok = await s.comparePin(pin);
      if (ok) { matchedStaff = s; break; }
    }
    if (!matchedStaff) return res.status(401).json({ success: false, message: 'Invalid PIN' });

    const restaurant = await Restaurant.findOne({ tenantId });

    const token = jwt.sign(
      { userId: matchedStaff._id, tenantId, role: matchedStaff.role, name: matchedStaff.name },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({
      success: true,
      token,
      staff: { id: matchedStaff._id, name: matchedStaff.name, role: matchedStaff.role },
      restaurant
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-passwordHash');
    const restaurant = await Restaurant.findOne({ tenantId: req.tenantId });
    res.json({ success: true, user, restaurant });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
