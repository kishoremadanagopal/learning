# Lesson 4: Indexing, slicing and views

**You'll learn:** integer and slice indexing per dimension, negative indexes, ... and None, how indexing changes the shape, boolean masks, combining conditions with & | ~, index lists and tensors, writing through indexes, torch.where, views versus copies, clone, item, tolist, numpy() sharing memory, the ambiguous truth value error.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/pytorch/#indexing-and-views)**: run every example and check your exercise answers.

## Key terms

- **Indexing:** selecting elements with one index or slice per dimension, like `x[1, :3]`.
- **Boolean mask:** a bool tensor, usually from a comparison, that selects the elements where it's True.
- **Advanced indexing:** indexing with a list or tensor of positions, or a mask; it returns a copy.
- **View:** a tensor that shares memory with another tensor but may have a different shape or strides.
- **clone:** returns a copy of a tensor with its own memory.
- **torch.where:** chooses, element by element, from one tensor where a condition is True and another where it's False.
- **tolist:** converts a tensor to (nested) Python lists.
- **numpy():** returns a NumPy array that shares memory with a CPU tensor.

Indexing works like NumPy: one index (or slice) per dimension, separated by commas.

```python
import torch

x = torch.arange(12).reshape(3, 4)
print(x)
print(x[0])          # first row
print(x[1, 2])       # row 1, column 2: a 0-D tensor
print(x[:, 1])       # every row, column 1
print(x[1:, ::2])    # rows 1 onwards, every second column
print(x[-1])         # the last row
print(x[..., 0])     # ... means "all the dimensions before": column 0
```

An integer index **removes** that dimension; a slice **keeps** it. So `x[:, 1]` has shape `[3]`, but `x[:, 1:2]` has shape `[3, 1]`. Use `None` to add a dimension of size 1: `x[:, None].shape` is `[3, 1, 4]`.

## Boolean masks and index tensors

A comparison gives a bool tensor of the same shape: a **mask**. Indexing with a mask picks the elements where it's True, as a 1-D tensor. A list or int64 tensor of indexes picks those positions, in that order.

```python
import torch

x = torch.tensor([5, -2, 8, 0, -7])
mask = x > 0
print(mask)
print(x[mask])                     # only the positive values
print(x[x < 0])                    # in one step
print(x[[0, 4, 4]])                # pick positions (repeats allowed)
print(x[torch.tensor([1, 2])])

x[x < 0] = 0                       # write through a mask: clip negatives
print(x)
print(torch.where(x > 0, x, -1))   # choose element by element
```

Combine conditions with `&` (and), `|` (or) and `~` (not), with brackets: `x[(x > 0) & (x < 6)]`. Python's `and`/`or` don't work on tensors.

## Views share memory

Basic indexing (integers and slices) returns a **view**: a new tensor object that looks at the same memory. Changing a view changes the original, and the other way round. Indexing with a mask or an index tensor makes a **copy**.

```python
import torch

x = torch.zeros(2, 3)
row = x[0]                    # a view of row 0
row[1] = 5.0
print(x)                      # x changed too

picked = x[torch.tensor([0])] # index tensor: a copy
picked[0, 0] = 9.0
print(x)                      # unchanged

safe = x[0].clone()           # .clone() makes an independent copy
safe[0] = -1.0
print(x[0], safe)
```

![One block of memory 0 to 5. a = torch.arange(6).view(2, 3) and t = a.t() both point to it with different strides; c = a.clone() has its own memory. Views share memory, so a[0, 0] = 9 changes t[0, 0] too](../figures/view-storage.svg)

Views make slicing free (no copying), which is why PyTorch uses them. Use `.clone()` when you need a copy you can change safely. `.detach()` (Part 2) is different: it returns a view outside autograd's records, still sharing memory.

## Back to Python and NumPy

| You want | Use | Notes |
|---|---|---|
| one Python number | `t.item()` | only for a one-element tensor |
| nested Python lists | `t.tolist()` | copies |
| a NumPy array | `t.numpy()` | **shares memory** (CPU only; not for tensors that require grad) |

```python
import torch

t = torch.tensor([[1.5, 2.5], [3.5, 4.5]])
print(t[1, 0].item(), type(t[1, 0].item()))
print(t.tolist())
arr = t.numpy()
arr[0, 0] = 100
print(t)                  # shared memory: t changed
```

*This example raises an error on purpose.*

```python
import torch

t = torch.tensor([1.5, 2.5])
print(t.item())           # two elements: which one?
```

