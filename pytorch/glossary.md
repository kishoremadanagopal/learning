# PyTorch glossary

Every term used in the course, A to Z. The number in brackets is the lesson where it's introduced.

| Term | Meaning |
|---|---|
| **Advanced indexing** | Indexing with a list or tensor of positions, or a mask; it returns a copy. [4] |
| **allclose** | Checks that two tensors are equal within a tolerance. [3] |
| **arange** | Evenly spaced values from start up to but not including end, by a step. [2] |
| **argmax** | The index of the largest value, overall or along a dim. [6] |
| **Asynchronous execution** | GPU work is queued and runs in the background while Python continues. [7] |
| **bfloat16** | 16-bit "brain" floating point with float32's 8 exponent bits: float32's range, less precision. [3] |
| **bmm** | Batched matrix multiplication of two 3-D tensors, one product per batch item. [6] |
| **Boolean mask** | A bool tensor, usually from a comparison, that selects the elements where it's True. [4] |
| **Broadcasting** | Stretching size-1 or missing dimensions so tensors of different shapes can be combined, without copying. [6] |
| **Caching allocator** | PyTorch's GPU memory manager, which keeps freed memory reserved for reuse. [7] |
| **cat** | Joins tensors along an existing dimension. [5] |
| **clone** | Returns a copy of a tensor with its own memory. [4] |
| **Contiguous** | A tensor whose elements lie in memory in row-by-row reading order. [5] |
| **CUDA** | NVIDIA's platform for running computations on its GPUs; PyTorch's `cuda` device type. [7] |
| **Default dtype** | The floating-point type PyTorch uses when you don't choose one: float32 (`torch.get_default_dtype()`). [3] |
| **Device** | Where a tensor's data lives: `cpu`, `cuda` (an NVIDIA GPU) or `mps` (an Apple GPU). [1] |
| **Device-agnostic code** | Code that chooses the device once and runs unchanged on a CPU or a GPU. [7] |
| **dim argument** | The dimension a reduction combines over; it disappears from the result. [6] |
| **dtype** | The data type shared by every element of a tensor, such as `torch.float32` or `torch.int64`. [1] |
| **Element-wise operation** | An operation applied to each element (or each pair of matching elements) separately. [6] |
| **Exponent and mantissa** | The parts of a floating-point number that set its range and its precision. [3] |
| **finfo / iinfo** | Objects describing a float or integer dtype's limits, such as `max` and `eps`. [3] |
| **flatten** | Merges a range of dimensions into one. [5] |
| **float16 (torch.half)** | 16-bit floating point with 5 exponent bits: precise but a small range (max 65504). [3] |
| **float32 (torch.float)** | 32-bit floating point, the standard type for model weights. [3] |
| **from_numpy** | Creates a tensor that shares memory with a NumPy array. [2] |
| **Generator** | An independent random number generator object, passed with `generator=`. [2] |
| **GPU** | A processor with thousands of cores that do the same arithmetic on many numbers at once. [7] |
| **Indexing** | Selecting elements with one index or slice per dimension, like `x[1, :3]`. [4] |
| **In-place operation** | An operation that overwrites a tensor's own memory, marked by a trailing underscore (`add_`). [6] |
| **int64 (torch.long)** | 64-bit integers, PyTorch's default for whole numbers, class labels and indexes. [3] |
| **keepdim** | Keeps the reduced dimension with size 1, so the result broadcasts against the input. [6] |
| **_like functions** | `zeros_like`, `ones_like`, `full_like`, `rand_like` and others create a tensor with another tensor's shape, dtype and device. [2] |
| **linspace** | A fixed number of evenly spaced values from start to end, both included. [2] |
| **Matrix multiplication (@)** | For `[n, k] @ [k, m]`, each output element is the dot product of a row and a column, giving `[n, m]`. [6] |
| **MPS** | Metal Performance Shaders, the `mps` device type for Apple silicon GPUs. [7] |
| **NCHW** | PyTorch's layout for image batches: batch, channels, height, width. [1] |
| **numpy()** | Returns a NumPy array that shares memory with a CPU tensor. [4] |
| **Overflow** | A value too large for its dtype, becoming `inf` for floats or wrapping around for integers. [3] |
| **permute** | Reorders all dimensions; `transpose` swaps two. [5] |
| **Pinned memory** | Page-locked CPU memory that the GPU can copy from directly, which speeds up transfers. [7] |
| **PTCA** | The PyTorch Certified Associate exam from the PyTorch Foundation and the Linux Foundation (2026). [1] |
| **PyTorch** | An open-source Python library for building and training neural networks, built on tensors and automatic differentiation. [1] |
| **randint** | Random integers from low up to but not including high. [2] |
| **rand / randn** | Random floats, uniform in [0, 1) or from the standard normal distribution. [2] |
| **Rank (number of dimensions)** | How many dimensions a tensor has: 0 for a scalar, 1 for a vector, 2 for a matrix (`.ndim`). [1] |
| **Reduction** | An operation that combines elements into fewer, like `sum`, `mean` or `max`. [6] |
| **reshape** | Returns a tensor with the same elements in a new shape, as a view when possible and a copy otherwise. [5] |
| **Scalar tensor** | A 0-dimensional tensor holding one value, such as the result of `.sum()`. [1] |
| **Seed** | The starting value of a random number generator; the same seed gives the same sequence. [2] |
| **Shape** | The number of elements along each dimension of a tensor, returned as a `torch.Size` (a tuple). [1] |
| **Softmax** | Turns a vector of scores into positive probabilities that sum to 1. [6] |
| **stack** | Joins same-shaped tensors along a new dimension. [5] |
| **Stride** | How many elements to skip in memory to move one step along each dimension. [5] |
| **Tensor** | A multi-dimensional array of numbers of one dtype, which can live on a CPU or a GPU and can be tracked by autograd. [1] |
| **.to(device)** | Returns a copy of a tensor on another device (and/or with another dtype). [7] |
| **tolist** | Converts a tensor to (nested) Python lists. [4] |
| **torch.accelerator** | A device-agnostic API for whatever accelerator (CUDA, MPS, XPU…) the machine has. [7] |
| **torch.empty** | Allocates a tensor without initialising its values. [2] |
| **torch.manual_seed** | Sets the seed of PyTorch's default random number generators (CPU and GPU). [2] |
| **torch.tensor** | Creates a tensor by copying Python data or an array, inferring the dtype unless you pass `dtype=`. [2] |
| **torch.where** | Chooses, element by element, from one tensor where a condition is True and another where it's False. [4] |
| **Type promotion** | The rules PyTorch uses to choose the dtype of a result from inputs of different dtypes. [3] |
| **unsqueeze / squeeze** | Add a dimension of size 1 / remove dimensions of size 1. [5] |
| **View** | A tensor that shares memory with another tensor but may have a different shape or strides. [4, 5] |
