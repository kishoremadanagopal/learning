# Lesson 24: Final project: a churn model, start to finish

**You'll learn:** framing a business question, choosing a success measure, splitting first, baseline, pipeline, comparing models with CV, tuning, choosing a threshold with cross_val_predict, the single final test, permutation importance on a pipeline, the final report.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ml/#final-project)**: run every example and check your exercise answers.

## Key terms

- **Success measure:** the metric and target agreed before modelling, such as recall of at least 0.7.
- **cross_val_predict:** returns, for every training row, the prediction from the CV round in which that row was held out.
- **Out-of-fold prediction:** a prediction for a row made by a model that didn't train on it.
- **Final test:** the single, last evaluation on the untouched test set.
- **Deliverable:** what the project hands over: the model, its honest numbers, explanations and limits.

A phone company wants to call customers who are likely to leave and offer them a deal. The retention team can make a few hundred calls a month and wants to **reach at least 70% of the customers who would leave**. Your job: build the model that picks whom to call, and report honestly how well it will work.

![The project's steps in order: 1. question and success measure, 2. split off a test set, 3. baseline, 4. pipeline, 5. compare models with cross-validation, 6. tune the winner, 7. choose the threshold with cross-validated predictions, 8. test once, 9. explain and report](../figures/project-steps.svg)

## 1–2. Frame it and split it

- **Prediction:** the probability that a customer leaves (`churned = 1`).
- **Success measure:** recall of at least 0.7 (catch 70% of leavers), with precision as high as possible (fewer wasted calls). AUC to compare models.
- **Split first**, stratified, and put the test set away until the end.

```python
import pandas as pd
from sklearn.model_selection import train_test_split

churn = pd.read_csv("churn.csv")
X = churn.drop(columns=["customer_id", "churned"])
y = churn["churned"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=0, stratify=y)

print("training rows:", len(X_train), " test rows:", len(X_test))
print("churn rate in training:", y_train.mean().round(3))
print(X_train.isna().sum()[X_train.isna().sum() > 0])
```

## 3–5. Baseline, pipeline, compare

```python
import pandas as pd
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline, make_pipeline
from sklearn.dummy import DummyClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import HistGradientBoostingClassifier

churn = pd.read_csv("churn.csv")
X = churn.drop(columns=["customer_id", "churned"])
y = churn["churned"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=0, stratify=y)

numeric = ["tenure_months", "monthly_charge", "support_calls", "age", "data_gb"]
prep = ColumnTransformer([
    ("num", make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), numeric),
    ("cat", OneHotEncoder(handle_unknown="ignore"), ["contract", "plan"]),
])
for name, model in [("baseline", DummyClassifier()),
                    ("logistic regression", LogisticRegression(max_iter=1000)),
                    ("gradient boosting", HistGradientBoostingClassifier(learning_rate=0.05, max_depth=3, random_state=0))]:
    scores = cross_val_score(Pipeline([("prep", prep), ("model", model)]), X_train, y_train, cv=5, scoring="roc_auc")
    print(f"{name:<20} CV AUC {scores.mean():.3f} ± {scores.std():.3f}")
```

Both real models beat the baseline by a mile and tie with each other. Logistic regression is simpler, faster and easier to explain to the retention team, so it goes forward.

## 6. Tune it

```python
import pandas as pd
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline, make_pipeline
from sklearn.linear_model import LogisticRegression

churn = pd.read_csv("churn.csv")
X = churn.drop(columns=["customer_id", "churned"])
y = churn["churned"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=0, stratify=y)
numeric = ["tenure_months", "monthly_charge", "support_calls", "age", "data_gb"]
prep = ColumnTransformer([
    ("num", make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), numeric),
    ("cat", OneHotEncoder(handle_unknown="ignore"), ["contract", "plan"]),
])
pipe = Pipeline([("prep", prep), ("model", LogisticRegression(max_iter=1000))])

search = GridSearchCV(pipe, {"model__C": [0.01, 0.03, 0.1, 0.3, 1, 3]}, cv=5, scoring="roc_auc")
search.fit(X_train, y_train)
print(search.best_params_, "CV AUC", round(search.best_score_, 3))
```

The best C gives a CV AUC of about 0.815. The differences between C values from 0.1 upward are tiny (Lesson 19), so the choice hardly matters, which is reassuring.

## 7. Choose the threshold, without the test set

You need probabilities for rows the model **didn't train on**, but you can't use the test set yet. `cross_val_predict` gives exactly that: each training row's prediction comes from the CV round in which it was in the validation fold.

```python
import pandas as pd
from sklearn.model_selection import train_test_split, cross_val_predict
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline, make_pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import precision_score, recall_score

churn = pd.read_csv("churn.csv")
X = churn.drop(columns=["customer_id", "churned"])
y = churn["churned"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=0, stratify=y)
numeric = ["tenure_months", "monthly_charge", "support_calls", "age", "data_gb"]
prep = ColumnTransformer([
    ("num", make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), numeric),
    ("cat", OneHotEncoder(handle_unknown="ignore"), ["contract", "plan"]),
])
pipe = Pipeline([("prep", prep), ("model", LogisticRegression(C=3, max_iter=1000))])

cv_proba = cross_val_predict(pipe, X_train, y_train, cv=5, method="predict_proba")[:, 1]
for t in [0.5, 0.4, 0.35, 0.3, 0.25]:
    pred = (cv_proba >= t).astype(int)
    print(f"threshold {t:<4}  recall {recall_score(y_train, pred):.2f}  precision {precision_score(y_train, pred):.2f}  calls {pred.sum()} of {len(pred)}")
```

A threshold of **0.3** is the highest one that reaches the 70% recall target, with about half of the calls going to real leavers.

## 8–9. Test once, explain, report

Now, and only now, the test set:

```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline, make_pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import precision_score, recall_score, roc_auc_score
from sklearn.inspection import permutation_importance

churn = pd.read_csv("churn.csv")
X = churn.drop(columns=["customer_id", "churned"])
y = churn["churned"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=0, stratify=y)
numeric = ["tenure_months", "monthly_charge", "support_calls", "age", "data_gb"]
prep = ColumnTransformer([
    ("num", make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), numeric),
    ("cat", OneHotEncoder(handle_unknown="ignore"), ["contract", "plan"]),
])
final = Pipeline([("prep", prep), ("model", LogisticRegression(C=3, max_iter=1000))]).fit(X_train, y_train)

proba = final.predict_proba(X_test)[:, 1]
calls = (proba >= 0.3).astype(int)
print("test AUC:      ", round(roc_auc_score(y_test, proba), 3))
print("test recall:   ", round(recall_score(y_test, calls), 3))
print("test precision:", round(precision_score(y_test, calls), 3))
print("calls:", calls.sum(), "of", len(calls), "customers")

imp = permutation_importance(final, X_test, y_test, scoring="roc_auc", n_repeats=10, random_state=0)
print(pd.Series(imp.importances_mean, index=X_test.columns).round(3).sort_values(ascending=False))
```

Permutation importance works on the **raw** columns here, because the whole pipeline is shuffled-and-scored as one model: contract type, tenure and support calls are what the model relies on.

The report for the retention team, in plain words:

> **Churn model, version 1.** Calling everyone the model scores at 30% or higher reaches about 3 in 4 customers who would leave (test recall 0.75), by calling about 2 in 5 customers. About half of those calls go to customers who really were about to leave (precision 0.53). The strongest warning signs are a month-to-month contract, a short time as a customer, and repeated support calls. Tested on 250 customers the model never saw. To be retrained monthly and checked for drift; not for pricing or credit decisions.

That's a real deliverable: a number people can plan with, an honest measure of it, the reasons behind it, and its limits.

## Where to go next

- **Practice on new data:** try the same steps on other datasets (Kaggle and the UCI repository have hundreds).
- **Go deeper on models:** XGBoost and LightGBM for tables; **PyTorch** for neural networks (images, text, audio).
- **Into AI engineering:** embeddings, retrieval-augmented generation (RAG), and evaluating LLM systems all build on what you now know: features, splits, metrics, leakage and monitoring.

## Common mistakes

- Starting with models before agreeing what success looks like.
- Choosing the threshold, the model or the features by looking at test scores.
- Reporting only the best number, without the baseline, the threshold or the limits.

## Exercises

### 1. Pick the threshold

Using the cross-validated probabilities below, find the **highest** threshold from `[0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15]` whose recall on the training labels is **at least 0.75**. Store it in `threshold`, and the precision at that threshold in `precision_at_t`.

Starter code:

```python
import pandas as pd
from sklearn.model_selection import train_test_split, cross_val_predict
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline, make_pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import precision_score, recall_score

churn = pd.read_csv("churn.csv")
X = churn.drop(columns=["customer_id", "churned"])
y = churn["churned"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=0, stratify=y)
numeric = ["tenure_months", "monthly_charge", "support_calls", "age", "data_gb"]
prep = ColumnTransformer([
    ("num", make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), numeric),
    ("cat", OneHotEncoder(handle_unknown="ignore"), ["contract", "plan"]),
])
pipe = Pipeline([("prep", prep), ("model", LogisticRegression(C=3, max_iter=1000))])
cv_proba = cross_val_predict(pipe, X_train, y_train, cv=5, method="predict_proba")[:, 1]

```

### 2. The final report numbers

Fit the final pipeline (`C=3`) on the training data. On the **test** set, using a threshold of **0.25**, store the recall in `test_recall`, the precision in `test_precision`, and the number of customers to call in `n_calls`.

Starter code:

```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline, make_pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import precision_score, recall_score

churn = pd.read_csv("churn.csv")
X = churn.drop(columns=["customer_id", "churned"])
y = churn["churned"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=0, stratify=y)
numeric = ["tenure_months", "monthly_charge", "support_calls", "age", "data_gb"]
prep = ColumnTransformer([
    ("num", make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), numeric),
    ("cat", OneHotEncoder(handle_unknown="ignore"), ["contract", "plan"]),
])
final = Pipeline([("prep", prep), ("model", LogisticRegression(C=3, max_iter=1000))])

```

**In the sandbox:** exercises 47–48. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Loop from the highest threshold down and `break` at the first one whose recall reaches 0.75.
2. Fit on the training data, take `predict_proba(X_test)[:, 1]`, apply the threshold, then compute the metrics against `y_test`.

</details>

<details>
<summary>Answers</summary>

**1. Pick the threshold**

```python
import pandas as pd
from sklearn.model_selection import train_test_split, cross_val_predict
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline, make_pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import precision_score, recall_score

churn = pd.read_csv("churn.csv")
X = churn.drop(columns=["customer_id", "churned"])
y = churn["churned"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=0, stratify=y)
numeric = ["tenure_months", "monthly_charge", "support_calls", "age", "data_gb"]
prep = ColumnTransformer([
    ("num", make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), numeric),
    ("cat", OneHotEncoder(handle_unknown="ignore"), ["contract", "plan"]),
])
pipe = Pipeline([("prep", prep), ("model", LogisticRegression(C=3, max_iter=1000))])
cv_proba = cross_val_predict(pipe, X_train, y_train, cv=5, method="predict_proba")[:, 1]

for t in [0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15]:     # from high to low
    pred = (cv_proba >= t).astype(int)
    if recall_score(y_train, pred) >= 0.75:
        threshold = t
        precision_at_t = precision_score(y_train, pred)
        break
print(threshold, round(precision_at_t, 3))
```

**2. The final report numbers**

```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline, make_pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import precision_score, recall_score

churn = pd.read_csv("churn.csv")
X = churn.drop(columns=["customer_id", "churned"])
y = churn["churned"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=0, stratify=y)
numeric = ["tenure_months", "monthly_charge", "support_calls", "age", "data_gb"]
prep = ColumnTransformer([
    ("num", make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), numeric),
    ("cat", OneHotEncoder(handle_unknown="ignore"), ["contract", "plan"]),
])
final = Pipeline([("prep", prep), ("model", LogisticRegression(C=3, max_iter=1000))])

final.fit(X_train, y_train)
calls = (final.predict_proba(X_test)[:, 1] >= 0.25).astype(int)
test_recall = recall_score(y_test, calls)
test_precision = precision_score(y_test, calls)
n_calls = int(calls.sum())
print(round(test_recall, 3), round(test_precision, 3), n_calls)
```

</details>

## Quick quiz

1. In the project, why choose the threshold with cross_val_predict on the training set?
   - A) Because the test set is too small
   - B) cross_val_predict is faster
   - C) So the test set stays unseen until the final, honest check

2. Two models tie in cross-validation. Which should usually go forward?
   - A) The simpler, faster, easier-to-explain one
   - B) The more complex one
   - C) Both, averaged

3. What belongs in the final report?
   - A) Only the AUC
   - B) The honest test numbers in plain words, what drives the predictions, and the model's limits
   - C) The training accuracy

4. The retention team later asks for 90% recall. What changes?
   - A) Lower the threshold (chosen again on validation data); expect more calls and lower precision
   - B) Retrain with a bigger test set
   - C) Nothing can be done

<details>
<summary>Quiz answers</summary>

1. **C) So the test set stays unseen until the final, honest check**: Any choice made with the test set makes the final test score optimistic.
2. **A) The simpler, faster, easier-to-explain one**: Equal performance plus simplicity wins.
3. **B) The honest test numbers in plain words, what drives the predictions, and the model's limits**: People need numbers they can plan with, the reasons, and the boundaries.
4. **A) Lower the threshold (chosen again on validation data); expect more calls and lower precision**: Recall and precision trade off through the threshold.

</details>

---
Previous: [Lesson 23](23-model-to-product.md) · Back to the [course home](../README.md)
