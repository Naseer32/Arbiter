"""
Test suite for the Arbiter contract, run against a live GenLayer Studio
(or Localnet) consensus instance via gltest.

Install:
    pip install genlayer-test

Run:
    gltest tests/test_arbiter_payout.py
    gltest tests/test_arbiter_payout.py --network studionet -v

This targets gltest's Studio-mode API (get_contract_factory / .transact() /
.call()), matching the current Arbiter contract, which requires:
  - create_job is @gl.public.write.payable (accepts escrowed value)
  - recover_unavailable_job(job_id, reason) takes a required reason argument
  - get_contract_balance() is a view for checking escrow movement without
    needing per-account balance access from the test harness

IMPORTANT -- behavior change from the pre-appeal contract:
  dispute() no longer settles the job immediately. It now parks the job in
  "verdict_pending" with a `pending_verdict` field, and payout only happens
  via appeal() or finalize(). Tests below reflect this.

NOTE: as of this commit, this suite could not be executed in a Termux
(Android) environment -- gltest 0.29.2's schema-fetch (default and
hosted-studio clients both) failed silently with no underlying error
surfaced, despite all HTTPS requests to Studio succeeding at the transport
level. This appears to be a library/environment-specific issue, not a
problem with the contract or test logic itself -- see TESTING.md for full
live on-chain evidence covering every path these tests check.

Adjust the `_extract_job_id` helper below to match exactly how your installed
gltest version surfaces a write method's return value in the tx receipt --
this has varied across releases, so treat it as the one thing to verify first
by running a single test with -v and inspecting the printed receipt.
"""

import pytest
from gltest import get_contract_factory, get_default_account, create_account
from gltest.assertions import tx_execution_succeeded

JOB_AMOUNT = 10**16  # small GEN amount in wei, used as escrow in each test


def _extract_job_id(tx_receipt):
    """create_job returns the new job's id. Extraction key varies by gltest
    version -- check both common shapes before falling back to a manual read."""
    if "return_value" in tx_receipt:
        return tx_receipt["return_value"]
    if "data" in tx_receipt and "return_value" in tx_receipt["data"]:
        return tx_receipt["data"]["return_value"]
    raise KeyError(
        "Could not find job id in tx receipt -- inspect the receipt structure "
        "with `print(tx_receipt)` and adjust _extract_job_id accordingly."
    )


@pytest.fixture
def requester():
    return get_default_account()


@pytest.fixture
def worker():
    return create_account()


@pytest.fixture
def outsider():
    return create_account()


@pytest.fixture
def arbiter():
    factory = get_contract_factory("Arbiter")
    return factory.deploy()


def _create_job(arbiter, requester, worker, spec, amount=JOB_AMOUNT):
    tx = arbiter.create_job(
        args=[worker.address, spec], value=amount, account=requester
    ).transact()
    assert tx_execution_succeeded(tx)
    return _extract_job_id(tx)


def _create_submitted_and_disputed_job(arbiter, requester, worker, spec, deliverable, dispute_reason):
    """Shared setup for appeal/finalize tests: create -> submit -> dispute,
    landing the job in verdict_pending."""
    job_id = _create_job(arbiter, requester, worker, spec)

    tx = arbiter.submit_work(
        args=[job_id, deliverable, False], account=worker
    ).transact()
    assert tx_execution_succeeded(tx)

    tx = arbiter.dispute(
        args=[job_id, dispute_reason], account=requester
    ).transact()
    assert tx_execution_succeeded(tx)

    return job_id


def test_job_ids_are_one_based(arbiter, requester, worker):
    job_id = _create_job(arbiter, requester, worker, "write a haiku about escrow")
    assert job_id == 1, "first job created should have id 1, not 0"


