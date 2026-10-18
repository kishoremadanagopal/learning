# Lesson 30: Mock exam 2

▶ **Take it in the [sandbox](https://kishoremadanagopal.github.io/learning/pytorch/#mock-exam-2)** for the real experience: an 80-minute timer, no feedback until you submit, then your score per domain and the lessons to review.

A fresh set of questions, none repeated from Mock exam 1. Same rules: one sitting, timer on, no notes and no running code until you've submitted.

| Domain | Exam weight | Questions here |
|---|---|---|
| PyTorch fundamentals | 38% | 15 |
| Performance and optimization | 26% | 11 |
| Model development | 20% | 8 |
| Data handling | 16% | 6 |

## Questions

**1.** What does this code print?

```python
from torch import nn

class Net(nn.Module):
    def __init__(self):
        super().__init__()
        self.layers = [nn.Linear(4, 4) for _ in range(3)]
        self.head = nn.Linear(4, 1)

print(len(list(Net().parameters())))
```

- A) `8`
- B) `4`
- C) `2`
- D) `6`

**2.** What does this code print?

```python
import torch

x = torch.tensor([[1, -2, 3], [-4, 5, -6]])
print(x[x > 0], x[:, 1])
```

- A) `tensor([1, 0, 3, 0, 5, 0]) tensor([-2,  5])`
- B) `tensor([1, 3, 5]) tensor([-4,  5, -6])`
- C) `tensor([[1, 3], [5]]) tensor([-2,  5])`
- D) `tensor([1, 3, 5]) tensor([-2,  5])`

**3.** You only need predictions and will never call `backward()`. Which context makes inference fastest?

- A) `torch.no_grad()`
- B) `torch.inference_mode()`
- C) `torch.set_grad_enabled(True)`
- D) `model.eval()` on its own

**4.** What does this code print?

```python
from torch import nn, optim

model = nn.Sequential(nn.Linear(2, 2), nn.Linear(2, 1))
opt = optim.AdamW([{"params": model[0].parameters(), "lr": 1e-4},
                   {"params": model[1].parameters()}], lr=1e-3, weight_decay=0.01)
print([g["lr"] for g in opt.param_groups], opt.param_groups[1]["weight_decay"])
```

- A) `[0.001, 0.001] 0.01`
- B) `[0.0001, 0.001] 0.0`
- C) `[0.0001, 0.0001] 0.01`
- D) `[0.0001, 0.001] 0.01`

**5.** Why can a model containing BatchNorm give different outputs for the same input in `train()` and `eval()` mode?

- A) BatchNorm adds random noise in training mode
- B) In training mode BatchNorm normalises with the current batch's statistics; in eval mode it uses the running averages
- C) BatchNorm's weights are frozen in eval mode
- D) In eval mode BatchNorm is skipped completely

**6.** What does this code print?

```python
import torch

scaler = torch.amp.GradScaler("cpu", init_scale=1024.0)
print(scaler.get_scale(), scaler.scale(torch.tensor(0.5)))
```

- A) `1024.0 tensor(0.5000)`
- B) `1024.0 tensor(0.0005)`
- C) `1024.0 tensor(512.)`
- D) `65536.0 tensor(32768.)`

**7.** A dataset contains exact duplicate rows. When should you remove them?

- A) Only in the test set
- B) After splitting, separately in each split
- C) Before splitting into training, validation and test sets
- D) Never: duplicates act as free augmentation

**8.** What does `torch.backends.cudnn.benchmark = True` do?

- A) It turns on TF32 matrix multiplications
- B) cuDNN times several convolution algorithms for each new input shape and reuses the fastest
- C) It makes convolution results bit-for-bit deterministic
- D) It prints a benchmark report after every epoch

**9.** In the profiler's table, `aten::linear` has a CPU total of 2 ms but a Self CPU time of only 0.1 ms. What does that mean?

