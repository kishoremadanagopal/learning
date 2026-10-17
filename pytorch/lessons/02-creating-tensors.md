# Lesson 2: Creating tensors

**You'll learn:** torch.tensor and dtype inference, ragged lists, torch.Tensor versus torch.tensor, zeros, ones, full, eye, empty, arange and linspace, the *_like functions, rand, randn, randint and randperm, torch.manual_seed, torch.Generator, reproducibility, from_numpy versus torch.tensor.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/pytorch/#creating-tensors)**: run every example and check your exercise answers.

## Key terms

- **torch.tensor:** creates a tensor by copying Python data or an array, inferring the dtype unless you pass `dtype=`.
- **arange:** evenly spaced values from start up to but not including end, by a step.
- **linspace:** a fixed number of evenly spaced values from start to end, both included.
- **_like functions:** `zeros_like`, `ones_like`, `full_like`, `rand_like` and others create a tensor with another tensor's shape, dtype and device.
- **torch.empty:** allocates a tensor without initialising its values.
- **rand / randn:** random floats, uniform in [0, 1) or from the standard normal distribution.
- **randint:** random integers from low up to but not including high.
- **Seed:** the starting value of a random number generator; the same seed gives the same sequence.
- **torch.manual_seed:** sets the seed of PyTorch's default random number generators (CPU and GPU).
- **Generator:** an independent random number generator object, passed with `generator=`.
- **from_numpy:** creates a tensor that shares memory with a NumPy array.

There are four ways to get a tensor: from data you already have, filled with a constant, as a sequence, or random.

## From Python data: torch.tensor

`torch.tensor(data)` **copies** a number, a list or nested lists (or a NumPy array) into a new tensor and infers the dtype from the values. Every inner list must have the same length.

```python
import torch

print(torch.tensor(3.5))                     # a 0-D tensor (scalar)
print(torch.tensor([1, 2, 3]))               # ints  -> int64
print(torch.tensor([1, 2.5, 3]))             # any float -> float32
print(torch.tensor([True, False]))           # bools -> bool
print(torch.tensor([1, 2, 3], dtype=torch.float32))   # or choose the dtype
```

*This example raises an error on purpose.*

```python
import torch

ragged = torch.tensor([[1, 2, 3], [4, 5]])   # rows of different lengths
```

You'll also see `torch.Tensor([1, 2])` with a capital T in older code. That calls the class constructor, which always makes float32 and treats integers as *sizes* (`torch.Tensor(2, 3)` is an uninitialised 2 × 3 tensor). Use lowercase `torch.tensor` for data.

## Filled tensors and ranges

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

## The *_like functions

`zeros_like(t)`, `ones_like(t)`, `full_like(t, v)`, `rand_like(t)` and `randn_like(t)` make a new tensor with the **same shape, dtype and device** as `t`. They save you from copying all three by hand, and they keep code device-agnostic (lesson 7).

```python
import torch

x = torch.tensor([[1, 2], [3, 4]])
print(torch.zeros_like(x))                       # int64, like x
print(torch.full_like(x, 9))
print(torch.ones_like(x, dtype=torch.float32))   # override the dtype
```

## Random tensors

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

## Reproducible randomness: seeds

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

## From NumPy

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

## At a glance

| Concept | Code | Gives you | Remember |
|---|---|---|---|
| From data | `torch.tensor(data, dtype=…)` | a new tensor (copy) | rows must have equal lengths |
| Filled | `zeros`, `ones`, `full(shape, v)`, `eye(n)` | float32 by default | shape as numbers or a tuple |
| Ranges | `arange(start, end, step)`, `linspace(start, end, steps)` | sequences | arange excludes end; linspace includes it |
| Same shape, dtype, device | `zeros_like(t)`, `rand_like(t)` | a matching new tensor | keeps code device-agnostic |
| Random | `rand`, `randn`, `randint(lo, hi, (n,))`, `randperm(n)` | uniform, normal, integers, a shuffle | randint's high is excluded |
| Reproducible | `torch.manual_seed(42)` or `torch.Generator().manual_seed(42)` | the same numbers every run | GPUs also need deterministic algorithms |
| From NumPy | `torch.from_numpy(arr)` / `torch.tensor(arr)` | shared memory / a copy | NumPy floats are float64 |