def test_approve_pays_worker(arbiter, requester, worker):
    """Direct approval (no dispute) still settles immediately -- this path
    is unaffected by the appeal-loop change."""
    job_id = _create_job(arbiter, requester, worker, "reverse a string in python")

    tx = arbiter.submit_work(
        args=[job_id, "def reverse(s): return s[::-1]", False], account=worker
    ).transact()
    assert tx_execution_succeeded(tx)

    balance_before = arbiter.get_contract_balance().call()

    tx = arbiter.approve(args=[job_id], account=requester).transact()
    assert tx_execution_succeeded(tx)

    job = arbiter.get_job(args=[job_id]).call()
    assert job["status"] == "resolved"
    assert job["payout_to"] == "worker"
    assert arbiter.get_contract_balance().call() < balance_before, (
        "escrow should have left the contract on payout"
    )


def test_dispute_parks_in_verdict_pending_without_paying(arbiter, requester, worker):
    """Real LLM-based validator adjudication: deliverable clearly doesn't match
    spec, so the holistic verdict should side with the requester -- but the
    job should NOT pay out yet, it should wait for appeal or finalize."""
    job_id = _create_job(
        arbiter, requester, worker,
        "Write a Python function called add(a, b) that returns the sum of a and b",
    )
    tx = arbiter.submit_work(
        args=[job_id, "Here is a poem about clouds and sunsets.", False],
        account=worker,
    ).transact()
    assert tx_execution_succeeded(tx)

    balance_before = arbiter.get_contract_balance().call()

    tx = arbiter.dispute(
        args=[job_id, "deliverable is a poem, not the requested function"],
        account=requester,
    ).transact()
    assert tx_execution_succeeded(tx)

    job = arbiter.get_job(args=[job_id]).call()
    assert job["status"] == "verdict_pending"
    assert job["pending_verdict"] == "requester"
    assert job["payout_to"] == ""
    assert job["appeal_used"] is False
    assert arbiter.get_contract_balance().call() == balance_before, (
        "escrow should NOT have moved yet -- dispute only judges, it "
        "doesn't settle"
    )


def test_dispute_evidence_unavailable_url(arbiter, requester, worker):
    job_id = _create_job(arbiter, requester, worker, "deploy a working landing page")

    tx = arbiter.submit_work(
        args=[job_id, "https://this-domain-should-not-exist.invalid/page", True],
        account=worker,
    ).transact()
    assert tx_execution_succeeded(tx)

    tx = arbiter.dispute(args=[job_id, "site does not load"], account=requester).transact()
    assert tx_execution_succeeded(tx)

    job = arbiter.get_job(args=[job_id]).call()
    assert job["status"] == "evidence_unavailable"


def test_recover_unavailable_job_splits_50_50(arbiter, requester, worker):
    job_id = _create_job(arbiter, requester, worker, "deploy a working landing page")

    tx = arbiter.submit_work(
        args=[job_id, "https://this-domain-should-not-exist.invalid/page", True],
        account=worker,
    ).transact()
    assert tx_execution_succeeded(tx)

    tx = arbiter.dispute(args=[job_id, "site does not load"], account=requester).transact()
    assert tx_execution_succeeded(tx)

    balance_before = arbiter.get_contract_balance().call()

    tx = arbiter.recover_unavailable_job(
        args=[job_id, "content unrecoverable, split fairly"], account=worker
    ).transact()
    assert tx_execution_succeeded(tx)

    job = arbiter.get_job(args=[job_id]).call()
    assert job["status"] == "resolved"
    assert job["payout_to"] == "split"
    assert job["recovery_used"] is True
    assert arbiter.get_contract_balance().call() < balance_before


def test_appeal_by_winning_party_fails(arbiter, requester, worker):
    """Only the losing party may appeal. Testable without any time delay --
    fails on the sender check regardless of the appeal window."""
    job_id = _create_submitted_and_disputed_job(
        arbiter, requester, worker,
        "Write a Python function called add(a, b) that returns the sum of a and b",
        "Here is a poem about clouds and sunsets.",
        "deliverable is a poem, not the requested function",
    )
    with pytest.raises(Exception):
        arbiter.appeal(
            args=[job_id, "trying to appeal my own win"], account=requester
        ).transact()


