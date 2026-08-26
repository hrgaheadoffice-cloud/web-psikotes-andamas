# server/routes/analytics.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case, extract, or_
from typing import Optional
import re
from difflib import SequenceMatcher
from database import get_db
from models import User, Assignment, ExamSession, ClassConfig, Test, Result
from auth import get_current_user

router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"],
    responses={404: {"description": "Not found"}},
    dependencies=[Depends(get_current_user)],
)

BUSINESS_UNIT_MASTER_CATEGORIES = [
    "PT. Long Daliq Primacoal - BP",
    "PT. Long Daliq Primacoal - SPGA",
    "PT. Long Daliq Primacoal - Head Office",
    "PT. Muncul Kilau Persada",
    "PT. Batubara Lahat",
    "PT. Batubara Lahat - Head Office",
    "PT. Andamas Global Energi",
    "PT. Andamas Global Energi - Head Office",
    "PT. Long Daliq Logistik",
    "PT. Andamas Propertindo",
    "PT. Bukit Artha Persada Arsy Nusantara - Site",
    "PT. Bukit Artha Persada Arsy Nusantara - Head Office",
    "Tidak Mengisi",
]

BUSINESS_UNIT_EMPTY_LABEL = "Tidak Mengisi"


def _normalize_business_unit_text(value: Optional[str]) -> str:
    if value is None:
        return ""

    text = str(value).strip()
    if not text:
        return ""

    text = text.replace("–", "-").replace("—", "-").replace("−", "-")
    text = text.replace("PT.", "PT")
    text = text.replace("PT", "PT")
    text = text.replace("headoffice", "head office")
    text = text.replace("ho", "head office")
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"\s*-\s*", "-", text)
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def normalize_business_unit_name(value: Optional[str]) -> str:
    if value is None:
        return BUSINESS_UNIT_EMPTY_LABEL

    text = str(value).strip()
    if not text:
        return BUSINESS_UNIT_EMPTY_LABEL

    normalized_value = _normalize_business_unit_text(text)
    if not normalized_value:
        return BUSINESS_UNIT_EMPTY_LABEL

    normalized_lookup = {
        _normalize_business_unit_text(master_name): master_name
        for master_name in BUSINESS_UNIT_MASTER_CATEGORIES
        if master_name != BUSINESS_UNIT_EMPTY_LABEL
    }

    if normalized_value in normalized_lookup:
        return normalized_lookup[normalized_value]

    for master_name in BUSINESS_UNIT_MASTER_CATEGORIES:
        if master_name == BUSINESS_UNIT_EMPTY_LABEL:
            continue
        normalized_master = _normalize_business_unit_text(master_name)
        if normalized_value == normalized_master:
            return master_name

    best_match = None
    best_score = 0.0
    for master_name in BUSINESS_UNIT_MASTER_CATEGORIES:
        if master_name == BUSINESS_UNIT_EMPTY_LABEL:
            continue
        normalized_master = _normalize_business_unit_text(master_name)
        score = SequenceMatcher(None, normalized_value, normalized_master).ratio()
        if score > best_score:
            best_score = score
            best_match = master_name

    if best_score >= 0.95 and best_match:
        return best_match

    return BUSINESS_UNIT_EMPTY_LABEL


def _normalize_business_unit_sql(column):
    normalized_column = func.lower(func.trim(column))
    normalized_column = func.replace(normalized_column, "–", "-")
    normalized_column = func.replace(normalized_column, "—", "-")
    normalized_column = func.replace(normalized_column, "−", "-")
    normalized_column = func.replace(normalized_column, ".", "")
    normalized_column = func.replace(normalized_column, "headoffice", "head office")
    normalized_column = func.replace(normalized_column, "ho", "head office")
    normalized_column = func.regexp_replace(normalized_column, r"\s+", " ")
    normalized_column = func.regexp_replace(normalized_column, r"\s*-\s*", "-")
    normalized_column = func.regexp_replace(normalized_column, r"[^a-z0-9]+", " ")
    normalized_column = func.regexp_replace(normalized_column, r"\s+", " ")
    return func.trim(normalized_column)


def _business_unit_mapping_case(column):
    normalized_column = _normalize_business_unit_sql(column)
    conditions = []
    for master_name in BUSINESS_UNIT_MASTER_CATEGORIES:
        if master_name == BUSINESS_UNIT_EMPTY_LABEL:
            continue
        conditions.append((normalized_column == _normalize_business_unit_text(master_name), master_name))
    conditions.append((normalized_column == "", BUSINESS_UNIT_EMPTY_LABEL))
    return case(*conditions, else_=BUSINESS_UNIT_EMPTY_LABEL)


def get_education_case():
    """
    Returns a SQLAlchemy case statement for normalizing education levels
    based on a comprehensive keyword matching logic.
    """
    education_col = func.coalesce(func.trim(func.lower(User.education)), '')

    # Define keyword mappings for each category.
    # The order of categories is important, from most specific to most general.
    conditions = [
        # Explicitly map empty/null/placeholder values to 'Lainnya' first
        (education_col.in_(['', '-', 'tidak mengisi', 'unknown', 'belum diisi', 'tidak ada', 'lainnya']), 'Lainnya'),
        
        # Profesi
        (education_col.ilike('%profesi%') | education_col.ilike('%professional engineer%') | education_col.ilike('%engineer professional programme%') | education_col.ilike('%insinyur%'), 'Profesi'),
        # S3
        (education_col.ilike('%s3%') | education_col.ilike('%doktor%') | education_col.ilike('%phd%'), 'S3'),
        # S2
        (education_col.ilike('%s2%') | education_col.ilike('%magister%') | education_col.ilike('%master%'), 'S2'),
        # D4/S1 - More specific rule
        (education_col.ilike('%d4%') | education_col.ilike('%s1%') | education_col.ilike('%sarjana%') | education_col.ilike('%bachelor%'), 'D4/S1'),
        # D3
        (education_col.ilike('%d3%') | education_col.ilike('%diploma iii%') | education_col.ilike('%diploma 3%'), 'D3'),
        # D2
        (education_col.ilike('%d2%') | education_col.ilike('%diploma ii%'), 'D2'),
        # D1
        (education_col.ilike('%d1%') | education_col.ilike('%diploma i%'), 'D1'),
        # Paket C
        (education_col.ilike('%paket c%'), 'Paket C'),
        # SMK
        (education_col.ilike('%smk%') | education_col.ilike('%smkn%') | education_col.ilike('%stm%') | education_col.ilike('%sekolah teknik menengah%'), 'SMK'),
        # SMA
        (education_col.ilike('%sma%') | education_col.ilike('%sman%') | education_col.ilike('%smu%') | education_col.ilike('%man%') | education_col.ilike('%madrasah aliyah%'), 'SMA'),
        # SMP
        (education_col.ilike('%smp%') | education_col.ilike('%smpn%') | education_col.ilike('%mts%') | education_col.ilike('%madrasah tsanawiyah%'), 'SMP'),
        # SD
        (education_col.ilike('%sd%') | education_col.ilike('%sekolah dasar%'), 'SD'),
    ]

    return case(*conditions, else_='Lainnya')


