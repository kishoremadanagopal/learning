# Lesson 7: CPUs, GPUs and devices

**You'll learn:** why GPUs speed up deep learning, cpu, cuda and mps devices and device indexes, torch.cuda.is_available and friends, torch.accelerator, .to(device), .cuda() and .cpu(), creating tensors on a device, the same-device rule and its error, 0-D tensors as scalars, .numpy() needing the CPU, detach().cpu().numpy(), device-agnostic code, CUDA out of memory, memory_allocated and the caching allocator, pinned memory and non_blocking copies, asynchronous execution and synchronize.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/pytorch/#devices)**: run every example and check your exercise answers.

## Key terms

- **GPU:** a processor with thousands of cores that do the same arithmetic on many numbers at once.
- **CUDA:** NVIDIA's platform for running computations on its GPUs; PyTorch's `cuda` device type.
- **MPS:** Metal Performance Shaders, the `mps` device type for Apple silicon GPUs.
- **torch.accelerator:** a device-agnostic API for whatever accelerator (CUDA, MPS, XPU…) the machine has.
- **.to(device):** returns a copy of a tensor on another device (and/or with another dtype).
- **Device-agnostic code:** code that chooses the device once and runs unchanged on a CPU or a GPU.
- **Pinned memory:** page-locked CPU memory that the GPU can copy from directly, which speeds up transfers.
- **Asynchronous execution:** GPU work is queued and runs in the background while Python continues.
- **Caching allocator:** PyTorch's GPU memory manager, which keeps freed memory reserved for reuse.

A **GPU** (graphics processing unit) has thousands of small cores built to do the same arithmetic on many numbers at once, exactly what tensor maths needs. Training a neural network on a GPU is often 10 to 100 times faster than on a CPU. PyTorch hides most of the difference: the same operations run on either; you only choose **where the tensors live**.

