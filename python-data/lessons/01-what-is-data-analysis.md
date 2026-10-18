# Lesson 1: What data analysis is

**You'll learn:** the analysis workflow, rows and columns, CSV files, NumPy, pandas and matplotlib.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python-data/#what-is-data-analysis)**: run every example and check your exercise answers.

## Key terms

- **Data analysis:** answering questions by loading, cleaning, summarising and charting data.
- **Tabular data:** data arranged as a table of rows and columns.
- **Row (record):** one thing being described, such as one order or one day.
- **Column (field):** one fact recorded for every row, such as the price or the date.
- **CSV (comma-separated values):** a plain-text table with one row per line and commas between the columns.
- **Header:** the first line of a CSV file, which names the columns.
- **Library (package):** a collection of ready-made code you import, such as pandas.
- **NumPy:** the library for fast maths on whole arrays of numbers.
- **pandas:** the library for working with tables of data.
- **matplotlib:** the library for drawing charts.
- **Jupyter notebook:** a document of code cells and their results, the usual way analysts run Python.

**Data analysis** means answering questions with data. "Which product earns the most?", "Is it hotter this year?", "Do students who study more score higher?" are all data questions.

Every analysis, whether you're an analyst making a dashboard or an AI engineer preparing training data, follows the same steps:

| Step | What you do | Where you'll learn it |
|---|---|---|
| 1. Ask | turn a vague goal into a clear question | every lesson |
| 2. Load | read the data from a file, database or website | Parts 1 and 3 |
| 3. Clean | fix gaps, typos, wrong types and duplicates | Part 4 |
| 4. Analyse | filter, group, combine and summarise | Parts 3 and 5 |
| 5. Show | draw charts that make the answer obvious | Part 6 |
| 6. Share | save results and explain what they mean | Part 6 |

![The data analysis workflow in six steps: ask a question, load the data, clean it, analyse it, show it in charts, share the results](../figures/workflow.svg)

## Data comes in tables

Most data you'll meet is **tabular**: a table where each **row** is one thing (one order, one customer, one day) and each **column** is one fact about it (the date, the price, the city). Here's the start of `sales.csv`, one of this course's practice files:

```text
order_id,order_date,customer_id,region,product,category,units,unit_price
1001,2025-01-01,C034,West,Headphones,Electronics,1,79.0
1002,2025-01-04,C086,North,Desk Lamp,Home,3,35.0
```

This format is called **CSV** (comma-separated values): one row per line, with commas between the columns. The first line, the **header**, names the columns. You can look at any practice file as plain text:

```python
text = open("products.csv").read()
print(text)
```

Open the **Data files** tab beside the editor to see all seven practice files. They reset before every run, so you can't break them.

## The tools: NumPy, pandas and matplotlib

Python on its own can do all of this, but it takes a lot of code. Three free **libraries** (packages of ready-made code) make it quick:

| Library | What it's for | How everyone imports it |
|---|---|---|
| **NumPy** | fast maths on whole lists of numbers at once | `import numpy as np` |
| **pandas** | tables: load, clean, filter, group and join data | `import pandas as pd` |
| **matplotlib** | charts | `import matplotlib.pyplot as plt` |

The short names `np`, `pd` and `plt` are a convention. You could pick any name, but every tutorial, job and AI assistant uses these, so you should too.

## Plain Python versus pandas

Here's a small set of orders as a list of dictionaries, and the total revenue worked out with a loop:

```python
orders = [
    {"product": "Pen", "units": 10, "price": 1.5},
    {"product": "Lamp", "units": 2, "price": 35.0},
    {"product": "Chair", "units": 1, "price": 189.0},
]

total = 0
for order in orders:
    total += order["units"] * order["price"]
print("Revenue:", total)
```

And here's the whole of `sales.csv` (600 orders) loaded and totalled with pandas. Don't worry about the details yet; just notice how short it is:

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
revenue = (sales["units"] * sales["unit_price"]).sum()
print("Orders:", len(sales))
print("Revenue:", revenue)
```

In this part you'll do things the plain-Python way first, so that when pandas does them in one line, you'll know exactly what that line means.

## Working on your own computer

The sandbox runs real Python in your browser. At work, people use **Jupyter notebooks** (or VS Code), where code runs in small cells and tables and charts appear under each cell. Everything in this course works there too: see the course README for the two install commands.

## Common mistakes

- Starting to code before you know the question. Write the question down first: it decides which data and which steps you need.
- Using a different short name like `import pandas as p`. It works, but everyone expects `pd`, `np` and `plt`.
- Treating a library as magic. Every pandas line does something you could write in plain Python; knowing that makes errors easier to understand.

## Exercises

### 1. Revenue from a few orders

Using the `orders` list below, work out the total revenue (units × price for every order, added up) and store it in a variable called `total`. Use a loop.

Starter code:

```python
orders = [
    {"product": "Notebook", "units": 12, "price": 4.5},
    {"product": "Monitor", "units": 2, "price": 249.0},
    {"product": "Pen Pack", "units": 5, "price": 6.0},
    {"product": "Desk Lamp", "units": 1, "price": 35.0},
]

total = 0
# your loop here

print(total)
```

### 2. Your first pandas line

Load `customers.csv` with pandas into a variable called `customers`, then print its first five rows with `customers.head()`.

Starter code:

```python
import pandas as pd

```

**In the sandbox:** exercises 1–2. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Inside the loop, add `order["units"] * order["price"]` to `total` with `+=`.
2. Copy the `pd.read_csv(...)` line from the example and change the file name.

</details>

<details>
<summary>Answers</summary>

**1. Revenue from a few orders**

```python
orders = [
    {"product": "Notebook", "units": 12, "price": 4.5},
    {"product": "Monitor", "units": 2, "price": 249.0},
    {"product": "Pen Pack", "units": 5, "price": 6.0},
    {"product": "Desk Lamp", "units": 1, "price": 35.0},
]

total = 0
for order in orders:
    total += order["units"] * order["price"]

print(total)
```

**2. Your first pandas line**

```python
import pandas as pd

customers = pd.read_csv("customers.csv")
print(customers.head())
```

</details>

## Quick quiz

1. In a table of sales, what is one **row**?
   - A) The list of column names
   - B) One record, like a single order
   - C) One fact, like the price

2. What does CSV stand for?
   - A) Comma-separated values
   - B) Column sorted view
   - C) Computer Spreadsheet Value

3. Which import is the standard way to load pandas?
   - A) `from pandas import *`
   - B) `import pandas`
   - C) `import pandas as pd`

<details>
<summary>Quiz answers</summary>

1. **B) One record, like a single order**: Each row is one thing being described (here, one order). Columns are the facts about it.
2. **A) Comma-separated values**: A CSV file is plain text with one row per line and commas between the columns.
3. **C) `import pandas as pd`**: Everyone uses the short name `pd`, so code you read and write looks the same everywhere.

</details>

---
Back to the [course home](../README.md) · Next: [Lesson 2: Reading and writing files](02-files-and-csv.md)
