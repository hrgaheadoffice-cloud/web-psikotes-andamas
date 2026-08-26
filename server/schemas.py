# server/schemas.py
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional

# What the user sends to login
class UserLogin(BaseModel):
    username: str
    password: str

# What we return after login (The Token)
class Token(BaseModel):
    access_token: str
    token_type: str

# What is inside the token (payload)
class TokenData(BaseModel):
    username: Optional[str] = None

# ClassConfig schemas
class ClassConfigOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    config: dict

    class Config:
        from_attributes = True

# Schema for creating a new user
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3)
    password: str = Field(..., min_length=6)
    role: str = "participant"  # Default to participant
    # NEW FIELDS
    full_name: str = Field(..., min_length=1)
    gender: Optional[str] = None
    age: Optional[int] = None
    education: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    business_unit: Optional[str] = None
    class_id: Optional[int] = None
    level: Optional[str] = None
    participant_status: Optional[str] = None
    report_decisions: Optional[dict] = None

    @field_validator("username", "password", "full_name", "education", "department", "position", "business_unit", "level", "participant_status", mode="before")
    @classmethod
    def _strip_strings(cls, value):
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("username")
    @classmethod
    def _validate_username(cls, value: str):
        if len(value) < 3:
            raise ValueError("Username minimal 3 karakter")
        return value

    @field_validator("password")
    @classmethod
    def _validate_password(cls, value: str):
        if len(value) < 6:
            raise ValueError("Kata sandi minimal 6 karakter")
        return value

    @field_validator("full_name")
    @classmethod
    def _validate_full_name(cls, value: str):
        if not value:
            raise ValueError("Nama lengkap wajib diisi")
        return value

    @field_validator("age")
    @classmethod
    def _validate_age(cls, value):
        if value is None:
            return value
        if value < 1 or value > 120:
            raise ValueError("Usia harus antara 1 hingga 120")
        return value


class TestSubmission(BaseModel):
    answers: List[dict]  # Make sure this is List[dict], not dict
    time_taken: int
    device_info: Optional[str] = None

# IQ Test Phase schemas
class PhaseOut(BaseModel):
    id: int
    order_number: int
    timer_seconds: int
    practice_questions: Optional[list] = None
    status: str  # locked, current, done
    is_unlocked: bool
    answered_count: Optional[int] = None
    total_questions: Optional[int] = None

    class Config:
        from_attributes = True

class PhaseSubmitRequest(BaseModel):
    phase_id: int
    answers: List[dict]  # [{question_id, option_id(s)}]

class IQSubmitAllRequest(BaseModel):
    device_info: Optional[str] = None

class IQSubmitAllResponse(BaseModel):
    message: str
    score: int
    max_score: int
    scaled_score: int
    iq: int
    classification: str
    section_scores: dict  # {section_1: {correct, max}, section_2: {correct, max}}
    phase_scores: dict

class PhaseSubmitResponse(BaseModel):
    phase_id: int
    answered_count: int
    correct_count: int

class UserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    full_name: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[int] = None
    education: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    business_unit: Optional[str] = None
    class_id: Optional[int] = None
    level: Optional[str] = None
    participant_status: Optional[str] = None
    report_decisions: Optional[dict] = None

# Exam Session schemas
from datetime import datetime

class ExamSessionBase(BaseModel):
    name: str
    start_time: datetime
    end_time: Optional[datetime] = None
    is_unlocked: bool = False

class ExamSessionCreate(ExamSessionBase):
    participant_ids: List[int]

class ExamSessionOut(ExamSessionBase):
    id: int
    created_at: Optional[datetime] = None
    participant_count: int = 0
    participant_ids: List[int] = []

    class Config:
        from_attributes = True

class ExamSessionUpdate(BaseModel):
    name: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    is_unlocked: Optional[bool] = None
    participant_ids: Optional[List[int]] = None

class ExamSessionStatus(BaseModel):
    id: int
    name: str
    is_open: bool
    is_unlocked: bool
    seconds_until_start: int
    start_time: datetime
    end_time: Optional[datetime] = None
