"""Password hashing + signed access tokens using only the standard library.

- Passwords: scrypt (hashlib) with a per-user random salt.
- Tokens: compact JWT (HS256) built with hmac — no external crypto deps, which
  keeps the Render deploy small and avoids passlib's Python 3.13+ breakage.
"""
import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Optional

from app.core.config import settings

_SCRYPT_N, _SCRYPT_R, _SCRYPT_P = 2 ** 14, 8, 1


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    key = hashlib.scrypt(
        password.encode(), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P
    )
    return f"scrypt${_b64(salt)}${_b64(key)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _scheme, salt_s, key_s = stored.split("$")
        key = hashlib.scrypt(
            password.encode(), salt=_unb64(salt_s), n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P
        )
        return hmac.compare_digest(key, _unb64(key_s))
    except Exception:
        return False


def _sign(msg: bytes) -> str:
    return _b64(hmac.new(settings.SECRET_KEY.encode(), msg, hashlib.sha256).digest())


def create_access_token(user_id: int, expires_minutes: Optional[int] = None) -> str:
    header = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    exp = int(time.time()) + 60 * (expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = _b64(json.dumps({"sub": str(user_id), "exp": exp}).encode())
    signing_input = f"{header}.{payload}"
    return f"{signing_input}.{_sign(signing_input.encode())}"


def decode_access_token(token: str) -> Optional[int]:
    """Return the user id for a valid, unexpired token; None otherwise."""
    try:
        header, payload, sig = token.split(".")
        if not hmac.compare_digest(sig, _sign(f"{header}.{payload}".encode())):
            return None
        claims = json.loads(_unb64(payload))
        if int(claims["exp"]) < time.time():
            return None
        return int(claims["sub"])
    except Exception:
        return None
