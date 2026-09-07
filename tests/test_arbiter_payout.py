
"""
Starter test suite for the Arbiter contract, run against a live GenLayer Studio
(or Localnet) consensus instance via gltest -- mirroring the structure used for
the accepted genlayer-escrow submission's test_escrow_payout.py.

Run with:
    gltest tests/test_arbiter_payout.py

Adjust fixture/account APIs to whatever gltest version you have installed --
the exact helper names (get_contract_factory, get_default_account, etc.) have
shifted across gltest releases, so treat this as a structural starting point
and confirm names against `gltest --help` / your installed package docs.
"""

import time

import pytest
from gltest import get_contract_factory
from gltest.accounts import get_accounts


CONTRACT_PATH = "contract/arbiter_contract.py"
JOB_AMOUNT = 10**16  # small GEN amount in wei for test escrow


@pytest.fixture
def accounts():
    accs = get_accounts()
    assert len(accs) >= 2, "need at least a requester and a worker account"
    return accs


@pytest.fixture
def arbiter(accounts):
    factory = get_contract_factory("Arbiter")
    requester = accounts[0]
    contract = factory.deploy(account=requester)
    return contract


def test_job_ids_are_one_based(arbiter, accounts):
    requester, worker = accounts[0], accounts[1]
    job_id = arbiter.create_job(
        args=[worker.address, "write a haiku about escrow"],
        value=JOB_AMOUNT,
        account=requester,
    )
    assert job_id == 1, "first job created should have id 1, not 0"


def test_approve_pays_worker(arbiter, accounts):
    requester, worker = accounts[0], accounts[1]
    job_id = arbiter.create_job(
        args=[worker.address, "reverse a string in python"],
        value=JOB_AMOUNT,
        account=requester,
    )
    arbiter.submit_work(
        args=[job_id, "def reverse(s): return s[::-1]", False],
        account=worker,
    )

    worker_balance_before = worker.get_balance()
    arbiter.approve(args=[job_id], account=requester)
    job = arbiter.get_job(args=[job_id])

    assert job["status"] == "resolved"
    assert job["payout_to"] == "worker"
    assert worker.get_balance() > worker_balance_before


def test_dispute_evidence_unavailable_url(arbiter, accounts):
    requester, worker = accounts[0], accounts[1]
    job_id = arbiter.create_job(
        args=[worker.address, "deploy a working landing page"],
        value=JOB_AMOUNT,
        account=requester,
    )
    # A URL that will not resolve to real content should fail digest pinning.
    arbiter.submit_work(
        args=[job_id, "https://this-domain-should-not-exist.invalid/page", True],
        account=worker,
    )
    arbiter.dispute(
        args=[job_id, "site does not load"],
        account=requester,
    )
    job = arbiter.get_job(args=[job_id])
    assert job["status"] == "evidence_unavailable"


def test_recover_unavailable_job_splits_50_50(arbiter, accounts):
    requester, worker = accounts[0], accounts[1]
    job_id = arbiter.create_job(
        args=[worker.address, "deploy a working landing page"],
        value=JOB_AMOUNT,
        account=requester,
    )
    arbiter.submit_work(
        args=[job_id, "https://this-domain-should-not-exist.invalid/page", True],
        account=worker,
    )
    arbiter.dispute(args=[job_id, "site does not load"], account=requester)

    worker_before = worker.get_balance()
    requester_before = requester.get_balance()

    arbiter.recover_unavailable_job(args=[job_id, "content unrecoverable, split fairly"], account=worker)
    job = arbiter.get_job(args=[job_id])

    assert job["status"] == "resolved"
    assert job["payout_to"] == "split"
    assert worker.get_balance() > worker_before
    assert requester.get_balance() > requester_before


def test_abandon_open_job_refunds_requester(arbiter, accounts, monkeypatch):
    """Worker never submits -- requester should be able to reclaim escrow after
    the abandonment window. Since ABANDONMENT_PERIOD is 7 days, this test
    assumes a Localnet/Studio time-travel or mocked-clock helper; substitute
    your gltest version's time control here."""
    requester, worker = accounts[0], accounts[1]
    job_id = arbiter.create_job(
        args=[worker.address, "task nobody will ever start"],
        value=JOB_AMOUNT,
        account=requester,
    )

    # Attempting to claim abandonment immediately should fail.
    with pytest.raises(Exception):
        arbiter.abandon_job(args=[job_id, "worker never started"], account=requester)

    # TODO: advance chain/contract time by ABANDONMENT_PERIOD here, e.g.:
    # advance_time(days=7)
    #
    # requester_before = requester.get_balance()
    # arbiter.abandon_job(args=[job_id, "worker never started"], account=requester)
    # job = arbiter.get_job(args=[job_id])
    # assert job["status"] == "resolved"
    # assert job["payout_to"] == "requester"
    # assert requester.get_balance() > requester_before


def test_abandon_submitted_job_pays_worker(arbiter, accounts):
    """Requester goes silent after work is submitted -- worker should be able to
    claim payment after the abandonment window. Same time-travel caveat as above."""
    requester, worker = accounts[0], accounts[1]
    job_id = arbiter.create_job(
        args=[worker.address, "write a README"],
        value=JOB_AMOUNT,
        account=requester,
    )
    arbiter.submit_work(args=[job_id, "# README\n\nDone.", False], account=worker)

    with pytest.raises(Exception):
        arbiter.abandon_job(args=[job_id, "requester went silent"], account=worker)

    # TODO: advance_time(days=7), then assert worker gets paid, mirroring the
    # test above.


def test_only_requester_can_approve(arbiter, accounts):
    requester, worker, outsider = accounts[0], accounts[1], accounts[2]
    job_id = arbiter.create_job(
        args=[worker.address, "simple task"],
        value=JOB_AMOUNT,
        account=requester,
    )
    arbiter.submit_work(args=[job_id, "done", False], account=worker)

    with pytest.raises(Exception):
        arbiter.approve(args=[job_id], account=outsider)
