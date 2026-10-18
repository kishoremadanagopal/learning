# Lesson 9: Logistic regression: predicting yes or no

**You'll learn:** classification with probabilities, the sigmoid curve, threshold 0.5, predict_proba, reading coefficient signs, odds, more than two classes.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ml/#logistic-regression)**: run every example and check your exercise answers.

## Key terms

- **Logistic regression:** a classification model that turns a weighted sum of the features into a probability with the sigmoid curve.
- **Sigmoid:** the S-shaped function that turns any number into a value between 0 and 1.
- **Probability:** a number from 0 to 1 saying how likely something is; predict_proba returns one per class.
- **Threshold:** the probability above which a classifier says "yes"; 0.5 by default.
- **Odds:** probability ÷ (1 − probability). A 20% chance is odds of 0.25.
- **Binary classification:** classification with two classes, such as yes/no.
- **Multiclass classification:** classification with more than two classes, such as three kinds of fruit.
- **ConvergenceWarning:** a warning that training stopped before settling; fix it by raising max_iter or scaling the features.

Will this customer leave? Is this transaction fraud? Most real classification questions have two answers. Despite its name, **logistic regression** is a **classification** model, and usually the first one to try for yes/no questions.

It works in three steps:

1. Like linear regression, it adds up the features times coefficients to get a **score**. Higher score means "more likely yes".
2. It squeezes the score through the **sigmoid** (S-shaped) function, which turns any number into a **probability** between 0 and 1.
3. It turns the probability into a **decision**: yes if the probability is at least 0.5 (the **threshold**), otherwise no.

