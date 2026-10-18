# Lesson 27: Trends over time

**You'll learn:** date index, partial-date selection, `resample`, period codes, `shift`, `pct_change`, `rolling`, `cumsum`, groupby + resample.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python-data/#time-series)**: run every example and check your exercise answers.

## Key terms

- **Time series:** a measurement recorded over time, like daily sales.
- **DatetimeIndex:** an index made of dates, which unlocks time-based selection and resampling.
- **resample:** groups a time series into periods such as weeks or months.
- **shift:** moves values down (or up) by a number of steps, to compare with earlier periods.
- **pct_change:** the change from the previous value as a fraction.
- **Rolling (moving) average:** the average over a sliding window, such as the last 7 days.
- **Year to date (YTD):** the running total from the start of the year.

"Are sales growing?", "Which month was hottest?", "How does this week compare with last week?" are **time series** questions: the same measurement tracked over time. pandas has special tools for them, and they work best when the dates are the index.

## A date index

```python
import pandas as pd

sales = pd.read_csv("sales.csv", parse_dates=["order_date"])
sales["revenue"] = sales["units"] * sales["unit_price"]
daily = sales.groupby("order_date")["revenue"].sum()
print(daily.head())
print(daily.index.dtype)
```

With dates as the index, you can select by date text, even partial dates:

```python
import pandas as pd

sales = pd.read_csv("sales.csv", parse_dates=["order_date"])
sales["revenue"] = sales["units"] * sales["unit_price"]
daily = sales.groupby("order_date")["revenue"].sum()
print(daily.loc["2025-03"].sum())                  # all of March
print(daily.loc["2025-06-01":"2025-06-07"])        # one week
```

## resample: change the frequency

`resample` groups by time periods, like a groupby for dates. Pass a period code:

| Code | Period |
|---|---|
| `"D"` | day |
| `"W"` | week (ending Sunday) |
| `"ME"` | month (labelled by its last day) |
| `"QE"` | quarter |
| `"YE"` | year |

```python
import pandas as pd

sales = pd.read_csv("sales.csv", parse_dates=["order_date"])
sales["revenue"] = sales["units"] * sales["unit_price"]
monthly = sales.set_index("order_date")["revenue"].resample("ME").sum()
print(monthly.round(0))
print("Best month:", monthly.idxmax().strftime("%B"))
```

`set_index("order_date")` makes the dates the index so `resample` can use them. Days with no orders still get a row (with 0), unlike a plain groupby.

## Growth: shift and pct_change

`shift(1)` moves values down one step, lining each period up with the one before. `pct_change()` does the growth calculation for you:

```python
import pandas as pd

sales = pd.read_csv("sales.csv", parse_dates=["order_date"])
sales["revenue"] = sales["units"] * sales["unit_price"]
monthly = sales.set_index("order_date")["revenue"].resample("ME").sum()

report = pd.DataFrame({"revenue": monthly})
report["previous"] = report["revenue"].shift(1)
report["change_pct"] = (report["revenue"].pct_change() * 100).round(1)
report.index = report.index.strftime("%b")
print(report.round(0).head(6))
```

The first month has no previous month, so its change is missing.

## Rolling averages

Daily numbers are noisy. A **rolling average** (moving average) replaces each day with the average of the last few days, smoothing out the noise so the trend shows:

