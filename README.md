# AI Trace Layer 
Lightweight AI Governance and Observability

## LLM providers

The governance pipeline supports OpenAI, Gemini, and Groq through one OpenAI-compatible adapter.

Set one provider explicitly:

```bash
LLM_PROVIDER="gemini"
GEMINI_API_KEY="..."
GEMINI_MODEL="gemini-2.0-flash"
```

```bash
LLM_PROVIDER="groq"
GROQ_API_KEY="..."
GROQ_MODEL="llama-3.3-70b-versatile"
```

Or leave `LLM_PROVIDER="auto"` and the app will use the first configured key in this order: Gemini, Groq, OpenAI. If no key is configured, the app runs with the built-in offline demo path.

## Governance architecture

The model is not limited to repeating retrieved snippets. It can reason naturally and use the supplied context preferentially. After generation, the governance layer extracts auditable claims, verifies each claim against retrieved trusted sources, scores unsupported or contradictory claims, and then allows, warns, rewrites, or blocks the response before release.
