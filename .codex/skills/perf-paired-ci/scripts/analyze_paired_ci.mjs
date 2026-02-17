#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = '1';
    }
  }
  return args;
}

function readNdjson(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function phaseSetKey(phases) {
  return phases.join('+');
}

function metricCpuTimeSec(row) {
  const user = Number(row?.server?.userSec ?? 0);
  const sys = Number(row?.server?.sysSec ?? 0);
  return Number.isFinite(user + sys) ? user + sys : 0;
}

function metricDelivered(row) {
  const v = Number(row?.statusDelta?.delivered ?? 0);
  return Number.isFinite(v) ? v : 0;
}

function groupByPair(rows, phases, minPair) {
  const byPair = new Map();
  for (const row of rows) {
    if (!phases.includes(row.phase)) continue;
    const pair = Number(row.pair);
    if (!Number.isFinite(pair) || pair < minPair) continue;
    const prev = byPair.get(pair) ?? { cpuTimeSec: 0, delivered: 0, rows: 0 };
    prev.cpuTimeSec += metricCpuTimeSec(row);
    prev.delivered += metricDelivered(row);
    prev.rows += 1;
    byPair.set(pair, prev);
  }
  return byPair;
}

function deriveKpi(entry) {
  const { cpuTimeSec, delivered } = entry;
  const cpuTimePer100k = delivered > 0 ? (cpuTimeSec * 100000) / delivered : null;
  const deliveredPerCpuSec = cpuTimeSec > 0 ? delivered / cpuTimeSec : null;
  return {
    cpuTimeSec,
    delivered,
    cpuTimePer100k,
    deliveredPerCpuSec,
  };
}

function buildPairs(beforeRows, afterRows, phases, minPair) {
  const before = groupByPair(beforeRows, phases, minPair);
  const after = groupByPair(afterRows, phases, minPair);
  const pairs = [];
  const keys = [...before.keys()].filter((k) => after.has(k)).sort((a, b) => a - b);
  for (const pair of keys) {
    const b = deriveKpi(before.get(pair));
    const a = deriveKpi(after.get(pair));
    if (!Number.isFinite(b.cpuTimePer100k) || !Number.isFinite(a.cpuTimePer100k)) continue;
    if (!Number.isFinite(b.deliveredPerCpuSec) || !Number.isFinite(a.deliveredPerCpuSec)) continue;
    if (b.cpuTimePer100k <= 0 || a.cpuTimePer100k <= 0) continue;
    if (b.deliveredPerCpuSec <= 0 || a.deliveredPerCpuSec <= 0) continue;
    pairs.push({
      pair,
      before: b,
      after: a,
      ratio: {
        cpuTimePer100k: a.cpuTimePer100k / b.cpuTimePer100k,
        deliveredPerCpuSec: a.deliveredPerCpuSec / b.deliveredPerCpuSec,
      },
    });
  }
  return pairs;
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  if (sorted.length === 1) return sorted[0];
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  const w = rank - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

function mean(values) {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function geometricMean(values) {
  if (!values.length) return null;
  const logs = values.map((v) => Math.log(v));
  return Math.exp(mean(logs));
}

function createRng(seedInput) {
  let seed = Number(seedInput);
  if (!Number.isFinite(seed)) seed = 123456789;
  seed = (Math.trunc(seed) >>> 0) || 123456789;
  return function rand() {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bootstrapGeomeanRatio(ratios, samples, rng) {
  const n = ratios.length;
  if (!n) return { ci95Low: null, ci95High: null, samples: 0 };
  const draws = [];
  for (let i = 0; i < samples; i += 1) {
    const picked = [];
    for (let j = 0; j < n; j += 1) {
      const idx = Math.floor(rng() * n);
      picked.push(ratios[idx]);
    }
    draws.push(geometricMean(picked));
  }
  draws.sort((a, b) => a - b);
  return {
    ci95Low: percentile(draws, 2.5),
    ci95High: percentile(draws, 97.5),
    samples,
  };
}

function summarizeRatios(ratios, lowerIsBetter, ci) {
  const geo = geometricMean(ratios);
  const arith = mean(ratios);
  let verdict = 'inconclusive';
  if (ci.ci95Low != null && ci.ci95High != null) {
    if (lowerIsBetter) {
      if (ci.ci95High < 1.0) verdict = 'improved';
      else if (ci.ci95Low > 1.0) verdict = 'regressed';
    } else {
      if (ci.ci95Low > 1.0) verdict = 'improved';
      else if (ci.ci95High < 1.0) verdict = 'regressed';
    }
  }
  return {
    n: ratios.length,
    geometricMeanRatio: geo,
    arithmeticMeanRatio: arith,
    ci95Low: ci.ci95Low,
    ci95High: ci.ci95High,
    verdict,
  };
}

function analyzeScenario(beforeRows, afterRows, phases, opts) {
  const pairs = buildPairs(beforeRows, afterRows, phases, opts.minPair);
  const cpuRatios = pairs.map((p) => p.ratio.cpuTimePer100k);
  const thrRatios = pairs.map((p) => p.ratio.deliveredPerCpuSec);
  const ciCpu = bootstrapGeomeanRatio(cpuRatios, opts.bootstrapSamples, opts.rng);
  const ciThr = bootstrapGeomeanRatio(thrRatios, opts.bootstrapSamples, opts.rng);
  return {
    phases,
    phaseKey: phaseSetKey(phases),
    minPair: opts.minPair,
    pairCount: pairs.length,
    kpiCpuTimePer100k: summarizeRatios(cpuRatios, true, ciCpu),
    kpiDeliveredPerCpuSec: summarizeRatios(thrRatios, false, ciThr),
    pairs: pairs.map((p) => ({
      pair: p.pair,
      ratioCpuTimePer100k: p.ratio.cpuTimePer100k,
      ratioDeliveredPerCpuSec: p.ratio.deliveredPerCpuSec,
    })),
  };
}

function resolveInput(dirArg) {
  const st = fs.statSync(dirArg);
  if (!st.isDirectory()) {
    throw new Error(`--dir must be a directory: ${dirArg}`);
  }
  const beforePath = path.join(dirArg, 'before.ndjson');
  const afterPath = path.join(dirArg, 'after.ndjson');
  if (!fs.existsSync(beforePath) || !fs.existsSync(afterPath)) {
    throw new Error(`missing before.ndjson or after.ndjson in ${dirArg}`);
  }
  return { beforePath, afterPath };
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.dir) {
    console.error('Usage: analyze_paired_ci.mjs --dir <results-dir> [--minPair 3] [--bootstrap 20000] [--seed 42] [--out file]');
    process.exit(1);
  }
  const { beforePath, afterPath } = resolveInput(args.dir);
  const beforeRows = readNdjson(beforePath);
  const afterRows = readNdjson(afterPath);

  const minPair = Number.isFinite(Number(args.minPair)) ? Number(args.minPair) : 1;
  const bootstrapSamples = Number.isFinite(Number(args.bootstrap)) ? Number(args.bootstrap) : 20000;
  const seed = Number.isFinite(Number(args.seed)) ? Number(args.seed) : 42;
  const rng = createRng(seed);

  const opts = { minPair, bootstrapSamples, rng };
  const result = {
    generatedAt: new Date().toISOString(),
    inputDir: args.dir,
    minPair,
    bootstrapSamples,
    seed,
    scenarios: {
      capture_on: analyzeScenario(beforeRows, afterRows, ['capture_on'], opts),
      capture_on_ws: analyzeScenario(beforeRows, afterRows, ['capture_on_ws'], opts),
      overall_capture: analyzeScenario(beforeRows, afterRows, ['capture_on', 'capture_on_ws'], opts),
    },
  };

  const outPath = args.out ? path.resolve(args.out) : path.join(args.dir, `paired-ci-minpair${minPair}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ outPath }, null, 2)}\n`);
}

main();
