# Lesson 2: Reading and writing files

**You'll learn:** `open()`, `with`, reading lines, `csv.DictReader`, writing text and CSV files.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python-data/#files-and-csv)**: run every example and check your exercise answers.

## Key terms

- **File path:** the name (and folder) of a file, like `"sales.csv"`.
- **with block:** `with open(...) as f:` opens a file and closes it automatically afterwards.
- **Mode:** how a file is opened: `"r"` read (the default), `"w"` write (replaces), `"a"` append.
- **csv module:** Python's built-in tool for reading and writing CSV files correctly, including quoted values.
- **csv.DictReader:** reads a CSV file as one dictionary per row, keyed by the header names.
- **csv.DictWriter:** writes dictionaries out as CSV rows.
- **Newline character:** the invisible `\n` at the end of each line of a file.
- **FileNotFoundError:** the error raised when a file name doesn't exist.

Before pandas, it helps to see how Python reads files on its own. You'll use this for logs, text and odd formats that pandas can't handle.

## Opening and reading a file

`open(name)` opens a file. The safest way is a **`with` block**, which closes the file for you when the block ends, even if an error happens:

```python
with open("products.csv") as f:
    text = f.read()

print(type(text))
print(len(text), "characters")
print(text[:120])
```

`f.read()` gives you the whole file as one string. Often it's easier to go line by line: looping over a file gives one line at a time, including the newline character at the end. `.strip()` removes it.

```python
with open("products.csv") as f:
    for line in f:
        print(line.strip())
```

## Splitting lines into columns

Each line is text. To get the columns, split it on commas:

```python
with open("products.csv") as f:
    header = f.readline().strip().split(",")
    first = f.readline().strip().split(",")

print(header)
print(first)
print(first[2], "is text, not a number:", type(first[2]))
```

Two lessons here. First, everything read from a file is **text** (a string). `"899.0"` must be converted with `float()` before you can do maths. Second, splitting on commas breaks when a value itself contains a comma, like `"92,000"`. CSV files wrap such values in quotes, and a plain `split(",")` doesn't understand quotes.

## The csv module does it properly

Python's built-in `csv` module understands quotes. `csv.DictReader` is the most useful part: it reads the header for you and gives you each row as a **dictionary** keyed by column name.

```python
import csv

with open("products.csv") as f:
    reader = csv.DictReader(f)
    for row in reader:
        margin = float(row["unit_price"]) - float(row["unit_cost"])
        print(f'{row["product"]:<13} margin {margin:7.2f}')
```

Here's the comma problem solved. The salary `"92,000"` stays in one piece:

```python
import csv

with open("employees_messy.csv") as f:
    rows = list(csv.DictReader(f))

print(len(rows), "rows")
print(rows[1])
```

`list(reader)` reads every row into a list in one go, so you can use them after the `with` block ends.

## Writing files

Open a file with `"w"` (write) to create it, or replace it if it already exists. `"a"` (append) adds to the end instead.

```python
with open("notes.txt", "w") as f:
    f.write("First line\n")
    f.write("Second line\n")

with open("notes.txt", "a") as f:
    f.write("Added later\n")

print(open("notes.txt").read())
```

`csv.DictWriter` writes dictionaries as CSV rows. Pass `newline=""` when opening, which stops blank lines appearing between rows on Windows:

```python
import csv

cheap = [{"product": "Notebook", "price": 4.5}, {"product": "Pen Pack", "price": 6.0}]

with open("cheap.csv", "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["product", "price"])
    writer.writeheader()
    writer.writerows(cheap)

print(open("cheap.csv").read())
```

## When the file isn't there

A wrong file name raises `FileNotFoundError`. Read the message: it tells you the name Python tried.

*This example raises an error on purpose.*

```python
with open("sale.csv") as f:
    print(f.read())
```

## Common mistakes

- Doing maths on values straight from a file. They're strings: `"4.5" * 2` gives `"4.54.5"`. Convert with `float()` or `int()` first.
- Splitting CSV lines with `line.split(",")`. It breaks on quoted values like `"92,000"`. Use the `csv` module (or pandas).
- Opening a file you want to keep with `"w"`. Write mode empties the file first; use `"a"` to add to it.

## Exercises

### 1. Count the North orders

Use `csv.DictReader` to read `sales.csv` and count how many orders have `region` equal to `"North"`. Store the count in `north_orders`.

Starter code:

```python
import csv

north_orders = 0

print(north_orders)
```

### 2. Write a price list

Read `products.csv` and write a new file called `price_list.csv` with just two columns, `product` and `unit_price`, for every product that costs **less than 100**. Include the header row.

Starter code:

```python
import csv

```

**In the sandbox:** exercises 3–4. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Inside `with open("sales.csv") as f:`, loop `for row in csv.DictReader(f):` and add 1 when `row["region"] == "North"`.
2. Remember the prices are text: compare `float(p["unit_price"]) < 100`. Build a list of small dictionaries, then write it with `csv.DictWriter`.

</details>

<details>
<summary>Answers</summary>

**1. Count the North orders**

```python
import csv

north_orders = 0
with open("sales.csv") as f:
    for row in csv.DictReader(f):
        if row["region"] == "North":
            north_orders += 1

print(north_orders)
```

**2. Write a price list**

```python
import csv

with open("products.csv") as f:
    products = list(csv.DictReader(f))

cheap = []
for p in products:
    if float(p["unit_price"]) < 100:
        cheap.append({"product": p["product"], "unit_price": p["unit_price"]})

with open("price_list.csv", "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["product", "unit_price"])
    writer.writeheader()
    writer.writerows(cheap)

print(open("price_list.csv").read())
```

</details>

## Quick quiz

1. Why use `with open(...) as f:` instead of just `f = open(...)`?
   - A) It closes the file automatically when the block ends
   - B) It converts numbers for you
   - C) It reads the file faster

2. You read `"249.0"` from a CSV file. What type is it?
   - A) `float`
   - B) `int`
   - C) `str`

3. What does `csv.DictReader` give you for each row?
   - A) A dictionary keyed by the column names
   - B) A single string
   - C) A list of values

<details>
<summary>Quiz answers</summary>

1. **A) It closes the file automatically when the block ends**: A `with` block always closes the file, even if an error happens inside it.
2. **C) `str`**: Everything read from a text file is a string. Convert it with `float()` before doing maths.
3. **A) A dictionary keyed by the column names**: It uses the header line as keys, so you can write `row["region"]` instead of remembering positions.

</details>

---
Previous: [Lesson 1](01-what-is-data-analysis.md) · Next: [Lesson 3: JSON data](03-json-data.md)
