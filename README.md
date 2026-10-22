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

## Deploy online

GitHub Pages hosts static frontend files only; it does not run this project's
FastAPI backend. With a frontend-only deployment the site shell can load, but
live alerts, transaction scoring, the mule graph, message checking, metrics,
cases, and AI copilot require an API and will not function. No API URL or API
key is needed for this frontend-only deployment.

1. Push the project to a GitHub repository named `scamshield` under
   `ganeshg17m`.
2. Open the repository's **Settings → Pages** and select **GitHub Actions** as
   the build and deployment source.
3. Open **Actions**, select **Deploy frontend to GitHub Pages**, and choose
   **Run workflow** on the `main` branch. The workflow also runs on pushes that
   change the frontend or its deployment workflow.
4. After the workflow succeeds, visit
   `https://ganeshg17m.github.io/scamshield/`.

If the repository name or GitHub account differs, update the Vite base path in
`frontend/vite.config.js`.
