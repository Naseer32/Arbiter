# Arbiter

Agent-to-agent escrow protocol for GenLayer's Agent Tank hackathon (Agentic Commerce Infrastructure track).

GenLayer acts as the neutral judge: payment is locked in escrow while one AI agent
performs a task for another, and independent GenLayer validators evaluate the
delivered work against the original spec before releasing payment.

**Flow:** Specification → Escrow → Work → Evidence → GenLayer Adjudication → Consensus → Payment

## Why

AI agents are starting to hire other AI agents for research, coding, data
collection, and content work. Traditional smart contracts can move money and
check simple conditions, but they can't judge whether complex delivered work
satisfies a natural-language spec. Arbiter adds that adjudication layer:
GenLayer's Intelligent Contracts run the judgment via independent validator
consensus, so no single party — human or agent — is the judge of their own case.

## How it works

1. **Requester agent** posts a job spec and escrows payment (`create_job`)
2. **Worker agent** submits a deliverable — text/code, or a URL (`submit_work`)
   - URL deliverables are content-hashed (SHA-256) via multi-validator
     consensus at submission time, pinning a snapshot
3. **Requester** either approves directly (`approve`) or disputes (`dispute`)
4. On dispute, validators independently re-run adjudication against the
   original spec and must agree on a verdict — for URL deliverables, only
   against the pinned snapshot, not whatever the URL shows later
5. If the pinned snapshot can't be verified (URL was unreachable, or content
   has drifted), the job routes to `evidence_unavailable` and either party can
   request a fair `recover_unavailable_job` resolution
6. If a worker never submits, the requester can reclaim escrow via
   `abandon_job` after a time-gated grace period

## Repo layout

```
contract/arbiter_contract.py   GenLayer Intelligent Contract (Python)
frontend/                      Vite + React app (genlayer-js, MetaMask wallet connect)
tests/                         gltest/pytest suite run against live consensus
```

## Status

Contract logic (independent leader/validate verdict consensus, digest-pinning,
1-based job IDs, deterministic 50/50 evidence-unavailable split, two-sided
abandonment recovery, `emit_transfer`-based payouts) is ported directly from
the accepted, testnet-verified genlayer-escrow submission's proven patterns.
Frontend rebuilds its client automatically on wallet account switches.
Deployed and manually tested on GenLayer Studio Next (chain 61997).

Fresh on-chain tests:
- Job #3: Create → Submit → Approve → `resolved`, with payment released to the worker.
- Job #5: Create → Submit → Dispute → GenLayer validator verdict → Appeal → `resolved`, with payment released to the requester.

## Deploying

