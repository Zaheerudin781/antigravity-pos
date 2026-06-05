const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, unique: true, index: true },
  businessName: { type: String, required: true, default: 'My Restaurant' },
  address: { type: String, default: '' },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  taxRate: { type: Number, default: 10 },
  currency: { type: String, default: 'USD' },
  currencySymbol: { type: String, default: '$' },
  logoUrl: { type: String, default: '' },
  coverImageUrl: { type: String, default: '' },
  receiptFooter: { type: String, default: 'Thank you for dining with us!' },
  isWebsitePublished: { type: Boolean, default: false },
  websiteSlug: { type: String, default: '' },
  subscriptionTier: { type: String, enum: ['Free', 'Small', 'Medium', 'Large'], default: 'Free' },
  billingInterval: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
  subscriptionStatus: { type: String, enum: ['active', 'trial', 'expired'], default: 'trial' },
  subscriptionExpiry: { type: Date, default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
  timezone: { type: String, default: 'America/New_York' },
}, { timestamps: true });

module.exports = mongoose.model('Restaurant', restaurantSchema);
