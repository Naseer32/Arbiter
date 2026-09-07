import { useEffect, useState } from "react";
import {
  connectWallet,
  getClient,
  onAccountsChanged,
  createJob,
  submitWork,
  approveJob,
  disputeJob,
  recoverUnavailableJob,
  abandonJob,
  getJob,
} from "./genlayer.js";

const weiPerGen = 1_000_000_000_000_000_000n;

export default function App() {
  const [account, setAccount] = useState(null);
  const [client, setClient] = useState(null);
  const [status, setStatus] = useState("");

  const [worker, setWorker] = useState("");
  const [spec, setSpec] = useState("");
  const [amount, setAmount] = useState("");

  const [jobId, setJobId] = useState("");
  const [deliverable, setDeliverable] = useState("");
  const [isUrl, setIsUrl] = useState(true);
  const [reason, setReason] = useState("");
  const [recoveryReason, setRecoveryReason] = useState("");
  const [abandonReason, setAbandonReason] = useState("");

  const [lookupId, setLookupId] = useState("");
  const [jobData, setJobData] = useState(null);

  async function handleConnect() {
    try {
      const acc = await connectWallet();
      setAccount(acc);
      setClient(getClient(acc));
      setStatus(`Connected: ${acc}`);
    } catch (e) {
      setStatus(`Connect failed: ${e.message}`);
    }
  }

  // If the user switches accounts in their wallet mid-session, rebuild the
  // client with the new account instead of silently signing with the old one.
  useEffect(() => {
    const unsubscribe = onAccountsChanged((newAccount) => {
      if (!newAccount) {
        setAccount(null);
        setClient(null);
        setStatus("Wallet disconnected.");
        return;
      }
      setAccount(newAccount);
      setClient(getClient(newAccount));
      setStatus(`Switched account: ${newAccount}`);
    });
    return unsubscribe;
  }, []);

  async function handleCreateJob() {
    try {
      const amountWei = BigInt(Math.floor(parseFloat(amount || "0") * 1e18));
      const tx = await createJob(client, worker, spec, amountWei);
      setStatus(`Job created. tx: ${tx}`);
    } catch (e) {
      setStatus(`create_job failed: ${e.message}`);
    }
  }

  async function handleSubmitWork() {
    try {
      const tx = await submitWork(client, Number(jobId), deliverable, isUrl);
      setStatus(`Work submitted. tx: ${tx}`);
    } catch (e) {
      setStatus(`submit_work failed: ${e.message}`);
    }
  }

  async function handleApprove() {
    try {
      const tx = await approveJob(client, Number(jobId));
      setStatus(`Approved, worker paid. tx: ${tx}`);
    } catch (e) {
      setStatus(`approve failed: ${e.message}`);
    }
  }

  async function handleDispute() {
    try {
      const tx = await disputeJob(client, Number(jobId), reason);
      setStatus(`Dispute submitted for adjudication. tx: ${tx}`);
    } catch (e) {
      setStatus(`dispute failed: ${e.message}`);
    }
  }

  async function handleRecover() {
    try {
      const tx = await recoverUnavailableJob(client, Number(jobId), recoveryReason);
      setStatus(`Recovery requested (50/50 split). tx: ${tx}`);
    } catch (e) {
      setStatus(`recover_unavailable_job failed: ${e.message}`);
    }
  }

  async function handleAbandon() {
    try {
      const tx = await abandonJob(client, Number(jobId), abandonReason);
      setStatus(`Abandonment claim submitted. tx: ${tx}`);
    } catch (e) {
      setStatus(`abandon_job failed: ${e.message}`);
    }
  }

  async function handleLookup() {
    try {
      const data = await getJob(client, Number(lookupId));
      setJobData(data);
    } catch (e) {
      setStatus(`get_job failed: ${e.message}`);
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>Arbiter</h1>
      <p style={{ color: "#666" }}>
        Agent-to-agent escrow. GenLayer validators independently adjudicate disputed work
        against the original spec before releasing payment.
      </p>

      {!account ? (
        <button onClick={handleConnect}>Connect Wallet</button>
      ) : (
        <p style={{ fontSize: 13, wordBreak: "break-all" }}>Connected: {account}</p>
      )}

      <hr />

      <section>
        <h2>1. Requester: Post a Job</h2>
        <input placeholder="Worker agent address" value={worker} onChange={(e) => setWorker(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
        <textarea placeholder="Job spec (natural-language requirements)" value={spec} onChange={(e) => setSpec(e.target.value)} style={{ width: "100%", marginBottom: 8 }} rows={3} />
        <input placeholder="Escrow amount (GEN)" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
        <button onClick={handleCreateJob} disabled={!client}>Create Job</button>
      </section>

      <hr />

      <section>
        <h2>2. Worker: Submit Deliverable</h2>
        <input placeholder="Job ID" value={jobId} onChange={(e) => setJobId(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
        <textarea placeholder="Deliverable (URL or text/code)" value={deliverable} onChange={(e) => setDeliverable(e.target.value)} style={{ width: "100%", marginBottom: 8 }} rows={3} />
        <label style={{ display: "block", marginBottom: 8 }}>
          <input type="checkbox" checked={isUrl} onChange={(e) => setIsUrl(e.target.checked)} /> Deliverable is a URL
        </label>
        <button onClick={handleSubmitWork} disabled={!client}>Submit Work</button>
      </section>

      <hr />

      <section>
        <h2>3. Requester: Approve or Dispute</h2>
        <input placeholder="Job ID" value={jobId} onChange={(e) => setJobId(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
        <button onClick={handleApprove} disabled={!client} style={{ marginRight: 8 }}>Approve (pay worker)</button>
        <div style={{ marginTop: 12 }}>
          <input placeholder="Dispute reason" value={reason} onChange={(e) => setReason(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
          <button onClick={handleDispute} disabled={!client}>Dispute → Adjudicate</button>
        </div>
      </section>

      <hr />

      <section>
        <h2>Evidence-Unavailable Recovery</h2>
        <input placeholder="Job ID" value={jobId} onChange={(e) => setJobId(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
        <input placeholder="Recovery reason" value={recoveryReason} onChange={(e) => setRecoveryReason(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
        <button onClick={handleRecover} disabled={!client}>Request Fair Recovery (50/50 split)</button>
      </section>

      <hr />

      <section>
        <h2>Abandonment</h2>
        <input placeholder="Job ID" value={jobId} onChange={(e) => setJobId(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
        <input placeholder="Abandonment reason" value={abandonReason} onChange={(e) => setAbandonReason(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
        <button onClick={handleAbandon} disabled={!client}>Claim Abandoned (after grace period)</button>
      </section>

      <hr />

      <section>
        <h2>Look Up a Job</h2>
        <input placeholder="Job ID" value={lookupId} onChange={(e) => setLookupId(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
        <button onClick={handleLookup} disabled={!client}>Get Job</button>
        {jobData && (
          <pre style={{ background: "#f5f5f5", padding: 12, marginTop: 12, overflowX: "auto" }}>
            {JSON.stringify(jobData, null, 2)}
          </pre>
        )}
      </section>

      {status && <p style={{ marginTop: 24, fontSize: 13, color: "#333" }}>{status}</p>}
    </div>
  );
}
