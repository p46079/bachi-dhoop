// Bachi Dhoop prototype: one engine, six screens (pump owner, daily dispatch, Dhoop Mitra,
// meter-relay, dairy society, cooperative books). State is kept in the browser only.
import { BASE, MONTHS, MONTHS_LONG, CHANNELS, simulate, summarise, earned, dayBills, hourly, dateOf, dayLabel, pumpId } from "./engine.js";
import { LANGS, SCRIPT, fill } from "./i18n.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const fmt = x => Math.round(x).toLocaleString("en-IN");
const fmt1 = x => (Math.round(x * 10) / 10).toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const inr = x => "₹" + fmt(x);
const ROLE = { hub: "Dairy hub", paani: "Paani Seva", field: "Field" };
const CH = {
  irr: { name: "Owner's irrigation", short: "Irrigation", c: "--c-irr" },
  chill: { name: "Dhoop Line (dairy chiller)", short: "Dhoop Line", c: "--c-chill" },
  paani: { name: "Paani Seva (neighbour's field)", short: "Paani Seva", c: "--c-paani" },
  gaadi: { name: "Dhoop Gaadi (machines)", short: "Dhoop Gaadi", c: "--c-gaadi" },
  pack: { name: "Dhoop Packs (batteries)", short: "Packs", c: "--c-pack" },
  unused: { name: "Unused", short: "Unused", c: "--c-unused" },
};
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

// ---------- state ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem("bd2-" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("bd2-" + k, JSON.stringify(v)); } catch (e) { /* storage blocked: keep in memory */ } },
};
const DEF = { pack: 12, save: 10, dg: 30, milk: 100, diesel: 98, owner: 4.5, chill: 7, paani: 12, gaadi: 22, ppack: 20, phase: 2 };
const S = {
  day: store.get("day", 14), pump: store.get("pump", 4), lang: store.get("lang", "hi"),
  st: { ...DEF, ...store.get("st", {}) }, ov: store.get("ov", {}), mitra: store.get("mitra", {}), dairy: store.get("dairy", {}),
  hour: 10,
};
let P, sim, sum;
function params() {
  const st = S.st;
  return { ...BASE, packCount: st.phase === 1 ? 0 : st.pack, irrigSaving: st.save / 100, dgShare: st.dg / 100, milkScale: st.milk / 100,
    diesel: st.diesel, ownerPay: st.owner, priceChill: st.chill, pricePaani: st.paani, priceGaadi: st.gaadi, pricePack: st.ppack };
}
function recompute() { P = params(); sim = simulate(P, 7, S.ov); sum = summarise(P, sim); }
function save() { ["day", "pump", "lang", "st", "ov", "mitra", "dairy"].forEach(k => store.set(k, S[k])); }

// ---------- shared pieces ----------
const legend = keys => `<div class="legend">${keys.map(k => `<span><i style="background:var(${CH[k].c});${k === "unused" ? "border:1px solid var(--line)" : ""}"></i>${CH[k].short}</span>`).join("")}</div>`;
const kpi = (label, big, sub, extra = "", hero = false) => `<div class="kpi${hero ? " hero-k" : ""}"><div class="eyebrow">${label}</div><div class="big">${big}</div>${extra}<div class="sub">${sub}</div></div>`;
function kpiRow() {
  const s = sum;
  return `<div class="kpis">
    ${kpi("Sun put to work", `${Math.round(100 * s.utilBd)}% <small>from ${Math.round(100 * s.utilBase)}%</small>`, `${fmt(s.sec)} kWh a year sold beyond irrigation`,
      `<div class="meter" aria-hidden="true"><i style="width:${100 * s.utilBd}%"></i><b style="left:${100 * s.utilBase}%"></b></div>`, true)}
    ${kpi("Diesel displaced", `${fmt(s.diesel)} L`, `${fmt(s.diesel / s.ha)} L per hectare · ${inr(s.diesel * P.diesel)} of fuel`)}
    ${kpi("Paid to a 5 HP owner", inr(s.bySize[5].income), `a year · controller pays back in ${s.bySize[5].payback.toFixed(1)} years`)}
    ${kpi("Dairy chilling from sun", `${Math.round(100 * s.chillCover)}%`, `society saves ${inr(s.dairySaving)} a year`)}
    ${kpi("Groundwater saved", `${fmt(s.water)} m³`, `${fmt(s.water / s.ha)} m³ per hectare · CO₂ ${s.co2.toFixed(1)} t less`)}
    ${kpi("Cooperative surplus", inr(s.net), isFinite(s.payback) ? `assets pay back in ${s.payback.toFixed(1)} yrs (${s.paybackGrant.toFixed(1)} with a 50% grant)` : "does not cover its costs at these prices")}
  </div>`;
}
function stackBar(parts, total) {
  return `<div class="bar" role="img" aria-label="${parts.filter(p => p[1] > 0.05).map(p => `${CH[p[0]].short} ${fmt1(p[1])} kWh`).join(", ")}">` +
    parts.map(([k, v]) => v > 0.05 ? `<i style="width:${100 * v / total}%;background:var(${CH[k].c})"></i>` : "").join("") + `</div>`;
}
function monthChart() {
  const M = sum.monthly;
  const W = 720, H = 300, L = 54, T = 26, PH = 230, PW = W - L - 8;
  const vmax = Math.ceil(Math.max(...M.map(x => x.gen)) / 3000) * 3000;
  const Y = v => T + PH - v / vmax * PH, band = PW / 12, bw = band * 0.56, X = i => L + i * band + (band - bw) / 2;
  let g = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Monthly solar generation of the cluster and how it is used">`;
  for (let t = 0; t <= vmax; t += 3000) g += `<line x1="${L}" x2="${W - 8}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--line)"/><text x="${L - 8}" y="${Y(t) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${fmt(t)}</text>`;
  g += `<text x="${L - 8}" y="${T - 12}" text-anchor="end" font-size="11" fill="var(--muted)">kWh</text>`;
  M.forEach((mo, i) => {
    g += `<rect x="${X(i) - 3}" y="${Y(mo.gen)}" width="${bw + 6}" height="${Y(0) - Y(mo.gen)}" fill="none" stroke="var(--muted)" stroke-dasharray="3 2"><title>${MONTHS[i]}: ${fmt(mo.gen)} kWh generated</title></rect>`;
    let acc = 0;
    ["irr", "chill", "paani", "gaadi", "pack"].forEach(k => { const v = mo[k]; g += `<rect x="${X(i)}" y="${Y(acc + v)}" width="${bw}" height="${Math.max(0, Y(acc) - Y(acc + v))}" fill="var(${CH[k].c})"><title>${MONTHS[i]}, ${CH[k].short}: ${fmt(v)} kWh</title></rect>`; acc += v; });
    g += `<line x1="${X(i) - 6}" x2="${X(i) + bw + 6}" y1="${Y(mo.base)}" y2="${Y(mo.base)}" stroke="var(--ink)" stroke-width="2"><title>${MONTHS[i]}: ${fmt(mo.base)} kWh used for irrigation today</title></line>`;
    g += `<text x="${X(i) + bw / 2}" y="${T + PH + 17}" text-anchor="middle" font-size="11.5" fill="var(--muted)">${MONTHS[i]}</text>`;
  });
  g += `<line x1="${L}" x2="${W - 8}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--muted)"/></svg>`;
  return `<div class="chart">${g}</div><p class="muted" style="font-size:12.5px;margin-top:6px">Dashed outline: solar generated. Dark tick: what the pumps use today (irrigation only). Colours: what Bachi Dhoop puts to work. The gap above the colours is sun still unused.</p>`;
}
const monthToDate = (j, d) => { const { m } = dateOf(d); let t = 0; for (let k = 0; k <= d; k++) if (dateOf(k).m === m) t += earned(P, sim, k, j); return t; };
const weekToDate = (j, d) => { let t = 0; for (let k = Math.max(0, d - 6); k <= d; k++) t += earned(P, sim, k, j); return t; };