## Common mistakes

- Using `torch.Tensor(data)` (always float32, and integers mean sizes) instead of `torch.tensor(data)`.
- Expecting `arange`'s end, or `randint`'s high, to be included.
- Reading `torch.empty` values before writing them.
- Expecting repeatable random numbers without seeding, or forgetting that extra random calls shift the sequence.
- Feeding float64 tensors from NumPy into float32 models; convert with `.float()`.
- Assuming `from_numpy` copies: changes to the array show up in the tensor.

## Exercises

### 1. Build a grid of coordinates

Create `xs`, a float32 tensor of 6 evenly spaced values from -1 to 1 (both included), and `idx`, the int64 tensor `[0, 2, 4, 6, 8]` made with `torch.arange`. Then make `grid`, a 2 × 6 tensor whose first row is all zeros and second row is all ones, using `torch.zeros_like` and `torch.ones_like` on `xs` and joining them with `torch.stack([row1, row2])`.

Starter code:

```python
import torch

xs = None
idx = None
grid = None
print(xs, idx, grid, sep="\n")
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** three tensors, each from a different creation function.
2. **Examples:** `linspace(0, 1, 3)` → 0, 0.5, 1; `arange(0, 6, 2)` → 0, 2, 4.
3. **Brute force:** typing the values with `torch.tensor` works but the checks want the functions.
4. **Pattern:** **ranges** (end excluded for arange, included for linspace) and **_like** helpers.
5. **Plan:** linspace for xs, arange with step 2 for idx, stack two _like rows.
6. **Code and test:** check `idx.dtype` is int64 and `xs.dtype` float32.

</details>

<details>
<summary>💡 Hint 1</summary>

`torch.linspace(start, end, steps)` includes both ends; you need 6 steps.

</details>

<details>
<summary>💡 Hint 2</summary>

`torch.arange(start, end, step)` excludes the end, so to include 8 the end must be bigger than 8.

</details>

<details>
<summary>💡 Hint 3</summary>

`torch.zeros_like(xs)` has xs's shape and dtype; `torch.stack([a, b])` puts the two rows on top of each other.

</details>

### 2. Reproducible dice

Write `roll_dice(n, seed)` that returns a tensor of `n` dice rolls (whole numbers from 1 to 6) that is the same every time it's called with the same seed. Use a **local** `torch.Generator` seeded with `seed`, so calling your function doesn't change the global random numbers.

Starter code:

```python
import torch

def roll_dice(n, seed):
    pass

print(roll_dice(10, seed=1))
print(roll_dice(10, seed=1))
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** random but repeatable, without side effects on the global generator.
2. **Examples:** two calls with seed 1 print identical tensors.
3. **Brute force:** `torch.manual_seed(seed)` inside the function gives repeatable rolls, but resets everyone else's random numbers too.
4. **Pattern:** a **local generator** passed with `generator=`.
5. **Plan:** create and seed a Generator, call randint with it.
6. **Code and test:** check min is 1, max is 6, and the global sequence is unchanged.

</details>

<details>
<summary>💡 Hint 1</summary>

`torch.randint(low, high, size)` excludes `high`, so dice need `low=1, high=7`.

</details>

<details>
<summary>💡 Hint 2</summary>

The size is a tuple: `(n,)`.

</details>

<details>
<summary>💡 Hint 3</summary>

`g = torch.Generator().manual_seed(seed)`, then pass `generator=g` to `randint`.

</details>

**In the sandbox:** exercises 3–4. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Build a grid of coordinates</summary>

```python
import torch

xs = torch.linspace(-1, 1, 6)
idx = torch.arange(0, 10, 2)
grid = torch.stack([torch.zeros_like(xs), torch.ones_like(xs)])
print(xs, idx, grid, sep="\n")
```

