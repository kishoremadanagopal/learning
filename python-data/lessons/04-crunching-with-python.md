# Lesson 4: Crunching data with plain Python

**You'll learn:** filtering with comprehensions, `sum()`, `Counter`, grouping with a dictionary, ranking with `sorted(key=...)`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python-data/#crunching-with-python)**: run every example and check your exercise answers.

## Key terms

- **Filter:** keep only the rows that match a condition.
- **List comprehension:** `[x for x in items if condition]`, a one-line way to build a filtered list.
- **Generator expression:** a comprehension in round brackets, like `sum(x for x in items)`, that produces values one at a time.
- **Counter:** a dictionary from `collections` that counts things and can add up amounts.
- **Group:** split rows by the values of a column, then summarise each part.
- **Aggregate:** a single number that summarises many, such as a sum, count or average.
- **lambda:** a tiny unnamed function, like `lambda p: p[1]`, often used as a sort key.

You now have records in a list of dictionaries. This lesson covers the four things analysts do all day: **filter**, **count**, **group** and **rank**. You'll do them in plain Python here; pandas does each one in a single line later.

All the examples start from the sales file, read with `csv.DictReader` and with the number columns converted:

```python
import csv

with open("sales.csv") as f:
    sales = list(csv.DictReader(f))

for s in sales:
    s["units"] = int(s["units"])
    s["unit_price"] = float(s["unit_price"])

print(len(sales), "orders")
print(sales[0])
```

## Filter: keep the rows you want

A **list comprehension** with an `if` keeps only matching records:

```python
import csv

with open("sales.csv") as f:
    sales = list(csv.DictReader(f))

laptops = [s for s in sales if s["product"] == "Laptop"]
big = [s for s in sales if int(s["units"]) >= 10]
print(len(laptops), "laptop orders")
print(len(big), "orders of 10 or more units")
print([s["order_id"] for s in big[:5]])
```

## Totals with sum()

`sum()` accepts a **generator expression**, a comprehension without square brackets:

```python
import csv

with open("sales.csv") as f:
    sales = list(csv.DictReader(f))

units = sum(int(s["units"]) for s in sales)
revenue = sum(int(s["units"]) * float(s["unit_price"]) for s in sales)
print("Units sold:", units)
print(f"Revenue: {revenue:,.2f}")
print(f"Average order value: {revenue / len(sales):.2f}")
```

## Count: how many of each?

`collections.Counter` counts things for you. `most_common(n)` gives the top `n`:

```python
import csv
from collections import Counter

with open("sales.csv") as f:
    sales = list(csv.DictReader(f))

by_region = Counter(s["region"] for s in sales)
print(by_region)
print(by_region.most_common(2))
print(by_region["West"])
```

A Counter can also add up amounts instead of counting rows:

```python
import csv
from collections import Counter

with open("sales.csv") as f:
    sales = list(csv.DictReader(f))

units_by_product = Counter()
for s in sales:
    units_by_product[s["product"]] += int(s["units"])
print(units_by_product.most_common(3))
```

## Group: a total per category

Grouping means "split the rows by a column, then total each group". The pattern is a dictionary that starts each new key at zero:

```python
import csv

with open("sales.csv") as f:
    sales = list(csv.DictReader(f))

revenue = {}
for s in sales:
    key = s["category"]
    revenue[key] = revenue.get(key, 0) + int(s["units"]) * float(s["unit_price"])

for category, total in revenue.items():
    print(f"{category:<12} {total:>10,.2f}")
```

`revenue.get(key, 0)` returns 0 the first time a category appears. Keep this pattern in mind: it's exactly what pandas' `groupby` does.

## Rank: sort by a value

`sorted()` with `key=` sorts records (or dictionary items) by whatever you choose. `reverse=True` puts the biggest first:

```python
products = {"Laptop": 41, "Notebook": 101, "Pen Pack": 121, "Monitor": 59}

ranked = sorted(products.items(), key=lambda pair: pair[1], reverse=True)
print(ranked)
print("Top seller:", ranked[0][0])
print("Fewest orders:", min(products, key=products.get))
```

`lambda pair: pair[1]` is a tiny function that says "sort by the second item" (the count).

## Why pandas next

Each task above took 5 to 10 lines and careful type conversion. Here's a preview of the same group-and-rank in pandas:

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
sales["revenue"] = sales["units"] * sales["unit_price"]
print(sales.groupby("category")["revenue"].sum().sort_values(ascending=False))
```

Next comes NumPy, the fast number engine underneath pandas, and then pandas itself.

## Common mistakes

- Forgetting to convert strings before adding: `sum(s["units"] for s in sales)` fails because units are text. Wrap them in `int()`.
- Writing `revenue[key] += amount` for a key that doesn't exist yet, which raises `KeyError`. Use `revenue.get(key, 0) + amount` or a `Counter`.
- Sorting a dictionary with `sorted(d)` and expecting values. That sorts the keys; use `sorted(d.items(), key=...)`.

## Exercises

### 1. Revenue per region

Read `sales.csv` and build a dictionary called `revenue` that maps each region to its total revenue (units × unit_price, added up). Round nothing; just total.

Starter code:

```python
import csv

revenue = {}

print(revenue)
```

### 2. Top three products by units

Use `Counter` to add up the **units** sold for each product in `sales.csv`, then store the three best sellers in `top3` using `most_common(3)`. `top3` should be a list of `(product, units)` pairs.

Starter code:

```python
import csv
from collections import Counter

```

**In the sandbox:** exercises 7–8. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Loop with `csv.DictReader`, and use `revenue[region] = revenue.get(region, 0) + amount`.
2. `units[s["product"]] += int(s["units"])` inside the loop, then `top3 = units.most_common(3)`.

</details>

<details>
<summary>Answers</summary>

**1. Revenue per region**

```python
import csv

revenue = {}
with open("sales.csv") as f:
    for s in csv.DictReader(f):
        amount = int(s["units"]) * float(s["unit_price"])
        revenue[s["region"]] = revenue.get(s["region"], 0) + amount

print(revenue)
```

**2. Top three products by units**

```python
import csv
from collections import Counter

units = Counter()
with open("sales.csv") as f:
    for s in csv.DictReader(f):
        units[s["product"]] += int(s["units"])

top3 = units.most_common(3)
print(top3)
```

</details>

## Quick quiz

1. What does `Counter(["a", "b", "a"])` give?
   - A) `3`
   - B) `Counter({'a': 2, 'b': 1})`
   - C) `['a', 'b']`

2. In `revenue.get(key, 0)`, what is the `0` for?
   - A) It limits the dictionary to one key
   - B) It sets every value to zero
   - C) It's returned when the key isn't in the dictionary yet

3. What does `sorted(items, key=lambda p: p[1], reverse=True)` do?
   - A) Sorts by the second item, biggest first
   - B) Sorts by the first item, smallest first
   - C) Removes duplicates

<details>
<summary>Quiz answers</summary>

1. **B) `Counter({'a': 2, 'b': 1})`**: A Counter counts how many times each value appears.
2. **C) It's returned when the key isn't in the dictionary yet**: `.get` returns the default when the key is missing, so the first amount for a new key starts from 0.
3. **A) Sorts by the second item, biggest first**: `key=` chooses what to sort by (the second item), and `reverse=True` puts the largest first.

</details>

---
Previous: [Lesson 3](03-json-data.md) · Next: [Lesson 5: NumPy arrays](05-numpy-arrays.md)
