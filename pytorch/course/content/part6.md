@@@ part
id: 6
title: Mock Exams
level: Exam
blurb: Putting it all together: a strategy for the exam's question types and time limit, a high-yield checklist per domain, and three timed mock exams weighted like the real PTCA, scored per domain with the lessons to review.

@@@ lesson
id: exam-strategy
title: Exam strategy and final review
minutes: 20
summary: What is and isn't known about the PTCA exam, the kinds of questions to expect, a step-by-step method for predict-the-output questions, the common traps, pacing yourself over 120 minutes, a high-yield checklist for each domain, how to use the mock exams, and preparing for an online proctored exam.
---
You've covered the whole exam outline. This lesson turns that knowledge into points on exam day; the three mock exams after it let you practise under exam conditions.

### What we know about the exam

| | |
|---|---|
| Format | online, proctored, multiple choice |
| Time | 120 minutes |
| Domains | PyTorch fundamentals 38% · performance and optimization 26% · model development 20% · data handling 16% |
| Retakes | one free retake |
| After booking | 12 months to take it; the certification is valid for 2 years |
| Not published | the number of questions and the pass mark |

The domain weights tell you where the points are: almost two thirds come from fundamentals and performance. A weak spot in fundamentals (Parts 1 and 2) costs more than a weak spot anywhere else. Check the [Linux Foundation's PTCA page](https://training.linuxfoundation.org/certification/pytorch-certified-associate-ptca/) for the current details before you book.

### The kinds of questions

| Type | Example | What it tests |
|---|---|---|
| Predict the output | "What does this code print?" | shapes, dtypes, devices and values, traced line by line |
| Find the error | "Which line raises an error?" or "What happens when this runs?" | the rules: same device, matching shapes, contiguity, in-place on leaves |
| Choose the API | "Which call returns the peak GPU memory?" | knowing the right function and its arguments |
| Put steps in order | "Which training step is correct?" | zero_grad → forward → loss → backward → step; the GradScaler sequence |
| Explain why | "Why does bfloat16 rarely need loss scaling?" | the idea behind a feature |

### A method for code questions

1. **Read the question first**, then the code: know whether you're tracking a shape, a dtype, a value or an error.
2. **Trace line by line**, writing each tensor's shape and dtype (and device, if any line mentions one).
3. **Check for traps** (the table below) before choosing.
4. **Eliminate**: wrong options are usually what a specific mistake would produce (the shape without broadcasting, the dtype without promotion). If you can name the mistake behind an option, cross it out.

| Trap | What actually happens | Lesson |
|---|---|---|
| `/` on integer tensors | true division: the result is float32 | 3 |
| a slice, `view`, `transpose` | shares memory: writing through it changes the original | 4 |
| `view` after `transpose`/`permute` | error: not contiguous (use `reshape`) | 5 |
| broadcasting | align shapes from the right; size-1 dimensions stretch | 6 |
| tensors on different devices | RuntimeError (except 0-D CPU tensors) | 7 |
| a second `backward()` | gradients **accumulate** in `.grad`; the graph is freed unless `retain_graph=True` | 8 |
| `model.eval()` | changes Dropout and BatchNorm; doesn't stop gradient tracking (`torch.no_grad()` does) | 12 |
| `CrossEntropyLoss` | expects raw logits and int64 class indices | 11 |
| `torch.load` | `weights_only=True` by default since 2.6 | 13 |
| `len(loader)` | `ceil(N / batch_size)`, or `floor` with `drop_last=True` | 15 |
| `nn.LSTM(batch_first=True)` | `output` is batch-first; `h_n` and `c_n` are not | 20 |
| autocast | per operation: matmuls go 16-bit, reductions and losses stay float32, weights stay float32 | 26 |
| `torch.compile` state dicts | keys start with `_orig_mod.` | 25 |
| DDP state dicts | keys start with `module.`; save `model.module.state_dict()` | 27 |

### Pacing

At 120 minutes, budget your time per question and check your pace at the halfway mark. Don't let one hard question eat five minutes: pick your best answer, flag it if the exam lets you, and come back at the end. An unanswered question can't score, so unless the exam's rules say otherwise, never leave one blank.

### High-yield checklist

If you can do everything on this list without notes, you're ready. Each item names the lesson that covers it.

| Domain | You can… |
|---|---|
| Fundamentals (38%) | predict shapes through indexing, `view`/`reshape`, `unsqueeze`, `cat`/`stack`, broadcasting and `@` (4–6); predict dtypes after promotion and division (3); create tensors with the right dtype and device (2, 7); explain `requires_grad`, `backward`, `.grad` accumulation, `detach` and `no_grad` (8–9); write the training and evaluation loop in the right order (12); save and load state dicts and checkpoints, with `map_location` (13) |
| Performance (26%) | time GPU code correctly, use `torch.utils.benchmark` and read the profiler table (24); explain what `torch.compile` does, its modes, graph breaks and recompiles (25); use autocast and GradScaler in the right order, and know when bfloat16 needs no scaler (26); explain DDP, all-reduce, `torchrun`, `DistributedSampler.set_epoch`, effective batch size and when to use FSDP (27) |
| Model development (20%) | compute convolution output shapes and parameter counts (19); read RNN/LSTM/attention shapes and masks (20); know train/eval behaviour of Dropout and BatchNorm, and initialisation and normalisation choices (21); choose optimizers, parameter groups and schedulers, and call `scheduler.step()` at the right time (22); freeze layers and replace heads for transfer learning (23) |
| Data handling (16%) | write a map-style Dataset (14); predict DataLoader batches, `len`, `drop_last` and collation (15); choose samplers, `num_workers` and `pin_memory` (16); build training and validation transform pipelines with `transforms.v2` (17); avoid leakage when splitting and normalising (18) |

### Using the mock exams

Each mock exam has **40 questions in 80 minutes**, split across the domains in proportion to the real weights: 15 fundamentals, 11 performance, 8 model development and 6 data handling. Two minutes per question is a steady pace for code-reading questions; since the real exam's question count isn't published, practise the pace rather than a number.

1. Take each mock **under exam conditions**: one sitting, timer on, no notes, no running code.
2. Submit, then read the explanation of **every** question you missed or guessed.
3. Review the lessons the results page lists, then try the related exercises again.
4. Leave a few days before the next mock. Aim for at least **80%** on each, which leaves a margin above whatever the real pass mark is.

### Before exam day

The exam is online with a remote proctor. Read the Linux Foundation's candidate handbook for the exact rules. Typically you need a webcam, a microphone, a government-issued photo ID and a private, quiet room with a clear desk. Run the system check on the computer you'll use a few days before, not on the day.

:::quiz
? Which two domains together make up almost two thirds of the PTCA exam?
+ PyTorch fundamentals (38%) and performance and optimization (26%)
- Model development (20%) and data handling (16%)
- PyTorch fundamentals (38%) and model development (20%)
- Performance and optimization (26%) and data handling (16%)
= 38% + 26% = 64%, so fundamentals and performance deserve most of your review time.
? A question shows `x = torch.arange(6)` and asks for the dtype of `x / 2`. What is the answer, and why is it a trap?
+ `torch.float32`: `/` is always true division, even on integer tensors
- `torch.int64`: integer tensors stay integers
- `torch.float64`: Python divides in double precision
- It raises an error: integer tensors can't be divided
= Use `//` (or `torch.div(..., rounding_mode="floor")`) for integer division.
? You can't decide between two answers after a minute. What should you do?
+ Pick the more likely one, flag the question if possible, and move on
- Keep working on it until you're certain
- Leave it blank so it doesn't count against you
- Skip all remaining code questions
= Every question is worth the same; time spent on one hard question costs easy points later.
? An option is exactly the shape you'd get if broadcasting didn't happen. What does that tell you?
+ It's probably a distractor built from a common mistake: check the broadcasting rule before choosing it
- It must be the right answer, because it's the simplest
- Broadcasting never changes shapes
- Nothing: distractors are random
= Wrong options usually encode specific mistakes; naming the mistake lets you eliminate the option.
? What score should you aim for on the course's mock exams before booking the real one?
+ At least 80% on each, since the real pass mark isn't published
- Exactly the real exam's pass mark
- 50%, because the real exam is easier
- 100% on one mock is enough
= A margin covers nerves, the time limit and questions on details the mocks didn't hit.
:::

@@@ lesson
id: mock-exam-1
title: Mock exam 1
minutes: 80
exam: 80
summary: 40 questions across all four domains, weighted like the real exam, in 80 minutes.
---
Take it in one sitting with the timer on: no notes and no running code until you've submitted. Afterwards you'll see your score for each domain, an explanation for every question, and the lessons to review.

:::exam
?? fundamentals dtypes output
What does this code print?

```python
import torch

x = torch.tensor([1, 2, 3])
print((x / 2).dtype)
```
+ `torch.float32`
- `torch.int64`
- `torch.float64`
- `torch.int32`
= `/` is true division: integer tensors produce the default float dtype, float32. Use `//` for floor division.

?? fundamentals tensor-math output
What does this code print?

```python
import torch

a = torch.zeros(4, 1, 3)
b = torch.ones(5, 1)
print((a + b).shape)
```
+ `torch.Size([4, 5, 3])`
- `torch.Size([4, 1, 3])`
- `torch.Size([5, 4, 3])`
- `torch.Size([4, 5, 1])`
= Align from the right: `[4, 1, 3]` and `[_, 5, 1]`. Each pair is equal or contains a 1, so the result takes the larger size in each position: `[4, 5, 3]`.

?? fundamentals reshaping error
What happens when this code runs?

```python
import torch

x = torch.arange(6).reshape(2, 3).t()
print(x.view(6))
```
+ A `RuntimeError`: the transposed tensor isn't contiguous, so `view` can't flatten it
- It prints `tensor([0, 3, 1, 4, 2, 5])`
- It prints `tensor([0, 1, 2, 3, 4, 5])`
- A `TypeError`: `view` needs a tuple of sizes
= `.t()` swaps the strides without moving data. `view` needs a compatible memory layout; `reshape` (or `.contiguous().view(6)`) would copy and print `tensor([0, 3, 1, 4, 2, 5])`.

?? fundamentals indexing-and-views output
What does this code print?

```python
import torch

x = torch.arange(5)
y = x[1:3]
y[0] = 100
print(x)
```
+ `tensor([  0, 100,   2,   3,   4])`
- `tensor([0, 1, 2, 3, 4])`
- `tensor([  0,   1, 100,   3,   4])`
- `tensor([100,   1,   2,   3,   4])`
= Basic slicing returns a view that shares memory with `x`. `y[0]` is `x[1]`, so writing to it changes `x`. Use `.clone()` for an independent copy.

?? fundamentals autograd output
What does this code print?

```python
import torch

x = torch.tensor(3.0, requires_grad=True)
y = x ** 2 + 2 * x
y.backward()
print(x.grad)
```
+ `tensor(8.)`
- `tensor(15.)`
- `tensor(6.)`
- `None`
= dy/dx = 2x + 2 = 8 at x = 3. (15 is the value of y, not its gradient.)

?? fundamentals autograd output
What does this code print?

```python
import torch

w = torch.tensor(1.0, requires_grad=True)
for _ in range(3):
    (2 * w).backward()
print(w.grad)
```
+ `tensor(6.)`
- `tensor(2.)`
- `tensor(0.)`
- `None`
= Each backward() adds its gradient (2) to `.grad` instead of replacing it: 2 + 2 + 2 = 6. That's why training loops call `zero_grad()` every step.

?? fundamentals autograd error
What happens when this code runs?

```python
import torch

x = torch.tensor([1.0, 2.0], requires_grad=True)
y = (x * x).sum()
y.backward()
y.backward()
```
+ A `RuntimeError` on the second `backward()`: the graph's saved values were freed by the first one
- `x.grad` ends up as `tensor([4., 8.])`, with no error
- `x.grad` ends up as `tensor([2., 4.])`: the second call is ignored
- A `ValueError`: `backward()` needs a gradient argument
= backward() frees the intermediate values it stored. Pass `retain_graph=True` to the first call to run backward twice (and then the gradients would accumulate to `[4., 8.]`).

?? fundamentals training-loop text
During validation you call `model.eval()` but forget `torch.no_grad()`. What is the effect?
+ Dropout and BatchNorm use their evaluation behaviour, but autograd still records every operation, using extra memory and time
- No gradients are recorded, because `eval()` turns autograd off
- The parameters are frozen, so `optimizer.step()` can't change them
- The model outputs are wrong, because BatchNorm still uses batch statistics
= `eval()` only switches layer behaviour; `torch.no_grad()` (or `torch.inference_mode()`) stops gradient tracking. Validation should use both.

?? fundamentals nn-module output
What does this code print?

```python
from torch import nn

model = nn.Sequential(nn.Linear(10, 5), nn.ReLU(), nn.Linear(5, 2))
print(sum(p.numel() for p in model.parameters()))
```
+ `67`
- `62`
- `60`
- `69`
= Linear(10, 5): 10 × 5 weights + 5 biases = 55. Linear(5, 2): 5 × 2 + 2 = 12. ReLU has no parameters. 55 + 12 = 67.

?? fundamentals training-loop text
Which order of calls is correct for one training step?
+ `optimizer.zero_grad()`, `out = model(x)`, `loss = loss_fn(out, y)`, `loss.backward()`, `optimizer.step()`
- `out = model(x)`, `loss = loss_fn(out, y)`, `optimizer.step()`, `loss.backward()`, `optimizer.zero_grad()`
- `optimizer.zero_grad()`, `out = model(x)`, `loss = loss_fn(out, y)`, `optimizer.step()`, `loss.backward()`
- `out = model(x)`, `loss.backward()`, `loss = loss_fn(out, y)`, `optimizer.step()`, `optimizer.zero_grad()`
= Clear old gradients, compute the loss, compute new gradients, then update. zero_grad() can also come right after step(); what matters is that it runs between one backward() and the next.

?? fundamentals losses-and-optimizers text
A 10-class classifier is trained with `nn.CrossEntropyLoss()`. What should the model output and the targets be?
+ Raw logits of shape `[N, 10]`, and class indices (int64) of shape `[N]`
- Softmax probabilities of shape `[N, 10]`, and class indices of shape `[N]`
- Logits of shape `[N]`, and class indices of shape `[N, 10]`
- Raw logits of shape `[N, 10]`, and float class labels of shape `[N]`
= CrossEntropyLoss applies log-softmax itself, so applying softmax first is a silent mistake. Integer targets must be int64 class indices (float targets are allowed only as class probabilities of shape `[N, 10]`).

?? fundamentals saving-and-loading output
What does this code print?

```python
from torch import nn

model = nn.Sequential(nn.Linear(2, 3), nn.ReLU(), nn.Linear(3, 1))
print(list(model.state_dict().keys()))
```
+ `['0.weight', '0.bias', '2.weight', '2.bias']`
- `['0.weight', '0.bias', '1.weight', '1.bias']`
- `['0.weight', '0.bias', '1.weight', '1.bias', '2.weight', '2.bias']`
- `['weight', 'bias', 'weight', 'bias']`
= Keys are named by position in the Sequential. The ReLU at index 1 has no parameters or buffers, so there's no `1.` entry.

?? fundamentals saving-and-loading text
A file was saved with `torch.save(model, "model.pt")` (the whole model). With PyTorch 2.6 or later, `torch.load("model.pt")` fails. Why?
+ `torch.load` uses `weights_only=True` by default, which refuses to unpickle arbitrary objects such as a model class
- Whole models can only be loaded on the device they were saved from
- `.pt` files must be loaded with `load_state_dict`
- The file is compressed and needs `torch.load(..., zip=True)`
= Unpickling can run arbitrary code, so loading defaults to tensors and plain containers only. Save and load `model.state_dict()` instead, or pass `weights_only=False` only for files you trust.

?? fundamentals devices error
What happens when this code runs on a machine with a CUDA GPU?

```python
import torch

x = torch.ones(2, device="cuda")
y = torch.ones(2)
print(x + y)
```
+ A `RuntimeError`: the tensors are on different devices
- It prints `tensor([2., 2.], device='cuda:0')`
- It prints `tensor([2., 2.])`
- PyTorch moves `x` to the CPU automatically and prints the sum
= Operations need all tensors on the same device; PyTorch never moves data silently. (The only exception is a 0-D CPU tensor, which acts like a Python number.)

?? fundamentals devices output
What does this code print on a machine with a CUDA GPU?

```python
import torch

x = torch.tensor([1.0, 2.0], device="cuda")
print(x.sum().item(), x.device)
```
+ `3.0 cuda:0`
- `tensor(3., device='cuda:0') cuda:0`
- `3.0 cuda`
- `3.0 cpu`
= `.item()` copies the single value to a Python float. A tensor created with `device="cuda"` lands on the current GPU, which prints as `cuda:0`.

?? performance measuring-performance text
A colleague times `c = a @ b` on a GPU with `time.perf_counter()` before and after, and gets 0.05 ms: far faster than the GPU can multiply those matrices. What is the most likely explanation?
+ The kernel runs asynchronously, so the clock stopped right after the launch; synchronize before reading the clock
- `perf_counter` only measures CPU code, so it always reports near zero for GPU work
- The result was cached from an earlier call
- Matrix multiplication on GPUs takes almost no time
= Call `torch.cuda.synchronize()` before both clock reads, or use `torch.utils.benchmark.Timer` or CUDA events.

?? performance measuring-performance text
Which code makes a region of your training step appear as its own row in the profiler's table?
+ `with torch.profiler.record_function("data_prep"):`
- `torch.profiler.label("data_prep")`
- `prof.step("data_prep")`
- `with torch.autograd.set_grad_enabled("data_prep"):`
= record_function labels a block (or decorates a function); its row shows the time spent inside it, including the operations it ran.

?? performance measuring-performance text
Which call returns the highest amount of GPU memory occupied by tensors since the last `torch.cuda.reset_peak_memory_stats()`?
+ `torch.cuda.max_memory_allocated()`
- `torch.cuda.memory_reserved()`
- `torch.cuda.memory_allocated()`
- `torch.cuda.empty_cache()`
= memory_allocated is the current amount, memory_reserved includes the caching allocator's spare blocks, and empty_cache releases spare blocks.

?? performance torch-compile output
What does this code print?

```python
import torch
from torch import nn

model = torch.compile(nn.Linear(4, 2))
print(list(model.state_dict().keys()))
```
+ `['_orig_mod.weight', '_orig_mod.bias']`
- `['weight', 'bias']`
- `['module.weight', 'module.bias']`
- `[]`
= torch.compile wraps the model in an OptimizedModule whose submodule is called `_orig_mod`. Save `model._orig_mod.state_dict()` to get plain keys.

?? performance torch-compile text
Which line inside a function decorated with `@torch.compile` causes a graph break?
+ `values = x.tolist()`
- `y = torch.relu(x @ w + b)`
- `y = torch.where(x > 0, x, 0.1 * x)`
- `y = x.reshape(x.shape[0], -1)`
= tolist() needs the actual values in Python, so Dynamo ends the graph there. The others are tensor operations Dynamo can capture.

?? performance torch-compile text
You serve a small model with batch size 1, and the profiler shows that most of the time is kernel-launch overhead. Which `torch.compile` option targets this?
+ `mode="reduce-overhead"`, which uses CUDA graphs to launch many kernels at once
- `fullgraph=True`
- `dynamic=True`
- `backend="eager"`
= CUDA graphs record a sequence of kernels and replay it with a single launch. fullgraph only forbids graph breaks; the eager backend doesn't optimise at all.

?? performance mixed-precision output
What does this code print?

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
+ `torch.bfloat16 torch.float32 torch.float32`
- `torch.bfloat16 torch.bfloat16 torch.bfloat16`
- `torch.bfloat16 torch.bfloat16 torch.float32`
- `torch.float32 torch.float32 torch.float32`
= linear is on autocast's lower-precision list. Addition isn't on any list, so ordinary type promotion applies: bfloat16 + float32 gives float32. The stored weights are never changed.

?? performance mixed-precision text
You train in float16 with autocast and want to clip gradients. Which sequence is correct?
+ `scaler.scale(loss).backward()`, `scaler.unscale_(opt)`, `clip_grad_norm_(...)`, `scaler.step(opt)`, `scaler.update()`
- `scaler.scale(loss).backward()`, `clip_grad_norm_(...)`, `scaler.unscale_(opt)`, `scaler.step(opt)`, `scaler.update()`
- `loss.backward()`, `clip_grad_norm_(...)`, `scaler.step(opt)`, `scaler.update()`, `scaler.unscale_(opt)`
- `scaler.scale(loss).backward()`, `scaler.update()`, `clip_grad_norm_(...)`, `scaler.step(opt)`
= Unscale before clipping so the threshold applies to the true gradients; step() then skips the update if any gradient is inf or nan, and update() adjusts the scale.

?? performance mixed-precision text
You train with `torch.autocast("cuda", dtype=torch.bfloat16)` on an A100. Do you need a GradScaler?
+ Usually not: bfloat16 has float32's exponent range, so gradients rarely underflow
- Yes: every mixed-precision run needs one
- Yes: bfloat16 has more mantissa bits than float16, which makes underflow more likely
- No: autocast turns off gradients for bfloat16 tensors
= Loss scaling exists for float16's narrow range. bfloat16 trades precision for range, so plain `loss.backward()` and `optimizer.step()` work.

?? performance distributed-training text
A DDP job runs on 8 GPUs with a DistributedSampler, `batch_size=16` in each DataLoader, and gradient accumulation over 4 micro-batches. How many samples contribute to each optimizer step?
+ 512
- 128
- 64
- 16
= 8 processes × 16 samples × 4 accumulated micro-batches = 512.

?? performance distributed-training output
What does this code print?

```python
from torch.utils.data.distributed import DistributedSampler

s = DistributedSampler(range(7), num_replicas=2, rank=1, shuffle=False)
print(list(s))
```
+ `[1, 3, 5, 0]`
- `[1, 3, 5]`
- `[4, 5, 6]`
- `[1, 3, 5, 6]`
= 7 samples over 2 ranks: each gets ceil(7 / 2) = 4, so the list is padded to `0 … 6, 0`. Rank 1 takes every second index starting at 1.

?? model cnn-layers output
What does this code print?

```python
import torch
from torch import nn

conv = nn.Conv2d(3, 16, kernel_size=3, stride=2, padding=1)
print(conv(torch.randn(8, 3, 32, 32)).shape)
```
+ `torch.Size([8, 16, 16, 16])`
- `torch.Size([8, 16, 15, 15])`
- `torch.Size([8, 16, 32, 32])`
- `torch.Size([8, 3, 16, 16])`
= ⌊(32 + 2·1 − 3) / 2⌋ + 1 = ⌊31 / 2⌋ + 1 = 16; the channels become `out_channels` = 16.

?? model cnn-layers output
What does this code print?

```python
from torch import nn

conv = nn.Conv2d(3, 16, kernel_size=3)
print(sum(p.numel() for p in conv.parameters()))
```
+ `448`
- `432`
- `144`
- `160`
= Each of the 16 filters has 3 × 3 × 3 = 27 weights plus 1 bias: 16 × 28 = 448.

?? model sequence-layers output
What does this code print?

```python
import torch
from torch import nn

lstm = nn.LSTM(input_size=8, hidden_size=20, num_layers=2, batch_first=True)
out, (h, c) = lstm(torch.randn(4, 10, 8))
print(out.shape, h.shape)
```
+ `torch.Size([4, 10, 20]) torch.Size([2, 4, 20])`
- `torch.Size([4, 10, 20]) torch.Size([4, 2, 20])`
- `torch.Size([10, 4, 20]) torch.Size([2, 4, 20])`
- `torch.Size([4, 10, 40]) torch.Size([2, 4, 20])`
= `batch_first=True` affects `output` (batch, steps, hidden) but not `h_n`, which is always (layers × directions, batch, hidden).

?? model better-models text
What does `nn.Dropout(p=0.5)` do to its input after `model.eval()`?
+ Returns it unchanged
- Zeros half the values and doubles the rest
- Multiplies every value by 0.5
- Zeros half the values without rescaling
= Dropout is only active in training mode, where it zeros values with probability p and scales the survivors by 1 / (1 − p), so evaluation needs no rescaling.

?? model better-models output
What does this code print?

```python
from torch import nn

bn = nn.BatchNorm1d(4)
print(len(list(bn.parameters())), len(bn.state_dict()))
```
+ `2 5`
- `4 4`
- `2 4`
- `4 5`
= The parameters are weight and bias. The state dict adds three buffers: running_mean, running_var and num_batches_tracked.

?? model optimizers-and-schedules output
What does this code print?

```python
from torch import nn, optim

opt = optim.SGD(nn.Linear(1, 1).parameters(), lr=0.1)
sched = optim.lr_scheduler.StepLR(opt, step_size=2, gamma=0.5)
for epoch in range(5):
    opt.step()
    sched.step()
print(sched.get_last_lr())
```
+ `[0.025]`
- `[0.05]`
- `[0.0125]`
- `[0.1]`
= After 5 scheduler steps the rate has been halved at steps 2 and 4: 0.1 × 0.5 × 0.5 = 0.025. get_last_lr returns a list, one value per parameter group.

?? model optimizers-and-schedules text
For a scheduler like StepLR that you step once per epoch, where does `scheduler.step()` go?
+ After the epoch's `optimizer.step()` calls, once per epoch
- Before the first `optimizer.step()` of every batch
- Inside the batch loop, before `loss.backward()`
- Once, before training starts
= Since PyTorch 1.1, `optimizer.step()` must come before `scheduler.step()`; calling them the other way round skips the first value of the schedule and triggers a warning.

?? model transfer-learning text
You freeze a pretrained ResNet with `model.requires_grad_(False)`, then replace `model.fc` with a new `nn.Linear`. Which statement is true?
+ Only the new head's parameters require gradients, so they're the only parameters the optimizer updates
- The new head is frozen too, because the whole model was frozen
- Frozen BatchNorm layers stop updating their running statistics automatically
- You must call `model.eval()` to stop the frozen layers' weights from changing
= New modules are created with `requires_grad=True`. Freezing doesn't affect BatchNorm's running statistics, which still update in `train()` mode unless those layers are put in `eval()`.

?? data dataloaders output
What does this code print?

```python
from torch.utils.data import DataLoader

loader = DataLoader(range(103), batch_size=10, drop_last=True)
print(len(loader), len(loader.dataset))
```
+ `10 103`
- `11 103`
- `10 100`
- `11 110`
= drop_last discards the incomplete last batch of 3, leaving ⌊103 / 10⌋ = 10 batches. The dataset itself is unchanged.

?? data datasets text
A map-style Dataset subclass is used with a DataLoader and the default sampler. Which methods must it implement?
+ `__len__` and `__getitem__`
- `__iter__` and `__next__`
- `__call__` and `__len__`
- `forward` and `__getitem__`
= The sampler needs the length to generate indexes, and the DataLoader fetches each sample with `dataset[i]`. `__iter__` is for IterableDataset.

?? data dataloaders output
What does this code print?

```python
import torch
from torch.utils.data import DataLoader

data = [(torch.tensor([1.0, 2.0]), 0), (torch.tensor([3.0, 4.0]), 1), (torch.tensor([5.0, 6.0]), 1)]
xb, yb = next(iter(DataLoader(data, batch_size=2)))
print(xb.shape, yb)
```
+ `torch.Size([2, 2]) tensor([0, 1])`
- `torch.Size([2, 2]) [0, 1]`
- `torch.Size([4]) tensor([0, 1])`
- `torch.Size([2, 2]) (0, 1)`
= The default collate function stacks tensors along a new first dimension and turns Python ints into an int64 tensor.

?? data samplers-and-workers text
90% of your training samples are class 0 and 10% class 1. Which sampler makes batches with roughly balanced classes?
+ `WeightedRandomSampler` with per-sample weights inversely proportional to class frequency, and `replacement=True`
- `RandomSampler`
- `SequentialSampler`
- `DistributedSampler`
= Rare-class samples get larger weights, so they're drawn more often; replacement lets them appear several times per epoch.

?? data transforms text
Which `torchvision.transforms.v2` pipeline suits **validation** images for a pretrained model?
+ `Resize(256)`, `CenterCrop(224)`, `ToImage()`, `ToDtype(torch.float32, scale=True)`, `Normalize(mean, std)`
- `RandomResizedCrop(224)`, `RandomHorizontalFlip()`, `ToImage()`, `ToDtype(torch.float32, scale=True)`, `Normalize(mean, std)`
- `Resize(256)`, `CenterCrop(224)`, `ToImage()`, `Normalize(mean, std)`, `ToDtype(torch.float32, scale=True)`
- `Resize(256)`, `RandomCrop(224)`, `ToImage()`, `ToDtype(torch.float32, scale=True)`, `Normalize(mean, std)`
= Validation must be deterministic (no random crops or flips), and Normalize expects float values in [0, 1], so ToDtype with scale=True comes first.

?? data data-quality text
When should you compute the mean and standard deviation used to normalise input features?
+ From the training split only, then apply the same values to validation and test data
- From the whole dataset before splitting
- Separately for each split, from that split's own data
- From the test set, since that's what the model is judged on
= Statistics computed with validation or test data leak information about them into training, making evaluation look better than it is.
:::

@@@ lesson
id: mock-exam-2
title: Mock exam 2
minutes: 80
exam: 80
summary: 40 new questions across all four domains, weighted like the real exam, in 80 minutes.
---
A fresh set of questions, none repeated from Mock exam 1. Same rules: one sitting, timer on, no notes and no running code until you've submitted.

:::exam
?? fundamentals creating-tensors output
What does this code print?

```python
import torch

print(torch.arange(1, 10, 3).tolist(), torch.linspace(0, 1, 5)[1].item())
```
+ `[1, 4, 7] 0.25`
- `[1, 4, 7, 10] 0.25`
- `[1, 4, 7] 0.2`
- `[1, 3, 6, 9] 0.25`
= arange stops before the end value (10 is excluded). linspace(0, 1, 5) includes both ends: 0, 0.25, 0.5, 0.75, 1.

?? fundamentals dtypes output
What does this code print?

```python
import torch

a = torch.tensor([1, 2], dtype=torch.int32)
print((a * torch.tensor(2.5)).dtype, (a * 2).dtype, (a + torch.tensor([1, 1])).dtype)
```
+ `torch.float32 torch.int32 torch.int64`
- `torch.float64 torch.int64 torch.int64`
- `torch.float32 torch.int64 torch.int64`
- `torch.float32 torch.int32 torch.int32`
= A 0-D float tensor lifts integers to the default float dtype. A Python int doesn't change an int32 tensor's dtype. Two 1-D integer tensors promote to the larger type, int64.

?? fundamentals indexing-and-views output
What does this code print?

```python
import torch

x = torch.tensor([[1, -2, 3], [-4, 5, -6]])
print(x[x > 0], x[:, 1])
```
+ `tensor([1, 3, 5]) tensor([-2,  5])`
- `tensor([[1, 3], [5]]) tensor([-2,  5])`
- `tensor([1, 3, 5]) tensor([-4,  5, -6])`
- `tensor([1, 0, 3, 0, 5, 0]) tensor([-2,  5])`
= A boolean mask returns the selected elements as a 1-D tensor, in row order. `x[:, 1]` is column 1 of every row.

?? fundamentals reshaping output
What does this code print?

```python
import torch

a, b = torch.zeros(2, 3), torch.ones(2, 3)
print(torch.cat([a, b]).shape, torch.stack([a, b], dim=1).shape)
```
+ `torch.Size([4, 3]) torch.Size([2, 2, 3])`
- `torch.Size([2, 6]) torch.Size([2, 2, 3])`
- `torch.Size([4, 3]) torch.Size([2, 3, 2])`
- `torch.Size([4, 3]) torch.Size([4, 3])`
= cat joins along an existing dimension (0 by default). stack adds a new dimension, here at position 1.

?? fundamentals tensor-math output
What does this code print?

```python
import torch

x = torch.tensor([[1.0, 5.0, 2.0], [7.0, 0.0, 3.0]])
print(x.argmax(dim=1), x.sum(dim=0, keepdim=True).shape)
```
+ `tensor([1, 0]) torch.Size([1, 3])`
- `tensor(3) torch.Size([1, 3])`
- `tensor([1, 0]) torch.Size([3])`
- `tensor([1, 0]) torch.Size([2, 1])`
= argmax(dim=1) gives the column of each row's maximum. Summing over dim 0 with keepdim keeps that dimension as size 1.

?? fundamentals tensor-math output
What does this code print?

```python
import torch

a = torch.randn(10, 3, 4)
b = torch.randn(4, 5)
print((a @ b).shape)
```
+ `torch.Size([10, 3, 5])`
- `torch.Size([3, 5])`
- `torch.Size([10, 4, 5])`
- `torch.Size([10, 3, 4])`
= matmul treats the leading dimensions as a batch and broadcasts `b` across it: each `[3, 4] @ [4, 5]` gives `[3, 5]`.

?? fundamentals autograd output
What does this code print?

```python
import torch

x = torch.tensor(2.0, requires_grad=True)
y = x * 3
z = y.detach() * x
z.backward()
print(x.grad)
```
+ `tensor(6.)`
- `tensor(12.)`
- `tensor(3.)`
- `None`
= detach() turns y into a constant (6), so z = 6·x and dz/dx = 6. Without detach, z = 3x² and the gradient would be 12.

?? fundamentals autograd output
What does this code print?

```python
import torch

a = torch.ones(2, requires_grad=True)
with torch.no_grad():
    b = a * 2
c = a * 2
print(b.requires_grad, c.requires_grad, a.is_leaf, c.is_leaf)
```
+ `False True True False`
- `True True True False`
- `False True True True`
- `False False True False`
= Inside no_grad nothing is recorded, so b doesn't require gradients. c was computed from a tracked tensor, so it isn't a leaf.

?? fundamentals autograd error
What happens when this code runs?

```python
import torch

w = torch.ones(3, requires_grad=True)
w += 1
```
+ A `RuntimeError`: an in-place operation on a leaf tensor that requires grad
- `w` becomes `tensor([2., 2., 2.], requires_grad=True)`
- `w` becomes `tensor([2., 2., 2.])` and stops requiring gradients
- A `TypeError`: tensors don't support `+=`
= Updating parameters in place must happen inside `torch.no_grad()`, as optimizers do, so autograd doesn't try to record it.

?? fundamentals gradient-descent text
In a hand-written gradient-descent loop, why is the update written as `with torch.no_grad(): w -= lr * w.grad`?
+ So the update isn't recorded by autograd, which also makes the in-place change to a leaf allowed
- Because `no_grad` computes the gradient used in the update
- Only to make the update faster; the result is the same without it
- So `w.grad` is reset to zero automatically
= Without no_grad, the in-place update of a leaf that requires grad raises an error. The gradient still has to be zeroed separately.

?? fundamentals nn-module output
What does this code print?

```python
from torch import nn

class Net(nn.Module):
    def __init__(self):
        super().__init__()
        self.layers = [nn.Linear(4, 4) for _ in range(3)]
        self.head = nn.Linear(4, 1)

print(len(list(Net().parameters())))
```
+ `2`
- `8`
- `6`
- `4`
= Modules in a plain Python list aren't registered, so only `head`'s weight and bias are parameters. The optimizer would never train the hidden layers; use `nn.ModuleList`.

?? fundamentals losses-and-optimizers output
What does this code print?

```python
import torch
from torch import nn

pred = torch.tensor([1.0, 2.0, 3.0])
target = torch.tensor([1.0, 0.0, 0.0])
print(nn.MSELoss()(pred, target), nn.L1Loss(reduction="sum")(pred, target))
```
+ `tensor(4.3333) tensor(5.)`
- `tensor(13.) tensor(5.)`
- `tensor(4.3333) tensor(1.6667)`
- `tensor(2.0817) tensor(5.)`
= MSE averages the squared errors: (0 + 4 + 9) / 3. L1 with reduction="sum" adds the absolute errors: 0 + 2 + 3.

?? fundamentals autograd text
You only need predictions and will never call `backward()`. Which context makes inference fastest?
+ `torch.inference_mode()`
- `torch.no_grad()`
- `model.eval()` on its own
- `torch.set_grad_enabled(True)`
= inference_mode skips even more bookkeeping than no_grad. eval() changes layer behaviour but doesn't stop gradient tracking; combine it with inference_mode.

?? fundamentals saving-and-loading text
A checkpoint saved during GPU training must be loaded on a CPU-only machine. Which call works?
+ `torch.load("ckpt.pt", map_location="cpu")`
- `torch.load("ckpt.pt").cpu()`
- `torch.load("ckpt.pt", device="cpu")`
- `model.load_state_dict("ckpt.pt", map_location="cpu")`
= Without map_location, loading tries to restore each tensor to the GPU it was saved from and fails on a machine without one.

?? fundamentals devices output
What does this code print on a machine with a CUDA GPU?

```python
import torch

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
x = torch.zeros(3).to(device)
print(x.is_cuda, x.cpu().device, x.device.type)
```
+ `True cpu cuda`
- `True cpu cuda:0`
- `False cpu cuda`
- `True cuda:0 cuda`
= `.cpu()` returns a copy on the CPU; `x` itself stays on the GPU. `device.type` is just the kind of device, without the index.

?? performance measuring-performance text
You profile with `schedule(wait=2, warmup=1, active=2, repeat=1)` and call `prof.step()` after each training step. How many steps are recorded in the results?
+ 2
- 5
- 3
- 1
= The first 2 steps are skipped, the next 1 is profiled but discarded (warm-up), and the following 2 are recorded.

?? performance measuring-performance text
In the profiler's table, `aten::linear` has a CPU total of 2 ms but a Self CPU time of only 0.1 ms. What does that mean?
+ Most of its time is spent in the operations it calls (such as `aten::addmm`), not in `linear` itself
- linear ran 20 times
- The profiler failed to measure most of linear's time
- 1.9 ms was spent waiting for the GPU
= Self time excludes child operations; total time includes them. Sort by self time to find the operations that do the work.

?? performance measuring-performance text
Training runs out of GPU memory with a batch size of 64, and you want to keep 64 samples per optimizer step. What works?
+ Batches of 16 with gradient accumulation over 4 backward passes before each optimizer step
- Calling `torch.cuda.empty_cache()` after every step
- Raising the learning rate
- Calling `model.eval()` during training
= Activations grow with the batch size; accumulating gradients over smaller batches keeps the effective batch size with a quarter of the activation memory. empty_cache doesn't free tensors that are still in use.

?? performance torch-compile text
Your first training step with a compiled model takes 40 seconds; later steps take 50 ms. Why?
+ The first call traces the model and generates optimised kernels; later calls reuse them
- The first step trains on the whole dataset
- The GPU warms up physically during the first step
- torch.compile always runs the first step in float64
= Compilation is a one-time cost per graph (and per recompile), which is why compiled models are benchmarked after warm-up.

?? performance torch-compile text
A compiled model gets batches of 32, except the last batch of each epoch, which has 7 samples. Which change avoids compiling for that odd shape?
+ `drop_last=True` in the DataLoader
- `fullgraph=True`
- `mode="max-autotune"`
- Wrapping the training step in `torch.no_grad()`
= A new input shape can trigger a recompile. Dropping the incomplete batch keeps every shape the same (marking the dimension dynamic is the other fix).

?? performance torch-compile text
What does `torch.backends.cudnn.benchmark = True` do?
+ cuDNN times several convolution algorithms for each new input shape and reuses the fastest
- It prints a benchmark report after every epoch
- It turns on TF32 matrix multiplications
- It makes convolution results bit-for-bit deterministic
= It pays off when input shapes stay fixed; with constantly changing shapes it keeps re-benchmarking.

?? performance mixed-precision output
What does this code print on a machine with a CUDA GPU?

```python
import torch

x = torch.randn(4, 4, device="cuda")
with torch.autocast(device_type="cuda", dtype=torch.float16):
    a = x @ x
    b = a.softmax(dim=-1)
    c = torch.relu(a)
print(a.dtype, b.dtype, c.dtype)
```
+ `torch.float16 torch.float32 torch.float16`
- `torch.float16 torch.float16 torch.float16`
- `torch.float32 torch.float32 torch.float32`
- `torch.float16 torch.float32 torch.float32`
= Matmul runs in float16; softmax is on the float32 list for CUDA; relu isn't on any list, so it keeps its input's dtype.

?? performance mixed-precision text
In the first few iterations of float16 training, `scaler.step(optimizer)` skips the update. Why?
+ The initial scale (65536) is large enough that some gradients overflow to inf; the step is skipped and `update()` lowers the scale
- The optimizer needs a few iterations to initialise its state
- Autocast disables updates until the loss decreases
- The learning-rate warm-up sets the rate to zero
= GradScaler starts high on purpose and backs off after each overflow, settling on the largest safe scale. A few skipped steps early on are normal.

?? performance mixed-precision output
What does this code print?

```python
import torch

scaler = torch.amp.GradScaler("cpu", init_scale=1024.0)
print(scaler.get_scale(), scaler.scale(torch.tensor(0.5)))
```
+ `1024.0 tensor(512.)`
- `1024.0 tensor(0.5000)`
- `65536.0 tensor(32768.)`
- `1024.0 tensor(0.0005)`
= `scale()` multiplies the loss by the current scale. init_scale replaces the default 65536.

?? performance distributed-training text
In a DDP script launched with `torchrun` on a machine with 4 GPUs, what should each process use to choose its GPU?
+ The `LOCAL_RANK` environment variable, with `torch.cuda.set_device(local_rank)`
- The `RANK` environment variable, which is always below 4
- The `WORLD_SIZE` environment variable
- Nothing: every process should use `cuda:0`
= LOCAL_RANK numbers the processes on this machine. RANK is unique across all machines, so on a second machine it would exceed the GPU count.

?? performance distributed-training text
A model's parameters, gradients and Adam state need 60 GB in total. Each GPU has 40 GB, and you have 4 GPUs. Which approach can fit the model?
+ FSDP (`fully_shard`), which shards parameters, gradients and optimizer state across the GPUs
- DDP on the 4 GPUs
- DDP with a batch size of 1
- `torch.compile`
= DDP keeps a full copy of all three on every GPU, so it can't fit; sharding over 4 GPUs leaves each with roughly a quarter, plus room for activations.

?? model cnn-layers output
What does this code print?

```python
import torch
from torch import nn

x = torch.randn(2, 8, 15, 15)
print(nn.MaxPool2d(2)(x).shape, nn.AdaptiveAvgPool2d(1)(x).shape)
```
+ `torch.Size([2, 8, 7, 7]) torch.Size([2, 8, 1, 1])`
- `torch.Size([2, 8, 8, 8]) torch.Size([2, 8, 1, 1])`
- `torch.Size([2, 8, 7, 7]) torch.Size([2, 8])`
- `torch.Size([2, 4, 7, 7]) torch.Size([2, 1, 1, 1])`
= Pooling rounds down: ⌊15 / 2⌋ = 7. Adaptive pooling sets the output size directly. Neither changes the number of channels.

?? model sequence-layers output
What does this code print?

```python
import torch
from torch import nn

emb = nn.Embedding(num_embeddings=100, embedding_dim=16)
tokens = torch.tensor([[1, 5, 9], [2, 0, 7]])
print(emb(tokens).shape, emb.weight.shape)
```
+ `torch.Size([2, 3, 16]) torch.Size([100, 16])`
- `torch.Size([2, 16]) torch.Size([100, 16])`
- `torch.Size([2, 3, 16]) torch.Size([16, 100])`
- `torch.Size([6, 16]) torch.Size([100, 16])`
= Each token id is replaced by its 16-value row of the weight table, so a dimension of 16 is added at the end.

?? model sequence-layers text
In `nn.MultiheadAttention`, what does `True` in a boolean `key_padding_mask` mean?
+ That key position is ignored by attention (masked out)
- That key position must be attended to
- That query position is ignored
- That position's attention weight is set to 1
= MultiheadAttention's boolean masks mark positions to exclude, typically padding. `F.scaled_dot_product_attention` uses the opposite convention: True means "may attend".

?? model sequence-layers error
What happens when this code runs?

```python
from torch import nn

nn.MultiheadAttention(embed_dim=10, num_heads=3)
```
+ An `AssertionError`: embed_dim must be divisible by num_heads
- It creates a layer whose heads have sizes 4, 3 and 3
- It creates a layer with 3 heads of size 10 each
- A `TypeError`: num_heads must be a power of two
= Each head works on embed_dim / num_heads features, so the division must be exact.

?? model better-models text
Why can a model containing BatchNorm give different outputs for the same input in `train()` and `eval()` mode?
+ In training mode BatchNorm normalises with the current batch's statistics; in eval mode it uses the running averages
- BatchNorm's weights are frozen in eval mode
- In eval mode BatchNorm is skipped completely
- BatchNorm adds random noise in training mode
= Training mode also updates the running averages. That's why predictions must be made in eval mode, where single samples are normalised consistently.

?? model better-models text
What does `torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)` do?
+ Rescales all the gradients together so their combined norm is at most 1.0, and returns the norm before clipping
- Clamps every gradient element to the range [-1, 1]
- Clips the weights so their norm is at most 1.0
- Sets the learning rate to 1.0 for parameters with large gradients
= Scaling all gradients by one factor keeps their direction. Clamping each element is `clip_grad_value_`.

?? model optimizers-and-schedules output
What does this code print?

```python
from torch import nn, optim

model = nn.Sequential(nn.Linear(2, 2), nn.Linear(2, 1))
opt = optim.AdamW([{"params": model[0].parameters(), "lr": 1e-4},
                   {"params": model[1].parameters()}], lr=1e-3, weight_decay=0.01)
print([g["lr"] for g in opt.param_groups], opt.param_groups[1]["weight_decay"])
```
+ `[0.0001, 0.001] 0.01`
- `[0.001, 0.001] 0.01`
- `[0.0001, 0.0001] 0.01`
- `[0.0001, 0.001] 0.0`
= Settings given in a group override the defaults; groups without them take the optimizer's keyword arguments.

?? model transfer-learning output
What does this code print?

```python
from torch import nn

model = nn.Sequential(nn.Linear(8, 8), nn.ReLU(), nn.Linear(8, 3))
model.requires_grad_(False)
model[2] = nn.Linear(8, 5)
print(sum(p.numel() for p in model.parameters() if p.requires_grad))
```
+ `45`
- `0`
- `117`
- `27`
= The replacement layer is created after freezing, so only its 8 × 5 + 5 = 45 parameters require gradients.

?? data datasets output
What does this code print?

```python
import torch
from torch.utils.data import TensorDataset

ds = TensorDataset(torch.arange(10).float().view(5, 2), torch.arange(5))
x, y = ds[3]
print(len(ds), x, y)
```
+ `5 tensor([6., 7.]) tensor(3)`
- `10 tensor([6., 7.]) tensor(3)`
- `5 tensor([3., 4.]) tensor(3)`
- `5 tensor([6., 7.]) 3`
= TensorDataset indexes every tensor along dimension 0. Row 3 of the 5 × 2 features is [6., 7.], and the label is a 0-D tensor.

?? data dataloaders error
What happens when this code runs?

```python
from torch.utils.data import DataLoader, SequentialSampler

data = list(range(10))
DataLoader(data, shuffle=True, sampler=SequentialSampler(data))
```
+ A `ValueError`: `sampler` and `shuffle` can't be used together
- It shuffles the data, ignoring the sampler
- It uses the sampler, ignoring shuffle
- It shuffles the order chosen by the sampler
= shuffle=True just creates a RandomSampler, so passing your own sampler as well is contradictory. Put any shuffling inside the sampler.

?? data samplers-and-workers text
An `IterableDataset` streams 1,000 records and doesn't check which worker it's running in. With `DataLoader(ds, num_workers=4)`, how many records does one epoch yield?
+ 4,000: every worker streams all the records
- 1,000: the DataLoader splits the stream between the workers
- 250: each worker gets a quarter
- An error: IterableDataset doesn't support workers
= Each worker gets its own copy of the dataset. Split the stream yourself with `torch.utils.data.get_worker_info()`.

?? data transforms output
What does this code print?

```python
import torch
from torchvision.transforms import v2

img = torch.tensor([[[0, 128, 255]]], dtype=torch.uint8)
out = v2.ToDtype(torch.float32, scale=True)(v2.ToImage()(img))
print(out.dtype, out.max().item())
```
+ `torch.float32 1.0`
- `torch.float32 255.0`
- `torch.uint8 255`
- `torch.float32 0.5`
= With scale=True, uint8 values 0–255 are divided by 255 into 0.0–1.0, the range Normalize and pretrained models expect.

?? data samplers-and-workers text
What does `pin_memory=True` in a DataLoader do?
+ Returns batches in page-locked CPU memory, so copies to the GPU are faster and can overlap with computation using `non_blocking=True`
- Keeps the whole dataset on the GPU
- Stops the worker processes from being restarted each epoch
- Locks the random seed so batches are reproducible
= Pinned memory lets the GPU copy data directly. It only helps when training on a GPU.

?? data data-quality text
A dataset contains exact duplicate rows. When should you remove them?
+ Before splitting into training, validation and test sets
- After splitting, separately in each split
- Never: duplicates act as free augmentation
- Only in the test set
= Duplicates removed after splitting can sit on both sides of the split: the model is then tested on samples it trained on.
:::

@@@ lesson
id: mock-exam-3
title: Mock exam 3
minutes: 80
exam: 80
summary: A final 40 questions across all four domains, weighted like the real exam, in 80 minutes.
---
The last full rehearsal, with questions not used in the first two mocks. Take it a few days before your exam date, under the same rules.

:::exam
?? fundamentals pytorch-and-tensors output
What does this code print?

```python
import torch

x = torch.tensor([[1, 2, 3], [4, 5, 6]])
print(x.ndim, x.numel(), x.shape[1])
```
+ `2 6 3`
- `2 6 2`
- `6 2 3`
- `3 6 3`
= Two dimensions (rows and columns), six elements, and three columns in dimension 1.

?? fundamentals creating-tensors output
What does this code print?

```python
import torch

print(torch.tensor([1, 2]).dtype, torch.Tensor([1, 2]).dtype, torch.zeros(2, dtype=int).dtype)
```
+ `torch.int64 torch.float32 torch.int64`
- `torch.int64 torch.int64 torch.int64`
- `torch.float32 torch.float32 torch.int64`
- `torch.int64 torch.float32 torch.int32`
= torch.tensor infers int64 from Python ints. The torch.Tensor constructor always uses the default float dtype. Python's `int` as a dtype means int64.

?? fundamentals creating-tensors output
What does this code print?

```python
import torch

torch.manual_seed(42)
a = torch.rand(3)
torch.manual_seed(42)
b = torch.rand(3)
c = torch.rand(3)
print(torch.equal(a, b), torch.equal(b, c))
```
+ `True False`
- `True True`
- `False False`
- `False True`
= Re-seeding restarts the same sequence, so a equals b. c continues the sequence after b, so it differs.

?? fundamentals dtypes output
What does this code print?

```python
import torch

x = torch.tensor(70000.0)
print(x.half(), x.bfloat16())
```
+ `tensor(inf, dtype=torch.float16) tensor(70144., dtype=torch.bfloat16)`
- `tensor(70000., dtype=torch.float16) tensor(70000., dtype=torch.bfloat16)`
- `tensor(65504., dtype=torch.float16) tensor(70144., dtype=torch.bfloat16)`
- `tensor(inf, dtype=torch.float16) tensor(inf, dtype=torch.bfloat16)`
= float16's largest value is 65504, so 70000 overflows to inf. bfloat16 has float32's range but only 8 bits of precision, so it rounds to the nearest multiple of 512.

?? fundamentals indexing-and-views output
What does this code print?

```python
import torch

x = torch.zeros(2, 3, 4)
print(x[..., 0].shape, x[:, None].shape, x[0, :, 1:3].shape)
```
+ `torch.Size([2, 3]) torch.Size([2, 1, 3, 4]) torch.Size([3, 2])`
- `torch.Size([2, 3, 1]) torch.Size([2, 1, 3, 4]) torch.Size([3, 2])`
- `torch.Size([2, 3]) torch.Size([1, 2, 3, 4]) torch.Size([3, 2])`
- `torch.Size([2, 3]) torch.Size([2, 1, 3, 4]) torch.Size([1, 3, 2])`
= An integer index removes its dimension, `...` stands for all the dimensions not mentioned, `None` inserts a size-1 dimension, and a slice keeps its dimension.

?? fundamentals reshaping output
What does this code print?

```python
import torch

x = torch.zeros(1, 3, 1, 5)
print(x.squeeze().shape, x.squeeze(0).shape, x.permute(3, 1, 0, 2).shape)
```
+ `torch.Size([3, 5]) torch.Size([3, 1, 5]) torch.Size([5, 3, 1, 1])`
- `torch.Size([3, 5]) torch.Size([3, 5]) torch.Size([5, 3, 1, 1])`
- `torch.Size([3, 1, 5]) torch.Size([3, 1, 5]) torch.Size([5, 3, 1, 1])`
- `torch.Size([3, 5]) torch.Size([3, 1, 5]) torch.Size([5, 1, 3, 1])`
= squeeze() removes every size-1 dimension; squeeze(0) only dimension 0. permute lists, for each new position, which old dimension goes there.

?? fundamentals tensor-math error
What happens when this code runs?

```python
import torch

print(torch.tensor([1, 2, 3, 4]).mean())
```
+ A `RuntimeError`: mean needs a floating-point (or complex) tensor
- It prints `tensor(2.5000)`
- It prints `tensor(2)`
- It prints `2.5`
= Convert first with `.float()`. Unlike mean, sum works on integers.

?? fundamentals tensor-math output
What does this code print?

```python
import torch

x = torch.tensor([2.0, 4.0, 4.0, 4.0, 5.0, 5.0, 7.0, 9.0])
print(x.std(), x.std(correction=0))
```
+ `tensor(2.1381) tensor(2.)`
- `tensor(2.) tensor(2.1381)`
- `tensor(2.) tensor(2.)`
- `tensor(4.5714) tensor(4.)`
= The squared deviations from the mean (5) sum to 32. By default std divides by n − 1 = 7 (√4.571 ≈ 2.1381); correction=0 divides by n = 8 (√4 = 2).

?? fundamentals autograd error
What happens when this code runs?

```python
import torch

x = torch.tensor([1.0, 2.0], requires_grad=True)
(x * 2).backward()
```
+ A `RuntimeError`: backward() on a tensor with more than one element needs a gradient argument
- `x.grad` becomes `tensor([2., 2.])`
- `x.grad` becomes `tensor(4.)`
- A `ValueError`: x must be a 0-D tensor
= The gradient can only be created implicitly for a scalar output. Reduce first (`.sum()`) or pass `gradient=torch.ones_like(...)`.

?? fundamentals autograd output
What does this code print?

```python
import torch

x = torch.tensor(2.0, requires_grad=True)
y = x * x
y.retain_grad()
z = y * 3
z.backward()
print(x.grad, y.grad)
```
+ `tensor(12.) tensor(3.)`
- `tensor(12.) None`
- `tensor(4.) tensor(3.)`
- `tensor(6.) tensor(3.)`
= dz/dx = 3 · 2x = 12. Only leaves keep `.grad` by default; retain_grad() asks autograd to keep it for the intermediate y too (dz/dy = 3).

?? fundamentals gradient-descent output
What does this code print?

```python
import torch

w = torch.tensor(1.0, requires_grad=True)
loss = (3 * w - 6) ** 2
loss.backward()
with torch.no_grad():
    w -= 0.1 * w.grad
print(w)
```
+ `tensor(2.8000, requires_grad=True)`
- `tensor(-0.8000, requires_grad=True)`
- `tensor(2.8000)`
- `tensor(1.1800, requires_grad=True)`
= dloss/dw = 2(3w − 6) · 3 = −18 at w = 1, so w becomes 1 − 0.1 · (−18) = 2.8. The in-place update keeps w a leaf that requires grad.

?? fundamentals nn-module output
What does this code print?

```python
from torch import nn

model = nn.Sequential(nn.Linear(2, 2), nn.Dropout(0.1))
model.eval()
print(model.training, model[1].training, len(list(model.children())))
```
+ `False False 2`
- `False True 2`
- `True True 2`
- `False False 1`
= eval() sets `training = False` on the module and all its submodules. children() lists the direct submodules: the Linear and the Dropout.

?? fundamentals losses-and-optimizers output
What does this code print?

```python
import torch
from torch import nn

loss = nn.BCEWithLogitsLoss()(torch.tensor([0.0, 0.0]), torch.tensor([1.0, 0.0]))
print(round(loss.item(), 4))
```
+ `0.6931`
- `0.5`
- `1.3863`
- `0.0`
= A logit of 0 is a probability of 0.5, so each sample's loss is −ln 0.5 = ln 2 ≈ 0.6931, and the mean is the same.

?? fundamentals training-loop text
Why should a training loop accumulate the epoch's loss with `total += loss.item()` rather than `total += loss`?
+ `loss` is a tensor attached to its graph, so adding tensors keeps every step's graph in memory; `.item()` gives a plain Python float
- `loss.item()` is more precise than the tensor
- `total += loss` raises an error
- `.item()` also zeroes the gradients
= Summing graph-attached tensors makes memory grow every step. (With a GPU, `.item()` also synchronises, so some loops log less often.)

?? fundamentals saving-and-loading text
To resume an interrupted training run exactly where it stopped, what should the checkpoint contain at a minimum?
+ The model's and the optimizer's state dicts (plus the scheduler's, if any) and the epoch number
- The model's state dict only
- The whole model object saved with `torch.save(model)`
- The optimizer's state dict only
= The optimizer holds state too (momentum, Adam's moving averages). Without it, training resumes with a cold optimizer.

?? performance measuring-performance output
What does this code print?

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
+ `3 3`
- `1 1`
- `3 1`
- `6 3`
= key_averages groups events with the same name; each of the 3 loop iterations runs one matmul and one relu.

?? performance measuring-performance text
Which line in a GPU training loop forces the CPU to wait for the GPU on every step?
+ `running_loss += loss.item()`
- `optimizer.step()`
- `loss.backward()`
- `x = x.to(device, non_blocking=True)`
= `.item()` copies a value to Python, so it must wait for the computation to finish. Log every N steps instead to keep the GPU busy.

?? performance measuring-performance text
You exported a profile with `prof.export_chrome_trace("trace.json")`. How can you look at it?
+ Open it in the Perfetto UI (ui.perfetto.dev) or chrome://tracing as a timeline
- Load it with `torch.load` and print it
- Run `nvidia-smi --trace trace.json`
- It can only be read with `prof.key_averages()`
= The trace shows each operation on a timeline per thread (and per GPU stream with CUDA activity), which reveals gaps where the GPU sits idle.

?? performance torch-compile text
Which describes what `torch.compile` does with its default settings?
+ TorchDynamo captures the tensor operations into FX graphs; TorchInductor fuses them and generates Triton (GPU) or C++ (CPU) kernels
- It converts the model to ONNX and runs it with ONNX Runtime
- It rewrites the Python source code of the model in C++
- It runs the model in float16 with CUDA graphs
= Inductor is the default backend. CUDA graphs are added by mode="reduce-overhead"; precision is unchanged.

?? performance torch-compile text
A function compiled with `torch.compile(f, fullgraph=True)` contains code Dynamo can't trace. What happens?
+ An error is raised instead of splitting the function into several graphs
- The untraceable code is silently skipped
- The whole function runs eagerly without a warning
- Dynamo compiles both branches of every `if`
= Without fullgraph, Dynamo would break the graph and run that code in plain Python. fullgraph=True is a way to find and remove graph breaks.

?? performance torch-compile output
What does this code print?

```python
import torch
from torch import nn

model = nn.Linear(3, 3)
compiled = torch.compile(model)
print(compiled.weight is model.weight, type(compiled._orig_mod).__name__)
```
+ `True Linear`
- `False Linear`
- `True OptimizedModule`
- `False OptimizedModule`
= The compiled wrapper shares the original module and its parameters, so training one trains the other. `_orig_mod` is the original Linear.

?? performance mixed-precision text
Why is `model.half()` a poor way to get mixed-precision training?
+ All weights and updates become float16: small updates round away and some operations overflow; autocast keeps float32 weights and lowers precision only where it's safe
- `model.half()` doesn't change any dtypes
- float16 isn't supported on GPUs
- It makes the model use more memory than float32
= Mixed precision means float32 master weights plus 16-bit computation for the operations that benefit.

?? performance mixed-precision output
What does this code print?

```python
import torch

with torch.autocast(device_type="cpu", dtype=torch.bfloat16):
    a = torch.randn(2, 2) @ torch.randn(2, 2)
    with torch.autocast(device_type="cpu", enabled=False):
        b = torch.randn(2, 2) @ torch.randn(2, 2)
    c = torch.randn(2, 2, dtype=torch.float64) @ torch.randn(2, 2, dtype=torch.float64)
print(a.dtype, b.dtype, c.dtype)
```
+ `torch.bfloat16 torch.float32 torch.float64`
- `torch.bfloat16 torch.bfloat16 torch.bfloat16`
- `torch.bfloat16 torch.bfloat16 torch.float64`
- `torch.bfloat16 torch.float32 torch.bfloat16`
= The nested block with enabled=False turns autocast off; float64 tensors are never autocast.

?? performance mixed-precision text
For float16 training with a GradScaler, which state should a checkpoint include so a resumed run behaves like the original?
+ The model's, the optimizer's and the scaler's state dicts (`scaler.state_dict()`)
- Only the model's state dict, because the scaler resets itself
- Only the scaler's scale value, saved as a Python float in a separate file
- The scaler can't be saved; resumed runs always start from 65536
= The scaler's state includes the current scale and its growth tracker; restore it with `scaler.load_state_dict(...)`.

?? performance distributed-training text
Every epoch of your DDP run feeds each rank the same sample order. What's missing?
+ `sampler.set_epoch(epoch)` at the start of each epoch
- `shuffle=True` in the DataLoader
- `dist.barrier()` after each batch
- A different `torch.manual_seed` on each rank
= DistributedSampler seeds its shuffle with seed + epoch; without set_epoch, the epoch stays 0. Adding shuffle=True to the DataLoader would raise an error, since a sampler is given.

?? performance distributed-training text
With DDP and gradient accumulation over 4 micro-batches, the first three `backward()` calls run inside `with model.no_sync():`. What does that save?
+ Three gradient all-reduces per optimizer step: gradients accumulate locally and are synchronised during the fourth backward
- Activation memory for the first three micro-batches
- Three optimizer steps
- Nothing: no_sync only affects BatchNorm
= Each backward on a DDP model normally triggers an all-reduce; communication only needs to happen once per optimizer step.

?? model cnn-layers error
What happens when this code runs?

```python
import torch
from torch import nn

conv = nn.Conv2d(3, 8, kernel_size=3)
conv(torch.randn(4, 1, 28, 28))
```
+ A `RuntimeError`: the layer expects 3 input channels but the input has 1
- It outputs `torch.Size([4, 8, 26, 26])`, repeating the single channel
- It outputs `torch.Size([4, 8, 28, 28])`
- A `ValueError`: images must be 32 × 32
= in_channels must match dimension 1 of the input. Grayscale images need `in_channels=1` (or repeating the channel 3 times for a pretrained RGB model).

?? model cnn-layers output
What does this code print?

```python
import torch
from torch import nn

features = nn.Sequential(nn.Conv2d(1, 4, 3, padding=1), nn.MaxPool2d(2),
                         nn.Conv2d(4, 8, 3), nn.Flatten())
print(features(torch.randn(2, 1, 28, 28)).shape)
```
+ `torch.Size([2, 1152])`
- `torch.Size([2, 1568])`
- `torch.Size([2, 8, 12, 12])`
- `torch.Size([2, 1352])`
= 28 → 28 (padding 1 keeps the size) → 14 (pooling) → 12 (3 × 3 without padding). Flatten keeps the batch: 8 × 12 × 12 = 1152.

?? model sequence-layers output
What does this code print?

```python
import torch
from torch import nn

gru = nn.GRU(input_size=4, hidden_size=6, bidirectional=True, batch_first=True)
out, h = gru(torch.randn(3, 5, 4))
print(out.shape, h.shape)
```
+ `torch.Size([3, 5, 12]) torch.Size([2, 3, 6])`
- `torch.Size([3, 5, 6]) torch.Size([2, 3, 6])`
- `torch.Size([3, 5, 12]) torch.Size([3, 2, 6])`
- `torch.Size([3, 5, 12]) torch.Size([1, 3, 12])`
= A bidirectional layer concatenates both directions' outputs (2 × 6 features). h_n has one entry per layer and direction, and isn't batch-first.

?? model sequence-layers output
What does this code print?

```python
import torch
import torch.nn.functional as F

q = torch.randn(2, 4, 10, 16)
k = torch.randn(2, 4, 12, 16)
v = torch.randn(2, 4, 12, 32)
print(F.scaled_dot_product_attention(q, k, v).shape)
```
+ `torch.Size([2, 4, 10, 32])`
- `torch.Size([2, 4, 12, 32])`
- `torch.Size([2, 4, 10, 16])`
- `torch.Size([2, 4, 10, 12])`
= There is one output per query (10), each a weighted average of the values (32 features). [10, 12] is the shape of the attention weights.

?? model better-models output
What does this code print?

```python
import torch
from torch import nn

bn = nn.BatchNorm1d(1)
bn(torch.tensor([[2.0], [4.0]]))
print(bn.running_mean, bn.num_batches_tracked)
```
+ `tensor([0.3000]) tensor(1)`
- `tensor([3.]) tensor(1)`
- `tensor([0.]) tensor(0)`
- `tensor([0.3000]) tensor(2)`
= In training mode, running_mean moves 10% (momentum 0.1) of the way from 0 towards the batch mean of 3.

?? model better-models text
What do residual (skip) connections, `out = x + block(x)`, do for deep networks?
+ Give gradients a direct path through the addition, so very deep networks still train
- Halve the number of parameters
- Replace the need for an activation function
- Normalise each layer's outputs
= The gradient of x + block(x) includes an identity term, so it doesn't vanish through many layers. The block's output must have x's shape.

?? model optimizers-and-schedules text
What is the difference between `optim.Adam(..., weight_decay=0.01)` and `optim.AdamW(..., weight_decay=0.01)`?
+ AdamW shrinks the weights directly (decoupled weight decay); Adam adds the decay to the gradient, where its adaptive scaling weakens it
- AdamW ignores weight_decay
- Adam has no momentum
- They're identical; AdamW is an alias
= Decoupled weight decay regularises more predictably, which is why AdamW is the usual default for transformers.

?? model transfer-learning text
Which code records a layer's output during the forward pass without changing the model's code?
+ `model.layer4.register_forward_hook(lambda m, inp, out: saved.append(out.detach()))`
- `model.layer4.register_full_backward_hook(lambda m, gin, gout: saved.append(gout))`
- `saved.append(model.layer4.output)`
- `torch.save(model.layer4, "out.pt")`
= Forward hooks run after the module's forward pass and receive its inputs and output. Keep the returned handle and call `.remove()` when done.

?? data datasets output
What does this code print?

```python
import torch
from torch.utils.data import random_split

train, val = random_split(range(10), [0.8, 0.2], generator=torch.Generator().manual_seed(0))
print(len(train), len(val), type(train).__name__)
```
+ `8 2 Subset`
- `8 2 list`
- `8 2 range`
- `2 8 Subset`
= random_split returns Subset objects, views of the original dataset by index, with sizes from the fractions.

?? data dataloaders output
What does this code print?

```python
from torch.utils.data import DataLoader

loader = DataLoader([1, 2, 3], batch_size=None)
print(list(loader))
```
+ `[1, 2, 3]`
- `[tensor(1), tensor(2), tensor(3)]`
- `[tensor([1, 2, 3])]`
- `[[1], [2], [3]]`
= batch_size=None turns automatic batching off: samples come out one at a time and aren't collated, so Python ints stay ints (only NumPy arrays are converted to tensors).

?? data dataloaders text
How do you make `DataLoader(ds, shuffle=True)` produce the same order on every run, without re-seeding PyTorch's global random numbers?
+ Pass `generator=torch.Generator().manual_seed(0)` to the DataLoader
- Set `shuffle="fixed"`
- Call `random.seed(0)` before creating it
- Use `num_workers=0`
= The DataLoader draws its shuffle from the generator you give it, so other random calls (initialisation, dropout) can't change the order.

?? data samplers-and-workers text
With `num_workers=4`, each worker should read a different part of an `IterableDataset`'s stream. What tells the dataset which worker it's running in?
+ `torch.utils.data.get_worker_info()`, which returns the worker's id and the number of workers
- `os.getpid()` compared with the main process
- The DataLoader passes the worker id to `__iter__` as an argument
- `torch.distributed.get_rank()`
= get_worker_info() returns None in the main process; inside a worker it has `id`, `num_workers`, `seed` and the worker's copy of the dataset.

?? data transforms output
What does this code print?

```python
import torch
from torchvision.transforms import v2

x = torch.ones(3, 2, 2)
out = v2.Normalize(mean=[0.5, 0.5, 0.5], std=[0.25, 0.25, 0.25])(x)
print(out.unique())
```
+ `tensor([2.])`
- `tensor([0.5000])`
- `tensor([1.])`
- `tensor([0.])`
= Normalize computes (x − mean) / std per channel: (1 − 0.5) / 0.25 = 2.

?? data data-quality text
You augment your images (random flips and crops), saving five versions of each, and then split them randomly into training and test sets. What's wrong?
+ Versions of the same image end up in both sets, so the test score is inflated by near-duplicates
- Nothing: more data always helps
- Augmented images can't be saved to disk
- Test sets must be smaller than 10% of the data
= Split first, then augment only the training data (usually on the fly, in the training transforms).
:::
