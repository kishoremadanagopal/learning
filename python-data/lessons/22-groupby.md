# Lesson 22: Grouping and aggregating

**You'll learn:** split-apply-combine, `groupby`, `size`, named aggregation with `agg`, grouping by several columns, `reset_index`, `transform`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python-data/#groupby)**: run every example and check your exercise answers.

## Key terms

- **groupby:** splits a table into groups by a column's values so each group can be summarised.
- **Split-apply-combine:** the three steps of grouping: split into groups, summarise each, combine the answers.
- **size():** the number of rows in each group.
- **Named aggregation:** `agg(new_name=("column", "summary"))`, which names each result column.
- **MultiIndex:** an index with more than one level, as you get when grouping by two columns.
- **transform:** a group summary repeated on every row of that group.

"Revenue **per region**", "average score **per class**", "orders **per month**": whenever a question says *per* or *by*, the answer is a **groupby**. You did it by hand with a dictionary in Part 1. pandas does it in one line.

## Split, apply, combine

`groupby` works in three steps:

![Split the rows into one group per region, apply sum to each group, then combine the answers into one small table](../figures/split-apply-combine.svg)

1. **split** the rows into groups by a column's values;
2. **apply** a summary (sum, mean, count…) to each group;
3. **combine** the answers into one result.

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
sales["revenue"] = sales["units"] * sales["unit_price"]
print(sales.groupby("region")["revenue"].sum())
```

Read it as: "group sales by region, take the revenue column, sum it". The result is a Series indexed by region. Sort it to rank the groups:

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
sales["revenue"] = sales["units"] * sales["unit_price"]
print(sales.groupby("product")["revenue"].sum().sort_values(ascending=False))
```

## Different summaries

Any summary works: `sum`, `mean`, `median`, `min`, `max`, `count`, `nunique`. And `size()` counts the rows in each group:

```python
import pandas as pd

students = pd.read_csv("students.csv")
print(students.groupby("class")["math"].mean().round(1))
print(students.groupby("class").size())
print(students.groupby("class")[["math", "science", "english"]].mean().round(1))
```

## Several summaries: named aggregation

`agg` with **named aggregation** gives you one tidy table with your own column names. Each new column is `name=("column", "summary")`:

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
sales["revenue"] = sales["units"] * sales["unit_price"]
summary = sales.groupby("region").agg(
    orders=("order_id", "count"),
    units=("units", "sum"),
    revenue=("revenue", "sum"),
    avg_order=("revenue", "mean"),
    customers=("customer_id", "nunique"),
).round(1)
print(summary.sort_values("revenue", ascending=False))
```

That one table answers five questions about every region. This is the most useful pattern in the whole course.

## Grouping by two columns

Pass a list to group by combinations. The result has a two-level index:

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
sales["revenue"] = sales["units"] * sales["unit_price"]
by_two = sales.groupby(["region", "category"])["revenue"].sum().round(0)
print(by_two)
```

`reset_index()` turns the group labels back into normal columns, which is easier to filter, merge and save:

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
sales["revenue"] = sales["units"] * sales["unit_price"]
flat = sales.groupby(["region", "category"])["revenue"].sum().reset_index()
print(flat.head(6))
print(flat[flat["category"] == "Home"])
```

## transform: a group value on every row

`transform` returns a result **the same length as the table**, so you can compare each row with its group. Here, each order's share of its region's revenue:

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
sales["revenue"] = sales["units"] * sales["unit_price"]
sales["region_total"] = sales.groupby("region")["revenue"].transform("sum")
sales["share_of_region"] = (sales["revenue"] / sales["region_total"] * 100).round(2)
print(sales[["region", "product", "revenue", "region_total", "share_of_region"]].head())
```

Another use: students who beat their own class average.

```python
import pandas as pd

students = pd.read_csv("students.csv")
class_avg = students.groupby("class")["math"].transform("mean")
above = students[students["math"] > class_avg]
print(len(above), "students beat their class average in math")
```

## Groups by a calculated value

You can group by any Series of the right length, not just a column, such as a date part:

```python
import pandas as pd

sales = pd.read_csv("sales.csv", parse_dates=["order_date"])
sales["revenue"] = sales["units"] * sales["unit_price"]
print(sales.groupby(sales["order_date"].dt.quarter)["revenue"].sum())
```

## Common mistakes

- Forgetting to choose a column: `df.groupby("region").sum()` tries to add up every column, including IDs and text. Select what you need: `df.groupby("region")["revenue"].sum()`.
- Using `count()` when you want the number of rows. `count()` skips missing values; `size()` counts every row.
- Grouping on uncleaned text, so "Sales" and "sales " become separate groups. Clean first.

## Exercises

### 1. Units per category

Load `sales.csv` and store the **total units** sold in each `category` in `units_by_cat`, sorted from largest to smallest.

Starter code:

```python
import pandas as pd

sales = pd.read_csv("sales.csv")

```

### 2. City report

Load `customers.csv` and build `city_report`, indexed by `city`, with three named columns: `customers` (how many customers, counting `customer_id`), `avg_age` (mean `age`) and `oldest` (max `age`).

Starter code:

```python
import pandas as pd

customers = pd.read_csv("customers.csv")

```

**In the sandbox:** exercises 43–44. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. `sales.groupby("category")["units"].sum()`, then `.sort_values(ascending=False)`.
2. `.agg(customers=("customer_id", "count"), avg_age=("age", "mean"), oldest=("age", "max"))`.

</details>

<details>
<summary>Answers</summary>

**1. Units per category**

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
units_by_cat = sales.groupby("category")["units"].sum().sort_values(ascending=False)
print(units_by_cat)
```

**2. City report**

```python
import pandas as pd

customers = pd.read_csv("customers.csv")
city_report = customers.groupby("city").agg(
    customers=("customer_id", "count"),
    avg_age=("age", "mean"),
    oldest=("age", "max"),
)
print(city_report)
```

</details>

## Quick quiz

1. Which question needs a groupby?
   - A) How many rows does the table have?
   - B) What's the average order value per region?
   - C) What's the largest order?

2. What's the difference between `.agg(...)` and `.transform(...)` after a groupby?
   - A) They're the same
   - B) `agg` gives one row per group; `transform` gives one value per original row
   - C) `transform` only works on text

3. What does `reset_index()` do after a groupby?
   - A) Sorts the result
   - B) Deletes the groups
   - C) Turns the group labels into ordinary columns

<details>
<summary>Quiz answers</summary>

1. **B) What's the average order value per region?**: "Per region" means split by region and summarise each group.
2. **B) `agg` gives one row per group; `transform` gives one value per original row**: `transform` broadcasts each group's result back to its rows, so you can compare rows with their group.
3. **C) Turns the group labels into ordinary columns**: The groups move from the index into columns, giving a flat table.

</details>

---
Previous: [Lesson 21](21-cleaning-project.md) · Next: [Lesson 23: Pivot tables and crosstabs](23-pivot-tables.md)
