@@ measuring-performance
topics: measuring before optimising, time.perf_counter, warm-up runs and the median, asynchronous GPU execution and torch.cuda.synchronize, CUDA events, torch.utils.benchmark.Timer and blocked_autorange, torch.profiler.profile with activities, record_function, key_averages and the profiler table (Self CPU versus CPU total, number of calls), record_shapes, profile_memory, schedule and prof.step, trace export for Perfetto and TensorBoard, GPU memory statistics (memory_allocated, max_memory_allocated, memory_reserved, reset_peak_memory_stats, empty_cache), what uses memory during training, fixes for out-of-memory errors, telling data-loading bottlenecks from compute bottlenecks
terms:
- **Warm-up:** untimed first runs that absorb one-time costs such as memory allocation, algorithm selection and compilation.
- **Asynchronous execution:** the CPU queues GPU kernels and continues without waiting for them to finish.
- **Synchronisation:** waiting until the GPU has finished all queued work (`torch.cuda.synchronize()`, or implicitly via `.item()`, `.cpu()`, `print`).
- **Profiler:** a tool that records every operation run, how often, and how long it took (`torch.profiler.profile`).
- **Self time:** time spent in an operation itself, excluding the operations it called.
- **Trace:** a timeline file of recorded events, viewable in Perfetto or TensorBoard.
- **Caching allocator:** PyTorch's GPU memory manager, which keeps freed blocks reserved for reuse.
- **Peak memory:** the highest memory use during a period (`max_memory_allocated`), which decides whether a batch fits.
- **Activation checkpointing:** recomputing activations during backward instead of storing them, trading compute for memory.
- **Bottleneck:** the slowest part of the pipeline, which limits overall speed.
mistakes:
- Timing GPU code without synchronising, which measures only the kernel launch.
- Including the first (warm-up or compile) call in timings.
- Reporting a single run instead of the median of several.
- Calling `.item()` or printing tensors every step, which forces a synchronisation each time.
- Reading memory_reserved as memory used by tensors.
- Expecting `empty_cache()` to free tensors that are still referenced.
- Optimising the model when the GPU is actually waiting for data.

glance:
- Time CPU code | `time.perf_counter()` around the call | seconds | warm up, repeat, take the median
- Time GPU code | `torch.cuda.synchronize()` before both clock reads | the real duration | or CUDA events / `benchmark.Timer`
- Benchmark | `benchmark.Timer(stmt, globals=...).blocked_autorange()` | `Measurement` (median, iqr) | handles warm-up and sync
- Profile | `with profile(activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA]) as prof:` | recorded events | `record_function("name")` labels regions
- Summarise | `prof.key_averages().table(sort_by="cpu_time_total", row_limit=10)` | per-operation table | Self excludes children; Total includes them
- Long runs | `schedule(wait, warmup, active)` + `prof.step()` | a few profiled steps | `tensorboard_trace_handler` / `export_chrome_trace`
- Memory | `torch.cuda.max_memory_allocated()` | peak bytes | reset with `reset_peak_memory_stats()`
- Out of memory | smaller batch + accumulation, AMP, checkpointing, FSDP | fits | activations grow with batch size