The same goes for `if`: `if t > 0:` works for a one-element tensor, but for several elements Python can't know whether you mean "any" or "all", so it raises `Boolean value of Tensor with more than one value is ambiguous`. Write `if (t > 0).all():` or `.any()`.

## At a glance

| Concept | Code | Gives you | Remember |
|---|---|---|---|
| Select | `x[1]`, `x[:, 2]`, `x[1:, ::2]`, `x[..., 0]` | elements, rows, columns, blocks | an int index drops a dim, a slice keeps it |
| Add a dim | `x[:, None]` | a size-1 dimension | same as `unsqueeze` |
| Filter | `x[x > 0]`, `x[(x > 0) & (x < 5)]` | a 1-D copy of the matches | use `&`, `\|`, `~` with brackets |
| Pick positions | `x[[0, 2]]`, `x[idx_tensor]` | a copy of those rows | index tensors must be int64 (or int32, bool) |
| Write | `x[mask] = 0` | changes x in place | works on views too |
| Choose per element | `torch.where(cond, a, b)` | a new tensor | broadcasts its inputs |
| Copy | `x.clone()` | independent memory | slicing returns views |
| Leave PyTorch | `.item()`, `.tolist()`, `.numpy()` | a number, lists, an array | numpy() shares memory, CPU only |

## Common mistakes

- Forgetting that an integer index removes a dimension while a slice keeps it.
- Using Python's `and` / `or` on tensors instead of `&` / `|` with brackets.
- Changing a slice and being surprised that the original changed (slices are views).
- Assigning `b = a` and expecting a copy; use `a.clone()`.
- Calling `.item()` on a tensor with more than one element.
- Using a multi-element tensor in an `if`; reduce with `.any()` or `.all()`.

## Exercises

### 1. Clean the readings

`readings` holds sensor values where `-1` means "missing". Without loops, make: `valid`, a 1-D tensor of only the non-missing values; `n_missing`, the number of missing readings as a Python int; and `filled`, a **copy** of `readings` where missing values are replaced by the mean of the valid ones (`readings` itself must stay unchanged).

Starter code:

```python
import torch

readings = torch.tensor([[2.0, -1.0, 4.0], [6.0, 8.0, -1.0]])
valid = None
n_missing = None
filled = None
print(valid, n_missing, filled, readings, sep="\n")
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** mask the missing values, use the rest, and fill a copy.
2. **Examples:** valid values 2, 4, 6, 8 have mean 5, so both −1s become 5.
3. **Brute force:** loops over rows and columns; masks do it in one step each.
4. **Pattern:** **boolean masks** for reading and writing, **clone** to protect the original.
5. **Plan:** build the mask, index with `~mask`, count with `.sum()`, clone, assign.
6. **Code and test:** print `readings` at the end to confirm it's unchanged.

</details>

<details>
<summary>💡 Hint 1</summary>

`missing = readings == -1` is a bool mask; `~missing` flips it.

</details>

<details>
<summary>💡 Hint 2</summary>

Summing a bool tensor counts the Trues; `.item()` makes it a Python int.

</details>

<details>
<summary>💡 Hint 3</summary>

`filled = readings.clone()` first, then assign through the mask: `filled[missing] = valid.mean()`.

</details>

### 2. Pick the top row per column

`scores` has one row per model and one column per test. Write `best_scores(scores)` returning a 1-D tensor with, for each column, the score in the row whose **first column** is largest. (So: find the row with the best first test, and return that whole row.) Then write `first_and_last(scores)` returning a tensor of shape `[2, n_columns]` holding the first and last rows, using one index list.

Starter code:

```python
import torch

def best_scores(scores):
    pass

def first_and_last(scores):
    pass

s = torch.tensor([[0.7, 0.2, 0.9], [0.8, 0.1, 0.4], [0.5, 0.6, 0.3]])
print(best_scores(s))       # tensor([0.8000, 0.1000, 0.4000])
print(first_and_last(s))
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** one function selects a row by a rule, the other selects two fixed rows.
2. **Examples:** first column 0.7, 0.8, 0.5 → row 1 is best.
3. **Brute force:** loop over rows comparing first values.
4. **Pattern:** **argmax then index**, and **index lists** for several positions.
5. **Plan:** column slice → argmax → row; list index `[0, -1]`.
6. **Code and test:** a single-row tensor returns that row twice.

</details>

<details>
<summary>💡 Hint 1</summary>

`scores[:, 0]` is the first column; `.argmax()` gives the index of its largest value.