- A) linear ran 20 times
- B) Most of its time is spent in the operations it calls (such as `aten::addmm`), not in `linear` itself
- C) 1.9 ms was spent waiting for the GPU
- D) The profiler failed to measure most of linear's time

**10.** A model's parameters, gradients and Adam state need 60 GB in total. Each GPU has 40 GB, and you have 4 GPUs. Which approach can fit the model?

- A) DDP on the 4 GPUs
- B) DDP with a batch size of 1
- C) `torch.compile`
- D) FSDP (`fully_shard`), which shards parameters, gradients and optimizer state across the GPUs

**11.** In a hand-written gradient-descent loop, why is the update written as `with torch.no_grad(): w -= lr * w.grad`?

- A) So the update isn't recorded by autograd, which also makes the in-place change to a leaf allowed
- B) So `w.grad` is reset to zero automatically
- C) Only to make the update faster; the result is the same without it
- D) Because `no_grad` computes the gradient used in the update

**12.** What does `pin_memory=True` in a DataLoader do?

- A) Keeps the whole dataset on the GPU
- B) Stops the worker processes from being restarted each epoch
- C) Returns batches in page-locked CPU memory, so copies to the GPU are faster and can overlap with computation using `non_blocking=True`
- D) Locks the random seed so batches are reproducible

**13.** What does this code print?

```python
import torch
from torch.utils.data import TensorDataset

ds = TensorDataset(torch.arange(10).float().view(5, 2), torch.arange(5))
x, y = ds[3]
print(len(ds), x, y)
```

- A) `10 tensor([6., 7.]) tensor(3)`
- B) `5 tensor([3., 4.]) tensor(3)`
- C) `5 tensor([6., 7.]) tensor(3)`
- D) `5 tensor([6., 7.]) 3`

**14.** In `nn.MultiheadAttention`, what does `True` in a boolean `key_padding_mask` mean?

- A) That key position must be attended to
- B) That key position is ignored by attention (masked out)
- C) That position's attention weight is set to 1
- D) That query position is ignored

**15.** What does this code print?

```python
import torch
from torch import nn

pred = torch.tensor([1.0, 2.0, 3.0])
target = torch.tensor([1.0, 0.0, 0.0])
print(nn.MSELoss()(pred, target), nn.L1Loss(reduction="sum")(pred, target))
```

- A) `tensor(4.3333) tensor(1.6667)`
- B) `tensor(4.3333) tensor(5.)`
- C) `tensor(2.0817) tensor(5.)`
- D) `tensor(13.) tensor(5.)`

**16.** Training runs out of GPU memory with a batch size of 64, and you want to keep 64 samples per optimizer step. What works?

- A) Calling `model.eval()` during training
- B) Raising the learning rate
- C) Batches of 16 with gradient accumulation over 4 backward passes before each optimizer step
- D) Calling `torch.cuda.empty_cache()` after every step

**17.** Your first training step with a compiled model takes 40 seconds; later steps take 50 ms. Why?

- A) The first call traces the model and generates optimised kernels; later calls reuse them
- B) The first step trains on the whole dataset
- C) torch.compile always runs the first step in float64
- D) The GPU warms up physically during the first step

**18.** What does this code print?

```python
import torch

a = torch.ones(2, requires_grad=True)
with torch.no_grad():
    b = a * 2
c = a * 2
print(b.requires_grad, c.requires_grad, a.is_leaf, c.is_leaf)
```

- A) `False True True True`
- B) `False False True False`
- C) `False True True False`
- D) `True True True False`

**19.** What does this code print?

```python
import torch
from torchvision.transforms import v2

img = torch.tensor([[[0, 128, 255]]], dtype=torch.uint8)
out = v2.ToDtype(torch.float32, scale=True)(v2.ToImage()(img))
print(out.dtype, out.max().item())
```

- A) `torch.float32 255.0`
- B) `torch.float32 0.5`
- C) `torch.uint8 255`
- D) `torch.float32 1.0`

