from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.student import Student
from app.models.parent import Parent
from app.models.student_parent import StudentParent
from app.schemas.student import StudentCreate, StudentUpdate, StudentOut, GuardianAdd, GuardianUpdate, GuardianOut
from app.services.session_generator import generate_sessions_for_student
from app.core.config import settings
from typing import List

router = APIRouter(prefix="/api/students", tags=["students"], dependencies=[Depends(get_current_user)])


def _get_student_or_404(student_id: int, db: Session):
    s = db.query(Student).get(student_id)
    if not s:
        raise HTTPException(404, "Student not found")
    return s


@router.get("", response_model=List[StudentOut])
def list_students(db: Session = Depends(get_db)):
    return db.query(Student).all()


@router.post("", response_model=StudentOut, status_code=201)
def create_student(data: StudentCreate, db: Session = Depends(get_db)):
    student = Student(
        name=data.name,
        subject=data.subject,
        default_day=data.default_day,
        default_time=data.default_time,
        fee_per_session=data.fee_per_session,
    )
    db.add(student)
    db.flush()

    # Auto-create a default guardian
    guardian_name = data.guardian_name or f"{data.name}'s Guardian"
    parent = db.query(Parent).filter(Parent.name == guardian_name).first()
    if not parent:
        parent = Parent(name=guardian_name)
        db.add(parent)
        db.flush()

    db.add(StudentParent(student_id=student.id, parent_id=parent.id, relationship_type="Guardian", is_primary=True))
    db.commit()
    db.refresh(student)
    generate_sessions_for_student(db, student)
    return student


@router.get("/{student_id}", response_model=StudentOut)
def get_student(student_id: int, db: Session = Depends(get_db)):
    return _get_student_or_404(student_id, db)


@router.put("/{student_id}", response_model=StudentOut)
def update_student(student_id: int, data: StudentUpdate, db: Session = Depends(get_db)):
    student = _get_student_or_404(student_id, db)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(student, k, v)
    db.commit()
    db.refresh(student)
    return student


@router.delete("/{student_id}", status_code=204)
def delete_student(student_id: int, db: Session = Depends(get_db)):
    student = _get_student_or_404(student_id, db)
    db.delete(student)
    db.commit()


# ── Guardian endpoints ──

@router.get("/{student_id}/guardians", response_model=List[GuardianOut])
def list_guardians(student_id: int, db: Session = Depends(get_db)):
    _get_student_or_404(student_id, db)
    return db.query(StudentParent).filter(StudentParent.student_id == student_id).all()


@router.post("/{student_id}/guardians", response_model=GuardianOut, status_code=201)
def add_guardian(student_id: int, data: GuardianAdd, db: Session = Depends(get_db)):
    _get_student_or_404(student_id, db)
    if not db.query(Parent).get(data.parent_id):
        raise HTTPException(404, "Parent not found")
    # If setting as primary, unset others
    if data.is_primary:
        db.query(StudentParent).filter(StudentParent.student_id == student_id).update({"is_primary": False}, synchronize_session='fetch')
    link = StudentParent(student_id=student_id, parent_id=data.parent_id, relationship_type=data.relationship_type, is_primary=data.is_primary)
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


@router.put("/{student_id}/guardians/{link_id}", response_model=GuardianOut)
def update_guardian(student_id: int, link_id: int, data: GuardianUpdate, db: Session = Depends(get_db)):
    link = db.query(StudentParent).filter(StudentParent.id == link_id, StudentParent.student_id == student_id).first()
    if not link:
        raise HTTPException(404, "Guardian link not found")
    if data.is_primary:
        db.query(StudentParent).filter(StudentParent.student_id == student_id).update({"is_primary": False}, synchronize_session='fetch')
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(link, k, v)
    db.commit()
    db.refresh(link)
    return link


@router.post("/{student_id}/guardians/{link_id}/set-primary", response_model=GuardianOut)
def set_primary_guardian(student_id: int, link_id: int, db: Session = Depends(get_db)):
    _get_student_or_404(student_id, db)
    # Unset all other primary guardians for this student
    db.query(StudentParent).filter(StudentParent.student_id == student_id).update({"is_primary": False}, synchronize_session='fetch')
    # Set the target guardian as primary
    link = db.query(StudentParent).filter(StudentParent.id == link_id, StudentParent.student_id == student_id).first()
    if not link:
        raise HTTPException(404, "Guardian link not found")
    link.is_primary = True
    db.commit()
    db.refresh(link)
    return link


@router.delete("/{student_id}/guardians/{link_id}", status_code=204)
def remove_guardian(student_id: int, link_id: int, db: Session = Depends(get_db)):
    link = db.query(StudentParent).filter(StudentParent.id == link_id, StudentParent.student_id == student_id).first()
    if not link:
        raise HTTPException(404, "Guardian link not found")
    # Must keep at least one guardian
    count = db.query(StudentParent).filter(StudentParent.student_id == student_id).count()
    if count <= 1:
        raise HTTPException(400, "A student must have at least one guardian")
    db.delete(link)
    db.commit()
