# server/routes/summary.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import Optional
from database import get_db
from models import User, Assignment, ExamSession, Result, ClassConfig, Test
from auth import get_current_user
from datetime import datetime, timedelta

router = APIRouter(
    prefix="/summary",
    tags=["Summary"],
    responses={404: {"description": "Not found"}},
    dependencies=[Depends(get_current_user)],
)

def apply_summary_filters(query, filters, db: Session):
    # Base filter for all summary queries to only include participants
    query = query.filter(User.role == 'participant')

    if not filters:
        return query

    if any(f in filters for f in ["periode", "session", "test_id"]):
        query = query.join(Assignment, User.id == Assignment.user_id)
        if any(f in filters for f in ["periode", "session"]):
            query = query.join(ExamSession, Assignment.session_id == ExamSession.id)
    
    if filters.get("department"):
        query = query.filter(User.department == filters["department"])
    if filters.get("position"):
        query = query.filter(User.position == filters["position"])
    if filters.get("business_unit"):
        query = query.filter(User.business_unit == filters["business_unit"])
    if filters.get("gender"):
        query = query.filter(User.gender == filters["gender"])
    if filters.get("education"):
        query = query.filter(User.education == filters["education"])
    if filters.get("periode"):
        query = query.filter(func.extract('year', ExamSession.start_time) == filters["periode"])
    if filters.get("session"):
        query = query.filter(ExamSession.id == filters["session"])
    if filters.get("class_id"):
        query = query.join(ClassConfig, User.class_id == ClassConfig.id)
        query = query.filter(ClassConfig.id == filters["class_id"])
    if filters.get("test_id"):
        query = query.join(Test, Assignment.test_id == Test.id)
        query = query.filter(Test.id == filters["test_id"])
    if filters.get("age"):
        query = query.filter(User.age == filters["age"])
    if filters.get("search"):
        query = query.filter(User.full_name.ilike(f'%{filters["search"]}%'))
        
    return query

@router.get("/")
def get_executive_summary(
    db: Session = Depends(get_db),
    department: Optional[str] = Query(None),
    position: Optional[str] = Query(None),
    business_unit: Optional[str] = Query(None),
    gender: Optional[str] = Query(None),
    education: Optional[str] = Query(None),
    periode: Optional[int] = Query(None),
    session: Optional[int] = Query(None),
    class_id: Optional[int] = Query(None),
    test_id: Optional[int] = Query(None),
    age: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
):
    filters = {k: v for k, v in locals().items() if v is not None and k != 'db'}
    
    # 1. Total Peserta
    total_peserta_query = db.query(func.count(User.id))
    total_peserta_query = apply_summary_filters(total_peserta_query, filters, db)
    total_peserta = total_peserta_query.scalar()

    # 2. Average IQ
    avg_iq_query = db.query(func.avg(Result.score)).join(Assignment, Result.assignment_id == Assignment.id).join(User, Assignment.user_id == User.id)
    avg_iq_query = apply_summary_filters(avg_iq_query, filters, db)
    avg_iq = avg_iq_query.scalar()

    # 3. Completion Rate
    total_assignments_query = db.query(func.count(Assignment.id)).join(User, Assignment.user_id == User.id)
    total_assignments_query = apply_summary_filters(total_assignments_query, filters, db)
    total_assignments = total_assignments_query.scalar()

    completed_assignments_query = db.query(func.count(Assignment.id)).join(User, Assignment.user_id == User.id).filter(Assignment.status == 'completed')
    completed_assignments_query = apply_summary_filters(completed_assignments_query, filters, db)
    completed_assignments = completed_assignments_query.scalar()
    
    completion_rate = (completed_assignments / total_assignments * 100) if total_assignments > 0 else 0

    # 4. High Risk CBI
    high_risk_cbi_query = db.query(func.count(Result.id)).join(Assignment, Result.assignment_id == Assignment.id).join(User, Assignment.user_id == User.id).filter(Result.cbi_score > 80) # Assuming 80 is high risk
    high_risk_cbi_query = apply_summary_filters(high_risk_cbi_query, filters, db)
    high_risk_cbi = high_risk_cbi_query.scalar()

    # 5. Avg. Test Time
    avg_test_time_query = db.query(func.avg(func.julianday(Assignment.end_time) - func.julianday(Assignment.start_time)) * 24 * 60)
    avg_test_time_query = apply_summary_filters(avg_test_time_query.join(User, Assignment.user_id == User.id), filters, db)
    avg_test_time = avg_test_time_query.scalar()

    # 6. Active Today
    today = datetime.utcnow().date()
    active_today_query = db.query(func.count(Assignment.id)).join(User, Assignment.user_id == User.id).filter(func.date(Assignment.start_time) == today)
    active_today_query = apply_summary_filters(active_today_query, filters, db)
    active_today = active_today_query.scalar()

    return {
        "total_peserta": total_peserta,
        "average_iq": round(avg_iq, 2) if avg_iq else 0,
        "completion_rate": round(completion_rate, 2),
        "high_risk_cbi": high_risk_cbi,
        "avg_test_time": round(avg_test_time, 2) if avg_test_time else 0,
        "active_today": active_today,
    }