// ---------- views ----------
function vOverview() {
  return `
  <section class="panel hero">
    <div>
      <div class="eyebrow">Working prototype · PM-KUSUM off-grid solar pumps</div>
      <h1 style="margin-top:6px">Bachi Dhoop</h1>
      <div class="tagline">Leftover sunshine, put to work.</div>
      <p class="lead">India has 11.49 lakh off-grid solar pumps, used for irrigation about 150 days a year. Bachi Dhoop lets a village cooperative sell each pump's leftover sun to buyers in the same village who use diesel today, with the owner's own irrigation always served first.</p>
      <div class="row" style="margin-top:14px"><a class="btn pri" href="#/owner" style="text-decoration:none">Start the walkthrough</a><a class="btn" href="#/books" style="text-decoration:none">See the numbers</a></div>
    </div>
    <div class="stack">${monthChart()}</div>
  </section>
  ${kpiRow()}
  <section class="stack">
    <h2>One day in the cluster, screen by screen</h2>
    <div class="journey">
      <a class="jcard" href="#/owner"><span class="t">6:00 AM · PUMP OWNER</span><h3>A voice call asks one question</h3><p>"Will you irrigate today?" He presses 1 or 2 on any phone, in Hindi, Gujarati, Marathi or English. His answer re-plans the day.</p></a>
      <a class="jcard" href="#/dispatch"><span class="t">6:15 AM · PLATFORM</span><h3>All 15 pumps are dispatched</h3><p>Water first, then the dairy chiller, neighbours' fields, the machine trolley and battery packs, with fair shares across owners.</p></a>
      <a class="jcard" href="#/mitra"><span class="t">8:00 AM · DHOOP MITRA</span><h3>The operator runs the route</h3><p>A local woman operator reads each meter, bills the buyer, and collects by UPI or cash. She keeps 15%.</p></a>
      <a class="jcard" href="#/meter"><span class="t">ALL DAY · METER-RELAY</span><h3>Every kWh switched and logged</h3><p>A ₹5,000 meter-relay on each pump enforces water first locally and sends hourly readings over 2G or SMS.</p></a>
      <a class="jcard" href="#/dairy"><span class="t">5:30 AM &amp; 7 PM · DAIRY</span><h3>The society gets updates on WhatsApp</h3><p>Ice-bank charge, any genset backup needed tonight, and the day's bill against what diesel would have cost.</p></a>
      <a class="jcard" href="#/books"><span class="t">WEEKLY · COOPERATIVE</span><h3>Books, payouts and impact</h3><p>Revenue by channel, owner payouts, paybacks, diesel, CO₂ and water saved. Every assumption can be changed.</p></a>
    </div>
  </section>
  <p class="note">This prototype runs on a simulation, not field data: one 15-pump cluster on 24 ha, modelled day by day from solar yield, the crop calendar and published prices. Change the day above to see any date of the year. Field validation is the next step.</p>`;
}

