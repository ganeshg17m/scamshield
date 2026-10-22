"""Core logic: scoring + SHAP reasons, mule-graph tracing, alerts and cases. (FastAPI wrapper is in main.py)"""
import random
import time
from collections import defaultdict

import networkx as nx
import pandas as pd
import xgboost as xgb

from copilot import draft_case_summary
from features import FEATURES, FeatureState

FREEZE_WINDOW_MS = 15 * 60 * 1000
LABELS = {
    "amount": "Unusually large amount", "hour": "Time of day", "is_night": "Late-night transfer",
    "amount_zscore": "Far above this sender's normal amount", "new_payee": "First time paying this account",
    "txn_count_1h": "Many transfers in the last hour", "device_account_count": "Device shared by several accounts",
    
}


def decide(score):
    return "block" if score >= 85 else "hold" if score >= 60 else "step_up" if score >= 30 else "allow"


class Engine:
    def __init__(self):
        self.model = xgb.XGBClassifier()
        self.model.load_model("model.json")
        self.reset()

    # ---------- startup / demo reset ----------
    def reset(self):
        df = pd.read_csv("transactions.csv").sort_values("ts").reset_index(drop=True)
        self.state = FeatureState()
        feats = []
        for t in df.to_dict("records"):
            feats.append(self.state.features(t))
            self.state.update(t)
        df["score"] = (self.model.predict_proba(pd.DataFrame(feats)[FEATURES])[:, 1] * 100).round().astype(int)
        self.G = nx.DiGraph()                       # graph of suspicious transfers only (score >= 60)
        self.acc_devices = defaultdict(set)
        for t in df.to_dict("records"):
            self.acc_devices[t["fromAcc"]].add(t["deviceId"])
            if t["score"] >= 60:
                self._add_edge(t)
        self.normal_accounts = sorted(a for a in self.state.stats if a.startswith("ACC_"))
        self.victim_pool = [a for a in self.normal_accounts if self._calm(a)]      # clean accounts for the live demo
        self.alerts, self.cases, self.counter, self.case_counter = [], {}, 0, 1000

    def _calm(self, a):
        n, s, ss = self.state.stats[a]
        std = max(ss / n - (s / n) ** 2, 0) ** 0.5 if n else 0
        return n >= 5 and std < 4000 and not any(p.startswith("MULE_") for p in self.state.payees[a])

    def _add_edge(self, t):
        u, v = t["fromAcc"], t["toAcc"]
        if self.G.has_edge(u, v):
            self.G[u][v]["amount"] += float(t["amount"]); self.G[u][v]["count"] += 1
        else:
            self.G.add_edge(u, v, amount=float(t["amount"]), count=1)

    # ---------- scoring ----------
    def score_txn(self, t):
        t0 = time.perf_counter()
        f = self.state.features(t)
        X = pd.DataFrame([f])[FEATURES]
        prob = float(self.model.predict_proba(X)[0, 1])
        contrib = self.model.get_booster().predict(xgb.DMatrix(X), pred_contribs=True)[0][:-1]   # TreeSHAP
        top = sorted(range(len(FEATURES)), key=lambda i: -contrib[i])[:3]
        reasons = [{"feature": FEATURES[i], "label": LABELS[FEATURES[i]], "value": round(float(f[FEATURES[i]]), 2),
                    "impact": round(float(contrib[i]), 2)} for i in top if contrib[i] > 0]
        self.state.update(t)
        self.acc_devices[t["fromAcc"]].add(t["deviceId"])
        score = int(round(prob * 100))
        decision = decide(score)
        if score >= 60:
            self._add_edge(t)
        res = {**t, "score": score, "decision": decision, "reasons": reasons,
               "modelVersion": "xgb-synthetic-v1", "latency_ms": round((time.perf_counter() - t0) * 1000, 1)}
        if decision in ("hold", "block"):
            res["alert"] = self._make_alert(res)
        return res

    def _make_alert(self, r):
        a = {"alertId": f"A{len(self.alerts) + 1:04d}", "txnId": r["txnId"], "fromAcc": r["fromAcc"], "toAcc": r["toAcc"],
             "amount": r["amount"], "score": r["score"], "decision": r["decision"], "reasons": r["reasons"],
             "createdMs": int(time.time() * 1000), "freezeDeadlineMs": int(time.time() * 1000) + FREEZE_WINDOW_MS,
             "status": "open", "caseId": None}
        self.alerts.insert(0, a)
        return a

    def simulate(self, kind, tries=0):
        self.counter += 1
        ts = self.state.last_ts + random.randint(60, 300)
        if kind == "fraud" and self.victim_pool:
            frm = self.victim_pool.pop(random.randrange(len(self.victim_pool)))      # fresh victim each time
        else:
            frm = random.choice(self.normal_accounts)
        if kind == "fraud":
            to, amount = random.choice(["MULE_01", "MULE_02", "MULE_03"]), round(random.uniform(40000, 90000), 2)
        else:
            to = random.choice(sorted(self.state.payees[frm]) or ["MER_01"])
            n, s, _ = self.state.stats[frm]
            mean = s / n if n else 500
            amount = round(max(50, random.gauss(mean, mean * 0.3)), 2)
        dev = sorted(self.acc_devices[frm])[0] if self.acc_devices[frm] else "DEV_0001"
        res = self.score_txn({"txnId": f"SIM{self.counter:04d}", "ts": ts, "fromAcc": frm, "toAcc": to,
                              "amount": amount, "deviceId": dev})
        if kind == "fraud" and res["decision"] not in ("hold", "block") and tries < 4:
            return self.simulate(kind, tries + 1)       # demo helper: replay the scripted fraud pattern with a fresh victim
        return res

    # ---------- mule graph ----------
    def trace(self, account):
        G = self.G
        if account not in G:
            return {"found": False, "query": account, "nodes": [], "edges": [], "stats": {}}
        # collectors = receive from 3+ flagged senders and forward money on; the ring = everything downstream of them
        seeds = {n for n in G if G.in_degree(n) >= 3 and G.out_degree(n) >= 1}
        mules = set(seeds)
        for s in seeds:
            mules |= nx.descendants(G, s)
        H = G.subgraph(mules)
        start = [account] if account in mules else [s for s in G.successors(account) if s in mules]
        if not start:
            return {"found": False, "query": account, "nodes": [], "edges": [], "stats": {}}
        comp = set()
        for s in start:
            comp |= nx.node_connected_component(H.to_undirected(), s)
        nodes, edges, victims_total, victims_n = [], [], 0.0, 0
        for m in comp:
            vict = [p for p in G.predecessors(m) if p not in mules]
            role = "collector" if vict else ("cashout" if H.out_degree(m) == 0 else "mule")
            nodes.append({"id": m, "label": m, "role": role, "devices": sorted(self.acc_devices[m])})
            if vict:
                others = [p for p in vict if p != account]
                amt = sum(G[p][m]["amount"] for p in others)
                victims_total += sum(G[p][m]["amount"] for p in vict); victims_n += len(vict)
                if others:
                    vid = f"VICTIMS->{m}"
                    nodes.append({"id": vid, "label": f"{len(others)} victims", "role": "victims", "devices": []})
                    edges.append({"src": vid, "dst": m, "amount": round(amt), "count": sum(G[p][m]["count"] for p in others)})
                if account in vict:
                    nodes.append({"id": account, "label": account, "role": "victim", "devices": []})
                    edges.append({"src": account, "dst": m, "amount": round(G[account][m]["amount"]), "count": G[account][m]["count"]})
        for u, v, d in H.subgraph(comp).edges(data=True):
            edges.append({"src": u, "dst": v, "amount": round(d["amount"]), "count": d["count"]})
        D = nx.DiGraph()
        D.add_nodes_from(n["id"] for n in nodes)
        D.add_edges_from((e["src"], e["dst"]) for e in edges)
        layer = {}
        try:
            for n in nx.topological_sort(D):
                layer[n] = max([layer[p] + 1 for p in D.predecessors(n)], default=0)
        except nx.NetworkXUnfeasible:
            layer = {n["id"]: 0 for n in nodes}
        for n in nodes:
            n["layer"] = layer[n["id"]]
        devices = sorted({d for n in nodes for d in n["devices"]})
        return {"found": True, "query": account, "nodes": nodes, "edges": edges,
                "stats": {"ring_accounts": len(comp), "shared_devices": len(devices), "devices": devices,
                          "victims": victims_n, "money_in": round(victims_total),
                          "hops": max(layer.values()),
                          "cashout": sorted(n["id"] for n in nodes if n["role"] == "cashout")}}

    # ---------- cases ----------
    def create_case(self, alert_id):
        a = next((x for x in self.alerts if x["alertId"] == alert_id), None)
        if not a:
            return None
        if a["caseId"]:
            return self.cases[a["caseId"]]
        self.case_counter += 1
        cid = f"CASE-{self.case_counter}"
        self.cases[cid] = {"caseId": cid, "alertIds": [alert_id], "accounts": [a["fromAcc"], a["toAcc"]], "status": "open",
                           "assignee": "analyst", "notes": [], "summary": None, "feedback": None, "amount": a["amount"],
                           "score": a["score"], "reasons": a["reasons"], "createdMs": int(time.time() * 1000)}
        a["caseId"], a["status"] = cid, "case_opened"
        return self.cases[cid]

    def copilot(self, case_id):
        c = self.cases.get(case_id)
        if not c:
            return None
        c["summary"] = draft_case_summary(c, self.trace(c["accounts"][1]))
        return c["summary"]