**Line by line**

- `torch.linspace(-1, 1, 6)`: the step is (1 − (−1)) / 5 = 0.4, giving −1, −0.6, −0.2, 0.2, 0.6, 1 as float32.
- `torch.arange(0, 10, 2)`: 0, 2, 4, 6, 8 (10 is excluded). All arguments are ints, so the dtype is int64. `torch.arange(0, 9, 2)` works too.
- `torch.zeros_like(xs)` and `torch.ones_like(xs)` copy xs's shape `[6]`, dtype and device. `torch.stack` adds a new first dimension: shape `[2, 6]`.

**Common wrong approach:** `torch.arange(0, 8, 2)`, which stops at 6 because the end is excluded.

</details>

<details>
<summary>✅ 2. Reproducible dice</summary>

```python
import torch

def roll_dice(n, seed):
    g = torch.Generator().manual_seed(seed)
    return torch.randint(1, 7, (n,), generator=g)

print(roll_dice(10, seed=1))
print(roll_dice(10, seed=1))
```

**Line by line**

- `torch.Generator()` makes an independent random number generator for the CPU; `.manual_seed(seed)` seeds it and returns it, so the two can be chained.
- `torch.randint(1, 7, (n,), generator=g)` draws n integers from 1 to 6 using that generator only.

**Why not torch.manual_seed?** It works for repeatability, but it resets the default generator that the rest of the program uses: code that called your function would suddenly get the same "random" numbers after every call. Libraries use local generators (DataLoader's `generator=` argument in Part 3 is the same idea).

**Common wrong approach:** `torch.randint(1, 6, ...)`: 6 can never appear, because `high` is excluded.

</details>

## Quick quiz

1. Which call creates `tensor([0, 2, 4, 6])`?
   - A) `torch.arange(0, 8, 2)`
   - B) `torch.arange(0, 6, 2)`
   - C) `torch.linspace(0, 6, 3)`
   - D) `torch.randint(0, 8, (4,))`

2. What is the dtype of `torch.tensor([1, 2, 3.0])`?
   - A) `torch.float32`
   - B) `torch.int64`
   - C) `torch.float64`
   - D) It raises an error because the types are mixed

3. `arr = np.zeros(3); t = torch.from_numpy(arr); arr[0] = 5`. What is `t[0]`?
   - A) `tensor(5., dtype=torch.float64)`
   - B) `tensor(0., dtype=torch.float64)`
   - C) `tensor(5.)`
   - D) It raises an error

4. You call `torch.manual_seed(7)` and then `torch.rand(2)` twice, getting `a` and `b`. Which statement is true?
   - A) `a` and `b` differ, but the pair is the same on every run of the program
   - B) `a` and `b` are equal
   - C) `a` and `b` differ on every run of the program
   - D) `torch.rand` ignores the seed

5. Which function returns integers where `high` is excluded?
   - A) `torch.randint(low, high, size)`
   - B) `torch.linspace(low, high, steps)`
   - C) `torch.full(size, high)`
   - D) `torch.rand(size) * high`

<details>
<summary>Quiz answers</summary>

1. **A) `torch.arange(0, 8, 2)`**: arange excludes the end, so the end must be past 6. linspace(0, 6, 3) gives 0, 3, 6 as floats.
2. **A) `torch.float32`**: One float makes the whole tensor floating point, using the default dtype, float32 (unlike NumPy, which would choose float64).
3. **A) `tensor(5., dtype=torch.float64)`**: from_numpy shares memory with the array, and keeps NumPy's float64 dtype, which the repr shows because it isn't the default.
4. **A) `a` and `b` differ, but the pair is the same on every run of the program**: Seeding fixes the whole sequence of draws. The second call continues the sequence, so it differs from the first.
5. **A) `torch.randint(low, high, size)`**: Like Python's range, randint's upper bound is exclusive.

</details>

---
Previous: [Lesson 1](01-pytorch-and-tensors.md) · Next: [Lesson 3: Data types and precision](03-dtypes.md)
