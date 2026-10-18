# Lesson 12: Selecting columns and rows

**You'll learn:** `df["col"]`, `df[["a", "b"]]`, `loc`, `iloc`, `set_index`, `reset_index`, changing cells.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python-data/#selecting-data)**: run every example and check your exercise answers.

## Key terms

- **Selection:** picking particular rows, columns or cells from a table.
- **loc:** selects rows and columns by label; slices include the end.
- **iloc:** selects rows and columns by position (integers); slices exclude the end.
- **set_index:** makes a column the row labels.
- **reset_index:** turns the index back into a normal column.
- **KeyError:** the error raised when a column or label doesn't exist.
- **Copy-on-write:** pandas 3's rule that a selection behaves like a copy, so changing it never changes the original table.

Analysis starts with getting the slice of data you need. pandas has three main tools: square brackets for columns, `.loc` for labels and `.iloc` for positions.

## Columns

One column name in brackets gives a **Series**. A **list** of names (note the double brackets) gives a smaller **DataFrame**:

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
print(sales["product"].head(3))
print(sales[["order_date", "product", "units"]].head(3))
```

*This example raises an error on purpose.*

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
print(sales["Product"])      # capital P: no such column
```

Column names are case-sensitive. When you get a `KeyError`, print `df.columns` and compare.

You may also see `sales.product` (dot style). It works for simple names, but brackets always work, so prefer them.

## loc: rows by label

`df.loc[row, column]` selects by **label**. With the default index the labels are 0, 1, 2…, so it looks like positions, but it's the labels that count:

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
print(sales.loc[0])                       # one row, as a Series
print(sales.loc[0, "product"])            # one cell
print(sales.loc[0:3, ["product", "units"]])
```

Unlike Python slices, a **`loc` slice includes the end label**: `0:3` gives rows 0, 1, 2 and 3.

## Setting a meaningful index

Rows are easier to find when the index is a real identifier. `set_index` makes a column the index:

```python
import pandas as pd

products = pd.read_csv("products.csv").set_index("product")
print(products)
print(products.loc["Monitor", "unit_price"])
print(products.loc[["Laptop", "Notebook"], ["unit_price", "unit_cost"]])
```

`reset_index()` turns the index back into an ordinary column.

## iloc: rows by position

`df.iloc[row, column]` uses **positions** (whole numbers from 0), and its slices exclude the end, like Python lists:

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
print(sales.iloc[0, 4])        # row 0, column 4
print(sales.iloc[-1])          # the last row
print(sales.iloc[:3, :4])      # first 3 rows, first 4 columns
```

| You want | Use |
|---|---|
| one or more columns by name | `df["col"]` or `df[["a", "b"]]` |
| rows and columns by label | `df.loc[rows, cols]` |
| rows and columns by position | `df.iloc[rows, cols]` |

## Changing a value

Use `loc` to change a cell. This is the safe way: it finds the row and column in one step.

```python
import pandas as pd

products = pd.read_csv("products.csv").set_index("product")
products.loc["Notebook", "unit_price"] = 4.99
print(products.loc["Notebook"])
```

Don't chain two sets of brackets to change data, like `products["unit_price"]["Notebook"] = 4.99`. In pandas 3 that never changes the table, because the first brackets give you a copy.

## Common mistakes

- Using single brackets for several columns: `df["a", "b"]` is a `KeyError`. Use a list: `df[["a", "b"]]`.
- Changing data with chained brackets like `df["price"][3] = 9`. In pandas 3 it does nothing; use `df.loc[3, "price"] = 9`.
- Mixing up `loc` and `iloc`. With a custom index, `loc[0]` looks for the label 0, which may not exist.

## Exercises

### 1. Pick the columns

Load `customers.csv` and make `contact` a DataFrame with just the `name` and `city` columns (in that order).

Starter code:

```python
import pandas as pd

customers = pd.read_csv("customers.csv")

```

### 2. Look up a product

Load `products.csv` with `product` as the index. Store the `supplier` of `"Desk Chair"` in `supplier` and the `unit_cost` of `"Laptop"` in `laptop_cost`, using `.loc`.

Starter code:

```python
import pandas as pd

```

**In the sandbox:** exercises 23–24. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. A list of column names inside the brackets: `customers[["name", "city"]]`.
2. `pd.read_csv("products.csv").set_index("product")`, then `products.loc["Desk Chair", "supplier"]`.

</details>

<details>
<summary>Answers</summary>

**1. Pick the columns**

```python
import pandas as pd

customers = pd.read_csv("customers.csv")
contact = customers[["name", "city"]]
print(contact.head())
```

**2. Look up a product**

```python
import pandas as pd

products = pd.read_csv("products.csv").set_index("product")
supplier = products.loc["Desk Chair", "supplier"]
laptop_cost = products.loc["Laptop", "unit_cost"]
print(supplier, laptop_cost)
```

</details>

## Quick quiz

1. What does `df[["a", "b"]]` return?
   - A) A Series
   - B) A DataFrame with columns a and b
   - C) An error

2. With the default index, how many rows does `df.loc[0:3]` return?
   - A) 3
   - B) 4
   - C) 2

3. Which selects by position, whatever the labels are?
   - A) `iloc`
   - B) `loc`
   - C) `set_index`

<details>
<summary>Quiz answers</summary>

1. **B) A DataFrame with columns a and b**: A list of names (double brackets) gives a DataFrame. A single name gives a Series.
2. **B) 4**: `loc` slices include the end label, so it returns rows 0, 1, 2 and 3. `iloc[0:3]` would return 3.
3. **A) `iloc`**: The "i" in `iloc` stands for integer position.

</details>

---
Previous: [Lesson 11](11-dataframes.md) · Next: [Lesson 13: Filtering rows](13-filtering-rows.md)
