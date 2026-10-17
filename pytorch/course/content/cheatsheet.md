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
