# Lesson 25: torch.compile and execution speed-ups

**You'll learn:** eager execution and its overheads, torch.compile on models and functions, TorchDynamo and FX graphs, TorchInductor, Triton and C++ kernels, operator fusion, first-call compile time, OptimizedModule and _orig_mod, the _orig_mod. state-dict prefix, modes (default, reduce-overhead with CUDA graphs, max-autotune), fullgraph, backends, graph breaks and their causes (.item(), data-dependent control flow, unsupported code), finding breaks with TORCH_LOGS and torch._dynamo.explain, torch.compiler.disable, recompilation, dynamic shapes and mark_dynamic, inference_mode, TF32 and set_float32_matmul_precision, cudnn.benchmark, channels_last, torch.export.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/pytorch/#torch-compile)**: run every example and check your exercise answers.

## Key terms

- **Eager mode:** PyTorch's default: each operation runs as soon as Python reaches it.
- **torch.compile:** turns a model or function into optimised code, captured on first call and reused afterwards.
- **TorchDynamo:** the part of torch.compile that captures tensor operations from running Python code into graphs.
- **TorchInductor:** the default compiler backend, which fuses operations and generates Triton (GPU) or C++ (CPU) kernels.
- **Kernel fusion:** combining several operations into one kernel, so intermediate results don't travel through memory.
- **Graph break:** a point where Dynamo can't capture code, so it splits the graph and runs that code in plain Python.
- **Recompilation:** compiling again because inputs no longer match what a graph was specialised for (shapes, dtypes).
- **CUDA graph:** a recorded sequence of GPU kernels replayed with one launch, used by `mode="reduce-overhead"`.
- **TF32:** a tensor-core format that speeds up float32 matmuls with slightly less precision.

PyTorch normally runs **eagerly**: every operation executes the moment Python reaches it, one GPU kernel at a time. That's easy to debug, but it costs time: Python overhead per operation, and intermediate results written to memory and read back between kernels.

`torch.compile` (since PyTorch 2.0) turns your model into optimised code with one line:

```python
model = MyModel().to(device)
model = torch.compile(model)          # nothing else changes: training and inference code stay the same
```

