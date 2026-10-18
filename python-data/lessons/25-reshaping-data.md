# Lesson 25: Stacking and reshaping tables

**You'll learn:** `pd.concat`, `ignore_index`, wide vs long (tidy) data, `melt`, `pivot`, `unstack`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python-data/#reshaping-data)**: run every example and check your exercise answers.

## Key terms

- **concat:** stacks tables on top of each other (or side by side with `axis=1`).
- **Wide data:** one row per thing, with a column for each measurement.
- **Long (tidy) data:** one row per thing per measurement, with a column naming the measurement.
- **melt:** turns columns into rows (wide to long).
- **pivot:** turns rows into columns (long to wide).
- **unstack:** moves an index level into the columns.

Data doesn't always arrive in the shape you need. Sometimes it's split into several files with the same columns; sometimes the layout is "wide" when your tools want "long". Here are the tools to rearrange it.

## concat: stacking tables

`pd.concat` puts tables with the same columns on top of each other, like appending this month's file to last month's:

```python
import pandas as pd

jan = pd.DataFrame({"product": ["Pen", "Lamp"], "units": [10, 2]})
feb = pd.DataFrame({"product": ["Pen", "Chair"], "units": [7, 1]})
both = pd.concat([jan, feb], ignore_index=True)
print(both)
```

`ignore_index=True` renumbers the rows 0, 1, 2…; without it you'd get the labels 0, 1, 0, 1. To remember which file each row came from, add a column first:

```python
import pandas as pd

jan = pd.DataFrame({"product": ["Pen", "Lamp"], "units": [10, 2]}).assign(month="Jan")
feb = pd.DataFrame({"product": ["Pen", "Chair"], "units": [7, 1]}).assign(month="Feb")
print(pd.concat([jan, feb], ignore_index=True))
```

A common real use: splitting a big file by a column, then stacking the parts back:

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
parts = [sales[sales["region"] == r] for r in ["North", "South"]]
north_south = pd.concat(parts)
print(len(parts[0]), len(parts[1]), len(north_south))
```

## Wide and long

The same data can be laid out two ways:

![The same scores in two layouts: wide has one column per subject; long has one row per student and subject. melt goes wide to long, pivot goes back](../figures/wide-long.svg)

- **wide**: one row per thing, one column per measurement (easy for people to read);
- **long** (also called **tidy**): one row per thing *per measurement*, with a column saying which measurement it is (easy for computers to group, filter and chart).

```python
import pandas as pd

wide = pd.DataFrame({
    "student": ["Ana", "Ben"],
    "math": [72, 64],
    "science": [85, 70],
})
print(wide)
```

## melt: wide to long

`melt` turns columns into rows. `id_vars` stay as they are; the other columns are "melted" into two: which column it was, and its value:

```python
import pandas as pd

wide = pd.DataFrame({"student": ["Ana", "Ben"], "math": [72, 64], "science": [85, 70]})
long = wide.melt(id_vars="student", var_name="subject", value_name="score")
print(long)
```

Now "average score per subject" is a simple groupby, and it works however many subjects there are:

```python
import pandas as pd

students = pd.read_csv("students.csv")
long = students.melt(id_vars=["student", "class"], value_vars=["math", "science", "english"],
                     var_name="subject", value_name="score")
print(long.head())
print(long.groupby(["class", "subject"])["score"].mean().round(1).unstack())
```

`unstack()` moves the inner index level (subject) into the columns, turning the result wide again for reading.

## pivot: long to wide

`pivot` is the opposite of `melt`. Daily weather is long (one row per city per day); pivot it to put the cities side by side:

```python
import pandas as pd

weather = pd.read_csv("weather.csv")
by_city = weather.pivot(index="date", columns="city", values="temp_c")
print(by_city.head())
print(by_city.corr().round(2))
```

With the cities as columns, comparing them is easy, like this table of **correlations** (how closely the temperatures rise and fall together; you'll learn it properly in the statistics course).

`pivot` needs each index/column pair to appear only once. If there are repeats, use `pivot_table`, which summarises them.

## Common mistakes

- Concatenating tables whose column names differ slightly, which creates extra columns full of gaps. Make the names match first.
- Forgetting `ignore_index=True` and ending up with repeated index labels.
- Using `pivot` when an index/column pair repeats, which raises an error. Use `pivot_table` to summarise the repeats.

## Exercises

### 1. Stack the quarters

`q1` and `q2` are two quarters of results with the same columns. Stack them into one table called `half_year` with a fresh index (0 to 5), after adding a `quarter` column holding `"Q1"` or `"Q2"` to each.

Starter code:

```python
import pandas as pd

q1 = pd.DataFrame({"region": ["North", "South", "East"], "revenue": [120, 95, 80]})
q2 = pd.DataFrame({"region": ["North", "South", "East"], "revenue": [130, 110, 85]})

```

### 2. Melt the scores

Melt `students.csv` into a long table called `long` with the columns `student`, `subject` and `score` (subjects: math, science, english). Then store the **highest score in each subject** in `best`.

Starter code:

```python
import pandas as pd

students = pd.read_csv("students.csv")

```

**In the sandbox:** exercises 49–50. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Add the column to each table, then `pd.concat([q1, q2], ignore_index=True)`.
2. `melt(id_vars="student", value_vars=[...], var_name="subject", value_name="score")`, then groupby subject.

</details>

<details>
<summary>Answers</summary>

**1. Stack the quarters**

```python
import pandas as pd

q1 = pd.DataFrame({"region": ["North", "South", "East"], "revenue": [120, 95, 80]})
q2 = pd.DataFrame({"region": ["North", "South", "East"], "revenue": [130, 110, 85]})
q1["quarter"] = "Q1"
q2["quarter"] = "Q2"
half_year = pd.concat([q1, q2], ignore_index=True)
print(half_year)
```

**2. Melt the scores**

```python
import pandas as pd

students = pd.read_csv("students.csv")
long = students.melt(id_vars="student", value_vars=["math", "science", "english"],
                     var_name="subject", value_name="score")
best = long.groupby("subject")["score"].max()
print(best)
```

</details>

## Quick quiz

1. What does `pd.concat([a, b])` do?
   - A) Stacks b underneath a
   - B) Adds the numbers in a and b
   - C) Joins a and b on a key

2. Which layout has one row per student per subject?
   - A) Pivot
   - B) Long
   - C) Wide

3. Which method turns wide data into long data?
   - A) `melt`
   - B) `pivot`
   - C) `concat`

<details>
<summary>Quiz answers</summary>

1. **A) Stacks b underneath a**: concat stacks tables. To match rows on a key, use `merge`.
2. **B) Long**: Long (tidy) data has one row per measurement, with a column naming which measurement it is.
3. **A) `melt`**: `melt` turns columns into rows; `pivot` does the reverse.

</details>

---
Previous: [Lesson 24](24-merging-tables.md) · Next: [Lesson 26: Mapping, applying and binning](26-map-apply-and-bins.md)