function vOwner() {
  const j = S.pump, d = S.day, id = pumpId(j), pu = P.pumps[j];
  const key = d + ":" + j;
  const answered = key in S.ov ? S.ov[key] : null;
  const irrig = sim.irrigFlag[d][j];
  const T = SCRIPT[S.lang], E = SCRIPT.en;
  const e = earned(P, sim, d, j), mtd = monthToDate(j, d), w = weekToDate(j, d);
  const v = { id, e: fmt(e), m: fmt(mtd), w: fmt(w) };
  const eveKey = e < 0.5 ? "eveNone" : irrig ? "eveIrr" : "eveSold";
  // both answers, side by side
  const scen = [true, false].map(ans => {
    const s2 = simulate(P, 7, { ...S.ov, [key]: ans });
    const a = s2.alloc[d].a[j];
    return { ans, irr: s2.irrBd[d][j], a, earn: earned(P, s2, d, j), gen: s2.gen[d][j], left: s2.alloc[d].left[j] };
  });
  const row = (label, f) => `<tr><td>${label}</td>${scen.map(x => `<td class="r">${f(x)}</td>`).join("")}</tr>`;
  const cur = answered === null ? (irrig ? 0 : 1) : answered ? 0 : 1;
  const last7 = [];
  for (let k = Math.max(0, d - 6); k <= d; k++) last7.push([k, earned(P, sim, k, j)]);
  const mx = Math.max(1, ...last7.map(x => x[1]));
  const bars = `<svg viewBox="0 0 300 124" role="img" aria-label="Earnings over the last 7 days">${last7.map(([k, x], i) => {
    const h = 80 * x / mx, xx = 12 + i * 41;
    return `<rect x="${xx}" y="${96 - h}" width="28" height="${h}" rx="3" fill="${k === d ? "var(--sun-b)" : "var(--green)"}"/><text x="${xx + 14}" y="${91 - h}" text-anchor="middle" font-size="11" fill="var(--ink)">${fmt(x)}</text><text x="${xx + 14}" y="108" text-anchor="middle" font-size="10.5" fill="var(--muted)">${dateOf(k).dd} ${MONTHS[dateOf(k).m]}</text>`;
  }).join("")}</svg>`;
  return `
  <section class="split">
    <div class="stack">
      <div class="row"><label for="pumpsel" class="muted">Pump</label>${pumpSelect()}<span class="muted" style="font-size:13px">${ROLE[pu.role]} · ${pu.hp} HP · ${pu.kwp} kWp</span></div>
      <div class="langs" role="group" aria-label="Call language">${LANGS.map(l => `<button type="button" data-lang="${l.code}" aria-pressed="${S.lang === l.code}">${l.name}</button>`).join("")}</div>
      <div class="phonewrap"><div class="phone"><div class="screen">
        <div class="status"><span>06:00</span><span>2G ▂▄▆</span></div>
        <div class="apphead"><b>Incoming call · Bachi Dhoop</b><span>Works on any phone, no smartphone needed</span></div>
        <div class="scr">
          <div class="callcard">
            <div class="who">6:00 am · Morning call</div>
            <div class="say" lang="${S.lang}">${fill(T.ask, v)}</div>
            ${S.lang !== "en" ? `<div class="gloss">${fill(E.ask, v)}</div>` : ""}
            <button class="play" type="button" data-say="ask">▶ Play call</button>
          </div>
          <div class="keypad" role="group" aria-label="Answer the call">
            <button type="button" class="y" data-ans="1" aria-pressed="${answered === true}">1 · Yes, I will irrigate</button>
            <button type="button" data-ans="2" aria-pressed="${answered === false}">2 · No, sell my sun</button>
          </div>
          ${answered !== null ? `<div class="callcard"><div class="who">Confirmation</div><div class="say" lang="${S.lang}">${answered ? T.yes : T.no}</div>${S.lang !== "en" ? `<div class="gloss">${answered ? E.yes : E.no}</div>` : ""}</div>`
            : `<p style="font-size:12.5px;color:#57655c">Not answered yet. The platform assumes the crop calendar: <b>${irrig ? "irrigating" : "not irrigating"}</b>.</p>`}
          <div class="callcard" style="background:#2f4f3a">
            <div class="who">7:00 pm · Evening call</div>
            <div class="say" lang="${S.lang}">${fill(T[eveKey], v)}</div>
            ${S.lang !== "en" ? `<div class="gloss">${fill(E[eveKey], v)}</div>` : ""}
            <button class="play" type="button" data-say="${eveKey}">▶ Play call</button>
          </div>
          <div class="sms"><span class="meta">SMS · Sunday</span><span lang="${S.lang}">${fill(T.week, v)}</span></div>
        </div>
      </div></div></div>
    </div>
    <div class="stack">
      <div class="panel stack">
        <h2>What his answer changes, ${dayLabel(d)}</h2>
        <p class="muted">Press 1 or 2 on the phone. The whole cluster is re-dispatched, and his own field is always served before anything is sold.</p>
        <div class="tablewrap"><table>
          <thead><tr><th>Pump ${id} today</th><th class="r" ${cur === 0 ? 'style="color:var(--green)"' : ""}>He presses 1</th><th class="r" ${cur === 1 ? 'style="color:var(--green)"' : ""}>He presses 2</th></tr></thead>
          <tbody>
            ${row("Sun generated", x => fmt1(x.gen) + " kWh")}
            ${row("To his own irrigation", x => fmt1(x.irr) + " kWh")}
            ${CHANNELS.map(c => row("Sold: " + CH[c].short, x => fmt1(x.a[c]) + " kWh")).join("")}
            ${row("Still unused", x => fmt1(x.left) + " kWh")}
            <tr class="total"><td>He earns today</td>${scen.map(x => `<td class="r">${inr(x.earn)}</td>`).join("")}</tr>
          </tbody></table></div>
        <p class="muted" style="font-size:13px">Owners earn ₹${P.ownerPay} for every kWh sold, plus ${Math.round(100 * P.ownerPaaniShare)}% of Paani Seva water sales. Currently shown: <b>${answered === null ? "no answer yet (crop calendar)" : answered ? "he pressed 1" : "he pressed 2"}</b>.</p>
        ${answered !== null ? `<button class="btn" type="button" id="clearans">Clear his answer</button>` : ""}
      </div>
      <div class="grid2">
        <div class="panel stack"><h3>Last 7 days</h3><div class="chart">${bars}</div><p class="muted" style="font-size:13px">This week ${inr(w)} · this month ${inr(mtd)}</p></div>
        <div class="panel stack"><h3>His year</h3>
          <p style="font-size:28px;font-family:var(--f-display);font-weight:700">${inr(sum.ownerPay[j])}</p>
          <p class="muted" style="font-size:13.5px">earned from sun he did not need, about ${inr(sum.ownerPay[j] / 12)} a month. A ${pu.hp} HP owner's ${pu.hp === 3 ? "pack charger (₹10,000)" : "multi-use controller (₹35,000)"} pays back in ${sum.bySize[pu.hp].payback.toFixed(1)} years${pu.hp === 3 ? "" : `, ${sum.bySize[pu.hp].paybackCfa.toFixed(1)} after the 30% PM-KUSUM subsidy`}.</p>
        </div>
      </div>
    </div>
  </section>`;
}
function pumpSelect() {
  return `<select class="sel" id="pumpsel">${P.pumps.map((p, j) => `<option value="${j}" ${j === S.pump ? "selected" : ""}>${pumpId(j)} · ${ROLE[p.role]} · ${p.hp} HP</option>`).join("")}</select>`;
}

