"""
Bachi Dhoop - cluster energy & economics simulation
One village cluster of 15 off-grid PM-KUSUM (Component B) solar pumps.
Daily energy-balance model, 365 days, fixed random seed (reproducible).

Every number used is in PARAMS below with its basis noted.
"""
import json, math, random
import numpy as np

SEED = 7
rng = np.random.default_rng(SEED)

DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

PARAMS = {
    # ---------- Assets ----------
    # PV array sizes per SECI/MNRE spec: 3 HP -> 3000 Wp, 5 HP -> 4800 Wp, 7.5 HP -> 6750 Wp
    "pumps": (
        [{"hp": 5, "kwp": 4.8, "role": "hub"}] * 2 + [{"hp": 7.5, "kwp": 6.75, "role": "hub"}] +
        [{"hp": 5, "kwp": 4.8, "role": "paani"}] * 3 + [{"hp": 7.5, "kwp": 6.75, "role": "paani"}] +
        [{"hp": 3, "kwp": 3.0, "role": "field"}] * 4 + [{"hp": 5, "kwp": 4.8, "role": "field"}] * 3 +
        [{"hp": 7.5, "kwp": 6.75, "role": "field"}] * 1
    ),
    "ha_per_pump": 1.6,               # smallholder command area (assumption)

    # ---------- Solar resource ----------
    # Monthly shape for semi-arid western India (Gujarat / western Maharashtra), normalised so the
    # annual usable yield = 1,500 kWh/kWp (Dhundi SPICE planning basis: 5 kWh/kWp/day x 300 sunny days)
    "monthly_shape": [4.6, 5.3, 5.8, 6.0, 5.9, 4.4, 3.2, 3.3, 4.2, 4.9, 4.7, 4.4],
    "annual_yield_kwh_per_kwp": 1500,
    "cloud_sigma_monsoon": 0.35,      # day-to-day variability Jun-Sep (lognormal)
    "cloud_sigma_dry": 0.10,

    # ---------- Irrigation (owner's own use; always served first) ----------
    # Probability a pump irrigates on a given day, by month (rabi-heavy calendar).
    # Calibrated so a pump runs ~145 days/yr: MNRE (~150 days), GIZ-KPMG Rajasthan (139 days).
    "irrig_prob": [0.75, 0.70, 0.55, 0.35, 0.25, 0.15, 0.03, 0.05, 0.12, 0.40, 0.65, 0.75],
    "irrig_use_frac": (0.75, 1.00),   # share of that day's generation used when irrigating
    "irrig_saving_with_bd": 0.10,     # scheduling + surplus-has-value incentive (assumption; tested 0-20%)
    "m3_per_kwh": 1.8,                # water lifted per kWh at ~80 m head, ~40% wire-to-water (assumption)

    # ---------- Load 1: dairy society ice-bank chiller (wired "Dhoop Line" from hub pumps) ----------
    "milk_l_per_day": [1150, 1150, 1050, 950, 850, 850, 900, 950, 1000, 1100, 1150, 1150],
    "chill_kwh_per_l": 0.03,          # 500 L BMC ~12-15 kWh/day at two pours (Rinac 2026 guide)
    "chiller_max_kwh_day": 45,        # ice-bank charging limit (~9 kW x 5 h)
    "chill_baseline_dg_share": 0.30,  # share of chilling energy from DG set today (weak rural feeders)
    "grid_tariff_commercial": 8.5,    # Rs/kWh (Rs 7-9 commercial, Rinac/Tristar)
    "price_chill": 7.0,               # Rs/kWh-eq charged to dairy society (below grid AND DG)

    # ---------- Load 2: Paani Seva - water service to neighbours who irrigate with diesel ----------
    "neighbours_per_paani_pump": 1.5,
    "neighbour_kwh_per_irrig_day": 12,
    "price_paani": 12.0,              # Rs/kWh-eq; Dhundi irrigation-service sales earned ~Rs 12/kWh (IWMI)

    # ---------- Load 3: Dhoop Gaadi - mobile agro-processing trolley (chaff cutter, pulveriser, grader) ----------
    "gaadi_max_kwh_day": 45,          # 7.5 kW x 6 h
    "gaadi_demand_kwh": [18, 18, 30, 30, 18, 15, 12, 12, 15, 30, 30, 18],
    "gaadi_operating_prob": 0.85,
    "price_gaadi": 22.0,              # Rs/kWh-eq, per service; diesel fuel alone costs ~Rs 27/kWh-eq (0.28 L x Rs 98)

    # ---------- Load 4: Dhoop Packs - swappable LiFePO4 packs ----------
    "pack_count": 12,
    "pack_kwh_delivered": 2.0,        # 2.4 kWh pack, ~85% usable
    "pack_charge_eff": 0.90,
    "pack_swap_rate": 0.85,           # share of packs swapped per day
    "charger_kwh_per_pump_day": 18,   # 3 kW x 6 h
    "price_pack": 20.0,               # Rs/kWh delivered (Rs 40 per swap); DG power costs ~Rs 29/kWh in fuel
    "pack_diesel_share": 0.40,        # share of pack energy that replaces diesel today (rest kerosene/grid/none)

    # ---------- Conversions ----------
    "diesel_price": 98.0,             # Rs/L, Anand, Sep 2026 (CarDekho)
    "l_diesel_per_kwh_dg": 0.30,      # small DG set at part load
    "l_diesel_per_kwh_shaft_eq": 0.28,# diesel engine ~30% vs electric motor ~85%
    "co2_per_l_diesel": 2.68,
    "co2_per_kwh_grid": 0.71,

    # ---------- Money ----------
    "owner_share_per_kwh": 4.5,       # paid to pump owner per metered kWh (Dhundi FiT was Rs 4.63)
    "owner_share_paani": 0.60,        # owner keeps 60% of Paani Seva revenue (it is his well)
    # Who pays for what (each party has its own business case)
    "owner_capex_uspc": 35000,        # per pump; Rs 33,900-38,000 market (IndiaMART; Kamal Meena paid Rs 38,000)
    "uspc_cfa_share": 0.30,           # PM-KUSUM extended CFA to USPC (2020 amendment)
    "mandali_capex": {
        "Smart meter + relay per pump (15 x Rs 5,000)": 15 * 5000,
        "Dhoop Line to dairy hub (400 m LT cable)": 150000,
        "Dhoop Gaadi trolley + 3 machines": 200000,
        "Onboarding, training, setup": 75000,
    },
    "pack_kwh_capacity": 2.4,
    "pack_cost_per_kwh": 14000,       # LiFePO4 pack incl. BMS + enclosure (assumption, ~Rs 12-17k/kWh retail)
    "pack_chargers": 5,
    "pack_charger_cost": 10000,
    "owner_capex_small_pump": 10000,  # 3 HP pumps: DC pack-charger instead of USPC (array too small for machines)
    "mandali_grant_share": 0.50,      # sensitivity: CSR / AIF / NABARD support on Mandali assets
    "dairy_icebank_incremental_capex": 300000,  # premium of solar-chargeable ice-bank over a standard DX BMC (assumption)
    "operator_commission": 0.15,      # Dhoop Mitra (village entrepreneur) earns 15% of revenue, not a salary
    "ecart_opex_per_year": 30000,     # pack delivery e-cart running (Rs 2,500/month)
    "maintenance_share": 0.03,        # of Mandali capex per year
    "platform_fee_per_pump": 1000,    # Rs/pump/yr to the software platform
}


