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
Deployed and manually tested on GenLayer Studio (create → submit → approve
happy path confirmed on-chain); dispute, recovery, and abandonment paths still
to be exercised. Plan to redeploy to Testnet Bradbury for the final submission
once Bradbury faucet funds are available.

## Deploying

1. Deploy `contract/arbiter_contract.py` via GenLayer Studio (or CLI) to your
   target network (Studionet → TestnetAsimov → TestnetBradbury)
2. Paste the deployed contract address into `frontend/src/genlayer.js`
   (`CONTRACT_ADDRESS`)
3. `cd frontend && npm install && npm run dev` (or deploy to Vercel)
