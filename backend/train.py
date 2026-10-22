"""Trains the fraud model on transactions.csv and saves model.json + metrics.json. Run: python train.py"""
import json
import pandas as pd
import xgboost as xgb
from sklearn.metrics import average_precision_score, roc_curve, precision_score, recall_score
from features import FeatureState, FEATURES

df = pd.read_csv("transactions.csv").sort_values("ts").reset_index(drop=True)
state, rows = FeatureState(), []
for t in df.to_dict("records"):
    rows.append(state.features(t))
    state.update(t)
X = pd.DataFrame(rows)[FEATURES]
y = df["is_fraud"].values

cut = int(len(df) * 0.8)                      # time-based split (no shuffling = no leakage)
Xtr, Xte, ytr, yte = X[:cut], X[cut:], y[:cut], y[cut:]

model = xgb.XGBClassifier(
    n_estimators=200, max_depth=4, learning_rate=0.1, subsample=0.9, colsample_bytree=0.9,
    scale_pos_weight=float((ytr == 0).sum() / max(ytr.sum(), 1)), eval_metric="aucpr",
)
model.fit(Xtr, ytr)

p = model.predict_proba(Xte)[:, 1]
fpr, tpr, _ = roc_curve(yte, p)
pred = (p >= 0.6).astype(int)
metrics = {
    "train_rows": int(len(Xtr)), "test_rows": int(len(Xte)), "test_fraud": int(yte.sum()),
    "pr_auc": round(float(average_precision_score(yte, p)), 4),
    "recall_at_1pct_fpr": round(float(tpr[fpr <= 0.01].max()), 4),
    "precision_at_score60": round(float(precision_score(yte, pred, zero_division=0)), 4),
    "recall_at_score60": round(float(recall_score(yte, pred, zero_division=0)), 4),
    "note": "Synthetic data. Metrics are optimistic and are NOT a claim about real-world performance.",
}
model.save_model("model.json")
json.dump(metrics, open("metrics.json", "w"), indent=2)
print(json.dumps(metrics, indent=2))
