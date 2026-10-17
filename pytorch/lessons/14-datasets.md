# Lesson 14: Datasets

**You'll learn:** the Dataset and DataLoader split of responsibilities, the map-style Dataset protocol (__len__ and __getitem__), TensorDataset, a custom Dataset reading a CSV file, float32 features and int64 labels, eager versus lazy loading, torchvision's ready-made datasets, Subset, ConcatDataset, random_split with lengths or fractions and a seeded Generator.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/pytorch/#datasets)**: run every example and check your exercise answers.

## Key terms

- **Dataset:** an object that returns one sample by index (`ds[i]`) and knows how many samples it has (`len(ds)`).
- **Map-style dataset:** a dataset that implements `__len__` and `__getitem__`, so any sample can be read by index.
- **TensorDataset:** a dataset wrapping tensors with the same first dimension; `ds[i]` is the tuple of their i-th rows.
- **Lazy loading:** reading each sample from disk only when `__getitem__` asks for it, instead of all at once.
- **Subset:** a dataset view made of some of another dataset's samples, chosen by index.
- **ConcatDataset:** several datasets joined end to end.
- **random_split:** splits a dataset into non-overlapping random Subsets of given lengths or fractions.
- **Training / validation / test split:** data to learn from, data to tune decisions on, and data for one final unbiased score.

Part 2 trained on tensors that were already in memory and cut batches by hand. Real projects separate two jobs:

1. A **Dataset** knows how to get **one sample**: "give me example number `i`".
2. A **DataLoader** (next lesson) decides **which** samples go in each batch, fetches them from the dataset and stacks them into tensors.

Splitting the jobs means the same training loop works for 100 rows in memory or a million images on disk.

## The Dataset protocol

A **map-style dataset** is any object with two methods:

| Method | Returns |
|---|---|
| `__len__(self)` | the number of samples |
| `__getitem__(self, i)` | sample `i`, usually a tuple `(features, label)` |

So `len(ds)` and `ds[i]` work, like a list. Subclass `torch.utils.data.Dataset` to make the intent clear (and to get `ds1 + ds2` for joining).

## TensorDataset: data already in tensors

`TensorDataset(x, y)` wraps tensors that share their first dimension; `ds[i]` returns `(x[i], y[i])`.

```python
import torch
from torch.utils.data import TensorDataset

x = torch.arange(12.0).view(6, 2)       # 6 samples, 2 features
y = torch.tensor([0, 1, 0, 1, 1, 0])     # 6 labels
ds = TensorDataset(x, y)
print(len(ds))
print(ds[0])
features, label = ds[4]
print(features, label)
print(ds[-1])
```

*This example raises an error on purpose.*

```python
import torch
from torch.utils.data import TensorDataset

ds = TensorDataset(torch.zeros(6, 2), torch.zeros(5))   # 6 inputs but 5 labels
```

## Your own Dataset

Most data doesn't start as tensors. This dataset reads `fruit.csv`, one of this course's practice files (see the **Data files** tab): each row has a fruit's weight, diameter and sweetness, and its name.

```python
import csv
import torch
from torch.utils.data import Dataset

class FruitDataset(Dataset):
    classes = ["apple", "orange", "lemon"]

    def __init__(self, path):
        with open(path, newline="") as f:
            rows = list(csv.DictReader(f))
        self.x = torch.tensor([[float(r["weight_g"]), float(r["diameter_cm"]), float(r["sweetness"])]
                               for r in rows])                       # float32 features
        self.y = torch.tensor([self.classes.index(r["fruit"]) for r in rows])   # int64 labels

    def __len__(self):
        return len(self.y)

    def __getitem__(self, i):
        return self.x[i], self.y[i]

ds = FruitDataset("fruit.csv")
print(len(ds))
x, y = ds[0]
print(x, y, ds.classes[y])
print(x.dtype, y.dtype)
```

