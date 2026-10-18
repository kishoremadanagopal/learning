# Lesson 29: Mock exam 1

▶ **Take it in the [sandbox](https://kishoremadanagopal.github.io/learning/pytorch/#mock-exam-1)** for the real experience: an 80-minute timer, no feedback until you submit, then your score per domain and the lessons to review.

Take it in one sitting with the timer on: no notes and no running code until you've submitted. Afterwards you'll see your score for each domain, an explanation for every question, and the lessons to review.

| Domain | Exam weight | Questions here |
|---|---|---|
| PyTorch fundamentals | 38% | 15 |
| Performance and optimization | 26% | 11 |
| Model development | 20% | 8 |
| Data handling | 16% | 6 |

## Questions

**1.** For a scheduler like StepLR that you step once per epoch, where does `scheduler.step()` go?

- A) Inside the batch loop, before `loss.backward()`
- B) After the epoch's `optimizer.step()` calls, once per epoch
- C) Before the first `optimizer.step()` of every batch
- D) Once, before training starts

**2.** During validation you call `model.eval()` but forget `torch.no_grad()`. What is the effect?

- A) Dropout and BatchNorm use their evaluation behaviour, but autograd still records every operation, using extra memory and time
- B) The parameters are frozen, so `optimizer.step()` can't change them
- C) The model outputs are wrong, because BatchNorm still uses batch statistics
- D) No gradients are recorded, because `eval()` turns autograd off

**3.** What does this code print?

```python
import torch

x = torch.arange(5)
y = x[1:3]
y[0] = 100
print(x)
```

- A) `tensor([100,   1,   2,   3,   4])`
- B) `tensor([0, 1, 2, 3, 4])`
- C) `tensor([  0,   1, 100,   3,   4])`
- D) `tensor([  0, 100,   2,   3,   4])`

**4.** What does this code print?

```python
from torch.utils.data import DataLoader

loader = DataLoader(range(103), batch_size=10, drop_last=True)
print(len(loader), len(loader.dataset))
```

- A) `10 103`
- B) `10 100`
- C) `11 110`
- D) `11 103`

**5.** You serve a small model with batch size 1, and the profiler shows that most of the time is kernel-launch overhead. Which `torch.compile` option targets this?

- A) `mode="reduce-overhead"`, which uses CUDA graphs to launch many kernels at once
- B) `backend="eager"`
- C) `fullgraph=True`
- D) `dynamic=True`

**6.** What does this code print?

```python
import torch
from torch import nn

model = torch.compile(nn.Linear(4, 2))
print(list(model.state_dict().keys()))
```

- A) `['module.weight', 'module.bias']`
- B) `['_orig_mod.weight', '_orig_mod.bias']`
- C) `['weight', 'bias']`
- D) `[]`

**7.** What happens when this code runs on a machine with a CUDA GPU?

```python
import torch

x = torch.ones(2, device="cuda")
y = torch.ones(2)
print(x + y)
```

- A) A `RuntimeError`: the tensors are on different devices
- B) It prints `tensor([2., 2.], device='cuda:0')`
- C) PyTorch moves `x` to the CPU automatically and prints the sum
- D) It prints `tensor([2., 2.])`

**8.** What does this code print?

```python
import torch

a = torch.zeros(4, 1, 3)
b = torch.ones(5, 1)
print((a + b).shape)
```

- A) `torch.Size([4, 5, 3])`
- B) `torch.Size([4, 5, 1])`
- C) `torch.Size([4, 1, 3])`
- D) `torch.Size([5, 4, 3])`

**9.** A map-style Dataset subclass is used with a DataLoader and the default sampler. Which methods must it implement?

- A) `forward` and `__getitem__`
- B) `__iter__` and `__next__`
- C) `__call__` and `__len__`
- D) `__len__` and `__getitem__`

**10.** You freeze a pretrained ResNet with `model.requires_grad_(False)`, then replace `model.fc` with a new `nn.Linear`. Which statement is true?