@@ torch-compile
topics: eager execution and its overheads, torch.compile on models and functions, TorchDynamo and FX graphs, TorchInductor, Triton and C++ kernels, operator fusion, first-call compile time, OptimizedModule and _orig_mod, the _orig_mod. state-dict prefix, modes (default, reduce-overhead with CUDA graphs, max-autotune), fullgraph, backends, graph breaks and their causes (.item(), data-dependent control flow, unsupported code), finding breaks with TORCH_LOGS and torch._dynamo.explain, torch.compiler.disable, recompilation, dynamic shapes and mark_dynamic, inference_mode, TF32 and set_float32_matmul_precision, cudnn.benchmark, channels_last, torch.export
terms:
- **Eager mode:** PyTorch's default: each operation runs as soon as Python reaches it.
- **torch.compile:** turns a model or function into optimised code, captured on first call and reused afterwards.
- **TorchDynamo:** the part of torch.compile that captures tensor operations from running Python code into graphs.
- **TorchInductor:** the default compiler backend, which fuses operations and generates Triton (GPU) or C++ (CPU) kernels.
- **Kernel fusion:** combining several operations into one kernel, so intermediate results don't travel through memory.
- **Graph break:** a point where Dynamo can't capture code, so it splits the graph and runs that code in plain Python.
- **Recompilation:** compiling again because inputs no longer match what a graph was specialised for (shapes, dtypes).
- **CUDA graph:** a recorded sequence of GPU kernels replayed with one launch, used by `mode="reduce-overhead"`.
- **TF32:** a tensor-core format that speeds up float32 matmuls with slightly less precision.
mistakes:
- Including the compile time of the first call in benchmarks.
- Saving `compiled.state_dict()` and then failing to load it into a plain model (the `_orig_mod.` prefix).
- Using `.item()`, `print` or `if tensor:` inside compiled code, causing graph breaks.
- Feeding many different input shapes, triggering repeated recompiles.
- Passing both `mode` and `options` (an error).
- Expecting `"reduce-overhead"` to save memory (CUDA graphs use more).

glance:
- Compile | `model = torch.compile(model)` | `OptimizedModule` | first call compiles; same parameters
- Pipeline | Dynamo → FX graph → Inductor → Triton / C++ | fused kernels | `backend="inductor"` by default
- Save | `compiled._orig_mod.state_dict()` | keys without `_orig_mod.` | or keep the original model
- Modes | `"default"`, `"reduce-overhead"`, `"max-autotune"` | speed vs compile time | reduce-overhead uses CUDA graphs
- No breaks allowed | `torch.compile(f, fullgraph=True)` | error at a break | debug with `TORCH_LOGS="graph_breaks"`
- Avoid breaks | `torch.where(cond, a, b)` instead of `if` | one graph | no `.item()` inside
- Shapes | `dynamic=True` / `torch._dynamo.mark_dynamic(x, 0)` | fewer recompiles | or `drop_last=True`
- TF32 | `torch.set_float32_matmul_precision("high")` | faster float32 matmuls | default "highest"
- Inference | `torch.inference_mode()` | no autograd tracking | faster than no_grad

@@ mixed-precision
topics: why 16-bit is faster (tensor cores, memory bandwidth), float16 versus bfloat16 range and precision, torch.autocast for CUDA and CPU, the lower-precision and float32 operation lists, operations that follow their inputs, float64 left alone, float32 master weights, backward outside autocast, nested enabled=False, the deprecated torch.cuda.amp.autocast, gradient underflow and loss scaling, torch.amp.GradScaler (scale, step, update, unscale_, get_scale, state_dict), skipped steps and the adaptive scale, clipping after unscale_, bfloat16 without a scaler, binary_cross_entropy versus BCEWithLogitsLoss under autocast
terms:
- **Mixed precision:** running some operations in 16-bit floats and others in float32 within one model.
- **Autocast:** a context in which each operation automatically chooses float16/bfloat16 or float32.
- **Tensor cores:** GPU units that multiply 16-bit (and TF32) matrices much faster than float32 units.
- **Master weights:** the float32 copy of the parameters that the optimizer updates.
- **Underflow:** a value too small for the format, which becomes zero.
- **Loss scaling:** multiplying the loss by a large factor so float16 gradients don't underflow, then dividing the gradients back.
- **GradScaler:** the object that scales the loss, unscales gradients, skips steps with inf or nan and adjusts the scale.
- **Growth interval:** the number of clean steps after which GradScaler doubles the scale (2000 by default).
mistakes:
- Calling `model.half()` for training instead of autocast.
- Putting `backward()` inside the autocast block.
- Clipping gradients before `scaler.unscale_(optimizer)`.
- Calling `unscale_` twice for the same optimizer before `update()`.
- Treating early skipped steps as a bug.
- Using a GradScaler with bfloat16 (unneeded) or forgetting it with float16.
- Using `F.binary_cross_entropy` under CUDA autocast instead of `BCEWithLogitsLoss`.
- Leaving the scaler's state out of checkpoints.