Two dtype choices matter here. Features are **float32**, the dtype of model weights. Class labels are **int64** (`torch.long`) class indexes, which is what `nn.CrossEntropyLoss` expects.

## Eager or lazy loading

`FruitDataset` loads everything in `__init__` (**eager**): fine when the data fits in memory. For large data such as images, `__init__` only stores the file **paths**, and `__getitem__` opens the one file it needs (**lazy**):

```python
class ImageFolderDataset(Dataset):
    def __init__(self, paths, labels, transform=None):
        self.paths, self.labels, self.transform = paths, labels, transform

    def __len__(self):
        return len(self.paths)

    def __getitem__(self, i):
        image = decode_image(self.paths[i])          # read one file only when it's asked for
        if self.transform:
            image = self.transform(image)
        return image, self.labels[i]
```

(`torchvision.io.decode_image` reads a JPEG or PNG into a uint8 tensor. torchvision also has ready-made datasets such as `datasets.MNIST`, `datasets.CIFAR10` and `datasets.ImageFolder`, which download or read files on your own computer.)

There's also a second kind of dataset, the **iterable-style** `IterableDataset`, for streams you can only read in order (lesson 3).

## Subset, ConcatDataset and random_split

`Subset(ds, indices)` is a view of some samples; `ConcatDataset([a, b])` (or `a + b`) joins datasets end to end.

To hold out validation and test data, `random_split` shuffles the indexes and cuts them into pieces. Pass lengths, or **fractions** that add up to 1, and a seeded `Generator` so the split is the same every run:

```python
import torch
from torch.utils.data import TensorDataset, random_split, Subset, ConcatDataset

ds = TensorDataset(torch.arange(10))
g = torch.Generator().manual_seed(42)
train, val, test = random_split(ds, [0.6, 0.2, 0.2], generator=g)
print(len(train), len(val), len(test))
print(type(train).__name__, train.indices)
print(val[0])                                  # indexes into the original dataset

first3 = Subset(ds, [0, 1, 2])
both = ConcatDataset([first3, test])
print(len(both), both[3])
```

*This example raises an error on purpose.*

```python
import torch
from torch.utils.data import TensorDataset, random_split

random_split(TensorDataset(torch.arange(10)), [6, 3])   # 9 isn't 10
```

With fractions, PyTorch rounds each piece down and hands the leftover samples out one at a time from the first piece: 11 samples split `[0.6, 0.2, 0.2]` gives `[7, 2, 2]`. Splitting with a fixed seed matters: if the split changed every run, validation samples would leak into training across runs and your scores couldn't be compared.

## At a glance

| Concept | Code | Gives you | Remember |
|---|---|---|---|
| Data already in tensors | `TensorDataset(x, y)` | `ds[i] == (x[i], y[i])` | every tensor needs the same size of dim 0 |
| Your own data | `class MyData(Dataset)` with `__len__`, `__getitem__` | samples on demand | float32 features, int64 labels |
| Big data on disk | store paths in `__init__`, read in `__getitem__` | low memory, parallel loading | lazy loading |
| Some samples | `Subset(ds, indices)` | a view by index | indexes into the original dataset |
| Join datasets | `ConcatDataset([a, b])` or `a + b` | one longer dataset | map-style only |
| Split | `random_split(ds, [0.8, 0.1, 0.1], generator=g)` | Subsets | fractions round down; leftovers go to the first pieces |

## Common mistakes

- Returning Python numbers or float64 features from `__getitem__` instead of float32 tensors.
- Returning float class labels when `nn.CrossEntropyLoss` needs int64 class indexes.
- Loading a huge image dataset into memory in `__init__` instead of reading files in `__getitem__`.
- Splitting without a seeded generator, so the split changes every run.
- Giving `random_split` lengths that don't add up to the dataset's length.

## Exercises

### 1. A dataset of squares

Write a map-style dataset class `Squares(Dataset)` whose constructor takes `n`. It has `n` samples; sample `i` is the tuple `(x, y)` where `x` is `torch.tensor([float(i)])` (shape `[1]`, float32) and `y` is `torch.tensor([float(i * i)])`. Indexes outside `0 … n-1` (including negative ones) must raise `IndexError`.

