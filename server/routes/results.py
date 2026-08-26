"""
Results routes - Get results and export data
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import Optional, List
from datetime import datetime, date
import csv
import io

from auth import require_assessor_or_higher, get_current_user
from database import get_db
from models import User, Test, Assignment, Result, Question, ExitLog
from utils import get_max_score
# from services.pdf_report import generate_participant_pdf

router = APIRouter(tags=["results"])


@router.get("/results/")
def get_results(
    user_id: Optional[int] = None,
    test_id: Optional[int] = None,
    search: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: Session = Depends(get_db),
    assessor: User = Depends(require_assessor_or_higher)
):
    """Get results with filters (superadmin only)"""
    query = db.query(Result).options(joinedload(Result.assignment), joinedload(Result.test), joinedload(Result.user))

    if user_id is not None:
        query = query.filter(Result.user_id == user_id)
    if test_id is not None:
        query = query.filter(Result.test_id == test_id)
    if from_date is not None:
        query = query.filter(Result.completed_at >= from_date)
    if to_date is not None:
        query = query.filter(Result.completed_at <= to_date)
    if search:
        query = query.filter(
            (User.full_name.ilike(f"%{search}%")) | (User.username.ilike(f"%{search}%"))
        )

    results = query.all()
    output = []
    for r in results:
        total_questions = db.query(Question).filter(Question.test_id == r.test_id).count()
        max_score = get_max_score(r.test.code)

        exit_count = db.query(ExitLog).filter(ExitLog.assignment_id == r.assignment_id).count()

        output.append({
            "id": r.id,
            "user_id": r.user_id,
            "username": r.user.username,
            "full_name": r.user.full_name,
            "test_name": r.test.name,
            "test_code": r.test.code,
            "test_id": r.test_id,
            "assignment_id": r.assignment_id,
            "score": r.score,
            "total_questions": total_questions,
            "max_score": max_score,
            "time_taken": r.time_taken,
            "exit_count": exit_count,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            "started_at": r.assignment.started_at.isoformat() if r.assignment and r.assignment.started_at else None,
            "details": r.details
        })
    return output


@router.get("/admin/export/results")
def export_results(
    test_id: Optional[int] = None,
    search: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: Session = Depends(get_db),
    assessor: User = Depends(require_assessor_or_higher)
):
    """Export results as CSV (superadmin only)"""
    query = db.query(Result).join(User).join(Test)
    if test_id:
        query = query.filter(Result.test_id == test_id)
    if from_date:
        query = query.filter(Result.completed_at >= from_date)
    if to_date:
        query = query.filter(Result.completed_at <= to_date)
    if search:
        query = query.filter(
            (User.full_name.ilike(f"%{search}%")) | (User.username.ilike(f"%{search}%"))
        )

    results = query.order_by(Result.completed_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Participant Username", "Participant Name", "Test", "Score", "Max Score",
        "Percentage", "Time Taken (s)", "Completed At"
    ])

    for r in results:
        max_score = get_max_score(r.test.code)
        if max_score is None:
            max_score = db.query(Question).filter(Question.test_id == r.test_id).count()
        
        percentage = round((r.score / max_score * 100), 2) if isinstance(max_score, int) and max_score > 0 else "N/A"

        writer.writerow([
            r.user.username,
            r.user.full_name or "",
            r.test.name,
            r.score,
            max_score,
            percentage,
            r.time_taken,
            r.completed_at.strftime("%Y-%m-%d %H:%M") if r.completed_at else ""
        ])

    response = StreamingResponse(iter([output.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=results.csv"
    return response


@router.get("/admin/export/participant/{user_id}")
def export_participant_results(
    user_id: int,
    db: Session = Depends(get_db),
    assessor: User = Depends(require_assessor_or_higher)
):
    """Export single participant results as CSV (superadmin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get all results and deduplicate by test_id (keep latest per test)
    all_results = db.query(Result).filter(Result.user_id == user_id).all()
    
    # Deduplicate: keep only the latest result per test
    latest_results = {}
    for r in all_results:
        if r.test_id not in latest_results or (r.completed_at and latest_results[r.test_id].completed_at and r.completed_at > latest_results[r.test_id].completed_at):
            latest_results[r.test_id] = r
    
    results = list(latest_results.values())
    results.sort(key=lambda x: x.completed_at or datetime.min)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Test", "Score", "Max Score", "Percentage", "Time Taken (s)", "Completed At"
    ])

    for r in results:
        max_score = get_max_score(r.test.code)
        if max_score is None:
            max_score = db.query(Question).filter(Question.test_id == r.test_id).count()

        percentage = round((r.score / max_score * 100), 2) if isinstance(max_score, int) and max_score > 0 else "N/A"

        writer.writerow([
            r.test.name,
            r.score,
            max_score,
            percentage,
            r.time_taken,
            r.completed_at.strftime("%Y-%m-%d %H:%M") if r.completed_at else ""
        ])

    response = StreamingResponse(iter([output.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename={user.username}_results.csv"
    return response


from services.word_report import generate_participant_docx

@router.get("/admin/export/participant/{user_id}/docx")
def export_participant_docx(
    user_id: int,
    db: Session = Depends(get_db),
    assessor: User = Depends(require_assessor_or_higher)
):
    """Export single participant results as DOCX (superadmin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get all results and deduplicate by test_id (keep latest per test)
    all_results = db.query(Result).filter(Result.user_id == user_id).all()
    
    # Deduplicate: keep only the latest result per test
    latest_results = {}
    for r in all_results:
        if r.test_id not in latest_results or (r.completed_at and latest_results[r.test_id].completed_at and r.completed_at > latest_results[r.test_id].completed_at):
            latest_results[r.test_id] = r
    
    results = list(latest_results.values())

    docx_bytes = generate_participant_docx(user, results)

    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": f'attachment; filename="Laporan_Psikotes_{user.username or user.id}_{datetime.now().strftime("%Y%m%d")}.docx"'
        },
    )