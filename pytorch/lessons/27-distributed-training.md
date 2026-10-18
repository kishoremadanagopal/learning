# Lesson 27: Distributed training

**You'll learn:** why distribute training, data parallelism, all-reduce of gradients, why averaged shard gradients equal the full-batch gradient, effective batch size and learning-rate scaling, processes, world size, rank and local rank, NCCL and Gloo backends, torchrun and its environment variables, init_process_group and destroy_process_group, DistributedDataParallel and model.module, DistributedSampler (interleaving, padding, drop_last, shuffle, seed, set_epoch), rank-0 logging and saving, barrier, no_sync for gradient accumulation, Fully Sharded Data Parallel (FSDP2 fully_shard, MixedPrecisionPolicy, FSDP1), tensor and pipeline parallelism.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/pytorch/#distributed-training)**: run every example and check your exercise answers.

## Key terms

- **Data parallelism:** each GPU holds a full model copy and trains on a different part of each batch.
- **All-reduce:** a collective operation that combines (sums or averages) a tensor across all processes and gives every process the result.
- **World size:** the total number of processes in a distributed job.
- **Rank:** a process's index in the job, from 0 to world size − 1; local rank is its index on its own machine.
- **Process group:** the set of processes that communicate, created with `init_process_group`.
- **NCCL:** NVIDIA's library for fast GPU-to-GPU communication; the backend for multi-GPU training.
- **torchrun:** PyTorch's launcher, which starts the processes and sets RANK, LOCAL_RANK, WORLD_SIZE, MASTER_ADDR and MASTER_PORT.
- **Effective batch size:** batch size per GPU × number of GPUs (× accumulation steps).
- **FSDP:** Fully Sharded Data Parallel: shards parameters, gradients and optimizer state across GPUs.
- **Sharding:** splitting a tensor or state across devices so each holds only a part.

One GPU eventually becomes too slow, or too small, for a model. Distributed training spreads the work over several GPUs, on one machine or many.

