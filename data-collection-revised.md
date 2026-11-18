# Data collection plan, revised (one-source method)

Revision agreed Nov 2026: the lab will not have different water sources for different samples, so the original 35-cup grid (7 TDS × 5 pH targets across tap/bottled/distilled) is replaced by a one-source recipe method.

## Key insight
The classifier only sees (ph, tds, temp) — it never knows the source. What matters is covering the (pH, TDS) space, not source diversity. One base water + additives generates the whole grid:
- TDS up: table salt. TDS down: dilute with distilled/bottled water.
- pH down: vinegar (drop by drop). pH up: baking soda (pinch).

## Measurable recipes
- TDS gain (ppm) ≈ mass of salt (mg) / volume of water (L). 1 g salt in 1 L ≈ 1000 ppm on a TDS meter (NaCl-calibrated).
- Practical: make one stock solution of 10 g salt per litre; each 10 mL of stock in 1 L of base raises TDS ~100 ppm. Use a 10 mL syringe for repeatable recipes.
- pH: not computable from first principles — record the dose ("6 drops vinegar per 250 mL") and treat the direction as the label.

## Realistic 12-cup list (one base water)
1. Base water as-is (reference; measure first)
2. 50% base + 50% distilled → safe
3. 75% distilled + 25% base → safe
4. Base + stock to ~+400 ppm → safe (still under 500)
5. Base + stock to ~+800 ppm → unsafe (TDS)
6. Base + stock to ~+1500 ppm → unsafe (TDS, obvious)
7. Base + 5 drops vinegar / 250 mL → unsafe (pH low)
8. Base + 15 drops vinegar → unsafe (pH low, obvious)
9. Base + small pinch baking soda → unsafe (pH high)
10. Base + large pinch baking soda → unsafe (pH high, obvious)
11. Salt + vinegar combined → unsafe (both)
12. Repeat of the most interesting cup

Per cup unchanged: settle ~30 s, ~20 readings at 1/s, rinse probes with distilled water between cups, calibrate sensors first. Label from the recipe, not the noisy reading. Training CSV: sample_id, ph, tds, temp, safe; merge with recipe table on sample_id.

## Boundary rule
Do NOT make cups sitting exactly on a threshold (499 ppm, pH 6.5): their true class is ambiguous and sensor noise mislabels them. Design every cup clearly one side; mark any borderline cup "grey zone" in the recipe table and exclude from training (may still be used on stage for discussion).

## Event-day demo
Students make 3-5 cups from one jug: base, diluted safe cup, salty, vinegary, baking-soda — matches the agreed 5-cup answer key flow.
