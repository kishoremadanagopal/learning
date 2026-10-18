# Lesson 28: Your first charts with matplotlib

**You'll learn:** figure and axes, `plt.subplots`, `ax.plot`, titles and labels, legends, `figsize`, styling, `savefig`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python-data/#matplotlib-basics)**: run every example and check your exercise answers.

## Key terms

- **matplotlib:** Python's main charting library; `pyplot` (imported as `plt`) is its main interface.
- **Figure:** the whole image, which can hold one or more charts.
- **Axes:** one chart area inside a figure, with its own x and y axes. You draw on it with `ax.` methods.
- **plt.subplots:** creates a figure and its axes in one call.
- **Line chart:** points joined by lines, best for change over time.
- **Legend:** the key that says which line or colour is which.
- **figsize:** the figure's (width, height) in inches.
- **savefig:** writes a figure to an image file.

A good chart shows in a second what a table takes a minute to read. **matplotlib** is Python's main charting library; pandas and most other chart tools are built on it. In the sandbox, charts appear under your code's output.

## Figure and axes

Every chart starts with two objects:

- the **figure**: the whole image, like a blank page;
- the **axes** (`ax`): one chart area on the page, with its x and y axes. You draw on `ax`.

`plt.subplots()` creates both:

```python
import matplotlib.pyplot as plt

fig, ax = plt.subplots()
ax.plot([1, 2, 3, 4, 5], [3, 5, 4, 7, 8])
plt.show()
```

`ax.plot(x, y)` draws a line through the points. `plt.show()` displays the chart; in the sandbox charts appear even without it, but on your own computer you need it.

## Titles and labels

A chart without labels makes the reader guess. Always set a title and label both axes, with units:

```python
import matplotlib.pyplot as plt

months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
revenue = [14.2, 15.8, 13.9, 17.5, 18.1, 19.6]

fig, ax = plt.subplots(figsize=(7, 3.5))
ax.plot(months, revenue, marker="o")
ax.set_title("Revenue grew 38% in the first half")
ax.set_xlabel("Month")
ax.set_ylabel("Revenue (£ thousands)")
plt.show()
```

`figsize=(width, height)` sets the size in inches. `marker="o"` puts a dot on each point.

## Several lines and a legend

Call `plot` again for each line. Give each a `label`, then `ax.legend()` shows the key:

```python
import matplotlib.pyplot as plt

months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
fig, ax = plt.subplots(figsize=(7, 3.5))
ax.plot(months, [5, 6, 8, 11, 14, 17], marker="o", label="London")
ax.plot(months, [3, 3, 7, 13, 19, 23], marker="o", label="New York")
ax.set_title("New York warms up faster than London")
ax.set_ylabel("Average temperature (°C)")
ax.legend()
plt.show()
```

## Plotting real data

pandas Series and dates work directly. Here's London's daily temperature for a year:

```python
import pandas as pd
import matplotlib.pyplot as plt

weather = pd.read_csv("weather.csv", parse_dates=["date"])
london = weather[weather["city"] == "London"]

fig, ax = plt.subplots(figsize=(8, 3.5))
ax.plot(london["date"], london["temp_c"], linewidth=1)
ax.plot(london["date"], london["temp_c"].rolling(14).mean(), linewidth=2.5, label="14-day average")
ax.set_title("London temperature, 2025")
ax.set_ylabel("°C")
ax.legend()
plt.show()
```

## Styling basics

Most style choices are arguments to `plot`:

| Argument | Example | Does |
|---|---|---|
| `color` | `"tab:orange"`, `"#2c679c"` | line colour |
| `linewidth` | `2` | line thickness |
| `linestyle` | `"--"`, `":"` | dashed or dotted |
| `marker` | `"o"`, `"s"` | dots or squares on points |
| `alpha` | `0.5` | transparency (0 to 1) |