function vDispatch() {
  const d = S.day, al = sim.alloc[d], g = sim.gen[d], ir = sim.irrBd[d];
  let G = 0, I = 0, Sd = 0;
  const tiles = P.pumps.map((pu, j) => {
    const a = al.a[j];
    const parts = [["irr", ir[j]], ["chill", a.chill], ["paani", a.paani], ["gaadi", a.gaadi], ["pack", a.pack]];
    const used = parts.reduce((s, x) => s + x[1], 0);
    G += g[j]; I += ir[j]; Sd += used - ir[j];
    const tags = [];
    if (ir[j] > 0) tags.push(`<span class="tag w">Irrigating</span>`);
    if (`${d}:${j}` in S.ov) tags.push(`<span class="tag">Owner answered</span>`);
    if (al.gaadiAt === j) tags.push(`<span class="tag g">Gaadi here</span>`);
    return `<button type="button" class="pump" data-j="${j}" aria-pressed="${j === S.pump}">
      <div class="r1"><span class="id">${pumpId(j)}</span><span class="role">${ROLE[pu.role]} · ${pu.hp} HP</span></div>
      ${stackBar(parts, g[j])}
      <div class="r3"><span class="num">${fmt1(g[j])} kWh</span><span class="num">${inr(earned(P, sim, d, j))}</span></div>
      <div class="tags">${tags.join("")}</div></button>`;
  }).join("");
  const nIrr = ir.filter(x => x > 0).length;
  const chill = al.a.reduce((s, a) => s + a.chill, 0), paani = al.a.reduce((s, a) => s + a.paani, 0);
  const pack = al.a.reduce((s, a) => s + a.pack, 0);
  const paaniPumps = al.a.map((a, j) => [j, a.paani]).filter(x => x[1] > 0.05).map(x => pumpId(x[0]));
  const packPumps = al.a.map((a, j) => [j, a.pack]).filter(x => x[1] > 0.05).map(x => pumpId(x[0]));
  const j = S.pump, a = al.a[j];
  return `
  <section class="panel stack">
    <div class="row" style="justify-content:space-between"><h2>Dispatch for ${dayLabel(d)}</h2><span class="muted num" style="font-size:13px">${fmt(G)} kWh generated · ${fmt(I)} to irrigation · ${fmt(Sd)} sold · ${fmt(G - I - Sd)} unused</span></div>
    ${legend(["irr", "chill", "paani", "gaadi", "pack", "unused"])}
    <div class="pumps">${tiles}</div>
  </section>
  <section class="grid2">
    <div class="panel stack">
      <h2>How today was planned</h2>
      <ol class="rules">
        <li><b>Water first.</b> ${nIrr} of 15 owners irrigate today; ${fmt1(I)} kWh is reserved for their fields before anything is sold.</li>
        <li><b>Dhoop Line.</b> Hub pumps P01–P03 send ${fmt1(chill)} of ${fmt1(al.chillNeed)} kWh the dairy's ice bank needs (${Math.round(100 * chill / al.chillNeed)}%).</li>
        <li><b>Paani Seva.</b> ${paaniPumps.length ? `${paaniPumps.join(", ")} water neighbours' fields: ${fmt1(paani)} kWh of pumping that would have run on diesel.` : "No neighbour needs water today."}</li>
        <li><b>Dhoop Gaadi.</b> ${al.gaadiAt >= 0 ? `The machine trolley goes to ${pumpId(al.gaadiAt)}, the eligible pump that has sold least so far (fair share): ${fmt1(al.a[al.gaadiAt].gaadi)} kWh of chaff cutting and grinding.` : "The trolley rests today."}</li>
        <li><b>Dhoop Packs.</b> ${P.packCount ? (packPumps.length ? `Packs charge at ${packPumps.join(", ")}: ${fmt1(pack)} kWh, about ${Math.round(pack * P.packEff / P.packDelivered)} swaps for homes and shops.` : "No spare sun for packs today.") : "No packs in Phase 1."}</li>
      </ol>
      <p class="muted" style="font-size:13px">Fair share: every sale after the dairy goes first to the pump that has sold the smallest share of its own generation so far this year, so income spreads across owners instead of pooling at the biggest pumps.</p>
    </div>
    <div class="panel stack">
      <div class="row" style="justify-content:space-between"><h2>${pumpId(j)} today</h2><span class="muted">${ROLE[P.pumps[j].role]} · ${P.pumps[j].hp} HP</span></div>
      <table><tbody>
        <tr><td>Sun generated</td><td class="r">${fmt1(g[j])} kWh</td></tr>
        <tr><td>To owner's irrigation</td><td class="r">${fmt1(ir[j])} kWh</td></tr>
        ${CHANNELS.map(c => `<tr><td>${CH[c].name}</td><td class="r">${fmt1(a[c])} kWh</td></tr>`).join("")}
        <tr class="total"><td>Owner earns</td><td class="r">${inr(earned(P, sim, d, j))}</td></tr>
      </tbody></table>
      <div class="row"><a class="btn" href="#/owner" style="text-decoration:none">Owner's calls</a><a class="btn" href="#/meter" style="text-decoration:none">Meter-relay log</a></div>
    </div>
  </section>`;
}

const CHIP = { chill: "--c-chill", paani: "--c-paani", gaadi: "--c-gaadi", pack: "--c-pack" };
function mitraStops() {
  const order = { chill: 0, gaadi: 1, paani: 2, pack: 3 };
  return dayBills(P, sim, S.day).sort((x, y) => order[x.ch] - order[y.ch] || x.j - y.j).map(b => ({ ...b, key: `${b.ch}-${b.j}` }));
}
function vMitra() {
  const d = S.day, stops = mitraStops(), rec = S.mitra[d] || {};
  let exp = 0, got = 0, done = 0;
  stops.forEach(s => { exp += s.kwh * s.price; const r = rec[s.key]; if (r && r.mode) { got += r.kwh * s.price; done++; } });
  const stopHtml = stops.map(s => {
    const r = rec[s.key] || {}, kwh = r.kwh ?? Math.round(s.kwh * 10) / 10;
    const modes = s.ch === "chill" ? [["bill", "Monthly bill"]] : [["upi", "UPI"], ["cash", "Cash"]];
    return `<div class="stop${r.mode ? " done" : ""}" data-key="${s.key}">
      <div class="h"><b>${pumpId(s.j)} · ${s.buyer}</b><span class="chip" style="background:var(${CHIP[s.ch]})">${CH[s.ch].short}</span></div>
      <div class="line"><label>Meter reading <input type="number" step="0.1" min="0" inputmode="decimal" value="${kwh}" data-k="${s.key}" aria-label="kWh read at ${pumpId(s.j)}"> kWh</label><span class="amt">× ₹${fmt1(s.price)} = ${inr(kwh * s.price)}</span></div>
      <div class="pay">${modes.map(([m, l]) => `<button type="button" data-pay="${s.key}" data-mode="${m}" aria-pressed="${r.mode === m}">${l}</button>`).join("")}</div>
    </div>`;
  }).join("");
  const rows = stops.map(s => { const r = rec[s.key]; const k = r?.kwh ?? s.kwh; return `<tr><td>${pumpId(s.j)}</td><td>${s.buyer}</td><td class="r">${fmt1(k)}</td><td class="r">${inr(k * s.price)}</td><td>${r?.mode ? `<span class="pill paid">${r.mode === "bill" ? "Billed" : r.mode.toUpperCase()}</span>` : `<span class="pill due">Due</span>`}</td></tr>`; }).join("");
  return `
  <section class="split">
    <div class="phonewrap"><div class="phone"><div class="screen">
      <div class="status"><span>08:00</span><span>offline-first ▂▄</span></div>
      <div class="apphead"><b>Dhoop Mitra · Today's route</b><span>${dayLabel(d)} · ${done} of ${stops.length} stops done</span></div>
      <div class="scr scroll">${stopHtml || `<p style="font-size:13px">No sales today: all sun went to irrigation.</p>`}</div>
    </div></div></div>
    <div class="stack">
      <div class="kpis">
        ${kpi("Collected today", inr(got), `of ${inr(exp)} due across ${stops.length} stops`, "", true)}
        ${kpi("Her commission", inr(got * P.commission), `15% of what she collects · about ${inr(sum.opex.commission / 12)} a month`)}
        ${kpi("Stops done", `${done} / ${stops.length}`, "readings sync when the phone finds signal")}
      </div>
      <div class="panel stack">
        <h2>Today's ledger</h2>
        <p class="muted">Each line is one meter read at one pump. Type the reading the meter shows, then mark how the buyer paid. The dairy's chilling goes on its monthly bill.</p>
        <div class="tablewrap"><table><thead><tr><th>Pump</th><th>Buyer</th><th class="r">kWh</th><th class="r">Amount</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>
        <div class="row"><button class="btn" type="button" id="mitrareset">Reset today's route</button></div>
      </div>
    </div>
  </section>`;
}

const RELAY = { irr: "Owner's pump", chill: "Dhoop Line", paani: "Paani Seva", gaadi: "Gaadi socket", pack: "Pack charger", unused: "Idle (no buyer)", off: "Night · off" };
function vMeter() {
  const d = S.day, j = S.pump, H = hourly(sim, d, j);
  const hi = Math.min(12, Math.max(0, S.hour - 6)), h = H[hi];
  const cum = H.slice(0, hi + 1).reduce((t, r) => t + r.gen, 0);
  const cumIrr = H.slice(0, hi + 1).reduce((t, r) => t + r.irr, 0);
  const cumSold = H.slice(0, hi + 1).reduce((t, r) => t + r.chill + r.paani + r.gaadi + r.pack, 0);
  const mode = h.relay, col = mode === "off" ? "#38433c" : mode === "unused" ? "#6b766f" : css(CH[mode].c);
  const W = 1000, Hh = 230, L = 44, T = 14, PH = 180, bw = (W - L - 8) / 13;
  const mx = Math.max(...H.map(r => r.gen), 0.5);
  const Y = v => T + PH - v / mx * PH;
  let svg = `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Hour by hour energy at ${pumpId(j)}">`;
  [0, mx / 2, mx].forEach(t => svg += `<line x1="${L}" x2="${W - 8}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--line)"/><text x="${L - 6}" y="${Y(t) + 4}" text-anchor="end" font-size="10.5" fill="var(--muted)">${fmt1(t)}</text>`);
  H.forEach((r, i) => {
    let acc = 0; const x = L + i * bw + 4;
    ["irr", "chill", "paani", "gaadi", "pack", "unused"].forEach(k => { const v = r[k]; if (v > 0.001) { svg += `<rect x="${x}" y="${Y(acc + v)}" width="${bw - 8}" height="${Y(acc) - Y(acc + v)}" fill="var(${CH[k].c})" ${k === "unused" ? 'stroke="var(--line)"' : ""}><title>${r.h}:00, ${CH[k].short}: ${fmt1(v)} kWh</title></rect>`; acc += v; } });
    if (i === hi) svg += `<rect x="${x - 3}" y="${T - 4}" width="${bw - 2}" height="${PH + 8}" fill="none" stroke="var(--sun-b)" stroke-width="2" rx="4"/>`;
    svg += `<text x="${x + (bw - 8) / 2}" y="${T + PH + 16}" text-anchor="middle" font-size="10.5" fill="var(--muted)">${r.h}</text>`;
  });
  svg += `<text x="${L - 6}" y="${T + PH + 16}" text-anchor="end" font-size="10.5" fill="var(--muted)">kWh</text></svg>`;
  const packet = JSON.stringify({ dev: `BD-${pumpId(j)}`, ts: `${dateOf(d).dd} ${MONTHS[dateOf(d).m]} ${String(h.h).padStart(2, "0")}:59`, kwh_h: +h.gen.toFixed(2),
    irr: +h.irr.toFixed(2), sold: { line: +h.chill.toFixed(2), paani: +h.paani.toFixed(2), gaadi: +h.gaadi.toFixed(2), pack: +h.pack.toFixed(2) },
    relay: mode, owner_ack: `${d}:${j}` in S.ov ? (S.ov[`${d}:${j}`] ? 1 : 2) : null, net: h.h === 13 ? "2G down, buffered" : "2G" }, null, 1);
  return `
  <section class="panel stack">
    <div class="row" style="justify-content:space-between"><h2>Meter-relay on ${pumpId(j)}, ${dayLabel(d)}</h2><div class="row">${pumpSelect()}<button class="btn pri" type="button" id="playday">▶ Play the day</button></div></div>
    <p class="muted">Every pump gets one ₹5,000 box: an energy meter, a two-way relay (owner's pump or the sale socket) and a 2G/SMS modem. It switches loads by the day's plan and logs every kWh. Water first is enforced inside the box, so it holds even when the network is down.</p>
    <div class="mode" style="background:${col}"><span>${String(h.h).padStart(2, "0")}:00 · Relay → ${RELAY[mode]}</span><span class="num" style="font-size:15px">${fmt1(h.gen)} kW avg</span></div>
    <div class="relay">
      <div class="lcd"><span class="k">Energy today</span><span class="v">${fmt1(cum)} kWh</span></div>
      <div class="lcd"><span class="k">To owner's field</span><span class="v">${fmt1(cumIrr)} kWh</span></div>
      <div class="lcd"><span class="k">Sold so far</span><span class="v">${fmt1(cumSold)} kWh</span></div>
    </div>
    <label class="ctl"><span class="muted" style="font-size:13px">Hour of the day: <b class="num">${String(h.h).padStart(2, "0")}:00</b></span><input type="range" id="hour" min="6" max="18" value="${h.h}"></label>
    <div class="chart">${svg}</div>
    ${legend(["irr", "chill", "paani", "gaadi", "pack", "unused"])}
  </section>
  <section class="grid2">
    <div class="panel stack"><h3>Packet sent at ${String(h.h).padStart(2, "0")}:59</h3><div class="packet">${packet}</div><p class="muted" style="font-size:12.5px">About 200 bytes an hour fits in one SMS. If 2G drops (13:00 in this demo), readings are buffered and sent later; settlement never depends on live signal.</p></div>
    <div class="panel stack"><h3>The box's rules</h3><ol class="rules">
      <li><b>Owner's answer wins.</b> If he pressed 1, the relay stays on his pump until his day's water is delivered.</li>
      <li><b>Sell only surplus.</b> The sale socket opens only after irrigation, in the order the platform sent overnight.</li>
      <li><b>Fail safe.</b> No plan received? The box defaults to the owner's pump, exactly as the farm works today.</li>
      <li><b>Every kWh signed.</b> Hourly readings carry the device ID and are reconciled with the Dhoop Mitra's bills.</li>
    </ol><p class="muted" style="font-size:12.5px">In this prototype the readings come from the model. Building the physical box (meter + relay + modem) is the next step.</p></div>
  </section>`;
}