![London's noisy daily temperatures with a smoother 7-day rolling average and an even smoother 30-day average drawn through them](../figures/rolling-average.svg)

```python
import pandas as pd

weather = pd.read_csv("weather.csv", parse_dates=["date"])
london = weather[weather["city"] == "London"].set_index("date")["temp_c"]
smooth = london.rolling(7).mean()
print(pd.DataFrame({"daily": london, "7-day avg": smooth.round(1)}).iloc[5:12])
```

The first six days have no 7-day average yet. `rolling(7, min_periods=1)` would use whatever days are available.

## Cumulative totals

`cumsum` gives a running total, like "revenue year to date":

```python
import pandas as pd

sales = pd.read_csv("sales.csv", parse_dates=["order_date"])
sales["revenue"] = sales["units"] * sales["unit_price"]
monthly = sales.set_index("order_date")["revenue"].resample("ME").sum()
ytd = monthly.cumsum()
print(ytd.round(0).tail(3))
print(f"Half the year's revenue was reached by {ytd[ytd >= ytd.iloc[-1] / 2].index[0]:%B}")
```

## Several series at once

Group first, then resample, to get a time series per group. Monthly average temperature for each city:

```python
import pandas as pd

weather = pd.read_csv("weather.csv", parse_dates=["date"])
monthly = (weather.set_index("date")
           .groupby("city")["temp_c"]
           .resample("ME").mean()
           .unstack(level=0)
           .round(1))
monthly.index = monthly.index.strftime("%b")
print(monthly)
```

London and New York peak in July and swing widely through the year, while Mumbai stays between about 25 and 30 °C all year. Its big seasonal change is rain: the June to September monsoon (you'll find it in the exercise).

## Common mistakes

- Resampling without a date index. Use `set_index("date")` (with real datetimes) first.
- Using the old period code `"M"`; in pandas 3 it's `"ME"` for month end (and `"QE"`, `"YE"`).
- Reading too much into the start of a rolling average, which is missing or based on few values.

## Exercises

### 1. Weekly units

Load `sales.csv` with dates parsed, make the dates the index, and store the **total units per week** (resample `"W"`) in `weekly`. Then store the date of the busiest week in `busiest`.

Starter code:

```python
import pandas as pd

sales = pd.read_csv("sales.csv", parse_dates=["order_date"])

```

### 2. Monsoon month

Load `weather.csv` with dates parsed, keep only **Mumbai**, and store the **total rain per month** (resample `"ME"`, sum of `rain_mm`) in `mumbai_rain`. Store the name of the wettest month (like `"July"`) in `wettest`.

Starter code:

```python
import pandas as pd

weather = pd.read_csv("weather.csv", parse_dates=["date"])

```

**In the sandbox:** exercises 53–54. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. `sales.set_index("order_date")["units"].resample("W").sum()`, then `idxmax()`.
2. Filter, `set_index("date")`, `["rain_mm"].resample("ME").sum()`. Format the best date with `.strftime("%B")`.

</details>

<details>
<summary>Answers</summary>

**1. Weekly units**

```python
import pandas as pd

sales = pd.read_csv("sales.csv", parse_dates=["order_date"])
weekly = sales.set_index("order_date")["units"].resample("W").sum()
busiest = weekly.idxmax()
print(busiest)
```

**2. Monsoon month**

```python
import pandas as pd

weather = pd.read_csv("weather.csv", parse_dates=["date"])
mumbai = weather[weather["city"] == "Mumbai"].set_index("date")
mumbai_rain = mumbai["rain_mm"].resample("ME").sum()
wettest = mumbai_rain.idxmax().strftime("%B")
print(mumbai_rain.round(0))
print(wettest)
```

</details>

## Quick quiz

1. What does `resample("ME").sum()` do?
   - A) Totals the values for each month
   - B) Removes months with missing values
   - C) Sorts by month

2. Why use a 7-day rolling average?
   - A) To fill missing days
   - B) To make the data longer
   - C) To smooth out day-to-day noise so the trend is visible

3. What does `pct_change()` calculate?
   - A) The running total
   - B) The change from the previous value, as a fraction
   - C) The share of the total

<details>
<summary>Quiz answers</summary>

1. **A) Totals the values for each month**: resample groups by time period. "ME" means month (labelled by its end date).
2. **C) To smooth out day-to-day noise so the trend is visible**: Each value becomes the average of the last 7 days, which evens out spikes.
3. **B) The change from the previous value, as a fraction**: It's (this − previous) / previous. Multiply by 100 for a percentage.

</details>

---
Previous: [Lesson 26](26-map-apply-and-bins.md) · Next: [Lesson 28: Your first charts with matplotlib](28-matplotlib-basics.md)
