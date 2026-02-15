"""Unified AI client abstraction supporting multiple providers.

Supported providers:
- anthropic (Claude) — default
- google (Gemini) — free tier available
- openai (ChatGPT)

All providers produce the same output format for seamless switching.
"""

from __future__ import annotations

import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Provider constants
PROVIDER_ANTHROPIC = "anthropic"
PROVIDER_GOOGLE = "google"
PROVIDER_OPENAI = "openai"
PROVIDER_COMET = "comet"
PROVIDER_GROQ = "groq"

SUPPORTED_PROVIDERS = {PROVIDER_ANTHROPIC, PROVIDER_GOOGLE, PROVIDER_OPENAI, PROVIDER_COMET, PROVIDER_GROQ}

# Default models per provider
DEFAULT_MODELS = {
    PROVIDER_ANTHROPIC: "claude-sonnet-4-5-20250929",
    PROVIDER_GOOGLE: "models/gemini-2.0-flash-lite",
    PROVIDER_OPENAI: "gpt-4o-mini",
    PROVIDER_COMET: "claude-3-5-haiku-latest",  # cheap + fast via CometAPI proxy
    PROVIDER_GROQ: "llama-3.1-8b-instant",  # free tier, very fast
}

# CometAPI base URL (OpenAI-compatible proxy)
COMET_API_BASE = "https://api.cometapi.com/v1"

# Groq base URL (OpenAI-compatible, genuinely free tier)
GROQ_API_BASE = "https://api.groq.com/openai/v1"


def chat_completion(
    api_key: str,
    system_prompt: str,
    user_prompt: str,
    provider: str = PROVIDER_ANTHROPIC,
    model: Optional[str] = None,
    max_tokens: int = 1024,
) -> str:
    """Send a chat completion request to the specified AI provider.

    Args:
        api_key: The API key for the chosen provider.
        system_prompt: System-level instructions.
        user_prompt: The user message / main prompt.
        provider: One of 'anthropic', 'google', 'openai'.
        model: Optional model override. Uses provider default if None.
        max_tokens: Maximum response tokens.

    Returns:
        The raw text response from the model.

    Raises:
        ValueError: If provider is unsupported.
        Exception: Propagates provider SDK errors.
    """
    provider = provider.lower().strip()
    if provider not in SUPPORTED_PROVIDERS:
        raise ValueError(
            f"Unsupported AI provider: '{provider}'. "
            f"Supported: {', '.join(sorted(SUPPORTED_PROVIDERS))}"
        )

    model = model or DEFAULT_MODELS[provider]

    if provider == PROVIDER_ANTHROPIC:
        return _call_anthropic(api_key, system_prompt, user_prompt, model, max_tokens)
    elif provider == PROVIDER_GOOGLE:
        return _call_google(api_key, system_prompt, user_prompt, model, max_tokens)
    elif provider == PROVIDER_OPENAI:
        return _call_openai(api_key, system_prompt, user_prompt, model, max_tokens)
    elif provider == PROVIDER_COMET:
        return _call_comet(api_key, system_prompt, user_prompt, model, max_tokens)
    elif provider == PROVIDER_GROQ:
        return _call_groq(api_key, system_prompt, user_prompt, model, max_tokens)

    # Should never reach here
    raise ValueError(f"Unhandled provider: {provider}")


def _call_anthropic(
    api_key: str,
    system_prompt: str,
    user_prompt: str,
    model: str,
    max_tokens: int,
) -> str:
    """Call Anthropic Claude API."""
    import anthropic

    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": user_prompt}],
        system=system_prompt,
    )
    return response.content[0].text


def _call_google(
    api_key: str,
    system_prompt: str,
    user_prompt: str,
    model: str,
    max_tokens: int,
) -> str:
    """Call Google Gemini API."""
    from google import genai

    client = genai.Client(api_key=api_key)

    response = client.models.generate_content(
        model=model,
        contents=f"{system_prompt}\n\n{user_prompt}",
        config={
            "max_output_tokens": max_tokens,
            "temperature": 0.7,
        },
    )
    return response.text


def _call_openai(
    api_key: str,
    system_prompt: str,
    user_prompt: str,
    model: str,
    max_tokens: int,
) -> str:
    """Call OpenAI ChatGPT API."""
    from openai import OpenAI

    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model=model,
        max_tokens=max_tokens,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    return response.choices[0].message.content or ""


def _call_comet(
    api_key: str,
    system_prompt: str,
    user_prompt: str,
    model: str,
    max_tokens: int,
) -> str:
    """Call CometAPI — an OpenAI-compatible proxy supporting 500+ models.

    Uses the OpenAI SDK pointed at CometAPI's base URL.
    Supports Claude, Gemini, GPT, DeepSeek, and more via a single key.
    """
    from openai import OpenAI

    client = OpenAI(api_key=api_key, base_url=COMET_API_BASE)
    response = client.chat.completions.create(
        model=model,
        max_tokens=max_tokens,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    return response.choices[0].message.content or ""


def _call_groq(
    api_key: str,
    system_prompt: str,
    user_prompt: str,
    model: str,
    max_tokens: int,
) -> str:
    """Call Groq API — genuinely free tier, very fast inference.

    Uses the OpenAI SDK pointed at Groq's base URL.
    Get a free key at https://console.groq.com
    Recommended models: llama-3.1-8b-instant, llama-3.3-70b-versatile
    """
    from openai import OpenAI

    client = OpenAI(api_key=api_key, base_url=GROQ_API_BASE)
    response = client.chat.completions.create(
        model=model,
        max_tokens=max_tokens,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    return response.choices[0].message.content or ""


def parse_json_response(text: str, expect_array: bool = False) -> dict | list:
    """Extract and parse JSON from an AI response.

    AI models sometimes wrap JSON in markdown code fences or add commentary.
    This handles all common cases.

    Args:
        text: Raw model response text.
        expect_array: If True, look for a JSON array instead of object.

    Returns:
        Parsed JSON as dict or list.

    Raises:
        ValueError: If no valid JSON found.
    """
    # First try direct parse
    stripped = text.strip()
    # Strip markdown code fences
    if stripped.startswith("```"):
        lines = stripped.split("\n")
        # Remove first and last fence lines
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        stripped = "\n".join(lines).strip()

    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass

    # Try to find JSON in the response
    if expect_array:
        start = text.find("[")
        end = text.rfind("]") + 1
    else:
        start = text.find("{")
        end = text.rfind("}") + 1

    if start >= 0 and end > start:
        try:
            return json.loads(text[start:end])
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not parse JSON from AI response: {text[:200]}...")
