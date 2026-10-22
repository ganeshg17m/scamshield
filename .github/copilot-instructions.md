# ScamShield – instructions for GitHub Copilot

Hackathon project: real-time UPI fraud detection + mule-network graph + scam-message checker + AI investigator copilot.

Rules
- Keep it SIMPLE. One FastAPI app in backend/ (main.py, engine.py, features.py, scamtext.py, copilot.py, llm.py). Do NOT add microservices, Docker, Kubernetes, Terraform or extra databases unless asked.
- Frontend is React + Vite (plain CSS, no UI library) in frontend/src/App.jsx.
- features.py is shared by train.py and engine.py. Never duplicate feature logic; change it in one place and retrain.
- All data is synthetic (generate_data.py). Never claim real-world accuracy.
- Python 3.10+, type hints where cheap, small functions, no secrets in code (GEMINI_API_KEY comes from the environment).
- Keep API response shapes unchanged unless the frontend is updated in the same change.
- When fixing a bug, explain the cause in 2 lines, then give the minimal patch.
