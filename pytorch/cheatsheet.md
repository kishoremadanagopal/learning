# PyTorch cheat sheet

The PyTorch you need for the PyTorch Certified Associate exam, on a few pages. The number in brackets is the lesson. The table of every concept is at the end.

## Tensors [1–4]

```python
import torch

torch.tensor([[1, 2], [3, 4]])          # copy data; ints -> int64, floats -> float32, bools -> bool
torch.zeros(2, 3); torch.ones(2, 3); torch.full((2, 3), 7.0); torch.eye(3); torch.empty(2, 3)
torch.arange(0, 10, 2)                  # 0, 2, 4, 6, 8 (end excluded)
torch.linspace(0, 1, 5)                 # 0, 0.25, 0.5, 0.75, 1 (both ends)
torch.zeros_like(x); torch.rand_like(x) # same shape, dtype and device as x
torch.rand(2, 3); torch.randn(2, 3)     # uniform [0, 1) / standard normal
torch.randint(0, 10, (5,)); torch.randperm(6)
torch.manual_seed(42)                   # reproducible sequence (CPU and GPU)
g = torch.Generator().manual_seed(42); torch.rand(3, generator=g)
torch.from_numpy(arr)                   # shares memory; keeps NumPy's float64
```

| Attribute | Example |
|---|---|
| `x.shape`, `x.size()`, `x.size(0)` | `torch.Size([2, 3])`, `2` |
| `x.ndim`, `x.numel()` | `2`, `6` |
| `x.dtype`, `x.device` | `torch.float32`, `device(type='cuda', index=0)` |
| `x.item()`, `x.tolist()`, `x.numpy()` | Python number, lists, NumPy array (shares memory, CPU only) |

## dtypes [3]

| dtype | Alias | Bytes | Note |
|---|---|---|---|
| float32 | `torch.float` | 4 | default |
| float64 | `torch.double` | 8 | NumPy's default |
| float16 | `torch.half` | 2 | max 65504 |
| bfloat16 | | 2 | float32's range |
| int64 | `torch.long` | 8 | labels, indexes |
| bool | | 1 | masks |

- **Promotion:** bool < int < float < complex. Tensors with dimensions set the size; Python numbers and 0-D tensors only raise the category. `int / int` → float32.
- `.long()` truncates toward zero; `.round()` rounds half to even. In-place ops keep the dtype (`int_tensor += 0.5` fails).
- Compare floats with `torch.allclose(a, b)`; `torch.equal` is exact.

## Indexing, views and shapes [4–5]

- An integer index removes a dim; a slice keeps it; `None` adds one. Masks: `x[(x > 0) & (x < 5)]`.
- Slices, `view`, `t()`, `permute`, `expand`, `split` return **views** (shared memory). Masks and index lists **copy**. `x.clone()` copies.
- `reshape` (view when possible) vs `view` (never copies; fails if not contiguous). `x.contiguous()` fixes the layout.
- `unsqueeze(0)` adds a batch dim; `squeeze(0)` removes it. `permute(2, 0, 1)`: HWC → CHW. `flatten(1)` keeps the batch dim.
- `torch.cat` joins along an existing dim; `torch.stack` adds a new one (same shapes). `split(sizes)`, `chunk(n)`.

## Maths [6]

- `*` is element-wise; `@` is the matrix product: `[n, k] @ [k, m] → [n, m]`, `[b, n, k] @ [b, k, m] → [b, n, m]`. Dtypes must match.
- **Broadcasting:** compare shapes from the right; sizes must be equal or 1 (a missing dim counts as 1).
- **Reductions:** the `dim` you pass disappears; `keepdim=True` keeps it as size 1. `values, idx = x.max(dim=1)`; `x.argmax(dim=1)` gives predicted classes.
- `mean()` needs a float tensor. `std()` divides by n − 1 unless `correction=0`.
- A trailing `_` means in place: `x.add_(1)`, `x.zero_()`.

## Devices [7]

```python
device = torch.accelerator.current_accelerator().type if torch.accelerator.is_available() else "cpu"
# or: device = "cuda" if torch.cuda.is_available() else "cpu"
x = x.to(device)                        # returns a copy: assign it
y = torch.zeros(3, device=device)       # create directly on the device
arr = t.detach().cpu().numpy()          # any tensor -> NumPy
```

