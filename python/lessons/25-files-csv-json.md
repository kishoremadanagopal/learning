# Lesson 25: Files, CSV and JSON

**You'll learn:** `open()` and `with`, file modes, `io.StringIO`, `csv`, `json`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python/#files-csv-json)**: run every example and check your exercise answers.

## Key terms

- **File mode:** how a file is opened: `"r"` read, `"w"` write, `"a"` append.
- **with statement:** opens a resource and closes it automatically.
- **Encoding:** how text is stored as bytes. Use `encoding="utf-8"`.
- **CSV:** comma-separated values, a plain-text table format.
- **JSON:** JavaScript Object Notation, a text format for nested data.
- **Serialization:** converting Python data to text (`json.dumps`) and back (`json.loads`).

Programs often read data from files and save results back. On your own computer you use `open()`:

```python
# Write a file
with open("notes.txt", "w", encoding="utf-8") as f:
    f.write("first line\n")
    f.write("second line\n")

# Read it back, one line at a time
with open("notes.txt", encoding="utf-8") as f:
    for line in f:
        print(line.strip())
```

| Mode | Meaning |
|---|---|
| `"r"` | read (the default) |
| `"w"` | write, replacing the file |
| `"a"` | append to the end |
| `"x"` | create, failing if the file exists |

The `with` statement closes the file automatically, even if an error happens. Always use it.

## Practising in the browser

This browser editor has no real disk, so the runnable examples use `io.StringIO`, an in-memory object that behaves exactly like an open text file. Everything you learn transfers directly: replace `io.StringIO(...)` with `open("file.txt")`.

```python
import io

f = io.StringIO("apples 3\npears 5\nplums 2\n")
total = 0
for line in f:
    name, count = line.split()
    total += int(count)
    print(f"{name:<8}{count:>3}")
print("Total:", total)
```

Useful file methods: `f.read()` returns the whole content as one string, `f.readlines()` returns a list of lines, and looping over `f` reads one line at a time (best for big files).

## CSV: spreadsheet-style data

CSV (comma-separated values) is the most common format for tables. The `csv` module handles quoting and commas inside values for you.

```python
import csv, io

data = io.StringIO("""name,department,salary
Ana,Engineering,95000
Ben,Sales,62000
"Cy, Jr.",Engineering,88000
""")

reader = csv.DictReader(data)
by_dept = {}
for row in reader:
    salary = int(row["salary"])          # CSV values are always strings
    by_dept.setdefault(row["department"], []).append(salary)

for dept, salaries in by_dept.items():
    print(f"{dept}: average {sum(salaries) / len(salaries):,.0f}")
```

Writing CSV works the same way with `csv.writer` or `csv.DictWriter`:

```python
import csv, io

out = io.StringIO()
writer = csv.writer(out)
writer.writerow(["city", "temp"])
writer.writerows([["Oslo", -2], ["Lima", 19]])
print(out.getvalue())
```

## JSON: data for the web

JSON is how most web APIs exchange data. It maps neatly onto Python dicts and lists.

```python
import json

text = '{"user": "ada", "active": true, "tags": ["math", "code"], "score": null}'
data = json.loads(text)          # JSON string -> Python
print(data["tags"], data["active"], data["score"])

data["score"] = 99
print(json.dumps(data, indent=2))   # Python -> JSON string
```

Note how JSON's `true`/`null` become Python's `True`/`None`. With real files, use `json.load(f)` and `json.dump(data, f)` (no `s`).

## Common mistakes

- Opening a file with `"w"` when you meant `"a"`, which erases it.
- Forgetting that CSV values are strings: convert with `int()` / `float()` before doing math.
- Mixing up `json.load` (from a file) and `json.loads` (from a string).
- Splitting CSV lines with `.split(",")`, which breaks on quoted values with commas. Use the `csv` module.

## Exercises

### 1. Total sales from CSV

Write `total_by_product(csv_text)` that takes CSV text with columns `product,qty,price` and returns a dict mapping each product to its total revenue (`qty * price`), rounded to 2 decimals.

Starter code:

```python
import csv, io

def total_by_product(csv_text):
    totals = {}
    return totals

sample = """product,qty,price
pen,10,1.5
book,2,12.99
pen,4,1.5
"""
print(total_by_product(sample))
```

### 2. Active users from JSON

Write `active_names(json_text)` that parses a JSON list of user objects and returns a sorted list of the `name`s of users whose `active` field is `true`.

Starter code:

```python
import json

def active_names(json_text):
    return []

sample = '[{"name": "ben", "active": true}, {"name": "ana", "active": true}, {"name": "cy", "active": false}]'
print(active_names(sample))
```

**In the sandbox:** exercises 41–42. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Loop over csv.DictReader(io.StringIO(csv_text)). Convert qty with int() and price with float(), and accumulate with totals.get(name, 0) + revenue. Round at the end.
2. users = json.loads(json_text), then sorted(u["name"] for u in users if u["active"]).

</details>

<details>
<summary>Answers</summary>

**1. Total sales from CSV**

```python
import csv, io

def total_by_product(csv_text):
    totals = {}
    for row in csv.DictReader(io.StringIO(csv_text)):
        revenue = int(row["qty"]) * float(row["price"])
        totals[row["product"]] = totals.get(row["product"], 0) + revenue
    return {name: round(value, 2) for name, value in totals.items()}

sample = """product,qty,price
pen,10,1.5
book,2,12.99
pen,4,1.5
"""
print(total_by_product(sample))
```

**2. Active users from JSON**

```python
import json

def active_names(json_text):
    users = json.loads(json_text)
    return sorted(u["name"] for u in users if u["active"])

sample = '[{"name": "ben", "active": true}, {"name": "ana", "active": true}, {"name": "cy", "active": false}]'
print(active_names(sample))
```

</details>

## Quick quiz

1. Why use `with open(...) as f:`?
   - A) The file is closed automatically, even after an error
   - B) It's required to write files
   - C) It reads faster

2. What does `json.loads('{"a": null}')` return?
   - A) {'a': 0}
   - B) {'a': None}
   - C) {'a': 'null'}

3. What type are values read by `csv.DictReader`?
   - A) They're converted automatically
   - B) Always strings

<details>
<summary>Quiz answers</summary>

1. **A) The file is closed automatically, even after an error**: `with` guarantees cleanup. Forgetting to close files can lose data.
2. **B) {'a': None}**: JSON null becomes Python None.
3. **B) Always strings**: CSV has no types, so every value arrives as a string. Convert numbers yourself.

</details>

---
Previous: [Lesson 24](24-modules-and-stdlib.md) · Next: [Lesson 26: Testing and debugging](26-testing-and-debugging.md)
