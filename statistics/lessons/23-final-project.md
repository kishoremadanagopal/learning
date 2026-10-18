# Lesson 23: Final project: what drives house prices?

**You'll learn:** an end-to-end statistical analysis: describing, visualising, intervals, ANOVA, multiple regression, model checks, residual-based insights, and a write-up with caveats.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/statistics/#final-project)**: run every example and check your exercise answers.

## Key terms

- **Exploratory analysis:** describing and visualising data before testing anything.
- **Like-for-like comparison:** comparing groups with other factors held fixed.
- **Fitted value:** the model's prediction for a row in the data.
- **Observational data:** data collected without randomly assigning anything, which shows associations rather than proven causes.
- **Caveat:** a stated limit on how far results can be trusted or generalised.

A property company asks: *"What drives house prices in our three neighbourhoods, and how confident can we be? We want a rule of thumb for valuing homes and to know which neighbourhood is the best value."*

You'll answer with `housing.csv`, step by step. Run each step and read the output before moving on.

## Step 1: Describe the data (Part 1)

```python
import pandas as pd

housing = pd.read_csv("housing.csv")
print(housing.shape)
print(housing.describe().round(1))
print(housing["neighborhood"].value_counts())
print("price skew:", round(housing["price_k"].skew(), 2))
```

Prices are roughly symmetric, so means and medians will agree and standard methods are safe.

## Step 2: Look at the outcome and the predictors (Parts 1 and 5)

```python
import pandas as pd
import matplotlib.pyplot as plt

housing = pd.read_csv("housing.csv")
fig, axes = plt.subplots(1, 3, figsize=(11, 3.2))
axes[0].hist(housing["price_k"], bins=20, color="teal", edgecolor="white")
axes[0].set_title("Price (thousands)")
axes[1].scatter(housing["area_sqm"], housing["price_k"], s=12, color="teal")
axes[1].set_title("Price vs area")
axes[2].boxplot([g["price_k"] for _, g in housing.groupby("neighborhood")],
                tick_labels=sorted(housing["neighborhood"].unique()))
axes[2].set_title("Price by neighbourhood")
plt.show()

print(housing[["price_k", "area_sqm", "bedrooms", "age_years", "distance_km"]].corr()["price_k"].round(2))
```

## Step 3: Estimate the typical price with uncertainty (Part 3)

```python
import pandas as pd
from scipy import stats

housing = pd.read_csv("housing.csv")
for name, g in housing.groupby("neighborhood"):
    p = g["price_k"]
    low, high = stats.t.interval(0.95, len(p) - 1, loc=p.mean(), scale=stats.sem(p))
    print(f"{name:10} mean {p.mean():6.1f}  95% CI {low:6.1f} to {high:6.1f}  (n = {len(p)})")
```

## Step 4: Are the neighbourhoods really different? (Part 4)

```python
import pandas as pd
from scipy import stats

housing = pd.read_csv("housing.csv")
groups = [g["price_k"] for _, g in housing.groupby("neighborhood")]
print("ANOVA p =", f"{stats.f_oneway(*groups).pvalue:.1e}")
```

Yes, but raw price differences mix up location with **size**, age and distance: maybe Central homes are just bigger. Comparing fairly needs regression.

## Step 5: Separate the effects (Part 5)

```python
import pandas as pd
import statsmodels.formula.api as smf

housing = pd.read_csv("housing.csv")
model = smf.ols("price_k ~ area_sqm + bedrooms + age_years + distance_km + C(neighborhood)", data=housing).fit()
out = pd.DataFrame({"coef": model.params, "low": model.conf_int()[0], "high": model.conf_int()[1], "p": model.pvalues})
print(out.round(2))
print(f"R² {model.rsquared:.2f}, typical error ±{model.resid.std():.0f}k")
```

## Step 6: Check the model

```python
import pandas as pd
import matplotlib.pyplot as plt
import statsmodels.formula.api as smf

housing = pd.read_csv("housing.csv")
model = smf.ols("price_k ~ area_sqm + bedrooms + age_years + distance_km + C(neighborhood)", data=housing).fit()
fig, axes = plt.subplots(1, 2, figsize=(10, 3.2))
axes[0].scatter(model.fittedvalues, model.resid, s=12, color="teal")
axes[0].axhline(0, color="darkorange")
axes[0].set_title("Residuals vs predicted")
axes[1].hist(model.resid, bins=20, color="teal", edgecolor="white")
axes[1].set_title("Residuals")
plt.show()
```

No pattern in the residuals and a roughly bell-shaped histogram: the straight-line model is a fair summary.

## Step 7: Find the best-value homes

A home priced well **below** what the model predicts for its size, age and location is potentially good value:

```python
import pandas as pd
import statsmodels.formula.api as smf

housing = pd.read_csv("housing.csv")
model = smf.ols("price_k ~ area_sqm + bedrooms + age_years + distance_km + C(neighborhood)", data=housing).fit()
housing["predicted"] = model.fittedvalues.round(1)
housing["gap"] = (housing["price_k"] - housing["predicted"]).round(1)
print(housing.nsmallest(5, "gap")[["home_id", "neighborhood", "area_sqm", "age_years", "price_k", "predicted", "gap"]])
```