def _apply_age_filters(query, filters):
    if filters.get("age_min") is not None:
        query = query.filter(User.age >= filters["age_min"])
    if filters.get("age_max") is not None:
        query = query.filter(User.age <= filters["age_max"])
    if filters.get("age") is not None:
        query = query.filter(User.age == filters["age"])
    return query

def apply_filters(query, filters, db: Session):
    # Base filter for all analytics queries to only include participants
    query = query.filter(User.role == 'participant')

    if not filters:
        return query

    # Determine which tables need to be joined based on active filters
    # A period is the participant registration period.  It must never cause an
    # assignment/session join: results are scoped after the user set is built.
    needs_assignment = any(f in filters for f in ["session", "test_id"])
    needs_session = "session" in filters
    needs_test = "test_id" in filters
    needs_class = "class_id" in filters

    # Apply joins
    if needs_assignment:
        query = query.join(Assignment, User.id == Assignment.user_id)
    if needs_session:
        query = query.join(ExamSession, Assignment.session_id == ExamSession.id)
    if needs_test:
        query = query.join(Test, Assignment.test_id == Test.id)
    if needs_class:
        query = query.join(ClassConfig, User.class_id == ClassConfig.id)

    # Apply filters
    if filters.get("department"):
        query = query.filter(User.department == filters["department"])
    if filters.get("position"):
        query = query.filter(User.position == filters["position"])
    if filters.get("business_unit"):
        business_unit_filter = filters["business_unit"]
        normalized_filter = normalize_business_unit_name(business_unit_filter)
        if normalized_filter == BUSINESS_UNIT_EMPTY_LABEL:
            query = query.filter(
                func.coalesce(func.trim(User.business_unit), '') == ''
            )
        else:
            mapped_business_unit = _business_unit_mapping_case(User.business_unit)
            normalized_raw = func.lower(func.trim(User.business_unit))
            query = query.filter(or_(
                mapped_business_unit == normalized_filter,
                normalized_raw == func.lower(func.trim(business_unit_filter)),
            ))
    if filters.get("gender"):
        gender_conditions = [
            (func.lower(User.gender).in_(['male', 'laki-laki', 'pria']), 'Laki-Laki'),
            (func.lower(User.gender).in_(['female', 'perempuan', 'wanita']), 'Perempuan')
        ]
        gender_case = case(*gender_conditions, else_=None)
        query = query.filter(gender_case == filters["gender"])
    if filters.get("education"):
        education_case = get_education_case()
        query = query.filter(education_case == filters["education"])
    if filters.get("participant_status"):
        query = query.filter(User.participant_status == filters["participant_status"])
    if filters.get("periode"):
        month_map_inv = {
            "Januari": "01", "Februari": "02", "Maret": "03", "April": "04", "Mei": "05", "Juni": "06",
            "Juli": "07", "Agustus": "08", "September": "09", "Oktober": "10", "November": "11", "Desember": "12"
        }
        try:
            month_str, year_str = filters["periode"].split()
            month_num = month_map_inv[month_str]
            query = query.filter(
                extract('year', User.created_at) == int(year_str),
                extract('month', User.created_at) == int(month_num),
            )
        except (ValueError, KeyError):
            pass  # Ignore invalid period format
    if filters.get("session"):
        query = query.filter(ExamSession.id == filters["session"])
    if filters.get("class_id"):
        query = query.filter(ClassConfig.id == filters["class_id"])
    if filters.get("test_id"):
        query = query.filter(Test.id == filters["test_id"])
    if filters.get("age"):
        query = query.filter(User.age == filters["age"])
    if filters.get("search"):
        query = query.filter(User.full_name.ilike(f'%{filters["search"]}%'))

    query = _apply_age_filters(query, filters)
        
    return query

@router.get("/overview/gender")
def get_gender_distribution(
    db: Session = Depends(get_db),
    department: Optional[str] = Query(None),
    position: Optional[str] = Query(None),
    business_unit: Optional[str] = Query(None),
    gender: Optional[str] = Query(None),
    education: Optional[str] = Query(None),
    participant_status: Optional[str] = Query(None),
    periode: Optional[str] = Query(None),
    session: Optional[int] = Query(None),
    class_id: Optional[int] = Query(None),
    test_id: Optional[int] = Query(None),
    age: Optional[int] = Query(None),
    age_min: Optional[int] = Query(None),
    age_max: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
):
    """
    Provides the gender distribution of users with normalized categories.
    """
    gender_col = func.coalesce(func.trim(func.lower(User.gender)), '')
    
    gender_conditions = [
        (gender_col.in_(['male', 'laki-laki', 'pria']), 'Laki-Laki'),
        (gender_col.in_(['female', 'perempuan', 'wanita']), 'Perempuan')
    ]
    gender_case = case(*gender_conditions, else_='Tidak Mengisi').label("gender_group")

    query = db.query(
        gender_case,
        func.count(User.id).label("count")
    ).select_from(User)

    filters = {
        "department": department, "position": position, "business_unit": business_unit,
        "gender": gender, "education": education, "participant_status": participant_status, "periode": periode, "session": session,
        "class_id": class_id, "test_id": test_id, "age": age, "age_min": age_min, "age_max": age_max, "search": search,
    }
    query = apply_filters(query, {k: v for k, v in filters.items() if v is not None}, db)
    
    gender_data = query.group_by("gender_group").all()
    
    total_users = sum(count for _, count in gender_data)

    return [
        {
            "name": g, 
            "value": count,
            "percentage": round((count / total_users) * 100, 2) if total_users > 0 else 0
        }
        for g, count in gender_data
    ]

