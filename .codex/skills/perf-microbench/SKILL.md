---
name: perf-microbench
description: Run deterministic synthetic microbenchmarks for Scrop internals. Use for fast iteration on algorithmic changes before full eBPF end-to-end validation.
---

# Perf Microbench

## Goal

Detect algorithmic performance shifts quickly with low setup overhead.

## Workflow

1. Isolate the target path.
- Benchmark one subsystem per suite (for example correlation matching).
- Avoid mixed concerns in a single benchmark.

2. Freeze workload shape.
- Use fixed packet shapes, event ordering, and repetition counts.
- Use fixed seeds for random generators.

3. Warm up and repeat.
- Include warmup iterations.
- Run enough repetitions to compare median and variance.

4. Record machine-readable output.
- Save per-run rows in TSV or JSON with:
- label, repetition, elapsed time, throughput, cpu usage

5. Compare old vs new.
- Report median delta and spread.
- Confirm trend consistency across repetitions.

## Interpretation

- Microbench is for directional signal and regression detection.
- Final release decisions still require realistic eBPF or normal-traffic validation.

## Guardrails

- Do not treat single-run improvements as final.
- Do not mix benchmarking with unrelated background workloads.
