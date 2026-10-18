# Lesson 20: Dates and times

**You'll learn:** `pd.to_datetime`, `parse_dates`, the `.dt` accessor, filtering by date, `Timedelta`, `DateOffset`, `strftime`, `dayfirst`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python-data/#dates-and-times)**: run every example and check your exercise answers.

## Key terms

- **datetime64:** pandas' type for dates and times.
- **pd.to_datetime:** converts text to dates.
- **parse_dates:** converts date columns while loading with `read_csv`.
- **.dt accessor:** gives a date column its parts and methods, like `.dt.month`.
- **Timestamp:** a single date and time, like `pd.Timestamp("2026-01-01")`.
- **Timedelta:** a length of time, the result of subtracting dates.
- **DateOffset:** a calendar step such as one month, which respects different month lengths.
- **strftime:** formats dates as text using codes like `%Y-%m-%d`.

Dates in a CSV are just text like `"2025-03-14"`. Until you convert them, pandas can't tell March from May or work out how many days apart two dates are.

## Converting with to_datetime

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
print(sales["order_date"].dtype)
sales["order_date"] = pd.to_datetime(sales["order_date"])
print(sales["order_date"].dtype)
print(sales["order_date"].head(3))
```

You can also convert while loading with `parse_dates`:

```python
import pandas as pd

sales = pd.read_csv("sales.csv", parse_dates=["order_date"])
print(sales.dtypes["order_date"])
```

## Parts of a date: .dt

Once a column is a datetime, `.dt` gives you its parts:

```python
import pandas as pd

sales = pd.read_csv("sales.csv", parse_dates=["order_date"])
d = sales["order_date"]
parts = pd.DataFrame({
    "date": d,
    "year": d.dt.year,
    "month": d.dt.month,
    "month_name": d.dt.month_name(),
    "day": d.dt.day,
    "weekday": d.dt.day_name(),
    "quarter": d.dt.quarter,
})
print(parts.head())
```

These make great grouping columns. Which weekday gets the most orders?

```python
import pandas as pd

sales = pd.read_csv("sales.csv", parse_dates=["order_date"])
print(sales["order_date"].dt.day_name().value_counts())
```

## Filtering by date

Compare a datetime column with a date written as text, or use the parts:

```python
import pandas as pd

sales = pd.read_csv("sales.csv", parse_dates=["order_date"])
q4 = sales[sales["order_date"] >= "2025-10-01"]
print(len(q4), "orders in Q4")

summer = sales[sales["order_date"].dt.month.isin([6, 7, 8])]
print(len(summer), "orders in summer")

first_week = sales[sales["order_date"].between("2025-01-01", "2025-01-07")]
print(first_week[["order_id", "order_date"]])
```

## Time between dates

Subtracting dates gives a **Timedelta** (a length of time). `.dt.days` turns it into a number of days:

```python
import pandas as pd

customers = pd.read_csv("customers.csv", parse_dates=["signup_date"])
today = pd.Timestamp("2026-01-01")
customers["days_since_signup"] = (today - customers["signup_date"]).dt.days
customers["years"] = (customers["days_since_signup"] / 365.25).round(1)
print(customers[["name", "signup_date", "days_since_signup", "years"]].head())
```

You can add time to dates too:

```python
import pandas as pd

order = pd.Timestamp("2025-03-28")
print(order + pd.Timedelta(days=5))
print(order + pd.DateOffset(months=1))
```

`Timedelta(days=5)` is an exact length; `DateOffset(months=1)` moves along the calendar (months have different lengths).

## Formatting dates as text

`dt.strftime` writes dates in any format, for reports and labels:

```python
import pandas as pd

dates = pd.to_datetime(pd.Series(["2025-03-14", "2025-12-01"]))
print(dates.dt.strftime("%d %b %Y").tolist())
print(dates.dt.strftime("%Y-%m").tolist())
```

| Code | Means | Example |
|---|---|---|
| `%Y` | year | 2025 |
| `%m` | month number | 03 |
| `%b` / `%B` | short / full month name | Mar / March |
| `%d` | day | 14 |
| `%A` | weekday | Friday |

## Day-first dates

`03/04/2025` is 3 April in the UK and March 4 in the US. Tell pandas which you mean with `dayfirst=True`, or better, give the exact `format`:

```python
import pandas as pd

raw = pd.Series(["03/04/2025", "25/12/2025"])
print(pd.to_datetime(raw, dayfirst=True))
print(pd.to_datetime(raw, format="%d/%m/%Y"))
```

Bad dates can be turned into missing values with `errors="coerce"`, just like numbers.

## Common mistakes

- Doing date logic on text. `"2025-9-1"` sorts after `"2025-10-01"` as text; convert first.
- Mixing up day-first and month-first dates. Pass `dayfirst=True` or an exact `format=`.
- Forgetting `.dt` before date parts: `df["date"].month` is an error; use `df["date"].dt.month`.

## Exercises

### 1. Orders by month

Load `sales.csv` with `order_date` as a real date, add a column `month` holding each order's **month number** (1 to 12), and store how many orders were placed in **December** in `dec_orders`.

Starter code:

```python
import pandas as pd

```

### 2. Customer tenure

Load `customers.csv` with `signup_date` as a date. Add `tenure_days`: the number of days from each signup date to **1 January 2026**. Store the name of the customer who signed up **earliest** in `first_customer`.

Starter code:

```python
import pandas as pd

```

**In the sandbox:** exercises 39–40. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Use `parse_dates=["order_date"]`, then `sales["order_date"].dt.month`.
2. `(pd.Timestamp("2026-01-01") - customers["signup_date"]).dt.days`. The earliest signup has the smallest date: `idxmin()`.

</details>

<details>
<summary>Answers</summary>

**1. Orders by month**

```python
import pandas as pd

sales = pd.read_csv("sales.csv", parse_dates=["order_date"])
sales["month"] = sales["order_date"].dt.month
dec_orders = (sales["month"] == 12).sum()
print(dec_orders)
```

**2. Customer tenure**

```python
import pandas as pd

customers = pd.read_csv("customers.csv", parse_dates=["signup_date"])
customers["tenure_days"] = (pd.Timestamp("2026-01-01") - customers["signup_date"]).dt.days
first_customer = customers.loc[customers["signup_date"].idxmin(), "name"]
print(first_customer)
```

</details>

## Quick quiz

1. Why convert a date column with `pd.to_datetime`?
   - A) To make it shorter
   - B) So pandas understands it as dates: parts, sorting, filtering and differences
   - C) CSV files require it

2. What does subtracting two dates give?
   - A) A date
   - B) A Timedelta (a length of time)
   - C) A number of seconds as text

3. What does `dayfirst=True` change?
   - A) `03/04/2025` is read as 3 April, not 4 March
   - B) The weekday names
   - C) Dates are sorted newest first

<details>
<summary>Quiz answers</summary>

1. **B) So pandas understands it as dates: parts, sorting, filtering and differences**: As text it's just characters. As datetimes you get `.dt.month`, date maths and correct comparisons.
2. **B) A Timedelta (a length of time)**: Use `.dt.days` on a Timedelta column to get whole days.
3. **A) `03/04/2025` is read as 3 April, not 4 March**: It tells pandas the day comes before the month, as in UK-style dates.

</details>

---
Previous: [Lesson 19](19-duplicates-and-outliers.md) · Next: [Lesson 21: Project: clean an HR export](21-cleaning-project.md)
