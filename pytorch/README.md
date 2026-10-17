# PyTorch: from tensors to the PyTorch Certified Associate exam

A beginner-first PyTorch course that follows the official exam outline of the **PyTorch Certified Associate (PTCA)**, launched by the PyTorch Foundation and the Linux Foundation in June 2026: 27 lessons so far on tensors, devices, autograd, data loading, building and training models, and making them fast.

PyTorch is the framework most AI research and production models are written in. Knowing it well is core for the **AI engineer** path, and a big plus for **data / AI analysts** who move into machine learning.

## ▶ [Open the practice sandbox](https://kishoremadanagopal.github.io/learning/pytorch/)

The sandbox runs Python 3.14 in your browser (via [Pyodide](https://pyodide.org)) with the course's own copy of PyTorch: a teaching version written in Python on NumPy that follows PyTorch 2.14's names, printing, rules, random numbers and error messages for everything the course uses. It even has a pretend NVIDIA GPU, so you can practise `.to('cuda')`. Nothing to install and no sign-up. Run the same code with real PyTorch on your own computer (`pip install torch`) and it behaves the same way, just faster.

- every lesson, with **159 examples** you can run and change
- **54 exercises** with hidden tests, each with an approach, hints and a walkthrough
- **150 exam-style quiz questions**, with explanations
- diagrams for the key ideas
- practice data files (from Part 3) that reset before every run
- your progress and code saved in your own browser

**Before you start:** you should be comfortable with Python basics (lists, loops, functions, classes). If not, do [Learn Python from scratch](../python/) first. Some NumPy helps: [Python for Data](../python-data/) covers it, but each lesson explains what it uses.

## About the PTCA exam

| | |
|---|---|
| Format | online, proctored, multiple choice, 120 minutes |
| Price | US$250 for the exam (US$299 with the official training pathway); one free retake |
| Valid | 2 years; no prerequisites |
| Domains | PyTorch fundamentals 38% · performance and optimization 26% · model development 20% · data handling 16% |

Check the latest details on the [Linux Foundation's PTCA page](https://training.linuxfoundation.org/certification/pytorch-certified-associate-ptca/) before you book: prices and outlines can change.

## Course materials

| | |
|---|---|
| 📘 [Lessons](#lessons) | 27 lessons, each with key terms, examples, common mistakes, exercises, walkthroughs and an exam-style quiz |
| 📖 [Glossary](glossary.md) | every PyTorch term used in the course, defined in plain English |
| 🧾 [Cheat sheet](cheatsheet.md) | the API you need for the exam on a few pages, and every concept at a glance |

## How to use this course

1. Read a lesson, here on GitHub or in the sandbox. Start with its **Key terms**.
2. Run the examples in the sandbox and change them: predict the output (shape, dtype, device) before you press Run.
3. Try each exercise before opening help; press **Check** to run the hidden tests.
4. Stuck? Open **How to approach it**, then the hints one at a time, and the **walkthrough** only after a real attempt.
5. Do the quiz at the end of each lesson: its questions are written like the exam's.

## Lessons

### Part 1: Tensors and Devices (Beginner)

| # | Lesson | Topics | Sandbox |
|---|---|---|---|
| 1 | [PyTorch, tensors and the exam](lessons/01-pytorch-and-tensors.md) | what PyTorch is (tensors, autograd, building blocks), your first tensor, shape, dtype and device, rank and dimensions, the NCHW image layout, tensors versus lists and NumPy arrays, .item(), how the sandbox's PyTorch works, the PTCA exam's format and domains | 1–2 |
| 2 | [Creating tensors](lessons/02-creating-tensors.md) | torch.tensor and dtype inference, ragged lists, torch.Tensor versus torch.tensor, zeros, ones, full, eye, empty, arange and linspace, the *_like functions, rand, randn, randint and randperm, torch.manual_seed, torch.Generator, reproducibility, from_numpy versus torch.tensor | 3–4 |
| 3 | [Data types and precision](lessons/03-dtypes.md) | the common dtypes and their aliases, bytes per element, the default dtype, when printing shows dtype=, converting with .to and shortcut methods, truncation versus rounding, type promotion categories, Python scalars and 0-D tensors in promotion, true division, in-place dtype errors, float32 versus float16 versus bfloat16 (range and precision), finfo and iinfo, comparing floats | 5–6 |
| 4 | [Indexing, slicing and views](lessons/04-indexing-and-views.md) | integer and slice indexing per dimension, negative indexes, ... and None, how indexing changes the shape, boolean masks, combining conditions with & \| ~, index lists and tensors, writing through indexes, torch.where, views versus copies, clone, item, tolist, numpy() sharing memory, the ambiguous truth value error | 7–8 |
| 5 | [Reshaping, joining and splitting](lessons/05-reshaping.md) | view and reshape with -1, strides and contiguous tensors, why view fails after transpose, contiguous(), unsqueeze and squeeze, permute and transpose, .T and .mT, flatten, cat versus stack, split, chunk and unbind | 9–10 |
| 6 | [Tensor maths and broadcasting](lessons/06-tensor-math.md) | element-wise arithmetic and functions, clamp, relu and sigmoid, broadcasting rules, broadcasting with keepdim, matrix multiplication with @, matmul, mm, mv, bmm and batched matmul, matching dtypes, reductions with dim and keepdim, max with indices, argmax for predictions, mean on integers, std's correction, softmax along a dim, in-place operations | 11–12 |
| 7 | [CPUs, GPUs and devices](lessons/07-devices.md) | why GPUs speed up deep learning, cpu, cuda and mps devices and device indexes, torch.cuda.is_available and friends, torch.accelerator, .to(device), .cuda() and .cpu(), creating tensors on a device, the same-device rule and its error, 0-D tensors as scalars, .numpy() needing the CPU, detach().cpu().numpy(), device-agnostic code, CUDA out of memory, memory_allocated and the caching allocator, pinned memory and non_blocking copies, asynchronous execution and synchronize | 13–14 |

### Part 2: Autograd and the Model Lifecycle (Beginner)

| # | Lesson | Topics | Sandbox |
|---|---|---|---|
| 8 | [Autograd: gradients for free](lessons/08-autograd.md) | gradients and why training needs them, requires_grad, backward() and .grad, the computation graph, grad_fn and next_functions, leaf tensors and retain_grad, gradients accumulating and zeroing them, backward on non-scalars, the graph freed after backward and retain_graph, detach, torch.no_grad, torch.inference_mode, freezing with requires_grad_(False), torch.autograd.grad | 15–16 |
| 9 | [Gradient descent by hand](lessons/09-gradient-descent.md) | the gradient descent update rule, fitting a line with tensors and autograd, updating weights inside torch.no_grad, in-place updates versus reassignment, zeroing gradients, the learning rate (too small, good, diverging), the loss curve, full-batch versus mini-batch (stochastic) gradient descent, epochs | 17–18 |
| 10 | [Building models with nn.Module](lessons/10-nn-module.md) | nn.Linear and y = xWᵀ + b, weight and bias shapes, default Kaiming-uniform initialisation, nn.Parameter, activation functions (ReLU, LeakyReLU, GELU, SiLU, Sigmoid, Tanh, Softmax) and torch.nn.functional, nn.Sequential, subclassing nn.Module with __init__ and forward, super().__init__(), calling the model, parameters and named_parameters, counting parameters, nn.ModuleList, moving a model with .to(device) | 19–20 |
| 11 | [Losses and optimizers](lessons/11-losses-and-optimizers.md) | MSELoss, L1Loss and HuberLoss for regression, reduction, shape mismatches that broadcast, CrossEntropyLoss with logits and int64 class indices, NLLLoss and log_softmax, class weights, ignore_index and label smoothing, BCEWithLogitsLoss for binary and multi-label targets, BCELoss, torch.optim, SGD with momentum, Adam, AdamW and decoupled weight decay, zero_grad, the five-line training step | 21–22 |
| 12 | [The training and evaluation loop](lessons/12-training-loop.md) | training, validation and test sets, generalisation and overfitting, epochs and shuffled mini-batches, a complete classification training loop, model.train() and model.eval(), dropout and batch norm in each mode, evaluating under torch.no_grad, accuracy from argmax, reading training and validation curves, underfitting, early stopping and keeping the best weights with deepcopy, training on a GPU | 23–24 |
| 13 | [Saving, loading and using a model](lessons/13-saving-and-loading.md) | model and optimizer state_dicts, buffers in state_dicts, torch.save and torch.load, saving the state_dict versus the whole model, weights_only=True by default since PyTorch 2.6 and why, load_state_dict and strict, missing, unexpected and size-mismatched keys, checkpoints for resuming training, map_location, making predictions with eval, inference_mode, a batch dimension, softmax and argmax | 25–26 |

### Part 3: Data Handling (Intermediate)

| # | Lesson | Topics | Sandbox |
|---|---|---|---|
| 14 | [Datasets](lessons/14-datasets.md) | the Dataset and DataLoader split of responsibilities, the map-style Dataset protocol (__len__ and __getitem__), TensorDataset, a custom Dataset reading a CSV file, float32 features and int64 labels, eager versus lazy loading, torchvision's ready-made datasets, Subset, ConcatDataset, random_split with lengths or fractions and a seeded Generator | 27–28 |
| 15 | [DataLoader: batching and shuffling](lessons/15-dataloaders.md) | iterating a DataLoader, batch_size and the last smaller batch, drop_last, len(loader), shuffle=True and a new order every epoch, generator for reproducible shuffling, how iterating draws a base seed, default_collate's rules, Python floats becoming float64, custom collate_fn with pad_sequence, batch_size=None, a full training loop with training and validation loaders, moving batches to the device | 29–30 |
| 16 | [Samplers, workers and fast loading](lessons/16-samplers-and-workers.md) | samplers and the order of indexes, SequentialSampler, RandomSampler with and without replacement, SubsetRandomSampler, BatchSampler, sampler and shuffle being mutually exclusive, WeightedRandomSampler for imbalanced classes, num_workers and parallel loading, worker processes with their own dataset copies and seeds, get_worker_info and worker_init_fn, IterableDataset and sharding a stream across workers, pin_memory with non_blocking copies, persistent_workers and prefetch_factor | 31–32 |
| 17 | [Transforms and augmentation](lessons/17-transforms.md) | what a transform is, torchvision.transforms.v2, tv_tensors.Image, ToImage, ToDtype with scale=True, Normalize with per-channel mean and std, Compose, the deprecated ToTensor, ImageNet normalisation statistics, computing statistics over the training set, data augmentation with RandomHorizontalFlip and RandomCrop, separate training and evaluation pipelines, transform and target_transform in a Dataset, transforms passing labels through | 33–34 |
| 18 | [Data quality and leakage](lessons/18-data-quality.md) | silent data bugs, inspecting raw CSV data, missing values, impossible values, inconsistent labels, wrong units, duplicates, NaN and inf in tensors with isnan, isfinite and nan_to_num, data leakage from statistics, duplicates, augmentation and test-set reuse, stratified splits, class imbalance and class-weighted cross-entropy, accuracy on imbalanced data, sanity checks on a batch, overfitting one batch, the expected starting loss | 35–36 |

### Part 4: Model Development (Intermediate)

| # | Lesson | Topics | Sandbox |
|---|---|---|---|
| 19 | [Convolutional networks](lessons/19-cnn-layers.md) | why images need convolutions, kernels and weight sharing, nn.Conv2d and its arguments (stride, padding, "same", dilation, groups, bias), the output-size formula, counting convolution parameters, channel-mismatch errors, MaxPool2d, AvgPool2d and AdaptiveAvgPool2d (global average pooling), BatchNorm2d and the Conv–BN–ReLU block, Conv1d, tracing shapes through a CNN, flattening into a linear layer, training a small CNN | 37–38 |
| 20 | [Recurrent layers and attention](lessons/20-sequence-layers.md) | sequence tensors and batch_first, nn.Embedding as a lookup table, recurrent layers (RNN, LSTM, GRU), hidden and cell states, output versus h_n and c_n, num_layers and bidirectional, classifying from the last hidden state, scaled dot-product attention, queries, keys and values, scaling by √d, causal and padding masks, nn.MultiheadAttention and its opposite boolean-mask convention, TransformerEncoderLayer and TransformerEncoder, positional embeddings, pre-norm | 39–40 |
| 21 | [Training deeper networks well](lessons/21-better-models.md) | vanishing and exploding gradients, ReLU, LeakyReLU, GELU and SiLU, sigmoid and tanh saturation, Kaiming and Xavier initialisation, nn.init and model.apply, why not to initialise all weights equally, BatchNorm versus LayerNorm, residual connections and skip paths, pre-norm residual blocks, regularisation with dropout, weight decay, augmentation and smaller models, early stopping with the best weights, gradient clipping | 41–42 |
| 22 | [Optimizers and learning-rate schedules](lessons/22-optimizers-and-schedules.md) | param_groups and optimizer state, SGD with momentum and Nesterov, RMSprop, Adam, AdamW and decoupled weight decay, per-group learning rates and weight decay, no decay on biases and norm weights, learning-rate schedulers (StepLR, MultiStepLR, ExponentialLR, CosineAnnealingLR, LinearLR, SequentialLR, OneCycleLR, ReduceLROnPlateau), the order of optimizer.step() and scheduler.step(), warm-up plus cosine decay, gradient accumulation, saving optimizer and scheduler state | 43–44 |
| 23 | [Transfer learning and modifying models](lessons/23-transfer-learning.md) | transfer learning, feature extraction versus fine-tuning, torchvision pretrained models and their weights' transforms, inspecting models with named_children, named_modules, named_parameters and get_submodule, freezing with requires_grad_(False), replacing the head, optimizing only trainable parameters, smaller learning rates for pretrained layers, frozen BatchNorm statistics, partial loading with strict=False and filtered state dicts, forward hooks and handles | 45–46 |

### Part 5: Performance and Optimization (Advanced)

| # | Lesson | Topics | Sandbox |
|---|---|---|---|
| 24 | [Measuring performance](lessons/24-measuring-performance.md) | measuring before optimising, time.perf_counter, warm-up runs and the median, asynchronous GPU execution and torch.cuda.synchronize, CUDA events, torch.utils.benchmark.Timer and blocked_autorange, torch.profiler.profile with activities, record_function, key_averages and the profiler table (Self CPU versus CPU total, number of calls), record_shapes, profile_memory, schedule and prof.step, trace export for Perfetto and TensorBoard, GPU memory statistics (memory_allocated, max_memory_allocated, memory_reserved, reset_peak_memory_stats, empty_cache), what uses memory during training, fixes for out-of-memory errors, telling data-loading bottlenecks from compute bottlenecks | 47–48 |
| 25 | [torch.compile and execution speed-ups](lessons/25-torch-compile.md) | eager execution and its overheads, torch.compile on models and functions, TorchDynamo and FX graphs, TorchInductor, Triton and C++ kernels, operator fusion, first-call compile time, OptimizedModule and _orig_mod, the _orig_mod. state-dict prefix, modes (default, reduce-overhead with CUDA graphs, max-autotune), fullgraph, backends, graph breaks and their causes (.item(), data-dependent control flow, unsupported code), finding breaks with TORCH_LOGS and torch._dynamo.explain, torch.compiler.disable, recompilation, dynamic shapes and mark_dynamic, inference_mode, TF32 and set_float32_matmul_precision, cudnn.benchmark, channels_last, torch.export | 49–50 |
| 26 | [Mixed precision training](lessons/26-mixed-precision.md) | why 16-bit is faster (tensor cores, memory bandwidth), float16 versus bfloat16 range and precision, torch.autocast for CUDA and CPU, the lower-precision and float32 operation lists, operations that follow their inputs, float64 left alone, float32 master weights, backward outside autocast, nested enabled=False, the deprecated torch.cuda.amp.autocast, gradient underflow and loss scaling, torch.amp.GradScaler (scale, step, update, unscale_, get_scale, state_dict), skipped steps and the adaptive scale, clipping after unscale_, bfloat16 without a scaler, binary_cross_entropy versus BCEWithLogitsLoss under autocast | 51–52 |
| 27 | [Distributed training](lessons/27-distributed-training.md) | why distribute training, data parallelism, all-reduce of gradients, why averaged shard gradients equal the full-batch gradient, effective batch size and learning-rate scaling, processes, world size, rank and local rank, NCCL and Gloo backends, torchrun and its environment variables, init_process_group and destroy_process_group, DistributedDataParallel and model.module, DistributedSampler (interleaving, padding, drop_last, shuffle, seed, set_epoch), rank-0 logging and saving, barrier, no_sync for gradient accumulation, Fully Sharded Data Parallel (FSDP2 fully_shard, MixedPrecisionPolicy, FSDP1), tensor and pipeline parallelism | 53–54 |

## Running it on your own computer

Install PyTorch with the command from [pytorch.org/get-started](https://pytorch.org/get-started/locally/) (for most computers: `pip install torch`). Every example runs unchanged; the outputs match, except where a lesson says a real GPU or a different random-number kernel changes them.

## Editing the course

Lessons are generated from the Markdown sources in [`course/`](course/). See [course/README.md](course/README.md).
