"""Turn a plain-English scheduling rule into a structured CustomRule.

Used ONLY to translate an admin's sentence into one of the rule types the
solver understands — never to build the timetable itself (that's OR-Tools).
The admin supplies their own API key. Gemini is the default; Claude is also
supported if the admin pastes an Anthropic key and sets provider to 'claude'.
"""
import json

VALID_TYPES = {"subject_time", "subject_max_per_day", "subject_position"}

_SYSTEM = """You convert a school-timetable rule written in plain English into a single JSON object.

Output ONLY a JSON object (no prose) with these fields:
  "rule_type": one of "subject_time", "subject_max_per_day", "subject_position"
  "subject_name": the subject the rule is about (string)
  "param_text": for subject_time use "morning" or "afternoon";
                for subject_position use "first" or "last";
                otherwise null
  "param_int": for subject_max_per_day, the maximum number per day (integer); otherwise null

Rule type meanings:
  - subject_time: the subject should be scheduled in the morning or the afternoon.
  - subject_max_per_day: the subject may appear at most N times in a class per day.
  - subject_position: the subject should avoid the first or the last period of the day.

If the sentence cannot be expressed with these types, output:
  {"error": "short reason"}

Examples:
  "Keep Maths in the morning"            -> {"rule_type":"subject_time","subject_name":"Maths","param_text":"morning","param_int":null}
  "PE at most once a day"                -> {"rule_type":"subject_max_per_day","subject_name":"PE","param_text":null,"param_int":1}
  "Library should never be the last period" -> {"rule_type":"subject_position","subject_name":"Library","param_text":"last","param_int":null}
"""


def parse_rule(text: str, provider: str, api_key: str) -> dict:
    """Return a validated rule dict, or raise ValueError with a clear message."""
    if not api_key:
        raise ValueError("No AI API key set. Add your key in Rules → AI assistant first.")
    if not text or not text.strip():
        raise ValueError("Type a rule first.")

    if provider == "claude":
        raw = _call_claude(text, api_key)
    else:
        raw = _call_gemini(text, api_key)

    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        raise ValueError(f"The AI returned something unexpected: {raw[:160]}")

    if "error" in data:
        raise ValueError(f"Couldn't turn that into a rule: {data['error']}")
    if data.get("rule_type") not in VALID_TYPES:
        raise ValueError("The AI produced an unsupported rule type. Try rephrasing.")
    if not data.get("subject_name"):
        raise ValueError("Couldn't tell which subject the rule is about.")
    return {
        "rule_type": data["rule_type"],
        "subject_name": str(data["subject_name"]).strip(),
        "param_text": data.get("param_text"),
        "param_int": data.get("param_int"),
        "enabled": True,
    }


def _call_gemini(text: str, api_key: str) -> str:
    import httpx  # imported lazily so the timetable engine never depends on it
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        "gemini-2.0-flash:generateContent"
    )
    body = {
        "contents": [{"parts": [{"text": f"{_SYSTEM}\n\nRULE: {text}"}]}],
        "generationConfig": {"temperature": 0, "responseMimeType": "application/json"},
    }
    try:
        r = httpx.post(url, params={"key": api_key}, json=body, timeout=30)
    except httpx.HTTPError as e:
        raise ValueError(f"Couldn't reach Gemini: {e}")
    if r.status_code != 200:
        raise ValueError(f"Gemini error ({r.status_code}). Check your API key. {r.text[:160]}")
    try:
        return r.json()["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        raise ValueError("Gemini returned no usable answer. Try again or rephrase.")


def _call_claude(text: str, api_key: str) -> str:
    import httpx  # imported lazily so the timetable engine never depends on it
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    body = {
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": 256,
        "system": _SYSTEM,
        "messages": [{"role": "user", "content": f"RULE: {text}"}],
    }
    try:
        r = httpx.post(url, headers=headers, json=body, timeout=30)
    except httpx.HTTPError as e:
        raise ValueError(f"Couldn't reach Claude: {e}")
    if r.status_code != 200:
        raise ValueError(f"Claude error ({r.status_code}). Check your API key. {r.text[:160]}")
    try:
        return r.json()["content"][0]["text"]
    except (KeyError, IndexError):
        raise ValueError("Claude returned no usable answer. Try again or rephrase.")