@router.get("/overview/age")
def get_age_distribution(
    db: Session = Depends(get_db),
    department: Optional[str] = Query(None),
    position: Optional[str] = Query(None),
    business_unit: Optional[str] = Query(None),
    gender: Optional[str] = Query(None),
    education: Optional[str] = Query(None),
    participant_status: Optional[str] = Query(None),
    periode: Optional[str] = Query(None),
    session: Optional[int] = Query(None),
    class_id: Optional[int] = Query(None),
    test_id: Optional[int] = Query(None),
    age: Optional[int] = Query(None),
    age_min: Optional[int] = Query(None),
    age_max: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
):
    """
    Provides the age distribution of users, grouped into predefined buckets
    with a 'Tidak Mengisi' category for invalid or out-of-range ages.
    """
    age_groups = [
        ("18–20", (User.age >= 18) & (User.age <= 20)),
        ("21–25", (User.age >= 21) & (User.age <= 25)),
        ("26–30", (User.age >= 26) & (User.age <= 30)),
        ("31–35", (User.age >= 31) & (User.age <= 35)),
        ("36–40", (User.age >= 36) & (User.age <= 40)),
        ("41–45", (User.age >= 41) & (User.age <= 45)),
        ("46–50", (User.age >= 46) & (User.age <= 50)),
        ("51+", User.age >= 51),
    ]

    age_group_conditions = [(condition, label) for label, condition in age_groups]
    query = db.query(
        case(*age_group_conditions, else_="Tidak Mengisi").label("age_group"),
        func.count(User.id).label("count")
    )
    
    filters = {
        "department": department, "position": position, "business_unit": business_unit,
        "gender": gender, "education": education, "participant_status": participant_status, "periode": periode, "session": session,
        "class_id": class_id, "test_id": test_id, "age": age, "age_min": age_min, "age_max": age_max, "search": search,
    }
    query = apply_filters(query, {k: v for k, v in filters.items() if v is not None}, db)
    
    age_data = query.group_by("age_group").all()
    
    # Ensure all categories are present and in the correct order
    ordered_labels = [label for label, _ in age_groups] + ["Tidak Mengisi"]
    results_map = {group: count for group, count in age_data}
    
    return [
        {"name": label, "value": results_map.get(label, 0)}
        for label in ordered_labels
    ]

@router.get("/overview/education")
def get_education_distribution(
    db: Session = Depends(get_db),
    department: Optional[str] = Query(None),
    position: Optional[str] = Query(None),
    business_unit: Optional[str] = Query(None),
    gender: Optional[str] = Query(None),
    education: Optional[str] = Query(None),
    participant_status: Optional[str] = Query(None),
    periode: Optional[str] = Query(None),
    session: Optional[int] = Query(None),
    class_id: Optional[int] = Query(None),
    test_id: Optional[int] = Query(None),
    age: Optional[int] = Query(None),
    age_min: Optional[int] = Query(None),
    age_max: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
):
    """
    Provides the education level distribution of users with a fixed order.
    """
    education_case = get_education_case().label("education_group")

    query = db.query(
        education_case,
        func.count(User.id).label("count")
    )
    
    filters = {
        "department": department, "position": position, "business_unit": business_unit,
        "gender": gender, "education": education, "participant_status": participant_status, "periode": periode, "session": session,
        "class_id": class_id, "test_id": test_id, "age": age, "age_min": age_min, "age_max": age_max, "search": search,
    }
    
    query = apply_filters(query, {k: v for k, v in filters.items() if v is not None}, db)
    
    education_data = query.group_by("education_group").all()
    
    # Define the mandatory order for education levels
    ordered_labels = [
        "SD", "SMP", "SMA", "SMK", "Paket C", "D1", "D2", "D3", 
        "D4/S1", "S2", "S3", "Profesi", "Lainnya"
    ]
    
    results_map = {group: count for group, count in education_data if group in ordered_labels}
    
    return [
        {"name": label, "value": results_map.get(label, 0)}
        for label in ordered_labels
    ]

@router.get("/overview/department")
def get_department_distribution(
    db: Session = Depends(get_db),
    department: Optional[str] = Query(None),
    position: Optional[str] = Query(None),
    business_unit: Optional[str] = Query(None),
    gender: Optional[str] = Query(None),
    education: Optional[str] = Query(None),
    participant_status: Optional[str] = Query(None),
    periode: Optional[str] = Query(None),
    session: Optional[int] = Query(None),
    class_id: Optional[int] = Query(None),
    test_id: Optional[int] = Query(None),
    age: Optional[int] = Query(None),
    age_min: Optional[int] = Query(None),
    age_max: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
):
    """Provides the top department distribution for participants."""
    query = db.query(
        User.department,
        func.count(User.id).label("count")
    ).select_from(User)

    filters = {
        "department": department,
        "position": position,
        "business_unit": business_unit,
        "gender": gender,
        "education": education,
        "participant_status": participant_status,
        "periode": periode,
        "session": session,
        "class_id": class_id,
        "test_id": test_id,
        "age": age,
        "age_min": age_min,
        "age_max": age_max,
        "search": search,
    }
    query = apply_filters(query, {k: v for k, v in filters.items() if v is not None}, db)
    query = query.filter(User.department.isnot(None), func.trim(User.department) != "")

    department_data = (
        query.group_by(User.department)
        .order_by(func.count(User.id).desc())
        .limit(10)
        .all()
    )
    return [{"name": department_name, "value": count} for department_name, count in department_data]

