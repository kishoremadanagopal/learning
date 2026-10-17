@@@ part
id: 5
title: Performance and Optimization
level: Advanced
blurb: Making training and inference fast and memory-efficient, the exam's second-largest domain: measuring correctly (GPU timing, torch.utils.benchmark, the profiler, memory), torch.compile, mixed precision with autocast and GradScaler, and spreading training across GPUs with DDP and FSDP.

@@@ lesson
id: measuring-performance
title: Measuring performance
minutes: 25
summary: Why to measure before optimising, timing with time.perf_counter and warm-up runs, why GPU timing needs torch.cuda.synchronize, CUDA events, torch.utils.benchmark.Timer, torch.profiler with record_function, key_averages and its table, record_shapes, schedules and trace files, GPU memory statistics, and spotting whether data loading or computation is the bottleneck.
---
Optimising without measuring usually speeds up the wrong thing. The workflow is: **measure**, find the biggest cost, change one thing, measure again.

(This sandbox runs PyTorch as Python on NumPy, so its timings say nothing about real PyTorch speed. The tools and their output work the same way, so practise reading them here and use them for real on your own machine.)

### Timing code correctly

Three rules:

1. Use `time.perf_counter()`, a high-resolution clock.
2. **Warm up** first. The first calls are slower (memory allocation, cuDNN choosing algorithms, `torch.compile` compiling), so leave them out.
3. Repeat and take the **median**, which ignores occasional slow runs.

```python
import time
import torch
from torch import nn

torch.manual_seed(0)
model = nn.Sequential(nn.Linear(256, 256), nn.ReLU(), nn.Linear(256, 10))
x = torch.randn(64, 256)

for _ in range(3):                           # warm-up
    model(x)
times = []
for _ in range(20):
    start = time.perf_counter()
    model(x)
    times.append(time.perf_counter() - start)
times.sort()
print(f"median {times[len(times) // 2] * 1e3:.3f} ms")
```

### The GPU runs asynchronously

When Python calls a GPU operation, PyTorch **queues** the kernel and returns immediately; the GPU works through the queue in the background. A clock read straight after the call measures only the launch. Call `torch.cuda.synchronize()` (wait until the GPU has finished everything queued) before reading the clock each time.

![The CPU launches kernels A, B and C and reads the clock right away, which stops too early because the GPU is still running the kernels. Calling torch.cuda.synchronize() waits for the GPU to finish before the clock is read](figures/gpu-async.svg)

```py-static
torch.cuda.synchronize()
start = time.perf_counter()
y = model(x)
torch.cuda.synchronize()                     # wait for the GPU before stopping the clock
elapsed = time.perf_counter() - start

start_evt = torch.cuda.Event(enable_timing=True)   # or time on the GPU itself with CUDA events
end_evt = torch.cuda.Event(enable_timing=True)
start_evt.record()
y = model(x)
end_evt.record()
torch.cuda.synchronize()
print(start_evt.elapsed_time(end_evt), "ms")
```

Anything that copies a value to the CPU (`.item()`, `.cpu()`, `print(tensor)`) also synchronises, which is why scattering `.item()` calls through a training loop slows it down.

### torch.utils.benchmark

`torch.utils.benchmark.Timer` does the warm-up, the repetitions and the CUDA synchronisation for you, and reports statistics:

```python
import torch
import torch.utils.benchmark as benchmark

x = torch.randn(64, 64)
t = benchmark.Timer(stmt="x @ x", globals={"x": x})
m = t.blocked_autorange(min_run_time=0.2)        # repeat until 0.2 s of measurements
print(m)
print(m.median > 0, len(m.times) >= 3)
```

### The profiler

Timing tells you *how long*; the **profiler** tells you *where the time goes*: every operation PyTorch ran, how many times, and for how long.

```python
import torch
from torch import nn
from torch.profiler import profile, record_function, ProfilerActivity

torch.manual_seed(0)
model = nn.Sequential(nn.Linear(64, 128), nn.ReLU(), nn.Linear(128, 10))
x = torch.randn(32, 64)
opt = torch.optim.SGD(model.parameters(), lr=0.1)

with profile(activities=[ProfilerActivity.CPU], record_shapes=True) as prof:
    with record_function("forward"):            # label your own regions
        loss = model(x).sum()
    loss.backward()
    opt.step()

print(prof.key_averages().table(sort_by="cpu_time_total", row_limit=8))
counts = {e.key: e.count for e in prof.key_averages()}
print(counts["aten::linear"], counts["forward"])
```

How to read the table:

| Column | Meaning |
|---|---|
| Name | `aten::…` are PyTorch's operators; `autograd::engine::evaluate_function: …Backward0` is backward; `Optimizer.step#…` is the update; your `record_function` labels appear too |
| Self CPU | time in the operation itself, excluding operations it called |
| CPU total | including everything it called |
| # of Calls | how many times it ran |

With `activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA]` on a GPU machine the table adds GPU columns (`Self CUDA`, `CUDA total`), and `sort_by="cuda_time_total"` shows which kernels dominate. (The sandbox has no real GPU, so it records CPU time only.) `profile_memory=True` adds memory columns; `group_by_input_shape=True` (with `record_shapes=True`) splits rows by tensor shapes.

For long training runs, profile a few steps with a **schedule**, and write traces you can open in Perfetto (`ui.perfetto.dev`) or TensorBoard:

```py-static
from torch.profiler import schedule, tensorboard_trace_handler

with profile(activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA],
             schedule=schedule(wait=1, warmup=1, active=3, repeat=1),
             on_trace_ready=tensorboard_trace_handler("./log/profile")) as prof:
    for step, (xb, yb) in enumerate(loader):
        train_step(xb, yb)
        prof.step()                    # tell the profiler a step ended
        if step >= 5:
            break
```

`wait` steps are ignored, `warmup` steps are profiled but discarded (start-up costs), and `active` steps are recorded. `prof.export_chrome_trace("trace.json")` writes a timeline file directly.

### Memory

GPU memory often limits batch size and model size before speed does.

