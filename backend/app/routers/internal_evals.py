from __future__ import annotations

import os
from typing import List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.schemas.chat_night import SanitizedMatchContext
from app.services.ai_icebreakers import (
    MODEL_FALLBACK,
    MODEL_NONE,
    OUTPUT_ICEBREAKER_COUNT,
    OUTPUT_REASON_COUNT,
    fallback_icebreakers_response,
    generate_icebreakers,
    get_icebreakers_prompt_version,
    validate_icebreakers_payload,
)

router = APIRouter()


def _env_flag_enabled(name: str) -> bool:
    return (os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"})


def _is_production_environment() -> bool:
    # Safety net against accidental public exposure when deploy env is marked prod.
    production_markers = {"prod", "production", "live"}
    env_names = ("APP_ENV", "ENV", "ENVIRONMENT", "FASTAPI_ENV", "BH_ENV")
    for env_name in env_names:
        value = os.getenv(env_name, "").strip().lower()
        if value in production_markers:
            return True
    return False


def _internal_evals_enabled() -> bool:
    if not (_env_flag_enabled("CHAT_NIGHT_TEST_MODE") and _env_flag_enabled("BH_INTERNAL_EVALS_ENABLED")):
        return False

    if _is_production_environment() and not _env_flag_enabled("BH_INTERNAL_EVALS_ALLOW_PROD"):
        return False

    return True


class InternalIcebreakersEvalRequest(BaseModel):
    case_id: str = Field(min_length=1, max_length=120)
    context: SanitizedMatchContext


class InternalIcebreakersEvalMeta(BaseModel):
    prompt_version: str
    mode: str
    cached: bool


class InternalIcebreakersEvalResponse(BaseModel):
    case_id: str
    reasons: List[str] = Field(min_length=OUTPUT_REASON_COUNT, max_length=OUTPUT_REASON_COUNT)
    icebreakers: List[str] = Field(min_length=OUTPUT_ICEBREAKER_COUNT, max_length=OUTPUT_ICEBREAKER_COUNT)
    meta: InternalIcebreakersEvalMeta


@router.post("/icebreakers", response_model=InternalIcebreakersEvalResponse)
async def eval_icebreakers(data: InternalIcebreakersEvalRequest):
    if not _internal_evals_enabled():
        raise HTTPException(status_code=404, detail="Not found")

    try:
        reasons, icebreakers, model_name, cached = await generate_icebreakers(
            data.context,
            requester_user_id=None,
            participant_user_ids=None,
        )
    except Exception:
        prefer_fallback = (
            os.getenv("CHAT_NIGHT_ICEBREAKERS_PROVIDER", "none").strip().lower() == "openai"
            and bool(os.getenv("OPENAI_API_KEY", "").strip())
        )
        reasons, icebreakers, model_name, cached = fallback_icebreakers_response(
            data.context,
            prefer_fallback=prefer_fallback,
        )

    payload = validate_icebreakers_payload(
        {
            "reasons": reasons,
            "icebreakers": icebreakers,
        }
    )

    mode = "llm" if model_name not in {MODEL_NONE, MODEL_FALLBACK} else "deterministic"
    return InternalIcebreakersEvalResponse(
        case_id=data.case_id,
        reasons=payload["reasons"],
        icebreakers=payload["icebreakers"],
        meta=InternalIcebreakersEvalMeta(
            prompt_version=get_icebreakers_prompt_version(),
            mode=mode,
            cached=bool(cached),
        ),
    )