| Device type | Hardware | Check availability |
|---|---|---|
| `cpu` | the computer's processor and RAM | always available |
| `cuda` | NVIDIA GPUs (AMD GPUs with PyTorch's ROCm build also use the name `cuda`) | `torch.cuda.is_available()` |
| `mps` | Apple silicon GPUs (Metal Performance Shaders) | `torch.backends.mps.is_available()` |

A device can have an index: `cuda:0` is the first GPU, `cuda:1` the second. Plain `cuda` means the current one, usually 0.

## Finding the GPU

This sandbox has a pretend NVIDIA L4 GPU so you can practise; on your own computer, these calls report your real hardware.

```python
import torch

print(torch.cuda.is_available())
print(torch.cuda.device_count())
print(torch.cuda.get_device_name(0))
print(torch.backends.mps.is_available())

d = torch.device("cuda:0")
print(d, d.type, d.index)
print(repr(torch.device("cpu")))
```

Recent PyTorch versions also have `torch.accelerator`, one device-agnostic API for whichever accelerator the machine has (CUDA, MPS, Intel XPU and others). The official tutorials pick the device like this:

```python
import torch

device = torch.accelerator.current_accelerator().type if torch.accelerator.is_available() else "cpu"
print(f"Using {device} device")
```

## Moving tensors: .to(device)

Tensors are created on the CPU unless you say otherwise. `.to(device)` returns a **copy on that device** (the original stays where it was); `.cuda()` and `.cpu()` are shortcuts. Moving to the device a tensor is already on returns the same tensor, no copy.

```python
import torch

device = "cuda" if torch.cuda.is_available() else "cpu"
x = torch.tensor([1.0, 2.0, 3.0])
g = x.to(device)
print(x.device, g.device)
print(g)                                 # the printout shows the device
print(g * 2)                             # results stay on the GPU
y = torch.zeros(2, 2, device=device)     # create directly on the device: no copy
print(y.device)
print(g.to(device) is g)                 # already there: the same tensor
```

Creating a tensor directly on the device (`device=` in `zeros`, `rand`, `tensor` and friends) is faster than creating it on the CPU and copying. The `*_like` functions keep the original's device, which keeps code device-agnostic. `.to()` can change the dtype at the same time: `x.to(device, torch.float16)`.

## The same-device rule

Every tensor in one operation must be on the **same device**. PyTorch never moves data behind your back, because a hidden copy between CPU and GPU memory would be slow.

![CPU memory (RAM) holds x = torch.ones(3); x.numpy() works; device='cpu'. GPU memory (VRAM) holds g = x.to('cuda'), fast maths, no .numpy(); device='cuda:0'. Arrows: .to('cuda') or .cuda() goes to the GPU, .to('cpu') or .cpu() comes back. Each copy takes time, and x + g raises an error because every operand must be on the same device](../figures/devices.svg)

*This example raises an error on purpose.*

```python
import torch

x = torch.ones(3)                 # on the CPU
g = torch.ones(3).to("cuda")      # on the GPU
print(x + g)
```

The fix is always to move one side, usually the CPU tensor to the GPU: `x.to(g.device)`. In a training loop that means moving the model **and** every batch of data to the same device (Part 2). One exception: a 0-dimensional CPU tensor (a single number) can be combined with GPU tensors, like a Python number.

## Getting results back

NumPy, Matplotlib and printing a Python number all need data in CPU memory. `.item()` and `.tolist()` copy back automatically; `.numpy()` doesn't, so it refuses a GPU tensor:

*This example raises an error on purpose.*

```python
import torch

g = torch.rand(3, device="cuda")
arr = g.numpy()
```

```python
import torch

g = torch.rand(3, device="cuda")
print(g.cpu().numpy().shape)          # copy to the CPU first
print(g.sum().item())                 # .item() copies one number back
w = torch.ones(2, requires_grad=True, device="cuda")
print(w.detach().cpu().numpy())       # tensors that require grad also need .detach()
```

`t.detach().cpu().numpy()` is the standard recipe for turning any tensor into a NumPy array.

One more GPU difference: random numbers made directly on a CUDA device come from a separate GPU generator, so after the same `torch.manual_seed`, `torch.rand(3, device="cuda")` gives different values from `torch.rand(3)`. (This sandbox's pretend GPU reuses the CPU generator, so here they match.)

## Device-agnostic code

Write code that runs anywhere by choosing the device once and using it everywhere:

```python
import torch

device = "cuda" if torch.cuda.is_available() else "cpu"

def normalise(batch):
    mean = torch.zeros(batch.shape[1], device=batch.device)   # follow the input's device
    return batch - mean

data = torch.rand(4, 3).to(device)
print(normalise(data).device)

torch.cuda._sandbox_gpu(False)          # sandbox only: pretend there's no GPU
device = "cuda" if torch.cuda.is_available() else "cpu"
print(device, normalise(torch.rand(4, 3).to(device)).device)
```

(`torch.cuda._sandbox_gpu` exists only in this sandbox, to show what your code does on a machine without a GPU. On such a machine, real PyTorch's CPU-only build raises `AssertionError: Torch not compiled with CUDA enabled` if you ask for `cuda` anyway.)

## GPU memory and transfer speed

GPU memory is limited (16–80 GB on typical data-centre GPUs), and running out raises `torch.OutOfMemoryError` ("CUDA out of memory"). `torch.cuda.memory_allocated()` reports the bytes your tensors use; PyTorch's caching allocator rounds each allocation up to blocks of 512 bytes and keeps freed memory reserved for reuse.

```python
import torch

print(torch.cuda.memory_allocated())
x = torch.zeros(1000, device="cuda")      # 1000 float32 = 4000 bytes
print(torch.cuda.memory_allocated())      # rounded up to a multiple of 512
del x
print(torch.cuda.memory_allocated())
```

Copies between CPU and GPU go over a link (PCIe) that's much slower than the GPU itself, so move data once and keep it there. Two tools speed up the copies that are needed: **pinned** (page-locked) CPU memory, `t.pin_memory()`, which the GPU can read directly, and `t.to("cuda", non_blocking=True)`, which lets the copy overlap with other work. DataLoader's `pin_memory=True` (Part 3) does the first for every batch.

GPU operations are also **asynchronous**: PyTorch queues them and returns at once. To time GPU code correctly, call `torch.cuda.synchronize()` before reading the clock (Part 5).

## At a glance

| Concept | Code | Gives you | Remember |
|---|---|---|---|
| Check hardware | `torch.cuda.is_available()`, `torch.backends.mps.is_available()` | True or False | real CPU-only builds raise "Torch not compiled with CUDA enabled" |
| Pick a device | `torch.accelerator.current_accelerator().type if torch.accelerator.is_available() else "cpu"` | a device string | choose once, use everywhere |
| Move | `x = x.to(device)`, `.cuda()`, `.cpu()` | a copy on the device | not in place for tensors |
| Create on device | `torch.zeros(n, device=device)` | no CPU copy | `*_like` keeps the device |
| Same-device rule | every operand on one device | otherwise a RuntimeError | 0-D CPU tensors are the exception |
| To NumPy | `t.detach().cpu().numpy()` | a NumPy array | `.item()` copies back by itself |
| GPU memory | `torch.cuda.memory_allocated()` | bytes in use | blocks of 512 bytes; OOM raises `torch.OutOfMemoryError` |
| Fast transfers | `pin_memory()`, `non_blocking=True` | overlapping copies | move data once, keep it there |

## Common mistakes

- Writing `x.to(device)` without `x = …`; for tensors, `.to()` returns a new tensor.
- Mixing CPU and GPU tensors in one operation.
- Calling `.numpy()` on a GPU tensor or a tensor that requires grad.
- Hard-coding `"cuda"`, so the code crashes on machines without a GPU.
- Creating tensors on the CPU and copying them to the GPU inside a loop instead of creating them on the device.
- Timing GPU code without `torch.cuda.synchronize()`.

## Exercises

### 1. A device-agnostic helper

Write `to_device(batch, device)` that moves a batch to `device`, where a batch can be a tensor, or a **list** or **dict** of tensors (dict values may also be lists). Return the same structure with every tensor moved. Then write `pick_device()` that returns the string `"cuda"` if a CUDA GPU is available, otherwise `"mps"` if an Apple GPU is available, otherwise `"cpu"`.

Starter code:

```python
import torch

def to_device(batch, device):
    pass

def pick_device():
    pass

device = pick_device()
batch = {"x": torch.rand(2, 3), "extras": [torch.zeros(2), torch.ones(1)]}
moved = to_device(batch, device)
print(device, moved["x"].device, moved["extras"][1].device)
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** walk a nested structure, moving the tensors and keeping the shape of the structure.
2. **Examples:** `{"x": t, "extras": [a, b]}` → the same keys and list, all on the device.
3. **Brute force:** handle only the exact structure in the example: breaks on the next batch format.
4. **Pattern:** **recursion over containers**, with tensors as the base case.
5. **Plan:** isinstance checks, dict and list comprehensions that recurse.
6. **Code and test:** move a list back to the CPU; check dtypes are unchanged.

</details>

<details>
<summary>💡 Hint 1</summary>

Handle three cases with `isinstance`: a tensor (call `.to(device)`), a dict, a list.

</details>

<details>
<summary>💡 Hint 2</summary>

For dicts and lists, call `to_device` again on each item (recursion handles lists inside dicts).

</details>

<details>
<summary>💡 Hint 3</summary>

`pick_device` checks `torch.cuda.is_available()` first, then `torch.backends.mps.is_available()`.

</details>

### 2. Fix the device bugs

The starter computes a weighted score on the GPU but has three device bugs: a tensor on the wrong device, a NumPy conversion of a GPU tensor, and a constant created on the CPU. Fix the code so it runs and sets `result` to a NumPy array of the 4 weighted scores and `best` to the index of the highest one (a Python int). Keep `scores` and `weights` on `device`.

Starter code:

```python
import torch

device = "cuda" if torch.cuda.is_available() else "cpu"
scores = torch.tensor([[0.2, 0.9], [0.7, 0.4], [0.5, 0.5], [0.1, 0.3]]).to(device)
weights = torch.tensor([0.6, 0.4])
bonus = torch.tensor([0.0, 0.1, 0.0, 0.2])

weighted = scores @ weights + bonus
result = weighted.numpy()
best = weighted.argmax()
print(result, best)
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** everything in one computation must share a device; results go back to the CPU for NumPy.
2. **Examples:** row 1: 0.7 × 0.6 + 0.4 × 0.4 + 0.1 = 0.68, the best.
3. **Brute force:** move everything to the CPU: it runs, but the work is no longer on the GPU.
4. **Pattern:** **create on the device**, compute there, **copy back once** at the end.
5. **Plan:** add `device=device` to the two constants, `.cpu()` before `.numpy()`, `.item()` for the index.
6. **Code and test:** check `weighted.device`.

</details>

<details>
<summary>💡 Hint 1</summary>

Run it and read the first error: which two tensors are on different devices?

</details>

<details>
<summary>💡 Hint 2</summary>

Create `weights` and `bonus` with `device=device`, or call `.to(device)` on them.

</details>

<details>
<summary>💡 Hint 3</summary>

`.numpy()` needs a CPU tensor: `weighted.cpu().numpy()`. And `.item()` turns the argmax into a Python int.

</details>

**In the sandbox:** exercises 13–14. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. A device-agnostic helper</summary>

```python
import torch

def to_device(batch, device):
    if isinstance(batch, torch.Tensor):
        return batch.to(device)
    if isinstance(batch, dict):
        return {k: to_device(v, device) for k, v in batch.items()}
    if isinstance(batch, list):
        return [to_device(v, device) for v in batch]
    return batch

def pick_device():
    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"

device = pick_device()
batch = {"x": torch.rand(2, 3), "extras": [torch.zeros(2), torch.ones(1)]}
moved = to_device(batch, device)
print(device, moved["x"].device, moved["extras"][1].device)
```

**Line by line**

- `batch.to(device)` returns a copy on the device (or the tensor itself if it's already there). It keeps the dtype.
- The dict and list branches rebuild the same container, calling `to_device` on every item, so nesting of any depth works.
- Anything else (a string label, a number) is returned unchanged.
- `pick_device` asks in order of preference. In the sandbox the pretend GPU is available, so it returns `"cuda"`.

**Common wrong approach:** calling `batch.to(device)` without assigning the result. Tensors' `.to()` doesn't change the tensor in place; it returns a new one. (Models are different: `model.to(device)` moves the model's own parameters, Part 2.)

</details>

<details>
<summary>✅ 2. Fix the device bugs</summary>

```python
import torch

device = "cuda" if torch.cuda.is_available() else "cpu"
scores = torch.tensor([[0.2, 0.9], [0.7, 0.4], [0.5, 0.5], [0.1, 0.3]]).to(device)
weights = torch.tensor([0.6, 0.4], device=device)
bonus = torch.tensor([0.0, 0.1, 0.0, 0.2], device=device)

weighted = scores @ weights + bonus
result = weighted.cpu().numpy()
best = weighted.argmax().item()
print(result, best)
```

**Line by line**

- `scores @ weights` fails first: `scores` is on `cuda:0` and `weights` on the CPU, which raises "Expected all tensors to be on the same device". Creating `weights` with `device=device` fixes it (and costs no extra copy). `bonus` needs the same, since it's 1-D, not a 0-D scalar.
- `weighted.numpy()` raises a TypeError for a GPU tensor. `weighted.cpu().numpy()` copies the 4 values to CPU memory first.
- `weighted.argmax()` returns a 0-D tensor *on the GPU*; `.item()` copies the single number back as a Python int.

**Common wrong approach:** fixing the error by moving `scores` to the CPU. The code runs, but on a real GPU machine it would silently give up the speed the GPU was there for.

</details>

## Quick quiz

1. `x = torch.ones(3)` is on the CPU. After `x.to("cuda")`, where is `x`?
   - A) Still on the CPU: `.to()` returns a new tensor on the GPU, which this line throws away
   - B) On the GPU
   - C) On both devices
   - D) It raises an error

2. `a` is on `cuda:0` and `b` on the CPU, both with shape `[3]`. What does `a + b` do?
   - A) Raises a RuntimeError saying the tensors are on different devices
   - B) Copies `b` to the GPU automatically and returns a CUDA tensor
   - C) Copies `a` to the CPU and returns a CPU tensor
   - D) Returns a tensor split across both devices

