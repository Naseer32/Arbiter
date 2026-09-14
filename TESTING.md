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

Contract: `0x7FE6B2AC00dbe9857E91fEfD3A280C59C1a267b1`

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

## Live Studio Test Pass -- Sept 13 2026

Full manual test run against contract 0x7FE6B2AC00dbe9857E91fEfD3A280C59C1a267b1
(appeal/checklist contract version), requester 0x21920357EA92f9B6715978CFdE877FfC2F0c00Ca,
worker 0xD128c85296E2f0F8a945B8BF4d3740E5897c207b.

### Test 1 -- Happy path (job 11)
create_job:  0x423a439e29abf09cfb955c4f5d5c2403c8daacef1c9035bd820eff40373f90c4
submit_work: 0xc86dfce1a45f06fdf732fb0a80aeaff25f34dee0b6f9c67652103a7633637e8f
approve:     0x4b51c9f58f89ba06065eeb0098f79d56bc19c2a30f0ef683e7d867ac8b018777
Result: resolved, payout_to=worker

### Test 2 -- Dispute + appeal, both verdicts agree "requester" (job 13)
create_job:  0x65d297256b08971477c9ab38395d33f6cf18bc28afcf83227b52a347c4d3f8fe
submit_work: 0x6229ac48465035569820b45772ab7aed02cc3f4e58764ecff48d24c45b3aa48a
dispute:     0xab2f376516c1f44cdb7f78cd04b3228454b6eff857772efab84791c325debff1 (holistic: requester)
appeal:      0x9cbab077b9960313d6e11e13709b24648b8a4f74ddcc04391bf869f8ec165957 (checklist: requester)
Result: resolved via appeal, payout_to=requester, appeal_used=true

### Test 3 -- Evidence unavailable + 50/50 recovery (job 12)
submit_work (dead URL): 0xf4974367110bfb65bf839a8d27c62514717fcc94f89efd75fa66338814bf86ad
dispute:                0xb7d6d6646f6b445a4a5b6c6e01cc23eb256447967e75291dc0f833e11e21de0d
recover_unavailable_job: 0x30bf25b1e79b8656608d2dd7eecc00809d62495162644399c148f08b85fc1420
Result: resolved, payout_to=split

### Test 2b -- finalize() before appeal window closes (guard confirmed) (job 14)
create_job:  0x6ac215989aa9c46e1bca112016bf484a4c1c3bae3fb236c5287c11df90a3bdb4
submit_work: 0xa0ea1fb0c9db492b739135b03aa1e4fa34db2e97c41855d4fa7c85cf3bb85123
dispute:     0x5a11fdd9bd83ded2bcabd51f10c5a616fc82e6f37511538bf859a801b53321e9
finalize (reverted): 0xc9b058fc3d4df4c9f0c318b7aa5726274f8fc40d8940888f0790fae64ddc0b6a
  -> "appeal window still open (0:00:53 elapsed, 1 day required)", 4/4 active validators agreed on rejection

### Test 4 -- abandon_job() before abandonment period elapses (guard confirmed) (job 15)
create_job: 0xe0488a168858c74d4b6077475cffa0c8447d162ad8fe2a4574f9a0eabd86e3c5
abandon_job (reverted): 0xc5e0c1cce02a32221070b28cb9589054f9ae223e4ad58ccbe987e85007c247d1
  -> "job cannot be claimed as abandoned yet (0:01:01 elapsed, 7 days required)"

### Test 5 -- Milestones, parent auto-resolve (parent 16, children 17/18)
create_milestone_job: 0x8b1fb557cbea6508d8c3b34f64582572422fa620faf07cd5f76eda3a9adeee9d
  NOTE: amounts must be passed in wei (e.g. 3000000000000000000), matching
  the payable value's units -- not plain GEN integers as an earlier note
  assumed. First attempt with plain integers reverted:
  "sum of milestone amounts (7) must equal escrowed value (7000000000000000000)"
job 17 submit/approve: 0x12724ea9d9db29e74017781aca353a37d9dde88ceb433bc3dc3d143ecd9fbbfe / 0x2a548b9884761c60dd0fbca0b78b9af484646964b8e5499b86cd4e60e83ad96e
job 18 submit/approve: 0xf6be12dc1d20ecc56a1072c5385e80cc3f57fe990c913f595d6bf9c9ef170715 / 0xd9be27ae31d3ac53e555ad4c948794eb6b9f3303570a2d00e6a470b0b2f6204d
Result: parent job 16 status=resolved, is_milestone_parent=true, milestone_count=2,
        payout_to="" (parent never held or paid funds -- confirmed by design)

