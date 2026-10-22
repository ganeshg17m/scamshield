import { useEffect, useState } from "react";

const API = import.meta.env?.VITE_API || "http://localhost:8000";

async function api(path, method = "GET", body) {
  const res = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
const DECISION_TEXT = { block: "BLOCK", hold: "HOLD", step_up: "STEP-UP", allow: "ALLOW" };

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function Countdown({ deadline }) {
  const now = useNow();
  const left = Math.max(0, deadline - now);
  const m = String(Math.floor(left / 60000)).padStart(2, "0");
  const s = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");
  return <div className={"countdown" + (left < 180000 ? " low" : "")}>{m}:{s}</div>;
}

function Reasons({ reasons }) {
  const max = Math.max(...reasons.map((r) => r.impact), 0.01);
  return (
    <div>
      {reasons.map((r) => (
        <div className="reason" key={r.feature}>
          <div style={{ width: 230 }}>{r.label}</div>
          <div className="bar" style={{ width: Math.max(8, (r.impact / max) * 120) }} />
          <span className="muted">+{r.impact}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Tab 1: live alerts ---------------- */
function AlertsTab({ onRing, onCase }) {
  const [alerts, setAlerts] = useState([]);
  const [last, setLast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = () => api("/v1/alerts").then(setAlerts).catch((e) => setErr(String(e.message)));
  useEffect(() => {
    load();
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, []);

  const simulate = async (kind) => {
    setBusy(true); setErr("");
    try { setLast(await api("/v1/demo/simulate?kind=" + kind, "POST")); await load(); }
    catch (e) { setErr(String(e.message)); }
    setBusy(false);
  };
  const reset = async () => { await api("/v1/demo/reset", "POST"); setLast(null); load(); };

  return (
    <div>
      <div className="card row">
        <button className="btn red" disabled={busy} onClick={() => simulate("fraud")}>⚠ Simulate fraud transaction</button>
        <button className="btn gray" disabled={busy} onClick={() => simulate("normal")}>Simulate normal transaction</button>
        <button className="btn gray small" onClick={reset}>Reset demo</button>
        {last && (
          <span className="small muted">
            Last: {inr(last.amount)} {last.fromAcc} → {last.toAcc} · score <b>{last.score}</b> ·{" "}
            <span className={"badge b-" + last.decision}>{DECISION_TEXT[last.decision]}</span> · scored in {last.latency_ms} ms
          </span>
        )}
      </div>
      {err && <div className="err">Backend error: {err}. Is the API running on port 8000?</div>}
      {alerts.length === 0 && <div className="card muted">No alerts yet. Click “Simulate fraud transaction”.</div>}
      {alerts.map((a) => (
        <div className="card alert" key={a.alertId}>
          <div>
            <div className="score" style={{ color: a.score >= 85 ? "#ef4444" : "#f59e0b" }}>{a.score}</div>
            <div style={{ textAlign: "center" }}><span className={"badge b-" + a.decision}>{DECISION_TEXT[a.decision]}</span></div>
          </div>
          <div>
            <div><b>{inr(a.amount)}</b> &nbsp; {a.fromAcc} → <b>{a.toAcc}</b> <span className="muted small">· {a.alertId}</span></div>
            <div className="small muted" style={{ margin: "4px 0" }}>Why this was flagged (SHAP):</div>
            <Reasons reasons={a.reasons} />
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn small" onClick={() => onRing(a.toAcc)}>View mule ring</button>
              <button className="btn small gray" onClick={() => onCase(a)}>{a.caseId ? "Open " + a.caseId : "Open case"}</button>
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div className="small muted">Freeze window left</div>
            <Countdown deadline={a.freezeDeadlineMs} />
            <div className="small muted">victim + bank notified (simulated)</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Tab 2: mule graph ---------------- */
const ROLE_COLOR = { victims: "#ef4444", victim: "#ef4444", collector: "#f59e0b", mule: "#eab308", cashout: "#a855f7" };

function GraphTab({ account, setAccount }) {
  const [input, setInput] = useState(account || "MULE_01");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  const run = (acc) => {
    setErr("");
    api("/v1/graph/trace?account=" + encodeURIComponent(acc)).then(setData).catch((e) => setErr(String(e.message)));
  };
  useEffect(() => { if (account) { setInput(account); run(account); } }, [account]);

  const W = 1000, H = 430;
  let pos = {};
  if (data && data.found) {
    const maxL = Math.max(...data.nodes.map((n) => n.layer), 1);
    const layers = {};
    data.nodes.forEach((n) => { (layers[n.layer] = layers[n.layer] || []).push(n); });
    Object.entries(layers).forEach(([l, arr]) => {
      arr.sort((a, b) => a.id.localeCompare(b.id));
      arr.forEach((n, i) => { pos[n.id] = { x: 70 + (Number(l) * (W - 140)) / maxL, y: ((i + 1) * H) / (arr.length + 1) }; });
    });
  }
  const st = data && data.stats;

  return (
    <div>
      <div className="card row">
        <input style={{ maxWidth: 260 }} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Account e.g. MULE_01" />
        <button className="btn" onClick={() => { setAccount(input); run(input); }}>Trace money trail</button>
        <span className="small muted">Try MULE_01, or the receiver account from an alert.</span>
      </div>
      {err && <div className="err">{err}</div>}
      {data && !data.found && <div className="card muted">No suspicious network found for “{data.query}”.</div>}
      {data && data.found && (
        <>
          <div className="grid4" style={{ marginBottom: 14 }}>
            <div className="stat"><b>{st.ring_accounts}</b><span>ring accounts</span></div>
            <div className="stat"><b>{st.shared_devices}</b><span>shared devices</span></div>
            <div className="stat"><b>{st.victims}</b><span>victims</span></div>
            <div className="stat"><b>{inr(st.money_in)}</b><span>money received</span></div>
            <div className="stat"><b>{st.hops}</b><span>hops to cash-out</span></div>
            <div className="stat"><b>{st.cashout.join(", ")}</b><span>cash-out account</span></div>
          </div>
          <div className="card" style={{ overflowX: "auto" }}>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 700 }}>
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#5b6b8c" />
                </marker>
              </defs>
              {data.edges.map((e, i) => {
                const a = pos[e.src], b = pos[e.dst];
                if (!a || !b) return null;
                return (
                  <g key={i}>
                    <line x1={a.x + 55} y1={a.y} x2={b.x - 55} y2={b.y} stroke="#5b6b8c" strokeWidth="1.5" markerEnd="url(#arrow)" />
                    <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4} textAnchor="middle" style={{ fill: "#8a9bb8" }}>
                      {inr(e.amount / 1000)}k
                    </text>
                  </g>
                );
              })}
              {data.nodes.map((n) => {
                const p = pos[n.id];
                if (!p) return null;
                const isQ = n.id === data.query;
                return (
                  <g key={n.id} onClick={() => { if (n.role !== "victims") setAccount(n.id); }} style={{ cursor: "pointer" }}>
                    <rect x={p.x - 55} y={p.y - 18} width="110" height="36" rx="8" fill={ROLE_COLOR[n.role]} fillOpacity="0.25"
                      stroke={isQ ? "#ffffff" : ROLE_COLOR[n.role]} strokeWidth={isQ ? 3 : 1.5} />
                    <text x={p.x} y={p.y - 2} textAnchor="middle" style={{ fontWeight: 700 }}>{n.label}</text>
                    <text x={p.x} y={p.y + 11} textAnchor="middle" style={{ fill: "#8a9bb8", fontSize: 10 }}>{n.role}</text>
                  </g>
                );
              })}
            </svg>
            <div className="small muted">Left → right = direction of money. Shared devices: {st.devices.join(", ")}. Click a node to re-trace.</div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- Tab 3: cases + copilot ---------------- */
function CasesTab({ selected, setSelected }) {
  const [cases, setCases] = useState([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const load = () => api("/v1/cases").then(setCases);
  useEffect(() => { load(); }, [selected]);
  const c = cases.find((x) => x.caseId === selected);

  const ask = async () => { setBusy(true); try { await api(`/v1/cases/${c.caseId}/copilot`, "POST"); await load(); } catch (e) { alert(e.message); } setBusy(false); };
  const addNote = async () => { if (!note.trim()) return; await api(`/v1/cases/${c.caseId}/notes`, "POST", { text: note }); setNote(""); load(); };
  const fb = async (label) => { await api("/v1/feedback", "POST", { caseId: c.caseId, label }); load(); };

  return (
    <div className="split">
      <div>
        {cases.length === 0 && <div className="card muted small">No cases yet. Open one from an alert.</div>}
        {cases.map((x) => (
          <div key={x.caseId} className={"item" + (x.caseId === selected ? " sel" : "")} onClick={() => setSelected(x.caseId)}>
            <b>{x.caseId}</b> <span className="muted small">· {x.status}</span>
            <div className="small muted">{inr(x.amount)} · score {x.score}</div>
          </div>
        ))}
      </div>
      <div>
        {!c && <div className="card muted">Select a case.</div>}
        {c && (
          <>
            <div className="card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div><b style={{ fontSize: 18 }}>{c.caseId}</b> <span className="badge b-hold">{c.status}</span></div>
                <div className="small muted">{c.accounts[0]} → {c.accounts[1]} · {inr(c.amount)}</div>
              </div>
              <div className="small muted" style={{ margin: "8px 0 4px" }}>Model reasons</div>
              <Reasons reasons={c.reasons} />
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn" disabled={busy} onClick={ask}>{busy ? "Thinking…" : "✨ Ask AI copilot"}</button>
                <button className="btn green small" onClick={() => fb("true_positive")}>Confirm fraud (true positive)</button>
                <button className="btn gray small" onClick={() => fb("false_positive")}>False alarm</button>
              </div>
              {c.feedback && <div className="small muted" style={{ marginTop: 6 }}>Analyst label saved: {c.feedback} (used for retraining)</div>}
            </div>
            {c.summary && (
              <div className="card">
                <div className="small muted">Copilot draft · source: {c.summary.method} · a human analyst must approve every action</div>
                <p>{c.summary.summary}</p>
                <b>Suggested next actions</b>
                <ol>{c.summary.next_actions.map((a, i) => <li key={i}>{a}</li>)}</ol>
                <b>Similar past cases (cited)</b>
                {c.summary.similar_cases.map((s) => (
                  <div key={s.id} className="small" style={{ margin: "6px 0" }}>
                    <b>{s.id}</b> — {s.text} <span className="muted">Outcome: {s.outcome}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="card">
              <b>Notes</b>
              {c.notes.map((n, i) => <div key={i} className="small muted">• {n.text}</div>)}
              <div className="row" style={{ marginTop: 8 }}>
                <input style={{ flex: 1 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" />
                <button className="btn small gray" onClick={addNote}>Add</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- Tab 4: scam message checker ---------------- */
const SAMPLES = [
  "Dear customer your SBI KYC expires today, click http://sbi-kyc.xyz to avoid account block",
  "Aapka bijli bill pending hai, aaj raat 9 baje connection kat jayega. Turant 9876543210 par call karein",
  "आपका खाता बंद हो जाएगा, तुरंत KYC अपडेट करें http://bit.ly/abc",
  "Your OTP for HDFC login is 482913. Do not share with anyone.",
  "Bhai kal 7 baje chai pe milte hain",
];

function MessageTab() {
  const [text, setText] = useState("");
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const check = async (t) => { setBusy(true); try { setRes(await api("/v1/classify-text", "POST", { text: t })); } catch (e) { alert(e.message); } setBusy(false); };

  return (
    <div>
      <div className="card">
        <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a suspicious SMS / WhatsApp message (English, Hindi or Hinglish)…" />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" disabled={busy || !text.trim()} onClick={() => check(text)}>{busy ? "Checking…" : "Check message"}</button>
          <span className="small muted">Try an example:</span>
          {SAMPLES.map((s, i) => <button key={i} className="btn gray small" onClick={() => { setText(s); check(s); }}>Example {i + 1}</button>)}
        </div>
      </div>
      {res && (
        <div className="card">
          <div className="row">
            <span className={"badge " + (res.label === "scam" ? "b-block" : "b-allow")} style={{ fontSize: 16 }}>{res.label === "scam" ? "SCAM" : "LOOKS LEGIT"}</span>
            <span>type: <b>{res.scam_type}</b></span>
            <span>language: <b>{res.language}</b></span>
            <span>confidence: <b>{Math.round((res.confidence || 0) * 100)}%</b></span>
            <span className="chip">{res.method}</span>
          </div>
          <ul>{(res.reasons || []).map((r, i) => <li key={i}>{r}</li>)}</ul>
          {res.label === "scam" && <div className="small muted">If you already paid, call 1930 immediately and report at cybercrime.gov.in — the first minutes matter.</div>}
        </div>
      )}
    </div>
  );
}

/* ---------------- App shell ---------------- */
export default function App() {
  const [tab, setTab] = useState("alerts");
  const [ringAcc, setRingAcc] = useState("");
  const [selCase, setSelCase] = useState("");
  const [metrics, setMetrics] = useState(null);
  useEffect(() => { api("/v1/metrics").then(setMetrics).catch(() => {}); }, []);

  const openRing = (acc) => { setRingAcc(acc); setTab("graph"); };
  const openCase = async (a) => {
    const c = await api("/v1/cases?alertId=" + a.alertId, "POST");
    setSelCase(c.caseId); setTab("cases");
  };
  const TABS = [["alerts", "Live alerts"], ["graph", "Mule network"], ["cases", "Cases & AI copilot"], ["message", "Check a message"]];

  return (
    <>
      <header>
        <div>
          <h1>Scam<span>Shield</span></h1>
          <div className="sub">Real-time fraud detection + mule-network intelligence</div>
        </div>
        <div className="chips">
          {metrics && <span className="chip">PR-AUC {metrics.pr_auc} · recall@1% FPR {metrics.recall_at_1pct_fpr} (synthetic data)</span>}
          <span className="chip">Data: synthetic only</span>
        </div>
      </header>
      <nav>
        {TABS.map(([k, label]) => <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{label}</button>)}
      </nav>
      <main>
        {tab === "alerts" && <AlertsTab onRing={openRing} onCase={openCase} />}
        {tab === "graph" && <GraphTab account={ringAcc} setAccount={setRingAcc} />}
        {tab === "cases" && <CasesTab selected={selCase} setSelected={setSelCase} />}
        {tab === "message" && <MessageTab />}
      </main>
    </>
  );
}
