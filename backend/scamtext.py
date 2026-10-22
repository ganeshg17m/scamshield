"""Scam message classifier: Gemini few-shot (handles Hinglish) with an offline rule-based fallback."""
import re
from llm import ask_json

PROMPT = """You are a scam-message detector for Indian UPI / online-payment fraud.
Messages may be English, Hindi (Devanagari) or Hinglish (Hindi in Roman script).
Return ONLY JSON: {{"label":"scam"|"legit","scam_type":"kyc|digital_arrest|parcel_customs|investment|electricity_bill|job_task|refund_qr|loan_app|lottery|other|none","language":"english|hindi|hinglish","confidence":0.0-1.0,"reasons":["short reason", "..."]}}
Examples:
"Dear customer your SBI KYC expires today, click http://sbi-kyc.xyz to avoid account block" -> scam, kyc
"Aapka bijli bill pending hai, aaj raat 9 baje connection kat jayega. Turant 9876543210 par call karein" -> scam, electricity_bill, hinglish
"Your OTP for HDFC login is 482913. Do not share with anyone." -> legit
"Bhai kal 7 baje chai pe milte hain" -> legit, hinglish
Message: {text}"""

HINGLISH = {"aapka", "aap", "kripya", "turant", "karein", "karo", "hai", "hain", "khata", "band", "jaldi", "paise",
            "bhejo", "abhi", "nahi", "kal", "aaj", "bijli", "ho", "jayega", "warna", "mat", "batao", "bhai"}
RULES = [
    ("kyc", r"\bkyc\b|pan (card )?(update|expire)|aadhaar.*(update|link)", "Asks for KYC/PAN update under threat of blocking"),
    ("digital_arrest", r"digital arrest|cbi|narcotics|police.*(case|arrest)|arrest warrant|gireftar", "Impersonates police/agency and threatens arrest"),
    ("parcel_customs", r"parcel|courier|customs|fedex|dhl", "Parcel/customs pretext for payment"),
    ("investment", r"guaranteed (return|profit)|double your money|stock tip|crypto.*profit|vip group", "Promises guaranteed investment returns"),
    ("electricity_bill", r"bijli|electricity|power (supply|connection).*(cut|disconnect)", "Electricity disconnection threat"),
    ("job_task", r"part[- ]?time job|work from home|like (and|&) (subscribe|review)|task.*earn", "Job/task earning pretext"),
    ("lottery", r"lottery|lucky draw|you (have )?won|jackpot|inaam", "Prize/lottery bait"),
    ("loan_app", r"instant loan|loan approved|pre-?approved loan", "Instant-loan bait"),
    ("refund_qr", r"refund.*(qr|scan|upi pin)|scan (this )?qr|enter (your )?upi pin", "Asks to scan QR / enter UPI PIN to receive money"),
]
URGENT = r"urgent|immediately|turant|abhi|today|aaj|within \d+ (hours|minutes)|expires?|block(ed)?|band|suspend|last chance|jaldi"


def detect_language(text):
    if re.search(r"[\u0900-\u097F]", text):
        return "hindi"
    words = set(re.findall(r"[a-z]+", text.lower()))
    return "hinglish" if len(words & HINGLISH) >= 2 else "english"


def fallback(text):
    t = text.lower()
    reasons, scam_type, score = [], "none", 0.0
    for name, pat, why in RULES:
        if re.search(pat, t):
            scam_type, score = name, score + 0.45
            reasons.append(why)
            break
    if re.search(r"https?://|www\.|bit\.ly|\.xyz|\.top", t):
        score += 0.25; reasons.append("Contains a link")
    if re.search(URGENT, t):
        score += 0.2; reasons.append("Creates urgency / threat")
    if re.search(r"\botp\b|\bcvv\b|upi pin|password", t) and re.search(r"share|send|bhej|batao|enter", t):
        score += 0.3; reasons.append("Asks for OTP/PIN/password")
    if re.search(r"do not share|never share|kisi ko na", t):
        score -= 0.4
    score = max(0.0, min(score, 1.0))
    label = "scam" if score >= 0.45 else "legit"
    if label == "scam" and scam_type == "none":
        scam_type = "other"
    return {"label": label, "scam_type": scam_type if label == "scam" else "none", "language": detect_language(text),
            "confidence": round(0.5 + score / 2 if label == "scam" else 0.9 - score / 2, 2),
            "reasons": reasons or ["No scam signals found"], "method": "rules-fallback"}


def classify(text):
    text = (text or "").strip()[:1000]
    out = ask_json(PROMPT.format(text=text))
    if isinstance(out, dict) and out.get("label") in ("scam", "legit"):
        out["method"] = "gemini"
        return out
    return fallback(text)