Starter code:

```python
import torch
from torch.utils.data import Dataset

class Squares(Dataset):
    pass

ds = Squares(5)
print(len(ds), ds[3])
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** implement the two-method protocol, computing samples on demand.
2. **Examples:** `Squares(5)[3]` → `(tensor([3.]), tensor([9.]))`.
3. **Brute force:** precompute all samples into a list in `__init__`: works, but costs memory for big n.
4. **Pattern:** a **lazy dataset**: compute (or load) sample i inside `__getitem__`.
5. **Plan:** store n; return it from `__len__`; range check, then build two tensors.
6. **Code and test:** index 0, the last index, n, and −1.

</details>

<details>
<summary>💡 Hint 1</summary>

You need three methods: `__init__` stores `n`, `__len__` returns it, `__getitem__` builds sample `i`.

</details>

<details>
<summary>💡 Hint 2</summary>

`torch.tensor([float(i)])` has shape `[1]` and dtype float32.

</details>

<details>
<summary>💡 Hint 3</summary>

Check `0 <= i < self.n` first and `raise IndexError(...)` otherwise; negative indexes count as out of range here.

</details>

### 2. Split the fruit reproducibly

Write `split_fruit(ds, seed)` that splits a dataset into training, validation and test subsets with fractions 0.7, 0.15 and 0.15, using `random_split` and a `torch.Generator` seeded with `seed`. Return the three subsets. The same seed must always give the same split, and calling it must not change PyTorch's global random numbers.

Starter code:

```python
import torch
from torch.utils.data import TensorDataset, random_split

def split_fruit(ds, seed):
    pass

ds = TensorDataset(torch.arange(90))
train, val, test = split_fruit(ds, seed=0)
print(len(train), len(val), len(test))
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a reproducible three-way split that leaves the global random state alone.
2. **Examples:** 90 samples × 0.7, 0.15, 0.15 → pieces of about 63, 13.5 and 13.5. (Check the walkthrough for how they're rounded.)
3. **Brute force:** shuffle indexes with `torch.randperm` and slice: also fine, more code.
4. **Pattern:** **random_split with fractions** and a **local generator**.
5. **Plan:** make a generator, call random_split, return.
6. **Code and test:** check the global random numbers are untouched.

</details>

<details>
<summary>💡 Hint 1</summary>

`random_split(ds, [0.7, 0.15, 0.15], generator=g)` accepts fractions that add up to 1.

</details>

<details>
<summary>💡 Hint 2</summary>

Make the generator inside the function: `g = torch.Generator().manual_seed(seed)`.

</details>

<details>
<summary>💡 Hint 3</summary>

random_split returns a list of three `Subset`s; return it directly (or unpack and return a tuple).

</details>

**In the sandbox:** exercises 27–28. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. A dataset of squares</summary>

```python
import torch
from torch.utils.data import Dataset

class Squares(Dataset):
    def __init__(self, n):
        self.n = n

    def __len__(self):
        return self.n

    def __getitem__(self, i):
        if not 0 <= i < self.n:
            raise IndexError(f"index {i} is out of range for {self.n} samples")
        return torch.tensor([float(i)]), torch.tensor([float(i * i)])

ds = Squares(5)
print(len(ds), ds[3])
```

**Line by line**

- `__init__` only stores `n`: nothing is computed up front, so `Squares(10_000_000)` is instant.
- `__len__` lets `len(ds)` (and the DataLoader) know how many samples exist.
- `__getitem__` checks the index, then builds the pair. The DataLoader only ever asks for indexes 0 to `len - 1`, but a clear error protects people who index by hand.

**Why raise IndexError?** Besides being the convention for sequences, it's what Python's old-style iteration (`for sample in ds:`) uses to know where a dataset without `__iter__` ends.

**Common wrong approach:** returning `torch.tensor(i)` (a 0-D int64 tensor). A model's linear layer needs float features with a feature dimension: shape `[1]`, float32.

</details>

<details>
<summary>✅ 2. Split the fruit reproducibly</summary>

```python
import torch
from torch.utils.data import TensorDataset, random_split

def split_fruit(ds, seed):
    g = torch.Generator().manual_seed(seed)
    return random_split(ds, [0.7, 0.15, 0.15], generator=g)

ds = TensorDataset(torch.arange(90))
train, val, test = split_fruit(ds, seed=0)
print(len(train), len(val), len(test))
```

**Line by line**

- `torch.Generator().manual_seed(seed)` creates and seeds a private generator.
- `random_split(..., generator=g)` draws `torch.randperm(90, generator=g)` and cuts it into pieces. Each `Subset` keeps the original dataset plus its list of indexes.
- The lengths are 63, 14 and 13, not the 63, 13.5, 13.5 you might expect. Each fraction is rounded down: 90 × 0.7 is 62.99999999999999 in floating point, so it becomes 62, and 13.5 becomes 13 twice. That leaves 2 samples over, handed out one each to the first and second pieces: 63, 14, 13. Check `len()` of each piece rather than assuming.

**Why a local generator?** With `generator=` left out, random_split uses PyTorch's global generator: the split would then depend on whatever random calls ran before it, and it would shift the random numbers used later (for example to initialise a model).

**Common wrong approach:** `random_split(ds, [63, 13, 13])`: the lengths add up to 89, which raises `ValueError: Sum of input lengths does not equal the length of the input dataset!`

</details>

## Quick quiz

1. Which two methods must a map-style `Dataset` implement?
   - A) `__len__` and `__getitem__`
   - B) `__iter__` and `__next__`
   - C) `forward` and `backward`
   - D) `load` and `transform`

