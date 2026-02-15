---
name: perf-normalized-metrics
description: Compute fair performance comparisons from Scrop benchmark artifacts. Use when raw CPU% is misleading because processed packet counts differ across variants.
---

# Perf Normalized Metrics

## Goal

Turn raw benchmark output into fair, decision-ready metrics.

## Core Metrics

- `capture_rate = delivered / sent`
- `drop_rate = (nicDrop + fwDrop) / sent`
- `efficiency = delivered / CPU%-sec`
- `cpu_cost_per_100k = (CPU%-sec * 100000) / delivered`

`CPU%-sec` is the sum of `cpu.mean * durationSec` across runs.

## Workflow

1. Load machine-readable results.
- Prefer JSON artifacts from the benchmark harness.

2. Aggregate by `(profile, variant)` and overall.
- Use the same run count per variant.
- Reject partial comparisons.

3. Compute normalized metrics.
- Report profile-level and overall tables.
- Include relative ratios (`after / before`) for each metric.

4. Interpret correctly.
- If `delivered` differs by orders of magnitude, raw CPU% alone is not meaningful.
- Prefer `efficiency` and `cpu_cost_per_100k` for fairness.

5. Add caveats.
- `capture_rate > 100%` can happen from non-load background traffic.
- Mention this explicitly in the final report.

## Quick Checks

- `drop_rate` unexpectedly high:
- Verify sink behavior and NIC attach configuration.

- `efficiency` unstable:
- Increase repetitions and compare medians, not a single run.

## Guardrails

- Never compare mismatched load plans.
- Never hide raw totals; normalized and raw values must be shown together.