- A) Only the new head's parameters require gradients, so they're the only parameters the optimizer updates
- B) The new head is frozen too, because the whole model was frozen
- C) Frozen BatchNorm layers stop updating their running statistics automatically
- D) You must call `model.eval()` to stop the frozen layers' weights from changing

**11.** What does this code print?

```python
import torch
from torch import nn

conv = nn.Conv2d(3, 16, kernel_size=3, stride=2, padding=1)
print(conv(torch.randn(8, 3, 32, 32)).shape)
```

- A) `torch.Size([8, 3, 16, 16])`
- B) `torch.Size([8, 16, 16, 16])`
- C) `torch.Size([8, 16, 15, 15])`
- D) `torch.Size([8, 16, 32, 32])`

**12.** What does `nn.Dropout(p=0.5)` do to its input after `model.eval()`?

- A) Zeros half the values and doubles the rest
- B) Multiplies every value by 0.5
- C) Zeros half the values without rescaling
- D) Returns it unchanged

**13.** What happens when this code runs?

```python
import torch

x = torch.arange(6).reshape(2, 3).t()
print(x.view(6))
```

- A) A `TypeError`: `view` needs a tuple of sizes
- B) It prints `tensor([0, 3, 1, 4, 2, 5])`
- C) A `RuntimeError`: the transposed tensor isn't contiguous, so `view` can't flatten it
- D) It prints `tensor([0, 1, 2, 3, 4, 5])`

**14.** A 10-class classifier is trained with `nn.CrossEntropyLoss()`. What should the model output and the targets be?

- A) Raw logits of shape `[N, 10]`, and class indices (int64) of shape `[N]`
- B) Raw logits of shape `[N, 10]`, and float class labels of shape `[N]`
- C) Logits of shape `[N]`, and class indices of shape `[N, 10]`
- D) Softmax probabilities of shape `[N, 10]`, and class indices of shape `[N]`

**15.** What does this code print?

```python
import torch
from torch.utils.data import DataLoader

data = [(torch.tensor([1.0, 2.0]), 0), (torch.tensor([3.0, 4.0]), 1), (torch.tensor([5.0, 6.0]), 1)]
xb, yb = next(iter(DataLoader(data, batch_size=2)))
print(xb.shape, yb)
```

- A) `torch.Size([2, 2]) [0, 1]`
- B) `torch.Size([2, 2]) tensor([0, 1])`
- C) `torch.Size([2, 2]) (0, 1)`
- D) `torch.Size([4]) tensor([0, 1])`

**16.** What does this code print?

```python
import torch
from torch import nn

lstm = nn.LSTM(input_size=8, hidden_size=20, num_layers=2, batch_first=True)
out, (h, c) = lstm(torch.randn(4, 10, 8))
print(out.shape, h.shape)
```

- A) `torch.Size([4, 10, 20]) torch.Size([4, 2, 20])`
- B) `torch.Size([4, 10, 40]) torch.Size([2, 4, 20])`
- C) `torch.Size([4, 10, 20]) torch.Size([2, 4, 20])`
- D) `torch.Size([10, 4, 20]) torch.Size([2, 4, 20])`

**17.** When should you compute the mean and standard deviation used to normalise input features?

- A) From the whole dataset before splitting
- B) Separately for each split, from that split's own data
- C) From the training split only, then apply the same values to validation and test data
- D) From the test set, since that's what the model is judged on

**18.** A DDP job runs on 8 GPUs with a DistributedSampler, `batch_size=16` in each DataLoader, and gradient accumulation over 4 micro-batches. How many samples contribute to each optimizer step?

- A) 64
- B) 16
- C) 512
- D) 128

**19.** What does this code print?

```python
from torch import nn

model = nn.Sequential(nn.Linear(10, 5), nn.ReLU(), nn.Linear(5, 2))
print(sum(p.numel() for p in model.parameters()))
```

- A) `69`
- B) `67`
- C) `62`
- D) `60`

**20.** A file was saved with `torch.save(model, "model.pt")` (the whole model). With PyTorch 2.6 or later, `torch.load("model.pt")` fails. Why?

