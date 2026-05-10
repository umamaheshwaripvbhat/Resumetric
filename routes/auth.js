const bcrypt = require('bcrypt');
const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { User, ResumeAnalysis, PointsHistory } = require('../models/User');
const { Post, PostReaction, Comment, Follow } = require('../models/Post');

const router = express.Router();
const form = multer().none();

function tokenFor(user) {
  return jwt.sign(
    { sub: String(user.id) },
    process.env.JWT_SECRET || 'resumetric-super-secret-key',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function reputationLevel(points = 0) {
  if (points >= 1000) return 'Legend Trophy';
  if (points >= 501) return 'Expert Diamond';
  if (points >= 201) return 'Rising Star';
  if (points >= 51) return 'Contributor';
  return 'Newcomer';
}

function parseInterests(interests) {
  if (Array.isArray(interests)) return interests;
  if (!interests) return [];
  try {
    const parsed = JSON.parse(interests);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return String(interests).split(',').map((item) => item.trim()).filter(Boolean);
  }
}

function serializeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    profile_photo: user.profile_photo,
    occupation: user.occupation,
    college: user.college,
    degree_field: user.degree_field,
    graduation_year: user.graduation_year,
    looking_for: user.looking_for,
    company: user.company,
    role: user.role,
    experience: user.experience,
    industry: user.industry,
    open_to_opportunities: user.open_to_opportunities,
    interests: parseInterests(user.interests),
    other_interest: user.other_interest,
    bio: user.bio || '',
    points: user.points || 0,
    reputation_level: reputationLevel(user.points || 0),
    login_streak: user.login_streak || 0,
    resume_count: user.resume_count || 0,
    mock_count: user.mock_count || 0,
    followers_count: user.followers_count || 0,
    following_count: user.following_count || 0,
    is_verified: Boolean(user.is_verified || (user.points || 0) >= 500),
  };
}

async function awardPoints(userId, points, reason) {
  if (!userId || points <= 0) return;
  const user = await User.findOne({ id: Number(userId) });
  if (!user) return;
  user.points = (user.points || 0) + points;
  await user.save();
  await PointsHistory.create({ user_id: Number(userId), points, reason });
}

async function serializePost(post, viewerId = 0) {
  const [author, comments, liked, saved] = await Promise.all([
    User.findOne({ id: post.user_id }),
    Comment.find({ post_id: post.id }).sort({ created_at: 1 }),
    viewerId ? PostReaction.findOne({ post_id: post.id, user_id: Number(viewerId), reaction_type: 'like' }) : null,
    viewerId ? PostReaction.findOne({ post_id: post.id, user_id: Number(viewerId), reaction_type: 'save' }) : null,
  ]);

  return {
    id: post.id,
    user_id: post.user_id,
    author_name: post.author_name,
    author_username: author?.username || null,
    author_photo: author?.profile_photo || null,
    author_occupation: author?.occupation || null,
    author_verified: Boolean(author && (author.is_verified || (author.points || 0) >= 500)),
    company_name: post.company_name,
    question: post.question,
    post_type: post.post_type || 'Interview Question',
    role_tag: post.role_tag || '',
    difficulty: post.difficulty || 'Medium',
    visibility: post.visibility || 'Public',
    image_data: post.image_data || '',
    poll_options: post.poll_options || [],
    hashtags: post.hashtags || [],
    like_count: post.like_count || 0,
    comment_count: post.comment_count || comments.length,
    save_count: post.save_count || 0,
    share_count: post.share_count || 0,
    liked: Boolean(liked),
    saved: Boolean(saved),
    comments: comments.map(serializeComment),
    created_at: post.created_at?.toISOString() || '',
  };
}

function serializeComment(comment) {
  return {
    id: comment.id,
    post_id: comment.post_id,
    user_id: comment.user_id,
    parent_id: comment.parent_id,
    author_name: comment.author_name,
    content: comment.content,
    like_count: comment.like_count || 0,
    created_at: comment.created_at?.toISOString() || '',
  };
}

router.post('/register', form, async (req, res, next) => {
  try {
    const body = req.body;
    const email = String(body.email || '').trim().toLowerCase();
    if (await User.findOne({ email })) return res.json({ error: 'Email already registered' });

    await User.create({
      email,
      password: await bcrypt.hash(body.password, 10),
      name: body.name,
      phone: body.phone,
      occupation: body.occupation,
      semester: body.semester,
      company: body.company,
      role: body.role,
      experience: body.experience,
      resume_count: 0,
      mock_count: 0,
    });

    res.json({ message: 'Account created successfully' });
  } catch (error) {
    next(error);
  }
});

router.get('/username-available', async (req, res, next) => {
  try {
    const normalized = String(req.query.username || '').trim().toLowerCase().replace(/^@/, '');
    if (!/^[a-z0-9_]{3,24}$/.test(normalized)) {
      return res.json({ available: false, message: 'Use 3-24 letters, numbers, or underscores.' });
    }
    const exists = await User.findOne({ username: normalized });
    res.json({ available: !exists });
  } catch (error) {
    next(error);
  }
});

