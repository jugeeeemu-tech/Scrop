---
name: perf-ebpf-abba
description: Run root-required eBPF before/after benchmarks with ABBA ordering in Scrop. Use for capture pipeline changes where order bias and privilege constraints must be controlled.
---

# Perf eBPF ABBA

## Goal

Collect comparable before/after eBPF benchmark data with order bias mitigation.

## Workflow

1. Build isolated binaries.
- Build baseline and candidate into separate target directories.
- Example: `/tmp/scrop-target-before` and `/tmp/scrop-target-after`.

2. Grant runtime capabilities.
- Run `setcap 'cap_bpf,cap_net_admin,cap_perfmon+ep'` for both binaries.
- Verify with `getcap`.

3. Prepare root runner and logs.
- Run benchmark orchestration as root when tracepoint attach requires it.
- Use unique log paths to avoid `EACCES` collisions.

4. Execute ABBA per profile.
- Run per-profile sequence: `before -> after -> after -> before`.
- Keep the same load profile definitions for both variants.
- Keep the same HTTP target semantics (same endpoint and same success/failure behavior).

5. Validate output completeness.
- Confirm all planned runs are present in results JSON.
- Check that each profile has two runs per variant.

6. Save artifacts.
- Keep results JSON and root log with absolute timestamp and host name.

## Troubleshooting

- `Operation not permitted` on kfree tracepoint:
- Run the suite under `sudo`.

- `EACCES` while writing `/tmp/*.log`:
- Use per-run unique directories or adjust ownership.

- Near-zero captured packets:
- Verify NIC attach target, sink process, and load-generator destination.

- `missing node runtime` from `/tmp` harness:
- Set `NODE_BIN` explicitly (for example `~/.local/share/fnm/aliases/default/bin/node`).

## Guardrails

- Do not mix different NIC selections between variants.
- Keep duration and packet size fixed across all runs.
- If one run crashes, rerun the full ABBA block for that profile.
- If before/after HTTP responses differ (one 2xx, one 4xx), treat the run as non-comparable.
