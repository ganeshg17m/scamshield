import { Fragment, useEffect, useMemo, useState } from "react";

const API = import.meta.env?.VITE_API || (import.meta.env.DEV ? "http://localhost:8000" : "");

async function api(path, method = "GET", body) {
  if (!API) {
    throw new Error("This frontend-only deployment has no backend API configured.");
  }
  const res = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const inr = (amount) => "₹" + Math.round(amount || 0).toLocaleString("en-IN");
const DECISION_TEXT = { block: "Blocked", hold: "Hold", step_up: "Step-up", allow: "Allowed" };
const NAV_ITEMS = [
  { id: "alerts", label: "Overview", detail: "Live alerts", icon: "overview" },
  { id: "graph", label: "Mule network", detail: "Trace money flows", icon: "network" },
  { id: "cases", label: "Cases & copilot", detail: "Investigations", icon: "cases" },
  { id: "message", label: "Message scanner", detail: "Check suspicious text", icon: "message" },
  { id: "study", label: "Case study", detail: "Anonymized complaint", icon: "shield" },
];

const PAGE_COPY = {
  alerts: ["Security overview", "Monitor transaction risk and review active alerts."],
  graph: ["Mule network", "Explore suspicious flows and linked accounts."],
  cases: ["Cases & AI copilot", "Review evidence and organize investigations."],
  message: ["Message scanner", "Check a suspicious message for scam signals."],
  study: ["Anonymized case study", "A privacy-preserving overview of a user-provided complaint."],
};

const SAMPLES = [
  "Dear customer your SBI KYC expires today, click http://sbi-kyc.xyz to avoid account block",
  "Aapka bijli bill pending hai, aaj raat 9 baje connection kat jayega. Turant 9876543210 par call karein",
  "आपका खाता बंद हो जाएगा, तुरंत KYC अपडेट करें http://bit.ly/abc",
  "Your OTP for HDFC login is 482913. Do not share with anyone.",
  "Bhai kal 7 baje chai pe milte hain",
];

function Icon({ name, size = 18 }) {
  const paths = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    network: <><circle cx="12" cy="5" r="2.5" /><circle cx="5" cy="18" r="2.5" /><circle cx="19" cy="18" r="2.5" /><path d="m10.8 7.2-4.5 8.5m6.9-8.5 4.5 8.5M7.5 18h9" /></>,
    cases: <><path d="M4 7.5h16a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 19V9A1.5 1.5 0 0 1 4 7.5Z" /><path d="M8 7.5V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2.5M8 12h8m-8 4h5" /></>,
    message: <><path d="M4 4.5h16A1.5 1.5 0 0 1 21.5 6v11a1.5 1.5 0 0 1-1.5 1.5H9l-5.5 3V6A1.5 1.5 0 0 1 5 4.5Z" /><path d="M8 10h8m-8 4h5" /></>,
    shield: <><path d="M12 2.5 20 6v5.5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3.5Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.shield}</svg>;
}

function Button({ children, className = "", ...props }) {
  return <button className={`btn ${className}`} {...props}>{children}</button>;
}

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
  const minutes = String(Math.floor(left / 60000)).padStart(2, "0");
  const seconds = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");
  return <span className={`countdown${left < 180000 ? " low" : ""}`}>{minutes}:{seconds}</span>;
}

function Reasons({ reasons = [] }) {
  if (!reasons.length) return <p className="muted small">No positive model signals were returned for this transaction.</p>;
  const max = Math.max(...reasons.map((reason) => reason.impact), 0.01);
  return (
    <div className="reason-list">
      {reasons.map((reason) => (
        <div className="reason" key={reason.feature}>
          <span>{reason.label}</span>
          <span className="reason-track"><span style={{ width: `${Math.max(6, (reason.impact / max) * 100)}%` }} /></span>
          <b>+{reason.impact}</b>
        </div>
      ))}
    </div>
  );
}

function ErrorBanner({ children }) {
  if (!children) return null;
  return <div className="error-banner" role="alert"><span className="error-icon">!</span><span>{children}</span></div>;
}

