import pandas as pd
import numpy as np

df = pd.read_csv("processed_water_quality_dataset1.csv")
df.columns = [c.strip() for c in df.columns]
df["Label"] = df["Label"].str.strip().str.lower()

print("=== COLUMNS ===")
print(list(df.columns))
print("dtypes:", df.dtypes.astype(str).to_dict())
print("rows:", len(df), "nulls:", df.isna().sum().to_dict())

print("\n=== CLASS COUNTS ===")
print(df["Label"].value_counts().to_dict())

print("\n=== PER-CLASS SUMMARY ===")
for lbl, sub in df.groupby("Label"):
    print(f"\n[{lbl}]  n={len(sub)}")
    for col in ["pH", "TDS_ppm", "Turbidity_NTU", "Temperature_C"]:
        s = sub[col].dropna()
        print(f"  {col:16s} min={s.min():8.2f}  p25={s.quantile(.25):8.2f}  "
              f"med={s.median():8.2f}  p75={s.quantile(.75):8.2f}  max={s.max():8.2f}")

print("\n=== TDS HISTOGRAM (bins of 100 ppm, both classes) ===")
bins = np.arange(0, df["TDS_ppm"].max() + 100, 100)
h = pd.crosstab(pd.cut(df["TDS_ppm"], bins), df["Label"])
print(h)

print("\n=== pH HISTOGRAM (bins of 0.5) ===")
bins = np.arange(4, 10.5, 0.5)
h = pd.crosstab(pd.cut(df["pH"], bins), df["Label"])
print(h)

print("\n=== RULE AGREEMENT ===")
rule = (df["pH"].between(6.5, 8.5)) & (df["TDS_ppm"] <= 500)
lab = (df["Label"] == "safe")
print(f"rule_safe == label_safe on {(rule == lab).mean():.2%} of rows")
print(f"rule says safe on {rule.mean():.2%} of rows; labels say safe on {lab.mean():.2%}")

print("\n=== FIRST 3 ROWS OF EACH CLASS ===")
print(df.groupby("Label").head(3).to_string(index=False))