@@ pytorch-and-tensors
topics: what PyTorch is (tensors, autograd, building blocks), your first tensor, shape, dtype and device, rank and dimensions, the NCHW image layout, tensors versus lists and NumPy arrays, .item(), how the sandbox's PyTorch works, the PTCA exam's format and domains
terms:
- **PyTorch:** an open-source Python library for building and training neural networks, built on tensors and automatic differentiation.
- **Tensor:** a multi-dimensional array of numbers of one dtype, which can live on a CPU or a GPU and can be tracked by autograd.
- **Shape:** the number of elements along each dimension of a tensor, returned as a `torch.Size` (a tuple).
- **Rank (number of dimensions):** how many dimensions a tensor has: 0 for a scalar, 1 for a vector, 2 for a matrix (`.ndim`).
- **Scalar tensor:** a 0-dimensional tensor holding one value, such as the result of `.sum()`.
- **dtype:** the data type shared by every element of a tensor, such as `torch.float32` or `torch.int64`.
- **Device:** where a tensor's data lives: `cpu`, `cuda` (an NVIDIA GPU) or `mps` (an Apple GPU).
- **NCHW:** PyTorch's layout for image batches: batch, channels, height, width.
- **PTCA:** the PyTorch Certified Associate exam from the PyTorch Foundation and the Linux Foundation (2026).
mistakes:
- Treating a 0-D tensor such as `x.sum()` as a Python number; call `.item()` when you need one.
- Multiplying a Python list by a number and expecting element-wise maths.
- Assuming images are height × width × channels; PyTorch models expect channels first.
- Ignoring dtype and device when debugging: most bugs are a shape, dtype or device you didn't expect.

glance:
- Make a tensor | `torch.tensor([[1, 2], [3, 4]])` | a copy of the data, dtype inferred | ints → int64, floats → float32
- Inspect a tensor | `.shape`, `.ndim`, `.numel()`, `.dtype`, `.device` | what you need to debug | `.shape` is a `torch.Size` (a tuple)
- Get a Python number | `t.item()` | an int, float or bool | only for one-element tensors
- Image batch layout | `[batch, channels, height, width]` | what conv models expect | NCHW, channels first

@@ creating-tensors
topics: torch.tensor and dtype inference, ragged lists, torch.Tensor versus torch.tensor, zeros, ones, full, eye, empty, arange and linspace, the *_like functions, rand, randn, randint and randperm, torch.manual_seed, torch.Generator, reproducibility, from_numpy versus torch.tensor
terms:
- **torch.tensor:** creates a tensor by copying Python data or an array, inferring the dtype unless you pass `dtype=`.
- **arange:** evenly spaced values from start up to but not including end, by a step.
- **linspace:** a fixed number of evenly spaced values from start to end, both included.
- **_like functions:** `zeros_like`, `ones_like`, `full_like`, `rand_like` and others create a tensor with another tensor's shape, dtype and device.
- **torch.empty:** allocates a tensor without initialising its values.
- **rand / randn:** random floats, uniform in [0, 1) or from the standard normal distribution.
- **randint:** random integers from low up to but not including high.
- **Seed:** the starting value of a random number generator; the same seed gives the same sequence.
- **torch.manual_seed:** sets the seed of PyTorch's default random number generators (CPU and GPU).
- **Generator:** an independent random number generator object, passed with `generator=`.
- **from_numpy:** creates a tensor that shares memory with a NumPy array.
mistakes:
- Using `torch.Tensor(data)` (always float32, and integers mean sizes) instead of `torch.tensor(data)`.
- Expecting `arange`'s end, or `randint`'s high, to be included.
- Reading `torch.empty` values before writing them.
- Expecting repeatable random numbers without seeding, or forgetting that extra random calls shift the sequence.
- Feeding float64 tensors from NumPy into float32 models; convert with `.float()`.
- Assuming `from_numpy` copies: changes to the array show up in the tensor.

glance:
- From data | `torch.tensor(data, dtype=…)` | a new tensor (copy) | rows must have equal lengths
- Filled | `zeros`, `ones`, `full(shape, v)`, `eye(n)` | float32 by default | shape as numbers or a tuple
- Ranges | `arange(start, end, step)`, `linspace(start, end, steps)` | sequences | arange excludes end; linspace includes it
- Same shape, dtype, device | `zeros_like(t)`, `rand_like(t)` | a matching new tensor | keeps code device-agnostic
- Random | `rand`, `randn`, `randint(lo, hi, (n,))`, `randperm(n)` | uniform, normal, integers, a shuffle | randint's high is excluded
- Reproducible | `torch.manual_seed(42)` or `torch.Generator().manual_seed(42)` | the same numbers every run | GPUs also need deterministic algorithms
- From NumPy | `torch.from_numpy(arr)` / `torch.tensor(arr)` | shared memory / a copy | NumPy floats are float64

