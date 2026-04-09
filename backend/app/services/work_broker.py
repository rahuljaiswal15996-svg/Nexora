from __future__ import annotations

import json
import logging
import os
import threading
import time
from collections import deque
from collections.abc import Mapping, Sequence
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

try:
    import redis
except Exception:  # pragma: no cover - optional dependency fallback
    redis = None

from app.services.broker_observability import (
    record_broker_dlq,
    record_broker_publish,
    record_broker_queue_depth,
)


logger = logging.getLogger("nexora.work-broker")

PIPELINE_RUN_QUEUE = "pipeline-runs"
PLATFORM_JOB_QUEUE = "platform-jobs"
DEFAULT_WORK_QUEUE_KINDS = [PIPELINE_RUN_QUEUE, PLATFORM_JOB_QUEUE]


def _broker_backend() -> str:
    configured = (os.getenv("NEXORA_WORK_BROKER") or "").strip().lower()
    if configured:
        return configured
    return "redis" if os.getenv("NEXORA_BROKER_URL") else "memory"


def _queue_prefix() -> str:
    configured = (os.getenv("NEXORA_BROKER_QUEUE_PREFIX") or "nexora").strip().strip(":")
    return configured or "nexora"


def queue_name(queue_kind: str) -> str:
    normalized = (queue_kind or "work").strip().lower().replace("_", "-")
    return f"{_queue_prefix()}:work:{normalized}"


def dlq_queue_name(queue_kind: str) -> str:
    normalized = (queue_kind or "work").strip().lower().replace("_", "-")
    return f"{_queue_prefix()}:dlq:{normalized}"


def broker_visibility_timeout_seconds() -> int:
    configured = os.getenv("NEXORA_BROKER_VISIBILITY_TIMEOUT_SECONDS", "30")
    try:
        return max(5, int(configured))
    except (TypeError, ValueError):
        return 30


def broker_maintenance_interval_seconds() -> int:
    configured = os.getenv("NEXORA_BROKER_MAINTENANCE_INTERVAL_SECONDS", "10")
    try:
        return max(2, int(configured))
    except (TypeError, ValueError):
        return 10


def broker_message_max_retries() -> int:
    configured = os.getenv("NEXORA_BROKER_MESSAGE_MAX_RETRIES", "3")
    try:
        return max(0, int(configured))
    except (TypeError, ValueError):
        return 3


def broker_message_ttl_seconds() -> int:
    configured = os.getenv("NEXORA_BROKER_MESSAGE_TTL_SECONDS", "900")
    try:
        return max(30, int(configured))
    except (TypeError, ValueError):
        return 900


def broker_requeue_loop_detection_threshold() -> int:
    configured = os.getenv("NEXORA_BROKER_REQUEUE_LOOP_THRESHOLD", "2")
    try:
        return max(1, int(configured))
    except (TypeError, ValueError):
        return 2


def broker_requeue_history_limit() -> int:
    configured = os.getenv("NEXORA_BROKER_REQUEUE_HISTORY_LIMIT", "6")
    try:
        return max(2, int(configured))
    except (TypeError, ValueError):
        return 6


def broker_db_fallback_enabled() -> bool:
    return False


def _safe_int(value: Any, default: int, *, minimum: int = 0) -> int:
    try:
        return max(minimum, int(value))
    except (TypeError, ValueError):
        return max(minimum, int(default))


def _timestamp_from_value(value: Any, *, default: float | None = None) -> float:
    if isinstance(value, datetime):
        candidate = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        return candidate.timestamp()
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return default if default is not None else time.time()
        try:
            return float(text)
        except ValueError:
            try:
                parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
            except Exception:
                return default if default is not None else time.time()
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.timestamp()
    return default if default is not None else time.time()


def _timestamp_to_iso(timestamp: Any) -> str:
    return datetime.fromtimestamp(
        _timestamp_from_value(timestamp, default=time.time()),
        tz=timezone.utc,
    ).isoformat()


def _normalize_requeue_history(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, tuple):
        return [str(item).strip() for item in value if str(item).strip()]
    return []


