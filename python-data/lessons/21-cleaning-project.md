# Lesson 21: Project: clean an HR export

**You'll learn:** a full cleaning workflow, working on a copy, cleaning functions, `assert` checks, `to_csv`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python-data/#cleaning-project)**: run every example and check your exercise answers.

## Key terms

- **Raw data:** the data exactly as it arrived, kept unchanged for reference.
- **Cleaning pipeline:** the ordered steps that turn raw data into clean data.
- **Reproducible:** giving the same result every time it's run on the same input.
- **assert:** a statement that stops with an error if a condition isn't true, used as an automatic check.
- **to_csv:** writes a DataFrame to a CSV file; `index=False` leaves out the index.
- **Data quality check:** a test that the cleaned data meets your expectations.

Time to clean a real mess from start to finish. `employees_messy.csv` is an HR export with every problem from this part. You'll build the cleaning one step at a time, checking as you go, and wrap it in a function so it can be re-run on next month's export.

## Step 0: look before you touch

```python
import pandas as pd

raw = pd.read_csv("employees_messy.csv")
print(raw.shape)
raw.info()
print(raw.head(8))
```

Problems spotted:

1. three exact duplicate rows;
2. names with stray spaces and mixed capitals;
3. departments with stray spaces and mixed capitals (8 spellings of 4 departments);
4. salaries as text with `$` and commas, and some missing;
5. impossible ages (230 and -1) and some missing;
6. start dates as text, some missing;
7. some emails missing.

## Steps 1 to 3: duplicates and text

Work on a copy, so the raw data stays untouched for comparison:

```python
import pandas as pd

raw = pd.read_csv("employees_messy.csv")
df = raw.drop_duplicates().copy()
df["name"] = df["name"].str.strip().str.title()
df["department"] = df["department"].str.strip().str.title().replace({"Hr": "HR"})
print(len(df))
print(df["department"].value_counts())
print(df["name"].head(5).tolist())
```

## Steps 4 to 6: numbers and dates

```python
import pandas as pd

raw = pd.read_csv("employees_messy.csv")
df = raw.drop_duplicates().copy()

salary_text = df["salary"].str.replace("$", "", regex=False).str.replace(",", "", regex=False)
df["salary"] = pd.to_numeric(salary_text, errors="coerce")

df["age"] = df["age"].mask((df["age"] < 16) | (df["age"] > 100)).astype("Int64")
df["start_date"] = pd.to_datetime(df["start_date"], errors="coerce")

print(df.dtypes)
print(df[["salary", "age"]].describe().round(0))
```

## Step 7: decide about the gaps

Not every gap should be filled. A guessed salary would distort pay analysis, so leave salaries missing but count them. A missing email is fine to label:

```python
import pandas as pd

raw = pd.read_csv("employees_messy.csv")
df = raw.drop_duplicates().copy()
df["email"] = df["email"].fillna("not provided")
print(df["email"].value_counts().head(3))
```

## Wrapping it in a function

Putting every step in one function makes the cleaning **repeatable**: next month you call `clean()` on the new file and get the same result, with no forgotten steps.

```python
import pandas as pd

def clean_employees(raw):
    """Return a cleaned copy of the HR export."""
    df = raw.drop_duplicates().copy()
    for col in ["name", "department"]:
        df[col] = df[col].str.strip().str.title()
    df["department"] = df["department"].replace({"Hr": "HR"})
    salary_text = df["salary"].str.replace("$", "", regex=False).str.replace(",", "", regex=False)
    df["salary"] = pd.to_numeric(salary_text, errors="coerce")
    df["age"] = df["age"].mask((df["age"] < 16) | (df["age"] > 100)).astype("Int64")
    df["start_date"] = pd.to_datetime(df["start_date"], errors="coerce")
    df["email"] = df["email"].fillna("not provided")
    return df.reset_index(drop=True)

clean = clean_employees(pd.read_csv("employees_messy.csv"))
print(clean.head())
print(clean.isna().sum())
```

## Check the result

Cleaning isn't done until you've checked it. `assert` statements turn your expectations into automatic tests: if one fails, you know straight away.

```python
import pandas as pd

def clean_employees(raw):
    df = raw.drop_duplicates().copy()
    for col in ["name", "department"]:
        df[col] = df[col].str.strip().str.title()
    df["department"] = df["department"].replace({"Hr": "HR"})
    salary_text = df["salary"].str.replace("$", "", regex=False).str.replace(",", "", regex=False)
    df["salary"] = pd.to_numeric(salary_text, errors="coerce")
    df["age"] = df["age"].mask((df["age"] < 16) | (df["age"] > 100)).astype("Int64")
    df["start_date"] = pd.to_datetime(df["start_date"], errors="coerce")
    df["email"] = df["email"].fillna("not provided")
    return df.reset_index(drop=True)

clean = clean_employees(pd.read_csv("employees_messy.csv"))
assert clean["emp_id"].is_unique, "employee ids repeat"
assert clean["department"].nunique() == 4
assert clean["age"].dropna().between(16, 100).all()
assert clean["salary"].dtype == "float64"
print("All checks passed:", clean.shape)
print(clean.groupby("department")["salary"].median())
```