- All operands must be on one device (0-D CPU tensors excepted): otherwise "Expected all tensors to be on the same device".
- `.numpy()` needs a CPU tensor that doesn't require grad. `.item()` copies back by itself.
- GPU work is asynchronous: `torch.cuda.synchronize()` before timing. `torch.cuda.memory_allocated()`; OOM is `torch.OutOfMemoryError`.
- Faster transfers: `pin_memory()` and `.to(device, non_blocking=True)`.

## Every concept at a glance

Generated from the **At a glance** table at the end of each lesson. The number in brackets links to the lesson.

| Concept | Code | Gives you | Remember | Lesson |
|---|---|---|---|---|
| Make a tensor | `torch.tensor([[1, 2], [3, 4]])` | a copy of the data, dtype inferred | ints → int64, floats → float32 | [1](lessons/01-pytorch-and-tensors.md) |
| Inspect a tensor | `.shape`, `.ndim`, `.numel()`, `.dtype`, `.device` | what you need to debug | `.shape` is a `torch.Size` (a tuple) | [1](lessons/01-pytorch-and-tensors.md) |
| Get a Python number | `t.item()` | an int, float or bool | only for one-element tensors | [1](lessons/01-pytorch-and-tensors.md) |
| Image batch layout | `[batch, channels, height, width]` | what conv models expect | NCHW, channels first | [1](lessons/01-pytorch-and-tensors.md) |
| From data | `torch.tensor(data, dtype=…)` | a new tensor (copy) | rows must have equal lengths | [2](lessons/02-creating-tensors.md) |
| Filled | `zeros`, `ones`, `full(shape, v)`, `eye(n)` | float32 by default | shape as numbers or a tuple | [2](lessons/02-creating-tensors.md) |
| Ranges | `arange(start, end, step)`, `linspace(start, end, steps)` | sequences | arange excludes end; linspace includes it | [2](lessons/02-creating-tensors.md) |
| Same shape, dtype, device | `zeros_like(t)`, `rand_like(t)` | a matching new tensor | keeps code device-agnostic | [2](lessons/02-creating-tensors.md) |
| Random | `rand`, `randn`, `randint(lo, hi, (n,))`, `randperm(n)` | uniform, normal, integers, a shuffle | randint's high is excluded | [2](lessons/02-creating-tensors.md) |
| Reproducible | `torch.manual_seed(42)` or `torch.Generator().manual_seed(42)` | the same numbers every run | GPUs also need deterministic algorithms | [2](lessons/02-creating-tensors.md) |
| From NumPy | `torch.from_numpy(arr)` / `torch.tensor(arr)` | shared memory / a copy | NumPy floats are float64 | [2](lessons/02-creating-tensors.md) |
| Choose a dtype | `dtype=torch.float32` at creation | predictable maths and memory | float32 for models, int64 for labels | [3](lessons/03-dtypes.md) |
| Convert | `.to(torch.float16)`, `.float()`, `.long()` | a converted copy | float → int truncates toward zero | [3](lessons/03-dtypes.md) |
| Promotion | bool < int < float < complex | the result's dtype | Python numbers raise the category, never the size | [3](lessons/03-dtypes.md) |
| Division | `/` vs `//` | floats vs floor-divided ints | `/` on ints gives float32 | [3](lessons/03-dtypes.md) |
| 16-bit floats | `float16` vs `bfloat16` | half the memory | bfloat16 keeps float32's range | [3](lessons/03-dtypes.md) |
| Limits | `torch.finfo(dtype).max`, `.eps` | range and precision | float16 max 65504 | [3](lessons/03-dtypes.md) |
| Compare floats | `torch.allclose(a, b)` | equal within tolerance | `torch.equal` is exact | [3](lessons/03-dtypes.md) |
| Select | `x[1]`, `x[:, 2]`, `x[1:, ::2]`, `x[..., 0]` | elements, rows, columns, blocks | an int index drops a dim, a slice keeps it | [4](lessons/04-indexing-and-views.md) |
| Add a dim | `x[:, None]` | a size-1 dimension | same as `unsqueeze` | [4](lessons/04-indexing-and-views.md) |
| Filter | `x[x > 0]`, `x[(x > 0) & (x < 5)]` | a 1-D copy of the matches | use `&`, `\|`, `~` with brackets | [4](lessons/04-indexing-and-views.md) |
| Pick positions | `x[[0, 2]]`, `x[idx_tensor]` | a copy of those rows | index tensors must be int64 (or int32, bool) | [4](lessons/04-indexing-and-views.md) |
| Write | `x[mask] = 0` | changes x in place | works on views too | [4](lessons/04-indexing-and-views.md) |
| Choose per element | `torch.where(cond, a, b)` | a new tensor | broadcasts its inputs | [4](lessons/04-indexing-and-views.md) |
| Copy | `x.clone()` | independent memory | slicing returns views | [4](lessons/04-indexing-and-views.md) |
| Leave PyTorch | `.item()`, `.tolist()`, `.numpy()` | a number, lists, an array | numpy() shares memory, CPU only | [4](lessons/04-indexing-and-views.md) |
| New shape | `x.reshape(2, -1)`, `x.view(2, -1)` | same elements, new shape | element count must match; one -1 allowed | [5](lessons/05-reshaping.md) |
| Contiguity | `x.is_contiguous()`, `x.contiguous()` | a row-major copy if needed | `.t()` and `.permute()` aren't contiguous | [5](lessons/05-reshaping.md) |
| Size-1 dims | `x.unsqueeze(0)`, `x.squeeze(0)` | add or remove a batch dim | plain `squeeze()` removes every size-1 dim | [5](lessons/05-reshaping.md) |
| Reorder dims | `x.permute(2, 0, 1)`, `x.transpose(0, 1)` | a view with new strides | HWC → CHW is `permute(2, 0, 1)` | [5](lessons/05-reshaping.md) |
| Flatten features | `x.flatten(1)` | `[batch, features]` | keeps dim 0 | [5](lessons/05-reshaping.md) |
| Join | `torch.cat(ts, dim)`, `torch.stack(ts, dim)` | along an existing / a new dim | stack needs identical shapes | [5](lessons/05-reshaping.md) |
| Split | `x.split(size)`, `x.split([a, b])`, `x.chunk(n)` | a tuple of views | split takes sizes, chunk takes a count | [5](lessons/05-reshaping.md) |
| Element-wise | `a + b`, `a * b`, `torch.exp(a)`, `a.clamp(0, 1)` | same shape as the inputs | `*` isn't matrix multiplication | [6](lessons/06-tensor-math.md) |
| Broadcasting | shapes compared from the right | combine different shapes | each pair equal or 1 | [6](lessons/06-tensor-math.md) |
| Matrix product | `a @ b`, `torch.matmul` | `[n, k] @ [k, m] → [n, m]` | inner sizes and dtypes must match | [6](lessons/06-tensor-math.md) |
| Batched product | `torch.bmm(a, b)` or `a @ b` | `[b, n, k] @ [b, k, m] → [b, n, m]` | `@` also broadcasts batch dims | [6](lessons/06-tensor-math.md) |
| Reduce | `x.sum(dim=0)`, `x.mean(dim=1, keepdim=True)` | fewer dimensions | the dim you pass disappears | [6](lessons/06-tensor-math.md) |
| Predicted classes | `logits.argmax(dim=1)` | one index per sample | no dim gives a flattened index | [6](lessons/06-tensor-math.md) |
| Max with positions | `values, idx = x.max(dim=1)` | a named tuple | `x.max()` with no dim gives one value | [6](lessons/06-tensor-math.md) |
| In place | `x.add_(1)`, `x += 1`, `x.zero_()` | changes x | can break autograd (Part 2) | [6](lessons/06-tensor-math.md) |
| Check hardware | `torch.cuda.is_available()`, `torch.backends.mps.is_available()` | True or False | real CPU-only builds raise "Torch not compiled with CUDA enabled" | [7](lessons/07-devices.md) |
| Pick a device | `torch.accelerator.current_accelerator().type if torch.accelerator.is_available() else "cpu"` | a device string | choose once, use everywhere | [7](lessons/07-devices.md) |
| Move | `x = x.to(device)`, `.cuda()`, `.cpu()` | a copy on the device | not in place for tensors | [7](lessons/07-devices.md) |
| Create on device | `torch.zeros(n, device=device)` | no CPU copy | `*_like` keeps the device | [7](lessons/07-devices.md) |
| Same-device rule | every operand on one device | otherwise a RuntimeError | 0-D CPU tensors are the exception | [7](lessons/07-devices.md) |
| To NumPy | `t.detach().cpu().numpy()` | a NumPy array | `.item()` copies back by itself | [7](lessons/07-devices.md) |
| GPU memory | `torch.cuda.memory_allocated()` | bytes in use | blocks of 512 bytes; OOM raises `torch.OutOfMemoryError` | [7](lessons/07-devices.md) |
| Fast transfers | `pin_memory()`, `non_blocking=True` | overlapping copies | move data once, keep it there | [7](lessons/07-devices.md) |
