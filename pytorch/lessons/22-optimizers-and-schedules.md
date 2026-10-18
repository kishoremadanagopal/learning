# Lesson 22: Optimizers and learning-rate schedules

**You'll learn:** param_groups and optimizer state, SGD with momentum and Nesterov, RMSprop, Adam, AdamW and decoupled weight decay, per-group learning rates and weight decay, no decay on biases and norm weights, learning-rate schedulers (StepLR, MultiStepLR, ExponentialLR, CosineAnnealingLR, LinearLR, SequentialLR, OneCycleLR, ReduceLROnPlateau), the order of optimizer.step() and scheduler.step(), warm-up plus cosine decay, gradient accumulation, saving optimizer and scheduler state.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/pytorch/#optimizers-and-schedules)**: run every example and check your exercise answers.

## Key terms

- **Parameter group:** a set of parameters in an optimizer with its own hyperparameters such as lr and weight_decay.
- **Optimizer state:** per-parameter values an optimizer keeps between steps, such as momentum buffers and Adam's moment estimates.
- **Momentum:** a running average of past gradients that keeps updates moving in consistent directions.
- **Adaptive learning rate:** scaling each parameter's update by the history of its own gradients (RMSprop, Adam).
- **Decoupled weight decay:** shrinking weights directly, separately from the gradient update, as AdamW does.
- **Learning-rate scheduler:** an object that changes the optimizer's learning rate as training progresses.
- **Warm-up:** starting with a small learning rate and increasing it over the first steps.
- **Cosine annealing:** decreasing the learning rate along half a cosine curve.
- **Gradient accumulation:** summing gradients from several micro-batches before one optimizer step.

Part 2 introduced the optimizer's job: `step()` updates every parameter using its `.grad`. This lesson looks at the choices that most affect how fast and how well a model trains.

## Inside an optimizer