**20.** A checkpoint saved during GPU training must be loaded on a CPU-only machine. Which call works?

- A) `torch.load("ckpt.pt", device="cpu")`
- B) `torch.load("ckpt.pt", map_location="cpu")`
- C) `torch.load("ckpt.pt").cpu()`
- D) `model.load_state_dict("ckpt.pt", map_location="cpu")`

**21.** What does this code print?

```python
import torch

print(torch.arange(1, 10, 3).tolist(), torch.linspace(0, 1, 5)[1].item())
```

- A) `[1, 3, 6, 9] 0.25`
- B) `[1, 4, 7] 0.25`
- C) `[1, 4, 7] 0.2`
- D) `[1, 4, 7, 10] 0.25`

**22.** What happens when this code runs?

```python
from torch.utils.data import DataLoader, SequentialSampler

data = list(range(10))
DataLoader(data, shuffle=True, sampler=SequentialSampler(data))
```

- A) It uses the sampler, ignoring shuffle
- B) It shuffles the order chosen by the sampler
- C) It shuffles the data, ignoring the sampler
- D) A `ValueError`: `sampler` and `shuffle` can't be used together

**23.** What does this code print?

```python
import torch
from torch import nn

emb = nn.Embedding(num_embeddings=100, embedding_dim=16)
tokens = torch.tensor([[1, 5, 9], [2, 0, 7]])
print(emb(tokens).shape, emb.weight.shape)
```

- A) `torch.Size([2, 3, 16]) torch.Size([16, 100])`
- B) `torch.Size([2, 16]) torch.Size([100, 16])`
- C) `torch.Size([2, 3, 16]) torch.Size([100, 16])`
- D) `torch.Size([6, 16]) torch.Size([100, 16])`

**24.** What does this code print?

```python
from torch import nn

model = nn.Sequential(nn.Linear(8, 8), nn.ReLU(), nn.Linear(8, 3))
model.requires_grad_(False)
model[2] = nn.Linear(8, 5)
print(sum(p.numel() for p in model.parameters() if p.requires_grad))
```

- A) `117`
- B) `0`
- C) `45`
- D) `27`

**25.** What does `torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)` do?

- A) Clamps every gradient element to the range [-1, 1]
- B) Clips the weights so their norm is at most 1.0
- C) Rescales all the gradients together so their combined norm is at most 1.0, and returns the norm before clipping
- D) Sets the learning rate to 1.0 for parameters with large gradients

**26.** An `IterableDataset` streams 1,000 records and doesn't check which worker it's running in. With `DataLoader(ds, num_workers=4)`, how many records does one epoch yield?

- A) 4,000: every worker streams all the records
- B) 1,000: the DataLoader splits the stream between the workers
- C) 250: each worker gets a quarter
- D) An error: IterableDataset doesn't support workers

**27.** What happens when this code runs?

```python
import torch

w = torch.ones(3, requires_grad=True)
w += 1
```

- A) A `RuntimeError`: an in-place operation on a leaf tensor that requires grad
- B) `w` becomes `tensor([2., 2., 2.], requires_grad=True)`
- C) A `TypeError`: tensors don't support `+=`
- D) `w` becomes `tensor([2., 2., 2.])` and stops requiring gradients

**28.** What does this code print?

```python
import torch

a = torch.randn(10, 3, 4)
b = torch.randn(4, 5)
print((a @ b).shape)
```

- A) `torch.Size([3, 5])`
- B) `torch.Size([10, 3, 5])`
- C) `torch.Size([10, 4, 5])`
- D) `torch.Size([10, 3, 4])`

**29.** What does this code print?

```python
import torch
from torch import nn

x = torch.randn(2, 8, 15, 15)
print(nn.MaxPool2d(2)(x).shape, nn.AdaptiveAvgPool2d(1)(x).shape)
```