</details>

<details>
<summary>💡 Hint 2</summary>

A 0-D integer tensor works as an index: `scores[best_row]`.

</details>

<details>
<summary>💡 Hint 3</summary>

A list of indexes picks several rows at once: `scores[[0, -1]]`.

</details>

**In the sandbox:** exercises 7–8. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Clean the readings</summary>

```python
import torch

readings = torch.tensor([[2.0, -1.0, 4.0], [6.0, 8.0, -1.0]])
missing = readings == -1
valid = readings[~missing]
n_missing = missing.sum().item()
filled = readings.clone()
filled[missing] = valid.mean()
print(valid, n_missing, filled, readings, sep="\n")
```

**Line by line**

- `readings == -1` compares every element, giving a bool tensor of shape `[2, 3]`.
- `readings[~missing]` keeps the True positions of the flipped mask, flattened into a 1-D tensor: `tensor([2., 4., 6., 8.])`.
- `missing.sum()` adds True as 1: `tensor(2)` (int64). `.item()` gives `2`.
- `readings.clone()` copies the memory. Without it, `filled = readings` would just be a second name for the same tensor, and the assignment would change `readings` too.
- `filled[missing] = valid.mean()` writes the 0-D mean, 5.0, into every masked position.

**Common wrong approach:** `filled = readings` followed by the masked assignment: the original data is overwritten.

</details>

<details>
<summary>✅ 2. Pick the top row per column</summary>

```python
import torch

def best_scores(scores):
    best_row = scores[:, 0].argmax()
    return scores[best_row]

def first_and_last(scores):
    return scores[[0, -1]]

s = torch.tensor([[0.7, 0.2, 0.9], [0.8, 0.1, 0.4], [0.5, 0.6, 0.3]])
print(best_scores(s))
print(first_and_last(s))
```

**Line by line**

- `scores[:, 0]`: all rows, column 0, shape `[n_rows]`.
- `.argmax()` returns the position of the maximum as a 0-D int64 tensor (the first one if there's a tie).
- `scores[best_row]` uses it as an integer index: one row, shape `[n_columns]`.
- `scores[[0, -1]]` is "advanced" indexing with a list: it copies rows 0 and −1 into a new `[2, n_columns]` tensor (with one row, both are row 0).

**Common wrong approach:** `scores.argmax()` with no dim: it returns the position in the *flattened* tensor (here 2, the 0.9), not a row number.

</details>

## Quick quiz

1. `x = torch.arange(24).reshape(2, 3, 4)`. What is `x[1, :, 2].shape`?
   - A) `torch.Size([3])`
   - B) `torch.Size([1, 3, 1])`
   - C) `torch.Size([2, 3])`
   - D) `torch.Size([3, 1])`

2. `a = torch.zeros(3); b = a[1:]; b += 1`. What is `a`?
   - A) `tensor([0., 1., 1.])`
   - B) `tensor([0., 0., 0.])`
   - C) `tensor([1., 1., 1.])`
   - D) It raises an error

3. Which operation returns a tensor that does NOT share memory with `x`?
   - A) `x[x > 0]`
   - B) `x[1:3]`
   - C) `x.view(-1)`
   - D) `x.t()`

4. `t = torch.tensor([3.0, 4.0])`. Which line raises an error?
   - A) `if t > 2: print("big")`
   - B) `if (t > 2).all(): print("big")`
   - C) `print(t.tolist())`
   - D) `print(t.sum().item())`

5. How do you get the value of the 0-D tensor `loss` as a Python float?
   - A) `loss.item()`
   - B) `loss.numpy()`
   - C) `float(loss.tolist()[0])`
   - D) `loss.data`

<details>
<summary>Quiz answers</summary>

1. **A) `torch.Size([3])`**: Each integer index removes its dimension; the slice keeps the middle one of size 3.
2. **A) `tensor([0., 1., 1.])`**: Slicing returns a view, so the in-place add writes into a's memory.
3. **A) `x[x > 0]`**: Boolean-mask (and index-tensor) indexing copies the selected elements; slicing, view and t() return views.
4. **A) `if t > 2: print("big")`**: A two-element bool tensor has no single truth value; reduce it with .all() or .any() first.
5. **A) `loss.item()`**: .item() converts a one-element tensor to a Python number. (float(loss) works too.)

</details>

---
Previous: [Lesson 3](03-dtypes.md) · Next: [Lesson 5: Reshaping, joining and splitting](05-reshaping.md)
