from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.parent import Parent
from app.schemas.parent import ParentCreate, ParentUpdate, ParentOut
from typing import List

router = APIRouter(prefix="/api/parents", tags=["parents"], dependencies=[Depends(get_current_user)])

@router.get("", response_model=List[ParentOut])
def list_parents(db: Session = Depends(get_db)):
    return db.query(Parent).all()

@router.post("", response_model=ParentOut, status_code=201)
def create_parent(data: ParentCreate, db: Session = Depends(get_db)):
    parent = Parent(**data.model_dump())
    db.add(parent)
    db.commit()
    db.refresh(parent)
    return parent

@router.get("/{parent_id}", response_model=ParentOut)
def get_parent(parent_id: int, db: Session = Depends(get_db)):
    parent = db.query(Parent).get(parent_id)
    if not parent:
        raise HTTPException(404, "Parent not found")
    return parent

@router.put("/{parent_id}", response_model=ParentOut)
def update_parent(parent_id: int, data: ParentUpdate, db: Session = Depends(get_db)):
    parent = db.query(Parent).get(parent_id)
    if not parent:
        raise HTTPException(404, "Parent not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(parent, k, v)
    db.commit()
    db.refresh(parent)
    return parent

@router.delete("/{parent_id}", status_code=204)
def delete_parent(parent_id: int, db: Session = Depends(get_db)):
    parent = db.query(Parent).get(parent_id)
    if not parent:
        raise HTTPException(404, "Parent not found")
    db.delete(parent)
    db.commit()
