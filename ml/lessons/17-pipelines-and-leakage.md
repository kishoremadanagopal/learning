# Lesson 17: Pipelines and data leakage

**You'll learn:** Pipeline and make_pipeline, named steps, predicting from raw rows, get_feature_names_out, train-test contamination, target leakage, the "too good to be true" check.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ml/#pipelines-and-leakage)**: run every example and check your exercise answers.

## Key terms

- **Pipeline:** a chain of transformers ending in a model that fits, predicts and scores as one object.
- **named_steps:** a pipeline's steps by name, such as pipe.named_steps["model"].
- **Data leakage:** information that won't be available at prediction time getting into training, making scores look better than reality.
- **Train-test contamination:** a learned step (scaling, imputing, selecting features) seeing test or validation rows.
- **Target leakage:** a feature that is only known after the outcome, or is caused by it.
- **SelectKBest:** a step that keeps the k features most related to the label.
- **get_feature_names_out:** returns the names of the columns a transformer produces.

A **Pipeline** chains transformers and a final model into one object that behaves like a model:

![A pipeline diagram. Raw rows with text and gaps go into a ColumnTransformer, where numeric columns are imputed and scaled and categorical columns are one-hot encoded, then into LogisticRegression, which outputs churn probabilities. pipe.fit(X_train, y_train) fits every step on the training data in order; pipe.predict(new_rows) applies the same learned steps to new rows](../figures/pipeline.svg)

- `pipe.fit(X_train, y_train)`: each step learns from the **training data** (the imputer its medians, the scaler its means, the encoder its categories) and passes the transformed data on; the last step, the model, trains on the result.
- `pipe.predict(X_new)`: the new rows go through the **same learned** steps, then the model predicts.

You've used `make_pipeline` since Lesson 7. `Pipeline` is the same, but you name each step yourself, which makes them easier to reach later.

## The full churn pipeline

```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline, make_pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score

churn = pd.read_csv("churn.csv")
X = churn.drop(columns=["customer_id", "churned"])
y = churn["churned"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=0, stratify=y)

numeric = ["tenure_months", "monthly_charge", "support_calls", "age", "data_gb"]
categorical = ["contract", "plan"]
prep = ColumnTransformer([
    ("num", make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), numeric),
    ("cat", OneHotEncoder(handle_unknown="ignore"), categorical),
])
pipe = Pipeline([("prep", prep), ("model", LogisticRegression())])

pipe.fit(X_train, y_train)
print("test accuracy:", round(pipe.score(X_test, y_test), 3))
print("test AUC:     ", round(roc_auc_score(y_test, pipe.predict_proba(X_test)[:, 1]), 3))
```

Accuracy 0.828 and AUC 0.844: the best churn model in the course so far, and it's "only" logistic regression. With every column prepared properly, a simple model can match or beat a forest. Good preparation often matters more than a clever model.

## Predicting from raw rows

Because the preparation is inside, the pipeline takes **raw** data: text, gaps and all. That's exactly what you need when a model goes live:

```python
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline, make_pipeline
from sklearn.linear_model import LogisticRegression

churn = pd.read_csv("churn.csv")
X = churn.drop(columns=["customer_id", "churned"])
numeric = ["tenure_months", "monthly_charge", "support_calls", "age", "data_gb"]
prep = ColumnTransformer([
    ("num", make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), numeric),
    ("cat", OneHotEncoder(handle_unknown="ignore"), ["contract", "plan"]),
])
pipe = Pipeline([("prep", prep), ("model", LogisticRegression())]).fit(X, churn["churned"])

new_customers = pd.DataFrame({
    "contract": ["month-to-month", "two-year"],
    "plan": ["basic", "premium"],
    "tenure_months": [2, 40],
    "monthly_charge": [31.5, 80.0],
    "support_calls": [4, 0],
    "age": [np.nan, 52],          # age unknown: the pipeline's imputer fills it
    "data_gb": [30.2, 12.0],
})
print(pipe.predict_proba(new_customers)[:, 1].round(3))

# reach inside: coefficients with readable names
names = pipe.named_steps["prep"].get_feature_names_out()
print(pd.Series(pipe.named_steps["model"].coef_[0], index=names).round(2).sort_values())
```