@@ dtypes
topics: the common dtypes and their aliases, bytes per element, the default dtype, when printing shows dtype=, converting with .to and shortcut methods, truncation versus rounding, type promotion categories, Python scalars and 0-D tensors in promotion, true division, in-place dtype errors, float32 versus float16 versus bfloat16 (range and precision), finfo and iinfo, comparing floats
terms:
- **Default dtype:** the floating-point type PyTorch uses when you don't choose one: float32 (`torch.get_default_dtype()`).
- **float32 (torch.float):** 32-bit floating point, the standard type for model weights.
- **float16 (torch.half):** 16-bit floating point with 5 exponent bits: precise but a small range (max 65504).
- **bfloat16:** 16-bit "brain" floating point with float32's 8 exponent bits: float32's range, less precision.
- **int64 (torch.long):** 64-bit integers, PyTorch's default for whole numbers, class labels and indexes.
- **Type promotion:** the rules PyTorch uses to choose the dtype of a result from inputs of different dtypes.
- **Exponent and mantissa:** the parts of a floating-point number that set its range and its precision.
- **Overflow:** a value too large for its dtype, becoming `inf` for floats or wrapping around for integers.
- **finfo / iinfo:** objects describing a float or integer dtype's limits, such as `max` and `eps`.
- **allclose:** checks that two tensors are equal within a tolerance.
mistakes:
- Expecting `.long()` or `.int()` to round; they truncate toward zero.
- Expecting `int_tensor + 1.5` to be float64; Python numbers give the default float32.
- Expecting `/` on integer tensors to give integers; use `//` for floor division.
- Doing in-place float maths on an integer tensor (`x += 0.5`), which raises an error.
- Using float16 for values above 65504, which overflow to `inf`.
- Comparing floats with `==` instead of `torch.allclose` or `torch.isclose`.

glance:
- Choose a dtype | `dtype=torch.float32` at creation | predictable maths and memory | float32 for models, int64 for labels
- Convert | `.to(torch.float16)`, `.float()`, `.long()` | a converted copy | float → int truncates toward zero
- Promotion | bool < int < float < complex | the result's dtype | Python numbers raise the category, never the size
- Division | `/` vs `//` | floats vs floor-divided ints | `/` on ints gives float32
- 16-bit floats | `float16` vs `bfloat16` | half the memory | bfloat16 keeps float32's range
- Limits | `torch.finfo(dtype).max`, `.eps` | range and precision | float16 max 65504
- Compare floats | `torch.allclose(a, b)` | equal within tolerance | `torch.equal` is exact

@@ indexing-and-views
topics: integer and slice indexing per dimension, negative indexes, ... and None, how indexing changes the shape, boolean masks, combining conditions with & | ~, index lists and tensors, writing through indexes, torch.where, views versus copies, clone, item, tolist, numpy() sharing memory, the ambiguous truth value error
terms:
- **Indexing:** selecting elements with one index or slice per dimension, like `x[1, :3]`.
- **Boolean mask:** a bool tensor, usually from a comparison, that selects the elements where it's True.
- **Advanced indexing:** indexing with a list or tensor of positions, or a mask; it returns a copy.
- **View:** a tensor that shares memory with another tensor but may have a different shape or strides.
- **clone:** returns a copy of a tensor with its own memory.
- **torch.where:** chooses, element by element, from one tensor where a condition is True and another where it's False.
- **tolist:** converts a tensor to (nested) Python lists.
- **numpy():** returns a NumPy array that shares memory with a CPU tensor.
mistakes:
- Forgetting that an integer index removes a dimension while a slice keeps it.
- Using Python's `and` / `or` on tensors instead of `&` / `|` with brackets.
- Changing a slice and being surprised that the original changed (slices are views).
- Assigning `b = a` and expecting a copy; use `a.clone()`.
- Calling `.item()` on a tensor with more than one element.
- Using a multi-element tensor in an `if`; reduce with `.any()` or `.all()`.

