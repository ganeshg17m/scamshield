"""ScamShield API. Run: uvicorn main:app --reload --port 8000   (docs at http://localhost:8000/docs)"""
import json
import time
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from engine import Engine
from scamtext import classify

app = FastAPI(title="ScamShield API", version="1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
engine = Engine()


class Txn(BaseModel):
    fromAcc: str
    toAcc: str
    amount: float
    deviceId: str = "DEV_UNKNOWN"
    ts: Optional[int] = None


class Msg(BaseModel):
    text: str


class Note(BaseModel):
    text: str


class Feedback(BaseModel):
    caseId: str
    label: str      # "true_positive" or "false_positive"


@app.get("/v1/health")
def health():
    return {"status": "ok", "model": "xgb-synthetic-v1", "transactions_loaded": engine.state.last_ts > 0,
            "alerts": len(engine.alerts), "time": int(time.time())}


@app.get("/v1/metrics")
def metrics():
    return json.load(open("metrics.json"))


@app.post("/v1/score")
def score(t: Txn):
    """Partner-style API: score one transaction. Returns score (0-100), decision and SHAP reasons."""
    engine.counter += 1
    ts = t.ts or engine.state.last_ts + 60
    return engine.score_txn({"txnId": f"API{engine.counter:04d}", "ts": ts, "fromAcc": t.fromAcc, "toAcc": t.toAcc,
                             "amount": t.amount, "deviceId": t.deviceId})


@app.post("/v1/demo/simulate")
def simulate(kind: str = "fraud"):
    if kind not in ("fraud", "normal"):
        raise HTTPException(400, "kind must be fraud or normal")
    return engine.simulate(kind)


@app.post("/v1/demo/reset")
def reset():
    engine.reset()
    return {"ok": True}


@app.get("/v1/alerts")
def alerts():
    return engine.alerts


@app.get("/v1/graph/trace")
def trace(account: str):
    return engine.trace(account)


@app.post("/v1/classify-text")
def classify_text(m: Msg):
    return classify(m.text)


@app.post("/v1/cases")
def create_case(alertId: str):
    c = engine.create_case(alertId)
    if not c:
        raise HTTPException(404, "alert not found")
    return c


@app.get("/v1/cases")
def list_cases():
    return list(engine.cases.values())


@app.post("/v1/cases/{case_id}/notes")
def add_note(case_id: str, n: Note):
    c = engine.cases.get(case_id)
    if not c:
        raise HTTPException(404, "case not found")
    c["notes"].append({"text": n.text, "ts": int(time.time() * 1000)})
    return c


@app.post("/v1/cases/{case_id}/copilot")
def copilot(case_id: str):
    out = engine.copilot(case_id)
    if out is None:
        raise HTTPException(404, "case not found")
    return out


@app.post("/v1/feedback")
def feedback(f: Feedback):
    c = engine.cases.get(f.caseId)
    if not c:
        raise HTTPException(404, "case not found")
    c["feedback"] = f.label
    c["status"] = "closed"
    return c