```python
import matplotlib.pyplot as plt

x = list(range(10))
fig, ax = plt.subplots(figsize=(6, 3))
ax.plot(x, [v * v for v in x], color="tab:purple", linewidth=2, label="squared")
ax.plot(x, [v * 8 for v in x], color="gray", linestyle="--", label="times 8")
ax.grid(alpha=0.3)
ax.legend()
ax.set_title("Squares overtake a straight line at 8")
plt.show()
```

`ax.grid(alpha=0.3)` adds faint grid lines, which help reading values without shouting.

## Saving a chart

`fig.savefig` writes the chart to an image file for a report or slide. `dpi` sets the sharpness and `bbox_inches="tight"` trims the white border:

```python
import os
import matplotlib.pyplot as plt

fig, ax = plt.subplots()
ax.plot([1, 2, 3], [2, 4, 3])
ax.set_title("Saved chart")
fig.savefig("chart.png", dpi=150, bbox_inches="tight")
print(os.path.getsize("chart.png"), "bytes written")
```

## Common mistakes

- Leaving the default title and labels empty. Every chart needs a title and axis labels with units.
- Calling `ax.legend()` without giving lines a `label=`, which shows an empty legend.
- Mixing up `plt.title()` and `ax.set_title()`. With `fig, ax`, use the `ax.set_...` methods.

## Exercises

### 1. Steps this week

Draw a line chart of `steps` against `days`, with the title `"Daily steps"` and the y-axis label `"Steps"`.

Starter code:

```python
import matplotlib.pyplot as plt

days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
steps = [8200, 10450, 6300, 12100, 9800, 15200, 4300]

```

### 2. Two cities

Plot New York's and Mumbai's daily `temp_c` from `weather.csv` on the **same axes** as two lines labelled `"New York"` and `"Mumbai"`, and show a legend.

Starter code:

```python
import pandas as pd
import matplotlib.pyplot as plt

weather = pd.read_csv("weather.csv", parse_dates=["date"])

```

**In the sandbox:** exercises 55–56. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. `fig, ax = plt.subplots()`, then `ax.plot(days, steps)`, `ax.set_title(...)` and `ax.set_ylabel(...)`.
2. Filter each city, call `ax.plot(..., label=city)` for each, then `ax.legend()`.

</details>

<details>
<summary>Answers</summary>

**1. Steps this week**

```python
import matplotlib.pyplot as plt

days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
steps = [8200, 10450, 6300, 12100, 9800, 15200, 4300]

fig, ax = plt.subplots()
ax.plot(days, steps, marker="o")
ax.set_title("Daily steps")
ax.set_ylabel("Steps")
plt.show()
```

**2. Two cities**

```python
import pandas as pd
import matplotlib.pyplot as plt

weather = pd.read_csv("weather.csv", parse_dates=["date"])
fig, ax = plt.subplots(figsize=(8, 3.5))
for city in ["New York", "Mumbai"]:
    one = weather[weather["city"] == city]
    ax.plot(one["date"], one["temp_c"], label=city, linewidth=1)
ax.set_title("Daily temperature")
ax.set_ylabel("°C")
ax.legend()
plt.show()
```

</details>

## Quick quiz

1. In `fig, ax = plt.subplots()`, what is `ax`?
   - A) The chart area you draw on
   - B) The whole image
   - C) The x axis only

2. What does `ax.legend()` need in order to show anything?
   - A) Lines drawn with a `label=`
   - B) At least three lines
   - C) A title

3. What makes a good chart title?
   - A) The finding, like "Revenue grew 38% in the first half"
   - B) The file name
   - C) The column names

<details>
<summary>Quiz answers</summary>

1. **A) The chart area you draw on**: The figure is the page; the axes object is the chart area with its own x and y axes.
2. **A) Lines drawn with a `label=`**: The legend lists each labelled line. Without labels it has nothing to show.
3. **A) The finding, like "Revenue grew 38% in the first half"**: A title that states the takeaway tells the reader what to look for.

</details>

---
Previous: [Lesson 27](27-time-series.md) · Next: [Lesson 29: Choosing the right chart](29-chart-types.md)
