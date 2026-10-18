# Lesson 16: Samplers, workers and fast loading

**You'll learn:** samplers and the order of indexes, SequentialSampler, RandomSampler with and without replacement, SubsetRandomSampler, BatchSampler, sampler and shuffle being mutually exclusive, WeightedRandomSampler for imbalanced classes, num_workers and parallel loading, worker processes with their own dataset copies and seeds, get_worker_info and worker_init_fn, IterableDataset and sharding a stream across workers, pin_memory with non_blocking copies, persistent_workers and prefetch_factor.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/pytorch/#samplers-and-workers)**: run every example and check your exercise answers.

## Key terms

- **Sampler:** an object that yields the indexes a DataLoader fetches, in order.
- **RandomSampler:** yields a random permutation of the indexes (or random indexes with replacement).
- **BatchSampler:** groups another sampler's indexes into lists of batch_size.
- **WeightedRandomSampler:** draws indexes with probability proportional to per-sample weights, usually with replacement.
- **Oversampling:** drawing rare-class samples more often so the classes are balanced during training.
- **num_workers:** how many worker processes load batches in parallel; 0 means the main process loads them.
- **get_worker_info():** inside a DataLoader worker, returns its id, num_workers, seed and dataset copy; None in the main process.
- **IterableDataset:** a dataset defined by `__iter__`, for data read as a stream rather than by index.
- **Sharding:** giving each worker a different part of the data so nothing is loaded twice.
- **Pinned memory:** page-locked CPU memory that makes copies to the GPU faster and allows non_blocking ones.
- **persistent_workers:** keeps worker processes alive between epochs instead of restarting them.

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

*This example raises an error on purpose.*

```python
from torch.utils.data import DataLoader, SequentialSampler

DataLoader(range(10), shuffle=True, sampler=SequentialSampler(range(10)))
```

## Imbalanced classes: WeightedRandomSampler

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

## Loading in parallel: num_workers

By default (`num_workers=0`) the main process fetches and collates every batch itself, so the GPU waits while each batch is read and augmented. With `num_workers=4`, four **worker processes** each load whole batches in the background and hand them over in order, while the main process trains.

