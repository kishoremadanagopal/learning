# Lesson 19: Duplicates and impossible values

**You'll learn:** `duplicated`, `drop_duplicates`, `subset` and `keep`, impossible values, `mask`, `clip`, the IQR rule.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python-data/#duplicates-and-outliers)**: run every example and check your exercise answers.

## Key terms

- **Duplicate:** a row that repeats another, completely or by its key.
- **Key:** a column that should uniquely identify each row, such as an order ID.
- **drop_duplicates:** removes repeated rows; `subset=` checks only some columns, `keep=` chooses which copy stays.
- **Impossible value:** a value that can't be true, like a negative age.
- **mask:** replaces values with missing where a condition is True.
- **clip:** caps values at a lower and upper limit.
- **Outlier:** a value far from the others, which may be an error or genuinely unusual.
- **IQR (interquartile range):** the third quartile minus the first: the spread of the middle half of the data.

Two more problems spoil results quietly: rows counted twice, and values that can't be right (an age of 230, a negative price). Neither causes an error. You only find them by looking.

## Exact duplicates

`duplicated()` marks every row that repeats an earlier one. `drop_duplicates()` removes them:

```python
import pandas as pd

employees = pd.read_csv("employees_messy.csv")
print("duplicate rows:", employees.duplicated().sum())
print(employees[employees.duplicated(keep=False)].sort_values("emp_id")[["emp_id", "name"]])

employees = employees.drop_duplicates()
print(len(employees), "rows left")
```

`keep=False` marks **all** copies, so you can see both the original and the repeat.

## Duplicates by key

Often the rows aren't identical (one has a typo fixed), but the **key** (the ID that should be unique) repeats. Use `subset=`:

```python
import pandas as pd

log = pd.DataFrame({
    "order_id": [1, 2, 2, 3],
    "status":   ["sent", "packed", "sent", "sent"],
    "updated":  ["09:00", "09:05", "11:30", "10:00"],
})
print(log.duplicated(subset=["order_id"]).sum(), "repeated order ids")
latest = log.sort_values("updated").drop_duplicates(subset=["order_id"], keep="last")
print(latest)
```

`keep="last"` keeps the final version of each order. Sorting first makes "last" mean "most recent".

Duplicates can also hide behind formatting: `"MEI BROWN"` and `"Mei Brown"` only match after cleaning the text. Clean first, then de-duplicate.

## Impossible values

`describe()` shows the minimum and maximum of every number column, which is where impossible values show up:

```python
import pandas as pd

employees = pd.read_csv("employees_messy.csv")
print(employees["age"].describe())
print(employees[(employees["age"] < 16) | (employees["age"] > 100)][["emp_id", "name", "age"]])
```

An employee can't be 230 or -1. These are typing errors. The safest fix is to mark them as missing (you can't know the true age), using `mask`:

```python
import pandas as pd

employees = pd.read_csv("employees_messy.csv")
bad = (employees["age"] < 16) | (employees["age"] > 100)
employees["age"] = employees["age"].mask(bad)
print(employees["age"].describe())
```

`mask(condition)` replaces values where the condition is True with missing. (Its opposite, `where`, keeps values where the condition is True.)

## Capping with clip

When values are possible but extreme and you want to limit their effect, `clip` caps them at a floor and ceiling:

```python
import pandas as pd

scores = pd.Series([45, 102, 88, -5, 67])
print(scores.clip(lower=0, upper=100))
```

## Outliers

An **outlier** is a value far from the rest. Unlike an impossible value, it might be real: a genuinely huge order, a heatwave day. A common rule of thumb uses the **IQR** (interquartile range, the spread of the middle half of the data): anything more than 1.5 × IQR beyond the quartiles is flagged.

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
sales["revenue"] = sales["units"] * sales["unit_price"]

q1, q3 = sales["revenue"].quantile([0.25, 0.75])
iqr = q3 - q1
high = q3 + 1.5 * iqr
outliers = sales[sales["revenue"] > high]
print(f"Q1 {q1}, Q3 {q3}, cut-off {high}")
print(len(outliers), "unusually large orders")
print(outliers["product"].value_counts())
```

The "outliers" here are all laptop, monitor and desk-chair orders: perfectly real, just expensive. That's the lesson: **flag outliers and investigate; don't delete them automatically.**

## Common mistakes

- De-duplicating before cleaning text, so `"MEI BROWN"` and `"Mei Brown"` both survive.
- Deleting outliers automatically. Check them first: they might be your most important customers.
- "Fixing" impossible values with a guess (230 → 23). Mark them missing unless you know the true value.

## Exercises

### 1. Remove the repeats

Load `employees_messy.csv`, remove exact duplicate rows, and store the result in `unique_emps`. Store the number of rows that were removed in `removed`.

Starter code:

```python
import pandas as pd

employees = pd.read_csv("employees_messy.csv")

```

### 2. Impossible ages

Load `employees_messy.csv` and replace every `age` below 16 or above 100 with a missing value, using `mask`. Store the cleaned table in `employees` and the oldest valid age in `oldest`.

Starter code:

```python
import pandas as pd

employees = pd.read_csv("employees_messy.csv")

```

**In the sandbox:** exercises 37–38. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. `drop_duplicates()`, then compare the lengths before and after.
2. Build the condition with `|`, then `employees["age"].mask(bad)`.

</details>

<details>
<summary>Answers</summary>

**1. Remove the repeats**

```python
import pandas as pd

employees = pd.read_csv("employees_messy.csv")
unique_emps = employees.drop_duplicates()
removed = len(employees) - len(unique_emps)
print(removed)
```

**2. Impossible ages**

```python
import pandas as pd

employees = pd.read_csv("employees_messy.csv")
bad = (employees["age"] < 16) | (employees["age"] > 100)
employees["age"] = employees["age"].mask(bad)
oldest = employees["age"].max()
print(oldest)
```

</details>

## Quick quiz

1. What does `df.duplicated()` mark as True?
   - A) Every row that has a copy, including the first
   - B) Rows with missing values
   - C) Each row that repeats an earlier row

2. An age of 230 appears. What's usually the best fix?
   - A) Mark it as missing, since the true value is unknown
   - B) Change it to 23
   - C) Delete the whole column

3. Why not delete every outlier?
   - A) pandas can't delete rows
   - B) Outliers can be real and important, like a very large genuine order
   - C) Outliers are always errors

<details>
<summary>Quiz answers</summary>

1. **C) Each row that repeats an earlier row**: By default the first copy is kept (False) and later repeats are True. `keep=False` marks all copies.
2. **A) Mark it as missing, since the true value is unknown**: Guessing could be wrong. Marking it missing is honest, and you can decide later whether to fill it.
3. **B) Outliers can be real and important, like a very large genuine order**: Investigate first. Impossible values are errors; unusual ones may be the most interesting rows.

</details>

---
Previous: [Lesson 18](18-text-cleaning.md) · Next: [Lesson 20: Dates and times](20-dates-and-times.md)
