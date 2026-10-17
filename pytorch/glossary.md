# PyTorch glossary

Every term used in the course, A to Z. The number in brackets is the lesson where it's introduced.

| Term | Meaning |
|---|---|
| **Accuracy** | The fraction of samples whose predicted class matches the label. [12] |
| **Activation function** | A non-linear function between layers, such as ReLU, that lets networks model curved relationships. [10] |
| **Adam** | An optimizer with a per-parameter step size from running averages of the gradient and its square. [11] |
| **Advanced indexing** | Indexing with a list or tensor of positions, or a mask; it returns a copy. [4] |
| **allclose** | Checks that two tensors are equal within a tolerance. [3] |
| **arange** | Evenly spaced values from start up to but not including end, by a step. [2] |
| **argmax** | The index of the largest value, overall or along a dim. [6] |
| **Asynchronous execution** | GPU work is queued and runs in the background while Python continues. [7] |
| **Autograd** | PyTorch's automatic differentiation engine, which records operations and computes gradients with the chain rule. [8] |
| **backward()** | Computes the gradients of a scalar with respect to every leaf that requires grad, adding them to `.grad`. [8] |
| **Batch normalisation** | Normalising activations with batch statistics in training and running averages in evaluation. [12] |
| **BCEWithLogitsLoss** | Sigmoid plus binary cross-entropy in one stable step, for yes/no and multi-label targets. [11] |
| **bfloat16** | 16-bit "brain" floating point with float32's 8 exponent bits: float32's range, less precision. [3] |
| **bmm** | Batched matrix multiplication of two 3-D tensors, one product per batch item. [6] |
| **Boolean mask** | A bool tensor, usually from a comparison, that selects the elements where it's True. [4] |
| **Broadcasting** | Stretching size-1 or missing dimensions so tensors of different shapes can be combined, without copying. [6] |
| **Buffer** | A tensor registered with a module that is saved and moved with it but not trained, such as BatchNorm's running mean. [13] |
| **Caching allocator** | PyTorch's GPU memory manager, which keeps freed memory reserved for reuse. [7] |
| **cat** | Joins tensors along an existing dimension. [5] |
| **Checkpoint** | A saved dict with everything needed to resume training: model and optimizer state, epoch, loss. [13] |
| **clone** | Returns a copy of a tensor with its own memory. [4] |
| **Computation graph** | The record of operations that produced a result, built during the forward pass. [8] |
| **Contiguous** | A tensor whose elements lie in memory in row-by-row reading order. [5] |
| **CrossEntropyLoss** | Log_softmax plus negative log-likelihood; takes logits and class indices. [11] |
| **CUDA** | NVIDIA's platform for running computations on its GPUs; PyTorch's `cuda` device type. [7] |
| **Default dtype** | The floating-point type PyTorch uses when you don't choose one: float32 (`torch.get_default_dtype()`). [3] |
| **detach()** | Returns a tensor that shares data but is cut off from the computation graph. [8] |
| **Device** | Where a tensor's data lives: `cpu`, `cuda` (an NVIDIA GPU) or `mps` (an Apple GPU). [1] |
| **Device-agnostic code** | Code that chooses the device once and runs unchanged on a CPU or a GPU. [7] |
| **dim argument** | The dimension a reduction combines over; it disappears from the result. [6] |
| **Divergence** | The loss growing (often to inf or nan) because the steps overshoot, usually from too high a learning rate. [9] |
| **Dropout** | Randomly zeroing activations during training to reduce overfitting. [12] |
| **dtype** | The data type shared by every element of a tensor, such as `torch.float32` or `torch.int64`. [1] |
| **Early stopping** | Keeping the weights from the epoch with the best validation score. [12] |
| **Element-wise operation** | An operation applied to each element (or each pair of matching elements) separately. [6] |
| **Epoch** | One complete pass through the training data. [9] |
| **Exponent and mantissa** | The parts of a floating-point number that set its range and its precision. [3] |
| **finfo / iinfo** | Objects describing a float or integer dtype's limits, such as `max` and `eps`. [3] |
| **flatten** | Merges a range of dimensions into one. [5] |
| **float16 (torch.half)** | 16-bit floating point with 5 exponent bits: precise but a small range (max 65504). [3] |
| **float32 (torch.float)** | 32-bit floating point, the standard type for model weights. [3] |
| **forward()** | The method that defines a module's computation; run it by calling the module. [10] |
| **from_numpy** | Creates a tensor that shares memory with a NumPy array. [2] |
| **Generalisation** | How well a model performs on data it wasn't trained on. [12] |
| **Generator** | An independent random number generator object, passed with `generator=`. [2] |
| **GPU** | A processor with thousands of cores that do the same arithmetic on many numbers at once. [7] |
| **grad_fn** | The graph node on a computed tensor that knows how to pass gradients back to its inputs. [8] |
| **Gradient** | How much a scalar (the loss) changes when each input changes slightly; it points in the direction of steepest increase. [8] |
| **Gradient accumulation** | `backward()` adds to existing `.grad` values instead of replacing them. [8] |
| **Gradient descent** | Repeatedly moving each weight a small step against its gradient to reduce the loss. [9] |
| **Indexing** | Selecting elements with one index or slice per dimension, like `x[1, :3]`. [4] |
| **Inference** | Using a trained model to make predictions. [13] |
| **In-place operation** | An operation that overwrites a tensor's own memory, marked by a trailing underscore (`add_`). [6] |
| **int64 (torch.long)** | 64-bit integers, PyTorch's default for whole numbers, class labels and indexes. [3] |
| **Kaiming (He) initialisation** | Random starting weights scaled by the number of inputs so activations keep a stable size. [10] |
| **keepdim** | Keeps the reduced dimension with size 1, so the result broadcasts against the input. [6] |
| **Leaf tensor** | A tensor created directly (not by a recorded operation); only leaves keep `.grad` by default. [8] |
| **Learning rate** | The step size of each gradient-descent update. [9] |
| **_like functions** | `zeros_like`, `ones_like`, `full_like`, `rand_like` and others create a tensor with another tensor's shape, dtype and device. [2] |
| **linspace** | A fixed number of evenly spaced values from start to end, both included. [2] |
| **load_state_dict** | Copies a state_dict's tensors into a module's parameters and buffers, checking names and shapes. [13] |
| **Logits** | A model's raw, unnormalised output scores. [10] |
| **Loss function** | A function of predictions and targets that measures error as one number to minimise. [11] |
| **map_location** | A torch.load argument that remaps saved tensors to another device, such as the CPU. [13] |
| **Matrix multiplication (@)** | For `[n, k] @ [k, m]`, each output element is the dot product of a row and a column, giving `[n, m]`. [6] |
| **Mean squared error (MSE)** | The average of the squared differences between predictions and targets. [9] |
| **Mini-batch** | A small random subset of the training data used for one step. [9] |
| **model.train() / model.eval()** | Switch layers such as dropout and batch norm between training and evaluation behaviour. [12] |
| **Momentum** | A running average of past gradients used as the update direction, which smooths noisy steps. [11] |
| **MPS** | Metal Performance Shaders, the `mps` device type for Apple silicon GPUs. [7] |
| **Multi-label classification** | Each sample can have several labels at once, each an independent yes/no. [11] |
| **NCHW** | PyTorch's layout for image batches: batch, channels, height, width. [1] |
| **Negative log-likelihood** | −log of the probability the model gave the correct class. [11] |
| **nn.Linear** | A fully connected layer computing x Wᵀ + b, with weight shape [out_features, in_features]. [10] |
| **nn.Module** | The base class for layers and models; it registers sub-modules and parameters assigned as attributes. [10] |
| **nn.ModuleList** | A list of modules that registers them, unlike a plain Python list. [10] |
| **nn.Parameter** | A tensor registered as a learnable weight of a module (requires grad by default). [10] |
| **nn.Sequential** | A container that runs its modules in order. [10] |
| **numpy()** | Returns a NumPy array that shares memory with a CPU tensor. [4] |
| **Optimizer** | An object that updates parameters from their gradients (`step()`) and clears gradients (`zero_grad()`). [11] |
| **Overfitting** | Fitting the training data so closely that performance on new data gets worse. [12] |
| **Overflow** | A value too large for its dtype, becoming `inf` for floats or wrapping around for integers. [3] |
| **permute** | Reorders all dimensions; `transpose` swaps two. [5] |
| **Pinned memory** | Page-locked CPU memory that the GPU can copy from directly, which speeds up transfers. [7] |
| **PTCA** | The PyTorch Certified Associate exam from the PyTorch Foundation and the Linux Foundation (2026). [1] |
| **PyTorch** | An open-source Python library for building and training neural networks, built on tensors and automatic differentiation. [1] |
| **randint** | Random integers from low up to but not including high. [2] |
| **rand / randn** | Random floats, uniform in [0, 1) or from the standard normal distribution. [2] |
| **Rank (number of dimensions)** | How many dimensions a tensor has: 0 for a scalar, 1 for a vector, 2 for a matrix (`.ndim`). [1] |
| **Reduction** | An operation that combines elements into fewer, like `sum`, `mean` or `max`. [6, 11] |
| **requires_grad** | A tensor flag that tells autograd to record operations on the tensor and compute its gradient. [8] |
| **reshape** | Returns a tensor with the same elements in a new shape, as a view when possible and a copy otherwise. [5] |
| **Scalar tensor** | A 0-dimensional tensor holding one value, such as the result of `.sum()`. [1] |
| **Seed** | The starting value of a random number generator; the same seed gives the same sequence. [2] |
| **Shape** | The number of elements along each dimension of a tensor, returned as a `torch.Size` (a tuple). [1] |
| **Softmax** | Turns a vector of scores into positive probabilities that sum to 1. [6] |
| **stack** | Joins same-shaped tensors along a new dimension. [5] |
| **state_dict** | An ordered dict mapping parameter and buffer names to tensors (or, for optimizers, their state and settings). [13] |
| **Step (iteration)** | One update of the weights. [9] |
| **Stochastic gradient descent (SGD)** | Gradient descent where each step uses a mini-batch instead of all the data. [9] |
| **Stride** | How many elements to skip in memory to move one step along each dimension. [5] |
| **Tensor** | A multi-dimensional array of numbers of one dtype, which can live on a CPU or a GPU and can be tracked by autograd. [1] |
| **Test set** | Data used once at the end for an unbiased final score. [12] |
| **.to(device)** | Returns a copy of a tensor on another device (and/or with another dtype). [7] |
| **tolist** | Converts a tensor to (nested) Python lists. [4] |
| **torch.accelerator** | A device-agnostic API for whatever accelerator (CUDA, MPS, XPU…) the machine has. [7] |
| **torch.empty** | Allocates a tensor without initialising its values. [2] |
| **torch.inference_mode()** | A faster no_grad for inference whose tensors can't be used in autograd later. [8] |
| **torch.manual_seed** | Sets the seed of PyTorch's default random number generators (CPU and GPU). [2] |
| **torch.nn.functional (F)** | The same operations as layers, as plain functions without stored weights. [10] |
| **torch.no_grad()** | A context in which operations aren't recorded. [8] |
| **torch.save / torch.load** | Write and read pickled objects of tensors and containers to files. [13] |
| **torch.tensor** | Creates a tensor by copying Python data or an array, inferring the dtype unless you pass `dtype=`. [2] |
| **torch.where** | Chooses, element by element, from one tensor where a condition is True and another where it's False. [4] |
| **Training set** | The data the optimizer learns from. [12] |
| **Type promotion** | The rules PyTorch uses to choose the dtype of a result from inputs of different dtypes. [3] |
| **Underfitting** | A model too simple, or trained too little, to fit even the training data. [12] |
| **unsqueeze / squeeze** | Add a dimension of size 1 / remove dimensions of size 1. [5] |
| **Validation set** | Held-out data for measuring generalisation and choosing settings during development. [12] |
| **View** | A tensor that shares memory with another tensor but may have a different shape or strides. [4, 5] |
| **Weight decay** | Shrinking weights slightly every step to reduce overfitting; decoupled from the gradient in AdamW. [11] |
| **weights_only** | A torch.load option (True by default since PyTorch 2.6) that only unpickles tensors and plain containers, for safety. [13] |
