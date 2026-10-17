@@@ part
id: 3
title: Data Handling
level: Intermediate
blurb: Getting data into a model the way real projects do: Dataset classes (built-in and your own), splitting data reproducibly, DataLoader batching and shuffling, how samples are collated, samplers for imbalanced data, worker processes and pinned memory, torchvision transforms and augmentation, and the data-quality checks that stop silent bugs.

@@@ lesson
id: datasets
title: Datasets
minutes: 25
summary: What torch.utils.data.Dataset is (__len__ and __getitem__), TensorDataset for data already in tensors, writing your own Dataset that reads a CSV file, choosing dtypes for features and labels, loading eagerly versus lazily, Subset and ConcatDataset, and splitting into training, validation and test sets with random_split and a seeded Generator.
---
Part 2 trained on tensors that were already in memory and cut batches by hand. Real projects separate two jobs:

1. A **Dataset** knows how to get **one sample**: "give me example number `i`".
2. A **DataLoader** (next lesson) decides **which** samples go in each batch, fetches them from the dataset and stacks them into tensors.

Splitting the jobs means the same training loop works for 100 rows in memory or a million images on disk.

### The Dataset protocol

A **map-style dataset** is any object with two methods:

| Method | Returns |
|---|---|
| `__len__(self)` | the number of samples |
| `__getitem__(self, i)` | sample `i`, usually a tuple `(features, label)` |

So `len(ds)` and `ds[i]` work, like a list. Subclass `torch.utils.data.Dataset` to make the intent clear (and to get `ds1 + ds2` for joining).

### TensorDataset: data already in tensors

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

```python error
import torch
from torch.utils.data import TensorDataset

ds = TensorDataset(torch.zeros(6, 2), torch.zeros(5))   # 6 inputs but 5 labels
```

### Your own Dataset

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

### Eager or lazy loading

`FruitDataset` loads everything in `__init__` (**eager**): fine when the data fits in memory. For large data such as images, `__init__` only stores the file **paths**, and `__getitem__` opens the one file it needs (**lazy**):

```py-static
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

### Subset, ConcatDataset and random_split

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

```python error
import torch
from torch.utils.data import TensorDataset, random_split

random_split(TensorDataset(torch.arange(10)), [6, 3])   # 9 isn't 10
```

With fractions, PyTorch rounds each piece down and hands the leftover samples out one at a time from the first piece: 11 samples split `[0.6, 0.2, 0.2]` gives `[7, 2, 2]`. Splitting with a fixed seed matters: if the split changed every run, validation samples would leak into training across runs and your scores couldn't be compared.

:::exercise A dataset of squares
Write a map-style dataset class `Squares(Dataset)` whose constructor takes `n`. It has `n` samples; sample `i` is the tuple `(x, y)` where `x` is `torch.tensor([float(i)])` (shape `[1]`, float32) and `y` is `torch.tensor([float(i * i)])`. Indexes outside `0 … n-1` (including negative ones) must raise `IndexError`.
```python starter
import torch
from torch.utils.data import Dataset

class Squares(Dataset):
    pass

ds = Squares(5)
print(len(ds), ds[3])
```
```python check
import torch
from torch.utils.data import Dataset
cls = need("Squares")
assert isinstance(cls, type) and issubclass(cls, Dataset), "Squares should be a class that subclasses Dataset."
ds = cls(5)
assert len(ds) == 5, f"len(Squares(5)) should be 5, got {len(ds)}."
x, y = ds[3]
same(x, torch.tensor([3.0]), "ds[3][0]", ignore_dtype=False)
same(y, torch.tensor([9.0]), "ds[3][1]", ignore_dtype=False)
same(cls(100)[99][1], torch.tensor([9801.0]), "Squares(100)[99][1]")
for bad in (5, 7, -1):
    try:
        ds[bad]
    except IndexError:
        pass
    else:
        raise AssertionError(f"ds[{bad}] should raise IndexError for Squares(5).")
assert len(cls(0)) == 0, "Squares(0) should be empty."
```
```python solution
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
hint: You need three methods: `__init__` stores `n`, `__len__` returns it, `__getitem__` builds sample `i`.
hint: `torch.tensor([float(i)])` has shape `[1]` and dtype float32.
hint: Check `0 <= i < self.n` first and `raise IndexError(...)` otherwise; negative indexes count as out of range here.
approach:
1. **Understand:** implement the two-method protocol, computing samples on demand.
2. **Examples:** `Squares(5)[3]` → `(tensor([3.]), tensor([9.]))`.
3. **Brute force:** precompute all samples into a list in `__init__`: works, but costs memory for big n.
4. **Pattern:** a **lazy dataset**: compute (or load) sample i inside `__getitem__`.
5. **Plan:** store n; return it from `__len__`; range check, then build two tensors.
6. **Code and test:** index 0, the last index, n, and −1.
walkthrough:
**Line by line**

- `__init__` only stores `n`: nothing is computed up front, so `Squares(10_000_000)` is instant.
- `__len__` lets `len(ds)` (and the DataLoader) know how many samples exist.
- `__getitem__` checks the index, then builds the pair. The DataLoader only ever asks for indexes 0 to `len - 1`, but a clear error protects people who index by hand.

**Why raise IndexError?** Besides being the convention for sequences, it's what Python's old-style iteration (`for sample in ds:`) uses to know where a dataset without `__iter__` ends.

**Common wrong approach:** returning `torch.tensor(i)` (a 0-D int64 tensor). A model's linear layer needs float features with a feature dimension: shape `[1]`, float32.
:::

