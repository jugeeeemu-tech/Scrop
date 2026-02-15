---
name: perf-playbook
description: Plan and orchestrate performance measurement in Scrop. Use when users ask to benchmark before/after changes, reduce noise and order bias, or decide whether evidence is sufficient for release.
---

# Perf Playbook

## Goal

Produce defensible performance conclusions with low noise and clear tradeoffs.

## Subskills

- `$perf-ebpf-abba`: Root-required eBPF before/after benchmarking with ABBA ordering.
- `$perf-normalized-metrics`: Fair comparison using normalized CPU and capture metrics.
- `$perf-normal-traffic`: Long-run validation on production-like traffic.
- `$perf-microbench`: Fast synthetic microbench for algorithmic changes.
- `$perf-issue-report`: Issue or PR comment template for final reporting.

## Workflow

1. Choose the minimal method set.
- Start with one method that answers the question.
- Add extra methods only when uncertainty remains.

2. Freeze variables before running.
- Same host, kernel, NIC selection, binary profile, duration, and load shape.
- Change only one variable per comparison (normally code version).

3. Counter order bias.
- Use `ABBA` or `BAAB`.
- Run at least two repetitions per profile and variant.

4. Preserve raw artifacts.
- Save logs and machine-readable outputs (for example `/tmp/*.json` and `/tmp/*.log`).
- Keep run plans and timestamps with absolute dates.

5. Normalize before concluding.
- Do not rely on raw CPU% alone.
- Always compute `capture_rate`, `drop_rate`, and a CPU-normalized throughput metric.

6. Report with caveats.
- Include environment and privilege assumptions.
- Explain anomalies such as `capture_rate > 100%` from background traffic.

## Guardrails

- Never compare runs with different attach targets or traffic mixes.
- Never conclude from a single run.
- If privilege mode differs (root vs non-root), treat results as non-comparable.
