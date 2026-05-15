# AI Trace Layer
![https://github.com/ThatParticularPencil/AI-Trace-Layer/blob/main/Screenshot%202026-05-14%20at%2010.51.13%E2%80%AFPM.png]

AI Trace Layer is a lightweight runtime governance sandbox for LLM outputs inspired by elloe AI, built to demonstrate how a safety and audit layer can monitor, verify, and enforce model responses in real time.

This repository is designed for roles in LLM evaluation, red teaming, and compliance operations. It showcases:

- A real-time audit and enforcement pipeline for generative AI responses
- Structured claim extraction and verification
- Dynamic source discovery, grounding, and decisioning

## Core features

- **Runtime governance**: requests flow through generation, claim extraction, verification, policy evaluation, and intervention
- **Claim-level verification**: responses are parsed into individual claims and scored for support and confidence
- **Source discovery**: the model can recommend sources, which are fetched and used for verification
- **Audit trace**: every pipeline stage emits structured events, metadata, and decisions for review
- **Enforcement actions**: responses may be allowed, warned, rewritten, or blocked based on grounding and risk

![https://github.com/ThatParticularPencil/AI-Trace-Layer/blob/main/Screenshot%202026-05-14%20at%207.23.33%E2%80%AFPM.png]

## Getting started

### Requirements

- Node.js 18+
- A compatible OpenAI API key or Gemini/Groq API keys

### Installation

```bash
npm install
```

### Environment

Set one provider and its API key in `.env` or your shell:

```bash
LLM_PROVIDER="openai"
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4o-mini"
```

For Gemini:

```bash
LLM_PROVIDER="gemini"
GEMINI_API_KEY="..."
GEMINI_MODEL="gemini-2.0-flash"
```

For Groq:

```bash
LLM_PROVIDER="groq"
GROQ_API_KEY="..."
GROQ_MODEL="llama-3.3-70b-versatile"
```

### Run locally

```bash
npm run dev
```

Then open the app in your browser and submit prompts to see the governance pipeline in action.
