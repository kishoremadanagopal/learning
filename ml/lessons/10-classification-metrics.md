# Lesson 10: Beyond accuracy: precision and recall

**You'll learn:** the confusion matrix, true/false positives and negatives, precision, recall, F1, classification_report, choosing a metric from the cost of mistakes.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ml/#classification-metrics)**: run every example and check your exercise answers.

## Key terms

- **Confusion matrix:** a table counting true negatives, false positives, false negatives and true positives.
- **Positive class:** the class you're trying to find (fraud, spam, leaving); not necessarily a good thing.
- **True positive (TP):** a positive correctly predicted as positive.
- **False positive (FP):** a negative wrongly predicted as positive; a false alarm.
- **False negative (FN):** a positive wrongly predicted as negative; a miss.
- **True negative (TN):** a negative correctly predicted as negative.
- **Precision:** TP ÷ (TP + FP): when the model says yes, how often it's right.
- **Recall:** TP ÷ (TP + FN): of all real positives, how many the model found. Also called sensitivity or true positive rate.
- **F1 score:** the harmonic mean of precision and recall; high only when both are high.
- **Support:** the number of test rows in each class, shown in classification_report.
- **Imbalanced classes:** when one class is much rarer than the other, which makes accuracy misleading.

The churn model from the last lesson is 76% accurate. Sounds decent. But the business question is: **of the customers who really leave, how many did we catch?** Accuracy can't answer that. The **confusion matrix** can.

## The confusion matrix

It counts the four possible outcomes on the test set:

![A 2-by-2 grid with real answer down the side (stayed, left) and prediction across the top (stay, leave). True negatives 167: stayed, predicted stay. False positives 14: stayed but predicted leave (false alarms). False negatives 46: left but predicted stay (missed). True positives 23: left, predicted leave (caught)](../figures/confusion-matrix.svg)

| | Predicted "stays" (0) | Predicted "leaves" (1) |
|---|---|---|
| **Really stayed (0)** | **True negative (TN)**: correctly left alone | **False positive (FP)**: a false alarm |
| **Really left (1)** | **False negative (FN)**: missed | **True positive (TP)**: caught |

"Positive" means the class you're looking for (leaving, fraud, spam), not "good".

```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import confusion_matrix

churn = pd.read_csv("churn.csv")
X = churn[["tenure_months", "monthly_charge", "support_calls"]]
y = churn["churned"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=0, stratify=y)
pred = LogisticRegression().fit(X_train, y_train).predict(X_test)

print(confusion_matrix(y_test, pred))
tn, fp, fn, tp = confusion_matrix(y_test, pred).ravel()
print("TN", tn, " FP", fp, " FN", fn, " TP", tp)
```

Of the 69 customers who really left, the model caught only **23** and missed **46**. The 76% accuracy comes mostly from correctly saying "stays" about customers who were staying anyway.

## Precision and recall

Two questions, two metrics:

| Metric | Question | Formula | Here |
|---|---|---|---|
| **Precision** | When the model says "leaves", how often is it right? | TP ÷ (TP + FP) | 23 ÷ 37 = 0.62 |
| **Recall** | Of everyone who really left, how many did it catch? | TP ÷ (TP + FN) | 23 ÷ 69 = 0.33 |
| **F1 score** | One number balancing both | 2 × P × R ÷ (P + R) | 0.43 |
| **Accuracy** | How often is it right overall? | (TP + TN) ÷ all | 190 ÷ 250 = 0.76 |

So: when this model raises the alarm it's right 62% of the time (decent precision), but it catches only a third of leavers (poor recall).

```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import precision_score, recall_score, f1_score, classification_report

churn = pd.read_csv("churn.csv")
X = churn[["tenure_months", "monthly_charge", "support_calls"]]
y = churn["churned"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=0, stratify=y)
pred = LogisticRegression().fit(X_train, y_train).predict(X_test)

print("precision:", round(precision_score(y_test, pred), 3))
print("recall:   ", round(recall_score(y_test, pred), 3))
print("F1:       ", round(f1_score(y_test, pred), 3))
print(classification_report(y_test, pred, target_names=["stayed", "left"]))
```

`classification_report` prints precision, recall and F1 for **each** class, plus **support** (how many test rows are in that class). Read the "left" row for the positive class.

## Which one matters?

It depends on which mistake costs more:

