"""
Authentication routes - Login, token, and current user endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from auth import create_access_token, find_user_by_username, get_current_user, normalize_username, verify_password
from database import get_db
from models import User
from schemas import Token, UserCreate, UserUpdate

router = APIRouter()


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Authenticate user and return JWT token"""
    username = normalize_username(form_data.username)
    user = find_user_by_username(db, username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    if not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    
    # Generate a unique session ID to prevent double login
    import uuid
    session_id = str(uuid.uuid4())
    user.current_session_id = session_id
    db.commit()

    access_token = create_access_token(data={"sub": user.username, "sid": session_id})
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/users/me")
def read_users_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user info"""
    return {
        "username": current_user.username,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "id": current_user.id,
        "gender": current_user.gender,
        "age": current_user.age,
        "education": current_user.education,
        "department": current_user.department,
        "position": current_user.position,
        "business_unit": current_user.business_unit
    }
