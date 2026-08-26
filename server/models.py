# server/models.py
from sqlalchemy import Column, Integer, String, JSON, ForeignKey, Boolean, DateTime, Index
from database import Base
import enum
from sqlalchemy import JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from utils import get_now_jakarta

# Define the Role Enum
class UserRole(enum.Enum):
    admin = "admin"
    participant = "participant"

# Class Config Model - Per-class time limits and passing grades
class ClassConfig(Base):
    __tablename__ = "class_configs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)  # e.g., "Karyawan Tetap"
    description = Column(String, nullable=True)
    config = Column(JSON, nullable=False, default=dict)  # {time_overrides: {TEST_CODE: seconds}, passing_grades: {...}}

    # Relationships
    users = relationship("User", back_populates="class_config")

# Define the User Model
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    role = Column(String, default="participant", index=True)

    # NEW FIELDS FOR REPORT
    full_name = Column(String, nullable=True, index=True)
    gender = Column(String, nullable=True)  # e.g., "L" or "P", or "Male"/"Female"
    age = Column(Integer, nullable=True)
    education = Column(String, nullable=True)
    department = Column(String, nullable=True, index=True)
    position = Column(String, nullable=True)
    business_unit = Column(String, nullable=True)
    class_id = Column(Integer, ForeignKey("class_configs.id"), nullable=True, index=True)
    level = Column(String, nullable=True)  # e.g., "Supervisor / Section Head"
    current_session_id = Column(String, nullable=True)
    participant_status = Column(String, nullable=True)
    report_decisions = Column(JSON, nullable=True, default=dict)
    created_at = Column(DateTime, default=get_now_jakarta, index=True)


    # Relationships with cascade delete
    assignments = relationship("Assignment", back_populates="user", cascade="all, delete-orphan")
    results = relationship("Result", back_populates="user", cascade="all, delete-orphan")
    responses = relationship("Response", back_populates="user", cascade="all, delete-orphan")
    exit_logs = relationship("ExitLog", back_populates="user", cascade="all, delete-orphan")
    class_config = relationship("ClassConfig", back_populates="users")

# 1. The Test Model (e.g., IQ Test, DISC)
class Test(Base):
    __tablename__ = "tests"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)  # e.g., "IQ Test"
    code = Column(String, unique=True, index=True) # e.g., "IQ"
    time_limit = Column(Integer)  # Time in seconds
    settings = Column(JSON, nullable=True) # Store config like 'passing_score'

    # Relationships
    questions = relationship("Question", back_populates="test", cascade="all, delete-orphan")
    assignments = relationship("Assignment", back_populates="test")
    results = relationship("Result", back_populates="test")
    phases = relationship("Phase", back_populates="test", cascade="all, delete-orphan")

# 1b. The Phase Model (IQ Test phases)
class Phase(Base):
    __tablename__ = "phases"

    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(Integer, ForeignKey("tests.id"), index=True)
    order_number = Column(Integer, nullable=False, index=True)  # 1 through 8
    timer_seconds = Column(Integer, nullable=False, default=180)
    practice_questions = Column(JSON, nullable=True, default=list)  # Practice/tutorial Q data

    # Relationships
    test = relationship("Test", back_populates="phases")
    questions = relationship("Question", back_populates="phase")

# 1c. The Exam Session Model (For scheduling waves)
class ExamSession(Base):
    __tablename__ = "exam_sessions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True) # e.g., "Recruitment Wave A"
    start_time = Column(DateTime, nullable=False, index=True)
    end_time = Column(DateTime, nullable=True, index=True)
    is_unlocked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=get_now_jakarta)

    # Relationships
    assignments = relationship("Assignment", back_populates="session")

# 2. The Question Model
class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(Integer, ForeignKey("tests.id"), index=True)
    phase_id = Column(Integer, ForeignKey("phases.id"), nullable=True, index=True)  # For IQ test phases
    content = Column(String)
    order_index = Column(Integer, index=True)

    # CHANGE 'metadata' to 'meta_data' to avoid conflict
    meta_data = Column(JSON, nullable=True)

    # Relationships
    test = relationship("Test", back_populates="questions")
    phase = relationship("Phase", back_populates="questions")
    options = relationship("Option", back_populates="question", cascade="all, delete-orphan")
    responses = relationship("Response", back_populates="question")

# 3. The Option Model (The answers)
class Option(Base):
    __tablename__ = "options"
    
    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"))
    label = Column(String) # A, B, C, D
    content = Column(String) # The answer text or image filename
    scoring_logic = Column(JSON, nullable=True) # e.g., {"correct": true} or {"trait": "D"}
    
    # Relationship
    question = relationship("Question", back_populates="options")

class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    test_id = Column(Integer, ForeignKey("tests.id"), index=True)
    session_id = Column(Integer, ForeignKey("exam_sessions.id"), nullable=True, index=True)
    status = Column(String, default="pending", index=True) # pending, in_progress, completed, locked
    pretest_completed = Column(Boolean, default=False) # The Tutorial flag
    assigned_at = Column(DateTime, default=get_now_jakarta, index=True) # Needs import: from datetime import datetime
    started_at = Column(DateTime, nullable=True, index=True)

    # Relationships
    user = relationship("User", back_populates="assignments")
    test = relationship("Test", back_populates="assignments")
    session = relationship("ExamSession", back_populates="assignments")
    responses = relationship("Response", back_populates="assignment", cascade="all, delete-orphan")
    results = relationship("Result", back_populates="assignment", cascade="all, delete-orphan")
    exit_logs = relationship("ExitLog", back_populates="assignment", cascade="all, delete-orphan")

    # Indexes for common queries
    __table_args__ = (
        Index('ix_assignments_user_status', 'user_id', 'status'),
        Index('ix_assignments_test_status', 'test_id', 'status'),
    )

class Response(Base):
    __tablename__ = "responses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    test_id = Column(Integer, ForeignKey("tests.id"), index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), index=True)
    selected_option_id = Column(Integer, ForeignKey("options.id"))
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False, index=True)  # new
    # NEW FIELD: To distinguish between 'most', 'least', or 'single' (for speed test)
    selection_type = Column(String, default="single")

    # Relationships
    user = relationship("User", back_populates="responses")
    test = relationship("Test")
    assignment = relationship("Assignment", back_populates="responses")
    question = relationship("Question", back_populates="responses")
    option = relationship("Option")

class Result(Base):
    __tablename__ = "results"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    test_id = Column(Integer, ForeignKey("tests.id"), index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False, index=True)
    score = Column(Integer, default=0, index=True)
    time_taken = Column(Integer) # in seconds
    completed_at = Column(DateTime, default=get_now_jakarta, index=True)
    details = Column(JSON, nullable=True)  # <-- ADD THIS LINE

    # Relationships
    user = relationship("User", back_populates="results")
    test = relationship("Test", back_populates="results")
    assignment = relationship("Assignment", back_populates="results")

    # Indexes for common queries
    __table_args__ = (
        Index('ix_results_user_completed', 'user_id', 'completed_at'),
        Index('ix_results_test_completed', 'test_id', 'completed_at'),
    )
    
class ExitLog(Base):
    __tablename__ = "exit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), index=True)
    timestamp = Column(DateTime, default=get_now_jakarta, index=True)

    # Relationships
    user = relationship("User", back_populates="exit_logs")
    assignment = relationship("Assignment", back_populates="exit_logs")