function dairyDay(d) {
  const al = sim.alloc[d], { m } = dateOf(d);
  const got = al.a.reduce((s, a) => s + a.chill, 0), need = al.chillNeed, milk = P.milk[m] * P.milkScale;
  const gap = Math.max(0, need - got);
  return { got, need, milk, gap, pct: Math.round(100 * got / need), bill: got * P.priceChill, save: got * (sum.chillBaseCost - P.priceChill) };
}
function vDairy() {
  const d = S.day, x = dairyDay(d), { m } = dateOf(d);
  let mtdSave = 0, mtdKwh = 0, mtdNeed = 0, days = 0;
  for (let k = 0; k <= d; k++) if (dateOf(k).m === m) { const y = dairyDay(k); mtdSave += y.save; mtdKwh += y.got; mtdNeed += y.need; days++; }
  const extra = (S.dairy[d] || []).map(t => `<div class="msg ${t.me ? "me" : ""}">${t.text}<time>${t.t}</time></div>`).join("");
  const months = MONTHS.map((_, i) => { let g = 0, n = 0; for (let k = 0; k < sim.D; k++) if (dateOf(k).m === i) { const y = sim.alloc[k]; g += y.a.reduce((s, a) => s + a.chill, 0); n += y.chillNeed; } return Math.min(1, g / n); });
  const bars = `<svg viewBox="0 0 720 200" role="img" aria-label="Share of chilling energy from solar, by month">${months.map((v, i) => `<rect x="${30 + i * 57}" y="${160 - 130 * v}" width="40" height="${130 * v}" rx="4" fill="${i === m ? "var(--sun-b)" : "var(--c-chill)"}"><title>${MONTHS[i]}: ${Math.round(100 * v)}%</title></rect><text x="${50 + i * 57}" y="${152 - 130 * v}" text-anchor="middle" font-size="12" fill="var(--ink)">${Math.round(100 * v)}%</text><text x="${50 + i * 57}" y="182" text-anchor="middle" font-size="12.5" fill="var(--muted)">${MONTHS[i]}</text>`).join("")}</svg>`;
  return `
  <section class="split">
    <div class="phonewrap wa"><div class="phone"><div class="screen">
      <div class="status"><span>19:00</span><span>4G ▂▄▆█</span></div>
      <div class="apphead"><b>Bachi Dhoop · Dairy</b><span>Secretary, village milk society</span></div>
      <div class="scr">
        <div class="msg">🌞 <b>${dayLabel(d)}</b><br>Milk expected: ${fmt(x.milk)} L. Ice bank needs ${fmt1(x.need)} kWh. Solar booked from P01–P03: ${fmt1(x.got)} kWh (${x.pct}%).<time>05:30</time></div>
        <div class="msg">${x.gap < 0.5 ? "Ice bank fully charged on sunshine. No genset needed tonight." : `Ice bank ${x.pct}% charged. Keep grid or genset ready for about ${fmt1(x.gap)} kWh tonight.`}<time>13:00</time></div>
        <div class="msg">Today's bill: ${fmt1(x.got)} kWh × ₹${P.priceChill} = <b>${inr(x.bill)}</b>. Saved against your usual grid + genset mix: <b>${inr(x.save)}</b>. Saved this month: ${inr(mtdSave)}.<time>19:00</time></div>
        ${extra}
        <div class="quick" role="group" aria-label="Quick replies">
          <button type="button" data-q="book">Book extra chilling tomorrow</button>
          <button type="button" data-q="fault">Report chiller problem</button>
          <button type="button" data-q="stmt">Send this month's statement</button>
        </div>
      </div>
    </div></div></div>
    <div class="stack">
      <div class="kpis">
        ${kpi("Solar share today", `${x.pct}%`, `${fmt1(x.got)} of ${fmt1(x.need)} kWh`, "", true)}
        ${kpi("Saved this month", inr(mtdSave), `${days} days · ${Math.round(100 * mtdKwh / mtdNeed)}% of chilling on sunshine`)}
        ${kpi("Saved in a year", inr(sum.dairySaving), `solar ice bank (₹3 lakh extra) pays back in ${sum.dairyPayback.toFixed(1)} years`)}
      </div>
      <div class="panel stack"><h3>Share of chilling from sunshine, by month</h3><div class="chart">${bars}</div>
      <p class="muted" style="font-size:13px">The dairy is the anchor buyer: it needs chilling every day of the year. Today it pays ₹${P.priceChill} per kWh against about ₹${fmt1(sum.chillBaseCost)} for its grid and diesel genset mix.</p></div>
    </div>
  </section>`;
}

