from fastapi import FastAPI, UploadFile, File, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import bcrypt
from pydantic import BaseModel
from parser import (
    parse_pdf,
    parse_docx,
    analyze_scanned_pdf_layout,
    analyze_image_layout,
    parse_image_with_ocr,
    parse_scanned_pdf_with_ocr,
)
from ai import analyze_resume, refine_suggestions, explain_score_shift, improve_resume_phrase, predict_ghost_text, generate_interview_questions, evaluate_mock_answer, transcribe_audio, evaluate_voice_answer, validate_resume_document, answer_site_assistant, generate_live_score_update, compare_resume_versions, benchmark_resume_against_industry, recommend_learning_resources, generate_mock_interview_mode
from parser import parse_scanned_pdf_with_ocr as ocr_pdf_pass2, parse_image_with_ocr as ocr_image_pass2
import os
from scorer import calculate_score
import logging
import json
import jwt
import base64
import re
import time
from typing import List
from datetime import datetime, timedelta
import models
from database import engine, get_db
from sqlalchemy import text
import smtplib
from email.mime.text import MIMEText
import random
from apscheduler.schedulers.background import BackgroundScheduler
import pytz
import sentry_sdk
import posthog
import boto3
from botocore.exceptions import ClientError
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException, Request, Response

try:
    from utils.email import send_login_reminder
except ImportError:
    send_login_reminder = None

models.Base.metadata.create_all(bind=engine)

def ensure_database_schema():
    """Add columns that older local SQLite databases may be missing."""
    with engine.begin() as conn:
        user_columns = {
            row[1]
            for row in conn.exec_driver_sql("PRAGMA table_info(users)").fetchall()
        }
        column_defs = {
            "username": "VARCHAR",
            "profile_photo": "TEXT",
            "college": "VARCHAR",
            "degree_field": "VARCHAR",
            "graduation_year": "VARCHAR",
            "looking_for": "VARCHAR",
            "industry": "VARCHAR",
            "open_to_opportunities": "VARCHAR",
            "interests": "TEXT",
            "other_interest": "VARCHAR",
            "bio": "VARCHAR",
            "points": "INTEGER DEFAULT 0",
            "last_login_date": "VARCHAR",
            "login_streak": "INTEGER DEFAULT 0",
            "resume_count": "INTEGER DEFAULT 0",
            "mock_count": "INTEGER DEFAULT 0",
            "followers_count": "INTEGER DEFAULT 0",
            "following_count": "INTEGER DEFAULT 0",
            "is_verified": "BOOLEAN DEFAULT 0",
            "notifications_enabled": "BOOLEAN DEFAULT 1",
            "is_private": "BOOLEAN DEFAULT 0",
            "is_active": "BOOLEAN DEFAULT 1",
        }
        for column, definition in column_defs.items():
            if column not in user_columns:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {column} {definition}"))
        post_columns = {
            row[1]
            for row in conn.exec_driver_sql("PRAGMA table_info(posts)").fetchall()
        }
        post_defs = {
            "post_type": "VARCHAR DEFAULT 'Interview Question'",
            "role_tag": "VARCHAR",
            "difficulty": "VARCHAR",
            "visibility": "VARCHAR DEFAULT 'Public'",
            "image_data": "TEXT",
            "poll_options": "TEXT",
            "hashtags": "TEXT",
            "like_count": "INTEGER DEFAULT 0",
            "comment_count": "INTEGER DEFAULT 0",
            "save_count": "INTEGER DEFAULT 0",
            "share_count": "INTEGER DEFAULT 0",
        }
        for column, definition in post_defs.items():
            if column not in post_columns:
                conn.execute(text(f"ALTER TABLE posts ADD COLUMN {column} {definition}"))

ensure_database_schema()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SECRET_KEY = "resumetric-super-secret-key"
ALGORITHM = "HS256"

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=7)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def hash_password(password: str):
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(password: str, hashed: str):
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def serialize_user(user: models.User) -> dict:
    interests = []
    if user.interests:
        try:
            interests = json.loads(user.interests)
        except Exception:
            interests = [item.strip() for item in user.interests.split(",") if item.strip()]
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "username": user.username,
        "profile_photo": user.profile_photo,
        "occupation": user.occupation,
        "college": user.college,
        "degree_field": user.degree_field,
        "graduation_year": user.graduation_year,
        "looking_for": user.looking_for,
        "company": user.company,
        "role": user.role,
        "experience": user.experience,
        "industry": user.industry,
        "open_to_opportunities": user.open_to_opportunities,
        "interests": interests,
        "other_interest": user.other_interest,
        "bio": user.bio or "",
        "points": user.points or 0,
        "reputation_level": reputation_level(user.points or 0),
        "login_streak": user.login_streak or 0,
        "resume_count": user.resume_count or 0,
        "mock_count": user.mock_count or 0,
        "followers_count": user.followers_count or 0,
        "following_count": user.following_count or 0,
        "is_verified": bool(user.is_verified) or (user.points or 0) >= 500,
    }

def reputation_level(points: int) -> str:
    if points >= 1000:
        return "Legend Trophy"
    if points >= 501:
        return "Expert Diamond"
    if points >= 201:
        return "Rising Star"
    if points >= 51:
        return "Contributor"
    return "Newcomer"

def award_points(db: Session, user_id: int, points: int, reason: str):
    if not user_id or points <= 0:
        return
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        return
    user.points = (user.points or 0) + points
    db.add(models.PointsHistory(user_id=user_id, points=points, reason=reason))
    db.commit()

def serialize_comment(comment: models.Comment) -> dict:
    return {
        "id": comment.id,
        "post_id": comment.post_id,
        "user_id": comment.user_id,
        "parent_id": comment.parent_id,
        "author_name": comment.author_name,
        "content": comment.content,
        "like_count": comment.like_count or 0,
        "created_at": comment.created_at.isoformat() if comment.created_at else "",
    }

def serialize_post(post: models.Post, db: Session, viewer_id: int = 0) -> dict:
    author = db.query(models.User).filter(models.User.id == post.user_id).first()
    comments = db.query(models.Comment).filter(models.Comment.post_id == post.id).order_by(models.Comment.created_at.asc()).all()
    liked = bool(viewer_id and db.query(models.PostReaction).filter_by(post_id=post.id, user_id=viewer_id, reaction_type="like").first())
    saved = bool(viewer_id and db.query(models.PostReaction).filter_by(post_id=post.id, user_id=viewer_id, reaction_type="save").first())
    hashtags = []
    if post.hashtags:
        try:
            hashtags = json.loads(post.hashtags)
        except Exception:
            hashtags = []
    return {
        "id": post.id,
        "user_id": post.user_id,
        "author_name": post.author_name,
        "author_username": author.username if author else None,
        "author_photo": author.profile_photo if author else None,
        "author_occupation": author.occupation if author else None,
        "author_verified": bool(author and ((author.is_verified) or (author.points or 0) >= 500)) if author else False,
        "company_name": post.company_name,
        "question": post.question,
        "post_type": post.post_type or "Interview Question",
        "role_tag": post.role_tag or "",
        "difficulty": post.difficulty or "Medium",
        "visibility": post.visibility or "Public",
        "image_data": post.image_data or "",
        "poll_options": json.loads(post.poll_options or "[]"),
        "hashtags": hashtags,
        "like_count": post.like_count or 0,
        "comment_count": post.comment_count or len(comments),
        "save_count": post.save_count or 0,
        "share_count": post.share_count or 0,
        "liked": liked,
        "saved": saved,
        "comments": [serialize_comment(comment) for comment in comments],
        "created_at": post.created_at.isoformat() if post.created_at else "",
    }

def extract_keywords(text: str) -> list:
    words = text.lower().replace(',', '').replace('.', '').split()
    return list(set(words))

def is_likely_resume(text: str) -> bool:
    normalized = text.lower()
    resume_signals = [
        "experience", "education", "skills", "projects", "certifications",
        "summary", "objective", "work history", "internship", "achievements"
    ]
    contact_signals = ["@", "linkedin", "github", "phone", "+91", "+1"]
    action_signals = [
        "developed", "built", "managed", "implemented", "designed",
        "created", "optimized", "led", "engineered", "analyzed"
    ]

    signal_count = sum(1 for signal in resume_signals if signal in normalized)
    has_contact = any(signal in normalized for signal in contact_signals)
    has_action_language = any(signal in normalized for signal in action_signals)

    return len(normalized.split()) >= 80 and signal_count >= 2 and (has_contact or has_action_language)

app = FastAPI()

# --- SENTRY SETUP ---
SENTRY_DSN = os.getenv("SENTRY_DSN", "")
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        traces_sample_rate=1.0,
        profiles_sample_rate=1.0,
    )

# --- POSTHOG SETUP ---
POSTHOG_API_KEY = os.getenv("POSTHOG_API_KEY", "")
POSTHOG_HOST = os.getenv("POSTHOG_HOST", "https://app.posthog.com")
if POSTHOG_API_KEY:
    posthog.project_api_key = POSTHOG_API_KEY
    posthog.host = POSTHOG_HOST

