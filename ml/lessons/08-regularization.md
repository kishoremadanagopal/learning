# Lesson 8: Regularisation: Ridge and Lasso

**You'll learn:** penalising big coefficients, Ridge, Lasso, ElasticNet, alpha, scaling before regularising, feature selection with Lasso.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ml/#regularization)**: run every example and check your exercise answers.

## Key terms

- **Regularisation:** adding a penalty for big coefficients to the training goal, to reduce overfitting.
- **alpha:** the strength of the penalty in Ridge and Lasso; 0 means none, larger means simpler.
- **Ridge:** linear regression with a penalty on squared coefficients; shrinks them all smoothly.
- **Lasso:** linear regression with a penalty on absolute coefficients; can set some exactly to 0.
- **ElasticNet:** linear regression with a mix of the Ridge and Lasso penalties.
- **Feature selection:** keeping only the features that help; Lasso does it automatically.
- **StandardScaler:** a step that rescales each feature to mean 0 and standard deviation 1.
- **Standardised coefficient:** a coefficient on scaled features: the effect of one standard deviation of the feature, comparable across features.

An overfitting curve gets its wild wiggles from **huge coefficients** that pull in opposite directions. **Regularisation** adds a penalty for big coefficients to the training goal. The model now has to balance two things:

> fit the training data well **+** keep the coefficients small

The strength of the penalty is a hyperparameter called **`alpha`**. `alpha = 0` means no penalty (plain linear regression). Bigger `alpha` means a simpler, smoother model; too big and it underfits.

| Model | Penalty | Effect |
|---|---|---|
| `Ridge` | sum of **squared** coefficients | shrinks all coefficients towards zero, smoothly |
| `Lasso` | sum of **absolute** coefficients | shrinks them, and sets some **exactly to zero**: it picks features for you |
| `ElasticNet` | a mix of both | a middle ground |

![Left: the energy data with three degree-15 curves. With no penalty the curve swings wildly; with Ridge alpha 0.1 it's a smooth U; with alpha 100 it's almost flat. Right: Lasso coefficients for nine house features as alpha grows: the five random "noise" features drop to exactly zero first, while area stays large](../figures/regularization.svg)

## Ridge rescues the wiggly curve

Same degree-15 model as last lesson, same split, but with `Ridge` instead of `LinearRegression`:

```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import PolynomialFeatures, StandardScaler
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.metrics import root_mean_squared_error

energy = pd.read_csv("energy.csv")
X_train, X_test, y_train, y_test = train_test_split(
    energy[["temperature_c"]], energy["energy_kwh"], test_size=0.3, random_state=1)

plain = make_pipeline(PolynomialFeatures(15), StandardScaler(), LinearRegression()).fit(X_train, y_train)
print("no penalty:    test RMSE", round(root_mean_squared_error(y_test, plain.predict(X_test)), 1))

for alpha in [0.01, 0.1, 1, 10, 100]:
    ridge = make_pipeline(PolynomialFeatures(15), StandardScaler(), Ridge(alpha=alpha)).fit(X_train, y_train)
    print(f"Ridge alpha={alpha:<5} test RMSE", round(root_mean_squared_error(y_test, ridge.predict(X_test)), 1))
```

The test error drops from 40.9 to about 23 with a small penalty, as good as the "just right" degree-2 model. With `alpha` too large (1 and above here), the curve flattens and the model underfits again. `alpha` is another complexity knob to tune.

## Scale first

The penalty treats every coefficient the same, but coefficients depend on units (Lesson 5). A feature in millimetres needs a tiny coefficient; the same feature in kilometres needs a huge one, and would be punished far more. So **always standardise features before Ridge or Lasso**. `StandardScaler` puts every feature on the same scale (mean 0, standard deviation 1). That's why it's in every pipeline here.

## Lasso picks features

To see Lasso at work, give the housing model five extra columns of **pure random noise**. They have nothing to do with price, but plain linear regression will still give them coefficients, because it finds accidental patterns in the training rows:

```python
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LinearRegression, Lasso

housing = pd.read_csv("housing.csv")
X = housing[["area_sqm", "bedrooms", "age_years", "distance_km"]].copy()
rng = np.random.default_rng(0)
for i in range(5):
    X[f"noise_{i}"] = rng.normal(size=len(X)).round(2)     # columns of random numbers
y = housing["price_k"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=5)

plain = make_pipeline(StandardScaler(), LinearRegression()).fit(X_train, y_train)
lasso = make_pipeline(StandardScaler(), Lasso(alpha=10)).fit(X_train, y_train)

coefs = pd.DataFrame({"plain": plain[-1].coef_, "lasso": lasso[-1].coef_}, index=X.columns)
print(coefs.round(1))
print("test R²  plain:", round(plain.score(X_test, y_test), 3), "  lasso:", round(lasso.score(X_test, y_test), 3))
```

`plain[-1]` means "the last step of the pipeline", the model itself. Because the features are standardised, these coefficients **can** be compared: each is "thousands per one standard deviation of the feature". Area is clearly the biggest driver.

Plain regression gives the noise columns coefficients up to about 12. Lasso sets all five **exactly to 0** (`-0.0` is just zero printed with a minus sign), keeps the real features, and scores better on the test set (0.823 against 0.775). That's **feature selection** done automatically.