- A) The file is compressed and needs `torch.load(..., zip=True)`
- B) `torch.load` uses `weights_only=True` by default, which refuses to unpickle arbitrary objects such as a model class
- C) `.pt` files must be loaded with `load_state_dict`
- D) Whole models can only be loaded on the device they were saved from

**21.** What does this code print?

```python
from torch import nn

model = nn.Sequential(nn.Linear(2, 3), nn.ReLU(), nn.Linear(3, 1))
print(list(model.state_dict().keys()))
```

- A) `['0.weight', '0.bias', '2.weight', '2.bias']`
- B) `['weight', 'bias', 'weight', 'bias']`
- C) `['0.weight', '0.bias', '1.weight', '1.bias', '2.weight', '2.bias']`
- D) `['0.weight', '0.bias', '1.weight', '1.bias']`

**22.** What does this code print?

```python
from torch.utils.data.distributed import DistributedSampler

s = DistributedSampler(range(7), num_replicas=2, rank=1, shuffle=False)
print(list(s))
```

- A) `[1, 3, 5, 0]`
- B) `[4, 5, 6]`
- C) `[1, 3, 5]`
- D) `[1, 3, 5, 6]`

**23.** You train in float16 with autocast and want to clip gradients. Which sequence is correct?

- A) `scaler.scale(loss).backward()`, `scaler.update()`, `clip_grad_norm_(...)`, `scaler.step(opt)`
- B) `loss.backward()`, `clip_grad_norm_(...)`, `scaler.step(opt)`, `scaler.update()`, `scaler.unscale_(opt)`
- C) `scaler.scale(loss).backward()`, `clip_grad_norm_(...)`, `scaler.unscale_(opt)`, `scaler.step(opt)`, `scaler.update()`
- D) `scaler.scale(loss).backward()`, `scaler.unscale_(opt)`, `clip_grad_norm_(...)`, `scaler.step(opt)`, `scaler.update()`

**24.** Which order of calls is correct for one training step?

- A) `optimizer.zero_grad()`, `out = model(x)`, `loss = loss_fn(out, y)`, `optimizer.step()`, `loss.backward()`
- B) `out = model(x)`, `loss.backward()`, `loss = loss_fn(out, y)`, `optimizer.step()`, `optimizer.zero_grad()`
- C) `optimizer.zero_grad()`, `out = model(x)`, `loss = loss_fn(out, y)`, `loss.backward()`, `optimizer.step()`
- D) `out = model(x)`, `loss = loss_fn(out, y)`, `optimizer.step()`, `loss.backward()`, `optimizer.zero_grad()`

**25.** What does this code print?

```python
from torch import nn

bn = nn.BatchNorm1d(4)
print(len(list(bn.parameters())), len(bn.state_dict()))
```

- A) `2 5`
- B) `2 4`
- C) `4 5`
- D) `4 4`

**26.** What happens when this code runs?

```python
import torch

x = torch.tensor([1.0, 2.0], requires_grad=True)
y = (x * x).sum()
y.backward()
y.backward()
```

- A) A `RuntimeError` on the second `backward()`: the graph's saved values were freed by the first one
- B) A `ValueError`: `backward()` needs a gradient argument
- C) `x.grad` ends up as `tensor([2., 4.])`: the second call is ignored
- D) `x.grad` ends up as `tensor([4., 8.])`, with no error

**27.** 90% of your training samples are class 0 and 10% class 1. Which sampler makes batches with roughly balanced classes?

- A) `RandomSampler`
- B) `DistributedSampler`
- C) `SequentialSampler`
- D) `WeightedRandomSampler` with per-sample weights inversely proportional to class frequency, and `replacement=True`

**28.** You train with `torch.autocast("cuda", dtype=torch.bfloat16)` on an A100. Do you need a GradScaler?

- A) Usually not: bfloat16 has float32's exponent range, so gradients rarely underflow
- B) No: autocast turns off gradients for bfloat16 tensors
- C) Yes: every mixed-precision run needs one
- D) Yes: bfloat16 has more mantissa bits than float16, which makes underflow more likely

