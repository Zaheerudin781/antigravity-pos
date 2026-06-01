const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');

exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ tenantId: req.tenantId }).sort({ sortOrder: 1, name: 1 });
    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const { name, description, sortOrder } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Category name is required' });

    const category = await Category.create({
      tenantId: req.tenantId,
      name,
      description,
      sortOrder: sortOrder || 0
    });
    res.status(201).json({ success: true, category });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Category name already exists' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { name, description, sortOrder } = req.body;
    const oldCategory = await Category.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!oldCategory) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const oldName = oldCategory.name;
    
    oldCategory.name = name || oldCategory.name;
    oldCategory.description = description !== undefined ? description : oldCategory.description;
    oldCategory.sortOrder = sortOrder !== undefined ? sortOrder : oldCategory.sortOrder;

    await oldCategory.save();

    // If name changed, update all MenuItems that use this category
    if (name && oldName !== name) {
      await MenuItem.updateMany(
        { tenantId: req.tenantId, category: oldName },
        { $set: { category: name } }
      );
    }

    res.json({ success: true, category: oldCategory });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Category name already exists' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    // Set any MenuItems using this category to "Uncategorized"
    await MenuItem.updateMany(
      { tenantId: req.tenantId, category: category.name },
      { $set: { category: 'Uncategorized' } }
    );

    // Make sure 'Uncategorized' category exists in the system or create it if there are menu items moved there
    const uncategorizedExists = await Category.findOne({ tenantId: req.tenantId, name: 'Uncategorized' });
    if (!uncategorizedExists) {
      const count = await MenuItem.countDocuments({ tenantId: req.tenantId, category: 'Uncategorized' });
      if (count > 0) {
        await Category.create({ tenantId: req.tenantId, name: 'Uncategorized', description: 'Default category for unassigned items' });
      }
    }

    await category.deleteOne();
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
