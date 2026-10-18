# Lesson 24: Combining tables with merge

**You'll learn:** `merge`, `on`, `how` (inner, left, right, outer), `indicator`, `left_on`/`right_on`, `suffixes`, `validate`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python-data/#merging-tables)**: run every example and check your exercise answers.

## Key terms

- **Join (merge):** combining two tables by matching rows on a key.
- **Key:** the column used to match rows, like `customer_id`.
- **Inner join:** keeps only rows that match in both tables.
- **Left join:** keeps every row of the left table, with gaps where there's no match.
- **Outer join:** keeps every row from both tables.
- **indicator:** adds a `_merge` column showing whether each row matched.
- **One-to-many:** one row on one side matches many on the other, like one customer to many orders.

Real data is spread over several tables. Orders don't repeat the customer's city; they store a `customer_id` that points to the customers table. To ask "revenue per city", you need to **join** the tables on that key. If you've done the SQL course, this is `JOIN`.

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
customers = pd.read_csv("customers.csv")
print(sales[["order_id", "customer_id", "product"]].head(3))
print(customers[["customer_id", "name", "city"]].head(3))
```

## merge

`merge` matches rows where the key columns are equal:

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
customers = pd.read_csv("customers.csv")
joined = sales.merge(customers, on="customer_id")
print(joined.shape)
print(joined[["order_id", "customer_id", "name", "city", "product"]].head())
```

Every order now carries its customer's details. Now "revenue per city" is a groupby:

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
customers = pd.read_csv("customers.csv")
joined = sales.merge(customers, on="customer_id")
joined["revenue"] = joined["units"] * joined["unit_price"]
print(joined.groupby("city")["revenue"].sum().sort_values(ascending=False).round(0))
```

## Types of join

When some keys don't match, the `how` argument decides what happens:

![Inner, left, right and outer joins as overlapping circles: the shaded part shows which rows each join keeps](../figures/merge-joins.svg)

| `how=` | Keeps | SQL |
|---|---|---|
| `"inner"` (default) | only rows with a match in both tables | `INNER JOIN` |
| `"left"` | every row of the left table; gaps where no match | `LEFT JOIN` |
| `"right"` | every row of the right table | `RIGHT JOIN` |
| `"outer"` | every row of both | `FULL OUTER JOIN` |

A small example makes the difference clear:

```python
import pandas as pd

orders = pd.DataFrame({"order": [1, 2, 3, 4], "cust": ["A", "B", "B", "Z"]})
people = pd.DataFrame({"cust": ["A", "B", "C"], "name": ["Ada", "Ben", "Cy"]})

print(orders.merge(people, on="cust", how="inner"))
print(orders.merge(people, on="cust", how="left"))
print(orders.merge(people, on="cust", how="outer"))
```

Order 4 (customer Z, not in `people`) disappears in the inner join and has a missing name in the left join. Customer C (no orders) only appears in the outer join.

## Finding what didn't match

`indicator=True` adds a `_merge` column saying where each row came from. It's the best way to check a join:

```python
import pandas as pd

orders = pd.DataFrame({"order": [1, 2, 3, 4], "cust": ["A", "B", "B", "Z"]})
people = pd.DataFrame({"cust": ["A", "B", "C"], "name": ["Ada", "Ben", "Cy"]})
check = orders.merge(people, on="cust", how="outer", indicator=True)
print(check)
print(check["_merge"].value_counts())
```

`left_only` rows are orders with an unknown customer, a data-quality problem worth reporting.

## Key names that differ

If the key has different names in the two tables, use `left_on` and `right_on`. When both tables have other columns with the same name, pandas adds `_x` and `_y`; `suffixes` makes them clearer:

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
products = pd.read_csv("products.csv").rename(columns={"product": "item"})
both = sales.merge(products, left_on="product", right_on="item", suffixes=("_sold", "_list"))
print(both[["product", "unit_price_sold", "unit_price_list", "unit_cost"]].head(3))
```