2. `ds = TensorDataset(x, y)` with `x` of shape `[100, 4]` and `y` of shape `[100]`. What is `ds[7]`?
   - A) The tuple `(x[7], y[7])`, with shapes `[4]` and `[]`
   - B) `x[7]` only
   - C) A tensor of shape `[5]`
   - D) A batch of 7 samples

3. You split 50 samples with `random_split(ds, [0.8, 0.1, 0.1])`. What are the lengths?
   - A) 40, 5, 5
   - B) 41, 5, 4
   - C) 40, 6, 4
   - D) It raises an error because fractions aren't allowed

4. Why should a split use `generator=torch.Generator().manual_seed(...)`?
   - A) So the same samples land in the same subset on every run, keeping scores comparable and validation data out of training
   - B) Because random_split fails without a generator
   - C) To make the split stratified by class
   - D) To make the split faster

5. A dataset of 200,000 photos on disk. What should its `__init__` do?
   - A) Store the file paths (and labels); read each image in `__getitem__`
   - B) Read every image into one big tensor
   - C) Train the model
   - D) Shuffle the images

<details>
<summary>Quiz answers</summary>

1. **A) `__len__` and `__getitem__`**: A map-style dataset maps an index to a sample; iterable-style datasets implement `__iter__` instead.
2. **A) The tuple `(x[7], y[7])`, with shapes `[4]` and `[]`**: TensorDataset indexes every tensor along dim 0 and returns the results as a tuple.
3. **A) 40, 5, 5**: 50 × 0.8 = 40 and 50 × 0.1 = 5 exactly, so there's no remainder to distribute.
4. **A) So the same samples land in the same subset on every run, keeping scores comparable and validation data out of training**: Without a fixed generator the split depends on the global random state, which changes between runs.
5. **A) Store the file paths (and labels); read each image in `__getitem__`**: Lazy loading keeps memory small and lets DataLoader workers read files in parallel.

</details>

---
Previous: [Lesson 13](13-saving-and-loading.md) · Next: [Lesson 15: DataLoader: batching and shuffling](15-dataloaders.md)