def normalize_broker_message(payload: Mapping[str, Any] | None = None, *, now: float | None = None) -> dict[str, Any]:
    now_ts = float(now if now is not None else time.time())
    message = dict(payload or {})
    created_at = _timestamp_from_value(
        message.get("created_at"),
        default=_timestamp_from_value(message.get("enqueued_at"), default=now_ts),
    )
    normalized = {
        **message,
        "created_at": created_at,
        "enqueued_at": _timestamp_from_value(message.get("enqueued_at"), default=now_ts),
        "ttl_seconds": _safe_int(
            message.get("ttl_seconds", message.get("ttl")),
            broker_message_ttl_seconds(),
            minimum=1,
        ),
        "retry_count": _safe_int(message.get("retry_count"), 0, minimum=0),
        "max_retries": _safe_int(message.get("max_retries"), broker_message_max_retries(), minimum=0),
        "requeue_history": _normalize_requeue_history(message.get("requeue_history")),
        "loop_warning_emitted": bool(message.get("loop_warning_emitted")),
    }
    return normalized


def broker_state_from_metadata(metadata: Mapping[str, Any] | None) -> dict[str, Any]:
    payload = dict(metadata or {})
    return normalize_broker_message(
        {
            "retry_count": payload.get("broker_retry_count", payload.get("retry_count")),
            "max_retries": payload.get("broker_max_retries", payload.get("max_retries")),
            "created_at": payload.get("broker_created_at", payload.get("created_at")),
            "ttl_seconds": payload.get("broker_ttl_seconds", payload.get("ttl_seconds", payload.get("ttl"))),
            "enqueued_at": payload.get("broker_last_enqueued_at", payload.get("enqueued_at")),
            "requeue_history": payload.get("broker_requeue_history", payload.get("requeue_history")),
            "loop_warning_emitted": payload.get(
                "broker_loop_warning_emitted",
                payload.get("loop_warning_emitted"),
            ),
            "last_requeue_reason": payload.get("broker_requeue_reason", payload.get("last_requeue_reason")),
            "dead_lettered_at": payload.get("broker_dead_lettered_at", payload.get("dead_lettered_at")),
            "dead_letter_reason": payload.get("broker_dead_letter_reason", payload.get("dead_letter_reason")),
            "dead_letter_source": payload.get("broker_dead_letter_source", payload.get("dead_letter_source")),
        }
    )


def broker_metadata_updates(
    message: Mapping[str, Any],
    *,
    queue_label: str,
    requeue_reason: str | None = None,
    dead_letter_reason: str | None = None,
    dead_letter_source: str | None = None,
) -> dict[str, Any]:
    normalized = normalize_broker_message(message)
    updates = {
        "broker_queue": queue_label,
        "broker_retry_count": normalized["retry_count"],
        "broker_max_retries": normalized["max_retries"],
        "broker_created_at": _timestamp_to_iso(normalized["created_at"]),
        "broker_ttl_seconds": normalized["ttl_seconds"],
        "broker_last_enqueued_at": _timestamp_to_iso(normalized["enqueued_at"]),
        "broker_requeue_history": normalized.get("requeue_history") or [],
        "broker_loop_warning_emitted": bool(normalized.get("loop_warning_emitted")),
    }
    if requeue_reason is not None:
        updates["broker_requeue_reason"] = requeue_reason
    if dead_letter_reason is not None:
        updates["broker_dead_letter_reason"] = dead_letter_reason
    if dead_letter_source is not None:
        updates["broker_dead_letter_source"] = dead_letter_source
    if normalized.get("dead_lettered_at") is not None:
        updates["broker_dead_lettered_at"] = _timestamp_to_iso(normalized["dead_lettered_at"])
    return updates


def broker_message_is_expired(message: Mapping[str, Any], *, now: float | None = None) -> bool:
    normalized = normalize_broker_message(message, now=now)
    now_ts = float(now if now is not None else time.time())
    return now_ts - float(normalized["created_at"]) > float(normalized["ttl_seconds"])


def broker_message_dead_letter_reason(message: Mapping[str, Any], *, now: float | None = None) -> str | None:
    normalized = normalize_broker_message(message, now=now)
    if normalized["retry_count"] > normalized["max_retries"]:
        return "retry_limit_exceeded"
    if broker_message_is_expired(normalized, now=now):
        return "ttl_expired"
    return None


def _detect_requeue_loop(history: Sequence[str], retry_count: int) -> bool:
    threshold = broker_requeue_loop_detection_threshold()
    if retry_count > threshold:
        return True
    if retry_count < threshold or len(history) < threshold:
        return False
    trailing = [item for item in history[-threshold:] if item]
    return len(trailing) == threshold and len(set(trailing)) == 1


