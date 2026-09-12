from gltest.types import TransactionStatus
import pytest
from gltest import get_contract_factory


@pytest.fixture
def arbiter():
    factory = get_contract_factory("Arbiter")
    return factory.deploy()


def test_initial_state(arbiter):
    assert arbiter.job_count(args=[]).call() == 0
    assert arbiter.get_contract_balance(args=[]).call() == "0"

def test_accounts(accounts):
    assert len(accounts) >= 2

def test_create_job(accounts, arbiter):
    requester = accounts[0]
    worker = accounts[1]
    amount = 100

    tx = arbiter.connect(requester).create_job(
        args=[worker.address, "Write a short report about decentralized escrow"]
    ).transact(value=amount)


def test_create_job_state(accounts, arbiter):
    requester = accounts[0]
    worker = accounts[1]
    amount = 100

    arbiter.connect(requester).create_job(
        args=[worker.address, "Write a short report about decentralized escrow"]
    ).transact(value=amount)

    assert arbiter.job_count(args=[]).call() == 1

    job = arbiter.get_job(args=[1]).call()

    assert job["requester"].lower() == requester.address.lower()
    assert job["worker"].lower() == worker.address.lower()
    assert job["spec"] == "Write a short report about decentralized escrow"

def test_submit_work(accounts, arbiter):
    requester = accounts[0]
    worker = accounts[1]

    arbiter.connect(requester).create_job(
        args=[worker.address, "Write a short report about decentralized escrow"]
    ).transact(value=100)

    arbiter.connect(worker).submit_work(
        args=[1, "Decentralized escrow uses programmable rules to hold and release payment.", False]
    ).transact()

    job = arbiter.get_job(args=[1]).call()

    assert job["status"] == "submitted"
    assert job["deliverable"] == "Decentralized escrow uses programmable rules to hold and release payment."
    assert job["deliverable_is_url"] is False

def test_approve_job(accounts, arbiter):
    requester = accounts[0]
    worker = accounts[1]

    arbiter.connect(requester).create_job(
        args=[worker.address, "Write a short report about decentralized escrow"]
    ).transact(value=100)

    arbiter.connect(worker).submit_work(
        args=[1, "Decentralized escrow uses programmable rules to hold and release payment.", False]
    ).transact()

    receipt = arbiter.connect(requester).approve(
        args=[1]
    ).transact(wait_transaction_status=TransactionStatus.FINALIZED, wait_triggered_transactions=True, wait_triggered_transactions_status=TransactionStatus.FINALIZED)

    job = arbiter.get_job(args=[1]).call()
    balance = arbiter.get_contract_balance(args=[]).call()

    assert receipt["status_name"] == "FINALIZED"
    assert job["status"] == "resolved"
    assert job["payout_to"] == "worker"
    assert balance == "0"

def test_dispute_job(accounts, arbiter):
    requester = accounts[0]
    worker = accounts[1]

    arbiter.connect(requester).create_job(
        args=[worker.address, "Write a short report about decentralized escrow"]
    ).transact(value=100)

    arbiter.connect(worker).submit_work(
        args=[1, "This deliverable does not satisfy the requested specification.", False]
    ).transact()

    receipt = arbiter.connect(requester).dispute(
        args=[1, "The deliverable does not meet the requested specification."]
    ).transact(wait_transaction_status=TransactionStatus.FINALIZED)

    job = arbiter.get_job(args=[1]).call()


    assert receipt["status_name"] == "FINALIZED"
    assert job["status"] == "verdict_pending"
    assert job["pending_verdict"] in ("worker", "requester")
    assert job["dispute_reason"] == "The deliverable does not meet the requested specification."