## Step 8: The write-up

> **What drives prices.** Size, location and distance from the centre explain about 89% of the variation in price. Each extra square metre adds about 3,200 (95% CI roughly 2,800 to 3,500), holding the other factors fixed; each km from the centre takes off about 4,200, and each year of age about 800.
>
> **Neighbourhoods.** For the same home, Riverside costs about 52,000 less than Central and Hillside about 95,000 less. Raw averages overstate some of these gaps because homes differ in size and age.
>
> **Rule of thumb.** Price ≈ the model's formula, with a typical error of about ±39,000; homes priced well below their predicted value (listed above) are worth a closer look.
>
> **Caveats.** 160 homes from one period; the model shows associations in this data, not guaranteed causes; predictions are reliable only for homes like these (35 to 175 m², up to about 25 km out).

Check every number in the write-up against your output before sending it.

## What you've learned

You can now describe data honestly, reason about probability, estimate with confidence intervals, test claims, measure relationships, fit regression models and run A/B tests: the statistical core of both the analyst and AI engineer paths. The next course, **machine learning**, builds directly on regression and on the idea of judging models with data they haven't seen.

## Common mistakes

- Comparing raw group averages when the groups differ in other important ways.
- Writing numbers in the report that don't match the output.
- Claiming causation from observational data.

## Exercises

### 1. Best and worst value

Fit the final model (`price_k ~ area_sqm + bedrooms + age_years + distance_km + C(neighborhood)`), add `gap` = actual price − predicted price to `housing`, and store the `home_id` of the **most overpriced** home (largest positive gap) in `overpriced_id`, and the number of homes priced more than **50 below** their prediction in `n_bargains`.

Starter code:

```python
import pandas as pd
import statsmodels.formula.api as smf

housing = pd.read_csv("housing.csv")

```

### 2. Central's premium

Using the same model, store the estimated price difference between **Riverside** and **Central** (the `C(neighborhood)[T.Riverside]` coefficient) in `riverside_coef`, and the lower and upper ends of its 95% confidence interval in `ci_low` and `ci_high`.

Starter code:

```python
import pandas as pd
import statsmodels.formula.api as smf

housing = pd.read_csv("housing.csv")

```

**In the sandbox:** exercises 45–46. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. `model.fittedvalues` holds each home's predicted price. "More than 50 below" means `gap < -50`.
2. `model.params[name]` and `model.conf_int().loc[name]` (which gives the two ends).

</details>

<details>
<summary>Answers</summary>

**1. Best and worst value**

```python
import pandas as pd
import statsmodels.formula.api as smf

housing = pd.read_csv("housing.csv")
model = smf.ols("price_k ~ area_sqm + bedrooms + age_years + distance_km + C(neighborhood)", data=housing).fit()
housing["gap"] = housing["price_k"] - model.fittedvalues
overpriced_id = housing.loc[housing["gap"].idxmax(), "home_id"]
n_bargains = (housing["gap"] < -50).sum()
print(overpriced_id, n_bargains)
```

**2. Central's premium**

```python
import pandas as pd
import statsmodels.formula.api as smf

housing = pd.read_csv("housing.csv")
model = smf.ols("price_k ~ area_sqm + bedrooms + age_years + distance_km + C(neighborhood)", data=housing).fit()
name = "C(neighborhood)[T.Riverside]"
riverside_coef = model.params[name]
ci_low, ci_high = model.conf_int().loc[name]
print(round(riverside_coef, 1), round(ci_low, 1), round(ci_high, 1))
```

</details>

## Quick quiz

1. Why fit a regression instead of just comparing average prices by neighbourhood?
   - A) Regression always gives bigger differences
   - B) To compare like with like: holding size, age and distance fixed
   - C) Averages can't be calculated by neighbourhood

2. A model explains 89% of price variation. Does it prove that a bigger area causes a higher price?
   - A) No: it shows a strong association; causal claims need more (experiments or strong reasoning)
   - B) Yes, R² proves cause
   - C) Only if p < 0.05

3. What belongs in the caveats of a good write-up?
   - A) The code
   - B) The sample's limits, what the model can't show, and where predictions are reliable
   - C) Every p-value calculated

<details>
<summary>Quiz answers</summary>

1. **B) To compare like with like: holding size, age and distance fixed**: Raw averages mix location with other factors; regression separates them.
2. **A) No: it shows a strong association; causal claims need more (experiments or strong reasoning)**: Observational data shows associations. Here causation is plausible, but the model alone doesn't prove it.
3. **B) The sample's limits, what the model can't show, and where predictions are reliable**: Caveats tell the reader how far to trust and generalise the results.

</details>

---
Previous: [Lesson 22](22-ab-testing.md) · Back to the [course home](../README.md)