def next_requeue_message(
    message: Mapping[str, Any],
    *,
    reason: str,
    now: float | None = None,
) -> tuple[dict[str, Any], dict[str, bool]]:
    now_ts = float(now if now is not None else time.time())
    normalized = normalize_broker_message(message, now=now_ts)
    history = [*normalized.get("requeue_history", []), str(reason or "requeued").strip()]
    next_message = {
        **normalized,
        "retry_count": int(normalized["retry_count"]) + 1,
        "enqueued_at": now_ts,
        "requeue_history": history[-broker_requeue_history_limit():],
        "last_requeue_reason": str(reason or "requeued").strip() or "requeued",
    }
    loop_detected = _detect_requeue_loop(next_message["requeue_history"], int(next_message["retry_count"]))
    emit_loop_metric = loop_detected and not bool(normalized.get("loop_warning_emitted"))
    next_message["loop_warning_emitted"] = bool(normalized.get("loop_warning_emitted")) or loop_detected
    dead_letter_reason = broker_message_dead_letter_reason(next_message, now=now_ts)
    return next_message, {
        "loop_detected": loop_detected,
        "emit_loop_metric": emit_loop_metric,
        "retry_limit_exceeded": dead_letter_reason == "retry_limit_exceeded",
        "ttl_expired": dead_letter_reason == "ttl_expired",
    }


def make_dead_letter_message(
    message: Mapping[str, Any],
    *,
    reason: str,
    source: str,
    now: float | None = None,
) -> dict[str, Any]:
    now_ts = float(now if now is not None else time.time())
    normalized = normalize_broker_message(message, now=now_ts)
    return {
        **normalized,
        "dead_letter_reason": str(reason or "dead_lettered").strip() or "dead_lettered",
        "dead_letter_source": str(source or "broker").strip() or "broker",
        "dead_lettered_at": _timestamp_from_value(normalized.get("dead_lettered_at"), default=now_ts),
    }


def _attach_message_state(base_payload: dict[str, Any], broker_message: Mapping[str, Any] | None) -> dict[str, Any]:
    normalized = normalize_broker_message(broker_message)
    message = {
        **base_payload,
        "enqueued_at": normalized["enqueued_at"],
        "created_at": normalized["created_at"],
        "ttl_seconds": normalized["ttl_seconds"],
        "retry_count": normalized["retry_count"],
        "max_retries": normalized["max_retries"],
    }
    if normalized.get("requeue_history"):
        message["requeue_history"] = list(normalized["requeue_history"])
    if normalized.get("last_requeue_reason"):
        message["last_requeue_reason"] = normalized["last_requeue_reason"]
    if normalized.get("loop_warning_emitted"):
        message["loop_warning_emitted"] = True
    if normalized.get("dead_letter_reason"):
        message["dead_letter_reason"] = normalized["dead_letter_reason"]
    if normalized.get("dead_letter_source"):
        message["dead_letter_source"] = normalized["dead_letter_source"]
    if normalized.get("dead_lettered_at") is not None:
        message["dead_lettered_at"] = normalized["dead_lettered_at"]
    return message


