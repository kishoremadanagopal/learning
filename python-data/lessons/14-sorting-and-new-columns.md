# Lesson 14: Sorting and adding columns

**You'll learn:** `sort_values`, `nlargest`, new calculated columns, `np.where`, `assign`, method chains, `rename`, `drop`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python-data/#sorting-and-new-columns)**: run every example and check your exercise answers.

## Key terms

- **sort_values:** sorts rows by one or more columns.
- **ascending:** the sort direction; `ascending=False` puts the largest first.
- **nlargest / nsmallest:** the top / bottom n rows by a column.
- **Calculated column:** a new column built from other columns, like revenue = units × price.
- **assign:** returns a copy of the table with new columns added.
- **Method chain:** several methods called one after another, each on the previous result.
- **rename / drop:** change column names / remove columns.

Most analyses add a few calculated columns (like revenue) and then sort to see the biggest or smallest. This lesson covers both.

## Sorting

`sort_values` sorts by a column. It returns a **new** DataFrame; the original stays as it was.

```python
import pandas as pd

products = pd.read_csv("products.csv")
print(products.sort_values("unit_price")[["product", "unit_price"]])
print(products.sort_values("unit_price", ascending=False).head(3)[["product", "unit_price"]])
```

Sort by several columns by passing lists. Here: category A to Z, then price high to low within each category:

```python
import pandas as pd

products = pd.read_csv("products.csv")
print(products.sort_values(["category", "unit_price"], ascending=[True, False]))
```

`nlargest` and `nsmallest` are shortcuts for "sort and take the top":

```python
import pandas as pd

students = pd.read_csv("students.csv")
print(students.nlargest(3, "math")[["student", "math"]])
```

## New columns from calculations

Assigning to a new column name creates it. The calculation runs on every row at once:

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
sales["revenue"] = sales["units"] * sales["unit_price"]
sales["big_order"] = sales["revenue"] > 500
print(sales[["product", "units", "unit_price", "revenue", "big_order"]].head())
```

A column can be a fixed value, or built from text:

```python
import pandas as pd

products = pd.read_csv("products.csv")
products["currency"] = "GBP"
products["margin"] = products["unit_price"] - products["unit_cost"]
products["margin_pct"] = (products["margin"] / products["unit_price"] * 100).round(1)
products["label"] = products["product"] + " (" + products["category"] + ")"
print(products[["label", "margin", "margin_pct", "currency"]])
```

## np.where for if/else columns

You met `np.where` in Part 2. It's the usual way to make a column from a condition:

```python
import numpy as np
import pandas as pd

students = pd.read_csv("students.csv")
students["result"] = np.where(students["math"] >= 50, "pass", "fail")
print(students["result"].value_counts())
```

## assign: several columns in a chain

`assign` returns a new DataFrame with added columns, which suits step-by-step chains. `lambda d:` refers to the DataFrame at that point in the chain:

```python
import pandas as pd

top = (
    pd.read_csv("sales.csv")
    .assign(revenue=lambda d: d["units"] * d["unit_price"])
    .sort_values("revenue", ascending=False)
    .head(5)
)
print(top[["order_id", "product", "revenue"]])
```

Wrapping a chain in brackets lets you put one step per line, which reads like a recipe.

## Renaming and dropping

```python
import pandas as pd

products = pd.read_csv("products.csv")
products = products.rename(columns={"unit_price": "price", "unit_cost": "cost"})
products = products.drop(columns=["supplier"])
print(products.head(3))
```

Notice the `products = ...`. Like `sort_values`, these methods return a new table; if you don't save the result, nothing changes.

## Common mistakes

- Forgetting to save the result: `df.sort_values("x")` on its own changes nothing. Write `df = df.sort_values("x")`.
- Using `inplace=True`. It still works but is discouraged; assigning the result is clearer.
- Dividing to get a percentage and forgetting `* 100`, or rounding too early and losing accuracy in later steps.

## Exercises

### 1. Margins

Load `products.csv`, add a column `margin` (unit_price minus unit_cost), then make `by_margin`: the table sorted by `margin` from **highest to lowest**.

Starter code:

```python
import pandas as pd

products = pd.read_csv("products.csv")

```

### 2. Biggest orders

Load `sales.csv`, add a `revenue` column (units × unit_price), and store the **5 rows with the highest revenue** in `top5`.

Starter code:

```python
import pandas as pd

sales = pd.read_csv("sales.csv")

```

**In the sandbox:** exercises 27–28. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Create the column first, then `sort_values("margin", ascending=False)`.
2. `sales.nlargest(5, "revenue")`, or sort descending and take `.head(5)`.

</details>

<details>
<summary>Answers</summary>

**1. Margins**

```python
import pandas as pd

products = pd.read_csv("products.csv")
products["margin"] = products["unit_price"] - products["unit_cost"]
by_margin = products.sort_values("margin", ascending=False)
print(by_margin)
```

**2. Biggest orders**

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
sales["revenue"] = sales["units"] * sales["unit_price"]
top5 = sales.nlargest(5, "revenue")
print(top5)
```

</details>

## Quick quiz

1. After `df.sort_values("price")`, is `df` sorted?
   - A) Only if the column is numeric
   - B) Yes
   - C) No, the sorted table is returned and must be saved

2. How do you sort by category A–Z, then price high to low?
   - A) `df.sort_values("category").sort_values("price")`
   - B) `df.sort_values(["category", "price"], ascending=[True, False])`
   - C) `df.sort_values("category", "price", False)`

3. What does `df["total"] = df["a"] * df["b"]` do?
   - A) Creates a total column, row by row
   - B) Raises an error because total doesn't exist
   - C) Multiplies only the first row

<details>
<summary>Quiz answers</summary>

1. **C) No, the sorted table is returned and must be saved**: Most pandas methods return a new object. Write `df = df.sort_values("price")` to keep it.
2. **B) `df.sort_values(["category", "price"], ascending=[True, False])`**: Pass lists of columns and directions, in priority order.
3. **A) Creates a total column, row by row**: Assigning to a new name creates the column, calculated for every row at once.

</details>

---
Previous: [Lesson 13](13-filtering-rows.md) · Next: [Lesson 15: Summarising a whole table](15-summarising-data.md)
