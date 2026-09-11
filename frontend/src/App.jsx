import { useEffect, useState } from "react";
import {
  connectWallet,
  getClient,
  onAccountsChanged,
  onChainChanged,
  getCurrentChainIdHex,
  REQUIRED_NETWORK_NAME,
  REQUIRED_CHAIN_ID_HEX,
  ensureStudioNetwork,
  createJob,
  submitWork,
  approveJob,
  disputeJob,
  appealJob,
  finalizeJob,
  recoverUnavailableJob,
  abandonJob,
  getJob,
  createMilestoneJob,
  getMilestones,
  txExplorerUrl,
  APPEAL_WINDOW_MS,
} from "./genlayer.js";
import {
  IconSearch,
  IconFilePlus,
  IconUpload,
  IconScale,
  IconFlag,
  IconCheckCircle,
  IconLifeBuoy,
  IconAlertTriangle,
  IconWallet,
  IconHistory,
} from "./icons.jsx";
import "./arbiter.css";

export default function App() {
  // Persisted so a page refresh doesn't bounce the person back to the
  // landing view once they've launched the app.
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem("arbiter_view") === "app" ? "app" : "landing";
    } catch {
      return "landing";
    }
  });

  function goTo(next) {
    setView(next);
    try {
      localStorage.setItem("arbiter_view", next);
    } catch {
      // storage unavailable -- view still switches for this session
    }
  }

  if (view === "landing") {
    return <Landing onLaunch={() => goTo("app")} />;
  }

  return <ArbiterApp onBack={() => goTo("landing")} />;
}

function Landing({ onLaunch }) {
  return (
    <div className="landing">
      <div className="landing-eyebrow">Built for GenLayer's Agent Tank — Agentic Commerce Infrastructure</div>
      <h1 className="landing-title">Escrow that AI agents can trust each other with.</h1>
      <p className="landing-lede">
        GenLayer validators independently adjudicate disputed work against the
        original spec before releasing payment — no single party is the judge
        of their own case.
      </p>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={onLaunch}>
          Launch App →
        </button>
        <a className="btn btn-outline" href="https://github.com/Naseer32/Arbiter" target="_blank" rel="noopener">
          View Source
        </a>
      </div>

      <hr className="landing-divider" />

      <h2 className="landing-section-title">Why</h2>
      <p className="landing-body">
        AI agents are starting to hire other AI agents for research, coding,
        data collection, and content work. Traditional smart contracts can
        move money and check simple conditions, but they can't judge whether
        complex delivered work satisfies a natural-language spec. Arbiter
        adds that adjudication layer.
      </p>

      <h2 className="landing-section-title" style={{ marginTop: 32 }}>How it works</h2>
      <ol className="landing-steps">
        <li>A requester agent posts a spec and escrows GEN.</li>
        <li>A worker agent delivers text/code, or a URL — pinned via SHA-256 content hash.</li>
        <li>The requester approves directly, or disputes for adjudication.</li>
        <li>On dispute, GenLayer validators independently re-judge the work and must agree.</li>
        <li>The losing party may appeal once, using a structurally different re-adjudication method, before payout finalizes.</li>
      </ol>
    </div>
  );
}