### Termux automation attempt (same day)
gltest 0.30.0rc2 against studionet: deploy succeeds with real on-chain
consensus (MAJORITY_AGREE, 5/5), but the first read call after deploy fails
with an opaque `execution failed` RPC error. See dated note in
tests/test_arbiter_payout.py for the full diagnostic trail. All paths above
remain fully verified via direct manual testing in GenLayer Studio's
browser UI with live tx-hash evidence.

## Live Test Run — Sept 14, 2026 (GenLayer Studio Dev, chain 61997)

Full end-to-end validation performed live through the deployed frontend
(frontend-kube.vercel.app) against contract 0x7FE6B2AC00dbe9857E91fEfD3A280C59C1a267b1
on studio-dev.genlayer.com (chain 61997). This followed a debugging session
that identified and fixed several genlayer-js 1.2.0 compatibility issues:
job_id args must be passed as Number (not BigInt), and every write call must
include distribution, feeValue, and messageAllocations from
estimateTransactionFeesForWrite() nested under a `fees` object in
writeContract() -- omitting messageAllocations causes fee-bearing payout
messages to fail with Mode1MessageFeesRequireGenVMPerEmissionSupport.

Note: the local `gltest` suite (tests/test_arbiter_smoke.py,
tests/test_arbiter_payout.py) currently fails at deployment with
FeesDistributionMissing -- genlayer-py 0.19.0rc2 / genlayer-test 0.30.0rc2
(latest available versions as of this writing) don't yet expose the same
fee-distribution parameters that genlayer-js 1.2.0 added. The live run below
is the authoritative validation for this submission.

Single-job lifecycle:
- create_job (job 20): 0x2598e93c964b1505df1d7cd58c7f9946e382c61ab68fb64c5454bfea4ed60447
- submit_work (job 19): 0x8b3d78241d552cf1c6fed7e3cbc4011c6fe5ea30b9e946a7e691d6a1ec5a67ed
- dispute (job 19): 0x470f3c7395bed7ccc2cd43127d236a3ff607d6618f39bc91658ab9779bc555c3
- dispute/appeal flow (job 22): 0xd510d9b3254fc2a2fa38219f13c0ac32056caf41134e62850f2dbeff44ff35b8
- finalize, pays out verdict (job 21): 0x1cf8c30bf9c23ffa0dd47140cf262f6d6f1ff1cc551256c9f6e6a2ccb46956d9
- recover_unavailable_job, 50/50 split (job 23): 0x8a6cdc8dda32efbc85d709c20a1df4b1778267f305f0411255cef55a6302c8f7

Milestone job lifecycle (parent job 24, 7 GEN total across 2 milestones):
- create_milestone_job: 0x98826d0b43f31b60b63c582e749e2617b365d1e7fe3333459a005290ccfa37de
- submit_work milestone #25: 0x271762bbce0ba7a59b0631160b1c870f88ff41ba530a331af0eebdfff3842a36
- submit_work milestone #26: 0x3a8338b5aa7dccef2a940b5859294bcad7da652d226102b2f9928d61f4fe28c8
- approve milestone #25, pays 3 GEN: 0xecf05bc659795d097968400d57e3f4563c56eeee1e6ab950910b5f16c9f90aa0
- approve milestone #26, pays 4 GEN: 0xd861d0fcc0b0ec8481900b04b2f25f957a8a28fd7046ec821ddeea790ceb2685
- parent job 24 confirmed auto-resolved after both milestones approved

All transactions verified FINALIZED with GenVM Execution Result: SUCCESS via
https://explorer-studio-dev.genlayer.com.

## Earlier Test Run — Sept 13, 2026 (pre-fix, chain 61997 diagnostic)

See smoke_run_latest.log (committed separately, commit 0670082) for the full
pytest/gltest output from Sept 13. This run is what identified that chain
61997 (studio_devnet, the fee-charging RC preview network) throws
FeesDistributionMissing on deploy with the genlayer-py/genlayer-test versions
available at the time -- see the comment block in
tests/test_arbiter_payout.py (~line 315) for the detailed investigation notes
from that session, including confirmation that the same contract code
deploys and passes cleanly on stable studionet (chain 61999).
