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

## Autograd [8–9]

```python
w = torch.randn(3, requires_grad=True)   # a leaf autograd tracks
loss = ((x @ w - y) ** 2).mean()         # forward: builds the graph (grad_fn)
loss.backward()                          # fills w.grad (adds to it!)
with torch.no_grad():
    w -= lr * w.grad                     # update in place, unrecorded
w.grad = None                            # or w.grad.zero_()
```

- `backward()` needs a scalar (or `gradient=`), frees the graph (`retain_graph=True` to reuse), and only fills leaves' `.grad`.
- Stop tracking: `t.detach()`, `with torch.no_grad():`, `with torch.inference_mode():` (fastest; its tensors can't be trained on later). Freeze: `p.requires_grad_(False)`.
- `torch.autograd.grad(y, x)` returns gradients without touching `.grad`.
- Learning rate too high → the loss diverges to `nan`; too low → it crawls.

## Models, losses and optimizers [10–11]

```python
from torch import nn, optim
import torch.nn.functional as F

class Net(nn.Module):
    def __init__(self):
        super().__init__()                  # first!
        self.fc1 = nn.Linear(4, 16)         # weight [16, 4], bias [16]
        self.fc2 = nn.Linear(16, 3)
    def forward(self, x):
        return self.fc2(F.relu(self.fc1(x)))   # logits

model = Net().to(device)                    # modules move in place
opt = optim.AdamW(model.parameters(), lr=1e-3, weight_decay=0.01)
loss_fn = nn.CrossEntropyLoss()
```

| Task | Output | Target | Loss |
|---|---|---|---|
| a number | `[N, 1]` / `[N]` | same shape, float | `MSELoss`, `L1Loss`, `HuberLoss` |
| one of C classes | logits `[N, C]` | int64 `[N]` | `CrossEntropyLoss` (no softmax first) |
| yes/no, multi-label | logits `[N]` / `[N, L]` | same shape, float 0/1 | `BCEWithLogitsLoss` |

- `nn.Linear(in, out)` has in × out + out parameters; layers in a plain list aren't registered (use `nn.ModuleList`).
- SGD (`momentum=0.9`), Adam (lr 1e-3), AdamW (decoupled weight decay). `zero_grad()` sets grads to `None`.

## Training, evaluation and saving [12–13]

```python
for epoch in range(epochs):
    model.train()
    for xb, yb in batches:                  # shuffled each epoch
        xb, yb = xb.to(device), yb.to(device)
        loss = loss_fn(model(xb), yb)
        opt.zero_grad()
        loss.backward()
        opt.step()
    model.eval()
    with torch.no_grad():
        val_acc = (model(x_val).argmax(1) == y_val).float().mean().item()

torch.save(model.state_dict(), "model.pt")                    # recommended
model.load_state_dict(torch.load("model.pt", map_location=device))
torch.save({"epoch": epoch, "model_state_dict": model.state_dict(),
            "optimizer_state_dict": opt.state_dict()}, "ckpt.pt")
```

- `model.eval()` changes Dropout and BatchNorm only; `no_grad` / `inference_mode` stop gradient tracking. Use both to evaluate.
- Overfitting: training loss falls while validation loss rises. Keep the best weights with `copy.deepcopy(model.state_dict())` (state_dict shares memory).
- `torch.load` uses `weights_only=True` since PyTorch 2.6: whole pickled models need `weights_only=False` (trusted files only).
- `load_state_dict` checks names and shapes; `strict=False` tolerates missing/extra keys, never size mismatches.
- Predict: `model.eval()`, `with torch.inference_mode():`, add a batch dim (`x.unsqueeze(0)`), `softmax(dim=1)` for probabilities, `argmax(dim=1)` for the class.

## Data [14–18]

```python
from torch.utils.data import Dataset, TensorDataset, DataLoader, random_split, WeightedRandomSampler
from torchvision.transforms import v2

class MyData(Dataset):                          # map-style: __len__ + __getitem__
    def __init__(self, paths, labels, transform=None): ...
    def __len__(self): return len(self.labels)
    def __getitem__(self, i): return self.transform(load(self.paths[i])), self.labels[i]

train, val = random_split(ds, [0.8, 0.2], generator=torch.Generator().manual_seed(0))
train_loader = DataLoader(train, batch_size=64, shuffle=True, num_workers=4, pin_memory=True, persistent_workers=True)
val_loader = DataLoader(val, batch_size=128)    # no shuffle, no augmentation
for xb, yb in train_loader:
    xb, yb = xb.to(device, non_blocking=True), yb.to(device, non_blocking=True)

train_tf = v2.Compose([v2.ToImage(), v2.RandomHorizontalFlip(), v2.RandomCrop(32, padding=4),
                       v2.ToDtype(torch.float32, scale=True), v2.Normalize(mean, std)])
eval_tf = v2.Compose([v2.ToImage(), v2.ToDtype(torch.float32, scale=True), v2.Normalize(mean, std)])
```

- `len(loader)` = ceil(n / batch_size), or n // batch_size with `drop_last=True`. `shuffle=True` draws a new order every epoch.
- `default_collate` stacks tensors on a new dim 0; ints → int64, **floats → float64**, strings → lists, tuples → lists.
- Variable lengths: a `collate_fn` with `pad_sequence(seqs, batch_first=True)`.
- `sampler=` and `shuffle=True` are mutually exclusive. Imbalance: `WeightedRandomSampler(1 / counts[labels], len(labels))` (one weight per **sample**) or `nn.CrossEntropyLoss(weight=n / (k * counts))` (one per **class**).
- Workers: own dataset copy each, seed `base_seed + worker_id`; `get_worker_info()` is None in the main process. Shard an `IterableDataset` by `info.id` / `info.num_workers` or every sample repeats.
- Leakage: fit normalisation statistics on the training split only; dedupe before splitting; touch the test set once.
- Sanity checks: one batch's shapes, dtypes, ranges and `isfinite`; overfit one batch; first cross-entropy ≈ ln(classes).

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
| Track a tensor | `torch.tensor(…, requires_grad=True)` | its gradient after backward | only float or complex tensors | [8](lessons/08-autograd.md) |
| Compute gradients | `loss.backward()` | `.grad` on every leaf | loss must be a scalar | [8](lessons/08-autograd.md) |
| Read the graph | `y.grad_fn`, `.next_functions`, `.is_leaf` | how y was computed | leaves have no grad_fn | [8](lessons/08-autograd.md) |
| Reset | `x.grad = None` or `x.grad.zero_()` | a clean slate | gradients accumulate otherwise | [8](lessons/08-autograd.md) |
| Stop recording | `with torch.no_grad():`, `t.detach()` | no graph, less memory | inference_mode is faster still | [8](lessons/08-autograd.md) |
| Freeze | `p.requires_grad_(False)` | the weight stays fixed | it still takes part in the forward pass | [8](lessons/08-autograd.md) |
| Gradient as a value | `torch.autograd.grad(y, x)` | a tuple of gradients | doesn't touch `.grad` | [8](lessons/08-autograd.md) |
| Update rule | `w -= lr * w.grad` inside `torch.no_grad()` | one step downhill | in place, not `w = w - …` | [9](lessons/09-gradient-descent.md) |
| One step | forward → loss → backward → update → zero | a lower loss | the order matters | [9](lessons/09-gradient-descent.md) |
| Learning rate | try 0.1, 0.03, 0.01 … | fast, stable training | too high diverges (nan) | [9](lessons/09-gradient-descent.md) |
| Diagnose | plot `loss.item()` per step | the learning curve | log scale helps | [9](lessons/09-gradient-descent.md) |
| Mini-batches | a random subset per step | cheap, noisy gradients | an epoch = all batches once | [9](lessons/09-gradient-descent.md) |
| Dense layer | `nn.Linear(in_f, out_f)` | `[…, in_f] → […, out_f]` | weight is `[out_f, in_f]` | [10](lessons/10-nn-module.md) |
| Parameter count | `in_f × out_f + out_f` | per Linear layer | `sum(p.numel() for p in model.parameters())` | [10](lessons/10-nn-module.md) |
| Non-linearity | `nn.ReLU()`, `F.relu(x)` | curved functions | no parameters | [10](lessons/10-nn-module.md) |
| Chain of layers | `nn.Sequential(…)` | a model in one line | index with `model[0]` | [10](lessons/10-nn-module.md) |
| Custom model | subclass `nn.Module`, `super().__init__()`, `forward` | any architecture | call it: `model(x)` | [10](lessons/10-nn-module.md) |
| Lists of layers | `nn.ModuleList([…])` | registered sub-modules | a plain list hides them | [10](lessons/10-nn-module.md) |
| Move | `model.to(device)` | parameters moved in place | before creating the optimizer | [10](lessons/10-nn-module.md) |
| Regression | `nn.MSELoss()`, `nn.L1Loss()` | mean squared / absolute error | same shapes for pred and target | [11](lessons/11-losses-and-optimizers.md) |
| Multi-class | `nn.CrossEntropyLoss()(logits, labels)` | log_softmax + NLL | logits `[N, C]`, int64 labels `[N]` | [11](lessons/11-losses-and-optimizers.md) |
| Yes/no, multi-label | `nn.BCEWithLogitsLoss()` | sigmoid + BCE, stable | float 0/1 targets, same shape | [11](lessons/11-losses-and-optimizers.md) |
| Plain SGD | `optim.SGD(params, lr=0.1, momentum=0.9)` | p ← p − lr · grad (with velocity) | lr around 0.01–0.1 | [11](lessons/11-losses-and-optimizers.md) |
| Adaptive | `optim.Adam(params, lr=1e-3)`, `optim.AdamW(…, weight_decay=0.01)` | per-parameter step sizes | AdamW decouples weight decay | [11](lessons/11-losses-and-optimizers.md) |
| Training step | `pred = model(x); loss = …; opt.zero_grad(); loss.backward(); opt.step()` | one update | zero_grad sets `.grad` to None | [11](lessons/11-losses-and-optimizers.md) |
| Split data | `perm = torch.randperm(n)`; slice train / val | honest validation | shuffle before splitting | [12](lessons/12-training-loop.md) |
| Epoch loop | `for epoch …: model.train(); for batch …: step` | many updates | reshuffle each epoch | [12](lessons/12-training-loop.md) |
| Evaluate | `model.eval()` + `with torch.no_grad():` | deterministic, cheap metrics | then `model.train()` again | [12](lessons/12-training-loop.md) |
| Accuracy | `(logits.argmax(1) == y).float().mean()` | fraction correct | bools must be cast to float | [12](lessons/12-training-loop.md) |
| Dropout / BatchNorm | behave differently in train and eval | regularisation, normalisation | BatchNorm needs batches > 1 in training | [12](lessons/12-training-loop.md) |
| Early stopping | `best = copy.deepcopy(model.state_dict())` | the best epoch's weights | state_dict shares memory | [12](lessons/12-training-loop.md) |
| On a GPU | `model.to(device)` once; `xb.to(device)` per batch | the same loop, faster | move the model before the optimizer | [12](lessons/12-training-loop.md) |
| Save | `torch.save(model.state_dict(), "model.pt")` | a portable weights file | the recommended way | [13](lessons/13-saving-and-loading.md) |
| Load | `model = Net(); model.load_state_dict(torch.load("model.pt"))` | the trained weights | build the same architecture first | [13](lessons/13-saving-and-loading.md) |
| Safety | `torch.load(path)` uses `weights_only=True` | refuses arbitrary objects | `weights_only=False` only for trusted files | [13](lessons/13-saving-and-loading.md) |
| Partial load | `load_state_dict(sd, strict=False)` | skips missing / extra keys | shapes must still match | [13](lessons/13-saving-and-loading.md) |
| Resume | save `{"model_state_dict", "optimizer_state_dict", "epoch", …}` | exact continuation | then `model.train()` | [13](lessons/13-saving-and-loading.md) |
| Other device | `torch.load(path, map_location="cpu")` | GPU checkpoint on a CPU | or `map_location=device` | [13](lessons/13-saving-and-loading.md) |
| Predict | `model.eval()`; `with torch.inference_mode(): model(x.unsqueeze(0)).argmax(1)` | a class index | softmax only for probabilities | [13](lessons/13-saving-and-loading.md) |
| Data already in tensors | `TensorDataset(x, y)` | `ds[i] == (x[i], y[i])` | every tensor needs the same size of dim 0 | [14](lessons/14-datasets.md) |
| Your own data | `class MyData(Dataset)` with `__len__`, `__getitem__` | samples on demand | float32 features, int64 labels | [14](lessons/14-datasets.md) |
| Big data on disk | store paths in `__init__`, read in `__getitem__` | low memory, parallel loading | lazy loading | [14](lessons/14-datasets.md) |
| Some samples | `Subset(ds, indices)` | a view by index | indexes into the original dataset | [14](lessons/14-datasets.md) |
| Join datasets | `ConcatDataset([a, b])` or `a + b` | one longer dataset | map-style only | [14](lessons/14-datasets.md) |
| Split | `random_split(ds, [0.8, 0.1, 0.1], generator=g)` | Subsets | fractions round down; leftovers go to the first pieces | [14](lessons/14-datasets.md) |
| Batches | `DataLoader(ds, batch_size=32)` | tensors with a batch dim | last batch may be smaller | [15](lessons/15-dataloaders.md) |
| Equal-sized batches | `drop_last=True` | len = n // batch_size | the leftover samples are skipped that epoch | [15](lessons/15-dataloaders.md) |
| Training order | `shuffle=True` | a new permutation each epoch | don't shuffle validation or test | [15](lessons/15-dataloaders.md) |
| Reproducible order | `generator=torch.Generator().manual_seed(0)` | the same shuffles every run | iterating also draws a base seed | [15](lessons/15-dataloaders.md) |
| Default batching | `default_collate` | stacked tensors; ints → int64, floats → float64 | tuples come back as lists | [15](lessons/15-dataloaders.md) |
| Variable lengths | `collate_fn=pad_batch` with `pad_sequence(..., batch_first=True)` | `[batch, longest]` | pad per batch, keep the lengths | [15](lessons/15-dataloaders.md) |
| Training loop | `for xb, yb in train_loader:` then the five steps | one epoch | `xb.to(device)` inside the loop | [15](lessons/15-dataloaders.md) |
| Choose the order | `sampler=RandomSampler(ds)` / `SequentialSampler(ds)` | the index order | can't combine with shuffle= | [16](lessons/16-samplers-and-workers.md) |
| Some indexes, shuffled | `SubsetRandomSampler(idx)` | a random order of chosen indexes | for manual splits | [16](lessons/16-samplers-and-workers.md) |
| Balance classes | `WeightedRandomSampler(1 / counts[labels], len(labels))` | rare classes drawn more | one weight per sample; repeats rare samples | [16](lessons/16-samplers-and-workers.md) |
| Parallel loading | `num_workers=4` | batches loaded in the background | each worker: own dataset copy, seed base_seed + id | [16](lessons/16-samplers-and-workers.md) |
| Who am I? | `get_worker_info()` | id, num_workers, seed, dataset | None in the main process | [16](lessons/16-samplers-and-workers.md) |
| Streams | `IterableDataset` with `__iter__` | data read in order | shard by `info.id` and `info.num_workers` | [16](lessons/16-samplers-and-workers.md) |
| Faster GPU copies | `pin_memory=True` + `.to(device, non_blocking=True)` | overlapped transfers | warns without an accelerator | [16](lessons/16-samplers-and-workers.md) |
| Reuse workers | `persistent_workers=True` | no restart each epoch | needs num_workers > 0 | [16](lessons/16-samplers-and-workers.md) |
| To a model input | `v2.Compose([v2.ToImage(), v2.ToDtype(torch.float32, scale=True), v2.Normalize(mean, std)])` | float32 `[C, H, W]`, about mean 0 | Normalize needs floats | [17](lessons/17-transforms.md) |
| Channels first | `v2.ToImage()` | `[H, W, C]` array → `[C, H, W]` Image | dtype unchanged | [17](lessons/17-transforms.md) |
| Scale | `v2.ToDtype(torch.float32, scale=True)` | uint8 0–255 → 0–1 | replaces ToTensor | [17](lessons/17-transforms.md) |
| Statistics | `x.mean(dim=(0, 2, 3))`, `x.std(dim=(0, 2, 3))` | one value per channel | training images only | [17](lessons/17-transforms.md) |
| Augment | `v2.RandomHorizontalFlip()`, `v2.RandomCrop(28, padding=4)` | a new variation each epoch | training pipeline only | [17](lessons/17-transforms.md) |
| In a Dataset | `transform`, `target_transform` in `__getitem__` | per-sample processing | labels pass through v2 transforms | [17](lessons/17-transforms.md) |
| Find gaps | `any(v.strip() == "" for v in row.values())` / `torch.isnan(x)` | rows to drop or impute | check before `float(...)` | [18](lessons/18-data-quality.md) |
| Non-finite values | `torch.isfinite(x).all()`, `torch.nan_to_num(x)` | catch NaN and inf | one NaN poisons the whole model | [18](lessons/18-data-quality.md) |
| Avoid leakage | fit mean / std on `train` only, apply to val and test | honest validation scores | dedupe before splitting | [18](lessons/18-data-quality.md) |
| Stratify | split each class's indexes separately | every class in every split | matters for small, imbalanced data | [18](lessons/18-data-quality.md) |
| Weight the loss | `nn.CrossEntropyLoss(weight=n / (k * counts))` | rare classes matter more | one weight per class | [18](lessons/18-data-quality.md) |
| Sanity check | inspect `next(iter(loader))`, overfit one batch | shapes, dtypes, ranges; loss → 0 | first loss ≈ ln(classes) | [18](lessons/18-data-quality.md) |
