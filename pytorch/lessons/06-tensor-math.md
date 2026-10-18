# Lesson 6: Tensor maths and broadcasting

**You'll learn:** element-wise arithmetic and functions, clamp, relu and sigmoid, broadcasting rules, broadcasting with keepdim, matrix multiplication with @, matmul, mm, mv, bmm and batched matmul, matching dtypes, reductions with dim and keepdim, max with indices, argmax for predictions, mean on integers, std's correction, softmax along a dim, in-place operations.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/pytorch/#tensor-math)**: run every example and check your exercise answers.

## Key terms

- **Element-wise operation:** an operation applied to each element (or each pair of matching elements) separately.
- **Broadcasting:** stretching size-1 or missing dimensions so tensors of different shapes can be combined, without copying.
- **Matrix multiplication (@):** for `[n, k] @ [k, m]`, each output element is the dot product of a row and a column, giving `[n, m]`.
- **bmm:** batched matrix multiplication of two 3-D tensors, one product per batch item.
- **Reduction:** an operation that combines elements into fewer, like `sum`, `mean` or `max`.
- **dim argument:** the dimension a reduction combines over; it disappears from the result.
- **keepdim:** keeps the reduced dimension with size 1, so the result broadcasts against the input.
- **argmax:** the index of the largest value, overall or along a dim.
- **Softmax:** turns a vector of scores into positive probabilities that sum to 1.
- **In-place operation:** an operation that overwrites a tensor's own memory, marked by a trailing underscore (`add_`).

### Element-wise operations

`+ - * / ** //` and functions like `torch.exp`, `torch.sqrt`, `torch.abs`, `torch.clamp` apply to each element. Most exist both as a function (`torch.exp(x)`) and a method (`x.exp()`).

```python
import torch

a = torch.tensor([1.0, 2.0, 3.0])
b = torch.tensor([10.0, 20.0, 30.0])
print(a + b, a * b, b / a)
print(a ** 2, torch.sqrt(a))
print(torch.clamp(a, min=1.5, max=2.5))      # limit to a range
print(torch.relu(torch.tensor([-1.0, 0.5])), torch.sigmoid(torch.tensor(0.0)))
```

Note that `a * b` is **element-wise**, not the matrix product.

## Broadcasting

When shapes differ, PyTorch **broadcasts**: it stretches size-1 dimensions (without copying memory) so the shapes match. Compare the shapes **from the right**: each pair of sizes must be **equal**, or one of them **1**; a missing dimension counts as 1.

![a of shape [3, 1] with values 0, 10, 20, plus b of shape [4] with values 0 to 3, gives a result of shape [3, 4] with values 0 to 23. A table lines up the shapes from the right: dim -1 is 1 and 4, giving 4; dim -2 is 3 and missing, giving 3](../figures/broadcasting.svg)

| Shapes | Result | Why |
|---|---|---|
| `[3, 4]` and `[4]` | `[3, 4]` | the `[4]` row is reused for every row |
| `[3, 1]` and `[1, 4]` | `[3, 4]` | each size-1 dim stretches |
| `[32, 3, 28, 28]` and `[3, 1, 1]` | `[32, 3, 28, 28]` | one value per channel |
| `[3, 4]` and `[3]` | error | from the right: 4 vs 3 |

```python
import torch

x = torch.tensor([[1.0, 2.0, 3.0],
                  [4.0, 5.0, 6.0]])
col_means = x.mean(dim=0)              # shape [3]
print(x - col_means)                   # [2, 3] - [3]: centre each column
row_max = x.max(dim=1, keepdim=True).values   # shape [2, 1]
print(x / row_max)                     # [2, 3] / [2, 1]: scale each row
print((torch.arange(3).view(3, 1) * 10 + torch.arange(4)).shape)
```

*This example raises an error on purpose.*

```python
import torch

x = torch.ones(2, 3)
row_sums = x.sum(dim=1)                # shape [2]: lost its dim
print(x / row_sums)                    # [2, 3] / [2]: 3 vs 2 from the right
```

That last error is the classic one: reducing removes a dimension, and broadcasting then lines the result up against the wrong axis. `keepdim=True` keeps the reduced dimension as size 1, so the result broadcasts back correctly.

## Matrix multiplication

`a @ b` (or `torch.matmul(a, b)`) is the matrix product: for shapes `[n, k] @ [k, m]` the result is `[n, m]`; the inner sizes must match. It's what every linear layer does.