# --- RATE LIMITER SETUP ---
def get_user_tier(request: Request):
    # Determine limit based on token tier, fallback to 5/hour
    # Ideally parse JWT, but keeping it simple for now
    auth = request.headers.get("Authorization", "")
    if "pro" in auth.lower():
        return "50/hour"
    return "5/hour"

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- CLOUDFLARE R2 SETUP ---
s3_client = None
if os.getenv("R2_ACCESS_KEY_ID"):
    s3_client = boto3.client(
        's3',
        endpoint_url=os.getenv("R2_ENDPOINT_URL"),
        aws_access_key_id=os.getenv("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("R2_SECRET_ACCESS_KEY"),
        region_name="auto"
    )

# --- SCHEDULER SETUP ---
scheduler = BackgroundScheduler(timezone=pytz.UTC)

def daily_login_check():
    # Send at 8 AM local time (Assuming UTC for simplicity, or localized if pytz configured)
    db = SessionLocal()
    today = datetime.utcnow().date().isoformat()
    # Find active users with notifications enabled who haven't logged in today
    users = db.query(models.User).filter(
        models.User.is_active == True,
        models.User.notifications_enabled == True,
        (models.User.last_login_date != today) | (models.User.last_login_date == None)
    ).all()
    
    for u in users:
        if send_login_reminder and u.email:
            send_login_reminder(u.email, u.name or u.username or "User")
            
    db.close()

# Run at 8:00 AM UTC every day
scheduler.add_job(daily_login_check, 'cron', hour=8, minute=0)
scheduler.start()

@app.on_event("shutdown")
def shutdown_event():
    scheduler.shutdown()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- GLOBAL DATA MODELS (PYDANTIC) ---
class PostCreate(BaseModel):
    user_id: int
    company_name: str
    question: str
    post_type: str = "Interview Question"
    role_tag: str = ""
    difficulty: str = "Medium"
    visibility: str = "Public"
    image_data: str = ""
    poll_options: List[str] = []
    hashtags: List[str] = []

class PostResponse(BaseModel):
    id: int
    author_name: str
    company_name: str
    question: str
    created_at: datetime

class CommentCreate(BaseModel):
    user_id: int
    content: str
    parent_id: int | None = None

class ProfileUpdate(BaseModel):
    name: str | None = None
    bio: str | None = None
    profile_photo: str | None = None
    company: str | None = None
    college: str | None = None
    role: str | None = None

class EditorInput(BaseModel):
    full_text: str
    section_text: str
    cursor_position: int
    role: str = "Software Engineering"
    tone: str = "strong"

class GhostInput(BaseModel):
    full_text: str
    current_line: str
    cursor_context: str
    role: str = "Software Engineer"
    tone: str = "strong"

class InterviewPrepInput(BaseModel):
    resume_text: str
    job_description: str
    weaknesses: List[str] = []
    role: str = "Software Engineer"

class LiveScoreInput(BaseModel):
    updated_resume_text: str
    previous_resume_text: str = ""
    job_role: str = ""

class ResumeComparisonInput(BaseModel):
    old_resume: str
    new_resume: str

class IndustryBenchmarkInput(BaseModel):
    job_role: str
    resume_text: str

class LearningResourcesInput(BaseModel):
    job_role: str
    resume_text: str

class MockInterviewModeInput(BaseModel):
    resume_text: str

class MockAnswerInput(BaseModel):
    resume_text: str
    job_description: str
    role: str = "Software Engineer"
    question: str
    answer: str

class VoiceAnswerInput(BaseModel):
    question: str
    transcript: str
    audio_base64: str = ""
    role: str = "Software Engineer"

class SiteAssistantInput(BaseModel):
    question: str
    page: str = "Unknown"
    resume_context: str = ""
    job_description: str = ""
    analysis_summary: str = ""

# --- API ENDPOINTS ---
@app.get("/")
def read_root():
    return {"status": "Resumetric Backend Engine: Active"}

MAX_FILE_SIZE = 5 * 1024 * 1024 # 5 MB Strict upload limit
MAX_VALIDATION_SECONDS = 10.0
MIN_ANALYZABLE_TEXT_LENGTH = 100
PDF_TEXT_EXTRACTION_ERROR = "Could not read this PDF. Please ensure it's a text-based PDF (not a scanned image) and try again."
SUPPORTED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}


def is_pdf_file(filename: str, file_bytes: bytes) -> bool:
    return filename.endswith(".pdf") and file_bytes.startswith(b"%PDF")


def is_supported_image(filename: str) -> bool:
    return any(filename.endswith(ext) for ext in SUPPORTED_IMAGE_EXTENSIONS)


def usable_text_length(text: str) -> int:
    return len(re.sub(r"\s+", "", text or ""))


def estimate_analysis_confidence(text: str) -> int:
    length = usable_text_length(text)
    if length < MIN_ANALYZABLE_TEXT_LENGTH:
        return 0
    if length >= 2500:
        return 100
    return max(25, min(99, round(25 + ((length - MIN_ANALYZABLE_TEXT_LENGTH) / 2400) * 75)))


def log_resume_text_before_ai(resume_text: str) -> None:
    print("\n[PDF DEBUG] RAW RESUME TEXT BEFORE AI START")
    print(resume_text[:4000] if resume_text else "<EMPTY>")
    print("[PDF DEBUG] RAW RESUME TEXT BEFORE AI END\n")


def log_upload_file_received(endpoint: str, file: UploadFile, file_bytes: bytes) -> None:
    print(
        "File received:",
        {
            "endpoint": endpoint,
            "filename": file.filename,
            "content_type": file.content_type,
            "bytes": len(file_bytes),
        },
    )


