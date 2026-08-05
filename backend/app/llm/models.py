"""
Model constants and provider configuration.

Groq is the active provider (free tier, OpenAI-compatible API).
Anthropic is configured but not active — switching is a config change.
"""

# --- Groq (active) ---
GROQ_BASE_URL = "https://api.groq.com/openai/v1"

# --- Role → model mapping (defaults, overridable via config) ---
# These match the architecture doc's tier concept:
#   - Default tier: Commander decisions (Vuln-Analysis, Exploitation)
#   - Reporting tier: single-call report generation
#   - Fast tier: simple lookups / fallback
ROLE_MODEL_MAP = {
    "vuln_analysis": "openai/gpt-oss-120b",
    "exploitation": "openai/gpt-oss-120b",
    "exploitation_escalation": "openai/gpt-oss-120b",  # same on free tier
    "reporting": "openai/gpt-oss-120b",
    "fast": "openai/gpt-oss-20b",
}


def get_model_for_role(role: str, escalation: bool = False) -> str:
    """Return the model ID for a given Commander role.

    On Groq free tier, escalation uses the same model.
    """
    if escalation and role == "exploitation":
        return ROLE_MODEL_MAP["exploitation_escalation"]
    return ROLE_MODEL_MAP.get(role, ROLE_MODEL_MAP["vuln_analysis"])