An optimizer keeps a list of **parameter groups**, each a dict holding its parameters and settings (`lr`, `momentum`, `weight_decay`…), and per-parameter **state** (momentum buffers, Adam's running averages).

```python
import torch
from torch import nn, optim

torch.manual_seed(0)
model = nn.Linear(3, 1)
opt = optim.Adam(model.parameters(), lr=1e-3)
print(opt)
print(len(opt.param_groups), opt.param_groups[0]["lr"])
model(torch.randn(4, 3)).sum().backward()
opt.step()
state = opt.state[model.weight]
print(list(state.keys()), state["step"])
```

## The common optimizers

| Optimizer | Update idea | Typical lr |
|---|---|---|
| `SGD(lr)` | step against the gradient | 0.01–0.1 |
| `SGD(lr, momentum=0.9)` | keep a running velocity, so steps build up along consistent directions | 0.01–0.1 |
| `SGD(..., nesterov=True)` | look ahead along the velocity before taking the gradient | 0.01–0.1 |
| `RMSprop(lr)` | divide by a running root-mean-square of recent gradients | 0.001–0.01 |
| `Adam(lr)` | momentum **and** per-parameter scaling (adaptive learning rates) | 1e-4–1e-3 |
| `AdamW(lr, weight_decay=0.01)` | Adam with **decoupled** weight decay | 1e-4–1e-3 |

**Adam versus AdamW:** in `Adam`, `weight_decay` is added to the gradient, so Adam's per-parameter scaling weakens it for parameters with large gradients. `AdamW` applies the decay directly to the weights, separately from the gradient step (`w ← w − lr·wd·w`), which regularises consistently. AdamW is the default choice for Transformers and most modern training.

## Different settings per group

Pass a list of dicts to give parts of the model different settings. Two common uses: a smaller learning rate for pretrained layers (next lesson), and no weight decay on biases and normalisation weights.

```python
import torch
from torch import nn, optim

model = nn.Sequential(nn.Linear(4, 8), nn.LayerNorm(8), nn.ReLU(), nn.Linear(8, 2))
decay, no_decay = [], []
for name, p in model.named_parameters():
    (no_decay if p.ndim == 1 else decay).append(p)       # biases and norm weights are 1-D
opt = optim.AdamW([{"params": decay, "weight_decay": 0.01},
                   {"params": no_decay, "weight_decay": 0.0}], lr=3e-4)
for g in opt.param_groups:
    print(len(g["params"]), g["weight_decay"], g["lr"])
```

## Learning-rate schedules

A fixed learning rate is rarely best: a larger one early makes fast progress, a smaller one later settles into a good minimum. A **scheduler** changes `param_groups[i]["lr"]` each time you call `scheduler.step()`.

![Learning rate over 60 steps starting from 0.1: StepLR(step_size=20, gamma=0.5) halves it at steps 20 and 40; CosineAnnealingLR(T_max=60) follows a half cosine down to 0; a LinearLR warm-up rises from 0.005 to 0.1 over 10 steps and then follows a cosine down; OneCycleLR rises to max_lr and then anneals to near 0](../figures/lr-schedules.svg)

| Scheduler | Schedule |
|---|---|
| `StepLR(opt, step_size, gamma=0.1)` | multiply by gamma every step_size steps |
| `MultiStepLR(opt, milestones=[30, 80], gamma=0.1)` | multiply by gamma at chosen steps |
| `ExponentialLR(opt, gamma)` | multiply by gamma every step |
| `CosineAnnealingLR(opt, T_max, eta_min=0)` | half a cosine from lr down to eta_min over T_max steps |
| `LinearLR(opt, start_factor, end_factor=1.0, total_iters)` | linear change, usually a **warm-up** from a small factor |
| `SequentialLR(opt, [s1, s2], milestones=[n])` | s1 for n steps, then s2 |
| `OneCycleLR(opt, max_lr, total_steps)` | warm up to max_lr then anneal; stepped **every batch** |
| `ReduceLROnPlateau(opt, factor=0.1, patience=10)` | cut the lr when a metric stops improving: `step(val_loss)` |

Call `optimizer.step()` **before** `scheduler.step()`, usually once per epoch (OneCycleLR and many warm-up schedules: once per batch). Calling them the other way round skips the first learning rate, and PyTorch warns:

```python
import torch
from torch import nn, optim

model = nn.Linear(2, 1)
opt = optim.SGD(model.parameters(), lr=0.1)
sched = optim.lr_scheduler.StepLR(opt, step_size=2, gamma=0.5)
for epoch in range(6):
    # ... train for one epoch: forward, loss, backward, opt.step() for every batch ...
    opt.step()
    sched.step()
    print(epoch, sched.get_last_lr())

sched2 = optim.lr_scheduler.StepLR(optim.SGD(model.parameters(), lr=0.1), step_size=2)
sched2.step()                                  # before any optimizer.step(): a warning
```

Warm-up followed by cosine decay is the standard recipe for Transformers:

```python
import torch
from torch import nn, optim

opt = optim.AdamW(nn.Linear(2, 1).parameters(), lr=1e-3)
warmup = optim.lr_scheduler.LinearLR(opt, start_factor=0.1, total_iters=3)
cosine = optim.lr_scheduler.CosineAnnealingLR(opt, T_max=5)
sched = optim.lr_scheduler.SequentialLR(opt, schedulers=[warmup, cosine], milestones=[3])
for step in range(8):
    print(step, f"{sched.get_last_lr()[0]:.6f}")
    opt.step()
    sched.step()
```

`ReduceLROnPlateau` is different: it reacts to a value you pass it, typically the validation loss.

```python
import torch
from torch import nn, optim

opt = optim.SGD(nn.Linear(2, 1).parameters(), lr=0.1)
sched = optim.lr_scheduler.ReduceLROnPlateau(opt, mode="min", factor=0.5, patience=1)
for val_loss in [1.0, 0.8, 0.85, 0.84, 0.9, 0.6]:
    sched.step(val_loss)
    print(val_loss, opt.param_groups[0]["lr"])
```

## Gradient accumulation

When the batch you want doesn't fit in memory, run several smaller **micro-batches**, call `backward()` on each (gradients add up in `.grad`), and step once. Divide each loss by the number of micro-batches so the gradient matches one big batch's mean loss.

```python
import torch
from torch import nn, optim

torch.manual_seed(0)
x, y = torch.randn(8, 3), torch.randn(8, 1)
model = nn.Linear(3, 1)
loss_fn = nn.MSELoss()

model.zero_grad()
loss_fn(model(x), y).backward()                 # one batch of 8
big = model.weight.grad.clone()

model.zero_grad()
for xb, yb in zip(x.split(2), y.split(2)):      # four micro-batches of 2
    (loss_fn(model(xb), yb) / 4).backward()
print(torch.allclose(big, model.weight.grad))
```

## Checkpoints include the optimizer and scheduler

To resume training exactly, save `optimizer.state_dict()` (momentum and Adam statistics) and `scheduler.state_dict()` alongside the model's (Part 2), and load all three.

```python
torch.save({"model": model.state_dict(), "optimizer": opt.state_dict(),
            "scheduler": sched.state_dict(), "epoch": epoch}, "checkpoint.pt")
```

## At a glance

| Concept | Code | Gives you | Remember |
|---|---|---|---|
| Default optimizer | `optim.AdamW(params, lr=3e-4, weight_decay=0.01)` | adaptive, decoupled decay | SGD + momentum still strong for CNNs |
| Per-group settings | `optim.AdamW([{"params": a, "lr": 1e-5}, {"params": b}], lr=1e-3)` | different lr / decay per group | groups can't share parameters |
| Epoch schedule | `StepLR`, `MultiStepLR`, `CosineAnnealingLR` | lr changes per `step()` | `opt.step()` first |
| Warm-up + cosine | `SequentialLR(opt, [LinearLR(...), CosineAnnealingLR(...)], milestones=[w])` | the Transformer recipe | step per batch or epoch consistently |
| One cycle | `OneCycleLR(opt, max_lr, total_steps)` | up then down | step every batch |
| On plateau | `ReduceLROnPlateau(opt, factor=0.1, patience=10)` | lower lr when stuck | `sched.step(val_loss)` |
| Big effective batch | `(loss / k).backward()` k times, then `opt.step()` | same gradient as one big batch | zero_grad once |

## Common mistakes

- Calling `scheduler.step()` before `optimizer.step()`.
- Stepping an epoch-based scheduler every batch (or OneCycleLR every epoch).
- Using `Adam(weight_decay=…)` expecting AdamW's decoupled decay.
- Forgetting to pass the metric to `ReduceLROnPlateau.step(val_loss)`.
- Not dividing the loss by the number of micro-batches when accumulating, or zeroing gradients between them.
- Resuming training without restoring the optimizer and scheduler state.

## Exercises

### 1. Warm-up then cosine

Write `make_scheduler(opt, warmup, total)` that returns a `SequentialLR` which runs `LinearLR(start_factor=0.1, total_iters=warmup)` for the first `warmup` steps, then `CosineAnnealingLR(T_max=total - warmup)`.

Starter code:

```python
import torch
from torch import nn, optim

def make_scheduler(opt, warmup, total):
    pass

opt = optim.AdamW(nn.Linear(2, 1).parameters(), lr=1e-3)
sched = make_scheduler(opt, warmup=2, total=6)
for _ in range(6):
    print(round(sched.get_last_lr()[0], 6))
    opt.step()
    sched.step()
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** chain a linear warm-up into a cosine decay at a milestone.
2. **Examples:** lr 1e-3, warm-up 2: 1e-4, 5.5e-4, then the cosine from 1e-3 down.
3. **Brute force:** a `LambdaLR` with your own formula: works, but this combines tested pieces.
4. **Pattern:** **SequentialLR** switches schedulers at milestones.
5. **Plan:** two schedulers, then SequentialLR.
6. **Code and test:** print every step's learning rate.

</details>

<details>
<summary>💡 Hint 1</summary>

Build both schedulers on the same optimizer.

</details>

<details>
<summary>💡 Hint 2</summary>

`optim.lr_scheduler.SequentialLR(opt, schedulers=[warm, cosine], milestones=[warmup])`.

</details>

<details>
<summary>💡 Hint 3</summary>

The cosine part lasts the remaining `total - warmup` steps.

</details>

### 2. Accumulate gradients

Write `accumulated_step(model, loss_fn, opt, micro_batches, max_norm=1.0)` where `micro_batches` is a list of `(x, y)` pairs. It zeroes the gradients, calls `backward()` on each micro-batch's loss divided by the number of micro-batches, clips the total gradient norm to `max_norm` with `torch.nn.utils.clip_grad_norm_`, takes one optimizer step, and returns the average of the micro-batch losses as a Python float.

Starter code:

```python
import torch
from torch import nn, optim

def accumulated_step(model, loss_fn, opt, micro_batches, max_norm=1.0):
    pass

torch.manual_seed(0)
model = nn.Linear(3, 1)
opt = optim.SGD(model.parameters(), lr=0.1)
batches = [(torch.randn(4, 3), torch.randn(4, 1)) for _ in range(3)]
print(accumulated_step(model, nn.MSELoss(), opt, batches))
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** several backward passes, one update, the same result as one big batch.
2. **Examples:** 4 micro-batches of 5 ≈ one batch of 20 (exactly, for equal-sized micro-batches and a mean loss).
3. **Brute force:** concatenate the micro-batches into one: that's what accumulation avoids when memory is short.
4. **Pattern:** **zero once, backward many, clip, step once**.
5. **Plan:** zero_grad; loop with scaled backward; clip; step; return the mean.
6. **Code and test:** compare the updated weights with a reference.

</details>

<details>
<summary>💡 Hint 1</summary>

`opt.zero_grad()` once at the start: the gradients from earlier steps must not leak in.

</details>

<details>
<summary>💡 Hint 2</summary>

Inside the loop, `(loss / n).backward()` adds each micro-batch's share into `.grad`; keep `loss.item()` for the return value.

</details>

<details>
<summary>💡 Hint 3</summary>

After the loop: `torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm)`, then `opt.step()`.

</details>

**In the sandbox:** exercises 43–44. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Warm-up then cosine</summary>

```python
import torch
from torch import nn, optim

def make_scheduler(opt, warmup, total):
    warm = optim.lr_scheduler.LinearLR(opt, start_factor=0.1, total_iters=warmup)
    cosine = optim.lr_scheduler.CosineAnnealingLR(opt, T_max=total - warmup)
    return optim.lr_scheduler.SequentialLR(opt, schedulers=[warm, cosine], milestones=[warmup])

opt = optim.AdamW(nn.Linear(2, 1).parameters(), lr=1e-3)
sched = make_scheduler(opt, warmup=2, total=6)
for _ in range(6):
    print(round(sched.get_last_lr()[0], 6))
    opt.step()
    sched.step()
```

**Line by line**

- `LinearLR(start_factor=0.1, total_iters=warmup)` starts at 0.1 × lr and rises linearly to the full lr over `warmup` steps.
- `CosineAnnealingLR(T_max=total - warmup)` then decays from the full lr to 0 over the remaining steps.
- `SequentialLR(..., milestones=[warmup])` uses the first scheduler until step `warmup`, then switches.

**Why warm up?** At the start, Adam's statistics are unreliable and the weights are random, so large steps can push training somewhere bad. A few hundred to a few thousand steps of warm-up is standard for Transformers.

**Common wrong approach:** stepping both schedulers yourself in the loop. Each one changes the same `lr` in the param groups, so they'd fight; SequentialLR steps only the active one.

</details>

<details>
<summary>✅ 2. Accumulate gradients</summary>

```python
import torch
from torch import nn, optim

def accumulated_step(model, loss_fn, opt, micro_batches, max_norm=1.0):
    opt.zero_grad()
    n = len(micro_batches)
    total = 0.0
    for x, y in micro_batches:
        loss = loss_fn(model(x), y)
        (loss / n).backward()
        total += loss.item()
    torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm)
    opt.step()
    return total / n

torch.manual_seed(0)
model = nn.Linear(3, 1)
opt = optim.SGD(model.parameters(), lr=0.1)
batches = [(torch.randn(4, 3), torch.randn(4, 1)) for _ in range(3)]
print(accumulated_step(model, nn.MSELoss(), opt, batches))
```

**Line by line**

- Gradients accumulate in `.grad` across `backward()` calls (Part 2), which is exactly what we want here, so zero only once.
- Dividing each loss by n makes the summed gradient the gradient of the *average* loss, as if one big batch had been used.
- Clipping happens after all the gradients are in, so it limits the norm of the full gradient.
- `opt.step()` applies one update; `total / n` reports the average loss (unscaled, for logging).

**Common wrong approach:** calling `opt.step()` (or `zero_grad()`) inside the loop, which turns it into n small updates instead of one large one.

</details>

## Quick quiz

1. What is the main difference between `Adam(weight_decay=...)` and `AdamW(weight_decay=...)`?
   - A) AdamW uses a fixed learning rate
   - B) AdamW applies weight decay directly to the weights, decoupled from the adaptive gradient step; Adam adds it to the gradient
   - C) AdamW doesn't use momentum
   - D) Adam doesn't support weight decay