:::exercise Split the fruit reproducibly
Write `split_fruit(ds, seed)` that splits a dataset into training, validation and test subsets with fractions 0.7, 0.15 and 0.15, using `random_split` and a `torch.Generator` seeded with `seed`. Return the three subsets. The same seed must always give the same split, and calling it must not change PyTorch's global random numbers.
```python starter
import torch
from torch.utils.data import TensorDataset, random_split

def split_fruit(ds, seed):
    pass

ds = TensorDataset(torch.arange(90))
train, val, test = split_fruit(ds, seed=0)
print(len(train), len(val), len(test))
```
```python check
import torch
from torch.utils.data import TensorDataset, Subset
fn = need("split_fruit")
ds = TensorDataset(torch.arange(90))
parts = fn(ds, seed=0)
assert len(parts) == 3, "Return three subsets: train, val and test."
tr, va, te = parts
assert (len(tr), len(va), len(te)) == (63, 14, 13), f"90 samples split 0.7 / 0.15 / 0.15 should give 63, 14, 13, got {len(tr)}, {len(va)}, {len(te)}."
ids = [p[i][0].item() for p in parts for i in range(len(p))]
assert sorted(ids) == list(range(90)), "Every sample should be in exactly one subset."
again = fn(ds, seed=0)
assert [again[0][i][0].item() for i in range(63)] == [tr[i][0].item() for i in range(63)], "The same seed should give the same split."
other = fn(ds, seed=1)
assert [other[0][i][0].item() for i in range(63)] != [tr[i][0].item() for i in range(63)], "A different seed should give a different split."
torch.manual_seed(0); before = torch.rand(2)
torch.manual_seed(0); fn(ds, seed=5); after = torch.rand(2)
assert torch.equal(before, after), "split_fruit changed the global random numbers: pass generator= to random_split."
assert uses("random_split"), "Use random_split."
```
```python solution
import torch
from torch.utils.data import TensorDataset, random_split

def split_fruit(ds, seed):
    g = torch.Generator().manual_seed(seed)
    return random_split(ds, [0.7, 0.15, 0.15], generator=g)

ds = TensorDataset(torch.arange(90))
train, val, test = split_fruit(ds, seed=0)
print(len(train), len(val), len(test))
```
hint: `random_split(ds, [0.7, 0.15, 0.15], generator=g)` accepts fractions that add up to 1.
hint: Make the generator inside the function: `g = torch.Generator().manual_seed(seed)`.
hint: random_split returns a list of three `Subset`s; return it directly (or unpack and return a tuple).
approach:
1. **Understand:** a reproducible three-way split that leaves the global random state alone.
2. **Examples:** 90 samples × 0.7, 0.15, 0.15 → pieces of about 63, 13.5 and 13.5. (Check the walkthrough for how they're rounded.)
3. **Brute force:** shuffle indexes with `torch.randperm` and slice: also fine, more code.
4. **Pattern:** **random_split with fractions** and a **local generator**.
5. **Plan:** make a generator, call random_split, return.
6. **Code and test:** check the global random numbers are untouched.
walkthrough:
**Line by line**

- `torch.Generator().manual_seed(seed)` creates and seeds a private generator.
- `random_split(..., generator=g)` draws `torch.randperm(90, generator=g)` and cuts it into pieces. Each `Subset` keeps the original dataset plus its list of indexes.
- The lengths are 63, 14 and 13, not the 63, 13.5, 13.5 you might expect. Each fraction is rounded down: 90 × 0.7 is 62.99999999999999 in floating point, so it becomes 62, and 13.5 becomes 13 twice. That leaves 2 samples over, handed out one each to the first and second pieces: 63, 14, 13. Check `len()` of each piece rather than assuming.

**Why a local generator?** With `generator=` left out, random_split uses PyTorch's global generator: the split would then depend on whatever random calls ran before it, and it would shift the random numbers used later (for example to initialise a model).

**Common wrong approach:** `random_split(ds, [63, 13, 13])`: the lengths add up to 89, which raises `ValueError: Sum of input lengths does not equal the length of the input dataset!`
:::

:::quiz
? Which two methods must a map-style `Dataset` implement?
+ `__len__` and `__getitem__`
- `__iter__` and `__next__`
- `forward` and `backward`
- `load` and `transform`
= A map-style dataset maps an index to a sample; iterable-style datasets implement `__iter__` instead.
? `ds = TensorDataset(x, y)` with `x` of shape `[100, 4]` and `y` of shape `[100]`. What is `ds[7]`?
+ The tuple `(x[7], y[7])`, with shapes `[4]` and `[]`
- `x[7]` only
- A tensor of shape `[5]`
- A batch of 7 samples
= TensorDataset indexes every tensor along dim 0 and returns the results as a tuple.
? You split 50 samples with `random_split(ds, [0.8, 0.1, 0.1])`. What are the lengths?
+ 40, 5, 5
- 41, 5, 4
- 40, 6, 4
- It raises an error because fractions aren't allowed
= 50 × 0.8 = 40 and 50 × 0.1 = 5 exactly, so there's no remainder to distribute.
? Why should a split use `generator=torch.Generator().manual_seed(...)`?
+ So the same samples land in the same subset on every run, keeping scores comparable and validation data out of training
- Because random_split fails without a generator
- To make the split stratified by class
- To make the split faster
= Without a fixed generator the split depends on the global random state, which changes between runs.
? A dataset of 200,000 photos on disk. What should its `__init__` do?
+ Store the file paths (and labels); read each image in `__getitem__`
- Read every image into one big tensor
- Train the model
- Shuffle the images
= Lazy loading keeps memory small and lets DataLoader workers read files in parallel.
:::

@@@ lesson
id: dataloaders
title: DataLoader: batching and shuffling
minutes: 30
summary: Iterating over a DataLoader, batch_size and the last smaller batch, drop_last, len(loader), shuffle=True drawing a new order every epoch, reproducible shuffling with a generator, how default_collate stacks samples (and why Python floats become float64), batch_size=None, custom collate functions with pad_sequence for variable-length data, and a full training loop driven by DataLoaders.
---
A `DataLoader` wraps a dataset and gives you **batches**: each iteration returns the samples of one batch, stacked into tensors with a new first (batch) dimension.

```python
import torch
from torch.utils.data import TensorDataset, DataLoader

x = torch.arange(20.0).view(10, 2)
y = torch.arange(10)
loader = DataLoader(TensorDataset(x, y), batch_size=4)

print(len(loader))                       # number of batches: ceil(10 / 4)
for xb, yb in loader:
    print(xb.shape, yb.tolist())
```

![The DataLoader pipeline: a Sampler chooses indexes, a BatchSampler groups them into batches of batch_size, the Dataset returns each sample, and collate_fn stacks them into batch tensors. shuffle=True swaps in a RandomSampler with a new order every epoch; num_workers > 0 runs the Dataset and collate steps in worker processes](figures/data-pipeline.svg)

### batch_size and drop_last

The last batch holds whatever is left: 10 samples in batches of 4 gives 4, 4, 2. `drop_last=True` skips a smaller final batch, which some models need (for example batch normalization can't train on a batch of 1) and which keeps every step the same size.

```python
import torch
from torch.utils.data import TensorDataset, DataLoader

ds = TensorDataset(torch.arange(10))
print([b[0].tolist() for b in DataLoader(ds, batch_size=4)])
print([b[0].tolist() for b in DataLoader(ds, batch_size=4, drop_last=True)])
print(len(DataLoader(ds, batch_size=4, drop_last=True)))
```

### Shuffling

`shuffle=True` visits the samples in a random order, **a different one every epoch** (every time you start a new `for` loop over the loader). Shuffling the training data stops the model learning from the order of the examples, for example all the apples first. Don't shuffle validation or test data: there's no benefit, and a fixed order makes results easier to compare.

```python
import torch
from torch.utils.data import TensorDataset, DataLoader

ds = TensorDataset(torch.arange(8))
torch.manual_seed(0)
loader = DataLoader(ds, batch_size=4, shuffle=True)
for epoch in range(2):
    print(epoch, [b[0].tolist() for b in loader])

g = torch.Generator().manual_seed(7)                  # its own generator: same order every run
loader = DataLoader(ds, batch_size=4, shuffle=True, generator=g)
print([b[0].tolist() for b in loader])
```

Under the hood, `shuffle=True` makes the DataLoader use a `RandomSampler`: each epoch it draws a fresh seed and a new permutation of the indexes (lesson 3). Starting each epoch also draws a random **base seed** for worker processes, so iterating a DataLoader moves PyTorch's global random numbers on, even with `shuffle=False`. Pass `generator=` to keep the loader's randomness separate.

### Collation: how samples become a batch

The DataLoader collects `batch_size` samples into a list and passes it to `collate_fn`. The default, `default_collate`, works through the structure of the samples:

| Each sample's element is | The batch gets |
|---|---|
| a tensor of shape `[...]` | the tensors **stacked**: shape `[batch, ...]` |
| a Python `int` | an int64 tensor |
| a Python `float` | a **float64** tensor |
| a NumPy array | stacked into a tensor (dtype kept) |
| a string | a list of strings |
| a tuple / list / dict | the same structure, each field collated (tuples come back as lists) |

```python
import torch
from torch.utils.data import default_collate

batch = [(torch.tensor([1.0, 2.0]), 0, 0.5, "apple"),
         (torch.tensor([3.0, 4.0]), 1, 1.5, "lemon")]
xs, labels, weights, names = default_collate(batch)
print(xs)
print(labels, weights, names)
print(default_collate([{"x": torch.zeros(2), "y": 3}, {"x": torch.ones(2), "y": 4}]))
```

The float64 row is a classic trap: if `__getitem__` returns Python floats, the batch is float64, and a float32 model rejects it.

```python error
import torch
from torch import nn
from torch.utils.data import DataLoader

class Points(torch.utils.data.Dataset):
    def __len__(self):
        return 4
    def __getitem__(self, i):
        return [float(i), float(i) / 2]          # Python floats

xb = next(iter(DataLoader(Points(), batch_size=4)))
print(xb)
model = nn.Linear(2, 1)
model(torch.stack(xb, dim=1))                # float64 data, float32 weights
```

Return tensors (`torch.tensor([...])`, float32 by default) from `__getitem__`, or convert with `.float()`.

### Custom collate functions

Stacking needs every sample to have the **same shape**. Text and other sequences vary in length, so you write a `collate_fn` that pads them. `torch.nn.utils.rnn.pad_sequence` pads a list of 1-D tensors to the longest:

```python
import torch
from torch.nn.utils.rnn import pad_sequence
from torch.utils.data import DataLoader

sentences = [torch.tensor([5, 2, 9]), torch.tensor([7]), torch.tensor([3, 3])]
labels = [1, 0, 1]
data = list(zip(sentences, labels))

def pad_batch(batch):
    seqs, ys = zip(*batch)
    lengths = torch.tensor([len(s) for s in seqs])
    return pad_sequence(seqs, batch_first=True, padding_value=0), lengths, torch.tensor(ys)

for x, lengths, y in DataLoader(data, batch_size=3, collate_fn=pad_batch):
    print(x)
    print(lengths, y)
```

```python error
import torch
from torch.utils.data import DataLoader

sentences = [torch.tensor([5, 2, 9]), torch.tensor([7])]
next(iter(DataLoader(sentences, batch_size=2)))     # default_collate can't stack 3 and 1
```

(As the example shows, any sequence with a length and indexing works as a dataset, even a plain list.)

`batch_size=None` turns batching off: the loader then returns single samples, converting NumPy arrays to tensors but not adding a batch dimension. It's for datasets whose `__getitem__` already returns whole batches.

### A training loop with DataLoaders

This is the shape of almost every PyTorch training script: one loader per split, shuffle only the training data, and loop over batches inside the epoch loop.

```python
import torch
from torch import nn, optim
from torch.utils.data import TensorDataset, DataLoader, random_split

torch.manual_seed(0)
x = torch.randn(300, 2)
y = (x[:, 0] + x[:, 1] > 0).long()                     # label 1 above the line x0 + x1 = 0
train_ds, val_ds = random_split(TensorDataset(x, y), [0.8, 0.2], generator=torch.Generator().manual_seed(0))
train_loader = DataLoader(train_ds, batch_size=32, shuffle=True)
val_loader = DataLoader(val_ds, batch_size=64)

model = nn.Sequential(nn.Linear(2, 16), nn.ReLU(), nn.Linear(16, 2))
loss_fn = nn.CrossEntropyLoss()
opt = optim.SGD(model.parameters(), lr=0.1)

for epoch in range(5):
    model.train()
    total = 0.0
    for xb, yb in train_loader:
        opt.zero_grad()
        loss = loss_fn(model(xb), yb)
        loss.backward()
        opt.step()
        total += loss.item() * len(xb)                 # weight by batch size: the last batch is smaller
    model.eval()
    correct = 0
    with torch.no_grad():
        for xb, yb in val_loader:
            correct += (model(xb).argmax(dim=1) == yb).sum().item()
    print(f"epoch {epoch}: train loss {total / len(train_ds):.3f}, val accuracy {correct / len(val_ds):.2f}")
```

On a GPU, move each batch inside the loop: `xb, yb = xb.to(device), yb.to(device)`. The dataset stays on the CPU; only the batch being used goes to the GPU.

:::exercise Train for one epoch
Write `train_one_epoch(model, loader, loss_fn, opt)` that runs one epoch of training over `loader` (zero the gradients, forward, loss, backward, step for every batch) with the model in training mode, and returns the **average loss per sample** over the epoch as a Python float. Weight each batch's loss by its number of samples, because the last batch can be smaller.
```python starter
import torch
from torch import nn, optim
from torch.utils.data import TensorDataset, DataLoader

def train_one_epoch(model, loader, loss_fn, opt):
    pass

torch.manual_seed(0)
ds = TensorDataset(torch.randn(50, 3), torch.randint(0, 2, (50,)))
model = nn.Linear(3, 2)
print(train_one_epoch(model, DataLoader(ds, batch_size=16, shuffle=True), nn.CrossEntropyLoss(), optim.SGD(model.parameters(), lr=0.1)))
```
```python check
import copy
import torch
from torch import nn, optim
from torch.utils.data import TensorDataset, DataLoader
fn = need("train_one_epoch")
torch.manual_seed(3)
ds = TensorDataset(torch.randn(50, 3), torch.randint(0, 2, (50,)))
model = nn.Linear(3, 2)
ref = copy.deepcopy(model)
model.eval()
loss_fn = nn.CrossEntropyLoss()
got = fn(model, DataLoader(ds, batch_size=16), loss_fn, optim.SGD(model.parameters(), lr=0.1))
assert isinstance(got, float), f"Return a Python float, got {type(got).__name__}. Use .item()."
assert model.training, "Put the model in training mode with model.train()."
opt = optim.SGD(ref.parameters(), lr=0.1)
total = 0.0
for xb, yb in DataLoader(ds, batch_size=16):
    opt.zero_grad(); loss = loss_fn(ref(xb), yb); loss.backward(); opt.step(); total += loss.item() * len(xb)
want = total / 50
assert abs(got - want) < 1e-5, f"The average loss should be {want:.5f} (each batch weighted by its size: 16, 16, 16, 2), got {got:.5f}. Did you average the batch means, or forget zero_grad()?"
same(model.weight, ref.weight, "the trained weights")
```
```python solution
import torch
from torch import nn, optim
from torch.utils.data import TensorDataset, DataLoader

def train_one_epoch(model, loader, loss_fn, opt):
    model.train()
    total, count = 0.0, 0
    for xb, yb in loader:
        opt.zero_grad()
        loss = loss_fn(model(xb), yb)
        loss.backward()
        opt.step()
        total += loss.item() * len(xb)
        count += len(xb)
    return total / count

torch.manual_seed(0)
ds = TensorDataset(torch.randn(50, 3), torch.randint(0, 2, (50,)))
model = nn.Linear(3, 2)
print(train_one_epoch(model, DataLoader(ds, batch_size=16, shuffle=True), nn.CrossEntropyLoss(), optim.SGD(model.parameters(), lr=0.1)))
```
hint: Start with `model.train()`, then loop `for xb, yb in loader:`.
hint: Inside the loop: `opt.zero_grad()`, `loss = loss_fn(model(xb), yb)`, `loss.backward()`, `opt.step()`.
hint: `loss` is the mean over the batch, so add `loss.item() * len(xb)` to a total and divide by the number of samples at the end.
approach:
1. **Understand:** the standard training step, repeated over batches, plus a correctly weighted average.
2. **Examples:** batches of 16, 16, 16 and 2: a plain mean of four batch losses gives the last 2 samples the same weight as 16.
3. **Brute force:** collect batch losses in a list and average them: slightly wrong for the small last batch.
4. **Pattern:** **sum of (batch mean × batch size) ÷ total samples**.
5. **Plan:** train mode; loop; five-step update; accumulate; divide.
6. **Code and test:** compare against a manual loop with the same seed.
walkthrough:
**Line by line**

- `model.train()` switches dropout and batch-norm layers to training behaviour; a previous evaluation may have left the model in eval mode.
- The five lines inside the loop are the training step from Part 2. The DataLoader only changes where `xb` and `yb` come from.
- `loss.item() * len(xb)` turns the batch's mean loss back into a sum over its samples; dividing the grand total by the number of samples gives the true per-sample average.

**Common wrong approach:** `total += loss` without `.item()`. That keeps every batch's computation graph alive (memory grows each step) and returns a tensor instead of a number.
:::

:::exercise Pad a batch of sequences
Each sample is a tuple `(tokens, label)`: `tokens` is a 1-D int64 tensor whose length varies, `label` a Python int. Write `pad_batch(batch)` for use as a DataLoader `collate_fn`. It returns three tensors: `x`, the tokens padded with 0 into shape `[batch, longest]`; `lengths`, the original lengths (int64); and `y`, the labels (int64).
```python starter
import torch
from torch.nn.utils.rnn import pad_sequence
from torch.utils.data import DataLoader

def pad_batch(batch):
    pass

data = [(torch.tensor([4, 5, 6]), 1), (torch.tensor([7]), 0), (torch.tensor([8, 9]), 1)]
x, lengths, y = next(iter(DataLoader(data, batch_size=3, collate_fn=pad_batch)))
print(x, lengths, y, sep="\n")
```
```python check
import torch
from torch.utils.data import DataLoader
fn = need("pad_batch")
data = [(torch.tensor([4, 5, 6]), 1), (torch.tensor([7]), 0), (torch.tensor([8, 9]), 1)]
out = fn(data)
assert isinstance(out, (tuple, list)) and len(out) == 3, "Return three tensors: x, lengths, y."
x, lengths, y = out
same(x, torch.tensor([[4, 5, 6], [7, 0, 0], [8, 9, 0]]), "x", ignore_dtype=False)
same(lengths, torch.tensor([3, 1, 2]), "lengths", ignore_dtype=False)
same(y, torch.tensor([1, 0, 1]), "y", ignore_dtype=False)
batches = list(DataLoader(data + [(torch.tensor([1, 2, 3, 4, 5]), 0)], batch_size=2, collate_fn=fn))
same(batches[1][0], torch.tensor([[8, 9, 0, 0, 0], [1, 2, 3, 4, 5]]), "the second batch's x (it pads to its own longest sequence)")
same(fn([(torch.tensor([3]), 2)])[0], torch.tensor([[3]]), "a batch of one")
```
```python solution
import torch
from torch.nn.utils.rnn import pad_sequence
from torch.utils.data import DataLoader

def pad_batch(batch):
    seqs, labels = zip(*batch)
    x = pad_sequence(seqs, batch_first=True, padding_value=0)
    lengths = torch.tensor([len(s) for s in seqs])
    y = torch.tensor(labels)
    return x, lengths, y

data = [(torch.tensor([4, 5, 6]), 1), (torch.tensor([7]), 0), (torch.tensor([8, 9]), 1)]
x, lengths, y = next(iter(DataLoader(data, batch_size=3, collate_fn=pad_batch)))
print(x, lengths, y, sep="\n")
```
hint: `batch` is a list of `(tokens, label)` tuples; `seqs, labels = zip(*batch)` separates them.
hint: `pad_sequence(seqs, batch_first=True, padding_value=0)` gives `[batch, longest]`.
hint: `torch.tensor([len(s) for s in seqs])` and `torch.tensor(labels)` are int64 because the values are Python ints.
approach:
1. **Understand:** a collate function receives the list of samples for one batch and returns the batch.
2. **Examples:** lengths 3, 1, 2 → x of shape `[3, 3]` with zeros at the end of the shorter rows.
3. **Brute force:** make a zeros tensor of `[batch, longest]` and copy each sequence in with a loop: correct, just longer.
4. **Pattern:** **unzip, pad, tensorise**.
5. **Plan:** zip(*batch); pad_sequence; build lengths and labels.
6. **Code and test:** each batch pads only to its own longest sequence.
walkthrough:
**Line by line**

- `zip(*batch)` turns `[(t1, 1), (t2, 0), ...]` into `(t1, t2, ...)` and `(1, 0, ...)`.
- `pad_sequence(..., batch_first=True)` stacks into `[batch, longest]`. Without `batch_first` the result is `[longest, batch]`, the layout PyTorch's recurrent layers use by default.
- `lengths` records where the real data ends, so a model can ignore the padding (for example with a mask, or `pack_padded_sequence` for RNNs).

**Why pad per batch?** Padding every sequence to the longest in the whole dataset wastes memory and compute. Padding inside `collate_fn` only pads to the longest in each batch. (Grouping sequences of similar length into batches, called **bucketing**, reduces padding further.)

**Common wrong approach:** relying on `default_collate`, which tries to `torch.stack` the sequences and raises "stack expects each tensor to be equal size".
:::

:::quiz
? A DataLoader over 103 samples has `batch_size=10`. What is `len(loader)` with and without `drop_last=True`?
+ 10 with drop_last=True, 11 without
- 11 in both cases
- 10 in both cases
- 103 in both cases
= Without drop_last the 3 leftover samples form an 11th, smaller batch.
? What does `shuffle=True` do across epochs?
+ Visits the samples in a new random order every epoch
- Shuffles once when the DataLoader is created and reuses that order
- Shuffles the features within each sample
- Shuffles only the last batch
= A RandomSampler draws a fresh permutation every time iteration starts.
? A dataset's `__getitem__` returns `(features, label)` where `features` is a tensor of shape `[5]` and `label` a Python int. With `batch_size=8`, what does the loader yield?
+ A list `[features of shape [8, 5], labels of shape [8] (int64)]`
- A list of 8 tuples
- One tensor of shape `[8, 6]`
- A tuple `(features [5, 8], labels [8])`
= default_collate stacks the tensors on a new dim 0, turns the ints into an int64 tensor, and returns the tuple's fields as a list.
? `__getitem__` returns `[0.5, 1.2]` (Python floats). What dtype do the batched values have?
+ `torch.float64`
- `torch.float32`
- `torch.float16`
- They stay Python floats
= default_collate turns Python floats into float64 tensors; return float32 tensors from the dataset instead.
? Which is the right place to move batches to the GPU?
+ Inside the training loop: `xb, yb = xb.to(device), yb.to(device)`
- In the Dataset's `__init__`, moving the whole dataset
- In `collate_fn`, before the batch is assembled
- Nowhere: the DataLoader moves batches automatically
= The DataLoader produces CPU tensors; you move each batch to the model's device as you use it.
:::

@@@ lesson
id: samplers-and-workers
title: Samplers, workers and fast loading
minutes: 25
summary: What a sampler is, SequentialSampler, RandomSampler (with replacement), SubsetRandomSampler and BatchSampler, WeightedRandomSampler for imbalanced classes, why sampler and shuffle can't be combined, num_workers and loading in parallel, worker seeds and get_worker_info, IterableDataset and splitting a stream between workers, pin_memory with non_blocking copies, persistent_workers and prefetch_factor.
---
### Samplers

A **sampler** decides the **order of indexes** the DataLoader asks the dataset for. `shuffle=True` and `shuffle=False` are shortcuts for two built-in samplers:

| Sampler | Yields |
|---|---|
| `SequentialSampler(ds)` | 0, 1, 2, … (what `shuffle=False` uses) |
| `RandomSampler(ds)` | a random permutation each epoch (what `shuffle=True` uses) |
| `RandomSampler(ds, replacement=True, num_samples=k)` | k random indexes, repeats allowed |
| `SubsetRandomSampler(indices)` | the given indexes, shuffled |
| `WeightedRandomSampler(weights, num_samples)` | indexes drawn with probability ∝ weight |
| `BatchSampler(sampler, batch_size, drop_last)` | lists of indexes (what `batch_size=` builds for you) |

```python
import torch
from torch.utils.data import SequentialSampler, RandomSampler, SubsetRandomSampler, BatchSampler

data = range(6)
print(list(SequentialSampler(data)))
torch.manual_seed(0)
print(list(RandomSampler(data)))
print(list(RandomSampler(data, replacement=True, num_samples=8)))
print(list(SubsetRandomSampler([10, 20, 30])))
print(list(BatchSampler(SequentialSampler(data), batch_size=4, drop_last=False)))
```

Pass a sampler with `sampler=`. It replaces shuffling, so combining the two is an error:

```python error
from torch.utils.data import DataLoader, SequentialSampler

DataLoader(range(10), shuffle=True, sampler=SequentialSampler(range(10)))
```

### Imbalanced classes: WeightedRandomSampler

`fruit.csv` has 50 apples, 28 oranges and only 12 lemons. A model trained on it sees few lemons and may learn to rarely predict them. One fix is to **oversample** rare classes: give each sample the weight 1 ÷ (size of its class), so every class is drawn equally often on average.

```python
import torch
from torch.utils.data import WeightedRandomSampler

labels = torch.tensor([0] * 50 + [1] * 28 + [2] * 12)       # apple, orange, lemon
counts = torch.bincount(labels)
print(counts)
weights = 1.0 / counts[labels].float()                      # one weight per sample
sampler = WeightedRandomSampler(weights, num_samples=len(labels), replacement=True,
                                generator=torch.Generator().manual_seed(0))
drawn = labels[list(sampler)]
print(torch.bincount(drawn, minlength=3))                   # roughly equal now
```

With `replacement=True` (the default), rare samples repeat within an epoch. The other common fix is to keep the data as it is and weight the **loss** instead (lesson 5).

### Loading in parallel: num_workers

By default (`num_workers=0`) the main process fetches and collates every batch itself, so the GPU waits while each batch is read and augmented. With `num_workers=4`, four **worker processes** each load whole batches in the background and hand them over in order, while the main process trains.

![The main process's sampler picks batch indexes and sends them to worker 0 (seed = base_seed + 0) and worker 1 (seed = base_seed + 1), each with its own copy of the dataset. Workers take turns: batch 0 to worker 0, batch 1 to worker 1, and so on; the batches come back in order](figures/workers.svg)

- Workers are separate processes, each with its **own copy of the dataset**. Changes a worker makes to the dataset object never reach the main process or the other workers.
- Each worker seeds PyTorch, Python's `random` and NumPy with `base_seed + worker_id`, so random augmentation differs between workers. `base_seed` is drawn from the loader's generator each epoch.
- `torch.utils.data.get_worker_info()` returns the worker's `id`, `num_workers`, `seed` and `dataset` inside a worker, and `None` in the main process. `worker_init_fn=f` calls `f(worker_id)` when each worker starts.
- Good starting values: 2 to 8 workers, at most the number of CPU cores. More helps when loading is slow (decoding images, heavy augmentation), not for small tensors already in memory.

(This sandbox can't start processes in a browser, so it runs each worker in turn inside one process. The batches, seeds and `get_worker_info()` values are the same as PyTorch's; there's just no speed-up.)

```python
import torch
from torch.utils.data import Dataset, DataLoader, get_worker_info

class WhoLoadsMe(Dataset):
    def __len__(self):
        return 8
    def __getitem__(self, i):
        info = get_worker_info()
        return torch.tensor([i, info.id if info else -1])

print(get_worker_info())                         # None: we're in the main process
for batch in DataLoader(WhoLoadsMe(), batch_size=2, num_workers=2):
    print(batch.tolist())                        # [index, worker id]
```

### IterableDataset and workers

An `IterableDataset` defines `__iter__` instead of `__getitem__`: for data you can only read in order, such as a stream from a database or a file too big to index. It has no sampler (so no `shuffle=`), and with workers there's a trap: **every worker iterates its own full copy**, so each sample arrives `num_workers` times. Use `get_worker_info()` to give each worker a different share:

```python
import torch
from torch.utils.data import IterableDataset, DataLoader, get_worker_info

class Naive(IterableDataset):
    def __iter__(self):
        return iter(range(6))

class Sharded(IterableDataset):
    def __iter__(self):
        info = get_worker_info()
        if info is None:                                    # main process: everything
            return iter(range(6))
        return iter(range(info.id, 6, info.num_workers))    # worker k takes k, k + n, k + 2n…

print([b.tolist() for b in DataLoader(Naive(), batch_size=2, num_workers=2)])
print([b.tolist() for b in DataLoader(Sharded(), batch_size=2, num_workers=2)])
```

### Faster copies to the GPU: pin_memory

Copying a batch to the GPU is quicker from **pinned** (page-locked) CPU memory, and only pinned memory allows an **asynchronous** copy that overlaps with GPU work. `pin_memory=True` makes the loader pin every batch; then copy with `non_blocking=True`:

```python
import torch
from torch.utils.data import TensorDataset, DataLoader

ds = TensorDataset(torch.randn(8, 3), torch.arange(8))
loader = DataLoader(ds, batch_size=4, pin_memory=True)
device = "cuda" if torch.cuda.is_available() else "cpu"
for xb, yb in loader:
    print(xb.is_pinned())
    xb = xb.to(device, non_blocking=True)
    yb = yb.to(device, non_blocking=True)
print(xb.device)
```

On a machine without an accelerator, `pin_memory=True` just warns that pinned memory won't be used.

### Keeping workers alive between epochs

| Option | Effect |
|---|---|
| `persistent_workers=True` | keep the worker processes between epochs instead of starting new ones each epoch (saves start-up time; needs `num_workers > 0`) |
| `prefetch_factor=2` | batches each worker loads ahead (the default, only allowed with `num_workers > 0`) |
| `generator=g` | the loader's own random generator for shuffling and worker seeds |

A typical GPU training loader: `DataLoader(train_ds, batch_size=64, shuffle=True, num_workers=4, pin_memory=True, persistent_workers=True)`.

:::exercise Balance the classes
Write `balanced_sampler(labels, seed)` that takes a 1-D int64 tensor of class labels and returns a `WeightedRandomSampler` that draws `len(labels)` samples with replacement, where each sample's weight is 1 ÷ (number of samples of its class), using a generator seeded with `seed`.
```python starter
import torch
from torch.utils.data import WeightedRandomSampler

def balanced_sampler(labels, seed):
    pass

labels = torch.tensor([0] * 50 + [1] * 28 + [2] * 12)
idx = list(balanced_sampler(labels, seed=0))
print(len(idx), torch.bincount(labels[idx]))
```
```python check
import torch
from torch.utils.data import WeightedRandomSampler
fn = need("balanced_sampler")
labels = torch.tensor([0] * 50 + [1] * 28 + [2] * 12)
s = fn(labels, seed=0)
assert isinstance(s, WeightedRandomSampler), f"Return a WeightedRandomSampler, got {type(s).__name__}."
assert s.num_samples == 90, f"It should draw len(labels) = 90 samples, got {s.num_samples}."
assert s.replacement, "Draw with replacement."
same(s.weights.float(), (1.0 / torch.tensor([50.0] * 50 + [28.0] * 28 + [12.0] * 12)), "the weights", tol=1e-5)
assert list(fn(labels, seed=0)) == list(fn(labels, seed=0)), "The same seed should give the same draws."
big = torch.tensor([0] * 900 + [1] * 100)
counts = torch.bincount(big[list(fn(big, seed=1))], minlength=2)
assert abs(counts[0].item() - counts[1].item()) < 150, f"With 900 of class 0 and 100 of class 1, the draws should be roughly balanced, got {counts.tolist()}."
```
```python solution
import torch
from torch.utils.data import WeightedRandomSampler

def balanced_sampler(labels, seed):
    counts = torch.bincount(labels)
    weights = 1.0 / counts[labels].float()
    return WeightedRandomSampler(weights, num_samples=len(labels), replacement=True,
                                 generator=torch.Generator().manual_seed(seed))

labels = torch.tensor([0] * 50 + [1] * 28 + [2] * 12)
idx = list(balanced_sampler(labels, seed=0))
print(len(idx), torch.bincount(labels[idx]))
```
hint: `torch.bincount(labels)` counts each class: `tensor([50, 28, 12])`.
hint: `counts[labels]` looks up each sample's class size, giving one number per sample; then `1.0 / ...`.
hint: `WeightedRandomSampler(weights, num_samples=len(labels), replacement=True, generator=torch.Generator().manual_seed(seed))`.
approach:
1. **Understand:** each sample's weight is inversely proportional to its class size, so each class has the same total weight.
2. **Examples:** an apple weighs 1/50, a lemon 1/12; the 50 apples and the 12 lemons both total 1.
3. **Brute force:** a Python loop computing each weight: fine, but indexing does it in one line.
4. **Pattern:** **count, look up per sample, invert**.
5. **Plan:** bincount; index; reciprocal; construct the sampler.
6. **Code and test:** count the drawn classes; they should be roughly equal.
walkthrough:
**Line by line**

- `torch.bincount(labels)` returns the number of occurrences of 0, 1, 2…: `[50, 28, 12]`.
- `counts[labels]` is advanced indexing: for each of the 90 labels, its class's count. `1.0 / ...float()` turns counts into weights.
- The sampler draws 90 indexes with probability proportional to the weights. Each class gets total weight 1, so each is picked about a third of the time.

**Trade-off:** lemons now appear about 30 times per epoch, so the 12 lemon samples repeat (and could be overfitted); apples appear about 30 times, so some apples are skipped each epoch. Augmentation (lesson 4) helps with the repeats.

**Common wrong approach:** passing per-class weights `[1/50, 1/28, 1/12]` (3 numbers). WeightedRandomSampler needs **one weight per sample**; with 3 weights it would only ever draw indexes 0, 1 and 2.
:::

:::exercise Split a stream between workers
Write an `IterableDataset` called `Numbers` whose constructor takes `start` and `end` and which yields every integer from `start` up to (not including) `end`, as plain ints. With `num_workers > 0`, every number must still come out exactly once in total: give each worker its own share using `get_worker_info()`.
```python starter
import torch
from torch.utils.data import IterableDataset, DataLoader, get_worker_info

class Numbers(IterableDataset):
    pass

for workers in (0, 2, 3):
    got = [v for b in DataLoader(Numbers(10, 20), batch_size=3, num_workers=workers) for v in b.tolist()]
    print(workers, sorted(got))
```
```python check
import torch
from torch.utils.data import IterableDataset, DataLoader
cls = need("Numbers")
assert isinstance(cls, type) and issubclass(cls, IterableDataset), "Numbers should subclass IterableDataset."
assert sorted(cls(3, 9)) == [3, 4, 5, 6, 7, 8], "Iterating Numbers(3, 9) directly should give 3 to 8."
for workers in (0, 1, 2, 3, 4):
    got = sorted(v for b in DataLoader(cls(10, 21), batch_size=3, num_workers=workers) for v in b.tolist())
    assert got == list(range(10, 21)), f"With num_workers={workers}, the numbers 10 to 20 should each appear once, got {got}."
assert sorted(v for b in DataLoader(cls(0, 2), batch_size=3, num_workers=4) for v in b.tolist()) == [0, 1], "More workers than numbers should still work."
```
```python solution
import torch
from torch.utils.data import IterableDataset, DataLoader, get_worker_info

class Numbers(IterableDataset):
    def __init__(self, start, end):
        self.start, self.end = start, end

    def __iter__(self):
        info = get_worker_info()
        if info is None:
            return iter(range(self.start, self.end))
        return iter(range(self.start + info.id, self.end, info.num_workers))

for workers in (0, 2, 3):
    got = [v for b in DataLoader(Numbers(10, 20), batch_size=3, num_workers=workers) for v in b.tolist()]
    print(workers, sorted(got))
```
hint: Store `start` and `end` in `__init__`; `__iter__` returns an iterator (or is a generator with `yield`).
hint: `info = get_worker_info()` is `None` in the main process: then yield everything.
hint: In a worker, take every `info.num_workers`-th number starting at `start + info.id`: `range(self.start + info.id, self.end, info.num_workers)`.
approach:
1. **Understand:** each worker runs `__iter__` on its own copy, so they must agree on who yields what.
2. **Examples:** 10 to 19 with 2 workers: worker 0 yields 10, 12, …, 18; worker 1 yields 11, 13, …, 19.
3. **Brute force:** each worker takes a contiguous block (first half, second half): also correct, a little more arithmetic.
4. **Pattern:** **shard by worker id**: interleave with a step of `num_workers`.
5. **Plan:** check get_worker_info; return the full range or the worker's slice.
6. **Code and test:** 0 to 4 workers, including more workers than items.
walkthrough:
**Line by line**

- In the main process (`num_workers=0`), `get_worker_info()` returns `None`, so the dataset yields the whole range.
- In worker k of n, `range(start + k, end, n)` yields every n-th number from the k-th: the workers' shares don't overlap and together cover everything.
- A worker whose share is empty (more workers than numbers) simply yields nothing.

**Why it's needed:** each worker process receives a copy of the dataset and calls `__iter__` on it. Without sharding, 3 workers would each produce all 11 numbers, and every epoch would quietly train on triplicated data.

**Common wrong approach:** dividing the work in `__init__`. The constructor runs once in the main process, before any worker exists, so `get_worker_info()` is `None` there.
:::

:::quiz
? You pass both `shuffle=True` and `sampler=WeightedRandomSampler(...)` to a DataLoader. What happens?
+ A ValueError: sampler option is mutually exclusive with shuffle
- The sampler's draws are shuffled again
- shuffle is silently ignored
- The weights are ignored
= The sampler decides the order, so shuffle has nothing left to do; PyTorch refuses the combination.
? A dataset has 950 negative and 50 positive examples. Which DataLoader setup draws positives about as often as negatives?
+ `WeightedRandomSampler` with weight 1/950 for each negative and 1/50 for each positive
- `shuffle=True`
- `RandomSampler(ds, replacement=True)`
- `drop_last=True`
= Weights inversely proportional to class size give each class the same total probability.
? An `IterableDataset` yields 100 items and the DataLoader has `num_workers=4`. Without any use of `get_worker_info()`, how many items does one epoch produce?
+ 400
- 100
- 25
- It raises an error
= Each worker iterates its own copy of the whole dataset unless `__iter__` shards the work.
? What does `pin_memory=True` in a DataLoader do?
+ Puts each batch in page-locked CPU memory so copies to the GPU are faster and can be asynchronous with `non_blocking=True`
- Moves each batch to the GPU automatically
- Keeps the dataset in GPU memory
- Stops the operating system from swapping the model
= Pinned memory speeds up host-to-device transfers; you still call `.to(device, non_blocking=True)`.
? Inside a DataLoader worker, what does `torch.utils.data.get_worker_info()` return?
+ An object with the worker's `id`, `num_workers`, `seed` and its copy of the `dataset`
- `None`
- The batch index being loaded
- The process ID of the main process
= It returns None only in the main process.
? When does `persistent_workers=True` help?
+ When starting worker processes at the beginning of every epoch is slow
- When num_workers is 0
- When the dataset doesn't fit in memory
- When batches have different sizes
= It keeps the workers (and their dataset copies) alive between epochs; it requires num_workers > 0.
:::

@@@ lesson
id: transforms
title: Transforms and augmentation
minutes: 25
summary: What a transform is, torchvision.transforms.v2, tv_tensors.Image and the CHW layout, ToImage, ToDtype with scale=True, Normalize with per-channel mean and std, Compose, data augmentation with RandomHorizontalFlip and RandomCrop, separate training and evaluation pipelines, applying transforms in a Dataset with transform and target_transform, and computing normalisation statistics.
---
A **transform** is a function applied to each sample as it's loaded: converting it to a tensor, scaling it, or randomly changing it. For images, PyTorch's companion library **torchvision** provides them in `torchvision.transforms.v2` (the current API; the older `torchvision.transforms` still works but v2 is recommended).

The sandbox includes the core v2 transforms. Real torchvision has many more (resizing, colour jitter, rotations, `RandomResizedCrop`, `AutoAugment`), all used the same way.

### Turning an image into a model input

Images usually arrive as uint8 values 0–255 in height × width × channels order (that's how PIL and NumPy store them). Models want float32, channels first, and roughly zero-centred values. Three transforms do that:

| Transform | Does |
|---|---|
| `v2.ToImage()` | NumPy array, PIL image or tensor → `tv_tensors.Image`, channels first `[C, H, W]` (dtype unchanged) |
| `v2.ToDtype(torch.float32, scale=True)` | uint8 0–255 → float32 0–1 (`scale=True` divides by 255) |
| `v2.Normalize(mean, std)` | `(x − mean) / std` for each channel |

`v2.Compose([...])` chains them.

```python
import numpy as np
import torch
from torchvision.transforms import v2

pixels = np.array([[[255, 0, 0], [0, 255, 0]],
                   [[0, 0, 255], [128, 128, 128]]], dtype=np.uint8)   # a 2 × 2 RGB image, H × W × C
img = v2.ToImage()(pixels)
print(type(img).__name__, img.shape, img.dtype)
scaled = v2.ToDtype(torch.float32, scale=True)(img)
print(scaled[0])                                    # the red channel, 0 to 1
normalize = v2.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5])
print(normalize(scaled)[0])                         # now -1 to 1

to_model = v2.Compose([v2.ToImage(), v2.ToDtype(torch.float32, scale=True), normalize])
print(to_model)
```

`tv_tensors.Image` is a tensor subclass that tells the transforms "this is an image" (others mark bounding boxes and masks, so geometry transforms move them together). Do maths on it like any tensor; the result of most operations is a plain tensor.

Normalize needs a float image; on uint8 it raises an error, so `ToDtype` always comes first:

```python error
import torch
from torchvision.transforms import v2

v2.Normalize([0.5], [0.5])(torch.zeros(1, 2, 2, dtype=torch.uint8))
```

The older `transforms.ToTensor()` did ToImage and ToDtype in one step. In v2 it's deprecated: use `v2.Compose([v2.ToImage(), v2.ToDtype(torch.float32, scale=True)])`.

### Normalisation statistics

`mean` and `std` are **per channel**, computed over the **training** images (after scaling to 0–1). The widely copied values `mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]` are ImageNet's: use them when fine-tuning a model pretrained on ImageNet, so your inputs match what it learned on.

```python
import torch

torch.manual_seed(0)
images = torch.randint(0, 256, (100, 3, 8, 8), dtype=torch.uint8)    # stand-in training images
x = images.float() / 255
mean = x.mean(dim=(0, 2, 3))                 # average over images, height and width: one per channel
std = x.std(dim=(0, 2, 3))
print(mean, std)
```

### Data augmentation

**Augmentation** applies small random changes to training images, so the model sees a slightly different version of each image every epoch. It acts like extra data and reduces overfitting. The changes must keep the label true: a horizontally flipped cat is still a cat, but a flipped "6" might read as something else, so choose augmentations that suit the data.

```python
import torch
from torchvision.transforms import v2

img = torch.arange(16, dtype=torch.uint8).view(1, 4, 4)     # 1 channel, 4 × 4
torch.manual_seed(0)
flip = v2.RandomHorizontalFlip(p=0.5)                         # flips with probability 0.5
for _ in range(3):
    print(flip(img)[0, 0].tolist())                           # the first row: flipped or not
crop = v2.RandomCrop(size=3, padding=1)                       # pad by 1 pixel, then cut a random 3 × 3
print(crop(img))
```

Random transforms draw from PyTorch's random generator, so `torch.manual_seed` makes them repeatable (inside DataLoader workers, each worker's own seed is used).

### Training and evaluation pipelines

Augment only the **training** data. Validation and test data must be deterministic, so scores are comparable between epochs and reflect real use. Both pipelines share the conversion and the **same** normalisation:

```python
import torch
from torchvision.transforms import v2

mean, std = [0.5], [0.25]
train_tf = v2.Compose([
    v2.ToImage(),
    v2.RandomHorizontalFlip(),
    v2.RandomCrop(28, padding=2),
    v2.ToDtype(torch.float32, scale=True),
    v2.Normalize(mean, std),
])
eval_tf = v2.Compose([
    v2.ToImage(),
    v2.ToDtype(torch.float32, scale=True),
    v2.Normalize(mean, std),
])
print(eval_tf)
```

Geometric transforms such as flips and crops go **before** `ToDtype` and `Normalize` (they're cheaper on uint8, and padding then fills with true black, 0).

### Transforms inside a Dataset

The convention, followed by every torchvision dataset, is a `transform` argument applied to the input and a `target_transform` applied to the label, both inside `__getitem__`. Because they run per sample, a random transform gives a new variation every time the sample is loaded, which is every epoch.

```python
import torch
from torch.utils.data import Dataset, DataLoader
from torchvision.transforms import v2

class TinyImages(Dataset):
    def __init__(self, images, labels, transform=None, target_transform=None):
        self.images, self.labels = images, labels
        self.transform, self.target_transform = transform, target_transform

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, i):
        image, label = self.images[i], self.labels[i]
        if self.transform:
            image = self.transform(image)
        if self.target_transform:
            label = self.target_transform(label)
        return image, label

torch.manual_seed(0)
images = torch.randint(0, 256, (6, 1, 4, 4), dtype=torch.uint8)
labels = [0, 1, 0, 1, 1, 0]
tf = v2.Compose([v2.RandomHorizontalFlip(), v2.ToDtype(torch.float32, scale=True)])
ds = TinyImages(images, labels, transform=tf, target_transform=lambda y: torch.tensor(y, dtype=torch.float32))
xb, yb = next(iter(DataLoader(ds, batch_size=3)))
print(xb.shape, xb.dtype, yb)
```

A transform given only a plain tensor treats it as the image; given a sample like `(image, label)`, v2 transforms change the image and pass the label through untouched.

:::exercise Build the two pipelines
Make `train_tf` and `eval_tf` for 1-channel 28 × 28 images arriving as uint8 NumPy arrays of shape `(28, 28)`. Both must output a float32 tensor of shape `[1, 28, 28]` normalised with `mean=[0.2860]` and `std=[0.3530]`. `train_tf` also augments: a random horizontal flip, then `RandomCrop(28, padding=4)`. Put the augmentations before the dtype conversion.
```python starter
import numpy as np
import torch
from torchvision.transforms import v2

train_tf = None
eval_tf = None

img = np.random.default_rng(0).integers(0, 256, (28, 28), dtype=np.uint8)
print(eval_tf(img).shape, eval_tf(img).dtype)
```
```python check
import numpy as np
import torch
from torchvision.transforms import v2
tr, ev = need("train_tf"), need("eval_tf")
img = np.random.default_rng(1).integers(0, 256, (28, 28), dtype=np.uint8)
out = ev(img)
assert isinstance(out, torch.Tensor), "eval_tf should return a tensor."
assert tuple(out.shape) == (1, 28, 28) and out.dtype == torch.float32, f"eval_tf should give float32 [1, 28, 28], got {out.dtype} {list(out.shape)}."
want = (torch.from_numpy(img).float().unsqueeze(0) / 255 - 0.2860) / 0.3530
same(out.detach().clone() * 1, want, "eval_tf(img)", tol=1e-5)
same(ev(img) * 1, out * 1, "eval_tf run twice (it must be deterministic)")
names = [type(t).__name__ for t in tr.transforms]
for n in ("RandomHorizontalFlip", "RandomCrop", "ToDtype", "Normalize"):
    assert n in names, f"train_tf should include {n}."
assert names.index("RandomCrop") < names.index("ToDtype") and names.index("RandomHorizontalFlip") < names.index("ToDtype"), "Put the flip and crop before ToDtype."
assert not any(n.startswith("Random") for n in (type(t).__name__ for t in ev.transforms)), "eval_tf must not augment."
torch.manual_seed(0)
outs = [tr(img) for _ in range(6)]
assert all(tuple(o.shape) == (1, 28, 28) and o.dtype == torch.float32 for o in outs), "train_tf should also give float32 [1, 28, 28]."
assert any(not torch.equal(outs[0], o) for o in outs[1:]), "train_tf should give different results on different calls."
crop = [t for t in tr.transforms if type(t).__name__ == "RandomCrop"][0]
assert crop.size == (28, 28) and crop.padding == [4, 4, 4, 4], "Use RandomCrop(28, padding=4)."
```
```python solution
import numpy as np
import torch
from torchvision.transforms import v2

mean, std = [0.2860], [0.3530]
train_tf = v2.Compose([
    v2.ToImage(),
    v2.RandomHorizontalFlip(),
    v2.RandomCrop(28, padding=4),
    v2.ToDtype(torch.float32, scale=True),
    v2.Normalize(mean, std),
])
eval_tf = v2.Compose([
    v2.ToImage(),
    v2.ToDtype(torch.float32, scale=True),
    v2.Normalize(mean, std),
])

img = np.random.default_rng(0).integers(0, 256, (28, 28), dtype=np.uint8)
print(eval_tf(img).shape, eval_tf(img).dtype)
```
hint: `v2.ToImage()` turns a `(28, 28)` array into an Image of shape `[1, 28, 28]`.
hint: The order for training: ToImage, RandomHorizontalFlip, RandomCrop, ToDtype, Normalize.
hint: The evaluation pipeline is the same without the two random transforms.
approach:
1. **Understand:** two Compose pipelines sharing conversion and normalisation; only one augments.
2. **Examples:** a pixel of 255 → 1.0 → (1 − 0.286) / 0.353 ≈ 2.02.
3. **Brute force:** write the conversion by hand with NumPy and division: it works, but transforms compose and document themselves.
4. **Pattern:** **convert → augment → scale → normalise**, with augmentation only in training.
5. **Plan:** list the transforms in order inside `v2.Compose`.
6. **Code and test:** eval_tf twice gives the same result; train_tf varies.
walkthrough:
**Line by line**

- `ToImage()` converts the NumPy array to a `tv_tensors.Image`, adding the channel dimension: `[1, 28, 28]`, still uint8.
- `RandomHorizontalFlip()` flips with probability 0.5; `RandomCrop(28, padding=4)` pads to 36 × 36 with zeros and cuts a random 28 × 28 window, so the digit or garment shifts by up to 4 pixels.
- `ToDtype(torch.float32, scale=True)` divides by 255; `Normalize` subtracts 0.2860 and divides by 0.3530.

**Why the same normalisation in both?** The model learns on normalised inputs; evaluating on differently scaled inputs would shift every value it sees.

**Common wrong approach:** augmenting the evaluation pipeline too. Validation scores then change from run to run and no longer measure performance on real, unaltered inputs.
:::

:::exercise Compute per-channel statistics
Write `channel_stats(images)` where `images` is a uint8 tensor of shape `[N, C, H, W]`. Return `(mean, std)`: two float32 tensors of shape `[C]` with each channel's mean and standard deviation over all images and pixels, after scaling to 0–1 (divide by 255). Use the population standard deviation (`correction=0`).
```python starter
import torch

def channel_stats(images):
    pass

torch.manual_seed(0)
imgs = torch.randint(0, 256, (10, 3, 4, 4), dtype=torch.uint8)
print(channel_stats(imgs))
```
```python check
import torch
fn = need("channel_stats")
torch.manual_seed(4)
imgs = torch.randint(0, 256, (12, 3, 5, 6), dtype=torch.uint8)
out = fn(imgs)
assert isinstance(out, tuple) and len(out) == 2, "Return a tuple (mean, std)."
m, s = out
x = imgs.float() / 255
same(m, torch.stack([x[:, c].mean() for c in range(3)]), "mean", tol=1e-5)
same(s, torch.stack([x[:, c].std(correction=0) for c in range(3)]), "std", tol=1e-5)
assert m.dtype == torch.float32 and s.dtype == torch.float32, "Return float32 tensors."
two = torch.zeros(2, 1, 2, 2, dtype=torch.uint8); two[1] = 255
m2, s2 = fn(two)
same(m2, torch.tensor([0.5]), "the mean of half-black, half-white images")
same(s2, torch.tensor([0.5]), "the population std of half-black, half-white images (correction=0)")
```
```python solution
import torch

def channel_stats(images):
    x = images.float() / 255
    mean = x.mean(dim=(0, 2, 3))
    std = x.std(dim=(0, 2, 3), correction=0)
    return mean, std

torch.manual_seed(0)
imgs = torch.randint(0, 256, (10, 3, 4, 4), dtype=torch.uint8)
print(channel_stats(imgs))
```
hint: Convert first: `images.float() / 255`. (`mean()` doesn't work on uint8.)
hint: To get one value per channel, reduce over every other dimension: `dim=(0, 2, 3)`.
hint: `x.std(dim=(0, 2, 3), correction=0)` gives the population standard deviation.
approach:
1. **Understand:** per-channel statistics over images, height and width.
2. **Examples:** half the images all black and half all white → mean 0.5, population std 0.5.
3. **Brute force:** loop over channels and compute each one: fine for 3 channels.
4. **Pattern:** **reduce over a tuple of dims**, keeping the channel dim.
5. **Plan:** scale to float; mean and std over dims 0, 2, 3.
6. **Code and test:** compare against a per-channel loop.
walkthrough:
**Line by line**

- `images.float() / 255` gives float32 values in 0–1, matching what `ToDtype(..., scale=True)` produces, so the statistics apply to the transformed images.
- `dim=(0, 2, 3)` reduces over images, rows and columns at once; the channel dimension (1) is the only one left: shape `[C]`.
- `correction=0` divides by the number of values; PyTorch's default `std()` divides by n − 1, which barely differs with millions of pixels but matters on tiny tests.

**Big datasets:** when the images don't fit in memory together, add up the per-batch sums of `x` and `x ** 2` while looping over a DataLoader, then compute `mean = Σx / n` and `std = sqrt(Σx² / n − mean²)`.

**Common wrong approach:** `x.mean()` with no dim: one number for all channels, when red, green and blue usually have different averages.
:::

:::quiz
? What does `v2.ToDtype(torch.float32, scale=True)` do to a uint8 image?
+ Converts it to float32 and divides by 255, so values are in 0–1
- Converts it to float32 and leaves the values 0–255
- Normalises it to mean 0 and standard deviation 1
- Converts it to float32 and multiplies by 255
= scale=True rescales the value range between integer and float dtypes.
? Which transform belongs in the training pipeline but NOT the validation pipeline?
+ `v2.RandomHorizontalFlip()`
- `v2.ToImage()`
- `v2.ToDtype(torch.float32, scale=True)`
- `v2.Normalize(mean, std)`
= Random augmentation is for training only; conversion and normalisation must be identical in both.
? You fine-tune a model pretrained on ImageNet. Which normalisation should you use?
+ ImageNet's mean and std, `[0.485, 0.456, 0.406]` and `[0.229, 0.224, 0.225]`
- `mean=[0, 0, 0], std=[1, 1, 1]`
- Your dataset's mean and std, computed over train and test together
- No normalisation, because the model is pretrained
= Inputs should match the distribution the pretrained weights were trained on.
? Where is data augmentation usually applied?
+ In the Dataset's `__getitem__`, through its `transform`, so each epoch sees a new random variation
- Once, before training, saving the augmented images to disk
- In the model's `forward`
- In the optimizer
= Per-sample, per-load transforms give fresh variations every epoch.
? An image tensor has shape `[3, 32, 32]` and dtype uint8. What happens with `v2.Normalize(mean, std)` applied directly?
+ A TypeError: Normalize needs a float tensor
- It normalises the 0–255 values
- It converts to float automatically
- It normalises only the first channel
= Convert with `ToDtype(torch.float32, scale=True)` first.
:::

@@@ lesson
id: data-quality
title: Data quality and leakage
minutes: 25
summary: Why data problems are silent, checking a raw file (missing values, impossible values, inconsistent labels, wrong units, duplicates), NaN in tensors, data leakage (statistics fitted on all the data, duplicates across splits, splitting after augmenting), stratified splits, class imbalance and class-weighted losses, and sanity checks on the first batch, including overfitting one batch.
---
A code bug usually raises an error. A **data** bug usually doesn't: the model trains, the loss goes down, and the results are quietly wrong. This lesson collects the checks that catch them.

### Look at the raw data first

`fruit_raw.csv` is a messy export of the fruit data. Read it with Python's `csv` module and check every column before turning anything into tensors.

```python
import csv
from collections import Counter

with open("fruit_raw.csv", newline="") as f:
    rows = list(csv.DictReader(f))
print(len(rows), "rows")
print(Counter(r["fruit"] for r in rows))                  # spot inconsistent labels

missing = [i for i, r in enumerate(rows) if any(v.strip() == "" for v in r.values())]
print("rows with a missing value:", missing)

weights = [float(r["weight_g"]) for r in rows if r["weight_g"]]
diameters = [float(r["diameter_cm"]) for r in rows]
print("weight range:", min(weights), max(weights))       # a negative weight is impossible
print("diameter range:", min(diameters), max(diameters)) # 71 cm is a fruit measured in mm

seen, dupes = set(), 0
for r in rows:
    key = tuple(r.values())
    dupes += key in seen
    seen.add(key)
print("exact duplicates:", dupes)
```

| Problem | What it does to a model | Typical fix |
|---|---|---|
| missing value | `float("")` crashes, or a NaN spreads through training | drop the row, or fill (impute) with a training-set statistic |
| impossible value (negative weight) | drags the learned pattern | drop or correct it |
| inconsistent label ("Apple " vs "apple") | an extra, tiny class | normalise text: `.strip().lower()` |
| wrong unit (mm in a cm column) | one huge outlier dominates | fix the unit, or drop |
| duplicates | over-weights some samples; leaks across splits | remove before splitting |

### NaN in tensors

One NaN in the inputs makes the loss NaN, and then every weight becomes NaN after the next step. Check tensors with `torch.isnan` (and `torch.isfinite` for infinities too):

```python
import torch

x = torch.tensor([[1.0, 2.0], [float("nan"), 4.0], [5.0, float("inf")]])
print(torch.isnan(x).any(), torch.isfinite(x).all())
bad_rows = ~torch.isfinite(x).all(dim=1)
print(bad_rows)
print(x[~bad_rows])                         # keep only fully finite rows
print(torch.nan_to_num(x, nan=0.0, posinf=100.0))
```

### Data leakage

**Leakage** is when information from the validation or test data reaches training. The validation score then looks better than the model will really do. Common causes:

- **Fitting statistics on all the data.** Normalisation means and standard deviations (and any vocabulary, imputation value or feature scaling) must be computed on the **training** split only, then applied to the others.
- **Duplicates across splits.** The same (or nearly the same) sample in training and test lets the model score by memory. Remove duplicates before splitting.
- **Splitting after augmenting** or after cutting one record into many (frames of one video, sentences of one document): related pieces end up on both sides. Split by the original record (by patient, user or video).
- **Using the test set to make decisions** (choosing epochs or hyperparameters): that's what the validation set is for. Touch the test set once, at the end.

![Right: compute mean and std from the training set only, and apply them to the validation set. Leak: compute them from all the data including validation, so the validation score looks better than real use will be](figures/leakage.svg)

```python
import torch
from torch.utils.data import TensorDataset, random_split

torch.manual_seed(0)
x = torch.randn(100, 3) * torch.tensor([1.0, 50.0, 0.1]) + torch.tensor([0.0, 200.0, 5.0])
train, val = random_split(TensorDataset(x), [0.8, 0.2], generator=torch.Generator().manual_seed(0))
x_train = x[train.indices]
x_val = x[val.indices]

mean = x_train.mean(dim=0)                 # from the training split only
std = x_train.std(dim=0)
x_train_n = (x_train - mean) / std
x_val_n = (x_val - mean) / std             # the same numbers applied to validation
print(x_train_n.mean(dim=0).abs().max() < 1e-4, x_train_n.std(dim=0).round(decimals=3))   # 0 and 1 by construction
print(x_val_n.mean(dim=0).round(decimals=2))   # close to 0, not exactly: that's honest
```

### Stratified splits

A random split of a small, imbalanced dataset can leave a rare class out of the validation set by chance. A **stratified** split takes the same fraction of each class:

```python
import torch

labels = torch.tensor([0] * 50 + [1] * 28 + [2] * 12)
g = torch.Generator().manual_seed(0)
train_idx, val_idx = [], []
for c in labels.unique():
    idx = torch.nonzero(labels == c).flatten()
    idx = idx[torch.randperm(len(idx), generator=g)]
    n_val = round(0.2 * len(idx))
    val_idx += idx[:n_val].tolist()
    train_idx += idx[n_val:].tolist()
print(torch.bincount(labels[val_idx]), torch.bincount(labels[train_idx]))
```

### Imbalance: weighting the loss

Besides oversampling (lesson 3), you can keep the data as it is and make mistakes on rare classes cost more. `nn.CrossEntropyLoss(weight=...)` takes one weight per class; a common choice is n ÷ (classes × count of that class):

```python
import torch
from torch import nn

labels = torch.tensor([0] * 50 + [1] * 28 + [2] * 12)
counts = torch.bincount(labels).float()
class_weights = len(labels) / (len(counts) * counts)
print(class_weights)
loss_fn = nn.CrossEntropyLoss(weight=class_weights)
logits = torch.tensor([[2.0, 0.5, 0.1], [0.3, 0.2, 1.5]])
print(loss_fn(logits, torch.tensor([0, 2])))
```

Whatever you do about imbalance, measure it properly: with 95% negatives, a model that always says "negative" scores 95% accuracy. Look at per-class accuracy, precision and recall, not just overall accuracy.

### Sanity checks before a long training run

Take one batch from the loader and check it, then check that the model can learn it.

```python
import torch
from torch import nn, optim
from torch.utils.data import TensorDataset, DataLoader

torch.manual_seed(0)
ds = TensorDataset(torch.randn(64, 4), torch.randint(0, 3, (64,)))
xb, yb = next(iter(DataLoader(ds, batch_size=16, shuffle=True)))
print(xb.shape, xb.dtype, yb.shape, yb.dtype)            # shapes and dtypes as the model expects?
print(xb.min().item() > -10, torch.isfinite(xb).all().item())   # sensible range, no NaN?
print(torch.bincount(yb, minlength=3))                   # every class appears?

model = nn.Sequential(nn.Linear(4, 64), nn.ReLU(), nn.Linear(64, 3))
opt = optim.Adam(model.parameters(), lr=0.01)
loss_fn = nn.CrossEntropyLoss()
for step in range(200):                                  # overfit this single batch
    opt.zero_grad()
    loss = loss_fn(model(xb), yb)
    loss.backward()
    opt.step()
print(round(loss.item(), 4))                             # near 0: the pipeline can learn
```

**Overfitting one batch** is the fastest end-to-end test of a pipeline: a model with enough capacity should drive the loss on 16 examples to nearly zero. If it can't, something is broken before you've spent hours training: labels misaligned with inputs, a missing `zero_grad`, a wrong loss, or a learning rate far off. Also check the first loss: for c balanced classes, a fresh classifier's cross-entropy should be about ln(c) (1.10 for 3 classes).

:::exercise Clean the raw fruit
Write `clean_rows(path)` that reads a CSV like `fruit_raw.csv` with `csv.DictReader` and returns a list of cleaned rows (dicts of strings, as DictReader gives them). Apply these steps in order: (1) normalise the `fruit` label with `.strip().lower()`; (2) drop rows with any empty value; (3) drop rows whose `weight_g` isn't positive or whose `diameter_cm` is over 20; (4) drop exact duplicates of an earlier kept row, keeping the first.
```python starter
import csv

def clean_rows(path):
    pass

rows = clean_rows("fruit_raw.csv")
print(len(rows))
print(rows[0])
```
```python check
import csv
fn = need("clean_rows")
rows = fn("fruit_raw.csv")
assert isinstance(rows, list) and rows and isinstance(rows[0], dict), "Return a list of dicts (rows from csv.DictReader)."
with open("fruit_raw.csv", newline="") as f:
    raw = list(csv.DictReader(f))
assert len(rows) == 36, f"Cleaning fruit_raw.csv should leave 36 rows (42 minus 2 with missing values, 2 with impossible values and 2 duplicates), got {len(rows)}."
labels = {r["fruit"] for r in rows}
assert labels <= {"apple", "orange", "lemon"}, f"Labels should be normalised to apple, orange and lemon, got {sorted(labels)}."
assert all(r["weight_g"] and r["sweetness"] for r in rows), "Rows with empty values should be dropped."
assert all(float(r["weight_g"]) > 0 and float(r["diameter_cm"]) <= 20 for r in rows), "Rows with impossible weights or diameters should be dropped."
assert len({tuple(r.values()) for r in rows}) == len(rows), "Duplicates should be removed."
assert rows[0] == raw[0], "Keep the rows in their original order (and keep every column as a string)."
import os
with open("tiny.csv", "w", newline="") as f:
    f.write("weight_g,diameter_cm,sweetness,colour,fruit\n100,5,3,yellow, Lemon\n100,5,3,yellow,lemon\n0,5,3,red,apple\n120,25,5,red,apple\n")
t = fn("tiny.csv")
assert len(t) == 1 and t[0]["fruit"] == "lemon", f"A ' Lemon' row and a 'lemon' row that are otherwise identical become duplicates once the label is normalised (step 1 before step 4), got {t}."
os.remove("tiny.csv")
```
```python solution
import csv

def clean_rows(path):
    with open(path, newline="") as f:
        rows = list(csv.DictReader(f))
    kept, seen = [], set()
    for r in rows:
        r["fruit"] = r["fruit"].strip().lower()
        if any(v.strip() == "" for v in r.values()):
            continue
        if float(r["weight_g"]) <= 0 or float(r["diameter_cm"]) > 20:
            continue
        key = tuple(r.values())
        if key in seen:
            continue
        seen.add(key)
        kept.append(r)
    return kept

rows = clean_rows("fruit_raw.csv")
print(len(rows))
print(rows[0])
```
hint: Read all rows with `list(csv.DictReader(f))`, then loop, `continue`-ing past the rows to drop.
hint: Missing values are empty strings: `any(v.strip() == "" for v in r.values())`.
hint: For duplicates, keep a set of `tuple(r.values())` for the rows you've kept, and normalise the label before building the tuple.
approach:
1. **Understand:** four filters, applied in a fixed order, keeping row order.
2. **Examples:** "Apple " becomes "apple"; a row with weight −152 is dropped; the second copy of a row is dropped.
3. **Brute force:** separate passes for each step, building new lists: fine, just longer.
4. **Pattern:** **one pass with guard clauses** and a **seen set** for duplicates.
5. **Plan:** normalise, check missing, check ranges, check duplicates, keep.
6. **Code and test:** 42 rows → 36; a case where normalising creates a duplicate.
walkthrough:
**Line by line**

- Normalising the label first means "Apple " and "apple" count as the same class, and that two rows differing only in that label count as duplicates.
- The missing-value check must come before `float(...)`, because `float("")` raises a ValueError.
- `float(r["weight_g"]) <= 0` catches the impossible −152 g; `diameter_cm > 20` catches the 71 cm measured in millimetres. (Dropping is the safe default; fixing the unit is better when you're sure what happened.)
- `tuple(r.values())` makes a hashable key of the whole row; a set gives O(1) lookups.

**Order matters:** if duplicates were removed before normalising labels, " Lemon" and "lemon" rows would both survive.

**Common wrong approach:** removing duplicates *after* splitting into training and test sets. Copies of the same sample then sit on both sides of the split: leakage.
:::

:::exercise Class weights for the loss
Write `class_weights(labels, n_classes)` returning a float32 tensor of shape `[n_classes]` with weight `n ÷ (n_classes × count_c)` for each class c, where n is the number of labels. A class with no samples gets weight 0 (instead of infinity). Then build `loss_fn`, an `nn.CrossEntropyLoss` using the weights for `fruit_labels`.
```python starter
import torch
from torch import nn

def class_weights(labels, n_classes):
    pass

fruit_labels = torch.tensor([0] * 50 + [1] * 28 + [2] * 12)
loss_fn = None
print(class_weights(fruit_labels, 3))
```
```python check
import torch
from torch import nn
fn = need("class_weights")
w = fn(torch.tensor([0] * 50 + [1] * 28 + [2] * 12), 3)
assert isinstance(w, torch.Tensor) and w.dtype == torch.float32, "Return a float32 tensor."
same(w, torch.tensor([90 / 150, 90 / 84, 90 / 36]), "the fruit class weights")
w2 = fn(torch.tensor([0, 0, 2, 2]), 4)
same(w2, torch.tensor([0.5, 0.0, 0.5, 0.0]), "weights with two empty classes (they get 0)")
same(fn(torch.tensor([1, 1, 1]), 2), torch.tensor([0.0, 0.5]), "weights when class 0 is absent (3 / (2 × 3) = 0.5)")
lf = need("loss_fn", nn.CrossEntropyLoss)
assert lf.weight is not None, "Pass weight= to nn.CrossEntropyLoss."
same(lf.weight, w, "loss_fn.weight")
```
```python solution
import torch
from torch import nn

def class_weights(labels, n_classes):
    counts = torch.bincount(labels, minlength=n_classes).float()
    weights = len(labels) / (n_classes * counts)
    return torch.where(counts > 0, weights, torch.zeros_like(weights))

fruit_labels = torch.tensor([0] * 50 + [1] * 28 + [2] * 12)
loss_fn = nn.CrossEntropyLoss(weight=class_weights(fruit_labels, 3))
print(class_weights(fruit_labels, 3))
```
hint: `torch.bincount(labels, minlength=n_classes)` counts every class, including ones with no samples.
hint: `len(labels) / (n_classes * counts)` gives inf where a count is 0; replace those with `torch.where(counts > 0, weights, torch.zeros_like(weights))`.
hint: `nn.CrossEntropyLoss(weight=class_weights(fruit_labels, 3))`.
approach:
1. **Understand:** rare classes get large weights, common ones small, so each class contributes equally to the loss on average.
2. **Examples:** 90 labels, 3 classes, 12 lemons → 90 / 36 = 2.5.
3. **Brute force:** a loop over classes with an if for empty ones.
4. **Pattern:** **bincount with minlength**, vectorised division, `where` for the zero case.
5. **Plan:** count, divide, mask, then build the loss.
6. **Code and test:** a class that never appears gets 0.
walkthrough:
**Line by line**

- `torch.bincount(labels, minlength=n_classes)` returns one count per class even if the highest classes never appear (without `minlength`, the result stops at the largest label present).
- `.float()` makes the division produce floats; dividing by a 0 count gives `inf`.
- `torch.where(counts > 0, weights, 0)` keeps finite weights and zeroes the rest; a class with no samples never appears as a target, so its weight is never used anyway.
- `nn.CrossEntropyLoss(weight=...)` multiplies each sample's loss by its class's weight and, with the default `reduction="mean"`, divides by the sum of the weights used.

**This formula** (n ÷ (classes × count)) gives weight 1 to every class when the data is perfectly balanced. It's the same as scikit-learn's `class_weight="balanced"`.

**Common wrong approach:** weights proportional to the counts (`counts / n`), which makes the common class *more* important: the opposite of the goal.
:::

:::quiz
? You normalise features with the mean and std of the whole dataset, then split into training and validation sets. What is the problem?
+ Data leakage: validation data influenced the preprocessing, so validation scores are optimistic
- None: normalisation statistics don't depend on the data
- The training set will contain NaN values
- The model can no longer be saved
= Fit preprocessing (statistics, vocabularies, imputers) on the training split only, and apply it to the others.
? The loss becomes `nan` after a few steps. Which check should come first?
+ `torch.isfinite(x).all()` on the input batches (and the labels)
- Increase the batch size
- Switch from SGD to Adam
- Call `model.eval()`
= A single NaN or inf in the data propagates to the loss and then to every weight; also consider a too-high learning rate.
? A 3-class classifier with random weights gives a first training loss of about 7.5 on balanced data. What does that suggest?
+ Something is off: the expected starting cross-entropy is about ln(3) ≈ 1.10, so check the inputs' scale, the labels or the model's output
- Training is going well
- The batch size is too small
- The dataset is too large
= A fresh model should be close to uniform over classes; a much larger loss points to badly scaled inputs or a bug.
? Why overfit a single batch before a long training run?
+ It quickly proves the model, loss and optimizer can learn; if the loss won't approach 0 on 16 examples, the pipeline has a bug
- It's the best way to get a good final model
- It replaces the validation set
- It calculates the normalisation statistics
= A model that can't memorise one tiny batch usually has a wiring bug (labels, loss, zero_grad, learning rate).
? A rare class makes up 3% of a dataset. A random 80/20 split of 100 samples might put none of it in validation. What fixes that?
+ A stratified split, taking 20% of each class separately
- Shuffling the DataLoader
- Using drop_last=True
- Normalising the features
= Stratification preserves each class's proportion in every split.
? `nn.CrossEntropyLoss(weight=w)`: what should `w` contain?
+ One weight per class, larger for rarer classes
- One weight per sample in the batch
- One weight per model parameter
- The learning rate for each class
= The class weights multiply each sample's loss according to its target class.
:::
