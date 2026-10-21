// Bachi Dhoop engine: a 365-day dispatch model of one 15-pump village cluster.
// JavaScript port of model/bachi_dhoop_sim.py (same logic, same seeded random draws).
// Exposes: BASE (assumptions), simulate(params, seed, overrides), summarise(params, sim),
//          hourly(sim, day, pump) for the smart meter-relay view, dateOf(day) helpers.

export const DIM = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const CHANNELS = ["chill", "paani", "gaadi", "pack"];

// All assumptions in one place. Sources are listed in docs/data-sources.md.
export const BASE = {
  pumps: [
    ...Array(2).fill({ hp: 5, kwp: 4.8, role: "hub" }), { hp: 7.5, kwp: 6.75, role: "hub" },
    ...Array(3).fill({ hp: 5, kwp: 4.8, role: "paani" }), { hp: 7.5, kwp: 6.75, role: "paani" },
    ...Array(4).fill({ hp: 3, kwp: 3.0, role: "field" }), ...Array(3).fill({ hp: 5, kwp: 4.8, role: "field" }),
    { hp: 7.5, kwp: 6.75, role: "field" },
  ],
  haPerPump: 1.6,
  // Solar: monthly irradiance shape, scaled so each kWp makes 1,500 kWh a year
  shape: [4.6, 5.3, 5.8, 6.0, 5.9, 4.4, 3.2, 3.3, 4.2, 4.9, 4.7, 4.4],
  yieldPerKwp: 1500, sigMon: 0.35, sigDry: 0.10,
  // Irrigation: chance a pump irrigates on a given day, by month (rabi-heavy calendar)
  irrigProb: [0.75, 0.70, 0.55, 0.35, 0.25, 0.15, 0.03, 0.05, 0.12, 0.40, 0.65, 0.75],
  irrigSaving: 0.10, m3PerKwh: 1.8,
  // Dhoop Line: dairy society bulk milk chiller with ice bank
  milk: [1150, 1150, 1050, 950, 850, 850, 900, 950, 1000, 1100, 1150, 1150], milkScale: 1,
  chillKwhPerL: 0.03, chillerMax: 45, dgShare: 0.30, gridTariff: 8.5, priceChill: 7,
  // Paani Seva: neighbours who rent diesel pumps today
  nbPerPump: 1.5, nbKwh: 12, pricePaani: 12,
  // Dhoop Gaadi: mobile machine trolley
  gaadiMax: 45, gaadiDemand: [18, 18, 30, 30, 18, 15, 12, 12, 15, 30, 30, 18], gaadiProb: 0.85, priceGaadi: 22,
  // Dhoop Packs: swappable 2.4 kWh batteries
  packCount: 12, packDelivered: 2.0, packEff: 0.9, swapRate: 0.85, chargerKwh: 18, pricePack: 20, packDieselShare: 0.4,
  // Diesel and emissions
  diesel: 98, lDg: 0.30, lShaft: 0.28, co2Diesel: 2.68, co2Grid: 0.71,
  // Money
  ownerPay: 4.5, ownerPaaniShare: 0.6,
  uspc: 35000, uspcCfa: 0.30, smallKit: 10000,
  mandaliFixed: { meters: 75000, line: 150000, gaadi: 200000, setup: 75000 },
  packKwhCap: 2.4, packCostPerKwh: 14000, chargers: 5, chargerCost: 10000,
  icebank: 300000, commission: 0.15, ecart: 30000, maint: 0.03, fee: 1000, grant: 0.5,
};

export const pumpId = j => "P" + String(j + 1).padStart(2, "0");