(A browser can only run one process, so the sandbox's `torch.distributed` supports a single process: the API, the errors and the data splitting work as in PyTorch, and the multi-GPU scripts below are for your own machine.)

## Data parallelism

The most common strategy, **distributed data parallel (DDP)**:

1. Every GPU runs its own **process** with a **full copy** of the model.
2. Each process trains on a **different slice** of every batch.
3. After `backward()`, the processes **all-reduce** their gradients (average them across all GPUs), so every copy ends up with the same averaged gradient.
4. Every process takes the same optimizer step, so the copies stay identical.

![Four GPUs, rank 0 to 3, each with a full model copy and its own batch shard, feed an all-reduce that averages every gradient across the four processes using NCCL. Each rank then takes the same optimizer step, so the copies stay identical; DistributedSampler gives each rank different data](../figures/ddp.svg)

Averaging the gradients of equal-sized shards gives exactly the gradient of the whole batch (for a mean loss), which is why DDP trains like one big GPU:

```python
import torch
from torch import nn

torch.manual_seed(0)
model = nn.Linear(3, 1)
x, y = torch.randn(8, 3), torch.randn(8, 1)
loss_fn = nn.MSELoss()

loss_fn(model(x), y).backward()                       # one GPU, the whole batch of 8
full = model.weight.grad.clone()

grads = []
for xs, ys in zip(x.chunk(4), y.chunk(4)):            # 4 "GPUs", 2 samples each
    model.zero_grad()
    loss_fn(model(xs), ys).backward()
    grads.append(model.weight.grad.clone())
averaged = torch.stack(grads).mean(dim=0)             # what the all-reduce computes
print(torch.allclose(full, averaged))
```

**Effective batch size** = batch size per GPU × number of GPUs. With 8 GPUs and 32 samples each, every optimizer step sees 256 samples, so the learning rate often needs raising (a common rule of thumb scales it with the batch size, combined with a warm-up).

## Processes, ranks and torchrun

| Term | Meaning |
|---|---|
| **world size** | total number of processes (usually one per GPU) |
| **rank** | this process's number, 0 … world size − 1 (rank 0 usually logs and saves) |
| **local rank** | its number on this machine, used to pick the GPU |
| **backend** | the communication library: **NCCL** for NVIDIA GPUs, **Gloo** for CPUs |

`torchrun` starts the processes and sets `RANK`, `LOCAL_RANK`, `WORLD_SIZE`, `MASTER_ADDR` and `MASTER_PORT` in each one's environment:

```bash
torchrun --nproc_per_node=4 train.py                     # 4 GPUs on this machine
torchrun --nnodes=2 --nproc_per_node=8 --node_rank=0 --master_addr=10.0.0.1 --master_port=29500 train.py
```

## A DDP training script

```python
import os
import torch
import torch.distributed as dist
from torch.nn.parallel import DistributedDataParallel as DDP
from torch.utils.data import DataLoader
from torch.utils.data.distributed import DistributedSampler

def main():
    dist.init_process_group(backend="nccl")             # reads RANK, WORLD_SIZE… set by torchrun
    local_rank = int(os.environ["LOCAL_RANK"])
    torch.cuda.set_device(local_rank)
    device = torch.device("cuda", local_rank)

    model = MyModel().to(device)
    model = DDP(model, device_ids=[local_rank])        # gradients are all-reduced during backward()
    opt = torch.optim.AdamW(model.parameters(), lr=1e-3)

    sampler = DistributedSampler(train_ds, shuffle=True)    # each rank gets a different 1/world_size slice
    loader = DataLoader(train_ds, batch_size=32, sampler=sampler, num_workers=4, pin_memory=True)

    for epoch in range(epochs):
        sampler.set_epoch(epoch)                        # a different shuffle every epoch
        for xb, yb in loader:
            xb, yb = xb.to(device, non_blocking=True), yb.to(device, non_blocking=True)
            opt.zero_grad()
            loss_fn(model(xb), yb).backward()
            opt.step()
        if dist.get_rank() == 0:                        # save once, from one process
            torch.save(model.module.state_dict(), "checkpoint.pt")
        dist.barrier()                                  # others wait until the save is done

    dist.destroy_process_group()

if __name__ == "__main__":
    main()
```

Key details:

- `DDP(model)` stores the model as `model.module`: save `model.module.state_dict()` so the keys don't start with `module.`.
- Pass the sampler with `sampler=` (not `shuffle=True`, which is mutually exclusive with a sampler).
- Without `sampler.set_epoch(epoch)`, every epoch uses the **same** order.
- Only rank 0 should print, save checkpoints or write logs; use `dist.barrier()` when the others must wait.

The same calls run in the sandbox as a world of one process:

```python
import os
import torch
import torch.distributed as dist
from torch import nn
from torch.nn.parallel import DistributedDataParallel as DDP

os.environ.setdefault("MASTER_ADDR", "127.0.0.1")
os.environ.setdefault("MASTER_PORT", "29500")
dist.init_process_group(backend="gloo", rank=0, world_size=1)
print(dist.get_rank(), dist.get_world_size(), dist.get_backend())

torch.manual_seed(0)
model = DDP(nn.Linear(2, 1))
print(model)
print(list(model.state_dict().keys()))
print(list(model.module.state_dict().keys()))

t = torch.tensor([1.0, 2.0])
dist.all_reduce(t, op=dist.ReduceOp.SUM)     # with one process, the sum is the tensor itself
print(t)
dist.destroy_process_group()
```

*This example raises an error on purpose.*

```python
import torch.distributed as dist

print(dist.get_rank())        # no process group yet
```

## DistributedSampler

`DistributedSampler(dataset, num_replicas, rank, shuffle=True, seed=0, drop_last=False)` gives each rank every `world_size`-th index (after an optional shuffle seeded with `seed + epoch`). If the dataset doesn't divide evenly, it **pads** by repeating indexes from the start, so every rank gets the same number of samples and the processes stay in step; `drop_last=True` drops the remainder instead.

```python
from torch.utils.data.distributed import DistributedSampler

data = range(10)
for rank in range(3):
    print(rank, list(DistributedSampler(data, num_replicas=3, rank=rank, shuffle=False)))

s = DistributedSampler(data, num_replicas=3, rank=0, shuffle=True, seed=0)
print(list(s))
s.set_epoch(1)
print(list(s))                                   # a new shuffle for epoch 1
print(len(DistributedSampler(data, num_replicas=3, rank=0, drop_last=True)))
```

The padding means a few samples are seen twice per epoch: for exact validation metrics, evaluate on rank 0 only or account for the duplicates.

## Gradient accumulation with DDP

Every `backward()` on a DDP model triggers an all-reduce. When accumulating gradients over several micro-batches (Part 4), skip the communication on all but the last with `model.no_sync()`:

```python
for i, (xb, yb) in enumerate(loader):
    is_last = (i + 1) % accum_steps == 0
    ctx = contextlib.nullcontext() if is_last else model.no_sync()
    with ctx:
        (loss_fn(model(xb), yb) / accum_steps).backward()
    if is_last:
        opt.step()
        opt.zero_grad()
```

## When the model doesn't fit: FSDP

DDP keeps a **full copy** of the parameters, gradients and optimizer state on every GPU. With Adam in float32 that's about 16 bytes per parameter, so a 7-billion-parameter model needs over 100 GB per GPU. **Fully Sharded Data Parallel (FSDP)** splits (shards) all three across the GPUs: each GPU stores only its slice, gathers the full parameters of a layer just before using it, and frees them afterwards.

```python
from torch.distributed.fsdp import fully_shard, MixedPrecisionPolicy

mp = MixedPrecisionPolicy(param_dtype=torch.bfloat16, reduce_dtype=torch.float32)
for block in model.blocks:              # shard each transformer block…
    fully_shard(block, mp_policy=mp)
fully_shard(model, mp_policy=mp)        # …then the whole model
opt = torch.optim.AdamW(model.parameters(), lr=1e-4)   # create the optimizer after sharding
```

`fully_shard` is the current API (called **FSDP2**); the older `FullyShardedDataParallel` wrapper class (FSDP1) still appears in existing code.

| Strategy | Each GPU holds | Use when |
|---|---|---|
| DDP | a full model copy | the model fits on one GPU (the usual case) |
| FSDP | a shard of parameters, gradients and optimizer state | the model, gradients and optimizer state don't fit on one GPU |
| tensor parallel | a slice of each layer's matrices | very large layers, usually within one machine |
| pipeline parallel | a few consecutive layers | very deep models across machines |

Large language models combine several of these at once.

## At a glance

| Concept | Code | Gives you | Remember |
|---|---|---|---|
| Launch | `torchrun --nproc_per_node=4 train.py` | 4 processes with RANK, LOCAL_RANK, WORLD_SIZE | one per GPU |
| Join | `dist.init_process_group(backend="nccl")` | process group | Gloo for CPUs |
| Wrap | `DDP(model.to(device), device_ids=[local_rank])` | gradients all-reduced in backward | `model.module` is the original |
| Shard data | `DistributedSampler(ds)` + `sampler.set_epoch(epoch)` | different slice per rank | pads to equal sizes |
| Save | `if dist.get_rank() == 0: torch.save(model.module.state_dict(), path)` | one checkpoint | `dist.barrier()` to wait |
| Accumulate | `with model.no_sync():` on non-final micro-batches | fewer all-reduces | last backward syncs |
| Too big for one GPU | `fully_shard(block)` per block, then `fully_shard(model)` | sharded params, grads, optimizer state | FSDP2 |
| Clean up | `dist.destroy_process_group()` | process group closed | at the end of main |

## Common mistakes

- Forgetting `sampler.set_epoch(epoch)`, so every epoch has the same order.
- Passing `shuffle=True` to a DataLoader together with a sampler.
- Saving the checkpoint from every rank, or saving `model.state_dict()` with `module.` prefixes.
- Using the Gloo backend for GPU training (or NCCL on CPUs).
- Forgetting `torch.cuda.set_device(local_rank)`, so every process uses GPU 0.
- Not adjusting the learning rate for a larger effective batch size.
- Ignoring DistributedSampler's padding when computing exact validation metrics.
- Creating the optimizer before `fully_shard`.

## Exercises

### 1. Which samples does each rank get?

Write `shard_indices(n, world_size, rank)` returning the list of indexes that `DistributedSampler(range(n), num_replicas=world_size, rank=rank, shuffle=False)` gives to `rank`: pad the index list 0 … n − 1 by repeating it from the start until its length is a multiple of `world_size`, then take every `world_size`-th index starting at `rank`. Don't use DistributedSampler itself.

Starter code:

```python
def shard_indices(n, world_size, rank):
    pass

for rank in range(3):
    print(rank, shard_indices(10, 3, rank))
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** pad to a multiple of the world size, then interleave.
2. **Examples:** n = 10, world 3: per rank 4, total 12; padded 0 … 9, 0, 1; rank 1 gets 1, 4, 7, 0.
3. **Brute force:** contiguous blocks per rank: a valid split, but not DistributedSampler's.
4. **Pattern:** **pad cyclically, then stride by world size**.
5. **Plan:** compute sizes; pad in a loop; slice with a step.
6. **Code and test:** tiny datasets with more ranks than samples.

</details>

<details>
<summary>💡 Hint 1</summary>

Each rank gets `ceil(n / world_size)` samples, so the padded list has `ceil(n / world_size) * world_size` indexes.

</details>

<details>
<summary>💡 Hint 2</summary>

Pad by appending indexes from the start of the list; when n is smaller than the padding needed, repeat the whole list more than once.

</details>

<details>
<summary>💡 Hint 3</summary>

`indices[rank::world_size]` takes every world_size-th index starting at rank.

</details>

### 2. Simulate an all-reduce step

Write `ddp_gradients(model, loss_fn, x, y, world_size)` that simulates data-parallel training in one process: split `x` and `y` into `world_size` equal chunks along dim 0, compute each chunk's gradients separately (zero the gradients before each chunk), then average each parameter's gradients over the chunks, store the averages in the parameters' `.grad`, and return them as a list (one tensor per parameter, in `model.parameters()` order).

Starter code:

```python
import torch
from torch import nn

def ddp_gradients(model, loss_fn, x, y, world_size):
    pass

torch.manual_seed(0)
model = nn.Linear(3, 1)
x, y = torch.randn(8, 3), torch.randn(8, 1)
grads = ddp_gradients(model, nn.MSELoss(), x, y, world_size=4)
print([g.shape for g in grads])
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** each "rank" computes local gradients; the all-reduce averages them.
2. **Examples:** 12 samples, world 3: shards of 4; the average of the 3 shard gradients is the 12-sample gradient.
3. **Brute force:** one backward over everything gives the same numbers, but doesn't show the mechanism.
4. **Pattern:** **local gradients → elementwise average across ranks**.
5. **Plan:** loop over shards; clone grads; average per parameter; write back.
6. **Code and test:** compare with a full-batch gradient.

</details>

<details>
<summary>💡 Hint 1</summary>

`x.chunk(world_size)` and `y.chunk(world_size)` give each rank's shard.

</details>

<details>
<summary>💡 Hint 2</summary>

For each shard: `model.zero_grad()`, forward, loss, `backward()`, then save `[p.grad.clone() for p in params]`.

</details>

<details>
<summary>💡 Hint 3</summary>

`zip(*per_rank)` groups the same parameter's gradients across ranks; `torch.stack(...).mean(dim=0)` averages them. Assign the result to each `p.grad`.

</details>

**In the sandbox:** exercises 53–54. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Which samples does each rank get?</summary>

```python
import math

def shard_indices(n, world_size, rank):
    per_rank = math.ceil(n / world_size)
    total = per_rank * world_size
    indices = list(range(n))
    while len(indices) < total:
        indices += indices[: total - len(indices)]
    return indices[rank:total:world_size]

for rank in range(3):
    print(rank, shard_indices(10, 3, rank))
```

**Line by line**

- `math.ceil(n / world_size)` is the number of samples per rank; every rank must get the same count, or the processes would fall out of step in the all-reduce.
- The padding loop appends from the start of the list, repeating it if necessary (n = 2 with 4 ranks needs indexes 0, 1, 0, 1).
- `indices[rank:total:world_size]` interleaves: rank r gets positions r, r + w, r + 2w…

**Consequence:** with padding, some samples appear twice in an epoch (index 0 and 1 above); `drop_last=True` instead drops the tail so nothing repeats.

**Common wrong approach:** splitting into contiguous blocks with `range(rank * per_rank, (rank + 1) * per_rank)`. It also splits the data, but gives different ranks different counts at the end and doesn't match the sampler, which matters when you reason about which rank saw which sample.

</details>

<details>
<summary>✅ 2. Simulate an all-reduce step</summary>

```python
import torch
from torch import nn

def ddp_gradients(model, loss_fn, x, y, world_size):
    params = list(model.parameters())
    per_rank = []
    for xs, ys in zip(x.chunk(world_size), y.chunk(world_size)):
        model.zero_grad()
        loss_fn(model(xs), ys).backward()
        per_rank.append([p.grad.clone() for p in params])
    averaged = [torch.stack(gs).mean(dim=0) for gs in zip(*per_rank)]
    for p, g in zip(params, averaged):
        p.grad = g.clone()
    return averaged

torch.manual_seed(0)
model = nn.Linear(3, 1)
x, y = torch.randn(8, 3), torch.randn(8, 1)
grads = ddp_gradients(model, nn.MSELoss(), x, y, world_size=4)
print([g.shape for g in grads])
```

**Line by line**

- `chunk` splits the batch into equal shards, as DistributedSampler and per-rank DataLoaders do.
- `model.zero_grad()` before each shard keeps each rank's gradient separate (each real GPU starts from zero).
- `p.grad.clone()` copies the gradient, because the next shard's backward would overwrite it.
- `torch.stack(gs).mean(dim=0)` is exactly the AVG all-reduce DDP performs (NCCL sums, then DDP divides by the world size).
- With a mean loss and equal shards, the average of the shard gradients equals the gradient of the full batch.

**Why it matters:** this equality is why DDP with world size W behaves like one GPU with a W-times-larger batch, which is also why the learning rate often needs adjusting.

**Common wrong approach:** summing instead of averaging the gradients, which multiplies the effective learning rate by the world size.

</details>

## Quick quiz

1. In DistributedDataParallel, what is communicated between GPUs during `backward()`?
   - A) The model's parameters after every step
   - B) The loss values only
   - C) Gradients, which are averaged across processes with an all-reduce
   - D) The input batches

