# Lesson 10: The Series

**You'll learn:** `pd.Series`, the index, label alignment, `value_counts`, `unique`, `nunique`, `idxmax`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python-data/#pandas-series)**: run every example and check your exercise answers.

## Key terms

- **Series:** a one-dimensional column of values, each with a label.
- **Index:** the labels of a Series' values (or a DataFrame's rows).
- **Label alignment:** pandas matching values by index label, not position, when combining Series.
- **NaN:** "not a number", the marker pandas shows for a missing value.
- **value_counts:** counts how often each distinct value appears, most common first.
- **unique / nunique:** the distinct values, and how many there are.
- **idxmax / idxmin:** the label of the largest / smallest value.

pandas has two main objects. A **DataFrame** is a whole table. A **Series** is a single column: a list of values, each with a **label**. Every column you pull out of a table is a Series, so it's worth knowing well.

```python
import pandas as pd

units = pd.Series([12, 7, 3, 9])
print(units)
```

The left-hand numbers (0, 1, 2, 3) are the **index**: the label of each value. By default it counts from 0, like list positions. The last line says the **dtype**, the type of the values.

## Your own labels

You can label values with anything, which makes them easier to read and look up:

```python
import pandas as pd

units = pd.Series([12, 7, 3, 9], index=["Mon", "Tue", "Wed", "Thu"], name="units")
print(units)
print(units["Tue"])
```

A dictionary works too: its keys become the index.

```python
import pandas as pd

population = pd.Series({"London": 8.9, "Manchester": 0.55, "Leeds": 0.8})
print(population)
```

## Maths works like NumPy

A Series is built on a NumPy array, so vectorised maths, comparisons and masks all work the same way:

```python
import pandas as pd

prices = pd.Series([899.0, 249.0, 79.0, 4.5], index=["Laptop", "Monitor", "Headphones", "Notebook"])
print(prices * 1.2)
print(prices[prices > 100])
print(prices.mean(), prices.max())
print(prices.idxmax())     # the label of the biggest value
```

## Labels line up

When you combine two Series, pandas matches them **by label**, not by position. A label that's missing from one side gives `NaN` (missing):

```python
import pandas as pd

jan = pd.Series({"North": 120, "South": 95, "East": 80})
feb = pd.Series({"South": 110, "North": 130, "West": 60})
print(jan + feb)
```

North and South were added correctly even though they were in a different order. East and West only appear once, so their totals are missing. You'll fix those with `fill_value` or `fillna` later.

```python
import pandas as pd

jan = pd.Series({"North": 120, "South": 95, "East": 80})
feb = pd.Series({"South": 110, "North": 130, "West": 60})
print(jan.add(feb, fill_value=0))
```

## Counting values

`value_counts()` is one of the most-used methods in pandas. It counts how often each value appears, biggest first:

```python
import pandas as pd

answers = pd.Series(["yes", "no", "yes", "maybe", "yes", "no"])
print(answers.value_counts())
print(answers.value_counts(normalize=True).round(2))   # shares instead of counts
print(answers.unique(), answers.nunique())
```

## Useful Series methods

```python
import pandas as pd

temps = pd.Series([14.2, 17.8, 13.1, 21.5, 19.0])
print(temps.sort_values(ascending=False))
print(temps.round(0))
print(temps.describe())
```

`describe()` gives a quick summary: the count, mean, standard deviation, minimum, quartiles and maximum.

## Common mistakes

- Expecting two Series to add by position. They line up by label; different labels give NaN. Use `.add(other, fill_value=0)` if you want missing labels treated as 0.
- Writing `pd.series(...)`. The class names start with capitals: `pd.Series`, `pd.DataFrame`.
- Confusing `count()` (non-missing values) with `value_counts()` (how often each value appears).

## Exercises

### 1. Weekly steps

Make a Series called `steps` with the values `8200, 10450, 6300, 12100, 9800` and the labels `"Mon"` to `"Fri"`. Then store the label of the day with the most steps in `best_day`.

Starter code:

```python
import pandas as pd

```

### 2. Favourite colours

Count how many times each colour appears in `colours` and store the result in `counts`. Then store the share (between 0 and 1) of answers that were `"blue"` in `blue_share`.

Starter code:

```python
import pandas as pd

colours = pd.Series(["blue", "green", "blue", "red", "blue", "green", "blue", "red"])

```

**In the sandbox:** exercises 19–20. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Pass `index=["Mon", ...]` when you create the Series, then use `.idxmax()`.
2. `colours.value_counts()` counts; `value_counts(normalize=True)` gives shares.

</details>

<details>
<summary>Answers</summary>

**1. Weekly steps**

```python
import pandas as pd

steps = pd.Series([8200, 10450, 6300, 12100, 9800], index=["Mon", "Tue", "Wed", "Thu", "Fri"])
best_day = steps.idxmax()
print(steps)
print(best_day)
```

**2. Favourite colours**

```python
import pandas as pd

colours = pd.Series(["blue", "green", "blue", "red", "blue", "green", "blue", "red"])
counts = colours.value_counts()
blue_share = colours.value_counts(normalize=True)["blue"]
print(counts)
print(blue_share)
```

</details>

## Quick quiz

1. What is the index of a Series?
   - A) The number of values
   - B) The labels attached to the values
   - C) The type of the values

2. You add two Series. How does pandas pair the values up?
   - A) By position
   - B) By matching labels
   - C) Randomly

3. Which method counts how often each value appears?
   - A) `count()`
   - B) `value_counts()`
   - C) `describe()`

<details>
<summary>Quiz answers</summary>

1. **B) The labels attached to the values**: The index labels each value. By default it's 0, 1, 2…, but it can be any labels you like.
2. **B) By matching labels**: pandas aligns on the index labels. Labels missing from one side give NaN.
3. **B) `value_counts()`**: `value_counts()` returns each distinct value with its count, most common first. `count()` just counts non-missing values.

</details>

---
Previous: [Lesson 9](09-random-and-simulation.md) · Next: [Lesson 11: DataFrames and loading data](11-dataframes.md)
