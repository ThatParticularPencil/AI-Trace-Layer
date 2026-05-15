# AI Trace Layer

AI Trace Layer is a lightweight runtime governance sandbox for LLM outputs, built to demonstrate how a safety and audit layer can monitor, verify, and enforce model responses in real time.

## Why this project matters

This repository is designed for roles in LLM evaluation, red teaming, and compliance operations. It showcases:

- A real-time audit and enforcement pipeline for generative AI responses
- Structured claim extraction and verification
- Dynamic source discovery, grounding, and decisioning
- A front-end observability experience for both engineers and safety stakeholders

It is especially relevant to internships focused on:

- LLM red teaming and risk testing
- Evaluation design and truth assessment
- Policy-driven compliance for AI systems
- Product safety flows and transparency tooling

## Core features

- **Runtime governance**: requests flow through generation, claim extraction, verification, policy evaluation, and intervention
- **Claim-level verification**: responses are parsed into individual claims and scored for support and confidence
- **Source discovery**: the model can recommend sources, which are fetched and used for verification
- **Audit trace**: every pipeline stage emits structured events, metadata, and decisions for review
- **Enforcement actions**: responses may be allowed, warned, rewritten, or blocked based on grounding and risk

## Architecture overview

1. **Generation**
   - The model answers freely but is guided to be cautious and evidence-aware.
   - It is asked to list recommended sources at the end of the response.

2. **Claim extraction**
   - The generated text is parsed into discrete claims.
   - Each claim includes support status and confidence.

3. **Verification**
   - Claims are verified against retrieved or discovered sources.
   - The system scores grounding, identifies unsupported claims, and surfaces contradictions.

4. **Policy enforcement**
   - Verification results feed a risk-based policy decision.
   - The response may be allowed, warned, rewritten, or blocked.

5. **Audit and storage**
   - Interaction history, trace events, policy decisions, and verification data are persisted.
   - The UI surfaces trace events and source information.

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

## Why employers should care

This repo is not just a demo: it is a practical example of how to move from passive retrieval-based output to active safety monitoring. It demonstrates:

- **Adversarial thinking**: building layers that catch unsupported or risky model behavior
- **Evaluation systems**: structuring claims and verification outputs for measurable decisions
- **Product safety**: creating a transparent audit trail and policy enforcement path
- **LLM interoperability**: supporting multiple provider backends through a single adapter

## Relevant skills demonstrated

- prompt engineering for safe, evidence-aware generation
- AI evaluation and claim-based verification
- observable, auditable runtime workflows
- frontend safety UX for governance and review
- backend persistence and trace event logging

## Notes

This app is intended to showcase a governance-first mindset: the model should think freely, but every output is monitored, scored, and controlled before reaching users.