| Inputs | Result | Also called |
|---|---|---|
| `[k] @ [k]` | a 0-D scalar (dot product) | `torch.dot` |
| `[n, k] @ [k]` | `[n]` | `torch.mv` |
| `[n, k] @ [k, m]` | `[n, m]` | `torch.mm` (2-D only) |
| `[b, n, k] @ [b, k, m]` | `[b, n, m]` (one product per batch item) | `torch.bmm` (3-D only) |
| `[b, n, k] @ [k, m]` | `[b, n, m]` (the batch dims broadcast) | |

```python
import torch

x = torch.tensor([[1.0, 2.0],
                  [3.0, 4.0],
                  [5.0, 6.0]])        # 3 samples, 2 features
w = torch.tensor([[1.0, 0.0, -1.0],
                  [0.5, 0.5, 0.5]])  # 2 inputs -> 3 outputs
print(x @ w)                         # [3, 2] @ [2, 3] = [3, 3]
print((x @ w).shape, (w @ x).shape)
print(torch.tensor([1.0, 2.0]) @ torch.tensor([3.0, 4.0]))
print((torch.ones(8, 3, 2) @ torch.ones(2, 5)).shape)
```

*This example raises an error on purpose.*

```python
import torch

x = torch.ones(3, 2)
print(x @ x)                         # inner sizes 2 and 3 don't match
```

matmul needs **matching dtypes**: an int64 tensor @ a float32 tensor is an error, not a promotion.

## Reductions along a dimension

`sum`, `mean`, `max`, `min`, `prod`, `std`, `argmax` and friends reduce all elements, or one dimension with `dim=`. The `dim` you pass is the one that **disappears**.

![x of shape [2, 3] holding 1 to 6. x.sum(dim=0) adds down the columns giving 5, 7, 9 with shape [3]; x.sum(dim=1) adds along each row giving 6 and 15 with shape [2]; keepdim=True gives shape [2, 1]](../figures/reduce-dims.svg)

```python
import torch

x = torch.tensor([[1.0, 5.0, 3.0],
                  [4.0, 2.0, 6.0]])
print(x.sum(), x.sum(dim=0), x.sum(dim=1))
print(x.mean(dim=1, keepdim=True))
values, indices = x.max(dim=1)       # max with a dim returns both
print(values, indices)
print(x.argmax(dim=1))               # just the positions: predicted classes
print(x.argmax())                    # no dim: position in the flattened tensor
print(torch.softmax(x, dim=1).sum(dim=1))   # each row sums to 1
```

`argmax(dim=1)` on a batch of class scores is how you turn model outputs into predicted labels. `mean()` needs a floating-point tensor: on int64 it raises an error, so convert with `.float()` first. `std()` uses the sample formula (dividing by n − 1) by default; pass `correction=0` for the population formula.

## In-place operations

Methods ending in an underscore change the tensor **in place** and return it: `x.add_(1)`, `x.mul_(2)`, `x.zero_()`, `x.clamp_(0, 1)`. `x += 1` is in place too. They save memory, but they overwrite data that autograd may need (Part 2), so ordinary code mostly uses the out-of-place versions.

```python
import torch

x = torch.ones(3)
y = x.add(1)          # new tensor; x unchanged
print(x, y)
x.add_(1)             # x changed
print(x)
x.zero_()
print(x)
```

## At a glance

| Concept | Code | Gives you | Remember |
|---|---|---|---|
| Element-wise | `a + b`, `a * b`, `torch.exp(a)`, `a.clamp(0, 1)` | same shape as the inputs | `*` isn't matrix multiplication |
| Broadcasting | shapes compared from the right | combine different shapes | each pair equal or 1 |
| Matrix product | `a @ b`, `torch.matmul` | `[n, k] @ [k, m] → [n, m]` | inner sizes and dtypes must match |
| Batched product | `torch.bmm(a, b)` or `a @ b` | `[b, n, k] @ [b, k, m] → [b, n, m]` | `@` also broadcasts batch dims |
| Reduce | `x.sum(dim=0)`, `x.mean(dim=1, keepdim=True)` | fewer dimensions | the dim you pass disappears |
| Predicted classes | `logits.argmax(dim=1)` | one index per sample | no dim gives a flattened index |
| Max with positions | `values, idx = x.max(dim=1)` | a named tuple | `x.max()` with no dim gives one value |
| In place | `x.add_(1)`, `x += 1`, `x.zero_()` | changes x | can break autograd (Part 2) |

## Common mistakes

- Using `*` when you mean matrix multiplication (`@`).
- Reducing along the wrong dim; ask which dimension should disappear.
- Dropping `keepdim=True` and then broadcasting the result against the wrong axis.
- Multiplying matrices with different dtypes (int64 @ float32 raises an error).
- Calling `.mean()` on an integer tensor; convert with `.float()` first.
- Calling `argmax()` without a dim on a batch and getting a flattened index.

