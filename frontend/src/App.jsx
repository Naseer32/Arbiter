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
  getJobCount,
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

function parseJobId(value) {
  const trimmed = String(value ?? "").trim();
  if (!/^\d+$/.test(trimmed)) return null;

  const n = Number(trimmed);
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
}

function isValidAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value ?? "").trim());
}

function parseAmountToWei(value) {
  const trimmed = String(value ?? "").trim();

  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;

  const [whole, frac = ""] = trimmed.split(".");

  if (frac.length > 18) return null;

  const wei =
    BigInt(whole || "0") * 10n ** 18n +
    BigInt(frac.padEnd(18, "0") || "0");

  return wei > 0n ? wei : null;
}

function formatWeiToGen(weiStr) {
  try {
    const wei = BigInt(weiStr);
    const base = 1000000000000000000n;
    const whole = wei / base;
    const frac = wei % base;

    if (frac === 0n) return whole.toString();

    const fracStr = frac
      .toString()
      .padStart(18, "0")
      .replace(/0+$/, "");

    return `${whole.toString()}.${fracStr}`;
  } catch {
    return weiStr;
  }
}

export default function App() {
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem("arbiter_view") === "app"
        ? "app"
        : "landing";
    } catch {
      return "landing";
    }
  });

  function goTo(next) {
    setView(next);

    try {
      localStorage.setItem("arbiter_view", next);
    } catch {
      // Storage unavailable.
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
      <div className="landing-glow landing-glow-one" />
      <div className="landing-glow landing-glow-two" />

      <div className="landing-content">
        <div className="landing-eyebrow">
          <span className="eyebrow-dot" />
          Built for GenLayer Agent Tank
        </div>

        <h1 className="landing-title">
          Escrow that AI agents can trust each other with.
        </h1>

        <p className="landing-lede">
          Arbiter lets AI agents transact with escrowed GEN while GenLayer
          validators independently adjudicate disputed work against the
          original specification.
        </p>

        <div className="landing-actions">
          <button
            className="btn btn-primary btn-large"
            onClick={onLaunch}
          >
            Launch Arbiter
            <span>→</span>
          </button>

          <a
            className="btn btn-outline btn-large"
            href="https://github.com/Naseer32/Arbiter"
            target="_blank"
            rel="noopener noreferrer"
          >
            View Source
          </a>
        </div>

        <div className="landing-trust-row">
          <div className="landing-trust-item">
            <IconScale />
            <span>Independent adjudication</span>
          </div>

          <div className="landing-trust-item">
            <IconWallet />
            <span>On-chain escrow</span>
          </div>

          <div className="landing-trust-item">
            <IconCheckCircle />
            <span>Deterministic payout</span>
          </div>
        </div>

        <div className="landing-section">
          <div className="section-kicker">Why Arbiter</div>

          <p className="landing-body">
            AI agents are starting to hire other AI agents for research,
            coding, data collection, and content work. Traditional smart
            contracts can move money and check simple conditions, but they
            cannot judge whether complex delivered work satisfies a
            natural-language specification.
          </p>
        </div>

        <div className="landing-section">
          <div className="section-kicker">How it works</div>

          <div className="landing-flow">
            <div className="landing-flow-item">
              <span>01</span>
              <div>
                <strong>Requester creates a job</strong>
                <p>GEN is escrowed against a clear job specification.</p>
              </div>
            </div>

            <div className="landing-flow-item">
              <span>02</span>
              <div>
                <strong>Worker submits the work</strong>
                <p>Text, code, or URL evidence can be submitted.</p>
              </div>
            </div>

            <div className="landing-flow-item">
              <span>03</span>
              <div>
                <strong>Requester approves or disputes</strong>
                <p>
                  Approved work pays directly. Disputes go to adjudication.
                </p>
              </div>
            </div>

            <div className="landing-flow-item">
              <span>04</span>
              <div>
                <strong>GenLayer judges the dispute</strong>
                <p>
                  Independent validators evaluate the work against the spec.
                </p>
              </div>
            </div>

            <div className="landing-flow-item">
              <span>05</span>
              <div>
                <strong>Verdict becomes payout</strong>
                <p>
                  The losing party can appeal once before finalization.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  description,
  items,
  onClick,
  accent = false,
}) {
  return (
    <button
      type="button"
      className={`section-card ${accent ? "section-card-accent" : ""}`}
      onClick={onClick}
    >
      <div className="section-card-top">
        <div className="section-card-icon">
          <Icon />
        </div>

        <span className="section-card-arrow">↗</span>
      </div>

      <div className="section-card-title">{title}</div>

      <div className="section-card-description">
        {description}
      </div>

      <div className="section-card-items">
        {items.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </button>
  );
}

function ArbiterApp({ onBack }) {
  const [account, setAccount] = useState(null);
  const [client, setClient] = useState(null);
  const [status, setStatus] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);

  const [activeSection, setActiveSection] = useState("dashboard");

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
  const [viewingFromRecent, setViewingFromRecent] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  const [recentJobs, setRecentJobs] = useState([]);
  const [recentLoading, setRecentLoading] = useState(false);

  const [milestoneWorker, setMilestoneWorker] = useState("");
  const [milestoneRows, setMilestoneRows] = useState([
    { spec: "", amount: "" },
    { spec: "", amount: "" },
  ]);
  const [milestoneResult, setMilestoneResult] = useState(null);

  const [msParentId, setMsParentId] = useState("");
  const [msLoading, setMsLoading] = useState(false);
  const [msParent, setMsParent] = useState(null);
  const [msChildren, setMsChildren] = useState([]);
  const [msChildDrafts, setMsChildDrafts] = useState({});
  const [msChildPending, setMsChildPending] = useState({});

  const [networkStatus, setNetworkStatus] = useState("unknown");

  const [txHistory, setTxHistory] = useState(() => {
    try {
      const saved = localStorage.getItem("arbiter_tx_history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const visibleHistory = account
    ? txHistory.filter(
        (entry) =>
          entry.account &&
          entry.account.toLowerCase() === account.toLowerCase()
      )
    : [];

  const milestoneTotalWei = milestoneRows.reduce((sum, row) => {
    const wei = parseAmountToWei(row.amount);
    return sum + (wei ?? 0n);
  }, 0n);

  const milestoneTotal = formatWeiToGen(
    milestoneTotalWei.toString()
  );

  function recordTx(action, tx, relatedJobId) {
    setTxHistory((prev) => {
      const next = [
        {
          action,
          tx,
          jobId: relatedJobId || null,
          time: Date.now(),
          account,
        },
        ...prev,
      ].slice(0, 50);

      try {
        localStorage.setItem(
          "arbiter_tx_history",
          JSON.stringify(next)
        );
      } catch {
        // Storage unavailable.
      }

      return next;
    });
  }

  function openSection(section) {
    setActiveSection(section);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });

    setStatus(null);
  }

  function goDashboard() {
    setActiveSection("dashboard");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });

    setStatus(null);
  }

  async function checkNetwork() {
    const current = await getCurrentChainIdHex();

    if (current === null) {
      setNetworkStatus("no-wallet");
    } else if (
      current.toLowerCase() ===
      REQUIRED_CHAIN_ID_HEX.toLowerCase()
    ) {
      setNetworkStatus("correct");
    } else {
      setNetworkStatus("wrong");
    }
  }

  useEffect(() => {
    checkNetwork();

    const unsubscribeAccounts = onAccountsChanged(
      (newAccount) => {
        if (!newAccount) {
          setAccount(null);
          setClient(null);

          setStatus({
            text: "Wallet disconnected.",
            tone: "neutral",
          });

          return;
        }

        setAccount(newAccount);
        setClient(getClient(newAccount));

        setStatus({
          text: `Switched account: ${newAccount}`,
          tone: "success",
        });
      }
    );

    const unsubscribeChain = onChainChanged(() => {
      checkNetwork();
    });

    return () => {
      unsubscribeAccounts();
      unsubscribeChain();
    };
  }, []);

  async function handleConnect() {
    setPendingAction("connect");
    setStatus(null);

    try {
      const acc = await connectWallet();

      setAccount(acc);
      setClient(getClient(acc));

      await checkNetwork();

      setStatus({
        text: `Connected: ${acc}`,
        tone: "success",
      });
    } catch (e) {
      setStatus({
        text: `Connect failed: ${e.message}`,
        tone: "error",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSwitchNetwork() {
    try {
      await ensureStudioNetwork();
      await checkNetwork();
    } catch (e) {
      setStatus({
        text: `Network switch failed: ${e.message}`,
        tone: "error",
      });
    }
  }

  async function refreshLookupIfSameJob(actedOnJobId) {
    if (!client) return;

    if (String(actedOnJobId) !== String(lookupId)) {
      return;
    }

    try {
      const data = await getJob(
        client,
        Number(actedOnJobId)
      );

      setJobData(data);
    } catch {
      // Silent refresh failure.
    }
  }

  async function run(
    actionName,
    fn,
    successText,
    relatedJobId
  ) {
    setPendingAction(actionName);
    setStatus(null);

    try {
      const tx = await fn();

      setStatus({
        text: `${successText} tx: ${tx}`,
        tone: "success",
      });

      recordTx(
        actionName,
        tx,
        relatedJobId
      );

      if (
        relatedJobId !== undefined &&
        relatedJobId !== ""
      ) {
        await refreshLookupIfSameJob(
          relatedJobId
        );
      }
    } catch (e) {
      setStatus({
        text: `${actionName} failed: ${e.message}`,
        tone: "error",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCreateJob() {
    if (!client) {
      setStatus({
        text: "Connect your wallet first.",
        tone: "error",
      });

      return;
    }

    if (!isValidAddress(worker)) {
      setStatus({
        text:
          "Worker agent address must be a valid 0x… address.",
        tone: "error",
      });

      return;
    }

    if (!spec.trim()) {
      setStatus({
        text: "Job spec can't be empty.",
        tone: "error",
      });

      return;
    }

    const amountWei = parseAmountToWei(amount);

    if (amountWei === null) {
      setStatus({
        text:
          "Escrow amount must be a positive number up to 18 decimal places.",
        tone: "error",
      });

      return;
    }

    setPendingAction("create_job");
    setStatus(null);

    try {
      const {
        tx,
        jobId: newJobId,
      } = await createJob(
        client,
        worker,
        spec,
        amountWei
      );

      const hasId =
        newJobId !== null &&
        newJobId !== undefined;

      setStatus({
        text: `${
          hasId
            ? `Job ${newJobId} created successfully.`
            : "Job created."
        } tx: ${tx}`,
        tone: "success",
      });

      recordTx(
        "create_job",
        tx,
        hasId ? String(newJobId) : null
      );

      if (hasId) {
        setJobId(String(newJobId));
      }
    } catch (e) {
      setStatus({
        text: `create_job failed: ${e.message}`,
        tone: "error",
      });
    } finally {
      setPendingAction(null);
    }
  }

  function withJobId(fn) {
    const id = parseJobId(jobId);

    if (id === null) {
      setStatus({
        text:
          "Job ID must be a positive whole number.",
        tone: "error",
      });

      return;
    }

    fn(id);
  }

  function handleSubmitWork() {
    withJobId((id) => {
      if (!deliverable.trim()) {
        setStatus({
          text: "Deliverable can't be empty.",
          tone: "error",
        });

        return;
      }

      run(
        "submit_work",
        () =>
          submitWork(
            client,
            id,
            deliverable,
            isUrl
          ),
        "Work submitted.",
        id
      );
    });
  }

  function handleApprove() {
    withJobId((id) => {
      run(
        "approve",
        () => approveJob(client, id),
        "Approved, worker paid.",
        id
      );
    });
  }

  function handleDispute() {
    withJobId((id) => {
      if (!reason.trim()) {
        setStatus({
          text: "Dispute reason can't be empty.",
          tone: "error",
        });

        return;
      }

      run(
        "dispute",
        () => disputeJob(client, id, reason),
        "Dispute submitted. Verdict pending.",
        id
      );
    });
  }

  function handleAppeal() {
    withJobId((id) => {
      if (!appealReason.trim()) {
        setStatus({
          text: "Appeal reason can't be empty.",
          tone: "error",
        });

        return;
      }

      run(
        "appeal",
        () =>
          appealJob(
            client,
            id,
            appealReason
          ),
        "Appeal submitted for independent re-adjudication.",
        id
      );
    });
  }

  function handleFinalize() {
    withJobId((id) => {
      run(
        "finalize",
        () => finalizeJob(client, id),
        "Job finalized, original verdict paid out.",
        id
      );
    });
  }

  function handleRecover() {
    withJobId((id) => {
      if (!recoveryReason.trim()) {
        setStatus({
          text:
            "Recovery reason can't be empty.",
          tone: "error",
        });

        return;
      }

      run(
        "recover_unavailable_job",
        () =>
          recoverUnavailableJob(
            client,
            id,
            recoveryReason
          ),
        "Recovery requested. 50/50 split.",
        id
      );
    });
  }

  function handleAbandon() {
    withJobId((id) => {
      if (!abandonReason.trim()) {
        setStatus({
          text:
            "Abandonment reason can't be empty.",
          tone: "error",
        });

        return;
      }

      run(
        "abandon_job",
        () =>
          abandonJob(
            client,
            id,
            abandonReason
          ),
        "Abandonment claim submitted.",
        id
      );
    });
  }

  function addMilestoneRow() {
    setMilestoneRows((rows) => [
      ...rows,
      {
        spec: "",
        amount: "",
      },
    ]);
  }

  function removeMilestoneRow(index) {
    setMilestoneRows((rows) =>
      rows.length <= 2
        ? rows
        : rows.filter(
            (_, i) => i !== index
          )
    );
  }

  function updateMilestoneRow(
    index,
    field,
    value
  ) {
    setMilestoneRows((rows) =>
      rows.map((row, i) =>
        i === index
          ? {
              ...row,
              [field]: value,
            }
          : row
      )
    );
  }

  async function handleCreateMilestoneJob() {
    if (!client) {
      setStatus({
        text: "Connect your wallet first.",
        tone: "error",
      });

      return;
    }

    if (!isValidAddress(milestoneWorker)) {
      setStatus({
        text:
          "Worker agent address must be a valid 0x… address.",
        tone: "error",
      });

      return;
    }

    if (milestoneRows.length < 2) {
      setStatus({
        text:
          "At least 2 milestones are required.",
        tone: "error",
      });

      return;
    }

    if (
      milestoneRows.some(
        (row) => !row.spec.trim()
      )
    ) {
      setStatus({
        text:
          "Every milestone needs a spec.",
        tone: "error",
      });

      return;
    }

    const amountsWei = [];

    for (const row of milestoneRows) {
      const wei = parseAmountToWei(
        row.amount
      );

      if (wei === null) {
        setStatus({
          text:
            "Every milestone amount must be positive.",
          tone: "error",
        });

        return;
      }

      amountsWei.push(wei);
    }

    setPendingAction(
      "create_milestone_job"
    );

    setStatus(null);
    setMilestoneResult(null);

    try {
      const specs = milestoneRows.map(
        (row) => row.spec
      );

      const {
        tx,
        parentJobId,
        milestoneJobIds,
      } = await createMilestoneJob(
        client,
        milestoneWorker,
        specs,
        amountsWei
      );

      setStatus({
        text: `${
          parentJobId
            ? `Milestone job created. Parent #${parentJobId}.`
            : "Milestone job created."
        } tx: ${tx}`,
        tone: "success",
      });

      recordTx(
        "create_milestone_job",
        tx,
        parentJobId
          ? String(parentJobId)
          : null
      );

      if (parentJobId) {
        setMilestoneResult({
          parentJobId,
          milestoneJobIds,
        });

        await loadMilestoneGroup(
          parentJobId
        );
      }
    } catch (e) {
      setStatus({
        text:
          `create_milestone_job failed: ${e.message}`,
        tone: "error",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function loadMilestoneGroup(
    parentIdValue
  ) {
    if (!client) return;

    const parentId =
      parseJobId(parentIdValue);

    if (parentId === null) {
      setStatus({
        text:
          "Parent Job ID must be a positive whole number.",
        tone: "error",
      });

      return;
    }

    setMsParentId(String(parentId));
    setMsLoading(true);

    try {
      const parentData = await getJob(
        client,
        parentId
      );

      const childIds =
        await getMilestones(
          client,
          parentId
        );

      const children =
        await Promise.all(
          (childIds || []).map(
            async (rawId) => {
              const idNum = Number(
                rawId.toString
                  ? rawId.toString()
                  : rawId
              );

              const data =
                await getJob(
                  client,
                  idNum
                );

              return {
                id: idNum,
                data,
              };
            }
          )
        );

      setMsParent(parentData);
      setMsChildren(children);
    } catch (e) {
      setStatus({
        text:
          `Loading milestones failed: ${e.message}`,
        tone: "error",
      });

      setMsParent(null);
      setMsChildren([]);
    } finally {
      setMsLoading(false);
    }
  }

  function handleLoadMilestoneGroupClick() {
    loadMilestoneGroup(msParentId);
  }

  function updateMilestoneDraft(
    childId,
    field,
    value
  ) {
    setMsChildDrafts((prev) => ({
      ...prev,
      [childId]: {
        deliverable: "",
        isUrl: false,
        ...(prev[childId] || {}),
        [field]: value,
      },
    }));
  }

  async function handleMilestoneSubmit(
    childId
  ) {
    const draft =
      msChildDrafts[childId] || {
        deliverable: "",
        isUrl: false,
      };

    if (!draft.deliverable.trim()) {
      setStatus({
        text:
          "Deliverable can't be empty.",
        tone: "error",
      });

      return;
    }

    setMsChildPending((prev) => ({
      ...prev,
      [childId]: "submit_work",
    }));

    setStatus(null);

    try {
      const tx = await submitWork(
        client,
        childId,
        draft.deliverable,
        draft.isUrl
      );

      setStatus({
        text:
          `Milestone #${childId} submitted. tx: ${tx}`,
        tone: "success",
      });

      recordTx(
        "submit_work",
        tx,
        String(childId)
      );

      await loadMilestoneGroup(
        msParentId
      );
    } catch (e) {
      setStatus({
        text:
          `submit_work failed: ${e.message}`,
        tone: "error",
      });
    } finally {
      setMsChildPending((prev) => ({
        ...prev,
        [childId]: null,
      }));
    }
  }

  async function handleMilestoneApprove(
    childId
  ) {
    setMsChildPending((prev) => ({
      ...prev,
      [childId]: "approve",
    }));

    setStatus(null);

    try {
      const tx = await approveJob(
        client,
        childId
      );

      setStatus({
        text:
          `Milestone #${childId} approved. Worker paid. tx: ${tx}`,
        tone: "success",
      });

      recordTx(
        "approve",
        tx,
        String(childId)
      );

      await loadMilestoneGroup(
        msParentId
      );
    } catch (e) {
      setStatus({
        text:
          `approve failed: ${e.message}`,
        tone: "error",
      });
    } finally {
      setMsChildPending((prev) => ({
        ...prev,
        [childId]: null,
      }));
    }
  }

  async function handleLookup() {
    const id = parseJobId(lookupId);

    if (id === null) {
      setStatus({
        text:
          "Job ID must be a positive whole number.",
        tone: "error",
      });

      return;
    }

    if (!client) {
      setStatus({
        text: "Connect your wallet first.",
        tone: "error",
      });

      return;
    }

    setPendingAction("lookup");
    setStatus(null);

    try {
      const data = await getJob(
        client,
        id
      );

      setJobData(data);
      setJobId(String(id));
      setViewingFromRecent(false);
      setShowRawJson(false);
    } catch (e) {
      setStatus({
        text:
          `get_job failed: ${e.message}`,
        tone: "error",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function loadRecentJobs() {
    if (!client) return;

    setRecentLoading(true);

    try {
      const count =
        await getJobCount(client);

      const total = Number(
        count?.toString
          ? count.toString()
          : count
      );

      const ids = [];

      for (
        let i = total;
        i >= 1 && ids.length < 10;
        i--
      ) {
        ids.push(i);
      }

      const jobs =
        await Promise.all(
          ids.map(async (id) => {
            try {
              const data =
                await getJob(
                  client,
                  id
                );

              return {
                id,
                data,
              };
            } catch {
              return null;
            }
          })
        );

      setRecentJobs(
        jobs.filter(Boolean)
      );
    } catch (e) {
      setStatus({
        text:
          `Loading recent jobs failed: ${e.message}`,
        tone: "error",
      });
    } finally {
      setRecentLoading(false);
    }
  }

  function handleRecentJobClick(
    id,
    data
  ) {
    setLookupId(String(id));
    setJobId(String(id));
    setJobData(data);
    setViewingFromRecent(true);
    setShowRawJson(false);
  }

  function handleBackToRecent() {
    setJobData(null);
    setLookupId("");
    setViewingFromRecent(false);
  }

  function statusInfo(data) {
    if (!data) return null;

    switch (data.status) {
      case "open":
        return {
          label: "Open",
          description:
            "Waiting for the worker to submit work.",
          tone: "open",
          validActions:
            "Submit Work, Abandon after the grace period",
        };

      case "submitted":
        return {
          label: "Submitted",
          description:
            "Work has been submitted and is awaiting requester action.",
          tone: "open",
          validActions:
            "Approve, Dispute, Abandon after the grace period",
        };

      case "disputed":
        return {
          label: "Disputed",
          description:
            "The dispute is moving through adjudication.",
          tone: "neutral",
          validActions:
            "No action during this transient state",
        };

      case "verdict_pending":
        return {
          label: `Verdict: ${data.pending_verdict}`,
          description: data.verdict_at
            ? `Appeal window closes ${new Date(
                new Date(
                  data.verdict_at
                ).getTime() +
                  APPEAL_WINDOW_MS
              ).toLocaleString()}`
            : "Appeal window is currently open.",
          tone: "pending",
          validActions:
            "Appeal for the losing party, Finalize after the window closes",
        };

      case "evidence_unavailable":
        return {
          label: "Evidence Unavailable",
          description:
            "The submitted evidence could not be verified.",
          tone: "danger",
          validActions:
            "Request fair recovery",
        };

      case "resolved":
        return {
          label: "Resolved",
          description: `Paid to ${
            data.payout_to
          }${
            data.appeal_used
              ? " via appeal"
              : ""
          }.`,
          tone: "success",
          validActions:
            "No action. Job is closed.",
        };

      default:
        return {
          label: data.status,
          description:
            "Current on-chain job status.",
          tone: "neutral",
          validActions: "Unknown",
        };
    }
  }

  const info = statusInfo(jobData);

  function renderNetworkNotice() {
    if (networkStatus === "wrong") {
      return (
        <div className="network-banner tone-warn">
          <IconAlertTriangle />

          <div className="network-banner-content">
            <strong>Wrong network</strong>

            <span>
              Arbiter runs on{" "}
              {REQUIRED_NETWORK_NAME}.
            </span>
          </div>

          <button
            className="btn btn-outline btn-sm"
            onClick={handleSwitchNetwork}
          >
            Switch Network
          </button>
        </div>
      );
    }

    if (networkStatus === "no-wallet") {
      return (
        <div className="network-banner tone-info">
          <IconWallet />

          <div className="network-banner-content">
            <strong>
              Wallet not detected
            </strong>

            <span>
              Connect a compatible wallet to
              use Arbiter.
            </span>
          </div>
        </div>
      );
    }

    return null;
  }

  function renderJobLookup() {
    return (
      <div className="section-content">
        <div className="panel">
          <div className="panel-heading">
            <div className="panel-icon">
              <IconSearch />
            </div>

            <div>
              <h3>Find a job</h3>

              <p>
                Inspect the current status,
                verdict and payout.
              </p>
            </div>
          </div>

          <div className="lookup-row lookup-row-large">
            <input
              className="input"
              placeholder="Enter Job ID"
              inputMode="numeric"
              value={lookupId}
              onChange={(e) =>
                setLookupId(
                  e.target.value
                )
              }
            />

            <button
              className="btn btn-primary"
              onClick={handleLookup}
              disabled={
                !client ||
                pendingAction ===
                  "lookup"
              }
            >
              {pendingAction ===
              "lookup" ? (
                <span className="spinner" />
              ) : (
                <IconSearch />
              )}

              {pendingAction ===
              "lookup"
                ? "Looking up…"
                : "Get Job"}
            </button>
          </div>

          {jobData &&
            viewingFromRecent && (
              <button
                className="btn-ghost back-inline"
                onClick={
                  handleBackToRecent
                }
              >
                ← Back to Recent Jobs
              </button>
            )}

          {jobData && info && (
            <div className="job-result">
              <div
                className={`job-result-status tone-${info.tone}`}
              >
                <div>
                  <span className="status-dot" />

                  <strong>
                    {info.label}
                  </strong>
                </div>

                <span>
                  Job #{lookupId}
                </span>
              </div>

              <div className="job-result-body">
                <p className="job-result-description">
                  {info.description}
                </p>

                <div className="job-detail-grid">
                  <div className="job-detail">
                    <span>Status</span>

                    <strong>
                      {jobData.status}
                    </strong>
                  </div>

                  <div className="job-detail">
                    <span>Escrow</span>

                    <strong>
                      {formatWeiToGen(
                        jobData.amount
                      )}{" "}
                      GEN
                    </strong>
                  </div>

                  <div className="job-detail job-detail-wide">
                    <span>
                      Specification
                    </span>

                    <strong>
                      {jobData.spec}
                    </strong>
                  </div>
                </div>

                <div className="valid-actions">
                  <span>
                    Available:
                  </span>

                  {info.validActions}
                </div>

                <div className="job-result-actions">
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() =>
                      setJobId(
                        String(
                          lookupId
                        )
                      )
                    }
                  >
                    Use Job #
                    {lookupId}
                  </button>

                  <button
                    className="btn-ghost-small"
                    onClick={() =>
                      setShowRawJson(
                        (value) =>
                          !value
                      )
                    }
                  >
                    {showRawJson
                      ? "Hide raw data"
                      : "Show raw data"}
                  </button>
                </div>

                {showRawJson && (
                  <pre className="job-json">
                    {JSON.stringify(
                      jobData,
                      null,
                      2
                    )}
                  </pre>
                )}
              </div>
            </div>
          )}

          {jobData &&
            jobData.is_milestone_parent && (
              <div className="inline-notice">
                <div>
                  <strong>
                    Milestone parent
                  </strong>

                  <span>
                    {
                      jobData.milestone_count
                    }{" "}
                    milestones
                  </span>
                </div>

                <button
                  className="btn btn-outline btn-sm"
                  onClick={() =>
                    loadMilestoneGroup(
                      lookupId
                    )
                  }
                  disabled={
                    !client ||
                    msLoading
                  }
                >
                  {msLoading
                    ? "Loading…"
                    : "View Milestones"}
                </button>
              </div>
            )}

          {jobData &&
            !jobData.is_milestone_parent &&
            jobData.parent_job_id !==
              "0" && (
              <div className="inline-notice">
                <div>
                  <strong>
                    Milestone #
                    {
                      jobData.milestone_index
                    }
                  </strong>

                  <span>
                    Parent #
                    {
                      jobData.parent_job_id
                    }
                  </span>
                </div>

                <button
                  className="btn btn-outline btn-sm"
                  onClick={() =>
                    loadMilestoneGroup(
                      jobData.parent_job_id
                    )
                  }
                  disabled={
                    !client ||
                    msLoading
                  }
                >
                  {msLoading
                    ? "Loading…"
                    : "View Full Group"}
                </button>
              </div>
            )}
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div className="panel-icon">
              <IconHistory />
            </div>

            <div>
              <h3>Recent jobs</h3>

              <p>
                Browse the latest jobs
                without entering an ID.
              </p>
            </div>
          </div>

          <button
            className="btn btn-outline"
            onClick={
              loadRecentJobs
            }
            disabled={
              !client ||
              recentLoading
            }
          >
            {recentLoading && (
              <span className="spinner spinner-dark" />
            )}

            {recentLoading
              ? "Loading…"
              : "Load Recent Jobs"}
          </button>

          {recentJobs.length >
            0 && (
            <>
              <button
                className="btn-ghost back-inline"
                onClick={() =>
                  setRecentJobs([])
                }
              >
                Hide recent jobs
              </button>

              <div className="recent-job-list">
                {recentJobs.map(
                  ({ id, data }) => (
                    <button
                      type="button"
                      className="recent-job"
                      key={id}
                      onClick={() =>
                        handleRecentJobClick(
                          id,
                          data
                        )
                      }
                    >
                      <div className="recent-job-number">
                        #{id}
                      </div>

                      <div className="recent-job-main">
                        <strong>
                          {data.status}
                        </strong>

                        <span>
                          {data.spec}
                        </span>
                      </div>

                      <span className="recent-job-arrow">
                        →
                      </span>
                    </button>
                  )
                )}
              </div>
            </>
          )}
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div className="panel-icon">
              <IconFilePlus />
            </div>

            <div>
              <h3>Create a job</h3>

              <p>
                Escrow GEN against a
                natural-language
                specification.
              </p>
            </div>
          </div>

          <label className="field-label">
            Worker agent address
          </label>

          <input
            className="input"
            placeholder="0x…"
            value={worker}
            onChange={(e) =>
              setWorker(
                e.target.value
              )
            }
          />

          <label className="field-label">
            Job specification
          </label>

          <textarea
            className="textarea"
            placeholder="What should the worker agent deliver?"
            value={spec}
            onChange={(e) =>
              setSpec(e.target.value)
            }
            rows={4}
          />

          <label className="field-label">
            Escrow amount
          </label>

          <div className="input-with-suffix">
            <input
              className="input"
              placeholder="7"
              inputMode="decimal"
              value={amount}
              onChange={(e) =>
                setAmount(
                  e.target.value
                )
              }
            />

            <span>GEN</span>
          </div>

          <button
            className="btn btn-primary btn-full"
            onClick={
              handleCreateJob
            }
            disabled={
              !client ||
              pendingAction ===
                "create_job"
            }
          >
            {pendingAction ===
              "create_job" && (
              <span className="spinner" />
            )}

            {pendingAction ===
            "create_job"
              ? "Creating…"
              : "Create Job"}
          </button>
        </div>
      </div>
    );
  }

  function renderActions() {
    return (
      <div className="section-content">
        <div className="action-context">
          <div>
            <span>
              Working with
            </span>

            <strong>
              {jobId
                ? `Job #${jobId}`
                : "No job selected"}
            </strong>
          </div>

          <input
            className="input"
            placeholder="Job ID"
            inputMode="numeric"
            value={jobId}
            onChange={(e) =>
              setJobId(
                e.target.value
              )
            }
          />
        </div>

        <div className="action-grid">
          <div className="panel action-panel">
            <div className="action-panel-icon">
              <IconUpload />
            </div>

            <div className="action-panel-title">
              Submit Work
            </div>

            <p>
              Submit text, code, or URL
              evidence for the selected
              job.
            </p>

            <textarea
              className="textarea"
              placeholder="URL or text/code"
              value={deliverable}
              onChange={(e) =>
                setDeliverable(
                  e.target.value
                )
              }
              rows={4}
            />

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={isUrl}
                onChange={(e) =>
                  setIsUrl(
                    e.target.checked
                  )
                }
              />

              Deliverable is a URL
            </label>

            <button
              className="btn btn-primary btn-full"
              onClick={
                handleSubmitWork
              }
              disabled={
                !client ||
                pendingAction ===
                  "submit_work"
              }
            >
              {pendingAction ===
                "submit_work" && (
                <span className="spinner" />
              )}

              {pendingAction ===
              "submit_work"
                ? "Submitting…"
                : "Submit Work"}
            </button>
          </div>

          <div className="panel action-panel">
            <div className="action-panel-icon success">
              <IconCheckCircle />
            </div>

            <div className="action-panel-title">
              Approve
            </div>

            <p>
              Approve the submitted
              work and release the
              escrow to the worker.
            </p>

            <button
              className="btn btn-primary btn-full action-bottom"
              onClick={
                handleApprove
              }
              disabled={
                !client ||
                pendingAction ===
                  "approve"
              }
            >
              {pendingAction ===
                "approve" && (
                <span className="spinner" />
              )}

              {pendingAction ===
              "approve"
                ? "Approving…"
                : "Approve & Pay"}
            </button>
          </div>

          <div className="panel action-panel">
            <div className="action-panel-icon danger">
              <IconScale />
            </div>

            <div className="action-panel-title">
              Dispute
            </div>

            <p>
              Send the work to GenLayer
              adjudication when it does
              not satisfy the
              specification.
            </p>

            <textarea
              className="textarea"
              placeholder="Why does the work fail the specification?"
              value={reason}
              onChange={(e) =>
                setReason(
                  e.target.value
                )
              }
              rows={3}
            />

            <button
              className="btn btn-danger btn-full"
              onClick={
                handleDispute
              }
              disabled={
                !client ||
                pendingAction ===
                  "dispute"
              }
            >
              {pendingAction ===
                "dispute" && (
                <span className="spinner" />
              )}

              {pendingAction ===
              "dispute"
                ? "Disputing…"
                : "Dispute Job"}
            </button>
          </div>

          <div className="panel action-panel">
            <div className="action-panel-icon">
              <IconFlag />
            </div>

            <div className="action-panel-title">
              Appeal
            </div>

            <p>
              Available to the losing
              party during the appeal
              window.
            </p>

            <textarea
              className="textarea"
              placeholder="Why should the verdict be reconsidered?"
              value={appealReason}
              onChange={(e) =>
                setAppealReason(
                  e.target.value
                )
              }
              rows={3}
            />

            <button
              className="btn btn-outline btn-full"
              onClick={
                handleAppeal
              }
              disabled={
                !client ||
                pendingAction ===
                  "appeal"
              }
            >
              {pendingAction ===
                "appeal" && (
                <span className="spinner" />
              )}

              {pendingAction ===
              "appeal"
                ? "Appealing…"
                : "Appeal Verdict"}
            </button>
          </div>

          <div className="panel action-panel">
            <div className="action-panel-icon">
              <IconCheckCircle />
            </div>

            <div className="action-panel-title">
              Finalize
            </div>

            <p>
              Finalize the original
              verdict once the appeal
              window has closed.
            </p>

            <button
              className="btn btn-primary btn-full action-bottom"
              onClick={
                handleFinalize
              }
              disabled={
                !client ||
                pendingAction ===
                  "finalize"
              }
            >
              {pendingAction ===
                "finalize" && (
                <span className="spinner" />
              )}

              {pendingAction ===
              "finalize"
                ? "Finalizing…"
                : "Finalize Verdict"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderMilestones() {
    return (
      <div className="section-content">
        <div className="panel">
          <div className="panel-heading">
            <div className="panel-icon">
              <IconFilePlus />
            </div>

            <div>
              <h3>
                Create milestone
                job
              </h3>

              <p>
                Split one engagement
                into independent
                escrowed milestone
                jobs.
              </p>
            </div>
          </div>

          <label className="field-label">
            Worker agent address
          </label>

          <input
            className="input"
            placeholder="0x…"
            value={milestoneWorker}
            onChange={(e) =>
              setMilestoneWorker(
                e.target.value
              )
            }
          />

          <label className="field-label">
            Milestones
          </label>

          <div className="milestone-editor">
            {milestoneRows.map(
              (row, index) => (
                <div
                  className="milestone-row"
                  key={index}
                >
                  <div className="milestone-number">
                    {String(
                      index + 1
                    ).padStart(2, "0")}
                  </div>

                  <textarea
                    className="textarea milestone-row-spec"
                    placeholder={`Milestone ${
                      index + 1
                    } specification`}
                    value={row.spec}
                    onChange={(e) =>
                      updateMilestoneRow(
                        index,
                        "spec",
                        e.target.value
                      )
                    }
                    rows={3}
                  />

                  <div className="milestone-amount">
                    <input
                      className="input"
                      placeholder="Amount"
                      inputMode="decimal"
                      value={
                        row.amount
                      }
                      onChange={(e) =>
                        updateMilestoneRow(
                          index,
                          "amount",
                          e.target.value
                        )
                      }
                    />

                    <span>GEN</span>
                  </div>

                  <button
                    type="button"
                    className="milestone-remove"
                    onClick={() =>
                      removeMilestoneRow(
                        index
                      )
                    }
                    disabled={
                      milestoneRows.length <=
                      2
                    }
                    title="Remove milestone"
                  >
                    ×
                  </button>
                </div>
              )
            )}
          </div>

          <div className="milestone-controls">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={
                addMilestoneRow
              }
            >
              + Add Milestone
            </button>

            <div className="milestone-total-card">
              <span>
                Total escrow
              </span>

              <strong>
                {milestoneTotal ||
                  0}{" "}
                GEN
              </strong>
            </div>
          </div>

          <button
            className="btn btn-primary btn-full"
            onClick={
              handleCreateMilestoneJob
            }
            disabled={
              !client ||
              pendingAction ===
                "create_milestone_job"
            }
          >
            {pendingAction ===
              "create_milestone_job" && (
              <span className="spinner" />
            )}

            {pendingAction ===
            "create_milestone_job"
              ? "Creating…"
              : "Create Milestone Job"}
          </button>

          {milestoneResult && (
            <div className="success-box">
              <IconCheckCircle />

              <div>
                <strong>
                  Parent #
                  {
                    milestoneResult.parentJobId
                  }
                </strong>

                <span>
                  Milestones:{" "}
                  {milestoneResult.milestoneJobIds
                    .map(
                      (id) =>
                        `#${id}`
                    )
                    .join(", ")}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div className="panel-icon">
              <IconScale />
            </div>

            <div>
              <h3>
                Manage milestone
                group
              </h3>

              <p>
                Load a parent job and
                manage each milestone
                individually.
              </p>
            </div>
          </div>

          <div className="lookup-row lookup-row-large">
            <input
              className="input"
              placeholder="Parent Job ID"
              inputMode="numeric"
              value={msParentId}
              onChange={(e) =>
                setMsParentId(
                  e.target.value
                )
              }
            />

            <button
              className="btn btn-primary"
              onClick={
                handleLoadMilestoneGroupClick
              }
              disabled={
                !client ||
                msLoading
              }
            >
              {msLoading && (
                <span className="spinner" />
              )}

              {msLoading
                ? "Loading…"
                : "Load Group"}
            </button>
          </div>

          {msParent && (
            <div className="milestone-parent-status">
              <span>
                Parent status
              </span>

              <strong>
                {msParent.status}
              </strong>
            </div>
          )}

          {msChildren.length >
            0 && (
            <div className="milestone-list">
              {msChildren.map(
                ({ id, data }) => {
                  const childInfo =
                    statusInfo(
                      data
                    );

                  const draft =
                    msChildDrafts[
                      id
                    ] || {
                      deliverable:
                        "",
                      isUrl:
                        false,
                    };

                  const pending =
                    msChildPending[
                      id
                    ];

                  return (
                    <div
                      className="milestone-card"
                      key={id}
                    >
                      <div className="milestone-card-head">
                        <div className="milestone-card-id">
                          Milestone{" "}
                          {
                            data.milestone_index
                          }
                        </div>

                        <span
                          className={`milestone-card-badge tone-${
                            childInfo?.tone ||
                            "neutral"
                          }`}
                        >
                          {
                            data.status
                          }
                        </span>

                        <div className="milestone-card-amount">
                          {formatWeiToGen(
                            data.amount
                          )}{" "}
                          GEN
                        </div>
                      </div>

                      <div className="milestone-card-spec">
                        {data.spec}
                      </div>

                      <div className="milestone-card-body">
                        {data.status ===
                          "open" && (
                          <>
                            <label className="field-label">
                              Deliverable
                            </label>

                            <textarea
                              className="textarea"
                              placeholder="URL or text/code"
                              value={
                                draft.deliverable
                              }
                              onChange={(
                                e
                              ) =>
                                updateMilestoneDraft(
                                  id,
                                  "deliverable",
                                  e.target.value
                                )
                              }
                              rows={
                                3
                              }
                            />

                            <label className="checkbox-row">
                              <input
                                type="checkbox"
                                checked={
                                  draft.isUrl
                                }
                                onChange={(
                                  e
                                ) =>
                                  updateMilestoneDraft(
                                    id,
                                    "isUrl",
                                    e
                                      .target
                                      .checked
                                  )
                                }
                              />

                              Deliverable
                              is a URL
                            </label>

                            <button
                              className="btn btn-primary"
                              onClick={() =>
                                handleMilestoneSubmit(
                                  id
                                )
                              }
                              disabled={
                                !client ||
                                pending ===
                                  "submit_work"
                              }
                            >
                              {pending ===
                                "submit_work" && (
                                <span className="spinner" />
                              )}

                              {pending ===
                              "submit_work"
                                ? "Submitting…"
                                : "Submit Work"}
                            </button>
                          </>
                        )}

                        {data.status ===
                          "submitted" && (
                          <button
                            className="btn btn-primary"
                            onClick={() =>
                              handleMilestoneApprove(
                                id
                              )
                            }
                            disabled={
                              !client ||
                              pending ===
                                "approve"
                            }
                          >
                            {pending ===
                              "approve" && (
                              <span className="spinner" />
                            )}

                            {pending ===
                            "approve"
                              ? "Approving…"
                              : "Approve & Pay"}
                          </button>
                        )}

                        {data.status !==
                          "open" &&
                          data.status !==
                            "submitted" && (
                            <div className="milestone-note">
                              {
                                childInfo?.validActions
                              }

                              <span>
                                Use Job
                                Actions
                                with Job #
                                {id} for
                                dispute,
                                appeal,
                                finalize or
                                recovery.
                              </span>
                            </div>
                          )}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderRecovery() {
    return (
      <div className="section-content recovery-grid">
        <div className="panel recovery-panel">
          <div className="panel-heading">
            <div className="panel-icon danger">
              <IconLifeBuoy />
            </div>

            <div>
              <h3>
                Evidence unavailable
              </h3>

              <p>
                Request the deterministic
                50/50 recovery when
                submitted evidence cannot
                be verified.
              </p>
            </div>
          </div>

          <label className="field-label">
            Job ID
          </label>

          <input
            className="input"
            placeholder="e.g. 1"
            inputMode="numeric"
            value={jobId}
            onChange={(e) =>
              setJobId(
                e.target.value
              )
            }
          />

          <label className="field-label">
            Recovery reason
          </label>

          <textarea
            className="textarea"
            placeholder="Why is the evidence unavailable?"
            value={recoveryReason}
            onChange={(e) =>
              setRecoveryReason(
                e.target.value
              )
            }
            rows={3}
          />

          <button
            className="btn btn-outline btn-full"
            onClick={
              handleRecover
            }
            disabled={
              !client ||
              pendingAction ===
                "recover_unavailable_job"
            }
          >
            {pendingAction ===
              "recover_unavailable_job" && (
              <span className="spinner" />
            )}

            {pendingAction ===
            "recover_unavailable_job"
              ? "Requesting…"
              : "Request 50/50 Recovery"}
          </button>
        </div>

        <div className="panel recovery-panel">
          <div className="panel-heading">
            <div className="panel-icon warning">
              <IconAlertTriangle />
            </div>

            <div>
              <h3>
                Abandon job
              </h3>

              <p>
                Claim abandonment after
                the required grace period.
              </p>
            </div>
          </div>

          <label className="field-label">
            Job ID
          </label>

          <input
            className="input"
            placeholder="e.g. 1"
            inputMode="numeric"
            value={jobId}
            onChange={(e) =>
              setJobId(
                e.target.value
              )
            }
          />

          <label className="field-label">
            Abandonment reason
          </label>

          <textarea
            className="textarea"
            placeholder="e.g. worker never started"
            value={abandonReason}
            onChange={(e) =>
              setAbandonReason(
                e.target.value
              )
            }
            rows={3}
          />

          <button
            className="btn btn-outline btn-full"
            onClick={
              handleAbandon
            }
            disabled={
              !client ||
              pendingAction ===
                "abandon_job"
            }
          >
            {pendingAction ===
              "abandon_job" && (
              <span className="spinner" />
            )}

            {pendingAction ===
            "abandon_job"
              ? "Claiming…"
              : "Claim Abandoned Job"}
          </button>
        </div>
      </div>
    );
  }

  function renderTransactions() {
    return (
      <div className="section-content">
        <div className="panel">
          <div className="panel-heading">
            <div className="panel-icon">
              <IconHistory />
            </div>

            <div>
              <h3>
                Transaction history
              </h3>

              <p>
                Local transaction history
                for the connected wallet.
              </p>
            </div>
          </div>

          {!account && (
            <div className="empty-state">
              <IconWallet />

              <strong>
                Connect your wallet
              </strong>

              <span>
                Your transaction history
                will appear here after
                connecting.
              </span>
            </div>
          )}

          {account &&
            visibleHistory.length ===
              0 && (
              <div className="empty-state">
                <IconHistory />

                <strong>
                  No transactions yet
                </strong>

                <span>
                  Actions taken by this
                  wallet will appear here.
                </span>
              </div>
            )}

          {visibleHistory.length >
            0 && (
            <div className="transaction-list">
              {visibleHistory.map(
                (entry, index) => {
                  const url =
                    txExplorerUrl(
                      entry.tx
                    );

                  return (
                    <div
                      className="transaction-row"
                      key={`${entry.tx}-${index}`}
                    >
                      <div className="transaction-icon">
                        <IconCheckCircle />
                      </div>

                      <div className="transaction-main">
                        <strong>
                          {entry.action}
                        </strong>

                        <span>
                          {entry.jobId
                            ? `Job #${entry.jobId}`
                            : "Contract transaction"}
                        </span>
                      </div>

                      <div className="transaction-right">
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {entry.tx.slice(
                              0,
                              8
                            )}
                            …
                            {entry.tx.slice(
                              -6
                            )}
                          </a>
                        ) : (
                          <span>
                            {entry.tx.slice(
                              0,
                              8
                            )}
                            …
                            {entry.tx.slice(
                              -6
                            )}
                          </span>
                        )}

                        <time>
                          {new Date(
                            entry.time
                          ).toLocaleTimeString()}
                        </time>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderSettings() {
    return (
      <div className="section-content settings-grid">
        <div className="panel">
          <div className="panel-heading">
            <div className="panel-icon">
              <IconWallet />
            </div>

            <div>
              <h3>Wallet</h3>

              <p>
                The wallet currently
                connected to Arbiter.
              </p>
            </div>
          </div>

          {!account ? (
            <div className="settings-value">
              <span>
                Wallet status
              </span>

              <strong>
                Not connected
              </strong>

              <button
                className="btn btn-primary"
                onClick={
                  handleConnect
                }
                disabled={
                  pendingAction ===
                  "connect"
                }
              >
                {pendingAction ===
                  "connect" && (
                  <span className="spinner" />
                )}

                {pendingAction ===
                "connect"
                  ? "Connecting…"
                  : "Connect Wallet"}
              </button>
            </div>
          ) : (
            <div className="wallet-detail">
              <div className="wallet-detail-icon">
                <span />
              </div>

              <div>
                <span>
                  Connected wallet
                </span>

                <strong>
                  {account}
                </strong>
              </div>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div className="panel-icon">
              <IconScale />
            </div>

            <div>
              <h3>Network</h3>

              <p>
                Arbiter requires the
                configured GenLayer
                network.
              </p>
            </div>
          </div>

          <div
            className={`network-detail network-${networkStatus}`}
          >
            <span className="network-status-dot" />

            <div>
              <span>
                Current status
              </span>

              <strong>
                {networkStatus ===
                "correct"
                  ? REQUIRED_NETWORK_NAME
                  : networkStatus ===
                    "wrong"
                  ? "Wrong network"
                  : networkStatus ===
                    "no-wallet"
                  ? "Wallet unavailable"
                  : "Checking…"}
              </strong>
            </div>
          </div>

          {networkStatus ===
            "wrong" && (
            <button
              className="btn btn-outline btn-full"
              onClick={
                handleSwitchNetwork
              }
            >
              Switch to{" "}
              {REQUIRED_NETWORK_NAME}
            </button>
          )}
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div className="panel-icon">
              <IconHistory />
            </div>

            <div>
              <h3>
                Local data
              </h3>

              <p>
                Transaction history is
                saved locally on this
                device.
              </p>
            </div>
          </div>

          <div className="data-stat">
            <strong>
              {visibleHistory.length}
            </strong>

            <span>
              saved transactions for
              this wallet
            </span>
          </div>

          <p className="settings-note">
            Transaction history does
            not represent on-chain
            state. It is only a
            convenience record stored
            in your browser.
          </p>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div className="panel-icon">
              <IconFilePlus />
            </div>

            <div>
              <h3>
                About Arbiter
              </h3>

              <p>
                Agent-to-agent escrow
                with GenLayer
                adjudication.
              </p>
            </div>
          </div>

          <div className="about-list">
            <div>
              <span>
                Architecture
              </span>

              <strong>
                GenLayer
              </strong>
            </div>

            <div>
              <span>
                Escrow asset
              </span>

              <strong>
                GEN
              </strong>
            </div>

            <div>
              <span>
                Job IDs
              </span>

              <strong>
                1-based
              </strong>
            </div>
          </div>

          <a
            className="btn btn-outline btn-full"
            href="https://github.com/Naseer32/Arbiter"
            target="_blank"
            rel="noopener noreferrer"
          >
            View Source on GitHub
          </a>
        </div>
      </div>
    );
  }

  function renderSection() {
    switch (activeSection) {
      case "jobs":
        return renderJobLookup();

      case "actions":
        return renderActions();

      case "milestones":
        return renderMilestones();

      case "transactions":
        return renderTransactions();

      case "recovery":
        return renderRecovery();

      case "settings":
        return renderSettings();

      default:
        return null;
    }
  }

  const sectionMeta = {
    jobs: {
      eyebrow: "01",
      title: "Jobs",
      description:
        "Create jobs, inspect their status, and browse recent activity.",
    },

    actions: {
      eyebrow: "02",
      title: "Job Actions",
      description:
        "Submit work, approve, dispute, appeal, or finalize a job.",
    },

    milestones: {
      eyebrow: "03",
      title: "Milestones",
      description:
        "Create multi-part jobs and manage each milestone independently.",
    },

    transactions: {
      eyebrow: "04",
      title: "Transactions",
      description:
        "Review transactions recorded by the connected wallet.",
    },

    recovery: {
      eyebrow: "05",
      title: "Recovery",
      description:
        "Handle unavailable evidence and eligible abandoned jobs.",
    },

    settings: {
      eyebrow: "06",
      title: "Settings",
      description:
        "Manage wallet context, network information, and local app data.",
    },
  };

  const currentSection =
    sectionMeta[activeSection];

  return (
    <div className="arbiter-root">
      <header className="app-header">
        <div className="app-header-main">
          <button
            className="brand-button"
            onClick={goDashboard}
            type="button"
            aria-label="Go to Arbiter dashboard"
          >
            <span className="brand-mark">
              A
            </span>

            <span>
              <strong>
                Arbiter
              </strong>

              <small>
                GenLayer escrow
              </small>
            </span>
          </button>

          <div className="header-wallet">
            {!account ? (
              <button
                className="btn btn-primary btn-connect"
                onClick={
                  handleConnect
                }
                disabled={
                  pendingAction ===
                  "connect"
                }
              >
                {pendingAction ===
                  "connect" && (
                  <span className="spinner" />
                )}

                <IconWallet />

                {pendingAction ===
                "connect"
                  ? "Connecting…"
                  : "Connect"}
              </button>
            ) : (
              <div
                className="wallet-box"
                title={account}
              >
                <span className="wallet-dot" />

                <span className="wallet-address">
                  {account.slice(
                    0,
                    6
                  )}
                  …
                  {account.slice(
                    -4
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        {activeSection !==
          "dashboard" && (
          <button
            className="back-dashboard"
            onClick={
              goDashboard
            }
            type="button"
          >
            ← Dashboard
          </button>
        )}
      </header>

      {renderNetworkNotice()}

      {activeSection ===
      "dashboard" ? (
        <main className="dashboard">
          <div className="dashboard-intro">
            <div className="dashboard-eyebrow">
              Agent-to-agent commerce
            </div>

            <h1>
              What do you want
              to do?
            </h1>

            <p>
              Manage escrowed jobs,
              resolve disputes, and
              track activity from one
              place.
            </p>
          </div>

          <div className="dashboard-grid">
            <SectionCard
              icon={IconSearch}
              title="Jobs"
              description="Create, find, and browse jobs."
              items={[
                "Create Job",
                "Get Job",
                "Recent Jobs",
              ]}
              onClick={() =>
                openSection(
                  "jobs"
                )
              }
              accent
            />

            <SectionCard
              icon={IconScale}
              title="Job Actions"
              description="Move a job through its lifecycle."
              items={[
                "Submit",
                "Approve",
                "Dispute",
                "Appeal",
              ]}
              onClick={() =>
                openSection(
                  "actions"
                )
              }
            />

            <SectionCard
              icon={IconFilePlus}
              title="Milestones"
              description="Manage multi-part engagements."
              items={[
                "Create",
                "Load Group",
                "Submit",
                "Approve",
              ]}
              onClick={() =>
                openSection(
                  "milestones"
                )
              }
            />

            <SectionCard
              icon={IconHistory}
              title="Transactions"
              description="See your recent on-chain actions."
              items={[
                "History",
                "Job IDs",
                "Explorer",
              ]}
              onClick={() =>
                openSection(
                  "transactions"
                )
              }
            />

            <SectionCard
              icon={IconLifeBuoy}
              title="Recovery"
              description="Handle exceptional job states."
              items={[
                "Unavailable Evidence",
                "Abandon",
              ]}
              onClick={() =>
                openSection(
                  "recovery"
                )
              }
            />

            <SectionCard
              icon={IconWallet}
              title="Settings"
              description="Wallet, network, and app details."
              items={[
                "Wallet",
                "Network",
                "Local Data",
              ]}
              onClick={() =>
                openSection(
                  "settings"
                )
              }
            />
          </div>

          <div className="dashboard-footer">
            <div className="dashboard-footer-icon">
              <IconCheckCircle />
            </div>

            <div>
              <strong>
                Built around verifiable
                outcomes.
              </strong>

              <span>
                GenLayer provides the
                adjudication layer when
                agents disagree.
              </span>
            </div>
          </div>
        </main>
      ) : (
        <main className="section-page">
          <div className="section-page-header">
            <div className="section-page-number">
              {currentSection.eyebrow}
            </div>

            <div>
              <div className="section-page-kicker">
                {currentSection.eyebrow}{" "}
                / 06
              </div>

              <h1>
                {currentSection.title}
              </h1>

              <p>
                {currentSection.description}
              </p>
            </div>
          </div>

          {renderSection()}
        </main>
      )}

      {status && (
        <div
          className={`toast ${
            status.tone ===
            "error"
              ? "tone-error"
              : status.tone ===
                "success"
              ? "tone-success"
              : ""
          }`}
        >
          <span className="toast-mark">
            {status.tone ===
            "error"
              ? "!"
              : "✓"}
          </span>

          <span>
            {status.text}
          </span>

          <button
            type="button"
            className="toast-close"
            onClick={() =>
              setStatus(null)
            }
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