@router.get("/overview/position")
def get_position_distribution(
    db: Session = Depends(get_db),
    department: Optional[str] = Query(None),
    position: Optional[str] = Query(None),
    business_unit: Optional[str] = Query(None),
    gender: Optional[str] = Query(None),
    education: Optional[str] = Query(None),
    participant_status: Optional[str] = Query(None),
    periode: Optional[str] = Query(None),
    session: Optional[int] = Query(None),
    class_id: Optional[int] = Query(None),
    test_id: Optional[int] = Query(None),
    age: Optional[int] = Query(None),
    age_min: Optional[int] = Query(None),
    age_max: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
):
    """
    Provides the position distribution of users.
    """
    query = db.query(
        User.position,
        func.count(User.id).label("count")
    )

    filters = {
        "department": department,
        "position": position,
        "business_unit": business_unit,
        "gender": gender,
        "education": education,
        "participant_status": participant_status,
        "periode": periode,
        "session": session,
        "class_id": class_id,
        "test_id": test_id,
        "age": age,
        "age_min": age_min,
        "age_max": age_max,
        "search": search,
    }
    query = apply_filters(query, {k: v for k, v in filters.items() if v is not None}, db)

    position_data = query.group_by(User.position).order_by(func.count(User.id).desc()).all()
    return [{"name": p, "value": count} for p, count in position_data if p is not None]

@router.get("/overview/business_unit")
def get_business_unit_distribution(
    db: Session = Depends(get_db),
    department: Optional[str] = Query(None),
    position: Optional[str] = Query(None),
    business_unit: Optional[str] = Query(None),
    gender: Optional[str] = Query(None),
    education: Optional[str] = Query(None),
    participant_status: Optional[str] = Query(None),
    periode: Optional[str] = Query(None),
    session: Optional[int] = Query(None),
    class_id: Optional[int] = Query(None),
    test_id: Optional[int] = Query(None),
    age: Optional[int] = Query(None),
    age_min: Optional[int] = Query(None),
    age_max: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
):
    """
    Provides the business unit distribution of users.
    """
    query = db.query(
        User.business_unit,
        func.count(User.id).label("count")
    )

    filters = {
        "department": department,
        "position": position,
        "business_unit": business_unit,
        "gender": gender,
        "education": education,
        "participant_status": participant_status,
        "periode": periode,
        "session": session,
        "class_id": class_id,
        "test_id": test_id,
        "age": age,
        "age_min": age_min,
        "age_max": age_max,
        "search": search,
    }
    query = apply_filters(query, {k: v for k, v in filters.items() if v is not None}, db)

    business_unit_data = query.group_by(User.business_unit).order_by(func.count(User.id).desc()).all()

    category_counts = {name: 0 for name in BUSINESS_UNIT_MASTER_CATEGORIES}
    total_participants = 0
    for business_unit_value, count in business_unit_data:
        normalized_name = normalize_business_unit_name(business_unit_value)
        if normalized_name in category_counts:
            category_counts[normalized_name] += count
        else:
            category_counts[BUSINESS_UNIT_EMPTY_LABEL] += count
        total_participants += count

    distribution = []
    for name in BUSINESS_UNIT_MASTER_CATEGORIES:
        value = category_counts.get(name, 0)
        percentage = round((value / total_participants * 100) if total_participants else 0.0, 2)
        distribution.append({"name": name, "value": value, "percentage": percentage})

    return distribution


@router.get("/overview/participant_status")
def get_participant_status_distribution(
    db: Session = Depends(get_db),
    department: Optional[str] = Query(None),
    position: Optional[str] = Query(None),
    business_unit: Optional[str] = Query(None),
    gender: Optional[str] = Query(None),
    education: Optional[str] = Query(None),
    participant_status: Optional[str] = Query(None),
    periode: Optional[str] = Query(None),
    session: Optional[int] = Query(None),
    class_id: Optional[int] = Query(None),
    test_id: Optional[int] = Query(None),
    age: Optional[int] = Query(None),
    age_min: Optional[int] = Query(None),
    age_max: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
):
    statuses = [
        "Recruitment Process",
        "Promotion Process",
        "Development Process",
        "Mutasi / Rotasi Internal",
        "Job Fit Re-Assessment",
        "Talent Mapping",
        "Internship Assessment",
        "Re-Test / Validating Check",
        "Tidak Mengisi",
    ]
    query = db.query(
        case(
            (User.participant_status.is_(None), "Tidak Mengisi"),
            (func.trim(User.participant_status) == "", "Tidak Mengisi"),
            else_=User.participant_status,
        ).label("participant_status_group"),
        func.count(User.id).label("count"),
    ).select_from(User)
    filters = {
        "department": department,
        "position": position,
        "business_unit": business_unit,
        "gender": gender,
        "education": education,
        "participant_status": participant_status,
        "periode": periode,
        "session": session,
        "class_id": class_id,
        "test_id": test_id,
        "age": age,
        "age_min": age_min,
        "age_max": age_max,
        "search": search,
    }
    query = apply_filters(query, {k: v for k, v in filters.items() if v is not None}, db)
    rows = query.group_by("participant_status_group").all()
    counts = {name: 0 for name in statuses}
    for name, count in rows:
        if name in counts:
            counts[name] += count
    total = sum(counts.values())
    return [
        {"name": name, "value": counts[name], "percentage": round((counts[name] / total) * 100, 2) if total else 0}
        for name in statuses
    ]


@router.get("/overview/location_distribution")
def get_location_distribution(
    db: Session = Depends(get_db),
    department: Optional[str] = Query(None),
    position: Optional[str] = Query(None),
    business_unit: Optional[str] = Query(None),
    gender: Optional[str] = Query(None),
    education: Optional[str] = Query(None),
    participant_status: Optional[str] = Query(None),
    periode: Optional[str] = Query(None),
    session: Optional[int] = Query(None),
    class_id: Optional[int] = Query(None),
    test_id: Optional[int] = Query(None),
    age: Optional[int] = Query(None),
    age_min: Optional[int] = Query(None),
    age_max: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
):
    return get_business_unit_distribution(
        db=db,
        department=department,
        position=position,
        business_unit=business_unit,
        gender=gender,
        education=education,
        participant_status=participant_status,
        periode=periode,
        session=session,
        class_id=class_id,
        test_id=test_id,
        age=age,
        age_min=age_min,
        age_max=age_max,
        search=search,
    )
def _personality_results(db: Session, test_id: int, filters: dict):
    query = db.query(Result).join(User, Result.user_id == User.id)
    query = apply_filters(query, {k: v for k, v in filters.items() if v is not None}, db)
    return query.filter(Result.test_id == test_id, Result.details.isnot(None)).all()


