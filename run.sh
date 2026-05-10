#!/bin/bash
cd "$(dirname "$0")"
source venv/bin/activate
export GROQ_API_KEY=""
uvicorn main:app --reload --host 0.0.0.0 --port 8000
