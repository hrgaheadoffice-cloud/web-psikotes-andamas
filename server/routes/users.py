"""
User management routes - CRUD operations for users
"""
import secrets
import string
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from auth import hash_password, verify_password, require_admin, require_superadmin, require_assessor_or_higher, get_current_user
from database import get_db
from models import User, ExitLog, Result, Assignment, ClassConfig
from schemas import UserCreate, UserUpdate, ClassConfigOut

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/classes", response_model=List[ClassConfigOut])
def get_classes(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Get all class configurations (for dropdown on add participant)"""
    classes = db.query(ClassConfig).order_by(ClassConfig.name).all()
    return classes


@router.get("/", response_model=List[dict])
def get_users(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Get all users (admin and superadmin only)"""
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "role": u.role,
            "full_name": u.full_name,
            "department": u.department,
            "position": u.position,
            "business_unit": u.business_unit,
            "education": u.education,
            "class_id": u.class_id,
            "level": u.level,
            "class_name": u.class_config.name if u.class_config else None,
            "created_at": u.created_at

        }
        for u in users
    ]


@router.post("/", status_code=201)
def create_user(
    user: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Create a new user"""
    if user.role not in ["participant", "admin", "assessor", "superadmin"]:
        raise HTTPException(status_code=400, detail="Role tidak valid")

    # If current user is not superadmin, they cannot create admin/superadmin
    if current_user.role != "superadmin" and user.role in ["admin", "superadmin", "assessor"]:
        raise HTTPException(
            status_code=403,
            detail="Only superadmin can create administrative users"
        )

    if not user.level:
        raise HTTPException(status_code=400, detail="Level wajib diisi")

    if user.role == "participant":
        required_fields = {
            "full_name": user.full_name,
            "gender": user.gender,
            "age": user.age,
            "education": user.education,
            "department": user.department,
            "position": user.position,
            "business_unit": user.business_unit,
            "level": user.level,
            "participant_status": user.participant_status,
        }
        missing_fields = [label for label, value in required_fields.items() if value is None or (isinstance(value, str) and not value.strip())]
        if missing_fields:
            raise HTTPException(
                status_code=400,
                detail=f"Field wajib peserta belum lengkap: {', '.join(missing_fields)}"
            )
        if user.class_id is None:
            raise HTTPException(status_code=400, detail="Kelas wajib dipilih untuk peserta")
    else:
        if user.age is not None and (user.age < 1 or user.age > 120):
            raise HTTPException(status_code=400, detail="Usia harus antara 1 hingga 120")

    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")

    # Validate class_id if provided
    if user.class_id is not None:
        class_exists = db.query(ClassConfig).filter(ClassConfig.id == user.class_id).first()
        if not class_exists:
            raise HTTPException(status_code=400, detail="Class not found")

    new_user = User(
        username=user.username,
        password_hash=hash_password(user.password),
        role=user.role,
        full_name=user.full_name,
        gender=user.gender,
        age=user.age,
        education=user.education,
        department=user.department,
        position=user.position,
        business_unit=user.business_unit,
        level=user.level,
        class_id=user.class_id,
        participant_status=user.participant_status if user.role == "participant" else None

    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User created successfully", "username": new_user.username, "id": new_user.id}


@router.get("/{user_id}")
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Get single user by ID"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Strip report decisions for non-assessors/superadmins
    report_decisions = user.report_decisions
    if admin.role not in ["assessor", "superadmin"]:
        report_decisions = None

    return {
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "full_name": user.full_name,
        "gender": user.gender,
        "age": user.age,
        "education": user.education,
        "department": user.department,
        "position": user.position,
        "business_unit": user.business_unit,
        "class_id": user.class_id,
        "level": user.level,
        "participant_status": user.participant_status,
        "report_decisions": report_decisions,
        "class_name": user.class_config.name if user.class_config else None,
        "created_at": user.created_at
    }


@router.put("/{user_id}")
def update_user(
    user_id: int,
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Update user information"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # If current user is not superadmin, they cannot change roles
    if current_user.role != "superadmin" and user_update.role is not None:
        raise HTTPException(
            status_code=403,
            detail="Only superadmin can change user roles"
        )

    # Also prevent a non-superadmin from elevating someone to admin/superadmin
    if current_user.role != "superadmin" and user_update.role in ["admin", "superadmin", "assessor"]:
        raise HTTPException(
            status_code=403,
            detail="Only superadmin can assign administrative roles"
        )

    # Update fields
    if user_update.username is not None:
        if user_update.username != user.username:
            existing = db.query(User).filter(User.username == user_update.username).first()
            if existing:
                raise HTTPException(status_code=400, detail="Username already taken")
        user.username = user_update.username  # type: ignore[assignment]
    if user_update.full_name is not None:
        user.full_name = user_update.full_name  # type: ignore[assignment]
    if user_update.gender is not None:
        user.gender = user_update.gender  # type: ignore[assignment]
    if user_update.age is not None:
        user.age = user_update.age  # type: ignore[assignment]
    if user_update.education is not None:
        user.education = user_update.education  # type: ignore[assignment]
    if user_update.department is not None:
        user.department = user_update.department  # type: ignore[assignment]
    if user_update.position is not None:
        user.position = user_update.position  # type: ignore[assignment]
    if user_update.business_unit is not None:
        user.business_unit = user_update.business_unit  # type: ignore[assignment]
    if user_update.level is not None:
        user.level = user_update.level  # type: ignore[assignment]
    if user_update.role is not None:

        user.role = user_update.role  # type: ignore[assignment]
    if user_update.class_id is not None:
        if user_update.class_id == 0:
            user.class_id = None  # type: ignore[assignment]  # Allow clearing the class
        else:
            class_exists = db.query(ClassConfig).filter(ClassConfig.id == user_update.class_id).first()
            if not class_exists:
                raise HTTPException(status_code=400, detail="Class not found")
            user.class_id = user_update.class_id  # type: ignore[assignment]
    if user_update.password is not None and user_update.password != "":
        user.password_hash = hash_password(user_update.password)
    if user_update.participant_status is not None:
        user.participant_status = user_update.participant_status  # type: ignore[assignment]
    if user_update.report_decisions is not None:
        if current_user.role not in ["assessor", "superadmin"]:
            raise HTTPException(
                status_code=403,
                detail="Only assessors or superadmins can update clinical decisions"
            )
        user.report_decisions = user_update.report_decisions  # type: ignore[assignment]

    db.commit()
    db.refresh(user)
    return {"message": "User updated successfully", "user": user}


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Delete user - cascade delete handles related data (superadmin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Cascade delete handles: ExitLog, Response, Result, Assignment
    db.delete(user)
    db.commit()

    return {"message": "User deleted successfully"}


@router.post("/admin/reset-password/{user_id}")
def reset_password(
    user_id: int,
    db: Session = Depends(get_db),
    superadmin: User = Depends(require_superadmin)
):
    """Reset user password to a random 10-character string (superadmin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Generate a random 10-character password
    alphabet = string.ascii_letters + string.digits
    new_password = ''.join(secrets.choice(alphabet) for _ in range(10))

    # Hash and update
    user.password_hash = hash_password(new_password)
    db.commit()

    return {"new_password": new_password}
