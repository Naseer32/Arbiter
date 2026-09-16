# Studio Next Live Test Results

All transactions below were executed against the **Studio Next** contract deployment:

**Contract address:** `0x81b86Cf6E5a9F789152f3EFEDF8D9d64A4AE5D82`
**Explorer:** https://explorer-studio-dev.genlayer.com

Previous testing was done on a separate "Studio Dev" contract (`0x7FE6...267b1`). That deployment is retained only as historical evidence and is **not** the current or authoritative deployment for this submission.

---

## Core Job Lifecycle (Job 4)

| Step | Tx Hash |
|---|---|
| Dispute | `0xf4c75453d667d48787e6b0a32f2cc0747d6e8d73e561b70b626b8738b1cae0f8` |
| GenLayer Verdict | (same tx as dispute — verdict returned `requester`) |
| Appeal | `0x140f81c9c616105d440efd1c6095d064cf4b1273e2ac84c1912935ef2b6aebd7` |

Final state: `status: "resolved"`, `appeal_used: true`, `payout_to: "requester"`.

## Unavailable Recovery (Job 6)

| Step | Tx Hash |
|---|---|
| Create | `0x5bcacaf89d76b29e2509b4da83a10f5e8124b799aa406a30e031ea795f5a5569` |
| Submit | `0x272fb520fe4e93d55779068b47e123666e79684a5ba48a57f70d2dee25e87761` |
| Recovery check | `0xf0226e9d466ac9c8760f77d55e3579c744fdf63eda46703abd8129fb097d091e` |
| Recovery payout | `0x38aed986b3918289d6fbb8e68784c63e2ad43f09d543e8f98957d92dfccf6b90` |

Result: escrow split 0.5 GEN worker / 0.5 GEN requester.

## Milestones (Job 7 parent, Jobs 8–10 children)

| Milestone | Job ID | Submit Tx | Approve Tx |
|---|---|---|---|
| Create parent | 7 | `0x7803d78b8881ba90060fe7c651815acf4f1b3aabfbc80fcbd7bed24f146f11a4` | — |
| 1 — Mockup | 8 | `0x3eb73da4d6a80c742ee897a7648afb0d1b0eb984fff875dbb0cf0bf7a3afe3cf` | `0x9302d29c1b2a7929a131a229208c6bd586b757babafdebf7a69ace950522f7f9` |
| 2 — Frontend | 9 | `0xcfa0e6a04d7f7136d09b4d058ebce32041176fa4dbffe7bee2d3775a675c8d1b` | `0x0343b7ba1c76d07f2a44771db1bb2ff45b0bcacd5e00ee12d0ba5992f27a0863` |
| 3 — Deploy | 10 | `0x71a7c3e275dc261cf7cd60982f209a42039d32f10a2fff69f86d6164257fdd31` | `0xdd8b027084f7f0cca470a4a7334217128fbb157196400314e8ac8ff1620ecd47` |

All 3 milestones completed with independent payouts.

## Known Issues

- **Abandonment flow**: `abandon_job` currently fails with a fee-estimation error (`no_matching_allocation # external`) tied to the v0.6 fee/message-allocation system for contract methods that trigger an external payout. This affects `abandon_job` specifically; `dispute`, `appeal`, and `recover_unavailable_job` succeeded despite occasionally showing the same misleading error message in the UI (the underlying transaction had actually gone through). Root cause under investigation — likely requires a proper fee-profile (`gltest --fee-profile`) per the [Consensus v0.6 migration guide](https://docs.genlayer.com/developers/consensus-v06-migration).
- **Frontend confirmation bug**: in some cases (see dispute above), a successful on-chain transaction was reported as a failure in the UI. Confirmed via explorer that the transaction succeeded regardless.


## Automated Test Suite

The repository also includes an automated `gltest` integration suite (`tests/test_arbiter_smoke.py`) covering: job creation, submit/approve, dispute, appeal, unavailable-evidence recovery, milestone creation/approval/independent dispute/appeal, URL-submission digest pinning, and finalize-before-appeal-window behavior. This suite was not re-run against the live Studio Next network in this session (requires a funded account key not configured here); the manually-executed, on-chain transactions listed above serve as the primary evidence for this submission.
