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

## Building blocks [19–21]

```python
nn.Conv2d(c_in, c_out, 3, stride=1, padding=1)   # [N, C, H, W]; out = ⌊(H + 2p − d(k−1) − 1)/s⌋ + 1
nn.MaxPool2d(2); nn.AdaptiveAvgPool2d(1); nn.BatchNorm2d(c); nn.Flatten()
nn.Embedding(vocab, dim)                          # int64 ids → vectors
nn.LSTM(in_dim, hidden, num_layers=1, batch_first=True)   # output, (h_n, c_n); h_n: [layers·dirs, N, hidden]
F.scaled_dot_product_attention(q, k, v, is_causal=True)   # bool attn_mask: True = may attend
nn.MultiheadAttention(E, heads, batch_first=True)          # bool masks: True = masked out
nn.TransformerEncoder(nn.TransformerEncoderLayer(d, h, dim_feedforward=4 * d, batch_first=True), num_layers=n)
```

- Conv params: c_out × (c_in / groups) × kH × kW + c_out. Pooling has none.
- Activations: ReLU (CNNs), GELU (Transformers), SiLU; avoid deep stacks of sigmoid/tanh (vanishing gradients).
- Init: Kaiming for ReLU (std √(2 / fan_in)), Xavier for tanh; `model.apply(fn)`; never all-equal weights.
- BatchNorm (batch statistics, train ≠ eval) for CNNs; LayerNorm (per sample) for sequences. Residual: `x + F(x)`.
- Regularise: dropout, AdamW weight decay, augmentation, early stopping (keep the best `state_dict`), `clip_grad_norm_` between backward and step.

## Optimizers and schedules [22]

```python
opt = optim.AdamW([{"params": decay, "weight_decay": 0.01}, {"params": no_decay, "weight_decay": 0.0}], lr=3e-4)
sched = optim.lr_scheduler.SequentialLR(opt, [optim.lr_scheduler.LinearLR(opt, 0.1, total_iters=w),
                                              optim.lr_scheduler.CosineAnnealingLR(opt, T_max=total - w)], milestones=[w])
for epoch in range(epochs):
    for xb, yb in loader:
        opt.zero_grad(); loss_fn(model(xb), yb).backward(); opt.step()
    sched.step()                         # after optimizer.step(); ReduceLROnPlateau: sched.step(val_loss)
```

- Adam adds weight decay to the gradient; **AdamW decouples it** (applied to the weights directly).
- StepLR(10, 0.1) from 0.1: 0.01 after 10 steps, 0.001 after 20. OneCycleLR steps every batch.
- Gradient accumulation: `zero_grad()` once, `(loss / k).backward()` per micro-batch, then `step()`.
- Checkpoints: model, optimizer and scheduler `state_dict()`s plus the epoch.

## Transfer learning [23]

```python
model.backbone.requires_grad_(False)                         # freeze
model.fc = nn.Linear(model.fc.in_features, n_classes)        # new head (trainable)
opt = optim.Adam(p for p in model.parameters() if p.requires_grad)   # create AFTER replacing the head
opt = optim.AdamW([{"params": model.backbone.parameters(), "lr": 1e-5}, {"params": model.fc.parameters(), "lr": 1e-3}])
model.load_state_dict({k: v for k, v in sd.items() if not k.startswith("fc.")}, strict=False)
h = model.layer.register_forward_hook(lambda m, inp, out: saved.append(out.detach())); ...; h.remove()
```

- Frozen BatchNorm still updates running statistics in `train()`: set those layers to `eval()`.
- Use the pretrained weights' own preprocessing (`weights.transforms()` in torchvision).
