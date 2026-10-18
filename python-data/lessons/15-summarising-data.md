# Lesson 15: Summarising a whole table

**You'll learn:** `sum`, `mean`, `median`, `agg`, `count`, `nunique`, `value_counts(normalize=True)`, `idxmax`, formatting with `:,` and `:%`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python-data/#summarising-data)**: run every example and check your exercise answers.

## Key terms

- **Summary statistic:** one number describing many, such as a total, average or count.
- **agg:** applies one or more summaries at once, like `agg(["mean", "max"])`.
- **count:** the number of values that aren't missing.
- **Share (proportion):** a part divided by the whole, between 0 and 1.
- **Percentage:** a share multiplied by 100.
- **Format code:** instructions inside an f-string's `{}` that control how a number looks, like `:,.2f` or `:.0%`.

Before grouping and charts, you need the basic question answers: how many, how much in total, what's typical, what's most common. pandas gives each in one method.

## Column summaries

The NumPy summaries all exist on Series, and they skip missing values automatically:

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
sales["revenue"] = sales["units"] * sales["unit_price"]
print("orders:     ", len(sales))
print("units sold: ", sales["units"].sum())
print("revenue:    ", sales["revenue"].sum())
print("avg order:  ", sales["revenue"].mean().round(2))
print("median:     ", sales["revenue"].median())
print("largest:    ", sales["revenue"].max())
```

## Several summaries at once

`agg` takes a list of summary names:

```python
import pandas as pd

students = pd.read_csv("students.csv")
print(students["math"].agg(["mean", "median", "min", "max", "std"]).round(1))
print(students[["math", "science", "english"]].agg(["mean", "max"]).round(1))
```

Called on a DataFrame, `mean()` and friends give one answer per column:

```python
import pandas as pd

students = pd.read_csv("students.csv")
print(students[["math", "science", "english"]].mean().round(1))
```

## Counting

`count()` counts the values that are present (not missing), `value_counts()` counts each distinct value, and `nunique()` counts how many distinct values there are:

```python
import pandas as pd

movies = pd.read_json("movies.json")
print(movies["box_office_musd"].count(), "films have a box office figure, out of", len(movies))
print(movies["genre"].nunique(), "genres")
print(movies["genre"].value_counts())
```

## Shares and percentages

`value_counts(normalize=True)` gives shares; multiply by 100 for percentages:

```python
import pandas as pd

customers = pd.read_csv("customers.csv")
print((customers["segment"].value_counts(normalize=True) * 100).round(1))
```

The mean of a True/False column is the share of True values, a trick from NumPy that works here too:

```python
import pandas as pd

students = pd.read_csv("students.csv")
print("share passing math:", (students["math"] >= 50).mean().round(2))
print("students under 80% attendance:", (students["attendance_pct"] < 80).sum())
```

## Which row has the biggest value?

`idxmax()` gives the **index label** of the largest value; pass it to `loc` to see the whole row:

```python
import pandas as pd

movies = pd.read_json("movies.json")
best = movies["rating"].idxmax()
print(best)
print(movies.loc[best])
```

## Answering a question

Putting it together. Question: *"What does a typical Electronics order look like?"*

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
sales["revenue"] = sales["units"] * sales["unit_price"]
elec = sales[sales["category"] == "Electronics"]

print(f"{len(elec)} Electronics orders ({len(elec) / len(sales):.0%} of all orders)")
print(f"Median order value: {elec['revenue'].median():,.2f}")
print(f"Most common product: {elec['product'].value_counts().idxmax()}")
print(f"Share of revenue: {elec['revenue'].sum() / sales['revenue'].sum():.0%}")
```

The format code `:.0%` turns 0.31 into `31%`, and `:,.2f` adds thousands commas and 2 decimals.

## Common mistakes

- Using `count()` to get the number of rows. It skips missing values; use `len(df)`.
- Adding up an ID column. `order_id.sum()` is a number, but it means nothing. Think about what each summary means.
- Reporting averages without counts. "Average rating 9.1" means little if it's from 2 films.

## Exercises

### 1. Movie numbers

Load `movies.json`. Store the average `rating` in `avg_rating`, the number of distinct genres in `n_genres`, and the **title** of the longest film (highest `runtime_min`) in `longest`.

Starter code:

```python
import pandas as pd

movies = pd.read_json("movies.json")

```

### 2. Segment shares

Load `customers.csv` and make `shares`: the **percentage** of customers in each `segment` (so they add up to 100).

Starter code:

```python
import pandas as pd

customers = pd.read_csv("customers.csv")

```

**In the sandbox:** exercises 29–30. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. `idxmax()` gives the row label; use it with `.loc[label, "title"]`.
2. `value_counts(normalize=True)` gives shares between 0 and 1; multiply by 100.

</details>

<details>
<summary>Answers</summary>

**1. Movie numbers**

```python
import pandas as pd

movies = pd.read_json("movies.json")
avg_rating = movies["rating"].mean()
n_genres = movies["genre"].nunique()
longest = movies.loc[movies["runtime_min"].idxmax(), "title"]
print(avg_rating, n_genres, longest)
```

**2. Segment shares**

```python
import pandas as pd

customers = pd.read_csv("customers.csv")
shares = customers["segment"].value_counts(normalize=True) * 100
print(shares.round(1))
```

</details>

## Quick quiz

1. What does `df["col"].count()` count?
   - A) The distinct values
   - B) Every row, including missing ones
   - C) The values that aren't missing

2. What does `(df["score"] >= 50).mean()` give?
   - A) The average score
   - B) The number of passing rows
   - C) The share of rows with a score of 50 or more

3. What does `idxmax()` return?
   - A) The index label of the row with the largest value
   - B) The largest value
   - C) The row number, always counting from 0

<details>
<summary>Quiz answers</summary>

1. **C) The values that aren't missing**: `count()` skips missing values. Use `len(df)` for the number of rows.
2. **C) The share of rows with a score of 50 or more**: True counts as 1 and False as 0, so the mean is the fraction of True.
3. **A) The index label of the row with the largest value**: It returns the label, which you can pass to `loc` to fetch the whole row.

</details>

---
Previous: [Lesson 14](14-sorting-and-new-columns.md) · Next: [Lesson 16: Missing values](16-missing-values.md)
