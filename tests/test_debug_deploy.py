import json
from gltest import get_contract_factory

def test_debug_deploy():
    factory = get_contract_factory("Arbiter")
    contract = factory.deploy()
    print("DEPLOYED AT:", contract.address)
    try:
        count = contract.job_count(args=[]).call()
        print("JOB_COUNT:", count)
    except Exception as e:
        resp = getattr(e, "response", None) or getattr(e, "args", None)
        print("READ FAILED:", type(e).__name__, str(e))
        print("RAW ARGS:", e.args)
