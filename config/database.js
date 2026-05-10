const mongoose = require('mongoose');

async function connectDatabase() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not configured');
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(mongoUri);
  console.log('[database] MongoDB connected');
}

module.exports = connectDatabase;
