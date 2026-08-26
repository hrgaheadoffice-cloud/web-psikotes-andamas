"""
Main FastAPI application entry point

This file sets up the FastAPI application, middleware, and includes all route modules.
All business logic has been moved to the routes/ package.
"""
import os
from datetime import datetime, date
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from auth import get_current_user, require_admin, require_superadmin
from database import engine, Base, SessionLocal, get_db
from models import User, Test, Assignment, Result, Question, Option, ExitLog, ClassConfig, Phase
from models import Response as DBResponse
from schemas import TestSubmission, Token, UserCreate, UserUpdate

# Import route modules
from routes import auth, users, tests, assignments, results, admin, iq, sessions, filters, analytics, summary

# Import scoring modules (used by assignments route)
from scoring.disc import score_disc
from scoring.speed import score_speed
from scoring.temperament import score_temperament
from scoring.memory import score_memory
from scoring.logic import score_logic
# from services.pdf_report import generate_participant_pdf

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Web Psikotes API",
    description="Psychological Testing Platform API",
    version="1.0.0"
)

# =============================================================================
# CORS Configuration
# =============================================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================================================
# Include Routers
# =============================================================================
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(tests.router)
app.include_router(assignments.router)
app.include_router(results.router)
app.include_router(admin.router)
app.include_router(iq.router)
app.include_router(sessions.router)
app.include_router(filters.router)
app.include_router(analytics.router)
app.include_router(summary.router)
# =============================================================================
# Root Endpoint
# =============================================================================
@app.get("/")
def read_root():
    """Root endpoint - API health check"""
    return {"message": "Hello from Python Backend!", "status": "running"}


# =============================================================================
# Legacy/Compatibility Endpoints
# These are kept for backward compatibility but should be migrated to routes
# =============================================================================

# Note: The following endpoints are still in main.py for now but should be
# migrated to appropriate route modules in a future refactor:
# - Any remaining endpoints not covered by the route modules above