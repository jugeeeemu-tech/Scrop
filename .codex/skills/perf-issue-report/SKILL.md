---
name: perf-issue-report
description: Summarize Scrop performance results into issue or PR comments. Use when benchmark data is complete and needs concise, decision-ready reporting.
---

# Perf Issue Report

## Goal

Publish performance findings with enough context to support technical decisions.

## Report Structure

1. Scope
- What changed, and which variants were compared.

2. Environment
- Host, privilege mode, traffic source, duration, and ordering strategy.

3. Methods
- Profiles, run counts, and artifact paths.

4. Results
- Profile table and overall table.
- Include raw totals and normalized metrics together.

5. Interpretation
- State wins, regressions, and tradeoffs.
- Explain anomalies and measurement caveats.

6. Decision
- Explicitly answer whether current evidence is sufficient.
- List minimal follow-up actions if needed.

## Style Rules

- Use absolute dates and concrete numbers.
- Prefer short bullet points over narrative paragraphs.
- Avoid ambiguous wording like "seems better" without metrics.

## Guardrails

- Never omit failed or incomplete runs.
- Never present normalized metrics without raw totals.
