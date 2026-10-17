# Lesson 5: Reshaping, joining and splitting

**You'll learn:** view and reshape with -1, strides and contiguous tensors, why view fails after transpose, contiguous(), unsqueeze and squeeze, permute and transpose, .T and .mT, flatten, cat versus stack, split, chunk and unbind.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/pytorch/#reshaping)**: run every example and check your exercise answers.

## Key terms

- **reshape:** returns a tensor with the same elements in a new shape, as a view when possible and a copy otherwise.
- **view:** returns a tensor with a new shape that shares memory; it fails when the memory layout doesn't allow it.
- **Stride:** how many elements to skip in memory to move one step along each dimension.
- **Contiguous:** a tensor whose elements lie in memory in row-by-row reading order.
- **unsqueeze / squeeze:** add a dimension of size 1 / remove dimensions of size 1.
- **permute:** reorders all dimensions; `transpose` swaps two.
- **flatten:** merges a range of dimensions into one.
- **cat:** joins tensors along an existing dimension.
- **stack:** joins same-shaped tensors along a new dimension.

Models are picky about shapes: a linear layer wants `[batch, features]`, an image model wants `[batch, channels, height, width]`. Reshaping is how you get data into the shape the next step expects. None of these operations change the **values**, only how they're arranged.

## view and reshape

Both take the new shape; the number of elements must stay the same. One size can be `-1`, meaning "whatever makes the count work".

```python
import torch

x = torch.arange(6)
print(x.view(2, 3))
print(x.reshape(3, 2))
print(x.view(-1, 2).shape)       # -1 is worked out: 6 / 2 = 3
print(x.reshape(1, -1).shape)
```

*This example raises an error on purpose.*

```python
import torch

x = torch.arange(6)
print(x.view(4, 2))              # 8 slots for 6 numbers
```

## Strides and contiguous memory

A tensor's elements sit in one long block of memory. Its **stride** says how many elements to skip to move one step along each dimension. A tensor is **contiguous** when its rows lie one after another in memory in the order you'd read them.

`.t()`, `.transpose()` and `.permute()` don't move any data: they return a view with swapped strides, which is **not contiguous**. `.view()` only works when the memory layout allows it, so it fails on those; `.reshape()` returns a view when it can and copies when it must.

```python
import torch

a = torch.arange(6).view(2, 3)
t = a.t()
print(a.stride(), t.stride())
print(a.is_contiguous(), t.is_contiguous())
print(t.reshape(6))              # works: copies if needed
print(t.contiguous().view(6))    # also works: make it contiguous first
```

*This example raises an error on purpose.*

```python
import torch

t = torch.arange(6).view(2, 3).t()
print(t.view(6))
```

Rule of thumb: use `reshape` unless you specifically need a guaranteed view (sharing memory), in which case `view` tells you loudly when it can't.

## Adding and removing size-1 dimensions

| Operation | Effect | Example (x has shape `[3]`) |
|---|---|---|
| `x.unsqueeze(0)` | insert a size-1 dim at position 0 | `[1, 3]`: a batch of one |
| `x.unsqueeze(1)` or `x.unsqueeze(-1)` | at the end | `[3, 1]`: a column |
| `y.squeeze()` | remove **every** size-1 dim | `[1, 3, 1]` → `[3]` |
| `y.squeeze(0)` | remove dim 0 only if it has size 1 | `[1, 3, 1]` → `[3, 1]` |

```python
import torch

image = torch.zeros(3, 28, 28)          # one image: channels, height, width
batch = image.unsqueeze(0)             # models expect a batch dimension
print(batch.shape)
print(batch.squeeze(0).shape)
print(torch.zeros(1, 4, 1).squeeze().shape)
print(torch.zeros(2, 3).squeeze(0).shape)   # dim 0 has size 2: nothing removed
```

Be careful with plain `squeeze()`: with a batch of one, it removes the batch dimension too.

