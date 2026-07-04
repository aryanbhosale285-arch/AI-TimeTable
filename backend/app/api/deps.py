"""Shared auth dependencies for protected routes."""
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.school import School
from app.models.user import User

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = decode_access_token(creds.credentials)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User no longer exists")
    return user


def require_school_access(
    school_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> School:
    """Router-level guard for every /schools/{school_id}/... route.

    Schools created before auth existed have owner_id NULL and stay reachable
    by any signed-in admin; owned schools are private to their owner.
    """
    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    if school.owner_id is not None and school.owner_id != user.id:
        raise HTTPException(status_code=403, detail="You don't have access to this school")
    return school