router.post('/community-register', form, async (req, res, next) => {
  try {
    const body = req.body;
    const normalizedUsername = String(body.username || '').trim().toLowerCase().replace(/^@/, '');
    const email = String(body.email || '').trim().toLowerCase();

    if (!/^[a-z0-9_]{3,24}$/.test(normalizedUsername)) {
      return res.json({ error: 'Username must be 3-24 characters using letters, numbers, or underscores.' });
    }
    if (await User.findOne({ email })) return res.json({ error: 'Email already registered' });
    if (await User.findOne({ username: normalizedUsername })) return res.json({ error: 'Username already taken' });

    const user = await User.create({
      email,
      password: await bcrypt.hash(body.password, 10),
      name: String(body.name || '').trim(),
      username: normalizedUsername,
      profile_photo: body.profile_photo,
      phone: '',
      occupation: body.occupation,
      college: body.college,
      degree_field: body.degree_field,
      graduation_year: body.graduation_year,
      looking_for: body.looking_for,
      company: body.company,
      role: body.role,
      experience: body.experience,
      industry: body.industry,
      open_to_opportunities: body.open_to_opportunities,
      interests: parseInterests(body.interests),
      other_interest: body.other_interest,
      resume_count: 0,
      mock_count: 0,
    });

    res.json({ message: 'Account created successfully', token: tokenFor(user), user: serializeUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post('/login-check', form, async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(req.body.password || '', user.password))) {
      return res.json({ error: 'Invalid credentials' });
    }

    const today = new Date().toISOString().slice(0, 10);
    if (user.last_login_date !== today) {
      user.login_streak = (user.login_streak || 0) + 1;
      user.last_login_date = today;
      await user.save();
      await awardPoints(user.id, 1, 'Daily login streak');
    }

    const refreshed = await User.findOne({ id: user.id });
    res.json({ token: tokenFor(refreshed), user_id: refreshed.id, user: serializeUser(refreshed) });
  } catch (error) {
    next(error);
  }
});

router.get('/history', async (req, res, next) => {
  try {
    const analyses = await ResumeAnalysis.find({ user_id: Number(req.query.user_id) }).sort({ created_at: 1 });
    let prevScore = null;
    const history = analyses.map((analysis) => {
      const diff = prevScore === null ? 0 : analysis.score - prevScore;
      prevScore = analysis.score;
      return {
        id: analysis.id,
        score: analysis.score,
        diff,
        date: analysis.created_at?.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) || '',
        data: analysis.data,
      };
    });
    res.json(history.reverse());
  } catch (error) {
    next(error);
  }
});

router.get('/profile/:user_id', async (req, res, next) => {
  try {
    const userId = Number(req.params.user_id);
    const user = await User.findOne({ id: userId });
    if (!user) return res.json({ error: 'User not found' });

    const [postsCount, followersCount, followingCount] = await Promise.all([
      Post.countDocuments({ user_id: userId }),
      Follow.countDocuments({ following_id: userId }),
      Follow.countDocuments({ follower_id: userId }),
    ]);
    const profile = serializeUser(user);

    res.json({
      name: user.name,
      email: user.email,
      username: user.username,
      profile_photo: user.profile_photo,
      occupation: user.occupation,
      college_sem: user.occupation === 'Student' ? user.semester : null,
      college: user.college,
      degree_field: user.degree_field,
      graduation_year: user.graduation_year,
      looking_for: user.looking_for,
      company: user.occupation === 'Working' ? user.company : null,
      branch: user.role,
      role: user.role,
      experience: user.experience,
      industry: user.industry,
      open_to_opportunities: user.open_to_opportunities,
      interests: profile.interests,
      other_interest: user.other_interest,
      bio: user.bio || '',
      points: user.points || 0,
      reputation_level: reputationLevel(user.points || 0),
      posts_count: postsCount,
      followers_count: followersCount,
      following_count: followingCount,
      resume_count: user.resume_count,
      mock_count: user.mock_count,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/profile/:user_id', async (req, res, next) => {
  try {
    const user = await User.findOne({ id: Number(req.params.user_id) });
    if (!user) return res.json({ error: 'User not found' });
    ['company', 'college', 'role'].forEach((field) => {
      if (req.body[field] !== undefined) user[field] = req.body[field];
    });
    if (req.body.name !== undefined) user.name = String(req.body.name).slice(0, 80);
    if (req.body.bio !== undefined) user.bio = String(req.body.bio).slice(0, 150);
    if (req.body.profile_photo !== undefined) user.profile_photo = req.body.profile_photo;
    await user.save();
    res.json({ message: 'Profile updated', user: serializeUser(user) });
  } catch (error) {
    next(error);
  }
});

router.get('/profile/:user_id/activity', async (req, res, next) => {
  try {
    const userId = Number(req.params.user_id);
    const [posts, savedReactions, likedReactions, comments, history] = await Promise.all([
      Post.find({ user_id: userId }).sort({ created_at: -1 }),
      PostReaction.find({ user_id: userId, reaction_type: 'save' }),
      PostReaction.find({ user_id: userId, reaction_type: 'like' }),
      Comment.find({ user_id: userId }).sort({ created_at: -1 }),
      PointsHistory.find({ user_id: userId }).sort({ created_at: -1 }).limit(20),
    ]);
    const saved = await Post.find({ id: { $in: savedReactions.map((r) => r.post_id) } });
    const liked = await Post.find({ id: { $in: likedReactions.map((r) => r.post_id) } });

    res.json({
      posts: await Promise.all(posts.map((post) => serializePost(post, userId))),
      saved: await Promise.all(saved.map((post) => serializePost(post, userId))),
      liked: await Promise.all(liked.map((post) => serializePost(post, userId))),
      comments: comments.map(serializeComment),
      points_history: history.map((item) => ({
        id: item.id,
        points: item.points,
        reason: item.reason,
        created_at: item.created_at?.toISOString() || '',
      })),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
module.exports.serializeUser = serializeUser;
module.exports.serializePost = serializePost;
module.exports.serializeComment = serializeComment;
module.exports.awardPoints = awardPoints;
module.exports.reputationLevel = reputationLevel;
