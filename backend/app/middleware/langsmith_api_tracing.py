from __future__ import annotations

from contextlib import nullcontext
from datetime import datetime, timezone
import os
import time
import uuid
from typing import Any, Optional

from langsmith.run_helpers import tracing_context
from langsmith.run_trees import RunTree
from starlette.datastructures import Headers, MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

_TRUE_VALUES = {"1", "true", "yes", "on"}
_TRACE_ALLOWLIST: set[tuple[str, str]] = {
    ("POST", "/api/chat-night/icebreakers"),
    ("POST", "/api/chat-night/icebreakers/reveal"),
    ("POST", "/api/internal/evals/icebreakers"),
}
_LANGSMITH_TRACING_FLAGS = ("LANGSMITH_TRACING", "LANGCHAIN_TRACING_V2")


def _to_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def _env_flag_enabled(name: str) -> bool:
    return _to_text(os.getenv(name, "")).lower() in _TRUE_VALUES


def _api_tracing_enabled() -> bool:
    return _env_flag_enabled("BH_LANGSMITH_API_TRACING_ENABLED")


def _langsmith_tracing_enabled() -> bool:
    return any(_env_flag_enabled(name) for name in _LANGSMITH_TRACING_FLAGS)


def _langsmith_api_key_present() -> bool:
    return bool(_to_text(os.getenv("LANGSMITH_API_KEY", "")))


def _should_trace(method: str, path: str) -> bool:
    return (method, path) in _TRACE_ALLOWLIST


def _build_metadata(
    *,
    method: str,
    path: str,
    status_code: int,
    duration_ms: int,
    request_id: str,
) -> dict[str, Any]:
    return {
        "method": method,
        "path": path,
        "status_code": status_code,
        "duration_ms": duration_ms,
        "request_id": request_id,
    }


class LangSmithApiTracingMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        method = _to_text(scope.get("method", "")).upper()
        path = _to_text(scope.get("path", ""))

        if (
            not _api_tracing_enabled()
            or not _langsmith_tracing_enabled()
            or not _langsmith_api_key_present()
            or not _should_trace(method, path)
        ):
            await self.app(scope, receive, send)
            return

        headers = Headers(scope=scope)
        request_id = _to_text(headers.get("x-request-id", "")) or str(uuid.uuid4())
        scope.setdefault("state", {})["request_id"] = request_id

        start_time = datetime.now(timezone.utc)
        started_at = time.perf_counter()
        status_code = 500
        captured_error: Optional[str] = None
        run: Optional[RunTree] = None

        async def send_wrapper(message: Message) -> None:
            nonlocal status_code
            if message.get("type") == "http.response.start":
                status_code = int(message.get("status", 500))
                response_headers = MutableHeaders(scope=message)
                if "x-request-id" not in response_headers:
                    response_headers.append("x-request-id", request_id)
            await send(message)

        try:
            run = RunTree(
                name=f"api {method} {path}",
                run_type="chain",
                start_time=start_time,
                inputs={},
            )
            run.post()
        except Exception:
            run = None

        trace_ctx = tracing_context(parent=run) if run else nullcontext()

        try:
            with trace_ctx:
                await self.app(scope, receive, send_wrapper)
        except Exception as exc:
            status_code = 500
            captured_error = f"{exc.__class__.__name__}: {exc}"
            raise
        finally:
            if run is None:
                return

            end_time = datetime.now(timezone.utc)
            duration_ms = int(round((time.perf_counter() - started_at) * 1000))
            metadata = _build_metadata(
                method=method,
                path=path,
                status_code=status_code,
                duration_ms=duration_ms,
                request_id=request_id,
            )

            if captured_error is None and status_code >= 500:
                captured_error = f"HTTP {status_code}"

            try:
                run.end(
                    outputs={"status_code": status_code},
                    error=captured_error,
                    end_time=end_time,
                    metadata=metadata,
                )
                run.patch(exclude_inputs=True)
            except Exception:
                pass
