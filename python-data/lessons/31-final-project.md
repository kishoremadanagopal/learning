# Lesson 31: Final project: a sales analysis

**You'll learn:** turning a brief into questions, joining and checking data, headline numbers, profit analysis, a dashboard, writing up findings, saving results.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python-data/#final-project)**: run every example and check your exercise answers.

## Key terms

- **Brief:** the request that starts an analysis, often vague.
- **Revenue:** money from sales: units × price.
- **Profit:** revenue minus cost.
- **Margin:** profit as a percentage of revenue.
- **Seasonality:** a pattern that repeats at the same time each year.
- **Dashboard:** a few related charts shown together to answer a set of questions.
- **Write-up:** a short plain-language summary of findings and recommendations.

Here's a realistic brief, the kind an analyst gets in their first month:

> *"We're planning next year's budget. How did 2025 go? Which products and customers should we focus on, and is there a seasonal pattern we should plan stock around?"*

You'll answer it with everything from this course. Each step builds on the last, so run them in order.

## Step 1: Turn the brief into questions

A vague brief becomes concrete questions you can answer with data:

1. What were total revenue, profit and order count, and how did they move month by month?
2. Which products make the most **profit** (not just revenue)?
3. Which customer segments and cities matter most?
4. Is there a seasonal pattern?

## Step 2: Load, join and check

Bring the three tables together, then check the join didn't lose or duplicate orders:

```python
import pandas as pd

sales = pd.read_csv("sales.csv", parse_dates=["order_date"])
customers = pd.read_csv("customers.csv")
products = pd.read_csv("products.csv")

df = (sales
      .merge(customers[["customer_id", "segment", "city"]], on="customer_id", how="left", validate="many_to_one")
      .merge(products[["product", "unit_cost"]], on="product", how="left", validate="many_to_one"))
df["revenue"] = df["units"] * df["unit_price"]
df["profit"] = df["units"] * (df["unit_price"] - df["unit_cost"])

assert len(df) == len(sales), "the join changed the number of orders"
assert df[["segment", "unit_cost"]].notna().all().all(), "some orders didn't match"
print(df.shape)
print(df[["order_date", "product", "segment", "city", "revenue", "profit"]].head())
```

## Step 3: The headline numbers

```python
import pandas as pd

sales = pd.read_csv("sales.csv", parse_dates=["order_date"])
products = pd.read_csv("products.csv")
df = sales.merge(products[["product", "unit_cost"]], on="product")
df["revenue"] = df["units"] * df["unit_price"]
df["profit"] = df["units"] * (df["unit_price"] - df["unit_cost"])

print(f"Orders:  {len(df):,}")
print(f"Revenue: £{df['revenue'].sum():,.0f}")
print(f"Profit:  £{df['profit'].sum():,.0f}  ({df['profit'].sum() / df['revenue'].sum():.0%} margin)")
print(f"Average order value: £{df['revenue'].mean():,.2f}")
```

## Step 4: Products by profit

Revenue and profit can tell different stories, because margins differ:

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
products = pd.read_csv("products.csv")
df = sales.merge(products[["product", "unit_cost"]], on="product")
df["revenue"] = df["units"] * df["unit_price"]
df["profit"] = df["units"] * (df["unit_price"] - df["unit_cost"])

by_product = df.groupby("product").agg(
    orders=("order_id", "count"),
    revenue=("revenue", "sum"),
    profit=("profit", "sum"),
)
by_product["margin_pct"] = (by_product["profit"] / by_product["revenue"] * 100).round(0)
by_product["profit_share"] = (by_product["profit"] / by_product["profit"].sum() * 100).round(1)
print(by_product.sort_values("profit", ascending=False).round(0))
```

## Step 5: Customers

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
customers = pd.read_csv("customers.csv")
products = pd.read_csv("products.csv")
df = (sales.merge(customers[["customer_id", "segment", "city"]], on="customer_id")
           .merge(products[["product", "unit_cost"]], on="product"))
df["profit"] = df["units"] * (df["unit_price"] - df["unit_cost"])

seg = df.groupby("segment").agg(customers=("customer_id", "nunique"), profit=("profit", "sum"))
seg["profit_per_customer"] = (seg["profit"] / seg["customers"]).round(0)
print(seg.sort_values("profit_per_customer", ascending=False))

top_customers = df.groupby("customer_id")["profit"].sum().nlargest(10)
print(f"Top 10 customers bring {top_customers.sum() / df['profit'].sum():.0%} of profit")
```

## Step 6: Seasonality, in a chart

A two-chart dashboard: the monthly trend, and profit by product:

```python
import pandas as pd
import matplotlib.pyplot as plt

sales = pd.read_csv("sales.csv", parse_dates=["order_date"])
products = pd.read_csv("products.csv")
df = sales.merge(products[["product", "unit_cost"]], on="product")
df["profit"] = df["units"] * (df["unit_price"] - df["unit_cost"])

monthly = df.set_index("order_date")["profit"].resample("ME").sum()
by_product = df.groupby("product")["profit"].sum().sort_values()

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 3.8))
ax1.plot(monthly.index.strftime("%b"), monthly.values / 1000, marker="o")
ax1.set_title("Monthly profit (£k)")
ax1.set_ylim(bottom=0)
ax1.grid(alpha=0.3)

colours = ["tab:blue" if v >= by_product.iloc[-3] else "lightgray" for v in by_product.values]
ax2.barh(by_product.index, by_product.values / 1000, color=colours)
ax2.set_title("Profit by product (£k): top 3 highlighted")
for ax in (ax1, ax2):
    ax.spines[["top", "right"]].set_visible(False)
fig.tight_layout()
plt.show()
```