## Reordering dimensions: permute and transpose

`permute(*dims)` lists the old dimensions in their new order; `transpose(d0, d1)` swaps two. The classic use is converting images between layouts.

```python
import torch

hwc = torch.zeros(28, 32, 3)            # height, width, channels (PIL / NumPy layout)
chw = hwc.permute(2, 0, 1)              # channels first, as PyTorch models expect
print(chw.shape)
print(hwc.transpose(0, 1).shape)        # swap height and width
m = torch.zeros(4, 5)
print(m.T.shape, m.mT.shape)            # .T for a matrix; .mT swaps the last two dims of any batch
print(torch.zeros(2, 3, 4).flatten().shape, torch.zeros(2, 3, 4).flatten(1).shape)
```

`flatten(start_dim=0)` merges dimensions into one; `flatten(1)` keeps the batch dimension and flattens the rest, which is how image features are fed into a linear layer (`nn.Flatten` in Part 4 does exactly that).

## Joining: cat versus stack

- `torch.cat(tensors, dim)` joins along an **existing** dimension. All other sizes must match.
- `torch.stack(tensors, dim)` creates a **new** dimension. All shapes must match exactly.

```python
import torch

a = torch.tensor([[1, 2], [3, 4]])
b = torch.tensor([[5, 6]])
print(torch.cat([a, b], dim=0))          # 2 rows + 1 row = 3 rows
print(torch.cat([a, a], dim=1).shape)    # side by side: [2, 4]
print(torch.stack([a, a]).shape)         # a new first dim: [2, 2, 2]
print(torch.stack([a, a], dim=2).shape)
```

*This example raises an error on purpose.*

```python
import torch

print(torch.cat([torch.zeros(2, 3), torch.zeros(2, 4)], dim=0))
```

## Splitting: split, chunk and unbind

```python
import torch

x = torch.arange(10)
print(x.split(4))                  # pieces of size 4 (the last is smaller)
print(x.split([2, 8]))             # exact sizes
print(x.chunk(3))                  # 3 pieces, as equal as possible
print(torch.arange(6).view(2, 3).unbind(0))   # remove a dim: one tensor per row
```

The pieces are views of the original.

## At a glance

| Concept | Code | Gives you | Remember |
|---|---|---|---|
| New shape | `x.reshape(2, -1)`, `x.view(2, -1)` | same elements, new shape | element count must match; one -1 allowed |
| Contiguity | `x.is_contiguous()`, `x.contiguous()` | a row-major copy if needed | `.t()` and `.permute()` aren't contiguous |
| Size-1 dims | `x.unsqueeze(0)`, `x.squeeze(0)` | add or remove a batch dim | plain `squeeze()` removes every size-1 dim |
| Reorder dims | `x.permute(2, 0, 1)`, `x.transpose(0, 1)` | a view with new strides | HWC → CHW is `permute(2, 0, 1)` |
| Flatten features | `x.flatten(1)` | `[batch, features]` | keeps dim 0 |
| Join | `torch.cat(ts, dim)`, `torch.stack(ts, dim)` | along an existing / a new dim | stack needs identical shapes |
| Split | `x.split(size)`, `x.split([a, b])`, `x.chunk(n)` | a tuple of views | split takes sizes, chunk takes a count |

## Common mistakes

- Using `reshape` or `view` to move dimensions (like HWC to CHW); that needs `permute`.
- Calling `.view()` on a transposed or permuted tensor; use `.reshape()` or `.contiguous()` first.
- Calling `squeeze()` with no dim and losing a batch dimension of size 1.
- Confusing `cat` and `stack`: cat keeps the number of dimensions, stack adds one.
- Joining tensors whose other dimensions don't match.

## Exercises

### 1. Images into a batch