2. Training with DDP on 4 GPUs uses `batch_size=64` in each DataLoader. What is the effective batch size per optimizer step?
   - A) 256
   - B) 64
   - C) 4
   - D) 16

3. What happens if you forget `sampler.set_epoch(epoch)` with a shuffling DistributedSampler?
   - A) Every epoch uses the same shuffled order
   - B) Training raises an error
   - C) Each rank sees the whole dataset
   - D) The data isn't shuffled at all, even in the first epoch

4. Which backend should `init_process_group` use for multi-GPU training on NVIDIA GPUs?
   - A) `nccl`
   - B) `mpi`
   - C) `gloo`
   - D) `tcp`

5. When is FSDP preferable to DDP?
   - A) When the dataset is small
   - B) When the parameters, gradients and optimizer state don't fit in one GPU's memory
   - C) When training on a CPU
   - D) Always: DDP is deprecated

6. In a DDP script, which process should save the checkpoint?
   - A) Every rank, each to the same file
   - B) No rank: DDP saves automatically
   - C) Only rank 0, saving `model.module.state_dict()`
   - D) The rank with the lowest loss

7. `torchrun --nproc_per_node=4 train.py` on one machine. What does it do?
   - A) Starts 1 process that uses 4 GPUs automatically
   - B) Starts 4 processes and sets RANK, LOCAL_RANK, WORLD_SIZE and the master address and port for each
   - C) Runs train.py on 4 CPU threads
   - D) Copies the dataset 4 times

<details>
<summary>Quiz answers</summary>

1. **C) Gradients, which are averaged across processes with an all-reduce**: Each process holds full parameters and its own data; averaging gradients keeps the copies identical.
2. **A) 256**: Each of the 4 processes processes 64 samples, and their gradients are averaged into one step.
3. **A) Every epoch uses the same shuffled order**: The shuffle is seeded with seed + epoch; without set_epoch, epoch stays 0.
4. **A) `nccl`**: NCCL implements fast GPU-to-GPU collectives; Gloo is for CPUs.
5. **B) When the parameters, gradients and optimizer state don't fit in one GPU's memory**: FSDP shards them across GPUs; DDP keeps a full copy everywhere and is simpler and faster when the model fits.
6. **C) Only rank 0, saving `model.module.state_dict()`**: One writer avoids conflicts; .module avoids "module." prefixes in the keys.
7. **B) Starts 4 processes and sets RANK, LOCAL_RANK, WORLD_SIZE and the master address and port for each**: Each process then calls init_process_group and uses its LOCAL_RANK to pick a GPU.

</details>

---
Previous: [Lesson 26](26-mixed-precision.md) · Next: [Lesson 28: Exam strategy and final review](28-exam-strategy.md)
