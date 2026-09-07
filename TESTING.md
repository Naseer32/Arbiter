# Manual Testing — Live On-Chain Evidence

All tests below were run against the deployed Arbiter contract on GenLayer
Studio:

**Contract address:** `0x5CCF4f0e7b3392C48ff2BE2A894e08A92863A2Db`
**Network:** GenLayer Studio (`studio.genlayer.com`)
**Test wallets:**
- `0x53b20BeADADe01b46a3fb5bdbC85D3A7B0f12A96`
- `0x5E31205009bC47842DAb8534F7492823A4dE6b35`

> **Note on abandonment timing:** Test 4 below was run with `ABANDONMENT_PERIOD`
> temporarily shortened to 1 hour (from the shipped 7-day value) purely to make
> the timeout observable within a live testing session. The contract source in
> this repo has since been reverted to the real 7-day threshold; this test
> demonstrates the abandonment *logic* is correct, not the literal production
> timing.

---

## Test 1 — Happy Path (create → submit → approve)

Good-faith work submitted and accepted directly, no dispute needed.

- **Job spec:** "Write a one-line Python function that adds two numbers"
- **Requester:** `0x53b20B...f12A96`
- **Worker:** `0x5E3120...dE6b35`
- **Escrow:** 5 GEN
- **Deliverable:** `def add(a, b): return a + b`

**Result:** `status: "resolved"`, `payout_to: "worker"` — deliverable satisfied the
spec, requester approved directly, full escrow paid to worker.

| Step | Tx |
|---|---|
| create_job | `0x2a1eb6b7...f0127d66` |
| submit_work | `0xf851724a...ba1897a2` |
| approve | `0x07e06dd8...88e04c8c` |

All FINALIZED, SUCCESS, consensus result Accepted.

---

## Test 2 — Disputed Work, Validator Consensus

Deliberately mismatched deliverable submitted, to test real LLM-based
validator adjudication under dispute.

- **Job spec:** "Write a Python function called add(a, b) that returns the sum
  of a and b"
- **Requester:** `0x5E3120...dE6b35`
- **Worker:** `0x53b20B...f12A96`
- **Escrow:** 7 GEN
- **Deliverable submitted:** `"Here is a poem about clouds and sunsets."`
- **Dispute reason:** "The deliverable is a poem, not the requested Python
  function"

**Result:** `status: "resolved"`, `payout_to: "requester"` — independent
GenLayer validators correctly recognized the deliverable did not satisfy the
spec and returned the escrow to the requester rather than paying the worker.

---

## Test 3 — Evidence Unavailable → Deterministic Recovery

Tests the fairness path when a URL deliverable cannot be verified.

- **Job spec:** "Deploy a working landing page and share the live URL"
- **Requester:** `0x5E3120...dE6b35`
- **Worker:** `0x53b20B...f12A96`
- **Escrow:** 20 GEN
- **Deliverable submitted:** `https://this-domain-should-not-exist-xyz789.invalid/page`
  (marked as URL)
- **Dispute reason:** "URL does not load"

**Step 1 — Dispute:** Result: `status: "evidence_unavailable"`,
`deliverable_digest: ""` — the URL never resolved, so no content snapshot was
ever pinned at submission time, and the contract correctly declined to
adjudicate on unverifiable evidence rather than guessing.

**Step 2 — Recovery:** `recover_unavailable_job` called. Result:
`status: "resolved"`, `payout_to: "split"`, `recovery_used: true` — escrow
split 50/50 between requester and worker deterministically, with no further
LLM judgment call (there was no reliable evidence left to judge).

---

## Test 4 — Abandonment (Worker Never Submits)

Tests the fairness path when a worker never starts work and the requester
wants to reclaim escrow after a timeout.

- **Job spec:** "Build a simple landing page with a headline and a CTA button"
- **Requester:** `0x5E3120...dE6b35`
- **Worker:** `0x53b20B...f12A96`
- **Escrow:** 5 GEN
- **Job status before claim:** `open` (no work ever submitted)

`abandon_job` called with reason "No work submitted yet and the time already
passed", after the (temporarily shortened, see note above) abandonment window
elapsed.

**Result:** `status: "resolved"`, `payout_to: "requester"`, `recovery_used: true`
- Tx: `0x8eccfe26ecf51e57e01ef57d2275dd09c00334d39b7cf1a6464f334296dd8d76`
- FINALIZED — 5 GEN transferred from contract directly to requester

---

## Summary

| Scenario | Outcome | Verified |
|---|---|---|
| Good work, direct approval | Worker paid in full | ✅ |
| Bad work, disputed | Validators sided with requester | ✅ |
| Unreachable evidence | Deterministic 50/50 split | ✅ |
| Worker never starts | Requester refunded after timeout | ✅ |

All four core payout paths of the adjudication state machine have been
exercised against live GenLayer Studio consensus, using two distinct wallet
addresses acting as requester and worker across different jobs.
