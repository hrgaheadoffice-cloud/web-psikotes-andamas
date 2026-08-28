"""
Assignment routes - Assignment management, test taking, and submission
"""
from fastapi import APIRouter, Depends, HTTPException, Form, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import Optional, List
from datetime import datetime, date
import csv
import io

from auth import require_admin, require_superadmin, require_assessor_or_higher, get_current_user, hash_password
from database import get_db
from models import User, Test, Assignment, Result, Question, Option, ExitLog, Response, ClassConfig
from schemas import TestSubmission

# Import scoring functions
from scoring.disc import score_disc
from scoring.speed import score_speed
from scoring.temperament import score_temperament
from scoring.memory import score_memory
from scoring.logic import score_logic
from scoring.papi_kostick import score_papi_kostick
from scoring.cbi import score_cbi_test
from scoring.iq import score_iq

# Import helper
from utils import get_max_score, get_now_jakarta

router = APIRouter(tags=["assignments"])


# ==================== TIME HELPER FUNCTIONS ====================

def _get_now_wib_naive() -> datetime:
    """Mengambil waktu WIB saat ini sebagai naive datetime (tanpa offset info)"""
    now = get_now_jakarta()
    if getattr(now, "tzinfo", None) is not None:
        now = now.replace(tzinfo=None)
    return now


def _to_naive(dt: Optional[datetime]) -> Optional[datetime]:
    """Mengonversi datetime timezone-aware menjadi naive datetime jika ada tzinfo"""
    if dt is None:
        return None
    if getattr(dt, "tzinfo", None) is not None:
        return dt.replace(tzinfo=None)
    return dt


# ==================== ASSIGNMENT CRUD ====================