def test_appeal_by_outsider_fails(arbiter, requester, worker, outsider):
    job_id = _create_submitted_and_disputed_job(
        arbiter, requester, worker,
        "Write a Python function called add(a, b) that returns the sum of a and b",
        "Here is a poem about clouds and sunsets.",
        "deliverable is a poem, not the requested function",
    )
    with pytest.raises(Exception):
        arbiter.appeal(
            args=[job_id, "not my case"], account=outsider
        ).transact()


def test_finalize_before_window_closed_fails(arbiter, requester, worker):
    """Finalize should refuse to run while the appeal window is still open.
    Testable immediately, no time delay needed -- APPEAL_WINDOW is 24h by
    default, so calling finalize right after dispute() is always 'too early'
    in a normal test run."""
    job_id = _create_submitted_and_disputed_job(
        arbiter, requester, worker,
        "Write a Python function called add(a, b) that returns the sum of a and b",
        "Here is a poem about clouds and sunsets.",
        "deliverable is a poem, not the requested function",
    )
    with pytest.raises(Exception):
        arbiter.finalize(args=[job_id], account=requester).transact()

    job = arbiter.get_job(args=[job_id]).call()
    assert job["status"] == "verdict_pending"


def test_finalize_by_outsider_fails(arbiter, requester, worker, outsider):
    job_id = _create_submitted_and_disputed_job(
        arbiter, requester, worker,
        "Write a Python function called add(a, b) that returns the sum of a and b",
        "Here is a poem about clouds and sunsets.",
        "deliverable is a poem, not the requested function",
    )
    with pytest.raises(Exception):
        arbiter.finalize(args=[job_id], account=outsider).transact()


# NOTE: full end-to-end appeal (checklist re-adjudication actually settling
# the job) and full end-to-end finalize (after the real 24h window elapses)
# are NOT exercised here -- same limitation as abandon_job's full timeout
# path below. Both were verified manually against a live Studio deployment
# with a temporarily shortened APPEAL_WINDOW; see TESTING.md Tests 5 and 6
# for those runs' tx hashes and results. If your gltest version exposes a
# time-travel cheatcode (check `direct_vm` / Direct Mode docs for your
# installed version), these are good candidates to convert to full
# end-to-end automated tests.


def test_abandon_open_job_too_early_fails(arbiter, requester, worker):
    """Claiming abandonment before ABANDONMENT_PERIOD has elapsed should fail.
    This is the part of the abandonment flow that's actually testable live --
    full end-to-end abandonment needs a 7-day time advance, which most gltest
    setups don't support against a real network. See note below."""
    job_id = _create_job(arbiter, requester, worker, "task nobody will ever start")

    with pytest.raises(Exception):
        arbiter.abandon_job(
            args=[job_id, "worker never started"], account=requester
        ).transact()

    # NOTE: full abandonment (after the real 7-day window) is not exercised
    # here -- it was verified manually on a live Studio deployment with a
    # temporarily shortened ABANDONMENT_PERIOD; see TESTING.md for that run's
    # tx hash and result. If your gltest version exposes a time-travel
    # cheatcode (check `direct_vm` / Direct Mode docs for your installed
    # version), swap this test to use it instead of Studio mode for full
    # end-to-end coverage.


def test_only_requester_can_approve(arbiter, requester, worker, outsider):
    job_id = _create_job(arbiter, requester, worker, "simple task")

    tx = arbiter.submit_work(args=[job_id, "done", False], account=worker).transact()
    assert tx_execution_succeeded(tx)

    with pytest.raises(Exception):
        arbiter.approve(args=[job_id], account=outsider).transact()


def test_only_requester_or_worker_can_dispute(arbiter, requester, worker, outsider):
    job_id = _create_job(arbiter, requester, worker, "simple task")

    tx = arbiter.submit_work(args=[job_id, "done", False], account=worker).transact()
    assert tx_execution_succeeded(tx)

    with pytest.raises(Exception):
        arbiter.dispute(args=[job_id, "not my call"], account=outsider).transact()