![The main process's sampler picks batch indexes and sends them to worker 0 (seed = base_seed + 0) and worker 1 (seed = base_seed + 1), each with its own copy of the dataset. Workers take turns: batch 0 to worker 0, batch 1 to worker 1, and so on; the batches come back in order](../figures/workers.svg)

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

## IterableDataset and workers

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

## Faster copies to the GPU: pin_memory

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

## Keeping workers alive between epochs

| Option | Effect |
|---|---|
| `persistent_workers=True` | keep the worker processes between epochs instead of starting new ones each epoch (saves start-up time; needs `num_workers > 0`) |
| `prefetch_factor=2` | batches each worker loads ahead (the default, only allowed with `num_workers > 0`) |
| `generator=g` | the loader's own random generator for shuffling and worker seeds |

A typical GPU training loader: `DataLoader(train_ds, batch_size=64, shuffle=True, num_workers=4, pin_memory=True, persistent_workers=True)`.

## At a glance

| Concept | Code | Gives you | Remember |
|---|---|---|---|
| Choose the order | `sampler=RandomSampler(ds)` / `SequentialSampler(ds)` | the index order | can't combine with shuffle= |
| Some indexes, shuffled | `SubsetRandomSampler(idx)` | a random order of chosen indexes | for manual splits |
| Balance classes | `WeightedRandomSampler(1 / counts[labels], len(labels))` | rare classes drawn more | one weight per sample; repeats rare samples |
| Parallel loading | `num_workers=4` | batches loaded in the background | each worker: own dataset copy, seed base_seed + id |
| Who am I? | `get_worker_info()` | id, num_workers, seed, dataset | None in the main process |
| Streams | `IterableDataset` with `__iter__` | data read in order | shard by `info.id` and `info.num_workers` |
| Faster GPU copies | `pin_memory=True` + `.to(device, non_blocking=True)` | overlapped transfers | warns without an accelerator |
| Reuse workers | `persistent_workers=True` | no restart each epoch | needs num_workers > 0 |

## Common mistakes

- Passing both `sampler=` and `shuffle=True`.
- Giving WeightedRandomSampler one weight per class instead of one per sample.
- Iterating an IterableDataset with several workers without sharding, so every sample repeats per worker.
- Expecting changes a worker makes to the dataset object to be visible in the main process.
- Setting num_workers far above the number of CPU cores.
- Using pin_memory without `non_blocking=True` copies (or the other way round) and expecting overlap.

## Exercises

### 1. Balance the classes

Write `balanced_sampler(labels, seed)` that takes a 1-D int64 tensor of class labels and returns a `WeightedRandomSampler` that draws `len(labels)` samples with replacement, where each sample's weight is 1 ÷ (number of samples of its class), using a generator seeded with `seed`.

Starter code:

```python
import torch
from torch.utils.data import WeightedRandomSampler

def balanced_sampler(labels, seed):
    pass

labels = torch.tensor([0] * 50 + [1] * 28 + [2] * 12)
idx = list(balanced_sampler(labels, seed=0))
print(len(idx), torch.bincount(labels[idx]))
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** each sample's weight is inversely proportional to its class size, so each class has the same total weight.
2. **Examples:** an apple weighs 1/50, a lemon 1/12; the 50 apples and the 12 lemons both total 1.
3. **Brute force:** a Python loop computing each weight: fine, but indexing does it in one line.
4. **Pattern:** **count, look up per sample, invert**.
5. **Plan:** bincount; index; reciprocal; construct the sampler.
6. **Code and test:** count the drawn classes; they should be roughly equal.

</details>

<details>
<summary>💡 Hint 1</summary>

`torch.bincount(labels)` counts each class: `tensor([50, 28, 12])`.

</details>

<details>
<summary>💡 Hint 2</summary>

`counts[labels]` looks up each sample's class size, giving one number per sample; then `1.0 / ...`.

</details>

<details>
<summary>💡 Hint 3</summary>

`WeightedRandomSampler(weights, num_samples=len(labels), replacement=True, generator=torch.Generator().manual_seed(seed))`.

</details>

### 2. Split a stream between workers

Write an `IterableDataset` called `Numbers` whose constructor takes `start` and `end` and which yields every integer from `start` up to (not including) `end`, as plain ints. With `num_workers > 0`, every number must still come out exactly once in total: give each worker its own share using `get_worker_info()`.

Starter code:

```python
import torch
from torch.utils.data import IterableDataset, DataLoader, get_worker_info

class Numbers(IterableDataset):
    pass

for workers in (0, 2, 3):
    got = [v for b in DataLoader(Numbers(10, 20), batch_size=3, num_workers=workers) for v in b.tolist()]
    print(workers, sorted(got))
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** each worker runs `__iter__` on its own copy, so they must agree on who yields what.
2. **Examples:** 10 to 19 with 2 workers: worker 0 yields 10, 12, …, 18; worker 1 yields 11, 13, …, 19.
3. **Brute force:** each worker takes a contiguous block (first half, second half): also correct, a little more arithmetic.
4. **Pattern:** **shard by worker id**: interleave with a step of `num_workers`.
5. **Plan:** check get_worker_info; return the full range or the worker's slice.
6. **Code and test:** 0 to 4 workers, including more workers than items.

</details>

<details>
<summary>💡 Hint 1</summary>

Store `start` and `end` in `__init__`; `__iter__` returns an iterator (or is a generator with `yield`).

</details>

<details>
<summary>💡 Hint 2</summary>

`info = get_worker_info()` is `None` in the main process: then yield everything.

</details>

<details>
<summary>💡 Hint 3</summary>

In a worker, take every `info.num_workers`-th number starting at `start + info.id`: `range(self.start + info.id, self.end, info.num_workers)`.

</details>

**In the sandbox:** exercises 31–32. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Balance the classes</summary>

```python
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

**Line by line**

- `torch.bincount(labels)` returns the number of occurrences of 0, 1, 2…: `[50, 28, 12]`.
- `counts[labels]` is advanced indexing: for each of the 90 labels, its class's count. `1.0 / ...float()` turns counts into weights.
- The sampler draws 90 indexes with probability proportional to the weights. Each class gets total weight 1, so each is picked about a third of the time.

**Trade-off:** lemons now appear about 30 times per epoch, so the 12 lemon samples repeat (and could be overfitted); apples appear about 30 times, so some apples are skipped each epoch. Augmentation (lesson 4) helps with the repeats.

**Common wrong approach:** passing per-class weights `[1/50, 1/28, 1/12]` (3 numbers). WeightedRandomSampler needs **one weight per sample**; with 3 weights it would only ever draw indexes 0, 1 and 2.

</details>

<details>
<summary>✅ 2. Split a stream between workers</summary>

```python
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

**Line by line**

- In the main process (`num_workers=0`), `get_worker_info()` returns `None`, so the dataset yields the whole range.
- In worker k of n, `range(start + k, end, n)` yields every n-th number from the k-th: the workers' shares don't overlap and together cover everything.
- A worker whose share is empty (more workers than numbers) simply yields nothing.

**Why it's needed:** each worker process receives a copy of the dataset and calls `__iter__` on it. Without sharding, 3 workers would each produce all 11 numbers, and every epoch would quietly train on triplicated data.

**Common wrong approach:** dividing the work in `__init__`. The constructor runs once in the main process, before any worker exists, so `get_worker_info()` is `None` there.

</details>

## Quick quiz

1. You pass both `shuffle=True` and `sampler=WeightedRandomSampler(...)` to a DataLoader. What happens?
   - A) The weights are ignored
   - B) A ValueError: sampler option is mutually exclusive with shuffle
   - C) shuffle is silently ignored
   - D) The sampler's draws are shuffled again

