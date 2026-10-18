# Lesson 9: Gradient descent by hand

**You'll learn:** the gradient descent update rule, fitting a line with tensors and autograd, updating weights inside torch.no_grad, in-place updates versus reassignment, zeroing gradients, the learning rate (too small, good, diverging), the loss curve, full-batch versus mini-batch (stochastic) gradient descent, epochs.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/pytorch/#gradient-descent)**: run every example and check your exercise answers.

## Key terms

- **Gradient descent:** repeatedly moving each weight a small step against its gradient to reduce the loss.
- **Learning rate:** the step size of each gradient-descent update.
- **Step (iteration):** one update of the weights.
- **Divergence:** the loss growing (often to inf or nan) because the steps overshoot, usually from too high a learning rate.
- **Mean squared error (MSE):** the average of the squared differences between predictions and targets.
- **Mini-batch:** a small random subset of the training data used for one step.
- **Stochastic gradient descent (SGD):** gradient descent where each step uses a mini-batch instead of all the data.
- **Epoch:** one complete pass through the training data.

**Gradient descent** is the algorithm behind nearly all deep learning: repeatedly nudge every weight a small step against its gradient.

> w ← w − learning rate × ∂loss/∂w

The **learning rate** (lr) sets the step size. Each repetition is a **step**, or **iteration**.

## Fitting a line

Some data roughly follows y = 2x + 1. Let's recover the 2 and the 1 with a tiny model, `y_hat = w * x + b`, and the **mean squared error** loss.

```python
import torch

torch.manual_seed(0)
x = torch.linspace(0, 1, 20)
y = 2 * x + 1 + 0.1 * torch.randn(20)       # the truth plus some noise

w = torch.zeros(1, requires_grad=True)
b = torch.zeros(1, requires_grad=True)
lr = 0.5

for step in range(201):
    y_hat = w * x + b                        # 1. forward pass
    loss = ((y_hat - y) ** 2).mean()         # 2. loss
    loss.backward()                          # 3. gradients
    with torch.no_grad():                    # 4. update, without recording
        w -= lr * w.grad
        b -= lr * b.grad
    w.grad.zero_()                           # 5. reset for the next step
    b.grad.zero_()
    if step % 50 == 0:
        print(f"step {step:3d}  loss {loss.item():.4f}  w {w.item():.3f}  b {b.item():.3f}")
```

Every line matters:

- The update must be inside `torch.no_grad()`. Otherwise autograd would try to record `w -= …` as part of the graph, and an in-place change to a leaf that requires grad is an error (below).
- `w -= …` updates `w` **in place**. Writing `w = w - lr * w.grad` instead would create a new tensor (no longer a leaf, with no `.grad`), breaking the next step.
- Without zeroing, gradients from every step pile up.

*This example raises an error on purpose.*

```python
import torch

w = torch.zeros(1, requires_grad=True)
loss = ((w * 3 - 6) ** 2).mean()
loss.backward()
w -= 0.1 * w.grad          # outside torch.no_grad()
```

## The learning rate

Too small and training crawls; too large and every step overshoots the minimum by more than the last, so the loss **diverges** (grows, often to `inf` or `nan`).

![Three panels of the curve loss = (w − 3)² with six gradient-descent steps from w = −1. With lr 0.05 the steps creep down one side; with lr 0.3 they reach the minimum at 3 in a few steps; with lr 1.05 each step jumps further across the valley and the loss grows](../figures/gradient-descent.svg)

```python
import torch

def train(lr, steps=30):
    w = torch.tensor(-1.0, requires_grad=True)
    for _ in range(steps):
        loss = (w - 3) ** 2
        loss.backward()
        with torch.no_grad():
            w -= lr * w.grad
        w.grad = None                       # another way to reset
    return w.item(), loss.item()

for lr in (0.01, 0.1, 0.5, 0.9, 1.1):
    w, loss = train(lr)
    print(f"lr {lr:<4}  w {w:10.4f}  loss {loss:.4g}")
```

There's no universal best value: it depends on the model, the loss and the optimizer. Common practice is to try values spaced by factors of about 3 to 10 (0.1, 0.03, 0.01, …) and keep the one whose loss falls fastest without blowing up.

## Watching the loss curve

Plotting the loss per step is the first diagnostic of any training run.

```python
import torch
import matplotlib.pyplot as plt

torch.manual_seed(0)
x = torch.linspace(0, 1, 20)
y = 2 * x + 1 + 0.1 * torch.randn(20)

fig, ax = plt.subplots(figsize=(6, 3))
for lr in (0.05, 0.5):
    w = torch.zeros(1, requires_grad=True)
    b = torch.zeros(1, requires_grad=True)
    losses = []
    for step in range(100):
        loss = ((w * x + b - y) ** 2).mean()
        loss.backward()
        with torch.no_grad():
            w -= lr * w.grad
            b -= lr * b.grad
        w.grad = None
        b.grad = None
        losses.append(loss.item())
    ax.plot(losses, label=f"lr = {lr}")
ax.set_xlabel("step")
ax.set_ylabel("MSE loss")
ax.set_yscale("log")
ax.legend()
```

