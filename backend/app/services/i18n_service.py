from __future__ import annotations

import json
from pathlib import Path


class I18nService:
    def __init__(self) -> None:
        root = Path(__file__).resolve().parents[1] / "i18n"
        self.messages = {code: json.loads((root / f"{code}.json").read_text(encoding="utf-8")) for code in ("en", "hi", "lus")}

    def advice(self, risk_level: str, language: str) -> dict:
        lang = self.messages.get(language, self.messages["en"])
        actions = [lang["move_away"], lang["avoid_debris"], lang["follow_authority"]]
        if risk_level in {"high", "critical"}:
            actions.extend([lang["contact_emergency"], lang["evacuate"]])
        return {"risk_label": lang.get(f"{risk_level}_risk", risk_level), "actions": actions, "language_review_status": lang["review_status"]}
