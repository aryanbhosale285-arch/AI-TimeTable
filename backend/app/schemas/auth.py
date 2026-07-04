import re

from pydantic import BaseModel, field_validator

# Deliberately simple check — real validation happens when mail is sent.
# Avoids adding the email-validator dependency for one field.
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class UserOut(BaseModel):
    id: int
    email: str
    name: str
    role: str
    model_config = {"from_attributes": True}


class _EmailMixin(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def email_format(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL_RE.match(v):
            raise ValueError("Enter a valid email address")
        return v


class RegisterRequest(_EmailMixin):
    name: str
    password: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name is required")
        return v.strip()


class LoginRequest(_EmailMixin):
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