The new month-to-month customer with lots of support calls is very likely to leave; the long-standing two-year customer is not. `pipe.named_steps["model"]` (or `pipe[-1]`) reaches a step by name or position.

## Data leakage

**Data leakage** is when information that wouldn't be available at prediction time sneaks into training. The model looks great in testing and then disappoints in real use. It's one of the most common and expensive mistakes in machine learning. Two kinds:

![Two panels. Left, train-test contamination: a scaler or feature selector is fitted on all rows, including the test rows, before splitting, so the test set is no longer unseen. Right, target leakage: a feature like "cancellation fee paid" only exists after a customer has churned, so it gives away the answer](../figures/leakage.svg)

**1. Train-test contamination.** Any step that learns from data (scaling, imputing, choosing features) must learn from training rows only. Here's how dramatic it can get. The data below is **pure random noise**: 2,000 random features, random labels. No model can genuinely do better than 50%. But choose the "best" 20 features using **all** the rows first, and cross-validation (Lesson 18) reports far better than chance:

```python
import numpy as np
from sklearn.feature_selection import SelectKBest, f_classif
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score
from sklearn.pipeline import make_pipeline

rng = np.random.default_rng(5)
X = rng.normal(size=(100, 2000))        # 100 rows of random numbers
y = rng.integers(0, 2, size=100)        # random labels: nothing to learn

# WRONG: pick the 20 features most related to y using ALL rows, then evaluate
X_picked = SelectKBest(f_classif, k=20).fit_transform(X, y)
print("leaky:  ", cross_val_score(LogisticRegression(), X_picked, y, cv=5).mean().round(2))

# RIGHT: selection inside a pipeline, so it's redone on the training part of every split
pipe = make_pipeline(SelectKBest(f_classif, k=20), LogisticRegression())
print("honest: ", cross_val_score(pipe, X, y, cv=5).mean().round(2))
```

The leaky version claims 88% accuracy on pure noise, because the features were chosen by peeking at the very rows used to test. Inside a pipeline the score drops to about 0.5: a coin toss, which is the truth. **Putting every learned step inside a pipeline is the cure.**

**2. Target leakage.** A feature that's only known **after** the outcome, or is caused by it. Imagine the churn table had a column "cancellation fee paid": only people who left paid it. A model would lean on it and look nearly perfect, but at prediction time (before anyone has left) the column doesn't exist yet.

```python
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score

churn = pd.read_csv("churn.csv")
rng = np.random.default_rng(1)
# a made-up column that is only filled in AFTER someone leaves: 90% of leavers paid a fee
churn["cancel_fee_paid"] = ((churn["churned"] == 1) & (rng.random(len(churn)) < 0.9)).astype(int)

X = churn[["tenure_months", "support_calls", "cancel_fee_paid"]]
X_train, X_test, y_train, y_test = train_test_split(X, churn["churned"], test_size=0.25, random_state=0)
model = LogisticRegression().fit(X_train, y_train)
print("AUC with the leaky column:", round(roc_auc_score(y_test, model.predict_proba(X_test)[:, 1]), 3))
```

The warning sign: **results that are too good to be true.** For every feature, ask: "Would I know this value at the moment I need to make the prediction?"

## Common mistakes

- Preparing the data before splitting it, so test-set information leaks into training.
- Choosing features with the whole dataset, then evaluating on part of it.
- Keeping a feature you wouldn't have at prediction time, like a closing date or a refund.
- Celebrating a near-perfect score instead of hunting for the leak.

## Exercises

### 1. A house-price pipeline

Build a `Pipeline` called `pipe` with two steps: `"prep"`, a `ColumnTransformer` that scales `area_sqm`, `bedrooms`, `age_years` and `distance_km` with `StandardScaler` and one-hot encodes `neighborhood` (with `handle_unknown="ignore"`); and `"model"`, a `Ridge(alpha=1.0)`. Fit it on the training data and store its test R² in `r2`.

Starter code:

```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.linear_model import Ridge

housing = pd.read_csv("housing.csv")
X = housing.drop(columns=["home_id", "price_k"])
y = housing["price_k"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=1)

```

### 2. Find the leak

