# Lesson 23: Pivot tables and crosstabs

**You'll learn:** `pivot_table`, `index`, `columns`, `values`, `aggfunc`, `margins`, `fill_value`, `pd.crosstab`, `normalize`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python-data/#pivot-tables)**: run every example and check your exercise answers.

## Key terms

- **Pivot table:** a summary grid with one category down the side, another across the top, and a number in each cell.
- **aggfunc:** the summary a pivot table uses, such as "sum" or "mean".
- **Margins:** total rows and columns added to a pivot table.
- **fill_value:** what to show where a combination has no data.
- **Crosstab:** a table counting how often each combination of two categories occurs.
- **normalize:** turns counts into shares, by row (`"index"`), column (`"columns"`) or overall (`True`).

If you've used Excel, you've probably met **pivot tables**: a summary with one category down the rows, another across the columns, and a number in each cell. They're perfect for reports, because people can read across and down.

## pivot_table

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
sales["revenue"] = sales["units"] * sales["unit_price"]
table = sales.pivot_table(index="region", columns="category", values="revenue", aggfunc="sum")
print(table.round(0))
```

| Argument | Meaning |
|---|---|
| `index` | what goes down the side (one row per value) |
| `columns` | what goes across the top |
| `values` | the number to summarise |
| `aggfunc` | how to summarise it: `"sum"`, `"mean"`, `"count"`… |

It's the same as `groupby(["region", "category"])["revenue"].sum()`, laid out as a grid.

## Totals and gaps

`margins=True` adds an "All" row and column with totals. `fill_value=0` puts 0 where a combination never happened:

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
table = sales.pivot_table(index="product", columns="region", values="units",
                          aggfunc="sum", fill_value=0, margins=True)
print(table)
```

## Months across the top

Dates make great pivot columns. Here's units per category per quarter:

```python
import pandas as pd

sales = pd.read_csv("sales.csv", parse_dates=["order_date"])
sales["quarter"] = "Q" + sales["order_date"].dt.quarter.astype(str)
print(sales.pivot_table(index="category", columns="quarter", values="units", aggfunc="sum"))
```

## Averages in a pivot

Any summary works. Average exam scores by class, for each subject:

```python
import pandas as pd

students = pd.read_csv("students.csv")
print(students.pivot_table(index="class", values=["math", "science", "english"], aggfunc="mean").round(1))
```

Without `columns`, you get one column per value. This is identical to a groupby with `mean`.

## crosstab: counting combinations

`pd.crosstab` counts how often each combination of two columns occurs. It's the quickest way to see how two categories relate:

```python
import pandas as pd

customers = pd.read_csv("customers.csv")
print(pd.crosstab(customers["city"], customers["segment"]))
```

`normalize="index"` turns each row into shares, so rows of different sizes can be compared:

```python
import pandas as pd

customers = pd.read_csv("customers.csv")
shares = pd.crosstab(customers["city"], customers["segment"], normalize="index")
print((shares * 100).round(0))
```

Now you can see which cities lean towards business customers, whatever their size.

## Reading values out

A pivot table is an ordinary DataFrame, so `loc` works:

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
table = sales.pivot_table(index="region", columns="category", values="units", aggfunc="sum")
print(table.loc["North", "Office"])
print(table["Home"].idxmax(), "buys the most Home units")
```

## Common mistakes

- Leaving out `aggfunc` and getting averages. The default is the mean; say `aggfunc="sum"` when you want totals.
- Comparing raw counts between groups of different sizes. Use `normalize="index"` to compare shares.
- Treating `NaN` in a pivot as zero without saying so. Use `fill_value=0` only when no data really means zero.

## Exercises

### 1. Revenue grid

Load `sales.csv`, add `revenue`, and make `grid`: a pivot table with `product` down the side, `region` across the top, and the **sum of revenue** in the cells. Fill gaps with 0.

Starter code:

```python
import pandas as pd

sales = pd.read_csv("sales.csv")

```

### 2. Genre by decade

Load `movies.json`, add a column `decade` holding `"2000s"`, `"2010s"` or `"2020s"` (hint: `(year // 10 * 10).astype(str) + "s"`), and store `pd.crosstab(movies["genre"], movies["decade"])` in `counts`.

Starter code:

```python
import pandas as pd

movies = pd.read_json("movies.json")

```

**In the sandbox:** exercises 45–46. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. `pivot_table(index="product", columns="region", values="revenue", aggfunc="sum", fill_value=0)`.
2. `year // 10 * 10` rounds 2017 down to 2010. Convert to text and add `"s"`.

</details>

<details>
<summary>Answers</summary>

**1. Revenue grid**

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
sales["revenue"] = sales["units"] * sales["unit_price"]
grid = sales.pivot_table(index="product", columns="region", values="revenue", aggfunc="sum", fill_value=0)
print(grid.round(0))
```

**2. Genre by decade**

```python
import pandas as pd

movies = pd.read_json("movies.json")
movies["decade"] = (movies["year"] // 10 * 10).astype(str) + "s"
counts = pd.crosstab(movies["genre"], movies["decade"])
print(counts)
```

</details>

## Quick quiz

1. In `pivot_table(index="region", columns="category", ...)`, what are the rows?
   - A) One row per order
   - B) One row per region
   - C) One row per category

2. What does `margins=True` add?
   - A) Spaces between columns
   - B) Total rows and columns labelled "All"
   - C) Percentages

3. What does `pd.crosstab(a, b)` count?
   - A) The values of a
   - B) The missing values
   - C) How often each combination of a and b occurs

<details>
<summary>Quiz answers</summary>

1. **B) One row per region**: `index` goes down the side; `columns` goes across the top.
2. **B) Total rows and columns labelled "All"**: Margins are the totals along each side, like a spreadsheet's grand total.
3. **C) How often each combination of a and b occurs**: A crosstab is a table of combination counts. `normalize=` turns them into shares.

</details>

---
Previous: [Lesson 22](22-groupby.md) · Next: [Lesson 24: Combining tables with merge](24-merging-tables.md)
