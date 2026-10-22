"""Feature builder shared by training and serving (same code = no train/serve mismatch)."""
import math
from collections import defaultdict, deque

FEATURES = [
    "amount", "hour", "is_night", "amount_zscore", "new_payee",
    "txn_count_1h", "device_account_count",
]


class FeatureState:
    """Keeps running history so features can be computed one transaction at a time."""

    def __init__(self):
        self.stats = defaultdict(lambda: [0, 0.0, 0.0])      # acc -> [n, sum, sumsq]
        self.payees = defaultdict(set)                        # acc -> payees seen
        self.recent = defaultdict(deque)                      # acc -> recent timestamps
        self.device_accounts = defaultdict(set)               # device -> accounts using it
        self.last_ts = 0

    def features(self, t):
        a, to, ts = t["fromAcc"], t["toAcc"], t["ts"]
        n, s, ss = self.stats[a]
        mean = s / n if n else 0.0
        std = math.sqrt(max(ss / n - mean * mean, 0.0)) if n else 0.0
        z = (t["amount"] - mean) / (std + 1.0) if n >= 3 else 0.0
        dq = self.recent[a]
        while dq and dq[0] < ts - 3600:
            dq.popleft()
        hour = (ts // 3600) % 24
        return {
            "amount": float(t["amount"]),
            "hour": int(hour),
            "is_night": int(hour < 6 or hour >= 23),
            "amount_zscore": float(z),
            "new_payee": int(to not in self.payees[a]),
            "txn_count_1h": len(dq),
            "device_account_count": len(self.device_accounts[t["deviceId"]]),
        }

    def update(self, t):
        a, to, ts = t["fromAcc"], t["toAcc"], t["ts"]
        st = self.stats[a]
        st[0] += 1; st[1] += t["amount"]; st[2] += t["amount"] ** 2
        self.payees[a].add(to)
        self.recent[a].append(ts)
        self.device_accounts[t["deviceId"]].add(a)
        self.last_ts = max(self.last_ts, ts)
