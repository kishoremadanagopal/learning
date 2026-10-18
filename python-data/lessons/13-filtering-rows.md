# Lesson 13: Filtering rows

**You'll learn:** boolean masks, `&`, `|`, `~`, `isin`, `between`, filtering text and dates, `query`, `loc` with a mask.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python-data/#filtering-rows)**: run every example and check your exercise answers.

## Key terms

- **Filter:** keeping only the rows that meet a condition.
- **Boolean mask:** a Series of True/False values, one per row, used to filter.
- **isin:** True where a value is one of a given list.
- **between:** True where a value lies within a range (both ends included).
- **query:** filters rows using a condition written as text.
- **& | ~:** "and", "or" and "not" for masks.

"Show me only the orders from the North" or "students who scored over 80" are **filters**. In pandas a filter is a boolean mask, exactly as in NumPy, but applied to whole rows.

## One condition

A comparison on a column gives a Series of True/False. Put it inside `df[...]` to keep the matching rows:

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
is_laptop = sales["product"] == "Laptop"
print(is_laptop.head())
laptops = sales[is_laptop]
print(len(laptops), "laptop orders")
print(laptops.head(3))
```

Usually it's written in one go:

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
big = sales[sales["units"] >= 10]
print(big[["order_id", "product", "units"]])
```

## Several conditions

Combine masks with `&` (and), `|` (or) and `~` (not), with **each condition in brackets**:

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
north_electronics = sales[(sales["region"] == "North") & (sales["category"] == "Electronics")]
print(len(north_electronics))

cheap_or_bulk = sales[(sales["unit_price"] < 10) | (sales["units"] >= 8)]
print(len(cheap_or_bulk))

not_office = sales[~(sales["category"] == "Office")]
print(not_office["category"].unique())
```

## isin: one of several values

`isin` is shorter than a chain of `|`:

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
desk_items = sales[sales["product"].isin(["Desk Chair", "Desk Lamp"])]
print(desk_items["product"].value_counts())
```

## between: a range

`between(low, high)` includes both ends:

```python
import pandas as pd

students = pd.read_csv("students.csv")
middle = students[students["math"].between(60, 75)]
print(middle[["student", "math"]].head())
```

## Filtering text and dates

Text columns have string methods under `.str`, which you'll see properly in Part 4. Dates stored as `YYYY-MM-DD` text even compare correctly, because that format sorts in date order:

```python
import pandas as pd

customers = pd.read_csv("customers.csv")
print(customers[customers["name"].str.startswith("A")]["name"].head())

sales = pd.read_csv("sales.csv")
march = sales[(sales["order_date"] >= "2025-03-01") & (sales["order_date"] < "2025-04-01")]
print(len(march), "orders in March")
```

## query: filters as text

`query` lets you write the condition as a readable string. Column names go in plainly, and `@` brings in a Python variable:

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
limit = 200
print(sales.query("region == 'West' and unit_price > @limit").head())
```

Both styles are common. Masks are more flexible; `query` is easier to read.

## Filter, then pick columns

Use `loc` to filter rows and choose columns in one step:

```python
import pandas as pd

students = pd.read_csv("students.csv")
print(students.loc[students["attendance_pct"] < 75, ["student", "attendance_pct", "math"]])
```

## Common mistakes

- Leaving out the brackets around each condition. Write `(df["a"] > 1) & (df["b"] < 5)`.
- Using `and`/`or` instead of `&`/`|`, which raises "The truth value of a Series is ambiguous".
- Comparing text with the wrong capitals or spaces: `"north"` doesn't match `"North"`. Check the values with `unique()` first.

## Exercises

### 1. Top students

Load `students.csv` and make `stars`, holding only the students who scored **85 or more in math AND 85 or more in science**.

Starter code:

```python
import pandas as pd

students = pd.read_csv("students.csv")

```

### 2. Big-city customers

Load `customers.csv` and make `big_city`, holding the customers whose `city` is `"London"` or `"Manchester"` and whose `segment` is `"Business"`. Use `isin`.

Starter code:

```python
import pandas as pd

customers = pd.read_csv("customers.csv")

```

**In the sandbox:** exercises 25–26. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Two conditions joined with `&`, each in its own brackets.
2. `customers["city"].isin(["London", "Manchester"]) & (customers["segment"] == "Business")`.

</details>

<details>
<summary>Answers</summary>

**1. Top students**

```python
import pandas as pd

students = pd.read_csv("students.csv")
stars = students[(students["math"] >= 85) & (students["science"] >= 85)]
print(stars)
```

**2. Big-city customers**

```python
import pandas as pd

customers = pd.read_csv("customers.csv")
big_city = customers[customers["city"].isin(["London", "Manchester"]) & (customers["segment"] == "Business")]
print(big_city)
```

</details>

## Quick quiz

1. Why does `df[df["a"] > 1 & df["b"] < 5]` go wrong?
   - A) Without brackets, `&` is applied before the comparisons
   - B) You can't filter on two columns
   - C) `&` doesn't work in pandas

2. What does `sales["product"].isin(["Pen Pack", "Notebook"])` produce?
   - A) True for rows whose product is either of those, False otherwise
   - B) The number of matching rows
   - C) A list of the two products

3. In `query`, what does the `@` in `"price > @limit"` mean?
   - A) A column called limit
   - B) Use the Python variable `limit`
   - C) A comment

<details>
<summary>Quiz answers</summary>

1. **A) Without brackets, `&` is applied before the comparisons**: `&` binds tighter than `>` and `<`, so wrap each condition: `(df["a"] > 1) & (df["b"] < 5)`.
2. **A) True for rows whose product is either of those, False otherwise**: `isin` gives a mask you can use to filter.
3. **B) Use the Python variable `limit`**: `@` refers to a variable from your code rather than a column.

</details>

---
Previous: [Lesson 12](12-selecting-data.md) · Next: [Lesson 14: Sorting and adding columns](14-sorting-and-new-columns.md)
