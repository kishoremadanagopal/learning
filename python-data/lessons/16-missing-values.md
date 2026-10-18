# Lesson 16: Missing values

**You'll learn:** `isna`, `notna`, `dropna`, `fillna`, forward fill, flagging gaps, `na_values`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python-data/#missing-values)**: run every example and check your exercise answers.

## Key terms

- **Missing value:** a gap in the data, shown as `NaN`, `None` or `<NA>`.
- **isna / notna:** True where a value is missing / present.
- **dropna:** removes rows (or columns) with missing values.
- **fillna:** replaces missing values with something you choose.
- **Imputation:** filling missing values with an estimate, such as the median.
- **Forward fill (ffill):** filling a gap with the previous value, common for time series.
- **na_values:** tells `read_csv` which extra strings (like `"-"`) mean missing.

Almost every real dataset has gaps: a sensor that didn't report, a form field left blank, a film with no box-office figure. pandas marks them as **missing** (shown as `NaN`, `None` or `<NA>`). Most summaries skip them quietly, which is convenient but can hide problems. So the first job is to find them.

## Finding missing values

`isna()` gives True where a value is missing. Add `.sum()` to count per column:

![A map of employees_messy.csv with every missing value shaded orange, showing which columns have gaps](../figures/missing-map.svg)

```python
import pandas as pd

weather = pd.read_csv("weather.csv")
print(weather.isna().sum())
print("Rows with any gap:", weather.isna().any(axis=1).sum())
```

Look at the rows themselves before deciding what to do:

```python
import pandas as pd

weather = pd.read_csv("weather.csv")
print(weather[weather["temp_c"].isna()].head())
```

`notna()` is the opposite, handy for keeping only complete rows of one column.

## How missing values behave

```python
import pandas as pd

movies = pd.read_json("movies.json")
box = movies["box_office_musd"]
print(len(box), box.count())     # count() skips the missing ones
print(box.mean())                # the mean of the 37 known values
print(box.sum())
```

The mean is the average of the films **with** a figure. That's often right, but always say so ("average box office of the 37 films with data").

## Option 1: drop them

`dropna()` removes rows with a missing value. `subset=` limits which columns to look at:

```python
import pandas as pd

employees = pd.read_csv("employees_messy.csv")
print(len(employees))
print(len(employees.dropna()))                     # any column missing: drop
print(len(employees.dropna(subset=["salary"])))    # only if salary is missing
```

Dropping is fine when only a few rows are affected and they're not special. Here `dropna()` would throw away 12 of 40 rows, far too many. Notice that `subset` lets you drop only rows that lack the value **this** analysis needs.

## Option 2: fill them

`fillna(value)` replaces missing values. What you fill with is a judgement call:

| Situation | Fill with |
|---|---|
| a missing count really means none | `0` |
| a missing category | a label like `"Unknown"` |
| a number roughly typical of its column | the median (or mean) |
| a reading in a time series | the previous value (`ffill`) |

```python
import pandas as pd

employees = pd.read_csv("employees_messy.csv")
employees["email"] = employees["email"].fillna("unknown")
print(employees["email"].isna().sum())

movies = pd.read_json("movies.json")
median_box = movies["box_office_musd"].median()
movies["box_filled"] = movies["box_office_musd"].fillna(median_box)
print(movies[movies["box_office_musd"].isna()][["title", "box_office_musd", "box_filled"]])
```

For a time series, the day before is usually the best guess for a missing day. Sort by date first, and fill **within each city**, otherwise London's last value could fill Mumbai's gap:

```python
import pandas as pd

weather = pd.read_csv("weather.csv").sort_values(["city", "date"])
weather["temp_filled"] = weather.groupby("city")["temp_c"].ffill()
gaps = weather["temp_c"].isna()
print(weather[gaps][["date", "city", "temp_c", "temp_filled"]].head())
```

`groupby` gets a full lesson in Part 5; here it just means "do this separately for each city".

## Option 3: flag them

Sometimes the fact that a value is missing is information. Keep a True/False column so it isn't lost:

```python
import pandas as pd

movies = pd.read_json("movies.json")
movies["box_office_known"] = movies["box_office_musd"].notna()
print(movies["box_office_known"].value_counts())
```

## Missing values hiding as text

Files sometimes write gaps as `"N/A"`, `"-"` or `"missing"`. pandas only recognises some of these, so tell `read_csv` with `na_values`:

```python
import io
import pandas as pd

text = "city,temp\nLeeds,14\nYork,-\nHull,missing\n"
print(pd.read_csv(io.StringIO(text)))
print(pd.read_csv(io.StringIO(text), na_values=["-", "missing"]))
```

`io.StringIO` lets `read_csv` read from a string as if it were a file, which is handy for small tests.

## Common mistakes

- Calling `dropna()` without thinking and losing a large part of the data. Check how many rows it removes; use `subset=` to target the columns you need.
- Filling with 0 when missing doesn't mean zero. It drags averages down and invents data.
- Forward-filling unsorted data, or across groups. Sort by date and fill within each group.

## Exercises

### 1. Count the gaps

Load `employees_messy.csv` and store the number of missing values **in each column** in `missing` (a Series), and the total number of missing values in the whole table in `total_missing`.

Starter code:

```python
import pandas as pd

employees = pd.read_csv("employees_messy.csv")

```

### 2. Fill the temperatures

Load `weather.csv` and fill the missing `temp_c` values with the **median temperature of that city**. Store the result back in `weather["temp_c"]`, so no gaps remain.

Starter code:

```python
import pandas as pd

weather = pd.read_csv("weather.csv")

```

**In the sandbox:** exercises 31–32. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. `isna().sum()` counts per column; summing that Series gives the total.
2. `weather.groupby("city")["temp_c"].transform("median")` gives each row its city's median. Pass that to `fillna`.

</details>

<details>
<summary>Answers</summary>

**1. Count the gaps**

```python
import pandas as pd

employees = pd.read_csv("employees_messy.csv")
missing = employees.isna().sum()
total_missing = missing.sum()
print(missing)
print(total_missing)
```

**2. Fill the temperatures**

```python
import pandas as pd

weather = pd.read_csv("weather.csv")
city_median = weather.groupby("city")["temp_c"].transform("median")
weather["temp_c"] = weather["temp_c"].fillna(city_median)
print(weather["temp_c"].isna().sum())
```

</details>

## Quick quiz

1. What does `df.isna().sum()` show?
   - A) The sum of each column
   - B) The number of rows
   - C) The number of missing values in each column

2. When is `fillna(0)` a good choice?
   - A) Always
   - B) For temperatures
   - C) When a missing value really means zero, like "no sales recorded"

3. What does `dropna(subset=["salary"])` drop?
   - A) Every row with any missing value
   - B) The salary column
   - C) Only rows where salary is missing

<details>
<summary>Quiz answers</summary>

1. **C) The number of missing values in each column**: `isna()` marks gaps as True, and summing counts them per column.
2. **C) When a missing value really means zero, like "no sales recorded"**: Filling with 0 claims the value was zero. That's only right when missing really means none.
3. **C) Only rows where salary is missing**: `subset` limits the check to the listed columns.

</details>

---
Previous: [Lesson 15](15-summarising-data.md) · Next: [Lesson 17: Fixing data types](17-data-types.md)
