const mongoose = require('mongoose');
const { nextSequence } = require('./User');

function withNumericId(schema, collectionName) {
  schema.pre('save', async function assignNumericId(next) {
    if (!this.id) this.id = await nextSequence(collectionName);
    next();
  });
}

const postSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    user_id: { type: Number, index: true },
    author_name: { type: String, default: '' },
    company_name: { type: String, default: '' },
    question: { type: String, default: '' },
    post_type: { type: String, default: 'Interview Question' },
    role_tag: { type: String, default: '' },
    difficulty: { type: String, default: 'Medium' },
    visibility: { type: String, default: 'Public' },
    image_data: { type: String, default: '' },
    poll_options: { type: [String], default: [] },
    hashtags: { type: [String], default: [] },
    like_count: { type: Number, default: 0 },
    comment_count: { type: Number, default: 0 },
    save_count: { type: Number, default: 0 },
    share_count: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

const commentSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    post_id: { type: Number, index: true },
    user_id: { type: Number, index: true },
    parent_id: { type: Number, default: null },
    author_name: { type: String, default: '' },
    content: { type: String, default: '' },
    like_count: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

const reactionSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    post_id: { type: Number, index: true },
    user_id: { type: Number, index: true },
    reaction_type: { type: String, default: 'like' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

const commentReactionSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    comment_id: { type: Number, index: true },
    user_id: { type: Number, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

const followSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    follower_id: { type: Number, index: true },
    following_id: { type: Number, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

const storySchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    user_id: { type: Number, index: true },
    content_type: { type: String, default: 'tip' },
    text_content: { type: String, default: '' },
    image_data: { type: String, default: '' },
    bg_color: { type: String, default: '#1E293B' },
    expires_at: { type: Date, required: true },
    views_count: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

const storyViewSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    story_id: { type: Number, index: true },
    viewer_id: { type: Number, index: true },
  },
  { timestamps: { createdAt: 'viewed_at', updatedAt: 'updated_at' } }
);

const notificationSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    user_id: { type: Number, index: true },
    actor_id: { type: Number, default: null },
    type: { type: String, required: true },
    message: { type: String, default: '' },
    reference_id: { type: Number, default: null },
    is_read: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

const directMessageSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    sender_id: { type: Number, index: true },
    receiver_id: { type: Number, index: true },
    content: { type: String, default: '' },
    shared_post_id: { type: Number, default: null },
    is_read: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

withNumericId(postSchema, 'posts');
withNumericId(commentSchema, 'comments');
withNumericId(reactionSchema, 'post_reactions');
withNumericId(commentReactionSchema, 'comment_reactions');
withNumericId(followSchema, 'follows');
withNumericId(storySchema, 'stories');
withNumericId(storyViewSchema, 'story_views');
withNumericId(notificationSchema, 'notifications');
withNumericId(directMessageSchema, 'direct_messages');

module.exports = {
  Post: mongoose.models.Post || mongoose.model('Post', postSchema),
  Comment: mongoose.models.Comment || mongoose.model('Comment', commentSchema),
  PostReaction: mongoose.models.PostReaction || mongoose.model('PostReaction', reactionSchema),
  CommentReaction: mongoose.models.CommentReaction || mongoose.model('CommentReaction', commentReactionSchema),
  Follow: mongoose.models.Follow || mongoose.model('Follow', followSchema),
  Story: mongoose.models.Story || mongoose.model('Story', storySchema),
  StoryView: mongoose.models.StoryView || mongoose.model('StoryView', storyViewSchema),
  Notification: mongoose.models.Notification || mongoose.model('Notification', notificationSchema),
  DirectMessage: mongoose.models.DirectMessage || mongoose.model('DirectMessage', directMessageSchema),
};
