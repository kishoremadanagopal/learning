# Lesson 28: Exam strategy and final review

**You'll learn:** the PTCA's format, domains and what isn't published, question types (predict the output, find the error, choose the API, order the steps, explain why), a method for code questions, the most common traps, pacing over 120 minutes, a high-yield checklist per domain, using the mock exams, preparing for an online proctored exam.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/pytorch/#exam-strategy)**: run every example and check your exercise answers.

## Key terms

- **Proctored exam:** an exam supervised by a proctor, here remotely through your webcam, microphone and screen.
- **Domain:** one of the exam outline's four topic areas, each worth a fixed share of the questions.
- **Distractor:** a wrong option written to look right, usually the result of a specific common mistake.
- **Process of elimination:** ruling out options you can show are wrong, to narrow down the right one.
- **Pacing:** spreading your time over the questions, so no single question costs you several others.
- **Mock exam:** a practice exam taken under real conditions: timed, in one sitting, without notes.

You've covered the whole exam outline. This lesson turns that knowledge into points on exam day; the three mock exams after it let you practise under exam conditions.

## What we know about the exam

| | |
|---|---|
| Format | online, proctored, multiple choice |
| Time | 120 minutes |
| Domains | PyTorch fundamentals 38% · performance and optimization 26% · model development 20% · data handling 16% |
| Retakes | one free retake |
| After booking | 12 months to take it; the certification is valid for 2 years |
| Not published | the number of questions and the pass mark |

The domain weights tell you where the points are: almost two thirds come from fundamentals and performance. A weak spot in fundamentals (Parts 1 and 2) costs more than a weak spot anywhere else. Check the [Linux Foundation's PTCA page](https://training.linuxfoundation.org/certification/pytorch-certified-associate-ptca/) for the current details before you book.

## The kinds of questions

| Type | Example | What it tests |
|---|---|---|
| Predict the output | "What does this code print?" | shapes, dtypes, devices and values, traced line by line |
| Find the error | "Which line raises an error?" or "What happens when this runs?" | the rules: same device, matching shapes, contiguity, in-place on leaves |
| Choose the API | "Which call returns the peak GPU memory?" | knowing the right function and its arguments |
| Put steps in order | "Which training step is correct?" | zero_grad → forward → loss → backward → step; the GradScaler sequence |
| Explain why | "Why does bfloat16 rarely need loss scaling?" | the idea behind a feature |

## A method for code questions

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

## Pacing

At 120 minutes, budget your time per question and check your pace at the halfway mark. Don't let one hard question eat five minutes: pick your best answer, flag it if the exam lets you, and come back at the end. An unanswered question can't score, so unless the exam's rules say otherwise, never leave one blank.

## High-yield checklist

If you can do everything on this list without notes, you're ready. Each item names the lesson that covers it.

| Domain | You can… |
|---|---|
| Fundamentals (38%) | predict shapes through indexing, `view`/`reshape`, `unsqueeze`, `cat`/`stack`, broadcasting and `@` (4–6); predict dtypes after promotion and division (3); create tensors with the right dtype and device (2, 7); explain `requires_grad`, `backward`, `.grad` accumulation, `detach` and `no_grad` (8–9); write the training and evaluation loop in the right order (12); save and load state dicts and checkpoints, with `map_location` (13) |
| Performance (26%) | time GPU code correctly, use `torch.utils.benchmark` and read the profiler table (24); explain what `torch.compile` does, its modes, graph breaks and recompiles (25); use autocast and GradScaler in the right order, and know when bfloat16 needs no scaler (26); explain DDP, all-reduce, `torchrun`, `DistributedSampler.set_epoch`, effective batch size and when to use FSDP (27) |
| Model development (20%) | compute convolution output shapes and parameter counts (19); read RNN/LSTM/attention shapes and masks (20); know train/eval behaviour of Dropout and BatchNorm, and initialisation and normalisation choices (21); choose optimizers, parameter groups and schedulers, and call `scheduler.step()` at the right time (22); freeze layers and replace heads for transfer learning (23) |
| Data handling (16%) | write a map-style Dataset (14); predict DataLoader batches, `len`, `drop_last` and collation (15); choose samplers, `num_workers` and `pin_memory` (16); build training and validation transform pipelines with `transforms.v2` (17); avoid leakage when splitting and normalising (18) |

## Using the mock exams

Each mock exam has **40 questions in 80 minutes**, split across the domains in proportion to the real weights: 15 fundamentals, 11 performance, 8 model development and 6 data handling. Two minutes per question is a steady pace for code-reading questions; since the real exam's question count isn't published, practise the pace rather than a number.

1. Take each mock **under exam conditions**: one sitting, timer on, no notes, no running code.
2. Submit, then read the explanation of **every** question you missed or guessed.
3. Review the lessons the results page lists, then try the related exercises again.
4. Leave a few days before the next mock. Aim for at least **80%** on each, which leaves a margin above whatever the real pass mark is.

## Before exam day

The exam is online with a remote proctor. Read the Linux Foundation's candidate handbook for the exact rules. Typically you need a webcam, a microphone, a government-issued photo ID and a private, quiet room with a clear desk. Run the system check on the computer you'll use a few days before, not on the day.

## At a glance

| Concept | Code | Gives you | Remember |
|---|---|---|---|
| Domains | fundamentals 38 · performance 26 · model development 20 · data 16 | where the points are | fundamentals + performance ≈ two thirds |
| Code question | read the question, trace shapes/dtypes line by line, check traps, eliminate | the answer | write each shape down |
| Common traps | `/` → float, views share memory, `.grad` accumulates, `eval()` ≠ `no_grad()` | fewer careless errors | see the trap table |
| Pacing | 120 minutes; check your pace at the halfway mark | time for every question | guess, flag, move on |
| Mock exams | 40 questions, 80 minutes, weighted like the exam | your score per domain | aim for 80% or more |
| Exam day | ID, webcam, microphone, quiet room, system check in advance | a smooth start | read the candidate handbook |

## Common mistakes

- Reading the code before the question, and tracking the wrong thing.
- Tracing shapes in your head instead of writing them down.
- Spending five minutes on one hard question.
- Leaving questions unanswered.
- Picking the option that "looks simplest" without checking the rule it depends on.
- Taking mocks with notes or a Python prompt open, which hides your real weak spots.
- Running the proctoring system check for the first time on exam day.

## Quick quiz

1. Which two domains together make up almost two thirds of the PTCA exam?
   - A) PyTorch fundamentals (38%) and performance and optimization (26%)
   - B) Model development (20%) and data handling (16%)
   - C) PyTorch fundamentals (38%) and model development (20%)
   - D) Performance and optimization (26%) and data handling (16%)

