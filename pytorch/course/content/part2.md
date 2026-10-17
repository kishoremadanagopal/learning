@@@ part
id: 2
title: Autograd and the Model Lifecycle
level: Beginner
blurb: How models learn: gradients computed automatically by autograd, gradient descent written by hand, building models with nn.Module, losses and optimizers, the training and evaluation loop with train and eval modes, and saving, loading and using a trained model.

@@@ lesson
id: autograd
title: Autograd: gradients for free
minutes: 25
summary: What a gradient is and why training needs it, requires_grad, the computation graph and grad_fn, leaf tensors, backward() and .grad, gradients accumulating until you zero them, non-scalar outputs, the graph being freed after backward, detach, torch.no_grad and torch.inference_mode, and torch.autograd.grad.
---
Training a model means adjusting its weights to make a **loss** (a number measuring how wrong it is) smaller. To know which way to adjust each weight, you need the **gradient**: how much the loss changes when that weight changes a little. A positive gradient means "increasing this weight increases the loss", so you decrease it, and vice versa.

A model can have millions of weights, and the loss is a long chain of operations. Working out every derivative by hand is impossible; **autograd** does it automatically.

### requires_grad, backward and .grad

Mark the tensors you want gradients for with `requires_grad=True`. Compute with them as usual. Call `.backward()` on the final scalar, and each marked tensor's `.grad` holds the derivative of that scalar with respect to it.

```python
import torch

x = torch.tensor(3.0, requires_grad=True)
y = x ** 2 + 2 * x            # y = x² + 2x
y.backward()                  # compute dy/dx
print(y)
print(x.grad)                 # dy/dx = 2x + 2 = 8 at x = 3
```

It works the same for tensors of any shape: `w.grad` always has the same shape as `w`.

```python
import torch

w = torch.tensor([1.0, -2.0, 0.5], requires_grad=True)
x = torch.tensor([3.0, 1.0, 4.0])
loss = (w * x).sum() ** 2     # (w · x)² = 3² = 9
loss.backward()
print(loss, w.grad)           # 2 · (w · x) · x = 6x
print(x.grad)                 # x didn't ask for gradients
```

### The computation graph

While you compute, PyTorch records each operation in a **computation graph**. Every result of a recorded operation has a `grad_fn`: the node that knows how to pass gradients back to its inputs. Tensors you created yourself are **leaves** (`is_leaf` is True, `grad_fn` is None). `backward()` walks the graph from the loss back to the leaves, applying the chain rule at each node, and stores the results in the leaves' `.grad`.

![w and b are leaf tensors with requires_grad=True, x is plain data. w and x feed MulBackward0, whose result and b feed AddBackward0, which produces the loss. Forward, PyTorch records each operation; loss.backward() walks the graph backwards, applying the chain rule at each node, and fills w.grad and b.grad](figures/autograd-graph.svg)

```python
import torch

w = torch.tensor([2.0], requires_grad=True)
b = torch.tensor([1.0], requires_grad=True)
x = torch.tensor([3.0])
y = w * x + b
print(y)                                  # the printout shows grad_fn
print(y.grad_fn, y.is_leaf, w.is_leaf)
print(y.grad_fn.next_functions)           # the nodes one step back
y.backward()
print(w.grad, b.grad)                     # dy/dw = x = 3, dy/db = 1
```

Only leaves keep their `.grad`. Intermediate results (like `y` above) don't, unless you call `y.retain_grad()` before `backward()`; reading `.grad` on them gives `None` and a warning.

### Gradients accumulate

`backward()` **adds** to `.grad`; it doesn't overwrite it. That's deliberate (it lets you sum gradients over several batches), but it means a training loop must **zero the gradients** before each backward pass, or every step uses the sum of all previous gradients.

```python
import torch

x = torch.tensor([1.0, 2.0], requires_grad=True)
(x * x).sum().backward()
print(x.grad)              # 2x
(x * x).sum().backward()
print(x.grad)              # added again: 4x
x.grad.zero_()             # or x.grad = None
(x * x).sum().backward()
print(x.grad)
```

In real training, `optimizer.zero_grad()` does this for every parameter (lesson 4).

### backward() needs a single number

Gradients are defined for a scalar loss. Calling `backward()` on a tensor with several elements is an error, unless you pass `gradient=` (a tensor of the same shape that weights each element). Normally you reduce first with `.sum()` or `.mean()`.

```python error
import torch

x = torch.tensor([1.0, 2.0], requires_grad=True)
y = x * 3
y.backward()
```

### The graph is freed after backward

To save memory, `backward()` frees the intermediate values the graph stored. Calling it twice on the same graph is an error. In a training loop this never happens, because every step does a fresh forward pass that builds a new graph. (Pass `retain_graph=True` to the first call if you really need two backward passes.)

```python error
import torch

x = torch.tensor([1.0, 2.0], requires_grad=True)
loss = (x ** 2).sum()
loss.backward()
loss.backward()
```

### Turning recording off: detach, no_grad and inference_mode

Recording the graph costs memory and time. When you don't need gradients, turn it off:

| Tool | What it does | Use it for |
|---|---|---|
| `t.detach()` | a tensor sharing `t`'s data, cut off from the graph | logging values, NumPy conversion, treating a value as a constant |
| `with torch.no_grad():` | nothing inside is recorded | evaluation, and updating weights by hand |
| `with torch.inference_mode():` | like no_grad, plus faster; its tensors can never be used in autograd later | pure inference (predictions) |
| `t.requires_grad_(False)` | stop tracking a leaf | freezing weights you don't want to train |

```python
import torch

w = torch.tensor([1.0, 2.0], requires_grad=True)
with torch.no_grad():
    y = w * 2
print(y, y.requires_grad)

z = (w * 2).detach()
print(z, z.requires_grad)

with torch.inference_mode():
    p = w * 2
print(p.requires_grad, p.is_inference())
```

### torch.autograd.grad

`torch.autograd.grad(output, inputs)` returns the gradients as a tuple instead of adding them to `.grad`. It's handy when you want a derivative as a value (in physics-informed models, or gradient penalties).

```python
import torch

x = torch.tensor([1.0, 2.0, 3.0], requires_grad=True)
y = (x ** 3).sum()
(g,) = torch.autograd.grad(y, x)
print(g)            # 3x²
print(x.grad)       # untouched
```

:::exercise Derivatives with autograd
Write `derivative(f, x)` that returns the derivative of a function `f` (which takes and returns a scalar tensor) at the Python float `x`, as a Python float, using autograd. Then set `slope`, the derivative of f(t) = t³ − 4t at t = 2.
```python starter
import torch

def derivative(f, x):
    pass

slope = None
print(derivative(lambda t: t ** 2, 3.0))   # 6.0
print(slope)
```
```python check
import torch
d = need("derivative")
r = d(lambda t: t ** 2, 3.0)
assert isinstance(r, float), f"derivative should return a Python float, got {type(r).__name__}. Use .item()."
assert abs(r - 6.0) < 1e-5, f"The derivative of t² at 3 is 6, got {r}."
assert abs(d(lambda t: torch.sin(t), 0.0) - 1.0) < 1e-5, "The derivative of sin(t) at 0 should be 1."
assert abs(d(lambda t: torch.exp(2 * t), 1.0) - 2 * 2.718281828 ** 2) < 1e-3, "The derivative of exp(2t) at 1 should be 2e²."
assert abs(d(lambda t: 5 * t, -7.0) - 5.0) < 1e-6, "The derivative of 5t is 5 everywhere."
s = need("slope")
assert abs(float(s) - 8.0) < 1e-5, f"slope should be 3·2² − 4 = 8, got {s}."
assert uses("backward") or uses("autograd.grad"), "Use autograd: backward() or torch.autograd.grad."
```
```python solution
import torch

def derivative(f, x):
    t = torch.tensor(x, requires_grad=True)
    f(t).backward()
    return t.grad.item()

slope = derivative(lambda t: t ** 3 - 4 * t, 2.0)
print(derivative(lambda t: t ** 2, 3.0))
print(slope)
```
hint: Make the input a tensor that records gradients: `torch.tensor(x, requires_grad=True)`.
hint: Call `f(t)`, then `.backward()` on the result.
hint: The answer is in `t.grad`; `.item()` makes it a float.
approach:
1. **Understand:** turn a Python number into a leaf tensor, run f, and read the gradient.
2. **Examples:** t² at 3 → 2·3 = 6.
3. **Brute force:** a finite difference (f(x + h) − f(x)) / h approximates it, with rounding error.
4. **Pattern:** **leaf with requires_grad → forward → backward → .grad**.
5. **Plan:** create t, call f(t).backward(), return t.grad.item().
6. **Code and test:** check sin at 0 (cos 0 = 1).
walkthrough:
**Line by line**

- `torch.tensor(x, requires_grad=True)` makes a 0-D float32 leaf. A new tensor each call means `.grad` starts as None, so nothing accumulates between calls.
- `f(t)` builds the graph as it computes; the result is a scalar, so `.backward()` needs no arguments.
- `t.grad` holds df/dt at x; `.item()` returns a Python float.
- For t³ − 4t the derivative is 3t² − 4, which is 8 at t = 2.

**Common wrong approach:** creating `t` once outside the function and reusing it: the second call's gradient is added to the first.
:::

:::exercise Freeze and inspect
A tiny model has weights `w` and `b` (both require grad) and a frozen `scale`. Compute `loss = ((w * x + b) * scale - y).pow(2).mean()` for the given data, call backward, and set: `w_grad` and `b_grad` (Python floats from `.grad`), `scale_grad` (whatever `scale.grad` is after backward), and `loss_value` (a Python float). Then compute `pred`, the predictions `(w * x + b) * scale` **without** recording a graph.
```python starter
import torch

x = torch.tensor([1.0, 2.0, 3.0])
y = torch.tensor([3.0, 6.0, 9.0])
w = torch.tensor(1.5, requires_grad=True)
b = torch.tensor(0.5, requires_grad=True)
scale = torch.tensor(2.0)          # frozen: no requires_grad

w_grad = b_grad = scale_grad = loss_value = pred = None
print(w_grad, b_grad, scale_grad, loss_value, pred)
```
```python check
import torch
assert isinstance(need("w_grad"), float) and abs(need("w_grad") - 8.0) < 1e-5, f"w_grad should be the float 8.0, got {need('w_grad')!r}."
assert isinstance(need("b_grad"), float) and abs(need("b_grad") - 4.0) < 1e-5, f"b_grad should be the float 4.0, got {need('b_grad')!r}."
assert need("scale_grad", object) is None, "scale doesn't require grad, so scale.grad stays None."
lv = need("loss_value")
assert isinstance(lv, float) and abs(lv - 1.0) < 1e-5, f"loss_value should be the float 1.0, got {lv!r}."
p = need("pred", torch.Tensor)
same(p, torch.tensor([4.0, 7.0, 10.0]), "pred")
assert not p.requires_grad and p.grad_fn is None, "Compute pred inside torch.no_grad() (or detach it) so no graph is recorded."
```
```python solution
import torch

x = torch.tensor([1.0, 2.0, 3.0])
y = torch.tensor([3.0, 6.0, 9.0])
w = torch.tensor(1.5, requires_grad=True)
b = torch.tensor(0.5, requires_grad=True)
scale = torch.tensor(2.0)

loss = ((w * x + b) * scale - y).pow(2).mean()
loss.backward()
w_grad, b_grad, scale_grad = w.grad.item(), b.grad.item(), scale.grad
loss_value = loss.item()
with torch.no_grad():
    pred = (w * x + b) * scale
print(w_grad, b_grad, scale_grad, loss_value, pred)
```
hint: Build `loss` from the formula, then `loss.backward()`.
hint: `w.grad.item()` gives a float. `scale.grad` is None because scale never asked for gradients.
hint: Wrap the prediction in `with torch.no_grad():` so `pred.requires_grad` is False.
approach:
1. **Understand:** one forward pass and backward pass, then read gradients; a second forward pass without recording.
2. **Examples:** predictions (1.5x + 0.5)·2 = 4, 7, 10; every error is 1, so the loss is 1.
3. **Brute force:** derive the gradient formulas by hand: possible here, impossible for big models.
4. **Pattern:** **backward, read .grad, then no_grad for inference**.
5. **Plan:** loss → backward → items → no_grad prediction.
6. **Code and test:** check `pred.requires_grad` is False.
walkthrough:
**Line by line**

