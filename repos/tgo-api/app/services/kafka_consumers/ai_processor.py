"""Kafka AI processing consumer.

Consumes incoming messages from Kafka, calls AI service (streaming), and publishes
AI response events to the responses topic. Optional aiokafka dependency.
"""
from __future__ import annotations

import asyncio
import json
import uuid
from typing import Any, Optional, Set

from app.core.config import settings
from app.core.logging import get_logger
from app.schemas.messages import IncomingMessagePayload
from app.services.ai_client import AIServiceClient
from app.services.kafka_producer import publish as kafka_publish, start_producer
from app.services.run_registry import run_registry

logger = get_logger("consumers.ai_processor")

try:
    from aiokafka import AIOKafkaConsumer  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    AIOKafkaConsumer = None  # type: ignore

# Module state
_consumer_task: Optional[asyncio.Task] = None
_stop_event = asyncio.Event()

# Concurrency controls
MAX_CONCURRENCY = int(getattr(settings, "KAFKA_AI_PROCESSOR_MAX_CONCURRENCY", 5))
_semaphore = asyncio.Semaphore(MAX_CONCURRENCY)
_inflight_tasks: Set[asyncio.Task] = set()

# Event types that indicate workflow completion
COMPLETION_EVENT_TYPES = frozenset({
    "workflow_completed",
    "team_run_completed",
    "workflow_failed",
    "team_run_failed",
    "error",
})


async def _handle_run_registry(
    event_type: str,
    event_payload: dict,
    client_msg_no: str,
    project_id: str,
    session_id: str,
    client: AIServiceClient,
) -> None:
    """Handle run registry operations for cancellation support."""
    try:
        if event_type == "team_run_started":
            meta = event_payload.get("metadata") or {}
            data_obj = event_payload.get("data") or {}
            run_id = meta.get("run_id") or data_obj.get("run_id")

            if run_id:
                should_cancel, reason = await run_registry.set_mapping_and_check_pending(
                    client_msg_no=client_msg_no,
                    run_id=str(run_id),
                    project_id=project_id,
                    api_key=None,
                    session_id=session_id,
                )
                if should_cancel:
                    try:
                        await client.cancel_supervisor_run(
                            project_id=project_id,
                            run_id=str(run_id),
                            reason=reason,
                        )
                        logger.info(
                            "Pending cancel executed at run start",
                            extra={"client_msg_no": client_msg_no, "run_id": run_id},
                        )
                    except Exception as cancel_exc:
                        logger.warning(
                            "Failed to cancel pending run at start: %s",
                            cancel_exc,
                            extra={"client_msg_no": client_msg_no, "run_id": run_id},
                        )

        elif event_type in COMPLETION_EVENT_TYPES:
            await run_registry.clear(client_msg_no)

    except Exception as exc:
        logger.debug(
            "run_registry handling error (ignored): %s",
            exc,
            extra={"client_msg_no": client_msg_no},
        )


async def _process_one(
    message_count: int,
    payload: IncomingMessagePayload,
    client: AIServiceClient,
) -> None:
    """Process a single incoming message end-to-end without blocking the consumer loop."""
    async with _semaphore:
        try:
            await _process_message(message_count, payload, client)
        except Exception as exc:
            logger.error(
                "Unhandled error for message #%d: %s",
                message_count,
                exc,
                exc_info=True,
            )
            await asyncio.sleep(0.5)


