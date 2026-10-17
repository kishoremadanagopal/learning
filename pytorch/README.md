# PyTorch: from tensors to the PyTorch Certified Associate exam

A beginner-first PyTorch course that follows the official exam outline of the **PyTorch Certified Associate (PTCA)**, launched by the PyTorch Foundation and the Linux Foundation in June 2026: 7 lessons so far on tensors, devices, autograd, data loading, building and training models, and making them fast.

PyTorch is the framework most AI research and production models are written in. Knowing it well is core for the **AI engineer** path, and a big plus for **data / AI analysts** who move into machine learning.

## ▶ [Open the practice sandbox](https://kishoremadanagopal.github.io/learning/pytorch/)

The sandbox runs Python 3.14 in your browser (via [Pyodide](https://pyodide.org)) with the course's own copy of PyTorch: a teaching version written in Python on NumPy that follows PyTorch 2.14's names, printing, rules, random numbers and error messages for everything the course uses. It even has a pretend NVIDIA GPU, so you can practise `.to('cuda')`. Nothing to install and no sign-up. Run the same code with real PyTorch on your own computer (`pip install torch`) and it behaves the same way, just faster.

- every lesson, with **46 examples** you can run and change
- **14 exercises** with hidden tests, each with an approach, hints and a walkthrough
- **36 exam-style quiz questions**, with explanations
- diagrams for the key ideas
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
| 📘 [Lessons](#lessons) | 7 lessons, each with key terms, examples, common mistakes, exercises, walkthroughs and an exam-style quiz |
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

## Running it on your own computer

Install PyTorch with the command from [pytorch.org/get-started](https://pytorch.org/get-started/locally/) (for most computers: `pip install torch`). Every example runs unchanged; the outputs match, except where a lesson says a real GPU or a different random-number kernel changes them.

## Editing the course

Lessons are generated from the Markdown sources in [`course/`](course/). See [course/README.md](course/README.md).