def daily_solar(p):
    shape = np.array(p["monthly_shape"])
    days = np.array(DAYS_IN_MONTH)
    scale = p["annual_yield_kwh_per_kwp"] / float((shape * days).sum())
    out = []
    for m, nd in enumerate(DAYS_IN_MONTH):
        sigma = p["cloud_sigma_monsoon"] if m in (5, 6, 7, 8) else p["cloud_sigma_dry"]
        f = rng.lognormal(-sigma**2 / 2, sigma, nd)          # mean-1 multiplicative noise
        out.extend((shape[m] * scale * f).tolist())
    return np.array(out)                                      # kWh per kWp per day


def month_index():
    idx = []
    for m, nd in enumerate(DAYS_IN_MONTH):
        idx += [m] * nd
    return np.array(idx)


def run(p, bachi_dhoop=True):
    pumps = p["pumps"]
    n = len(pumps)
    kwp = np.array([x["kwp"] for x in pumps])
    roles = [x["role"] for x in pumps]
    mi = month_index()
    yld = daily_solar(p)                                       # same weather draws for both runs? no - reseed below
    D = len(yld)

    gen = np.outer(yld, kwp)                                   # D x n
    # irrigation draws
    ip = np.array(p["irrig_prob"])[mi]
    irrig_day = rng.random((D, n)) < ip[:, None]
    use_frac = rng.uniform(*p["irrig_use_frac"], size=(D, n))
    irrig = np.where(irrig_day, gen * use_frac, 0.0)
    if bachi_dhoop:
        irrig = irrig * (1 - p["irrig_saving_with_bd"])
    surplus = gen - irrig

    # neighbour (Paani Seva) demand draws
    nb_day = rng.random((D, n)) < ip[:, None]
    gaadi_on = rng.random(D) < p["gaadi_operating_prob"]

    served = {k: np.zeros(D) for k in ["chill", "paani", "gaadi", "pack"]}
    per_pump_sold = np.zeros(n)
    per_pump_paani_rev = np.zeros(n)
    cum_gen = np.zeros(n)
    chill_demand = np.zeros(D)

    for d in range(D):
        m = mi[d]
        s = surplus[d].copy()
        cum_gen += gen[d]
        # fair-share key: pumps that have sold the least relative to what they generate go first
        def fair(i):
            return per_pump_sold[i] / cum_gen[i]
        chill_need = p["milk_l_per_day"][m] * p["chill_kwh_per_l"]
        chill_demand[d] = chill_need
        if not bachi_dhoop:
            continue
        # 1) Hub: dairy ice-bank chiller, fed only by hub pumps over the Dhoop Line
        need = min(chill_need, p["chiller_max_kwh_day"])
        for j in [i for i in range(n) if roles[i] == "hub"]:
            take = min(s[j], need)
            s[j] -= take; need -= take
            served["chill"][d] += take; per_pump_sold[j] += take
        # 2) Paani Seva: neighbour irrigation from designated pumps (water-neutral: replaces their diesel)
        for j in [i for i in range(n) if roles[i] == "paani"]:
            if nb_day[d, j]:
                want = p["neighbours_per_paani_pump"] * p["neighbour_kwh_per_irrig_day"]
                take = min(s[j], want)
                s[j] -= take
                served["paani"][d] += take
                per_pump_paani_rev[j] += take * p["price_paani"]
        # 3) Dhoop Gaadi: goes to the non-hub pump with the most surplus today
        if gaadi_on[d]:
            want = min(p["gaadi_demand_kwh"][m], p["gaadi_max_kwh_day"])
            big = [i for i in range(n) if roles[i] != "hub" and kwp[i] >= 4.8]   # 7.5 kW machines need >= 4.8 kWp
            cand = [i for i in big if s[i] >= want]
            if not cand:
                cand = [max(big, key=lambda i: s[i])]
            j = min(cand, key=fair)
            take = min(s[j], p["gaadi_demand_kwh"][m], p["gaadi_max_kwh_day"])
            s[j] -= take; served["gaadi"][d] += take; per_pump_sold[j] += take
        # 4) Dhoop Packs: charged wherever surplus is left (largest first), charger-limited
        need = p["pack_count"] * p["pack_swap_rate"] * p["pack_kwh_delivered"] / p["pack_charge_eff"]
        for j in sorted([i for i in range(n) if s[i] > 2.0], key=fair):
            if need <= 0: break
            take = min(s[j], p["charger_kwh_per_pump_day"], need)
            s[j] -= take; need -= take
            served["pack"][d] += take; per_pump_sold[j] += take

    return dict(gen=gen, irrig=irrig, surplus=surplus, served=served, mi=mi,
                per_pump_sold=per_pump_sold, per_pump_paani_rev=per_pump_paani_rev,
                chill_demand=chill_demand, kwp=kwp, roles=roles)


