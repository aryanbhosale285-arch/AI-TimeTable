from pydantic import BaseModel
from typing import Optional


class RuleConfigOut(BaseModel):
    id: int
    keep_key_periods_filled: bool
    teacher_rest_after_two: bool
    avoid_back_to_back_free: bool
    spread_subjects: bool
    morning_hard_subjects: bool
    max_doubles_per_week: int
    solve_time_limit: int
    ai_provider: str
    has_ai_key: bool = False  # never expose the key itself
    model_config = {"from_attributes": True}


class RuleConfigUpdate(BaseModel):
    keep_key_periods_filled: Optional[bool] = None
    teacher_rest_after_two: Optional[bool] = None
    avoid_back_to_back_free: Optional[bool] = None
    spread_subjects: Optional[bool] = None
    morning_hard_subjects: Optional[bool] = None
    max_doubles_per_week: Optional[int] = None
    solve_time_limit: Optional[int] = None
    ai_provider: Optional[str] = None
    ai_api_key: Optional[str] = None


class NLRuleRequest(BaseModel):
    text: str


class CustomRuleCreate(BaseModel):
    rule_type: str  # subject_time | subject_max_per_day | subject_position
    subject_name: Optional[str] = None
    param_text: Optional[str] = None
    param_int: Optional[int] = None
    enabled: bool = True


class CustomRuleUpdate(BaseModel):
    enabled: Optional[bool] = None
    param_text: Optional[str] = None
    param_int: Optional[int] = None


class CustomRuleOut(BaseModel):
    id: int
    rule_type: str
    subject_name: Optional[str]
    param_text: Optional[str]
    param_int: Optional[int]
    enabled: bool
    model_config = {"from_attributes": True}