`images` is a list of 4 images, each a tensor of shape `[28, 28, 3]` (height, width, channels). Write `to_batch(images)` returning one tensor of shape `[4, 3, 28, 28]`: a batch in PyTorch's channels-first layout. Then write `flat_features(batch)` returning a `[batch, features]` tensor that keeps the first dimension and flattens everything else.

Starter code:

```python
import torch

def to_batch(images):
    pass

def flat_features(batch):
    pass

imgs = [torch.rand(28, 28, 3) for _ in range(4)]
b = to_batch(imgs)
print(b.shape)                    # torch.Size([4, 3, 28, 28])
print(flat_features(b).shape)     # torch.Size([4, 2352])
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** two shape changes: reorder each image's dims, then add a batch dim; then flatten all but the batch.
2. **Examples:** `[28, 28, 3]` → `[3, 28, 28]` → stacked `[4, 3, 28, 28]` → `[4, 2352]`.
3. **Brute force:** stack first to `[4, 28, 28, 3]`, then `permute(0, 3, 1, 2)`: also correct.
4. **Pattern:** **permute** to reorder, **stack** for a new dim, **flatten(1)** for features.
5. **Plan:** permute in a list comprehension, stack, flatten.
6. **Code and test:** a batch of one must keep its batch dimension.

</details>

<details>
<summary>💡 Hint 1</summary>

Each image needs its channels moved first: `img.permute(2, 0, 1)` gives `[3, 28, 28]`.

</details>

<details>
<summary>💡 Hint 2</summary>

`torch.stack(list_of_tensors)` adds the batch dimension in front.

</details>

<details>
<summary>💡 Hint 3</summary>

`batch.flatten(1)` (or `batch.reshape(batch.shape[0], -1)`) keeps dim 0.

</details>

### 2. Split a dataset

Write `train_val_split(data, n_val)` that returns two tensors: the training rows (everything except the last `n_val` rows) and the validation rows (the last `n_val`). Then write `add_bias_column(x)` that returns `x` with an extra column of ones on the right, using `torch.cat`.

Starter code:

```python
import torch

def train_val_split(data, n_val):
    pass

def add_bias_column(x):
    pass

data = torch.arange(20.).reshape(10, 2)
train, val = train_val_split(data, 3)
print(train.shape, val.shape)        # torch.Size([7, 2]) torch.Size([3, 2])
print(add_bias_column(val))
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** split rows into two groups; append a column.
2. **Examples:** 10 rows, n_val=3 → 7 and 3 rows.
3. **Brute force:** loop and append rows to lists, then stack: slow and long.
4. **Pattern:** **split by sizes** (or slicing) and **cat along dim 1** for columns.
5. **Plan:** `split([n - n_val, n_val])`; make a `[rows, 1]` tensor of ones; cat.
6. **Code and test:** check a single-column input.

</details>

<details>
<summary>💡 Hint 1</summary>

Slicing works: `data[:-n_val]` and `data[-n_val:]`. Or `data.split([n_train, n_val])`.

</details>

<details>
<summary>💡 Hint 2</summary>

The column of ones needs shape `[rows, 1]` so that `cat` along dim 1 lines up.

</details>

<details>
<summary>💡 Hint 3</summary>

`torch.cat([x, ones], dim=1)`; give `ones` the same dtype as `x`.

</details>

**In the sandbox:** exercises 9–10. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Images into a batch</summary>

```python
import torch

def to_batch(images):
    return torch.stack([img.permute(2, 0, 1) for img in images])

def flat_features(batch):
    return batch.flatten(1)

imgs = [torch.rand(28, 28, 3) for _ in range(4)]
b = to_batch(imgs)
print(b.shape)
print(flat_features(b).shape)
```

**Line by line**

- `img.permute(2, 0, 1)` says: new dim 0 is old dim 2 (channels), then old dims 0 and 1 (height, width). It's a view, no copy.
- `torch.stack([...])` creates a new dim 0 of size 4; every image must have exactly the same shape.
- `batch.flatten(1)` merges dims 1 to the end: 3 × 28 × 28 = 2352 features per image.

