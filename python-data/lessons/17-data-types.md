# Lesson 17: Fixing data types

**You'll learn:** `dtypes`, `astype`, `pd.to_numeric`, `errors="coerce"`, cleaning text into numbers, `Int64`, `dtype=` on load, categories.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python-data/#data-types)**: run every example and check your exercise answers.

## Key terms

- **astype:** converts a column to another type; fails if any value can't be converted.
- **pd.to_numeric:** converts values to numbers; `errors="coerce"` turns failures into missing values.
- **Coerce:** force a conversion, replacing what can't be converted with a missing value.
- **Nullable integer (Int64):** a whole-number type that can also hold missing values.
- **Categorical:** a type for a column with a few repeating values, optionally in a set order.
- **regex=False:** tells `.str.replace` to treat the search text literally, not as a pattern.

A column's dtype decides what you can do with it. A salary stored as text can't be averaged; a postcode stored as a number loses its leading zero. Fixing types is one of the most common cleaning jobs.

## Spotting the problem

```python
import pandas as pd

employees = pd.read_csv("employees_messy.csv")
print(employees.dtypes)
print(employees["salary"].head(6))
```

`salary` is `str` (text) because some values contain `$` and commas. Trying to do maths fails or gives nonsense:

*This example raises an error on purpose.*

```python
import pandas as pd

employees = pd.read_csv("employees_messy.csv")
print(employees["salary"].mean())
```

## astype: convert when the values are clean

`astype` converts a whole column. It works when every value can be converted:

```python
import pandas as pd

df = pd.DataFrame({"units": ["3", "12", "7"], "price": ["4.5", "6", "35"]})
print(df.dtypes)
df["units"] = df["units"].astype(int)
df["price"] = df["price"].astype(float)
print(df.dtypes)
print((df["units"] * df["price"]).sum())
```

## Cleaning text into numbers

For the salaries, first strip out the `$` and the commas with `.str.replace`, then convert. `pd.to_numeric` is safer than `astype` because `errors="coerce"` turns anything that still can't be converted into a missing value instead of crashing:

```python
import pandas as pd

employees = pd.read_csv("employees_messy.csv")
cleaned = (employees["salary"]
           .str.replace("$", "", regex=False)
           .str.replace(",", "", regex=False))
employees["salary"] = pd.to_numeric(cleaned, errors="coerce")
print(employees["salary"].head(6))
print(employees["salary"].dtype)
print("Average salary:", employees["salary"].mean().round(0))
```

`regex=False` tells pandas to treat `"$"` as a plain character. (In patterns, `$` has a special meaning.)

See what `errors="coerce"` does with values that aren't numbers:

```python
import pandas as pd

raw = pd.Series(["10", "12.5", "n/a", "eight", "7"])
print(pd.to_numeric(raw, errors="coerce"))
```

After converting, always count how many values became missing. If it's more than you expected, some formats weren't handled.

## Whole numbers with gaps

A normal integer column can't hold missing values, so pandas makes it `float64` (that's why `age` shows `49.0`). The **nullable** integer type `"Int64"` (capital I) keeps whole numbers and allows gaps:

```python
import pandas as pd

employees = pd.read_csv("employees_messy.csv")
print(employees["age"].head(6))
employees["age"] = employees["age"].astype("Int64")
print(employees["age"].head(6))
```

## Numbers that should be text

IDs, phone numbers and postcodes look like numbers but aren't for maths. Read them as text with `dtype=` so leading zeros survive:

```python
import io
import pandas as pd

text = "store,postcode\nA,02134\nB,10001\n"
print(pd.read_csv(io.StringIO(text)))
print(pd.read_csv(io.StringIO(text), dtype={"postcode": str}))
```

## Categories

A text column with a few repeating values (regions, segments, sizes) can be a **category**. It uses less memory and can have a meaningful order:

```python
import pandas as pd

sizes = pd.Series(["M", "S", "L", "M", "S"])
sizes = pd.Categorical(sizes, categories=["S", "M", "L"], ordered=True)
print(sizes)
print(sorted(sizes))
print(sizes.max())
```

Without the category, sorting gives `L, M, S` (alphabetical). With it, sorting follows S, M, L.

## Common mistakes

- Using `astype(float)` on dirty text and getting an error. Clean the characters first, or use `pd.to_numeric(..., errors="coerce")`.
- Coercing without checking. Count the new missing values; if there are many, some formats weren't handled.
- Storing IDs and postcodes as numbers, which drops leading zeros. Load them as text.

## Exercises

### 1. Clean the salaries

Load `employees_messy.csv` and convert `salary` into numbers: remove `$` and commas, then use `pd.to_numeric(..., errors="coerce")`. Store the result back in `employees["salary"]`, and store the **median salary** in `median_salary`.

Starter code:

```python
import pandas as pd

employees = pd.read_csv("employees_messy.csv")

```

### 2. Numbers from a survey

`answers` holds how many hours people said they slept, typed by hand. Convert it with `pd.to_numeric` so the words become missing values, store it in `hours`, and store how many answers couldn't be converted in `bad`.

Starter code:

```python
import pandas as pd

answers = pd.Series(["7", "8", "six", "7.5", "", "9", "about 6", "5"])

```

**In the sandbox:** exercises 33–34. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Chain two `.str.replace(..., "", regex=False)` calls, then wrap the result in `pd.to_numeric(..., errors="coerce")`.
2. `errors="coerce"` turns what it can't read into NaN; count those with `.isna().sum()`.

</details>

<details>
<summary>Answers</summary>

**1. Clean the salaries**

```python
import pandas as pd

employees = pd.read_csv("employees_messy.csv")
cleaned = employees["salary"].str.replace("$", "", regex=False).str.replace(",", "", regex=False)
employees["salary"] = pd.to_numeric(cleaned, errors="coerce")
median_salary = employees["salary"].median()
print(median_salary)
```

**2. Numbers from a survey**

```python
import pandas as pd

answers = pd.Series(["7", "8", "six", "7.5", "", "9", "about 6", "5"])
hours = pd.to_numeric(answers, errors="coerce")
bad = hours.isna().sum()
print(hours)
print(bad)
```

</details>

## Quick quiz

1. Why did `salary` load as text?
   - A) Some values contain `$` and commas, so pandas can't read them as numbers
   - B) CSV files can't hold numbers
   - C) pandas always reads money as text

2. What does `pd.to_numeric(s, errors="coerce")` do with `"eight"`?
   - A) Turns it into a missing value
   - B) Raises an error
   - C) Converts it to 8

3. Why read postcodes with `dtype={"postcode": str}`?
   - A) To keep leading zeros, since postcodes aren't for maths
   - B) To make them faster to sort
   - C) Because numbers can't be in CSV files

<details>
<summary>Quiz answers</summary>

1. **A) Some values contain `$` and commas, so pandas can't read them as numbers**: One unreadable value is enough to make pandas keep the whole column as text.
2. **A) Turns it into a missing value**: "coerce" replaces anything it can't convert with NaN, so check how many values went missing.
3. **A) To keep leading zeros, since postcodes aren't for maths**: As numbers, `02134` becomes `2134`. Codes and IDs should stay text.

</details>

---
Previous: [Lesson 16](16-missing-values.md) · Next: [Lesson 18: Cleaning text](18-text-cleaning.md)