2. A question shows `x = torch.arange(6)` and asks for the dtype of `x / 2`. What is the answer, and why is it a trap?
   - A) `torch.float64`: Python divides in double precision
   - B) It raises an error: integer tensors can't be divided
   - C) `torch.int64`: integer tensors stay integers
   - D) `torch.float32`: `/` is always true division, even on integer tensors

3. You can't decide between two answers after a minute. What should you do?
   - A) Keep working on it until you're certain
   - B) Skip all remaining code questions
   - C) Leave it blank so it doesn't count against you
   - D) Pick the more likely one, flag the question if possible, and move on

4. An option is exactly the shape you'd get if broadcasting didn't happen. What does that tell you?
   - A) It must be the right answer, because it's the simplest
   - B) It's probably a distractor built from a common mistake: check the broadcasting rule before choosing it
   - C) Nothing: distractors are random
   - D) Broadcasting never changes shapes

5. What score should you aim for on the course's mock exams before booking the real one?
   - A) 100% on one mock is enough
   - B) 50%, because the real exam is easier
   - C) Exactly the real exam's pass mark
   - D) At least 80% on each, since the real pass mark isn't published

<details>
<summary>Quiz answers</summary>

1. **A) PyTorch fundamentals (38%) and performance and optimization (26%)**: 38% + 26% = 64%, so fundamentals and performance deserve most of your review time.
2. **D) `torch.float32`: `/` is always true division, even on integer tensors**: Use `//` (or `torch.div(..., rounding_mode="floor")`) for integer division.
3. **D) Pick the more likely one, flag the question if possible, and move on**: Every question is worth the same; time spent on one hard question costs easy points later.
4. **B) It's probably a distractor built from a common mistake: check the broadcasting rule before choosing it**: Wrong options usually encode specific mistakes; naming the mistake lets you eliminate the option.
5. **D) At least 80% on each, since the real pass mark isn't published**: A margin covers nerves, the time limit and questions on details the mocks didn't hit.

</details>

---
Previous: [Lesson 27](27-distributed-training.md) · Next: [Lesson 29: Mock exam 1](29-mock-exam-1.md)
