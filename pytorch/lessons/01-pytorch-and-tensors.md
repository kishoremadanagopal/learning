# Lesson 1: PyTorch, tensors and the exam

**You'll learn:** what PyTorch is (tensors, autograd, building blocks), your first tensor, shape, dtype and device, rank and dimensions, the NCHW image layout, tensors versus lists and NumPy arrays, .item(), how the sandbox's PyTorch works, the PTCA exam's format and domains.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/pytorch/#pytorch-and-tensors)**: run every example and check your exercise answers.

## Key terms

- **PyTorch:** an open-source Python library for building and training neural networks, built on tensors and automatic differentiation.
- **Tensor:** a multi-dimensional array of numbers of one dtype, which can live on a CPU or a GPU and can be tracked by autograd.
- **Shape:** the number of elements along each dimension of a tensor, returned as a `torch.Size` (a tuple).
- **Rank (number of dimensions):** how many dimensions a tensor has: 0 for a scalar, 1 for a vector, 2 for a matrix (`.ndim`).
- **Scalar tensor:** a 0-dimensional tensor holding one value, such as the result of `.sum()`.
- **dtype:** the data type shared by every element of a tensor, such as `torch.float32` or `torch.int64`.
- **Device:** where a tensor's data lives: `cpu`, `cuda` (an NVIDIA GPU) or `mps` (an Apple GPU).
- **NCHW:** PyTorch's layout for image batches: batch, channels, height, width.
- **PTCA:** the PyTorch Certified Associate exam from the PyTorch Foundation and the Linux Foundation (2026).

**PyTorch** is an open-source Python library for building and training neural networks. Most AI research and a large share of production models (including the large language models behind chat assistants) are written in it. It gives you three things:

1. **Tensors**: multi-dimensional arrays of numbers, like NumPy arrays, that can also live on a **GPU** for very fast maths.
2. **Autograd**: PyTorch records the operations you do on tensors and can work out **gradients** automatically, which is how models learn (Part 2).
3. **Building blocks** for models, data loading and training: `torch.nn`, `torch.optim`, `torch.utils.data` (Parts 3 and 4), plus tools to make it all fast (Part 5).

This part is about the first one. Everything in PyTorch is a tensor: the input data, the model's weights, its predictions and its loss.

## Your first tensor

```python
import torch

print(torch.__version__)

x = torch.tensor([1.0, 2.0, 3.0])
print(x)
print(x * 10)            # maths applies to every element at once
print(x.sum())           # the result is a tensor too: a 0-dimensional one
print(x.sum().item())    # .item() turns a one-element tensor into a plain Python number
```

Notice that `x.sum()` prints as `tensor(6.)`, not `6.0`: results stay tensors (so they can stay on the GPU and be tracked by autograd) until you ask for a Python number with `.item()`.

## Shape, dtype and device

Every tensor has three attributes you'll check constantly. Most PyTorch bugs are one of them being different from what you expected.

| Attribute | What it tells you | Example |
|---|---|---|
| `.shape` (or `.size()`) | how many elements along each **dimension** | `torch.Size([2, 3])`: 2 rows, 3 columns |
| `.dtype` | the type of every element | `torch.float32`, `torch.int64`, `torch.bool` |
| `.device` | where the data lives | `cpu`, `cuda:0` (an NVIDIA GPU), `mps` (Apple silicon) |

```python
import torch

m = torch.tensor([[1, 2, 3],
                  [4, 5, 6]])
print(m)
print(m.shape)        # torch.Size is a tuple: m.shape[0] is 2
print(m.ndim)         # number of dimensions (also m.dim())
print(m.numel())      # number of elements: 2 * 3
print(m.dtype)        # whole numbers become int64
print(m.device)
```

![Tensors of rank 0 to 3: a scalar 7 with shape torch.Size([]), a vector of 3 numbers with shape [3], a 2 by 3 matrix with shape [2, 3], and a stack of two 2 by 3 matrices with shape [2, 2, 3]. An image batch is 4-D: batch, channels, height, width](../figures/tensor-ranks.svg)

The number of dimensions is the tensor's **rank**: a **scalar** has 0, a **vector** 1, a **matrix** 2. Real data quickly gets more: a batch of 32 colour images of 224 × 224 pixels is a 4-D tensor of shape `[32, 3, 224, 224]` (batch, channels, height, width).

## Tensors versus lists and NumPy arrays

A Python list holds any objects, one by one, and `*` repeats it. A tensor holds numbers of **one dtype** in one block of memory, and operations run on all of them in fast C++ (or GPU) code.

