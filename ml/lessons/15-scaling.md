# Lesson 15: Scaling features

**You'll learn:** why units matter, StandardScaler, MinMaxScaler, RobustScaler, transformers and fit / transform / fit_transform, fitting on training data only, which models need scaling.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ml/#scaling)**: run every example and check your exercise answers.

## Key terms

- **Scaling:** changing features to comparable ranges so no feature dominates just because of its units.
- **Transformer:** a scikit-learn object with fit and transform that changes data instead of predicting.
- **transform:** applies what a transformer learned in fit to some data.
- **fit_transform:** fit and transform in one step; use it on training data only.
- **Standardisation:** subtracting the mean and dividing by the standard deviation, giving z-scores.
- **MinMaxScaler:** rescales each feature to the range 0 to 1.
- **RobustScaler:** scales with the median and interquartile range, so outliers barely affect it.
- **Outlier:** a value far from the rest, which can drag the mean and standard deviation.

Features come in different units: centimetres and grams, months and pounds. Some models are blind to units (trees); others are dominated by whichever feature has the biggest numbers (anything that measures distances or penalises coefficients). **Scaling** puts every feature on a comparable scale.

![Two scatter plots of the same 150 fruits. Left, raw units: width spans about 4 cm while weight spans about 200 g, so the cloud is a thin streak along the weight axis. Right, after StandardScaler: both features are centred on 0 and spread about -2 to 2, and the shape of the data is visible](../figures/scaling.svg)

| Scaler | What it does | Result | Use when |
|---|---|---|---|
| `StandardScaler` | subtract the mean, divide by the standard deviation | mean 0, std 1 (z-scores) | the default choice |
| `MinMaxScaler` | squeeze into a range | 0 to 1 | you need a fixed range (e.g. pixel values, some neural networks) |
| `RobustScaler` | subtract the median, divide by the IQR | middle half spans about 1 | the data has big outliers |

## Transformers: fit, then transform

Scalers are **transformers**: instead of `predict`, they have `transform`, which returns a changed copy of the data. Like models, they **learn** something in `fit`: `StandardScaler` learns each column's mean and standard deviation.

```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

fruit = pd.read_csv("fruit.csv")
X = fruit[["width_cm", "height_cm", "weight_g"]]
X_train, X_test = train_test_split(X, test_size=0.25, random_state=3)

scaler = StandardScaler()
scaler.fit(X_train)                       # learn the means and standard deviations from TRAINING data
print("learned means:", scaler.mean_.round(1))
print("learned stds: ", scaler.scale_.round(1))

X_train_scaled = scaler.transform(X_train)
X_test_scaled = scaler.transform(X_test)  # use the TRAINING means on the test data
print(pd.DataFrame(X_train_scaled, columns=X.columns).describe().loc[["mean", "std"]].round(2))
```

(`-0.0` is zero; the tiny minus sign comes from rounding a number like −0.0000001.)

The rule that matters most: **fit the scaler on the training data only**, then use it to transform both training and test data. The test set stands for future data, and you won't know future data's mean when you train. Fitting on everything lets information from the test set leak into training (Lesson 17).

`fit_transform(X_train)` does `fit` and `transform` in one step. Use it on training data only; on test data, only ever call `transform`.

The scaled training data has mean 0 and standard deviation 1 in every column. The test data's mean will be close to 0, not exactly 0, and that's correct.

## Which models need scaling?

