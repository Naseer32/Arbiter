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

# Manual Testing Addendum — Appeal & Finalize

Tests below extend the original TESTING.md with the appeal-loop feature
added for Agent Tank (checklist-based re-adjudication + finalize-after-
window), run against the upgraded Arbiter contract on GenLayer Studio.

**Contract address:** `0x34390D6ffEb7450727d71fBfad22cFE7095dAac9`
**Network:** GenLayer Studio (`studio.genlayer.com`)
**Test wallets:**
- Requester: `0xBD6D84fC12AE3b9b3110FCc9efF91DDf5d59Aa01`
- Worker: `0x58e9e85f73840b07e2d8f67c65ac62620F18bf82`

> **Note on appeal timing:** `APPEAL_WINDOW` was temporarily shortened to
> 2 minutes (from the shipped 24-hour value) purely to make the window
> observable within a live testing session, same approach used for
> `ABANDONMENT_PERIOD` in the original TESTING.md. The contract has since
> been reverted to the real 24-hour threshold before final submission.

---

## Test 5 — Appeal Overturns Nothing, But Confirms the Path (Checklist Method)

Tests that a disputed job correctly parks in `verdict_pending` without
paying out, and that the losing party can appeal to trigger an
independent, structurally different re-adjudication.

- **Job spec:** "Write a Python function called add(a, b) that returns the
  sum of a and b"
- **Requester:** `0xBD6D84...59Aa01`
- **Worker:** `0x58e9e8...18bf82`
- **Escrow:** 7 GEN
- **Deliverable submitted:** `"Here is a poem about clouds and sunsets."`
- **Dispute reason:** "The deliverable is a poem, not the requested Python
  function"

**Step 1 — Dispute (holistic adjudication):** Result: `status:
"verdict_pending"`, `pending_verdict: "requester"`, `payout_to: ""` — the
job is judged but escrow is held, not released, pending the appeal window.

**Step 2 — Appeal, within window (checklist adjudication):** Called by the
losing party (worker). Result: `status: "resolved"`, `payout_to:
"requester"`, `appeal_used: true` — the checklist-based method
independently reached the same verdict as the holistic method and settled
the job.

| Step | Tx |
|---|---|
| create_job (Job 2) | see Studio history |
| submit_work | see Studio history |
| dispute | see Studio history |
| appeal | `0xb5b8df6581ed20e2092a4c8080d3de94a68b8c1a0e3643d7de800e7bfa008a91` |

All FINALIZED, SUCCESS, consensus Agree across validators.

**Negative test — appeal after window closed (Job 1):** Same scenario,
but `appeal` called ~2:39 after the verdict, past the 2-minute window.

- Tx: `0xcad071974a8d879497bdb6442bac73aae53517052f01611a5ff3a6fa8d34613a`
- Result: `ERROR`, all responding validators agreed on rollback reason
  `"appeal window has closed"` — correctly reverted, no state change, no
  funds moved.

---

## Test 6 — Finalize After No Appeal

Tests that an undisputed appeal window correctly allows either party to
finalize the original verdict, and that finalize correctly refuses to run
early.

- **Job spec:** "Write a Python function called add(a, b) that returns the
  sum of a and b"
- **Requester:** `0xBD6D84...59Aa01`
- **Worker:** `0x58e9e8...18bf82`
- **Escrow:** 7 GEN
- **Deliverable submitted:** `"Here is a poem about clouds and sunsets."`
- **Dispute reason:** "The deliverable is a poem, not the requested Python
  function"

**Step 1 — Dispute:** Result: `status: "verdict_pending"`, `pending_verdict:
"requester"` (Job 3).

**Negative test — finalize before window closed:**
- Tx: `0x69cd1351b839cbb61c7a656b4574a5344c5cbfce8e98320c59f50b32f5846f9c`
- Called at 0:01:29 elapsed, 0:02:00 required. Result: `ERROR`, unanimous
  rollback across all 5 validators with reason `"appeal window still
  open"` — correctly reverted.

**Step 2 — Finalize after window closed:**
- Tx: `0xe67e3e23c4f10e2d8b51ee60d8106c00d8d97619cba7200026f777b2ab69bd56`
- Result: `status: "resolved"`, `payout_to: "requester"`, `appeal_used:
  false` — original holistic verdict paid out correctly since nobody
  appealed.

---

## Summary

| Scenario | Outcome | Verified |
|---|---|---|
| Dispute holds escrow pending appeal | `verdict_pending`, no payout | ✅ |
| Appeal within window (checklist method) | Independent re-adjudication, settles job | ✅ |
| Appeal after window closed | Correctly reverted | ✅ |
| Finalize before window closed | Correctly reverted | ✅ |
| Finalize after window closed, no appeal | Original verdict paid out | ✅ |

All appeal-loop and finalize paths have been exercised against live
GenLayer Studio consensus, including two negative tests confirming the
time-window guards function correctly in both directions.

## Model diversity observed

Live consensus rounds during this testing session used validators backed
by distinct underlying models within the same job, e.g.:
`policy:prd-qwen`, `policy:prd-minimax`, `policy:prd-mistral`,
`policy:prd-grok`, `policy:prd-gpt-5-4`, `openai/gpt-5.4`, `policy:prd-
gemini`, `policy:prd-sonnet`, `policy:prd-glm`, `policy:prd-gemma`,
`google/gemini-3-flash-preview`, `policy:prd-gpt-oss`, `policy:prd-
deepseek`, `anthropic/claude-sonnet-4.6`. Model diversity across
validators is inherent to GenLayer's validator network at the
infrastructure level, and Arbiter's appeal path adds a second,
structurally distinct *adjudication method* (checklist-based) on top of
that, rather than re-running the same reasoning approach twice.