def _personality_filters(
    department=None, position=None, business_unit=None, gender=None,
    education=None, participant_status=None, periode=None, session=None, class_id=None,
    test_id=None, age=None, age_min=None, age_max=None, search=None,
):
    return {
        "department": department, "position": position,
        "business_unit": business_unit, "gender": gender,
        "education": education, "participant_status": participant_status, "periode": periode, "session": session,
        "class_id": class_id, "test_id": test_id, "age": age, "age_min": age_min, "age_max": age_max,
        "search": search,
    }


def _personality_query_params(
    db: Session, fixed_test_id: int, department=None, position=None,
    business_unit=None, gender=None, education=None, participant_status=None, periode=None,
    session=None, class_id=None, test_id=None, age=None, age_min=None, age_max=None, search=None,
):
    return _personality_results(
        db, fixed_test_id,
        _personality_filters(
            department, position, business_unit, gender, education, participant_status,
            periode, session, class_id, test_id, age, age_min, age_max, search,
        ),
    )


def _distribution_response(rows, extractor, names):
    counts = {name: 0 for name in names}
    for row in rows:
        value = extractor(row.details or {})
        if value in counts:
            counts[value] += 1
    return {
        "total": sum(counts.values()),
        "distribution": [{"name": name, "value": counts[name]} for name in names],
    }


@router.get("/personality/disc")
def get_personality_disc(
    db: Session = Depends(get_db),
    department: Optional[str] = Query(None), position: Optional[str] = Query(None),
    business_unit: Optional[str] = Query(None), gender: Optional[str] = Query(None),
    education: Optional[str] = Query(None), participant_status: Optional[str] = Query(None), periode: Optional[str] = Query(None),
    session: Optional[int] = Query(None), class_id: Optional[int] = Query(None),
    test_id: Optional[int] = Query(None), age: Optional[int] = Query(None),
    age_min: Optional[int] = Query(None), age_max: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
):
    rows = _personality_query_params(
        db, 1, department, position, business_unit, gender, education,
        participant_status, periode, session, class_id, test_id, age, age_min, age_max, search,
    )
    return _distribution_response(
        rows,
        lambda details: max(details.get("graph_iii", {}), key=details.get("graph_iii", {}).get)
        if details.get("graph_iii") else None,
        ["D", "I", "S", "C"],
    )


@router.get("/personality/temperament")
def get_personality_temperament(
    db: Session = Depends(get_db),
    department: Optional[str] = Query(None), position: Optional[str] = Query(None),
    business_unit: Optional[str] = Query(None), gender: Optional[str] = Query(None),
    education: Optional[str] = Query(None), participant_status: Optional[str] = Query(None), periode: Optional[str] = Query(None),
    session: Optional[int] = Query(None), class_id: Optional[int] = Query(None),
    test_id: Optional[int] = Query(None), age: Optional[int] = Query(None),
    age_min: Optional[int] = Query(None), age_max: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
):
    rows = _personality_query_params(
        db, 3, department, position, business_unit, gender, education,
        participant_status, periode, session, class_id, test_id, age, age_min, age_max, search,
    )
    return _distribution_response(
        rows, lambda details: details.get("primary"),
        ["Sanguine", "Melancholic", "Choleric", "Phlegmatic"],
    )


def _unique_result_rows(rows):
    latest_by_user = {}
    for row in rows:
        current = latest_by_user.get(row.user_id)
        if current is None or (row.completed_at and (
            current.completed_at is None or row.completed_at > current.completed_at
        )):
            latest_by_user[row.user_id] = row
    return list(latest_by_user.values())


def _parse_iq_range(value):
    if not isinstance(value, str):
        return None
    text = value.strip().replace("â€“", "-").replace("â€”", "-").replace("–", "-")
    if not text:
        return None
    if text.startswith("<"):
        match = re.fullmatch(r"<\s*(\d+)", text)
        return (None, int(match.group(1))) if match else None
    if text.endswith("+"):
        match = re.fullmatch(r"(\d+)\s*\+", text)
        return (int(match.group(1)), None) if match else None
    match = re.fullmatch(r"\s*(\d+)\s*[^0-9]+\s*(\d+)\s*", text)
    return (int(match.group(1)), int(match.group(2))) if match else None


def _iq_bucket_match(parsed, bucket):
    _, lower, upper = bucket
    low, high = parsed
    if lower is None:
        if upper is None:
            return False
        if low is None and high is None:
            return False
        if high is None:
            return low <= upper
        if low is None:
            return high <= upper
        return high <= upper
    if upper is None:
        if low is None:
            return False
        return low >= lower
    if low is None and high is not None:
        return high >= lower and high <= upper
    if low is not None and high is None:
        return low >= lower and low <= upper
    if low is None or high is None:
        return False
    return low >= lower and high <= upper


def _iq_range_midpoint(parsed):
    if not isinstance(parsed, tuple) or len(parsed) != 2:
        return None
    low, high = parsed
    if low is None and high is None:
        return None
    if low is None:
        return float(high)
    if high is None:
        return float(low)
    return (float(low) + float(high)) / 2


def _range_distribution(rows, field, buckets):
    counts = {name: 0 for name, _, _ in buckets}
    numeric_values = []
    for row in _unique_result_rows(rows):
        details = row.details if isinstance(row.details, dict) else {}
        value = details.get(field)
        parsed = _parse_iq_range(value) if field == "est_iq" else None
        if field == "iq":
            try:
                parsed = int(value)
            except (TypeError, ValueError):
                parsed = None
            if parsed is not None:
                numeric_values.append(parsed)
        if parsed is None:
            continue
        name = None
        if field == "est_iq":
            for bucket_name, lower, upper in buckets:
                if _iq_bucket_match(parsed, (bucket_name, lower, upper)):
                    name = bucket_name
                    break
        else:
            for bucket_name, lower, upper in buckets:
                if (upper is None and parsed >= lower) or (
                    upper is not None and lower <= parsed <= upper
                ):
                    name = bucket_name
                    break
        if name is not None:
            counts[name] += 1
    return {
        "average": round(sum(numeric_values) / len(numeric_values)) if numeric_values else None,
        "distribution": [{"name": name, "value": counts[name]} for name, _, _ in buckets],
    }