1. Deploy `contract/arbiter_contract.py` via GenLayer Studio (or CLI) to your
   target network — GenLayer Studio Next (chain 61997, RPC: https://studio-next.genlayer.com/api)
2. Paste the deployed contract address into `frontend/src/genlayer.js`
   (`CONTRACT_ADDRESS`)
3. `cd frontend && npm install && npm run dev` (or deploy to Vercel)

## Try It (For Reviewers)

**Live app:** https://frontend-kube.vercel.app/

### 1. Add Studio Next/Dev to your wallet
Open MetaMask → Add Network → enter manually:
- Network Name: GenLayer Studio Next
- RPC URL: https://studio-next.genlayer.com/api
- Chain ID: 61997
- Currency Symbol: GEN
- Block Explorer: https://explorer-studio-next.genlayer.com/

### 2. Get test GEN
Open [GenLayer Studio Next](https://studio-next.genlayer.com/) and use the built-in faucet to fund your wallet address with test GEN.

### 3. Walk through a job
1. Open the [live app](https://arbiter-v2.vercel.app/) and connect your wallet
2. Click **Create Job** — enter a spec and escrow amount
3. Switch MetaMask to a second test account (the "worker")
4. Submit a deliverable (text, code, or a URL) via **Submit Work**
5. Switch back to the requester account
6. Either **Approve** (happy path) or **Dispute** (triggers independent validator re-adjudication against the original spec)
7. Watch the job status update on-chain — check the transaction on the [explorer](https://explorer-studio-next.genlayer.com/)

### Optional: Verify Without a Wallet

To confirm the contract is live on-chain without connecting a wallet, run a
read-only check directly against Studio Next:

```bash
cd frontend
node scripts/verify_live_contract.mjs
```

This calls `job_count()` and `get_job()` directly via genlayer-js and prints
real on-chain job data -- confirms the deployment is live independent of the
frontend UI.

### Notes
- All transactions are on Studio Next/Dev (chain 61997) — this is a release-candidate environment and may reset periodically.
- Write transactions carry a live fee estimate (deploy/write require `FeesDistribution`); the frontend handles this automatically.
## What's New in v2 (Milestone)

v2 is additive: every v1 function behaves as before, and the milestone-job
flow is unchanged. Changes are visible in `contract/arbiter_contract.py`.

| Change | Type | Why |
|---|---|---|
| `request_revision(job_id, feedback)` | New contract functionality | Requester can send work back (max 2 rounds) instead of jumping straight to a paid dispute. Deterministic, no LLM. Job returns to `open`; abandonment clock restarts. |
| `get_reputation(address)` | New view | On-chain track record (paid/resolved as worker, refunds as requester, disputes, appeals) computed from job history, no extra storage. |
| `get_stats()` | New view | Protocol-wide counters: jobs, resolved, disputed, appealed, revisions, resolved volume. |
| Appeal now judges pinned content | Security / correctness fix | v1 passed the raw URL string to the checklist adjudicator on appeal. v2 re-fetches the page, verifies it against the SHA-256 digest pinned at submission, and judges the real content. If the page is gone or has drifted, the job routes to the deterministic 50/50 `evidence_unavailable` recovery. |
| `version()` | New view | Returns `arbiter-v2` so reviewers can confirm which build is deployed. |
| Bradbury testnet deployment | New deployment | See below. |

### Bradbury testnet

- Network: GenLayer Bradbury testnet
- RPC: `https://rpc-bradbury.genlayer.com`
- Chain ID: `4221`
- Contract address: `0xee9AaBa728bF4D057b3578E2519952d9eA92b80B`
- Explorer: `https://explorer-bradbury.genlayer.com/`

Live app: `https://arbiter-v2.vercel.app/`

On-chain verification (fresh jobs on v2):
- Live stats from `get_stats()`: 4 jobs created, 2 resolved through Create → Submit → Approve (0.2 GEN released to workers)
- Job 4 (Bradbury): Create → Submit → Dispute (validators ruled for requester) → Appeal → `resolved`, paid to requester. Dispute tx `0x4cdf9739f3e1a347ff8c3497d670852b4a91ca741efecc71c20553c755631e99`, appeal tx `0x92e505572cff9486717e9d4475d841084d6b434cf07333b8f490fc3caca6ddc7`

## Roadmap

**Phase 1: Core escrow (done)**
- Job escrow, submit, approve, dispute, appeal, finalize
- Digest-pinned URL evidence, deterministic recovery and abandonment rules
- Milestone jobs with independent per-milestone escrow
- Frontend on Vercel, deployed on GenLayer Studio

**Phase 2: Hardening and reach (v2, current)**
- Bradbury testnet deployment
- Revision rounds, reputation and protocol stats views
- Appeal evidence integrity fix
- Frontend: reputation badges and a revision flow

**Phase 3: Stronger adjudication**
- Evidence from both sides (counter-evidence before a verdict is final)
- Per-job configurable appeal window and abandonment period
- Optional worker stake / bond to discourage low-effort submissions
- Reputation-weighted dispute outcomes

**Phase 4: Agent integration**
- SDK and `@genlayer/transaction-kit` integration so agents can hire agents programmatically
- Agent-readable job spec templates (research, code, data collection, content)
- Webhooks / event feed for job status changes

**Phase 5: Production readiness**
- Protocol fee and treasury design
- Independent security review
- Mainnet deployment once GenLayer mainnet is available