function ArbiterApp({ onBack }) {
  const [account, setAccount] = useState(null);
  const [client, setClient] = useState(null);
  const [status, setStatus] = useState(null); // { text, tone }
  const [pendingAction, setPendingAction] = useState(null);

  const [worker, setWorker] = useState("");
  const [spec, setSpec] = useState("");
  const [amount, setAmount] = useState("");

  const [jobId, setJobId] = useState("");
  const [deliverable, setDeliverable] = useState("");
  const [isUrl, setIsUrl] = useState(true);
  const [reason, setReason] = useState("");
  const [appealReason, setAppealReason] = useState("");
  const [recoveryReason, setRecoveryReason] = useState("");
  const [abandonReason, setAbandonReason] = useState("");

  const [lookupId, setLookupId] = useState("");
  const [jobData, setJobData] = useState(null);

  // ---- Milestone jobs ----
  const [milestoneWorker, setMilestoneWorker] = useState("");
  const [milestoneRows, setMilestoneRows] = useState([
    { spec: "", amount: "" },
    { spec: "", amount: "" },
  ]);
  const [milestoneResult, setMilestoneResult] = useState(null); // { parentJobId, milestoneJobIds }

  const [msParentId, setMsParentId] = useState("");
  const [msLoading, setMsLoading] = useState(false);
  const [msParent, setMsParent] = useState(null);
  const [msChildren, setMsChildren] = useState([]); // [{ id, data }]
  const [msChildDrafts, setMsChildDrafts] = useState({}); // id -> { deliverable, isUrl }
  const [msChildPending, setMsChildPending] = useState({}); // id -> "submit_work" | "approve"

  // "unknown" | "correct" | "wrong" | "no-wallet"
  const [networkStatus, setNetworkStatus] = useState("unknown");

  const [txHistory, setTxHistory] = useState(() => {
    try {
      const saved = localStorage.getItem("arbiter_tx_history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  function recordTx(action, tx, relatedJobId) {
    setTxHistory((prev) => {
      const next = [
        { action, tx, jobId: relatedJobId || null, time: Date.now(), account },
        ...prev,
      ].slice(0, 50);
      try {
        localStorage.setItem("arbiter_tx_history", JSON.stringify(next));
      } catch {
        // storage full or unavailable -- history still works for this session
      }
      return next;
    });
  }

  // Only show history for the currently connected wallet -- entries from
  // a previously connected account stay saved (in case the user switches
  // back) but shouldn't display as if the current wallet performed them.
  const visibleHistory = account
    ? txHistory.filter((e) => e.account && e.account.toLowerCase() === account.toLowerCase())
    : [];

  async function checkNetwork() {
    const current = await getCurrentChainIdHex();
    if (current === null) {
      setNetworkStatus("no-wallet");
    } else if (current.toLowerCase() === REQUIRED_CHAIN_ID_HEX.toLowerCase()) {
      setNetworkStatus("correct");
    } else {
      setNetworkStatus("wrong");
    }
  }

  useEffect(() => {
    checkNetwork();

    const unsubscribeAccounts = onAccountsChanged((newAccount) => {
      if (!newAccount) {
        setAccount(null);
        setClient(null);
        setStatus({ text: "Wallet disconnected.", tone: "neutral" });
        return;
      }
      setAccount(newAccount);
      setClient(getClient(newAccount));
      setStatus({ text: `Switched account: ${newAccount}`, tone: "success" });
    });

    const unsubscribeChain = onChainChanged(() => {
      checkNetwork();
    });

    return () => {
      unsubscribeAccounts();
      unsubscribeChain();
    };
  }, []);

  async function handleSwitchNetwork() {
    try {
      await ensureStudioNetwork();
      await checkNetwork();
    } catch (e) {
      setStatus({ text: `Network switch failed: ${e.message}`, tone: "error" });
    }
  }

  // Re-fetches the currently looked-up job if it's the same job an action
  // just acted on, so the status panel reflects the new on-chain state
  // without the person needing to manually click "Get Job" again.
  async function refreshLookupIfSameJob(actedOnJobId) {
    if (!client) return;
    if (String(actedOnJobId) !== String(lookupId)) return;
    try {
      const data = await getJob(client, Number(actedOnJobId));
      setJobData(data);
    } catch {
      // silent -- the action's own success/error status already reported;
      // a failed refresh here shouldn't overwrite that message
    }
  }

  async function run(actionName, fn, successText, relatedJobId) {
    setPendingAction(actionName);
    setStatus(null);
    try {
      const tx = await fn();
      setStatus({ text: `${successText} tx: ${tx}`, tone: "success" });
      recordTx(actionName, tx, relatedJobId);
      if (relatedJobId !== undefined && relatedJobId !== "") {
        await refreshLookupIfSameJob(relatedJobId);
      }
    } catch (e) {
      setStatus({ text: `${actionName} failed: ${e.message}`, tone: "error" });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleConnect() {
    setPendingAction("connect");
    setStatus(null);
    try {
      const acc = await connectWallet();
      setAccount(acc);
      setClient(getClient(acc));
      await checkNetwork();
      setStatus({ text: `Connected: ${acc}`, tone: "success" });
    } catch (e) {
      setStatus({ text: `Connect failed: ${e.message}`, tone: "error" });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCreateJob() {
    setPendingAction("create_job");
    setStatus(null);
    try {
      const amountWei = BigInt(Math.floor(parseFloat(amount || "0") * 1e18));
      const { tx, jobId: newJobId } = await createJob(client, worker, spec, amountWei);
      const hasId = newJobId !== null && newJobId !== undefined;
      setStatus({
        text: `${hasId ? `Job ${newJobId} created successfully.` : "Job created."} tx: ${tx}`,
        tone: "success",
      });
      recordTx("create_job", tx, hasId ? String(newJobId) : null);
      if (hasId) {
        setJobId(String(newJobId));
      }
    } catch (e) {
      setStatus({ text: `create_job failed: ${e.message}`, tone: "error" });
    } finally {
      setPendingAction(null);
    }
  }

  function handleSubmitWork() {
    run("submit_work", () => submitWork(client, Number(jobId), deliverable, isUrl), "Work submitted.", jobId);
  }

  function handleApprove() {
    run("approve", () => approveJob(client, Number(jobId)), "Approved, worker paid.", jobId);
  }

  function handleDispute() {
    run("dispute", () => disputeJob(client, Number(jobId), reason), "Dispute submitted — verdict pending, appeal window now open.", jobId);
  }

  function handleAppeal() {
    run("appeal", () => appealJob(client, Number(jobId), appealReason), "Appeal submitted for independent re-adjudication.", jobId);
  }

  function handleFinalize() {
    run("finalize", () => finalizeJob(client, Number(jobId)), "Job finalized, original verdict paid out.", jobId);
  }

  function handleRecover() {
    run("recover_unavailable_job", () => recoverUnavailableJob(client, Number(jobId), recoveryReason), "Recovery requested (50/50 split).", jobId);
  }

  function handleAbandon() {
    run("abandon_job", () => abandonJob(client, Number(jobId), abandonReason), "Abandonment claim submitted.", jobId);
  }

  // ---- Milestone jobs ----

  function addMilestoneRow() {
    setMilestoneRows((rows) => [...rows, { spec: "", amount: "" }]);
  }

  function removeMilestoneRow(index) {
    setMilestoneRows((rows) => (rows.length <= 2 ? rows : rows.filter((_, i) => i !== index)));
  }

  function updateMilestoneRow(index, field, value) {
    setMilestoneRows((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  function formatWeiToGen(weiStr) {
    try {
      const wei = BigInt(weiStr);
      const base = 1000000000000000000n;
      const whole = wei / base;
      const frac = wei % base;
      if (frac === 0n) return whole.toString();
      const fracStr = frac.toString().padStart(18, "0").replace(/0+$/, "");
      return `${whole.toString()}.${fracStr}`;
    } catch {
      return weiStr;
    }
  }

  const milestoneTotal = milestoneRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  async function handleCreateMilestoneJob() {
    setPendingAction("create_milestone_job");
    setStatus(null);
    setMilestoneResult(null);
    try {
      const specs = milestoneRows.map((r) => r.spec);
      const amountsWei = milestoneRows.map((r) => BigInt(Math.floor(parseFloat(r.amount || "0") * 1e18)));
      const { tx, parentJobId, milestoneJobIds } = await createMilestoneJob(client, milestoneWorker, specs, amountsWei);
      setStatus({
        text: `${parentJobId ? `Milestone job created — parent #${parentJobId}.` : "Milestone job created."} tx: ${tx}`,
        tone: "success",
      });
      recordTx("create_milestone_job", tx, parentJobId ? String(parentJobId) : null);
      if (parentJobId) {
        setMilestoneResult({ parentJobId, milestoneJobIds });
        await loadMilestoneGroup(parentJobId);
      }
    } catch (e) {
      setStatus({ text: `create_milestone_job failed: ${e.message}`, tone: "error" });
    } finally {
      setPendingAction(null);
    }
  }

  async function loadMilestoneGroup(parentIdValue) {
    if (!client || !parentIdValue) return;
    setMsParentId(String(parentIdValue));
    setMsLoading(true);
    try {
      const parentData = await getJob(client, Number(parentIdValue));
      const childIds = await getMilestones(client, Number(parentIdValue));
      const children = await Promise.all(
        (childIds || []).map(async (rawId) => {
          const idNum = Number(rawId.toString ? rawId.toString() : rawId);
          const data = await getJob(client, idNum);
          return { id: idNum, data };
        })
      );
      setMsParent(parentData);
      setMsChildren(children);
    } catch (e) {
      setStatus({ text: `Loading milestones failed: ${e.message}`, tone: "error" });
      setMsParent(null);
      setMsChildren([]);
    } finally {
      setMsLoading(false);
    }
  }

  function handleLoadMilestoneGroupClick() {
    if (!msParentId) return;
    loadMilestoneGroup(msParentId);
  }

  function updateMilestoneDraft(childId, field, value) {
    setMsChildDrafts((prev) => ({
      ...prev,
      [childId]: { deliverable: "", isUrl: false, ...(prev[childId] || {}), [field]: value },
    }));
  }

  async function handleMilestoneSubmit(childId) {
    const draft = msChildDrafts[childId] || { deliverable: "", isUrl: false };
    setMsChildPending((p) => ({ ...p, [childId]: "submit_work" }));
    setStatus(null);
    try {
      const tx = await submitWork(client, childId, draft.deliverable, draft.isUrl);
      setStatus({ text: `Milestone #${childId} submitted. tx: ${tx}`, tone: "success" });
      recordTx("submit_work", tx, String(childId));
      await loadMilestoneGroup(msParentId);
    } catch (e) {
      setStatus({ text: `submit_work failed: ${e.message}`, tone: "error" });
    } finally {
      setMsChildPending((p) => ({ ...p, [childId]: null }));
    }
  }

  async function handleMilestoneApprove(childId) {
    setMsChildPending((p) => ({ ...p, [childId]: "approve" }));
    setStatus(null);
    try {
      const tx = await approveJob(client, childId);
      setStatus({ text: `Milestone #${childId} approved, worker paid. tx: ${tx}`, tone: "success" });
      recordTx("approve", tx, String(childId));
      await loadMilestoneGroup(msParentId);
    } catch (e) {
      setStatus({ text: `approve failed: ${e.message}`, tone: "error" });
    } finally {
      setMsChildPending((p) => ({ ...p, [childId]: null }));
    }
  }

  async function handleLookup() {
    setPendingAction("lookup");
    setStatus(null);
    try {
      const data = await getJob(client, Number(lookupId));
      setJobData(data);
    } catch (e) {
      setStatus({ text: `get_job failed: ${e.message}`, tone: "error" });
    } finally {
      setPendingAction(null);
    }
  }

  function statusInfo(data) {
    if (!data) return null;
    switch (data.status) {
      case "open":
        return { label: "Open — awaiting worker submission", tone: "open", validActions: "Submit Work, Abandon (after grace period)" };
      case "submitted":
        return { label: "Submitted — awaiting requester action", tone: "open", validActions: "Approve, Dispute, Abandon (after grace period)" };
      case "disputed":
        return { label: "Disputed — adjudication in progress", tone: "neutral", validActions: "none (transient state)" };
      case "verdict_pending":
        return {
          label: `Verdict pending: "${data.pending_verdict}"`,
          tone: "pending",
          detail: `Appeal window open until ${new Date(new Date(data.verdict_at).getTime() + APPEAL_WINDOW_MS).toLocaleString()}`,
          validActions: "Appeal (losing party only), Finalize (after window closes)",
        };
      case "evidence_unavailable":
        return { label: "Evidence unavailable — awaiting recovery", tone: "danger", validActions: "Request Fair Recovery" };
      case "resolved":
        return { label: `Resolved — paid to: ${data.payout_to}${data.appeal_used ? " (via appeal)" : ""}`, tone: "success", validActions: "none — job is closed" };
      default:
        return { label: data.status, tone: "neutral", validActions: "unknown" };
    }
  }

  const info = statusInfo(jobData);

  return (
    <div className="arbiter-root">
      <button className="btn-ghost" onClick={onBack}>
        ← Back to overview
      </button>

      <div className="header-row">
        <div>
          <h1 className="brand-name">Arbiter</h1>
          <p className="brand-sub">Agent-to-agent escrow, adjudicated by GenLayer.</p>
        </div>

        {!account ? (
          <button className="btn btn-primary btn-connect" onClick={handleConnect} disabled={pendingAction === "connect"}>
            {pendingAction === "connect" ? <span className="spinner" /> : <IconWallet className="stage-icon" style={{ color: "#12100a" }} />}
            {pendingAction === "connect" ? "Connecting…" : "Connect Wallet"}
          </button>
        ) : (
          <div className="wallet-box">
            <span className="wallet-dot" />
            <span className="wallet-address">{account.slice(0, 6)}…{account.slice(-4)}</span>
          </div>
        )}
      </div>

      {networkStatus === "wrong" && (
        <div className="network-banner tone-warn">
          <IconAlertTriangle style={{ width: 15, height: 15 }} />
          <span>
            Wrong network — Arbiter runs on <strong>{REQUIRED_NETWORK_NAME}</strong>. Transactions will fail until you switch.
          </span>
          <button className="btn btn-outline btn-sm" onClick={handleSwitchNetwork}>
            Switch Network
          </button>
        </div>
      )}

      {networkStatus === "no-wallet" && (
        <div className="network-banner tone-info">
          <IconWallet style={{ width: 15, height: 15 }} />
          <span>
            No wallet detected. Install a wallet like MetaMask to use Arbiter — it runs on <strong>{REQUIRED_NETWORK_NAME}</strong>.
          </span>
        </div>
      )}

      <div className="pipeline">
        {/* Lookup */}
        <div className="stage stage-lookup">
          <div className="stage-header">
            <IconSearch className="stage-icon" />
            <h2 className="stage-title">Look Up a Job</h2>
          </div>
          <p className="stage-help">Inspect any job's current status, verdict, and payout by ID.</p>
          <div className="lookup-row">
            <input
              className="input"
              placeholder="Job ID"
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
            />
            <button className="btn btn-outline" onClick={handleLookup} disabled={!client || pendingAction === "lookup"}>
              {pendingAction === "lookup" ? <span className="spinner" /> : <IconSearch className="stage-icon" style={{ width: 15, height: 15 }} />}
              {pendingAction === "lookup" ? "Looking up…" : "Get Job"}
            </button>
          </div>

          {jobData && (
            <div className="status-panel">
              {info && (
                <>
                  <div className={`status-head tone-${info.tone}`}>
                    {info.tone === "success" && <IconCheckCircle style={{ width: 15, height: 15 }} />}
                    {info.tone === "danger" && <IconAlertTriangle style={{ width: 15, height: 15 }} />}
                    {info.tone === "pending" && <IconScale style={{ width: 15, height: 15 }} />}
                    {info.label}
                  </div>
                  <div className="status-body">
                    {info.detail && <div style={{ marginBottom: 6 }}>{info.detail}</div>}
                    <span className="status-actions-label">Valid next actions:</span>
                    {info.validActions}
                  </div>
                </>
              )}
              <pre className="job-json">{JSON.stringify(jobData, null, 2)}</pre>
            </div>
          )}

          {jobData && jobData.is_milestone_parent && (
            <div className="milestone-parent-summary">
              This is a milestone parent job with{" "}
              <span className="milestone-parent-badge">{jobData.milestone_count}</span> milestones.
              <button
                className="btn btn-outline btn-sm"
                onClick={() => loadMilestoneGroup(lookupId)}
                disabled={!client || msLoading}
              >
                {msLoading ? "Loading…" : "View Milestones ↓"}
              </button>
            </div>
          )}

          {jobData && !jobData.is_milestone_parent && jobData.parent_job_id !== "0" && (
            <div className="milestone-parent-summary">
              Milestone #{jobData.milestone_index} of a job under parent{" "}
              <span className="milestone-parent-badge">#{jobData.parent_job_id}</span>.
              <button
                className="btn btn-outline btn-sm"
                onClick={() => loadMilestoneGroup(jobData.parent_job_id)}
                disabled={!client || msLoading}
              >
                {msLoading ? "Loading…" : "View Full Group ↓"}
              </button>
            </div>
          )}
        </div>

        {/* 1. Post a Job */}
        <div className="stage" data-connected="true">
          <div className="stage-header">
            <span className="stage-number">1</span>
            <IconFilePlus className="stage-icon" />
            <h2 className="stage-title">Post a Job</h2>
            <span className="stage-role">Requester</span>
          </div>
          <p className="stage-help">Escrow GEN against a natural-language spec for a worker agent to fulfill.</p>

          <label className="field-label">Worker agent address</label>
          <input className="input" placeholder="0x…" value={worker} onChange={(e) => setWorker(e.target.value)} />

          <label className="field-label">Job spec</label>
          <textarea className="textarea input" placeholder="Natural-language requirements" value={spec} onChange={(e) => setSpec(e.target.value)} rows={3} />

          <label className="field-label">Escrow amount (GEN)</label>
          <input className="input" placeholder="e.g. 7" value={amount} onChange={(e) => setAmount(e.target.value)} />

          <button className="btn btn-primary" onClick={handleCreateJob} disabled={!client || pendingAction === "create_job"}>
            {pendingAction === "create_job" && <span className="spinner" />}
            {pendingAction === "create_job" ? "Creating…" : "Create Job"}
          </button>
        </div>

        {/* Post a Milestone Job (alternate to stage 1, for multi-payment engagements) */}
        <div className="stage">
          <div className="stage-header">
            <IconFilePlus className="stage-icon" />
            <h2 className="stage-title">Post a Milestone Job</h2>
            <span className="stage-role">Requester</span>
          </div>
          <p className="stage-help">
            For multi-part engagements: escrow GEN across 2 or more milestones, each with its own
            spec and payment. Every milestone becomes its own independent job — submitted,
            approved, or disputed separately, paying out as soon as it resolves. The parent
            auto-resolves once every milestone is done.
          </p>

          <label className="field-label">Worker agent address</label>
          <input
            className="input"
            placeholder="0x…"
            value={milestoneWorker}
            onChange={(e) => setMilestoneWorker(e.target.value)}
          />

          <label className="field-label">Milestones</label>
          {milestoneRows.map((row, i) => (
            <div className="milestone-row" key={i}>
              <textarea
                className="textarea input milestone-row-spec"
                placeholder={`Milestone ${i + 1} spec`}
                value={row.spec}
                onChange={(e) => updateMilestoneRow(i, "spec", e.target.value)}
                rows={2}
              />
              <input
                className="input milestone-row-amount"
                placeholder="GEN"
                value={row.amount}
                onChange={(e) => updateMilestoneRow(i, "amount", e.target.value)}
              />
              <button
                type="button"
                className="milestone-row-remove"
                onClick={() => removeMilestoneRow(i)}
                disabled={milestoneRows.length <= 2}
                title={milestoneRows.length <= 2 ? "At least 2 milestones are required" : "Remove milestone"}
              >
                ×
              </button>
            </div>
          ))}

          <button type="button" className="btn btn-outline btn-sm milestone-add-row" onClick={addMilestoneRow}>
            + Add Milestone
          </button>

          <div className="milestone-total">Total escrow: {milestoneTotal || 0} GEN</div>

          <button
            className="btn btn-primary"
            onClick={handleCreateMilestoneJob}
            disabled={!client || pendingAction === "create_milestone_job"}
          >
            {pendingAction === "create_milestone_job" && <span className="spinner" />}
            {pendingAction === "create_milestone_job" ? "Creating…" : "Create Milestone Job"}
          </button>

          {milestoneResult && (
            <div className="milestone-created-banner">
              Created parent #{milestoneResult.parentJobId} with milestones:{" "}
              {milestoneResult.milestoneJobIds.map((id) => `#${id}`).join(", ")}. See the panel below to
              submit and approve each one.
            </div>
          )}
        </div>

        {/* Milestone Progress: dedicated submit/approve UI per milestone child,
            rather than reusing the single-job "Job ID" fields below. */}
        <div className="stage">
          <div className="stage-header">
            <IconScale className="stage-icon" />
            <h2 className="stage-title">Milestone Progress</h2>
          </div>
          <p className="stage-help">
            Load a milestone job by its parent ID to submit and approve each milestone individually.
          </p>

          <div className="lookup-row">
            <input
              className="input"
              placeholder="Parent Job ID"
              value={msParentId}
              onChange={(e) => setMsParentId(e.target.value)}
            />
            <button className="btn btn-outline" onClick={handleLoadMilestoneGroupClick} disabled={!client || msLoading}>
              {msLoading ? <span className="spinner" /> : <IconSearch className="stage-icon" style={{ width: 15, height: 15 }} />}
              {msLoading ? "Loading…" : "Load Milestones"}
            </button>
          </div>

          {msParent && (
            <div className="milestone-parent-summary">
              Parent status: <span className="milestone-parent-badge">{msParent.status}</span>
              {msParent.status === "milestones_open" && " — stays open until every milestone below resolves."}
              {msParent.status === "resolved" && " — all milestones complete."}
            </div>
          )}

          {msChildren.length > 0 && (
            <div className="milestone-list">
              {msChildren.map(({ id, data }) => {
                const childInfo = statusInfo(data);
                const draft = msChildDrafts[id] || { deliverable: "", isUrl: false };
                const pending = msChildPending[id];
                return (
                  <div className="milestone-card" key={id}>
                    <div className="milestone-card-head">
                      <span className="milestone-card-index">
                        #{id} · Milestone {data.milestone_index}
                      </span>
                      <span className="milestone-card-spec">{data.spec}</span>
                      <span className="milestone-card-amount">{formatWeiToGen(data.amount)} GEN</span>
                      {childInfo && (
                        <span className={`milestone-card-badge tone-${childInfo.tone}`}>{data.status}</span>
                      )}
                    </div>

                    <div className="milestone-card-body">
                      {data.status === "open" && (
                        <>
                          <label className="field-label">Deliverable (worker)</label>
                          <textarea
                            className="textarea input"
                            placeholder="URL or text/code"
                            value={draft.deliverable}
                            onChange={(e) => updateMilestoneDraft(id, "deliverable", e.target.value)}
                            rows={2}
                          />
                          <label className="checkbox-row">
                            <input
                              type="checkbox"
                              checked={draft.isUrl}
                              onChange={(e) => updateMilestoneDraft(id, "isUrl", e.target.checked)}
                            />
                            Deliverable is a URL
                          </label>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleMilestoneSubmit(id)}
                            disabled={!client || pending === "submit_work"}
                          >
                            {pending === "submit_work" && <span className="spinner" />}
                            {pending === "submit_work" ? "Submitting…" : "Submit Work"}
                          </button>
                        </>
                      )}

                      {data.status === "submitted" && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleMilestoneApprove(id)}
                          disabled={!client || pending === "approve"}
                        >
                          {pending === "approve" && <span className="spinner" />}
                          {pending === "approve" ? "Approving…" : "Approve (pay worker)"}
                        </button>
                      )}

                      {data.status !== "open" && data.status !== "submitted" && (
                        <span className="milestone-card-note">
                          {childInfo ? childInfo.validActions : ""} — use the standard panels above with Job ID{" "}
                          {id} for dispute, appeal, finalize, or recovery.
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 2. Submit Deliverable */}
        <div className="stage" data-connected="true">
          <div className="stage-header">
            <span className="stage-number">2</span>
            <IconUpload className="stage-icon" />
            <h2 className="stage-title">Submit Deliverable</h2>
            <span className="stage-role">Worker</span>
          </div>
          <p className="stage-help">Deliver the work — text, code, or a URL, pinned by content hash at submission time.</p>

          <label className="field-label">Job ID</label>
          <input className="input" placeholder="e.g. 1" value={jobId} onChange={(e) => setJobId(e.target.value)} />

          <label className="field-label">Deliverable</label>
          <textarea className="textarea input" placeholder="URL or text/code" value={deliverable} onChange={(e) => setDeliverable(e.target.value)} rows={3} />

          <label className="checkbox-row">
            <input type="checkbox" checked={isUrl} onChange={(e) => setIsUrl(e.target.checked)} />
            Deliverable is a URL
          </label>

          <button className="btn btn-primary" onClick={handleSubmitWork} disabled={!client || pendingAction === "submit_work"}>
            {pendingAction === "submit_work" && <span className="spinner" />}
            {pendingAction === "submit_work" ? "Submitting…" : "Submit Work"}
          </button>
        </div>

        {/* 3. Approve or Dispute */}
        <div className="stage" data-connected="true">
          <div className="stage-header">
            <span className="stage-number">3</span>
            <IconScale className="stage-icon" />
            <h2 className="stage-title">Approve or Dispute</h2>
            <span className="stage-role">Requester</span>
          </div>
          <p className="stage-help">Approve to pay directly, or dispute to trigger adjudication.</p>

          <label className="field-label">Job ID</label>
          <input className="input" placeholder="e.g. 1" value={jobId} onChange={(e) => setJobId(e.target.value)} />

          <button className="btn btn-primary" onClick={handleApprove} disabled={!client || pendingAction === "approve"}>
            {pendingAction === "approve" && <span className="spinner" />}
            {pendingAction === "approve" ? "Approving…" : "Approve (pay worker)"}
          </button>

          <div style={{ marginTop: 16 }}>
            <label className="field-label">Dispute reason</label>
            <input className="input" placeholder="Why the deliverable doesn't satisfy the spec" value={reason} onChange={(e) => setReason(e.target.value)} />
            <button className="btn btn-danger" onClick={handleDispute} disabled={!client || pendingAction === "dispute"}>
              {pendingAction === "dispute" && <span className="spinner" />}
              {pendingAction === "dispute" ? "Disputing…" : "Dispute → Adjudicate"}
            </button>
          </div>
        </div>

        {/* 4. Appeal */}
        <div className="stage" data-connected="true">
          <div className="stage-header">
            <span className="stage-number">4</span>
            <IconFlag className="stage-icon" />
            <h2 className="stage-title">Appeal</h2>
            <span className="stage-role">Losing party</span>
          </div>
          <p className="stage-help">
            Only callable by the party who lost the dispute verdict, within the appeal window.
            Triggers an independent, differently-reasoned re-adjudication whose result is final.
          </p>

          <label className="field-label">Job ID</label>
          <input className="input" placeholder="e.g. 1" value={jobId} onChange={(e) => setJobId(e.target.value)} />

          <label className="field-label">Appeal reason</label>
          <input className="input" placeholder="Why this verdict should be reconsidered" value={appealReason} onChange={(e) => setAppealReason(e.target.value)} />
          <button className="btn btn-outline" onClick={handleAppeal} disabled={!client || pendingAction === "appeal"}>
            {pendingAction === "appeal" && <span className="spinner" />}
            {pendingAction === "appeal" ? "Appealing…" : "Appeal → Re-adjudicate"}
          </button>
        </div>

        {/* 5. Finalize */}
        <div className="stage" data-connected="true">
          <div className="stage-header">
            <span className="stage-number">5</span>
            <IconCheckCircle className="stage-icon" />
            <h2 className="stage-title">Finalize</h2>
            <span className="stage-role">Either party</span>
          </div>
          <p className="stage-help">Callable once the appeal window has closed with no appeal filed. Pays out the original verdict.</p>

          <label className="field-label">Job ID</label>
          <input className="input" placeholder="e.g. 1" value={jobId} onChange={(e) => setJobId(e.target.value)} />

          <button className="btn btn-primary" onClick={handleFinalize} disabled={!client || pendingAction === "finalize"}>
            {pendingAction === "finalize" && <span className="spinner" />}
            {pendingAction === "finalize" ? "Finalizing…" : "Finalize Verdict"}
          </button>
        </div>

        {/* Recovery */}
        <div className="stage">
          <div className="stage-header">
            <IconLifeBuoy className="stage-icon" />
            <h2 className="stage-title">Evidence-Unavailable Recovery</h2>
          </div>
          <p className="stage-help">If a disputed URL can't be verified against its submission-time snapshot, either party can request a fair, deterministic split.</p>

          <label className="field-label">Job ID</label>
          <input className="input" placeholder="e.g. 1" value={jobId} onChange={(e) => setJobId(e.target.value)} />

          <label className="field-label">Recovery reason</label>
          <input className="input" placeholder="e.g. content unrecoverable, split fairly" value={recoveryReason} onChange={(e) => setRecoveryReason(e.target.value)} />
          <button className="btn btn-outline" onClick={handleRecover} disabled={!client || pendingAction === "recover_unavailable_job"}>
            {pendingAction === "recover_unavailable_job" && <span className="spinner" />}
            {pendingAction === "recover_unavailable_job" ? "Requesting…" : "Request Fair Recovery (50/50 split)"}
          </button>
        </div>

        {/* Abandonment */}
        <div className="stage">
          <div className="stage-header">
            <IconAlertTriangle className="stage-icon" />
            <h2 className="stage-title">Abandonment</h2>
          </div>
          <p className="stage-help">If a job sits unactioned past the grace period, either party can reclaim escrow deterministically.</p>

          <label className="field-label">Job ID</label>
          <input className="input" placeholder="e.g. 1" value={jobId} onChange={(e) => setJobId(e.target.value)} />

          <label className="field-label">Abandonment reason</label>
          <input className="input" placeholder="e.g. worker never started" value={abandonReason} onChange={(e) => setAbandonReason(e.target.value)} />
          <button className="btn btn-outline" onClick={handleAbandon} disabled={!client || pendingAction === "abandon_job"}>
            {pendingAction === "abandon_job" && <span className="spinner" />}
            {pendingAction === "abandon_job" ? "Claiming…" : "Claim Abandoned (after grace period)"}
          </button>
        </div>
      </div>

      {/* Transaction History */}
      <div className="stage" style={{ marginTop: 4 }}>
        <div className="stage-header">
          <IconHistory className="stage-icon" />
          <h2 className="stage-title">Transaction History</h2>
        </div>
        <p className="stage-help">
          {visibleHistory.length === 0
            ? "Actions taken by the connected wallet will appear here."
            : "Most recent first, for the connected wallet. Saved locally to this device/browser."}
        </p>

        {visibleHistory.length > 0 && (
          <div className="history-list">
            {visibleHistory.map((entry, i) => {
              const url = txExplorerUrl(entry.tx);
              return (
                <div className="history-row" key={`${entry.tx}-${i}`}>
                  <div className="history-main">
                    <span className="history-action">{entry.action}</span>
                    {entry.jobId && <span className="history-job">Job #{entry.jobId}</span>}
                  </div>
                  {url ? (
                    <a className="history-hash" href={url} target="_blank" rel="noopener">
                      {entry.tx.slice(0, 10)}…{entry.tx.slice(-6)}
                    </a>
                  ) : (
                    <span className="history-hash history-hash-plain">
                      {entry.tx.slice(0, 10)}…{entry.tx.slice(-6)}
                    </span>
                  )}
                  <span className="history-time">{new Date(entry.time).toLocaleTimeString()}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {status && (
        <div className={`toast ${status.tone === "error" ? "tone-error" : status.tone === "success" ? "tone-success" : ""}`}>
          {status.text}
        </div>
      )}
    </div>
  );
}
