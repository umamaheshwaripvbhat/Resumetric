const express = require('express');
const multer = require('multer');
const { User } = require('../models/User');
const {
  Post,
  Comment,
  PostReaction,
  CommentReaction,
  Follow,
  Story,
  StoryView,
  Notification,
  DirectMessage,
} = require('../models/Post');
const { serializeUser, serializePost, serializeComment, awardPoints } = require('./auth');

const router = express.Router();
const form = multer().none();

router.get('/posts', async (req, res, next) => {
  try {
    const posts = await Post.find({}).sort({ created_at: -1 });
    res.json(await Promise.all(posts.map((post) => serializePost(post, Number(req.query.user_id || 0)))));
  } catch (error) {
    next(error);
  }
});

router.post('/posts', async (req, res, next) => {
  try {
    const user = await User.findOne({ id: Number(req.body.user_id) });
    if (!user) return res.json({ error: 'User not found' });
    const contentTags = Array.from(String(req.body.question || '').matchAll(/#(\w+)/g)).map((match) => match[1].toLowerCase());
    const explicitTags = Array.isArray(req.body.hashtags) ? req.body.hashtags : [];
    const hashtags = Array.from(new Set([...explicitTags, ...contentTags].map((tag) => String(tag).toLowerCase())));

    const post = await Post.create({
      user_id: Number(req.body.user_id),
      author_name: user.name,
      company_name: req.body.company_name,
      question: req.body.question,
      post_type: req.body.post_type || 'Interview Question',
      role_tag: req.body.role_tag || '',
      difficulty: req.body.difficulty || 'Medium',
      visibility: req.body.visibility || 'Public',
      image_data: req.body.image_data || '',
      poll_options: Array.isArray(req.body.poll_options) ? req.body.poll_options : [],
      hashtags,
    });

    await awardPoints(user.id, 5, `You earned +5 pts for your post on ${post.company_name} ${post.role_tag || 'community'}`);
    res.json({ message: 'Post created', post: await serializePost(post, user.id) });
  } catch (error) {
    next(error);
  }
});

router.post('/posts/:post_id/comments', async (req, res, next) => {
  try {
    const post = await Post.findOne({ id: Number(req.params.post_id) });
    const user = await User.findOne({ id: Number(req.body.user_id) });
    if (!post || !user) return res.json({ error: 'Post or user not found' });

    const comment = await Comment.create({
      post_id: post.id,
      user_id: user.id,
      parent_id: req.body.parent_id ? Number(req.body.parent_id) : null,
      author_name: user.name,
      content: req.body.content,
    });
    post.comment_count = (post.comment_count || 0) + 1;
    await post.save();
    await awardPoints(user.id, 5, `You earned +5 pts for commenting on ${post.company_name || 'a community post'}`);
    res.json({ message: 'Comment added', comment: serializeComment(comment) });
  } catch (error) {
    next(error);
  }
});

router.post('/posts/:post_id/react', form, async (req, res, next) => {
  try {
    const post = await Post.findOne({ id: Number(req.params.post_id) });
    if (!post) return res.json({ error: 'Post not found' });
    const userId = Number(req.body.user_id);
    const reactionType = req.body.reaction_type;
    const existing = await PostReaction.findOne({ post_id: post.id, user_id: userId, reaction_type: reactionType });

    if (existing) {
      await existing.deleteOne();
      if (reactionType === 'like') post.like_count = Math.max((post.like_count || 0) - 1, 0);
      if (reactionType === 'save') post.save_count = Math.max((post.save_count || 0) - 1, 0);
      await post.save();
      return res.json({ active: false, post: await serializePost(post, userId) });
    }

    await PostReaction.create({ post_id: post.id, user_id: userId, reaction_type: reactionType });
    if (reactionType === 'like') {
      post.like_count = (post.like_count || 0) + 1;
      if (userId !== post.user_id) await awardPoints(post.user_id, 5, `You earned +5 pts because your post on ${post.company_name || 'community'} got a like`);
    } else if (reactionType === 'save') {
      post.save_count = (post.save_count || 0) + 1;
      if (userId !== post.user_id) await awardPoints(post.user_id, 3, `You earned +3 pts because your post on ${post.company_name || 'community'} was saved`);
    } else if (reactionType === 'share') {
      post.share_count = (post.share_count || 0) + 1;
      if (userId !== post.user_id) await awardPoints(post.user_id, 3, `You earned +3 pts because your post on ${post.company_name || 'community'} was shared`);
    }
    await post.save();
    res.json({ active: true, post: await serializePost(post, userId) });
  } catch (error) {
    next(error);
  }
});

router.post('/comments/:comment_id/like', form, async (req, res, next) => {
  try {
    const comment = await Comment.findOne({ id: Number(req.params.comment_id) });
    if (!comment) return res.json({ error: 'Comment not found' });
    const userId = Number(req.body.user_id);
    const existing = await CommentReaction.findOne({ comment_id: comment.id, user_id: userId });
    if (existing) {
      await existing.deleteOne();
      comment.like_count = Math.max((comment.like_count || 0) - 1, 0);
      await comment.save();
      return res.json({ active: false, comment: serializeComment(comment) });
    }
    await CommentReaction.create({ comment_id: comment.id, user_id: userId });
    comment.like_count = (comment.like_count || 0) + 1;
    await comment.save();
    if (userId !== comment.user_id) await awardPoints(comment.user_id, 5, 'You earned +5 pts because your comment got a like');
    res.json({ active: true, comment: serializeComment(comment) });
  } catch (error) {
    next(error);
  }
});

router.post('/follow/:following_id', form, async (req, res, next) => {
  try {
    const followerId = Number(req.body.follower_id);
    const followingId = Number(req.params.following_id);
    if (followerId === followingId) return res.json({ error: 'You cannot follow yourself' });
    const [follower, target] = await Promise.all([
      User.findOne({ id: followerId }),
      User.findOne({ id: followingId }),
    ]);
    if (!follower || !target) return res.json({ error: 'User not found' });

    const existing = await Follow.findOne({ follower_id: followerId, following_id: followingId });
    if (existing) {
      await existing.deleteOne();
      target.followers_count = Math.max((target.followers_count || 0) - 1, 0);
      follower.following_count = Math.max((follower.following_count || 0) - 1, 0);
      await Promise.all([target.save(), follower.save()]);
      return res.json({ following: false, followers_count: target.followers_count, following_count: follower.following_count });
    }

    await Follow.create({ follower_id: followerId, following_id: followingId });
    target.followers_count = (target.followers_count || 0) + 1;
    follower.following_count = (follower.following_count || 0) + 1;
    await Promise.all([target.save(), follower.save()]);
    await awardPoints(followingId, 2, 'You earned +2 pts because someone followed you');
    await Notification.create({ user_id: followingId, actor_id: followerId, type: 'follow', message: `${follower.name} started following you`, reference_id: followerId });
    res.json({ following: true, followers_count: target.followers_count, following_count: follower.following_count });
  } catch (error) {
    next(error);
  }
});

router.get('/leaderboard', async (_req, res, next) => {
  try {
    const users = await User.find({}).sort({ points: -1 }).limit(10);
    res.json(users.map(serializeUser));
  } catch (error) {
    next(error);
  }
});

router.get('/stories', async (_req, res, next) => {
  try {
    const stories = await Story.find({ expires_at: { $gt: new Date() } }).sort({ created_at: -1 });
    const grouped = {};
    for (const story of stories) {
      const author = await User.findOne({ id: story.user_id });
      if (!author) continue;
      if (!grouped[story.user_id]) {
        grouped[story.user_id] = {
          user_id: author.id,
          author_name: author.name,
          author_username: author.username,
          author_photo: author.profile_photo,
          is_verified: Boolean(author.is_verified || (author.points || 0) >= 500),
          has_unseen: false,
          items: [],
        };
      }
      grouped[story.user_id].items.push({
        id: story.id,
        content_type: story.content_type,
        text_content: story.text_content,
        image_data: story.image_data,
        bg_color: story.bg_color,
        created_at: story.created_at?.toISOString() || '',
        expires_at: story.expires_at?.toISOString() || '',
        views_count: story.views_count,
      });
    }
    res.json(Object.values(grouped));
  } catch (error) {
    next(error);
  }
});

router.post('/stories', form, async (req, res, next) => {
  try {
    const userId = Number(req.body.user_id);
    const user = await User.findOne({ id: userId });
    if (!user) return res.json({ error: 'User not found' });
    await Story.create({
      user_id: userId,
      content_type: req.body.content_type || 'tip',
      text_content: req.body.text_content,
      image_data: req.body.image_data,
      bg_color: req.body.bg_color || '#1E293B',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    await awardPoints(userId, 3, 'Earned +3 pts for sharing a story');
    res.json({ message: 'Story posted' });
  } catch (error) {
    next(error);
  }
});

router.post('/stories/:story_id/view', form, async (req, res, next) => {
  try {
    const story = await Story.findOne({ id: Number(req.params.story_id) });
    if (!story) return res.json({ error: 'Story not found' });
    const existing = await StoryView.findOne({ story_id: story.id, viewer_id: Number(req.body.user_id) });
    if (!existing) {
      await StoryView.create({ story_id: story.id, viewer_id: Number(req.body.user_id) });
      story.views_count = (story.views_count || 0) + 1;
      await story.save();
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/notifications/:user_id', async (req, res, next) => {
  try {
    const notifications = await Notification.find({ user_id: Number(req.params.user_id) }).sort({ created_at: -1 }).limit(50);
    const result = [];
    for (const item of notifications) {
      const actor = item.actor_id ? await User.findOne({ id: item.actor_id }) : null;
      result.push({
        id: item.id,
        type: item.type,
        message: item.message,
        reference_id: item.reference_id,
        is_read: item.is_read,
        created_at: item.created_at?.toISOString() || '',
        actor: actor ? { name: actor.name, username: actor.username, profile_photo: actor.profile_photo } : null,
      });
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/notifications/:user_id/read', async (req, res, next) => {
  try {
    await Notification.updateMany({ user_id: Number(req.params.user_id), is_read: false }, { is_read: true });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/explore', async (req, res, next) => {
  try {
    const q = String(req.query.q || '');
    const filterType = String(req.query.filter_type || 'recent');
    const query = {};
    if (q) {
      if (q.startsWith('#')) {
        query.hashtags = q.slice(1).toLowerCase();
      } else {
        const re = new RegExp(q, 'i');
        query.$or = [{ company_name: re }, { role_tag: re }, { question: re }, { author_name: re }];
      }
    }
    const sort = filterType === 'liked' ? { like_count: -1 } : filterType === 'commented' ? { comment_count: -1 } : { created_at: -1 };
    const posts = await Post.find(query).sort(sort).limit(30);
    res.json(await Promise.all(posts.map((post) => serializePost(post, 0))));
  } catch (error) {
    next(error);
  }
});

router.get('/messages/conversations/:user_id', async (req, res, next) => {
  try {
    const userId = Number(req.params.user_id);
    const messages = await DirectMessage.find({ $or: [{ sender_id: userId }, { receiver_id: userId }] }).sort({ created_at: -1 });
    const seen = new Set();
    const conversations = [];
    for (const message of messages) {
      const otherId = message.receiver_id === userId ? message.sender_id : message.receiver_id;
      if (seen.has(otherId)) continue;
      seen.add(otherId);
      const other = await User.findOne({ id: otherId });
      if (!other) continue;
      conversations.push({
        user_id: other.id,
        name: other.name,
        username: other.username,
        profile_photo: other.profile_photo,
        last_message: message.content,
        is_read: message.is_read || message.sender_id === userId,
        created_at: message.created_at?.toISOString() || '',
      });
    }
    res.json(conversations);
  } catch (error) {
    next(error);
  }
});

router.get('/messages/:user_id/:other_id', async (req, res, next) => {
  try {
    const userId = Number(req.params.user_id);
    const otherId = Number(req.params.other_id);
    const messages = await DirectMessage.find({
      $or: [
        { sender_id: userId, receiver_id: otherId },
        { sender_id: otherId, receiver_id: userId },
      ],
    }).sort({ created_at: 1 });
    await DirectMessage.updateMany({ sender_id: otherId, receiver_id: userId, is_read: false }, { is_read: true });
    const result = [];
    for (const message of messages) {
      const shared = message.shared_post_id ? await Post.findOne({ id: message.shared_post_id }) : null;
      result.push({
        id: message.id,
        sender_id: message.sender_id,
        receiver_id: message.receiver_id,
        content: message.content,
        shared_post: shared ? await serializePost(shared, userId) : null,
        is_read: message.is_read,
        created_at: message.created_at?.toISOString() || '',
      });
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/messages', form, async (req, res, next) => {
  try {
    const senderId = Number(req.body.sender_id);
    const receiverId = Number(req.body.receiver_id);
    const sharedPostId = req.body.shared_post_id ? Number(req.body.shared_post_id) : null;
    await DirectMessage.create({ sender_id: senderId, receiver_id: receiverId, content: req.body.content, shared_post_id: sharedPostId });
    const sender = await User.findOne({ id: senderId });
    if (sender) {
      await Notification.create({
        user_id: receiverId,
        actor_id: senderId,
        type: 'message',
        message: sharedPostId ? `${sender.name} shared a post with you` : `${sender.name} sent you a message`,
        reference_id: senderId,
      });
    }
    res.json({ message: 'Sent successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