async def _process_message(
    message_count: int,
    payload: IncomingMessagePayload,
    client: AIServiceClient,
) -> None:
    """Core message processing logic."""
    # Extract fields from payload
    message_text = payload.message_text or ""
    client_msg_no = payload.client_msg_no
    recv_client_msg_no = uuid.uuid4().hex
    session_id = payload.session_id or f"sess_{uuid.uuid4().hex}"
    user_id = payload.from_uid or ""
    channel_id = payload.channel_id or ""
    channel_type = int(payload.channel_type or 0)
    project_id = payload.project_id or ""

    log_extra = {
        "client_msg_no": client_msg_no,
        "recv_client_msg_no": recv_client_msg_no,
        "session_id": session_id,
        "message_count": message_count,
    }

    # Validate required fields
    if not project_id or not message_text or not user_id or not channel_id:
        logger.warning(
            "Skipping message #%d due to missing fields",
            message_count,
            extra={
                "has_project_id": bool(project_id),
                "has_text": bool(message_text),
                "has_user": bool(user_id),
                "has_channel": bool(channel_id),
                **log_extra,
            },
        )
        return

    logger.info("Processing incoming message #%d", message_count, extra=log_extra)

    # Check if AI is disabled
    if payload.ai_disabled:
        logger.info(
            "AI processing disabled for message, skipping AI service call",
            extra=log_extra,
        )
        return

    # Determine team_id: use payload value if provided, otherwise "default"
    team_id = payload.team_id or "default"

    # Process AI stream
    try:
        logger.debug("Starting AI stream for message #%d", message_count)
        chunk_count = 0

        async for _, event_payload in client.run_supervisor_agent_stream(
            message=message_text,
            project_id=project_id,
            team_id=team_id,
            agent_id=payload.agent_id,
            session_id=session_id,
            user_id=user_id,
            enable_memory=True,
            system_message=payload.system_message,
            expected_output=payload.expected_output,
        ):
            chunk_count += 1

            if not isinstance(event_payload, dict):
                continue

            event_type = event_payload.get("event_type", "team_run_content")
            event_payload.setdefault("event_type", event_type)

            # Handle run registry for cancellation support
            if client_msg_no:
                await _handle_run_registry(
                    event_type=event_type,
                    event_payload=event_payload,
                    client_msg_no=client_msg_no,
                    project_id=project_id,
                    session_id=session_id,
                    client=client,
                )

            # Publish event to Kafka
            # For personal channels (type=1), swap from_uid and channel_id
            # so AI response goes from agent/staff to the original sender
            if channel_type == 1:
                publish_from_uid = channel_id
                publish_channel_id = payload.staff_cid or ""
            else:
                publish_from_uid = payload.staff_cid or ""
                publish_channel_id = channel_id

            await kafka_publish(
                settings.KAFKA_TOPIC_AI_RESPONSES,
                {
                    "session_id": session_id,
                    "client_msg_no": client_msg_no,
                    "recv_client_msg_no": recv_client_msg_no,
                    "from_uid": publish_from_uid,
                    "channel_id": publish_channel_id,
                    "channel_type": channel_type,
                    **event_payload,
                },
            )

        logger.info(
            "AI stream completed for message #%d",
            message_count,
            extra={"chunk_count": chunk_count, **log_extra},
        )

    except Exception as exc:
        logger.error(
            "AI streaming failed for message #%d: %s",
            message_count,
            exc,
            extra=log_extra,
            exc_info=True,
        )


async def _run_consumer() -> None:
    """Main consumer loop."""
    if AIOKafkaConsumer is None:
        logger.warning("aiokafka not installed; AI processor consumer disabled")
        return

    logger.info("Initializing consumer...")
    consumer = AIOKafkaConsumer(
        settings.KAFKA_TOPIC_INCOMING_MESSAGES,
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
        group_id=settings.KAFKA_CONSUMER_GROUP_AI_PROCESSOR,
        enable_auto_commit=True,
        auto_offset_reset="earliest",
        value_deserializer=lambda v: json.loads(v.decode("utf-8")),
    )
    client = AIServiceClient()

    await consumer.start()
    await start_producer()
    logger.info(
        "Consumer started, entering message loop",
        extra={"topic": settings.KAFKA_TOPIC_INCOMING_MESSAGES},
    )

    message_count = 0
    try:
        async for msg in consumer:
            message_count += 1

            if _stop_event.is_set():
                logger.info("Stop event detected, breaking loop")
                break

            logger.debug(
                "Received message #%d from Kafka",
                message_count,
                extra={
                    "offset": msg.offset,
                    "partition": msg.partition,
                    "timestamp": msg.timestamp,
                },
            )

            try:
                payload_dict = msg.value or {}
                payload = IncomingMessagePayload.model_validate(payload_dict)

                # Dispatch processing as background task
                task = asyncio.create_task(_process_one(message_count, payload, client))
                _inflight_tasks.add(task)
                task.add_done_callback(lambda t: _inflight_tasks.discard(t))

            except Exception as exc:
                logger.error(
                    "Error dispatching task for message #%d: %s",
                    message_count,
                    exc,
                    exc_info=True,
                )

    except asyncio.CancelledError:
        logger.warning("Consumer task was cancelled")
        raise
    except Exception as exc:
        logger.error("Fatal error in consumer loop: %s", exc, exc_info=True)
        raise
    finally:
        logger.info("Stopping consumer (processed %d messages total)", message_count)
        await consumer.stop()

        # Wait for in-flight tasks to finish
        if _inflight_tasks:
            pending = set(_inflight_tasks)
            logger.info("Waiting for %d in-flight task(s) to finish", len(pending))

            done, not_done = await asyncio.wait(pending, timeout=20)

            if not_done:
                logger.warning(
                    "%d task(s) still running after timeout; cancelling",
                    len(not_done),
                )
                for t in not_done:
                    t.cancel()


async def start_ai_processor() -> None:
    """Start the AI processor consumer task."""
    global _consumer_task

    if _consumer_task and not _consumer_task.done():
        logger.debug("Consumer task already running, skipping start")
        return

    logger.info("Starting new consumer task")
    _stop_event.clear()
    _consumer_task = asyncio.create_task(_run_consumer())


async def stop_ai_processor() -> None:
    """Stop the AI processor consumer task."""
    logger.info("Stop requested")
    _stop_event.set()

    if not _consumer_task:
        return

    try:
        await asyncio.wait_for(_consumer_task, timeout=5)
        logger.info("Consumer task finished gracefully")
    except asyncio.TimeoutError:
        logger.warning("Consumer task timeout, cancelling")
        _consumer_task.cancel()
    except Exception as exc:
        logger.error("Error stopping consumer task: %s", exc)
        _consumer_task.cancel()
