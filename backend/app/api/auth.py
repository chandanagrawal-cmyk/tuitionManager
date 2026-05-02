from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import User, Role
from app.schemas.user import UserCreate, UserUpdate, UserOut, Token
from app.api.deps import get_current_user, require_role

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form.username.lower()).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")
    return Token(access_token=create_access_token({"sub": user.username}))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me/theme")
def update_my_theme(theme: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    current_user.theme = theme
    db.commit()
    return {"theme": theme}


# ── Admin-only user management ──

@router.get("/users", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_role(Role.admin))):
    return db.query(User).order_by(User.id).all()


@router.post("/users", response_model=UserOut, status_code=201)
def create_user(data: UserCreate, db: Session = Depends(get_db), _: User = Depends(require_role(Role.admin))):
    if db.query(User).filter(User.username == data.username.lower()).first():
        raise HTTPException(400, "Username already exists")
    user = User(
        username=data.username.lower(),
        hashed_password=hash_password(data.password),
        role=data.role,
        full_name=data.full_name,
        email=data.email
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/users/{user_id}", response_model=UserOut)
def update_user(user_id: int, data: UserUpdate, db: Session = Depends(get_db), current: User = Depends(require_role(Role.admin))):
    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if user.id == current.id and data.is_active is False:
        raise HTTPException(400, "Cannot deactivate your own account")
    if data.password:
        user.hashed_password = hash_password(data.password)
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.email is not None:
        user.email = data.email
    if data.role is not None:
        user.role = data.role
    if data.is_active is not None:
        user.is_active = data.is_active
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: int, db: Session = Depends(get_db), current: User = Depends(require_role(Role.admin))):
    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if user.id == current.id:
        raise HTTPException(400, "Cannot delete your own account")
    db.delete(user)
    db.commit()


@router.post("/users/{user_id}/send-summary")
def trigger_user_summary(user_id: int, db: Session = Depends(get_db), _: User = Depends(require_role(Role.admin))):
    from app.services.scheduler import send_user_summary
    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if not user.email:
        raise HTTPException(400, "User has no email address configured")
    
    success, message = send_user_summary(user, db)
    if not success:
        raise HTTPException(500, message)
    return {"message": message}