@router.get("/assignments/")
def get_assignments(
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Get assignments with optional user_id filter"""
    query = db.query(Assignment).options(joinedload(Assignment.user), joinedload(Assignment.test))
    if user_id is not None:
        query = query.filter(Assignment.user_id == user_id)
    
    assignments = query.all()

    result = []
    for a in assignments:
        exit_count = db.query(ExitLog).filter(ExitLog.assignment_id == a.id).count()
        result.append({
            "id": a.id,
            "user_id": a.user_id,
            "username": a.user.username,
            "full_name": a.user.full_name,
            "test_id": a.test_id,
            "test_name": a.test.name,
            "test_code": a.test.code,
            "status": a.status,
            "assigned_at": a.assigned_at.isoformat() if a.assigned_at else None,
            "started_at": a.started_at.isoformat() if a.started_at else None,
            "exit_count": exit_count,
            "pretest_completed": a.pretest_completed
        })
    return result


@router.post("/assignments/", status_code=201)
def create_assignment(
    user_id: int,
    test_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Assign a test to a user"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    test = db.query(Test).filter(Test.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    existing = db.query(Assignment).filter(Assignment.user_id == user_id, Assignment.test_id == test_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Test already assigned to this user")
    new_assignment = Assignment(user_id=user_id, test_id=test_id)
    db.add(new_assignment)
    db.commit()
    return {"message": "Test assigned successfully"}


@router.get("/users/me/assignments")
def get_my_assignments(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get current user's assignments"""
    assignments = db.query(Assignment).filter(Assignment.user_id == current_user.id).all()
    
    time_overrides = {}
    if current_user.class_id:
        class_config = db.query(ClassConfig).filter(ClassConfig.id == current_user.class_id).first()
        if class_config:
            time_overrides = class_config.config.get("time_overrides", {})

    result = []
    for a in assignments:
        time_limit = a.test.time_limit
        if a.test.code in time_overrides:
            override = time_overrides[a.test.code]
            if isinstance(override, dict):
                if "encoding" in override and "recall" in override:
                    time_limit = override["encoding"] + override["recall"]
                elif "phases" in override and isinstance(override["phases"], list):
                    time_limit = sum(override["phases"])
                else:
                    time_limit = a.test.time_limit
            else:
                time_limit = override
        
        # Check for auto-submit if in progress and timed out
        if a.status == "in_progress" and a.started_at and time_limit > 0:
            now = _get_now_wib_naive()
            start = _to_naive(a.started_at)
            elapsed = (now - start).total_seconds()
            if elapsed > (time_limit + 30): # 30s grace period
                try:
                    process_test_submission(a, db, is_auto=True)
                    db.refresh(a)
                except Exception as e:
                    print(f"Auto-submit failed for assignment {a.id}: {e}")
            
        time_in_minutes = (time_limit // 60) if isinstance(time_limit, (int, float)) and time_limit > 0 else 0
        
        result.append({
            "id": a.id,
            "test_id": a.test_id,
            "test_name": a.test.name,
            "test_code": a.test.code,
            "status": a.status,
            "pretest_completed": a.pretest_completed,
            "assigned_at": a.assigned_at,
            "duration": time_in_minutes
        })
    return result


@router.get("/assignments/{assignment_id}/start")
def start_test(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Start a test - get questions for an assignment"""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if assignment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if assignment.status == "locked":
        raise HTTPException(status_code=403, detail="This test is locked due to a security violation. Please contact the administrator.")
    if assignment.status == "completed":
        raise HTTPException(status_code=403, detail="This test has already been completed and cannot be retaken.")
    
    # Session Time-Lock Check
    if assignment.session_id:
        session = assignment.session
        now = _get_now_wib_naive()
        session_start = _to_naive(session.start_time)
        session_end = _to_naive(session.end_time)
        
        if not session.is_unlocked:
            if session_start and now < session_start:
                remaining = int((session_start - now).total_seconds())
                raise HTTPException(
                    status_code=403, 
                    detail=f"Tes ini dijadwalkan akan dimulai dalam {remaining} detik."
                )
            if session_end and now > session_end and assignment.status == "pending":
                raise HTTPException(
                    status_code=403,
                    detail="Sesi ujian ini telah berakhir dan tidak dapat dimulai lagi."
                )

    if assignment.status == "pending":
        assignment.status = "in_progress"
        assignment.started_at = _get_now_wib_naive()
        db.commit()

    time_limit = assignment.test.time_limit
    if current_user.class_id:
        class_config = db.query(ClassConfig).filter(ClassConfig.id == current_user.class_id).first()
        if class_config:
            time_overrides = class_config.config.get("time_overrides", {})
            if assignment.test.code in time_overrides:
                override = time_overrides[assignment.test.code]
                if isinstance(override, dict):
                    if "encoding" in override and "recall" in override:
                        time_limit = override["encoding"] + override["recall"]
                    elif "phases" in override and isinstance(override["phases"], list):
                        time_limit = sum(override["phases"])
                    else:
                        time_limit = override
                else:
                    time_limit = override

    questions = db.query(Question).filter(Question.test_id == assignment.test_id).order_by(Question.order_index).all()
    output = []
    for q in questions:
        options_data = []
        for opt in q.options:
            options_data.append({
                "id": opt.id,
                "label": opt.label,
                "content": opt.content
            })
        q_settings = q.meta_data
        output.append({
            "id": q.id,
            "content": q.content,
            "order": q.order_index,
            "options": options_data,
            "settings": q_settings
        })
    test_settings = assignment.test.settings or {}
    if assignment.test.code == "MEM" and current_user.class_id:
        class_config = db.query(ClassConfig).filter(ClassConfig.id == current_user.class_id).first()
        if class_config:
            time_overrides = class_config.config.get("time_overrides", {})
            mem_overrides = time_overrides.get("MEM", {})
            if isinstance(mem_overrides, dict):
                if "encoding" in mem_overrides:
                    test_settings["encoding_time"] = mem_overrides["encoding"]
                if "recall" in mem_overrides:
                    test_settings["recall_time"] = mem_overrides["recall"]

    remaining_time = time_limit
    if assignment.status == "in_progress" and assignment.started_at:
        now = _get_now_wib_naive()
        start = _to_naive(assignment.started_at)
        elapsed = (now - start).total_seconds()
        if time_limit > 0:
            remaining_time = max(0, int(time_limit - elapsed))

    responses = db.query(Response).filter(Response.assignment_id == assignment_id).all()
    existing_answers = {}
    
    if assignment.test.code == "DISC":
        for r in responses:
            q_id = str(r.question_id)
            if q_id not in existing_answers:
                existing_answers[q_id] = {"most": None, "least": None}
            if r.selection_type in ["most", "least"]:
                existing_answers[q_id][r.selection_type] = r.selected_option_id
    elif assignment.test.code == "LOGIC":
        multi_map = {}
        for r in responses:
            if r.selection_type == "multi":
                if r.question_id not in multi_map: multi_map[r.question_id] = []
                multi_map[r.question_id].append(str(r.selected_option_id))
            else:
                existing_answers[str(r.question_id)] = r.selected_option_id
        for q_id, opt_ids in multi_map.items():
            existing_answers[str(q_id)] = ",".join(opt_ids)
    else:
        for r in responses:
            existing_answers[str(r.question_id)] = r.selected_option_id

    return {
        "test_name": assignment.test.name,
        "test_code": assignment.test.code,
        "time_limit": time_limit,
        "remaining_time": remaining_time,
        "existing_answers": existing_answers,
        "settings": test_settings,
        "questions": output
    }


@router.post("/assignments/{assignment_id}/save-answer")
def save_answer(
    assignment_id: int,
    question_id: int,
    option_id: Optional[str] = None,
    type: str = "single",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Save or update a single answer in real-time"""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id, Assignment.user_id == current_user.id).first()
    if not assignment or assignment.status != "in_progress":
        raise HTTPException(status_code=400, detail="Test is not in progress or unauthorized")

    db.query(Response).filter(
        Response.assignment_id == assignment_id, 
        Response.question_id == question_id,
        Response.selection_type == type
    ).delete()

    if option_id and "," in str(option_id):
        ids = [int(x.strip()) for x in str(option_id).split(",") if x.strip()]
        for opt_id in ids:
            resp = Response(
                user_id=current_user.id,
                test_id=assignment.test_id,
                assignment_id=assignment_id,
                question_id=question_id,
                selected_option_id=opt_id,
                selection_type="multi"
            )
            db.add(resp)
    else:
        resp = Response(
            user_id=current_user.id,
            test_id=assignment.test_id,
            assignment_id=assignment_id,
            question_id=question_id,
            selected_option_id=int(option_id) if option_id and str(option_id).isdigit() else None,
            selection_type=type
        )
        db.add(resp)
    
    db.commit()
    return {"status": "success"}


def process_test_submission(assignment, db: Session, submission_data: Optional[TestSubmission] = None, is_auto: bool = False):
    """
    Core logic to score and complete a test.
    """
    answers_to_score = []
    device_info = "Unknown"
    time_taken = 0

    if submission_data:
        answers_to_score = submission_data.answers
        device_info = submission_data.device_info or "Unknown"
        time_taken = submission_data.time_taken
        
        db.query(Response).filter(Response.assignment_id == assignment.id).delete()
        for ans in answers_to_score:
            opt_id = ans.get("option_id")
            if opt_id and "," in str(opt_id):
                ids = [int(x.strip()) for x in str(opt_id).split(",")]
                for o_id in ids:
                    db.add(Response(
                        user_id=assignment.user_id,
                        test_id=assignment.test_id,
                        assignment_id=assignment.id,
                        question_id=ans["question_id"],
                        selected_option_id=o_id,
                        selection_type="multi"
                    ))
            else:
                db.add(Response(
                    user_id=assignment.user_id,
                    test_id=assignment.test_id,
                    assignment_id=assignment.id,
                    question_id=ans["question_id"],
                    selected_option_id=opt_id,
                    selection_type=ans.get("type", "single")
                ))
    else:
        responses = db.query(Response).filter(Response.assignment_id == assignment.id).all()
        q_map = {}
        for r in responses:
            if r.question_id not in q_map:
                q_map[r.question_id] = {"question_id": r.question_id, "option_id": r.selected_option_id, "type": r.selection_type}
            if r.selection_type == "multi":
                curr = str(q_map[r.question_id]["option_id"])
                if r.selected_option_id and str(r.selected_option_id) not in curr:
                    q_map[r.question_id]["option_id"] = f"{curr},{r.selected_option_id}" if curr != "None" else str(r.selected_option_id)
        
        answers_to_score = list(q_map.values())
        device_info = "Server Auto-Submit"

    test_code = assignment.test.code
    score = 0
    details = {}
    answered_count = 0
    total_questions = 0
    scoring_error = None

    try:
        questions = db.query(Question).options(joinedload(Question.options)).filter(Question.test_id == assignment.test_id).all()
        total_questions = len(questions)

        if test_code == "DISC":
            details = score_disc(answers_to_score, questions)
            score = len({ans["question_id"] for ans in answers_to_score})
            answered_count = score
        elif test_code == "SPEED":
            details = score_speed(answers_to_score, questions)
            score = details["score"]
            answered_count = details.get("total_answered", len(answers_to_score))
        elif test_code == "TEMP":
            details = score_temperament(answers_to_score, questions)
            score = sum(details["raw_scores"].values()) if details["raw_scores"] else 0
            answered_count = len({ans["question_id"] for ans in answers_to_score})
        elif test_code == "MEM":
            details = score_memory(answers_to_score, questions)
            score = details["score"]
            answered_count = len(answers_to_score)
        elif test_code == "LOGIC":
            details = score_logic(answers_to_score, questions)
            score = details["score"]
            answered_count = len(answers_to_score)
        elif test_code == "LEAD":
            details = score_papi_kostick(answers_to_score, questions)
            score = len(answers_to_score)
            answered_count = len(answers_to_score)
        elif test_code == "CBI":
            details = score_cbi_test(answers_to_score, questions)
            score = details["score"]
            answered_count = len(answers_to_score)
        elif test_code == "IQ":
            details = score_iq(answers_to_score, questions)
            score = details["raw_score"]
            answered_count = len(answers_to_score)
        else:
            for ans in answers_to_score:
                opt = db.query(Option).filter(Option.id == ans.get("option_id")).first()
                if opt and opt.scoring_logic.get("correct"): score += 1
            answered_count = len(answers_to_score)
    except Exception as e:
        scoring_error = str(e)
        details["scoring_error"] = scoring_error
        answered_count = len({ans.get("question_id") for ans in answers_to_score})

    # Menggunakan helper naive WIB agar selaras dengan PostgreSQL `timestamp without time zone`
    completed_at = _get_now_wib_naive()
    started_at = _to_naive(assignment.started_at)

    is_complete = answered_count >= total_questions
    if details is None: details = {}
    details["session"] = {
        "device": device_info,
        "started_at": started_at.isoformat() if started_at else None,
        "completed_at": completed_at.isoformat(),
        "is_auto": is_auto
    }
    details.update({"answered_count": answered_count, "total_questions": total_questions, "is_complete": is_complete})

    # Hitung durasi waktu server (time_taken)
    server_time_taken = time_taken
    if started_at:
        server_time_taken = int((completed_at - started_at).total_seconds())
    server_time_taken = max(0, server_time_taken)

    result = Result(
        user_id=assignment.user_id,
        test_id=assignment.test_id,
        assignment_id=assignment.id,
        score=score,
        time_taken=server_time_taken,
        details=details,
        completed_at=completed_at
    )
    try:
        db.add(result)
        assignment.status = "completed"
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"CRITICAL: Failed to commit test submission for assignment {assignment.id}: {e}")
        raise e
    return {"score": score, "test_type": test_code}


@router.post("/assignments/{assignment_id}/submit")
def submit_test(
    assignment_id: int,
    submission: TestSubmission,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Submit test answers and get scored"""
    assignment = db.query(Assignment).with_for_update().filter(Assignment.id == assignment_id).first()
    if not assignment or assignment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if assignment.status != "in_progress":
        raise HTTPException(status_code=400, detail="Test is not in progress")
    
    if db.query(Result).filter(Result.assignment_id == assignment_id).first():
        raise HTTPException(status_code=400, detail="Already submitted")

    try:
        res = process_test_submission(assignment, db, submission_data=submission)
        return {"message": "Test submitted successfully", **res}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/assignments/{assignment_id}/lock")
def lock_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lock assignment due to security violation"""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment or assignment.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Assignment not found")
    assignment.status = "locked"
    db.commit()
    return {"message": "Assignment locked due to integrity violation"}


@router.post("/admin/assignments/{assignment_id}/unlock")
def unlock_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    assessor: User = Depends(require_assessor_or_higher)
):
    """Unlock an assignment (assessor or superadmin only)"""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    assignment.status = "in_progress"
    db.commit()
    return {"message": "Assignment unlocked"}


@router.post("/admin/assignments/{assignment_id}/reset")
def reset_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Reset an assignment - delete responses and results, reset status"""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    db.delete(assignment)
    db.commit()
    
    new_assignment = Assignment(
        user_id=assignment.user_id,
        test_id=assignment.test_id,
        status="pending",
        pretest_completed=False
    )
    db.add(new_assignment)
    db.commit()
    
    return {"message": "Assignment reset successfully"}


@router.post("/assignments/assign-all/{user_id}")
def assign_all_tests(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Assign all tests to a user"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    all_tests = db.query(Test).all()
    assigned_test_ids = {a.test_id for a in db.query(Assignment).filter(Assignment.user_id == user_id).all()}

    created = []
    for test in all_tests:
        if test.id not in assigned_test_ids:
            new_assignment = Assignment(user_id=user_id, test_id=test.id)
            db.add(new_assignment)
            created.append(test.name)

    db.commit()
    return {
        "message": f"Assigned {len(created)} tests",
        "assigned_tests": created
    }


@router.post("/assignments/{assignment_id}/exit-log")
def log_exit(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Log an exit event during test"""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment or assignment.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Assignment not found")
    log = ExitLog(user_id=current_user.id, assignment_id=assignment_id)
    db.add(log)
    db.commit()
    return {"message": "Exit logged"}


@router.post("/assignments/{assignment_id}/complete-tutorial")
def complete_tutorial(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark tutorial as completed for an assignment"""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment or assignment.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Assignment not found")
    assignment.pretest_completed = True
    db.commit()
    return {"message": "Tutorial marked as completed"}