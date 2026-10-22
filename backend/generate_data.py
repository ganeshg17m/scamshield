"""Creates synthetic UPI-style transactions with a planted mule ring. Run once: python generate_data.py"""
import random
import pandas as pd

random.seed(7)
DAY = 86400
START = 1_760_000_000 - (1_760_000_000 % 86400)   # midnight-aligned base timestamp
N_NORMAL_ACC = 400
DAYS = 30

normal = [f"ACC_{i:04d}" for i in range(1, N_NORMAL_ACC + 1)]
device_of = {a: f"DEV_{i:04d}" for i, a in enumerate(normal, 1)}
friends = {a: random.sample(normal, 6) for a in normal}      # usual payees
merchants = [f"MER_{i:02d}" for i in range(1, 21)]
typical = {a: random.choice([300, 600, 1200, 2500]) for a in normal}

# --- mule ring: 3 collectors -> 3 middle -> 2 layer -> 1 cash-out, 3 shared devices
ring = [f"MULE_{i:02d}" for i in range(1, 10)]
ring_dev = {m: f"DEV_M{(i % 3) + 1}" for i, m in enumerate(ring)}
chain = {"MULE_01": "MULE_04", "MULE_02": "MULE_05", "MULE_03": "MULE_06",
         "MULE_04": "MULE_07", "MULE_05": "MULE_07", "MULE_06": "MULE_08",
         "MULE_07": "MULE_09", "MULE_08": "MULE_09"}

rows = []
def add(ts, a, to, amount, dev, fraud):
    rows.append(dict(ts=int(ts), fromAcc=a, toAcc=to, amount=round(amount, 2), deviceId=dev, is_fraud=fraud))

# normal behaviour
for _ in range(20000):
    a = random.choice(normal)
    day = random.randint(0, DAYS - 1)
    hour = random.choices(range(24), weights=[1]*6 + [4]*4 + [6]*8 + [8]*4 + [3]*2)[0]
    ts = START + day * DAY + hour * 3600 + random.randint(0, 3599)
    r = random.random()
    to = random.choice(friends[a]) if r < 0.6 else random.choice(merchants) if r < 0.9 else random.choice(normal)
    amt = max(20, random.gauss(typical[a], typical[a] * 0.4))
    if random.random() < 0.01:                       # legit big purchases (noise)
        amt = random.uniform(15000, 60000)
    add(ts, a, to, amt, device_of[a], 0)

# fraud: victims pay collectors, ring forwards the money within minutes
for _ in range(150):
    v = random.choice(normal)
    day = random.randint(1, DAYS - 1)
    hour = random.choices(range(24), weights=[3]*6 + [1]*12 + [2]*6)[0]
    ts = START + day * DAY + hour * 3600 + random.randint(0, 3599)
    head = random.choice(["MULE_01", "MULE_02", "MULE_03"])
    amt = random.uniform(25000, 95000)
    add(ts, v, head, amt, device_of[v], 1)
    cur, t2, a2 = head, ts, amt
    while cur in chain:
        t2 += random.randint(120, 1500)
        a2 *= random.uniform(0.9, 0.97)
        add(t2, cur, chain[cur], a2, ring_dev[cur], 1)
        cur = chain[cur]

df = pd.DataFrame(rows).sort_values("ts").reset_index(drop=True)
df.insert(0, "txnId", [f"T{i:06d}" for i in range(len(df))])
df.to_csv("transactions.csv", index=False)
print(len(df), "transactions;", int(df.is_fraud.sum()), "fraud;", "ring accounts:", ring)