def test_appeal_job(accounts, arbiter):
    requester = accounts[0]
    worker = accounts[1]

    arbiter.connect(requester).create_job(
        args=[worker.address, "Write a short report about decentralized escrow"]
    ).transact(value=100)

    arbiter.connect(worker).submit_work(
        args=[1, "This deliverable does not satisfy the requested specification.", False]
    ).transact()

    arbiter.connect(requester).dispute(
        args=[1, "The deliverable does not meet the requested specification."]
    ).transact(wait_transaction_status=TransactionStatus.FINALIZED)

    disputed_job = arbiter.get_job(args=[1]).call()

    assert disputed_job["status"] == "verdict_pending"
    assert disputed_job["pending_verdict"] in ("worker", "requester")

    losing_party = worker if disputed_job["pending_verdict"] == "requester" else requester

    receipt = arbiter.connect(losing_party).appeal(
        args=[1, "The original verdict should be reconsidered."]
    ).transact(
        wait_transaction_status=TransactionStatus.FINALIZED,
        wait_triggered_transactions=True,
        wait_triggered_transactions_status=TransactionStatus.FINALIZED,
    )

    job = arbiter.get_job(args=[1]).call()
    balance = arbiter.get_contract_balance(args=[]).call()


    assert receipt["status_name"] == "FINALIZED"
    assert job["status"] == "resolved"
    assert job["appeal_used"] is True
    assert job["payout_to"] in ("worker", "requester")
    assert balance == "0"

def test_unavailable_evidence_recovery(accounts, arbiter):
    requester = accounts[0]
    worker = accounts[1]

    arbiter.connect(requester).create_job(
        args=[worker.address, "Review the submitted webpage"]
    ).transact(value=100)

    arbiter.connect(worker).submit_work(
        args=[1, "https://unavailable.example/work", True]
    ).transact()

    arbiter.connect(requester).dispute(
        args=[1, "The submitted evidence cannot be verified."]
    ).transact()

    disputed_job = arbiter.get_job(args=[1]).call()

    assert disputed_job["status"] == "evidence_unavailable"
    assert disputed_job["payout_to"] == ""

    receipt = arbiter.connect(requester).recover_unavailable_job(
        args=[1, "Evidence is unavailable, so recovery should use the neutral split rule."]
    ).transact(
        wait_transaction_status=TransactionStatus.FINALIZED,
        wait_triggered_transactions=True,
        wait_triggered_transactions_status=TransactionStatus.FINALIZED,
    )

    job = arbiter.get_job(args=[1]).call()
    balance = arbiter.get_contract_balance(args=[]).call()


    assert receipt["status_name"] == "FINALIZED"
    assert job["status"] == "resolved"
    assert job["recovery_used"] is True
    assert job["payout_to"] == "split"
    assert balance == "0"

def test_create_milestone_job(accounts, arbiter):
    requester = accounts[0]
    worker = accounts[1]

    parent_id = arbiter.connect(requester).create_milestone_job(
        args=[
            worker.address,
            [
                "Complete the research phase",
                "Complete the final report",
            ],
            [40, 60],
        ]
    ).transact(value=100)

    parent = arbiter.get_job(args=[1]).call()
    milestones = arbiter.get_milestones(args=[1]).call()
    milestone_1 = arbiter.get_job(args=[2]).call()
    milestone_2 = arbiter.get_job(args=[3]).call()


    assert parent_id is not None
    assert parent["status"] == "milestones_open"
    assert parent["is_milestone_parent"] is True
    assert parent["milestone_count"] == "2"
    assert parent["amount"] == "100"

    assert len(milestones) == 2
    assert milestones[0] == 2
    assert milestones[1] == 3

    assert milestone_1["parent_job_id"] == "1"
    assert milestone_1["milestone_index"] == "1"
    assert milestone_1["amount"] == "40"
    assert milestone_1["status"] == "open"

    assert milestone_2["parent_job_id"] == "1"
    assert milestone_2["milestone_index"] == "2"
    assert milestone_2["amount"] == "60"
    assert milestone_2["status"] == "open"

    assert arbiter.get_contract_balance(args=[]).call() == "100"

