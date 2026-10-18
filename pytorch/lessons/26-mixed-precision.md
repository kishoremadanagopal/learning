# Lesson 26: Mixed precision training

**You'll learn:** why 16-bit is faster (tensor cores, memory bandwidth), float16 versus bfloat16 range and precision, torch.autocast for CUDA and CPU, the lower-precision and float32 operation lists, operations that follow their inputs, float64 left alone, float32 master weights, backward outside autocast, nested enabled=False, the deprecated torch.cuda.amp.autocast, gradient underflow and loss scaling, torch.amp.GradScaler (scale, step, update, unscale_, get_scale, state_dict), skipped steps and the adaptive scale, clipping after unscale_, bfloat16 without a scaler, binary_cross_entropy versus BCEWithLogitsLoss under autocast.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/pytorch/#mixed-precision)**: run every example and check your exercise answers.

## Key terms

- **Mixed precision:** running some operations in 16-bit floats and others in float32 within one model.
- **Autocast:** a context in which each operation automatically chooses float16/bfloat16 or float32.
- **Tensor cores:** GPU units that multiply 16-bit (and TF32) matrices much faster than float32 units.
- **Master weights:** the float32 copy of the parameters that the optimizer updates.
- **Underflow:** a value too small for the format, which becomes zero.
- **Loss scaling:** multiplying the loss by a large factor so float16 gradients don't underflow, then dividing the gradients back.
- **GradScaler:** the object that scales the loss, unscales gradients, skips steps with inf or nan and adjusts the scale.
- **Growth interval:** the number of clean steps after which GradScaler doubles the scale (2000 by default).

GPUs run matrix multiplications in 16-bit floats several times faster than in float32 (on **tensor cores**), and 16-bit tensors halve memory traffic. But some operations need float32's precision or range. **Mixed precision** gets the speed without losing accuracy: run the operations that benefit in 16 bits, keep the sensitive ones and the weights in float32.

