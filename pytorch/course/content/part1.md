@@@ part
id: 1
title: Tensors and Devices
level: Beginner
blurb: The foundation of everything in PyTorch, and the biggest slice of the exam: what a tensor is, creating tensors (including random ones you can reproduce), dtypes and precision, indexing and views, reshaping, tensor maths with broadcasting, and moving work between the CPU and a GPU.

@@@ lesson
id: pytorch-and-tensors
title: PyTorch, tensors and the exam
minutes: 15
summary: What PyTorch is and why it's the standard for AI models, what a tensor is (and how it differs from a Python list and a NumPy array), your first tensors, the three attributes every tensor has, how this sandbox's PyTorch works, and what the PyTorch Certified Associate exam covers.
---
**PyTorch** is an open-source Python library for building and training neural networks. Most AI research and a large share of production models (including the large language models behind chat assistants) are written in it. It gives you three things:

1. **Tensors**: multi-dimensional arrays of numbers, like NumPy arrays, that can also live on a **GPU** for very fast maths.
2. **Autograd**: PyTorch records the operations you do on tensors and can work out **gradients** automatically, which is how models learn (Part 2).
3. **Building blocks** for models, data loading and training: `torch.nn`, `torch.optim`, `torch.utils.data` (Parts 3 and 4), plus tools to make it all fast (Part 5).

This part is about the first one. Everything in PyTorch is a tensor: the input data, the model's weights, its predictions and its loss.

### Your first tensor

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

### Shape, dtype and device

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

![Tensors of rank 0 to 3: a scalar 7 with shape torch.Size([]), a vector of 3 numbers with shape [3], a 2 by 3 matrix with shape [2, 3], and a stack of two 2 by 3 matrices with shape [2, 2, 3]. An image batch is 4-D: batch, channels, height, width](figures/tensor-ranks.svg)

The number of dimensions is the tensor's **rank**: a **scalar** has 0, a **vector** 1, a **matrix** 2. Real data quickly gets more: a batch of 32 colour images of 224 × 224 pixels is a 4-D tensor of shape `[32, 3, 224, 224]` (batch, channels, height, width).

### Tensors versus lists and NumPy arrays

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

### About this sandbox

The examples here run on the course's own copy of PyTorch, written in Python on NumPy so it can run in your browser. It follows PyTorch 2.14's names, printing, rules, random numbers and error messages for everything the course uses, so code you write here runs unchanged with real PyTorch (`pip install torch`). Two differences: it's much slower, and its GPU (`cuda`) is a pretend one, so you can practise moving tensors between devices without owning a GPU.

### The PyTorch Certified Associate (PTCA) exam

The PyTorch Foundation and the Linux Foundation launched the **PTCA** in June 2026. It's an online, proctored, multiple-choice exam of 120 minutes, with no prerequisites. It weights four domains:

| Domain | Weight | Where in this course |
|---|---|---|
| PyTorch fundamentals: tensors, devices, training and using models | 38% | Parts 1 and 2 |
| Performance and optimization: precision, `torch.compile`, profiling, distributed training | 26% | Part 5 |
| Model development: layers, losses, optimizers, improving models | 20% | Part 4 |
| Data handling: datasets, data loaders, transforms | 16% | Part 3 |

Questions test whether you can **predict what code does**: the shape that comes out, the dtype after an operation, which line raises an error and why. So in every lesson, guess the output before you press Run. Each lesson ends with exam-style questions, and Part 6 has full mock exams.

:::exercise Describe a tensor
Create a tensor `scores` holding these exam scores for 2 students across 4 tests, one row per student: `[71, 85, 90, 64]` and `[88, 79, 95, 70]`. Then set `n_dims`, `n_items` and `total` to its number of dimensions, its number of elements and the sum of all scores **as a plain Python int** (not a tensor).
```python starter
import torch

scores = None
n_dims = None
n_items = None
total = None
print(scores, n_dims, n_items, total)
```
```python check
import torch
s = need("scores", torch.Tensor)
same(s, torch.tensor([[71, 85, 90, 64], [88, 79, 95, 70]]), "scores", ignore_dtype=False)
nd = need("n_dims")
assert nd == 2 and isinstance(nd, int), f"n_dims should be 2 (an int), got {nd!r}."
ni = need("n_items")
assert ni == 8 and isinstance(ni, int), f"n_items should be 8 (an int), got {ni!r}."
t = need("total")
assert not isinstance(t, torch.Tensor), "total is still a tensor: turn it into a Python number with .item()."
assert t == 642 and isinstance(t, int), f"total should be 642, got {t!r}."
```
```python solution
import torch

scores = torch.tensor([[71, 85, 90, 64],
                       [88, 79, 95, 70]])
n_dims = scores.ndim
n_items = scores.numel()
total = scores.sum().item()
print(scores, n_dims, n_items, total)
```
hint: A list of two lists makes a 2-D tensor: `torch.tensor([[...], [...]])`.
hint: `.ndim` gives the number of dimensions and `.numel()` the number of elements.
hint: `scores.sum()` is a 0-D tensor; `.item()` turns it into a Python int (because the tensor holds int64 values).
approach:
1. **Understand:** build a 2 × 4 tensor, then read three facts about it; the last must be a Python number.
2. **Examples:** two rows of four numbers → shape `[2, 4]`.
3. **Brute force:** you could count by hand, but the tensor already knows.
4. **Pattern:** **attributes** (`ndim`, `numel()`) and **reduce then convert** (`sum().item()`).
5. **Plan:** `torch.tensor` of a nested list; `ndim`; `numel()`; `sum().item()`.
6. **Code and test:** print everything and check the types.
walkthrough:
**Line by line**

- `torch.tensor([[...], [...]])` copies the nested list into a new tensor. All values are whole numbers, so its dtype is `torch.int64`.
- `scores.ndim` is 2: rows and columns. (`scores.dim()` is the same.)
- `scores.numel()` multiplies the shape: 2 × 4 = 8.
- `scores.sum()` adds every element and returns `tensor(642)`, a 0-dimensional tensor. `.item()` converts it to the Python int `642`.

**Common wrong approach:** `total = scores.sum()`. It prints as `tensor(642)` and *looks* right, but it's still a tensor; comparisons and JSON serialisation of it behave differently from a plain number.
:::

:::exercise Lists versus tensors
Given the Python list `prices = [2.5, 4.0, 10.0]`, make `doubled_list` by putting `prices` twice in a row (a list of 6 numbers), and `doubled_tensor` by multiplying every price by 2 (a tensor of 3 numbers). Use `*` for both.
```python starter
import torch

prices = [2.5, 4.0, 10.0]
doubled_list = None
doubled_tensor = None
print(doubled_list)
print(doubled_tensor)
```
```python check
import torch
dl = need("doubled_list", list)
assert dl == [2.5, 4.0, 10.0, 2.5, 4.0, 10.0], f"doubled_list should be the list twice, got {dl!r}."
dt = need("doubled_tensor", torch.Tensor)
same(dt, torch.tensor([5.0, 8.0, 20.0]), "doubled_tensor")
assert uses("*"), "Use the * operator for both."
```
```python solution
import torch

prices = [2.5, 4.0, 10.0]
doubled_list = prices * 2
doubled_tensor = torch.tensor(prices) * 2
print(doubled_list)
print(doubled_tensor)
```
hint: On a list, `* 2` repeats it.
hint: Turn the list into a tensor first with `torch.tensor(prices)`; then `* 2` multiplies each element.
approach:
1. **Understand:** the same operator means different things for lists and tensors.
2. **Examples:** `[1, 2] * 2` is `[1, 2, 1, 2]`; `torch.tensor([1, 2]) * 2` is `tensor([2, 4])`.
3. **Brute force:** a loop that doubles each price works, but tensors do it in one step.
4. **Pattern:** **element-wise maths**: tensor operators apply to every element.
5. **Plan:** `prices * 2`, and `torch.tensor(prices) * 2`.
6. **Code and test:** check lengths: 6 and 3.
walkthrough:
**Line by line**

- `prices * 2` follows Python's rule for sequences: concatenate the list with itself.
- `torch.tensor(prices)` makes a float32 tensor (the prices have decimal points), and `* 2` multiplies every element, giving `tensor([ 5.,  8., 20.])`.

**Why it matters:** in PyTorch code, a list sneaking in where a tensor is expected gives silently wrong results like this, not an error. Convert data to tensors early.
:::

:::quiz
? What does `torch.tensor([[1, 2], [3, 4], [5, 6]]).shape` return?
+ `torch.Size([3, 2])`
- `torch.Size([2, 3])`
- `torch.Size([6])`
- `(3, 2, 1)`
= Three inner lists (rows) of two numbers each: 3 rows, 2 columns. `torch.Size` is a subclass of tuple.
? `x = torch.tensor([4.0, 5.0])`. What is `type(x.sum())`?
+ `torch.Tensor`, holding a 0-dimensional tensor
- `float`
- `int`
- `numpy.float32`
= Reductions return tensors. Call `.item()` to get a Python number.
? A batch of 16 RGB images, each 64 × 64 pixels, in PyTorch's usual layout. What's its shape?
+ `[16, 3, 64, 64]`
- `[16, 64, 64, 3]`
- `[3, 16, 64, 64]`
- `[64, 64, 3, 16]`
= PyTorch's convention is NCHW: batch, channels, height, width. (Libraries such as PIL and Matplotlib use height, width, channels.)
? Which of these is NOT one of the three attributes that describe every tensor?
+ `.grad_fn`
- `.shape`
- `.dtype`
- `.device`
= `grad_fn` exists only on tensors produced by operations that autograd records; shape, dtype and device describe every tensor.
:::

@@@ lesson
id: creating-tensors
title: Creating tensors
minutes: 20
summary: torch.tensor from Python data, filled tensors (zeros, ones, full, eye), ranges (arange, linspace), the *_like functions, empty, random tensors (rand, randn, randint, randperm), seeding with torch.manual_seed and Generators for reproducible results, and creating tensors from NumPy.
---
There are four ways to get a tensor: from data you already have, filled with a constant, as a sequence, or random.

### From Python data: torch.tensor

`torch.tensor(data)` **copies** a number, a list or nested lists (or a NumPy array) into a new tensor and infers the dtype from the values. Every inner list must have the same length.

