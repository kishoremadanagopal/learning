# Lesson 14: Random forests and gradient boosting

**You'll learn:** ensembles, bagging and bootstrap samples, random forests, gradient boosting, HistGradientBoosting, key hyperparameters, built-in vs permutation importance, XGBoost and LightGBM.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ml/#ensembles)**: run every example and check your exercise answers.

## Key terms

- **Ensemble:** a model that combines the predictions of many models.
- **Bootstrap sample:** a random sample of rows drawn with replacement, the same size as the original.
- **Bagging:** training each model on a different bootstrap sample and averaging their predictions.
- **Random forest:** many decision trees, each on a bootstrap sample with random features per split, averaged together.
- **Gradient boosting:** trees built one after another, each correcting the errors of the ones before; their outputs are added up.
- **n_estimators:** the number of trees in a random forest.
- **learning_rate:** in boosting, how big each tree's correction is; smaller usually needs more trees but generalises better.
- **HistGradientBoostingClassifier:** scikit-learn's fast gradient-boosting model, which bins feature values.
- **Permutation importance:** how much a model's score drops when one feature's values are shuffled.
- **XGBoost / LightGBM / CatBoost:** popular gradient-boosting libraries outside scikit-learn.

One deep tree overfits; one shallow tree is too simple. The fix is to combine **many** trees into an **ensemble**. Two ways to do it dominate machine learning on tables, and in 2026 they're still the first models most practitioners try for spreadsheet-style data:

![Left: a random forest. The same training data is resampled into many different bootstrap samples, each grows its own tree, and their predictions are averaged into one vote. Right: gradient boosting. Tree 1 makes predictions, tree 2 is trained on tree 1's mistakes, tree 3 on what's still wrong, and the final prediction adds them all up](../figures/ensembles.svg)

| | Random forest | Gradient boosting |
|---|---|---|
| Trees are built | independently, in parallel | one after another |
| Each tree | is deep, trained on a random **bootstrap sample** of rows, with random features at each split | is small, and trained to fix the **errors** of the trees so far |
| Combined by | averaging (a vote) | adding up |
| Main idea | many different "opinions" cancel out each other's noise | lots of small corrections add up to a strong model |
| scikit-learn | `RandomForestClassifier` / `Regressor` | `HistGradientBoostingClassifier` / `Regressor` |

A **bootstrap sample** is a sample of rows drawn **with replacement** (some rows appear twice, some not at all), as in the bootstrap from Statistics. Training each tree on different rows (**bagging**) and letting it consider only a random subset of features at each split makes the trees **different from each other**. Their individual mistakes then point in different directions and largely cancel when you average them.

## Using every column

So far the churn models used only the number columns. The strongest clue, the contract type, is text. `pd.get_dummies` turns each text column into 0/1 columns, one per category. (Lesson 16 shows the proper way to do this inside a pipeline; `get_dummies` is fine for a quick experiment.) Trees in scikit-learn 1.8 also handle the missing ages by themselves.

```python
import pandas as pd

churn = pd.read_csv("churn.csv")
X = pd.get_dummies(churn.drop(columns=["customer_id", "churned"]), dtype=int)
print(X.columns.tolist())
print(X.head(3))
```

## One tree versus a forest versus boosting

```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.metrics import roc_auc_score

churn = pd.read_csv("churn.csv")
X = pd.get_dummies(churn.drop(columns=["customer_id", "churned"]), dtype=int)
y = churn["churned"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=0, stratify=y)

models = {
    "one deep tree": DecisionTreeClassifier(random_state=0),
    "one tree, depth 4": DecisionTreeClassifier(max_depth=4, random_state=0),
    "random forest": RandomForestClassifier(n_estimators=300, min_samples_leaf=3, random_state=0),
    "gradient boosting": HistGradientBoostingClassifier(learning_rate=0.05, max_depth=3, random_state=0),
}
for name, model in models.items():
    model.fit(X_train, y_train)
    auc = roc_auc_score(y_test, model.predict_proba(X_test)[:, 1])
    print(f"{name:<18}  accuracy {model.score(X_test, y_test):.3f}   AUC {auc:.3f}")
```

The single deep tree is the worst; limiting its depth helps; both ensembles beat any single tree by a wide margin (AUC around 0.83 against 0.67 for the deep tree).

The main settings:

