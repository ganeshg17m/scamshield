# ScamShield (hackathon build)

Real-time UPI fraud scoring with SHAP reasons, mule-ring graph, Hindi/Hinglish scam-message checker, and an AI investigator copilot.
All data is synthetic. Metrics are optimistic and are not a claim about real-world performance.

## Run locally (3 terminals max)

Backend (Python 3.10-3.12):
```
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate      Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
python generate_data.py
python train.py
# Optional: copy .env.example to .env and replace its placeholder with a fresh key
# Windows PowerShell: Copy-Item .env.example .env
# Mac/Linux: cp .env.example .env
uvicorn main:app --reload --port 8000
```
The `.env` file is ignored by Git. Restart the backend after changing it.
Without a key, the message checker and copilot use offline fallbacks.

Open http://localhost:8000/docs to see the API.

Frontend (Node 18+):
```
cd frontend
npm install
npm run dev
```
Open http://localhost:5173