def build_pipeline_run_message(
    run_id: str,
    tenant_id: str,
    pipeline_id: str,
    *,
    broker_message: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    return _attach_message_state(
        {
            "kind": "pipeline_run",
            "run_id": run_id,
            "tenant_id": tenant_id,
            "pipeline_id": pipeline_id,
        },
        broker_message,
    )


def build_platform_job_message(
    job_id: str,
    tenant_id: str,
    job_type: str,
    *,
    broker_message: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    return _attach_message_state(
        {
            "kind": "platform_job",
            "job_id": job_id,
            "tenant_id": tenant_id,
            "job_type": job_type,
        },
        broker_message,
    )


class BaseWorkBroker:
    backend_name = "unknown"

    def publish(self, queue_kind: str, payload: dict[str, Any]) -> None:
        raise NotImplementedError

    def consume(self, queue_kinds: Sequence[str], timeout_seconds: int = 5) -> dict[str, Any] | None:
        raise NotImplementedError

    def queue_depth(self, queue_kind: str) -> int:
        raise NotImplementedError

    def publish_dead_letter(self, queue_kind: str, payload: dict[str, Any]) -> None:
        raise NotImplementedError

    def dlq_depth(self, queue_kind: str) -> int:
        raise NotImplementedError

    def inspect_dlq(self, queue_kind: str, limit: int = 20) -> list[dict[str, Any]]:
        raise NotImplementedError

    def close(self) -> None:
        return None


class InMemoryWorkBroker(BaseWorkBroker):
    backend_name = "memory"

    def __init__(self) -> None:
        self._queues: dict[str, deque[str]] = {}
        self._condition = threading.Condition()

    def _publish_raw(self, queue_key: str, payload: dict[str, Any]) -> int:
        encoded = json.dumps(payload)
        with self._condition:
            self._queues.setdefault(queue_key, deque()).append(encoded)
            self._condition.notify_all()
            return len(self._queues.get(queue_key, ()))

    def _inspect_queue(self, queue_key: str, limit: int) -> list[dict[str, Any]]:
        with self._condition:
            items = list(self._queues.get(queue_key, ()))
        selected = items[-max(1, int(limit)) :]
        messages: list[dict[str, Any]] = []
        for raw in reversed(selected):
            try:
                parsed = json.loads(raw)
            except Exception:
                continue
            if isinstance(parsed, dict):
                messages.append(parsed)
        return messages

    def publish(self, queue_kind: str, payload: dict[str, Any]) -> None:
        depth = self._publish_raw(queue_name(queue_kind), payload)
        record_broker_publish(queue_kind, depth)

    def consume(self, queue_kinds: Sequence[str], timeout_seconds: int = 5) -> dict[str, Any] | None:
        queue_keys = [queue_name(kind) for kind in queue_kinds]
        deadline = time.monotonic() + max(1, timeout_seconds)
        with self._condition:
            while True:
                for queue_key in queue_keys:
                    queue = self._queues.get(queue_key)
                    if queue:
                        raw = queue.popleft()
                        message = json.loads(raw)
                        message["broker_queue"] = queue_key
                        return message

                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    return None
                self._condition.wait(timeout=remaining)

    def queue_depth(self, queue_kind: str) -> int:
        with self._condition:
            return len(self._queues.get(queue_name(queue_kind), ()))

    def publish_dead_letter(self, queue_kind: str, payload: dict[str, Any]) -> None:
        self._publish_raw(dlq_queue_name(queue_kind), payload)

    def dlq_depth(self, queue_kind: str) -> int:
        with self._condition:
            return len(self._queues.get(dlq_queue_name(queue_kind), ()))

    def inspect_dlq(self, queue_kind: str, limit: int = 20) -> list[dict[str, Any]]:
        return self._inspect_queue(dlq_queue_name(queue_kind), limit)


class RedisWorkBroker(BaseWorkBroker):
    backend_name = "redis"

    def __init__(self, broker_url: str) -> None:
        if redis is None:
            raise RuntimeError("redis package is not installed")
        self._client = redis.Redis.from_url(broker_url, decode_responses=True)

    def _publish_raw(self, queue_key: str, payload: dict[str, Any]) -> None:
        self._client.rpush(queue_key, json.dumps(payload))

    def _inspect_queue(self, queue_key: str, limit: int) -> list[dict[str, Any]]:
        rows = self._client.lrange(queue_key, -max(1, int(limit)), -1)
        messages: list[dict[str, Any]] = []
        for raw in reversed(rows):
            try:
                parsed = json.loads(raw)
            except Exception:
                continue
            if isinstance(parsed, dict):
                messages.append(parsed)
        return messages

    def publish(self, queue_kind: str, payload: dict[str, Any]) -> None:
        self._publish_raw(queue_name(queue_kind), payload)
        record_broker_publish(queue_kind, self.queue_depth(queue_kind))

    def consume(self, queue_kinds: Sequence[str], timeout_seconds: int = 5) -> dict[str, Any] | None:
        queue_keys = [queue_name(kind) for kind in queue_kinds]
        item = self._client.blpop(queue_keys, timeout=max(1, timeout_seconds))
        if not item:
            return None
        queue_key, raw = item
        message = json.loads(raw)
        message["broker_queue"] = queue_key
        return message

    def queue_depth(self, queue_kind: str) -> int:
        return int(self._client.llen(queue_name(queue_kind)))

    def publish_dead_letter(self, queue_kind: str, payload: dict[str, Any]) -> None:
        self._publish_raw(dlq_queue_name(queue_kind), payload)

    def dlq_depth(self, queue_kind: str) -> int:
        return int(self._client.llen(dlq_queue_name(queue_kind)))

    def inspect_dlq(self, queue_kind: str, limit: int = 20) -> list[dict[str, Any]]:
        return self._inspect_queue(dlq_queue_name(queue_kind), limit)

    def close(self) -> None:
        try:
            self._client.close()
        except Exception:
            logger.debug("Failed to close redis broker client cleanly", exc_info=True)


def _create_work_broker() -> BaseWorkBroker:
    backend = _broker_backend()
    if backend == "redis":
        broker_url = (os.getenv("NEXORA_BROKER_URL") or "").strip()
        if not broker_url:
            logger.warning("Redis broker selected but NEXORA_BROKER_URL is empty; falling back to in-memory broker")
            return InMemoryWorkBroker()
        try:
            broker = RedisWorkBroker(broker_url)
            logger.info("Initialized Redis work broker")
            return broker
        except Exception:
            logger.exception("Failed to initialize Redis work broker; falling back to in-memory broker")
            return InMemoryWorkBroker()

    logger.info("Initialized in-memory work broker")
    return InMemoryWorkBroker()


@lru_cache(maxsize=1)
def get_work_broker() -> BaseWorkBroker:
    return _create_work_broker()


def broker_backend() -> str:
    return get_work_broker().backend_name


def reset_work_broker() -> None:
    try:
        broker = get_work_broker()
        broker.close()
    finally:
        get_work_broker.cache_clear()


def queue_depth_snapshot(queue_kinds: Sequence[str] | None = None) -> dict[str, int]:
    broker = get_work_broker()
    selected_queue_kinds = list(queue_kinds or DEFAULT_WORK_QUEUE_KINDS)
    return {queue_kind: max(0, int(broker.queue_depth(queue_kind))) for queue_kind in selected_queue_kinds}


def dead_letter_queue_depth_snapshot(queue_kinds: Sequence[str] | None = None) -> dict[str, int]:
    broker = get_work_broker()
    selected_queue_kinds = list(queue_kinds or DEFAULT_WORK_QUEUE_KINDS)
    return {queue_kind: max(0, int(broker.dlq_depth(queue_kind))) for queue_kind in selected_queue_kinds}


def inspect_dead_letter_messages(
    queue_kinds: Sequence[str] | None = None,
    *,
    limit: int = 20,
) -> dict[str, list[dict[str, Any]]]:
    broker = get_work_broker()
    selected_queue_kinds = list(queue_kinds or DEFAULT_WORK_QUEUE_KINDS)
    return {
        queue_kind: broker.inspect_dlq(queue_kind, limit=max(1, int(limit)))
        for queue_kind in selected_queue_kinds
    }


def publish_pipeline_run_message(
    run_id: str,
    tenant_id: str,
    pipeline_id: str,
    *,
    broker_message: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    payload = build_pipeline_run_message(
        run_id,
        tenant_id,
        pipeline_id,
        broker_message=broker_message,
    )
    get_work_broker().publish(PIPELINE_RUN_QUEUE, payload)
    return payload


def publish_platform_job_message(
    job_id: str,
    tenant_id: str,
    job_type: str,
    *,
    broker_message: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    payload = build_platform_job_message(
        job_id,
        tenant_id,
        job_type,
        broker_message=broker_message,
    )
    get_work_broker().publish(PLATFORM_JOB_QUEUE, payload)
    return payload


def publish_dead_letter_message(
    queue_kind: str,
    payload: Mapping[str, Any],
    *,
    reason: str,
    source: str,
) -> dict[str, Any]:
    message = make_dead_letter_message(payload, reason=reason, source=source)
    broker = get_work_broker()
    broker.publish_dead_letter(queue_kind, message)
    record_broker_dlq(queue_kind, reason, source)
    record_broker_queue_depth(f"dlq:{queue_kind}", broker.dlq_depth(queue_kind))
    logger.error(
        "Moved broker work item to DLQ",
        extra={
            "queue_kind": queue_kind,
            "reason": reason,
            "source": source,
            "message_kind": message.get("kind"),
            "retry_count": message.get("retry_count"),
            "max_retries": message.get("max_retries"),
        },
    )
    return message


def consume_work_message(queue_kinds: Sequence[str], timeout_seconds: int = 5) -> dict[str, Any] | None:
    message = get_work_broker().consume(queue_kinds, timeout_seconds=timeout_seconds)
    if not message:
        return None
    return normalize_broker_message(message)