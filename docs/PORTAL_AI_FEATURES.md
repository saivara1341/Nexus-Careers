# Nexus Careers Portal AI Map

## AI Runtime

All portal AI features should call `runAI()` from `services/aiClient.ts`.

Supported development modes:

- `VITE_AI_PROVIDER=supabase`: calls the deployed Supabase Edge Function `ai-handler`.
- `VITE_AI_PROVIDER=ollama`: calls local Ollama at `VITE_OLLAMA_BASE_URL`.
- `VITE_AI_ENABLE_FALLBACKS=true`: returns deterministic local output when the model backend is unavailable.

Recommended local open-source models:

- `llama3.1:8b`: general chat, career advice, summaries, reports.
- `mistral:7b`: fast summaries, circulars, MoM, query triage.
- `qwen2.5:7b`: structured JSON tasks and academic writing.
- `llava:7b` or another vision model: proof/proctoring tasks, if routed through a compatible backend.

Example local setup:

```bash
ollama pull llama3.1:8b
OLLAMA_ORIGINS=http://127.0.0.1:3000 ollama serve
```

Then set:

```env
VITE_AI_PROVIDER=ollama
VITE_OLLAMA_BASE_URL=http://127.0.0.1:11434
VITE_OLLAMA_MODEL=llama3.1:8b
```

## Student Portal

- Job Board: AI job matching, opportunity analysis, application pitch generation, external opportunity search.
- My Applications: proof verification workflow. Vision verification needs a configured vision-capable model; fallback sends manual-review result.
- AI Career Toolkit: resume analysis, outreach drafting, mock interview/report generation.
- Mock Test: AI question generation, proctor checks, exam report.
- Calendar: schedule optimization.
- Resource Exchange: listing moderation.
- Idea Cafe: startup idea scoring and investor pitch.
- Career Compass: admissions mentor, SOP/scholarship/university guidance.
- ChatBot: page-aware assistant and navigation command dispatcher.

## Educator/Admin Portal

- Placement Drives: AI URL import, external scout, opportunity analysis.
- Candidate Pipeline: candidate pool ranking and shortlist recommendations.
- Student Performance: academic/placement risk analysis.
- Student Queries: query summarization.
- AI Mentor Lab: circulars, research drafts, originality checks, MoM, IDF documents.
- Department HQ: meeting minutes generation.
- Opportunity Reports: strategic placement analysis.

## Company Portal

- Post Job: AI job description generation and URL import.
- Recruitment Pipeline: candidate pool analysis.
- Company Profile: brand description optimizer.
- AI Recruiter Modal: verifies and publishes AI-created job drafts.

## Operational Notes

- Never approve sensitive workflows solely from fallback output.
- Vision tasks need a model/provider that accepts images; the text-only fallback intentionally refuses proof approval.
- External job search and URL scraping are best handled by the Supabase Edge Function because browsers and job sites often block direct client requests.
- Production deployments should keep API keys server-side in Supabase secrets, not in Vite variables.
