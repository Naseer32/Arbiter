# Manual Testing — Live On-Chain Evidence

All tests below were run against the deployed Arbiter contract on GenLayer
Studio.

**Test wallets:**
- `0x53b20BeADADe01b46a3fb5bdbC85D3A7B0f12A96`
- `0x5E31205009bC47842DAb8534F7492823A4dE6b35`
- Worker (Tests 5-6): `0x58e9e85f73840b07e2d8f67c65ac62620F18bf82`
- Requester (Tests 5-6): `0xBD6D84fC12AE3b9b3110FCc9efF91DDf5d59Aa01`

> **Note on abandonment timing:** Test 4 was run with `ABANDONMENT_PERIOD`
> temporarily shortened to 1 hour (from the shipped 7-day value) purely to
> make the timeout observable within a live testing session. The contract
> has since been reverted to the real 7-day threshold.

> **Note on appeal timing:** Tests 5-6 were run with `APPEAL_WINDOW`
> temporarily shortened to 2 minutes (from the shipped 24-hour value), same
> approach as above. The contract has since been reverted to the real
> 24-hour threshold and re-verified (see "Post-Upgrade Re-Verification"
> below).

---

## Test 1 — Happy Path (create → submit → approve)

Good-faith work submitted and accepted directly, no dispute needed.

**Contract:** `0x5CCF4f0e7b3392C48ff2BE2A894e08A92863A2Db` (pre-upgrade)

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

**Contract:** `0x5CCF4f0e7b3392C48ff2BE2A894e08A92863A2Db` (pre-upgrade)

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

*(Note: at the time of this test, dispute resolved and paid out immediately.
The appeal-loop upgrade below changes this — dispute now enters
`verdict_pending` and requires either an appeal or `finalize()` to pay out.
See Tests 5-6.)*

---

## Test 3 — Evidence Unavailable → Deterministic Recovery

Tests the fairness path when a URL deliverable cannot be verified.

**Contract:** `0x5CCF4f0e7b3392C48ff2BE2A894e08A92863A2Db` (pre-upgrade)

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

**Contract:** `0x5CCF4f0e7b3392C48ff2BE2A894e08A92863A2Db` (pre-upgrade)

- **Job spec:** "Build a simple landing page with a headline and a CTA button"
- **Requester:** `0x5E3120...dE6b35`
- **Worker:** `0x53b20B...f12A96`
- **Escrow:** 5 GEN
- **Job status before claim:** `open` (no work ever submitted)

`abandon_job` called with reason "No work submitted yet and the time already
passed", after the (temporarily shortened) abandonment window elapsed.

**Result:** `status: "resolved"`, `payout_to: "requester"`, `recovery_used: true`
- Tx: `0x8eccfe26ecf51e57e01ef57d2275dd09c00334d39b7cf1a6464f334296dd8d76`
- FINALIZED — 5 GEN transferred from contract directly to requester

---

## Test 5 — Appeal After Dispute (Checklist Adjudication)

Tests that a disputed job correctly parks in `verdict_pending` without
paying out, and that the losing party can appeal within the window to
trigger an independent, structurally different re-adjudication method
(checklist extraction + per-check evaluation, rather than repeating the
same holistic prompt).

**Contract:** `0x34390D6ffEb7450727d71fBfad22cFE7095dAac9` (post-upgrade)

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
| appeal | `0xb5b8df6581ed20e2092a4c8080d3de94a68b8c1a0e3643d7de800e7bfa008a91` |

All FINALIZED, SUCCESS, consensus Agree across validators.

**Negative test — appeal after window closed:** Same scenario on a separate
job, but `appeal` called ~2:39 after the verdict, past the 2-minute window.

- Tx: `0xcad071974a8d879497bdb6442bac73aae53517052f01611a5ff3a6fa8d34613a`
- Result: `ERROR`, all responding validators agreed on rollback reason
  `"appeal window has closed"` — correctly reverted, no state change, no
  funds moved.

---

## Test 6 — Finalize After No Appeal

Tests that an undisputed appeal window correctly allows either party to
finalize the original verdict, and that finalize correctly refuses to run
early.

**Contract:** `0x34390D6ffEb7450727d71fBfad22cFE7095dAac9` (post-upgrade)

- **Job spec:** "Write a Python function called add(a, b) that returns the
  sum of a and b"
- **Requester:** `0xBD6D84...59Aa01`
- **Worker:** `0x58e9e8...18bf82`
- **Escrow:** 7 GEN
- **Deliverable submitted:** `"Here is a poem about clouds and sunsets."`
- **Dispute reason:** "The deliverable is a poem, not the requested Python
  function"

**Step 1 — Dispute:** Result: `status: "verdict_pending"`, `pending_verdict:
"requester"`.

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

## Post-Upgrade Re-Verification

After reverting `APPEAL_WINDOW` to the real 24-hour value and re-deploying
(same contract address, in-place upgrade), the original happy path was
re-run to confirm the appeal-loop changes didn't disturb existing behavior.

**Contract:** `0x34390D6ffEb7450727d71fBfad22cFE7095dAac9`

- **Job spec:** "Write a one-line Python function that adds two numbers"
- **Requester:** `0x5E31205009bC47842DAb8534F7492823A4dE6b35`
- **Worker:** `0x53b20BeADADe01b46a3fb5bdbC85D3A7B0f12A96`
- **Escrow:** 5 GEN
- **Deliverable:** `def add(a, b): return a + b`

