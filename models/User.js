const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  _id: String,
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

async function nextSequence(name) {
  const counter = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

const userSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    email: { type: String, unique: true, index: true, required: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    username: { type: String, unique: true, sparse: true, index: true },
    profile_photo: { type: String, default: '' },
    phone: { type: String, default: '' },
    occupation: { type: String, default: '' },
    semester: { type: String, default: '' },
    college: { type: String, default: '' },
    degree_field: { type: String, default: '' },
    graduation_year: { type: String, default: '' },
    looking_for: { type: String, default: '' },
    company: { type: String, default: '' },
    role: { type: String, default: '' },
    experience: { type: String, default: '' },
    industry: { type: String, default: '' },
    open_to_opportunities: { type: String, default: '' },
    interests: { type: mongoose.Schema.Types.Mixed, default: [] },
    other_interest: { type: String, default: '' },
    bio: { type: String, default: '' },
    points: { type: Number, default: 0 },
    last_login_date: { type: String, default: '' },
    login_streak: { type: Number, default: 0 },
    resume_count: { type: Number, default: 0 },
    mock_count: { type: Number, default: 0 },
    followers_count: { type: Number, default: 0 },
    following_count: { type: Number, default: 0 },
    is_verified: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

userSchema.pre('save', async function assignUserId(next) {
  if (!this.id) this.id = await nextSequence('users');
  next();
});

const resumeAnalysisSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    user_id: { type: Number, index: true },
    score: { type: Number, default: 0 },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

resumeAnalysisSchema.pre('save', async function assignAnalysisId(next) {
  if (!this.id) this.id = await nextSequence('analyses');
  next();
});

const pointsHistorySchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    user_id: { type: Number, index: true },
    points: { type: Number, default: 0 },
    reason: { type: String, default: '' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

pointsHistorySchema.pre('save', async function assignPointsId(next) {
  if (!this.id) this.id = await nextSequence('points_history');
  next();
});

const User = mongoose.models.User || mongoose.model('User', userSchema);
const ResumeAnalysis = mongoose.models.ResumeAnalysis || mongoose.model('ResumeAnalysis', resumeAnalysisSchema);
const PointsHistory = mongoose.models.PointsHistory || mongoose.model('PointsHistory', pointsHistorySchema);

module.exports = {
  User,
  ResumeAnalysis,
  PointsHistory,
  nextSequence,
};