Now the question "what's the median salary by department?" has a trustworthy answer.

## Saving the clean data

`to_csv` writes a DataFrame to a file. `index=False` leaves out the 0, 1, 2… index column:

```python
import pandas as pd

df = pd.read_csv("employees_messy.csv").drop_duplicates()
df.to_csv("employees_clean.csv", index=False)
print(open("employees_clean.csv").read()[:200])
```

## Common mistakes

- Cleaning in scattered cells or by hand in a spreadsheet, so nobody (including you) can repeat it.
- Changing the raw table in place, then being unable to compare before and after. Work on `raw.copy()`.
- Skipping the checks. A one-line `assert` catches a step that silently didn't work.

## Exercises

### 1. Write the cleaner

Write a function `clean_employees(raw)` that takes the raw DataFrame and returns a cleaned copy where:

1. exact duplicate rows are removed and the index is reset (`reset_index(drop=True)`);
2. `name` and `department` are stripped and in title case;
3. `salary` is a number (`$` and commas removed, `errors="coerce"`);
4. ages below 16 or above 100 are missing.

Then store `clean_employees(pd.read_csv("employees_messy.csv"))` in `clean`.

Starter code:

```python
import pandas as pd

def clean_employees(raw):
    df = raw.copy()
    # your steps here
    return df

clean = clean_employees(pd.read_csv("employees_messy.csv"))
print(clean.head())
```

### 2. Pay by department

Using your cleaned data (copy your `clean_employees` function in), store the **median salary for each department** in `median_pay` (a Series indexed by department), using `groupby("department")["salary"].median()`.

Starter code:

```python
import pandas as pd

# paste your clean_employees function here

```

**In the sandbox:** exercises 41–42. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Copy the steps from the lesson into the function, one per line, and finish with `return df.reset_index(drop=True)`.
2. The departments must be cleaned first, or "Sales" and "SALES" become separate groups.

</details>

<details>
<summary>Answers</summary>

**1. Write the cleaner**

```python
import pandas as pd

def clean_employees(raw):
    df = raw.drop_duplicates().copy()
    for col in ["name", "department"]:
        df[col] = df[col].str.strip().str.title()
    salary_text = df["salary"].str.replace("$", "", regex=False).str.replace(",", "", regex=False)
    df["salary"] = pd.to_numeric(salary_text, errors="coerce")
    df["age"] = df["age"].mask((df["age"] < 16) | (df["age"] > 100))
    return df.reset_index(drop=True)

clean = clean_employees(pd.read_csv("employees_messy.csv"))
print(clean.head())
```

**2. Pay by department**

```python
import pandas as pd

def clean_employees(raw):
    df = raw.drop_duplicates().copy()
    for col in ["name", "department"]:
        df[col] = df[col].str.strip().str.title()
    salary_text = df["salary"].str.replace("$", "", regex=False).str.replace(",", "", regex=False)
    df["salary"] = pd.to_numeric(salary_text, errors="coerce")
    df["age"] = df["age"].mask((df["age"] < 16) | (df["age"] > 100))
    return df.reset_index(drop=True)

clean = clean_employees(pd.read_csv("employees_messy.csv"))
median_pay = clean.groupby("department")["salary"].median()
print(median_pay)
```

</details>

## Quick quiz

1. Why wrap the cleaning steps in a function?
   - A) pandas requires it
   - B) Functions run faster
   - C) So the same cleaning can be re-run on new data, with no steps forgotten

2. Why were missing salaries left missing instead of filled?
   - A) Because there were too many of them
   - B) A guessed salary would distort the pay analysis
   - C) pandas can't fill numbers

3. What does `df.to_csv("out.csv", index=False)` leave out?
   - A) The header row
   - B) The row index (0, 1, 2…)
   - C) Missing values

<details>
<summary>Quiz answers</summary>

1. **C) So the same cleaning can be re-run on new data, with no steps forgotten**: A cleaning function is repeatable and testable: next month's file gets exactly the same treatment.
2. **B) A guessed salary would distort the pay analysis**: Filling with a typical value makes the data look more certain than it is. Leave it, count it and mention it.
3. **B) The row index (0, 1, 2…)**: Without `index=False`, the index is written as an extra unnamed first column.

</details>

---
Previous: [Lesson 20](20-dates-and-times.md) · Next: [Lesson 22: Grouping and aggregating](22-groupby.md)
