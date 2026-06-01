const mongoose = require('mongoose');
const seedDatabase = require('./seed');

const connectDB = async () => {
  const primaryUri = process.env.MONGO_URI;
  const localUri = 'mongodb://localhost:27017/global_pos_local_dev';

  try {
    console.log('🔌 Connecting to MongoDB...');
    const conn = await mongoose.connect(primaryUri, { serverSelectionTimeoutMS: 4000 });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    await seedDatabase();
  } catch (error) {
    console.error(`MongoDB Primary Connection Error: ${error.message}`);
    console.log('🔄 Attempting fallback connection to local MongoDB...');
    try {
      const conn = await mongoose.connect(localUri, { serverSelectionTimeoutMS: 4000 });
      console.log(`MongoDB Local Fallback Connected: ${conn.connection.host}`);
      await seedDatabase();
    } catch (fallbackError) {
      console.error(`MongoDB Fallback Connection Error: ${fallbackError.message}`);
      // Keep process alive so backend/frontend servers stay up and report diagnostics
      console.log('⚠️ Server running with disconnected database state.');
    }
  }
};

module.exports = connectDB;