| Call | Returns |
|---|---|
| `torch.cuda.memory_allocated()` | bytes held by tensors right now |
| `torch.cuda.max_memory_allocated()` | the peak since the start (or since `reset_peak_memory_stats()`) |
| `torch.cuda.memory_reserved()` | bytes the caching allocator holds, including freed blocks it keeps for reuse |
| `torch.cuda.empty_cache()` | gives cached, unused blocks back to the driver (doesn't free live tensors) |

```python
import torch
from torch import nn

torch.cuda.reset_peak_memory_stats()
model = nn.Linear(1024, 1024).cuda()
x = torch.randn(256, 1024, device="cuda")
print(torch.cuda.memory_allocated() // 1024, "KiB")      # weights 4096 + bias 4 + input 1024
y = model(x)
print(y.nelement() * y.element_size() // 1024, "KiB for the output")
print(torch.cuda.max_memory_allocated() >= torch.cuda.memory_allocated())
```

(On a real GPU the numbers also include small allocator rounding and the workspace cuBLAS reserves for matmuls, so expect slightly more.)

During training, memory holds the weights, the gradients, the optimizer state (Adam keeps two extra values per weight) and the **activations** saved for backward, which grow with batch size. When you run out of memory (`torch.OutOfMemoryError`): use a smaller batch with gradient accumulation (Part 4), mixed precision (lesson 26), activation checkpointing (`torch.utils.checkpoint`, which recomputes activations during backward instead of storing them), or sharding across GPUs (lesson 27).

### Find the bottleneck first

| Symptom | Likely bottleneck | Fixes |
|---|---|---|
| GPU utilisation low (`nvidia-smi`), the profiler shows time in `enumerate(DataLoader)` | data loading | `num_workers`, `pin_memory=True`, faster decoding, prepare data in advance |
| GPU busy, many small kernels | Python and launch overhead | `torch.compile`, bigger batches |
| GPU busy on matmuls and convolutions | the maths itself | mixed precision, TF32, a smaller or more efficient model |
| out of memory | activations, optimizer state | the memory list above |

:::exercise Time a function properly
Write `time_fn(fn, warmup=3, repeats=10)` that calls `fn()` `warmup` times without timing it, then `repeats` times, measuring each call with `time.perf_counter()`, and returns the **median** duration in seconds. If a CUDA GPU is available, call `torch.cuda.synchronize()` before starting and before stopping the clock for each timed call.
```python starter
import time
import torch

def time_fn(fn, warmup=3, repeats=10):
    pass

x = torch.randn(64, 64)
print(f"{time_fn(lambda: x @ x) * 1e6:.1f} microseconds")
```
```python check
import time
import torch
fn = need("time_fn")
assert uses("perf_counter"), "Measure with time.perf_counter()."
assert uses("synchronize"), "Call torch.cuda.synchronize() when a GPU is available."
calls = {"n": 0, "sync": 0}
fake_now = {"t": 0.0}
durations = [100.0, 100.0, 100.0, 5.0, 1.0, 30.0, 3.0, 7.0]       # first 3 are the warm-up calls
def work():
    fake_now["t"] += durations[calls["n"]]
    calls["n"] += 1
real_pc, real_sync = time.perf_counter, torch.cuda.synchronize
time.perf_counter = lambda: fake_now["t"]
torch.cuda.synchronize = lambda *a, **k: calls.__setitem__("sync", calls["sync"] + 1)
try:
    got = fn(work, warmup=3, repeats=5)
finally:
    time.perf_counter, torch.cuda.synchronize = real_pc, real_sync
assert calls["n"] == 8, f"fn should be called warmup + repeats = 8 times, got {calls['n']}."
assert got == 5.0, f"The median of the 5 timed calls (5, 1, 30, 3, 7) is 5.0 (the mean would be 9.2); got {got!r}. Return the median (not the mean) of the timed calls only, leaving out the warm-up calls."
assert calls["sync"] >= 10, f"With a GPU, synchronize before starting and before stopping each timed call ({calls['sync']} calls seen)."
calls["n"] = 0; durations[:] = [1.0] * 2 + [4.0, 2.0]
time.perf_counter = lambda: fake_now["t"]
try:
    got2 = fn(work, warmup=2, repeats=2)
finally:
    time.perf_counter = real_pc
assert got2 == 3.0, f"With two timed calls (4 and 2) the median is 3.0, got {got2!r}."
```
```python solution
import statistics
import time
import torch

def time_fn(fn, warmup=3, repeats=10):
    for _ in range(warmup):
        fn()
    times = []
    for _ in range(repeats):
        if torch.cuda.is_available():
            torch.cuda.synchronize()
        start = time.perf_counter()
        fn()
        if torch.cuda.is_available():
            torch.cuda.synchronize()
        times.append(time.perf_counter() - start)
    return statistics.median(times)

x = torch.randn(64, 64)
print(f"{time_fn(lambda: x @ x) * 1e6:.1f} microseconds")
```
hint: A plain loop of `fn()` calls handles the warm-up.
hint: For each timed call: synchronize, `start = time.perf_counter()`, `fn()`, synchronize, then append `time.perf_counter() - start`.
hint: `statistics.median(times)` averages the two middle values when the count is even.
approach:
1. **Understand:** warm up, time each call separately, report a robust statistic.
2. **Examples:** timed durations 5, 1, 30, 3, 7 → median 5 (the mean, 9.2, is pulled up by the one slow call).
3. **Brute force:** time all repeats in one block and divide: the mean, which slow outliers distort.
4. **Pattern:** **warm-up + per-call timing + median**, with **synchronisation** around GPU work.
5. **Plan:** warm-up loop; timed loop with sync; median.
6. **Code and test:** the check replaces the clock with a fake one, so the answer is exact.
walkthrough:
**Line by line**

- The warm-up calls absorb one-time costs (allocations, algorithm selection, compilation) that would otherwise inflate the first measurements.
- `torch.cuda.synchronize()` before `start` makes sure earlier queued GPU work isn't counted; the one after `fn()` makes sure this call's GPU work is.
- `statistics.median` resists outliers such as a garbage-collection pause or another program using the GPU.

**Common wrong approach:** timing without synchronising on a GPU, which can report microseconds for a matmul that really takes milliseconds.
:::

:::exercise Count operations with the profiler
Write `op_counts(fn, names)` that runs `fn()` inside `torch.profiler.profile` (CPU activity) and returns a dict mapping each name in `names` to how many times that event occurred (0 if it never ran), using `prof.key_averages()`.
```python starter
import torch
from torch import nn
from torch.profiler import profile, ProfilerActivity

def op_counts(fn, names):
    pass

model = nn.Sequential(nn.Linear(4, 8), nn.ReLU(), nn.Linear(8, 2))
x = torch.randn(3, 4)
print(op_counts(lambda: model(x).sum().backward(), ["aten::linear", "aten::relu", "aten::conv2d"]))
```
```python check
import torch
from torch import nn
fn = need("op_counts")
assert uses("key_averages"), "Read the counts from prof.key_averages()."
model = nn.Sequential(nn.Linear(4, 8), nn.ReLU(), nn.Linear(8, 8), nn.ReLU(), nn.Linear(8, 2))
x = torch.randn(3, 4)
got = fn(lambda: model(x), ["aten::linear", "aten::relu", "aten::conv2d"])
assert got == {"aten::linear": 3, "aten::relu": 2, "aten::conv2d": 0}, f"Expected {{'aten::linear': 3, 'aten::relu': 2, 'aten::conv2d': 0}}, got {got}."
got = fn(lambda: model(x).sum().backward(), ["AddmmBackward0", "aten::linear"])
assert got == {"AddmmBackward0": 3, "aten::linear": 3}, f"Expected 3 AddmmBackward0 events during backward, got {got}."
def two_passes():
    for _ in range(2):
        model(x)
assert fn(two_passes, ["aten::linear"]) == {"aten::linear": 6}, "Two forward passes run linear 6 times."
```
```python solution
import torch
from torch import nn
from torch.profiler import profile, ProfilerActivity

def op_counts(fn, names):
    with profile(activities=[ProfilerActivity.CPU]) as prof:
        fn()
    counts = {e.key: e.count for e in prof.key_averages()}
    return {name: counts.get(name, 0) for name in names}

model = nn.Sequential(nn.Linear(4, 8), nn.ReLU(), nn.Linear(8, 2))
x = torch.randn(3, 4)
print(op_counts(lambda: model(x).sum().backward(), ["aten::linear", "aten::relu", "aten::conv2d"]))
```
hint: `with profile(activities=[ProfilerActivity.CPU]) as prof: fn()`.
hint: Each entry of `prof.key_averages()` has `.key` (the name) and `.count`.
hint: Build a dict from them, then look up each requested name with `.get(name, 0)`.
approach:
1. **Understand:** run under the profiler, then aggregate events by name.
2. **Examples:** three Linear layers → `aten::linear` 3 times per forward pass.
3. **Brute force:** add counters to the model by hand: doesn't work for library code you can't edit.
4. **Pattern:** **profile → key_averages → look up**.
5. **Plan:** profile; dict of key → count; answer for each name.
6. **Code and test:** names that never ran give 0.
walkthrough:
**Line by line**

- Inside the `with` block every operator call, backward node and optimizer step is recorded as an event.
- `key_averages()` groups events with the same name and sums their counts and times; each group has `.key`, `.count`, `.cpu_time_total` and `.self_cpu_time_total`.
- Missing names get 0 through `.get`.

**Why counts matter:** an operation that runs far more often than expected (a `.to()` copy inside a loop, an `aten::item` per step) is a common hidden cost, and counts are stable from run to run while times vary.

**Common wrong approach:** reading `prof.events()` and counting by hand: it works, but key_averages already does it.
:::

:::quiz
? You time `y = model(x)` on a GPU with `time.perf_counter()` before and after, without anything else. What is wrong?
+ GPU operations are asynchronous, so the call returns before the work finishes; synchronize before reading the clock
- perf_counter can't measure GPU code at all
- Nothing: the measurement is accurate
- The model must be in eval mode to be timed
= Use torch.cuda.synchronize() (or torch.utils.benchmark, or CUDA events) around the timed region.
? In the profiler table, what is the difference between "Self CPU" and "CPU total"?
+ Self CPU excludes the time spent in operations it called; CPU total includes them
- Self CPU is for the forward pass, CPU total for backward
- Self CPU counts one call, CPU total all calls
- They are always equal
= An aten::linear row's CPU total includes the aten::addmm it calls; its self time doesn't.
? With `schedule(wait=1, warmup=1, active=3)`, which steps are recorded?
+ Steps 3, 4 and 5 (after skipping 1 and warming up for 1), with `prof.step()` marking each step
- Steps 1 to 3
- Every step
- Only the warm-up step
= Waiting and warm-up steps aren't recorded; warm-up excludes start-up costs from the trace.
? Training uses little of the GPU, and the profiler shows most time in `enumerate(DataLoader)`. What should you try first?
+ More DataLoader workers (num_workers) and pin_memory=True
- A bigger model
- torch.compile
- A higher learning rate
= The GPU is waiting for data; speeding up the model won't help.
? What does `torch.cuda.max_memory_allocated()` report?
+ The peak memory used by tensors since the start or the last `reset_peak_memory_stats()`
- The GPU's total memory
- Memory reserved by the caching allocator right now
- The memory used by the current process on the CPU
= Use it to find the peak during a training step, which decides whether a batch size fits.
:::

@@@ lesson
id: torch-compile
title: torch.compile and execution speed-ups
minutes: 25
summary: What torch.compile does (TorchDynamo, FX graphs, TorchInductor, Triton), compiling a model or a function, the compile cost of the first call, modes (default, reduce-overhead, max-autotune), fullgraph, graph breaks and how to find and avoid them, recompilation and dynamic shapes, the _orig_mod prefix in state dicts, and other speed-ups: inference_mode, TF32 with set_float32_matmul_precision, cudnn.benchmark and channels_last.
---
PyTorch normally runs **eagerly**: every operation executes the moment Python reaches it, one GPU kernel at a time. That's easy to debug, but it costs time: Python overhead per operation, and intermediate results written to memory and read back between kernels.

`torch.compile` (since PyTorch 2.0) turns your model into optimised code with one line:

```py-static
model = MyModel().to(device)
model = torch.compile(model)          # nothing else changes: training and inference code stay the same
```

![Python code model(x) goes to TorchDynamo, which captures an FX graph, then TorchInductor, which fuses operations, then generated kernels in Triton on GPUs or C++ on CPUs. The first call compiles (seconds to minutes) and later calls reuse the cached kernels. A graph break means code Dynamo can't trace (print, .item(), data-dependent if) runs in plain Python between graphs; new input shapes or dtypes cause a recompile](figures/compile.svg)

1. **TorchDynamo** watches your Python code run and captures the tensor operations into a **graph** (an FX graph).
2. **TorchInductor** (the default `backend="inductor"`) optimises the graph, mainly by **fusing** operations so data stays in fast memory, and generates kernels: **Triton** code on GPUs, C++ on CPUs.
3. Later calls reuse the compiled code. Typical training speed-ups are 1.3–2× on modern GPUs, more for small operations.

The **first call is slow**: it compiles (seconds, sometimes minutes for large models), so exclude it from timings and expect it at the start of training.

(The sandbox's `torch.compile` checks the arguments and returns the same objects as PyTorch, but runs your code eagerly: same results, no speed-up.)

### Compiling models and functions

```python
import torch
from torch import nn

torch.manual_seed(0)
model = nn.Sequential(nn.Linear(4, 8), nn.ReLU(), nn.Linear(8, 2))
compiled = torch.compile(model)
print(type(compiled).__name__)
print(compiled)
x = torch.randn(3, 4)
print(torch.allclose(compiled(x), model(x)))          # same parameters, same results
print(compiled._orig_mod is model)

@torch.compile
def gelu_ish(x):
    return 0.5 * x * (1 + torch.tanh(0.79788456 * (x + 0.044715 * x ** 3)))

print(gelu_ish(torch.tensor([-1.0, 0.0, 1.0])))
```

A compiled model **shares** the original's parameters, so training the compiled one trains the original. Its `state_dict()` keys gain an `_orig_mod.` prefix, though, which breaks loading into a plain model. Save `compiled._orig_mod.state_dict()` (or the original `model.state_dict()`) instead:

```python
import torch
from torch import nn

model = nn.Linear(2, 2)
compiled = torch.compile(model)
print(list(compiled.state_dict().keys()))
print(list(model.state_dict().keys()))
plain = nn.Linear(2, 2)
plain.load_state_dict(compiled._orig_mod.state_dict())
print("loaded")
```

### Modes and options

| Argument | Values | Effect |
|---|---|---|
| `mode` | `"default"` | a good balance of compile time and speed |
| | `"reduce-overhead"` | also uses **CUDA graphs** (replay a whole sequence of kernels in one launch): best for small batches where launch overhead dominates; uses more memory |
| | `"max-autotune"` | benchmarks many kernel variants (longest compile, fastest code) |
| `fullgraph=True` | | raise an error instead of allowing graph breaks |
| `dynamic` | `None` / `True` / `False` | how to handle changing input shapes (see below) |
| `backend` | `"inductor"` (default), `"cudagraphs"`, debugging: `"eager"`, `"aot_eager"` | what turns graphs into code |

```python error
import torch
from torch import nn

torch.compile(nn.Linear(2, 2), mode="fast")
```

### Graph breaks

When Dynamo meets code it can't put in a graph, it **breaks** the graph: it runs the graph so far, executes that code in normal Python, and starts a new graph afterwards. Each break costs speed. Common causes:

| Cause | Example | Fix |
|---|---|---|
| reading a value into Python | `if loss.item() > 1:` , `x.tolist()`, `print(x)` | keep it in tensors (`torch.where`), log outside the compiled function |
| data-dependent control flow | `if x.sum() > 0:` | `torch.where`, `torch.cond` |
| unsupported Python or libraries | calls into NumPy or other C extensions | move them out of the compiled region |

```py-static
@torch.compile
def f(x):
    if x.sum() > 0:          # graph break: the branch depends on the tensor's value
        return x * 2
    return x - 1

@torch.compile(fullgraph=True)
def g(x):
    return torch.where(x.sum() > 0, x * 2, x - 1)     # one graph: both branches as tensor operations
```

To see breaks and their reasons, run with the environment variable `TORCH_LOGS="graph_breaks"` (or `"recompiles"`, `"+dynamo"` for more), or call `torch._dynamo.explain(f)(x)`. `torch.compiler.disable` marks a function to always run eagerly.

### Recompilation and dynamic shapes

A compiled graph is specialised to what it saw: input shapes, dtypes, devices, even some Python values. When a call doesn't match (a new batch size, say), Dynamo **recompiles**. After a shape changes once, PyTorch automatically marks that dimension dynamic and compiles a shape-generic version; `dynamic=True` asks for that from the start, and `torch._dynamo.mark_dynamic(x, 0)` marks one dimension. Too many recompilations hit a cache limit and fall back to eager. A smaller, varying last batch is a common cause: `drop_last=True` avoids it.

### Other speed-ups worth knowing

| Setting | What it does |
|---|---|
| `torch.inference_mode()` | for inference: no autograd tracking at all (faster than `no_grad`) |
| `torch.set_float32_matmul_precision("high")` | lets float32 matmuls use **TF32** tensor cores on Ampere and newer GPUs: much faster, slightly less precise |
| `torch.backends.cudnn.benchmark = True` | cuDNN times several convolution algorithms for each input shape and keeps the fastest (good for fixed shapes) |
| `model.to(memory_format=torch.channels_last)` | stores images height-width-channels in memory, faster for convolutions on tensor cores |
| bigger batches, fewer `.item()` calls | fewer launches and synchronisations |

```python
import torch

print(torch.get_float32_matmul_precision())
torch.set_float32_matmul_precision("high")
print(torch.get_float32_matmul_precision(), torch.backends.cuda.matmul.allow_tf32)
```

For deployment, `torch.export` captures a whole model ahead of time into a single graph (no graph breaks allowed) that can be saved, inspected and run without the Python model code.

:::exercise Clean up state-dict keys
A model may be wrapped by `torch.compile` (keys start with `_orig_mod.`), by DistributedDataParallel (keys start with `module.`), or both, in either order. Write `clean_state_dict(sd)` returning a new dict with every leading `_orig_mod.` and `module.` prefix removed from each key (repeatedly, in any order), keeping the values.
```python starter
import torch
from torch import nn

def clean_state_dict(sd):
    pass

compiled = torch.compile(nn.Linear(2, 3))
print(list(clean_state_dict(compiled.state_dict()).keys()))
```
```python check
import torch
from torch import nn
fn = need("clean_state_dict")
sd = {"_orig_mod.0.weight": 1, "_orig_mod.0.bias": 2}
assert fn(sd) == {"0.weight": 1, "0.bias": 2}, f"Got {fn(sd)}."
sd = {"module._orig_mod.fc.weight": 3, "_orig_mod.module.fc.bias": 4, "plain.weight": 5, "encoder.module.x": 6}
want = {"fc.weight": 3, "fc.bias": 4, "plain.weight": 5, "encoder.module.x": 6}
assert fn(sd) == want, f"Expected {want}, got {fn(sd)}. Only strip prefixes at the start of each key."
assert sd["module._orig_mod.fc.weight"] == 3, "Don't change the input dict."
compiled = torch.compile(nn.Linear(2, 3))
plain = nn.Linear(2, 3)
plain.load_state_dict(fn(compiled.state_dict()))
same(plain.weight, compiled._orig_mod.weight, "the loaded weight")
```
```python solution
import torch
from torch import nn

def clean_state_dict(sd):
    prefixes = ("_orig_mod.", "module.")
    out = {}
    for key, value in sd.items():
        changed = True
        while changed:
            changed = False
            for p in prefixes:
                if key.startswith(p):
                    key = key[len(p):]
                    changed = True
        out[key] = value
    return out

compiled = torch.compile(nn.Linear(2, 3))
print(list(clean_state_dict(compiled.state_dict()).keys()))
```
hint: Loop over the items and build a new dict.
hint: `key.startswith("_orig_mod.")` and `key[len(prefix):]` (or `key.removeprefix(prefix)`) strip one prefix.
hint: Repeat until neither prefix is at the start, so `module._orig_mod.` and `_orig_mod.module.` both reduce fully.
approach:
1. **Understand:** wrappers add name prefixes; loading into an unwrapped model needs them gone.
2. **Examples:** `module._orig_mod.fc.weight` → `fc.weight`; `encoder.module.x` stays (not a leading prefix).
3. **Brute force:** `key.replace("module.", "")` also hits names in the middle: wrong.
4. **Pattern:** **strip leading prefixes until none match**.
5. **Plan:** for each key, loop removing either prefix while one matches.
6. **Code and test:** both orders; a nested `module` that must stay.
walkthrough:
**Line by line**

- `torch.compile(model)` returns an `OptimizedModule` holding the model as `_orig_mod`, so every key gains `_orig_mod.`; `DistributedDataParallel` holds it as `module`, adding `module.`.
- The `while changed` loop keeps stripping until the key starts with neither prefix, which handles any nesting order.
- Only leading prefixes are removed, so a real submodule called `module` deeper in the name is untouched.

**Better habit:** save `model.state_dict()` from the unwrapped model (keep a reference to it before wrapping), and you never need this. The function is for checkpoints you didn't save that way.

**Common wrong approach:** `str.replace`, which also deletes `module.` from the middle of names like `encoder.module.x`.
:::

:::exercise Remove a graph break
This function decides per row whether to double or negate values, using Python control flow on tensor values, which causes graph breaks under `torch.compile` (and is slow). Rewrite `scale_rows(x)` with the same results using only tensor operations: no `for` loops, no `if`, no `.item()`. Rows whose sum is positive are doubled; the others are negated.
```python starter
import torch

def scale_rows(x):
    out = []
    for row in x:
        if row.sum().item() > 0:
            out.append(row * 2)
        else:
            out.append(-row)
    return torch.stack(out)

print(scale_rows(torch.tensor([[1.0, 2.0], [-3.0, 1.0], [0.0, 0.0]])))
```
```python check
import torch
fn = need("scale_rows")
code = "\n".join(l.split("#")[0] for l in __source__.splitlines())
assert "for " not in code and "if " not in code and ".item(" not in code, "Use only tensor operations: no for, if or .item()."
x = torch.tensor([[1.0, 2.0], [-3.0, 1.0], [2.0, -2.0]])
same(fn(x), torch.tensor([[2.0, 4.0], [3.0, -1.0], [-2.0, 2.0]]), "scale_rows with a row summing to 0 (0 isn't positive, so negate)")
torch.manual_seed(0)
x = torch.randn(50, 7)
want = torch.where(x.sum(dim=1, keepdim=True) > 0, x * 2, -x)
same(fn(x), want, "scale_rows on random data")
```
```python solution
import torch

def scale_rows(x):
    positive = x.sum(dim=1, keepdim=True) > 0
    return torch.where(positive, x * 2, -x)

print(scale_rows(torch.tensor([[1.0, 2.0], [-3.0, 1.0], [0.0, 0.0]])))
```
hint: Compute every row's sum at once: `x.sum(dim=1, keepdim=True)`, shape `[rows, 1]`.
hint: Compare with 0 to get a boolean mask of shape `[rows, 1]`.
hint: `torch.where(mask, x * 2, -x)` picks per element; the `[rows, 1]` mask broadcasts across the columns.
approach:
1. **Understand:** a per-row decision expressed as a mask instead of Python branches.
2. **Examples:** row sums 3, −2, 0 → double, negate, negate (0 isn't positive).
3. **Brute force:** the loop in the starter: correct, but one tiny operation per row and a sync per `.item()`.
4. **Pattern:** **compute both branches, select with torch.where**.
5. **Plan:** row sums with keepdim; mask; where.
6. **Code and test:** compare with the loop on random data.
walkthrough:
**Line by line**

- `x.sum(dim=1, keepdim=True)` gives one sum per row, kept as a column so it broadcasts against `x`.
- `> 0` turns it into a boolean mask.
- `torch.where(mask, x * 2, -x)` computes both candidates for every element and keeps the right one: no Python branching, so Dynamo captures one graph, and the work runs as a few large operations instead of many tiny ones.

**Why `.item()` hurts twice:** it copies a value from the GPU to Python, which forces a synchronisation (lesson 24), and it's a graph break, because Dynamo can't know the value while tracing.

**Common wrong approach:** keeping `if row.sum() > 0` without `.item()`: still Python control flow on a tensor value, so still a graph break.
:::

:::quiz
? What does the first call to a `torch.compile`d model do that later calls don't?
+ Traces the code and compiles optimised kernels, so it is much slower
- Moves the model to the GPU
- Trains the model for one step
- Nothing: every call costs the same
= Exclude the first call(s) from timings; compiled code is cached and reused.
? Which line inside a compiled function most likely causes a graph break?
+ `if loss.item() > 0.5:`
- `y = torch.relu(x @ w)`
- `z = x.sum(dim=1)`
- `out = torch.where(x > 0, x, 0)`
= .item() needs the actual value in Python, which ends the graph; the others are tensor operations.
? You compile a model and save `compiled.state_dict()`. Loading it into a fresh `MyModel()` fails. Why?
+ The keys start with `_orig_mod.`; save `compiled._orig_mod.state_dict()` (or strip the prefix)
- Compiled models can't be saved
- The weights are stored in float16
- state_dict() of a compiled model is empty
= torch.compile wraps the model in an OptimizedModule whose submodule is called _orig_mod.
? Which `torch.compile` mode uses CUDA graphs to cut kernel-launch overhead?
+ `mode="reduce-overhead"`
- `mode="default"`
- `fullgraph=True`
- `backend="eager"`
= CUDA graphs replay a recorded sequence of kernels with one launch, which helps most for small batches.
? What does `torch.set_float32_matmul_precision("high")` enable?
+ TF32 tensor-core matmuls for float32 on supporting GPUs: faster, with slightly lower precision
- float64 matmuls
- Automatic mixed precision with GradScaler
- torch.compile for every model
= "highest" (the default) keeps full float32 precision.
? Why can varying batch sizes slow down a compiled model?
+ Each new shape can trigger a recompilation until the dimension is treated as dynamic
- Compiled models only accept one batch size
- Larger batches always disable compilation
- The optimizer state is recompiled
= Use drop_last=True, dynamic=True or mark_dynamic to avoid repeated recompiles.
:::

@@@ lesson
id: mixed-precision
title: Mixed precision training
minutes: 25
summary: Why lower precision speeds up training (tensor cores, memory bandwidth), torch.autocast for CUDA and CPU, which operations run in float16 or bfloat16 and which stay float32, keeping float32 master weights, why float16 needs loss scaling, torch.amp.GradScaler (scale, step, update, unscale_ before gradient clipping, skipped steps), bfloat16 without a scaler, and saving the scaler's state.
---
GPUs run matrix multiplications in 16-bit floats several times faster than in float32 (on **tensor cores**), and 16-bit tensors halve memory traffic. But some operations need float32's precision or range. **Mixed precision** gets the speed without losing accuracy: run the operations that benefit in 16 bits, keep the sensitive ones and the weights in float32.

Part 1 covered the two 16-bit formats: **float16** (more precision, tiny range: overflows above 65504, and small gradients underflow to 0) and **bfloat16** (float32's range, less precision). Modern GPUs (NVIDIA Ampere and newer, and TPUs) support bfloat16, which makes mixed precision much simpler.

### torch.autocast

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

### Gradient scaling for float16

With float16, gradients for small weights can be so small that they **underflow** to zero, and those weights stop learning. **Loss scaling** fixes it: multiply the loss by a large factor (initially 65536) before `backward()`, so the gradients are scaled up into float16's range, then divide them back before the optimizer uses them.

![float32 master weights; an autocast forward runs matmuls and convolutions in fp16 and softmax and losses in fp32; GradScaler multiplies the loss by the scale; backward produces scaled fp16 gradients; unscale_ divides by the scale and skips the step if any gradient is inf or nan; optimizer.step() updates the float32 weights; update() halves the scale after an overflow, otherwise slowly grows it. float16 needs loss scaling; bfloat16 has float32's range and doesn't](figures/amp.svg)

`torch.amp.GradScaler` does the bookkeeping:

```py-static
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

### bfloat16: usually simpler

bfloat16 has float32's exponent range, so gradients don't underflow and **no GradScaler is needed**:

```py-static
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

:::exercise A mixed-precision training step
Write `amp_step(model, x, y, loss_fn, opt, scaler)` for float16 training on CUDA: zero the gradients, run the forward pass and loss under `torch.autocast(device_type="cuda", dtype=torch.float16)`, backward on the **scaled** loss, unscale, clip the gradient norm to 1.0, step through the scaler, update the scaler, and return the (unscaled) loss as a Python float.
```python starter
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
```python check
import copy
import torch
from torch import nn, optim
fn = need("amp_step")
assert uses("autocast") and uses("scale(") and uses("unscale_") and uses("clip_grad_norm_") and uses(".update("), "Use autocast, scaler.scale(...), scaler.unscale_, clip_grad_norm_ and scaler.update()."
torch.manual_seed(1)
model = nn.Sequential(nn.Linear(4, 8), nn.ReLU(), nn.Linear(8, 3)).cuda()
ref = copy.deepcopy(model)
x, y = torch.randn(16, 4, device="cuda") * 3, torch.randint(0, 3, (16,), device="cuda")
loss_fn = nn.CrossEntropyLoss()
opt = optim.SGD(model.parameters(), lr=0.5)
scaler = torch.amp.GradScaler("cuda", init_scale=1024.0)
model[0].weight.grad = torch.ones_like(model[0].weight)            # stale gradient that must be cleared
got = fn(model, x, y, loss_fn, opt, scaler)
assert isinstance(got, float), f"Return the loss as a Python float, got {type(got).__name__}."
ropt = optim.SGD(ref.parameters(), lr=0.5)
rs = torch.amp.GradScaler("cuda", init_scale=1024.0)
ropt.zero_grad()
with torch.autocast(device_type="cuda", dtype=torch.float16):
    rl = loss_fn(ref(x), y)
rs.scale(rl).backward(); rs.unscale_(ropt); torch.nn.utils.clip_grad_norm_(ref.parameters(), 1.0); rs.step(ropt); rs.update()
assert abs(got - rl.item()) < 1e-4, f"The returned loss should be {rl.item():.4f} (the unscaled loss), got {got:.4f}."
same(model[0].weight, ref[0].weight, "the first layer's weights after the step", tol=1e-4)
assert model[0].weight.dtype == torch.float32, "The weights must stay float32."
assert scaler.get_scale() == rs.get_scale(), "Call scaler.update() after the step."
```
```python solution
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
hint: Only the forward pass and the loss go inside `with torch.autocast(...)`.
hint: `scaler.scale(loss).backward()`; then `scaler.unscale_(opt)` before `clip_grad_norm_`, so the clipping sees the true gradient sizes.
hint: Finish with `scaler.step(opt)` and `scaler.update()`, and return `loss.item()` (the loss before scaling).
approach:
1. **Understand:** the standard AMP recipe, with clipping in the right place.
2. **Examples:** without `unscale_`, clipping would compare gradients 1024 times too large with the threshold 1.0.
3. **Brute force:** multiply and divide by a fixed scale yourself: no overflow detection, no adaptive scale.
4. **Pattern:** **autocast forward → scale → backward → unscale_ → clip → step → update**.
5. **Plan:** follow the pattern in order.
6. **Code and test:** compare the updated weights with a reference run.
walkthrough:
**Line by line**

- `torch.autocast(..., float16)` makes the linear layers run in float16; cross-entropy runs in float32.
- `scaler.scale(loss)` multiplies by the current scale (here 1024); `backward()` then produces scaled gradients.
- `scaler.unscale_(opt)` divides the gradients of that optimizer's parameters by the scale, in place, and records whether any is inf or nan.
- `clip_grad_norm_` now clips the real gradients.
- `scaler.step(opt)` skips the update if an inf or nan was found, otherwise calls `opt.step()`; it doesn't unscale again.
- `scaler.update()` adjusts the scale; `loss.item()` is the true loss, because only the copy passed to backward was scaled.

**Common wrong approach:** clipping before `unscale_`. The clip threshold then applies to scaled gradients, so it almost always clips, by a huge factor.
:::

:::exercise Predict the dtypes under autocast
Inside `torch.autocast(device_type="cuda", dtype=torch.float16)`, with `w` a float32 CUDA tensor of shape `[4, 4]`, `x` a float32 CUDA tensor of shape `[2, 4]` and `d` a float64 CUDA tensor, fill in `answers`: each expression's result dtype. Predict, then run them to check.
```python starter
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
```python check
import torch
ans = need("answers", dict)
w = torch.randn(4, 4, device="cuda"); x = torch.randn(2, 4, device="cuda"); d = torch.randn(3, 3, device="cuda", dtype=torch.float64)
with torch.autocast(device_type="cuda", dtype=torch.float16):
    truth = {k: eval(k).dtype for k in ["x @ w", "(x @ w).relu()", "(x @ w).softmax(dim=-1)", "(x @ w).sum()", "x + 1", "(x @ w) + x", "d @ d"]}
for k, v in truth.items():
    assert k in ans and ans[k] is not None, f"Fill in a dtype for {k!r}."
    assert ans[k] == v, f"{k}: not {ans[k]}. Think again about which list the operation is on (or run it)."
```
```python solution
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
hint: Matmul-like operations go to float16; numerically sensitive ones (softmax, sum, exp, log, losses) go to float32.
hint: Operations on neither list (relu, +) keep their inputs' dtype, using normal type promotion when dtypes differ.
hint: Autocast only casts float32 (and 16-bit) tensors: float64 is left alone.
approach:
1. **Understand:** three behaviours: cast down, cast up to float32, or leave alone.
2. **Examples:** `lin(x)` under autocast is float16; `loss` is float32.
3. **Brute force:** run each line (allowed here; not in the exam).
4. **Pattern:** **lower-precision list / float32 list / promotion** for everything else.
5. **Plan:** classify each operation.
6. **Code and test:** check the answers.
walkthrough:
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
:::

:::quiz
? Inside `torch.autocast(device_type="cuda", dtype=torch.float16)`, what dtype does `nn.Linear` produce, and what dtype are its weights?
+ float16 output; the weights remain float32
- float16 output and float16 weights
- float32 output; the weights become float16
- float32 output and weights
= Autocast casts copies of the weights per operation; the stored weights stay float32.
? Why does float16 training need a GradScaler but bfloat16 usually doesn't?
+ float16's small exponent range lets small gradients underflow to zero; bfloat16 has float32's range
- bfloat16 has more mantissa bits
- GradScaler doesn't support bfloat16
- float16 can't be used on GPUs without it
= Scaling the loss moves gradients into float16's representable range.
? When should `scaler.unscale_(optimizer)` be called explicitly?
+ Before clipping or inspecting gradients, so they have their true sizes
- After `scaler.update()`
- Before `scaler.scale(loss).backward()`
- Never: step() can't run without it
= step() unscales automatically if you didn't; call unscale_ yourself only when you need real gradients first.
? A GradScaler's `step()` finds inf values in the gradients. What happens?
+ The optimizer step is skipped, and `update()` lowers the scale (by backoff_factor, 0.5 by default)
- The step runs with the inf values
- Training stops with an error
- The gradients are set to zero and the step runs
= Occasional skipped steps are expected, especially early in training.
? Where should `loss.backward()` be called relative to the autocast block?
+ Outside it, after the forward pass and loss
- Inside it, so backward also runs in float16
- Before entering it
- It doesn't matter, but inside is required for bfloat16
= Backward operations automatically use the dtypes of their forward counterparts.
? Which loss raises an error under CUDA autocast?
+ `F.binary_cross_entropy` (on probabilities)
- `F.binary_cross_entropy_with_logits`
- `F.cross_entropy`
- `F.mse_loss`
= A sigmoid followed by BCE is unstable in float16; use BCEWithLogitsLoss, which is safe.
:::

@@@ lesson
id: distributed-training
title: Distributed training
minutes: 30
summary: Why train on several GPUs, data parallelism and the all-reduce of gradients, effective batch size, processes, ranks, world size and local rank, launching with torchrun, init_process_group with the NCCL and Gloo backends, DistributedDataParallel and its module attribute, DistributedSampler with set_epoch, saving and logging on rank 0, no_sync for gradient accumulation, Fully Sharded Data Parallel (FSDP2 fully_shard) for models too big for one GPU, and other parallelism strategies.
---
One GPU eventually becomes too slow, or too small, for a model. Distributed training spreads the work over several GPUs, on one machine or many.

(A browser can only run one process, so the sandbox's `torch.distributed` supports a single process: the API, the errors and the data splitting work as in PyTorch, and the multi-GPU scripts below are for your own machine.)

### Data parallelism

The most common strategy, **distributed data parallel (DDP)**:

1. Every GPU runs its own **process** with a **full copy** of the model.
2. Each process trains on a **different slice** of every batch.
3. After `backward()`, the processes **all-reduce** their gradients (average them across all GPUs), so every copy ends up with the same averaged gradient.
4. Every process takes the same optimizer step, so the copies stay identical.

![Four GPUs, rank 0 to 3, each with a full model copy and its own batch shard, feed an all-reduce that averages every gradient across the four processes using NCCL. Each rank then takes the same optimizer step, so the copies stay identical; DistributedSampler gives each rank different data](figures/ddp.svg)

Averaging the gradients of equal-sized shards gives exactly the gradient of the whole batch (for a mean loss), which is why DDP trains like one big GPU:

```python
import torch
from torch import nn

torch.manual_seed(0)
model = nn.Linear(3, 1)
x, y = torch.randn(8, 3), torch.randn(8, 1)
loss_fn = nn.MSELoss()

loss_fn(model(x), y).backward()                       # one GPU, the whole batch of 8
full = model.weight.grad.clone()

grads = []
for xs, ys in zip(x.chunk(4), y.chunk(4)):            # 4 "GPUs", 2 samples each
    model.zero_grad()
    loss_fn(model(xs), ys).backward()
    grads.append(model.weight.grad.clone())
averaged = torch.stack(grads).mean(dim=0)             # what the all-reduce computes
print(torch.allclose(full, averaged))
```

**Effective batch size** = batch size per GPU × number of GPUs. With 8 GPUs and 32 samples each, every optimizer step sees 256 samples, so the learning rate often needs raising (a common rule of thumb scales it with the batch size, combined with a warm-up).

### Processes, ranks and torchrun

| Term | Meaning |
|---|---|
| **world size** | total number of processes (usually one per GPU) |
| **rank** | this process's number, 0 … world size − 1 (rank 0 usually logs and saves) |
| **local rank** | its number on this machine, used to pick the GPU |
| **backend** | the communication library: **NCCL** for NVIDIA GPUs, **Gloo** for CPUs |

`torchrun` starts the processes and sets `RANK`, `LOCAL_RANK`, `WORLD_SIZE`, `MASTER_ADDR` and `MASTER_PORT` in each one's environment:

```bash
torchrun --nproc_per_node=4 train.py                     # 4 GPUs on this machine
torchrun --nnodes=2 --nproc_per_node=8 --node_rank=0 --master_addr=10.0.0.1 --master_port=29500 train.py
```

### A DDP training script

```py-static
import os
import torch
import torch.distributed as dist
from torch.nn.parallel import DistributedDataParallel as DDP
from torch.utils.data import DataLoader
from torch.utils.data.distributed import DistributedSampler

def main():
    dist.init_process_group(backend="nccl")             # reads RANK, WORLD_SIZE… set by torchrun
    local_rank = int(os.environ["LOCAL_RANK"])
    torch.cuda.set_device(local_rank)
    device = torch.device("cuda", local_rank)

    model = MyModel().to(device)
    model = DDP(model, device_ids=[local_rank])        # gradients are all-reduced during backward()
    opt = torch.optim.AdamW(model.parameters(), lr=1e-3)

    sampler = DistributedSampler(train_ds, shuffle=True)    # each rank gets a different 1/world_size slice
    loader = DataLoader(train_ds, batch_size=32, sampler=sampler, num_workers=4, pin_memory=True)

    for epoch in range(epochs):
        sampler.set_epoch(epoch)                        # a different shuffle every epoch
        for xb, yb in loader:
            xb, yb = xb.to(device, non_blocking=True), yb.to(device, non_blocking=True)
            opt.zero_grad()
            loss_fn(model(xb), yb).backward()
            opt.step()
        if dist.get_rank() == 0:                        # save once, from one process
            torch.save(model.module.state_dict(), "checkpoint.pt")
        dist.barrier()                                  # others wait until the save is done

    dist.destroy_process_group()

if __name__ == "__main__":
    main()
```

Key details:

- `DDP(model)` stores the model as `model.module`: save `model.module.state_dict()` so the keys don't start with `module.`.
- Pass the sampler with `sampler=` (not `shuffle=True`, which is mutually exclusive with a sampler).
- Without `sampler.set_epoch(epoch)`, every epoch uses the **same** order.
- Only rank 0 should print, save checkpoints or write logs; use `dist.barrier()` when the others must wait.

The same calls run in the sandbox as a world of one process:

```python
import os
import torch
import torch.distributed as dist
from torch import nn
from torch.nn.parallel import DistributedDataParallel as DDP

os.environ.setdefault("MASTER_ADDR", "127.0.0.1")
os.environ.setdefault("MASTER_PORT", "29500")
dist.init_process_group(backend="gloo", rank=0, world_size=1)
print(dist.get_rank(), dist.get_world_size(), dist.get_backend())

torch.manual_seed(0)
model = DDP(nn.Linear(2, 1))
print(model)
print(list(model.state_dict().keys()))
print(list(model.module.state_dict().keys()))

t = torch.tensor([1.0, 2.0])
dist.all_reduce(t, op=dist.ReduceOp.SUM)     # with one process, the sum is the tensor itself
print(t)
dist.destroy_process_group()
```

```python error
import torch.distributed as dist

print(dist.get_rank())        # no process group yet
```

### DistributedSampler

`DistributedSampler(dataset, num_replicas, rank, shuffle=True, seed=0, drop_last=False)` gives each rank every `world_size`-th index (after an optional shuffle seeded with `seed + epoch`). If the dataset doesn't divide evenly, it **pads** by repeating indexes from the start, so every rank gets the same number of samples and the processes stay in step; `drop_last=True` drops the remainder instead.

```python
from torch.utils.data.distributed import DistributedSampler

data = range(10)
for rank in range(3):
    print(rank, list(DistributedSampler(data, num_replicas=3, rank=rank, shuffle=False)))

s = DistributedSampler(data, num_replicas=3, rank=0, shuffle=True, seed=0)
print(list(s))
s.set_epoch(1)
print(list(s))                                   # a new shuffle for epoch 1
print(len(DistributedSampler(data, num_replicas=3, rank=0, drop_last=True)))
```

The padding means a few samples are seen twice per epoch: for exact validation metrics, evaluate on rank 0 only or account for the duplicates.

### Gradient accumulation with DDP

Every `backward()` on a DDP model triggers an all-reduce. When accumulating gradients over several micro-batches (Part 4), skip the communication on all but the last with `model.no_sync()`:

```py-static
for i, (xb, yb) in enumerate(loader):
    is_last = (i + 1) % accum_steps == 0
    ctx = contextlib.nullcontext() if is_last else model.no_sync()
    with ctx:
        (loss_fn(model(xb), yb) / accum_steps).backward()
    if is_last:
        opt.step()
        opt.zero_grad()
```

### When the model doesn't fit: FSDP

DDP keeps a **full copy** of the parameters, gradients and optimizer state on every GPU. With Adam in float32 that's about 16 bytes per parameter, so a 7-billion-parameter model needs over 100 GB per GPU. **Fully Sharded Data Parallel (FSDP)** splits (shards) all three across the GPUs: each GPU stores only its slice, gathers the full parameters of a layer just before using it, and frees them afterwards.

```py-static
from torch.distributed.fsdp import fully_shard, MixedPrecisionPolicy

mp = MixedPrecisionPolicy(param_dtype=torch.bfloat16, reduce_dtype=torch.float32)
for block in model.blocks:              # shard each transformer block…
    fully_shard(block, mp_policy=mp)
fully_shard(model, mp_policy=mp)        # …then the whole model
opt = torch.optim.AdamW(model.parameters(), lr=1e-4)   # create the optimizer after sharding
```

`fully_shard` is the current API (called **FSDP2**); the older `FullyShardedDataParallel` wrapper class (FSDP1) still appears in existing code.

| Strategy | Each GPU holds | Use when |
|---|---|---|
| DDP | a full model copy | the model fits on one GPU (the usual case) |
| FSDP | a shard of parameters, gradients and optimizer state | the model, gradients and optimizer state don't fit on one GPU |
| tensor parallel | a slice of each layer's matrices | very large layers, usually within one machine |
| pipeline parallel | a few consecutive layers | very deep models across machines |

Large language models combine several of these at once.

:::exercise Which samples does each rank get?
Write `shard_indices(n, world_size, rank)` returning the list of indexes that `DistributedSampler(range(n), num_replicas=world_size, rank=rank, shuffle=False)` gives to `rank`: pad the index list 0 … n − 1 by repeating it from the start until its length is a multiple of `world_size`, then take every `world_size`-th index starting at `rank`. Don't use DistributedSampler itself.
```python starter
def shard_indices(n, world_size, rank):
    pass

for rank in range(3):
    print(rank, shard_indices(10, 3, rank))
```
```python check
from torch.utils.data.distributed import DistributedSampler
fn = need("shard_indices")
assert not uses("DistributedSampler"), "Work it out yourself instead of calling DistributedSampler."
for n, w in [(10, 3), (12, 4), (7, 2), (2, 4), (1, 3), (16, 8), (5, 5), (3, 7)]:
    for r in range(w):
        want = list(DistributedSampler(range(n), num_replicas=w, rank=r, shuffle=False))
        got = fn(n, w, r)
        assert got == want, f"shard_indices({n}, {w}, {r}) should be {want}, got {got}."
```
```python solution
import math

def shard_indices(n, world_size, rank):
    per_rank = math.ceil(n / world_size)
    total = per_rank * world_size
    indices = list(range(n))
    while len(indices) < total:
        indices += indices[: total - len(indices)]
    return indices[rank:total:world_size]

for rank in range(3):
    print(rank, shard_indices(10, 3, rank))
```
hint: Each rank gets `ceil(n / world_size)` samples, so the padded list has `ceil(n / world_size) * world_size` indexes.
hint: Pad by appending indexes from the start of the list; when n is smaller than the padding needed, repeat the whole list more than once.
hint: `indices[rank::world_size]` takes every world_size-th index starting at rank.
approach:
1. **Understand:** pad to a multiple of the world size, then interleave.
2. **Examples:** n = 10, world 3: per rank 4, total 12; padded 0 … 9, 0, 1; rank 1 gets 1, 4, 7, 0.
3. **Brute force:** contiguous blocks per rank: a valid split, but not DistributedSampler's.
4. **Pattern:** **pad cyclically, then stride by world size**.
5. **Plan:** compute sizes; pad in a loop; slice with a step.
6. **Code and test:** tiny datasets with more ranks than samples.
walkthrough:
**Line by line**

- `math.ceil(n / world_size)` is the number of samples per rank; every rank must get the same count, or the processes would fall out of step in the all-reduce.
- The padding loop appends from the start of the list, repeating it if necessary (n = 2 with 4 ranks needs indexes 0, 1, 0, 1).
- `indices[rank:total:world_size]` interleaves: rank r gets positions r, r + w, r + 2w…

**Consequence:** with padding, some samples appear twice in an epoch (index 0 and 1 above); `drop_last=True` instead drops the tail so nothing repeats.

**Common wrong approach:** splitting into contiguous blocks with `range(rank * per_rank, (rank + 1) * per_rank)`. It also splits the data, but gives different ranks different counts at the end and doesn't match the sampler, which matters when you reason about which rank saw which sample.
:::

:::exercise Simulate an all-reduce step
Write `ddp_gradients(model, loss_fn, x, y, world_size)` that simulates data-parallel training in one process: split `x` and `y` into `world_size` equal chunks along dim 0, compute each chunk's gradients separately (zero the gradients before each chunk), then average each parameter's gradients over the chunks, store the averages in the parameters' `.grad`, and return them as a list (one tensor per parameter, in `model.parameters()` order).
```python starter
import torch
from torch import nn

def ddp_gradients(model, loss_fn, x, y, world_size):
    pass

torch.manual_seed(0)
model = nn.Linear(3, 1)
x, y = torch.randn(8, 3), torch.randn(8, 1)
grads = ddp_gradients(model, nn.MSELoss(), x, y, world_size=4)
print([g.shape for g in grads])
```
```python check
import copy
import torch
from torch import nn
fn = need("ddp_gradients")
torch.manual_seed(3)
model = nn.Sequential(nn.Linear(3, 5), nn.Tanh(), nn.Linear(5, 2))
ref = copy.deepcopy(model)
x, y = torch.randn(12, 3), torch.randn(12, 2)
loss_fn = nn.MSELoss()
for p in model.parameters():
    p.grad = torch.full_like(p, 7.0)                 # stale gradients that must be ignored
grads = fn(model, loss_fn, x, y, world_size=3)
assert isinstance(grads, list) and len(grads) == 4, "Return a list with one averaged gradient per parameter (4 here)."
loss_fn(ref(x), y).backward()
for i, (g, p, r) in enumerate(zip(grads, model.parameters(), ref.parameters())):
    same(g, r.grad, f"averaged gradient {i} (it should equal the full-batch gradient)", tol=1e-5)
    same(p.grad, r.grad, f"parameter {i}'s .grad", tol=1e-5)
```
```python solution
import torch
from torch import nn

def ddp_gradients(model, loss_fn, x, y, world_size):
    params = list(model.parameters())
    per_rank = []
    for xs, ys in zip(x.chunk(world_size), y.chunk(world_size)):
        model.zero_grad()
        loss_fn(model(xs), ys).backward()
        per_rank.append([p.grad.clone() for p in params])
    averaged = [torch.stack(gs).mean(dim=0) for gs in zip(*per_rank)]
    for p, g in zip(params, averaged):
        p.grad = g.clone()
    return averaged

torch.manual_seed(0)
model = nn.Linear(3, 1)
x, y = torch.randn(8, 3), torch.randn(8, 1)
grads = ddp_gradients(model, nn.MSELoss(), x, y, world_size=4)
print([g.shape for g in grads])
```
hint: `x.chunk(world_size)` and `y.chunk(world_size)` give each rank's shard.
hint: For each shard: `model.zero_grad()`, forward, loss, `backward()`, then save `[p.grad.clone() for p in params]`.
hint: `zip(*per_rank)` groups the same parameter's gradients across ranks; `torch.stack(...).mean(dim=0)` averages them. Assign the result to each `p.grad`.
approach:
1. **Understand:** each "rank" computes local gradients; the all-reduce averages them.
2. **Examples:** 12 samples, world 3: shards of 4; the average of the 3 shard gradients is the 12-sample gradient.
3. **Brute force:** one backward over everything gives the same numbers, but doesn't show the mechanism.
4. **Pattern:** **local gradients → elementwise average across ranks**.
5. **Plan:** loop over shards; clone grads; average per parameter; write back.
6. **Code and test:** compare with a full-batch gradient.
walkthrough:
**Line by line**

- `chunk` splits the batch into equal shards, as DistributedSampler and per-rank DataLoaders do.
- `model.zero_grad()` before each shard keeps each rank's gradient separate (each real GPU starts from zero).
- `p.grad.clone()` copies the gradient, because the next shard's backward would overwrite it.
- `torch.stack(gs).mean(dim=0)` is exactly the AVG all-reduce DDP performs (NCCL sums, then DDP divides by the world size).
- With a mean loss and equal shards, the average of the shard gradients equals the gradient of the full batch.

**Why it matters:** this equality is why DDP with world size W behaves like one GPU with a W-times-larger batch, which is also why the learning rate often needs adjusting.

**Common wrong approach:** summing instead of averaging the gradients, which multiplies the effective learning rate by the world size.
:::

:::quiz
? In DistributedDataParallel, what is communicated between GPUs during `backward()`?
+ Gradients, which are averaged across processes with an all-reduce
- The model's parameters after every step
- The input batches
- The loss values only
= Each process holds full parameters and its own data; averaging gradients keeps the copies identical.
? Training with DDP on 4 GPUs uses `batch_size=64` in each DataLoader. What is the effective batch size per optimizer step?
+ 256
- 64
- 16
- 4
= Each of the 4 processes processes 64 samples, and their gradients are averaged into one step.
? What happens if you forget `sampler.set_epoch(epoch)` with a shuffling DistributedSampler?
+ Every epoch uses the same shuffled order
- Each rank sees the whole dataset
- Training raises an error
- The data isn't shuffled at all, even in the first epoch
= The shuffle is seeded with seed + epoch; without set_epoch, epoch stays 0.
? Which backend should `init_process_group` use for multi-GPU training on NVIDIA GPUs?
+ `nccl`
- `gloo`
- `mpi`
- `tcp`
= NCCL implements fast GPU-to-GPU collectives; Gloo is for CPUs.
? When is FSDP preferable to DDP?
+ When the parameters, gradients and optimizer state don't fit in one GPU's memory
- When the dataset is small
- When training on a CPU
- Always: DDP is deprecated
= FSDP shards them across GPUs; DDP keeps a full copy everywhere and is simpler and faster when the model fits.
? In a DDP script, which process should save the checkpoint?
+ Only rank 0, saving `model.module.state_dict()`
- Every rank, each to the same file
- The rank with the lowest loss
- No rank: DDP saves automatically
= One writer avoids conflicts; .module avoids "module." prefixes in the keys.
? `torchrun --nproc_per_node=4 train.py` on one machine. What does it do?
+ Starts 4 processes and sets RANK, LOCAL_RANK, WORLD_SIZE and the master address and port for each
- Runs train.py on 4 CPU threads
- Starts 1 process that uses 4 GPUs automatically
- Copies the dataset 4 times
= Each process then calls init_process_group and uses its LOCAL_RANK to pick a GPU.
:::
