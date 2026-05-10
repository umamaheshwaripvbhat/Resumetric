import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

SUPABASE_DATABASE_URL = os.getenv("SUPABASE_DATABASE_URL", "")

if SUPABASE_DATABASE_URL and SUPABASE_DATABASE_URL != "postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres":
    # PostgreSQL settings
    engine = create_engine(
        SUPABASE_DATABASE_URL, 
        pool_size=20, 
        max_overflow=0
    )
else:
    # Fallback to SQLite for local testing
    SQLALCHEMY_DATABASE_URL = "sqlite:///./resumetric.db"
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, 
        connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
