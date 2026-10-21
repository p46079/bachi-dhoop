# Data sources and assumptions

Bachi Dhoop's prototype runs on a **simulation**, not field measurements. Every number below feeds the model in `model/bachi_dhoop_sim.py` (Python) and its browser port `app/engine.js`. Where a value is our own assumption, it says so, and the important ones are tested across a range.

## The cluster

| Item | Value | Basis |
|---|---|---|
| Pumps | 15 off-grid PM-KUSUM (Component B) pumps: 4 × 3 HP, 8 × 5 HP, 3 × 7.5 HP | Typical mix of sanctioned pump sizes |
| Panel size | 3 HP: 3.0 kWp · 5 HP: 4.8 kWp · 7.5 HP: 6.75 kWp | SECI standalone pump specification |
| Total | 70.65 kWp on 24 ha (1.6 ha per pump) | |
| Roles | 3 pumps near the dairy ("hub"), 4 with diesel-pump neighbours ("Paani Seva"), 8 in fields | Our cluster design |

## Solar and irrigation

| Item | Value | Basis |
|---|---|---|
| Solar yield | 1,500 kWh per kWp a year, monthly shape for central/western India, daily weather noise | Dhundi solar cooperative planning basis (Ecologise, 2016) |
| Irrigation days | About 145 a year, mostly rabi (Oct–Mar) | MNRE: ~150 days; GIZ–KPMG (Rajasthan): 139 days |
| Low use today | 27% utilisation (Chhattisgarh); 129 multi-use controllers among 59,234 pumps (Rajasthan) | CEEW; Mongabay India (2023) |
| Irrigation saved once surplus is paid | 10% (tested 0–20%) | **Our assumption** |
| Water per kWh of pumping | 1.8 m³ | Engineering estimate for shallow borewells |

## Buyers and prices

| Channel | Price | Basis |
|---|---|---|
| Dhoop Line (dairy ice-bank chiller) | ₹7 per kWh | Below the dairy's grid + diesel genset mix (≈₹14.8/kWh) |
| Milk chilling energy | 0.03 kWh per litre | Rinac bulk milk cooler guide (2026) |
| Dairy chilling on diesel today | 30% (tested 15–50%) | **Our assumption** |
| Paani Seva (water to neighbours) | ₹12 per kWh-equivalent | Below diesel pump rental (≈₹27/kWh-eq) |
| Dhoop Gaadi (machine trolley) | ₹22 per kWh-equivalent | Below diesel engine work (≈₹27/kWh-eq) |
| Dhoop Packs (2.4 kWh batteries) | ₹20 per kWh delivered (₹40 a swap) | Below genset / kerosene |
| Battery pack cost | ₹14,000 per kWh | **Our assumption** (retail LiFePO4 ₹12,000–17,000/kWh) |

## Diesel, emissions, money

| Item | Value | Basis |
|---|---|---|
| Diesel price | ₹98 per litre | Anand, September 2026 (CarDekho) |
| Diesel per kWh | 0.30 L (genset), 0.28 L (engine/shaft work) | Engineering estimate |
| CO₂ | 2.68 kg per litre of diesel; 0.71 kg per grid kWh | CEA / IPCC factors |
| Owner payout | ₹4.5 per kWh sold + 60% of Paani Seva revenue | Our design; compare Dhundi feed-in tariff ₹4.63/kWh (IWMI) |
| Multi-use controller (USPC) | ₹35,000; 30% central subsidy (CFA) | IndiaMART listings; MNRE PM-KUSUM guidelines |
| Dhoop Mitra operator | 15% commission on what she collects | Our design |
| Platform fee | ₹1,000 per pump a year | Our design |

## Scale

| Item | Value | Basis |
|---|---|---|
| Off-grid KUSUM-B pumps installed | 11.49 lakh (June 2026): Maharashtra 5.52, Haryana 1.95, Rajasthan 1.28 lakh | Energetica India (Aug 2026), IBEF |

## Robustness

The Python model is run with 50 random weather and irrigation draws; the 5th to 95th percentile of the headline results moves by under 3%. The browser engine uses a different random number generator, so its single run differs from the Python run by up to about 4% (see `tests/engine.test.mjs`); it stays inside the Python model's range.

## What is not yet measured

No field trial has been run. Phase 0 (Kheda district, Gujarat) is designed to replace the simulated baseline with measured solar use, diesel and payouts from real pumps and a dairy society.