**Result:** `status: "resolved"`, `payout_to: "worker"` — direct approval
still resolves and pays out immediately with no `verdict_pending` step,
confirming that state only applies to the dispute path, as intended.

| Step | Tx |
|---|---|
| create_job (Job 4) | `0x7c2fa56d638a830ce8768ec2a9290a404cf1ac09eae28fe5d230c4e805d88d50` |
| submit_work | `0x6617c429f18372842e0abd0ec6fa255948eba5ab5884075ef113e3230a0621bc` |
| approve | `0xa9ce364b3010b445fa6d280dc45054e5b4eeedbd33ab173de123ea35950a5000` |

All ACCEPTED/FINALIZED, SUCCESS, consensus result Accepted.

---

## Test 7 — Milestone Job (Parent/Child Auto-Resolve)
Tests that a job posted with multiple milestones correctly creates a parent container plus independent child jobs, that each child behaves as a completely normal job with zero special-casing, and that the parent auto-resolves the instant every milestone is done.

Contract: `0x5cDFabc39bd5b90FB1b89d4F5b448f0BdD8c3Afa`

Requester: `0x53b20B...f12A96`
Worker: `0x5E3120...dE6b35`
Milestones:
- "Design the landing page mockup" — 3 GEN
- "Implement the landing page in code" — 4 GEN
Total escrow: 7 GEN

Step 1 — create_milestone_job: Result: parent (job 1) created with `status: "milestones_open"`, `is_milestone_parent: true`, `milestone_count: 2`. `get_milestones(1)` correctly returns child job IDs `[2, 3]`.

| Step | Tx |
|---|---|
| create_milestone_job | `0x0acdb1bb06f31a53da55bee56300b992a0d2463e904ecca2a448442282f87254` |

Step 2 — First milestone (job 2): Deliverable: "Mockup delivered: wireframe.png". Submitted, then approved directly.

Result: `status: "resolved"`, `payout_to: "worker"` — 3 GEN paid to worker. Parent (job 1) checked after this step: still `status: "milestones_open"`, correctly staying open while milestone 2 is pending.

| Step | Tx |
|---|---|
| submit_work | `0x13ac64db6ec59090a18785bdb41612a2aa3f6bc41deabb4e037f19bd5d000415` |
| approve | `0xca82b66a8fa0d9e153be635d4c2d8a8545db25986f11a8761bb21100548f97ce` |

Step 3 — Second milestone (job 3), triggering auto-resolve: Deliverable: "Landing page implemented: github.com/example/repo". Submitted, then approved directly.

Result: `status: "resolved"`, `payout_to: "worker"` — 4 GEN paid to worker. Parent (job 1) checked after this step: `status: "resolved"` — auto-resolved the instant the last milestone completed, no manual intervention.

| Step | Tx |
|---|---|
| submit_work | `0x8b897bca5c6c57aa2b70c2352f075f557bb3d05b9415c16ddb8108c8e349d01c` |
| approve | `0xa4f691f43ff9e8f68d79deee856befc03ca74ce170a63f63db7745d56cfd473a` |

All FINALIZED, SUCCESS.

## Summary

| Scenario | Outcome | Verified |
|---|---|---|
| Good work, direct approval | Worker paid in full | ✅ |
| Bad work, disputed (pre-upgrade) | Validators sided with requester | ✅ |
| Unreachable evidence | Deterministic 50/50 split | ✅ |
| Worker never starts | Requester refunded after timeout | ✅ |
| Dispute holds escrow pending appeal | `verdict_pending`, no payout | ✅ |
| Appeal within window (checklist method) | Independent re-adjudication, settles job | ✅ |
| Appeal after window closed | Correctly reverted | ✅ |
| Finalize before window closed | Correctly reverted | ✅ |
| Finalize after window closed, no appeal | Original verdict paid out | ✅ |
| Post-upgrade happy path re-check | Still resolves/pays immediately, unaffected | ✅ |

| Milestone job creation (parent + children) | Parent `milestones_open`, children independently addressable via `get_milestones` | ✅ |
| Milestone children behave as normal jobs | submit_work/approve worked with zero special-casing | ✅ |
| Parent stays open mid-milestones | Confirmed `milestones_open` after 1st of 2 approved | ✅ |
| Parent auto-resolves on last milestone | `status: "resolved"` with no manual step | ✅ |
All core payout paths, the full appeal-loop state machine, and both
time-window guards have been exercised against live GenLayer Studio
consensus, including negative tests confirming enforcement in both
directions, and a post-upgrade re-verification confirming no regression to
existing functionality.

## Model diversity observed

Live consensus rounds during testing used validators backed by distinct
underlying models within the same job, e.g.: `policy:prd-qwen`,
`policy:prd-minimax`, `policy:prd-mistral`, `policy:prd-grok`,
`policy:prd-gpt-5-4`, `openai/gpt-5.4`, `policy:prd-gemini`,
`policy:prd-sonnet`, `policy:prd-glm`, `policy:prd-gemma`,
`google/gemini-3-flash-preview`, `policy:prd-gpt-oss`, `policy:prd-
deepseek`, `anthropic/claude-sonnet-4.6`. Model diversity across validators
is inherent to GenLayer's validator network at the infrastructure level;
Arbiter's appeal path adds a second, structurally distinct *adjudication
method* (checklist-based) on top of that, rather than re-running the same
reasoning approach twice.