def summarise(p, base, bd):
    n = len(p["pumps"])
    G = base["gen"].sum()
    base_irrig = base["irrig"].sum()
    bd_irrig = bd["irrig"].sum()
    sv = {k: v.sum() for k, v in bd["served"].items()}
    productive_bd = bd_irrig + sum(sv.values())
    pack_delivered = sv["pack"] * p["pack_charge_eff"]

    # ---- Diesel displaced ----
    d_chill = sv["chill"] * p["chill_baseline_dg_share"] * p["l_diesel_per_kwh_dg"]
    d_paani = sv["paani"] * p["l_diesel_per_kwh_shaft_eq"]
    d_gaadi = sv["gaadi"] * p["l_diesel_per_kwh_shaft_eq"]
    d_pack = pack_delivered * p["pack_diesel_share"] * p["l_diesel_per_kwh_dg"]
    diesel = d_chill + d_paani + d_gaadi + d_pack
    grid_kwh_displaced = sv["chill"] * (1 - p["chill_baseline_dg_share"])
    co2_t = (diesel * p["co2_per_l_diesel"] + grid_kwh_displaced * p["co2_per_kwh_grid"]) / 1000

    # ---- Water ----
    water_saved_m3 = (base_irrig - bd_irrig) * p["m3_per_kwh"]
    ha = n * p["ha_per_pump"]

    # ---- Revenue (to the Dhoop Mandali) ----
    rev = {
        "Dairy chilling": sv["chill"] * p["price_chill"],
        "Paani Seva": sv["paani"] * p["price_paani"],
        "Dhoop Gaadi services": sv["gaadi"] * p["price_gaadi"],
        "Dhoop Packs": pack_delivered * p["price_pack"],
    }
    revenue = sum(rev.values())
    # ---- Payouts to pump owners ----
    owner_energy_pay = bd["per_pump_sold"] * p["owner_share_per_kwh"]
    owner_paani_pay = bd["per_pump_paani_rev"] * p["owner_share_paani"]
    owner_pay = owner_energy_pay + owner_paani_pay

    # ---- Mandali (cooperative) P&L ----
    mcap_items = dict(p["mandali_capex"])
    if p["pack_count"] > 0:
        mcap_items[f'Dhoop Packs ({p["pack_count"]} x {p["pack_kwh_capacity"]} kWh @ Rs {p["pack_cost_per_kwh"]:,}/kWh)'] = \
            round(p["pack_count"] * p["pack_kwh_capacity"] * p["pack_cost_per_kwh"])
        mcap_items[f'Pack chargers ({p["pack_chargers"]} x Rs {p["pack_charger_cost"]:,})'] = p["pack_chargers"] * p["pack_charger_cost"]
    mcap = sum(mcap_items.values())
    opex = {
        "Dhoop Mitra commission (15% of revenue)": p["operator_commission"] * revenue,
        "Pack delivery e-cart": p["ecart_opex_per_year"] if p["pack_count"] > 0 else 0,
        "Maintenance (3% of Mandali capex)": p["maintenance_share"] * mcap,
        "Platform fee (Rs 1,000/pump/yr)": p["platform_fee_per_pump"] * n,
    }
    opex_total = sum(opex.values())
    mandali_net = revenue - owner_pay.sum() - opex_total
    payback = mcap / mandali_net if mandali_net > 0 else float("inf")
    payback_grant = mcap * (1 - p["mandali_grant_share"]) / mandali_net if mandali_net > 0 else float("inf")

    # ---- Pump owner view ----
    uspc_net = p["owner_capex_uspc"] * (1 - p["uspc_cfa_share"])
    kwp = bd["kwp"]
    owner_by_size = {}
    for size, hp in [(3.0, 3), (4.8, 5), (6.75, 7.5)]:
        mask = kwp == size
        inc = float(owner_pay[mask].mean())
        if hp == 3:
            cap, cap_net, kit = p["owner_capex_small_pump"], p["owner_capex_small_pump"], "DC pack charger"
        else:
            cap, cap_net, kit = p["owner_capex_uspc"], uspc_net, "USPC"
        owner_by_size[f"{hp} HP"] = {"kit": kit, "income": round(inc), "capex": cap,
                                     "payback_yrs": round(cap / inc, 1) if inc > 0 else None,
                                     "payback_after_cfa_yrs": round(cap_net / inc, 1) if inc > 0 else None}

    # ---- Dairy society view ----
    chill_baseline_cost_per_kwh = (1 - p["chill_baseline_dg_share"]) * p["grid_tariff_commercial"] + \
        p["chill_baseline_dg_share"] * p["l_diesel_per_kwh_dg"] * p["diesel_price"]
    dairy_saving = sv["chill"] * (chill_baseline_cost_per_kwh - p["price_chill"])
    chill_cover = sv["chill"] / bd["chill_demand"].sum()

    # ---- Users who switch off diesel ----
    shaft_cost = p["l_diesel_per_kwh_shaft_eq"] * p["diesel_price"]
    dg_cost = p["l_diesel_per_kwh_dg"] * p["diesel_price"]
    user_saving = {
        "Paani Seva buyers": sv["paani"] * (shaft_cost - p["price_paani"]),
        "Dhoop Gaadi users": sv["gaadi"] * (shaft_cost - p["price_gaadi"]),
        "Dhoop Pack users (diesel-replacing share only)": pack_delivered * p["pack_diesel_share"] * (dg_cost - p["price_pack"]),
    }

    # ---- Whole-cluster view ----
    n_small = int((kwp == 3.0).sum())
    owner_capex_total = p["owner_capex_uspc"] * (n - n_small) + p["owner_capex_small_pump"] * n_small
    total_capex = owner_capex_total + mcap + p["dairy_icebank_incremental_capex"]
    annual_value = owner_pay.sum() + mandali_net + dairy_saving + sum(user_saving.values())
    system_payback = total_capex / annual_value

    # ---- Monthly series for charts ----
    mi = bd["mi"]
    def monthly(arr):
        return [round(float(arr[mi == m].sum()), 1) for m in range(12)]
    monthly_series = {
        "generation": monthly(bd["gen"].sum(axis=1)),
        "irrigation_baseline": monthly(base["irrig"].sum(axis=1)),
        "irrigation_bd": monthly(bd["irrig"].sum(axis=1)),
        "chill": monthly(bd["served"]["chill"]),
        "paani": monthly(bd["served"]["paani"]),
        "gaadi": monthly(bd["served"]["gaadi"]),
        "pack": monthly(bd["served"]["pack"]),
    }
    out = {
        "cluster": {"pumps": n, "kwp_total": float(kwp.sum()), "hectares": ha},
        "generation_kwh": round(G),
        "utilisation_baseline_pct": round(100 * base_irrig / G, 1),
        "utilisation_bd_pct": round(100 * productive_bd / G, 1),
        "baseline_irrigation_kwh": round(base_irrig),
        "bd_irrigation_kwh": round(bd_irrig),
        "served_kwh": {k: round(v) for k, v in sv.items()},
        "secondary_total_kwh": round(sum(sv.values())),
        "pack_delivered_kwh": round(pack_delivered),
        "unused_surplus_kwh_bd": round(G - productive_bd),
        "diesel_displaced_l": round(diesel),
        "diesel_by_load_l": {"chill": round(d_chill), "paani": round(d_paani), "gaadi": round(d_gaadi), "pack": round(d_pack)},
        "diesel_value_rs": round(diesel * p["diesel_price"]),
        "grid_kwh_displaced": round(grid_kwh_displaced),
        "co2_t": round(co2_t, 1),
        "water_saved_m3": round(water_saved_m3),
        "per_ha": {
            "diesel_l": round(diesel / ha, 1),
            "water_saved_m3": round(water_saved_m3 / ha),
            "extra_productive_kwh": round((productive_bd - base_irrig) / ha),
            "co2_kg": round(1000 * co2_t / ha),
        },
        "revenue_rs": {k: round(v) for k, v in rev.items()},
        "revenue_total_rs": round(revenue),
        "owner_pay_total_rs": round(owner_pay.sum()),
        "owner_pay_avg_rs": round(owner_pay.mean()),
        "owner_by_size": owner_by_size,
        "owner_pay_min_max_rs": [round(float(owner_pay.min())), round(float(owner_pay.max()))],
        "owner_sold_share_of_gen_pct": [round(100 * float(x), 1) for x in bd["per_pump_sold"] / bd["gen"].sum(axis=0)],
        "mandali_capex_rs": mcap_items,
        "owner_capex_total_rs": owner_capex_total,
        "mandali_capex_total_rs": mcap,
        "opex_rs": {k: round(v) for k, v in opex.items()},
        "opex_total_rs": round(opex_total),
        "mandali_net_rs": round(mandali_net),
        "mandali_payback_yrs": round(payback, 1),
        "mandali_payback_with_grant_yrs": round(payback_grant, 1),
        "dairy": {
            "chill_cover_pct": round(100 * chill_cover, 1),
            "baseline_cost_per_kwh": round(chill_baseline_cost_per_kwh, 2),
            "annual_saving_rs": round(dairy_saving),
            "incremental_capex_rs": p["dairy_icebank_incremental_capex"],
            "payback_yrs": round(p["dairy_icebank_incremental_capex"] / dairy_saving, 1) if dairy_saving > 0 else None,
        },
        "user_saving_rs": {k: round(v) for k, v in user_saving.items()},
        "system": {"total_capex_rs": total_capex, "annual_value_rs": round(annual_value),
                   "payback_yrs": round(system_payback, 1)},
        "monthly": monthly_series,
    }
    return out


