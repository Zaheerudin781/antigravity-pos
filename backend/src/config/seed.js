const mongoose = require('mongoose');
const Restaurant = require('../models/Restaurant');
const User = require('../models/User');
const Room = require('../models/Room');
const Table = require('../models/Table');
const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');

const seedDatabase = async () => {
  const tenantId = 'pizza-pro-1779905558532';
  try {
    console.log('🌱 Checking if database needs to be seeded...');

    // 1. Seed Restaurant
    const existingRestaurant = await Restaurant.findOne({ tenantId });
    if (!existingRestaurant) {
      console.log('🌱 Seeding Restaurant...');
      await Restaurant.create({
        tenantId,
        businessName: 'Pizza Pro',
        websiteSlug: 'pizza-pro',
        isWebsitePublished: true,
        address: '123 Gourmet Way, NY',
        phone: '212-555-0199',
        email: 'hello@pizzapro.com',
        taxRate: 10,
        currencySymbol: '$',
        receiptFooter: 'Thank you for choosing Pizza Pro!'
      });
    }

    // 2. Seed Admin User
    const existingUser = await User.findOne({ tenantId });
    if (!existingUser) {
      console.log('🌱 Seeding Admin user...');
      await User.create({
        tenantId,
        name: 'Manager',
        email: 'manager@pizzapro.com',
        passwordHash: 'admin123', // Will be hashed automatically by pre-save
        pin: '1234',
        role: 'Admin',
        isActive: true
      });
    }

    // 3. Seed Rooms
    const existingRooms = await Room.find({ tenantId });
    if (existingRooms.length === 0) {
      console.log('🌱 Seeding Rooms...');
      await Room.create([
        { tenantId, name: 'Main Room', description: 'Primary dining hall' },
        { tenantId, name: 'Patio', description: 'Outdoor garden seating' }
      ]);
    }

    // 4. Seed Tables
    const existingTables = await Table.find({ tenantId });
    if (existingTables.length === 0) {
      console.log('🌱 Seeding Tables...');
      await Table.create([
        { tenantId, name: 'T1', section: 'Main Room', capacity: 2, status: 'available' },
        { tenantId, name: 'T2', section: 'Main Room', capacity: 4, status: 'available' },
        { tenantId, name: 'T3', section: 'Main Room', capacity: 4, status: 'available' },
        { tenantId, name: 'T4', section: 'Main Room', capacity: 6, status: 'available' },
        { tenantId, name: 'T5', section: 'Main Room', capacity: 2, status: 'available' },
        { tenantId, name: 'T6', section: 'Main Room', capacity: 4, status: 'available' },
        { tenantId, name: 'P1', section: 'Patio', capacity: 4, status: 'available' },
        { tenantId, name: 'P2', section: 'Patio', capacity: 4, status: 'available' },
        { tenantId, name: 'P3', section: 'Patio', capacity: 6, status: 'available' },
        { tenantId, name: 'P4', section: 'Patio', capacity: 2, status: 'available' }
      ]);
    }

    // 5. Seed Categories
    const existingCategories = await Category.find({ tenantId });
    if (existingCategories.length === 0) {
      console.log('🌱 Seeding Categories...');
      await Category.create([
        { tenantId, name: 'Pizzas', description: 'Wood-fired gourmet pizzas', sortOrder: 1 },
        { tenantId, name: 'Burgers', description: 'Premium craft burgers', sortOrder: 2 },
        { tenantId, name: 'Sides', description: 'Delicious sides and starters', sortOrder: 3 },
        { tenantId, name: 'Drinks', description: 'Cold beverages and sodas', sortOrder: 4 }
      ]);
    }

    // 6. Seed Menu Items
    const existingMenuItems = await MenuItem.find({ tenantId });
    if (existingMenuItems.length === 0) {
      console.log('🌱 Seeding Menu Items...');
      await MenuItem.create([
        {
          tenantId,
          name: 'Margherita Pizza',
          category: 'Pizzas',
          price: 12.99,
          costPrice: 4.50,
          description: 'Wood-fired tomato sauce, fresh mozzarella, basil, olive oil',
          modifiers: [
            { name: 'Extra Cheese', price: 2.00 },
            { name: 'Mushrooms', price: 1.50 }
          ],
          isAvailable: true
        },
        {
          tenantId,
          name: 'Pepperoni Pizza',
          category: 'Pizzas',
          price: 14.99,
          costPrice: 5.50,
          description: 'Classy mozzarella topped with spicy Italian pepperoni slices',
          modifiers: [
            { name: 'Extra Cheese', price: 2.00 },
            { name: 'Jalapenos', price: 1.00 }
          ],
          isAvailable: true
        },
        {
          tenantId,
          name: 'Classic Cheeseburger',
          category: 'Burgers',
          price: 10.99,
          costPrice: 3.80,
          description: 'Angus beef patty, cheddar, lettuce, tomato, house burger sauce',
          modifiers: [
            { name: 'Extra Patty', price: 3.50 },
            { name: 'Crispy Bacon', price: 1.50 }
          ],
          isAvailable: true
        },
        {
          tenantId,
          name: 'Truffle Fries',
          category: 'Sides',
          price: 6.99,
          costPrice: 1.50,
          description: 'Crispy golden fries tossed in truffle oil and parmesan cheese',
          modifiers: [],
          isAvailable: true
        },
        {
          tenantId,
          name: 'Mozzarella Sticks',
          category: 'Sides',
          price: 7.99,
          costPrice: 2.20,
          description: '6 pieces of golden melted cheese sticks with marinara dip',
          modifiers: [],
          isAvailable: true
        },
        {
          tenantId,
          name: 'Italian Craft Beer',
          category: 'Drinks',
          price: 5.50,
          costPrice: 2.00,
          description: 'Premium chilled blond lager from Italian breweries',
          modifiers: [],
          isAvailable: true
        },
        {
          tenantId,
          name: 'Fresh Lemonade',
          category: 'Drinks',
          price: 3.50,
          costPrice: 0.80,
          description: 'Cold pressed organic sweet lemonade with mint leaves',
          modifiers: [],
          isAvailable: true
        }
      ]);
    }

    console.log('🌱 Seeding process complete!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  }
};

module.exports = seedDatabase;