| Needs scaling | Doesn't care |
|---|---|
| k-nearest neighbours (distances) | decision trees |
| Ridge, Lasso, logistic regression (penalties; also trains faster) | random forests |
| support vector machines, neural networks | gradient boosting |
| k-means clustering, PCA (Part 5) | plain linear regression (predictions don't change, only the coefficients) |

When in doubt, scale: it never hurts a tree, and it often helps everything else.

## Scaled coefficients can be compared

A bonus from Lesson 5: after `StandardScaler`, a linear model's coefficients are all "per standard deviation", so their sizes **can** be compared:

```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression

churn = pd.read_csv("churn.csv")
features = ["tenure_months", "monthly_charge", "support_calls", "data_gb"]
X_train, X_test, y_train, y_test = train_test_split(
    churn[features], churn["churned"], test_size=0.25, random_state=0, stratify=churn["churned"])

scaler = StandardScaler().fit(X_train)
model = LogisticRegression().fit(scaler.transform(X_train), y_train)
print(pd.Series(model.coef_[0], index=features).round(2).sort_values())
```

Tenure has the biggest effect (negative: long-standing customers stay), then support calls. Monthly charge and data use matter much less.

## Outliers and RobustScaler

The mean and standard deviation are pulled around by extreme values. If a column has a few huge outliers, `RobustScaler` uses the median and the interquartile range instead, which outliers barely affect:

```python
import pandas as pd
from sklearn.preprocessing import StandardScaler, RobustScaler, MinMaxScaler

incomes = pd.DataFrame({"income_k": [28, 31, 35, 38, 41, 44, 47, 52, 900]})   # one billionaire-ish outlier
incomes["standard"] = StandardScaler().fit_transform(incomes[["income_k"]]).round(2).ravel()
incomes["robust"] = RobustScaler().fit_transform(incomes[["income_k"]]).round(2).ravel()
incomes["minmax"] = MinMaxScaler().fit_transform(incomes[["income_k"]]).round(2).ravel()
print(incomes)
```

With `StandardScaler` and `MinMaxScaler`, the one outlier squashes the eight normal incomes into a tiny range. `RobustScaler` keeps them spread out.

## Common mistakes

- Fitting the scaler on all the data, or on the test set. Fit on training data; only transform the test data.
- Calling fit_transform on the test set, which refits the scaler to it.
- Scaling for trees and expecting a difference. It only matters for distance- and penalty-based models.

## Exercises

### 1. Scale the right way

Fit a `StandardScaler` called `scaler` on `X_train` only. Store the transformed training data in `X_train_scaled` and the transformed test data in `X_test_scaled`.

Starter code:

```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

housing = pd.read_csv("housing.csv")
X = housing[["area_sqm", "age_years", "distance_km"]]
X_train, X_test = train_test_split(X, test_size=0.25, random_state=0)

```

### 2. Zero to one

Use `MinMaxScaler` to scale the `spending_score` and `annual_income_k` columns of `shoppers.csv` (all rows: there's no label, so no split is needed). Store the result as a DataFrame called `scaled` with the same two column names.

Starter code:

```python
import pandas as pd
from sklearn.preprocessing import MinMaxScaler

shoppers = pd.read_csv("shoppers.csv")
cols = ["spending_score", "annual_income_k"]

```

**In the sandbox:** exercises 29–30. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. `scaler = StandardScaler().fit(X_train)`, then `scaler.transform(...)` on each set. Never fit on `X_test`.
2. `MinMaxScaler().fit_transform(shoppers[cols])` returns an array; wrap it with `pd.DataFrame(..., columns=cols)`.

</details>

<details>
<summary>Answers</summary>

**1. Scale the right way**

```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

housing = pd.read_csv("housing.csv")
X = housing[["area_sqm", "age_years", "distance_km"]]
X_train, X_test = train_test_split(X, test_size=0.25, random_state=0)

scaler = StandardScaler().fit(X_train)
X_train_scaled = scaler.transform(X_train)
X_test_scaled = scaler.transform(X_test)
print(X_train_scaled.mean(axis=0).round(2), X_test_scaled.mean(axis=0).round(2))
```

**2. Zero to one**

```python
import pandas as pd
from sklearn.preprocessing import MinMaxScaler

shoppers = pd.read_csv("shoppers.csv")
cols = ["spending_score", "annual_income_k"]
scaled = pd.DataFrame(MinMaxScaler().fit_transform(shoppers[cols]), columns=cols)
print(scaled.describe().loc[["min", "max"]])
```

</details>

## Quick quiz

1. Why fit the scaler on the training data only?
   - A) scikit-learn doesn't allow it
   - B) Fitting on the test data is slower
   - C) The test set stands for future data, whose statistics you can't know when training

2. After StandardScaler, each training column has:
   - A) Mean 0 and standard deviation 1
   - B) Values between 0 and 1
   - C) Median 0 and no outliers

3. Which model does NOT need scaled features?
   - A) Logistic regression with a penalty
   - B) k-nearest neighbours
   - C) A random forest

4. A column has a few extreme outliers. Which scaler is least affected?
   - A) RobustScaler
   - B) MinMaxScaler
   - C) StandardScaler

<details>
<summary>Quiz answers</summary>

1. **C) The test set stands for future data, whose statistics you can't know when training**: Fitting on test data leaks information from it into training, making scores look better than they will be.
2. **A) Mean 0 and standard deviation 1**: That's standardising. MinMaxScaler gives 0 to 1.
3. **C) A random forest**: Trees split on one feature at a time, so units don't matter.
4. **A) RobustScaler**: It uses the median and IQR, which outliers barely move.

</details>

---
Previous: [Lesson 14](14-ensembles.md) · Next: [Lesson 16: Text categories and missing values](16-encoding-and-missing.md)
