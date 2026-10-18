# Lesson 8: Summarising arrays

**You'll learn:** `sum`, `mean`, `median`, `std`, `percentile`, `argmax`, `axis`, `cumsum`, `reshape`, `np.loadtxt`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python-data/#array-statistics)**: run every example and check your exercise answers.

## Key terms

- **Mean:** the average: the total divided by the number of values.
- **Median:** the middle value when the values are sorted.
- **Standard deviation (std):** a measure of how spread out values are around the mean.
- **Percentile:** the value below which a given percentage of the data falls.
- **Quartiles:** the 25th, 50th and 75th percentiles.
- **axis:** which direction to summarise: `axis=0` down the columns, `axis=1` across the rows.
- **cumsum:** a running total.
- **reshape:** rearranging an array's values into a new shape with the same total size.

Summary numbers like the total, average and spread are the backbone of every report. NumPy computes them in one call, for a whole array or for each row or column.

## The essential summaries

```python
import numpy as np

sales = np.array([120, 95, 143, 88, 160, 132, 101])
print("total  ", sales.sum())
print("mean   ", sales.mean())
print("median ", np.median(sales))
print("min/max", sales.min(), sales.max())
print("std    ", round(sales.std(), 2))
print("best day index:", sales.argmax())
```

| Summary | Meaning |
|---|---|
| **mean** | the average: total divided by count |
| **median** | the middle value when sorted; not pulled around by extreme values |
| **std** (standard deviation) | how spread out the values are around the mean |
| **argmax / argmin** | the *position* of the largest / smallest value |

## Mean versus median

One huge value drags the mean but not the median. That's why house prices and salaries are usually reported as medians:

```python
import numpy as np

salaries = np.array([32_000, 35_000, 38_000, 41_000, 45_000])
print(salaries.mean(), np.median(salaries))

with_ceo = np.append(salaries, 900_000)
print(with_ceo.mean(), np.median(with_ceo))
```

## Percentiles

The 90th **percentile** is the value 90% of the data falls below. The 25th, 50th and 75th percentiles are called the **quartiles**, and the 50th is the median:

```python
import numpy as np

times = np.array([1.2, 0.8, 2.5, 1.9, 0.6, 3.8, 1.1, 1.4, 0.9, 7.2])
print(np.percentile(times, [25, 50, 75]))
print("90% of requests took under", np.percentile(times, 90), "seconds")
```

## axis: rows or columns

On a 2-D array, `axis=0` summarises **down the columns** (one answer per column) and `axis=1` summarises **across the rows** (one answer per row):

![mean(axis=0) gives one answer per column, down the rows; mean(axis=1) gives one answer per row, across the columns](../figures/axis.svg)

```python
import numpy as np

# rows: 4 students. columns: math, science, english
scores = np.array([[72, 85, 90],
                   [64, 70, 58],
                   [88, 91, 79],
                   [55, 62, 71]])

print("average per subject:", scores.mean(axis=0))
print("average per student:", scores.mean(axis=1).round(1))
print("best student per subject:", scores.argmax(axis=0))
```

A way to remember it: the axis you name is the one that **disappears**. Shape `(4, 3)` with `axis=0` gives 3 answers; with `axis=1` it gives 4.

## Running totals

`cumsum()` gives a running total, handy for "sales so far this year":

```python
import numpy as np

monthly = np.array([10, 12, 9, 15, 14, 18])
print(monthly.cumsum())
```

## Reshaping

`reshape` rearranges the same numbers into a new shape. The total size must match; `-1` means "work this one out":

```python
import numpy as np

days = np.arange(1, 15)        # 14 days
weeks = days.reshape(2, 7)     # 2 weeks of 7 days
print(weeks)
print(weeks.sum(axis=1))       # total per week
print(days.reshape(-1, 2).shape)
```

## Loading numbers from a file

`np.loadtxt` reads a file of numbers straight into an array. Here are the five number columns of `students.csv` (columns 2 to 6), skipping the header:

```python
import numpy as np

data = np.loadtxt("students.csv", delimiter=",", skiprows=1, usecols=(2, 3, 4, 5, 6))
print(data.shape)
print(data[:3])
hours, math = data[:, 0], data[:, 2]
print("Average hours:", hours.mean().round(2))
print("Average math:", math.mean().round(1))
```

That works for files that are all numbers. Real files mix text and numbers, which is where pandas takes over next.

## Common mistakes

- Mixing up the axes. Remember the axis you name disappears: `(rows, cols)` with `axis=0` leaves one value per column.
- Reporting only the mean for skewed data like salaries or response times. Show the median (or percentiles) too.
- Confusing `max()` (the value) with `argmax()` (its position).

## Exercises

### 1. Subject averages

`scores` has one row per student and the columns math, science, english. Make `subject_avg` (the average of each **column**) and `student_total` (the total of each **row**).

Starter code:

```python
import numpy as np

scores = np.array([[72, 85, 90],
                   [64, 70, 58],
                   [88, 91, 79],
                   [55, 62, 71],
                   [93, 80, 84]])

```

### 2. Typical and extreme

For the response times below, store the **median** in `typical` and the **95th percentile** in `slow`.

Starter code:

```python
import numpy as np

times = np.array([0.4, 0.6, 0.5, 2.8, 0.7, 0.5, 0.9, 0.6, 5.2, 0.8,
                  0.6, 0.7, 1.1, 0.5, 0.6, 0.9, 0.7, 0.4, 3.9, 0.6])

```

**In the sandbox:** exercises 15–16. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. `axis=0` gives one answer per column; `axis=1` gives one answer per row.
2. `np.median(times)` and `np.percentile(times, 95)`.

</details>

<details>
<summary>Answers</summary>

**1. Subject averages**

```python
import numpy as np

scores = np.array([[72, 85, 90],
                   [64, 70, 58],
                   [88, 91, 79],
                   [55, 62, 71],
                   [93, 80, 84]])
subject_avg = scores.mean(axis=0)
student_total = scores.sum(axis=1)
print(subject_avg, student_total)
```

**2. Typical and extreme**

```python
import numpy as np

times = np.array([0.4, 0.6, 0.5, 2.8, 0.7, 0.5, 0.9, 0.6, 5.2, 0.8,
                  0.6, 0.7, 1.1, 0.5, 0.6, 0.9, 0.7, 0.4, 3.9, 0.6])
typical = np.median(times)
slow = np.percentile(times, 95)
print(typical, slow)
```

</details>

## Quick quiz

1. Why might you report the median salary instead of the mean?
   - A) The median is always bigger
   - B) A few very high salaries pull the mean up but barely move the median
   - C) The mean can't be calculated for salaries

2. `scores` has shape `(30, 4)`: 30 students, 4 subjects. What shape is `scores.mean(axis=0)`?
   - A) `(30,)`, one average per student
   - B) `(4,)`, one average per subject
   - C) A single number

3. What does `argmax()` return?
   - A) The position of the largest value
   - B) The largest value
   - C) The number of values

<details>
<summary>Quiz answers</summary>

1. **B) A few very high salaries pull the mean up but barely move the median**: The median is the middle value, so extreme values don't drag it around.
2. **B) `(4,)`, one average per subject**: `axis=0` collapses the rows, leaving one answer per column.
3. **A) The position of the largest value**: `max()` gives the value; `argmax()` gives where it is.

</details>

---
Previous: [Lesson 7](07-vectorised-math.md) · Next: [Lesson 9: Random numbers and simulation](09-random-and-simulation.md)