def test_milestone_approval_and_parent_resolution(accounts, arbiter):
    requester = accounts[0]
    worker = accounts[1]

    arbiter.connect(requester).create_milestone_job(
        args=[
            worker.address,
            [
                "Complete the research phase",
                "Complete the final report",
            ],
            [40, 60],
        ]
    ).transact(value=100)

    arbiter.connect(worker).submit_work(
        args=[2, "Research phase completed successfully.", False]
    ).transact()

    first_receipt = arbiter.connect(requester).approve(
        args=[2]
    ).transact(
        wait_transaction_status=TransactionStatus.FINALIZED,
        wait_triggered_transactions=True,
        wait_triggered_transactions_status=TransactionStatus.FINALIZED,
    )

    milestone_1 = arbiter.get_job(args=[2]).call()
    parent_after_first = arbiter.get_job(args=[1]).call()
    balance_after_first = arbiter.get_contract_balance(args=[]).call()

    assert first_receipt["status_name"] == "FINALIZED"
    assert milestone_1["status"] == "resolved"
    assert milestone_1["payout_to"] == "worker"
    assert parent_after_first["status"] == "milestones_open"
    assert balance_after_first == "60"

    arbiter.connect(worker).submit_work(
        args=[3, "Final report completed successfully.", False]
    ).transact()

    second_receipt = arbiter.connect(requester).approve(
        args=[3]
    ).transact(
        wait_transaction_status=TransactionStatus.FINALIZED,
        wait_triggered_transactions=True,
        wait_triggered_transactions_status=TransactionStatus.FINALIZED,
    )

    milestone_2 = arbiter.get_job(args=[3]).call()
    parent_final = arbiter.get_job(args=[1]).call()
    final_balance = arbiter.get_contract_balance(args=[]).call()


    assert second_receipt["status_name"] == "FINALIZED"
    assert milestone_2["status"] == "resolved"
    assert milestone_2["payout_to"] == "worker"
    assert parent_final["status"] == "resolved"
    assert final_balance == "0"

def test_milestone_dispute_is_independent(accounts, arbiter):
    requester = accounts[0]
    worker = accounts[1]

    arbiter.connect(requester).create_milestone_job(
        args=[
            worker.address,
            [
                "Complete the research phase",
                "Complete the final report",
            ],
            [40, 60],
        ]
    ).transact(value=100)

    arbiter.connect(worker).submit_work(
        args=[2, "Research phase completed successfully.", False]
    ).transact()

    arbiter.connect(worker).submit_work(
        args=[3, "Final report is incomplete and missing required sections.", False]
    ).transact()

    receipt = arbiter.connect(requester).dispute(
        args=[3, "The final report does not meet the requested specification."]
    ).transact(
        wait_transaction_status=TransactionStatus.FINALIZED
    )

    milestone_1 = arbiter.get_job(args=[2]).call()
    milestone_2 = arbiter.get_job(args=[3]).call()
    parent = arbiter.get_job(args=[1]).call()


    assert receipt["status_name"] == "FINALIZED"
    assert milestone_1["status"] == "submitted"
    assert milestone_2["status"] == "verdict_pending"
    assert milestone_2["pending_verdict"] in ("worker", "requester")
    assert milestone_2["dispute_reason"] == "The final report does not meet the requested specification."
    assert parent["status"] == "milestones_open"