glance:
- Select | `x[1]`, `x[:, 2]`, `x[1:, ::2]`, `x[..., 0]` | elements, rows, columns, blocks | an int index drops a dim, a slice keeps it
- Add a dim | `x[:, None]` | a size-1 dimension | same as `unsqueeze`
- Filter | `x[x > 0]`, `x[(x > 0) & (x < 5)]` | a 1-D copy of the matches | use `&`, `\|`, `~` with brackets
- Pick positions | `x[[0, 2]]`, `x[idx_tensor]` | a copy of those rows | index tensors must be int64 (or int32, bool)
- Write | `x[mask] = 0` | changes x in place | works on views too
- Choose per element | `torch.where(cond, a, b)` | a new tensor | broadcasts its inputs
- Copy | `x.clone()` | independent memory | slicing returns views
- Leave PyTorch | `.item()`, `.tolist()`, `.numpy()` | a number, lists, an array | numpy() shares memory, CPU only

@@ reshaping
topics: view and reshape with -1, strides and contiguous tensors, why view fails after transpose, contiguous(), unsqueeze and squeeze, permute and transpose, .T and .mT, flatten, cat versus stack, split, chunk and unbind
terms:
- **reshape:** returns a tensor with the same elements in a new shape, as a view when possible and a copy otherwise.
- **view:** returns a tensor with a new shape that shares memory; it fails when the memory layout doesn't allow it.
- **Stride:** how many elements to skip in memory to move one step along each dimension.
- **Contiguous:** a tensor whose elements lie in memory in row-by-row reading order.
- **unsqueeze / squeeze:** add a dimension of size 1 / remove dimensions of size 1.
- **permute:** reorders all dimensions; `transpose` swaps two.
- **flatten:** merges a range of dimensions into one.
- **cat:** joins tensors along an existing dimension.
- **stack:** joins same-shaped tensors along a new dimension.
mistakes:
- Using `reshape` or `view` to move dimensions (like HWC to CHW); that needs `permute`.
- Calling `.view()` on a transposed or permuted tensor; use `.reshape()` or `.contiguous()` first.
- Calling `squeeze()` with no dim and losing a batch dimension of size 1.
- Confusing `cat` and `stack`: cat keeps the number of dimensions, stack adds one.
- Joining tensors whose other dimensions don't match.

glance:
- New shape | `x.reshape(2, -1)`, `x.view(2, -1)` | same elements, new shape | element count must match; one -1 allowed
- Contiguity | `x.is_contiguous()`, `x.contiguous()` | a row-major copy if needed | `.t()` and `.permute()` aren't contiguous
- Size-1 dims | `x.unsqueeze(0)`, `x.squeeze(0)` | add or remove a batch dim | plain `squeeze()` removes every size-1 dim
- Reorder dims | `x.permute(2, 0, 1)`, `x.transpose(0, 1)` | a view with new strides | HWC → CHW is `permute(2, 0, 1)`
- Flatten features | `x.flatten(1)` | `[batch, features]` | keeps dim 0
- Join | `torch.cat(ts, dim)`, `torch.stack(ts, dim)` | along an existing / a new dim | stack needs identical shapes
- Split | `x.split(size)`, `x.split([a, b])`, `x.chunk(n)` | a tuple of views | split takes sizes, chunk takes a count

@@ tensor-math
topics: element-wise arithmetic and functions, clamp, relu and sigmoid, broadcasting rules, broadcasting with keepdim, matrix multiplication with @, matmul, mm, mv, bmm and batched matmul, matching dtypes, reductions with dim and keepdim, max with indices, argmax for predictions, mean on integers, std's correction, softmax along a dim, in-place operations
terms:
- **Element-wise operation:** an operation applied to each element (or each pair of matching elements) separately.
- **Broadcasting:** stretching size-1 or missing dimensions so tensors of different shapes can be combined, without copying.
- **Matrix multiplication (@):** for `[n, k] @ [k, m]`, each output element is the dot product of a row and a column, giving `[n, m]`.
- **bmm:** batched matrix multiplication of two 3-D tensors, one product per batch item.
- **Reduction:** an operation that combines elements into fewer, like `sum`, `mean` or `max`.
- **dim argument:** the dimension a reduction combines over; it disappears from the result.
- **keepdim:** keeps the reduced dimension with size 1, so the result broadcasts against the input.
- **argmax:** the index of the largest value, overall or along a dim.
- **Softmax:** turns a vector of scores into positive probabilities that sum to 1.
- **In-place operation:** an operation that overwrites a tensor's own memory, marked by a trailing underscore (`add_`).
mistakes:
- Using `*` when you mean matrix multiplication (`@`).
- Reducing along the wrong dim; ask which dimension should disappear.
- Dropping `keepdim=True` and then broadcasting the result against the wrong axis.
- Multiplying matrices with different dtypes (int64 @ float32 raises an error).
- Calling `.mean()` on an integer tensor; convert with `.float()` first.
- Calling `argmax()` without a dim on a batch and getting a flattened index.