- The predictions are (1.5 · [1, 2, 3] + 0.5) · 2 = [4, 7, 10]; minus y = [3, 6, 9] gives errors e = [1, 1, 1], so the loss is mean(e²) = 1.
- By the chain rule, ∂loss/∂w = mean(2 · e · scale · x) = mean(4x) = 8, and ∂loss/∂b = mean(2 · e · scale) = 4. Autograd computes exactly these.
- `loss.backward()` fills `w.grad` and `b.grad`. `scale` was created without `requires_grad`, so autograd treats it as a constant and `scale.grad` stays `None`.
- Inside `torch.no_grad()`, the same expression produces a plain tensor: no `grad_fn`, `requires_grad=False`, no memory spent on a graph.

**Why freeze?** Fine-tuning often trains only the last layers of a big pretrained model: the frozen weights take part in the forward pass but get no gradients and aren't updated.
:::

:::quiz
? `x = torch.tensor(2.0, requires_grad=True); y = x ** 3; y.backward()`. What is `x.grad`?
+ `tensor(12.)`
- `tensor(8.)`
- `tensor(6.)`
- `None`
= dy/dx = 3x² = 12 at x = 2.
? You call `loss.backward()` in two training steps without zeroing gradients. What does each weight's `.grad` hold after the second call?
+ The sum of both steps' gradients
- Only the second step's gradient
- Only the first step's gradient
- The average of the two gradients
= backward() accumulates into .grad; zero it (optimizer.zero_grad()) every step.
? Which tensor is a leaf?
+ `w = torch.randn(3, requires_grad=True)`
- `y = w * 2`
- `z = w.sum()`
- `w.exp()`
= Tensors you create directly are leaves; results of recorded operations have a grad_fn.
? `y` has shape `[5]` and requires grad. What does `y.backward()` do?
+ Raises "grad can be implicitly created only for scalar outputs"
- Computes gradients of y.sum()
- Computes gradients of y[0]
- Nothing
= Reduce to a scalar first (y.sum() or y.mean()), or pass gradient= with y's shape.
? What is the difference between `torch.no_grad()` and `torch.inference_mode()`?
+ Both stop recording; inference_mode is faster, but its tensors can't be used in autograd later
- no_grad also switches dropout off
- inference_mode still records the graph
- There is no difference
= Neither changes layer behaviour (that's model.eval()); inference_mode adds optimisations and restrictions.
? Why does calling `loss.backward()` a second time on the same loss raise an error?
+ The graph's saved values were freed by the first backward()
- Gradients can only be computed once per tensor
- The loss became a leaf
- requires_grad was reset to False
= backward() frees the graph to save memory; recompute the forward pass, or use retain_graph=True.
:::

@@@ lesson
id: gradient-descent
title: Gradient descent by hand
minutes: 20
summary: Fitting a line by gradient descent with nothing but tensors and autograd, the update rule w ← w − lr · grad, why weight updates go inside torch.no_grad, zeroing gradients, choosing the learning rate (too small, good, diverging), watching the loss curve, and full-batch versus mini-batch updates.
---
**Gradient descent** is the algorithm behind nearly all deep learning: repeatedly nudge every weight a small step against its gradient.

> w ← w − learning rate × ∂loss/∂w

The **learning rate** (lr) sets the step size. Each repetition is a **step**, or **iteration**.

### Fitting a line

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

```python error
import torch

w = torch.zeros(1, requires_grad=True)
loss = ((w * 3 - 6) ** 2).mean()
loss.backward()
w -= 0.1 * w.grad          # outside torch.no_grad()
```

### The learning rate

Too small and training crawls; too large and every step overshoots the minimum by more than the last, so the loss **diverges** (grows, often to `inf` or `nan`).

![Three panels of the curve loss = (w − 3)² with six gradient-descent steps from w = −1. With lr 0.05 the steps creep down one side; with lr 0.3 they reach the minimum at 3 in a few steps; with lr 1.05 each step jumps further across the valley and the loss grows](figures/gradient-descent.svg)

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

### Watching the loss curve

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

### Full batch versus mini-batches

The loops above compute the loss on **all** the data at every step (full-batch gradient descent). Real datasets are too big for that, so training uses **mini-batches**: each step uses a random subset (often 32 to 512 examples). The gradient is noisier but far cheaper, and the noise even helps escape poor solutions. That's **stochastic gradient descent (SGD)**. One pass through all the batches is an **epoch**. Lesson 5 builds this loop; Part 3 hands the batching to a `DataLoader`.

:::exercise Fit a line by gradient descent
Write `fit_line(x, y, lr, steps)` that starts from `w = 0` and `b = 0` and runs `steps` steps of full-batch gradient descent on the mean squared error of `w * x + b`. Return `(w, b)` as Python floats. Use autograd for the gradients and update inside `torch.no_grad()`.
```python starter
import torch

def fit_line(x, y, lr, steps):
    pass

x = torch.tensor([0.0, 1.0, 2.0, 3.0])
y = torch.tensor([1.0, 3.0, 5.0, 7.0])       # y = 2x + 1 exactly
print(fit_line(x, y, lr=0.2, steps=300))     # close to (2.0, 1.0)
```
```python check
import torch
fn = need("fit_line")
x = torch.tensor([0.0, 1.0, 2.0, 3.0]); y = torch.tensor([1.0, 3.0, 5.0, 7.0])
r = fn(x, y, lr=0.2, steps=300)
assert isinstance(r, tuple) and len(r) == 2 and all(isinstance(v, float) for v in r), f"Return a tuple of two Python floats, got {r!r}."
assert abs(r[0] - 2) < 1e-3 and abs(r[1] - 1) < 1e-3, f"Expected about (2.0, 1.0), got {r}."
w1, b1 = fn(x, y, lr=0.05, steps=1)
assert abs(w1 - 0.85) < 1e-5 and abs(b1 - 0.4) < 1e-5, f"After one step from (0, 0) with lr 0.05 the answer is (0.85, 0.4), got {(w1, b1)}. Check the gradient and the update."
w2, b2 = fn(x, y, lr=0.05, steps=2)
assert abs(w2 - 1.3425) < 1e-4 and abs(b2 - 0.6325) < 1e-4, f"After two steps expected (1.3425, 0.6325), got {(w2, b2)}: are gradients being zeroed each step?"
r = fn(torch.tensor([0.0, 1.0, 2.0]), torch.tensor([1.0, -1.0, -3.0]), lr=0.3, steps=200)
assert abs(r[0] + 2) < 1e-3 and abs(r[1] - 1) < 1e-3, f"For y = -2x + 1, expected about (-2.0, 1.0), got {r}."
```
```python solution
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
hint: Create `w` and `b` as leaves with `requires_grad=True`, starting at 0.
hint: Each step: forward, loss, `loss.backward()`, then inside `torch.no_grad()` subtract `lr * grad`.
hint: Reset gradients every step (`w.grad = None` or `w.grad.zero_()`), and return `w.item(), b.item()`.
approach:
1. **Understand:** the five-line loop from the lesson, packaged as a function.
2. **Examples:** one step from 0: ∂L/∂w = 2·mean((0 − y)·x) = −17 and ∂L/∂b = 2·mean(0 − y) = −8, so w = 0.05 · 17 = 0.85 and b = 0.05 · 8 = 0.4.
3. **Brute force:** solve with the normal equations: exact, but not what training does.
4. **Pattern:** **forward → loss → backward → update in no_grad → zero**.
5. **Plan:** loop `steps` times; return items.
6. **Code and test:** one step and two steps check the update and the zeroing.
walkthrough:
**Line by line**

- `torch.zeros((), requires_grad=True)` makes a 0-D leaf (a shape `[1]` tensor works too).
- `((w * x + b - y) ** 2).mean()` is the mean squared error over the 4 points.
- After `backward()`, `w.grad` is 2·mean((wx + b − y)·x) and `b.grad` is 2·mean(wx + b − y). On the first step (w = b = 0) those are 2 · (−34/4) = −17 and 2 · (−16/4) = −8, giving (0.85, 0.4). The second step's gradients are −9.85 and −4.65, giving (1.3425, 0.6325).
- The in-place updates inside `no_grad` keep `w` and `b` as the same leaf tensors.
- Setting `.grad = None` gives the next step a clean slate; without it the second step would use the sum of two gradients, which the two-step check catches.

**Common wrong approach:** `w = w - lr * w.grad` inside `no_grad`: it replaces `w` with a new tensor that doesn't require grad, so the next `backward()` fails.
:::

:::exercise Find the learning rates that work
For the loss (w − 3)², starting at w = 0, gradient descent converges only for some learning rates. Write `final_w(lr, steps=50)` returning w after `steps` steps (a Python float), and then build `diverges`, a list of the learning rates from `[0.1, 0.5, 0.9, 1.0, 1.1]` for which `abs(final_w(lr) - 3)` is greater than 3 (it ended further from the minimum than it started).
```python starter
import torch

def final_w(lr, steps=50):
    pass

diverges = None
print([round(final_w(lr), 3) for lr in [0.1, 0.5, 0.9, 1.0, 1.1]])
print(diverges)
```
```python check
import torch
fw = need("final_w")
r = fw(0.1)
assert isinstance(r, float), f"final_w should return a float, got {type(r).__name__}."
assert abs(r - 3) < 1e-3, f"With lr 0.1, 50 steps should reach about 3.0, got {r}."
assert abs(fw(0.5) - 3) < 1e-6, "With lr 0.5 the first step lands exactly on 3."
assert abs(fw(1.0) - 0.0) < 1e-6 or abs(fw(1.0) - 6.0) < 1e-6, "With lr 1.0 the weight bounces between 0 and 6."
assert abs(fw(0.1, steps=1) - 0.6) < 1e-6, "One step with lr 0.1 from w = 0 goes to 0.6."
d = need("diverges", list)
assert d == [1.1], f"diverges should be [1.1]: lr 1.0 bounces forever but ends where it started, got {d}."
```
```python solution
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
hint: The loop is the same as before with a single weight: forward, backward, update in `no_grad`, reset.
hint: The gradient of (w − 3)² is 2(w − 3), so each step multiplies the distance to 3 by (1 − 2·lr).
hint: Build `diverges` with a list comprehension over the five learning rates.
approach:
1. **Understand:** run gradient descent for several learning rates and classify the result.
2. **Examples:** lr 0.5: w = 0 − 0.5·2(0 − 3) = 3 in one step.
3. **Brute force:** that's what we do: run each one.
4. **Pattern:** the distance to the minimum is multiplied by **(1 − 2·lr)** each step: it shrinks only when |1 − 2·lr| < 1.
5. **Plan:** a function for one run, a comprehension for the list.
6. **Code and test:** lr 1.0 is the boundary case.
walkthrough:
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
:::

:::quiz
? Why are weight updates written inside `with torch.no_grad():`?
+ So the update isn't recorded in the graph (in-place changes to a leaf that requires grad are an error otherwise)
- So the gradients are zeroed automatically
- To make the update run on the GPU
- To switch dropout off
= The update is not part of the model's computation, so autograd must not record it.
? The loss rises every step and becomes `nan`. What's the most likely cause?
+ The learning rate is too high
- The learning rate is too low
- The gradients were zeroed
- The model has too few parameters
= Steps that overshoot the minimum grow each time, so the loss diverges.
? In `w -= lr * w.grad`, what is the role of the minus sign?
+ It moves w against the gradient, the direction in which the loss decreases
- It undoes the previous step
- It keeps w positive
- It normalises the gradient
= The gradient points uphill; gradient descent steps downhill.
? What is one epoch?
+ One full pass through the training data
- One gradient step
- One mini-batch
- One call to backward()
= With mini-batches, an epoch contains many steps (number of samples ÷ batch size).
? After `with torch.no_grad(): w = w - lr * w.grad`, what goes wrong on the next step?
+ `w` is now a new tensor that doesn't require grad, so the next backward() can't produce `w.grad`
- Nothing; it's the same as `w -= lr * w.grad`
- The learning rate doubles
- The gradient is computed twice
= Assignment creates a new tensor; in-place `-=` updates the original leaf.
:::

@@@ lesson
id: nn-module
title: Building models with nn.Module
minutes: 25
summary: nn.Linear and what y = xWᵀ + b means for shapes, how layers are initialised, nn.Parameter, activation functions, nn.Sequential, writing your own nn.Module with __init__ and forward, calling the model instead of forward, listing and counting parameters, why layers in a plain list are invisible (ModuleList), and moving a model to a device.
---
Writing every weight by hand doesn't scale. `torch.nn` provides **layers** that create and own their weights, and **nn.Module**, the base class for layers and whole models.

### nn.Linear

`nn.Linear(in_features, out_features)` is a fully connected layer: `y = x Wᵀ + b`. It holds a `weight` of shape `[out_features, in_features]` and a `bias` of shape `[out_features]`, and accepts inputs whose **last** dimension is `in_features`, with any number of dimensions before it.

```python
import torch
from torch import nn

torch.manual_seed(0)
layer = nn.Linear(3, 2)               # 3 inputs -> 2 outputs
print(layer)
print(layer.weight.shape, layer.bias.shape)
x = torch.randn(4, 3)                 # a batch of 4 samples
y = layer(x)
print(y.shape)                        # one row of 2 outputs per sample
print(torch.allclose(y, x @ layer.weight.T + layer.bias))
print(layer(torch.randn(5, 7, 3)).shape)   # leading dims are kept
```

The weights start random, not zero: if every weight were equal, every unit would compute the same thing and get the same gradient forever. PyTorch's default for `Linear` draws them uniformly from ±1/√in_features (a scaled **Kaiming** initialisation), so the outputs keep a sensible size however wide the layer is. `torch.nn.init` has the alternatives (`xavier_uniform_`, `kaiming_normal_`, `zeros_`…), Part 4.

Layer weights are **nn.Parameter** objects: tensors that require grad and are registered with the module that owns them.

```python
import torch
from torch import nn

layer = nn.Linear(2, 1)
print(type(layer.weight).__name__, layer.weight.requires_grad, layer.weight.is_leaf)
p = nn.Parameter(torch.zeros(3))
print(p)
```

### Activation functions

Stacking linear layers alone gives just another linear function. **Activation functions** between them add non-linearity, which is what lets a network model curved relationships.

| Layer | Function | Notes |
|---|---|---|
| `nn.ReLU()` | max(0, x) | the default choice for hidden layers |
| `nn.LeakyReLU(0.01)` | x, or 0.01x when negative | avoids "dead" units stuck at 0 |
| `nn.GELU()`, `nn.SiLU()` | smooth ReLU-like curves | standard in transformers |
| `nn.Sigmoid()` | 1 / (1 + e⁻ˣ), between 0 and 1 | for probabilities of yes/no outputs |
| `nn.Tanh()` | between −1 and 1 | |
| `nn.Softmax(dim=1)` | positive values summing to 1 along dim | turns scores into class probabilities |

```python
import torch
from torch import nn

x = torch.tensor([-2.0, -0.5, 0.0, 0.5, 2.0])
for act in (nn.ReLU(), nn.LeakyReLU(0.1), nn.Sigmoid(), nn.Tanh(), nn.GELU()):
    print(f"{act!s:32} {act(x)}")
```

Each also exists as a function in `torch.nn.functional` (usually imported as `F`): `F.relu(x)`, `F.softmax(x, dim=1)`.

### nn.Sequential

For a model that is just a chain of layers, `nn.Sequential` runs them in order:

```python
import torch
from torch import nn

torch.manual_seed(0)
model = nn.Sequential(
    nn.Linear(4, 16),
    nn.ReLU(),
    nn.Linear(16, 3),
)
print(model)
print(model(torch.randn(2, 4)))
print(model[0])                     # index into it like a list
```

### Your own nn.Module

Anything beyond a straight chain (branches, skip connections, several inputs) is a subclass of `nn.Module`:

1. In `__init__`, call `super().__init__()` **first**, then create the layers as attributes.
2. In `forward(self, x)`, describe the computation.
3. Use the model by **calling** it: `model(x)`. That runs `forward` plus PyTorch's hooks; don't call `model.forward(x)` directly.

```python
import torch
from torch import nn
import torch.nn.functional as F

class Classifier(nn.Module):
    def __init__(self, n_in, n_hidden, n_classes):
        super().__init__()
        self.hidden = nn.Linear(n_in, n_hidden)
        self.out = nn.Linear(n_hidden, n_classes)

    def forward(self, x):
        x = F.relu(self.hidden(x))
        return self.out(x)              # raw scores (logits), one per class

torch.manual_seed(0)
model = Classifier(4, 8, 3)
print(model)
logits = model(torch.randn(5, 4))
print(logits.shape)
```

```python error
import torch
from torch import nn

class Broken(nn.Module):
    def __init__(self):
        self.fc = nn.Linear(2, 2)       # forgot super().__init__()

model = Broken()
```

### Parameters

Assigning a layer (or `nn.Parameter`) to an attribute **registers** it, so the module can find every weight: `parameters()` yields them (that's what you give the optimizer), `named_parameters()` adds their names.

```python
import torch
from torch import nn

model = nn.Sequential(nn.Linear(4, 16), nn.ReLU(), nn.Linear(16, 3))
for name, p in model.named_parameters():
    print(f"{name:10} {str(list(p.shape)):10} {p.numel()}")
print("total:", sum(p.numel() for p in model.parameters()))
```

A layer with `in` inputs and `out` outputs has `in × out + out` parameters: here 4 × 16 + 16 = 80 and 16 × 3 + 3 = 51. ReLU has none.

Registration only works for attributes. Layers kept in a plain Python list or dict are invisible to `parameters()`, so the optimizer would never train them. Use `nn.ModuleList` (or `nn.ModuleDict`) instead:

```python
import torch
from torch import nn

class Hidden(nn.Module):
    def __init__(self):
        super().__init__()
        self.layers = [nn.Linear(4, 4) for _ in range(3)]               # a plain list: not registered

class Visible(nn.Module):
    def __init__(self):
        super().__init__()
        self.layers = nn.ModuleList([nn.Linear(4, 4) for _ in range(3)])

    def forward(self, x):
        for layer in self.layers:
            x = torch.relu(layer(x))
        return x

print(len(list(Hidden().parameters())), len(list(Visible().parameters())))
print(Visible())
```

### Moving a model to a device

For a module, `.to(device)` moves every parameter and buffer **in place** and returns the module itself (for tensors it returns a copy). The input data must then go to the same device. Move the model before creating its optimizer.

```python
import torch
from torch import nn

device = "cuda" if torch.cuda.is_available() else "cpu"
model = nn.Linear(3, 1)
model.to(device)                                   # no assignment needed for modules
print(next(model.parameters()).device)
x = torch.randn(2, 3, device=device)
print(model(x).device)
```

:::exercise A two-layer network
Write a class `MLP(nn.Module)` whose constructor takes `n_in`, `n_hidden` and `n_out`, and whose forward pass is: Linear(n_in → n_hidden), ReLU, Linear(n_hidden → n_out). Name the layers `fc1` and `fc2`. Then write `count_params(model)` returning the total number of parameters as an int.
```python starter
import torch
from torch import nn

class MLP(nn.Module):
    pass

def count_params(model):
    pass

model = MLP(10, 32, 2)
print(model)
print(count_params(model))       # 10*32 + 32 + 32*2 + 2 = 418
print(model(torch.randn(5, 10)).shape)
```
```python check
import torch
from torch import nn
MLP = need("MLP"); cp = need("count_params")
m = MLP(10, 32, 2)
assert isinstance(m, nn.Module), "MLP should subclass nn.Module."
assert isinstance(getattr(m, "fc1", None), nn.Linear) and isinstance(getattr(m, "fc2", None), nn.Linear), "Create self.fc1 and self.fc2 as nn.Linear layers."
assert (m.fc1.in_features, m.fc1.out_features, m.fc2.in_features, m.fc2.out_features) == (10, 32, 32, 2), "fc1 should be Linear(10, 32) and fc2 Linear(32, 2) for MLP(10, 32, 2)."
assert cp(m) == 418 and isinstance(cp(m), int), f"count_params should return 418 for MLP(10, 32, 2), got {cp(m)!r}."
assert cp(nn.Linear(3, 1)) == 4, "count_params(nn.Linear(3, 1)) should be 4."
x = torch.randn(6, 10)
out = m(x)
assert out.shape == (6, 2), f"The output for 6 samples should have shape [6, 2], got {list(out.shape)}."
same(out, m.fc2(torch.relu(m.fc1(x))), "the forward pass (fc1, ReLU, fc2)")
m2 = MLP(3, 5, 4)
assert sum(p.numel() for p in m2.parameters()) == 3 * 5 + 5 + 5 * 4 + 4, "All the layers' parameters should be registered."
```
```python solution
import torch
from torch import nn
import torch.nn.functional as F

class MLP(nn.Module):
    def __init__(self, n_in, n_hidden, n_out):
        super().__init__()
        self.fc1 = nn.Linear(n_in, n_hidden)
        self.fc2 = nn.Linear(n_hidden, n_out)

    def forward(self, x):
        return self.fc2(F.relu(self.fc1(x)))

def count_params(model):
    return sum(p.numel() for p in model.parameters())

model = MLP(10, 32, 2)
print(model)
print(count_params(model))
print(model(torch.randn(5, 10)).shape)
```
hint: Start `__init__` with `super().__init__()`, then `self.fc1 = nn.Linear(n_in, n_hidden)` and `self.fc2 = nn.Linear(n_hidden, n_out)`.
hint: `forward(self, x)` returns `self.fc2(torch.relu(self.fc1(x)))`.
hint: `sum(p.numel() for p in model.parameters())` counts every weight and bias.
approach:
1. **Understand:** a Module subclass with two registered layers and a forward pass; a parameter counter.
2. **Examples:** MLP(10, 32, 2) has 10·32 + 32 + 32·2 + 2 = 418 parameters.
3. **Brute force:** compute the count from the sizes by hand: breaks for other architectures.
4. **Pattern:** **layers in `__init__`, computation in `forward`**; count with **parameters()**.
5. **Plan:** write the class, then the counter.
6. **Code and test:** call the model on a batch and check the shape.
walkthrough:
**Line by line**

- `super().__init__()` sets up the module's internal registries; assigning `self.fc1 = nn.Linear(...)` then registers the layer and, through it, its weight and bias.
- `forward` composes the layers: `[batch, n_in] → [batch, n_hidden] → ReLU → [batch, n_out]`. Calling `model(x)` runs it.
- `model.parameters()` yields fc1.weight, fc1.bias, fc2.weight, fc2.bias; `numel()` counts each one's elements.

**Common wrong approach:** creating the layers inside `forward`. They'd be new, random and unregistered on every call, so nothing could ever be trained.
:::

:::exercise Read a layer's shapes
Without running a model, a lot can be worked out from shapes. Write `linear_output_shape(in_shape, layer)` that returns the shape (a tuple) of `layer(x)` for an `nn.Linear` `layer` and an input of shape `in_shape`, or `None` if the call would fail. Use `layer.in_features` and `layer.out_features`; don't call the layer.
```python starter
import torch
from torch import nn

def linear_output_shape(in_shape, layer):
    pass

layer = nn.Linear(8, 3)
print(linear_output_shape((32, 8), layer))       # (32, 3)
print(linear_output_shape((8,), layer))          # (3,)
print(linear_output_shape((4, 5, 8), layer))     # (4, 5, 3)
print(linear_output_shape((32, 3), layer))       # None
```
```python check
import torch
from torch import nn
fn = need("linear_output_shape")
L = nn.Linear(8, 3)
test(fn, cases=[
    (((32, 8), L), (32, 3), "a batch"),
    (((8,), L), (3,), "a single sample"),
    (((4, 5, 8), L), (4, 5, 3), "extra leading dims"),
    (((32, 3), L), None, "the wrong last size"),
    (((8, 32), L), None, "features in the wrong dim"),
    (((), L), None, "a scalar"),
    (((2, 1, 1, 8), nn.Linear(8, 1)), (2, 1, 1, 1), "many leading dims"),
])
assert not uses("layer("), "Work it out from in_features and out_features, without calling the layer."
```
```python solution
import torch
from torch import nn

def linear_output_shape(in_shape, layer):
    if len(in_shape) == 0 or in_shape[-1] != layer.in_features:
        return None
    return tuple(in_shape[:-1]) + (layer.out_features,)

layer = nn.Linear(8, 3)
print(linear_output_shape((32, 8), layer))
print(linear_output_shape((8,), layer))
print(linear_output_shape((4, 5, 8), layer))
print(linear_output_shape((32, 3), layer))
```
hint: Only the **last** size matters: it must equal `in_features`.
hint: Every other size is kept; the last becomes `out_features`.
hint: A scalar input (shape `()`) has no last size: return None.
approach:
1. **Understand:** Linear maps `[..., in] → [..., out]`.
2. **Examples:** (4, 5, 8) → (4, 5, 3).
3. **Brute force:** call the layer and catch errors: not allowed here, and slow for big layers.
4. **Pattern:** **check the last dim, replace it**.
5. **Plan:** guard the empty shape and mismatch; build the tuple.
6. **Code and test:** features in the wrong position must fail.
walkthrough:
**Line by line**

- A shape like `(32, 8)` means 32 samples of 8 features. Linear multiplies the last dimension by Wᵀ, which is `[in_features, out_features]`, so the last size must be `in_features`.
- `tuple(in_shape[:-1]) + (layer.out_features,)` keeps the leading sizes and swaps the last.
- `(8, 32)` fails even though it contains an 8: this is the classic mistake of passing data as `[features, samples]`, and the error PyTorch raises is `mat1 and mat2 shapes cannot be multiplied (8x32 and 8x3)`.

**Common wrong approach:** checking `layer.in_features in in_shape`, which accepts the wrong layout.
:::

:::quiz
? `layer = nn.Linear(20, 5)`. What is `layer.weight.shape`?
+ `torch.Size([5, 20])`
- `torch.Size([20, 5])`
- `torch.Size([5])`
- `torch.Size([20])`
= The weight is [out_features, in_features]; the layer computes x @ weight.T + bias.
? How many parameters does `nn.Linear(100, 10)` have?
+ 1010
- 1000
- 110
- 10
= 100 × 10 weights + 10 biases.
? A model's `__init__` creates its layers but doesn't call `super().__init__()`. What happens?
+ Assigning the first layer raises "cannot assign module before Module.__init__() call"
- The model works but can't be moved to the GPU
- The layers are created but not trained
- Nothing; super().__init__() is optional
= nn.Module's registries are set up by its __init__; without them there's nowhere to register layers.
? A model stores its layers as `self.layers = [nn.Linear(4, 4), nn.Linear(4, 4)]`. What does `list(model.parameters())` return?
+ An empty list: layers in a plain list aren't registered
- The four weight and bias tensors
- Two Linear modules
- It raises an error
= Use nn.ModuleList so the layers (and their parameters) are registered.
? Why call `model(x)` rather than `model.forward(x)`?
+ Calling the module runs forward() together with PyTorch's hooks and bookkeeping
- forward() doesn't exist on nn.Module
- model(x) automatically moves x to the right device
- model(x) disables gradients
= Calling the module (__call__) runs registered hooks around forward().
? What does `model.to("cuda")` return for an `nn.Module`?
+ The same module, whose parameters were moved in place
- A copy of the model on the GPU, leaving the original on the CPU
- None
- A list of moved parameters
= Modules move in place (and return self); tensors' .to() returns a new tensor.
:::

@@@ lesson
id: losses-and-optimizers
title: Losses and optimizers
minutes: 25
summary: Choosing a loss: MSELoss and L1Loss for regression, CrossEntropyLoss for classes (raw logits, int64 labels), BCEWithLogitsLoss for yes/no; reduction; the shape mistakes that broadcast silently; torch.optim with SGD, momentum, Adam and AdamW; weight decay; and the five lines of a training step: forward, loss, zero_grad, backward, step.
---
A **loss function** turns the model's predictions and the true answers into one number to minimise. An **optimizer** uses the gradients to update the parameters. Choosing the right pair is part of the exam's "model development" and "fundamentals" domains.

### Regression losses

| Loss | Formula (mean over elements) | Use when |
|---|---|---|
| `nn.MSELoss()` | (pred − y)² | the default for predicting numbers; punishes big errors hard |
| `nn.L1Loss()` | \|pred − y\| | robust to outliers |
| `nn.HuberLoss(delta=1.0)`, `nn.SmoothL1Loss()` | squared near zero, linear far away | a compromise between the two |

```python
import torch
from torch import nn

pred = torch.tensor([2.5, 0.0, 2.0, 8.0])
y = torch.tensor([3.0, -0.5, 2.0, 7.0])
print(nn.MSELoss()(pred, y))                    # (0.25 + 0.25 + 0 + 1) / 4
print(nn.L1Loss()(pred, y))
print(nn.MSELoss(reduction="sum")(pred, y))     # 'mean' (default), 'sum' or 'none'
print(nn.MSELoss(reduction="none")(pred, y))
```

Watch the shapes. A model with one output produces `[batch, 1]`, while targets are often `[batch]`. Broadcasting turns the subtraction into a `[batch, batch]` table, and the loss is silently wrong. PyTorch warns you; fix it with `pred.squeeze(1)` or `y.unsqueeze(1)`.

```python
import torch
from torch import nn

pred = torch.tensor([[1.0], [2.0], [3.0]])     # [3, 1], like a model's output
y = torch.tensor([1.0, 2.0, 3.0])              # [3]
print(nn.MSELoss()(pred, y))                   # not 0: every pred compared with every y
print(nn.MSELoss()(pred.squeeze(1), y))        # 0, as it should be
```

### Classification: CrossEntropyLoss

For one label out of C classes, the model outputs C raw scores per sample, called **logits** (any real numbers). `nn.CrossEntropyLoss` takes:

- **input:** logits of shape `[batch, C]`. Not probabilities: it applies `log_softmax` itself, so don't add a softmax layer before it.
- **target:** class indices of shape `[batch]`, dtype **int64**, values from 0 to C − 1 (or, less often, class probabilities with the same shape as the input).

It's `log_softmax` followed by the negative log-likelihood (`nn.NLLLoss`): the loss is −log(probability the model gave the right class), averaged over the batch.

```python
import torch
from torch import nn
import torch.nn.functional as F

logits = torch.tensor([[2.0, 0.5, -1.0],      # sample 0: class 0 looks likely
                       [0.1, 0.2, 3.0]])      # sample 1: class 2 looks likely
target = torch.tensor([0, 2])
loss_fn = nn.CrossEntropyLoss()
print(loss_fn(logits, target))
probs = F.softmax(logits, dim=1)
print(probs)
print(-torch.log(probs[[0, 1], target]).mean())   # the same number, by hand
print(loss_fn(logits, torch.tensor([1, 0])))      # wrong labels: a much bigger loss
```

```python error
import torch
from torch import nn

logits = torch.randn(4, 3)
labels = torch.tensor([0.0, 2.0, 1.0, 0.0])      # floats instead of int64
nn.CrossEntropyLoss()(logits, labels)
```

Useful options: `weight=` (a tensor of per-class weights for imbalanced data), `ignore_index=` (a label value to skip, -100 by default), `label_smoothing=0.1` (soften the targets to reduce overconfidence).

### Yes/no outputs: BCEWithLogitsLoss

For binary or **multi-label** problems (each output is an independent yes/no), the model outputs one logit per label and the targets are **floats** of 0.0 and 1.0 with the **same shape**. `nn.BCEWithLogitsLoss` applies the sigmoid and the binary cross-entropy in one numerically stable step. (`nn.BCELoss` expects probabilities after your own sigmoid, and is less stable.) `pos_weight=` up-weights the positive class.

```python
import torch
from torch import nn

logits = torch.tensor([1.5, -0.3, 2.2, -1.0])
target = torch.tensor([1.0, 0.0, 1.0, 1.0])
print(nn.BCEWithLogitsLoss()(logits, target))
print(nn.BCELoss()(torch.sigmoid(logits), target))     # the same value, less stable
```

| Task | Model output | Target | Loss |
|---|---|---|---|
| a number | `[batch, 1]` or `[batch]` | same shape, float | `MSELoss` / `L1Loss` |
| one of C classes | `[batch, C]` logits | `[batch]` int64 | `CrossEntropyLoss` |
| yes/no, or several independent labels | `[batch]` or `[batch, L]` logits | same shape, float 0/1 | `BCEWithLogitsLoss` |

### Optimizers

`torch.optim` implements the update rules. You give an optimizer the parameters and a learning rate; `step()` updates every parameter from its `.grad`, and `zero_grad()` clears the gradients (setting them to `None`).

| Optimizer | Idea | Typical lr |
|---|---|---|
| `optim.SGD(params, lr)` | p ← p − lr · grad | 0.01–0.1 |
| `optim.SGD(params, lr, momentum=0.9)` | keeps a running direction ("velocity"), smoothing noisy steps | 0.01–0.1 |
| `optim.Adam(params, lr=1e-3)` | a step size per parameter, from running averages of the gradient and its square | 1e-4–1e-3 |
| `optim.AdamW(params, lr=1e-3, weight_decay=0.01)` | Adam with **decoupled** weight decay: the usual choice for transformers | 1e-4–1e-3 |

**Weight decay** shrinks weights a little every step, which discourages large weights and reduces overfitting. In SGD and Adam it's added to the gradient (`weight_decay=` is L2 regularisation); AdamW applies it directly to the weights, which works better with Adam's adaptive steps.

```python
import torch
from torch import nn, optim

model = nn.Linear(3, 1)
opt = optim.SGD(model.parameters(), lr=0.1, momentum=0.9)
print(opt)
print(optim.AdamW(model.parameters(), lr=3e-4))
```

### One training step

Every PyTorch training step is the same five lines:

```python
import torch
from torch import nn, optim

torch.manual_seed(0)
model = nn.Linear(3, 1)
loss_fn = nn.MSELoss()
opt = optim.SGD(model.parameters(), lr=0.1)

x = torch.randn(8, 3)
y = x @ torch.tensor([[1.0], [-2.0], [0.5]]) + 0.3    # a target the model can learn

for step in range(5):
    pred = model(x)                 # 1. forward
    loss = loss_fn(pred, y)         # 2. loss
    opt.zero_grad()                 # 3. clear old gradients
    loss.backward()                 # 4. compute new gradients
    opt.step()                      # 5. update the parameters
    print(step, round(loss.item(), 4))
```

The order of `zero_grad()` matters only relative to `backward()`: it must come before it (at the start of the step is common too). `step()` must come after `backward()`, or there are no gradients to use.

:::exercise Pick the loss
Write `make_loss(task)` returning the right loss module for each task: `"regression"` → mean squared error, `"multiclass"` → cross-entropy, `"multilabel"` → binary cross-entropy on logits. Then compute `ce`: the cross-entropy loss (a Python float) for `logits` and `labels` below, after converting `labels` to the dtype the loss needs.
```python starter
import torch
from torch import nn

def make_loss(task):
    pass

logits = torch.tensor([[1.0, 2.0, 0.5], [0.3, 0.1, 2.0], [2.5, 0.0, 0.0]])
labels = torch.tensor([1.0, 2.0, 0.0])      # stored as floats by mistake
ce = None
print(make_loss("multiclass"), ce)
```
```python check
import torch
from torch import nn
ml = need("make_loss")
assert isinstance(ml("regression"), nn.MSELoss), "regression → nn.MSELoss()."
assert isinstance(ml("multiclass"), nn.CrossEntropyLoss), "multiclass → nn.CrossEntropyLoss()."
assert isinstance(ml("multilabel"), nn.BCEWithLogitsLoss), "multilabel → nn.BCEWithLogitsLoss() (logits in, float 0/1 targets)."
ce = need("ce")
logits = torch.tensor([[1.0, 2.0, 0.5], [0.3, 0.1, 2.0], [2.5, 0.0, 0.0]])
expected = nn.CrossEntropyLoss()(logits, torch.tensor([1, 2, 0])).item()
assert isinstance(ce, float), f"ce should be a Python float, got {type(ce).__name__}."
assert abs(ce - expected) < 1e-5, f"ce should be {expected:.4f}, got {ce}. Convert labels with .long() and don't apply softmax first."
```
```python solution
import torch
from torch import nn

def make_loss(task):
    return {"regression": nn.MSELoss(), "multiclass": nn.CrossEntropyLoss(), "multilabel": nn.BCEWithLogitsLoss()}[task]

logits = torch.tensor([[1.0, 2.0, 0.5], [0.3, 0.1, 2.0], [2.5, 0.0, 0.0]])
labels = torch.tensor([1.0, 2.0, 0.0])
ce = make_loss("multiclass")(logits, labels.long()).item()
print(make_loss("multiclass"), ce)
```
hint: A dict from task names to loss modules is enough.
hint: CrossEntropyLoss needs int64 class indices: `labels.long()`.
hint: Pass the raw logits; CrossEntropyLoss applies log_softmax itself. `.item()` gives the float.
approach:
1. **Understand:** match tasks to losses, and fix the target dtype.
2. **Examples:** multiclass → CrossEntropyLoss; targets [1, 2, 0] as int64.
3. **Brute force:** if/elif works just as well.
4. **Pattern:** **task → output shape → target format → loss** (the table in the lesson).
5. **Plan:** a lookup dict; `.long()` on the labels; `.item()` on the loss.
6. **Code and test:** passing float labels raises "expected target dtype to be Long or Byte".
walkthrough:
**Line by line**

- The dict maps each task to a new loss module. Losses have no parameters, so creating one is cheap.
- `labels.long()` converts 1.0, 2.0, 0.0 to the int64 indices 1, 2, 0. With float targets of shape `[3]` (not `[3, 3]`), CrossEntropyLoss refuses them: float targets are only accepted as class probabilities with the same shape as the logits.
- All three samples' highest logit is the correct class, so the loss is fairly small.

**Common wrong approach:** `nn.CrossEntropyLoss()(torch.softmax(logits, 1), labels.long())`: it runs, but applies softmax twice, which squashes the scores and slows learning.
:::

:::exercise Write the training step
Write `train_steps(model, x, y, loss_fn, optimizer, n)` that runs `n` training steps on the full batch `(x, y)` and returns a list of the `n` loss values (Python floats, the loss computed **before** each update).
```python starter
import torch
from torch import nn, optim

def train_steps(model, x, y, loss_fn, optimizer, n):
    pass

torch.manual_seed(0)
model = nn.Linear(2, 1)
x = torch.randn(16, 2)
y = x @ torch.tensor([[3.0], [-1.0]]) + 2
losses = train_steps(model, x, y, nn.MSELoss(), optim.SGD(model.parameters(), lr=0.1), 50)
print(round(losses[0], 3), round(losses[-1], 5))
```
```python check
import torch
from torch import nn, optim
fn = need("train_steps")
torch.manual_seed(0)
m = nn.Linear(2, 1); x = torch.randn(16, 2); y = x @ torch.tensor([[3.0], [-1.0]]) + 2
init = {k: v.clone() for k, v in m.state_dict().items()}
losses = fn(m, x, y, nn.MSELoss(), optim.SGD(m.parameters(), lr=0.1), 50)
assert isinstance(losses, list) and len(losses) == 50, "Return a list with one loss per step."
assert all(isinstance(v, float) for v in losses), "Store each loss as a Python float (.item())."
ref = nn.Linear(2, 1); ref.load_state_dict(init); o = optim.SGD(ref.parameters(), lr=0.1); want = []
for _ in range(50):
    l = nn.MSELoss()(ref(x), y); o.zero_grad(); l.backward(); o.step(); want.append(l.item())
assert abs(losses[0] - want[0]) < 1e-5, f"The first loss should be {want[0]:.4f} (computed before any update), got {losses[0]:.4f}."
assert abs(losses[1] - want[1]) < 1e-4, f"The second loss should be {want[1]:.4f}, got {losses[1]:.4f}: are gradients zeroed every step?"
assert abs(losses[-1] - want[-1]) < 1e-4 and losses[-1] < 0.01, f"After 50 steps the loss should be about {want[-1]:.5f}, got {losses[-1]:.5f}."
```
```python solution
import torch
from torch import nn, optim

def train_steps(model, x, y, loss_fn, optimizer, n):
    losses = []
    for _ in range(n):
        loss = loss_fn(model(x), y)
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        losses.append(loss.item())
    return losses

torch.manual_seed(0)
model = nn.Linear(2, 1)
x = torch.randn(16, 2)
y = x @ torch.tensor([[3.0], [-1.0]]) + 2
losses = train_steps(model, x, y, nn.MSELoss(), optim.SGD(model.parameters(), lr=0.1), 50)
print(round(losses[0], 3), round(losses[-1], 5))
```
hint: The loop body is the five lines: forward, loss, `optimizer.zero_grad()`, `loss.backward()`, `optimizer.step()`.
hint: Append `loss.item()`: a float, not the tensor (which would keep every step's graph alive).
hint: The loss you record is the one computed before `step()` changes the weights.
approach:
1. **Understand:** package the training step in a loop and record losses.
2. **Examples:** the first loss is the untrained model's error.
3. **Brute force:** there is no shortcut: this is the shortcut.
4. **Pattern:** **forward → loss → zero_grad → backward → step**.
5. **Plan:** loop n times, append `loss.item()`.
6. **Code and test:** the loss should fall towards 0, since the data is exactly linear.
walkthrough:
**Line by line**

- `loss_fn(model(x), y)` builds a fresh graph from the current weights.
- `optimizer.zero_grad()` sets every parameter's `.grad` to None, so `backward()` writes fresh gradients instead of adding to the last step's.
- `optimizer.step()` applies p ← p − lr · grad to the weight and bias.
- `losses.append(loss.item())` stores a plain float. Appending the tensor itself would keep each step's computation graph in memory, a classic slow memory leak.

**Common wrong approach:** calling `optimizer.step()` before `loss.backward()`: the first step does nothing (no gradients yet) and every later step uses the previous step's gradients.
:::

:::quiz
? A model outputs logits of shape `[64, 10]` for 10 classes. Which target does `nn.CrossEntropyLoss` expect?
+ An int64 tensor of shape `[64]` with values from 0 to 9
- A float tensor of shape `[64, 1]`
- A one-hot int64 tensor of shape `[64, 10]`
- An int64 tensor of shape `[10]`
= Class indices, one per sample (float class probabilities of shape [64, 10] are also accepted).
? Why shouldn't you apply `softmax` to the model's outputs before `nn.CrossEntropyLoss`?
+ CrossEntropyLoss already applies log_softmax; adding softmax applies it twice
- softmax outputs can't be differentiated
- softmax changes the dtype
- It would make the loss negative
= CrossEntropyLoss expects raw logits.
? Which loss suits a model that predicts several independent yes/no tags per image?
+ `nn.BCEWithLogitsLoss` with float 0/1 targets of shape `[batch, n_tags]`
- `nn.CrossEntropyLoss` with int64 targets
- `nn.MSELoss` on class indices
- `nn.NLLLoss`
= Multi-label: an independent sigmoid per output.
? What does `optimizer.zero_grad()` do by default in current PyTorch?
+ Sets each parameter's `.grad` to `None`
- Sets the learning rate to 0
- Sets every parameter to 0
- Fills each `.grad` with zeros
= set_to_none=True has been the default since PyTorch 2.0; it saves memory.
? `pred` has shape `[32, 1]` and `y` has shape `[32]`. What happens with `nn.MSELoss()(pred, y)`?
+ It broadcasts to `[32, 32]`, gives a wrong loss, and warns about different sizes
- It raises a shape error
- It computes the right loss
- It squeezes pred automatically
= Fix the shapes with pred.squeeze(1) or y.unsqueeze(1).
? What does AdamW change compared with Adam?
+ Weight decay is applied directly to the weights (decoupled) instead of being added to the gradient
- It doesn't use momentum
- It uses a fixed step size for all parameters
- It has no learning rate
= Decoupled weight decay works better with adaptive step sizes; AdamW's default weight_decay is 0.01.
:::

@@@ lesson
id: training-loop
title: The training and evaluation loop
minutes: 30
summary: Splitting data into training and validation sets, epochs and shuffled mini-batches, a complete classification training loop, model.train() and model.eval() and what they change (dropout, batch norm), evaluating under torch.no_grad, accuracy, reading training and validation curves, overfitting, keeping the best weights, and running the loop on a GPU.
---
A full training run repeats the training step over **mini-batches** for several **epochs**, and regularly checks the model on data it doesn't train on.

![The five steps in a cycle: 1 forward (pred = model(x)), 2 loss (loss = loss_fn(pred, y)), 3 zero_grad, 4 backward, 5 step; repeat for every batch, and one pass over the data is an epoch. model.train() first; evaluate with model.eval() and torch.no_grad()](figures/training-loop.svg)

### Training, validation and test data

- The **training set** is what the optimizer learns from.
- The **validation set** is held out to measure how well the model **generalises** while you choose settings (learning rate, epochs, model size).
- A **test set**, used once at the very end, gives an unbiased final score.

A model that does much better on training data than on validation data has **overfitted**: it memorised the training examples instead of learning the pattern.

### A complete loop

The data: points from two overlapping clouds, labelled 0 and 1, plus a third class.

```python
import torch
from torch import nn, optim

torch.manual_seed(0)
n = 600
centers = torch.tensor([[0.0, 0.0], [2.0, 2.0], [0.0, 2.5]])
y_all = torch.randint(0, 3, (n,))
x_all = centers[y_all] + torch.randn(n, 2)            # each point near its class centre

perm = torch.randperm(n)                              # shuffle before splitting
train_idx, val_idx = perm[:480], perm[480:]
x_train, y_train = x_all[train_idx], y_all[train_idx]
x_val, y_val = x_all[val_idx], y_all[val_idx]

model = nn.Sequential(nn.Linear(2, 32), nn.ReLU(), nn.Linear(32, 3))
loss_fn = nn.CrossEntropyLoss()
opt = optim.Adam(model.parameters(), lr=0.01)
batch_size = 32

def evaluate(x, y):
    model.eval()
    with torch.no_grad():
        logits = model(x)
        loss = loss_fn(logits, y).item()
        acc = (logits.argmax(dim=1) == y).float().mean().item()
    return loss, acc

for epoch in range(1, 11):
    model.train()
    order = torch.randperm(len(x_train))              # a new order every epoch
    for i in range(0, len(x_train), batch_size):
        idx = order[i:i + batch_size]
        xb, yb = x_train[idx], y_train[idx]
        loss = loss_fn(model(xb), yb)
        opt.zero_grad()
        loss.backward()
        opt.step()
    if epoch in (1, 2, 5, 10):
        tl, ta = evaluate(x_train, y_train)
        vl, va = evaluate(x_val, y_val)
        print(f"epoch {epoch:2d}  train loss {tl:.3f} acc {ta:.2f}  |  val loss {vl:.3f} acc {va:.2f}")
```

Key details:

- **Shuffle every epoch** (`torch.randperm`), so batches differ each time and the model can't learn the order.
- The last batch may be smaller (480 / 32 is exact here, but often it isn't); that's fine.
- `evaluate` switches to **eval mode** and **no_grad**, and the loop switches back with `model.train()` at the start of every epoch.
- Accuracy is `argmax` of the logits compared with the labels.

### model.train() and model.eval()

Some layers behave differently while training:

| Layer | `model.train()` | `model.eval()` |
|---|---|---|
| `nn.Dropout(p)` | zeroes a random fraction p of values, scales the rest by 1/(1 − p) | does nothing |
| `nn.BatchNorm1d/2d` | normalises with the batch's statistics and updates running averages | uses the stored running averages |
| everything else (Linear, ReLU…) | same | same |

`model.eval()` sets the `training` flag on the model and every submodule; `model.train()` sets it back. **Neither affects autograd**: eval mode still records graphs unless you also use `torch.no_grad()` (or `inference_mode()`). Forgetting `eval()` gives random predictions (dropout) or predictions that depend on the rest of the batch (batch norm); forgetting `no_grad` wastes memory and time.

```python
import torch
from torch import nn

torch.manual_seed(0)
drop = nn.Dropout(p=0.5)
x = torch.ones(8)
print(drop.training, drop(x))         # training: about half zeroed, the rest doubled
drop.eval()
print(drop.training, drop(x))         # eval: unchanged

bn = nn.BatchNorm1d(2)
batch = torch.tensor([[1.0, 10.0], [2.0, 25.0], [6.0, 55.0]])
print(bn(batch))                      # training: normalised with this batch's mean and variance
print(bn.running_mean)                # moved 10% towards the batch mean
bn.eval()
print(bn(torch.tensor([[3.0, 30.0]])))   # eval: uses the running averages
```

(The dropout pattern in this sandbox differs from real PyTorch's: PyTorch's CPU dropout uses a different random-number routine. Which elements are dropped is random either way.)

### Reading the curves

![Training loss falls steadily over 40 epochs. Validation loss falls at first, reaches its lowest point around epoch 19 (best epoch: save this checkpoint), then rises while training loss keeps falling: overfitting](figures/train-val-curves.svg)

| What you see | Likely meaning | Try |
|---|---|---|
| both losses high and flat | **underfitting**, or the learning rate is too low | a bigger model, more epochs, a higher lr |
| training falls, validation rises | **overfitting** | more data, weight decay, dropout, fewer epochs (early stopping) |
| loss jumps to `nan` or explodes | the learning rate is too high, or bad data | lower lr, gradient clipping, check inputs |
| training loss noisy but falling | normal with mini-batches | nothing |

**Early stopping:** keep the weights from the epoch with the best validation score. A model's `state_dict()` shares memory with its parameters, so save a **copy** (`copy.deepcopy`), not the live dict (lesson 6).

### On a GPU

The loop is identical on a GPU; only two things move: the model (once, before creating the optimizer) and each batch.

```python
import torch
from torch import nn, optim

device = "cuda" if torch.cuda.is_available() else "cpu"
torch.manual_seed(0)
x = torch.randn(256, 4)
y = (x.sum(dim=1) > 0).long()

model = nn.Sequential(nn.Linear(4, 16), nn.ReLU(), nn.Linear(16, 2)).to(device)
opt = optim.SGD(model.parameters(), lr=0.5)
for epoch in range(20):
    for i in range(0, 256, 64):
        xb, yb = x[i:i + 64].to(device), y[i:i + 64].to(device)   # move each batch
        loss = nn.functional.cross_entropy(model(xb), yb)
        opt.zero_grad()
        loss.backward()
        opt.step()
model.eval()
with torch.no_grad():
    acc = (model(x.to(device)).argmax(1) == y.to(device)).float().mean()
print(device, f"accuracy {acc.item():.2f}")
```

:::exercise Evaluate a model
Write `evaluate(model, x, y, loss_fn)` that returns `(mean_loss, accuracy)` as Python floats for a classification model, computed in **eval mode** without recording a graph. It must leave the model in the mode it was in before (so it can be called in the middle of training).
```python starter
import torch
from torch import nn

def evaluate(model, x, y, loss_fn):
    pass

torch.manual_seed(0)
model = nn.Sequential(nn.Linear(3, 8), nn.Dropout(0.5), nn.ReLU(), nn.Linear(8, 2))
x = torch.randn(20, 3)
y = torch.randint(0, 2, (20,))
print(evaluate(model, x, y, nn.CrossEntropyLoss()))
print(model.training)
```
```python check
import torch
from torch import nn
ev = need("evaluate")
torch.manual_seed(1)
m = nn.Sequential(nn.Linear(3, 8), nn.Dropout(0.5), nn.ReLU(), nn.Linear(8, 2))
x = torch.randn(20, 3); y = torch.randint(0, 2, (20,))
m.eval()
with torch.no_grad():
    lg = m(x); want_loss = nn.CrossEntropyLoss()(lg, y).item(); want_acc = (lg.argmax(1) == y).float().mean().item()
m.train()
r = ev(m, x, y, nn.CrossEntropyLoss())
assert isinstance(r, tuple) and len(r) == 2 and all(isinstance(v, float) for v in r), f"Return (loss, accuracy) as two Python floats, got {r!r}."
assert abs(r[0] - want_loss) < 1e-5, f"The loss should be {want_loss:.4f} (in eval mode, so dropout is off), got {r[0]:.4f}."
assert abs(r[1] - want_acc) < 1e-6, f"The accuracy should be {want_acc:.2f}, got {r[1]:.2f}."
assert m.training, "The model was in training mode before; evaluate should put it back with model.train()."
m.eval(); ev(m, x, y, nn.CrossEntropyLoss())
assert not m.training, "A model that was in eval mode should stay in eval mode."
assert uses("no_grad") or uses("inference_mode"), "Evaluate inside torch.no_grad() (or torch.inference_mode())."
```
```python solution
import torch
from torch import nn

def evaluate(model, x, y, loss_fn):
    was_training = model.training
    model.eval()
    with torch.no_grad():
        logits = model(x)
        loss = loss_fn(logits, y).item()
        acc = (logits.argmax(dim=1) == y).float().mean().item()
    model.train(was_training)
    return loss, acc

torch.manual_seed(0)
model = nn.Sequential(nn.Linear(3, 8), nn.Dropout(0.5), nn.ReLU(), nn.Linear(8, 2))
x = torch.randn(20, 3)
y = torch.randint(0, 2, (20,))
print(evaluate(model, x, y, nn.CrossEntropyLoss()))
print(model.training)
```
hint: Remember the mode first: `was_training = model.training`.
hint: `model.eval()`, then compute inside `with torch.no_grad():`.
hint: Restore with `model.train(was_training)` (train(False) is the same as eval()).
approach:
1. **Understand:** an evaluation helper that's safe to call during training.
2. **Examples:** called on a model in training mode, it returns with the model still in training mode.
3. **Brute force:** always calling `model.train()` at the end breaks callers that were in eval mode.
4. **Pattern:** **save state → change → restore**.
5. **Plan:** store `model.training`, eval + no_grad, compute, restore.
6. **Code and test:** the dropout layer would make results random if eval() were missing.
walkthrough:
**Line by line**

- `model.training` is the flag that `train()` and `eval()` set (on the model and every submodule).
- In eval mode the Dropout layer passes values through unchanged, so the result is deterministic.
- `torch.no_grad()` stops autograd from building a graph you'd never use.
- `model.train(was_training)` restores whichever mode the caller had.

**Common wrong approach:** relying on `torch.no_grad()` alone. It stops gradient tracking but leaves dropout active, so the "evaluation" is randomly perturbed and lower than it should be.
:::

:::exercise Train with early stopping
Write `fit(model, train, val, epochs, lr)` where `train` and `val` are `(x, y)` pairs for classification. Each epoch: train on the full training batch once (Adam, cross-entropy), then compute the validation loss in eval mode without grad. Keep a **copy** of the `state_dict` with the lowest validation loss, load it back into the model at the end, and return the best epoch number (1-based).
```python starter
import copy
import torch
from torch import nn, optim

def fit(model, train, val, epochs, lr):
    pass

torch.manual_seed(0)
x = torch.randn(60, 5); y = (x[:, 0] > 0).long()
model = nn.Sequential(nn.Linear(5, 64), nn.ReLU(), nn.Linear(64, 2))
best = fit(model, (x[:20], y[:20]), (x[20:], y[20:]), epochs=60, lr=0.05)
print("best epoch:", best)
```
```python check
import copy
import torch
from torch import nn, optim
fit = need("fit")
torch.manual_seed(0)
x = torch.randn(60, 5); y = (x[:, 0] > 0).long()
torch.manual_seed(1)
m = nn.Sequential(nn.Linear(5, 64), nn.ReLU(), nn.Linear(64, 2))
init = copy.deepcopy(m.state_dict())
best = fit(m, (x[:20], y[:20]), (x[20:], y[20:]), epochs=40, lr=0.05)
ref = nn.Sequential(nn.Linear(5, 64), nn.ReLU(), nn.Linear(64, 2)); ref.load_state_dict(init)
o = optim.Adam(ref.parameters(), lr=0.05); vals = []; snaps = []
for e in range(40):
    ref.train(); l = nn.functional.cross_entropy(ref(x[:20]), y[:20]); o.zero_grad(); l.backward(); o.step()
    ref.eval()
    with torch.no_grad():
        vals.append(nn.functional.cross_entropy(ref(x[20:]), y[20:]).item())
    snaps.append(copy.deepcopy(ref.state_dict()))
want = min(range(40), key=lambda i: vals[i]) + 1
assert isinstance(best, int), f"Return the best epoch as an int, got {best!r}."
assert best == want, f"The validation loss is lowest after epoch {want}, but fit returned {best}."
for k, v in snaps[want - 1].items():
    assert torch.allclose(m.state_dict()[k], v, atol=1e-5), f"The model should end with the weights from epoch {want} ({k} differs). Did you deepcopy the state_dict?"
```
```python solution
import copy
import torch
from torch import nn, optim

def fit(model, train, val, epochs, lr):
    opt = optim.Adam(model.parameters(), lr=lr)
    loss_fn = nn.CrossEntropyLoss()
    best_loss, best_epoch, best_state = float("inf"), 0, None
    for epoch in range(1, epochs + 1):
        model.train()
        loss = loss_fn(model(train[0]), train[1])
        opt.zero_grad()
        loss.backward()
        opt.step()
        model.eval()
        with torch.no_grad():
            val_loss = loss_fn(model(val[0]), val[1]).item()
        if val_loss < best_loss:
            best_loss, best_epoch = val_loss, epoch
            best_state = copy.deepcopy(model.state_dict())
    model.load_state_dict(best_state)
    return best_epoch

torch.manual_seed(0)
x = torch.randn(60, 5); y = (x[:, 0] > 0).long()
model = nn.Sequential(nn.Linear(5, 64), nn.ReLU(), nn.Linear(64, 2))
best = fit(model, (x[:20], y[:20]), (x[20:], y[20:]), epochs=60, lr=0.05)
print("best epoch:", best)
```
hint: Create the optimizer and loss once, before the epoch loop.
hint: After each epoch's update, compute the validation loss under `model.eval()` and `torch.no_grad()`.
hint: When it's the best so far, store `copy.deepcopy(model.state_dict())`; at the end, `model.load_state_dict(best_state)`.
approach:
1. **Understand:** train, validate each epoch, remember the best weights, restore them.
2. **Examples:** with only 20 training points and a big hidden layer, validation loss bottoms out and then rises.
3. **Brute force:** save every epoch's weights and pick at the end: works, but wastes memory.
4. **Pattern:** **early stopping with the best checkpoint**.
5. **Plan:** optimizer, loop, validate, deepcopy on improvement, load at the end.
6. **Code and test:** check the returned weights equal the best epoch's.
walkthrough:
**Line by line**

- One full-batch training step per epoch keeps the example small; with mini-batches the structure is the same.
- `model.eval()` and `torch.no_grad()` make the validation loss deterministic and cheap.
- `copy.deepcopy(model.state_dict())` copies the tensors. `model.state_dict()` alone returns tensors that **share memory** with the parameters, so the "best" snapshot would keep changing as training continued and you'd restore the final weights.
- `model.load_state_dict(best_state)` copies the saved values back into the model's parameters.

**Common wrong approach:** `best_state = model.state_dict()`. The check catches it: the model ends with the last epoch's weights instead of the best ones.
:::

:::quiz
? What does `model.eval()` change?
+ The behaviour of layers like Dropout and BatchNorm
- It turns off gradient tracking
- It freezes the parameters so the optimizer can't change them
- It moves the model to the CPU
= eval() sets training=False on every submodule; use torch.no_grad() to stop gradient tracking.
? A model with dropout gets slightly different validation accuracy every time you evaluate it. What's the most likely bug?
+ The evaluation runs without `model.eval()`
- The evaluation runs inside `torch.no_grad()`
- The learning rate is too high
- The validation data isn't shuffled
= In training mode, dropout randomly zeroes activations on every call.
? Training loss keeps falling but validation loss has been rising for 10 epochs. What is happening?
+ Overfitting: keep the weights from the best validation epoch, add regularisation, or get more data
- Underfitting: train for longer
- The learning rate is too low
- The validation set is too big
= The model is memorising the training data.
? Why should the training data be reshuffled every epoch?
+ So mini-batches differ each epoch and the model can't learn from the order of the data
- So the validation set changes
- Because PyTorch requires it
- To make training deterministic
= Fresh random batches give better gradient estimates and generalisation.
? You keep `best = model.state_dict()` when validation improves, and load it at the end. What goes wrong?
+ The state_dict shares memory with the live parameters, so `best` ends up holding the final weights
- Nothing; this is correct
- load_state_dict rejects dicts from the same model
- state_dict() only contains buffers
= Copy it with copy.deepcopy (or clone each tensor).
? A BatchNorm model raises "Expected more than 1 value per channel when training" when predicting one sample. What fixes it?
+ Calling `model.eval()` before predicting
- Wrapping the call in `torch.no_grad()`
- Converting the input to float64
- Lowering the learning rate
= In training mode, batch norm needs batch statistics; eval mode uses the running averages.
:::

@@@ lesson
id: saving-and-loading
title: Saving, loading and using a model
minutes: 20
summary: state_dict for models and optimizers, torch.save and torch.load, weights_only=True by default (since PyTorch 2.6) and why, saving a whole model versus its state_dict, load_state_dict with strict and size mismatches, checkpoints for resuming training, map_location for loading GPU checkpoints on a CPU, and making predictions with eval, no_grad, softmax and argmax.
---
Training can take hours or days. You **save** the result so you can use the model later, share it, or resume training if it's interrupted.

### state_dict

A model's `state_dict()` is an ordered dict from parameter (and buffer) names to tensors: all the numbers that make up the trained model, and nothing else.

```python
import torch
from torch import nn

torch.manual_seed(0)
model = nn.Sequential(nn.Linear(2, 3), nn.ReLU(), nn.Linear(3, 1))
sd = model.state_dict()
for name, t in sd.items():
    print(name, tuple(t.shape))
print(sd["0.bias"])                 # detached: no requires_grad
print(nn.BatchNorm1d(3).state_dict().keys())   # buffers are included too
```

Optimizers have one as well: their settings and per-parameter state (momentum buffers, Adam's running averages).

### torch.save and torch.load

`torch.save(obj, path)` pickles any object of tensors, dicts, lists and numbers to a file (`.pt` or `.pth` by convention). `torch.load(path)` reads it back. The recommended way to save a model is to save its **state_dict** and, to load, build the same architecture and call `load_state_dict`:

```python
import torch
from torch import nn

def make_model():
    return nn.Sequential(nn.Linear(2, 3), nn.ReLU(), nn.Linear(3, 1))

torch.manual_seed(0)
trained = make_model()
torch.save(trained.state_dict(), "model.pt")

restored = make_model()                     # same architecture, new random weights
print(restored.load_state_dict(torch.load("model.pt")))
x = torch.tensor([[0.5, -1.0]])
print(trained(x), restored(x))              # identical
```

### weights_only: why loading a whole model fails

`torch.save(model, path)` also works: it pickles the whole object, including a reference to its class. But since **PyTorch 2.6, `torch.load` uses `weights_only=True` by default**. It only unpickles tensors and plain containers, because unpickling arbitrary objects can run arbitrary code: a malicious `.pt` file could take over your computer. Loading a whole model therefore fails:

```python error
import torch
from torch import nn

torch.save(nn.Linear(2, 1), "whole.pt")
model = torch.load("whole.pt")
```

You can pass `weights_only=False` for files **you trust**, but saving the state_dict avoids the problem and also survives renaming or moving your model's code. Loading a whole pickled model needs the class to be importable under the same name, which breaks easily.

### load_state_dict checks the keys and shapes

`load_state_dict` fails loudly if the names or shapes don't match the model, which catches loading weights into the wrong architecture. It returns the missing and unexpected keys. `strict=False` allows missing or extra keys (useful when reusing part of a model), but never a shape mismatch.

```python
import torch
from torch import nn

small = nn.Sequential(nn.Linear(4, 8), nn.ReLU(), nn.Linear(8, 2))
bigger = nn.Sequential(nn.Linear(4, 8), nn.ReLU(), nn.Linear(8, 2), nn.ReLU(), nn.Linear(2, 2))
try:
    bigger.load_state_dict(small.state_dict())
except RuntimeError as e:
    print(e)
print(bigger.load_state_dict(small.state_dict(), strict=False))

wrong = nn.Sequential(nn.Linear(4, 16), nn.ReLU(), nn.Linear(16, 2))
try:
    wrong.load_state_dict(small.state_dict())
except RuntimeError as e:
    print(str(e).splitlines()[1])
```

### Checkpoints: resuming training

To resume training exactly where it stopped, you need more than the weights: the optimizer state (Adam's averages, momentum), the epoch, and anything else your loop tracks. A **checkpoint** is a dict of all of them:

```python
import torch
from torch import nn, optim

torch.manual_seed(0)
model = nn.Linear(3, 1)
opt = optim.Adam(model.parameters(), lr=0.01)
x, y = torch.randn(16, 3), torch.randn(16, 1)
for epoch in range(3):
    loss = nn.functional.mse_loss(model(x), y)
    opt.zero_grad()
    loss.backward()
    opt.step()

torch.save({
    "epoch": epoch,
    "model_state_dict": model.state_dict(),
    "optimizer_state_dict": opt.state_dict(),
    "loss": loss.item(),
}, "checkpoint.pt")

# ... later, in a new program:
ckpt = torch.load("checkpoint.pt")
model2 = nn.Linear(3, 1)
opt2 = optim.Adam(model2.parameters(), lr=0.01)
model2.load_state_dict(ckpt["model_state_dict"])
opt2.load_state_dict(ckpt["optimizer_state_dict"])
start_epoch = ckpt["epoch"] + 1
print(start_epoch, round(ckpt["loss"], 4), list(opt2.state_dict()["state"][0]))
```

After restoring, call `model.train()` to continue training (or `model.eval()` to use it).

### Loading on a different device

Tensors are saved with their device. A checkpoint saved from a GPU won't load on a machine without one unless you **map** it: `torch.load(path, map_location="cpu")`, or `map_location=device` to load straight onto whatever device you're using. `load_state_dict` then copies the values into the model's parameters wherever the model lives.

```python
import torch
from torch import nn

gpu_model = nn.Linear(2, 2).to("cuda")
torch.save(gpu_model.state_dict(), "gpu.pt")
sd = torch.load("gpu.pt", map_location="cpu")
print(sd["weight"].device)
cpu_model = nn.Linear(2, 2)
cpu_model.load_state_dict(torch.load("gpu.pt", map_location="cpu"))
print(next(cpu_model.parameters()).device)
```

### Using a trained model

To make predictions ("inference"): put the model in **eval mode**, turn off gradient tracking, feed a **batch** (add a batch dimension for a single sample), and turn the logits into an answer.

```python
import torch
from torch import nn

torch.manual_seed(0)
model = nn.Sequential(nn.Linear(4, 16), nn.ReLU(), nn.Linear(16, 3))
classes = ["cat", "dog", "bird"]

model.eval()
sample = torch.tensor([0.2, -1.0, 0.5, 0.3])        # one sample: shape [4]
with torch.inference_mode():
    logits = model(sample.unsqueeze(0))              # a batch of one: [1, 4] -> [1, 3]
    probs = torch.softmax(logits, dim=1)
    pred = probs.argmax(dim=1).item()
print(probs)
print(classes[pred], f"{probs[0, pred].item():.1%}")
```

`softmax` is only needed when you want probabilities; `argmax` of the raw logits gives the same predicted class.

:::exercise Save and restore a model
Write `save_model(model, path)` that saves only the model's state_dict, and `load_model(path, make_model)` that builds a fresh model with the function `make_model()`, loads the saved weights into it, puts it in eval mode, and returns it.
```python starter
import torch
from torch import nn

def save_model(model, path):
    pass

def load_model(path, make_model):
    pass

def make_model():
    return nn.Sequential(nn.Linear(3, 4), nn.Tanh(), nn.Linear(4, 1))

torch.manual_seed(0)
m = make_model()
save_model(m, "m.pt")
m2 = load_model("m.pt", make_model)
x = torch.randn(2, 3)
print(torch.equal(m(x), m2(x)), m2.training)
```
```python check
import torch
from torch import nn
sv = need("save_model"); ld = need("load_model")
def mk():
    return nn.Sequential(nn.Linear(3, 4), nn.Tanh(), nn.Linear(4, 1))
torch.manual_seed(5)
m = mk(); sv(m, "check_model.pt")
raw = torch.load("check_model.pt", weights_only=False)
assert isinstance(raw, dict) and set(raw) == {"0.weight", "0.bias", "2.weight", "2.bias"}, "save_model should save model.state_dict() (a dict of tensors), not the whole model."
torch.manual_seed(9)
m2 = ld("check_model.pt", mk)
assert isinstance(m2, nn.Module), "load_model should return the model."
x = torch.randn(4, 3)
assert torch.equal(m(x), m2(x)), "The loaded model should give exactly the same outputs as the saved one."
assert not m2.training, "load_model should put the model in eval mode."
```
```python solution
import torch
from torch import nn

def save_model(model, path):
    torch.save(model.state_dict(), path)

def load_model(path, make_model):
    model = make_model()
    model.load_state_dict(torch.load(path))
    model.eval()
    return model

def make_model():
    return nn.Sequential(nn.Linear(3, 4), nn.Tanh(), nn.Linear(4, 1))

torch.manual_seed(0)
m = make_model()
save_model(m, "m.pt")
m2 = load_model("m.pt", make_model)
x = torch.randn(2, 3)
print(torch.equal(m(x), m2(x)), m2.training)
```
hint: `torch.save(model.state_dict(), path)`.
hint: Loading: `model = make_model()`, then `model.load_state_dict(torch.load(path))`.
hint: Finish with `model.eval()` and return the model (`eval()` also returns it).
approach:
1. **Understand:** the recommended save/load pattern, wrapped in two functions.
2. **Examples:** the reloaded model gives identical outputs.
3. **Brute force:** `torch.save(model, path)`: then loading needs `weights_only=False`.
4. **Pattern:** **save the state_dict; rebuild, load, eval**.
5. **Plan:** one line to save; four lines to load.
6. **Code and test:** compare outputs on new data.
walkthrough:
**Line by line**

- `model.state_dict()` holds the four tensors `0.weight`, `0.bias`, `2.weight`, `2.bias` (the Tanh at index 1 has none). `torch.save` pickles that dict.
- `make_model()` creates the same architecture with random weights; `load_state_dict` overwrites them, checking every name and shape.
- `torch.load(path)` works with the default `weights_only=True`, because the file only holds tensors in a dict.
- `model.eval()` is the right default for a model loaded for use; call `train()` if you're going to continue training.

**Common wrong approach:** `model.load_state_dict(path)`: it expects the dict, not a file path. Load the file first with `torch.load`.
:::

:::exercise Predict with a trained model
Write `predict(model, x, class_names)` that takes a single sample `x` (a 1-D tensor) **or** a batch (2-D), and returns a list of `(class_name, probability)` pairs, one per sample, where probability is a Python float rounded to 3 decimals. Run the model in eval mode without gradients and leave the model in eval mode.
```python starter
import torch
from torch import nn

def predict(model, x, class_names):
    pass

torch.manual_seed(0)
model = nn.Sequential(nn.Linear(2, 8), nn.ReLU(), nn.Dropout(0.3), nn.Linear(8, 3))
print(predict(model, torch.tensor([0.5, -0.2]), ["low", "mid", "high"]))
print(predict(model, torch.tensor([[0.5, -0.2], [2.0, 1.0]]), ["low", "mid", "high"]))
```
```python check
import torch
from torch import nn
pr = need("predict")
torch.manual_seed(3)
m = nn.Sequential(nn.Linear(2, 8), nn.ReLU(), nn.Dropout(0.3), nn.Linear(8, 3))
names = ["low", "mid", "high"]
xb = torch.tensor([[0.5, -0.2], [2.0, 1.0], [-1.0, 0.0]])
m.eval()
with torch.no_grad():
    p = torch.softmax(m(xb), dim=1)
want = [(names[i], round(p[k, i].item(), 3)) for k, i in enumerate(p.argmax(1).tolist())]
m.train()
got = pr(m, xb, names)
assert isinstance(got, list) and len(got) == 3, f"A batch of 3 should give a list of 3 pairs, got {got!r}."
assert [g[0] for g in got] == [w[0] for w in want], f"Predicted classes should be {[w[0] for w in want]}, got {[g[0] for g in got]}. Is the model in eval mode?"
assert all(isinstance(g[1], float) and abs(g[1] - w[1]) < 1e-9 for g, w in zip(got, want)), f"Probabilities should be {[w[1] for w in want]} (softmax, rounded to 3 decimals), got {[g[1] for g in got]}."
assert not m.training, "Leave the model in eval mode."
one = pr(m, xb[1], names)
assert one == [want[1]], f"A single 1-D sample should give a list with one pair, {[want[1]]}, got {one!r}."
assert uses("no_grad") or uses("inference_mode"), "Predict inside torch.no_grad() or torch.inference_mode()."
```
```python solution
import torch
from torch import nn

def predict(model, x, class_names):
    if x.dim() == 1:
        x = x.unsqueeze(0)
    model.eval()
    with torch.inference_mode():
        probs = torch.softmax(model(x), dim=1)
    best = probs.argmax(dim=1)
    return [(class_names[i], round(probs[k, i].item(), 3)) for k, i in enumerate(best.tolist())]

torch.manual_seed(0)
model = nn.Sequential(nn.Linear(2, 8), nn.ReLU(), nn.Dropout(0.3), nn.Linear(8, 3))
print(predict(model, torch.tensor([0.5, -0.2]), ["low", "mid", "high"]))
print(predict(model, torch.tensor([[0.5, -0.2], [2.0, 1.0]]), ["low", "mid", "high"]))
```
hint: A 1-D sample needs a batch dimension: `x.unsqueeze(0)`.
hint: `model.eval()`, then inside `torch.inference_mode()` (or `no_grad`) compute `torch.softmax(model(x), dim=1)`.
hint: `probs.argmax(dim=1)` gives each sample's class index; read the probability at `probs[k, i]`.
approach:
1. **Understand:** a prediction helper: shape handling, inference mode, probabilities and labels.
2. **Examples:** a batch of 2 gives two (name, probability) pairs.
3. **Brute force:** call the model once per sample in a loop: slower and needs the same care.
4. **Pattern:** **add batch dim → eval → inference_mode → softmax → argmax**.
5. **Plan:** unsqueeze if 1-D; compute; build the list.
6. **Code and test:** the model has dropout, so predictions are random unless eval() is called.
walkthrough:
**Line by line**

- Models expect a batch dimension: a `[2]` sample becomes `[1, 2]`.
- `model.eval()` switches the Dropout layer off, so predictions are deterministic.
- `torch.inference_mode()` skips all autograd bookkeeping; the results can't be used for training, which is fine here.
- `softmax(dim=1)` turns each row of logits into probabilities summing to 1; `argmax(dim=1)` picks the most likely class per row.
- `round(..., 3)` on the Python float gives three decimals.

**Common wrong approach:** forgetting the batch dimension. `nn.Linear` accepts a 1-D input, but `softmax(dim=1)` on a 1-D result raises "Dimension out of range".
:::

:::quiz
? What is the recommended way to save a trained model for later use?
+ `torch.save(model.state_dict(), "model.pt")`
- `torch.save(model, "model.pt")`
- `pickle.dump(model.parameters(), f)`
- `model.save("model.pt")`
= Save the state_dict; rebuild the architecture in code and load_state_dict to restore it.
? Since PyTorch 2.6, `torch.load("whole_model.pt")` on a file made with `torch.save(model, ...)` raises an error. Why?
+ torch.load defaults to weights_only=True, which refuses to unpickle arbitrary classes for security
- Whole models can't be saved in PyTorch 2.6
- The file must be loaded with model.load()
- The model must be on the GPU
= Pass weights_only=False only for files you trust, or save state_dicts instead.
? A checkpoint was saved on a GPU machine. How do you load it on a laptop without a GPU?
+ `torch.load(path, map_location="cpu")`
- `torch.load(path).cpu()`
- `torch.load(path, device="cpu")`
- It can't be done
= map_location remaps the stored tensors' devices while loading.
? To resume training exactly, what should a checkpoint contain besides the model's state_dict?
+ The optimizer's state_dict (and the epoch and other loop state)
- Only the learning rate
- The training data
- The model's class source code
= Optimizers such as Adam and SGD with momentum keep state that affects every future step.
? `load_state_dict` raises "size mismatch for 0.weight". What does `strict=False` do about it?
+ Nothing: strict=False only allows missing or unexpected keys, not shape mismatches
- It loads the tensor anyway, padding with zeros
- It skips that tensor and continues
- It resizes the model's layer
= Shapes must always match; build the right architecture.
? You predict a single sample of shape `[10]` with a model trained on batches of shape `[batch, 10]`. What should you do first?
+ Add a batch dimension: `x.unsqueeze(0)`
- Transpose it with `x.T`
- Repeat it 32 times
- Convert it to float64
= Models are written for batches; a batch of one has shape [1, 10].
:::
