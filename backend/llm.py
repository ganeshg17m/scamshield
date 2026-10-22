"""Tiny Gemini wrapper (free tier). If no key or any error -> returns None and callers use a fallback."""
import json, os
import requests
from dotenv import load_dotenv

load_dotenv()

KEY = os.getenv("GEMINI_API_KEY", "")
MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-latest")


def ask_json(prompt):
    if not KEY:
        return None
    try:
        r = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
            params={"key": KEY},
            json={"contents": [{"parts": [{"text": prompt}]}],
                  "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"}},
            timeout=25,
        )
        r.raise_for_status()
        text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(text.strip().strip("`").removeprefix("json").strip())
    except Exception as e:
        print("LLM call failed, using fallback:", e)
        return None