glance:
- Element-wise | `a + b`, `a * b`, `torch.exp(a)`, `a.clamp(0, 1)` | same shape as the inputs | `*` isn't matrix multiplication
- Broadcasting | shapes compared from the right | combine different shapes | each pair equal or 1
- Matrix product | `a @ b`, `torch.matmul` | `[n, k] @ [k, m] → [n, m]` | inner sizes and dtypes must match
- Batched product | `torch.bmm(a, b)` or `a @ b` | `[b, n, k] @ [b, k, m] → [b, n, m]` | `@` also broadcasts batch dims
- Reduce | `x.sum(dim=0)`, `x.mean(dim=1, keepdim=True)` | fewer dimensions | the dim you pass disappears
- Predicted classes | `logits.argmax(dim=1)` | one index per sample | no dim gives a flattened index
- Max with positions | `values, idx = x.max(dim=1)` | a named tuple | `x.max()` with no dim gives one value
- In place | `x.add_(1)`, `x += 1`, `x.zero_()` | changes x | can break autograd (Part 2)

@@ devices
topics: why GPUs speed up deep learning, cpu, cuda and mps devices and device indexes, torch.cuda.is_available and friends, torch.accelerator, .to(device), .cuda() and .cpu(), creating tensors on a device, the same-device rule and its error, 0-D tensors as scalars, .numpy() needing the CPU, detach().cpu().numpy(), device-agnostic code, CUDA out of memory, memory_allocated and the caching allocator, pinned memory and non_blocking copies, asynchronous execution and synchronize
terms:
- **GPU:** a processor with thousands of cores that do the same arithmetic on many numbers at once.
- **CUDA:** NVIDIA's platform for running computations on its GPUs; PyTorch's `cuda` device type.
- **MPS:** Metal Performance Shaders, the `mps` device type for Apple silicon GPUs.
- **torch.accelerator:** a device-agnostic API for whatever accelerator (CUDA, MPS, XPU…) the machine has.
- **.to(device):** returns a copy of a tensor on another device (and/or with another dtype).
- **Device-agnostic code:** code that chooses the device once and runs unchanged on a CPU or a GPU.
- **Pinned memory:** page-locked CPU memory that the GPU can copy from directly, which speeds up transfers.
- **Asynchronous execution:** GPU work is queued and runs in the background while Python continues.
- **Caching allocator:** PyTorch's GPU memory manager, which keeps freed memory reserved for reuse.
mistakes:
- Writing `x.to(device)` without `x = …`; for tensors, `.to()` returns a new tensor.
- Mixing CPU and GPU tensors in one operation.
- Calling `.numpy()` on a GPU tensor or a tensor that requires grad.
- Hard-coding `"cuda"`, so the code crashes on machines without a GPU.
- Creating tensors on the CPU and copying them to the GPU inside a loop instead of creating them on the device.
- Timing GPU code without `torch.cuda.synchronize()`.

glance:
- Check hardware | `torch.cuda.is_available()`, `torch.backends.mps.is_available()` | True or False | real CPU-only builds raise "Torch not compiled with CUDA enabled"
- Pick a device | `torch.accelerator.current_accelerator().type if torch.accelerator.is_available() else "cpu"` | a device string | choose once, use everywhere
- Move | `x = x.to(device)`, `.cuda()`, `.cpu()` | a copy on the device | not in place for tensors
- Create on device | `torch.zeros(n, device=device)` | no CPU copy | `*_like` keeps the device
- Same-device rule | every operand on one device | otherwise a RuntimeError | 0-D CPU tensors are the exception
- To NumPy | `t.detach().cpu().numpy()` | a NumPy array | `.item()` copies back by itself
- GPU memory | `torch.cuda.memory_allocated()` | bytes in use | blocks of 512 bytes; OOM raises `torch.OutOfMemoryError`
- Fast transfers | `pin_memory()`, `non_blocking=True` | overlapping copies | move data once, keep it there