![An S-shaped curve: the model's predicted probability of churning (from 0 to 1) against tenure in months, for a customer paying 50 a month with one support call. The probability starts just above 0.5 for brand-new customers and falls towards 0 for long-standing ones. A dashed line marks the 0.5 threshold. Real customers are shown as dots at 0 (stayed) and 1 (left)](../figures/sigmoid.svg)

## Fit and predict probabilities

```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression

churn = pd.read_csv("churn.csv")
X = churn[["tenure_months", "monthly_charge", "support_calls"]]
y = churn["churned"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=0, stratify=y)

model = LogisticRegression().fit(X_train, y_train)

print(model.predict_proba(X_test.head()).round(3))   # columns: P(stayed), P(left)
print(model.predict(X_test.head()))                   # 1 if P(left) >= 0.5
print("test accuracy:", round(model.score(X_test, y_test), 3))
```

`predict_proba` gives one column per class, in the order of `model.classes_` (here 0 then 1). The second column, `predict_proba(X)[:, 1]`, is the probability of "yes": it's the one you'll use most.

The test accuracy is 0.76, against the baseline's 0.724 from Lesson 4. Better, but keep that baseline in mind: the next lesson shows why accuracy alone can be misleading here.

## Reading the coefficients

```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression

churn = pd.read_csv("churn.csv")
X = churn[["tenure_months", "monthly_charge", "support_calls"]]
y = churn["churned"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=0, stratify=y)
model = LogisticRegression().fit(X_train, y_train)

print(pd.Series(model.coef_[0], index=X.columns).round(3))
```

The **sign** tells you the direction:

- `tenure_months` is negative: the longer someone has been a customer, the **less** likely they are to leave.
- `monthly_charge` and `support_calls` are positive: higher bills and more complaints mean **more** likely to leave.

The size is harder to read than in linear regression, because it's on the "score" scale, not the probability scale. One handy fact: each extra support call multiplies the **odds** of leaving by e^0.475 ≈ 1.6. (Odds are probability ÷ (1 − probability): a 20% chance is odds of 0.25.) The same coefficient moves the **probability** by different amounts depending on where on the S-curve a customer is.

## More than two classes

Logistic regression also handles several classes, like the three fruits. scikit-learn does it automatically: one probability per class, summing to 1, and the prediction is the class with the highest probability.

```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression

fruit = pd.read_csv("fruit.csv")
X_train, X_test, y_train, y_test = train_test_split(
    fruit[["width_cm", "height_cm", "weight_g"]], fruit["fruit"], test_size=0.25, random_state=3, stratify=fruit["fruit"])

model = LogisticRegression(max_iter=1000).fit(X_train, y_train)
print(model.classes_)
print(model.predict_proba(X_test.head(3)).round(2))
print("test accuracy:", round(model.score(X_test, y_test), 3))
```

`max_iter=1000` gives the training more steps to settle. If you ever see a `ConvergenceWarning`, raising `max_iter` (or scaling the features, Lesson 15) usually fixes it.

## Common mistakes

- Thinking logistic regression predicts numbers because of its name. It's a classifier.
- Using predict when you need a ranking or a custom threshold. Use predict_proba(X)[:, 1].
- Reading a coefficient as "adds this much to the probability". It works on the score scale, so the effect on probability varies.

## Exercises

### 1. How likely is she to leave?

Train a `LogisticRegression` called `model` on **all** rows of `churn.csv`, using `tenure_months` and `support_calls`. Store the probability that a customer with 3 months' tenure and 4 support calls **leaves** in `p_leave` (a number between 0 and 1).

Starter code:

```python
import pandas as pd
from sklearn.linear_model import LogisticRegression

churn = pd.read_csv("churn.csv")

```

### 2. Who gets a call?

Using the split below, fit a `LogisticRegression()` on the training data. Store how many **test** customers it predicts will leave in `n_flagged`, and its test accuracy in `acc`.

Starter code:

```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression

churn = pd.read_csv("churn.csv")
X = churn[["tenure_months", "monthly_charge", "support_calls", "data_gb"]]
y = churn["churned"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=8, stratify=y)

```

**In the sandbox:** exercises 17–18. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. `model.predict_proba(customer)` returns one row with two columns; the probability of leaving is `[0, 1]` (row 0, column 1).
2. Predictions are 0s and 1s, so `.sum()` counts the predicted leavers.

</details>

<details>
<summary>Answers</summary>

**1. How likely is she to leave?**

```python
import pandas as pd
from sklearn.linear_model import LogisticRegression

churn = pd.read_csv("churn.csv")
model = LogisticRegression().fit(churn[["tenure_months", "support_calls"]], churn["churned"])

customer = pd.DataFrame({"tenure_months": [3], "support_calls": [4]})
p_leave = model.predict_proba(customer)[0, 1]
print(round(p_leave, 3))
```

**2. Who gets a call?**

```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression

churn = pd.read_csv("churn.csv")
X = churn[["tenure_months", "monthly_charge", "support_calls", "data_gb"]]
y = churn["churned"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=8, stratify=y)

model = LogisticRegression().fit(X_train, y_train)
n_flagged = model.predict(X_test).sum()      # predictions are 0/1, so the sum counts the 1s
acc = model.score(X_test, y_test)
print(n_flagged, round(acc, 3))
```

</details>

## Quick quiz

1. Logistic regression is used for:
   - A) Clustering
   - B) Classification, especially yes/no questions
   - C) Predicting numbers like prices

2. What does the sigmoid function do?
   - A) Picks the features
   - B) Removes outliers
   - C) Turns any score into a probability between 0 and 1

3. model.predict_proba(X)[:, 1] gives:
   - A) The predicted class
   - B) The probability of the second class in model.classes_ (here: leaving)
   - C) The model's accuracy

4. A coefficient for support_calls is positive. This means:
   - A) Support calls reduce churn
   - B) More support calls make the model predict a higher chance of churning
   - C) Each call adds exactly 0.47 to the probability

<details>
<summary>Quiz answers</summary>

1. **B) Classification, especially yes/no questions**: The name is historical. It predicts the probability of a class.
2. **C) Turns any score into a probability between 0 and 1**: The S-curve maps very negative scores near 0 and very positive scores near 1.
3. **B) The probability of the second class in model.classes_ (here: leaving)**: One column per class, in the order of classes_. Column 1 is class 1.
4. **B) More support calls make the model predict a higher chance of churning**: The sign gives the direction. The effect on probability isn't a fixed amount, because of the S-curve.

</details>

---
Previous: [Lesson 8](08-regularization.md) · Next: [Lesson 10: Beyond accuracy: precision and recall](10-classification-metrics.md)