Part 1 covered the two 16-bit formats: **float16** (more precision, tiny range: overflows above 65504, and small gradients underflow to 0) and **bfloat16** (float32's range, less precision). Modern GPUs (NVIDIA Ampere and newer, and TPUs) support bfloat16, which makes mixed precision much simpler.

## torch.autocast

Inside `with torch.autocast(device_type, dtype):`, each operation picks its own precision:

| Runs in the autocast dtype (16-bit) | Runs in float32 | Unchanged |
|---|---|---|
| `matmul`, `@`, `mm`, `bmm`, `linear`, convolutions, `scaled_dot_product_attention` | on CUDA: `softmax`, `log_softmax`, `sum`, `exp`, `log`, `pow`, `layer_norm`, `norm`, losses (`cross_entropy`, `mse_loss`, `nll_loss`…) | `relu`, `+`, `*` and other ops: follow their inputs' dtypes |

```python
import torch
from torch import nn
import torch.nn.functional as F

torch.manual_seed(0)
model = nn.Sequential(nn.Linear(8, 16), nn.ReLU(), nn.Linear(16, 4)).cuda()
x = torch.randn(5, 8, device="cuda")
y = torch.randint(0, 4, (5,), device="cuda")

with torch.autocast(device_type="cuda", dtype=torch.float16):
    logits = model(x)
    print(logits.dtype)                        # linear layers ran in float16
    print(logits.softmax(dim=-1).dtype)        # softmax runs in float32 for accuracy
    loss = F.cross_entropy(logits, y)
    print(loss.dtype)                          # losses run in float32
print(model[0].weight.dtype)                   # the weights themselves stay float32
loss.backward()                                # backward outside the autocast block
print(model[0].weight.grad.dtype)
```

Rules worth remembering:

- Wrap only the **forward pass and the loss**. Call `backward()` outside: autograd automatically runs each backward operation in the dtype its forward used.
- The model's weights stay **float32** (the "master weights"); autocast makes 16-bit copies of them for each operation. Don't call `model.half()` for training: updates smaller than float16's precision would be lost.
- On CPUs, use `device_type="cpu"` with `dtype=torch.bfloat16` (the CPU default). Its float32 list is shorter (mainly losses).
- `torch.autocast(..., enabled=False)` inside an autocast block turns it off for a region; `@torch.autocast(...)` works as a decorator. The old `torch.cuda.amp.autocast` is deprecated: use `torch.amp.autocast("cuda")` or `torch.autocast("cuda")`.

```python
import torch
from torch import nn

torch.manual_seed(0)
lin = nn.Linear(4, 3)
x = torch.randn(2, 4)
with torch.autocast(device_type="cpu", dtype=torch.bfloat16):
    out = lin(x)
    print(out.dtype, torch.is_autocast_enabled("cpu"))
    with torch.autocast(device_type="cpu", enabled=False):
        print(lin(x).dtype)                    # autocast switched off here
print(out)
```

## Gradient scaling for float16

With float16, gradients for small weights can be so small that they **underflow** to zero, and those weights stop learning. **Loss scaling** fixes it: multiply the loss by a large factor (initially 65536) before `backward()`, so the gradients are scaled up into float16's range, then divide them back before the optimizer uses them.

![float32 master weights; an autocast forward runs matmuls and convolutions in fp16 and softmax and losses in fp32; GradScaler multiplies the loss by the scale; backward produces scaled fp16 gradients; unscale_ divides by the scale and skips the step if any gradient is inf or nan; optimizer.step() updates the float32 weights; update() halves the scale after an overflow, otherwise slowly grows it. float16 needs loss scaling; bfloat16 has float32's range and doesn't](../figures/amp.svg)

`torch.amp.GradScaler` does the bookkeeping:

```python
scaler = torch.amp.GradScaler("cuda")

for xb, yb in loader:
    optimizer.zero_grad()
    with torch.autocast(device_type="cuda", dtype=torch.float16):
        loss = loss_fn(model(xb), yb)
    scaler.scale(loss).backward()          # backward on the scaled loss
    scaler.unscale_(optimizer)             # only needed before clipping or inspecting gradients
    torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
    scaler.step(optimizer)                 # unscales (if not done yet), skips the step if grads have inf/nan
    scaler.update()                        # adjusts the scale for the next iteration
```

The scale adapts: after an overflow (inf or nan gradients) `step()` **skips** the update and `update()` **halves** the scale; after 2000 clean steps in a row it **doubles** it. A few skipped steps early in training are normal.

```python
import torch
from torch import nn, optim

torch.manual_seed(0)
lin = nn.Linear(2, 1)
opt = optim.SGD(lin.parameters(), lr=0.1)
scaler = torch.amp.GradScaler("cpu", init_scale=8.0, growth_interval=2)
x = torch.ones(1, 2)
for step in range(4):
    opt.zero_grad()
    scaler.scale(lin(x).sum()).backward()
    scaler.step(opt)
    scaler.update()
    print(step, scaler.get_scale())            # doubles every 2 clean steps

opt.zero_grad()
scaler.scale(lin(x).sum() * float("inf")).backward()     # force an overflow
before = lin.weight.clone()
scaler.step(opt)
scaler.update()
print(torch.equal(before, lin.weight), scaler.get_scale())   # step skipped, scale halved
print(scaler.state_dict())
```

Include `scaler.state_dict()` in checkpoints, so a resumed run starts from the learned scale.

## bfloat16: usually simpler

bfloat16 has float32's exponent range, so gradients don't underflow and **no GradScaler is needed**:

```python
with torch.autocast(device_type="cuda", dtype=torch.bfloat16):
    loss = loss_fn(model(xb), yb)
loss.backward()
optimizer.step()
```

| | float16 + GradScaler | bfloat16 |
|---|---|---|
| GPUs | most NVIDIA GPUs (Volta and newer) | Ampere (A100, RTX 30xx) and newer, TPUs |
| range problems | possible; the scaler handles them | rare |
| precision | 10 mantissa bits | 7 mantissa bits |
| usual choice today | older GPUs | **default** where supported (`torch.cuda.is_bf16_supported()`) |

Don't use `F.binary_cross_entropy` (on probabilities) under CUDA autocast: it raises an error, because a sigmoid followed by BCE is unstable in float16. Use `BCEWithLogitsLoss` on raw logits, which is safe.

## At a glance

| Concept | Code | Gives you | Remember |
|---|---|---|---|
| Autocast (GPU) | `with torch.autocast("cuda", dtype=torch.float16):` | matmul/linear/conv in fp16 | forward and loss only |
| Autocast (CPU) | `with torch.autocast("cpu", dtype=torch.bfloat16):` | matmul/linear/conv in bf16 | bf16 is the CPU default |
| Stays float32 (CUDA) | softmax, log_softmax, sum, exp, log, pow, layer_norm, losses | accuracy | float64 never cast |
| Scale | `scaler.scale(loss).backward()` | scaled gradients | `torch.amp.GradScaler("cuda")` |
| Clip | `scaler.unscale_(opt)` then `clip_grad_norm_` | true gradient sizes | once per optimizer per step |
| Step | `scaler.step(opt); scaler.update()` | skips on inf/nan | scale ×0.5 on overflow, ×2 after 2000 clean steps |
| bfloat16 | autocast with `dtype=torch.bfloat16`, plain `backward()` | no scaler needed | float32's range |
| Checkpoint | `scaler.state_dict()` / `load_state_dict` | resumes the scale | alongside model and optimizer |

## Common mistakes

- Calling `model.half()` for training instead of autocast.
- Putting `backward()` inside the autocast block.
- Clipping gradients before `scaler.unscale_(optimizer)`.
- Calling `unscale_` twice for the same optimizer before `update()`.
- Treating early skipped steps as a bug.
- Using a GradScaler with bfloat16 (unneeded) or forgetting it with float16.
- Using `F.binary_cross_entropy` under CUDA autocast instead of `BCEWithLogitsLoss`.
- Leaving the scaler's state out of checkpoints.

## Exercises

### 1. A mixed-precision training step

Write `amp_step(model, x, y, loss_fn, opt, scaler)` for float16 training on CUDA: zero the gradients, run the forward pass and loss under `torch.autocast(device_type="cuda", dtype=torch.float16)`, backward on the **scaled** loss, unscale, clip the gradient norm to 1.0, step through the scaler, update the scaler, and return the (unscaled) loss as a Python float.

Starter code:

```python
import torch
from torch import nn, optim

def amp_step(model, x, y, loss_fn, opt, scaler):
    pass

torch.manual_seed(0)
model = nn.Linear(4, 2).cuda()
opt = optim.SGD(model.parameters(), lr=0.1)
scaler = torch.amp.GradScaler("cuda", init_scale=1024.0)
x, y = torch.randn(8, 4, device="cuda"), torch.randint(0, 2, (8,), device="cuda")
print(amp_step(model, x, y, nn.CrossEntropyLoss(), opt, scaler), scaler.get_scale())
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** the standard AMP recipe, with clipping in the right place.
2. **Examples:** without `unscale_`, clipping would compare gradients 1024 times too large with the threshold 1.0.
3. **Brute force:** multiply and divide by a fixed scale yourself: no overflow detection, no adaptive scale.
4. **Pattern:** **autocast forward → scale → backward → unscale_ → clip → step → update**.
5. **Plan:** follow the pattern in order.
6. **Code and test:** compare the updated weights with a reference run.

</details>

<details>
<summary>💡 Hint 1</summary>

Only the forward pass and the loss go inside `with torch.autocast(...)`.

</details>

<details>
<summary>💡 Hint 2</summary>

`scaler.scale(loss).backward()`; then `scaler.unscale_(opt)` before `clip_grad_norm_`, so the clipping sees the true gradient sizes.

</details>

<details>
<summary>💡 Hint 3</summary>

Finish with `scaler.step(opt)` and `scaler.update()`, and return `loss.item()` (the loss before scaling).

</details>

### 2. Predict the dtypes under autocast

Inside `torch.autocast(device_type="cuda", dtype=torch.float16)`, with `w` a float32 CUDA tensor of shape `[4, 4]`, `x` a float32 CUDA tensor of shape `[2, 4]` and `d` a float64 CUDA tensor, fill in `answers`: each expression's result dtype. Predict, then run them to check.

Starter code:

```python
import torch

answers = {
    "x @ w": None,
    "(x @ w).relu()": None,
    "(x @ w).softmax(dim=-1)": None,
    "(x @ w).sum()": None,
    "x + 1": None,
    "(x @ w) + x": None,
    "d @ d": None,
}
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** three behaviours: cast down, cast up to float32, or leave alone.
2. **Examples:** `lin(x)` under autocast is float16; `loss` is float32.
3. **Brute force:** run each line (allowed here; not in the exam).
4. **Pattern:** **lower-precision list / float32 list / promotion** for everything else.
5. **Plan:** classify each operation.
6. **Code and test:** check the answers.

</details>

<details>
<summary>💡 Hint 1</summary>

Matmul-like operations go to float16; numerically sensitive ones (softmax, sum, exp, log, losses) go to float32.

</details>

<details>
<summary>💡 Hint 2</summary>

Operations on neither list (relu, +) keep their inputs' dtype, using normal type promotion when dtypes differ.

</details>

<details>
<summary>💡 Hint 3</summary>

Autocast only casts float32 (and 16-bit) tensors: float64 is left alone.

</details>

**In the sandbox:** exercises 51–52. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. A mixed-precision training step</summary>

```python
import torch
from torch import nn, optim

def amp_step(model, x, y, loss_fn, opt, scaler):
    opt.zero_grad()
    with torch.autocast(device_type="cuda", dtype=torch.float16):
        loss = loss_fn(model(x), y)
    scaler.scale(loss).backward()
    scaler.unscale_(opt)
    torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
    scaler.step(opt)
    scaler.update()
    return loss.item()

torch.manual_seed(0)
model = nn.Linear(4, 2).cuda()
opt = optim.SGD(model.parameters(), lr=0.1)
scaler = torch.amp.GradScaler("cuda", init_scale=1024.0)
x, y = torch.randn(8, 4, device="cuda"), torch.randint(0, 2, (8,), device="cuda")
print(amp_step(model, x, y, nn.CrossEntropyLoss(), opt, scaler), scaler.get_scale())
```

**Line by line**

- `torch.autocast(..., float16)` makes the linear layers run in float16; cross-entropy runs in float32.
- `scaler.scale(loss)` multiplies by the current scale (here 1024); `backward()` then produces scaled gradients.
- `scaler.unscale_(opt)` divides the gradients of that optimizer's parameters by the scale, in place, and records whether any is inf or nan.
- `clip_grad_norm_` now clips the real gradients.
- `scaler.step(opt)` skips the update if an inf or nan was found, otherwise calls `opt.step()`; it doesn't unscale again.
- `scaler.update()` adjusts the scale; `loss.item()` is the true loss, because only the copy passed to backward was scaled.

**Common wrong approach:** clipping before `unscale_`. The clip threshold then applies to scaled gradients, so it almost always clips, by a huge factor.

</details>

<details>
<summary>✅ 2. Predict the dtypes under autocast</summary>

```python
import torch

answers = {
    "x @ w": torch.float16,                    # matmul: autocast to float16
    "(x @ w).relu()": torch.float16,           # not on a list: follows its float16 input
    "(x @ w).softmax(dim=-1)": torch.float32,  # softmax: float32 on CUDA
    "(x @ w).sum()": torch.float32,            # sum: float32 on CUDA
    "x + 1": torch.float32,                    # not on a list: float32 input stays float32
    "(x @ w) + x": torch.float32,              # ordinary type promotion: float16 + float32 → float32
    "d @ d": torch.float64,                    # float64 tensors are never autocast
}
```

**The rules applied**

| Expression | Result | Why |
|---|---|---|
| `x @ w` | float16 | matmul is on the lower-precision list |
| `.relu()` | float16 | not listed: keeps its input's dtype |
| `.softmax()` | float32 | exponentials and normalisation need float32 on CUDA |
| `.sum()` | float32 | large reductions lose precision in float16 |
| `x + 1` | float32 | not listed, and x is float32 |
| `(x @ w) + x` | float32 | not listed; float16 + float32 promotes to float32 |
| `d @ d` | float64 | autocast never touches float64 |

**Common wrong approach:** expecting everything inside the block to be float16. Autocast is per-operation, which is exactly what keeps it accurate.

</details>

## Quick quiz

1. Inside `torch.autocast(device_type="cuda", dtype=torch.float16)`, what dtype does `nn.Linear` produce, and what dtype are its weights?
   - A) float32 output and weights
   - B) float32 output; the weights become float16
   - C) float16 output; the weights remain float32
   - D) float16 output and float16 weights