def weighted_resume_validation(text: str) -> dict:
    normalized = re.sub(r"\s+", " ", text).strip()
    lowered = normalized.lower()
    words = normalized.split()

    section_patterns = [
        r"\bexperience\b", r"\beducation\b", r"\bskills\b", r"\bprojects\b", r"\bsummary\b",
        r"\bobjective\b", r"\bcertifications?\b", r"\btechnical skills\b", r"\bwork history\b",
    ]
    bullet_lines = sum(1 for line in text.splitlines() if line.strip().startswith(("-", "*", "•")))
    date_hits = re.findall(r"\b(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+)?(?:19|20)\d{2}(?:\s*[-/]\s*(?:present|current|(?:19|20)\d{2}))?\b", lowered)
    section_hits = sum(1 for pattern in section_patterns if re.search(pattern, lowered))
    structural_score = min(1.0, ((section_hits / 4) * 0.6) + (min(bullet_lines, 8) / 8) * 0.2 + (min(len(date_hits), 4) / 4) * 0.2)

    email_hit = bool(re.search(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", normalized, re.IGNORECASE))
    phone_hit = bool(re.search(r"(?:\+\d{1,3}[\s-]?)?(?:\(?\d{3}\)?[\s-]?)?\d{3}[\s-]?\d{4}", normalized))
    profile_hit = bool(re.search(r"\b(?:linkedin|github)\b", lowered))
    contact_score = (email_hit + phone_hit + profile_hit) / 3

    action_hits = len(re.findall(r"\b(developed|managed|led|implemented|designed|created|optimized|engineered|analyzed|delivered|improved)\b", lowered))
    technical_hits = len(re.findall(r"\b(python|java|javascript|react|sql|aws|docker|node|html|css|excel|tableau|tensorflow|c\+\+|c#)\b", lowered))
    education_hits = len(re.findall(r"\b(bachelor|master|b\.tech|m\.tech|university|college|gpa|degree)\b", lowered))
    keyword_score = min(1.0, (min(action_hits, 6) / 6) * 0.4 + (min(technical_hits, 6) / 6) * 0.4 + (min(education_hits, 4) / 4) * 0.2)

    length_score = 1.0 if 80 <= len(words) <= 1800 else 0.45 if 40 <= len(words) <= 2500 else 0.0
    coherence_bonus = 1.0 if section_hits >= 2 and (bullet_lines >= 2 or len(date_hits) >= 2) else 0.4 if section_hits >= 1 else 0.0
    format_score = min(1.0, (length_score * 0.6) + (coherence_bonus * 0.4))

    resume_score = round(
        (structural_score * 0.5) +
        (contact_score * 0.2) +
        (keyword_score * 0.2) +
        (format_score * 0.1),
        3,
    )

    detected_sections = []
    for section in ["summary", "experience", "education", "skills", "projects", "certifications"]:
        if re.search(rf"\b{section}\b", lowered):
            detected_sections.append(section)

    is_resume = resume_score >= 0.6
    reason = (
        "Resume structure and professional signals were detected."
        if is_resume
        else "This file does not contain enough resume structure, contact details, and professional content."
    )

    return {
        "is_resume": is_resume,
        "confidence": int(round(resume_score * 100)),
        "resume_score": resume_score,
        "reason": reason,
        "detected_sections": detected_sections,
        "scores": {
            "structural": round(structural_score, 3),
            "contact": round(contact_score, 3),
            "keywords": round(keyword_score, 3),
            "format": round(format_score, 3),
        },
    }


def classify_resume_text(text: str) -> dict:
    validation = weighted_resume_validation(text)
    lowered = text.lower()
    penalty_terms = [
        "lecture", "syllabus", "chapter", "assignment", "question bank",
        "table of contents", "contents", "abstract", "references", "appendix",
        "invoice", "receipt", "journal", "copyright", "lesson", "unit-1",
    ]
    matched_penalties = [term for term in penalty_terms if term in lowered]
    if matched_penalties and validation["resume_score"] < 0.8:
        validation["is_resume"] = False
        validation["reason"] = f"This file looks like non-resume content because it contains terms such as {', '.join(matched_penalties[:3])}."
        validation["confidence"] = min(validation["confidence"], 45)
        return validation

    has_resume_sections = len(validation.get("detected_sections", [])) >= 2
    has_contact_or_profile = any(signal in lowered for signal in ["@", "linkedin", "github", "phone", "+91", "+1"])
    has_professional_actions = any(
        signal in lowered
        for signal in [
            "developed", "built", "managed", "implemented", "designed",
            "created", "optimized", "led", "engineered", "analyzed", "delivered",
        ]
    )

    if not validation["is_resume"] and (has_resume_sections or (has_contact_or_profile and has_professional_actions)):
        validation["is_resume"] = True
        validation["confidence"] = max(validation["confidence"], 60)
        validation["reason"] = "Resume-like sections and professional signals were detected."

    return validation


def finalize_validation_result(resume_text: str, base_validation: dict, processing_seconds: float, extraction_method: str) -> tuple[str, dict]:
    validation = {
        **base_validation,
        "processing_seconds": round(processing_seconds, 2),
        "word_count": len(resume_text.split()),
        "character_count": len(resume_text),
        "requires_text_pdf": usable_text_length(resume_text) < MIN_ANALYZABLE_TEXT_LENGTH,
        "can_analyze": usable_text_length(resume_text) >= MIN_ANALYZABLE_TEXT_LENGTH,
        "analysis_confidence": estimate_analysis_confidence(resume_text),
        "extraction_method": extraction_method,
    }
    return resume_text, validation


def validate_uploaded_resume(filename: str, file_bytes: bytes) -> tuple[str, dict]:
    started_at = time.perf_counter()

    if len(file_bytes) > MAX_FILE_SIZE:
        return "", {
            "is_resume": False,
            "confidence": 100,
            "reason": "File size exceeds 5MB limit. Please upload a smaller resume file.",
            "detected_sections": [],
            "processing_seconds": round(time.perf_counter() - started_at, 2),
            "character_count": 0,
            "can_analyze": False,
            "requires_text_pdf": True,
            "extraction_method": "file-too-large",
        }

    if not (is_pdf_file(filename, file_bytes) or is_supported_image(filename)):
        return "", {
            "is_resume": False,
            "confidence": 100,
            "reason": "Please upload a resume in PDF, JPG, JPEG, or PNG format.",
            "detected_sections": [],
            "processing_seconds": round(time.perf_counter() - started_at, 2),
            "character_count": 0,
            "can_analyze": False,
            "requires_text_pdf": True,
            "extraction_method": "unsupported-file",
        }

    resume_text = ""
    extraction_method = ""

    if is_pdf_file(filename, file_bytes):
        resume_text = parse_pdf(file_bytes)
        extraction_method = "direct-pdf-text"
        if usable_text_length(resume_text) < MIN_ANALYZABLE_TEXT_LENGTH:
            ocr_result = parse_scanned_pdf_with_ocr(file_bytes)
            if usable_text_length(ocr_result.get("text", "")) >= MIN_ANALYZABLE_TEXT_LENGTH:
                resume_text = ocr_result["text"]
                extraction_method = "pdf-ocr"
    else:
        ocr_result = parse_image_with_ocr(file_bytes)
        if ocr_result["text"].strip():
            resume_text = ocr_result["text"]
            extraction_method = "image-ocr"

    processing_seconds = time.perf_counter() - started_at

    if processing_seconds > MAX_VALIDATION_SECONDS:
        return "", {
            "is_resume": False,
            "confidence": 100,
            "reason": "Resume reading took too long. Please upload a cleaner file that can be processed within 10 seconds.",
            "detected_sections": [],
            "processing_seconds": round(processing_seconds, 2),
            "character_count": len(resume_text),
            "can_analyze": False,
            "requires_text_pdf": True,
            "extraction_method": extraction_method or "timeout",
        }

    if usable_text_length(resume_text) < MIN_ANALYZABLE_TEXT_LENGTH:
        layout = analyze_scanned_pdf_layout(file_bytes) if is_pdf_file(filename, file_bytes) else analyze_image_layout(file_bytes)
        return resume_text, {
            "is_resume": False,
            "confidence": 25,
            "resume_score": 0.25,
            "reason": PDF_TEXT_EXTRACTION_ERROR,
            "detected_sections": [],
            "processing_seconds": round(processing_seconds, 2),
            "can_analyze": False,
            "requires_text_pdf": True,
            "character_count": len(resume_text),
            "analysis_confidence": 0,
            "layout_analysis": layout,
            "extraction_method": extraction_method or "no-text",
        }

    validation = classify_resume_text(resume_text)
    return finalize_validation_result(resume_text, validation, processing_seconds, extraction_method)


@app.post("/register")
def register(
    email: str = Form(...), 
    password: str = Form(...),
    name: str = Form(...),
    phone: str = Form(...),
    occupation: str = Form(...),
    semester: str = Form(None),
    company: str = Form(None),
    role: str = Form(None),
    experience: str = Form(None),
    db: Session = Depends(get_db)
):
    if db.query(models.User).filter(models.User.email == email).first():
        return {"error": "Email already registered"}
    hashed = hash_password(password)
    user = models.User(
        email=email, password=hashed, name=name, phone=phone,
        occupation=occupation, semester=semester, company=company,
        role=role, experience=experience,
        resume_count=0, mock_count=0
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    if POSTHOG_API_KEY:
        posthog.capture(str(user.id), "signup", {"email": email})
        
    return {"message": "Account created successfully"}

@app.get("/username-available")
def username_available(username: str, db: Session = Depends(get_db)):
    normalized = username.strip().lower().lstrip("@")
    if not re.match(r"^[a-z0-9_]{3,24}$", normalized):
        return {"available": False, "message": "Use 3-24 letters, numbers, or underscores."}
    exists = db.query(models.User).filter(models.User.username == normalized).first()
    return {"available": exists is None}

@app.post("/community-register")
def community_register(
    email: str = Form(...),
    password: str = Form(...),
    name: str = Form(...),
    username: str = Form(...),
    profile_photo: str = Form(None),
    occupation: str = Form(...),
    college: str = Form(None),
    degree_field: str = Form(None),
    graduation_year: str = Form(None),
    looking_for: str = Form(None),
    company: str = Form(None),
    role: str = Form(None),
    experience: str = Form(None),
    industry: str = Form(None),
    open_to_opportunities: str = Form(None),
    interests: str = Form("[]"),
    other_interest: str = Form(None),
    db: Session = Depends(get_db),
):
    normalized_username = username.strip().lower().lstrip("@")
    normalized_email = email.strip().lower()
    if not re.match(r"^[a-z0-9_]{3,24}$", normalized_username):
        return {"error": "Username must be 3-24 characters using letters, numbers, or underscores."}
    if db.query(models.User).filter(models.User.email == normalized_email).first():
        return {"error": "Email already registered"}
    if db.query(models.User).filter(models.User.username == normalized_username).first():
        return {"error": "Username already taken"}

    user = models.User(
        email=normalized_email,
        password=hash_password(password),
        name=name.strip(),
        username=normalized_username,
        profile_photo=profile_photo,
        phone="",
        occupation=occupation,
        college=college,
        degree_field=degree_field,
        graduation_year=graduation_year,
        looking_for=looking_for,
        company=company,
        role=role,
        experience=experience,
        industry=industry,
        open_to_opportunities=open_to_opportunities,
        interests=interests,
        other_interest=other_interest,
        resume_count=0,
        mock_count=0,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": str(user.id)})
    return {"message": "Account created successfully", "token": token, "user": serialize_user(user)}

@app.post("/login-check")
def login_check(email: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    """Validate Email and Password and login."""
    user = db.query(models.User).filter(models.User.email == email.strip().lower()).first()
    if not user or not verify_password(password, user.password):
        return {"error": "Invalid credentials"}
    today = datetime.utcnow().date().isoformat()
    if user.last_login_date != today:
        user.login_streak = (user.login_streak or 0) + 1
        user.last_login_date = today
        db.commit()
        award_points(db, user.id, 1, "Daily login streak")
        
    token = create_access_token({"sub": str(user.id)})
    
    if POSTHOG_API_KEY:
        posthog.capture(str(user.id), "login", {"email": email})
        
    return {"token": token, "user_id": user.id, "user": serialize_user(user)}

@app.get("/history")
def get_history(user_id: int, db: Session = Depends(get_db)):
    analyses = db.query(models.ResumeAnalysis).filter(models.ResumeAnalysis.user_id == user_id).order_by(models.ResumeAnalysis.created_at.asc()).all()
    history = []
    prev_score = None
    for a in analyses:
        diff = a.score - prev_score if prev_score is not None else 0
        history.append({
            "id": a.id,
            "score": a.score,
            "diff": diff,
            "date": a.created_at.strftime("%b %d, %Y - %H:%M"),
            "data": json.loads(a.data)
        })
        prev_score = a.score
    history.reverse() # Newest first
    return history

@app.get("/profile/{user_id}")
def get_profile(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        return {"error": "User not found"}
    profile = serialize_user(user)
    posts_count = db.query(models.Post).filter(models.Post.user_id == user_id).count()
    followers_count = db.query(models.Follow).filter(models.Follow.following_id == user_id).count()
    following_count = db.query(models.Follow).filter(models.Follow.follower_id == user_id).count()
    return {
        "name": user.name,
        "email": user.email,
        "username": user.username,
        "profile_photo": user.profile_photo,
        "occupation": user.occupation,
        "college_sem": user.semester if user.occupation == "Student" else None,
        "college": user.college,
        "degree_field": user.degree_field,
        "graduation_year": user.graduation_year,
        "looking_for": user.looking_for,
        "company": user.company if user.occupation == "Working" else None,
        "branch": user.role, # Mapping branch to role for simplicity
        "role": user.role,
        "experience": user.experience,
        "industry": user.industry,
        "open_to_opportunities": user.open_to_opportunities,
        "interests": profile["interests"],
        "other_interest": user.other_interest,
        "bio": user.bio or "",
        "points": user.points or 0,
        "reputation_level": reputation_level(user.points or 0),
        "posts_count": posts_count,
        "followers_count": followers_count,
        "following_count": following_count,
        "resume_count": user.resume_count,
        "mock_count": user.mock_count
    }

@app.patch("/profile/{user_id}")
def update_profile(user_id: int, payload: ProfileUpdate, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        return {"error": "User not found"}
    if payload.name is not None:
        user.name = payload.name[:80]
    if payload.bio is not None:
        user.bio = payload.bio[:150]
    if payload.profile_photo is not None:
        user.profile_photo = payload.profile_photo
    if payload.company is not None:
        user.company = payload.company
    if payload.college is not None:
        user.college = payload.college
    if payload.role is not None:
        user.role = payload.role
    db.commit()
    db.refresh(user)
    return {"message": "Profile updated", "user": serialize_user(user)}

@app.get("/posts")
def get_posts(user_id: int = 0, db: Session = Depends(get_db)):
    posts = db.query(models.Post).order_by(models.Post.created_at.desc()).all()
    return [serialize_post(post, db, user_id) for post in posts]

@app.post("/posts")
def create_post(payload: PostCreate, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == payload.user_id).first()
    if not user:
        return {"error": "User not found"}
    
    # Extract hashtags from content + explicit list
    content_tags = re.findall(r'#(\w+)', payload.question)
    all_tags = list(set([t.lower() for t in (payload.hashtags + content_tags)] ))

    new_post = models.Post(
        user_id=payload.user_id,
        author_name=user.name,
        company_name=payload.company_name,
        question=payload.question,
        post_type=payload.post_type,
        role_tag=payload.role_tag,
        difficulty=payload.difficulty,
        visibility=payload.visibility,
        image_data=payload.image_data,
        poll_options=json.dumps(payload.poll_options or []),
        hashtags=json.dumps(all_tags),
        like_count=0,
        comment_count=0,
        save_count=0,
        share_count=0,
    )
    db.add(new_post)
    db.commit()
    db.refresh(new_post)
    award_points(db, payload.user_id, 5, f"You earned +5 pts for your post on {payload.company_name} {payload.role_tag or 'community'}")
    return {"message": "Post created", "post": serialize_post(new_post, db, payload.user_id)}

@app.post("/posts/{post_id}/comments")
def create_comment(post_id: int, payload: CommentCreate, db: Session = Depends(get_db)):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    user = db.query(models.User).filter(models.User.id == payload.user_id).first()
    if not post or not user:
        return {"error": "Post or user not found"}
    comment = models.Comment(
        post_id=post_id,
        user_id=payload.user_id,
        parent_id=payload.parent_id,
        author_name=user.name,
        content=payload.content,
        like_count=0,
    )
    post.comment_count = (post.comment_count or 0) + 1
    db.add(comment)
    db.commit()
    db.refresh(comment)
    award_points(db, payload.user_id, 5, f"You earned +5 pts for commenting on {post.company_name or 'a community post'}")
    return {"message": "Comment added", "comment": serialize_comment(comment)}

@app.post("/posts/{post_id}/react")
def react_to_post(post_id: int, user_id: int = Form(...), reaction_type: str = Form(...), db: Session = Depends(get_db)):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        return {"error": "Post not found"}
    existing = db.query(models.PostReaction).filter_by(post_id=post_id, user_id=user_id, reaction_type=reaction_type).first()
    if existing:
        db.delete(existing)
        if reaction_type == "like":
            post.like_count = max((post.like_count or 0) - 1, 0)
        if reaction_type == "save":
            post.save_count = max((post.save_count or 0) - 1, 0)
        db.commit()
        return {"active": False, "post": serialize_post(post, db, user_id)}
    db.add(models.PostReaction(post_id=post_id, user_id=user_id, reaction_type=reaction_type))
    if reaction_type == "like":
        post.like_count = (post.like_count or 0) + 1
        if user_id != post.user_id:
            award_points(db, post.user_id, 5, f"You earned +5 pts because your post on {post.company_name or 'community'} got a like")
    elif reaction_type == "save":
        post.save_count = (post.save_count or 0) + 1
        if user_id != post.user_id:
            award_points(db, post.user_id, 3, f"You earned +3 pts because your post on {post.company_name or 'community'} was saved")
    elif reaction_type == "share":
        post.share_count = (post.share_count or 0) + 1
        if user_id != post.user_id:
            award_points(db, post.user_id, 3, f"You earned +3 pts because your post on {post.company_name or 'community'} was shared")
    db.commit()
    return {"active": True, "post": serialize_post(post, db, user_id)}

@app.post("/comments/{comment_id}/like")
def like_comment(comment_id: int, user_id: int = Form(...), db: Session = Depends(get_db)):
    comment = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if not comment:
        return {"error": "Comment not found"}
    existing = db.query(models.CommentReaction).filter_by(comment_id=comment_id, user_id=user_id).first()
    if existing:
        db.delete(existing)
        comment.like_count = max((comment.like_count or 0) - 1, 0)
        db.commit()
        return {"active": False, "comment": serialize_comment(comment)}
    db.add(models.CommentReaction(comment_id=comment_id, user_id=user_id))
    comment.like_count = (comment.like_count or 0) + 1
    if user_id != comment.user_id:
        award_points(db, comment.user_id, 5, "You earned +5 pts because your comment got a like")
    db.commit()
    return {"active": True, "comment": serialize_comment(comment)}

@app.post("/follow/{following_id}")
def follow_user(following_id: int, follower_id: int = Form(...), db: Session = Depends(get_db)):
    if follower_id == following_id:
        return {"error": "You cannot follow yourself"}
    follower = db.query(models.User).filter(models.User.id == follower_id).first()
    target = db.query(models.User).filter(models.User.id == following_id).first()
    if not follower or not target:
        return {"error": "User not found"}
    existing = db.query(models.Follow).filter_by(follower_id=follower_id, following_id=following_id).first()
    if existing:
        db.delete(existing)
        target.followers_count = max((target.followers_count or 0) - 1, 0)
        follower.following_count = max((follower.following_count or 0) - 1, 0)
        db.commit()
        return {"following": False, "followers_count": target.followers_count, "following_count": follower.following_count}
    db.add(models.Follow(follower_id=follower_id, following_id=following_id))
    target.followers_count = (target.followers_count or 0) + 1
    follower.following_count = (follower.following_count or 0) + 1
    db.commit()
    award_points(db, following_id, 2, "You earned +2 pts because someone followed you")
    # Create notification
    db.add(models.Notification(
        user_id=following_id,
        actor_id=follower_id,
        type="follow",
        message=f"{follower.name} started following you",
        reference_id=follower_id,
    ))
    db.commit()
    return {"following": True, "followers_count": target.followers_count, "following_count": follower.following_count}

@app.get("/leaderboard")
def leaderboard(filter: str = "All Time", db: Session = Depends(get_db)):
    users = db.query(models.User).order_by(models.User.points.desc()).limit(10).all()
    return [serialize_user(user) for user in users]

@app.get("/profile/{user_id}/activity")
def profile_activity(user_id: int, db: Session = Depends(get_db)):
    posts = db.query(models.Post).filter(models.Post.user_id == user_id).order_by(models.Post.created_at.desc()).all()
    saved_ids = [reaction.post_id for reaction in db.query(models.PostReaction).filter_by(user_id=user_id, reaction_type="save").all()]
    liked_ids = [reaction.post_id for reaction in db.query(models.PostReaction).filter_by(user_id=user_id, reaction_type="like").all()]
    comments = db.query(models.Comment).filter(models.Comment.user_id == user_id).order_by(models.Comment.created_at.desc()).all()
    saved = db.query(models.Post).filter(models.Post.id.in_(saved_ids)).all() if saved_ids else []
    liked = db.query(models.Post).filter(models.Post.id.in_(liked_ids)).all() if liked_ids else []
    history = db.query(models.PointsHistory).filter(models.PointsHistory.user_id == user_id).order_by(models.PointsHistory.created_at.desc()).limit(20).all()
    return {
        "posts": [serialize_post(post, db, user_id) for post in posts],
        "saved": [serialize_post(post, db, user_id) for post in saved],
        "liked": [serialize_post(post, db, user_id) for post in liked],
        "comments": [serialize_comment(comment) for comment in comments],
        "points_history": [{"id": item.id, "points": item.points, "reason": item.reason, "created_at": item.created_at.isoformat()} for item in history],
    }

@app.post("/mock-interview")
async def mock_interview(payload: MockAnswerInput, db: Session = Depends(get_db)):
    # --- LIMIT CHECK ---
    user_id = 0 # In a real app, extract from JWT. For now, we'll assume it's passed or mock it.
    # We'll use a hack to get user_id from context if available, otherwise skip limit for guest
    user = db.query(models.User).filter(models.User.email == payload.resume_text[:20]).first() # Placeholder logic
    
    if user:
        if user.mock_count >= 2:
            return {"error": "LIMIT_REACHED", "details": "You have used your 2 free mock interviews. Please upgrade to continue."}
        user.mock_count += 1
        db.commit()

    try:
        return evaluate_mock_answer(
            payload.resume_text, payload.job_description,
            payload.role, payload.question, payload.answer
        )
    except Exception as e:
        logger.error(f"Mock Interview Engine Failed: {e}")
        return {"error": str(e)}



@app.post("/live-edit")
async def live_edit(payload: EditorInput):
    """Real-time AI Assistant endpoint triggering sub-second analysis streams."""
    try:
        data = improve_resume_phrase(payload.full_text, payload.section_text, payload.cursor_position, payload.role, payload.tone)
        return data
    except Exception as e:
        logger.error(f"Editor Engine Failed: {e}")
        return {"error": str(e)}


@app.post("/ghost-text")
async def ghost_text(payload: GhostInput):
    """Ultra-fast ghost text autocomplete — 700ms debounce on frontend."""
    try:
        return predict_ghost_text(
            payload.full_text, payload.current_line,
            payload.cursor_context, payload.role, payload.tone
        )
    except Exception as e:
        logger.error(f"Ghost Text Engine Failed: {e}")
        return {"ghost_text": "", "improved_line": "", "confidence": "low", "type": "completion"}

# Canonical endpoint (matches frontend spec)
@app.post("/inline-suggest")
async def inline_suggest(payload: GhostInput):
    """Alias of /ghost-text — cursor-aware inline suggestion."""
    return await ghost_text(payload)



@app.post("/resume-score-live")
async def resume_score_live(payload: LiveScoreInput):
    """Real-time resume score updates for editor and comparison flows."""
    try:
        return generate_live_score_update(
            payload.updated_resume_text,
            payload.previous_resume_text,
            payload.job_role,
        )
    except Exception as e:
        logger.error(f"Live Score Update Failed: {e}")
        return {"error": str(e)}


@app.post("/resume-compare")
async def resume_compare(payload: ResumeComparisonInput):
    """Compare before/after resume revisions."""
    try:
        return compare_resume_versions(payload.old_resume, payload.new_resume)
    except Exception as e:
        logger.error(f"Resume Comparison Failed: {e}")
        return {"error": str(e)}


@app.post("/industry-benchmark")
async def industry_benchmark(payload: IndustryBenchmarkInput):
    """Benchmark resume against role-based industry expectations."""
    try:
        return benchmark_resume_against_industry(payload.job_role, payload.resume_text)
    except Exception as e:
        logger.error(f"Industry Benchmark Failed: {e}")
        return {"error": str(e)}


@app.post("/learning-resources")
async def learning_resources(payload: LearningResourcesInput):
    """Recommend skill-gap learning resources for the target role."""
    try:
        return recommend_learning_resources(payload.job_role, payload.resume_text)
    except Exception as e:
        logger.error(f"Learning Resources Failed: {e}")
        return {"error": str(e)}


@app.post("/mock-interview-mode")
async def mock_interview_mode(payload: MockInterviewModeInput):
    """Create a structured mock interview session blueprint from a resume."""
    try:
        return generate_mock_interview_mode(payload.resume_text)
    except Exception as e:
        logger.error(f"Mock Interview Mode Failed: {e}")
        return {"error": str(e)}

@app.post("/interview-prep")
async def interview_prep(payload: InterviewPrepInput):
    """Generate personalized interview questions from resume + JD."""
    try:
        return generate_interview_questions(
            payload.resume_text, payload.job_description,
            payload.weaknesses, payload.role
        )
    except Exception as e:
        logger.error(f"Interview Prep Failed: {e}")
        return {"error": str(e)}


@app.post("/mock-interview")
async def mock_interview(payload: MockAnswerInput):
    """Evaluate a candidate's answer to an interview question."""
    try:
        return evaluate_mock_answer(
            payload.resume_text, payload.job_description,
            payload.role, payload.question, payload.answer
        )
    except Exception as e:
        logger.error(f"Mock Interview Engine Failed: {e}")
        return {"error": str(e)}


@app.post("/voice-interview")
async def voice_interview(payload: VoiceAnswerInput):
    """Transcribe (if audio provided) then evaluate spoken answer."""
    try:
        transcript = payload.transcript
        # Server-side Whisper transcription when raw audio is supplied
        if not transcript and payload.audio_base64:
            audio_bytes = base64.b64decode(payload.audio_base64)
            transcript = transcribe_audio(audio_bytes)
        return evaluate_voice_answer(payload.question, transcript, payload.role)
    except Exception as e:
        logger.error(f"Voice Interview Engine Failed: {e}")
        return {"error": str(e)}


@app.post("/site-assistant")
async def site_assistant(payload: SiteAssistantInput):
    """In-app assistant for resume, ATS, keyword, and interview doubts."""
    try:
        return answer_site_assistant(
            payload.question,
            payload.page,
            payload.resume_context,
            payload.job_description,
            payload.analysis_summary,
        )
    except Exception as e:
        logger.error(f"Site Assistant Failed: {e}")
        return {"error": str(e)}

@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    job_description: str = Form(""),
    user_id: int = Form(0),
    db: Session = Depends(get_db),
):
    """
    4-Step PDF Validation Pipeline:
      STEP 1 — Extract text (gate on 0 chars)
      STEP 2 — AI resume classifier with exact prompt
      STEP 3 — Gate: isResume + confidence thresholds
      STEP 4 — Full resume scoring analysis
    """

    # 0. API key guard
    if not os.environ.get("GROQ_API_KEY") and not os.environ.get("GEMINI_API_KEY") and not os.environ.get("OPENAI_API_KEY"):
        return {
            "error": "API key not configured",
            "details": "The API key is not set. Please set it before running the server.",
        }

    # --- LIMIT CHECK ---
    if user_id > 0:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if user:
            if user.resume_count >= 5:
                return {"error": "LIMIT_REACHED", "details": "You have used your 5 free resume analyses. Please upgrade to continue."}
            user.resume_count += 1
            db.commit()

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 1 — EXTRACT TEXT
    # ─────────────────────────────────────────────────────────────────────────
    file_bytes = await file.read()
    log_upload_file_received("/analyze", file, file_bytes)
    filename = file.filename.lower() if file.filename else ""

    if len(file_bytes) > MAX_FILE_SIZE:
        return {
            "error": "File too large",
            "details": "File size exceeds 5MB limit. Please upload a smaller resume file.",
        }

    if not (is_pdf_file(filename, file_bytes) or is_supported_image(filename)):
        return {
            "error": "Unsupported format",
            "details": "Please upload a resume in PDF, JPG, JPEG, or PNG format.",
        }

    started_at = time.perf_counter()
    resume_text = ""
    extraction_method = ""

    if is_pdf_file(filename, file_bytes):
        resume_text = parse_pdf(file_bytes)
        extraction_method = "direct-pdf-text"
        # Fallback: OCR for scanned PDFs
        if usable_text_length(resume_text) < MIN_ANALYZABLE_TEXT_LENGTH:
            ocr_result = parse_scanned_pdf_with_ocr(file_bytes)
            if usable_text_length(ocr_result.get("text", "")) >= MIN_ANALYZABLE_TEXT_LENGTH:
                resume_text = ocr_result["text"]
                extraction_method = "pdf-ocr"
    else:
        ocr_result = parse_image_with_ocr(file_bytes)
        if ocr_result["text"].strip():
            resume_text = ocr_result["text"]
            extraction_method = "image-ocr"

    # Gate: 0-character extraction → stop immediately
    if usable_text_length(resume_text) < MIN_ANALYZABLE_TEXT_LENGTH:
        layout_hint = (
            analyze_scanned_pdf_layout(file_bytes)
            if is_pdf_file(filename, file_bytes)
            else analyze_image_layout(file_bytes)
        )
        return {
            "error": "Could not read this PDF. Please upload a text-based PDF.",
            "details": "The PDF appears to be a scanned image or contains no extractable text.",
            "resume_validation": {
                "is_resume": False,
                "isResume": False,
                "confidence": 0,
                "reason": "Could not read this PDF. Please upload a text-based PDF.",
                "extraction_method": extraction_method or "no-text",
                "layout_analysis": layout_hint,
                "character_count": len(resume_text),
                "can_analyze": False,
            },
        }

    log_resume_text_before_ai(resume_text)
    processing_seconds = round(time.perf_counter() - started_at, 2)

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 2 — VALIDATE IF IT IS A RESUME (AI classifier)
    # ─────────────────────────────────────────────────────────────────────────
    ai_check = {"isResume": True, "confidence": 75, "reason": "AI validation skipped due to error."}  # safe default
    try:
        ai_check = validate_resume_document(resume_text)
    except Exception as ai_err:
        logger.warning(f"AI resume validation error (using heuristic fallback): {ai_err}")
        # Heuristic fallback when AI is unavailable
        heuristic = classify_resume_text(resume_text)
        ai_check = {
            "isResume": heuristic.get("is_resume", True),
            "confidence": heuristic.get("confidence", 70),
            "reason": heuristic.get("reason", "Heuristic classification used."),
        }

    is_resume_flag = ai_check.get("isResume", True)
    confidence_val = ai_check.get("confidence", 75)
    ai_reason = ai_check.get("reason", "")

    # Build a unified validation dict for the response
    resume_validation_meta = {
        **ai_check,
        # Keep snake_case alias for compatibility with frontend
        "is_resume": is_resume_flag,
        "extraction_method": extraction_method,
        "processing_seconds": processing_seconds,
        "character_count": len(resume_text),
        "word_count": len(resume_text.split()),
        "can_analyze": True,
        "analysis_confidence": estimate_analysis_confidence(resume_text),
    }

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 3 — GATE THE RESULT
    # ─────────────────────────────────────────────────────────────────────────
    if not is_resume_flag:
        return {
            "error": "This doesn't look like a resume. Please upload your resume PDF.",
            "details": ai_reason,
            "resume_validation": {**resume_validation_meta, "can_analyze": False},
        }

    if confidence_val < 40:
        return {
            "error": "This doesn't look like a resume. Please upload your resume PDF.",
            "details": ai_reason,
            "resume_validation": {**resume_validation_meta, "can_analyze": False},
        }

    if 40 <= confidence_val <= 70:
        # Low-confidence warning — frontend should prompt the user to confirm
        return {
            "warning": "We're not sure this is a resume. Continue anyway?",
            "details": ai_reason,
            "confidence": confidence_val,
            "resume_validation": resume_validation_meta,
            "extracted_preview": resume_text[:500],
            "resume_text": resume_text,
        }

    # confidence > 70 AND isResume: true → ACCEPTED
    logger.info(f"Resume accepted — AI confidence {confidence_val}%, {len(resume_text)} chars, method: {extraction_method}")

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 4 — FULL RESUME SCORING ANALYSIS
    # ─────────────────────────────────────────────────────────────────────────
    jd_keywords = extract_keywords(job_description)
    resume_keywords = extract_keywords(resume_text)

    try:
        data = analyze_resume(resume_text, job_description, jd_keywords, resume_keywords)
    except Exception as e:
        logger.error(f"AI Logic Engine Failed: {e}")
        return {"error": "AI response parsing failed", "details": str(e)}

    final_score = round(float(data.get("overallScore", calculate_score(data))), 2)
    data["analysis_confidence"] = estimate_analysis_confidence(resume_text)

    # Pass 2: refine suggestions
    if data.get("improvements"):
        try:
            refined_improvements = refine_suggestions(data["improvements"], job_description)
            data["improvements"] = refined_improvements
        except Exception as e:
            logger.warning(f"Suggestion refinement skipped: {e}")

    # Contextual memory: score shift insight
    if user_id > 0:
        prev_analysis = (
            db.query(models.ResumeAnalysis)
            .filter(models.ResumeAnalysis.user_id == user_id)
            .order_by(models.ResumeAnalysis.created_at.desc())
            .first()
        )
        if prev_analysis and prev_analysis.score != final_score:
            try:
                data["memory_insight"] = explain_score_shift(prev_analysis.score, int(final_score))
            except Exception as e:
                logger.warning(f"Score shift insight skipped: {e}")

    payload = {
        "overall_score": final_score,
        "details": {
            **data,
            "resume_text": resume_text,
            "extracted_preview": resume_text[:500],
            "resume_validation": resume_validation_meta,
        },
    }

    if user_id > 0:
        save_obj = models.ResumeAnalysis(user_id=user_id, score=int(final_score), data=json.dumps(payload))
        db.add(save_obj)
        db.commit()

    return payload



@app.get("/resume/download/{analysis_id}")
def download_resume(analysis_id: int, db: Session = Depends(get_db)):
    if not s3_client:
        raise HTTPException(status_code=501, detail="Cloud storage not configured")
        
    analysis = db.query(models.ResumeAnalysis).filter(models.ResumeAnalysis.id == analysis_id).first()
    if not analysis or not analysis.pdf_url:
        raise HTTPException(status_code=404, detail="Resume PDF not found")
        
    try:
        url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': 'resumetric-pdfs', 'Key': analysis.pdf_url},
            ExpiresIn=3600
        )
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/validate-upload")
async def validate_upload(file: UploadFile = File(...)):
    """
    4-Step PDF Validation Pipeline (preview / pre-flight endpoint).
    Runs STEP 1 + STEP 2 + STEP 3 without scoring.
    Returns status: 'accepted' | 'declined' | 'low_confidence'
    """
    file_bytes = await file.read()
    log_upload_file_received("/validate-upload", file, file_bytes)
    filename = file.filename.lower() if file.filename else ""

    # Size / format guard
    if len(file_bytes) > MAX_FILE_SIZE:
        return {
            "status": "declined",
            "message": "File size exceeds 5MB limit. Please upload a smaller resume file.",
            "can_analyze": False,
        }

    if not (is_pdf_file(filename, file_bytes) or is_supported_image(filename)):
        return {
            "status": "declined",
            "message": "Please upload a resume in PDF, JPG, JPEG, or PNG format.",
            "can_analyze": False,
        }

    # ── STEP 1: Extract text ──────────────────────────────────────────────────
    started_at = time.perf_counter()
    resume_text = ""
    extraction_method = ""

    if is_pdf_file(filename, file_bytes):
        resume_text = parse_pdf(file_bytes)
        extraction_method = "direct-pdf-text"
        if usable_text_length(resume_text) < MIN_ANALYZABLE_TEXT_LENGTH:
            ocr_result = parse_scanned_pdf_with_ocr(file_bytes)
            if usable_text_length(ocr_result.get("text", "")) >= MIN_ANALYZABLE_TEXT_LENGTH:
                resume_text = ocr_result["text"]
                extraction_method = "pdf-ocr"
    else:
        ocr_result = parse_image_with_ocr(file_bytes)
        if ocr_result["text"].strip():
            resume_text = ocr_result["text"]
            extraction_method = "image-ocr"

    processing_seconds = round(time.perf_counter() - started_at, 2)

    if usable_text_length(resume_text) < MIN_ANALYZABLE_TEXT_LENGTH:
        return {
            "status": "declined",
            "message": "Could not read this PDF. Please upload a text-based PDF.",
            "validation": {
                "isResume": False,
                "is_resume": False,
                "confidence": 0,
                "reason": "Could not read this PDF. Please upload a text-based PDF.",
                "extraction_method": extraction_method or "no-text",
                "processing_seconds": processing_seconds,
                "character_count": len(resume_text),
                "can_analyze": False,
            },
            "extracted_preview": resume_text[:500],
            "can_analyze": False,
        }

    # ── STEP 2: AI resume classifier ─────────────────────────────────────────
    ai_check = {"isResume": True, "confidence": 75, "reason": "AI validation skipped."}
    try:
        ai_check = validate_resume_document(resume_text)
    except Exception as ai_err:
        logger.warning(f"AI validation error in /validate-upload (heuristic fallback): {ai_err}")
        heuristic = classify_resume_text(resume_text)
        ai_check = {
            "isResume": heuristic.get("is_resume", True),
            "confidence": heuristic.get("confidence", 70),
            "reason": heuristic.get("reason", "Heuristic classification used."),
        }

    is_resume_flag = ai_check.get("isResume", True)
    confidence_val = ai_check.get("confidence", 75)

    validation_meta = {
        **ai_check,
        "is_resume": is_resume_flag,
        "extraction_method": extraction_method,
        "processing_seconds": processing_seconds,
        "character_count": len(resume_text),
        "word_count": len(resume_text.split()),
        "can_analyze": is_resume_flag and confidence_val > 70,
        "analysis_confidence": estimate_analysis_confidence(resume_text),
    }

    # ── STEP 3: Gate ─────────────────────────────────────────────────────────
    if not is_resume_flag or confidence_val < 40:
        return {
            "status": "declined",
            "message": "This doesn't look like a resume. Please upload your resume PDF.",
            "validation": {**validation_meta, "can_analyze": False},
            "extracted_preview": resume_text[:500],
            "can_analyze": False,
        }

    if 40 <= confidence_val <= 70:
        return {
            "status": "low_confidence",
            "message": "We're not sure this is a resume. Continue anyway?",
            "validation": validation_meta,
            "extracted_preview": resume_text[:500],
            "can_analyze": True,
        }

    # confidence > 70 → accepted
    return {
        "status": "accepted",
        "message": f"Resume accepted. PDF verified in {processing_seconds}s.",
        "validation": validation_meta,
        "extracted_preview": resume_text[:500],
        "can_analyze": True,
    }

# -----------------------------------------------------------------------------
# INSTAGRAM-STYLE SOCIAL ENDPOINTS
# -----------------------------------------------------------------------------

@app.get("/stories")
def get_stories(user_id: int = 0, db: Session = Depends(get_db)):
    """Get active stories (not expired) grouped by user, ordered by recent."""
    now = datetime.utcnow()
    # In a real app, only show stories from followed users + own + popular
    stories = db.query(models.Story).filter(models.Story.expires_at > now).order_by(models.Story.created_at.desc()).all()
    
    # Group by user
    grouped = {}
    for s in stories:
        if s.user_id not in grouped:
            author = db.query(models.User).filter(models.User.id == s.user_id).first()
            if not author: continue
            grouped[s.user_id] = {
                "user_id": author.id,
                "author_name": author.name,
                "author_username": author.username,
                "author_photo": author.profile_photo,
                "is_verified": bool(author.is_verified) or (author.points or 0) >= 500,
                "has_unseen": False, # Would calculate based on views in real app
                "items": []
            }
        grouped[s.user_id]["items"].append({
            "id": s.id,
            "content_type": s.content_type,
            "text_content": s.text_content,
            "image_data": s.image_data,
            "bg_color": s.bg_color,
            "created_at": s.created_at.isoformat(),
            "expires_at": s.expires_at.isoformat(),
            "views_count": s.views_count
        })
    return list(grouped.values())

@app.post("/stories")
def create_story(
    user_id: int = Form(...),
    content_type: str = Form("tip"),
    text_content: str = Form(None),
    image_data: str = Form(None),
    bg_color: str = Form("#1E293B"),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user: return {"error": "User not found"}
    
    story = models.Story(
        user_id=user_id,
        content_type=content_type,
        text_content=text_content,
        image_data=image_data,
        bg_color=bg_color,
        expires_at=datetime.utcnow() + timedelta(hours=24)
    )
    db.add(story)
    db.commit()
    db.refresh(story)
    award_points(db, user_id, 3, "Earned +3 pts for sharing a story")
    return {"message": "Story posted"}

@app.post("/stories/{story_id}/view")
def view_story(story_id: int, user_id: int = Form(...), db: Session = Depends(get_db)):
    story = db.query(models.Story).filter(models.Story.id == story_id).first()
    if not story: return {"error": "Story not found"}
    
    existing = db.query(models.StoryView).filter_by(story_id=story_id, viewer_id=user_id).first()
    if not existing:
        db.add(models.StoryView(story_id=story_id, viewer_id=user_id))
        story.views_count = (story.views_count or 0) + 1
        db.commit()
    return {"success": True}

@app.get("/notifications/{user_id}")
def get_notifications(user_id: int, db: Session = Depends(get_db)):
    notifs = db.query(models.Notification).filter(models.Notification.user_id == user_id).order_by(models.Notification.created_at.desc()).limit(50).all()
    result = []
    for n in notifs:
        actor = db.query(models.User).filter(models.User.id == n.actor_id).first() if n.actor_id else None
        result.append({
            "id": n.id,
            "type": n.type,
            "message": n.message,
            "reference_id": n.reference_id,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat(),
            "actor": {
                "name": actor.name,
                "username": actor.username,
                "profile_photo": actor.profile_photo
            } if actor else None
        })
    return result

@app.post("/notifications/{user_id}/read")
def mark_notifications_read(user_id: int, db: Session = Depends(get_db)):
    db.query(models.Notification).filter(models.Notification.user_id == user_id, models.Notification.is_read == False).update({"is_read": True})
    db.commit()
    return {"success": True}

@app.get("/explore")
def explore_search(q: str = "", filter_type: str = "recent", db: Session = Depends(get_db)):
    """Search posts by company, role, user, or hashtag. Filter by recent/liked/commented."""
    query = db.query(models.Post)
    if q:
        q_lower = q.lower()
        if q.startswith("#"):
            tag = q_lower[1:]
            query = query.filter(models.Post.hashtags.like(f'%"{tag}"%'))
        else:
            query = query.filter(
                (models.Post.company_name.ilike(f"%{q}%")) |
                (models.Post.role_tag.ilike(f"%{q}%")) |
                (models.Post.question.ilike(f"%{q}%")) |
                (models.Post.author_name.ilike(f"%{q}%"))
            )
            
    if filter_type == "liked":
        query = query.order_by(models.Post.like_count.desc())
    elif filter_type == "commented":
        query = query.order_by(models.Post.comment_count.desc())
    else:
        query = query.order_by(models.Post.created_at.desc())
        
    posts = query.limit(30).all()
    return [serialize_post(post, db, 0) for post in posts]

@app.get("/messages/conversations/{user_id}")
def get_conversations(user_id: int, db: Session = Depends(get_db)):
    """Get list of users you have DM'd with."""
    msgs = db.query(models.DirectMessage).filter(
        (models.DirectMessage.sender_id == user_id) | (models.DirectMessage.receiver_id == user_id)
    ).order_by(models.DirectMessage.created_at.desc()).all()
    
    seen = set()
    conversations = []
    for m in msgs:
        other_id = m.receiver_id if m.sender_id == user_id else m.sender_id
        if other_id not in seen:
            seen.add(other_id)
            other_user = db.query(models.User).filter(models.User.id == other_id).first()
            if other_user:
                conversations.append({
                    "user_id": other_user.id,
                    "name": other_user.name,
                    "username": other_user.username,
                    "profile_photo": other_user.profile_photo,
                    "last_message": m.content,
                    "is_read": m.is_read or m.sender_id == user_id,
                    "created_at": m.created_at.isoformat()
                })
    return conversations

@app.get("/messages/{user_id}/{other_id}")
def get_messages(user_id: int, other_id: int, db: Session = Depends(get_db)):
    msgs = db.query(models.DirectMessage).filter(
        ((models.DirectMessage.sender_id == user_id) & (models.DirectMessage.receiver_id == other_id)) |
        ((models.DirectMessage.sender_id == other_id) & (models.DirectMessage.receiver_id == user_id))
    ).order_by(models.DirectMessage.created_at.asc()).all()
    
    # Mark as read
    db.query(models.DirectMessage).filter(
        models.DirectMessage.sender_id == other_id,
        models.DirectMessage.receiver_id == user_id,
        models.DirectMessage.is_read == False
    ).update({"is_read": True})
    db.commit()
    
    result = []
    for m in msgs:
        post = None
        if m.shared_post_id:
            p = db.query(models.Post).filter(models.Post.id == m.shared_post_id).first()
            if p: post = serialize_post(p, db, user_id)
        
        result.append({
            "id": m.id,
            "sender_id": m.sender_id,
            "receiver_id": m.receiver_id,
            "content": m.content,
            "shared_post": post,
            "is_read": m.is_read,
            "created_at": m.created_at.isoformat()
        })
    return result

@app.post("/messages")
def send_message(
    sender_id: int = Form(...),
    receiver_id: int = Form(...),
    content: str = Form(None),
    shared_post_id: int = Form(None),
    db: Session = Depends(get_db)
):
    msg = models.DirectMessage(
        sender_id=sender_id,
        receiver_id=receiver_id,
        content=content,
        shared_post_id=shared_post_id
    )
    db.add(msg)
    
    # Send notification if it's the first message or a post share
    sender = db.query(models.User).filter(models.User.id == sender_id).first()
    if sender:
        n_msg = f"{sender.name} sent you a message"
        if shared_post_id: n_msg = f"{sender.name} shared a post with you"
        db.add(models.Notification(
            user_id=receiver_id,
            actor_id=sender_id,
            type="message",
            message=n_msg,
            reference_id=sender_id
        ))
        
    db.commit()
    return {"message": "Sent successfully"}

# --- NEW FEATURES: RESUME BUILDER, JOB MATCH, HISTORY, LINKEDIN, COVER LETTER ---

from fastapi.responses import FileResponse
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
import requests

class ResumeBuilderInput(BaseModel):
    user_id: int
    personal_info: str
    work_experience: str
    education: str
    skills: str
    projects: str

@app.post("/resume/build")
def build_resume(payload: ResumeBuilderInput, db: Session = Depends(get_db)):
    # 1. Save to DB
    builder = models.BuilderResume(
        user_id=payload.user_id,
        personal_info=payload.personal_info,
        work_experience=payload.work_experience,
        education=payload.education,
        skills=payload.skills,
        projects=payload.projects
    )
    db.add(builder)
    db.commit()
    db.refresh(builder)
    
    # 2. Generate PDF
    pdf_filename = f"uploads/builder_{builder.id}.pdf"
    os.makedirs("uploads", exist_ok=True)
    c = canvas.Canvas(pdf_filename, pagesize=letter)
    y = 750
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, y, "Resume")
    y -= 30
    c.setFont("Helvetica", 12)
    
    # Very basic PDF rendering
    for section, content in [
        ("Personal Info", payload.personal_info),
        ("Experience", payload.work_experience),
        ("Education", payload.education),
        ("Skills", payload.skills),
        ("Projects", payload.projects)
    ]:
        c.setFont("Helvetica-Bold", 14)
        c.drawString(50, y, section)
        y -= 20
        c.setFont("Helvetica", 12)
        lines = content.split('\n')
        for line in lines:
            if y < 50:
                c.showPage()
                y = 750
            c.drawString(50, y, line)
            y -= 15
        y -= 10
    
    c.save()
    builder.pdf_path = pdf_filename
    db.commit()
    
    return {"message": "Resume built successfully", "pdf_url": f"/{pdf_filename}", "id": builder.id}

@app.get("/jobs/match")
def match_jobs(resume_id: int, job_title: str = "Software Engineer", db: Session = Depends(get_db)):
    # This expects resume_id from ResumeAnalysis or BuilderResume. 
    # For now, we mock the RapidAPI JSearch call as we don't have the API key.
    analysis = db.query(models.ResumeAnalysis).filter(models.ResumeAnalysis.id == resume_id).first()
    skills = "python, react"
    if analysis:
        try:
            data = json.loads(analysis.data)
            skills = ", ".join(data.get("keywords", []))
        except:
            pass
            
    # Mocking RapidAPI call
    mock_jobs = [
        {"job_title": job_title, "employer_name": "Tech Corp", "job_apply_link": "https://example.com/apply1", "job_min_salary": 90000, "job_max_salary": 120000},
        {"job_title": f"Senior {job_title}", "employer_name": "Innovate LLC", "job_apply_link": "https://example.com/apply2", "job_min_salary": 120000, "job_max_salary": 150000},
        {"job_title": f"Junior {job_title}", "employer_name": "Startup Inc", "job_apply_link": "https://example.com/apply3", "job_min_salary": 60000, "job_max_salary": 80000},
    ]
    return {"jobs": mock_jobs, "query": f"{job_title} in {skills}"}

@app.get("/resume/history")
def get_resume_history(user_id: int, db: Session = Depends(get_db)):
    history = db.query(models.ResumeHistory).filter(models.ResumeHistory.user_id == user_id).order_by(models.ResumeHistory.created_at.asc()).all()
    result = []
    for h in history:
        result.append({
            "id": h.id,
            "score": h.score,
            "feedback_summary": h.feedback_summary,
            "created_at": h.created_at.isoformat()
        })
    return result

LINKEDIN_CLIENT_ID = os.getenv("LINKEDIN_CLIENT_ID", "")
LINKEDIN_CLIENT_SECRET = os.getenv("LINKEDIN_CLIENT_SECRET", "")
LINKEDIN_REDIRECT_URI = os.getenv("LINKEDIN_REDIRECT_URI", "http://localhost:5000/auth/linkedin/callback")

@app.get("/auth/linkedin/url")
def linkedin_auth_url():
    if not LINKEDIN_CLIENT_ID:
        return {"url": "mock"}
    url = f"https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id={LINKEDIN_CLIENT_ID}&redirect_uri={LINKEDIN_REDIRECT_URI}&state=123456&scope=openid%20profile%20email"
    return {"url": url}

@app.get("/auth/linkedin/callback")
def linkedin_callback(code: str):
    if not LINKEDIN_CLIENT_ID:
        # Mock OAuth 2.0 exchange
        mock_profile = {
            "name": "LinkedIn User",
            "headline": "Software Engineer at Tech",
            "experience": "3 years at Tech Corp",
            "education": "BS Computer Science",
            "skills": "Python, React, SQL"
        }
        return {"message": "LinkedIn connected (Mock)", "profile": mock_profile}
        
    # Real implementation
    token_url = "https://www.linkedin.com/oauth/v2/accessToken"
    payload = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": LINKEDIN_REDIRECT_URI,
        "client_id": LINKEDIN_CLIENT_ID,
        "client_secret": LINKEDIN_CLIENT_SECRET
    }
    
    try:
        res = requests.post(token_url, data=payload)
        res_data = res.json()
        access_token = res_data.get("access_token")
        
        if not access_token:
            return {"error": "Failed to get access token", "details": res_data}
            
        # Get user profile (using OpenID API)
        headers = {"Authorization": f"Bearer {access_token}"}
        profile_res = requests.get("https://api.linkedin.com/v2/userinfo", headers=headers)
        profile_data = profile_res.json()
        
        # Note: LinkedIn restricts full experience/skills data to approved enterprise partners.
        # For standard apps, we can only get name, email, and picture via OpenID.
        profile = {
            "name": profile_data.get("name", "LinkedIn User"),
            "email": profile_data.get("email", ""),
            "picture": profile_data.get("picture", ""),
            "headline": "Imported from LinkedIn", 
            "experience": "Details available on LinkedIn profile.",
            "education": "Imported via LinkedIn",
            "skills": ""
        }
        return {"message": "LinkedIn connected", "profile": profile}
    except Exception as e:
        return {"error": str(e)}

class CoverLetterInput(BaseModel):
    user_id: int
    job_title: str
    company_name: str
    job_description: str
    resume_text: str = "" # Optional, if not provided will fetch latest

@app.post("/cover-letter/generate")
def generate_cover_letter(payload: CoverLetterInput, db: Session = Depends(get_db)):
    # Mocking Claude API call for cover letter
    resume_text = payload.resume_text
    if not resume_text:
        # fetch latest from db
        pass
        
    letter = f"Dear Hiring Manager at {payload.company_name},\n\n"
    letter += f"I am writing to express my interest in the {payload.job_title} position. "
    letter += f"With my background in software engineering, I am confident I can bring value to your team.\n\n"
    letter += f"In my previous roles, I have developed scalable applications and am eager to apply these skills to {payload.company_name}. "
    letter += f"The job description mentions a need for {payload.job_description[:50]}..., which aligns perfectly with my expertise.\n\n"
    letter += f"Thank you for your time and consideration. I look forward to discussing my qualifications further.\n\n"
    letter += "Sincerely,\nApplicant"
    
    return {"cover_letter": letter}

@app.get("/leaderboard")
def get_leaderboard(db: Session = Depends(get_db)):
    users = db.query(models.User).filter(models.User.is_active == True, models.User.is_private == False).order_by(models.User.points.desc()).limit(50).all()
    result = []
    for idx, u in enumerate(users):
        result.append({
            "rank": idx + 1,
            "id": u.id,
            "username": u.username or f"user_{u.id}",
            "name": u.name,
            "profile_photo": u.profile_photo,
            "points": u.points or 0,
            "rank_title": reputation_level(u.points or 0)
        })
    return result

class UserSettings(BaseModel):
    user_id: int
    name: str | None = None
    email: str | None = None
    password: str | None = None
    notifications_enabled: bool | None = None
    is_private: bool | None = None

@app.patch("/user/settings")
def update_user_settings(payload: UserSettings, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == payload.user_id).first()
    if not user:
        return {"error": "User not found"}
        
    if payload.name is not None: user.name = payload.name
    if payload.email is not None: user.email = payload.email
    if payload.password is not None and len(payload.password) > 0: 
        user.password = hash_password(payload.password)
    if payload.notifications_enabled is not None: 
        user.notifications_enabled = payload.notifications_enabled
    if payload.is_private is not None: 
        user.is_private = payload.is_private
        
    db.commit()
    return {"message": "Settings updated successfully"}

@app.delete("/user/account")
def delete_account(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        return {"error": "User not found"}
        
    # Soft delete
    user.is_active = False
    user.email = f"deleted_{user.id}_{user.email}" # Clear email to allow re-registration
    user.username = f"deleted_{user.id}_{user.username}"
    db.commit()
    return {"message": "Account deleted successfully"}