The code below adds three new columns to the churn data. One of them is target leakage. For each new column, fit a `LogisticRegression` on the training data using **only that column**, and compute its test AUC. Store the name of the column with the suspiciously high AUC in `leaky`.

Starter code:

```python
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score

churn = pd.read_csv("churn.csv")
rng = np.random.default_rng(7)
churn["app_logins"] = rng.poisson(9, len(churn))
churn["final_bill_refunded"] = ((churn["churned"] == 1) & (rng.random(len(churn)) < 0.85)).astype(int)
churn["emails_opened"] = rng.poisson(3, len(churn))
new_columns = ["app_logins", "final_bill_refunded", "emails_opened"]
X_train, X_test, y_train, y_test = train_test_split(churn, churn["churned"], test_size=0.25, random_state=0)

```

**In the sandbox:** exercises 33–34. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. `Pipeline([("prep", ColumnTransformer([...])), ("model", Ridge(alpha=1.0))])`, then fit and score like any model.
2. A loop over `new_columns`; for each, fit on `X_train[[col]]` and score on `X_test[[col]]`. Then ask: could you know a final bill refund before the customer leaves?

</details>

<details>
<summary>Answers</summary>

**1. A house-price pipeline**

```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.linear_model import Ridge

housing = pd.read_csv("housing.csv")
X = housing.drop(columns=["home_id", "price_k"])
y = housing["price_k"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=1)

prep = ColumnTransformer([
    ("num", StandardScaler(), ["area_sqm", "bedrooms", "age_years", "distance_km"]),
    ("cat", OneHotEncoder(handle_unknown="ignore"), ["neighborhood"]),
])
pipe = Pipeline([("prep", prep), ("model", Ridge(alpha=1.0))])
pipe.fit(X_train, y_train)
r2 = pipe.score(X_test, y_test)
print(round(r2, 3))
```

**2. Find the leak**

```python
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score

churn = pd.read_csv("churn.csv")
rng = np.random.default_rng(7)
churn["app_logins"] = rng.poisson(9, len(churn))
churn["final_bill_refunded"] = ((churn["churned"] == 1) & (rng.random(len(churn)) < 0.85)).astype(int)
churn["emails_opened"] = rng.poisson(3, len(churn))
new_columns = ["app_logins", "final_bill_refunded", "emails_opened"]
X_train, X_test, y_train, y_test = train_test_split(churn, churn["churned"], test_size=0.25, random_state=0)

aucs = {}
for col in new_columns:
    model = LogisticRegression().fit(X_train[[col]], y_train)
    aucs[col] = roc_auc_score(y_test, model.predict_proba(X_test[[col]])[:, 1])
print(aucs)
leaky = max(aucs, key=aucs.get)
```

</details>

## Quick quiz

1. What's the main benefit of putting preprocessing inside a Pipeline?
   - A) It makes the model more accurate on its own
   - B) Every step learns from the training data only, and new raw rows get exactly the same treatment
   - C) It removes the need for a test set

2. Which is target leakage?
   - A) Using customer age to predict churn
   - B) Using "account closed date" to predict whether a customer will leave
   - C) Scaling features

3. A model scores 99.8% on a hard problem. What should you do first?
   - A) Add more features
   - B) Suspect leakage and check whether any feature carries the answer
   - C) Deploy it immediately

4. In pipe = Pipeline([("prep", prep), ("model", LogisticRegression())]), how do you reach the logistic regression?
   - A) pipe.model
   - B) pipe.named_steps["model"] or pipe[-1]
   - C) pipe.steps.model

<details>
<summary>Quiz answers</summary>

1. **B) Every step learns from the training data only, and new raw rows get exactly the same treatment**: Pipelines prevent leakage and make the model easy to use on raw data.
2. **B) Using "account closed date" to predict whether a customer will leave**: The closed date only exists after the customer leaves, so it gives away the answer.
3. **B) Suspect leakage and check whether any feature carries the answer**: Results that are too good to be true usually are.
4. **B) pipe.named_steps["model"] or pipe[-1]**: Steps can be reached by name or by position.

</details>

---
Previous: [Lesson 16](16-encoding-and-missing.md) · Next: [Lesson 18: Cross-validation](18-cross-validation.md)