```python
import torch

print(torch.tensor(3.5))                     # a 0-D tensor (scalar)
print(torch.tensor([1, 2, 3]))               # ints  -> int64
print(torch.tensor([1, 2.5, 3]))             # any float -> float32
print(torch.tensor([True, False]))           # bools -> bool
print(torch.tensor([1, 2, 3], dtype=torch.float32))   # or choose the dtype
```

```python error
import torch

ragged = torch.tensor([[1, 2, 3], [4, 5]])   # rows of different lengths
```

You'll also see `torch.Tensor([1, 2])` with a capital T in older code. That calls the class constructor, which always makes float32 and treats integers as *sizes* (`torch.Tensor(2, 3)` is an uninitialised 2 × 3 tensor). Use lowercase `torch.tensor` for data.

### Filled tensors and ranges

These take a **shape** (as separate numbers or one tuple) and make float32 tensors unless you pass `dtype=`.

```python
import torch

print(torch.zeros(2, 3))                 # same as torch.zeros((2, 3))
print(torch.ones(2, dtype=torch.int64))
print(torch.full((2, 2), 7.5))           # every element 7.5
print(torch.eye(3))                      # identity matrix
print(torch.arange(5))                   # 0, 1, 2, 3, 4  (end excluded, like range)
print(torch.arange(1, 2, 0.25))          # start, end, step
print(torch.linspace(0, 1, 5))           # 5 points from 0 to 1, both ends included
```

`arange` works like Python's `range`: the end is **excluded**, and with all-integer arguments it makes int64. `linspace(start, end, steps)` gives exactly `steps` evenly spaced values **including** both ends, always as floats.

`torch.empty(2, 3)` allocates memory without setting the values. It's slightly faster when you'll overwrite every element anyway, but in real PyTorch its contents are whatever was in memory: never read them before writing.

### The *_like functions

`zeros_like(t)`, `ones_like(t)`, `full_like(t, v)`, `rand_like(t)` and `randn_like(t)` make a new tensor with the **same shape, dtype and device** as `t`. They save you from copying all three by hand, and they keep code device-agnostic (lesson 7).

```python
import torch

x = torch.tensor([[1, 2], [3, 4]])
print(torch.zeros_like(x))                       # int64, like x
print(torch.full_like(x, 9))
print(torch.ones_like(x, dtype=torch.float32))   # override the dtype
```

### Random tensors

| Function | Values | Default dtype |
|---|---|---|
| `torch.rand(*shape)` | uniform in [0, 1) | float32 |
| `torch.randn(*shape)` | normal (Gaussian), mean 0, standard deviation 1 | float32 |
| `torch.randint(low, high, shape)` | integers in [low, high): `high` excluded | int64 |
| `torch.randperm(n)` | a shuffled 0 … n − 1 | int64 |

Note the different call style of `randint`: the shape is a **tuple** after the bounds.

```python
import torch

torch.manual_seed(0)
print(torch.rand(3))
print(torch.randn(2, 3))
print(torch.randint(0, 10, (5,)))      # high is excluded: values 0 to 9
print(torch.randperm(6))
```

### Reproducible randomness: seeds

Random numbers in PyTorch come from a **generator** that starts from a **seed**. Real PyTorch picks a new random seed each time Python starts, so without a seed you get different numbers on every run, and so does this sandbox. `torch.manual_seed(n)` resets the default generator, so the same sequence of calls gives the same numbers every time. (It seeds CPU and GPU generators together.)

```python
import torch

torch.manual_seed(42)
a = torch.rand(3)
torch.manual_seed(42)
b = torch.rand(3)
print(a)
print(torch.equal(a, b))          # same seed, same numbers

c = torch.rand(3)                 # the generator moved on
print(torch.equal(a, c))

g = torch.Generator().manual_seed(42)     # a separate generator for one purpose
print(torch.rand(3, generator=g))         # same as a: same seed
```

Seeding makes **experiments** repeatable: you can compare two versions of a model knowing the difference isn't luck. Two cautions for the exam: the seed fixes the *sequence*, so an extra random call earlier changes everything after it; and full determinism on GPUs also needs `torch.use_deterministic_algorithms(True)` because some fast GPU kernels aren't deterministic.

### From NumPy