![Python code model(x) goes to TorchDynamo, which captures an FX graph, then TorchInductor, which fuses operations, then generated kernels in Triton on GPUs or C++ on CPUs. The first call compiles (seconds to minutes) and later calls reuse the cached kernels. A graph break means code Dynamo can't trace (print, .item(), data-dependent if) runs in plain Python between graphs; new input shapes or dtypes cause a recompile](../figures/compile.svg)

1. **TorchDynamo** watches your Python code run and captures the tensor operations into a **graph** (an FX graph).
2. **TorchInductor** (the default `backend="inductor"`) optimises the graph, mainly by **fusing** operations so data stays in fast memory, and generates kernels: **Triton** code on GPUs, C++ on CPUs.
3. Later calls reuse the compiled code. Typical training speed-ups are 1.3–2× on modern GPUs, more for small operations.

The **first call is slow**: it compiles (seconds, sometimes minutes for large models), so exclude it from timings and expect it at the start of training.

(The sandbox's `torch.compile` checks the arguments and returns the same objects as PyTorch, but runs your code eagerly: same results, no speed-up.)

## Compiling models and functions

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

## Modes and options

| Argument | Values | Effect |
|---|---|---|
| `mode` | `"default"` | a good balance of compile time and speed |
| | `"reduce-overhead"` | also uses **CUDA graphs** (replay a whole sequence of kernels in one launch): best for small batches where launch overhead dominates; uses more memory |
| | `"max-autotune"` | benchmarks many kernel variants (longest compile, fastest code) |
| `fullgraph=True` | | raise an error instead of allowing graph breaks |
| `dynamic` | `None` / `True` / `False` | how to handle changing input shapes (see below) |
| `backend` | `"inductor"` (default), `"cudagraphs"`, debugging: `"eager"`, `"aot_eager"` | what turns graphs into code |

*This example raises an error on purpose.*

```python
import torch
from torch import nn

torch.compile(nn.Linear(2, 2), mode="fast")
```

## Graph breaks

When Dynamo meets code it can't put in a graph, it **breaks** the graph: it runs the graph so far, executes that code in normal Python, and starts a new graph afterwards. Each break costs speed. Common causes:

| Cause | Example | Fix |
|---|---|---|
| reading a value into Python | `if loss.item() > 1:` , `x.tolist()`, `print(x)` | keep it in tensors (`torch.where`), log outside the compiled function |
| data-dependent control flow | `if x.sum() > 0:` | `torch.where`, `torch.cond` |
| unsupported Python or libraries | calls into NumPy or other C extensions | move them out of the compiled region |

```python
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

## Recompilation and dynamic shapes

A compiled graph is specialised to what it saw: input shapes, dtypes, devices, even some Python values. When a call doesn't match (a new batch size, say), Dynamo **recompiles**. After a shape changes once, PyTorch automatically marks that dimension dynamic and compiles a shape-generic version; `dynamic=True` asks for that from the start, and `torch._dynamo.mark_dynamic(x, 0)` marks one dimension. Too many recompilations hit a cache limit and fall back to eager. A smaller, varying last batch is a common cause: `drop_last=True` avoids it.

## Other speed-ups worth knowing

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

## At a glance

| Concept | Code | Gives you | Remember |
|---|---|---|---|
| Compile | `model = torch.compile(model)` | `OptimizedModule` | first call compiles; same parameters |
| Pipeline | Dynamo → FX graph → Inductor → Triton / C++ | fused kernels | `backend="inductor"` by default |
| Save | `compiled._orig_mod.state_dict()` | keys without `_orig_mod.` | or keep the original model |
| Modes | `"default"`, `"reduce-overhead"`, `"max-autotune"` | speed vs compile time | reduce-overhead uses CUDA graphs |
| No breaks allowed | `torch.compile(f, fullgraph=True)` | error at a break | debug with `TORCH_LOGS="graph_breaks"` |
| Avoid breaks | `torch.where(cond, a, b)` instead of `if` | one graph | no `.item()` inside |
| Shapes | `dynamic=True` / `torch._dynamo.mark_dynamic(x, 0)` | fewer recompiles | or `drop_last=True` |
| TF32 | `torch.set_float32_matmul_precision("high")` | faster float32 matmuls | default "highest" |
| Inference | `torch.inference_mode()` | no autograd tracking | faster than no_grad |

## Common mistakes

- Including the compile time of the first call in benchmarks.
- Saving `compiled.state_dict()` and then failing to load it into a plain model (the `_orig_mod.` prefix).
- Using `.item()`, `print` or `if tensor:` inside compiled code, causing graph breaks.
- Feeding many different input shapes, triggering repeated recompiles.
- Passing both `mode` and `options` (an error).
- Expecting `"reduce-overhead"` to save memory (CUDA graphs use more).

## Exercises

### 1. Clean up state-dict keys

A model may be wrapped by `torch.compile` (keys start with `_orig_mod.`), by DistributedDataParallel (keys start with `module.`), or both, in either order. Write `clean_state_dict(sd)` returning a new dict with every leading `_orig_mod.` and `module.` prefix removed from each key (repeatedly, in any order), keeping the values.

Starter code:

```python
import torch
from torch import nn

def clean_state_dict(sd):
    pass

compiled = torch.compile(nn.Linear(2, 3))
print(list(clean_state_dict(compiled.state_dict()).keys()))
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** wrappers add name prefixes; loading into an unwrapped model needs them gone.
2. **Examples:** `module._orig_mod.fc.weight` → `fc.weight`; `encoder.module.x` stays (not a leading prefix).
3. **Brute force:** `key.replace("module.", "")` also hits names in the middle: wrong.
4. **Pattern:** **strip leading prefixes until none match**.
5. **Plan:** for each key, loop removing either prefix while one matches.
6. **Code and test:** both orders; a nested `module` that must stay.

</details>

<details>
<summary>💡 Hint 1</summary>

Loop over the items and build a new dict.

</details>

<details>
<summary>💡 Hint 2</summary>

`key.startswith("_orig_mod.")` and `key[len(prefix):]` (or `key.removeprefix(prefix)`) strip one prefix.

</details>

<details>
<summary>💡 Hint 3</summary>

Repeat until neither prefix is at the start, so `module._orig_mod.` and `_orig_mod.module.` both reduce fully.

</details>

### 2. Remove a graph break

This function decides per row whether to double or negate values, using Python control flow on tensor values, which causes graph breaks under `torch.compile` (and is slow). Rewrite `scale_rows(x)` with the same results using only tensor operations: no `for` loops, no `if`, no `.item()`. Rows whose sum is positive are doubled; the others are negated.

Starter code:

```python
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

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a per-row decision expressed as a mask instead of Python branches.
2. **Examples:** row sums 3, −2, 0 → double, negate, negate (0 isn't positive).
3. **Brute force:** the loop in the starter: correct, but one tiny operation per row and a sync per `.item()`.
4. **Pattern:** **compute both branches, select with torch.where**.
5. **Plan:** row sums with keepdim; mask; where.
6. **Code and test:** compare with the loop on random data.

</details>

<details>
<summary>💡 Hint 1</summary>

Compute every row's sum at once: `x.sum(dim=1, keepdim=True)`, shape `[rows, 1]`.

</details>

<details>
<summary>💡 Hint 2</summary>

Compare with 0 to get a boolean mask of shape `[rows, 1]`.

</details>

<details>
<summary>💡 Hint 3</summary>

`torch.where(mask, x * 2, -x)` picks per element; the `[rows, 1]` mask broadcasts across the columns.

</details>

**In the sandbox:** exercises 49–50. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Clean up state-dict keys</summary>

```python
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

**Line by line**

- `torch.compile(model)` returns an `OptimizedModule` holding the model as `_orig_mod`, so every key gains `_orig_mod.`; `DistributedDataParallel` holds it as `module`, adding `module.`.
- The `while changed` loop keeps stripping until the key starts with neither prefix, which handles any nesting order.
- Only leading prefixes are removed, so a real submodule called `module` deeper in the name is untouched.

**Better habit:** save `model.state_dict()` from the unwrapped model (keep a reference to it before wrapping), and you never need this. The function is for checkpoints you didn't save that way.

**Common wrong approach:** `str.replace`, which also deletes `module.` from the middle of names like `encoder.module.x`.

</details>

<details>
<summary>✅ 2. Remove a graph break</summary>

```python
import torch

def scale_rows(x):
    positive = x.sum(dim=1, keepdim=True) > 0
    return torch.where(positive, x * 2, -x)

print(scale_rows(torch.tensor([[1.0, 2.0], [-3.0, 1.0], [0.0, 0.0]])))
```

**Line by line**

- `x.sum(dim=1, keepdim=True)` gives one sum per row, kept as a column so it broadcasts against `x`.
- `> 0` turns it into a boolean mask.
- `torch.where(mask, x * 2, -x)` computes both candidates for every element and keeps the right one: no Python branching, so Dynamo captures one graph, and the work runs as a few large operations instead of many tiny ones.

**Why `.item()` hurts twice:** it copies a value from the GPU to Python, which forces a synchronisation (lesson 24), and it's a graph break, because Dynamo can't know the value while tracing.

**Common wrong approach:** keeping `if row.sum() > 0` without `.item()`: still Python control flow on a tensor value, so still a graph break.

</details>

## Quick quiz

1. What does the first call to a `torch.compile`d model do that later calls don't?
   - A) Traces the code and compiles optimised kernels, so it is much slower
   - B) Trains the model for one step
   - C) Moves the model to the GPU
   - D) Nothing: every call costs the same

