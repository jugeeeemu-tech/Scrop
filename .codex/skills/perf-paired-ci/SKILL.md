---
name: perf-paired-ci
description: Run paired bootstrap CI significance checks for Scrop before/after benchmark artifacts. Use when median diffs are small, contradictory, or sensitive to warmup/run order.
---

# Perf Paired CI

## Goal

Decide `improved`, `regressed`, or `inconclusive` from paired before/after runs with explicit confidence intervals.

## Inputs

- Benchmark directory containing `before.ndjson` and `after.ndjson`.
- Paired run ids in `.pair`.

## Workflow

1. Validate comparability first.
- Require identical load plan, attach target, and phase set.
- Require the same `http.mode` before/after.
- For `HTTP_MODE=requests`, require identical `attempted` counts.
- Reject mixed success semantics (for example before all errors, after all success).

2. Choose KPI explicitly.
- Primary: `cpu_time_per_100k = (userSec + sysSec) * 100000 / delivered`.
- Secondary: `delivered_per_cpu_sec = delivered / (userSec + sysSec)`.
- Use both and report both.

3. Remove warmup bias.
- Run at least `minPair=1` and `minPair=3`.
- Add `minPair=5` sensitivity when early drift is visible.

4. Run paired CI analysis.
- Script: `scripts/analyze_paired_ci.mjs`
- Example:
```bash
node .codex/skills/perf-paired-ci/scripts/analyze_paired_ci.mjs \
  --dir /tmp/perf-compare-ringbuf/results-ebpf-randomized-20260217T173041Z \
  --minPair 3 \
  --bootstrap 30000 \
  --seed 42 \
  --out /tmp/perf-compare-ringbuf/paired-ci-min3.json
```

5. Apply verdict rule.
- Lower-is-better KPI (`cpu_time_per_100k`):
- `CI95.high < 1.0` => improved
- `CI95.low > 1.0` => regressed
- otherwise => inconclusive
- Higher-is-better KPI (`delivered_per_cpu_sec`) uses inverse inequality.

6. Report caveats.
- If per-run delivered is very low, mark the result low-signal.
- If minPair sensitivity changes verdict, call out warmup/ordering risk.

## Guardrails

- Never conclude from point estimate only; always include CI.
- Never aggregate unpaired runs.
- Never mix heterogeneous workloads in one CI result.