def simulate(p, seed=SEED):
    global rng
    rng = np.random.default_rng(seed)
    base = run(p, bachi_dhoop=False)
    rng = np.random.default_rng(seed)       # identical weather & irrigation draws for both scenarios
    bd = run(p, bachi_dhoop=True)
    return summarise(p, base, bd)


if __name__ == "__main__":
    res = simulate(PARAMS)
    p1 = dict(PARAMS); p1["pack_count"] = 0
    r1 = simulate(p1)
    res["phase1_no_packs"] = {k: r1[k] for k in ["utilisation_bd_pct", "secondary_total_kwh", "diesel_displaced_l",
        "co2_t", "revenue_total_rs", "owner_pay_avg_rs", "owner_by_size", "mandali_capex_total_rs", "opex_total_rs",
        "mandali_net_rs", "mandali_payback_yrs", "mandali_payback_with_grant_yrs", "system", "per_ha", "user_saving_rs"]}
    # Robustness: 50 seeds
    seeds = [simulate(PARAMS, s) for s in range(50)]
    def band(key, sub=None):
        vals = [ (r[key] if sub is None else r[key][sub]) for r in seeds]
        return [round(float(np.percentile(vals, 5)), 1), round(float(np.percentile(vals, 95)), 1)]
    res["robustness_50_seeds_p5_p95"] = {
        "utilisation_baseline_pct": band("utilisation_baseline_pct"),
        "utilisation_bd_pct": band("utilisation_bd_pct"),
        "diesel_displaced_l": band("diesel_displaced_l"),
        "mandali_net_rs": band("mandali_net_rs"),
        "mandali_payback_yrs": band("mandali_payback_yrs"),
        "owner_pay_avg_rs": band("owner_pay_avg_rs"),
    }
    # Sensitivity
    sens = {}
    for name, key, vals in [
        ("irrigation saving", "irrig_saving_with_bd", [0.0, 0.10, 0.20]),
        ("baseline DG share at dairy", "chill_baseline_dg_share", [0.15, 0.30, 0.50]),
        ("pack price Rs/kWh", "price_pack", [16.0, 20.0, 24.0]),
        ("owner payout Rs/kWh", "owner_share_per_kwh", [3.5, 4.5, 5.5]),
        ("Dhoop Gaadi price Rs/kWh-eq", "price_gaadi", [16.0, 22.0, 26.0]),
        ("diesel price Rs/L", "diesel_price", [85.0, 98.0, 110.0]),
    ]:
        rows = []
        for v in vals:
            q = dict(PARAMS); q[key] = v
            r = simulate(q)
            rows.append({"value": v, "diesel_l": r["diesel_displaced_l"], "mandali_net": r["mandali_net_rs"],
                         "mandali_payback": r["mandali_payback_yrs"], "system_payback": r["system"]["payback_yrs"],
                         "owner_avg": r["owner_pay_avg_rs"],
                         "water_saved_m3": r["water_saved_m3"], "dairy_saving": r["dairy"]["annual_saving_rs"]})
        sens[name] = rows
    res["sensitivity"] = sens
    import os
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "results", "sim_results.json")
    json.dump(res, open(out, "w"), indent=2, default=float)
    print(json.dumps({k: v for k, v in res.items() if k not in ("monthly", "sensitivity")}, indent=1, default=float))
    for k, rows in res["sensitivity"].items():
        print(k, [(r["value"], r["diesel_l"], r["mandali_payback"], r["system_payback"], r["owner_avg"]) for r in rows])