## Full batch versus mini-batches

The loops above compute the loss on **all** the data at every step (full-batch gradient descent). Real datasets are too big for that, so training uses **mini-batches**: each step uses a random subset (often 32 to 512 examples). The gradient is noisier but far cheaper, and the noise even helps escape poor solutions. That's **stochastic gradient descent (SGD)**. One pass through all the batches is an **epoch**. Lesson 5 builds this loop; Part 3 hands the batching to a `DataLoader`.

## At a glance

| Concept | Code | Gives you | Remember |
|---|---|---|---|
| Update rule | `w -= lr * w.grad` inside `torch.no_grad()` | one step downhill | in place, not `w = w - …` |
| One step | forward → loss → backward → update → zero | a lower loss | the order matters |
| Learning rate | try 0.1, 0.03, 0.01 … | fast, stable training | too high diverges (nan) |
| Diagnose | plot `loss.item()` per step | the learning curve | log scale helps |
| Mini-batches | a random subset per step | cheap, noisy gradients | an epoch = all batches once |

## Common mistakes

- Updating weights outside `torch.no_grad()`, which raises an in-place error on a leaf.
- Writing `w = w - lr * w.grad`, which replaces the leaf with a tensor that has no gradient.
- Forgetting to reset gradients each step.
- Using a learning rate so high the loss diverges, or so low it barely moves.

## Exercises

### 1. Fit a line by gradient descent

Write `fit_line(x, y, lr, steps)` that starts from `w = 0` and `b = 0` and runs `steps` steps of full-batch gradient descent on the mean squared error of `w * x + b`. Return `(w, b)` as Python floats. Use autograd for the gradients and update inside `torch.no_grad()`.

Starter code:

```python
import torch

def fit_line(x, y, lr, steps):
    pass

x = torch.tensor([0.0, 1.0, 2.0, 3.0])
y = torch.tensor([1.0, 3.0, 5.0, 7.0])       # y = 2x + 1 exactly
print(fit_line(x, y, lr=0.2, steps=300))     # close to (2.0, 1.0)
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** the five-line loop from the lesson, packaged as a function.
2. **Examples:** one step from 0: ∂L/∂w = 2·mean((0 − y)·x) = −17 and ∂L/∂b = 2·mean(0 − y) = −8, so w = 0.05 · 17 = 0.85 and b = 0.05 · 8 = 0.4.
3. **Brute force:** solve with the normal equations: exact, but not what training does.
4. **Pattern:** **forward → loss → backward → update in no_grad → zero**.
5. **Plan:** loop `steps` times; return items.
6. **Code and test:** one step and two steps check the update and the zeroing.

</details>

<details>
<summary>💡 Hint 1</summary>

Create `w` and `b` as leaves with `requires_grad=True`, starting at 0.

</details>

<details>
<summary>💡 Hint 2</summary>

Each step: forward, loss, `loss.backward()`, then inside `torch.no_grad()` subtract `lr * grad`.

</details>

<details>
<summary>💡 Hint 3</summary>

Reset gradients every step (`w.grad = None` or `w.grad.zero_()`), and return `w.item(), b.item()`.

</details>

### 2. Find the learning rates that work

For the loss (w − 3)², starting at w = 0, gradient descent converges only for some learning rates. Write `final_w(lr, steps=50)` returning w after `steps` steps (a Python float), and then build `diverges`, a list of the learning rates from `[0.1, 0.5, 0.9, 1.0, 1.1]` for which `abs(final_w(lr) - 3)` is greater than 3 (it ended further from the minimum than it started).

Starter code:

```python
import torch

def final_w(lr, steps=50):
    pass

diverges = None
print([round(final_w(lr), 3) for lr in [0.1, 0.5, 0.9, 1.0, 1.1]])
print(diverges)
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** run gradient descent for several learning rates and classify the result.
2. **Examples:** lr 0.5: w = 0 − 0.5·2(0 − 3) = 3 in one step.
3. **Brute force:** that's what we do: run each one.
4. **Pattern:** the distance to the minimum is multiplied by **(1 − 2·lr)** each step: it shrinks only when |1 − 2·lr| < 1.
5. **Plan:** a function for one run, a comprehension for the list.
6. **Code and test:** lr 1.0 is the boundary case.

</details>

<details>
<summary>💡 Hint 1</summary>

The loop is the same as before with a single weight: forward, backward, update in `no_grad`, reset.

</details>

<details>
<summary>💡 Hint 2</summary>

The gradient of (w − 3)² is 2(w − 3), so each step multiplies the distance to 3 by (1 − 2·lr).

</details>

<details>
<summary>💡 Hint 3</summary>

Build `diverges` with a list comprehension over the five learning rates.

</details>

**In the sandbox:** exercises 17–18. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Fit a line by gradient descent</summary>

