from sqlalchemy import Column, Integer, Boolean, String

from app.core.database import Base


class RuleConfig(Base):
    """Global, admin-editable scheduling rules. Single row (id=1).

    Hard rules (no double-booking, room capacity, availability, fixed slots)
    are always enforced and are NOT configurable. These are the preferences
    the admin can turn on/off or tune.
    """
    __tablename__ = "rule_config"

    id = Column(Integer, primary_key=True, index=True)
    keep_key_periods_filled = Column(Boolean, default=True)   # 1st/2nd/around break/last never free
    teacher_rest_after_two = Column(Boolean, default=True)    # no 3 lectures in a row
    avoid_back_to_back_free = Column(Boolean, default=True)   # no two free periods in a row
    spread_subjects = Column(Boolean, default=True)           # spread a subject across the week
    morning_hard_subjects = Column(Boolean, default=True)     # Maths/Science earlier in the day
    max_doubles_per_week = Column(Integer, default=2)         # allowed consecutive doubles / class
    solve_time_limit = Column(Integer, default=30)            # solver time budget (seconds)
    ai_provider = Column(String, default="gemini")           # which LLM parses typed rules
    ai_api_key = Column(String, nullable=True)               # the admin's own API key


class CustomRule(Base):
    """An admin-defined rule, applied on top of the built-in ones.

    rule_type drives how it maps to a solver constraint:
      - "subject_time"        : subject_name prefers param_text ("morning"/"afternoon")
      - "subject_max_per_day" : subject_name at most param_int periods per class per day
      - "subject_position"    : subject_name avoids param_text ("first"/"last") period
    Rules match subjects by NAME (case-insensitive), so they apply across schools.
    """
    __tablename__ = "custom_rules"

    id = Column(Integer, primary_key=True, index=True)
    rule_type = Column(String, nullable=False)
    subject_name = Column(String, nullable=True)
    param_text = Column(String, nullable=True)
    param_int = Column(Integer, nullable=True)
    enabled = Column(Boolean, default=True)