- A) `torch.Size([2, 4, 7, 7]) torch.Size([2, 1, 1, 1])`
- B) `torch.Size([2, 8, 7, 7]) torch.Size([2, 8, 1, 1])`
- C) `torch.Size([2, 8, 7, 7]) torch.Size([2, 8])`
- D) `torch.Size([2, 8, 8, 8]) torch.Size([2, 8, 1, 1])`

**30.** In the first few iterations of float16 training, `scaler.step(optimizer)` skips the update. Why?

- A) Autocast disables updates until the loss decreases
- B) The initial scale (65536) is large enough that some gradients overflow to inf; the step is skipped and `update()` lowers the scale
- C) The learning-rate warm-up sets the rate to zero
- D) The optimizer needs a few iterations to initialise its state

**31.** In a DDP script launched with `torchrun` on a machine with 4 GPUs, what should each process use to choose its GPU?

- A) The `LOCAL_RANK` environment variable, with `torch.cuda.set_device(local_rank)`
- B) Nothing: every process should use `cuda:0`
- C) The `RANK` environment variable, which is always below 4
- D) The `WORLD_SIZE` environment variable

**32.** You profile with `schedule(wait=2, warmup=1, active=2, repeat=1)` and call `prof.step()` after each training step. How many steps are recorded in the results?

- A) 3
- B) 2
- C) 1
- D) 5

**33.** What does this code print?

```python
import torch

a = torch.tensor([1, 2], dtype=torch.int32)
print((a * torch.tensor(2.5)).dtype, (a * 2).dtype, (a + torch.tensor([1, 1])).dtype)
```

- A) `torch.float32 torch.int32 torch.int32`
- B) `torch.float32 torch.int32 torch.int64`
- C) `torch.float32 torch.int64 torch.int64`
- D) `torch.float64 torch.int64 torch.int64`

**34.** What does this code print?

```python
import torch

x = torch.tensor([[1.0, 5.0, 2.0], [7.0, 0.0, 3.0]])
print(x.argmax(dim=1), x.sum(dim=0, keepdim=True).shape)
```

- A) `tensor([1, 0]) torch.Size([3])`
- B) `tensor([1, 0]) torch.Size([2, 1])`
- C) `tensor(3) torch.Size([1, 3])`
- D) `tensor([1, 0]) torch.Size([1, 3])`

**35.** A compiled model gets batches of 32, except the last batch of each epoch, which has 7 samples. Which change avoids compiling for that odd shape?

- A) `mode="max-autotune"`
- B) `drop_last=True` in the DataLoader
- C) Wrapping the training step in `torch.no_grad()`
- D) `fullgraph=True`

**36.** What happens when this code runs?

```python
from torch import nn

nn.MultiheadAttention(embed_dim=10, num_heads=3)
```

- A) It creates a layer with 3 heads of size 10 each
- B) It creates a layer whose heads have sizes 4, 3 and 3
- C) A `TypeError`: num_heads must be a power of two
- D) An `AssertionError`: embed_dim must be divisible by num_heads

**37.** What does this code print on a machine with a CUDA GPU?

```python
import torch

x = torch.randn(4, 4, device="cuda")
with torch.autocast(device_type="cuda", dtype=torch.float16):
    a = x @ x
    b = a.softmax(dim=-1)
    c = torch.relu(a)
print(a.dtype, b.dtype, c.dtype)
```

- A) `torch.float16 torch.float32 torch.float16`
- B) `torch.float16 torch.float16 torch.float16`
- C) `torch.float16 torch.float32 torch.float32`
- D) `torch.float32 torch.float32 torch.float32`

**38.** What does this code print?

```python
import torch

a, b = torch.zeros(2, 3), torch.ones(2, 3)
print(torch.cat([a, b]).shape, torch.stack([a, b], dim=1).shape)
```