```python
import numpy as np
import torch

nums = [1, 2, 3]
print(nums * 2)                       # list: repeated
print(np.array(nums) * 2)             # NumPy array: doubled
print(torch.tensor(nums) * 2)         # tensor: doubled, like NumPy

print(type(torch.tensor(nums)))
```

PyTorch's tensor API was designed to feel like NumPy: `+`, `*`, slicing, `.sum()`, `.mean()`, `.reshape()` and broadcasting all work the same way. What tensors add is **devices** (GPUs) and **autograd**.

## About this sandbox

The examples here run on the course's own copy of PyTorch, written in Python on NumPy so it can run in your browser. It follows PyTorch 2.14's names, printing, rules, random numbers and error messages for everything the course uses, so code you write here runs unchanged with real PyTorch (`pip install torch`). Two differences: it's much slower, and its GPU (`cuda`) is a pretend one, so you can practise moving tensors between devices without owning a GPU.

## The PyTorch Certified Associate (PTCA) exam

The PyTorch Foundation and the Linux Foundation launched the **PTCA** in June 2026. It's an online, proctored, multiple-choice exam of 120 minutes, with no prerequisites. It weights four domains:

| Domain | Weight | Where in this course |
|---|---|---|
| PyTorch fundamentals: tensors, devices, training and using models | 38% | Parts 1 and 2 |
| Performance and optimization: precision, `torch.compile`, profiling, distributed training | 26% | Part 5 |
| Model development: layers, losses, optimizers, improving models | 20% | Part 4 |
| Data handling: datasets, data loaders, transforms | 16% | Part 3 |

Questions test whether you can **predict what code does**: the shape that comes out, the dtype after an operation, which line raises an error and why. So in every lesson, guess the output before you press Run. Each lesson ends with exam-style questions, and Part 6 has full mock exams.

## At a glance

| Concept | Code | Gives you | Remember |
|---|---|---|---|
| Make a tensor | `torch.tensor([[1, 2], [3, 4]])` | a copy of the data, dtype inferred | ints → int64, floats → float32 |
| Inspect a tensor | `.shape`, `.ndim`, `.numel()`, `.dtype`, `.device` | what you need to debug | `.shape` is a `torch.Size` (a tuple) |
| Get a Python number | `t.item()` | an int, float or bool | only for one-element tensors |
| Image batch layout | `[batch, channels, height, width]` | what conv models expect | NCHW, channels first |

## Common mistakes

- Treating a 0-D tensor such as `x.sum()` as a Python number; call `.item()` when you need one.
- Multiplying a Python list by a number and expecting element-wise maths.
- Assuming images are height × width × channels; PyTorch models expect channels first.
- Ignoring dtype and device when debugging: most bugs are a shape, dtype or device you didn't expect.

## Exercises

### 1. Describe a tensor

Create a tensor `scores` holding these exam scores for 2 students across 4 tests, one row per student: `[71, 85, 90, 64]` and `[88, 79, 95, 70]`. Then set `n_dims`, `n_items` and `total` to its number of dimensions, its number of elements and the sum of all scores **as a plain Python int** (not a tensor).

Starter code:

```python
import torch

scores = None
n_dims = None
n_items = None
total = None
print(scores, n_dims, n_items, total)
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** build a 2 × 4 tensor, then read three facts about it; the last must be a Python number.
2. **Examples:** two rows of four numbers → shape `[2, 4]`.
3. **Brute force:** you could count by hand, but the tensor already knows.
4. **Pattern:** **attributes** (`ndim`, `numel()`) and **reduce then convert** (`sum().item()`).
5. **Plan:** `torch.tensor` of a nested list; `ndim`; `numel()`; `sum().item()`.
6. **Code and test:** print everything and check the types.

</details>

<details>
<summary>💡 Hint 1</summary>

A list of two lists makes a 2-D tensor: `torch.tensor([[...], [...]])`.

</details>

<details>
<summary>💡 Hint 2</summary>

`.ndim` gives the number of dimensions and `.numel()` the number of elements.

</details>

<details>
<summary>💡 Hint 3</summary>

`scores.sum()` is a 0-D tensor; `.item()` turns it into a Python int (because the tensor holds int64 values).

</details>

### 2. Lists versus tensors

Given the Python list `prices = [2.5, 4.0, 10.0]`, make `doubled_list` by putting `prices` twice in a row (a list of 6 numbers), and `doubled_tensor` by multiplying every price by 2 (a tensor of 3 numbers). Use `*` for both.

Starter code:

```python
import torch