## Joining three tables

Chain merges to bring everything together. Here profit needs the cost from `products` and the segment from `customers`:

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
customers = pd.read_csv("customers.csv")
products = pd.read_csv("products.csv")[["product", "unit_cost"]]

full = (sales
        .merge(customers[["customer_id", "segment"]], on="customer_id", how="left")
        .merge(products, on="product", how="left"))
full["profit"] = full["units"] * (full["unit_price"] - full["unit_cost"])
print(full.groupby("segment")["profit"].sum().round(0))
```

Selecting only the columns you need before merging keeps the result small and readable.

## Watch the row count

If a key repeats in **both** tables, every match is paired up and rows multiply. Compare the length before and after, or let pandas check with `validate`:

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
customers = pd.read_csv("customers.csv")
joined = sales.merge(customers, on="customer_id", how="left", validate="many_to_one")
print(len(sales), len(joined))
```

`validate="many_to_one"` means "many orders per customer, but each customer only once", and raises an error if that's not true.

## Common mistakes

- Using an inner join and silently losing rows that didn't match. Check the row count, or use `how="left"` with `indicator=True`.
- Joining on keys with different types (`"101"` vs `101`) or spellings. They won't match; clean and convert first.
- Merging whole wide tables and getting `_x`/`_y` columns everywhere. Select the columns you need first.

## Exercises

### 1. Orders with names

Merge `sales.csv` with `customers.csv` on `customer_id` (a **left** join, so no order is lost) and store the result in `orders`. Then store the number of distinct **cities** that have placed orders in `n_cities`.

Starter code:

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
customers = pd.read_csv("customers.csv")

```

### 2. Profit by product

Merge `sales.csv` with the `product` and `unit_cost` columns of `products.csv`, add `profit` = units × (unit_price − unit_cost), and store the **total profit per product**, largest first, in `profit_by_product`.

Starter code:

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
products = pd.read_csv("products.csv")

```

**In the sandbox:** exercises 47–48. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. `sales.merge(customers, on="customer_id", how="left")`.
2. Merge on `"product"`, calculate `profit`, then groupby product and sum.

</details>

<details>
<summary>Answers</summary>

**1. Orders with names**

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
customers = pd.read_csv("customers.csv")
orders = sales.merge(customers, on="customer_id", how="left")
n_cities = orders["city"].nunique()
print(n_cities)
```

**2. Profit by product**

```python
import pandas as pd

sales = pd.read_csv("sales.csv")
products = pd.read_csv("products.csv")
full = sales.merge(products[["product", "unit_cost"]], on="product")
full["profit"] = full["units"] * (full["unit_price"] - full["unit_cost"])
profit_by_product = full.groupby("product")["profit"].sum().sort_values(ascending=False)
print(profit_by_product)
```

</details>

## Quick quiz

1. An order's customer_id isn't in the customers table. What happens in an inner join?
   - A) The order is dropped
   - B) An error is raised
   - C) It's kept with missing customer details

2. What does `indicator=True` add?
   - A) A `_merge` column showing whether each row matched
   - B) A row count
   - C) An index

3. After a merge you have far more rows than before. What's the likely cause?
   - A) The merge was a left join
   - B) The key repeats in both tables, so matches multiply
   - C) Missing values

<details>
<summary>Quiz answers</summary>

1. **A) The order is dropped**: An inner join only keeps rows that match in both tables. Use `how="left"` to keep every order.
2. **A) A `_merge` column showing whether each row matched**: `_merge` is `both`, `left_only` or `right_only`, which makes unmatched rows easy to find.
3. **B) The key repeats in both tables, so matches multiply**: Each left row pairs with every matching right row. Check keys are unique where they should be, or use `validate=`.

</details>

---
Previous: [Lesson 23](23-pivot-tables.md) · Next: [Lesson 25: Stacking and reshaping tables](25-reshaping-data.md)