export function dateOf(d) {
  let m = 0, k = d;
  while (k >= DIM[m]) { k -= DIM[m]; m++; }
  return { m, dd: k + 1 };
}
export const dayLabel = d => { const { m, dd } = dateOf(d); return `${dd} ${MONTHS_LONG[m]}`; };

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function draws(p, seed) {
  const rnd = mulberry32(seed);
  const normal = () => { let u = 0; while (u === 0) u = rnd(); const v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const n = p.pumps.length;
  const scale = p.yieldPerKwp / p.shape.reduce((s, x, m) => s + x * DIM[m], 0);
  const mi = [], yld = [];
  DIM.forEach((nd, m) => {
    const sig = m >= 5 && m <= 8 ? p.sigMon : p.sigDry;
    for (let k = 0; k < nd; k++) { mi.push(m); yld.push(p.shape[m] * scale * Math.exp(-sig * sig / 2 + sig * normal())); }
  });
  const D = yld.length;
  const irrigDay = [], useFrac = [], nbDay = [], gaadiOn = [];
  for (let d = 0; d < D; d++) irrigDay.push(Array.from({ length: n }, () => rnd()));
  for (let d = 0; d < D; d++) useFrac.push(Array.from({ length: n }, () => 0.75 + 0.25 * rnd()));
  for (let d = 0; d < D; d++) nbDay.push(Array.from({ length: n }, () => rnd()));
  for (let d = 0; d < D; d++) gaadiOn.push(rnd());
  return { mi, yld, irrigDay, useFrac, nbDay, gaadiOn, D, n };
}

/**
 * Run the cluster for a year.
 * overrides: { "day:pump": true | false } — the owner's answer to the 6 am call
 * (true = "I will irrigate today", false = "I will not"). Missing keys use the modelled crop calendar.
 * Dispatch order each day (the platform's rules):
 *   0. Water first: the owner's irrigation is served before anything is sold.
 *   1. Dhoop Line: hub pumps feed the dairy chiller.
 *   2. Paani Seva: Paani pumps water neighbours who would otherwise rent diesel pumps.
 *   3. Dhoop Gaadi: the machine trolley goes to the eligible pump that has sold least (fair share).
 *   4. Dhoop Packs: battery packs charge at pumps that have sold least, until the day's swaps are covered.
 */
export function simulate(p, seed = 7, overrides = {}) {
  const r = draws(p, seed);
  const { mi, yld, D, n } = r;
  const kwp = p.pumps.map(x => x.kwp), roles = p.pumps.map(x => x.role);
  const gen = [], irrBase = [], irrBd = [], alloc = [], irrigFlag = [];
  const sold = new Array(n).fill(0), paaniRev = new Array(n).fill(0), cumGen = new Array(n).fill(0);
  const chillDemand = [];
  for (let d = 0; d < D; d++) {
    const m = mi[d];
    const g = kwp.map(k => k * yld[d]);
    const flag = g.map((_, j) => {
      const key = d + ":" + j;
      if (key in overrides) return !!overrides[key];
      return r.irrigDay[d][j] < p.irrigProb[m];
    });
    const ib = g.map((x, j) => (flag[j] ? x * r.useFrac[d][j] : 0));
    const ibd = ib.map(x => x * (1 - p.irrigSaving));
    gen.push(g); irrBase.push(ib); irrBd.push(ibd); irrigFlag.push(flag);
    const s = g.map((x, j) => x - ibd[j]);
    g.forEach((x, j) => (cumGen[j] += x));
    const fair = i => sold[i] / cumGen[i];
    const a = Array.from({ length: n }, () => ({ chill: 0, paani: 0, gaadi: 0, pack: 0 }));
    const chillNeed = p.milk[m] * p.milkScale * p.chillKwhPerL;
    chillDemand.push(chillNeed);
    let need = Math.min(chillNeed, p.chillerMax);
    for (let j = 0; j < n; j++) if (roles[j] === "hub") { const t = Math.min(s[j], need); s[j] -= t; need -= t; a[j].chill += t; sold[j] += t; }
    for (let j = 0; j < n; j++) if (roles[j] === "paani" && r.nbDay[d][j] < p.irrigProb[m]) {
      const t = Math.min(s[j], p.nbPerPump * p.nbKwh); s[j] -= t; a[j].paani += t; paaniRev[j] += t * p.pricePaani;
    }
    let gaadiAt = -1;
    if (r.gaadiOn[d] < p.gaadiProb) {
      const want = Math.min(p.gaadiDemand[m], p.gaadiMax);
      const big = [...Array(n).keys()].filter(i => roles[i] !== "hub" && kwp[i] >= 4.8);
      let cand = big.filter(i => s[i] >= want);
      if (!cand.length) cand = [big.reduce((b, i) => (s[i] > s[b] ? i : b), big[0])];
      const j = cand.reduce((b, i) => (fair(i) < fair(b) ? i : b), cand[0]);
      const t = Math.min(s[j], want); s[j] -= t; a[j].gaadi += t; sold[j] += t; gaadiAt = j;
    }
    need = p.packCount * p.swapRate * p.packDelivered / p.packEff;
    const order = [...Array(n).keys()].filter(i => s[i] > 2).sort((x, y) => fair(x) - fair(y));
    for (const j of order) { if (need <= 0) break; const t = Math.min(s[j], p.chargerKwh, need); s[j] -= t; need -= t; a[j].pack += t; sold[j] += t; }
    alloc.push({ a, gaadiAt, chillNeed, left: s.slice() });
  }
  return { r, gen, irrBase, irrBd, irrigFlag, alloc, sold, paaniRev, chillDemand, kwp, roles, mi, D, n };
}

export function summarise(p, sim) {
  const { gen, irrBase, irrBd, alloc, sold, paaniRev, chillDemand, kwp, mi, D, n } = sim;
  const sum2 = arr => arr.reduce((s, row) => s + row.reduce((t, x) => t + x, 0), 0);
  const G = sum2(gen), B = sum2(irrBase), I = sum2(irrBd);
  const sv = { chill: 0, paani: 0, gaadi: 0, pack: 0 };
  const monthly = MONTHS.map(() => ({ gen: 0, base: 0, irr: 0, chill: 0, paani: 0, gaadi: 0, pack: 0 }));
  for (let d = 0; d < D; d++) {
    const mo = monthly[mi[d]];
    for (let j = 0; j < n; j++) {
      const a = alloc[d].a[j];
      for (const k in sv) { sv[k] += a[k]; mo[k] += a[k]; }
      mo.gen += gen[d][j]; mo.base += irrBase[d][j]; mo.irr += irrBd[d][j];
    }
  }
  const sec = sv.chill + sv.paani + sv.gaadi + sv.pack;
  const packDel = sv.pack * p.packEff;
  const dChill = sv.chill * p.dgShare * p.lDg, dPaani = sv.paani * p.lShaft, dGaadi = sv.gaadi * p.lShaft, dPack = packDel * p.packDieselShare * p.lDg;
  const diesel = dChill + dPaani + dGaadi + dPack;
  const gridDisp = sv.chill * (1 - p.dgShare);
  const co2 = (diesel * p.co2Diesel + gridDisp * p.co2Grid) / 1000;
  const water = (B - I) * p.m3PerKwh;
  const ha = n * p.haPerPump;
  const rev = { chill: sv.chill * p.priceChill, paani: sv.paani * p.pricePaani, gaadi: sv.gaadi * p.priceGaadi, pack: packDel * p.pricePack };
  const revenue = rev.chill + rev.paani + rev.gaadi + rev.pack;
  const ownerPay = sold.map((x, j) => x * p.ownerPay + paaniRev[j] * p.ownerPaaniShare);
  const ownerTotal = ownerPay.reduce((s, x) => s + x, 0);
  const mcap = Object.values(p.mandaliFixed).reduce((s, x) => s + x, 0) +
    (p.packCount > 0 ? p.packCount * p.packKwhCap * p.packCostPerKwh + p.chargers * p.chargerCost : 0);
  const opex = { commission: p.commission * revenue, ecart: p.packCount > 0 ? p.ecart : 0, maint: p.maint * mcap, fee: p.fee * n };
  const opexTotal = opex.commission + opex.ecart + opex.maint + opex.fee;
  const net = revenue - ownerTotal - opexTotal;
  const bySize = {};
  [[3, 3.0], [5, 4.8], [7.5, 6.75]].forEach(([hp, k]) => {
    const idx = kwp.map((x, j) => (x === k ? j : -1)).filter(j => j >= 0);
    const inc = idx.reduce((s, j) => s + ownerPay[j], 0) / idx.length;
    const cap = hp === 3 ? p.smallKit : p.uspc, capNet = hp === 3 ? p.smallKit : p.uspc * (1 - p.uspcCfa);
    bySize[hp] = { income: inc, cap, payback: inc > 0 ? cap / inc : Infinity, paybackCfa: inc > 0 ? capNet / inc : Infinity };
  });
  const chillBaseCost = (1 - p.dgShare) * p.gridTariff + p.dgShare * p.lDg * p.diesel;
  const dairySaving = sv.chill * (chillBaseCost - p.priceChill);
  const shaftCost = p.lShaft * p.diesel, dgCost = p.lDg * p.diesel;
  const userSaving = sv.paani * (shaftCost - p.pricePaani) + sv.gaadi * (shaftCost - p.priceGaadi) + packDel * p.packDieselShare * (dgCost - p.pricePack);
  const nSmall = kwp.filter(k => k === 3.0).length;
  const totalCapex = p.uspc * (n - nSmall) + p.smallKit * nSmall + mcap + p.icebank;
  const value = ownerTotal + net + dairySaving + userSaving;
  return {
    G, B, I, sv, sec, packDel, monthly,
    utilBase: B / G, utilBd: (I + sec) / G,
    diesel, dieselBy: { chill: dChill, paani: dPaani, gaadi: dGaadi, pack: dPack }, co2, water, ha,
    rev, revenue, ownerPay, ownerTotal, opex, opexTotal, net, mcap,
    payback: net > 0 ? mcap / net : Infinity, paybackGrant: net > 0 ? mcap * (1 - p.grant) / net : Infinity,
    bySize, chillCover: sv.chill / chillDemand.reduce((s, x) => s + x, 0), chillBaseCost, dairySaving,
    dairyPayback: dairySaving > 0 ? p.icebank / dairySaving : Infinity, userSaving, totalCapex, value,
    systemPayback: value > 0 ? totalCapex / value : Infinity,
  };
}

/** What one pump earned for its owner on one day (₹). */
export function earned(p, sim, d, j) {
  const a = sim.alloc[d].a[j];
  return (a.chill + a.gaadi + a.pack) * p.ownerPay + a.paani * p.pricePaani * p.ownerPaaniShare;
}

/** Bills the Dhoop Mitra collects on a day: one line per pump and channel with kWh and ₹. */
export function dayBills(p, sim, d) {
  const out = [];
  const al = sim.alloc[d];
  for (let j = 0; j < sim.n; j++) {
    const a = al.a[j];
    if (a.chill > 0.05) out.push({ j, ch: "chill", kwh: a.chill, price: p.priceChill, buyer: "Dairy society" });
    if (a.paani > 0.05) out.push({ j, ch: "paani", kwh: a.paani, price: p.pricePaani, buyer: "Neighbour (Paani Seva)" });
    if (a.gaadi > 0.05) out.push({ j, ch: "gaadi", kwh: a.gaadi, price: p.priceGaadi, buyer: "Gaadi users" });
    if (a.pack > 0.05) out.push({ j, ch: "pack", kwh: a.pack, price: p.pricePack * p.packEff, buyer: "Pack swaps" });
  }
  return out;
}

// Normalised clear-sky shape from 06:00 to 18:00, one value per hour start
const HOURS = Array.from({ length: 13 }, (_, i) => 6 + i);
const SHAPE = (() => {
  const w = HOURS.map(h => Math.max(0, Math.sin(Math.PI * (h + 0.5 - 6) / 12)));
  const s = w.reduce((a, b) => a + b, 0);
  return w.map(x => x / s);
})();

/**
 * Hour-by-hour view of one pump's day, as its meter-relay would log it.
 * The relay serves irrigation first (morning), then the channels in dispatch order.
 */
export function hourly(sim, d, j) {
  const genH = SHAPE.map(f => f * sim.gen[d][j]);
  const a = sim.alloc[d].a[j];
  const queue = [["irr", sim.irrBd[d][j]], ["chill", a.chill], ["paani", a.paani], ["gaadi", a.gaadi], ["pack", a.pack]];
  const rows = HOURS.map((h, i) => ({ h, gen: genH[i], irr: 0, chill: 0, paani: 0, gaadi: 0, pack: 0, unused: 0 }));
  let qi = 0, rem = queue[0][1];
  for (const row of rows) {
    let cap = row.gen;
    while (cap > 1e-9 && qi < queue.length) {
      if (rem <= 1e-9) { qi++; if (qi < queue.length) rem = queue[qi][1]; continue; }
      const t = Math.min(cap, rem);
      row[queue[qi][0]] += t; cap -= t; rem -= t;
    }
    row.unused = Math.max(0, cap);
  }
  return rows.map(r => {
    const uses = [["irr", r.irr], ["chill", r.chill], ["paani", r.paani], ["gaadi", r.gaadi], ["pack", r.pack], ["unused", r.unused]];
    const top = uses.reduce((b, x) => (x[1] > b[1] ? x : b), ["unused", -1])[0];
    return { ...r, relay: r.gen < 0.02 ? "off" : top };
  });
}