## Exercises

### 1. Standardise the columns

Write `standardise(x)` that takes a 2-D float tensor (rows = samples, columns = features) and returns `(x - mean) / std` computed **per column**, using the population standard deviation (`correction=0`). Use broadcasting, no loops. If a column has a standard deviation of 0, divide by 1 instead (so that column becomes all zeros).

Starter code:

```python
import torch

def standardise(x):
    pass

x = torch.tensor([[1.0, 10.0], [2.0, 10.0], [3.0, 10.0]])
print(standardise(x))
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** per-column statistics, applied to every row.
2. **Examples:** column 1, 2, 3 has mean 2 and population std 0.8165, giving −1.22, 0, 1.22.
3. **Brute force:** loop over columns, standardising each: works, but slow on big data.
4. **Pattern:** **reduce along dim 0** then **broadcast back**.
5. **Plan:** mean and std along dim 0; guard zeros with where; subtract and divide.
6. **Code and test:** after standardising, every column should have mean 0 and std 1.

</details>

<details>
<summary>💡 Hint 1</summary>

Reduce over the rows to get one value per column: `dim=0` gives shape `[n_columns]`.

</details>

<details>
<summary>💡 Hint 2</summary>

`[rows, cols] - [cols]` broadcasts: each row has the column means subtracted.

</details>

<details>
<summary>💡 Hint 3</summary>

Replace zero standard deviations with `torch.where(std == 0, torch.ones_like(std), std)`.

</details>

### 2. Score a batch of predictions

`logits` has shape `[batch, classes]` (one row of class scores per sample) and `labels` has shape `[batch]` (the correct class index for each). Write `accuracy(logits, labels)` returning the fraction of samples whose highest-scoring class equals the label, as a Python float. Then write `pairwise_dist(a, b)` returning the matrix of Euclidean distances between every row of `a` (shape `[n, d]`) and every row of `b` (shape `[m, d]`): shape `[n, m]`, using broadcasting.

Starter code:

```python
import torch

def accuracy(logits, labels):
    pass

def pairwise_dist(a, b):
    pass

logits = torch.tensor([[2.0, 0.1, 0.3], [0.2, 0.1, 3.0], [1.0, 2.0, 0.0], [0.5, 0.4, 0.1]])
labels = torch.tensor([0, 2, 0, 0])
print(accuracy(logits, labels))           # 0.75
print(pairwise_dist(torch.tensor([[0.0, 0.0], [3.0, 4.0]]), torch.tensor([[0.0, 0.0]])))
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** accuracy compares predictions with labels; distances compare every pair of rows.
2. **Examples:** (0, 0) to (3, 4) is 5.
3. **Brute force:** two nested loops over rows for the distances.
4. **Pattern:** **argmax along the class dim**, and **unsqueeze to broadcast pairs**.
5. **Plan:** argmax, compare, mean; unsqueeze, subtract, square, sum, sqrt.
6. **Code and test:** a batch of one; random data against a loop version.

</details>

<details>
<summary>💡 Hint 1</summary>

`logits.argmax(dim=1)` gives the predicted class per row; compare with `labels` to get a bool tensor.

</details>

<details>
<summary>💡 Hint 2</summary>

The mean of a bool tensor needs a float: `(pred == labels).float().mean().item()`.

</details>

<details>
<summary>💡 Hint 3</summary>

For distances, `a.unsqueeze(1)` is `[n, 1, d]` and `b.unsqueeze(0)` is `[1, m, d]`; their difference broadcasts to `[n, m, d]`. Square, sum over `dim=2`, take `sqrt`.

</details>

**In the sandbox:** exercises 11–12. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Standardise the columns</summary>

```python
import torch

def standardise(x):
    mean = x.mean(dim=0)
    std = x.std(dim=0, correction=0)
    std = torch.where(std == 0, torch.ones_like(std), std)
    return (x - mean) / std

x = torch.tensor([[1.0, 10.0], [2.0, 10.0], [3.0, 10.0]])
print(standardise(x))
```

**Line by line**

- `x.mean(dim=0)` averages down each column: shape `[n_cols]`. The rows dimension disappears.
- `x.std(dim=0, correction=0)` divides by n (population). The default, `correction=1`, divides by n − 1.
- `torch.where(std == 0, torch.ones_like(std), std)` picks 1 where the std is 0, so a constant column becomes (value − mean) / 1 = 0 instead of 0 / 0 = nan.
- `(x - mean) / std`: shapes `[r, c]` and `[c]` line up from the right, so every row uses the same column statistics.