glance:
- Autocast (GPU) | `with torch.autocast("cuda", dtype=torch.float16):` | matmul/linear/conv in fp16 | forward and loss only
- Autocast (CPU) | `with torch.autocast("cpu", dtype=torch.bfloat16):` | matmul/linear/conv in bf16 | bf16 is the CPU default
- Stays float32 (CUDA) | softmax, log_softmax, sum, exp, log, pow, layer_norm, losses | accuracy | float64 never cast
- Scale | `scaler.scale(loss).backward()` | scaled gradients | `torch.amp.GradScaler("cuda")`
- Clip | `scaler.unscale_(opt)` then `clip_grad_norm_` | true gradient sizes | once per optimizer per step
- Step | `scaler.step(opt); scaler.update()` | skips on inf/nan | scale ×0.5 on overflow, ×2 after 2000 clean steps
- bfloat16 | autocast with `dtype=torch.bfloat16`, plain `backward()` | no scaler needed | float32's range
- Checkpoint | `scaler.state_dict()` / `load_state_dict` | resumes the scale | alongside model and optimizer

@@ distributed-training
topics: why distribute training, data parallelism, all-reduce of gradients, why averaged shard gradients equal the full-batch gradient, effective batch size and learning-rate scaling, processes, world size, rank and local rank, NCCL and Gloo backends, torchrun and its environment variables, init_process_group and destroy_process_group, DistributedDataParallel and model.module, DistributedSampler (interleaving, padding, drop_last, shuffle, seed, set_epoch), rank-0 logging and saving, barrier, no_sync for gradient accumulation, Fully Sharded Data Parallel (FSDP2 fully_shard, MixedPrecisionPolicy, FSDP1), tensor and pipeline parallelism
terms:
- **Data parallelism:** each GPU holds a full model copy and trains on a different part of each batch.
- **All-reduce:** a collective operation that combines (sums or averages) a tensor across all processes and gives every process the result.
- **World size:** the total number of processes in a distributed job.
- **Rank:** a process's index in the job, from 0 to world size − 1; local rank is its index on its own machine.
- **Process group:** the set of processes that communicate, created with `init_process_group`.
- **NCCL:** NVIDIA's library for fast GPU-to-GPU communication; the backend for multi-GPU training.
- **torchrun:** PyTorch's launcher, which starts the processes and sets RANK, LOCAL_RANK, WORLD_SIZE, MASTER_ADDR and MASTER_PORT.
- **Effective batch size:** batch size per GPU × number of GPUs (× accumulation steps).
- **FSDP:** Fully Sharded Data Parallel: shards parameters, gradients and optimizer state across GPUs.
- **Sharding:** splitting a tensor or state across devices so each holds only a part.
mistakes:
- Forgetting `sampler.set_epoch(epoch)`, so every epoch has the same order.
- Passing `shuffle=True` to a DataLoader together with a sampler.
- Saving the checkpoint from every rank, or saving `model.state_dict()` with `module.` prefixes.
- Using the Gloo backend for GPU training (or NCCL on CPUs).
- Forgetting `torch.cuda.set_device(local_rank)`, so every process uses GPU 0.
- Not adjusting the learning rate for a larger effective batch size.
- Ignoring DistributedSampler's padding when computing exact validation metrics.
- Creating the optimizer before `fully_shard`.

glance:
- Launch | `torchrun --nproc_per_node=4 train.py` | 4 processes with RANK, LOCAL_RANK, WORLD_SIZE | one per GPU
- Join | `dist.init_process_group(backend="nccl")` | process group | Gloo for CPUs
- Wrap | `DDP(model.to(device), device_ids=[local_rank])` | gradients all-reduced in backward | `model.module` is the original
- Shard data | `DistributedSampler(ds)` + `sampler.set_epoch(epoch)` | different slice per rank | pads to equal sizes
- Save | `if dist.get_rank() == 0: torch.save(model.module.state_dict(), path)` | one checkpoint | `dist.barrier()` to wait
- Accumulate | `with model.no_sync():` on non-final micro-batches | fewer all-reduces | last backward syncs
- Too big for one GPU | `fully_shard(block)` per block, then `fully_shard(model)` | sharded params, grads, optimizer state | FSDP2
- Clean up | `dist.destroy_process_group()` | process group closed | at the end of main