## Step 7: Write it up

Numbers don't speak for themselves. The last step is a short summary in plain language: the answer first, then the evidence, then what to do. For example:

> **2025 summary.** 600 orders brought in about £195k revenue and £71k profit (a 36% margin).
> Laptops alone earn 39% of the profit from only 41 orders; with headphones and monitors, the top three products earn nearly three-quarters of it, so stock-outs there are expensive.
> Pen packs and notebooks are ordered most often but earn little; they bring customers back rather than profit.
> Business customers are worth the most each (about £670 of profit per customer, against £590 for consumers). Monthly profit swings from about £2.7k (November) to £8.7k (August), but one year of data isn't enough to call that a reliable season; compare with 2024 before planning stock around it.

Always check every number in the write-up against your output before sending it. That habit is what makes people trust an analyst.

## Step 8: Save the results

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
products = pd.read_csv("products.csv")
df = sales.merge(products[["product", "unit_cost"]], on="product")
df["profit"] = df["units"] * (df["unit_price"] - df["unit_cost"])
summary = df.groupby("product")["profit"].sum().round(2).sort_values(ascending=False)

summary.to_csv("profit_by_product.csv")
summary.to_json("profit_by_product.json", indent=2)
print(open("profit_by_product.csv").read())
```

You've now done the full workflow from the first lesson: **ask, load, clean, analyse, show, share**. That's the core of both the analyst and AI engineer paths. The next courses build on it with statistics and machine learning.

## Common mistakes

- Answering only the easy question (revenue) when the real one is about profit or customers.
- Sharing numbers you haven't re-checked against the output. One wrong figure costs a lot of trust.
- Burying the answer at the end of a long report. Put the finding first.

## Exercises

### 1. The project table

Join `sales.csv` with `products.csv` (the `product` and `unit_cost` columns) and build `report`, indexed by `category`, with three named columns: `revenue` (sum), `profit` (sum) and `margin_pct` (profit ÷ revenue × 100, not rounded). Sort it by `profit`, largest first.

Starter code:

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
products = pd.read_csv("products.csv")

```

### 2. Profit by month chart

Draw a **line chart** of total `profit` per month (resample `"ME"`) for 2025, with a title. There should be 12 points.

Starter code:

```python
import pandas as pd
import matplotlib.pyplot as plt

sales = pd.read_csv("sales.csv", parse_dates=["order_date"])
products = pd.read_csv("products.csv")

```

**In the sandbox:** exercises 61–62. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Merge, add `revenue` and `profit`, `groupby("category").agg(...)`, then add `margin_pct` and sort.
2. Merge, add `profit`, then `df.set_index("order_date")["profit"].resample("ME").sum()` and plot it.

</details>

<details>
<summary>Answers</summary>

**1. The project table**

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
products = pd.read_csv("products.csv")
df = sales.merge(products[["product", "unit_cost"]], on="product")
df["revenue"] = df["units"] * df["unit_price"]
df["profit"] = df["units"] * (df["unit_price"] - df["unit_cost"])

report = df.groupby("category").agg(revenue=("revenue", "sum"), profit=("profit", "sum"))
report["margin_pct"] = report["profit"] / report["revenue"] * 100
report = report.sort_values("profit", ascending=False)
print(report.round(1))
```

**2. Profit by month chart**

```python
import pandas as pd
import matplotlib.pyplot as plt

sales = pd.read_csv("sales.csv", parse_dates=["order_date"])
products = pd.read_csv("products.csv")
df = sales.merge(products[["product", "unit_cost"]], on="product")
df["profit"] = df["units"] * (df["unit_price"] - df["unit_cost"])
monthly = df.set_index("order_date")["profit"].resample("ME").sum()

fig, ax = plt.subplots(figsize=(8, 3.5))
ax.plot(monthly.index, monthly.values, marker="o")
ax.set_title("Monthly profit, 2025")
ax.set_ylabel("Profit (£)")
plt.show()
```

</details>

## Quick quiz

1. What should come first in an analysis?
   - A) Removing outliers
   - B) Drawing charts
   - C) Turning the brief into specific questions

2. Why check `len(df) == len(sales)` after the joins?
   - A) To catch a join that dropped or duplicated orders
   - B) pandas requires it
   - C) To make the code faster

3. What belongs first in a write-up?
   - A) The code
   - B) A list of every number calculated
   - C) The answer to the question

<details>
<summary>Quiz answers</summary>

1. **C) Turning the brief into specific questions**: Clear questions decide which data, steps and charts you need.
2. **A) To catch a join that dropped or duplicated orders**: A bad join silently changes your totals. Checking the row count catches it.
3. **C) The answer to the question**: Lead with the finding, then the evidence, then the recommendation.

</details>

---
Previous: [Lesson 30](30-pandas-plotting.md) · Back to the [course home](../README.md)