**29.** Which `torchvision.transforms.v2` pipeline suits **validation** images for a pretrained model?

- A) `RandomResizedCrop(224)`, `RandomHorizontalFlip()`, `ToImage()`, `ToDtype(torch.float32, scale=True)`, `Normalize(mean, std)`
- B) `Resize(256)`, `CenterCrop(224)`, `ToImage()`, `ToDtype(torch.float32, scale=True)`, `Normalize(mean, std)`
- C) `Resize(256)`, `RandomCrop(224)`, `ToImage()`, `ToDtype(torch.float32, scale=True)`, `Normalize(mean, std)`
- D) `Resize(256)`, `CenterCrop(224)`, `ToImage()`, `Normalize(mean, std)`, `ToDtype(torch.float32, scale=True)`

**30.** What does this code print?

```python
import torch

x = torch.tensor([1, 2, 3])
print((x / 2).dtype)
```

- A) `torch.float64`
- B) `torch.int32`
- C) `torch.float32`
- D) `torch.int64`

**31.** What does this code print?

```python
import torch

w = torch.tensor(1.0, requires_grad=True)
for _ in range(3):
    (2 * w).backward()
print(w.grad)
```

- A) `tensor(6.)`
- B) `tensor(2.)`
- C) `tensor(0.)`
- D) `None`

**32.** Which code makes a region of your training step appear as its own row in the profiler's table?

- A) `torch.profiler.label("data_prep")`
- B) `with torch.autograd.set_grad_enabled("data_prep"):`
- C) `prof.step("data_prep")`
- D) `with torch.profiler.record_function("data_prep"):`

**33.** What does this code print?

```python
from torch import nn

conv = nn.Conv2d(3, 16, kernel_size=3)
print(sum(p.numel() for p in conv.parameters()))
```

- A) `432`
- B) `160`
- C) `144`
- D) `448`

**34.** What does this code print on a machine with a CUDA GPU?

```python
import torch

x = torch.tensor([1.0, 2.0], device="cuda")
print(x.sum().item(), x.device)
```

- A) `3.0 cpu`
- B) `3.0 cuda`
- C) `tensor(3., device='cuda:0') cuda:0`
- D) `3.0 cuda:0`

**35.** Which call returns the highest amount of GPU memory occupied by tensors since the last `torch.cuda.reset_peak_memory_stats()`?

- A) `torch.cuda.empty_cache()`
- B) `torch.cuda.memory_reserved()`
- C) `torch.cuda.memory_allocated()`
- D) `torch.cuda.max_memory_allocated()`

**36.** A colleague times `c = a @ b` on a GPU with `time.perf_counter()` before and after, and gets 0.05 ms: far faster than the GPU can multiply those matrices. What is the most likely explanation?

- A) The kernel runs asynchronously, so the clock stopped right after the launch; synchronize before reading the clock
- B) The result was cached from an earlier call
- C) Matrix multiplication on GPUs takes almost no time
- D) `perf_counter` only measures CPU code, so it always reports near zero for GPU work

**37.** What does this code print?

```python
import torch

x = torch.tensor(3.0, requires_grad=True)
y = x ** 2 + 2 * x
y.backward()
print(x.grad)
```

- A) `tensor(15.)`
- B) `tensor(8.)`
- C) `tensor(6.)`
- D) `None`

**38.** What does this code print?

```python
from torch import nn, optim

opt = optim.SGD(nn.Linear(1, 1).parameters(), lr=0.1)
sched = optim.lr_scheduler.StepLR(opt, step_size=2, gamma=0.5)
for epoch in range(5):
    opt.step()
    sched.step()
print(sched.get_last_lr())
```

- A) `[0.1]`
- B) `[0.05]`
- C) `[0.0125]`
- D) `[0.025]`

**39.** What does this code print?

```python
import torch
from torch import nn

lin = nn.Linear(4, 4)
x = torch.randn(2, 4)
with torch.autocast(device_type="cpu", dtype=torch.bfloat16):
    y = lin(x)
    z = y + x
print(y.dtype, z.dtype, lin.weight.dtype)
```

