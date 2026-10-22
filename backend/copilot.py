"""Investigator copilot: finds similar past cases (TF-IDF) and asks Gemini to draft summary + next actions."""
import json
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from llm import ask_json

# Synthetic sample past cases for the demo (not real cases).
PAST = [
    {"id": "C-1021", "text": "KYC update call. Victim paid 45000 to a new payee at night. Funds forwarded through 4 accounts within 20 minutes sharing 2 devices.", "outcome": "Last hop frozen in 18 minutes, 60 percent recovered.", "action": "Request freeze on final receiving account first, then trace upstream."},
    {"id": "C-1034", "text": "Digital arrest scam. Victim threatened by fake CBI officer and transferred 90000 in two transfers to a newly opened account that fans out to many mule accounts.", "outcome": "Ring of 7 accounts identified, 3 accounts frozen.", "action": "Escalate to cyber cell, share account list with banks, flag shared device."},
    {"id": "C-1048", "text": "Fake investment group promised guaranteed returns. Many victims paid the same collector account which forwarded money to cash-out account in minutes.", "outcome": "Collector and cash-out accounts frozen, funds partly recovered.", "action": "Bulk freeze request for collector accounts and cross-check victims complaints."},
    {"id": "C-1057", "text": "Parcel customs fee scam. Large transfer to new payee late at night, receiver account receiving from many senders, pass-through within 10 minutes.", "outcome": "Receiver frozen before withdrawal, full recovery.", "action": "Immediate hold on receiver, notify victim to file complaint on 1930."},
    {"id": "C-1062", "text": "Electricity bill disconnection scam in Hinglish. Victim sent 12000 to a mule account sharing a device with 5 other accounts.", "outcome": "Device linked to 6 accounts, all flagged.", "action": "Block the shared device, review all accounts linked to it."},
    {"id": "C-1075", "text": "Part-time job task scam. Victim paid deposits repeatedly to different accounts that all forward to one cash-out account.", "outcome": "Cash-out account identified and frozen.", "action": "Trace forward to the single cash-out account and freeze it."},
    {"id": "C-1083", "text": "Refund QR scam. Victim scanned a QR and entered UPI PIN, amount 30000 sent to account with high fan-in and rapid forwarding.", "outcome": "Partial recovery, ring accounts reported to bank.", "action": "Request transaction reversal and report the receiving account."},
    {"id": "C-1090", "text": "Instant loan app harassment scam. Multiple small transfers from many victims to a shell account that forwards money upstream to a layered chain.", "outcome": "Chain of 9 accounts mapped, app reported.", "action": "Map the full chain and report to platform and cyber cell."},
]
_vec = TfidfVectorizer(stop_words="english").fit([p["text"] for p in PAST])
_mat = _vec.transform([p["text"] for p in PAST])

REASON_WORDS = {"new_payee": "new payee", "is_night": "night transfer", "amount_zscore": "unusually large amount",
                "device_account_count": "shared device", 
                "txn_count_1h": "rapid repeated transfers", "amount": "large amount"}


def similar_cases(case, trace, k=3):
    words = [REASON_WORDS.get(r["feature"], r["feature"]) for r in case["reasons"]]
    st = trace.get("stats", {})
    if st.get("shared_devices"):
        words.append("shared device accounts")
    if st.get("ring_accounts"):
        words.append("ring mule accounts forward cash-out")
    sims = cosine_similarity(_vec.transform([" ".join(words) + " transfer victim"]), _mat)[0]
    return [PAST[i] for i in sims.argsort()[::-1][:k]]


def draft_case_summary(case, trace):
    sim = similar_cases(case, trace)
    st = trace.get("stats", {})
    facts = {"case": case["caseId"], "amount_inr": case["amount"], "risk_score": case["score"],
            "from_account": case["accounts"][0], "to_account": case["accounts"][1],
            "model_reasons": [r["label"] for r in case["reasons"]],
            "network": st, "similar_past_cases": [{k: p[k] for k in ("id", "text", "outcome", "action")} for p in sim]}
    prompt = ("You are a fraud-investigation copilot for an Indian cyber cell. Using ONLY the facts below, return JSON: "
            '{"summary": "3-4 sentence case summary", "next_actions": ["3 to 4 concrete actions, most urgent first"], '
            '"cited_cases": ["case ids used"]}. Do not invent facts. A human analyst approves every action.\nFACTS: ' + json.dumps(facts))
    out = ask_json(prompt)
    if isinstance(out, dict) and "summary" in out:
        out["method"] = "gemini"
    else:
        ring = (f" The receiving account is part of a ring of {st['ring_accounts']} accounts sharing {st['shared_devices']} devices; "
                f"cash-out account(s): {', '.join(st['cashout'])}.") if st.get("ring_accounts") else ""
        out = {"summary": f"{case['caseId']}: transfer of INR {case['amount']:,.0f} from {case['accounts'][0]} to {case['accounts'][1]} "
                        f"scored {case['score']}/100. Main signals: {', '.join(r['label'].lower() for r in case['reasons'])}.{ring}",
            "next_actions": [sim[0]["action"], "Notify the victim and advise filing a complaint on the 1930 helpline.",
                                "Request a hold on the receiving and cash-out accounts within the freeze window."],
            "cited_cases": [p["id"] for p in sim], "method": "template-fallback"}
    out["similar_cases"] = sim
    return out