2. Why does float16 training need a GradScaler but bfloat16 usually doesn't?
   - A) bfloat16 has more mantissa bits
   - B) float16 can't be used on GPUs without it
   - C) float16's small exponent range lets small gradients underflow to zero; bfloat16 has float32's range
   - D) GradScaler doesn't support bfloat16

3. When should `scaler.unscale_(optimizer)` be called explicitly?
   - A) Before clipping or inspecting gradients, so they have their true sizes
   - B) Never: step() can't run without it
   - C) After `scaler.update()`
   - D) Before `scaler.scale(loss).backward()`

4. A GradScaler's `step()` finds inf values in the gradients. What happens?
   - A) The step runs with the inf values
   - B) The gradients are set to zero and the step runs
   - C) Training stops with an error
   - D) The optimizer step is skipped, and `update()` lowers the scale (by backoff_factor, 0.5 by default)

5. Where should `loss.backward()` be called relative to the autocast block?
   - A) Before entering it
   - B) Outside it, after the forward pass and loss
   - C) It doesn't matter, but inside is required for bfloat16
   - D) Inside it, so backward also runs in float16

6. Which loss raises an error under CUDA autocast?
   - A) `F.binary_cross_entropy_with_logits`
   - B) `F.binary_cross_entropy` (on probabilities)
   - C) `F.mse_loss`
   - D) `F.cross_entropy`

<details>
<summary>Quiz answers</summary>

1. **C) float16 output; the weights remain float32**: Autocast casts copies of the weights per operation; the stored weights stay float32.
2. **C) float16's small exponent range lets small gradients underflow to zero; bfloat16 has float32's range**: Scaling the loss moves gradients into float16's representable range.
3. **A) Before clipping or inspecting gradients, so they have their true sizes**: step() unscales automatically if you didn't; call unscale_ yourself only when you need real gradients first.
4. **D) The optimizer step is skipped, and `update()` lowers the scale (by backoff_factor, 0.5 by default)**: Occasional skipped steps are expected, especially early in training.
5. **B) Outside it, after the forward pass and loss**: Backward operations automatically use the dtypes of their forward counterparts.
6. **B) `F.binary_cross_entropy` (on probabilities)**: A sigmoid followed by BCE is unstable in float16; use BCEWithLogitsLoss, which is safe.

</details>

---
Previous: [Lesson 25](25-torch-compile.md) · Next: [Lesson 27: Distributed training](27-distributed-training.md)