function MetricCard({ label, value, note, icon, tone = "" }) {
  return (
    <article className="metric-card">
      <div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}><Icon name={icon} size={17} /></span></div>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function riskName(score) {
  if (score >= 85) return "critical";
  if (score >= 60) return "high";
  if (score >= 30) return "medium";
  return "low";
}

function AlertsTab({ onRing, onCase, notify }) {
  const [alerts, setAlerts] = useState([]);
  const [last, setLast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState("");

  const load = async () => {
    try {
      setAlerts(await api("/v1/alerts"));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  const simulate = async (kind) => {
    setBusy(true);
    setError("");
    try {
      const result = await api(`/v1/demo/simulate?kind=${kind}`, "POST");
      setLast(result);
      await load();
      notify(kind === "fraud" ? "Demo fraud transaction simulated." : "Demo normal transaction simulated.", "success");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!window.confirm("Reset the demo? This clears current alerts and cases from the running session.")) return;
    setBusy(true);
    try {
      await api("/v1/demo/reset", "POST");
      setLast(null);
      setExpanded("");
      await load();
      notify("Demo state reset.", "success");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(() => alerts.filter((alert) => {
    const search = `${alert.txnId} ${alert.fromAcc} ${alert.toAcc} ${alert.alertId}`.toLowerCase();
    return search.includes(query.toLowerCase()) &&
      (filter === "all" || (filter === "critical" ? alert.score >= 85 : filter === "review" ? !alert.caseId : alert.decision === filter));
  }), [alerts, query, filter]);
  const highRisk = alerts.filter((alert) => alert.score >= 85).length;
  const blocked = alerts.filter((alert) => alert.decision === "block").length;
  const awaitingReview = alerts.filter((alert) => !alert.caseId).length;
  const distribution = [
    { name: "Critical", count: alerts.filter((alert) => alert.score >= 85).length, tone: "critical" },
    { name: "High", count: alerts.filter((alert) => alert.score >= 60 && alert.score < 85).length, tone: "high" },
    { name: "Medium", count: alerts.filter((alert) => alert.score >= 30 && alert.score < 60).length, tone: "medium" },
    { name: "Low", count: alerts.filter((alert) => alert.score < 30).length, tone: "low" },
  ];

  return (
    <section className="page-stack">
      <div className="toolbar-card">
        <div>
          <span className="eyebrow">DEMO CONTROLS</span>
          <p className="muted small">Create synthetic transactions to explore risk decisions.</p>
        </div>
        <div className="toolbar-actions">
          <Button className="danger-button" onClick={() => simulate("fraud")} disabled={busy}><Icon name="shield" size={16} />{busy ? "Running…" : "Simulate fraud"}</Button>
          <Button className="secondary-button" onClick={() => simulate("normal")} disabled={busy}>Simulate normal</Button>
          <Button className="quiet-button" onClick={reset} disabled={busy}>Reset demo</Button>
        </div>
      </div>
      {last && (
        <div className="last-result">
          <span className={`risk-dot ${riskName(last.score)}`} />
          <span><b>Latest simulation</b> · {inr(last.amount)} · {last.fromAcc} → {last.toAcc}</span>
          <span className={`badge ${riskName(last.score)}`}>{last.score} / 100 · {DECISION_TEXT[last.decision]}</span>
          <span className="muted small">{last.latency_ms} ms</span>
        </div>
      )}
      <ErrorBanner>{error}</ErrorBanner>
      <div className="metrics-grid">
        <MetricCard label="Total alerts" value={alerts.length} note="Current demo session" icon="overview" />
        <MetricCard label="Critical risk" value={highRisk} note="Risk score ≥ 85" icon="shield" tone="red" />
        <MetricCard label="Blocked" value={blocked} note="Model decision: block" icon="cases" tone="orange" />
        <MetricCard label="Needs review" value={awaitingReview} note="No case opened yet" icon="message" tone="blue" />
      </div>
      <div className="panel risk-panel">
        <div className="section-heading">
          <div><span className="eyebrow">RISK DISTRIBUTION</span><h2>Alert severity</h2></div>
          <span className="muted small">Current alerts only</span>
        </div>
        {alerts.length ? (
          <div className="distribution-list">
            {distribution.map((item) => (
              <div className="distribution-row" key={item.name}>
                <span className={`distribution-marker ${item.tone}`} />
                <span>{item.name}</span><b>{item.count}</b>
                <span className="distribution-track"><span className={item.tone} style={{ width: `${(item.count / alerts.length) * 100}%` }} /></span>
              </div>
            ))}
          </div>
        ) : <p className="empty-inline">Simulate a transaction to populate the severity distribution.</p>}
      </div>
      <div className="panel">
        <div className="section-heading list-heading">
          <div><span className="eyebrow">MONITORING</span><h2>Live alerts <span className="count-pill">{alerts.length}</span></h2></div>
          <div className="filter-controls">
            <label className="search-box"><Icon name="search" size={16} /><input aria-label="Search alerts" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search account or transaction" /></label>
            <select aria-label="Filter alerts" value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">All alerts</option><option value="critical">Critical risk</option><option value="block">Blocked</option><option value="hold">On hold</option><option value="review">Needs review</option>
            </select>
          </div>
        </div>
        {!alerts.length && <div className="empty-state"><span className="empty-icon"><Icon name="shield" size={23} /></span><h3>No active alerts</h3><p>Run a synthetic fraud simulation to see model explanations and response actions here.</p></div>}
        {alerts.length > 0 && !filtered.length && <p className="empty-inline">No alerts match this search and filter.</p>}
        {filtered.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Transaction</th><th>Accounts</th><th>Amount</th><th>Risk</th><th>Decision</th><th>Freeze window</th><th aria-label="Expand details" /></tr></thead>
              <tbody>{filtered.map((alert) => (
                <Fragment key={alert.alertId}>
                  <tr key={alert.alertId} className={expanded === alert.alertId ? "row-expanded" : ""}>
                    <td><b>{alert.txnId}</b><small>{alert.alertId} · {new Date(alert.createdMs).toLocaleTimeString()}</small></td>
                    <td><span>{alert.fromAcc}</span><small className="account-destination">to {alert.toAcc}</small></td>
                    <td className="amount-cell">{inr(alert.amount)}</td>
                    <td><span className={`badge ${riskName(alert.score)}`}>{riskName(alert.score)} · {alert.score}</span></td>
                    <td><span className={`status-pill ${alert.decision}`}>{DECISION_TEXT[alert.decision] || alert.decision}</span></td>
                    <td><Countdown deadline={alert.freezeDeadlineMs} /></td>
                    <td><Button className="icon-button" aria-label={`${expanded === alert.alertId ? "Hide" : "Show"} details for ${alert.txnId}`} onClick={() => setExpanded(expanded === alert.alertId ? "" : alert.alertId)}>{expanded === alert.alertId ? "−" : "+"}</Button></td>
                  </tr>
                  {expanded === alert.alertId && <tr className="details-row" key={`${alert.alertId}-details`}><td colSpan="7">
                    <div className="expanded-details">
                      <div><span className="eyebrow">MODEL SIGNALS</span><Reasons reasons={alert.reasons} /></div>
                      <div className="detail-actions"><span className="eyebrow">INVESTIGATION ACTIONS</span><div className="toolbar-actions">
                        <Button className="secondary-button" onClick={() => onRing(alert.toAcc)}>Inspect mule network</Button>
                        <Button className="primary-button" onClick={() => onCase(alert)}>{alert.caseId ? `Open ${alert.caseId}` : "Open case"}</Button>
                      </div><small className="muted">Freeze period is a demo countdown; no real transfer is blocked.</small></div>
                    </div>
                  </td></tr>}
                </Fragment>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

const ROLE_COLOR = { victims: "#f87171", victim: "#f87171", collector: "#f59e0b", mule: "#eab308", cashout: "#a78bfa" };

function GraphTab({ account, setAccount }) {
  const [input, setInput] = useState(account || "MULE_01");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);

  const run = async (value = input) => {
    const next = value.trim();
    if (!next) {
      setError("Enter an account ID to trace.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await api(`/v1/graph/trace?account=${encodeURIComponent(next)}`);
      setData(result);
      setSelectedNode(result.nodes?.find((node) => node.id === next) || null);
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (account) {
      setInput(account);
      run(account);
    }
  }, [account]);

  const W = 1080;
  const H = Math.max(420, (data?.nodes?.length || 0) * 38);
  const positions = {};
  if (data?.found) {
    const layers = {};
    data.nodes.forEach((node) => { (layers[node.layer] ||= []).push(node); });
    const keys = Object.keys(layers).map(Number);
    const maxLayer = Math.max(...keys, 1);
    Object.entries(layers).forEach(([layer, nodes]) => {
      nodes.sort((a, b) => a.id.localeCompare(b.id));
      nodes.forEach((node, index) => {
        positions[node.id] = { x: 90 + (Number(layer) * (W - 180)) / maxLayer, y: ((index + 1) * H) / (nodes.length + 1) };
      });
    });
  }

  return (
    <section className="page-stack">
      <div className="panel graph-search-panel">
        <div className="search-intro"><span className="eyebrow">NETWORK INVESTIGATION</span><h2>Trace suspicious money flows</h2><p className="muted">Search for an account from a demo alert or explore the seeded synthetic mule ring.</p></div>
        <form className="trace-form" onSubmit={(event) => { event.preventDefault(); const next = input.trim(); if (!next || next === account) run(next); else setAccount(next); }}>
          <label className="search-box"><Icon name="search" size={17} /><input aria-label="Account ID" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Account, e.g. MULE_01" /></label>
          <Button className="primary-button" disabled={loading}>{loading ? "Tracing…" : "Trace money trail"} <Icon name="arrow" size={16} /></Button>
        </form>
      </div>
      <ErrorBanner>{error}</ErrorBanner>
      {data?.found && (
        <>
          <div className="metrics-grid graph-metrics">
            <MetricCard label="Ring accounts" value={data.stats.ring_accounts} note="Connected suspicious accounts" icon="network" />
            <MetricCard label="Shared devices" value={data.stats.shared_devices} note="Devices linked in ring" icon="cases" />
            <MetricCard label="Victims" value={data.stats.victims} note="Distinct source accounts" icon="overview" tone="red" />
            <MetricCard label="Money received" value={inr(data.stats.money_in)} note="Synthetic flagged flow" icon="message" tone="orange" />
            <MetricCard label="Hops to cash-out" value={data.stats.hops} note="Along traced money flow" icon="arrow" />
            <MetricCard label="Cash-out" value={data.stats.cashout.join(", ") || "—"} note={`Devices: ${data.stats.devices.join(", ") || "—"}`} icon="shield" tone="blue" />
          </div>
          <div className="panel">
            <div className="section-heading">
              <div><span className="eyebrow">SYNTHETIC TRANSACTION GRAPH</span><h2>Money flow <span className="count-pill">{data.nodes.length} nodes</span></h2></div>
              <div className="legend">{Object.entries(ROLE_COLOR).filter(([role]) => role !== "victim").map(([role, color]) => <span key={role}><i style={{ background: color }} />{role}</span>)}</div>
            </div>
            <div className="graph-scroll">
              <svg className="network-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Money flow graph for ${data.query}`}>
                <defs><marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#52647f" /></marker></defs>
                {data.edges.map((edge, index) => {
                  const from = positions[edge.src], to = positions[edge.dst];
                  if (!from || !to) return null;
                  return <g key={`${edge.src}-${edge.dst}-${index}`}><line x1={from.x + 61} y1={from.y} x2={to.x - 61} y2={to.y} markerEnd="url(#flow-arrow)" className="graph-edge" /><text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 8} className="edge-label">{inr(edge.amount)}</text></g>;
                })}
                {data.nodes.map((node) => {
                  const point = positions[node.id];
                  if (!point) return null;
                  const color = ROLE_COLOR[node.role] || "#94a3b8";
                  return <g key={node.id} className="graph-node" tabIndex="0" role="button" aria-label={`${node.id}, ${node.role}; select to trace`} onClick={() => { if (node.role !== "victims") { setSelectedNode(node); setInput(node.id); if (node.id === account) run(node.id); else setAccount(node.id); } }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (node.role !== "victims") { setSelectedNode(node); setInput(node.id); if (node.id === account) run(node.id); else setAccount(node.id); } } }}>
                    <title>{`${node.id} · ${node.role} · devices: ${node.devices.join(", ") || "none listed"}`}</title>
                    <rect x={point.x - 60} y={point.y - 20} width="120" height="40" rx="10" fill={`${color}18`} stroke={selectedNode?.id === node.id ? "#f1f5f9" : color} strokeWidth={selectedNode?.id === node.id ? 2.5 : 1.4} />
                    <text x={point.x} y={point.y - 2} textAnchor="middle" className="node-label">{node.label}</text>
                    <text x={point.x} y={point.y + 12} textAnchor="middle" className="node-role">{node.role}</text>
                  </g>;
                })}
              </svg>
            </div>
            <p className="graph-caption"><span>← Source accounts</span><span>Direction of money flow</span><span>Cash-out →</span></p>
            {selectedNode && <div className="node-detail"><b>{selectedNode.id}</b><span className={`role-chip ${selectedNode.role}`}>{selectedNode.role}</span><span className="muted small">Linked devices: {selectedNode.devices?.join(", ") || "not listed"}</span></div>}
          </div>
        </>
      )}
      {data && !data.found && <div className="empty-state panel"><span className="empty-icon"><Icon name="network" size={23} /></span><h3>No suspicious network found</h3><p>No flagged connections were returned for <b>{data.query}</b>. Try MULE_01 or an alert’s receiver account.</p></div>}
      {!data && !loading && !error && <div className="empty-state panel"><span className="empty-icon"><Icon name="network" size={23} /></span><h3>Start a network trace</h3><p>Enter MULE_01 to explore the generated demo ring, or use a receiver from a live alert.</p></div>}
    </section>
  );
}

function CasesTab({ selected, setSelected, notify }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setCases(await api("/v1/cases"));
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);
  const currentCase = cases.find((item) => item.caseId === selected);
  const filtered = cases.filter((item) => `${item.caseId} ${item.accounts?.join(" ")}`.toLowerCase().includes(query.toLowerCase()));

  const ask = async () => {
    setBusy(true);
    try {
      await api(`/v1/cases/${currentCase.caseId}/copilot`, "POST");
      await load();
      notify("Investigator draft generated. Review it before taking action.", "success");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const addNote = async () => {
    if (!note.trim()) return;
    setBusy(true);
    try {
      await api(`/v1/cases/${currentCase.caseId}/notes`, "POST", { text: note.trim() });
      setNote("");
      await load();
      notify("Investigation note saved.", "success");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const saveFeedback = async (label) => {
    const verb = label === "true_positive" ? "confirm this as fraud" : "mark this as a false alarm";
    if (!window.confirm(`Are you sure you want to ${verb}? This records an analyst label and closes the case.`)) return;
    setBusy(true);
    try {
      await api("/v1/feedback", "POST", { caseId: currentCase.caseId, label });
      await load();
      notify("Analyst decision recorded; case closed.", "success");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="page-stack">
      <ErrorBanner>{error}</ErrorBanner>
      <div className="case-workspace">
        <aside className="panel case-list">
          <div className="section-heading"><div><span className="eyebrow">INVESTIGATIONS</span><h2>Case queue <span className="count-pill">{cases.length}</span></h2></div></div>
          <label className="search-box"><Icon name="search" size={16} /><input aria-label="Search cases" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a case" /></label>
          {loading && <p className="empty-inline">Loading cases…</p>}
          {!loading && !cases.length && <p className="empty-inline">No cases yet. Open one from a live alert.</p>}
          {!!cases.length && !filtered.length && <p className="empty-inline">No cases match your search.</p>}
          <div className="case-list-items">{filtered.map((item) => (
            <button type="button" key={item.caseId} className={`case-item${item.caseId === selected ? " selected" : ""}`} onClick={() => setSelected(item.caseId)}>
              <span className="case-item-top"><b>{item.caseId}</b><span className={`case-status ${item.status}`}>{item.status}</span></span>
              <span className="case-item-bottom">{inr(item.amount)} <span>·</span> Risk {item.score}</span>
              <span className="case-account">{item.accounts?.[0]} → {item.accounts?.[1]}</span>
            </button>
          ))}</div>
        </aside>
        <div className="case-detail-column">
          {!currentCase && <div className="empty-state panel"><span className="empty-icon"><Icon name="cases" size={22} /></span><h3>Select an investigation</h3><p>Choose a case to review its transaction, model signals, and investigation notes.</p></div>}
          {currentCase && (
            <>
              <div className="panel">
                <div className="case-title-row"><div><span className="eyebrow">CASE FILE</span><h2>{currentCase.caseId}</h2></div><span className={`case-status large ${currentCase.status}`}>{currentCase.status}</span></div>
                <div className="case-facts">
                  <div><span>Transaction amount</span><b>{inr(currentCase.amount)}</b></div>
                  <div><span>Risk score</span><b className={`risk-text ${riskName(currentCase.score)}`}>{currentCase.score}<small> / 100</small></b></div>
                  <div><span>Source account</span><b>{currentCase.accounts[0]}</b></div>
                  <div><span>Destination account</span><b>{currentCase.accounts[1]}</b></div>
                </div>
                <div className="subsection"><span className="eyebrow">EXPLAINABLE MODEL SIGNALS</span><Reasons reasons={currentCase.reasons} /></div>
                <div className="toolbar-actions case-actions">
                  <Button className="primary-button" onClick={ask} disabled={busy}>{busy ? "Generating…" : "Generate copilot draft"}</Button>
                  <Button className="secondary-button" onClick={() => saveFeedback("true_positive")} disabled={busy || Boolean(currentCase.feedback)}>Confirm fraud</Button>
                  <Button className="quiet-button" onClick={() => saveFeedback("false_positive")} disabled={busy || Boolean(currentCase.feedback)}>False alarm</Button>
                </div>
                {currentCase.feedback && <div className="feedback-banner"><Icon name="shield" size={16} />Analyst label recorded: <b>{currentCase.feedback === "true_positive" ? "Confirmed fraud" : "False alarm"}</b>. Case closed.</div>}
              </div>
              {currentCase.summary && (
                <div className="panel copilot-panel">
                  <div className="section-heading"><div><span className="eyebrow">INVESTIGATOR ASSIST</span><h2>Copilot draft</h2></div><span className="source-chip">{currentCase.summary.method}</span></div>
                  <p className="muted small">AI-generated assistance based on case facts. Verify evidence; a human analyst must approve all consequential actions.</p>
                  <div className="copilot-summary"><b>Case summary</b><p>{currentCase.summary.summary}</p></div>
                  <div className="subsection"><b>Suggested next steps</b><ol className="action-list">{currentCase.summary.next_actions?.map((action, index) => <li key={`${index}-${action}`}>{action}</li>)}</ol></div>
                  {!!currentCase.summary.similar_cases?.length && <div className="subsection"><b>Similar synthetic cases</b>{currentCase.summary.similar_cases.map((item) => <div key={item.id} className="similar-case"><b>{item.id}</b><p>{item.text}</p><small className="muted">Recorded outcome: {item.outcome}</small></div>)}</div>}
                </div>
              )}
              <div className="panel">
                <div className="section-heading"><div><span className="eyebrow">CASE LOG</span><h2>Analyst notes</h2></div></div>
                {!!currentCase.notes?.length ? <div className="notes-list">{currentCase.notes.map((item, index) => <div className="note-item" key={`${item.ts}-${index}`}><span className="note-dot" /><p>{item.text}</p><time>{new Date(item.ts).toLocaleString()}</time></div>)}</div> : <p className="empty-inline">No notes have been added to this case.</p>}
                <div className="note-compose"><label className="sr-only" htmlFor="case-note">Add an investigation note</label><textarea id="case-note" rows="2" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Record a finding or next step…" /><Button className="secondary-button" onClick={addNote} disabled={busy || !note.trim()}>Save note</Button></div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function MessageTab({ notify }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scan = async (value = text) => {
    const content = value.trim();
    if (!content || busy) return;
    setBusy(true);
    setError("");
    try {
      setResult(await api("/v1/classify-text", "POST", { text: content }));
    } catch (err) {
      setError(err.message);
      notify("Message analysis could not be completed.", "error");
    } finally {
      setBusy(false);
    }
  };
  const clear = () => { setText(""); setResult(null); setError(""); };
  const resultTone = result?.label === "scam" ? "critical" : "safe";

  return (
    <section className="page-stack scanner-layout">
      <ErrorBanner>{error}</ErrorBanner>
      <div className="panel scanner-panel">
        <div className="scanner-heading"><span className="scanner-icon"><Icon name="message" size={22} /></span><div><span className="eyebrow">MESSAGE INTELLIGENCE</span><h2>Analyze a suspicious message</h2><p className="muted">Paste an SMS or chat message. Analysis runs through the configured backend.</p></div></div>
        <label className="sr-only" htmlFor="message-input">Message to analyze</label>
        <textarea id="message-input" className="message-input" maxLength={1000} rows={7} value={text} onChange={(event) => setText(event.target.value)} placeholder="Paste a suspicious SMS or WhatsApp message (English, Hindi, or Hinglish)…" />
        <div className="input-meta"><span className={text.length >= 950 ? "limit-warning" : "muted"}>{text.length} / 1000 characters</span><Button className="quiet-button" onClick={clear} disabled={!text && !result}>Clear</Button></div>
        <div className="sample-area"><span className="eyebrow">TRY A SYNTHETIC EXAMPLE</span><div className="sample-chips">{SAMPLES.map((sample, index) => <button type="button" key={index} className="sample-chip" title={sample} onClick={() => { setText(sample); setResult(null); }}>{["KYC alert", "Electricity threat", "Hindi message", "OTP reminder", "Everyday chat"][index]}</button>)}</div></div>
        <div className="scanner-submit"><Button className="primary-button" onClick={() => scan()} disabled={busy || !text.trim()}>{busy ? <><span className="spinner" />Analyzing…</> : <><Icon name="shield" size={16} />Analyze message</>}</Button><span className="muted small">Message content is sent to the configured backend for analysis.</span></div>
      </div>
      {result && (
        <div className={`panel scanner-result ${resultTone}`}>
          <div className="result-heading"><span className={`result-mark ${resultTone}`}>{resultTone === "critical" ? "!" : "✓"}</span><div><span className="eyebrow">ANALYSIS RESULT</span><h2>{result.label === "scam" ? "Scam signals detected" : "No scam signals detected"}</h2></div><span className={`badge ${resultTone}`}>{result.label === "scam" ? "SCAM" : "LOOKS LEGIT"}</span></div>
          <div className="result-metrics"><div><span>Confidence</span><b>{Math.round((result.confidence || 0) * 100)}%</b></div><div><span>Category</span><b>{(result.scam_type || "none").replaceAll("_", " ")}</b></div><div><span>Language</span><b>{result.language || "Not identified"}</b></div><div><span>Detection source</span><b>{result.method || "Not reported"}</b></div></div>
          <div className="subsection"><b>Signals returned by the analyzer</b><ul className="signal-list">{(result.reasons || []).map((reason, index) => <li key={`${index}-${reason}`}>{reason}</li>)}</ul></div>
          {result.label === "scam" && <div className="safety-note"><Icon name="shield" size={17} /><span>Never share your UPI PIN, OTP, or passwords. If you already lost money in India, call <b>1930</b> and report it at <b>cybercrime.gov.in</b>.</span></div>}
          <p className="muted microcopy">This is an automated signal, not proof. Verify independently before taking action. Synthetic/demo system.</p>
        </div>
      )}
      {!result && !error && <div className="scanner-footnote"><Icon name="shield" size={16} /><span>Text is treated as untrusted input and rendered as plain text. Scanner results require a reachable backend.</span></div>}
    </section>
  );
}

const CASE_STUDY_DATA = {
  channels: [
    { label: "UPI", count: 1103, color: "#60a5fa" },
    { label: "NEFT", count: 738, color: "#818cf8" },
    { label: "IMPS", count: 34, color: "#c084fc" },
    { label: "RTGS", count: 13, color: "#f472b6" },
    { label: "Wallet", count: 14, color: "#fb923c" },
    { label: "Credit card", count: 4, color: "#fbbf24" },
    { label: "Debit card", count: 1, color: "#4ade80" },
  ],
  context: [
    { label: "Transaction", count: 3624, color: "#60a5fa" },
    { label: "Bank", count: 8606, color: "#818cf8" },
    { label: "Loan", count: 26, color: "#fb923c" },
    { label: "Investment", count: 3, color: "#c084fc" },
    { label: "1930 helpline", count: 1, color: "#4ade80" },
    { label: "Police", count: 1, color: "#f87171" },
  ],
};

const ILLUSTRATIVE_RING_NODES = [
  { id: "MULE_01", role: "Collector", layer: 0, row: 0 },
  { id: "MULE_02", role: "Collector", layer: 0, row: 1 },
  { id: "MULE_03", role: "Collector", layer: 0, row: 2 },
  { id: "MULE_04", role: "Mule", layer: 1, row: 0 },
  { id: "MULE_05", role: "Mule", layer: 1, row: 1 },
  { id: "MULE_06", role: "Mule", layer: 1, row: 2 },
  { id: "MULE_07", role: "Layer", layer: 2, row: 0 },
  { id: "MULE_08", role: "Layer", layer: 2, row: 1 },
  { id: "MULE_09", role: "Cash-out", layer: 3, row: 0 },
];
const ILLUSTRATIVE_RING_EDGES = [
  ["MULE_01", "MULE_04"], ["MULE_02", "MULE_05"], ["MULE_03", "MULE_06"],
  ["MULE_04", "MULE_07"], ["MULE_05", "MULE_07"], ["MULE_06", "MULE_08"],
  ["MULE_07", "MULE_09"], ["MULE_08", "MULE_09"],
];
const RING_ROLE_COLORS = { Collector: "#f59e0b", Mule: "#fbbf24", Layer: "#a78bfa", "Cash-out": "#f472b6" };

function CaseStudyTab() {
  const [chartGroup, setChartGroup] = useState("channels");
  const [selectedReference, setSelectedReference] = useState(CASE_STUDY_DATA.channels[0]);
  const [selectedRingNode, setSelectedRingNode] = useState("MULE_01");
  const chartItems = CASE_STUDY_DATA[chartGroup];
  const chartTotal = chartItems.reduce((sum, item) => sum + item.count, 0);
  const channelTotal = CASE_STUDY_DATA.channels.reduce((sum, item) => sum + item.count, 0);
  const maxCount = Math.max(...chartItems.map((item) => item.count));
  const selectedShare = chartTotal ? (selectedReference.count / chartTotal) * 100 : 0;
  const ringNodePositions = Object.fromEntries(ILLUSTRATIVE_RING_NODES.map((node) => [
    node.id,
    { x: 80 + node.layer * 230, y: 52 + node.row * 83 },
  ]));
  const connectedRingNodes = new Set(
    ILLUSTRATIVE_RING_EDGES.flatMap(([source, target]) => {
      if (source === selectedRingNode) return [target];
      if (target === selectedRingNode) return [source];
      return [];
    }),
  );
  const ringPath = ILLUSTRATIVE_RING_NODES.find((node) => node.id === selectedRingNode);
  const ringConnections = ILLUSTRATIVE_RING_EDGES.filter(([source, target]) => source === selectedRingNode || target === selectedRingNode);
  const changeChartGroup = (group) => {
    setChartGroup(group);
    setSelectedReference(CASE_STUDY_DATA[group][0]);
  };
  const studySteps = [
    {
      number: "01",
      title: "Start with the report",
      description: "The source is a user-provided complaint document concerning suspected financial fraud. This summary does not establish the allegations or independently verify them.",
    },
    {
      number: "02",
      title: "Review payment-channel references",
      description: "The document references UPI, NEFT, and IMPS. Those references alone do not establish which channel was involved in a particular transaction.",
    },
    {
      number: "03",
      title: "Validate evidence before tracing",
      description: "An investigator would verify transaction records with the relevant financial institutions before linking accounts or inferring a money trail.",
    },
  ];

  return (
    <section className="page-stack study-layout">
      <div className="study-privacy-banner"><Icon name="shield" size={18} /><span><b>Privacy-preserving summary</b><small>The original complaint PDF and identifying details are not included in this project.</small></span><span className="synthetic-stamp">REDACTED</span></div>
      <div className="panel study-hero">
        <div className="study-title"><span className="study-icon"><Icon name="cases" size={23} /></span><div><span className="eyebrow">DOCUMENT-BASED OVERVIEW</span><h2>Reported financial-fraud complaint</h2><p className="muted">A deliberately limited summary of the user-provided complaint record.</p></div></div>
        <p className="study-summary">The source document is a complaint record concerning suspected financial fraud. It references UPI, NEFT, and IMPS payment channels. This project does not publish the complaint itself or reproduce personal, account, transaction, or complaint-reference details.</p>
        <div className="study-tags"><span>Suspected financial fraud</span><span>Payment-channel references: UPI · NEFT · IMPS</span><span>Personal details omitted</span></div>
      </div>
      <div className="metrics-grid study-metrics">
        <MetricCard label="Document pages" value="388" note="Pages in the supplied PDF" icon="cases" />
        <MetricCard label="Payment-channel mentions" value={channelTotal.toLocaleString("en-IN")} note="Counted references in extracted text" icon="network" tone="blue" />
        <MetricCard label="UPI mentions" value="1,103" note="Most frequent listed payment rail" icon="overview" tone="orange" />
        <MetricCard label="Transaction mentions" value="3,624" note="Text mentions, not unique transactions" icon="message" tone="red" />
      </div>
      <div className="panel study-chart-panel">
        <div className="section-heading study-chart-heading">
          <div><span className="eyebrow">DOCUMENT TEXT ANALYSIS</span><h2>What terms appear in the complaint?</h2><p className="muted small">Counts are exact phrase mentions in extracted PDF text—not confirmed events or unique records.</p></div>
          <div className="chart-tabs" role="tablist" aria-label="Choose document mention chart">
            <button type="button" role="tab" aria-selected={chartGroup === "channels"} className={chartGroup === "channels" ? "active" : ""} onClick={() => changeChartGroup("channels")}>Payment channels</button>
            <button type="button" role="tab" aria-selected={chartGroup === "context"} className={chartGroup === "context" ? "active" : ""} onClick={() => changeChartGroup("context")}>Other terms</button>
          </div>
        </div>
        <div className="study-chart-layout">
          <div className="study-chart-wrap">
            <svg className="study-chart" viewBox={`0 0 760 ${chartItems.length * 48 + 16}`} role="group" aria-label={`${chartGroup === "channels" ? "Payment channel" : "Context"} text mention counts`}>
              {chartItems.map((item, index) => {
                const y = index * 48 + 8;
                const width = item.count / maxCount * 465;
                const selected = selectedReference.label === item.label;
                return (
                  <g
                    key={item.label}
                    className={`study-bar${selected ? " selected" : ""}`}
                    role="button"
                    tabIndex="0"
                    aria-label={`${item.label}: ${item.count.toLocaleString("en-IN")} mentions`}
                    aria-pressed={selected}
                    onClick={() => setSelectedReference(item)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedReference(item);
                      }
                    }}
                  >
                    <title>{`${item.label}: ${item.count.toLocaleString("en-IN")} text mentions`}</title>
                    <text x="0" y={y + 17} className="study-chart-label">{item.label}</text>
                    <rect x="150" y={y} width="470" height="25" rx="6" className="study-bar-track" />
                    <rect x="150" y={y} width={Math.max(width, 3)} height="25" rx="6" fill={item.color} className="study-bar-fill" />
                    <text x={Math.min(162 + width, 650)} y={y + 17} className="study-chart-count">{item.count.toLocaleString("en-IN")}</text>
                    <rect x="0" y={y - 4} width="735" height="34" rx="7" className="study-bar-hit" />
                  </g>
                );
              })}
            </svg>
            <div className="study-chart-axis"><span>0 mentions</span><span>Counts from extracted text · select a bar for details</span><span>{maxCount.toLocaleString("en-IN")}</span></div>
          </div>
          <aside className="chart-detail-card" aria-live="polite">
            <span className="eyebrow">SELECTED REFERENCE</span>
            <div className="chart-detail-title"><i style={{ background: selectedReference.color }} /><h3>{selectedReference.label}</h3></div>
            <strong>{selectedReference.count.toLocaleString("en-IN")}</strong>
            <span className="muted small">text mentions</span>
            <div className="share-track"><span style={{ width: `${Math.max(selectedShare, selectedReference.count ? 1 : 0)}%`, background: selectedReference.color }} /></div>
            <p>{selectedShare.toFixed(1)}% of the counted terms in this chart category.</p>
            <small>Share is among listed word/phrase matches only. It is not a share of transactions or alleged loss.</small>
          </aside>
        </div>
        <div className="chart-method"><Icon name="shield" size={15} /><span>Method: case-insensitive, whole-term phrase counts from locally extracted PDF text. Repeated form text may contribute multiple mentions. No individual complaint details are shown.</span></div>
      </div>
      <div className="panel study-network-panel">
        <div className="section-heading study-chart-heading">
          <div><span className="eyebrow">ILLUSTRATIVE DEMO TOPOLOGY</span><h2>How a synthetic mule ring is structured</h2><p className="muted small">Interactive example from ScamShield’s generated demo data—not extracted from or attributed to the complaint.</p></div>
          <span className="synthetic-stamp">SYNTHETIC ONLY</span>
        </div>
        <div className="ring-legend">{Object.entries(RING_ROLE_COLORS).map(([role, color]) => <span key={role}><i style={{ background: color }} />{role}</span>)}</div>
        <div className="ring-graph-scroll">
          <svg className="ring-graph" viewBox="0 0 820 310" role="group" aria-label="Illustrative synthetic mule network with nine demo accounts">
            <defs><marker id="demo-ring-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#52647f" /></marker></defs>
            {[0, 1, 2, 3].map((layer) => <g key={layer}><line x1={80 + layer * 230} y1="18" x2={80 + layer * 230} y2="285" className="ring-layer-line" /><text x={80 + layer * 230} y="302" textAnchor="middle" className="ring-layer-label">{["COLLECTORS", "MULE ACCOUNTS", "LAYER ACCOUNTS", "CASH-OUT"][layer]}</text></g>)}
            {ILLUSTRATIVE_RING_EDGES.map(([source, target]) => {
              const from = ringNodePositions[source];
              const to = ringNodePositions[target];
              const active = source === selectedRingNode || target === selectedRingNode;
              return <line key={`${source}-${target}`} x1={from.x + 38} y1={from.y} x2={to.x - 38} y2={to.y} className={`ring-edge${active ? " active" : ""}`} markerEnd="url(#demo-ring-arrow)" />;
            })}
            {ILLUSTRATIVE_RING_NODES.map((node) => {
              const point = ringNodePositions[node.id];
              const active = node.id === selectedRingNode;
              const connected = connectedRingNodes.has(node.id);
              const color = RING_ROLE_COLORS[node.role];
              return <g key={node.id} className="ring-node" role="button" tabIndex="0" aria-pressed={active} aria-label={`${node.id}, synthetic ${node.role} account`} onClick={() => setSelectedRingNode(node.id)} onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedRingNode(node.id);
                }
              }}>
                <title>{`${node.id} · synthetic ${node.role} role`}</title>
                <rect x={point.x - 39} y={point.y - 18} width="78" height="36" rx="10" fill={`${color}18`} stroke={active ? "#f1f5f9" : connected ? color : `${color}85`} strokeWidth={active ? 2.5 : connected ? 1.8 : 1.1} />
                <text x={point.x} y={point.y - 1} textAnchor="middle" className="ring-node-id">{node.id}</text>
                <text x={point.x} y={point.y + 11} textAnchor="middle" className="ring-node-role">{node.role}</text>
              </g>;
            })}
          </svg>
        </div>
        <div className="ring-detail" aria-live="polite">
          <span className="ring-detail-icon" style={{ color: RING_ROLE_COLORS[ringPath?.role], borderColor: `${RING_ROLE_COLORS[ringPath?.role]}55` }}><Icon name="network" size={18} /></span>
          <div><span className="eyebrow">SELECTED SYNTHETIC ACCOUNT</span><b>{ringPath?.id} · {ringPath?.role}</b><small>{ringConnections.length ? `Connected demo accounts: ${ringConnections.map(([source, target]) => source === selectedRingNode ? target : source).join(", ")}` : "No direct connections in the demo graph."}</small></div>
          <span className="muted small">Click or focus a node to inspect its direct links.</span>
        </div>
        <div className="chart-method"><Icon name="shield" size={15} /><span>This graph visualizes only the static synthetic ring already used by the demo model. Its node IDs and connections are not present in the complaint, are not derived from it, and must not be treated as real accounts or evidence.</span></div>
      </div>
      <div className="study-grid">
        <div className="panel">
          <div className="section-heading"><div><span className="eyebrow">REVIEW FRAMEWORK</span><h2>How an investigation could proceed</h2></div></div>
          <div className="study-timeline">{studySteps.map((step) => <article className="study-step" key={step.number}><span className="step-number">{step.number}</span><div><h3>{step.title}</h3><p>{step.description}</p></div></article>)}</div>
        </div>
        <aside className="panel study-boundary">
          <span className="eyebrow">SCOPE & LIMITATIONS</span>
          <h2>What this case study does—and doesn’t—claim</h2>
          <ul>
            <li>It summarizes only broad document themes and payment-channel references.</li>
            <li>It does not disclose names, contact details, account numbers, amounts, dates, or complaint identifiers.</li>
            <li>No transaction has been scored and no mule network has been inferred from this complaint.</li>
            <li>The ScamShield model and its demo metrics are based on synthetic data only.</li>
          </ul>
        </aside>
      </div>
      <div className="study-source-note"><Icon name="shield" size={15} /><span>Source document supplied by the project owner; original file intentionally kept out of the website and repository. This educational summary is not a finding of fact or legal conclusion.</span></div>
    </section>
  );
}

export default function App() {
  const [tab, setTab] = useState("alerts");
  const [ringAccount, setRingAccount] = useState("");
  const [selectedCase, setSelectedCase] = useState("");
  const [metrics, setMetrics] = useState(null);
  const [backendStatus, setBackendStatus] = useState("checking");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const page = PAGE_COPY[tab];

  const notify = (message, tone = "success") => setToast({ message, tone, id: Date.now() });
  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      if (!API) {
        if (alive) setBackendStatus("offline");
        return;
      }
      try {
        await api("/v1/health");
        if (alive) setBackendStatus("online");
      } catch {
        if (alive) setBackendStatus("offline");
      }
    };
    const loadMetrics = async () => {
      try {
        const data = await api("/v1/metrics");
        if (alive) setMetrics(data);
      } catch (error) {
        console.warn("Unable to load synthetic model metrics:", error.message);
      }
    };
    check();
    loadMetrics();
    const id = setInterval(check, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const openCase = async (alert) => {
    try {
      const record = await api(`/v1/cases?alertId=${encodeURIComponent(alert.alertId)}`, "POST");
      setSelectedCase(record.caseId);
      setTab("cases");
      notify("Case opened for review.", "success");
    } catch (error) {
      notify(`Could not open case: ${error.message}`, "error");
    }
  };
  const openNetwork = (account) => {
    setRingAccount(account);
    setTab("graph");
  };
  const selectPage = (id) => {
    setTab(id);
    setMobileNavOpen(false);
  };

  return (
    <div className="app-shell">
      {mobileNavOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`sidebar${mobileNavOpen ? " mobile-open" : ""}`}>
        <a className="brand" href="#overview" onClick={(event) => { event.preventDefault(); selectPage("alerts"); }}>
          <span className="brand-mark"><Icon name="shield" size={23} /></span><span className="brand-name">Scam<span>Shield</span><small>FRAUD INTELLIGENCE</small></span>
        </a>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => <button type="button" key={item.id} className={`nav-item${tab === item.id ? " active" : ""}`} onClick={() => selectPage(item.id)} aria-current={tab === item.id ? "page" : undefined}><Icon name={item.icon} /><span>{item.label}<small>{item.detail}</small></span></button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className={`engine-status ${backendStatus}`}><span className="status-light" /><div><b>{backendStatus === "online" ? "Detection engine active" : backendStatus === "checking" ? "Checking engine…" : "Backend unavailable"}</b><small>{backendStatus === "online" ? "API connection healthy" : backendStatus === "offline" ? (API ? "Unable to reach API" : "Frontend-only deployment") : "Connecting to API"}</small></div></div>
          <div className="data-note"><span className="data-note-icon">i</span><span>Demo environment<br /><b>Synthetic data only</b></span></div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-title">
            <button type="button" className="mobile-menu" aria-label={mobileNavOpen ? "Close menu" : "Open menu"} onClick={() => setMobileNavOpen(!mobileNavOpen)}><Icon name={mobileNavOpen ? "close" : "menu"} /></button>
            <div><span className="breadcrumb">SCAMSHIELD <span>/</span> WORKSPACE</span><h1>{page[0]}</h1><p>{page[1]}</p></div>
          </div>
          <div className="topbar-meta">
            <span className={`top-status ${backendStatus}`}><i />{backendStatus === "online" ? "Engine active" : backendStatus === "checking" ? "Connecting" : "Engine offline"}</span>
            {metrics && <span className="metric-context">PR-AUC {metrics.pr_auc} <span>·</span> Recall@1% FPR {metrics.recall_at_1pct_fpr} <small>synthetic validation</small></span>}
          </div>
        </header>
        {backendStatus === "offline" && <div className="backend-notice" role="status"><Icon name="shield" size={17} /><span><b>Backend not connected.</b> This site is a static frontend; live API features need a running backend. {API ? "Check that the API URL is reachable." : "This frontend-only deployment cannot score or analyze data."}</span></div>}
        <main className="main-content">
          {tab === "alerts" && <AlertsTab onRing={openNetwork} onCase={openCase} notify={notify} />}
          {tab === "graph" && <GraphTab account={ringAccount} setAccount={setRingAccount} />}
          {tab === "cases" && <CasesTab selected={selectedCase} setSelected={setSelectedCase} notify={notify} />}
          {tab === "message" && <MessageTab notify={notify} />}
          {tab === "study" && <CaseStudyTab />}
          <footer className="page-footer"><span>ScamShield · security operations demo</span><span>All transaction data is synthetic and is not a claim of real-world accuracy.</span></footer>
        </main>
      </div>
      {toast && <div className={`toast ${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"} key={toast.id}><span>{toast.tone === "error" ? "!" : "✓"}</span>{toast.message}<button type="button" aria-label="Dismiss notification" onClick={() => setToast(null)}>×</button></div>}
    </div>
  );
}
