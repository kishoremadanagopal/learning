# Lesson 15: DataLoader: batching and shuffling

**You'll learn:** iterating a DataLoader, batch_size and the last smaller batch, drop_last, len(loader), shuffle=True and a new order every epoch, generator for reproducible shuffling, how iterating draws a base seed, default_collate's rules, Python floats becoming float64, custom collate_fn with pad_sequence, batch_size=None, a full training loop with training and validation loaders, moving batches to the device.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/pytorch/#dataloaders)**: run every example and check your exercise answers.

## Key terms

- **DataLoader:** iterates over a dataset in batches, handling the sampling order, batching, collation and optional worker processes.
- **Batch size:** the number of samples combined into one batch and one training step.
- **drop_last:** skips the final batch if it's smaller than batch_size.
- **Epoch:** one full pass over the training data.
- **Shuffling:** visiting the samples in a new random order each epoch.
- **Collation:** combining a list of samples into one batch; `default_collate` stacks tensors and converts numbers.
- **collate_fn:** the function a DataLoader calls to turn a list of samples into a batch; replace it for data that can't simply be stacked.
- **Padding:** filling shorter sequences with a pad value so they can share one tensor.
- **pad_sequence:** pads a list of variable-length tensors to the longest one (`torch.nn.utils.rnn`).

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

![The DataLoader pipeline: a Sampler chooses indexes, a BatchSampler groups them into batches of batch_size, the Dataset returns each sample, and collate_fn stacks them into batch tensors. shuffle=True swaps in a RandomSampler with a new order every epoch; num_workers > 0 runs the Dataset and collate steps in worker processes](../figures/data-pipeline.svg)

## batch_size and drop_last

