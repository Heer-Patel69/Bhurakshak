from __future__ import annotations

from typing import Any

from ..core.config import Settings


class GroqCopilotService:
    """Explanation-only boundary; factual fields must be supplied by TerraWatch services."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def health(self) -> dict[str, Any]:
        return {
            "provider": "groq",
            "status": "configured_not_activated" if self.settings.groq_api_key else "not_configured",
            "role": "explanation_and_summarization_only",
            "may_decide_risk": False,
        }

    @staticmethod
    def structured_explanation_request(facts: dict[str, Any], language: str = "en") -> dict[str, Any]:
        return {
            "instruction": (
                "Explain only the supplied TerraWatch facts. Do not add coordinates, rainfall, roads, closures, "
                "villages, facilities, satellite observations, or risk values. Return valid JSON."
            ),
            "language": language,
            "facts": facts,
            "response_schema": {
                "summary": "string",
                "key_drivers": ["string"],
                "uncertainties": ["string"],
                "recommended_next_checks": ["string"],
            },
        }

