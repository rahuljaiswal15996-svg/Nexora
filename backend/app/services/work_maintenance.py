from __future__ import annotations

import logging
import threading

from app.services.pipeline_runner import requeue_remote_runs
from app.services.platform_jobs import requeue_remote_jobs
from app.services.work_broker import broker_maintenance_interval_seconds


logger = logging.getLogger("nexora.work-maintenance")
_maintenance_lock = threading.Lock()
_maintenance_stop = threading.Event()
_maintenance_thread: threading.Thread | None = None


def _maintenance_loop(stop_event: threading.Event) -> None:
    interval = broker_maintenance_interval_seconds()
    while not stop_event.wait(interval):
        try:
            recovered_runs = requeue_remote_runs()
            recovered_jobs = requeue_remote_jobs()
            if recovered_runs or recovered_jobs:
                logger.info(
                    "Recovered remote work from lease/broker maintenance",
                    extra={
                        "recovered_runs": recovered_runs,
                        "recovered_jobs": recovered_jobs,
                    },
                )
        except Exception:
            logger.exception("Remote work maintenance loop failed")


def start_work_maintenance() -> None:
    global _maintenance_thread
    with _maintenance_lock:
        if _maintenance_thread and _maintenance_thread.is_alive():
            return
        _maintenance_stop.clear()
        _maintenance_thread = threading.Thread(
            target=_maintenance_loop,
            args=(_maintenance_stop,),
            daemon=True,
            name="nexora-work-maintenance",
        )
        _maintenance_thread.start()


def stop_work_maintenance() -> None:
    global _maintenance_thread
    with _maintenance_lock:
        _maintenance_stop.set()
        if _maintenance_thread and _maintenance_thread.is_alive():
            _maintenance_thread.join(timeout=1.0)
        _maintenance_thread = None