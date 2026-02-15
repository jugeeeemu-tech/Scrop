---
name: perf-normal-traffic
description: Validate performance under normal production-like traffic in Scrop. Use to confirm synthetic benchmark conclusions under real operating conditions.
---

# Perf Normal Traffic

## Goal

Confirm that measured improvements hold under realistic traffic patterns.

## Workflow

1. Define a realistic observation window.
- Use at least 30 minutes per variant.
- Keep time-of-day effects in mind.

2. Use crossover order.
- Run `AB` then `BA` if possible.
- Keep attach NIC, filters, and environment unchanged.

3. Collect periodic samples.
- Poll capture counters and process CPU/RSS at fixed intervals.
- Keep the same sampling interval across variants.

4. Aggregate by time buckets.
- Compare median and p95 per metric over equal bucket widths.
- Report both central tendency and spread.

5. Validate drift and outliers.
- Flag bursts, interface state changes, and external workload spikes.
- Exclude windows only with explicit justification.

## Recommended Metrics

- Capture: delivered, drop counters, capture rate
- Resource: CPU%, RSS
- Transport: batch rate, packet stream lag (if available)

## Guardrails

- Do not mix synthetic mismatch injection into normal-traffic runs.
- Do not compare windows with different attached interfaces.
- If host load changes materially, repeat the pair.