@router.get("/personality/iq-cfit")
def get_personality_iq_cfit(
    db: Session = Depends(get_db),
    department: Optional[str] = Query(None), position: Optional[str] = Query(None),
    business_unit: Optional[str] = Query(None), gender: Optional[str] = Query(None),
    education: Optional[str] = Query(None), participant_status: Optional[str] = Query(None), periode: Optional[str] = Query(None),
    session: Optional[int] = Query(None), class_id: Optional[int] = Query(None),
    test_id: Optional[int] = Query(None), age: Optional[int] = Query(None),
    age_min: Optional[int] = Query(None), age_max: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
):
    return _range_distribution(_personality_query_params(
        db, 5, department, position, business_unit, gender, education,
        participant_status, periode, session, class_id, test_id, age, age_min, age_max, search,
    ), "est_iq", [("<70", None, 70), ("71-79", 71, 79), ("80-84", 80, 84), ("85-94", 85, 94), ("95-105", 95, 105), ("106-115", 106, 115), ("116-130", 116, 130), ("131-140", 131, 140), ("141-150", 141, 150)])


@router.get("/personality/iq-wpt")
def get_personality_iq_wpt(
    db: Session = Depends(get_db),
    department: Optional[str] = Query(None), position: Optional[str] = Query(None),
    business_unit: Optional[str] = Query(None), gender: Optional[str] = Query(None),
    education: Optional[str] = Query(None), participant_status: Optional[str] = Query(None), periode: Optional[str] = Query(None),
    session: Optional[int] = Query(None), class_id: Optional[int] = Query(None),
    test_id: Optional[int] = Query(None), age: Optional[int] = Query(None),
    age_min: Optional[int] = Query(None), age_max: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
):
    return _range_distribution(_personality_query_params(
        db, 7, department, position, business_unit, gender, education,
        participant_status, periode, session, class_id, test_id, age, age_min, age_max, search,
    ), "iq", [("<70", 0, 69), ("70-79", 70, 79), ("80-89", 80, 89), ("90-99", 90, 99), ("100-109", 100, 109), ("110-119", 110, 119), ("120+", 120, None)])
def _recruitment_rows(db: Session, test_id: int, filters: dict):
    return _unique_result_rows(_personality_results(db, test_id, filters))


def _recruitment_filter_values(
    department=None, position=None, business_unit=None, gender=None,
    education=None, participant_status=None, periode=None, session=None, class_id=None, age=None, age_min=None, age_max=None, search=None,
):
    return _personality_filters(
        department, position, business_unit, gender, education,
        participant_status, periode, session, class_id, None, age, age_min, age_max, search,
    )


def _recruitment_params(
    db, test_id, department, position, business_unit, gender,
    education, participant_status, periode, session, class_id, age, age_min, age_max, search,
):
    return _recruitment_rows(
        db, test_id,
        _recruitment_filter_values(
            department, position, business_unit, gender, education, participant_status,
            periode, session, class_id, age, age_min, age_max, search,
        ),
    )


ASSESSMENT_TESTS = [
    (1, "DISC Test", "DISC"),
    (2, "Speed Test", "SPEED"),
    (3, "Temperament Test", "TEMP"),
    (4, "Memory Test", "MEM"),
    (5, "Test IQ (Aritmatika & Logika)", "LOGIC"),
    (6, "Test Kepemimpinan", "LEAD"),
    (7, "Test IQ (POLA)", "IQ"),
    (8, "CBI Test", "CBI"),
]


def _assessment_filter_params(
    department=None, position=None, business_unit=None, gender=None,
    education=None, participant_status=None, periode=None, session=None, class_id=None,
    test_id=None, age=None, age_min=None, age_max=None, search=None,
):
    return {
        "department": department, "position": position,
        "business_unit": business_unit, "gender": gender,
        "education": education, "participant_status": participant_status, "periode": periode, "session": session,
        "class_id": class_id, "test_id": test_id, "age": age, "age_min": age_min, "age_max": age_max,
        "search": search,
    }


@router.get("/assessment-overview")
def get_assessment_overview(
    db: Session = Depends(get_db),
    department: Optional[str] = Query(None), position: Optional[str] = Query(None),
    business_unit: Optional[str] = Query(None), gender: Optional[str] = Query(None),
    education: Optional[str] = Query(None), participant_status: Optional[str] = Query(None), periode: Optional[str] = Query(None),
    session: Optional[int] = Query(None), class_id: Optional[int] = Query(None),
    test_id: Optional[int] = Query(None), age: Optional[int] = Query(None),
    age_min: Optional[int] = Query(None), age_max: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
):
    filters = _assessment_filter_params(
        department, position, business_unit, gender, education, participant_status, periode,
        session, class_id, test_id, age, age_min, age_max, search,
    )
    participant_query = apply_filters(
        db.query(User.id),
        {key: value for key, value in filters.items() if value is not None},
        db,
    )
    participant_ids = {user_id for (user_id,) in participant_query.distinct().all()}

    rows = []
    for current_test_id, name, code in ASSESSMENT_TESTS:
        completed = 0
        if participant_ids:
            completed = db.query(Assignment.id).filter(
                Assignment.user_id.in_(participant_ids),
                Assignment.test_id == current_test_id,
                Assignment.status == "completed",
            ).count()
        completion = round(completed / len(participant_ids) * 100, 1) if participant_ids else 0
        rows.append({
            "name": name, "code": code, "participants": len(participant_ids),
            "completed": completed, "completion": completion,
        })
    return rows


MONTH_NAMES = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]


