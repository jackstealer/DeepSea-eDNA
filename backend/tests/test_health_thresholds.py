"""
Host resources warn at 90 % and go critical at 95 %, and the summary says which resource
caused it, so "warning" on the dashboard always comes with its reason.
"""
import app.main  # noqa: F401  (puts the project root, home of mlops/, on sys.path)
from mlops.monitoring import resource_status, summarize_health


def test_thresholds():
    assert resource_status(89.9) == "healthy"
    assert resource_status(90) == "warning"
    assert resource_status(94.9) == "warning"
    assert resource_status(95) == "critical"


def test_summary_names_the_resource_behind_a_warning():
    system = {
        "cpu": {"usage_percent": 23.0, "status": "healthy"},
        "memory": {"usage_percent": 85.2, "status": "healthy"},
        "disk": {"usage_percent": 91.9, "status": "warning"},
    }
    assert summarize_health(system) == ("warning", ["Disk 92% used"])


def test_critical_wins_and_lists_every_strained_resource():
    system = {
        "cpu": {"usage_percent": 40.0, "status": "healthy"},
        "memory": {"usage_percent": 91.0, "status": "warning"},
        "disk": {"usage_percent": 96.0, "status": "critical"},
    }
    assert summarize_health(system) == ("critical", ["Memory 91% used", "Disk 96% used"])


def test_unreadable_metrics_are_degraded():
    assert summarize_health({"error": "psutil failed"}) == ("degraded", ["Host metrics unavailable"])