**Common wrong approach:** `img.reshape(3, 28, 28)`. It has the right shape but the wrong arrangement: reshape refills the same values in memory order, mixing pixels from different channels. Use `permute` to move dimensions, `reshape`/`view` to regroup them.

</details>

<details>
<summary>✅ 2. Split a dataset</summary>

```python
import torch

def train_val_split(data, n_val):
    return data.split([len(data) - n_val, n_val])

def add_bias_column(x):
    ones = torch.ones(x.shape[0], 1, dtype=x.dtype)
    return torch.cat([x, ones], dim=1)

data = torch.arange(20.).reshape(10, 2)
train, val = train_val_split(data, 3)
print(train.shape, val.shape)
print(add_bias_column(val))
```

**Line by line**

- `data.split([len(data) - n_val, n_val])` splits along dim 0 into exactly those sizes and returns a tuple of two views. (`len(t)` is the size of dim 0.)
- `torch.ones(x.shape[0], 1, dtype=x.dtype)` is a column with one row per row of x.
- `torch.cat([x, ones], dim=1)` joins side by side: shapes `[r, c]` and `[r, 1]` give `[r, c + 1]`.

**Common wrong approach:** `torch.ones(x.shape[0])` (shape `[r]`, 1-D): `cat` refuses because the tensors have different numbers of dimensions. `torch.stack` would also be wrong: it adds a new dimension instead of a column.

</details>

## Quick quiz

1. `x = torch.zeros(4, 6)`. Which call raises an error?
   - A) `x.view(5, -1)`
   - B) `x.view(-1)`
   - C) `x.reshape(3, 8)`
   - D) `x.view(2, 3, 4)`

2. `x = torch.rand(2, 3, 4)`. What is `x.permute(2, 0, 1).shape`?
   - A) `torch.Size([4, 2, 3])`
   - B) `torch.Size([3, 4, 2])`
   - C) `torch.Size([2, 4, 3])`
   - D) `torch.Size([4, 3, 2])`

3. Why does `x.t().view(-1)` raise an error when `x` is 2 × 3?
   - A) The transpose is not contiguous in memory, and view never copies
   - B) view can't take -1
   - C) Transposed tensors can't be reshaped at all
   - D) view only works on 1-D tensors

4. `a` and `b` both have shape `[5, 3]`. What are the shapes of `torch.cat([a, b])` and `torch.stack([a, b])`?
   - A) `[10, 3]` and `[2, 5, 3]`
   - B) `[2, 5, 3]` and `[10, 3]`
   - C) `[5, 6]` and `[2, 5, 3]`
   - D) `[10, 3]` and `[5, 3, 2]`

5. `x` has shape `[1, 10, 1]`. What is `x.squeeze(1).shape`?
   - A) `torch.Size([1, 10, 1])`
   - B) `torch.Size([10])`
   - C) `torch.Size([1, 1])`
   - D) It raises an error

<details>
<summary>Quiz answers</summary>

1. **A) `x.view(5, -1)`**: 24 elements can't be split into rows of 5. Every other shape multiplies to 24.
2. **A) `torch.Size([4, 2, 3])`**: New dim i is old dim dims[i]: old dim 2 (size 4), then 0 (size 2), then 1 (size 3).
3. **A) The transpose is not contiguous in memory, and view never copies**: Use .reshape(-1) or .contiguous().view(-1).
4. **A) `[10, 3]` and `[2, 5, 3]`**: cat joins along an existing dim (0 by default); stack adds a new dim (0 by default).
5. **A) `torch.Size([1, 10, 1])`**: squeeze(dim) only removes that dim when its size is 1; dim 1 has size 10, so nothing changes.

</details>

---
Previous: [Lesson 4](04-indexing-and-views.md) · Next: [Lesson 6: Tensor maths and broadcasting](06-tensor-math.md)
