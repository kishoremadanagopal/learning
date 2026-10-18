# Lesson 31: Mock exam 3

▶ **Take it in the [sandbox](https://kishoremadanagopal.github.io/learning/pytorch/#mock-exam-3)** for the real experience: an 80-minute timer, no feedback until you submit, then your score per domain and the lessons to review.

The last full rehearsal, with questions not used in the first two mocks. Take it a few days before your exam date, under the same rules.

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

model = nn.Sequential(nn.Linear(2, 2), nn.Dropout(0.1))
model.eval()
print(model.training, model[1].training, len(list(model.children())))
```

- A) `False True 2`
- B) `True True 2`
- C) `False False 1`
- D) `False False 2`

**2.** Which code records a layer's output during the forward pass without changing the model's code?

- A) `model.layer4.register_forward_hook(lambda m, inp, out: saved.append(out.detach()))`
- B) `torch.save(model.layer4, "out.pt")`
- C) `model.layer4.register_full_backward_hook(lambda m, gin, gout: saved.append(gout))`
- D) `saved.append(model.layer4.output)`

**3.** What does this code print?

```python
import torch

x = torch.tensor(2.0, requires_grad=True)
y = x * x
y.retain_grad()
z = y * 3
z.backward()
print(x.grad, y.grad)
```

- A) `tensor(6.) tensor(3.)`
- B) `tensor(4.) tensor(3.)`
- C) `tensor(12.) None`
- D) `tensor(12.) tensor(3.)`

**4.** Every epoch of your DDP run feeds each rank the same sample order. What's missing?

- A) `shuffle=True` in the DataLoader
- B) A different `torch.manual_seed` on each rank
- C) `sampler.set_epoch(epoch)` at the start of each epoch
- D) `dist.barrier()` after each batch

**5.** What does this code print?

```python
import torch
from torch import nn

loss = nn.BCEWithLogitsLoss()(torch.tensor([0.0, 0.0]), torch.tensor([1.0, 0.0]))
print(round(loss.item(), 4))
```

- A) `1.3863`
- B) `0.5`
- C) `0.6931`
- D) `0.0`

**6.** What do residual (skip) connections, `out = x + block(x)`, do for deep networks?

- A) Halve the number of parameters
- B) Give gradients a direct path through the addition, so very deep networks still train
- C) Replace the need for an activation function
- D) Normalise each layer's outputs

**7.** What does this code print?

```python
from torch.utils.data import DataLoader

loader = DataLoader([1, 2, 3], batch_size=None)
print(list(loader))
```

- A) `[tensor([1, 2, 3])]`
- B) `[tensor(1), tensor(2), tensor(3)]`
- C) `[[1], [2], [3]]`
- D) `[1, 2, 3]`

**8.** With `num_workers=4`, each worker should read a different part of an `IterableDataset`'s stream. What tells the dataset which worker it's running in?

- A) `torch.distributed.get_rank()`
- B) `os.getpid()` compared with the main process
- C) `torch.utils.data.get_worker_info()`, which returns the worker's id and the number of workers
- D) The DataLoader passes the worker id to `__iter__` as an argument

**9.** What does this code print?

```python
import torch

x = torch.tensor([[1, 2, 3], [4, 5, 6]])
print(x.ndim, x.numel(), x.shape[1])
```

- A) `3 6 3`
- B) `2 6 2`
- C) `6 2 3`
- D) `2 6 3`

**10.** For float16 training with a GradScaler, which state should a checkpoint include so a resumed run behaves like the original?

- A) The scaler can't be saved; resumed runs always start from 65536
- B) Only the scaler's scale value, saved as a Python float in a separate file
- C) The model's, the optimizer's and the scaler's state dicts (`scaler.state_dict()`)
- D) Only the model's state dict, because the scaler resets itself

**11.** What is the difference between `optim.Adam(..., weight_decay=0.01)` and `optim.AdamW(..., weight_decay=0.01)`?

- A) AdamW ignores weight_decay
- B) They're identical; AdamW is an alias
- C) AdamW shrinks the weights directly (decoupled weight decay); Adam adds the decay to the gradient, where its adaptive scaling weakens it
- D) Adam has no momentum

**12.** What does this code print?

```python
import torch

w = torch.tensor(1.0, requires_grad=True)
loss = (3 * w - 6) ** 2
loss.backward()
with torch.no_grad():
    w -= 0.1 * w.grad
print(w)
```

- A) `tensor(2.8000)`
- B) `tensor(1.1800, requires_grad=True)`
- C) `tensor(2.8000, requires_grad=True)`
- D) `tensor(-0.8000, requires_grad=True)`

**13.** What happens when this code runs?

```python
import torch

x = torch.tensor([1.0, 2.0], requires_grad=True)
(x * 2).backward()
```

- A) A `RuntimeError`: backward() on a tensor with more than one element needs a gradient argument
- B) A `ValueError`: x must be a 0-D tensor
- C) `x.grad` becomes `tensor([2., 2.])`
- D) `x.grad` becomes `tensor(4.)`

**14.** What does this code print?

```python
import torch
from torch import nn

gru = nn.GRU(input_size=4, hidden_size=6, bidirectional=True, batch_first=True)
out, h = gru(torch.randn(3, 5, 4))
print(out.shape, h.shape)
```

- A) `torch.Size([3, 5, 12]) torch.Size([1, 3, 12])`
- B) `torch.Size([3, 5, 12]) torch.Size([2, 3, 6])`
- C) `torch.Size([3, 5, 12]) torch.Size([3, 2, 6])`
- D) `torch.Size([3, 5, 6]) torch.Size([2, 3, 6])`

**15.** Why is `model.half()` a poor way to get mixed-precision training?

- A) float16 isn't supported on GPUs
- B) All weights and updates become float16: small updates round away and some operations overflow; autocast keeps float32 weights and lowers precision only where it's safe
- C) `model.half()` doesn't change any dtypes
- D) It makes the model use more memory than float32

**16.** Which line in a GPU training loop forces the CPU to wait for the GPU on every step?

- A) `loss.backward()`
- B) `running_loss += loss.item()`
- C) `optimizer.step()`
- D) `x = x.to(device, non_blocking=True)`

**17.** What does this code print?

```python
import torch

torch.manual_seed(42)
a = torch.rand(3)
torch.manual_seed(42)
b = torch.rand(3)
c = torch.rand(3)
print(torch.equal(a, b), torch.equal(b, c))
```

- A) `False False`
- B) `False True`
- C) `True False`
- D) `True True`

**18.** What does this code print?

```python
import torch
import torch.nn.functional as F

q = torch.randn(2, 4, 10, 16)
k = torch.randn(2, 4, 12, 16)
v = torch.randn(2, 4, 12, 32)
print(F.scaled_dot_product_attention(q, k, v).shape)
```

- A) `torch.Size([2, 4, 10, 12])`
- B) `torch.Size([2, 4, 10, 16])`
- C) `torch.Size([2, 4, 12, 32])`
- D) `torch.Size([2, 4, 10, 32])`

**19.** What does this code print?

```python
import torch

x = torch.zeros(1, 3, 1, 5)
print(x.squeeze().shape, x.squeeze(0).shape, x.permute(3, 1, 0, 2).shape)
```

- A) `torch.Size([3, 5]) torch.Size([3, 5]) torch.Size([5, 3, 1, 1])`
- B) `torch.Size([3, 5]) torch.Size([3, 1, 5]) torch.Size([5, 3, 1, 1])`
- C) `torch.Size([3, 5]) torch.Size([3, 1, 5]) torch.Size([5, 1, 3, 1])`
- D) `torch.Size([3, 1, 5]) torch.Size([3, 1, 5]) torch.Size([5, 3, 1, 1])`

**20.** What does this code print?

```python
import torch

with torch.autocast(device_type="cpu", dtype=torch.bfloat16):
    a = torch.randn(2, 2) @ torch.randn(2, 2)
    with torch.autocast(device_type="cpu", enabled=False):
        b = torch.randn(2, 2) @ torch.randn(2, 2)
    c = torch.randn(2, 2, dtype=torch.float64) @ torch.randn(2, 2, dtype=torch.float64)
print(a.dtype, b.dtype, c.dtype)
```

- A) `torch.bfloat16 torch.bfloat16 torch.bfloat16`
- B) `torch.bfloat16 torch.float32 torch.float64`
- C) `torch.bfloat16 torch.bfloat16 torch.float64`
- D) `torch.bfloat16 torch.float32 torch.bfloat16`

**21.** How do you make `DataLoader(ds, shuffle=True)` produce the same order on every run, without re-seeding PyTorch's global random numbers?

- A) Call `random.seed(0)` before creating it
- B) Set `shuffle="fixed"`
- C) Use `num_workers=0`
- D) Pass `generator=torch.Generator().manual_seed(0)` to the DataLoader

**22.** What happens when this code runs?

```python
import torch
from torch import nn

conv = nn.Conv2d(3, 8, kernel_size=3)
conv(torch.randn(4, 1, 28, 28))
```

- A) A `ValueError`: images must be 32 × 32
- B) It outputs `torch.Size([4, 8, 28, 28])`
- C) A `RuntimeError`: the layer expects 3 input channels but the input has 1
- D) It outputs `torch.Size([4, 8, 26, 26])`, repeating the single channel

**23.** What does this code print?

```python
import torch
from torch import nn

model = nn.Linear(3, 3)
compiled = torch.compile(model)
print(compiled.weight is model.weight, type(compiled._orig_mod).__name__)
```

- A) `True Linear`
- B) `True OptimizedModule`
- C) `False Linear`
- D) `False OptimizedModule`

**24.** What does this code print?

```python
import torch

x = torch.tensor([2.0, 4.0, 4.0, 4.0, 5.0, 5.0, 7.0, 9.0])
print(x.std(), x.std(correction=0))
```

- A) `tensor(2.1381) tensor(2.)`
- B) `tensor(2.) tensor(2.)`
- C) `tensor(2.) tensor(2.1381)`
- D) `tensor(4.5714) tensor(4.)`

**25.** You exported a profile with `prof.export_chrome_trace("trace.json")`. How can you look at it?

- A) Run `nvidia-smi --trace trace.json`
- B) It can only be read with `prof.key_averages()`
- C) Load it with `torch.load` and print it
- D) Open it in the Perfetto UI (ui.perfetto.dev) or chrome://tracing as a timeline

**26.** You augment your images (random flips and crops), saving five versions of each, and then split them randomly into training and test sets. What's wrong?

- A) Nothing: more data always helps
- B) Test sets must be smaller than 10% of the data
- C) Versions of the same image end up in both sets, so the test score is inflated by near-duplicates
- D) Augmented images can't be saved to disk

**27.** What does this code print?

```python
import torch
from torch import nn

bn = nn.BatchNorm1d(1)
bn(torch.tensor([[2.0], [4.0]]))
print(bn.running_mean, bn.num_batches_tracked)
```

- A) `tensor([0.]) tensor(0)`
- B) `tensor([0.3000]) tensor(1)`
- C) `tensor([0.3000]) tensor(2)`
- D) `tensor([3.]) tensor(1)`

**28.** Which describes what `torch.compile` does with its default settings?

- A) TorchDynamo captures the tensor operations into FX graphs; TorchInductor fuses them and generates Triton (GPU) or C++ (CPU) kernels
- B) It runs the model in float16 with CUDA graphs
- C) It converts the model to ONNX and runs it with ONNX Runtime
- D) It rewrites the Python source code of the model in C++

**29.** What does this code print?

```python
import torch

print(torch.tensor([1, 2]).dtype, torch.Tensor([1, 2]).dtype, torch.zeros(2, dtype=int).dtype)
```

- A) `torch.int64 torch.float32 torch.int64`
- B) `torch.int64 torch.int64 torch.int64`
- C) `torch.int64 torch.float32 torch.int32`
- D) `torch.float32 torch.float32 torch.int64`

**30.** What does this code print?

```python
import torch
from torch.profiler import profile, ProfilerActivity

x = torch.randn(8, 8)
with profile(activities=[ProfilerActivity.CPU]) as prof:
    for _ in range(3):
        y = torch.relu(x @ x)
counts = {e.key: e.count for e in prof.key_averages()}
print(counts["aten::matmul"], counts["aten::relu"])
```

- A) `3 3`
- B) `1 1`
- C) `6 3`
- D) `3 1`

**31.** To resume an interrupted training run exactly where it stopped, what should the checkpoint contain at a minimum?

- A) The model's and the optimizer's state dicts (plus the scheduler's, if any) and the epoch number
- B) The whole model object saved with `torch.save(model)`
- C) The model's state dict only
- D) The optimizer's state dict only

**32.** What does this code print?

```python
import torch
from torchvision.transforms import v2

x = torch.ones(3, 2, 2)
out = v2.Normalize(mean=[0.5, 0.5, 0.5], std=[0.25, 0.25, 0.25])(x)
print(out.unique())
```

- A) `tensor([0.])`
- B) `tensor([1.])`
- C) `tensor([0.5000])`
- D) `tensor([2.])`

**33.** What does this code print?

```python
import torch
from torch.utils.data import random_split

train, val = random_split(range(10), [0.8, 0.2], generator=torch.Generator().manual_seed(0))
print(len(train), len(val), type(train).__name__)
```

- A) `8 2 Subset`
- B) `2 8 Subset`
- C) `8 2 range`
- D) `8 2 list`

**34.** What does this code print?

```python
import torch

x = torch.tensor(70000.0)
print(x.half(), x.bfloat16())
```

- A) `tensor(inf, dtype=torch.float16) tensor(70144., dtype=torch.bfloat16)`
- B) `tensor(inf, dtype=torch.float16) tensor(inf, dtype=torch.bfloat16)`
- C) `tensor(65504., dtype=torch.float16) tensor(70144., dtype=torch.bfloat16)`
- D) `tensor(70000., dtype=torch.float16) tensor(70000., dtype=torch.bfloat16)`

**35.** What does this code print?

```python
import torch
from torch import nn

features = nn.Sequential(nn.Conv2d(1, 4, 3, padding=1), nn.MaxPool2d(2),
                         nn.Conv2d(4, 8, 3), nn.Flatten())
print(features(torch.randn(2, 1, 28, 28)).shape)
```

- A) `torch.Size([2, 1352])`
- B) `torch.Size([2, 1152])`
- C) `torch.Size([2, 1568])`
- D) `torch.Size([2, 8, 12, 12])`

**36.** Why should a training loop accumulate the epoch's loss with `total += loss.item()` rather than `total += loss`?

- A) `total += loss` raises an error
- B) `loss` is a tensor attached to its graph, so adding tensors keeps every step's graph in memory; `.item()` gives a plain Python float
- C) `loss.item()` is more precise than the tensor
- D) `.item()` also zeroes the gradients

**37.** With DDP and gradient accumulation over 4 micro-batches, the first three `backward()` calls run inside `with model.no_sync():`. What does that save?

- A) Nothing: no_sync only affects BatchNorm
- B) Activation memory for the first three micro-batches
- C) Three optimizer steps
- D) Three gradient all-reduces per optimizer step: gradients accumulate locally and are synchronised during the fourth backward

**38.** A function compiled with `torch.compile(f, fullgraph=True)` contains code Dynamo can't trace. What happens?

- A) The whole function runs eagerly without a warning
- B) Dynamo compiles both branches of every `if`
- C) The untraceable code is silently skipped
- D) An error is raised instead of splitting the function into several graphs

**39.** What happens when this code runs?

```python
import torch

print(torch.tensor([1, 2, 3, 4]).mean())
```

- A) It prints `tensor(2.5000)`
- B) A `RuntimeError`: mean needs a floating-point (or complex) tensor
- C) It prints `2.5`
- D) It prints `tensor(2)`

**40.** What does this code print?

```python
import torch

x = torch.zeros(2, 3, 4)
print(x[..., 0].shape, x[:, None].shape, x[0, :, 1:3].shape)
```

- A) `torch.Size([2, 3, 1]) torch.Size([2, 1, 3, 4]) torch.Size([3, 2])`
- B) `torch.Size([2, 3]) torch.Size([2, 1, 3, 4]) torch.Size([1, 3, 2])`
- C) `torch.Size([2, 3]) torch.Size([2, 1, 3, 4]) torch.Size([3, 2])`
- D) `torch.Size([2, 3]) torch.Size([1, 2, 3, 4]) torch.Size([3, 2])`

## Answers

<details>
<summary>Show the answers (after you've finished)</summary>

1. **D) `False False 2`**: eval() sets `training = False` on the module and all its submodules. children() lists the direct submodules: the Linear and the Dropout. *(PyTorch fundamentals; review [lesson 10](10-nn-module.md))*
2. **A) `model.layer4.register_forward_hook(lambda m, inp, out: saved.append(out.detach()))`**: Forward hooks run after the module's forward pass and receive its inputs and output. Keep the returned handle and call `.remove()` when done. *(Model development; review [lesson 23](23-transfer-learning.md))*
3. **D) `tensor(12.) tensor(3.)`**: dz/dx = 3 · 2x = 12. Only leaves keep `.grad` by default; retain_grad() asks autograd to keep it for the intermediate y too (dz/dy = 3). *(PyTorch fundamentals; review [lesson 8](08-autograd.md))*
4. **C) `sampler.set_epoch(epoch)` at the start of each epoch**: DistributedSampler seeds its shuffle with seed + epoch; without set_epoch, the epoch stays 0. Adding shuffle=True to the DataLoader would raise an error, since a sampler is given. *(Performance and optimization; review [lesson 27](27-distributed-training.md))*
5. **C) `0.6931`**: A logit of 0 is a probability of 0.5, so each sample's loss is −ln 0.5 = ln 2 ≈ 0.6931, and the mean is the same. *(PyTorch fundamentals; review [lesson 11](11-losses-and-optimizers.md))*
6. **B) Give gradients a direct path through the addition, so very deep networks still train**: The gradient of x + block(x) includes an identity term, so it doesn't vanish through many layers. The block's output must have x's shape. *(Model development; review [lesson 21](21-better-models.md))*
7. **D) `[1, 2, 3]`**: batch_size=None turns automatic batching off: samples come out one at a time and aren't collated, so Python ints stay ints (only NumPy arrays are converted to tensors). *(Data handling; review [lesson 15](15-dataloaders.md))*
8. **C) `torch.utils.data.get_worker_info()`, which returns the worker's id and the number of workers**: get_worker_info() returns None in the main process; inside a worker it has `id`, `num_workers`, `seed` and the worker's copy of the dataset. *(Data handling; review [lesson 16](16-samplers-and-workers.md))*
9. **D) `2 6 3`**: Two dimensions (rows and columns), six elements, and three columns in dimension 1. *(PyTorch fundamentals; review [lesson 1](01-pytorch-and-tensors.md))*
10. **C) The model's, the optimizer's and the scaler's state dicts (`scaler.state_dict()`)**: The scaler's state includes the current scale and its growth tracker; restore it with `scaler.load_state_dict(...)`. *(Performance and optimization; review [lesson 26](26-mixed-precision.md))*
11. **C) AdamW shrinks the weights directly (decoupled weight decay); Adam adds the decay to the gradient, where its adaptive scaling weakens it**: Decoupled weight decay regularises more predictably, which is why AdamW is the usual default for transformers. *(Model development; review [lesson 22](22-optimizers-and-schedules.md))*
12. **C) `tensor(2.8000, requires_grad=True)`**: dloss/dw = 2(3w − 6) · 3 = −18 at w = 1, so w becomes 1 − 0.1 · (−18) = 2.8. The in-place update keeps w a leaf that requires grad. *(PyTorch fundamentals; review [lesson 9](09-gradient-descent.md))*
13. **A) A `RuntimeError`: backward() on a tensor with more than one element needs a gradient argument**: The gradient can only be created implicitly for a scalar output. Reduce first (`.sum()`) or pass `gradient=torch.ones_like(...)`. *(PyTorch fundamentals; review [lesson 8](08-autograd.md))*
14. **B) `torch.Size([3, 5, 12]) torch.Size([2, 3, 6])`**: A bidirectional layer concatenates both directions' outputs (2 × 6 features). h_n has one entry per layer and direction, and isn't batch-first. *(Model development; review [lesson 20](20-sequence-layers.md))*
15. **B) All weights and updates become float16: small updates round away and some operations overflow; autocast keeps float32 weights and lowers precision only where it's safe**: Mixed precision means float32 master weights plus 16-bit computation for the operations that benefit. *(Performance and optimization; review [lesson 26](26-mixed-precision.md))*
16. **B) `running_loss += loss.item()`**: `.item()` copies a value to Python, so it must wait for the computation to finish. Log every N steps instead to keep the GPU busy. *(Performance and optimization; review [lesson 24](24-measuring-performance.md))*
17. **C) `True False`**: Re-seeding restarts the same sequence, so a equals b. c continues the sequence after b, so it differs. *(PyTorch fundamentals; review [lesson 2](02-creating-tensors.md))*
18. **D) `torch.Size([2, 4, 10, 32])`**: There is one output per query (10), each a weighted average of the values (32 features). [10, 12] is the shape of the attention weights. *(Model development; review [lesson 20](20-sequence-layers.md))*
19. **B) `torch.Size([3, 5]) torch.Size([3, 1, 5]) torch.Size([5, 3, 1, 1])`**: squeeze() removes every size-1 dimension; squeeze(0) only dimension 0. permute lists, for each new position, which old dimension goes there. *(PyTorch fundamentals; review [lesson 5](05-reshaping.md))*
20. **B) `torch.bfloat16 torch.float32 torch.float64`**: The nested block with enabled=False turns autocast off; float64 tensors are never autocast. *(Performance and optimization; review [lesson 26](26-mixed-precision.md))*
21. **D) Pass `generator=torch.Generator().manual_seed(0)` to the DataLoader**: The DataLoader draws its shuffle from the generator you give it, so other random calls (initialisation, dropout) can't change the order. *(Data handling; review [lesson 15](15-dataloaders.md))*
22. **C) A `RuntimeError`: the layer expects 3 input channels but the input has 1**: in_channels must match dimension 1 of the input. Grayscale images need `in_channels=1` (or repeating the channel 3 times for a pretrained RGB model). *(Model development; review [lesson 19](19-cnn-layers.md))*
23. **A) `True Linear`**: The compiled wrapper shares the original module and its parameters, so training one trains the other. `_orig_mod` is the original Linear. *(Performance and optimization; review [lesson 25](25-torch-compile.md))*
24. **A) `tensor(2.1381) tensor(2.)`**: The squared deviations from the mean (5) sum to 32. By default std divides by n − 1 = 7 (√4.571 ≈ 2.1381); correction=0 divides by n = 8 (√4 = 2). *(PyTorch fundamentals; review [lesson 6](06-tensor-math.md))*
25. **D) Open it in the Perfetto UI (ui.perfetto.dev) or chrome://tracing as a timeline**: The trace shows each operation on a timeline per thread (and per GPU stream with CUDA activity), which reveals gaps where the GPU sits idle. *(Performance and optimization; review [lesson 24](24-measuring-performance.md))*
26. **C) Versions of the same image end up in both sets, so the test score is inflated by near-duplicates**: Split first, then augment only the training data (usually on the fly, in the training transforms). *(Data handling; review [lesson 18](18-data-quality.md))*
27. **B) `tensor([0.3000]) tensor(1)`**: In training mode, running_mean moves 10% (momentum 0.1) of the way from 0 towards the batch mean of 3. *(Model development; review [lesson 21](21-better-models.md))*
28. **A) TorchDynamo captures the tensor operations into FX graphs; TorchInductor fuses them and generates Triton (GPU) or C++ (CPU) kernels**: Inductor is the default backend. CUDA graphs are added by mode="reduce-overhead"; precision is unchanged. *(Performance and optimization; review [lesson 25](25-torch-compile.md))*
29. **A) `torch.int64 torch.float32 torch.int64`**: torch.tensor infers int64 from Python ints. The torch.Tensor constructor always uses the default float dtype. Python's `int` as a dtype means int64. *(PyTorch fundamentals; review [lesson 2](02-creating-tensors.md))*
30. **A) `3 3`**: key_averages groups events with the same name; each of the 3 loop iterations runs one matmul and one relu. *(Performance and optimization; review [lesson 24](24-measuring-performance.md))*
31. **A) The model's and the optimizer's state dicts (plus the scheduler's, if any) and the epoch number**: The optimizer holds state too (momentum, Adam's moving averages). Without it, training resumes with a cold optimizer. *(PyTorch fundamentals; review [lesson 13](13-saving-and-loading.md))*
32. **D) `tensor([2.])`**: Normalize computes (x − mean) / std per channel: (1 − 0.5) / 0.25 = 2. *(Data handling; review [lesson 17](17-transforms.md))*
33. **A) `8 2 Subset`**: random_split returns Subset objects, views of the original dataset by index, with sizes from the fractions. *(Data handling; review [lesson 14](14-datasets.md))*
34. **A) `tensor(inf, dtype=torch.float16) tensor(70144., dtype=torch.bfloat16)`**: float16's largest value is 65504, so 70000 overflows to inf. bfloat16 has float32's range but only 8 bits of precision, so it rounds to the nearest multiple of 512. *(PyTorch fundamentals; review [lesson 3](03-dtypes.md))*
35. **B) `torch.Size([2, 1152])`**: 28 → 28 (padding 1 keeps the size) → 14 (pooling) → 12 (3 × 3 without padding). Flatten keeps the batch: 8 × 12 × 12 = 1152. *(Model development; review [lesson 19](19-cnn-layers.md))*
36. **B) `loss` is a tensor attached to its graph, so adding tensors keeps every step's graph in memory; `.item()` gives a plain Python float**: Summing graph-attached tensors makes memory grow every step. (With a GPU, `.item()` also synchronises, so some loops log less often.) *(PyTorch fundamentals; review [lesson 12](12-training-loop.md))*
37. **D) Three gradient all-reduces per optimizer step: gradients accumulate locally and are synchronised during the fourth backward**: Each backward on a DDP model normally triggers an all-reduce; communication only needs to happen once per optimizer step. *(Performance and optimization; review [lesson 27](27-distributed-training.md))*
38. **D) An error is raised instead of splitting the function into several graphs**: Without fullgraph, Dynamo would break the graph and run that code in plain Python. fullgraph=True is a way to find and remove graph breaks. *(Performance and optimization; review [lesson 25](25-torch-compile.md))*
39. **B) A `RuntimeError`: mean needs a floating-point (or complex) tensor**: Convert first with `.float()`. Unlike mean, sum works on integers. *(PyTorch fundamentals; review [lesson 6](06-tensor-math.md))*
40. **C) `torch.Size([2, 3]) torch.Size([2, 1, 3, 4]) torch.Size([3, 2])`**: An integer index removes its dimension, `...` stands for all the dimensions not mentioned, `None` inserts a size-1 dimension, and a slice keeps its dimension. *(PyTorch fundamentals; review [lesson 4](04-indexing-and-views.md))*

</details>

---
Previous: [Lesson 30](30-mock-exam-2.md) · Back to the [course home](../README.md)
