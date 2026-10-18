# Lesson 18: Cleaning text

**You'll learn:** `.str` methods, `strip`, `lower`, `title`, `replace` vs `.str.replace`, `contains`, `split`, `extract`, `na=False`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python-data/#text-cleaning)**: run every example and check your exercise answers.

## Key terms

- **.str accessor:** gives a text column all the string methods, applied to every value.
- **strip:** removes spaces (and newlines) from both ends of text.
- **title case:** Each Word Starting With A Capital.
- **Standardise:** make values that mean the same thing look the same.
- **str.contains:** True where the text includes a substring.
- **str.split:** breaks text into parts at a separator.
- **Regular expression (regex):** a pattern for matching text, like `\d+` for "one or more digits".
- **str.extract:** pulls out the part of each value that matches a pattern.

Text typed by people is inconsistent: `"Sales"`, `"sales"` and `"SALES "` are the same department to you, but three different values to a computer. Until they match, counts and groups are wrong.

```python
import pandas as pd

employees = pd.read_csv("employees_messy.csv")
print(employees["department"].value_counts())
```

There are really only four departments. Let's fix it.

## The .str accessor

Every string method you know (`strip`, `lower`, `replace`…) works on a whole text column through `.str`:

```python
import pandas as pd

employees = pd.read_csv("employees_messy.csv")
dept = employees["department"].str.strip().str.title()
print(dept.value_counts())
```

`strip()` removes spaces at the ends, and `title()` makes every word start with a capital. Four departments, but look closely: `title()` turned `HR` into `Hr`. Fix exceptions like that with `.replace`, which swaps whole values:

```python
import pandas as pd

employees = pd.read_csv("employees_messy.csv")
dept = employees["department"].str.strip().str.title().replace({"Hr": "HR"})
print(dept.value_counts())
```

| Method | Does | `"  sales team "` becomes |
|---|---|---|
| `.str.strip()` | remove spaces at both ends | `"sales team"` |
| `.str.lower()` / `.str.upper()` | all small / all capital letters | `"  sales team "` → `"  SALES TEAM "` |
| `.str.title()` | capitalise each word | `"  Sales Team "` |
| `.str.replace(a, b)` | swap text | |
| `.str.len()` | number of characters | `14` |

## Names

The same treatment tidies names:

```python
import pandas as pd

employees = pd.read_csv("employees_messy.csv")
print(employees["name"].head(4).tolist())
employees["name"] = employees["name"].str.strip().str.title()
print(employees["name"].head(4).tolist())
```

`title()` isn't perfect: it would turn "McDonald" into "Mcdonald". For real people's names, check a sample by eye.

## Mapping spelling variants

When the variants aren't just spaces and capitals, map them to one value with `replace` and a dictionary:

```python
import pandas as pd

answers = pd.Series(["UK", "U.K.", "United Kingdom", "uk", "France", "FR"])
clean = answers.str.upper().replace({"U.K.": "UK", "UNITED KINGDOM": "UK", "FR": "FRANCE"})
print(clean.value_counts())
```

Note the difference: `.str.replace` swaps **part** of each string, while `.replace` (no `.str`) swaps **whole** values.

## Searching text

`contains`, `startswith` and `endswith` give True/False masks for filtering. `case=False` ignores capitals:

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
desk = sales[sales["product"].str.contains("desk", case=False)]
print(desk["product"].unique())

customers = pd.read_csv("customers.csv")
print(customers[customers["name"].str.endswith("Patel")]["name"].tolist())
```

## Splitting and extracting

`str.split` breaks text into parts. `expand=True` puts the parts into separate columns, and `.str[0]` takes the first part:

```python
import pandas as pd

employees = pd.read_csv("employees_messy.csv")
emails = employees["email"].dropna()
print(emails.str.split("@").str[1].value_counts())

names = employees["name"].str.strip().str.title()
parts = names.str.split(" ", expand=True)
parts.columns = ["first", "last"]
print(parts.head(3))
```

`str.extract` pulls out the part of each value that matches a **pattern** (a regular expression). `(\d+)` means "one or more digits":

```python
import pandas as pd

codes = pd.Series(["Room 12", "Room 3", "Lab 101", "Hall"])
print(codes.str.extract(r"(\d+)"))
```

Regular expressions are a language of their own; you only need simple ones like this for now.

## Missing values in text

`.str` methods leave missing values missing, so they're safe to use on columns with gaps. But masks with gaps need `na=False` to decide what a missing value counts as:

```python
import pandas as pd

employees = pd.read_csv("employees_messy.csv")
has_example = employees["email"].str.endswith("@example.com", na=False)
print(has_example.sum(), "of", len(employees), "have an example.com email")
```

## Common mistakes

- Forgetting `.str`: `df["name"].strip()` is an error. Write `df["name"].str.strip()`.
- Cleaning case but not spaces (or the reverse). `"SALES "` needs both `strip()` and a case change.
- Searching with `contains` on a column with gaps and getting an error when filtering. Add `na=False`.

## Exercises

### 1. Tidy departments

Load `employees_messy.csv` and clean `department` so that every value is stripped of spaces and in title case (like `"Sales"`). Store the cleaned column back in `employees["department"]`, then store `employees["department"].value_counts()` in `dept_counts`.

Starter code:

```python
import pandas as pd

employees = pd.read_csv("employees_messy.csv")

```

### 2. Email domains

`emails` holds some addresses with stray spaces and capitals. Make `domains`: the part after the `@` in each address, lower case with no spaces.

Starter code:

```python
import pandas as pd

emails = pd.Series([" Ada@Example.com", "grace@NAVY.mil ", "alan@cam.ac.uk", " LINUS@Example.COM "])

```

**In the sandbox:** exercises 35–36. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Chain `.str.strip()` and `.str.title()`.
2. Clean first (`strip`, `lower`), then `.str.split("@").str[1]`.

</details>

<details>
<summary>Answers</summary>

**1. Tidy departments**

```python
import pandas as pd

employees = pd.read_csv("employees_messy.csv")
employees["department"] = employees["department"].str.strip().str.title()
dept_counts = employees["department"].value_counts()
print(dept_counts)
```

**2. Email domains**

```python
import pandas as pd

emails = pd.Series([" Ada@Example.com", "grace@NAVY.mil ", "alan@cam.ac.uk", " LINUS@Example.COM "])
domains = emails.str.strip().str.lower().str.split("@").str[1]
print(domains)
```

</details>

## Quick quiz

1. Why does `value_counts()` show `"Sales"` and `"sales"` separately?
   - A) One of them is missing
   - B) pandas counts randomly
   - C) Text comparisons are exact, including capital letters

2. What's the difference between `s.str.replace("a", "b")` and `s.replace({"a": "b"})`?
   - A) `.replace` only works on numbers
   - B) `.str.replace` changes part of each string; `.replace` swaps whole values
   - C) None

3. What does `.str.split("@").str[1]` give for `"ada@example.com"`?
   - A) `"ada"`
   - B) `["ada", "example.com"]`
   - C) `"example.com"`

<details>
<summary>Quiz answers</summary>

1. **C) Text comparisons are exact, including capital letters**: To a computer they're different strings. Standardise the case before counting.
2. **B) `.str.replace` changes part of each string; `.replace` swaps whole values**: Use `.str.replace` for characters inside text, and `.replace` to map complete values.
3. **C) `"example.com"`**: Split makes a list of parts; `.str[1]` takes the second part.

</details>

---
Previous: [Lesson 17](17-data-types.md) · Next: [Lesson 19: Duplicates and impossible values](19-duplicates-and-outliers.md)
