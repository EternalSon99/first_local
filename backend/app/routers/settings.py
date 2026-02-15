"""Settings endpoints for app configuration."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.settings import Setting
from app.schemas.settings import SettingResponse, SettingsBulkUpdate

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("", response_model=list[SettingResponse])
def get_all_settings(db: Session = Depends(get_db)):
    """Get all settings."""
    settings = db.query(Setting).all()
    return [
        SettingResponse(key=s.key, value=s.value)
        for s in settings
    ]


@router.put("", response_model=list[SettingResponse])
def update_settings(
    body: SettingsBulkUpdate, db: Session = Depends(get_db)
):
    """Update multiple settings at once. Creates them if they don't exist."""
    results = []
    for item in body.settings:
        existing = db.query(Setting).filter(Setting.key == item.key).first()
        if existing:
            existing.value = item.value
        else:
            setting = Setting(key=item.key, value=item.value)
            db.add(setting)

        results.append(SettingResponse(key=item.key, value=item.value))

    db.commit()
    return results