The last batch holds whatever is left: 10 samples in batches of 4 gives 4, 4, 2. `drop_last=True` skips a smaller final batch, which some models need (for example batch normalization can't train on a batch of 1) and which keeps every step the same size.

```python
import torch
from torch.utils.data import TensorDataset, DataLoader

ds = TensorDataset(torch.arange(10))
print([b[0].tolist() for b in DataLoader(ds, batch_size=4)])
print([b[0].tolist() for b in DataLoader(ds, batch_size=4, drop_last=True)])
print(len(DataLoader(ds, batch_size=4, drop_last=True)))
```

## Shuffling

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

## Collation: how samples become a batch

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

*This example raises an error on purpose.*

```python
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

## Custom collate functions

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

*This example raises an error on purpose.*

```python
import torch
from torch.utils.data import DataLoader

sentences = [torch.tensor([5, 2, 9]), torch.tensor([7])]
next(iter(DataLoader(sentences, batch_size=2)))     # default_collate can't stack 3 and 1
```

(As the example shows, any sequence with a length and indexing works as a dataset, even a plain list.)

`batch_size=None` turns batching off: the loader then returns single samples, converting NumPy arrays to tensors but not adding a batch dimension. It's for datasets whose `__getitem__` already returns whole batches.

## A training loop with DataLoaders

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

## At a glance

| Concept | Code | Gives you | Remember |
|---|---|---|---|
| Batches | `DataLoader(ds, batch_size=32)` | tensors with a batch dim | last batch may be smaller |
| Equal-sized batches | `drop_last=True` | len = n // batch_size | the leftover samples are skipped that epoch |
| Training order | `shuffle=True` | a new permutation each epoch | don't shuffle validation or test |
| Reproducible order | `generator=torch.Generator().manual_seed(0)` | the same shuffles every run | iterating also draws a base seed |
| Default batching | `default_collate` | stacked tensors; ints → int64, floats → float64 | tuples come back as lists |
| Variable lengths | `collate_fn=pad_batch` with `pad_sequence(..., batch_first=True)` | `[batch, longest]` | pad per batch, keep the lengths |
| Training loop | `for xb, yb in train_loader:` then the five steps | one epoch | `xb.to(device)` inside the loop |

## Common mistakes

- Shuffling the validation or test loader (harmless but pointless) or forgetting to shuffle the training loader.
- Averaging per-batch mean losses without weighting by batch size when the last batch is smaller.
- Returning Python floats from a dataset and getting float64 batches that a float32 model rejects.
- Using default_collate on variable-length sequences instead of a padding collate_fn.
- Moving the whole dataset to the GPU instead of each batch.
- Accumulating `loss` instead of `loss.item()`, which keeps every graph in memory.

## Exercises

### 1. Train for one epoch

Write `train_one_epoch(model, loader, loss_fn, opt)` that runs one epoch of training over `loader` (zero the gradients, forward, loss, backward, step for every batch) with the model in training mode, and returns the **average loss per sample** over the epoch as a Python float. Weight each batch's loss by its number of samples, because the last batch can be smaller.

Starter code:

```python
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

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** the standard training step, repeated over batches, plus a correctly weighted average.
2. **Examples:** batches of 16, 16, 16 and 2: a plain mean of four batch losses gives the last 2 samples the same weight as 16.
3. **Brute force:** collect batch losses in a list and average them: slightly wrong for the small last batch.
4. **Pattern:** **sum of (batch mean × batch size) ÷ total samples**.
5. **Plan:** train mode; loop; five-step update; accumulate; divide.
6. **Code and test:** compare against a manual loop with the same seed.

</details>

<details>
<summary>💡 Hint 1</summary>

Start with `model.train()`, then loop `for xb, yb in loader:`.

</details>

<details>
<summary>💡 Hint 2</summary>

Inside the loop: `opt.zero_grad()`, `loss = loss_fn(model(xb), yb)`, `loss.backward()`, `opt.step()`.

</details>

<details>
<summary>💡 Hint 3</summary>

`loss` is the mean over the batch, so add `loss.item() * len(xb)` to a total and divide by the number of samples at the end.

</details>

### 2. Pad a batch of sequences

Each sample is a tuple `(tokens, label)`: `tokens` is a 1-D int64 tensor whose length varies, `label` a Python int. Write `pad_batch(batch)` for use as a DataLoader `collate_fn`. It returns three tensors: `x`, the tokens padded with 0 into shape `[batch, longest]`; `lengths`, the original lengths (int64); and `y`, the labels (int64).

Starter code:

```python
import torch
from torch.nn.utils.rnn import pad_sequence
from torch.utils.data import DataLoader

def pad_batch(batch):
    pass

data = [(torch.tensor([4, 5, 6]), 1), (torch.tensor([7]), 0), (torch.tensor([8, 9]), 1)]
x, lengths, y = next(iter(DataLoader(data, batch_size=3, collate_fn=pad_batch)))
print(x, lengths, y, sep="\n")
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a collate function receives the list of samples for one batch and returns the batch.
2. **Examples:** lengths 3, 1, 2 → x of shape `[3, 3]` with zeros at the end of the shorter rows.
3. **Brute force:** make a zeros tensor of `[batch, longest]` and copy each sequence in with a loop: correct, just longer.
4. **Pattern:** **unzip, pad, tensorise**.
5. **Plan:** zip(*batch); pad_sequence; build lengths and labels.
6. **Code and test:** each batch pads only to its own longest sequence.

</details>

<details>
<summary>💡 Hint 1</summary>

`batch` is a list of `(tokens, label)` tuples; `seqs, labels = zip(*batch)` separates them.

</details>

<details>
<summary>💡 Hint 2</summary>

`pad_sequence(seqs, batch_first=True, padding_value=0)` gives `[batch, longest]`.

</details>

<details>
<summary>💡 Hint 3</summary>

`torch.tensor([len(s) for s in seqs])` and `torch.tensor(labels)` are int64 because the values are Python ints.

</details>

**In the sandbox:** exercises 29–30. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Train for one epoch</summary>

```python
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

**Line by line**

- `model.train()` switches dropout and batch-norm layers to training behaviour; a previous evaluation may have left the model in eval mode.
- The five lines inside the loop are the training step from Part 2. The DataLoader only changes where `xb` and `yb` come from.
- `loss.item() * len(xb)` turns the batch's mean loss back into a sum over its samples; dividing the grand total by the number of samples gives the true per-sample average.

**Common wrong approach:** `total += loss` without `.item()`. That keeps every batch's computation graph alive (memory grows each step) and returns a tensor instead of a number.

</details>

<details>
<summary>✅ 2. Pad a batch of sequences</summary>

```python
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

**Line by line**

- `zip(*batch)` turns `[(t1, 1), (t2, 0), ...]` into `(t1, t2, ...)` and `(1, 0, ...)`.
- `pad_sequence(..., batch_first=True)` stacks into `[batch, longest]`. Without `batch_first` the result is `[longest, batch]`, the layout PyTorch's recurrent layers use by default.
- `lengths` records where the real data ends, so a model can ignore the padding (for example with a mask, or `pack_padded_sequence` for RNNs).

**Why pad per batch?** Padding every sequence to the longest in the whole dataset wastes memory and compute. Padding inside `collate_fn` only pads to the longest in each batch. (Grouping sequences of similar length into batches, called **bucketing**, reduces padding further.)

**Common wrong approach:** relying on `default_collate`, which tries to `torch.stack` the sequences and raises "stack expects each tensor to be equal size".

</details>

## Quick quiz

1. A DataLoader over 103 samples has `batch_size=10`. What is `len(loader)` with and without `drop_last=True`?
   - A) 10 with drop_last=True, 11 without
   - B) 11 in both cases
   - C) 10 in both cases
   - D) 103 in both cases

2. What does `shuffle=True` do across epochs?
   - A) Visits the samples in a new random order every epoch
   - B) Shuffles once when the DataLoader is created and reuses that order
   - C) Shuffles the features within each sample
   - D) Shuffles only the last batch

3. A dataset's `__getitem__` returns `(features, label)` where `features` is a tensor of shape `[5]` and `label` a Python int. With `batch_size=8`, what does the loader yield?
   - A) A list `[features of shape [8, 5], labels of shape [8] (int64)]`
   - B) A list of 8 tuples
   - C) One tensor of shape `[8, 6]`
   - D) A tuple `(features [5, 8], labels [8])`

4. `__getitem__` returns `[0.5, 1.2]` (Python floats). What dtype do the batched values have?
   - A) `torch.float64`
   - B) `torch.float32`
   - C) `torch.float16`
   - D) They stay Python floats

5. Which is the right place to move batches to the GPU?
   - A) Inside the training loop: `xb, yb = xb.to(device), yb.to(device)`
   - B) In the Dataset's `__init__`, moving the whole dataset
   - C) In `collate_fn`, before the batch is assembled
   - D) Nowhere: the DataLoader moves batches automatically

<details>
<summary>Quiz answers</summary>

1. **A) 10 with drop_last=True, 11 without**: Without drop_last the 3 leftover samples form an 11th, smaller batch.
2. **A) Visits the samples in a new random order every epoch**: A RandomSampler draws a fresh permutation every time iteration starts.
3. **A) A list `[features of shape [8, 5], labels of shape [8] (int64)]`**: default_collate stacks the tensors on a new dim 0, turns the ints into an int64 tensor, and returns the tuple's fields as a list.
4. **A) `torch.float64`**: default_collate turns Python floats into float64 tensors; return float32 tensors from the dataset instead.
5. **A) Inside the training loop: `xb, yb = xb.to(device), yb.to(device)`**: The DataLoader produces CPU tensors; you move each batch to the model's device as you use it.

</details>

---
Previous: [Lesson 14](14-datasets.md) · Next: [Lesson 16: Samplers, workers and fast loading](16-samplers-and-workers.md)