const CTL = [["pack", "Battery packs", 0, 24, 1, v => v + " packs"], ["save", "Irrigation saved once surplus is paid", 0, 20, 1, v => v + "%"],
  ["dg", "Dairy chilling on diesel today", 10, 60, 1, v => v + "%"], ["milk", "Milk volume", 50, 150, 5, v => fmt(10 * v) + " L/day"],
  ["diesel", "Diesel price", 80, 120, 1, v => "₹" + v + "/L"], ["owner", "Paid to owner per kWh", 3, 6, 0.5, v => "₹" + v],
  ["chill", "Dhoop Line price", 5, 9, 0.5, v => "₹" + v + "/kWh"], ["paani", "Paani Seva price", 8, 16, 1, v => "₹" + v + "/kWh-eq"],
  ["gaadi", "Dhoop Gaadi price", 14, 28, 1, v => "₹" + v + "/kWh-eq"], ["ppack", "Pack energy price", 14, 28, 1, v => "₹" + v + "/kWh"]];
function vBooks() {
  const s = sum;
  const pb = x => isFinite(x) ? x.toFixed(1) + " yrs" : "never";
  const pill = x => `<span class="pill ${x <= 4 ? "ok" : "slow"}">${pb(x)}</span>`;
  const parties = [
    ["Pump owner, 5 HP", "Controller ₹35,000", s.bySize[5].income, s.bySize[5].payback],
    ["Pump owner, 7.5 HP", "Controller ₹35,000", s.bySize[7.5].income, s.bySize[7.5].payback],
    ["Pump owner, 3 HP", "Pack charger ₹10,000", s.bySize[3].income, s.bySize[3].payback],
    ["Dairy society", "Solar ice bank, ₹3 lakh extra", s.dairySaving, s.dairyPayback],
    ["Dhoop Mandali (co-op)", `Shared assets ${inr(s.mcap)}`, s.net, s.payback],
    ["Whole cluster", `All assets ${inr(s.totalCapex)}`, s.value, s.systemPayback],
  ];
  return `
  <section class="split">
    <div class="panel stack" style="position:sticky;top:120px">
      <div class="row" style="justify-content:space-between"><h2>Assumptions</h2><button class="btn" type="button" id="reset">Reset</button></div>
      <div class="seg" role="group" aria-label="Phase"><button type="button" data-phase="1" aria-pressed="${S.st.phase === 1}">Phase 1: no packs</button><button type="button" data-phase="2" aria-pressed="${S.st.phase === 2}">Full design</button></div>
      ${CTL.map(([k, l, mn, mx, stp, f]) => `<div class="ctl"><label for="s-${k}"><span>${l}</span><span class="num">${f(S.st[k])}</span></label><input type="range" id="s-${k}" data-k="${k}" min="${mn}" max="${mx}" step="${stp}" value="${S.st[k]}" ${k === "pack" && S.st.phase === 1 ? "disabled" : ""}></div>`).join("")}
      <small class="muted">Every screen updates. Sources: docs/data-sources.md in the repository.</small>
    </div>
    <div class="stack">
      ${kpiRow()}
      <div class="panel stack"><h2>${Math.round(100 * s.utilBd)}% of the cluster's sun does work, up from ${Math.round(100 * s.utilBase)}%</h2>${legend(["irr", "chill", "paani", "gaadi", "pack"])}${monthChart()}</div>
      <div class="grid2">
        <div class="panel stack"><h3>Cooperative's books, one year</h3><table><tbody>
          ${CHANNELS.map(c => `<tr><td>${CH[c].name}</td><td class="r">${inr(s.rev[c])}</td></tr>`).join("")}
          <tr class="total"><td>Village energy sales</td><td class="r">${inr(s.revenue)}</td></tr>
          <tr><td>Paid to pump owners</td><td class="r neg">−${inr(s.ownerTotal)}</td></tr>
          <tr><td>Dhoop Mitra commission (15%)</td><td class="r neg">−${inr(s.opex.commission)}</td></tr>
          ${s.opex.ecart ? `<tr><td>Pack e-cart</td><td class="r neg">−${inr(s.opex.ecart)}</td></tr>` : ""}
          <tr><td>Maintenance (3% of assets)</td><td class="r neg">−${inr(s.opex.maint)}</td></tr>
          <tr><td>Platform fee (₹1,000 per pump)</td><td class="r neg">−${inr(s.opex.fee)}</td></tr>
          <tr class="total"><td>Co-op surplus</td><td class="r">${s.net < 0 ? "−" : ""}${inr(Math.abs(s.net))}</td></tr>
        </tbody></table></div>
        <div class="panel stack"><h3>Impact, one cluster a year</h3><table><tbody>
          <tr><td>Diesel displaced</td><td class="r">${fmt(s.diesel)} L</td></tr>
          ${CHANNELS.map(c => `<tr><td class="muted">· via ${CH[c].short}</td><td class="r">${fmt(s.dieselBy[c])} L</td></tr>`).join("")}
          <tr><td>CO₂ avoided</td><td class="r">${s.co2.toFixed(1)} t</td></tr>
          <tr><td>Groundwater saved</td><td class="r">${fmt(s.water)} m³</td></tr>
          <tr><td>Buyers' savings against diesel</td><td class="r">${inr(s.userSaving)}</td></tr>
          <tr><td>Solar used, today → with Bachi Dhoop</td><td class="r">${Math.round(100 * s.utilBase)}% → ${Math.round(100 * s.utilBd)}%</td></tr>
        </tbody></table></div>
      </div>
      <div class="panel stack"><h3>Who invests, who gains</h3><div class="tablewrap"><table><thead><tr><th>Party</th><th>Invests</th><th class="r">Gains a year</th><th class="r">Payback</th></tr></thead><tbody>
        ${parties.map(r => `<tr><td>${r[0]}</td><td class="muted">${r[1]}</td><td class="r">${inr(r[2])}</td><td class="r">${pill(r[3])}</td></tr>`).join("")}
        <tr><td>Buyers leaving diesel</td><td class="muted">Nothing</td><td class="r">${inr(s.userSaving)}</td><td class="r"><span class="pill ok">now</span></td></tr></tbody></table></div></div>
      <div class="panel stack"><h3>Every owner's year (fair share at work)</h3><div class="tablewrap"><table><thead><tr><th>Pump</th><th>Role</th><th class="r">kWh sold</th><th class="r">Earned</th></tr></thead><tbody>
        ${P.pumps.map((p, j) => `<tr><td class="num">${pumpId(j)}</td><td>${ROLE[p.role]} · ${p.hp} HP</td><td class="r">${fmt(sim.sold[j])}</td><td class="r">${inr(s.ownerPay[j])}</td></tr>`).join("")}
      </tbody></table></div></div>
    </div>
  </section>`;
}

