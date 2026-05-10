from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, index=True)
    password = Column(String)
    name = Column(String)
    username = Column(String, unique=True, index=True, nullable=True)
    profile_photo = Column(Text, nullable=True)
    phone = Column(String)
    occupation = Column(String)  # 'Student' or 'Working'
    semester = Column(String, nullable=True)
    college = Column(String, nullable=True)
    degree_field = Column(String, nullable=True)
    graduation_year = Column(String, nullable=True)
    looking_for = Column(String, nullable=True)
    company = Column(String, nullable=True)
    role = Column(String, nullable=True)
    experience = Column(String, nullable=True)
    industry = Column(String, nullable=True)
    open_to_opportunities = Column(String, nullable=True)
    interests = Column(Text, nullable=True)
    other_interest = Column(String, nullable=True)
    bio = Column(String, nullable=True)
    points = Column(Integer, default=0)
    last_login_date = Column(String, nullable=True)
    login_streak = Column(Integer, default=0)
    # Monetization limits
    resume_count = Column(Integer, default=0)
    mock_count = Column(Integer, default=0)
    # Social stats (denormalized for speed)
    followers_count = Column(Integer, default=0)
    following_count = Column(Integer, default=0)
    is_verified = Column(Boolean, default=False)
    # Settings & Preferences
    notifications_enabled = Column(Boolean, default=True)
    is_private = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

class ResumeAnalysis(Base):
    __tablename__ = "analyses"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer)
    score = Column(Integer)
    data = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

class Post(Base):
    __tablename__ = "posts"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer)
    author_name = Column(String)
    company_name = Column(String)
    question = Column(Text)
    post_type = Column(String, default="Interview Question")
    role_tag = Column(String, nullable=True)
    difficulty = Column(String, nullable=True)
    visibility = Column(String, default="Public")
    image_data = Column(Text, nullable=True)
    poll_options = Column(Text, nullable=True)
    hashtags = Column(Text, nullable=True)  # JSON list of hashtags
    like_count = Column(Integer, default=0)
    comment_count = Column(Integer, default=0)
    save_count = Column(Integer, default=0)
    share_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

class Comment(Base):
    __tablename__ = "comments"
    id = Column(Integer, primary_key=True)
    post_id = Column(Integer)
    user_id = Column(Integer)
    parent_id = Column(Integer, nullable=True)
    author_name = Column(String)
    content = Column(Text)
    like_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

class PostReaction(Base):
    __tablename__ = "post_reactions"
    id = Column(Integer, primary_key=True)
    post_id = Column(Integer)
    user_id = Column(Integer)
    reaction_type = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class CommentReaction(Base):
    __tablename__ = "comment_reactions"
    id = Column(Integer, primary_key=True)
    comment_id = Column(Integer)
    user_id = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)

class Follow(Base):
    __tablename__ = "follows"
    id = Column(Integer, primary_key=True)
    follower_id = Column(Integer)
    following_id = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)

class PointsHistory(Base):
    __tablename__ = "points_history"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer)
    points = Column(Integer)
    reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

# --- INSTAGRAM-STYLE FEATURES ---

class Story(Base):
    __tablename__ = "stories"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)
    content_type = Column(String, default="tip")   # 'tip' | 'qa' | 'image'
    text_content = Column(Text, nullable=True)
    image_data = Column(Text, nullable=True)
    bg_color = Column(String, default="#1E293B")
    expires_at = Column(DateTime, nullable=False)   # 24h after created_at
    views_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

class StoryView(Base):
    __tablename__ = "story_views"
    id = Column(Integer, primary_key=True)
    story_id = Column(Integer, nullable=False)
    viewer_id = Column(Integer, nullable=False)
    viewed_at = Column(DateTime, default=datetime.utcnow)

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)        # recipient
    actor_id = Column(Integer, nullable=True)        # who triggered it
    type = Column(String, nullable=False)            # like|comment|follow|share|points
    message = Column(Text, nullable=False)
    reference_id = Column(Integer, nullable=True)   # post_id / comment_id etc.
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class DirectMessage(Base):
    __tablename__ = "direct_messages"
    id = Column(Integer, primary_key=True)
    sender_id = Column(Integer, nullable=False)
    receiver_id = Column(Integer, nullable=False)
    content = Column(Text, nullable=True)
    shared_post_id = Column(Integer, nullable=True)  # post shared in DM
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class BuilderResume(Base):
    __tablename__ = "builder_resumes"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer)
    personal_info = Column(Text)
    work_experience = Column(Text)
    education = Column(Text)
    skills = Column(Text)
    projects = Column(Text)
    pdf_path = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class ResumeHistory(Base):
    __tablename__ = "resume_history"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer)
    score = Column(Integer)
    feedback_summary = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
