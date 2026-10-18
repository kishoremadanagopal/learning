# Lesson 30: Charts straight from pandas

**You'll learn:** `Series.plot`, `kind=` and `.plot.bar()`-style shortcuts, plotting DataFrames, `plt.subplots(rows, cols)`, `ax=`, `sharey`, chart design habits.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python-data/#pandas-plotting)**: run every example and check your exercise answers.

## Key terms

- **df.plot:** pandas' built-in charting, which draws with matplotlib.
- **Grouped bar chart:** bars for several series side by side, one group per category.
- **Stacked bar chart:** series stacked on top of each other in one bar.
- **Subplots:** several charts arranged in a grid in one figure.
- **sharey:** makes every subplot use the same y-axis scale.
- **tight_layout:** adjusts spacing so labels don't overlap.
- **Chart clutter:** anything on a chart that doesn't help the reader, like heavy grids or 3-D effects.

pandas can draw charts itself with `.plot`, using matplotlib underneath. It's the fastest way to look at your data while analysing, and it handles labels and legends for you.

## .plot on a Series

```python
import pandas as pd
import matplotlib.pyplot as plt

sales = pd.read_csv("sales.csv", parse_dates=["order_date"])
sales["revenue"] = sales["units"] * sales["unit_price"]
monthly = sales.set_index("order_date")["revenue"].resample("ME").sum()

ax = monthly.plot(figsize=(7, 3.5), marker="o", title="Monthly revenue, 2025")
ax.set_ylabel("Revenue (£)")
plt.show()
```

`.plot` returns the axes, so you can keep customising with the `ax.` methods you know. Change the chart type with `kind=` or the shortcut methods:

```python
import pandas as pd
import matplotlib.pyplot as plt

sales = pd.read_csv("sales.csv")
ax = sales["product"].value_counts().sort_values().plot.barh(figsize=(6, 3.5), color="tab:orange")
ax.set_title("Pen packs are ordered most often")
ax.set_xlabel("Orders")
plt.show()
```

| Shortcut | Chart |
|---|---|
| `.plot()` / `.plot.line()` | line |
| `.plot.bar()` / `.plot.barh()` | bars |
| `.plot.hist(bins=…)` | histogram |
| `.plot.scatter(x=…, y=…)` | scatter (DataFrame) |
| `.plot.box()` | box plot |

## .plot on a DataFrame

Each column becomes its own line or bar series, with a legend. A pivot table is the perfect input:

```python
import pandas as pd
import matplotlib.pyplot as plt

sales = pd.read_csv("sales.csv")
sales["revenue"] = sales["units"] * sales["unit_price"]
table = sales.pivot_table(index="region", columns="category", values="revenue", aggfunc="sum")

ax = table.plot.bar(figsize=(7, 3.5), rot=0)
ax.set_title("Electronics leads in every region")
ax.set_ylabel("Revenue (£)")
plt.show()
```

`rot=0` keeps the labels horizontal. Add `stacked=True` to stack the categories into one bar per region.

## A grid of charts

`plt.subplots(rows, cols)` makes several axes at once. Pass `ax=` to `.plot` to draw on a particular one. This is how small dashboards are built:

```python
import pandas as pd
import matplotlib.pyplot as plt

weather = pd.read_csv("weather.csv", parse_dates=["date"])
cities = ["London", "Mumbai", "New York"]

fig, axes = plt.subplots(1, 3, figsize=(10, 3), sharey=True)
for ax, city in zip(axes, cities):
    one = weather[weather["city"] == city].set_index("date")["temp_c"]
    one.resample("ME").mean().plot(ax=ax, marker="o")
    ax.set_title(city)
    ax.set_xlabel("")
axes[0].set_ylabel("Average temperature (°C)")
fig.suptitle("Monthly average temperature, 2025")
fig.tight_layout()
plt.show()
```

`sharey=True` gives every chart the same y scale, so they can be compared fairly. `tight_layout()` stops labels overlapping.

## Habits of clear charts

The same data can be shown clearly or confusingly. Five habits make the difference:

1. **Title the finding**, not the data: "Electronics leads in every region" beats "Revenue by region and category".
2. **Label axes with units**: "Revenue (£)", "°C", "Orders".
3. **Sort bars** by value unless the categories have a natural order (like months).
4. **Remove clutter**: fewer gridlines, no 3-D, no unnecessary colours.
5. **Use colour to highlight**, not decorate. Grey for context, one colour for what matters:

```python
import pandas as pd
import matplotlib.pyplot as plt

sales = pd.read_csv("sales.csv")
sales["revenue"] = sales["units"] * sales["unit_price"]
by_product = sales.groupby("product")["revenue"].sum().sort_values()
colours = ["tab:red" if p == "Desk Chair" else "lightgray" for p in by_product.index]

fig, ax = plt.subplots(figsize=(7, 3.5))
ax.barh(by_product.index, by_product.values, color=colours)
ax.set_title("Desk chairs: the fourth-biggest earner")
ax.set_xlabel("Revenue (£)")
ax.spines[["top", "right"]].set_visible(False)
plt.show()
```

`ax.spines[...]` hides the top and right borders, a small change that makes charts look cleaner.

## Common mistakes

- Comparing subplots with different y scales. Use `sharey=True` when the charts measure the same thing.
- Letting pandas pick an unsorted category order. Sort the values (or use a meaningful order) before plotting.
- Using colour for decoration. Highlight the one thing that matters and keep the rest grey.

## Exercises

### 1. Units by category

Use pandas plotting to draw a **bar chart** of total `units` per `category` from `sales.csv`, sorted from largest to smallest, with a title.

Starter code:

```python
import pandas as pd
import matplotlib.pyplot as plt

sales = pd.read_csv("sales.csv")

```

### 2. Rain histogram

Draw a **histogram** of London's daily `rain_mm` (from `weather.csv`) with `bins=20`, using pandas (`.plot.hist`) or matplotlib. Give it a title and an x-axis label.

Starter code:

```python
import pandas as pd
import matplotlib.pyplot as plt

weather = pd.read_csv("weather.csv")

```

**In the sandbox:** exercises 59–60. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. `sales.groupby("category")["units"].sum().sort_values(ascending=False).plot.bar(title="...")`.
2. Filter London first, then `["rain_mm"].plot.hist(bins=20, title=...)` and `ax.set_xlabel(...)`.

</details>

<details>
<summary>Answers</summary>

**1. Units by category**

```python
import pandas as pd
import matplotlib.pyplot as plt

sales = pd.read_csv("sales.csv")
units = sales.groupby("category")["units"].sum().sort_values(ascending=False)
ax = units.plot.bar(rot=0, title="Office items sell the most units")
ax.set_ylabel("Units")
plt.show()
```

**2. Rain histogram**

```python
import pandas as pd
import matplotlib.pyplot as plt

weather = pd.read_csv("weather.csv")
london = weather[weather["city"] == "London"]
ax = london["rain_mm"].plot.hist(bins=20, title="Most London days are dry or nearly dry")
ax.set_xlabel("Rain (mm)")
plt.show()
```

</details>

## Quick quiz

1. What does `df.plot.bar()` do with a DataFrame of three columns?
   - A) Draws only the first column
   - B) Raises an error
   - C) Draws a bar for each column, grouped by the index, with a legend

2. Why use `sharey=True` in a grid of charts?
   - A) To share one title
   - B) To make the charts smaller
   - C) So every chart uses the same y scale and can be compared fairly

3. Which title is best for a chart of revenue by region?
   - A) "North brings in 30% of all revenue"
   - B) "groupby region sum"
   - C) "Revenue by region"

<details>
<summary>Quiz answers</summary>

1. **C) Draws a bar for each column, grouped by the index, with a legend**: Each column becomes a bar series, and the index provides the categories.
2. **C) So every chart uses the same y scale and can be compared fairly**: Different scales can make a small change look as big as a large one.
3. **A) "North brings in 30% of all revenue"**: Title the finding, so the reader knows what to notice.

</details>

---
Previous: [Lesson 29](29-chart-types.md) · Next: [Lesson 31: Final project: a sales analysis](31-final-project.md)
