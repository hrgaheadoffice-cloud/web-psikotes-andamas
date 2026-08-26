"""
Filter routes - Get distinct values for global filters in Result Analytics
Analytics routes - Get aggregated data for all charts in Result Analytics
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct, case, extract
from typing import Optional
from datetime import datetime

from auth import require_assessor_or_higher, get_current_user
from database import get_db
from models import User, Test, ExamSession, ClassConfig, Assignment
from .analytics import (
    get_education_case,
    BUSINESS_UNIT_MASTER_CATEGORIES,
    BUSINESS_UNIT_EMPTY_LABEL,
)

router = APIRouter(tags=["filters", "analytics"])

EDUCATION_MASTER_CATEGORIES = [
    "SD",
    "SMP",
    "SMA",
    "SMK",
    "Paket C",
    "D1",
    "D2",
    "D3",
    "D4/S1",
    "S2",
    "S3",
    "Profesi",
    "Lainnya",
]


def _build_age_ranges(min_age: int | None, max_age: int | None):
    if min_age is None or max_age is None:
        return ["18-20", "21-25", "26-30", "31-35", "36-40", "41-45", "46-50", "51-55", "56-60", "61+"]

    ranges = []
    start = max(18, int(min_age))
    end = int(max_age)

    bands = [(18, 20), (21, 25), (26, 30), (31, 35), (36, 40), (41, 45), (46, 50), (51, 55), (56, 60)]
    for low, high in bands:
        if high < start:
            continue
        if low > end:
            break
        ranges.append(f"{low}-{high}")

    if end >= 61:
        ranges.append("61+")

    return ranges or ["18-20", "21-25", "26-30", "31-35", "36-40", "41-45", "46-50", "51-55", "56-60", "61+"]


@router.get("/filters/options")
def get_filter_options(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_assessor_or_higher)
):
    """Get all distinct values for global filters in Result Analytics"""
    
    # Base query for participants
    participant_query = db.query(User).filter(User.role == 'participant')

    # Get distinct periods (Month Year from users.created_at for participants)
    # This is the correct source of truth for participant registration periods.
    periods_query = db.query(
        distinct(func.to_char(User.created_at, 'YYYY-MM')).label('period')
    ).filter(User.role == 'participant', User.created_at.isnot(None)).order_by(func.to_char(User.created_at, 'YYYY-MM').desc()).all()
    
    month_map = {
        "01": "Januari", "02": "Februari", "03": "Maret", "04": "April",
        "05": "Mei", "06": "Juni", "07": "Juli", "08": "Agustus",
        "09": "September", "10": "Oktober", "11": "November", "12": "Desember"
    }
    
    period_list = []
    for p in periods_query:
        if p.period and '-' in p.period:
            year, month = p.period.split('-', 1)
            month_name = month_map.get(month, '')
            if year and month_name:
                period_list.append(f"{month_name} {year}")

    # Get distinct sessions, classes, tests - these are not user-specific
    sessions = db.query(ExamSession.id, ExamSession.name).order_by(ExamSession.name).all()
    session_list = [{"id": s.id, "name": s.name} for s in sessions]
    
    classes = db.query(ClassConfig.id, ClassConfig.name).order_by(ClassConfig.name).all()
    class_list = [{"id": c.id, "name": c.name} for c in classes]
    
    tests = db.query(Test.id, Test.name, Test.code).order_by(Test.name).all()
    test_list = [{"id": t.id, "name": t.name, "code": t.code} for t in tests]
    
    # Get distinct values from participants only
    departments = participant_query.with_entities(distinct(User.department)).filter(User.department.isnot(None)).order_by(User.department).all()
    department_list = [d[0] for d in departments]
    
    positions = participant_query.with_entities(distinct(User.position)).filter(User.position.isnot(None)).order_by(User.position).all()
    position_list = [p[0] for p in positions]
    
    business_unit_list = list(BUSINESS_UNIT_MASTER_CATEGORIES)
    
    # Get and normalize distinct genders from participants
    gender_conditions = [
        (func.lower(User.gender).in_(['male', 'laki-laki', 'pria']), 'Laki-Laki'),
        (func.lower(User.gender).in_(['female', 'perempuan', 'wanita']), 'Perempuan')
    ]
    gender_case = case(*gender_conditions, else_=None)
    genders = participant_query.with_entities(gender_case).filter(gender_case.isnot(None)).distinct().all()
    gender_list = [g[0] for g in genders]
    
    # Get and group distinct educations from participants using the same
    # canonical buckets as the education analytics chart.
    education_list = list(EDUCATION_MASTER_CATEGORIES)

    participant_statuses = participant_query.with_entities(
        distinct(User.participant_status)
    ).filter(
        User.participant_status.isnot(None),
        func.trim(User.participant_status) != ""
    ).order_by(User.participant_status).all()
    participant_status_list = [item[0] for item in participant_statuses]
    
    # Get age range from participants
    min_age = participant_query.with_entities(func.min(User.age)).scalar()
    max_age = participant_query.with_entities(func.max(User.age)).scalar()
    age_list = [str(age) for age in range(int(min_age or 1), int(max_age or 60) + 1)]
    age_range_list = _build_age_ranges(min_age, max_age)
    
    return {
        "periods": period_list,
        "sessions": session_list,
        "classes": class_list,
        "tests": test_list,
        "departments": department_list,
        "positions": position_list,
        "business_units": business_unit_list,
        "genders": gender_list,
        "educations": education_list,
        "participant_statuses": participant_status_list,
        "ages": age_list,
        "age_ranges": age_range_list,
    }


@router.get("/analytics/overview")
def get_analytics_overview(
    period: Optional[str] = Query(None),
    session_id: Optional[int] = Query(None),
    class_id: Optional[int] = Query(None),
    test_id: Optional[int] = Query(None),
    department: Optional[str] = Query(None),
    position: Optional[str] = Query(None),
    business_unit: Optional[str] = Query(None),
    gender: Optional[str] = Query(None),
    education: Optional[str] = Query(None),
    participant_status: Optional[str] = Query(None),
    age: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_assessor_or_higher)
):
    """Get all aggregated data for analytics charts with filter support"""
    
    # Base query - always start with participants
    query = db.query(User).filter(User.role == 'participant')
    
    # Apply all filters
    if period:
        month_map_inv = {
            "Januari": 1, "Februari": 2, "Maret": 3, "April": 4,
            "Mei": 5, "Juni": 6, "Juli": 7, "Agustus": 8,
            "September": 9, "Oktober": 10, "November": 11, "Desember": 12
        }
        try:
            # Correctly parse "Month Year" format e.g. "Juli 2026"
            month_str, year_str = period.split()
            month = month_map_inv[month_str]
            year = int(year_str)
            
            # Filter by year and month of User.created_at
            query = query.filter(
                extract('year', User.created_at) == year,
                extract('month', User.created_at) == month
            )
        except (ValueError, KeyError):
            # If period format is incorrect, do not apply the filter.
            pass
    
    # Join with Assignment for session_id and test_id filtering if needed
    # This join should be outer to not exclude users without assignments
    if session_id or test_id:
        query = query.join(Assignment, User.id == Assignment.user_id, isouter=True)
        if session_id:
            query = query.filter(Assignment.session_id == session_id)
        if test_id:
            query = query.filter(Assignment.test_id == test_id)

    if class_id:
        query = query.filter(User.class_id == class_id)
    
    if department:
        query = query.filter(User.department == department)
    
    if position:
        query = query.filter(User.position == position)
    
    if business_unit:
        from .analytics import normalize_business_unit_name, _business_unit_mapping_case

        normalized_business_unit = normalize_business_unit_name(business_unit)
        if normalized_business_unit == BUSINESS_UNIT_EMPTY_LABEL:
            query = query.filter(func.coalesce(func.trim(User.business_unit), '') == '')
        else:
            mapped_business_unit = _business_unit_mapping_case(User.business_unit)
            query = query.filter(mapped_business_unit == normalized_business_unit)
    
    if gender:
        gender_lower = gender.lower()
        if gender_lower in ['laki-laki', 'pria', 'male']:
            query = query.filter(func.lower(User.gender).in_(['laki-laki', 'pria', 'male']))
        elif gender_lower in ['perempuan', 'wanita', 'female']:
            query = query.filter(func.lower(User.gender).in_(['perempuan', 'wanita', 'female']))

    if education:
        education_case = get_education_case()
        query = query.filter(education_case == education)

    if participant_status:
        query = query.filter(User.participant_status == participant_status)
    
    if age:
        query = query.filter(User.age == age)
    
    # Get a subquery of distinct user IDs that match the filters to avoid duplicates
    subquery = query.with_entities(User.id).distinct().subquery()

    # Base query for aggregations using the filtered user IDs
    filtered_query = db.query(User).filter(User.id.in_(subquery))

    # 1. Gender distribution
    gender_dist_query = filtered_query.with_entities(
        User.gender,
        func.count(User.id).label('count')
    ).filter(User.gender.isnot(None)).group_by(User.gender).all()
    
    gender_data = [{"label": g[0], "value": g[1]} for g in gender_dist_query]
    
    # 2. Age groups distribution
    age_groups_query = filtered_query.with_entities(
        case(
            (User.age.between(18, 20), '18-20'),
            (User.age.between(21, 25), '21-25'),
            (User.age.between(26, 30), '26-30'),
            (User.age.between(31, 35), '31-35'),
            (User.age >= 36, '36+'),
            else_='Lainnya'
        ).label('age_group'),
        func.count(User.id).label('count')
    ).filter(User.age.isnot(None)).group_by('age_group').order_by('age_group').all()
    
    age_data = [{"label": a[0], "value": a[1]} for a in age_groups_query]
    
    # 3. Education distribution
    education_case = get_education_case()
    education_dist_query = filtered_query.with_entities(
        education_case.label('education_group'),
        func.count(User.id).label('count')
    ).filter(User.education.isnot(None)).group_by('education_group').order_by('education_group').all()
    
    education_data = [{"label": e[0], "value": e[1]} for e in education_dist_query]
    
    # 4. Department distribution
    department_dist_query = filtered_query.with_entities(
        User.department,
        func.count(User.id).label('count')
    ).filter(User.department.isnot(None)).group_by(User.department).order_by(User.department).all()
    
    department_data = [{"label": d[0], "value": d[1]} for d in department_dist_query]
    
    # 5. Position distribution
    position_dist_query = filtered_query.with_entities(
        User.position,
        func.count(User.id).label('count')
    ).filter(User.position.isnot(None)).group_by(User.position).order_by(User.position).all()
    
    position_data = [{"label": p[0], "value": p[1]} for p in position_dist_query]
    
    # 6. Business Unit distribution
    bu_dist_query = filtered_query.with_entities(
        User.business_unit,
        func.count(User.id).label('count')
    ).filter(User.business_unit.isnot(None)).group_by(User.business_unit).order_by(User.business_unit).all()
    
    bu_data = [{"label": b[0], "value": b[1]} for b in bu_dist_query]
    
    return {
        "gender": gender_data,
        "age": age_data,
        "education": education_data,
        "department": department_data,
        "position": position_data,
        "business_unit": bu_data
    }
