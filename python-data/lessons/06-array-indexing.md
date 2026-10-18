# Lesson 6: Indexing, slicing and filtering arrays

**You'll learn:** indexing and slicing, `arr[row, col]`, boolean masks, `&`, `|`, `~`, fancy indexing, views and copies.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python-data/#array-indexing)**: run every example and check your exercise answers.

## Key terms

- **Index:** the position of an item, starting at 0.
- **Slice:** a range of positions, like `a[2:5]`.
- **Boolean mask:** an array of `True`/`False` values used to pick items.
- **Fancy indexing:** selecting items with a list of positions, like `a[[0, 3]]`.
- **np.nan:** "not a number", NumPy's marker for a missing value.
- **View:** a slice that shares data with the original array, so changes show up in both.
- **copy():** makes an independent array that doesn't share data.

Getting the right numbers out of an array works like lists, with two big extras: you can index rows and columns together, and you can filter with a **mask**.

## Single items and slices

```python
import numpy as np

temps = np.array([3.1, 4.8, 7.2, 10.5, 14.0, 17.3, 19.6])
print(temps[0])      # first
print(temps[-1])     # last
print(temps[2:5])    # items 2, 3 and 4
print(temps[::2])    # every second item
```

## Rows and columns in 2-D

For a 2-D array, put the row and column inside one pair of brackets, separated by a comma: `arr[row, col]`. A `:` on its own means "all".

```python
import numpy as np

# rows are students, columns are math, science, english
scores = np.array([[72, 85, 90],
                   [64, 70, 58],
                   [88, 91, 79],
                   [55, 62, 71]])

print(scores[1, 2])     # row 1, column 2
print(scores[0])        # the whole first row
print(scores[:, 0])     # the whole first column (all math scores)
print(scores[1:3, :2])  # rows 1-2, first two columns
```

## Boolean masks: filtering

Comparing an array with a value gives an array of `True`/`False`, one per item. That's a **mask**:

![A comparison makes a True/False array; using it inside the brackets keeps only the values at the True positions](../figures/boolean-mask.svg)

```python
import numpy as np

temps = np.array([3.1, 4.8, 7.2, 10.5, 14.0, 17.3, 19.6])
warm = temps > 10
print(warm)
```

Put a mask inside the brackets and you get only the items where it's `True`:

```python
import numpy as np

temps = np.array([3.1, 4.8, 7.2, 10.5, 14.0, 17.3, 19.6])
print(temps[temps > 10])
print(temps[temps < 5])
print("Warm days:", (temps > 10).sum())
```

`(temps > 10).sum()` counts the warm days, because `True` counts as 1 and `False` as 0. You'll use this trick constantly.

## Combining conditions

Use `&` (and), `|` (or) and `~` (not). Each condition **must** be in brackets:

```python
import numpy as np

temps = np.array([3.1, 4.8, 7.2, 10.5, 14.0, 17.3, 19.6])
mild = temps[(temps > 5) & (temps < 15)]
extreme = temps[(temps < 4) | (temps > 18)]
print(mild)
print(extreme)
```

Python's `and`/`or` don't work on arrays and give an error:

*This example raises an error on purpose.*

```python
import numpy as np

temps = np.array([3.1, 4.8, 7.2, 10.5])
print(temps[temps > 5 and temps < 15])
```

## Picking by a list of positions

You can also pass a list of positions, called **fancy indexing**:

```python
import numpy as np

products = np.array(["Laptop", "Monitor", "Headphones", "Notebook", "Pen Pack"])
print(products[[0, 3]])
```

## Changing values

Assigning to an index, slice or mask changes the array in place. A common use is fixing bad readings:

```python
import numpy as np

readings = np.array([12.0, -999.0, 14.5, 13.2, -999.0, 15.1])
readings[readings == -999.0] = np.nan    # mark missing values
print(readings)
```

`np.nan` means "not a number", NumPy's marker for a missing value. You'll see much more of it in pandas.

## Slices are views

A slice of an array is a **view**: a window onto the same numbers, not a copy. Changing the view changes the original. Use `.copy()` when you want an independent array:

```python
import numpy as np

a = np.array([1, 2, 3, 4, 5])
part = a[1:4]
part[0] = 99
print(a)          # the original changed!

b = np.array([1, 2, 3, 4, 5])
safe = b[1:4].copy()
safe[0] = 99
print(b)          # unchanged
```

## Common mistakes

- Using `and`/`or` with arrays. Use `&`/`|` and wrap each condition in brackets: `(a > 5) & (a < 15)`.
- Writing `scores[1][2]` everywhere. It works, but `scores[1, 2]` is the NumPy way and is needed for column slices like `scores[:, 2]`.
- Changing a slice and being surprised the original changed. Call `.copy()` when you need independence.

## Exercises

### 1. Warm days

Using the `temps` array of 14 daily temperatures, make `warm` holding only the temperatures **above 15**, and `n_warm` holding how many there are.

Starter code:

```python
import numpy as np

temps = np.array([12.5, 16.1, 14.8, 18.0, 21.3, 15.0, 13.9,
                  17.6, 19.2, 11.4, 15.5, 22.0, 14.1, 16.8])

```

### 2. Science column

`scores` has one row per student and the columns math, science, english. Store the **science** column (all rows) in `science`, and the scores of the **third student** (row 2) in `third`.

Starter code:

```python
import numpy as np

scores = np.array([[72, 85, 90],
                   [64, 70, 58],
                   [88, 91, 79],
                   [55, 62, 71]])

```

**In the sandbox:** exercises 11–12. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. `temps[temps > 15]` filters; `(temps > 15).sum()` counts the `True` values.
2. Columns are the second index: `scores[:, 1]` means all rows, column 1.

</details>

<details>
<summary>Answers</summary>

**1. Warm days**

```python
import numpy as np

temps = np.array([12.5, 16.1, 14.8, 18.0, 21.3, 15.0, 13.9,
                  17.6, 19.2, 11.4, 15.5, 22.0, 14.1, 16.8])
warm = temps[temps > 15]
n_warm = (temps > 15).sum()
print(warm, n_warm)
```

**2. Science column**

```python
import numpy as np

scores = np.array([[72, 85, 90],
                   [64, 70, 58],
                   [88, 91, 79],
                   [55, 62, 71]])
science = scores[:, 1]
third = scores[2]
print(science, third)
```

</details>

## Quick quiz

1. What does `arr[:, 0]` select from a 2-D array?
   - A) The first item only
   - B) The first row
   - C) The first column, from every row

2. Which line correctly keeps values between 5 and 15?
   - A) `a[a > 5 and a < 15]`
   - B) `a[a > 5 & a < 15]`
   - C) `a[(a > 5) & (a < 15)]`

3. `part = a[1:4]` then `part[0] = 99`. What happens to `a`?
   - A) `a` changes too, because a slice is a view
   - B) An error is raised
   - C) Nothing, a slice is a copy

<details>
<summary>Quiz answers</summary>

1. **C) The first column, from every row**: `:` means "every row", and `0` picks column 0.
2. **C) `a[(a > 5) & (a < 15)]`**: Use `&` with each condition in brackets. `and` doesn't work on arrays, and without brackets `&` runs first.
3. **A) `a` changes too, because a slice is a view**: Slices share the original's numbers. Use `.copy()` when you want to change one without the other.

</details>

---
Previous: [Lesson 5](05-numpy-arrays.md) · Next: [Lesson 7: Maths on whole arrays](07-vectorised-math.md)
