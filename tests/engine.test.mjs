// Checks the JavaScript engine against the Python model's published results (model/results/sim_results.json).
// Run: node tests/engine.test.mjs
import { readFileSync } from "node:fs";
import { BASE, simulate, summarise, hourly } from "../app/engine.js";

const py = JSON.parse(readFileSync(new URL("../model/results/sim_results.json", import.meta.url)));
const s = summarise(BASE, simulate(BASE, 7));
const checks = [
  ["Solar used today, %", 100 * s.utilBase, py.utilisation_baseline_pct],
  ["Solar used with Bachi Dhoop, %", 100 * s.utilBd, py.utilisation_bd_pct],
  ["Diesel displaced, L", s.diesel, py.diesel_displaced_l],
  ["CO2 avoided, t", s.co2, py.co2_t],
  ["Groundwater saved, m3", s.water, py.water_saved_m3],
  ["Village energy sales, Rs", s.revenue, py.revenue_total_rs],
  ["Paid to owners, Rs", s.ownerTotal, py.owner_pay_total_rs],
  ["Cooperative surplus, Rs", s.net, py.mandali_net_rs],
];
let fail = 0;
for (const [name, js, ref] of checks) {
  const diff = Math.abs(js - ref) / Math.max(1, Math.abs(ref));
  const ok = diff < 0.05;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(32)} JS ${js.toFixed(1).padStart(10)}   Python ${String(ref).padStart(10)}   (${(100 * diff).toFixed(2)}% apart)`);
}
// Water-first rule: on every day, a pump's irrigation is fully served before any sale
const sim = simulate(BASE, 7);
let breaches = 0;
for (let d = 0; d < sim.D; d++) for (let j = 0; j < sim.n; j++) {
  const a = sim.alloc[d].a[j];
  const used = sim.irrBd[d][j] + a.chill + a.paani + a.gaadi + a.pack;
  if (used > sim.gen[d][j] + 1e-6) breaches++;
}
console.log(`${breaches ? "FAIL" : "PASS"}  Water first, never oversold       ${breaches} pump-days over generation`);
// Owner override: saying "I will irrigate" on day 14 at pump 6 must reserve water for him
const o = simulate(BASE, 7, { "14:6": true });
const okOverride = o.irrBd[14][6] > 0;
console.log(`${okOverride ? "PASS" : "FAIL"}  Owner's 6 am answer is obeyed`);
// Hourly meter log adds up to the day's generation
const h = hourly(sim, 14, 6);
const hs = h.reduce((t, r) => t + r.gen, 0);
const okH = Math.abs(hs - sim.gen[14][6]) < 1e-6;
console.log(`${okH ? "PASS" : "FAIL"}  Hourly meter log adds up`);
process.exit(fail || breaches || !okOverride || !okH ? 1 : 0);