**Common wrong approach:** `dim=1`, which computes statistics per *row* (per sample). Ask "which dimension should disappear?": to get one number per feature, the samples dimension (0) must go.

</details>

<details>
<summary>✅ 2. Score a batch of predictions</summary>

```python
import torch

def accuracy(logits, labels):
    predictions = logits.argmax(dim=1)
    return (predictions == labels).float().mean().item()

def pairwise_dist(a, b):
    diff = a.unsqueeze(1) - b.unsqueeze(0)      # [n, 1, d] - [1, m, d] = [n, m, d]
    return (diff ** 2).sum(dim=2).sqrt()

logits = torch.tensor([[2.0, 0.1, 0.3], [0.2, 0.1, 3.0], [1.0, 2.0, 0.0], [0.5, 0.4, 0.1]])
labels = torch.tensor([0, 2, 0, 0])
print(accuracy(logits, labels))
print(pairwise_dist(torch.tensor([[0.0, 0.0], [3.0, 4.0]]), torch.tensor([[0.0, 0.0]])))
```

**Line by line**

- `logits.argmax(dim=1)`: for each row, the column with the highest score: `[0, 2, 1, 0]`.
- `predictions == labels`: `[True, True, False, True]`. `.float().mean()` turns it into the fraction 0.75 (a bool tensor can't be averaged directly), and `.item()` makes it a Python float.
- `a.unsqueeze(1) - b.unsqueeze(0)`: shapes `[n, 1, d]` and `[1, m, d]` broadcast to `[n, m, d]`, every row of a minus every row of b.
- `(diff ** 2).sum(dim=2).sqrt()` adds the squared differences over the d features, leaving `[n, m]`. (PyTorch's built-in for this is `torch.cdist(a, b)`.)

**Common wrong approach:** `a - b`, which only works when n equals m, and then subtracts row i from row i, not every pair.

</details>

## Quick quiz

1. `a` has shape `[5, 1, 4]` and `b` has shape `[3, 1]`. What is the shape of `a + b`?
   - A) `[5, 1, 4]`
   - B) It raises an error
   - C) `[5, 3, 4]`
   - D) `[5, 3, 1]`

2. `x` has shape `[32, 10]` (a batch of class scores). What does `x.argmax(dim=1)` return?
   - A) A tensor of shape `[32]`: the predicted class index for each sample
   - B) One number: the position of the largest score
   - C) A tensor of shape `[10]`: the best sample for each class
   - D) A tensor of shape `[32, 1]`

3. What is the shape of `torch.ones(4, 3) @ torch.ones(3)`?
   - A) `torch.Size([4, 3])`
   - B) `torch.Size([4])`
   - C) `torch.Size([3])`
   - D) It raises an error

4. `x = torch.tensor([[1., 2.], [3., 4.]])`. What does `x * x` compute?
   - A) The dot product: `30.`
   - B) The element-wise square: `[[1., 4.], [9., 16.]]`
   - C) The matrix product: `[[7., 10.], [15., 22.]]`
   - D) It raises an error

5. Which line leaves `x` unchanged?
   - A) `x.zero_()`
   - B) `y = x.add(1)`
   - C) `x += 1`
   - D) `x.add_(1)`

6. `x` has shape `[8, 3]`. Which expression divides each row by its own sum?
   - A) `x / x.sum()`
   - B) `x / x.sum(dim=0)`
   - C) `x / x.sum(dim=1)`
   - D) `x / x.sum(dim=1, keepdim=True)`

<details>
<summary>Quiz answers</summary>

1. **C) `[5, 3, 4]`**: From the right: 4 and 1 → 4; 1 and 3 → 3; 5 and (missing) → 5.
2. **A) A tensor of shape `[32]`: the predicted class index for each sample**: The dim you reduce disappears: dim 1 (classes) goes, leaving one index per sample.
3. **B) `torch.Size([4])`**: A matrix times a vector: [4, 3] @ [3] gives [4] (one dot product per row).
4. **B) The element-wise square: `[[1., 4.], [9., 16.]]`**: `*` is element-wise; use `@` for the matrix product.
5. **B) `y = x.add(1)`**: Methods without a trailing underscore return a new tensor; `_` methods and `+=` modify x in place.
6. **D) `x / x.sum(dim=1, keepdim=True)`**: keepdim keeps shape [8, 1], which broadcasts across the 3 columns. Without it, [8] lines up against the columns and fails.

</details>

---
Previous: [Lesson 5](05-reshaping.md) · Next: [Lesson 7: CPUs, GPUs and devices](07-devices.md)