2. In which order should these be called in an epoch-based training loop?
   - A) Only `scheduler.step()`; it calls the optimizer itself
   - B) `scheduler.step()` before `loss.backward()`
   - C) `scheduler.step()` then `optimizer.step()`
   - D) `optimizer.step()` for each batch, then `scheduler.step()` once at the end of the epoch

3. `StepLR(opt, step_size=10, gamma=0.1)` with initial lr 0.1. What is the lr after 25 calls to `scheduler.step()`?
   - A) 0.1
   - B) 0.0001
   - C) 0.001
   - D) 0.01

4. Which scheduler needs a metric passed to `step()`?
   - A) `CosineAnnealingLR`
   - B) `ReduceLROnPlateau`
   - C) `LinearLR`
   - D) `OneCycleLR`

5. With gradient accumulation over 4 micro-batches, why divide each micro-batch's loss by 4?
   - A) Because backward() can only be called on small values
   - B) So the accumulated gradient equals the gradient of the average loss over the whole batch
   - C) To avoid zeroing the gradients
   - D) To make training faster

6. What does an optimizer's `param_groups` let you do?
   - A) Use different hyperparameters (like lr or weight_decay) for different sets of parameters
   - B) Group parameters by dtype
   - C) Freeze parameters automatically
   - D) Train several models at once on different GPUs

<details>
<summary>Quiz answers</summary>

1. **B) AdamW applies weight decay directly to the weights, decoupled from the adaptive gradient step; Adam adds it to the gradient**: Decoupled weight decay regularises every weight consistently, which is why AdamW is standard for Transformers.
2. **D) `optimizer.step()` for each batch, then `scheduler.step()` once at the end of the epoch**: Calling the scheduler first skips the initial learning rate, and PyTorch warns about it.
3. **C) 0.001**: It is multiplied by 0.1 after steps 10 and 20: 0.1 → 0.01 → 0.001.
4. **B) `ReduceLROnPlateau`**: It lowers the lr when the metric (usually validation loss) stops improving for `patience` steps.
5. **B) So the accumulated gradient equals the gradient of the average loss over the whole batch**: Gradients from each backward() add up; dividing by 4 turns the sum into a mean.
6. **A) Use different hyperparameters (like lr or weight_decay) for different sets of parameters**: Each group is a dict of parameters plus its own settings; schedulers update every group's lr.

</details>

---
Previous: [Lesson 21](21-better-models.md) · Next: [Lesson 23: Transfer learning and modifying models](23-transfer-learning.md)