| Situation | Worse mistake | Focus on |
|---|---|---|
| Spam filter | Hiding a real email (false positive) | **Precision** |
| Cancer screening, fraud alerts | Missing a real case (false negative) | **Recall** |
| Churn: a cheap retention offer | Missing a leaver (false negative) | **Recall**, with precision not too low |
| You need one balanced number | both | **F1** |

You can usually trade one for the other: flag more people and recall goes up while precision goes down. The next lesson shows how.

## Drawing it

```python
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import ConfusionMatrixDisplay

churn = pd.read_csv("churn.csv")
X = churn[["tenure_months", "monthly_charge", "support_calls"]]
y = churn["churned"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=0, stratify=y)
model = LogisticRegression().fit(X_train, y_train)

ConfusionMatrixDisplay.from_estimator(model, X_test, y_test, display_labels=["stayed", "left"], cmap="Blues")
plt.title("Churn model on the test set")
plt.show()
```

## Common mistakes

- Judging a model on imbalanced data by accuracy alone.
- Swapping the arguments: metrics take (y_true, y_pred). For precision and recall, the order changes the answer.
- Mixing up precision and recall. Precision is about the alarms raised; recall is about the real cases.

## Exercises

### 1. Count the outcomes

Using the predictions below, store the four counts in `tn`, `fp`, `fn`, `tp`, then compute `precision` and `recall` **by hand** from them (not with the scikit-learn functions).

Starter code:

```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import confusion_matrix

churn = pd.read_csv("churn.csv")
X = churn[["tenure_months", "support_calls"]]
y = churn["churned"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=5, stratify=y)
pred = LogisticRegression().fit(X_train, y_train).predict(X_test)

```

### 2. Precision or recall?

Make a dictionary `focus` mapping each system to `"precision"` or `"recall"`, depending on which mistake is worse: `"spam filter"`, `"airport weapon scanner"`, `"recommend a film"`, `"detect a gas leak"`.

Starter code:

```python
focus = {}
```

**In the sandbox:** exercises 19–20. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. `confusion_matrix(y_test, pred).ravel()` gives the counts in the order tn, fp, fn, tp.
2. Ask "is a false alarm worse, or a miss?" False alarms hurt precision; misses hurt recall.

</details>

<details>
<summary>Answers</summary>

**1. Count the outcomes**

```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import confusion_matrix

churn = pd.read_csv("churn.csv")
X = churn[["tenure_months", "support_calls"]]
y = churn["churned"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=5, stratify=y)
pred = LogisticRegression().fit(X_train, y_train).predict(X_test)

tn, fp, fn, tp = confusion_matrix(y_test, pred).ravel()
precision = tp / (tp + fp)
recall = tp / (tp + fn)
print(tn, fp, fn, tp, round(precision, 3), round(recall, 3))
```

**2. Precision or recall?**

```python
focus = {
    "spam filter": "precision",            # a false alarm hides a real email
    "airport weapon scanner": "recall",    # missing a weapon is far worse than an extra bag check
    "recommend a film": "precision",       # bad suggestions annoy; missing one good film is harmless
    "detect a gas leak": "recall",         # never miss a real leak
}
print(focus)
```

</details>

## Quick quiz

1. A fraud model has recall 0.9. What does that mean?
   - A) It's right 90% of the time overall
   - B) 90% of its alerts are real frauds
   - C) It catches 90% of the real frauds

2. A false positive in a spam filter is:
   - A) A spam email that reached the inbox
   - B) A spam correctly blocked
   - C) A real email wrongly sent to spam

3. Why can a model be 95% accurate and still useless?
   - A) Accuracy above 90% is impossible
   - B) Because accuracy is computed on training data
   - C) If 95% of rows are one class, always predicting it scores 95% while catching nothing

4. Which metric balances precision and recall in one number?
   - A) F1 score
   - B) R²
   - C) Support

<details>
<summary>Quiz answers</summary>

1. **C) It catches 90% of the real frauds**: Recall = TP / (TP + FN): the share of real positives that were found.
2. **C) A real email wrongly sent to spam**: "Positive" is the predicted class (spam). False positive: predicted spam, but it wasn't.
3. **C) If 95% of rows are one class, always predicting it scores 95% while catching nothing**: With imbalanced classes, look at recall and precision for the rare class.
4. **A) F1 score**: F1 is the harmonic mean of precision and recall; it's low if either one is low.

</details>

---
Previous: [Lesson 9](09-logistic-regression.md) · Next: [Lesson 11: Thresholds, ROC curves and AUC](11-thresholds-roc.md)
