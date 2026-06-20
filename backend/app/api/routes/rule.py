from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.rule import RuleConfig, CustomRule
from app.schemas.rule import (
    RuleConfigOut, RuleConfigUpdate,
    CustomRuleCreate, CustomRuleUpdate, CustomRuleOut, NLRuleRequest,
)
from app.services import ai_rules

router = APIRouter(prefix="/rules", tags=["rules"])

VALID_TYPES = {"subject_time", "subject_max_per_day", "subject_position"}


def detect_provider(api_key: str) -> str:
    """Infer the LLM provider from the key format so the user just pastes a key."""
    if api_key.startswith("sk-ant-"):
        return "claude"
    return "gemini"  # Google keys start with 'AIza'; default to Gemini otherwise


def _to_out(cfg: RuleConfig) -> RuleConfigOut:
    """Serialize config WITHOUT leaking the API key — only whether one is set."""
    return RuleConfigOut(
        id=cfg.id,
        keep_key_periods_filled=cfg.keep_key_periods_filled,
        teacher_rest_after_two=cfg.teacher_rest_after_two,
        avoid_back_to_back_free=cfg.avoid_back_to_back_free,
        spread_subjects=cfg.spread_subjects,
        morning_hard_subjects=cfg.morning_hard_subjects,
        max_doubles_per_week=cfg.max_doubles_per_week,
        solve_time_limit=cfg.solve_time_limit,
        ai_provider=cfg.ai_provider or "gemini",
        has_ai_key=bool(cfg.ai_api_key),
    )


def get_or_create(db: Session) -> RuleConfig:
    """The rule config is a single global row; create it with defaults if missing."""
    cfg = db.query(RuleConfig).first()
    if not cfg:
        cfg = RuleConfig()
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


@router.get("", response_model=RuleConfigOut)
def get_rules(db: Session = Depends(get_db)):
    return _to_out(get_or_create(db))


@router.put("", response_model=RuleConfigOut)
def update_rules(payload: RuleConfigUpdate, db: Session = Depends(get_db)):
    cfg = get_or_create(db)
    data = payload.model_dump(exclude_none=True)
    # Auto-detect the provider from the key format — the user just pastes a key.
    if data.get("ai_api_key"):
        data["ai_provider"] = detect_provider(data["ai_api_key"])
    for field, value in data.items():
        setattr(cfg, field, value)
    db.commit()
    db.refresh(cfg)
    return _to_out(cfg)


# ---- Custom (admin-defined) rules ----

@router.get("/custom", response_model=List[CustomRuleOut])
def list_custom_rules(db: Session = Depends(get_db)):
    return db.query(CustomRule).order_by(CustomRule.id).all()


@router.post("/custom", response_model=CustomRuleOut)
def create_custom_rule(payload: CustomRuleCreate, db: Session = Depends(get_db)):
    if payload.rule_type not in VALID_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown rule type '{payload.rule_type}'. "
                   f"Valid: {', '.join(sorted(VALID_TYPES))}.",
        )
    if not payload.subject_name:
        raise HTTPException(status_code=400, detail="subject_name is required.")
    rule = CustomRule(**payload.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.post("/custom/parse", response_model=CustomRuleOut)
def parse_and_create_rule(payload: NLRuleRequest, db: Session = Depends(get_db)):
    """Turn a plain-English rule into a structured CustomRule via the admin's LLM."""
    cfg = get_or_create(db)
    try:
        parsed = ai_rules.parse_rule(
            payload.text, cfg.ai_provider or "gemini", cfg.ai_api_key or ""
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    rule = CustomRule(**parsed)
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.patch("/custom/{rule_id}", response_model=CustomRuleOut)
def update_custom_rule(rule_id: int, payload: CustomRuleUpdate, db: Session = Depends(get_db)):
    rule = db.query(CustomRule).filter(CustomRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Custom rule not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(rule, field, value)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/custom/{rule_id}", status_code=204)
def delete_custom_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(CustomRule).filter(CustomRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Custom rule not found")
    db.delete(rule)
    db.commit()