- A) `torch.bfloat16 torch.bfloat16 torch.bfloat16`
- B) `torch.bfloat16 torch.float32 torch.float32`
- C) `torch.float32 torch.float32 torch.float32`
- D) `torch.bfloat16 torch.bfloat16 torch.float32`

**40.** Which line inside a function decorated with `@torch.compile` causes a graph break?

- A) `y = x.reshape(x.shape[0], -1)`
- B) `y = torch.where(x > 0, x, 0.1 * x)`
- C) `values = x.tolist()`
- D) `y = torch.relu(x @ w + b)`

## Answers

<details>
<summary>Show the answers (after you've finished)</summary>

1. **B) After the epoch's `optimizer.step()` calls, once per epoch**: Since PyTorch 1.1, `optimizer.step()` must come before `scheduler.step()`; calling them the other way round skips the first value of the schedule and triggers a warning. *(Model development; review [lesson 22](22-optimizers-and-schedules.md))*
2. **A) Dropout and BatchNorm use their evaluation behaviour, but autograd still records every operation, using extra memory and time**: `eval()` only switches layer behaviour; `torch.no_grad()` (or `torch.inference_mode()`) stops gradient tracking. Validation should use both. *(PyTorch fundamentals; review [lesson 12](12-training-loop.md))*
3. **D) `tensor([  0, 100,   2,   3,   4])`**: Basic slicing returns a view that shares memory with `x`. `y[0]` is `x[1]`, so writing to it changes `x`. Use `.clone()` for an independent copy. *(PyTorch fundamentals; review [lesson 4](04-indexing-and-views.md))*
4. **A) `10 103`**: drop_last discards the incomplete last batch of 3, leaving ⌊103 / 10⌋ = 10 batches. The dataset itself is unchanged. *(Data handling; review [lesson 15](15-dataloaders.md))*
5. **A) `mode="reduce-overhead"`, which uses CUDA graphs to launch many kernels at once**: CUDA graphs record a sequence of kernels and replay it with a single launch. fullgraph only forbids graph breaks; the eager backend doesn't optimise at all. *(Performance and optimization; review [lesson 25](25-torch-compile.md))*
6. **B) `['_orig_mod.weight', '_orig_mod.bias']`**: torch.compile wraps the model in an OptimizedModule whose submodule is called `_orig_mod`. Save `model._orig_mod.state_dict()` to get plain keys. *(Performance and optimization; review [lesson 25](25-torch-compile.md))*
7. **A) A `RuntimeError`: the tensors are on different devices**: Operations need all tensors on the same device; PyTorch never moves data silently. (The only exception is a 0-D CPU tensor, which acts like a Python number.) *(PyTorch fundamentals; review [lesson 7](07-devices.md))*
8. **A) `torch.Size([4, 5, 3])`**: Align from the right: `[4, 1, 3]` and `[_, 5, 1]`. Each pair is equal or contains a 1, so the result takes the larger size in each position: `[4, 5, 3]`. *(PyTorch fundamentals; review [lesson 6](06-tensor-math.md))*
9. **D) `__len__` and `__getitem__`**: The sampler needs the length to generate indexes, and the DataLoader fetches each sample with `dataset[i]`. `__iter__` is for IterableDataset. *(Data handling; review [lesson 14](14-datasets.md))*
10. **A) Only the new head's parameters require gradients, so they're the only parameters the optimizer updates**: New modules are created with `requires_grad=True`. Freezing doesn't affect BatchNorm's running statistics, which still update in `train()` mode unless those layers are put in `eval()`. *(Model development; review [lesson 23](23-transfer-learning.md))*
11. **B) `torch.Size([8, 16, 16, 16])`**: ⌊(32 + 2·1 − 3) / 2⌋ + 1 = ⌊31 / 2⌋ + 1 = 16; the channels become `out_channels` = 16. *(Model development; review [lesson 19](19-cnn-layers.md))*
12. **D) Returns it unchanged**: Dropout is only active in training mode, where it zeros values with probability p and scales the survivors by 1 / (1 − p), so evaluation needs no rescaling. *(Model development; review [lesson 21](21-better-models.md))*
13. **C) A `RuntimeError`: the transposed tensor isn't contiguous, so `view` can't flatten it**: `.t()` swaps the strides without moving data. `view` needs a compatible memory layout; `reshape` (or `.contiguous().view(6)`) would copy and print `tensor([0, 3, 1, 4, 2, 5])`. *(PyTorch fundamentals; review [lesson 5](05-reshaping.md))*
14. **A) Raw logits of shape `[N, 10]`, and class indices (int64) of shape `[N]`**: CrossEntropyLoss applies log-softmax itself, so applying softmax first is a silent mistake. Integer targets must be int64 class indices (float targets are allowed only as class probabilities of shape `[N, 10]`). *(PyTorch fundamentals; review [lesson 11](11-losses-and-optimizers.md))*
15. **B) `torch.Size([2, 2]) tensor([0, 1])`**: The default collate function stacks tensors along a new first dimension and turns Python ints into an int64 tensor. *(Data handling; review [lesson 15](15-dataloaders.md))*
16. **C) `torch.Size([4, 10, 20]) torch.Size([2, 4, 20])`**: `batch_first=True` affects `output` (batch, steps, hidden) but not `h_n`, which is always (layers × directions, batch, hidden). *(Model development; review [lesson 20](20-sequence-layers.md))*
17. **C) From the training split only, then apply the same values to validation and test data**: Statistics computed with validation or test data leak information about them into training, making evaluation look better than it is. *(Data handling; review [lesson 18](18-data-quality.md))*
18. **C) 512**: 8 processes × 16 samples × 4 accumulated micro-batches = 512. *(Performance and optimization; review [lesson 27](27-distributed-training.md))*
19. **B) `67`**: Linear(10, 5): 10 × 5 weights + 5 biases = 55. Linear(5, 2): 5 × 2 + 2 = 12. ReLU has no parameters. 55 + 12 = 67. *(PyTorch fundamentals; review [lesson 10](10-nn-module.md))*
20. **B) `torch.load` uses `weights_only=True` by default, which refuses to unpickle arbitrary objects such as a model class**: Unpickling can run arbitrary code, so loading defaults to tensors and plain containers only. Save and load `model.state_dict()` instead, or pass `weights_only=False` only for files you trust. *(PyTorch fundamentals; review [lesson 13](13-saving-and-loading.md))*
21. **A) `['0.weight', '0.bias', '2.weight', '2.bias']`**: Keys are named by position in the Sequential. The ReLU at index 1 has no parameters or buffers, so there's no `1.` entry. *(PyTorch fundamentals; review [lesson 13](13-saving-and-loading.md))*
22. **A) `[1, 3, 5, 0]`**: 7 samples over 2 ranks: each gets ceil(7 / 2) = 4, so the list is padded to `0 … 6, 0`. Rank 1 takes every second index starting at 1. *(Performance and optimization; review [lesson 27](27-distributed-training.md))*
23. **D) `scaler.scale(loss).backward()`, `scaler.unscale_(opt)`, `clip_grad_norm_(...)`, `scaler.step(opt)`, `scaler.update()`**: Unscale before clipping so the threshold applies to the true gradients; step() then skips the update if any gradient is inf or nan, and update() adjusts the scale. *(Performance and optimization; review [lesson 26](26-mixed-precision.md))*
24. **C) `optimizer.zero_grad()`, `out = model(x)`, `loss = loss_fn(out, y)`, `loss.backward()`, `optimizer.step()`**: Clear old gradients, compute the loss, compute new gradients, then update. zero_grad() can also come right after step(); what matters is that it runs between one backward() and the next. *(PyTorch fundamentals; review [lesson 12](12-training-loop.md))*
25. **A) `2 5`**: The parameters are weight and bias. The state dict adds three buffers: running_mean, running_var and num_batches_tracked. *(Model development; review [lesson 21](21-better-models.md))*
26. **A) A `RuntimeError` on the second `backward()`: the graph's saved values were freed by the first one**: backward() frees the intermediate values it stored. Pass `retain_graph=True` to the first call to run backward twice (and then the gradients would accumulate to `[4., 8.]`). *(PyTorch fundamentals; review [lesson 8](08-autograd.md))*
27. **D) `WeightedRandomSampler` with per-sample weights inversely proportional to class frequency, and `replacement=True`**: Rare-class samples get larger weights, so they're drawn more often; replacement lets them appear several times per epoch. *(Data handling; review [lesson 16](16-samplers-and-workers.md))*
28. **A) Usually not: bfloat16 has float32's exponent range, so gradients rarely underflow**: Loss scaling exists for float16's narrow range. bfloat16 trades precision for range, so plain `loss.backward()` and `optimizer.step()` work. *(Performance and optimization; review [lesson 26](26-mixed-precision.md))*
29. **B) `Resize(256)`, `CenterCrop(224)`, `ToImage()`, `ToDtype(torch.float32, scale=True)`, `Normalize(mean, std)`**: Validation must be deterministic (no random crops or flips), and Normalize expects float values in [0, 1], so ToDtype with scale=True comes first. *(Data handling; review [lesson 17](17-transforms.md))*
30. **C) `torch.float32`**: `/` is true division: integer tensors produce the default float dtype, float32. Use `//` for floor division. *(PyTorch fundamentals; review [lesson 3](03-dtypes.md))*
31. **A) `tensor(6.)`**: Each backward() adds its gradient (2) to `.grad` instead of replacing it: 2 + 2 + 2 = 6. That's why training loops call `zero_grad()` every step. *(PyTorch fundamentals; review [lesson 8](08-autograd.md))*
32. **D) `with torch.profiler.record_function("data_prep"):`**: record_function labels a block (or decorates a function); its row shows the time spent inside it, including the operations it ran. *(Performance and optimization; review [lesson 24](24-measuring-performance.md))*
33. **D) `448`**: Each of the 16 filters has 3 × 3 × 3 = 27 weights plus 1 bias: 16 × 28 = 448. *(Model development; review [lesson 19](19-cnn-layers.md))*
34. **D) `3.0 cuda:0`**: `.item()` copies the single value to a Python float. A tensor created with `device="cuda"` lands on the current GPU, which prints as `cuda:0`. *(PyTorch fundamentals; review [lesson 7](07-devices.md))*
35. **D) `torch.cuda.max_memory_allocated()`**: memory_allocated is the current amount, memory_reserved includes the caching allocator's spare blocks, and empty_cache releases spare blocks. *(Performance and optimization; review [lesson 24](24-measuring-performance.md))*
36. **A) The kernel runs asynchronously, so the clock stopped right after the launch; synchronize before reading the clock**: Call `torch.cuda.synchronize()` before both clock reads, or use `torch.utils.benchmark.Timer` or CUDA events. *(Performance and optimization; review [lesson 24](24-measuring-performance.md))*
37. **B) `tensor(8.)`**: dy/dx = 2x + 2 = 8 at x = 3. (15 is the value of y, not its gradient.) *(PyTorch fundamentals; review [lesson 8](08-autograd.md))*
38. **D) `[0.025]`**: After 5 scheduler steps the rate has been halved at steps 2 and 4: 0.1 × 0.5 × 0.5 = 0.025. get_last_lr returns a list, one value per parameter group. *(Model development; review [lesson 22](22-optimizers-and-schedules.md))*
39. **B) `torch.bfloat16 torch.float32 torch.float32`**: linear is on autocast's lower-precision list. Addition isn't on any list, so ordinary type promotion applies: bfloat16 + float32 gives float32. The stored weights are never changed. *(Performance and optimization; review [lesson 26](26-mixed-precision.md))*
40. **C) `values = x.tolist()`**: tolist() needs the actual values in Python, so Dynamo ends the graph there. The others are tensor operations Dynamo can capture. *(Performance and optimization; review [lesson 25](25-torch-compile.md))*

</details>

---
Previous: [Lesson 28](28-exam-strategy.md) · Next: [Lesson 30: Mock exam 2](30-mock-exam-2.md)