```python
import torch

def fit_line(x, y, lr, steps):
    w = torch.zeros((), requires_grad=True)
    b = torch.zeros((), requires_grad=True)
    for _ in range(steps):
        loss = ((w * x + b - y) ** 2).mean()
        loss.backward()
        with torch.no_grad():
            w -= lr * w.grad
            b -= lr * b.grad
        w.grad = None
        b.grad = None
    return w.item(), b.item()

x = torch.tensor([0.0, 1.0, 2.0, 3.0])
y = torch.tensor([1.0, 3.0, 5.0, 7.0])
print(fit_line(x, y, lr=0.2, steps=300))
```

**Line by line**

- `torch.zeros((), requires_grad=True)` makes a 0-D leaf (a shape `[1]` tensor works too).
- `((w * x + b - y) ** 2).mean()` is the mean squared error over the 4 points.
- After `backward()`, `w.grad` is 2·mean((wx + b − y)·x) and `b.grad` is 2·mean(wx + b − y). On the first step (w = b = 0) those are 2 · (−34/4) = −17 and 2 · (−16/4) = −8, giving (0.85, 0.4). The second step's gradients are −9.85 and −4.65, giving (1.3425, 0.6325).
- The in-place updates inside `no_grad` keep `w` and `b` as the same leaf tensors.
- Setting `.grad = None` gives the next step a clean slate; without it the second step would use the sum of two gradients, which the two-step check catches.

**Common wrong approach:** `w = w - lr * w.grad` inside `no_grad`: it replaces `w` with a new tensor that doesn't require grad, so the next `backward()` fails.

</details>

<details>
<summary>✅ 2. Find the learning rates that work</summary>

```python
import torch

def final_w(lr, steps=50):
    w = torch.tensor(0.0, requires_grad=True)
    for _ in range(steps):
        loss = (w - 3) ** 2
        loss.backward()
        with torch.no_grad():
            w -= lr * w.grad
        w.grad = None
    return w.item()

diverges = [lr for lr in [0.1, 0.5, 0.9, 1.0, 1.1] if abs(final_w(lr) - 3) > 3]
print([round(final_w(lr), 3) for lr in [0.1, 0.5, 0.9, 1.0, 1.1]])
print(diverges)
```

**Why these results**

The error e = w − 3 changes as e ← e − lr · 2e = (1 − 2·lr)·e.

| lr | factor 1 − 2·lr | behaviour |
|---|---|---|
| 0.1 | 0.8 | shrinks smoothly |
| 0.5 | 0 | exact in one step |
| 0.9 | −0.8 | overshoots, but shrinks (zig-zags in) |
| 1.0 | −1 | bounces between 0 and 6 forever |
| 1.1 | −1.2 | grows: diverges |

After 50 steps at lr 1.1 the error is 3 · 1.2⁵⁰ ≈ 27,000. The same "too big a step overshoots" problem happens in real networks, which is why a loss that suddenly jumps to `nan` usually means the learning rate is too high.

**Common wrong approach:** forgetting to reset `w.grad`, so step n uses the sum of n gradients: the run diverges even for small learning rates.

</details>

## Quick quiz

1. Why are weight updates written inside `with torch.no_grad():`?
   - A) So the update isn't recorded in the graph (in-place changes to a leaf that requires grad are an error otherwise)
   - B) So the gradients are zeroed automatically
   - C) To make the update run on the GPU
   - D) To switch dropout off

2. The loss rises every step and becomes `nan`. What's the most likely cause?
   - A) The learning rate is too low
   - B) The model has too few parameters
   - C) The gradients were zeroed
   - D) The learning rate is too high

3. In `w -= lr * w.grad`, what is the role of the minus sign?
   - A) It undoes the previous step
   - B) It normalises the gradient
   - C) It moves w against the gradient, the direction in which the loss decreases
   - D) It keeps w positive

4. What is one epoch?
   - A) One call to backward()
   - B) One gradient step
   - C) One mini-batch
   - D) One full pass through the training data

5. After `with torch.no_grad(): w = w - lr * w.grad`, what goes wrong on the next step?
   - A) Nothing; it's the same as `w -= lr * w.grad`
   - B) `w` is now a new tensor that doesn't require grad, so the next backward() can't produce `w.grad`
   - C) The gradient is computed twice
   - D) The learning rate doubles

<details>
<summary>Quiz answers</summary>

1. **A) So the update isn't recorded in the graph (in-place changes to a leaf that requires grad are an error otherwise)**: The update is not part of the model's computation, so autograd must not record it.
2. **D) The learning rate is too high**: Steps that overshoot the minimum grow each time, so the loss diverges.
3. **C) It moves w against the gradient, the direction in which the loss decreases**: The gradient points uphill; gradient descent steps downhill.
4. **D) One full pass through the training data**: With mini-batches, an epoch contains many steps (number of samples ÷ batch size).
5. **B) `w` is now a new tensor that doesn't require grad, so the next backward() can't produce `w.grad`**: Assignment creates a new tensor; in-place `-=` updates the original leaf.

</details>

---
Previous: [Lesson 8](08-autograd.md) · Next: [Lesson 10: Building models with nn.Module](10-nn-module.md)