3. Which expression turns a GPU tensor `p` that requires grad into a NumPy array?
   - A) `p.detach().cpu().numpy()`
   - B) `p.numpy()`
   - C) `p.cpu().numpy()`
   - D) `numpy.array(p)`

4. What is the most portable way to choose a device in modern PyTorch code?
   - A) `torch.accelerator.current_accelerator().type if torch.accelerator.is_available() else "cpu"`
   - B) `"cuda"`
   - C) `torch.device("gpu")`
   - D) `"cuda" if torch.cuda.device_count() > 1 else "mps"`

5. Why is `torch.zeros(1000, 1000, device="cuda")` better than `torch.zeros(1000, 1000).cuda()`?
   - A) It allocates directly on the GPU, skipping a CPU allocation and a copy
   - B) It uses less GPU memory
   - C) `.cuda()` doesn't work on zeros
   - D) They're different: one is float64

6. Why should you call `torch.cuda.synchronize()` before stopping a timer around GPU code?
   - A) GPU operations run asynchronously, so without it you may time only the queuing, not the work
   - B) It frees GPU memory
   - C) It moves results to the CPU
   - D) It makes random numbers reproducible

<details>
<summary>Quiz answers</summary>

1. **A) Still on the CPU: `.to()` returns a new tensor on the GPU, which this line throws away**: For tensors, .to() is not in place. Write `x = x.to("cuda")`.
2. **A) Raises a RuntimeError saying the tensors are on different devices**: PyTorch never moves data implicitly between devices (except 0-D CPU tensors, which act like Python numbers).
3. **A) `p.detach().cpu().numpy()`**: numpy() needs CPU memory and a tensor outside autograd, so detach and copy first.
4. **A) `torch.accelerator.current_accelerator().type if torch.accelerator.is_available() else "cpu"`**: torch.accelerator covers CUDA, MPS, XPU and others, and falls back to the CPU. "gpu" isn't a device type at all.
5. **A) It allocates directly on the GPU, skipping a CPU allocation and a copy**: Both give the same tensor, but creating it on the device avoids a slow CPU-to-GPU transfer.
6. **A) GPU operations run asynchronously, so without it you may time only the queuing, not the work**: CUDA kernels are launched asynchronously; synchronize waits until they finish.

</details>

---
Previous: [Lesson 6](06-tensor-math.md) · Back to the [course home](../README.md)