`torch.from_numpy(arr)` makes a tensor that **shares memory** with the array (no copy, so it's instant, but changing one changes the other). `torch.tensor(arr)` copies. Either way the dtype carries over, and NumPy's default float is **float64**, while PyTorch models use float32.

```python
import numpy as np
import torch

arr = np.array([1.0, 2.0, 3.0])
shared = torch.from_numpy(arr)
copied = torch.tensor(arr)
arr[0] = 100.0
print(shared)                  # sees the change
print(copied)                  # doesn't
print(shared.dtype)            # float64 from NumPy
print(shared.float().dtype)    # convert before feeding a model
```

:::exercise Build a grid of coordinates
Create `xs`, a float32 tensor of 6 evenly spaced values from -1 to 1 (both included), and `idx`, the int64 tensor `[0, 2, 4, 6, 8]` made with `torch.arange`. Then make `grid`, a 2 × 6 tensor whose first row is all zeros and second row is all ones, using `torch.zeros_like` and `torch.ones_like` on `xs` and joining them with `torch.stack([row1, row2])`.
```python starter
import torch

xs = None
idx = None
grid = None
print(xs, idx, grid, sep="\n")
```
```python check
import torch
xs = need("xs", torch.Tensor)
same(xs, torch.tensor([-1.0, -0.6, -0.2, 0.2, 0.6, 1.0]), "xs", ignore_dtype=False)
idx = need("idx", torch.Tensor)
same(idx, torch.tensor([0, 2, 4, 6, 8]), "idx", ignore_dtype=False)
assert uses("arange"), "Make idx with torch.arange (start, end, step)."
assert uses("linspace"), "Make xs with torch.linspace."
grid = need("grid", torch.Tensor)
same(grid, torch.tensor([[0.0] * 6, [1.0] * 6]), "grid", ignore_dtype=False)
assert uses("zeros_like") and uses("ones_like"), "Build the rows with torch.zeros_like(xs) and torch.ones_like(xs)."
```
```python solution
import torch

xs = torch.linspace(-1, 1, 6)
idx = torch.arange(0, 10, 2)
grid = torch.stack([torch.zeros_like(xs), torch.ones_like(xs)])
print(xs, idx, grid, sep="\n")
```
hint: `torch.linspace(start, end, steps)` includes both ends; you need 6 steps.
hint: `torch.arange(start, end, step)` excludes the end, so to include 8 the end must be bigger than 8.
hint: `torch.zeros_like(xs)` has xs's shape and dtype; `torch.stack([a, b])` puts the two rows on top of each other.
approach:
1. **Understand:** three tensors, each from a different creation function.
2. **Examples:** `linspace(0, 1, 3)` → 0, 0.5, 1; `arange(0, 6, 2)` → 0, 2, 4.
3. **Brute force:** typing the values with `torch.tensor` works but the checks want the functions.
4. **Pattern:** **ranges** (end excluded for arange, included for linspace) and **_like** helpers.
5. **Plan:** linspace for xs, arange with step 2 for idx, stack two _like rows.
6. **Code and test:** check `idx.dtype` is int64 and `xs.dtype` float32.
walkthrough:
**Line by line**

- `torch.linspace(-1, 1, 6)`: the step is (1 − (−1)) / 5 = 0.4, giving −1, −0.6, −0.2, 0.2, 0.6, 1 as float32.
- `torch.arange(0, 10, 2)`: 0, 2, 4, 6, 8 (10 is excluded). All arguments are ints, so the dtype is int64. `torch.arange(0, 9, 2)` works too.
- `torch.zeros_like(xs)` and `torch.ones_like(xs)` copy xs's shape `[6]`, dtype and device. `torch.stack` adds a new first dimension: shape `[2, 6]`.

**Common wrong approach:** `torch.arange(0, 8, 2)`, which stops at 6 because the end is excluded.
:::

:::exercise Reproducible dice
Write `roll_dice(n, seed)` that returns a tensor of `n` dice rolls (whole numbers from 1 to 6) that is the same every time it's called with the same seed. Use a **local** `torch.Generator` seeded with `seed`, so calling your function doesn't change the global random numbers.
```python starter
import torch

def roll_dice(n, seed):
    pass

print(roll_dice(10, seed=1))
print(roll_dice(10, seed=1))
```
```python check
import torch
fn = need("roll_dice")
a = fn(500, seed=3)
assert isinstance(a, torch.Tensor), f"roll_dice should return a tensor, got {type(a).__name__}."
assert a.shape == (500,), f"roll_dice(500, ...) should have shape [500], got {list(a.shape)}."
assert a.dtype == torch.int64, f"The rolls should be int64 (from randint), got {a.dtype}."
assert int(a.min()) == 1 and int(a.max()) == 6, f"Rolls should go from 1 to 6, got {int(a.min())} to {int(a.max())}. Remember randint's high is excluded."
assert torch.equal(a, fn(500, seed=3)), "The same seed should give the same rolls."
assert not torch.equal(a, fn(500, seed=4)), "Different seeds should give different rolls."
torch.manual_seed(0); before = torch.rand(3)
torch.manual_seed(0); fn(20, seed=9); after = torch.rand(3)
assert torch.equal(before, after), "roll_dice changed the global random numbers: pass generator= to randint instead of calling torch.manual_seed."
```
```python solution
import torch

def roll_dice(n, seed):
    g = torch.Generator().manual_seed(seed)
    return torch.randint(1, 7, (n,), generator=g)

print(roll_dice(10, seed=1))
print(roll_dice(10, seed=1))
```
hint: `torch.randint(low, high, size)` excludes `high`, so dice need `low=1, high=7`.
hint: The size is a tuple: `(n,)`.
hint: `g = torch.Generator().manual_seed(seed)`, then pass `generator=g` to `randint`.
approach:
1. **Understand:** random but repeatable, without side effects on the global generator.
2. **Examples:** two calls with seed 1 print identical tensors.
3. **Brute force:** `torch.manual_seed(seed)` inside the function gives repeatable rolls, but resets everyone else's random numbers too.
4. **Pattern:** a **local generator** passed with `generator=`.
5. **Plan:** create and seed a Generator, call randint with it.
6. **Code and test:** check min is 1, max is 6, and the global sequence is unchanged.
walkthrough:
**Line by line**

- `torch.Generator()` makes an independent random number generator for the CPU; `.manual_seed(seed)` seeds it and returns it, so the two can be chained.
- `torch.randint(1, 7, (n,), generator=g)` draws n integers from 1 to 6 using that generator only.

**Why not torch.manual_seed?** It works for repeatability, but it resets the default generator that the rest of the program uses: code that called your function would suddenly get the same "random" numbers after every call. Libraries use local generators (DataLoader's `generator=` argument in Part 3 is the same idea).

**Common wrong approach:** `torch.randint(1, 6, ...)`: 6 can never appear, because `high` is excluded.
:::

:::quiz
? Which call creates `tensor([0, 2, 4, 6])`?
+ `torch.arange(0, 8, 2)`
- `torch.arange(0, 6, 2)`
- `torch.linspace(0, 6, 3)`
- `torch.randint(0, 8, (4,))`
= arange excludes the end, so the end must be past 6. linspace(0, 6, 3) gives 0, 3, 6 as floats.
? What is the dtype of `torch.tensor([1, 2, 3.0])`?
+ `torch.float32`
- `torch.int64`
- `torch.float64`
- It raises an error because the types are mixed
= One float makes the whole tensor floating point, using the default dtype, float32 (unlike NumPy, which would choose float64).
? `arr = np.zeros(3); t = torch.from_numpy(arr); arr[0] = 5`. What is `t[0]`?
+ `tensor(5., dtype=torch.float64)`
- `tensor(0., dtype=torch.float64)`
- `tensor(5.)`
- It raises an error
= from_numpy shares memory with the array, and keeps NumPy's float64 dtype, which the repr shows because it isn't the default.
? You call `torch.manual_seed(7)` and then `torch.rand(2)` twice, getting `a` and `b`. Which statement is true?
+ `a` and `b` differ, but the pair is the same on every run of the program
- `a` and `b` are equal
- `a` and `b` differ on every run of the program
- `torch.rand` ignores the seed
= Seeding fixes the whole sequence of draws. The second call continues the sequence, so it differs from the first.
? Which function returns integers where `high` is excluded?
+ `torch.randint(low, high, size)`
- `torch.linspace(low, high, steps)`
- `torch.full(size, high)`
- `torch.rand(size) * high`
= Like Python's range, randint's upper bound is exclusive.
:::

@@@ lesson
id: dtypes
title: Data types and precision
minutes: 20
summary: The dtypes you'll meet (float32, float64, float16, bfloat16, int64, int32, uint8, bool), the default dtype, how PyTorch picks a result's dtype (type promotion), converting with .to and .float(), what precision and range mean for float16 and bfloat16, memory per element, and the dtype errors you'll see.
---
Every tensor has one **dtype** for all its elements. It decides what values fit, how precise they are and how much memory they take.

| dtype | Aliases | Bytes | Used for |
|---|---|---|---|
| `torch.float32` | `torch.float` | 4 | the default for model weights and inputs |
| `torch.float64` | `torch.double` | 8 | scientific code; NumPy's default float |
| `torch.float16` | `torch.half` | 2 | mixed-precision training and inference on GPUs |
| `torch.bfloat16` | | 2 | mixed precision on newer GPUs and TPUs; same range as float32 |
| `torch.int64` | `torch.long` | 8 | class labels, indexes, counts |
| `torch.int32` | `torch.int` | 4 | smaller integers |
| `torch.uint8` | | 1 | raw image pixels (0–255) |
| `torch.bool` | | 1 | masks: results of comparisons |

```python
import torch

print(torch.float is torch.float32, torch.long is torch.int64)
print(torch.get_default_dtype())
x = torch.zeros(1000)
print(x.dtype, x.element_size(), x.nbytes)               # 4 bytes per float32
print(torch.zeros(1000, dtype=torch.float16).nbytes)     # half the memory
```

### How printing shows the dtype

A tensor's printout adds `dtype=` only when the dtype isn't one PyTorch would infer anyway: float32 (the default), int64 and bool are left out.

```python
import torch

print(torch.tensor([1.0, 2.0]))
print(torch.tensor([1.0, 2.0], dtype=torch.float64))
print(torch.tensor([1, 2]))
print(torch.tensor([1, 2], dtype=torch.int32))
print(torch.tensor([1.0, 2.0], dtype=torch.bfloat16))
```

### Converting

`.to(dtype)` returns a converted copy (or the same tensor if nothing changes). The short methods `.float()`, `.double()`, `.half()`, `.bfloat16()`, `.long()`, `.int()` and `.bool()` do the same. Converting float to int **truncates toward zero**; it doesn't round.

```python
import torch

x = torch.tensor([1.7, -1.7, 2.5])
print(x.long())                  # truncates toward zero
print(x.round())                 # rounds half to even: 2.5 -> 2
print(x.to(torch.int32))
print(torch.tensor([0, 3, 0]).bool())
print(torch.tensor([300]).to(torch.uint8))   # wraps around: 300 - 256
```

### Type promotion: the dtype of a result

When an operation mixes dtypes, PyTorch picks the result's dtype in **categories**: bool < integer < floating point < complex.

1. A tensor with dimensions decides within its category, but a higher category wins: int64 tensor + float32 tensor is float32.
2. A **Python number** or a **0-dimensional tensor** can raise the category but never the size. int tensor + `1.5` gives the **default float** (float32), not float64; a float16 tensor + `1.0` stays float16.
3. **True division** `/` always gives a float, even for two ints. `//` keeps ints.

```python
import torch

ints = torch.tensor([1, 2, 3])
print((ints + 1).dtype)                   # stays int64
print((ints + 1.5).dtype)                 # float category: default float32
print((ints / 2))                         # / always gives floats
print((ints // 2))                        # floor division keeps int64
half = torch.tensor([1.0, 2.0], dtype=torch.float16)
print((half + 1.0).dtype)                 # a Python float doesn't upcast
print((half + torch.tensor([1.0, 2.0])).dtype)   # a float32 tensor does
print(torch.promote_types(torch.int32, torch.float16))
```

In-place operations (`+=`, `.add_()`) can't change a tensor's dtype, so adding a float to an int tensor in place is an error:

```python error
import torch

counts = torch.tensor([1, 2, 3])
counts += 0.5
```

### Precision and range: float32, float16 and bfloat16

A floating-point number stores a sign, an **exponent** (which sets the **range**: how big or small a value can be) and a **mantissa** (which sets the **precision**: how many significant digits).

![Bit layouts: float32 has 1 sign bit, 8 exponent bits and 23 mantissa bits (range about ±3.4e38, about 7 digits); bfloat16 has 1, 8 and 7 (same range, 2 to 3 digits); float16 has 1, 5 and 10 (range ±65504, about 3 digits)](figures/float-formats.svg)

- **float16** keeps more precision than bfloat16 but has a tiny range: anything over 65504 becomes `inf`, and very small gradients underflow to 0. Training in float16 needs **loss scaling** (Part 5).
- **bfloat16** ("brain float") keeps float32's 8 exponent bits, so it has the same range and rarely overflows, at the cost of precision. It's the usual choice for mixed-precision training on modern GPUs.
- Both halve memory and speed up maths on GPUs with tensor cores, which is why Part 5 uses them.

```python
import torch

third = torch.tensor(1 / 3)
print(third.item())
print(third.half().item())
print(third.bfloat16().item())
print(torch.tensor([70000.0]).half())      # past float16's maximum
print(torch.tensor([70000.0]).bfloat16())  # bfloat16 has the range, less precision
print(torch.finfo(torch.float16).max, torch.finfo(torch.bfloat16).max)
```

`torch.finfo(dtype)` tells you a float type's limits (`max`, `eps`, `tiny`), and `torch.iinfo(dtype)` an integer type's.

### Float comparisons

Floating-point maths rounds, so test closeness, not equality: `torch.allclose(a, b)` (one True/False for the whole tensor) or `torch.isclose(a, b)` (element by element). `torch.equal(a, b)` is exact: same shape and same values.

```python
import torch

a = torch.tensor([0.1 + 0.2])
b = torch.tensor([0.3])
print(a == b)
print(torch.allclose(a, b))
print(torch.equal(torch.tensor([1, 2]), torch.tensor([1, 2])))
```

:::exercise Prepare pixels for a model
`pixels` is a uint8 tensor of raw image values (0–255). Make `scaled`: the same values as float32 between 0 and 1 (divide by 255). Then make `as_half`: `scaled` converted to float16, and `saved_bytes`: how many bytes `as_half` saves compared with `scaled` (a Python int).
```python starter
import torch

pixels = torch.tensor([[0, 64, 128], [192, 255, 32]], dtype=torch.uint8)
scaled = None
as_half = None
saved_bytes = None
print(scaled, as_half, saved_bytes, sep="\n")
```
```python check
import torch
pixels = torch.tensor([[0, 64, 128], [192, 255, 32]], dtype=torch.uint8)
sc = need("scaled", torch.Tensor)
same(sc, pixels.float() / 255, "scaled", ignore_dtype=False)
h = need("as_half", torch.Tensor)
assert h.dtype == torch.float16, f"as_half should be float16, got {h.dtype}."
same(h.float(), (pixels.float() / 255).half().float(), "as_half")
sb = need("saved_bytes")
assert not isinstance(sb, torch.Tensor) and sb == 12, f"saved_bytes should be 12 (6 elements × 2 bytes saved), got {sb!r}."
```
```python solution
import torch

pixels = torch.tensor([[0, 64, 128], [192, 255, 32]], dtype=torch.uint8)
scaled = pixels.float() / 255
as_half = scaled.half()
saved_bytes = scaled.nbytes - as_half.nbytes
print(scaled, as_half, saved_bytes, sep="\n")
```
hint: `/` already gives floats, but convert explicitly with `.float()` so the result is float32 whatever the input.
hint: `.half()` (or `.to(torch.float16)`) converts to float16.
hint: `.nbytes` is `numel() × element_size()`: 6 × 4 for float32, 6 × 2 for float16.
approach:
1. **Understand:** convert dtype, scale, convert again, and measure memory.
2. **Examples:** 255 → 1.0, 128 → 0.502.
3. **Brute force:** compute bytes as 6 × 4 − 6 × 2 by hand; better to ask the tensors.
4. **Pattern:** **explicit conversion** before arithmetic, and **nbytes** for memory.
5. **Plan:** `pixels.float() / 255`; `.half()`; subtract nbytes.
6. **Code and test:** print dtypes and the saving.
walkthrough:
**Line by line**

- `pixels.float()` converts uint8 to float32 so the division keeps fractions; dividing by 255 maps 0–255 to 0–1. (This is what torchvision's `ToDtype(torch.float32, scale=True)` does, Part 3.)
- `scaled.half()` rounds every value to float16's 10-bit mantissa: 64/255 = 0.25098 becomes 0.25098 ≈ 0.2510 (close, not identical).
- `scaled.nbytes` is 24 and `as_half.nbytes` is 12, so `saved_bytes` is 12: half the memory, which is why large models are stored in 16-bit types.

**Common wrong approach:** dividing a uint8 tensor with `//`, which gives integers 0 or 1.
:::

:::exercise Predict the dtype
Fill in `answers`, a dict mapping each expression (as written in the starter) to the dtype you expect, like `torch.float32`. Predict first, then run the expressions to check yourself.
```python starter
import torch

i64 = torch.tensor([1, 2])
f32 = torch.tensor([1.0, 2.0])
f16 = torch.tensor([1.0, 2.0], dtype=torch.float16)
answers = {
    "i64 + 1": None,
    "i64 / 1": None,
    "i64 * 2.0": None,
    "f16 * 2.0": None,
    "f16 + f32": None,
    "i64 > 1": None,
    "f32.sum()": None,
    "i64.sum()": None,
}
```
```python check
import torch
ans = need("answers", dict)
i64 = torch.tensor([1, 2]); f32 = torch.tensor([1.0, 2.0]); f16 = torch.tensor([1.0, 2.0], dtype=torch.float16)
truth = {k: eval(k).dtype for k in ["i64 + 1", "i64 / 1", "i64 * 2.0", "f16 * 2.0", "f16 + f32", "i64 > 1", "f32.sum()", "i64.sum()"]}
for k, v in truth.items():
    assert k in ans, f"Keep the key {k!r} in answers."
    assert ans[k] is not None, f"Fill in a dtype for {k!r}."
    assert ans[k] == v, f"{k}: not {ans[k]}. Think about the promotion rules again (or run it)."
```
```python solution
import torch

answers = {
    "i64 + 1": torch.int64,       # int with an int: no change
    "i64 / 1": torch.float32,     # true division always gives a float (the default float)
    "i64 * 2.0": torch.float32,   # a Python float lifts the category to float, at the default size
    "f16 * 2.0": torch.float16,   # same category: a Python number never upcasts
    "f16 + f32": torch.float32,   # two tensors with dims: the bigger float wins
    "i64 > 1": torch.bool,        # comparisons give bool
    "f32.sum()": torch.float32,
    "i64.sum()": torch.int64,     # integer sums are int64
}
```
hint: Comparisons always return `torch.bool`.
hint: A Python number can move the result up a category (int → float) but uses the *default* size for it, and never makes a float16 tensor bigger.
hint: `/` is true division and always returns a floating-point dtype.
approach:
1. **Understand:** apply the promotion rules: category first, then size, with Python numbers counting only for category.
2. **Examples:** `torch.tensor([1]) + 1.5` → float32.
3. **Brute force:** run each one: fine for checking, but the exam won't let you.
4. **Pattern:** **category rule**: bool < int < float < complex; tensors with dims decide the size.
5. **Plan:** go line by line and write the dtype.
6. **Code and test:** press Check; a wrong answer names the expression.
walkthrough:
**The rules applied**

| Expression | Why |
|---|---|
| `i64 + 1` | both integers; the tensor's int64 decides |
| `i64 / 1` | `/` promotes integers to the default float, float32 |
| `i64 * 2.0` | a Python float raises the category to float, using the default float32 (not float64) |
| `f16 * 2.0` | already float; a Python number doesn't change the size |
| `f16 + f32` | two tensors with dimensions: float16 and float32 promote to float32 |
| `i64 > 1` | comparison: bool |
| `f32.sum()` | sums keep floating dtypes |
| `i64.sum()` | integer (and bool) sums are int64 |

**Common wrong approach:** expecting `i64 * 2.0` to be float64 because a Python float is a 64-bit double. PyTorch deliberately uses the default dtype so that Python numbers don't silently double your memory.
:::

:::quiz
? What is the dtype of `torch.tensor([1, 2]) / torch.tensor([2, 2])`?
+ `torch.float32`
- `torch.int64`
- `torch.float64`
- `torch.int32`
= True division always returns a floating-point result; for integer inputs that's the default dtype, float32.
? Why is bfloat16 often preferred over float16 for training?
+ It has the same exponent range as float32, so values rarely overflow or underflow
- It is more precise than float16
- It uses less memory than float16
- It is the only 16-bit type GPUs support
= bfloat16 trades mantissa bits (precision) for float32's 8 exponent bits (range). Both use 2 bytes.
? `x = torch.tensor([2.9, -2.9])`. What does `x.long()` return?
+ `tensor([ 2, -2])`
- `tensor([ 3, -3])`
- `tensor([ 2, -3])`
- `tensor([ 3, -2])`
= Converting to an integer dtype truncates toward zero.
? `h = torch.ones(3, dtype=torch.float16)`. What is `(h * 3.0).dtype`?
+ `torch.float16`
- `torch.float32`
- `torch.float64`
- `torch.int64`
= A Python scalar can only raise the category (int → float), never the size within a category.
? Which check is the right way to compare two float tensors computed in different ways?
+ `torch.allclose(a, b)`
- `torch.equal(a, b)`
- `a == b`
- `a is b`
= Rounding makes exact float equality unreliable; allclose compares within a tolerance (rtol=1e-05, atol=1e-08 by default).
:::

@@@ lesson
id: indexing-and-views
title: Indexing, slicing and views
minutes: 20
summary: Reading elements, rows, columns and sub-blocks with integers and slices, negative indexes and ..., boolean masks and index tensors, writing through indexes, which results are views that share memory and which are copies, clone and detach, item and tolist, and converting to NumPy.
---
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

### Boolean masks and index tensors

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

### Views share memory

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

![One block of memory 0 to 5. a = torch.arange(6).view(2, 3) and t = a.t() both point to it with different strides; c = a.clone() has its own memory. Views share memory, so a[0, 0] = 9 changes t[0, 0] too](figures/view-storage.svg)

Views make slicing free (no copying), which is why PyTorch uses them. Use `.clone()` when you need a copy you can change safely. `.detach()` (Part 2) is different: it returns a view outside autograd's records, still sharing memory.

### Back to Python and NumPy

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

```python error
import torch

t = torch.tensor([1.5, 2.5])
print(t.item())           # two elements: which one?
```

The same goes for `if`: `if t > 0:` works for a one-element tensor, but for several elements Python can't know whether you mean "any" or "all", so it raises `Boolean value of Tensor with more than one value is ambiguous`. Write `if (t > 0).all():` or `.any()`.

:::exercise Clean the readings
`readings` holds sensor values where `-1` means "missing". Without loops, make: `valid`, a 1-D tensor of only the non-missing values; `n_missing`, the number of missing readings as a Python int; and `filled`, a **copy** of `readings` where missing values are replaced by the mean of the valid ones (`readings` itself must stay unchanged).
```python starter
import torch

readings = torch.tensor([[2.0, -1.0, 4.0], [6.0, 8.0, -1.0]])
valid = None
n_missing = None
filled = None
print(valid, n_missing, filled, readings, sep="\n")
```
```python check
import torch
r0 = torch.tensor([[2.0, -1.0, 4.0], [6.0, 8.0, -1.0]])
r = need("readings", torch.Tensor)
assert torch.equal(r, r0), "readings changed: work on a .clone() for filled."
same(need("valid", torch.Tensor), torch.tensor([2.0, 4.0, 6.0, 8.0]), "valid")
nm = need("n_missing")
assert not isinstance(nm, torch.Tensor) and nm == 2, f"n_missing should be the Python int 2, got {nm!r}."
same(need("filled", torch.Tensor), torch.tensor([[2.0, 5.0, 4.0], [6.0, 8.0, 5.0]]), "filled")
assert not uses("for "), "Solve it without a loop: use masks."
```
```python solution
import torch

readings = torch.tensor([[2.0, -1.0, 4.0], [6.0, 8.0, -1.0]])
missing = readings == -1
valid = readings[~missing]
n_missing = missing.sum().item()
filled = readings.clone()
filled[missing] = valid.mean()
print(valid, n_missing, filled, readings, sep="\n")
```
hint: `missing = readings == -1` is a bool mask; `~missing` flips it.
hint: Summing a bool tensor counts the Trues; `.item()` makes it a Python int.
hint: `filled = readings.clone()` first, then assign through the mask: `filled[missing] = valid.mean()`.
approach:
1. **Understand:** mask the missing values, use the rest, and fill a copy.
2. **Examples:** valid values 2, 4, 6, 8 have mean 5, so both −1s become 5.
3. **Brute force:** loops over rows and columns; masks do it in one step each.
4. **Pattern:** **boolean masks** for reading and writing, **clone** to protect the original.
5. **Plan:** build the mask, index with `~mask`, count with `.sum()`, clone, assign.
6. **Code and test:** print `readings` at the end to confirm it's unchanged.
walkthrough:
**Line by line**

- `readings == -1` compares every element, giving a bool tensor of shape `[2, 3]`.
- `readings[~missing]` keeps the True positions of the flipped mask, flattened into a 1-D tensor: `tensor([2., 4., 6., 8.])`.
- `missing.sum()` adds True as 1: `tensor(2)` (int64). `.item()` gives `2`.
- `readings.clone()` copies the memory. Without it, `filled = readings` would just be a second name for the same tensor, and the assignment would change `readings` too.
- `filled[missing] = valid.mean()` writes the 0-D mean, 5.0, into every masked position.

**Common wrong approach:** `filled = readings` followed by the masked assignment: the original data is overwritten.
:::

:::exercise Pick the top row per column
`scores` has one row per model and one column per test. Write `best_scores(scores)` returning a 1-D tensor with, for each column, the score in the row whose **first column** is largest. (So: find the row with the best first test, and return that whole row.) Then write `first_and_last(scores)` returning a tensor of shape `[2, n_columns]` holding the first and last rows, using one index list.
```python starter
import torch

def best_scores(scores):
    pass

def first_and_last(scores):
    pass

s = torch.tensor([[0.7, 0.2, 0.9], [0.8, 0.1, 0.4], [0.5, 0.6, 0.3]])
print(best_scores(s))       # tensor([0.8000, 0.1000, 0.4000])
print(first_and_last(s))
```
```python check
import torch
bs = need("best_scores"); fl = need("first_and_last")
s = torch.tensor([[0.7, 0.2, 0.9], [0.8, 0.1, 0.4], [0.5, 0.6, 0.3]])
same(bs(s), torch.tensor([0.8, 0.1, 0.4]), "best_scores(s)")
s2 = torch.tensor([[1.0, 5.0], [9.0, 2.0], [3.0, 3.0], [0.0, 7.0]])
same(bs(s2), torch.tensor([9.0, 2.0]), "best_scores on a 4 × 2 tensor")
same(fl(s), torch.tensor([[0.7, 0.2, 0.9], [0.5, 0.6, 0.3]]), "first_and_last(s)")
same(fl(s2), torch.tensor([[1.0, 5.0], [0.0, 7.0]]), "first_and_last on a 4 × 2 tensor")
same(fl(torch.tensor([[4.0, 4.0]])), torch.tensor([[4.0, 4.0], [4.0, 4.0]]), "first_and_last with one row")
```
```python solution
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
hint: `scores[:, 0]` is the first column; `.argmax()` gives the index of its largest value.
hint: A 0-D integer tensor works as an index: `scores[best_row]`.
hint: A list of indexes picks several rows at once: `scores[[0, -1]]`.
approach:
1. **Understand:** one function selects a row by a rule, the other selects two fixed rows.
2. **Examples:** first column 0.7, 0.8, 0.5 → row 1 is best.
3. **Brute force:** loop over rows comparing first values.
4. **Pattern:** **argmax then index**, and **index lists** for several positions.
5. **Plan:** column slice → argmax → row; list index `[0, -1]`.
6. **Code and test:** a single-row tensor returns that row twice.
walkthrough:
**Line by line**

- `scores[:, 0]`: all rows, column 0, shape `[n_rows]`.
- `.argmax()` returns the position of the maximum as a 0-D int64 tensor (the first one if there's a tie).
- `scores[best_row]` uses it as an integer index: one row, shape `[n_columns]`.
- `scores[[0, -1]]` is "advanced" indexing with a list: it copies rows 0 and −1 into a new `[2, n_columns]` tensor (with one row, both are row 0).

**Common wrong approach:** `scores.argmax()` with no dim: it returns the position in the *flattened* tensor (here 2, the 0.9), not a row number.
:::

:::quiz
? `x = torch.arange(24).reshape(2, 3, 4)`. What is `x[1, :, 2].shape`?
+ `torch.Size([3])`
- `torch.Size([1, 3, 1])`
- `torch.Size([2, 3])`
- `torch.Size([3, 1])`
= Each integer index removes its dimension; the slice keeps the middle one of size 3.
? `a = torch.zeros(3); b = a[1:]; b += 1`. What is `a`?
+ `tensor([0., 1., 1.])`
- `tensor([0., 0., 0.])`
- `tensor([1., 1., 1.])`
- It raises an error
= Slicing returns a view, so the in-place add writes into a's memory.
? Which operation returns a tensor that does NOT share memory with `x`?
+ `x[x > 0]`
- `x[1:3]`
- `x.view(-1)`
- `x.t()`
= Boolean-mask (and index-tensor) indexing copies the selected elements; slicing, view and t() return views.
? `t = torch.tensor([3.0, 4.0])`. Which line raises an error?
+ `if t > 2: print("big")`
- `if (t > 2).all(): print("big")`
- `print(t.tolist())`
- `print(t.sum().item())`
= A two-element bool tensor has no single truth value; reduce it with .all() or .any() first.
? How do you get the value of the 0-D tensor `loss` as a Python float?
+ `loss.item()`
- `loss.numpy()`
- `float(loss.tolist()[0])`
- `loss.data`
= .item() converts a one-element tensor to a Python number. (float(loss) works too.)
:::

@@@ lesson
id: reshaping
title: Reshaping, joining and splitting
minutes: 20
summary: Changing a tensor's shape with view and reshape (and -1), strides and contiguous memory, adding and removing size-1 dimensions with unsqueeze and squeeze, reordering dimensions with permute and transpose, flatten, and joining and splitting tensors with cat, stack, split and chunk.
---
Models are picky about shapes: a linear layer wants `[batch, features]`, an image model wants `[batch, channels, height, width]`. Reshaping is how you get data into the shape the next step expects. None of these operations change the **values**, only how they're arranged.

### view and reshape

Both take the new shape; the number of elements must stay the same. One size can be `-1`, meaning "whatever makes the count work".

```python
import torch

x = torch.arange(6)
print(x.view(2, 3))
print(x.reshape(3, 2))
print(x.view(-1, 2).shape)       # -1 is worked out: 6 / 2 = 3
print(x.reshape(1, -1).shape)
```

```python error
import torch

x = torch.arange(6)
print(x.view(4, 2))              # 8 slots for 6 numbers
```

### Strides and contiguous memory

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

```python error
import torch

t = torch.arange(6).view(2, 3).t()
print(t.view(6))
```

Rule of thumb: use `reshape` unless you specifically need a guaranteed view (sharing memory), in which case `view` tells you loudly when it can't.

### Adding and removing size-1 dimensions

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

### Reordering dimensions: permute and transpose

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

### Joining: cat versus stack

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

```python error
import torch

print(torch.cat([torch.zeros(2, 3), torch.zeros(2, 4)], dim=0))
```

### Splitting: split, chunk and unbind

```python
import torch

x = torch.arange(10)
print(x.split(4))                  # pieces of size 4 (the last is smaller)
print(x.split([2, 8]))             # exact sizes
print(x.chunk(3))                  # 3 pieces, as equal as possible
print(torch.arange(6).view(2, 3).unbind(0))   # remove a dim: one tensor per row
```

The pieces are views of the original.

:::exercise Images into a batch
`images` is a list of 4 images, each a tensor of shape `[28, 28, 3]` (height, width, channels). Write `to_batch(images)` returning one tensor of shape `[4, 3, 28, 28]`: a batch in PyTorch's channels-first layout. Then write `flat_features(batch)` returning a `[batch, features]` tensor that keeps the first dimension and flattens everything else.
```python starter
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
```python check
import torch
tb = need("to_batch"); ff = need("flat_features")
torch.manual_seed(1)
imgs = [torch.rand(5, 7, 3) for _ in range(2)]
b = tb(imgs)
assert isinstance(b, torch.Tensor), "to_batch should return one tensor."
assert b.shape == (2, 3, 5, 7), f"to_batch on two 5×7×3 images should give [2, 3, 5, 7], got {list(b.shape)}. Height and width must stay in order: permute(2, 0, 1)."
same(b[1, 2], imgs[1][:, :, 2], "channel 2 of image 1")
same(b[0, 0, 4], imgs[0][4, :, 0], "row 4 of channel 0 in image 0")
f = ff(b)
assert f.shape == (2, 105), f"flat_features should give [2, 105], got {list(f.shape)}."
same(f[1], b[1].reshape(-1), "the features of image 1")
same(ff(torch.zeros(1, 2, 2, 2)), torch.zeros(1, 8), "a batch of one")
```
```python solution
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
hint: Each image needs its channels moved first: `img.permute(2, 0, 1)` gives `[3, 28, 28]`.
hint: `torch.stack(list_of_tensors)` adds the batch dimension in front.
hint: `batch.flatten(1)` (or `batch.reshape(batch.shape[0], -1)`) keeps dim 0.
approach:
1. **Understand:** two shape changes: reorder each image's dims, then add a batch dim; then flatten all but the batch.
2. **Examples:** `[28, 28, 3]` → `[3, 28, 28]` → stacked `[4, 3, 28, 28]` → `[4, 2352]`.
3. **Brute force:** stack first to `[4, 28, 28, 3]`, then `permute(0, 3, 1, 2)`: also correct.
4. **Pattern:** **permute** to reorder, **stack** for a new dim, **flatten(1)** for features.
5. **Plan:** permute in a list comprehension, stack, flatten.
6. **Code and test:** a batch of one must keep its batch dimension.
walkthrough:
**Line by line**

- `img.permute(2, 0, 1)` says: new dim 0 is old dim 2 (channels), then old dims 0 and 1 (height, width). It's a view, no copy.
- `torch.stack([...])` creates a new dim 0 of size 4; every image must have exactly the same shape.
- `batch.flatten(1)` merges dims 1 to the end: 3 × 28 × 28 = 2352 features per image.

**Common wrong approach:** `img.reshape(3, 28, 28)`. It has the right shape but the wrong arrangement: reshape refills the same values in memory order, mixing pixels from different channels. Use `permute` to move dimensions, `reshape`/`view` to regroup them.
:::

:::exercise Split a dataset
Write `train_val_split(data, n_val)` that returns two tensors: the training rows (everything except the last `n_val` rows) and the validation rows (the last `n_val`). Then write `add_bias_column(x)` that returns `x` with an extra column of ones on the right, using `torch.cat`.
```python starter
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
```python check
import torch
tvs = need("train_val_split"); abc = need("add_bias_column")
data = torch.arange(20.).reshape(10, 2)
tr, va = tvs(data, 3)
same(tr, data[:7], "train rows"); same(va, data[7:], "validation rows")
tr, va = tvs(torch.arange(12.).reshape(4, 3), 1)
same(tr, torch.arange(9.).reshape(3, 3), "train rows (4 × 3, n_val=1)"); same(va, torch.tensor([[9., 10., 11.]]), "validation rows (4 × 3, n_val=1)")
same(abc(torch.tensor([[2., 3.], [4., 5.]])), torch.tensor([[2., 3., 1.], [4., 5., 1.]]), "add_bias_column")
same(abc(torch.zeros(3, 1)), torch.tensor([[0., 1.], [0., 1.], [0., 1.]]), "add_bias_column on a single column")
assert uses("cat"), "Use torch.cat to join the column."
```
```python solution
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
hint: Slicing works: `data[:-n_val]` and `data[-n_val:]`. Or `data.split([n_train, n_val])`.
hint: The column of ones needs shape `[rows, 1]` so that `cat` along dim 1 lines up.
hint: `torch.cat([x, ones], dim=1)`; give `ones` the same dtype as `x`.
approach:
1. **Understand:** split rows into two groups; append a column.
2. **Examples:** 10 rows, n_val=3 → 7 and 3 rows.
3. **Brute force:** loop and append rows to lists, then stack: slow and long.
4. **Pattern:** **split by sizes** (or slicing) and **cat along dim 1** for columns.
5. **Plan:** `split([n - n_val, n_val])`; make a `[rows, 1]` tensor of ones; cat.
6. **Code and test:** check a single-column input.
walkthrough:
**Line by line**

- `data.split([len(data) - n_val, n_val])` splits along dim 0 into exactly those sizes and returns a tuple of two views. (`len(t)` is the size of dim 0.)
- `torch.ones(x.shape[0], 1, dtype=x.dtype)` is a column with one row per row of x.
- `torch.cat([x, ones], dim=1)` joins side by side: shapes `[r, c]` and `[r, 1]` give `[r, c + 1]`.

**Common wrong approach:** `torch.ones(x.shape[0])` (shape `[r]`, 1-D): `cat` refuses because the tensors have different numbers of dimensions. `torch.stack` would also be wrong: it adds a new dimension instead of a column.
:::

:::quiz
? `x = torch.zeros(4, 6)`. Which call raises an error?
+ `x.view(5, -1)`
- `x.view(-1)`
- `x.reshape(3, 8)`
- `x.view(2, 3, 4)`
= 24 elements can't be split into rows of 5. Every other shape multiplies to 24.
? `x = torch.rand(2, 3, 4)`. What is `x.permute(2, 0, 1).shape`?
+ `torch.Size([4, 2, 3])`
- `torch.Size([3, 4, 2])`
- `torch.Size([2, 4, 3])`
- `torch.Size([4, 3, 2])`
= New dim i is old dim dims[i]: old dim 2 (size 4), then 0 (size 2), then 1 (size 3).
? Why does `x.t().view(-1)` raise an error when `x` is 2 × 3?
+ The transpose is not contiguous in memory, and view never copies
- view can't take -1
- Transposed tensors can't be reshaped at all
- view only works on 1-D tensors
= Use .reshape(-1) or .contiguous().view(-1).
? `a` and `b` both have shape `[5, 3]`. What are the shapes of `torch.cat([a, b])` and `torch.stack([a, b])`?
+ `[10, 3]` and `[2, 5, 3]`
- `[2, 5, 3]` and `[10, 3]`
- `[5, 6]` and `[2, 5, 3]`
- `[10, 3]` and `[5, 3, 2]`
= cat joins along an existing dim (0 by default); stack adds a new dim (0 by default).
? `x` has shape `[1, 10, 1]`. What is `x.squeeze(1).shape`?
+ `torch.Size([1, 10, 1])`
- `torch.Size([10])`
- `torch.Size([1, 1])`
- It raises an error
= squeeze(dim) only removes that dim when its size is 1; dim 1 has size 10, so nothing changes.
:::

@@@ lesson
id: tensor-math
title: Tensor maths and broadcasting
minutes: 25
summary: Element-wise arithmetic and functions, broadcasting rules for tensors of different shapes, matrix multiplication with @ (matmul, mm, bmm), reductions along a dim with keepdim, argmax and max with indices, softmax along a dim, and in-place operations with a trailing underscore.
---
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

### Broadcasting

When shapes differ, PyTorch **broadcasts**: it stretches size-1 dimensions (without copying memory) so the shapes match. Compare the shapes **from the right**: each pair of sizes must be **equal**, or one of them **1**; a missing dimension counts as 1.

![a of shape [3, 1] with values 0, 10, 20, plus b of shape [4] with values 0 to 3, gives a result of shape [3, 4] with values 0 to 23. A table lines up the shapes from the right: dim -1 is 1 and 4, giving 4; dim -2 is 3 and missing, giving 3](figures/broadcasting.svg)

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

```python error
import torch

x = torch.ones(2, 3)
row_sums = x.sum(dim=1)                # shape [2]: lost its dim
print(x / row_sums)                    # [2, 3] / [2]: 3 vs 2 from the right
```

That last error is the classic one: reducing removes a dimension, and broadcasting then lines the result up against the wrong axis. `keepdim=True` keeps the reduced dimension as size 1, so the result broadcasts back correctly.

### Matrix multiplication

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

```python error
import torch

x = torch.ones(3, 2)
print(x @ x)                         # inner sizes 2 and 3 don't match
```

matmul needs **matching dtypes**: an int64 tensor @ a float32 tensor is an error, not a promotion.

### Reductions along a dimension

`sum`, `mean`, `max`, `min`, `prod`, `std`, `argmax` and friends reduce all elements, or one dimension with `dim=`. The `dim` you pass is the one that **disappears**.

![x of shape [2, 3] holding 1 to 6. x.sum(dim=0) adds down the columns giving 5, 7, 9 with shape [3]; x.sum(dim=1) adds along each row giving 6 and 15 with shape [2]; keepdim=True gives shape [2, 1]](figures/reduce-dims.svg)

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

### In-place operations

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

:::exercise Standardise the columns
Write `standardise(x)` that takes a 2-D float tensor (rows = samples, columns = features) and returns `(x - mean) / std` computed **per column**, using the population standard deviation (`correction=0`). Use broadcasting, no loops. If a column has a standard deviation of 0, divide by 1 instead (so that column becomes all zeros).
```python starter
import torch

def standardise(x):
    pass

x = torch.tensor([[1.0, 10.0], [2.0, 10.0], [3.0, 10.0]])
print(standardise(x))
```
```python check
import torch
fn = need("standardise")
x = torch.tensor([[1.0, 10.0], [2.0, 10.0], [3.0, 10.0]])
r = fn(x)
assert isinstance(r, torch.Tensor), "Return a tensor."
same(r, torch.tensor([[-1.2247449, 0.0], [0.0, 0.0], [1.2247449, 0.0]]), "standardise(x)")
torch.manual_seed(0)
y = torch.randn(50, 4) * torch.tensor([1.0, 5.0, 0.1, 2.0]) + torch.tensor([3.0, -2.0, 0.0, 10.0])
r = fn(y)
same(r.mean(dim=0), torch.zeros(4), "the column means after standardising", tol=1e-4)
same(r.std(dim=0, correction=0), torch.ones(4), "the column standard deviations after standardising", tol=1e-4)
same(r, (y - y.mean(0)) / y.std(0, correction=0), "standardise on random data")
assert not uses("for "), "Use broadcasting instead of a loop."
```
```python solution
import torch

def standardise(x):
    mean = x.mean(dim=0)
    std = x.std(dim=0, correction=0)
    std = torch.where(std == 0, torch.ones_like(std), std)
    return (x - mean) / std

x = torch.tensor([[1.0, 10.0], [2.0, 10.0], [3.0, 10.0]])
print(standardise(x))
```
hint: Reduce over the rows to get one value per column: `dim=0` gives shape `[n_columns]`.
hint: `[rows, cols] - [cols]` broadcasts: each row has the column means subtracted.
hint: Replace zero standard deviations with `torch.where(std == 0, torch.ones_like(std), std)`.
approach:
1. **Understand:** per-column statistics, applied to every row.
2. **Examples:** column 1, 2, 3 has mean 2 and population std 0.8165, giving −1.22, 0, 1.22.
3. **Brute force:** loop over columns, standardising each: works, but slow on big data.
4. **Pattern:** **reduce along dim 0** then **broadcast back**.
5. **Plan:** mean and std along dim 0; guard zeros with where; subtract and divide.
6. **Code and test:** after standardising, every column should have mean 0 and std 1.
walkthrough:
**Line by line**

- `x.mean(dim=0)` averages down each column: shape `[n_cols]`. The rows dimension disappears.
- `x.std(dim=0, correction=0)` divides by n (population). The default, `correction=1`, divides by n − 1.
- `torch.where(std == 0, torch.ones_like(std), std)` picks 1 where the std is 0, so a constant column becomes (value − mean) / 1 = 0 instead of 0 / 0 = nan.
- `(x - mean) / std`: shapes `[r, c]` and `[c]` line up from the right, so every row uses the same column statistics.

**Common wrong approach:** `dim=1`, which computes statistics per *row* (per sample). Ask "which dimension should disappear?": to get one number per feature, the samples dimension (0) must go.
:::

:::exercise Score a batch of predictions
`logits` has shape `[batch, classes]` (one row of class scores per sample) and `labels` has shape `[batch]` (the correct class index for each). Write `accuracy(logits, labels)` returning the fraction of samples whose highest-scoring class equals the label, as a Python float. Then write `pairwise_dist(a, b)` returning the matrix of Euclidean distances between every row of `a` (shape `[n, d]`) and every row of `b` (shape `[m, d]`): shape `[n, m]`, using broadcasting.
```python starter
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
```python check
import torch
acc = need("accuracy"); pd_ = need("pairwise_dist")
logits = torch.tensor([[2.0, 0.1, 0.3], [0.2, 0.1, 3.0], [1.0, 2.0, 0.0], [0.5, 0.4, 0.1]])
r = acc(logits, torch.tensor([0, 2, 0, 0]))
assert isinstance(r, float), f"accuracy should return a Python float, got {type(r).__name__}. Use .item()."
assert abs(r - 0.75) < 1e-6, f"accuracy on the example should be 0.75, got {r}."
assert abs(acc(logits, torch.tensor([1, 1, 1, 1])) - 0.25) < 1e-6, "accuracy when one prediction is right should be 0.25."
assert abs(acc(torch.tensor([[0.0, 1.0]]), torch.tensor([1])) - 1.0) < 1e-6, "accuracy of a batch of one correct prediction should be 1.0."
a = torch.tensor([[0.0, 0.0], [3.0, 4.0]]); b = torch.tensor([[0.0, 0.0], [6.0, 8.0], [3.0, 0.0]])
same(pd_(a, b), torch.tensor([[0.0, 10.0, 3.0], [5.0, 5.0, 4.0]]), "pairwise_dist(a, b)")
torch.manual_seed(2)
a = torch.randn(5, 3); b = torch.randn(4, 3)
same(pd_(a, b), torch.tensor([[((x - y) ** 2).sum().sqrt().item() for y in b] for x in a]), "pairwise_dist on random 5 × 3 and 4 × 3", tol=1e-5)
assert not uses("for "), "Use broadcasting instead of loops."
```
```python solution
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
hint: `logits.argmax(dim=1)` gives the predicted class per row; compare with `labels` to get a bool tensor.
hint: The mean of a bool tensor needs a float: `(pred == labels).float().mean().item()`.
hint: For distances, `a.unsqueeze(1)` is `[n, 1, d]` and `b.unsqueeze(0)` is `[1, m, d]`; their difference broadcasts to `[n, m, d]`. Square, sum over `dim=2`, take `sqrt`.
approach:
1. **Understand:** accuracy compares predictions with labels; distances compare every pair of rows.
2. **Examples:** (0, 0) to (3, 4) is 5.
3. **Brute force:** two nested loops over rows for the distances.
4. **Pattern:** **argmax along the class dim**, and **unsqueeze to broadcast pairs**.
5. **Plan:** argmax, compare, mean; unsqueeze, subtract, square, sum, sqrt.
6. **Code and test:** a batch of one; random data against a loop version.
walkthrough:
**Line by line**

- `logits.argmax(dim=1)`: for each row, the column with the highest score: `[0, 2, 1, 0]`.
- `predictions == labels`: `[True, True, False, True]`. `.float().mean()` turns it into the fraction 0.75 (a bool tensor can't be averaged directly), and `.item()` makes it a Python float.
- `a.unsqueeze(1) - b.unsqueeze(0)`: shapes `[n, 1, d]` and `[1, m, d]` broadcast to `[n, m, d]`, every row of a minus every row of b.
- `(diff ** 2).sum(dim=2).sqrt()` adds the squared differences over the d features, leaving `[n, m]`. (PyTorch's built-in for this is `torch.cdist(a, b)`.)

**Common wrong approach:** `a - b`, which only works when n equals m, and then subtracts row i from row i, not every pair.
:::

:::quiz
? `a` has shape `[5, 1, 4]` and `b` has shape `[3, 1]`. What is the shape of `a + b`?
+ `[5, 3, 4]`
- `[5, 1, 4]`
- `[5, 3, 1]`
- It raises an error
= From the right: 4 and 1 → 4; 1 and 3 → 3; 5 and (missing) → 5.
? `x` has shape `[32, 10]` (a batch of class scores). What does `x.argmax(dim=1)` return?
+ A tensor of shape `[32]`: the predicted class index for each sample
- A tensor of shape `[10]`: the best sample for each class
- One number: the position of the largest score
- A tensor of shape `[32, 1]`
= The dim you reduce disappears: dim 1 (classes) goes, leaving one index per sample.
? What is the shape of `torch.ones(4, 3) @ torch.ones(3)`?
+ `torch.Size([4])`
- `torch.Size([4, 3])`
- `torch.Size([3])`
- It raises an error
= A matrix times a vector: [4, 3] @ [3] gives [4] (one dot product per row).
? `x = torch.tensor([[1., 2.], [3., 4.]])`. What does `x * x` compute?
+ The element-wise square: `[[1., 4.], [9., 16.]]`
- The matrix product: `[[7., 10.], [15., 22.]]`
- The dot product: `30.`
- It raises an error
= `*` is element-wise; use `@` for the matrix product.
? Which line leaves `x` unchanged?
+ `y = x.add(1)`
- `x.add_(1)`
- `x += 1`
- `x.zero_()`
= Methods without a trailing underscore return a new tensor; `_` methods and `+=` modify x in place.
? `x` has shape `[8, 3]`. Which expression divides each row by its own sum?
+ `x / x.sum(dim=1, keepdim=True)`
- `x / x.sum(dim=1)`
- `x / x.sum(dim=0)`
- `x / x.sum()`
= keepdim keeps shape [8, 1], which broadcasts across the 3 columns. Without it, [8] lines up against the columns and fails.
:::

@@@ lesson
id: devices
title: CPUs, GPUs and devices
minutes: 20
summary: Why GPUs make deep learning fast, the device types (cpu, cuda, mps), checking what's available with torch.cuda and torch.accelerator, writing device-agnostic code, moving tensors with .to(device), the same-device rule and its error, getting results back to the CPU and NumPy, creating tensors directly on a device, and GPU memory basics.
---
A **GPU** (graphics processing unit) has thousands of small cores built to do the same arithmetic on many numbers at once, exactly what tensor maths needs. Training a neural network on a GPU is often 10 to 100 times faster than on a CPU. PyTorch hides most of the difference: the same operations run on either; you only choose **where the tensors live**.

| Device type | Hardware | Check availability |
|---|---|---|
| `cpu` | the computer's processor and RAM | always available |
| `cuda` | NVIDIA GPUs (AMD GPUs with PyTorch's ROCm build also use the name `cuda`) | `torch.cuda.is_available()` |
| `mps` | Apple silicon GPUs (Metal Performance Shaders) | `torch.backends.mps.is_available()` |

A device can have an index: `cuda:0` is the first GPU, `cuda:1` the second. Plain `cuda` means the current one, usually 0.

### Finding the GPU

This sandbox has a pretend NVIDIA L4 GPU so you can practise; on your own computer, these calls report your real hardware.

```python
import torch

print(torch.cuda.is_available())
print(torch.cuda.device_count())
print(torch.cuda.get_device_name(0))
print(torch.backends.mps.is_available())

d = torch.device("cuda:0")
print(d, d.type, d.index)
print(repr(torch.device("cpu")))
```

Recent PyTorch versions also have `torch.accelerator`, one device-agnostic API for whichever accelerator the machine has (CUDA, MPS, Intel XPU and others). The official tutorials pick the device like this:

```python
import torch

device = torch.accelerator.current_accelerator().type if torch.accelerator.is_available() else "cpu"
print(f"Using {device} device")
```

### Moving tensors: .to(device)

Tensors are created on the CPU unless you say otherwise. `.to(device)` returns a **copy on that device** (the original stays where it was); `.cuda()` and `.cpu()` are shortcuts. Moving to the device a tensor is already on returns the same tensor, no copy.

```python
import torch

device = "cuda" if torch.cuda.is_available() else "cpu"
x = torch.tensor([1.0, 2.0, 3.0])
g = x.to(device)
print(x.device, g.device)
print(g)                                 # the printout shows the device
print(g * 2)                             # results stay on the GPU
y = torch.zeros(2, 2, device=device)     # create directly on the device: no copy
print(y.device)
print(g.to(device) is g)                 # already there: the same tensor
```

Creating a tensor directly on the device (`device=` in `zeros`, `rand`, `tensor` and friends) is faster than creating it on the CPU and copying. The `*_like` functions keep the original's device, which keeps code device-agnostic. `.to()` can change the dtype at the same time: `x.to(device, torch.float16)`.

### The same-device rule

Every tensor in one operation must be on the **same device**. PyTorch never moves data behind your back, because a hidden copy between CPU and GPU memory would be slow.

![CPU memory (RAM) holds x = torch.ones(3); x.numpy() works; device='cpu'. GPU memory (VRAM) holds g = x.to('cuda'), fast maths, no .numpy(); device='cuda:0'. Arrows: .to('cuda') or .cuda() goes to the GPU, .to('cpu') or .cpu() comes back. Each copy takes time, and x + g raises an error because every operand must be on the same device](figures/devices.svg)

```python error
import torch

x = torch.ones(3)                 # on the CPU
g = torch.ones(3).to("cuda")      # on the GPU
print(x + g)
```

The fix is always to move one side, usually the CPU tensor to the GPU: `x.to(g.device)`. In a training loop that means moving the model **and** every batch of data to the same device (Part 2). One exception: a 0-dimensional CPU tensor (a single number) can be combined with GPU tensors, like a Python number.

### Getting results back

NumPy, Matplotlib and printing a Python number all need data in CPU memory. `.item()` and `.tolist()` copy back automatically; `.numpy()` doesn't, so it refuses a GPU tensor:

```python error
import torch

g = torch.rand(3, device="cuda")
arr = g.numpy()
```

```python
import torch

g = torch.rand(3, device="cuda")
print(g.cpu().numpy().shape)          # copy to the CPU first
print(g.sum().item())                 # .item() copies one number back
w = torch.ones(2, requires_grad=True, device="cuda")
print(w.detach().cpu().numpy())       # tensors that require grad also need .detach()
```

`t.detach().cpu().numpy()` is the standard recipe for turning any tensor into a NumPy array.

One more GPU difference: random numbers made directly on a CUDA device come from a separate GPU generator, so after the same `torch.manual_seed`, `torch.rand(3, device="cuda")` gives different values from `torch.rand(3)`. (This sandbox's pretend GPU reuses the CPU generator, so here they match.)

### Device-agnostic code

Write code that runs anywhere by choosing the device once and using it everywhere:

```python
import torch

device = "cuda" if torch.cuda.is_available() else "cpu"

def normalise(batch):
    mean = torch.zeros(batch.shape[1], device=batch.device)   # follow the input's device
    return batch - mean

data = torch.rand(4, 3).to(device)
print(normalise(data).device)

torch.cuda._sandbox_gpu(False)          # sandbox only: pretend there's no GPU
device = "cuda" if torch.cuda.is_available() else "cpu"
print(device, normalise(torch.rand(4, 3).to(device)).device)
```

(`torch.cuda._sandbox_gpu` exists only in this sandbox, to show what your code does on a machine without a GPU. On such a machine, real PyTorch's CPU-only build raises `AssertionError: Torch not compiled with CUDA enabled` if you ask for `cuda` anyway.)

### GPU memory and transfer speed

GPU memory is limited (16–80 GB on typical data-centre GPUs), and running out raises `torch.OutOfMemoryError` ("CUDA out of memory"). `torch.cuda.memory_allocated()` reports the bytes your tensors use; PyTorch's caching allocator rounds each allocation up to blocks of 512 bytes and keeps freed memory reserved for reuse.

```python
import torch

print(torch.cuda.memory_allocated())
x = torch.zeros(1000, device="cuda")      # 1000 float32 = 4000 bytes
print(torch.cuda.memory_allocated())      # rounded up to a multiple of 512
del x
print(torch.cuda.memory_allocated())
```

Copies between CPU and GPU go over a link (PCIe) that's much slower than the GPU itself, so move data once and keep it there. Two tools speed up the copies that are needed: **pinned** (page-locked) CPU memory, `t.pin_memory()`, which the GPU can read directly, and `t.to("cuda", non_blocking=True)`, which lets the copy overlap with other work. DataLoader's `pin_memory=True` (Part 3) does the first for every batch.

GPU operations are also **asynchronous**: PyTorch queues them and returns at once. To time GPU code correctly, call `torch.cuda.synchronize()` before reading the clock (Part 5).

:::exercise A device-agnostic helper
Write `to_device(batch, device)` that moves a batch to `device`, where a batch can be a tensor, or a **list** or **dict** of tensors (dict values may also be lists). Return the same structure with every tensor moved. Then write `pick_device()` that returns the string `"cuda"` if a CUDA GPU is available, otherwise `"mps"` if an Apple GPU is available, otherwise `"cpu"`.
```python starter
import torch

def to_device(batch, device):
    pass

def pick_device():
    pass

device = pick_device()
batch = {"x": torch.rand(2, 3), "extras": [torch.zeros(2), torch.ones(1)]}
moved = to_device(batch, device)
print(device, moved["x"].device, moved["extras"][1].device)
```
```python check
import torch
td = need("to_device"); pick = need("pick_device")
assert pick() == "cuda", f"With a GPU available, pick_device() should return 'cuda', got {pick()!r}."
torch.cuda._sandbox_gpu(False)
try:
    got = pick()
finally:
    torch.cuda._sandbox_gpu(True)
assert got == "cpu", f"Without a GPU (and no MPS), pick_device() should return 'cpu', got {got!r}."
assert uses("is_available"), "Check availability with torch.cuda.is_available() and torch.backends.mps.is_available()."
t = torch.arange(3.)
m = td(t, "cuda")
assert isinstance(m, torch.Tensor) and m.device == torch.device("cuda:0"), "A single tensor should come back on the device."
same(m.cpu(), t, "the moved tensor's values")
b = {"x": torch.rand(2, 3), "extras": [torch.zeros(2), torch.ones(1)], "y": torch.tensor([1, 0])}
r = td(b, "cuda")
assert isinstance(r, dict) and set(r) == {"x", "extras", "y"}, "A dict should come back as a dict with the same keys."
assert isinstance(r["extras"], list) and len(r["extras"]) == 2, "Lists inside the dict should stay lists."
assert all(v.is_cuda for v in [r["x"], r["y"], *r["extras"]]), "Every tensor in the structure should be on cuda."
assert r["y"].dtype == torch.int64, "Moving shouldn't change dtypes."
back = td([torch.ones(1, device="cuda"), torch.zeros(1)], "cpu")
assert isinstance(back, list) and all(v.device.type == "cpu" for v in back), "A list moved to 'cpu' should come back as a list of CPU tensors."
```
```python solution
import torch

def to_device(batch, device):
    if isinstance(batch, torch.Tensor):
        return batch.to(device)
    if isinstance(batch, dict):
        return {k: to_device(v, device) for k, v in batch.items()}
    if isinstance(batch, list):
        return [to_device(v, device) for v in batch]
    return batch

def pick_device():
    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"

device = pick_device()
batch = {"x": torch.rand(2, 3), "extras": [torch.zeros(2), torch.ones(1)]}
moved = to_device(batch, device)
print(device, moved["x"].device, moved["extras"][1].device)
```
hint: Handle three cases with `isinstance`: a tensor (call `.to(device)`), a dict, a list.
hint: For dicts and lists, call `to_device` again on each item (recursion handles lists inside dicts).
hint: `pick_device` checks `torch.cuda.is_available()` first, then `torch.backends.mps.is_available()`.
approach:
1. **Understand:** walk a nested structure, moving the tensors and keeping the shape of the structure.
2. **Examples:** `{"x": t, "extras": [a, b]}` → the same keys and list, all on the device.
3. **Brute force:** handle only the exact structure in the example: breaks on the next batch format.
4. **Pattern:** **recursion over containers**, with tensors as the base case.
5. **Plan:** isinstance checks, dict and list comprehensions that recurse.
6. **Code and test:** move a list back to the CPU; check dtypes are unchanged.
walkthrough:
**Line by line**

- `batch.to(device)` returns a copy on the device (or the tensor itself if it's already there). It keeps the dtype.
- The dict and list branches rebuild the same container, calling `to_device` on every item, so nesting of any depth works.
- Anything else (a string label, a number) is returned unchanged.
- `pick_device` asks in order of preference. In the sandbox the pretend GPU is available, so it returns `"cuda"`.

**Common wrong approach:** calling `batch.to(device)` without assigning the result. Tensors' `.to()` doesn't change the tensor in place; it returns a new one. (Models are different: `model.to(device)` moves the model's own parameters, Part 2.)
:::

:::exercise Fix the device bugs
The starter computes a weighted score on the GPU but has three device bugs: a tensor on the wrong device, a NumPy conversion of a GPU tensor, and a constant created on the CPU. Fix the code so it runs and sets `result` to a NumPy array of the 4 weighted scores and `best` to the index of the highest one (a Python int). Keep `scores` and `weights` on `device`.
```python starter
import torch

device = "cuda" if torch.cuda.is_available() else "cpu"
scores = torch.tensor([[0.2, 0.9], [0.7, 0.4], [0.5, 0.5], [0.1, 0.3]]).to(device)
weights = torch.tensor([0.6, 0.4])
bonus = torch.tensor([0.0, 0.1, 0.0, 0.2])

weighted = scores @ weights + bonus
result = weighted.numpy()
best = weighted.argmax()
print(result, best)
```
```python check
import numpy as np
import torch
r = need("result", np.ndarray)
assert np.allclose(r, [0.48, 0.68, 0.5, 0.38]), f"result should be the weighted scores [0.48, 0.68, 0.5, 0.38], got {r}."
b = need("best")
assert not isinstance(b, torch.Tensor) and b == 1, f"best should be the Python int 1, got {b!r}."
w = need("weighted", torch.Tensor)
assert w.is_cuda, "Keep the computation on the GPU: weighted should be on cuda."
assert need("weights", torch.Tensor).is_cuda, "Move weights to device too."
```
```python solution
import torch

device = "cuda" if torch.cuda.is_available() else "cpu"
scores = torch.tensor([[0.2, 0.9], [0.7, 0.4], [0.5, 0.5], [0.1, 0.3]]).to(device)
weights = torch.tensor([0.6, 0.4], device=device)
bonus = torch.tensor([0.0, 0.1, 0.0, 0.2], device=device)

weighted = scores @ weights + bonus
result = weighted.cpu().numpy()
best = weighted.argmax().item()
print(result, best)
```
hint: Run it and read the first error: which two tensors are on different devices?
hint: Create `weights` and `bonus` with `device=device`, or call `.to(device)` on them.
hint: `.numpy()` needs a CPU tensor: `weighted.cpu().numpy()`. And `.item()` turns the argmax into a Python int.
approach:
1. **Understand:** everything in one computation must share a device; results go back to the CPU for NumPy.
2. **Examples:** row 1: 0.7 × 0.6 + 0.4 × 0.4 + 0.1 = 0.68, the best.
3. **Brute force:** move everything to the CPU: it runs, but the work is no longer on the GPU.
4. **Pattern:** **create on the device**, compute there, **copy back once** at the end.
5. **Plan:** add `device=device` to the two constants, `.cpu()` before `.numpy()`, `.item()` for the index.
6. **Code and test:** check `weighted.device`.
walkthrough:
**Line by line**

- `scores @ weights` fails first: `scores` is on `cuda:0` and `weights` on the CPU, which raises "Expected all tensors to be on the same device". Creating `weights` with `device=device` fixes it (and costs no extra copy). `bonus` needs the same, since it's 1-D, not a 0-D scalar.
- `weighted.numpy()` raises a TypeError for a GPU tensor. `weighted.cpu().numpy()` copies the 4 values to CPU memory first.
- `weighted.argmax()` returns a 0-D tensor *on the GPU*; `.item()` copies the single number back as a Python int.

**Common wrong approach:** fixing the error by moving `scores` to the CPU. The code runs, but on a real GPU machine it would silently give up the speed the GPU was there for.
:::

:::quiz
? `x = torch.ones(3)` is on the CPU. After `x.to("cuda")`, where is `x`?
+ Still on the CPU: `.to()` returns a new tensor on the GPU, which this line throws away
- On the GPU
- On both devices
- It raises an error
= For tensors, .to() is not in place. Write `x = x.to("cuda")`.
? `a` is on `cuda:0` and `b` on the CPU, both with shape `[3]`. What does `a + b` do?
+ Raises a RuntimeError saying the tensors are on different devices
- Copies `b` to the GPU automatically and returns a CUDA tensor
- Copies `a` to the CPU and returns a CPU tensor
- Returns a tensor split across both devices
= PyTorch never moves data implicitly between devices (except 0-D CPU tensors, which act like Python numbers).
? Which expression turns a GPU tensor `p` that requires grad into a NumPy array?
+ `p.detach().cpu().numpy()`
- `p.numpy()`
- `p.cpu().numpy()`
- `numpy.array(p)`
= numpy() needs CPU memory and a tensor outside autograd, so detach and copy first.
? What is the most portable way to choose a device in modern PyTorch code?
+ `torch.accelerator.current_accelerator().type if torch.accelerator.is_available() else "cpu"`
- `"cuda"`
- `torch.device("gpu")`
- `"cuda" if torch.cuda.device_count() > 1 else "mps"`
= torch.accelerator covers CUDA, MPS, XPU and others, and falls back to the CPU. "gpu" isn't a device type at all.
? Why is `torch.zeros(1000, 1000, device="cuda")` better than `torch.zeros(1000, 1000).cuda()`?
+ It allocates directly on the GPU, skipping a CPU allocation and a copy
- It uses less GPU memory
- `.cuda()` doesn't work on zeros
- They're different: one is float64
= Both give the same tensor, but creating it on the device avoids a slow CPU-to-GPU transfer.
? Why should you call `torch.cuda.synchronize()` before stopping a timer around GPU code?
+ GPU operations run asynchronously, so without it you may time only the queuing, not the work
- It frees GPU memory
- It moves results to the CPU
- It makes random numbers reproducible
= CUDA kernels are launched asynchronously; synchronize waits until they finish.
:::