def test_milestone_dispute_appeal_and_parent_resolution(accounts, arbiter):
    requester = accounts[0]
    worker = accounts[1]

    arbiter.connect(requester).create_milestone_job(
        args=[
            worker.address,
            [
                "Complete the research phase",
                "Complete the final report",
            ],
            [40, 60],
        ]
    ).transact(value=100)

    arbiter.connect(worker).submit_work(
        args=[2, "Research phase completed successfully.", False]
    ).transact()

    arbiter.connect(worker).submit_work(
        args=[3, "Final report does not satisfy the specification.", False]
    ).transact()

    arbiter.connect(requester).dispute(
        args=[3, "The final report does not meet the requested specification."]
    ).transact(
        wait_transaction_status=TransactionStatus.FINALIZED
    )

    disputed = arbiter.get_job(args=[3]).call()
    assert disputed["status"] == "verdict_pending"

    losing_party = (
        worker if disputed["pending_verdict"] == "requester"
        else requester
    )

    appeal_receipt = arbiter.connect(losing_party).appeal(
        args=[3, "The original verdict should be reconsidered."]
    ).transact(
        wait_transaction_status=TransactionStatus.FINALIZED,
        wait_triggered_transactions=True,
        wait_triggered_transactions_status=TransactionStatus.FINALIZED,
    )

    milestone_3 = arbiter.get_job(args=[3]).call()
    parent = arbiter.get_job(args=[1]).call()
    balance = arbiter.get_contract_balance(args=[]).call()


    assert appeal_receipt["status_name"] == "FINALIZED"
    assert milestone_3["status"] == "resolved"
    assert milestone_3["appeal_used"] is True
    assert milestone_3["payout_to"] in ("worker", "requester")
    assert parent["status"] == "milestones_open"
    assert balance == "40"

def test_url_submission_pins_digest(accounts, arbiter):
    requester = accounts[0]
    worker = accounts[1]

    arbiter.connect(requester).create_job(
        args=[worker.address, "Review the submitted webpage"]
    ).transact(value=100)

    receipt = arbiter.connect(worker).submit_work(
        args=[1, "https://example.com", True]
    ).transact(
        wait_transaction_status=TransactionStatus.FINALIZED
    )

    job = arbiter.get_job(args=[1]).call()


    assert receipt["status_name"] == "FINALIZED"
    assert job["status"] == "submitted"
    assert job["deliverable"] == "https://example.com"
    assert job["deliverable_is_url"] is True
    assert job["deliverable_digest"] != ""
    assert len(job["deliverable_digest"]) == 64

def test_url_dispute_uses_pinned_evidence(accounts, arbiter):
    requester = accounts[0]
    worker = accounts[1]

    arbiter.connect(requester).create_job(
        args=[worker.address, "Review the submitted webpage"]
    ).transact(value=100)

    arbiter.connect(worker).submit_work(
        args=[1, "https://example.com", True]
    ).transact(
        wait_transaction_status=TransactionStatus.FINALIZED
    )

    submitted = arbiter.get_job(args=[1]).call()
    original_digest = submitted["deliverable_digest"]

    receipt = arbiter.connect(requester).dispute(
        args=[1, "The submitted webpage does not satisfy the requested specification."]
    ).transact()


    disputed = arbiter.get_job(args=[1]).call()


    assert receipt["status_name"] == "ACCEPTED"
    assert disputed["status"] == "verdict_pending"
    assert disputed["deliverable_is_url"] is True
    assert disputed["deliverable_digest"] == original_digest
    assert disputed["pending_verdict"] in ("worker", "requester")

def test_finalize_before_appeal_window_fails(accounts, arbiter):
    requester = accounts[0]
    worker = accounts[1]

    arbiter.connect(requester).create_job(
        args=[worker.address, "Write a Python function called add(a, b) that returns the sum of a and b"]
    ).transact(value=100)

    arbiter.connect(worker).submit_work(
        args=[1, "Here is a poem about clouds and sunsets.", False]
    ).transact(
        wait_transaction_status=TransactionStatus.FINALIZED
    )

    arbiter.connect(requester).dispute(
        args=[1, "The deliverable does not satisfy the requested specification."]
    ).transact()

    receipt = arbiter.connect(requester).finalize(
        args=[1]
    ).transact()


    job = arbiter.get_job(args=[1]).call()


    assert job["status"] == "verdict_pending"
