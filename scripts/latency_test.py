"""Measures real p50/p95 latency of POST /v1/score. Run (backend must be running): python scripts/latency_test.py"""
import statistics, time, requests

URL = "http://localhost:8000/v1/score"
body = {"fromAcc": "ACC_0010", "toAcc": "MULE_01", "amount": 62000, "deviceId": "DEV_0010"}
times = []
for _ in range(200):
    t = time.perf_counter()
    requests.post(URL, json=body, timeout=10)
    times.append((time.perf_counter() - t) * 1000)
times.sort()
print(f"requests=200  p50={statistics.median(times):.1f} ms  p95={times[int(0.95 * len(times))]:.1f} ms  max={times[-1]:.1f} ms")