2. A dataset has 950 negative and 50 positive examples. Which DataLoader setup draws positives about as often as negatives?
   - A) `drop_last=True`
   - B) `WeightedRandomSampler` with weight 1/950 for each negative and 1/50 for each positive
   - C) `RandomSampler(ds, replacement=True)`
   - D) `shuffle=True`

3. An `IterableDataset` yields 100 items and the DataLoader has `num_workers=4`. Without any use of `get_worker_info()`, how many items does one epoch produce?
   - A) 25
   - B) 400
   - C) 100
   - D) It raises an error

4. What does `pin_memory=True` in a DataLoader do?
   - A) Moves each batch to the GPU automatically
   - B) Keeps the dataset in GPU memory
   - C) Puts each batch in page-locked CPU memory so copies to the GPU are faster and can be asynchronous with `non_blocking=True`
   - D) Stops the operating system from swapping the model

5. Inside a DataLoader worker, what does `torch.utils.data.get_worker_info()` return?
   - A) The process ID of the main process
   - B) `None`
   - C) The batch index being loaded
   - D) An object with the worker's `id`, `num_workers`, `seed` and its copy of the `dataset`

6. When does `persistent_workers=True` help?
   - A) When the dataset doesn't fit in memory
   - B) When num_workers is 0
   - C) When starting worker processes at the beginning of every epoch is slow
   - D) When batches have different sizes

<details>
<summary>Quiz answers</summary>

1. **B) A ValueError: sampler option is mutually exclusive with shuffle**: The sampler decides the order, so shuffle has nothing left to do; PyTorch refuses the combination.
2. **B) `WeightedRandomSampler` with weight 1/950 for each negative and 1/50 for each positive**: Weights inversely proportional to class size give each class the same total probability.
3. **B) 400**: Each worker iterates its own copy of the whole dataset unless `__iter__` shards the work.
4. **C) Puts each batch in page-locked CPU memory so copies to the GPU are faster and can be asynchronous with `non_blocking=True`**: Pinned memory speeds up host-to-device transfers; you still call `.to(device, non_blocking=True)`.
5. **D) An object with the worker's `id`, `num_workers`, `seed` and its copy of the `dataset`**: It returns None only in the main process.
6. **C) When starting worker processes at the beginning of every epoch is slow**: It keeps the workers (and their dataset copies) alive between epochs; it requires num_workers > 0.

</details>

---
Previous: [Lesson 15](15-dataloaders.md) · Next: [Lesson 17: Transforms and augmentation](17-transforms.md)