- **Random forest:** `n_estimators` (number of trees: more is better but slower; a few hundred is typical), `max_features` (features tried per split), `min_samples_leaf` or `max_depth` (how big each tree grows).
- **Gradient boosting:** `learning_rate` (how big each correction is: smaller is usually better but needs more trees), `max_iter` (number of trees), `max_depth` (each tree's size).

scikit-learn's `HistGradientBoostingClassifier` is the fast, modern implementation (it groups values into bins, which is the "Hist"). Outside scikit-learn, **XGBoost**, **LightGBM** and **CatBoost** are popular libraries built on the same idea, often used in competitions and production. They work the same way you've learned: create, fit, predict.

## Which features matter?

Random forests have `feature_importances_`, but it has a known bias: it favours columns with many different values (like age or charges) even when they barely help. **Permutation importance** is more honest. It shuffles one column of the **test** data at a time and measures how much the score drops. If shuffling a column hurts a lot, the model relied on it.

```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.inspection import permutation_importance

churn = pd.read_csv("churn.csv")
X = pd.get_dummies(churn.drop(columns=["customer_id", "churned"]), dtype=int)
y = churn["churned"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=0, stratify=y)
forest = RandomForestClassifier(n_estimators=300, min_samples_leaf=3, random_state=0).fit(X_train, y_train)

result = permutation_importance(forest, X_test, y_test, scoring="roc_auc", n_repeats=10, random_state=0)
importance = pd.DataFrame({
    "built-in": forest.feature_importances_,
    "permutation": result.importances_mean,
}, index=X.columns).round(3)
print(importance.sort_values("permutation", ascending=False))
```

![Two bar charts of feature importance for the churn forest. Built-in importance puts tenure first and gives age and data use large bars. Permutation importance puts the month-to-month contract first, then tenure and support calls, and gives age almost nothing](../figures/feature-importance.svg)

Permutation importance says the month-to-month contract, tenure and support calls drive the predictions, while age barely matters, even though the built-in measure gives age a sizeable share. When the two disagree, trust permutation importance on the test set.

## Common mistakes

- Trusting built-in feature importances blindly; they favour features with many distinct values.
- Comparing an ensemble only with a single tree. Also compare with a baseline and a simple linear model.
- Reaching for a neural network first on spreadsheet-like data, where tree ensembles usually win.

## Exercises

### 1. Grow a forest

Using the split below, train `RandomForestClassifier(n_estimators=200, random_state=1)` as `forest`. Store its test AUC in `forest_auc`, and the test AUC of a single `DecisionTreeClassifier(random_state=1)` in `tree_auc`.

Starter code:

```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import roc_auc_score

churn = pd.read_csv("churn.csv")
X = pd.get_dummies(churn.drop(columns=["customer_id", "churned"]), dtype=int)
y = churn["churned"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=4, stratify=y)

```

### 2. Boost the house prices

Ensembles predict numbers too. Using the housing split below, store the test R² of `HistGradientBoostingRegressor(random_state=0)` in `boost_r2` and of `LinearRegression()` in `linear_r2`.

Starter code:

```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import HistGradientBoostingRegressor

housing = pd.read_csv("housing.csv")
X = housing[["area_sqm", "bedrooms", "age_years", "distance_km"]]
y = housing["price_k"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=5)

```

**In the sandbox:** exercises 27–28. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Both models use `.predict_proba(X_test)[:, 1]` for the AUC.
2. `.score` on a regressor gives R². Fit each on the training data and score on the test data.

</details>

<details>
<summary>Answers</summary>

**1. Grow a forest**

```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import roc_auc_score

churn = pd.read_csv("churn.csv")
X = pd.get_dummies(churn.drop(columns=["customer_id", "churned"]), dtype=int)
y = churn["churned"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=4, stratify=y)

forest = RandomForestClassifier(n_estimators=200, random_state=1).fit(X_train, y_train)
tree = DecisionTreeClassifier(random_state=1).fit(X_train, y_train)
forest_auc = roc_auc_score(y_test, forest.predict_proba(X_test)[:, 1])
tree_auc = roc_auc_score(y_test, tree.predict_proba(X_test)[:, 1])
print(round(tree_auc, 3), "->", round(forest_auc, 3))
```

**2. Boost the house prices**

```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import HistGradientBoostingRegressor

housing = pd.read_csv("housing.csv")
X = housing[["area_sqm", "bedrooms", "age_years", "distance_km"]]
y = housing["price_k"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=5)

boost_r2 = HistGradientBoostingRegressor(random_state=0).fit(X_train, y_train).score(X_test, y_test)
linear_r2 = LinearRegression().fit(X_train, y_train).score(X_test, y_test)
print("boosting:", round(boost_r2, 3), " linear:", round(linear_r2, 3))
```

</details>

## Quick quiz

1. Why does averaging many trees beat one deep tree?
   - A) Forests use more features than trees can
   - B) Each tree overfits in a different way, so their errors largely cancel out
   - C) Each tree in the forest is more accurate than a single tree

2. How are the trees in gradient boosting built?
   - A) All at once, independently
   - B) By deleting branches from one big tree
   - C) One after another, each fixing the errors of the trees before it

3. What does permutation importance measure?
   - A) How often a feature is used in splits
   - B) How much the test score drops when one feature's values are shuffled
   - C) The correlation of each feature with the label

4. For a new table-shaped (spreadsheet-like) problem in 2026, a strong first choice is:
   - A) A deep neural network
   - B) A tree ensemble such as a random forest or gradient boosting, next to a simple baseline
   - C) k-nearest neighbours with k=1

<details>
<summary>Quiz answers</summary>

1. **B) Each tree overfits in a different way, so their errors largely cancel out**: The individual trees are noisy; the average is stable.
2. **C) One after another, each fixing the errors of the trees before it**: Boosting adds small corrections in sequence.
3. **B) How much the test score drops when one feature's values are shuffled**: If shuffling a feature hurts the score, the model depended on it.
4. **B) A tree ensemble such as a random forest or gradient boosting, next to a simple baseline**: Tree ensembles remain the go-to for tabular data; always compare with a baseline and a simple model.

</details>

---
Previous: [Lesson 13](13-decision-trees.md) · Next: [Lesson 15: Scaling features](15-scaling.md)