// ---------- router ----------
const ROUTES = { "": vOverview, owner: vOwner, dispatch: vDispatch, mitra: vMitra, meter: vMeter, dairy: vDairy, books: vBooks };
const TITLES = { "": "Overview", owner: "Pump owner", dispatch: "Daily dispatch", mitra: "Dhoop Mitra", meter: "Meter-relay", dairy: "Dairy", books: "Co-op books & impact" };
let route = "";
function render(keepScroll) {
  route = (location.hash.replace(/^#\/?/, "").split("?")[0]) || "";
  if (!(route in ROUTES)) route = "";
  const y = window.scrollY;
  $("#view").innerHTML = ROUTES[route]();
  $$(".nav a").forEach(a => a.setAttribute("aria-current", a.getAttribute("href") === "#/" + route ? "page" : "false"));
  document.title = `Bachi Dhoop · ${TITLES[route]}`;
  $("#day").value = S.day;
  $("#daylbl").textContent = dayLabel(S.day);
  const { m } = dateOf(S.day);
  $("#daytag").textContent = sim.irrigFlag[S.day].filter(Boolean).length + " of 15 owners irrigating · " + (m >= 3 && m <= 8 ? "idle season" : "rabi irrigation season");
  bind();
  if (keepScroll) window.scrollTo(0, y);
}
function update() { save(); render(true); }

function speak(text, lang) {
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  const code = LANGS.find(l => l.code === lang)?.voice || "en-IN";
  u.lang = code; u.rate = 0.95;
  const v = speechSynthesis.getVoices().find(x => x.lang === code) || speechSynthesis.getVoices().find(x => x.lang.startsWith(code.slice(0, 2)));
  if (v) u.voice = v;
  speechSynthesis.cancel(); speechSynthesis.speak(u);
}

function bind() {
  const v = $("#view");
  $$(".pump", v).forEach(b => b.addEventListener("click", () => { S.pump = +b.dataset.j; update(); }));
  $("#pumpsel", v)?.addEventListener("change", e => { S.pump = +e.target.value; update(); });
  $$("[data-lang]", v).forEach(b => b.addEventListener("click", () => { S.lang = b.dataset.lang; update(); }));
  $$("[data-ans]", v).forEach(b => b.addEventListener("click", () => { S.ov = { ...S.ov, [S.day + ":" + S.pump]: b.dataset.ans === "1" }; recompute(); update(); }));
  $("#clearans", v)?.addEventListener("click", () => { const o = { ...S.ov }; delete o[S.day + ":" + S.pump]; S.ov = o; recompute(); update(); });
  $$("[data-say]", v).forEach(b => b.addEventListener("click", () => {
    const j = S.pump, d = S.day, e = earned(P, sim, d, j);
    speak(fill(SCRIPT[S.lang][b.dataset.say], { id: pumpId(j).split("").join(" "), e: fmt(e), m: fmt(monthToDate(j, d)), w: fmt(weekToDate(j, d)) }), S.lang);
  }));
  // Dhoop Mitra
  $$(".stop input", v).forEach(inp => inp.addEventListener("change", () => {
    const d = S.day, k = inp.dataset.k, rec = { ...(S.mitra[d] || {}) };
    rec[k] = { ...(rec[k] || {}), kwh: Math.max(0, parseFloat(inp.value) || 0) };
    S.mitra = { ...S.mitra, [d]: rec }; update();
  }));
  $$("[data-pay]", v).forEach(b => b.addEventListener("click", () => {
    const d = S.day, k = b.dataset.pay, rec = { ...(S.mitra[d] || {}) };
    const stop = mitraStops().find(s => s.key === k);
    const cur = rec[k] || {};
    rec[k] = { kwh: cur.kwh ?? Math.round(stop.kwh * 10) / 10, mode: cur.mode === b.dataset.mode ? null : b.dataset.mode };
    S.mitra = { ...S.mitra, [d]: rec }; update();
  }));
  $("#mitrareset", v)?.addEventListener("click", () => { const m = { ...S.mitra }; delete m[S.day]; S.mitra = m; update(); });
  // Meter
  $("#hour", v)?.addEventListener("input", e => { S.hour = +e.target.value; render(true); });
  $("#playday", v)?.addEventListener("click", () => {
    S.hour = 6; render(true);
    const t = setInterval(() => { if (route !== "meter" || S.hour >= 18) { clearInterval(t); return; } S.hour++; render(true); }, 700);
  });
  // Dairy
  $$("[data-q]", v).forEach(b => b.addEventListener("click", () => {
    const d = S.day, x = dairyDay(d), { m } = dateOf(d);
    let mtd = 0, kwh = 0; for (let k = 0; k <= d; k++) if (dateOf(k).m === m) { const y = dairyDay(k); mtd += y.save; kwh += y.got; }
    const R = {
      book: ["Book extra chilling tomorrow", `Booked. Up to 5 kWh more will be held for the ice bank at P01–P03 tomorrow, if the sun allows. You will be billed only for what is delivered.`],
      fault: ["Report chiller problem", `Logged. Your Dhoop Mitra will visit before 4 pm today, and the cooperative's technician is informed.`],
      stmt: ["Send this month's statement", `${MONTHS_LONG[m]} so far: ${fmt1(kwh)} kWh from sunshine, billed ${inr(kwh * P.priceChill)}. Saved against grid + genset: ${inr(mtd)}.`],
    }[b.dataset.q];
    const list = [...(S.dairy[d] || []), { me: true, text: R[0], t: "19:05" }, { me: false, text: R[1], t: "19:05" }];
    S.dairy = { ...S.dairy, [d]: list }; update();
  }));
  // Books
  $$("input[data-k]", v).forEach(inp => inp.addEventListener("input", () => { S.st = { ...S.st, [inp.dataset.k]: parseFloat(inp.value) }; recompute(); update(); }));
  $$("[data-phase]", v).forEach(b => b.addEventListener("click", () => { S.st = { ...S.st, phase: +b.dataset.phase }; recompute(); update(); }));
  $("#reset", v)?.addEventListener("click", () => { S.st = { ...DEF }; recompute(); update(); });
}

// ---------- global controls ----------
function setDay(d) { S.day = (d + 365) % 365; update(); }
$("#day").addEventListener("input", e => setDay(+e.target.value));
$("#prev").addEventListener("click", () => setDay(S.day - 1));
$("#next").addEventListener("click", () => setDay(S.day + 1));
const themeSaved = store.get("theme", null);
if (themeSaved) document.documentElement.dataset.theme = themeSaved;
$("#theme").addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = dark ? "light" : "dark"; store.set("theme", document.documentElement.dataset.theme); render(true);
});
window.addEventListener("hashchange", () => { render(false); window.scrollTo(0, 0); });
if ("speechSynthesis" in window) speechSynthesis.getVoices();
recompute();
render(false);