@router.get("/participant-growth-years")
def get_participant_growth_years(
    participant_status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(
        extract("year", User.created_at).label("year")
    ).filter(
        User.role == "participant",
        User.created_at.isnot(None),
    )
    if participant_status:
        query = query.filter(User.participant_status == participant_status)
    return [year for (year,) in query.distinct().order_by(extract("year", User.created_at).desc()).all()]


@router.get("/participant-growth")
def get_participant_growth(
    year: Optional[int] = Query(None),
    participant_status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    latest_year = db.query(func.max(extract("year", User.created_at))).filter(
        User.role == "participant", User.created_at.isnot(None)
    ).scalar()
    selected_year = year or (int(latest_year) if latest_year is not None else None)
    counts = {month: 0 for month in range(1, 13)}
    if selected_year is not None:
        query = db.query(
            extract("month", User.created_at).label("month"),
            func.count(User.id),
        ).filter(
            User.role == "participant",
            User.created_at.isnot(None),
            extract("year", User.created_at) == selected_year,
        )
        if participant_status:
            query = query.filter(User.participant_status == participant_status)
        rows = query.group_by("month").all()
        counts.update({int(month): count for month, count in rows})
    return [
        {"month": month, "name": MONTH_NAMES[month - 1], "value": counts[month]}
        for month in range(1, 13)
    ]



@router.get("/recruitment/speed")
def get_recruitment_speed(
    db: Session = Depends(get_db),
    department: Optional[str] = Query(None), position: Optional[str] = Query(None),
    business_unit: Optional[str] = Query(None), gender: Optional[str] = Query(None),
    education: Optional[str] = Query(None), participant_status: Optional[str] = Query(None), periode: Optional[str] = Query(None),
    session: Optional[int] = Query(None), class_id: Optional[int] = Query(None),
    age: Optional[int] = Query(None), age_min: Optional[int] = Query(None), age_max: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
):
    rows = _recruitment_params(
        db, 2, department, position, business_unit, gender, education,
        participant_status, periode, session, class_id, age, age_min, age_max, search,
    )
    bands = {}
    scores = []
    for row in rows:
        details = row.details if isinstance(row.details, dict) else {}
        band = details.get("band")
        score = details.get("score")
        if isinstance(band, str) and band.strip():
            bands[band.strip()] = bands.get(band.strip(), 0) + 1
        try:
            scores.append(float(score))
        except (TypeError, ValueError):
            pass
    return {
        "total": len(rows),
        "average_score": round(sum(scores) / len(scores), 2) if scores else None,
        "distribution": [{"name": name, "value": value} for name, value in bands.items()],
    }


@router.get("/recruitment/memory")
def get_recruitment_memory(
    db: Session = Depends(get_db),
    department: Optional[str] = Query(None), position: Optional[str] = Query(None),
    business_unit: Optional[str] = Query(None), gender: Optional[str] = Query(None),
    education: Optional[str] = Query(None), participant_status: Optional[str] = Query(None), periode: Optional[str] = Query(None),
    session: Optional[int] = Query(None), class_id: Optional[int] = Query(None),
    age: Optional[int] = Query(None), age_min: Optional[int] = Query(None), age_max: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
):
    rows = _recruitment_params(
        db, 4, department, position, business_unit, gender, education,
        participant_status, periode, session, class_id, age, age_min, age_max, search,
    )
    bands = {}
    for row in rows:
        details = row.details if isinstance(row.details, dict) else {}
        band = details.get("band")
        if isinstance(band, str) and band.strip():
            bands[band.strip()] = bands.get(band.strip(), 0) + 1
    return {
        "total": len(rows),
        "distribution": [{"name": name, "value": value} for name, value in bands.items()],
    }


@router.get("/recruitment/cbi")
def get_recruitment_cbi(
    db: Session = Depends(get_db),
    department: Optional[str] = Query(None), position: Optional[str] = Query(None),
    business_unit: Optional[str] = Query(None), gender: Optional[str] = Query(None),
    education: Optional[str] = Query(None), participant_status: Optional[str] = Query(None), periode: Optional[str] = Query(None),
    session: Optional[int] = Query(None), class_id: Optional[int] = Query(None),
    age: Optional[int] = Query(None), age_min: Optional[int] = Query(None), age_max: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
):
    dimensions = [
        "Dependability",
        "Aggression",
        "Substance Abuse",
        "Honesty",
        "Computer Abuse",
        "Sexual Harassment",
        "Good Impression",
    ]
    levels = {dimension: {} for dimension in dimensions}
    rows = _recruitment_params(
        db, 8, department, position, business_unit, gender, education,
        participant_status, periode, session, class_id, age, age_min, age_max, search,
    )
    for row in rows:
        details = row.details if isinstance(row.details, dict) else {}
        concerns = details.get("primary_concerns")
        if isinstance(concerns, dict):
            for dimension in dimensions[:-1]:
                concern = concerns.get(dimension)
                level = concern.get("level") if isinstance(concern, dict) else None
                if isinstance(level, str) and level.strip():
                    levels[dimension][level.strip()] = levels[dimension].get(level.strip(), 0) + 1
        good_impression = details.get("good_impression")
        level = good_impression.get("level") if isinstance(good_impression, dict) else None
        if isinstance(level, str) and level.strip():
            levels["Good Impression"][level.strip()] = levels["Good Impression"].get(level.strip(), 0) + 1
    return {
        "total": len(rows),
        "distribution": [
            {
                "name": dimension,
                "levels": [
                    {"name": level, "value": value}
                    for level, value in (
                        (level_name, levels[dimension].get(level_name, 0))
                        for level_name in ["White", "Light Blue", "Dark Blue"]
                    )
                ],
            }
            for dimension in dimensions
        ],
    }

@router.get("/recruitment/papikostick")
def get_recruitment_papikostick(
    db: Session = Depends(get_db),
    department: Optional[str] = Query(None), position: Optional[str] = Query(None),
    business_unit: Optional[str] = Query(None), gender: Optional[str] = Query(None),
    education: Optional[str] = Query(None), participant_status: Optional[str] = Query(None), periode: Optional[str] = Query(None),
    session: Optional[int] = Query(None), class_id: Optional[int] = Query(None),
    age: Optional[int] = Query(None), age_min: Optional[int] = Query(None), age_max: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
):
    norm_order = ["N", "G", "A", "L", "P", "I", "T", "V", "O", "B", "S", "X", "C", "D", "R", "Z", "E", "K", "F", "W"]
    norm_labels = {
        "N": "Need to finish task",
        "G": "Hard intense worker",
        "A": "Need to achieve",
        "L": "Leadership role",
        "P": "Need to control others",
        "I": "Ease in decision making",
        "T": "Pace",
        "V": "Vigorous type",
        "O": "Need for closeness",
        "B": "Need to belong",
        "S": "Social extension",
        "X": "Need to be noticed",
        "C": "Organized type",
        "D": "Interest in details",
        "R": "Theoretical type",
        "Z": "Need for change",
        "E": "Emotional resistant",
        "K": "Need to be forceful",
        "F": "Need to support authority",
        "W": "Need for rules",
    }
    frequencies = {norm: 0 for norm in norm_order}
    rows = _recruitment_params(
        db, 6, department, position, business_unit, gender, education,
        participant_status, periode, session, class_id, age, age_min, age_max, search,
    )

    for row in rows:
        details = row.details if isinstance(row.details, dict) else {}
        primary_trait = details.get("primary_trait")
        if not isinstance(primary_trait, str) or not primary_trait.strip():
            continue
        match = re.match(r"\s*([A-Z])\b", primary_trait)
        if not match:
            continue
        code = match.group(1)
        if code in frequencies:
            frequencies[code] += 1

    distribution = [
        {"name": name, "value": value}
        for name, value in sorted(
            frequencies.items(),
            key=lambda item: (-item[1], norm_order.index(item[0]))
        )
    ]
    return {"distribution": [{"name": item["name"], "value": item["value"]} for item in distribution], "total": len(rows)}
@router.get("/executive-summary")
def get_executive_summary(
    db: Session = Depends(get_db),
    department: Optional[str] = Query(None), position: Optional[str] = Query(None),
    business_unit: Optional[str] = Query(None), gender: Optional[str] = Query(None),
    education: Optional[str] = Query(None), participant_status: Optional[str] = Query(None), periode: Optional[str] = Query(None),
    session: Optional[int] = Query(None), class_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    age: Optional[int] = Query(None), age_min: Optional[int] = Query(None), age_max: Optional[int] = Query(None),
):
    filters = {
        "department": department, "position": position,
        "business_unit": business_unit, "gender": gender,
        "education": education, "participant_status": participant_status, "periode": periode, "session": session,
        "class_id": class_id, "search": search, "age": age, "age_min": age_min, "age_max": age_max,
    }
    participant_query = apply_filters(
        db.query(User.id).select_from(User),
        {key: value for key, value in filters.items() if value is not None},
        db,
    )
    participant_ids = {user_id for (user_id,) in participant_query.distinct().all()}

    assignments = []
    if participant_ids:
        assignments = db.query(Assignment).filter(Assignment.user_id.in_(participant_ids)).all()
    assignments_by_user = {}
    for assignment in assignments:
        assignments_by_user.setdefault(assignment.user_id, []).append(assignment)
    completed = sum(
        1 for user_id in participant_ids
        if assignments_by_user.get(user_id)
        and all(item.status == "completed" for item in assignments_by_user[user_id])
    )
    pending = len(participant_ids) - completed
    completion_percentage = (completed / len(participant_ids) * 100) if participant_ids else None

    def average(values):
        return round(sum(values) / len(values), 2) if values else None

    iq_cfit_values = []
    iq_wpt_values = []
    iq_bands = {}

    for row in _personality_results(db, 5, filters):  # CFIT (Test ID 5)
        details = row.details if isinstance(row.details, dict) else {}
        classification = details.get("classification")
        if isinstance(classification, str) and classification.strip():
            band = classification.strip()
            iq_bands[band] = iq_bands.get(band, 0) + 1
        
        parsed = _parse_iq_range(details.get("est_iq"))
        midpoint = _iq_range_midpoint(parsed)
        if midpoint is not None:
            iq_cfit_values.append(midpoint)

    for row in _personality_results(db, 7, filters):  # WPT (Test ID 7)
        details = row.details if isinstance(row.details, dict) else {}
        classification = details.get("classification")
        if isinstance(classification, str) and classification.strip():
            band = classification.strip()
            iq_bands[band] = iq_bands.get(band, 0) + 1
        
        try:
            iq_wpt_values.append(float(details.get("iq")))
        except (TypeError, ValueError):
            continue

    speed_rows = _personality_results(db, 2, filters)
    speed_values = []
    speed_bands = {}
    for row in speed_rows:
        details = row.details if isinstance(row.details, dict) else {}
        try:
            speed_values.append(float(details.get("score")))
        except (TypeError, ValueError):
            pass
        band = details.get("band")
        if isinstance(band, str) and band.strip():
            speed_bands[band.strip()] = speed_bands.get(band.strip(), 0) + 1

    memory_rows = _personality_results(db, 4, filters)
    memory_values = []
    memory_bands = {}
    for row in memory_rows:
        details = row.details if isinstance(row.details, dict) else {}
        try:
            memory_values.append(float(details.get("score")))
        except (TypeError, ValueError):
            pass
        band = details.get("band")
        if isinstance(band, str) and band.strip():
            memory_bands[band.strip()] = memory_bands.get(band.strip(), 0) + 1

    cbi_levels = {}
    for row in _personality_results(db, 8, filters):
        details = row.details if isinstance(row.details, dict) else {}
        concerns = details.get("primary_concerns")
        if not isinstance(concerns, dict):
            continue
        for concern in concerns.values():
            level = concern.get("level") if isinstance(concern, dict) else None
            if isinstance(level, str) and level.strip():
                key = level.strip()
                cbi_levels[key] = cbi_levels.get(key, 0) + 1
    dominant_cbi = max(cbi_levels, key=cbi_levels.get) if cbi_levels else None
    cbi_participants = cbi_levels.get(dominant_cbi, 0) if dominant_cbi else 0
    cbi_total = sum(cbi_levels.values())
    cbi_percentage = (cbi_participants / cbi_total * 100) if cbi_total else None
    risk = {"White": "Low Risk", "Light Blue": "Medium Risk", "Dark Blue": "High Risk"}.get(dominant_cbi)

    return {
        "total_participants": len(participant_ids),
        "completion": {
            "completed": completed,
            "pending": pending,
            "percentage": round(completion_percentage, 2) if completion_percentage is not None else None,
        },
        "iq_cfit": {"average": average(iq_cfit_values)},
        "iq_wpt": {"average": average(iq_wpt_values)},
        "speed": {"average": average(speed_values), "band": max(speed_bands, key=speed_bands.get) if speed_bands else None},
        "memory": {"average": average(memory_values), "band": max(memory_bands, key=memory_bands.get) if memory_bands else None},
        "cbi": {
            "dominant_level": dominant_cbi,
            "participant": cbi_participants,
            "percentage": round(cbi_percentage, 2) if cbi_percentage is not None else None,
            "risk": risk,
        },
    }