- A) `torch.Size([4, 3]) torch.Size([4, 3])`
- B) `torch.Size([2, 6]) torch.Size([2, 2, 3])`
- C) `torch.Size([4, 3]) torch.Size([2, 2, 3])`
- D) `torch.Size([4, 3]) torch.Size([2, 3, 2])`

**39.** What does this code print?

```python
import torch

x = torch.tensor(2.0, requires_grad=True)
y = x * 3
z = y.detach() * x
z.backward()
print(x.grad)
```

- A) `tensor(3.)`
- B) `tensor(12.)`
- C) `None`
- D) `tensor(6.)`

**40.** What does this code print on a machine with a CUDA GPU?

```python
import torch

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
x = torch.zeros(3).to(device)
print(x.is_cuda, x.cpu().device, x.device.type)
```

- A) `False cpu cuda`
- B) `True cpu cuda`
- C) `True cpu cuda:0`
- D) `True cuda:0 cuda`

## Answers

<details>
<summary>Show the answers (after you've finished)</summary>

1. **C) `2`**: Modules in a plain Python list aren't registered, so only `head`'s weight and bias are parameters. The optimizer would never train the hidden layers; use `nn.ModuleList`. *(PyTorch fundamentals; review [lesson 10](10-nn-module.md))*
2. **D) `tensor([1, 3, 5]) tensor([-2,  5])`**: A boolean mask returns the selected elements as a 1-D tensor, in row order. `x[:, 1]` is column 1 of every row. *(PyTorch fundamentals; review [lesson 4](04-indexing-and-views.md))*
3. **B) `torch.inference_mode()`**: inference_mode skips even more bookkeeping than no_grad. eval() changes layer behaviour but doesn't stop gradient tracking; combine it with inference_mode. *(PyTorch fundamentals; review [lesson 8](08-autograd.md))*
4. **D) `[0.0001, 0.001] 0.01`**: Settings given in a group override the defaults; groups without them take the optimizer's keyword arguments. *(Model development; review [lesson 22](22-optimizers-and-schedules.md))*
5. **B) In training mode BatchNorm normalises with the current batch's statistics; in eval mode it uses the running averages**: Training mode also updates the running averages. That's why predictions must be made in eval mode, where single samples are normalised consistently. *(Model development; review [lesson 21](21-better-models.md))*
6. **C) `1024.0 tensor(512.)`**: `scale()` multiplies the loss by the current scale. init_scale replaces the default 65536. *(Performance and optimization; review [lesson 26](26-mixed-precision.md))*
7. **C) Before splitting into training, validation and test sets**: Duplicates removed after splitting can sit on both sides of the split: the model is then tested on samples it trained on. *(Data handling; review [lesson 18](18-data-quality.md))*
8. **B) cuDNN times several convolution algorithms for each new input shape and reuses the fastest**: It pays off when input shapes stay fixed; with constantly changing shapes it keeps re-benchmarking. *(Performance and optimization; review [lesson 25](25-torch-compile.md))*
9. **B) Most of its time is spent in the operations it calls (such as `aten::addmm`), not in `linear` itself**: Self time excludes child operations; total time includes them. Sort by self time to find the operations that do the work. *(Performance and optimization; review [lesson 24](24-measuring-performance.md))*
10. **D) FSDP (`fully_shard`), which shards parameters, gradients and optimizer state across the GPUs**: DDP keeps a full copy of all three on every GPU, so it can't fit; sharding over 4 GPUs leaves each with roughly a quarter, plus room for activations. *(Performance and optimization; review [lesson 27](27-distributed-training.md))*
11. **A) So the update isn't recorded by autograd, which also makes the in-place change to a leaf allowed**: Without no_grad, the in-place update of a leaf that requires grad raises an error. The gradient still has to be zeroed separately. *(PyTorch fundamentals; review [lesson 9](09-gradient-descent.md))*
12. **C) Returns batches in page-locked CPU memory, so copies to the GPU are faster and can overlap with computation using `non_blocking=True`**: Pinned memory lets the GPU copy data directly. It only helps when training on a GPU. *(Data handling; review [lesson 16](16-samplers-and-workers.md))*
13. **C) `5 tensor([6., 7.]) tensor(3)`**: TensorDataset indexes every tensor along dimension 0. Row 3 of the 5 × 2 features is [6., 7.], and the label is a 0-D tensor. *(Data handling; review [lesson 14](14-datasets.md))*
14. **B) That key position is ignored by attention (masked out)**: MultiheadAttention's boolean masks mark positions to exclude, typically padding. `F.scaled_dot_product_attention` uses the opposite convention: True means "may attend". *(Model development; review [lesson 20](20-sequence-layers.md))*
15. **B) `tensor(4.3333) tensor(5.)`**: MSE averages the squared errors: (0 + 4 + 9) / 3. L1 with reduction="sum" adds the absolute errors: 0 + 2 + 3. *(PyTorch fundamentals; review [lesson 11](11-losses-and-optimizers.md))*
16. **C) Batches of 16 with gradient accumulation over 4 backward passes before each optimizer step**: Activations grow with the batch size; accumulating gradients over smaller batches keeps the effective batch size with a quarter of the activation memory. empty_cache doesn't free tensors that are still in use. *(Performance and optimization; review [lesson 24](24-measuring-performance.md))*
17. **A) The first call traces the model and generates optimised kernels; later calls reuse them**: Compilation is a one-time cost per graph (and per recompile), which is why compiled models are benchmarked after warm-up. *(Performance and optimization; review [lesson 25](25-torch-compile.md))*
18. **C) `False True True False`**: Inside no_grad nothing is recorded, so b doesn't require gradients. c was computed from a tracked tensor, so it isn't a leaf. *(PyTorch fundamentals; review [lesson 8](08-autograd.md))*
19. **D) `torch.float32 1.0`**: With scale=True, uint8 values 0–255 are divided by 255 into 0.0–1.0, the range Normalize and pretrained models expect. *(Data handling; review [lesson 17](17-transforms.md))*
20. **B) `torch.load("ckpt.pt", map_location="cpu")`**: Without map_location, loading tries to restore each tensor to the GPU it was saved from and fails on a machine without one. *(PyTorch fundamentals; review [lesson 13](13-saving-and-loading.md))*
21. **B) `[1, 4, 7] 0.25`**: arange stops before the end value (10 is excluded). linspace(0, 1, 5) includes both ends: 0, 0.25, 0.5, 0.75, 1. *(PyTorch fundamentals; review [lesson 2](02-creating-tensors.md))*
22. **D) A `ValueError`: `sampler` and `shuffle` can't be used together**: shuffle=True just creates a RandomSampler, so passing your own sampler as well is contradictory. Put any shuffling inside the sampler. *(Data handling; review [lesson 15](15-dataloaders.md))*
23. **C) `torch.Size([2, 3, 16]) torch.Size([100, 16])`**: Each token id is replaced by its 16-value row of the weight table, so a dimension of 16 is added at the end. *(Model development; review [lesson 20](20-sequence-layers.md))*
24. **C) `45`**: The replacement layer is created after freezing, so only its 8 × 5 + 5 = 45 parameters require gradients. *(Model development; review [lesson 23](23-transfer-learning.md))*
25. **C) Rescales all the gradients together so their combined norm is at most 1.0, and returns the norm before clipping**: Scaling all gradients by one factor keeps their direction. Clamping each element is `clip_grad_value_`. *(Model development; review [lesson 21](21-better-models.md))*
26. **A) 4,000: every worker streams all the records**: Each worker gets its own copy of the dataset. Split the stream yourself with `torch.utils.data.get_worker_info()`. *(Data handling; review [lesson 16](16-samplers-and-workers.md))*
27. **A) A `RuntimeError`: an in-place operation on a leaf tensor that requires grad**: Updating parameters in place must happen inside `torch.no_grad()`, as optimizers do, so autograd doesn't try to record it. *(PyTorch fundamentals; review [lesson 8](08-autograd.md))*
28. **B) `torch.Size([10, 3, 5])`**: matmul treats the leading dimensions as a batch and broadcasts `b` across it: each `[3, 4] @ [4, 5]` gives `[3, 5]`. *(PyTorch fundamentals; review [lesson 6](06-tensor-math.md))*
29. **B) `torch.Size([2, 8, 7, 7]) torch.Size([2, 8, 1, 1])`**: Pooling rounds down: ⌊15 / 2⌋ = 7. Adaptive pooling sets the output size directly. Neither changes the number of channels. *(Model development; review [lesson 19](19-cnn-layers.md))*
30. **B) The initial scale (65536) is large enough that some gradients overflow to inf; the step is skipped and `update()` lowers the scale**: GradScaler starts high on purpose and backs off after each overflow, settling on the largest safe scale. A few skipped steps early on are normal. *(Performance and optimization; review [lesson 26](26-mixed-precision.md))*
31. **A) The `LOCAL_RANK` environment variable, with `torch.cuda.set_device(local_rank)`**: LOCAL_RANK numbers the processes on this machine. RANK is unique across all machines, so on a second machine it would exceed the GPU count. *(Performance and optimization; review [lesson 27](27-distributed-training.md))*
32. **B) 2**: The first 2 steps are skipped, the next 1 is profiled but discarded (warm-up), and the following 2 are recorded. *(Performance and optimization; review [lesson 24](24-measuring-performance.md))*
33. **B) `torch.float32 torch.int32 torch.int64`**: A 0-D float tensor lifts integers to the default float dtype. A Python int doesn't change an int32 tensor's dtype. Two 1-D integer tensors promote to the larger type, int64. *(PyTorch fundamentals; review [lesson 3](03-dtypes.md))*
34. **D) `tensor([1, 0]) torch.Size([1, 3])`**: argmax(dim=1) gives the column of each row's maximum. Summing over dim 0 with keepdim keeps that dimension as size 1. *(PyTorch fundamentals; review [lesson 6](06-tensor-math.md))*
35. **B) `drop_last=True` in the DataLoader**: A new input shape can trigger a recompile. Dropping the incomplete batch keeps every shape the same (marking the dimension dynamic is the other fix). *(Performance and optimization; review [lesson 25](25-torch-compile.md))*
36. **D) An `AssertionError`: embed_dim must be divisible by num_heads**: Each head works on embed_dim / num_heads features, so the division must be exact. *(Model development; review [lesson 20](20-sequence-layers.md))*
37. **A) `torch.float16 torch.float32 torch.float16`**: Matmul runs in float16; softmax is on the float32 list for CUDA; relu isn't on any list, so it keeps its input's dtype. *(Performance and optimization; review [lesson 26](26-mixed-precision.md))*
38. **C) `torch.Size([4, 3]) torch.Size([2, 2, 3])`**: cat joins along an existing dimension (0 by default). stack adds a new dimension, here at position 1. *(PyTorch fundamentals; review [lesson 5](05-reshaping.md))*
39. **D) `tensor(6.)`**: detach() turns y into a constant (6), so z = 6·x and dz/dx = 6. Without detach, z = 3x² and the gradient would be 12. *(PyTorch fundamentals; review [lesson 8](08-autograd.md))*
40. **B) `True cpu cuda`**: `.cpu()` returns a copy on the CPU; `x` itself stays on the GPU. `device.type` is just the kind of device, without the index. *(PyTorch fundamentals; review [lesson 7](07-devices.md))*

</details>

---
Previous: [Lesson 29](29-mock-exam-1.md) · Next: [Lesson 31: Mock exam 3](31-mock-exam-3.md)