## Which to use?

- Start with **Ridge** when you have many features that might all matter a little. It's stable and rarely hurts.
- Use **Lasso** when you suspect many features are useless and you want a simpler model that's easier to explain.
- Either way, choose `alpha` by testing on unseen data, not by guessing (Lesson 19 shows how to search for it automatically).

## Common mistakes

- Regularising without scaling, so features in small units get punished unfairly.
- Using alpha that's far too big and wondering why the model is no better than the average.
- Picking alpha by the training score. Like any hyperparameter, choose it on unseen data.

## Exercises

### 1. Tame the curve

Using the split below (`random_state=3`), fit a degree-15 pipeline with `Ridge(alpha=0.1)`, exactly like the lesson. Store its test RMSE in `ridge_rmse`, and the test RMSE of the same pipeline with plain `LinearRegression()` in `plain_rmse`.

Starter code:

```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import PolynomialFeatures, StandardScaler
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.metrics import root_mean_squared_error

energy = pd.read_csv("energy.csv")
X_train, X_test, y_train, y_test = train_test_split(
    energy[["temperature_c"]], energy["energy_kwh"], test_size=0.3, random_state=3)

```

### 2. Which features survive?

The code below adds three noise columns to the housing features. Fit `make_pipeline(StandardScaler(), Lasso(alpha=8))` on the training data and store, in `kept`, a list of the column names whose Lasso coefficient is **not** zero.

Starter code:

```python
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import Lasso

housing = pd.read_csv("housing.csv")
X = housing[["area_sqm", "bedrooms", "age_years", "distance_km"]].copy()
rng = np.random.default_rng(1)
for i in range(3):
    X[f"noise_{i}"] = rng.normal(size=len(X)).round(2)
y = housing["price_k"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=0)

```

**In the sandbox:** exercises 15–16. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Only the last step changes: `Ridge(alpha=0.1)` instead of `LinearRegression()`.
2. `lasso[-1].coef_` holds the coefficients in the order of `X.columns`. Put them in a Series and keep the names where the value isn't 0.

</details>

<details>
<summary>Answers</summary>

**1. Tame the curve**

```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import PolynomialFeatures, StandardScaler
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.metrics import root_mean_squared_error

energy = pd.read_csv("energy.csv")
X_train, X_test, y_train, y_test = train_test_split(
    energy[["temperature_c"]], energy["energy_kwh"], test_size=0.3, random_state=3)

ridge = make_pipeline(PolynomialFeatures(15), StandardScaler(), Ridge(alpha=0.1)).fit(X_train, y_train)
plain = make_pipeline(PolynomialFeatures(15), StandardScaler(), LinearRegression()).fit(X_train, y_train)
ridge_rmse = root_mean_squared_error(y_test, ridge.predict(X_test))
plain_rmse = root_mean_squared_error(y_test, plain.predict(X_test))
print(round(plain_rmse, 1), "->", round(ridge_rmse, 1))
```

**2. Which features survive?**

```python
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import Lasso

housing = pd.read_csv("housing.csv")
X = housing[["area_sqm", "bedrooms", "age_years", "distance_km"]].copy()
rng = np.random.default_rng(1)
for i in range(3):
    X[f"noise_{i}"] = rng.normal(size=len(X)).round(2)
y = housing["price_k"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=0)

lasso = make_pipeline(StandardScaler(), Lasso(alpha=8)).fit(X_train, y_train)
coefs = pd.Series(lasso[-1].coef_, index=X.columns)
print(coefs.round(2))
kept = coefs[coefs != 0].index.tolist()
print(kept)
```

</details>

## Quick quiz

1. What does a larger alpha do in Ridge?
   - A) Penalises big coefficients more, making the model simpler and smoother
   - B) Makes the model more complex
   - C) Removes the intercept

2. What can Lasso do that Ridge can't?
   - A) Predict categories
   - B) Set some coefficients exactly to zero, dropping those features
   - C) Work without any data

3. Why scale features before Ridge or Lasso?
   - A) The penalty treats all coefficients equally, but their sizes depend on each feature's units
   - B) Scaling makes training data larger
   - C) scikit-learn refuses to fit otherwise

4. How should you choose alpha?
   - A) Try several values and keep the one that does best on unseen (validation) data
   - B) Pick the one with the best training score
   - C) Always use alpha=1

<details>
<summary>Quiz answers</summary>

1. **A) Penalises big coefficients more, making the model simpler and smoother**: alpha is the strength of the penalty. Too large and the model underfits.
2. **B) Set some coefficients exactly to zero, dropping those features**: The absolute-value penalty pushes weak features all the way to 0.
3. **A) The penalty treats all coefficients equally, but their sizes depend on each feature's units**: Without scaling, features in small units get punished more than features in big units.
4. **A) Try several values and keep the one that does best on unseen (validation) data**: Like any hyperparameter, alpha is tuned on data the model didn't train on.

</details>

---
Previous: [Lesson 7](07-overfitting.md) · Next: [Lesson 9: Logistic regression: predicting yes or no](09-logistic-regression.md)