2. Which line inside a compiled function most likely causes a graph break?
   - A) `out = torch.where(x > 0, x, 0)`
   - B) `z = x.sum(dim=1)`
   - C) `if loss.item() > 0.5:`
   - D) `y = torch.relu(x @ w)`

3. You compile a model and save `compiled.state_dict()`. Loading it into a fresh `MyModel()` fails. Why?
   - A) The keys start with `_orig_mod.`; save `compiled._orig_mod.state_dict()` (or strip the prefix)
   - B) state_dict() of a compiled model is empty
   - C) The weights are stored in float16
   - D) Compiled models can't be saved

4. Which `torch.compile` mode uses CUDA graphs to cut kernel-launch overhead?
   - A) `backend="eager"`
   - B) `mode="reduce-overhead"`
   - C) `mode="default"`
   - D) `fullgraph=True`

5. What does `torch.set_float32_matmul_precision("high")` enable?
   - A) float64 matmuls
   - B) torch.compile for every model
   - C) Automatic mixed precision with GradScaler
   - D) TF32 tensor-core matmuls for float32 on supporting GPUs: faster, with slightly lower precision

6. Why can varying batch sizes slow down a compiled model?
   - A) Each new shape can trigger a recompilation until the dimension is treated as dynamic
   - B) Larger batches always disable compilation
   - C) The optimizer state is recompiled
   - D) Compiled models only accept one batch size

<details>
<summary>Quiz answers</summary>

1. **A) Traces the code and compiles optimised kernels, so it is much slower**: Exclude the first call(s) from timings; compiled code is cached and reused.
2. **C) `if loss.item() > 0.5:`**: .item() needs the actual value in Python, which ends the graph; the others are tensor operations.
3. **A) The keys start with `_orig_mod.`; save `compiled._orig_mod.state_dict()` (or strip the prefix)**: torch.compile wraps the model in an OptimizedModule whose submodule is called _orig_mod.
4. **B) `mode="reduce-overhead"`**: CUDA graphs replay a recorded sequence of kernels with one launch, which helps most for small batches.
5. **D) TF32 tensor-core matmuls for float32 on supporting GPUs: faster, with slightly lower precision**: "highest" (the default) keeps full float32 precision.
6. **A) Each new shape can trigger a recompilation until the dimension is treated as dynamic**: Use drop_last=True, dynamic=True or mark_dynamic to avoid repeated recompiles.

</details>

---
Previous: [Lesson 24](24-measuring-performance.md) · Next: [Lesson 26: Mixed precision training](26-mixed-precision.md)