prices = [2.5, 4.0, 10.0]
doubled_list = None
doubled_tensor = None
print(doubled_list)
print(doubled_tensor)
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** the same operator means different things for lists and tensors.
2. **Examples:** `[1, 2] * 2` is `[1, 2, 1, 2]`; `torch.tensor([1, 2]) * 2` is `tensor([2, 4])`.
3. **Brute force:** a loop that doubles each price works, but tensors do it in one step.
4. **Pattern:** **element-wise maths**: tensor operators apply to every element.
5. **Plan:** `prices * 2`, and `torch.tensor(prices) * 2`.
6. **Code and test:** check lengths: 6 and 3.

</details>

<details>
<summary>💡 Hint 1</summary>

On a list, `* 2` repeats it.

</details>

<details>
<summary>💡 Hint 2</summary>

Turn the list into a tensor first with `torch.tensor(prices)`; then `* 2` multiplies each element.

</details>

**In the sandbox:** exercises 1–2. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Describe a tensor</summary>

```python
import torch

scores = torch.tensor([[71, 85, 90, 64],
                       [88, 79, 95, 70]])
n_dims = scores.ndim
n_items = scores.numel()
total = scores.sum().item()
print(scores, n_dims, n_items, total)
```

**Line by line**

- `torch.tensor([[...], [...]])` copies the nested list into a new tensor. All values are whole numbers, so its dtype is `torch.int64`.
- `scores.ndim` is 2: rows and columns. (`scores.dim()` is the same.)
- `scores.numel()` multiplies the shape: 2 × 4 = 8.
- `scores.sum()` adds every element and returns `tensor(642)`, a 0-dimensional tensor. `.item()` converts it to the Python int `642`.

**Common wrong approach:** `total = scores.sum()`. It prints as `tensor(642)` and *looks* right, but it's still a tensor; comparisons and JSON serialisation of it behave differently from a plain number.

</details>

<details>
<summary>✅ 2. Lists versus tensors</summary>

```python
import torch

prices = [2.5, 4.0, 10.0]
doubled_list = prices * 2
doubled_tensor = torch.tensor(prices) * 2
print(doubled_list)
print(doubled_tensor)
```

**Line by line**

- `prices * 2` follows Python's rule for sequences: concatenate the list with itself.
- `torch.tensor(prices)` makes a float32 tensor (the prices have decimal points), and `* 2` multiplies every element, giving `tensor([ 5.,  8., 20.])`.

**Why it matters:** in PyTorch code, a list sneaking in where a tensor is expected gives silently wrong results like this, not an error. Convert data to tensors early.

</details>

## Quick quiz

1. What does `torch.tensor([[1, 2], [3, 4], [5, 6]]).shape` return?
   - A) `(3, 2, 1)`
   - B) `torch.Size([3, 2])`
   - C) `torch.Size([6])`
   - D) `torch.Size([2, 3])`

2. `x = torch.tensor([4.0, 5.0])`. What is `type(x.sum())`?
   - A) `int`
   - B) `float`
   - C) `torch.Tensor`, holding a 0-dimensional tensor
   - D) `numpy.float32`

3. A batch of 16 RGB images, each 64 × 64 pixels, in PyTorch's usual layout. What's its shape?
   - A) `[16, 3, 64, 64]`
   - B) `[64, 64, 3, 16]`
   - C) `[3, 16, 64, 64]`
   - D) `[16, 64, 64, 3]`

4. Which of these is NOT one of the three attributes that describe every tensor?
   - A) `.device`
   - B) `.dtype`
   - C) `.grad_fn`
   - D) `.shape`

<details>
<summary>Quiz answers</summary>

1. **B) `torch.Size([3, 2])`**: Three inner lists (rows) of two numbers each: 3 rows, 2 columns. `torch.Size` is a subclass of tuple.
2. **C) `torch.Tensor`, holding a 0-dimensional tensor**: Reductions return tensors. Call `.item()` to get a Python number.
3. **A) `[16, 3, 64, 64]`**: PyTorch's convention is NCHW: batch, channels, height, width. (Libraries such as PIL and Matplotlib use height, width, channels.)
4. **C) `.grad_fn`**: `grad_fn` exists only on tensors produced by operations that autograd records; shape, dtype and device describe every tensor.

</details>

---
Back to the [course home](../README.md) · Next: [Lesson 2: Creating tensors](02-creating-tensors.md)
