# Lesson 8: Autograd: gradients for free

**You'll learn:** gradients and why training needs them, requires_grad, backward() and .grad, the computation graph, grad_fn and next_functions, leaf tensors and retain_grad, gradients accumulating and zeroing them, backward on non-scalars, the graph freed after backward and retain_graph, detach, torch.no_grad, torch.inference_mode, freezing with requires_grad_(False), torch.autograd.grad.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/pytorch/#autograd)**: run every example and check your exercise answers.

## Key terms

- **Gradient:** how much a scalar (the loss) changes when each input changes slightly; it points in the direction of steepest increase.
- **Autograd:** PyTorch's automatic differentiation engine, which records operations and computes gradients with the chain rule.
- **requires_grad:** a tensor flag that tells autograd to record operations on the tensor and compute its gradient.
- **Computation graph:** the record of operations that produced a result, built during the forward pass.
- **grad_fn:** the graph node on a computed tensor that knows how to pass gradients back to its inputs.
- **Leaf tensor:** a tensor created directly (not by a recorded operation); only leaves keep `.grad` by default.
- **backward():** computes the gradients of a scalar with respect to every leaf that requires grad, adding them to `.grad`.
- **Gradient accumulation:** `backward()` adds to existing `.grad` values instead of replacing them.
- **detach():** returns a tensor that shares data but is cut off from the computation graph.
- **torch.no_grad():** a context in which operations aren't recorded.
- **torch.inference_mode():** a faster no_grad for inference whose tensors can't be used in autograd later.

Training a model means adjusting its weights to make a **loss** (a number measuring how wrong it is) smaller. To know which way to adjust each weight, you need the **gradient**: how much the loss changes when that weight changes a little. A positive gradient means "increasing this weight increases the loss", so you decrease it, and vice versa.

A model can have millions of weights, and the loss is a long chain of operations. Working out every derivative by hand is impossible; **autograd** does it automatically.

## requires_grad, backward and .grad

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

## The computation graph

While you compute, PyTorch records each operation in a **computation graph**. Every result of a recorded operation has a `grad_fn`: the node that knows how to pass gradients back to its inputs. Tensors you created yourself are **leaves** (`is_leaf` is True, `grad_fn` is None). `backward()` walks the graph from the loss back to the leaves, applying the chain rule at each node, and stores the results in the leaves' `.grad`.

![w and b are leaf tensors with requires_grad=True, x is plain data. w and x feed MulBackward0, whose result and b feed AddBackward0, which produces the loss. Forward, PyTorch records each operation; loss.backward() walks the graph backwards, applying the chain rule at each node, and fills w.grad and b.grad](../figures/autograd-graph.svg)

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

## Gradients accumulate

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

## backward() needs a single number

Gradients are defined for a scalar loss. Calling `backward()` on a tensor with several elements is an error, unless you pass `gradient=` (a tensor of the same shape that weights each element). Normally you reduce first with `.sum()` or `.mean()`.

*This example raises an error on purpose.*

```python
import torch

x = torch.tensor([1.0, 2.0], requires_grad=True)
y = x * 3
y.backward()
```

## The graph is freed after backward

To save memory, `backward()` frees the intermediate values the graph stored. Calling it twice on the same graph is an error. In a training loop this never happens, because every step does a fresh forward pass that builds a new graph. (Pass `retain_graph=True` to the first call if you really need two backward passes.)

*This example raises an error on purpose.*

```python
import torch

x = torch.tensor([1.0, 2.0], requires_grad=True)
loss = (x ** 2).sum()
loss.backward()
loss.backward()
```

## Turning recording off: detach, no_grad and inference_mode

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

## torch.autograd.grad

`torch.autograd.grad(output, inputs)` returns the gradients as a tuple instead of adding them to `.grad`. It's handy when you want a derivative as a value (in physics-informed models, or gradient penalties).

```python
import torch

x = torch.tensor([1.0, 2.0, 3.0], requires_grad=True)
y = (x ** 3).sum()
(g,) = torch.autograd.grad(y, x)
print(g)            # 3x²
print(x.grad)       # untouched
```

## At a glance

| Concept | Code | Gives you | Remember |
|---|---|---|---|
| Track a tensor | `torch.tensor(…, requires_grad=True)` | its gradient after backward | only float or complex tensors |
| Compute gradients | `loss.backward()` | `.grad` on every leaf | loss must be a scalar |
| Read the graph | `y.grad_fn`, `.next_functions`, `.is_leaf` | how y was computed | leaves have no grad_fn |
| Reset | `x.grad = None` or `x.grad.zero_()` | a clean slate | gradients accumulate otherwise |
| Stop recording | `with torch.no_grad():`, `t.detach()` | no graph, less memory | inference_mode is faster still |
| Freeze | `p.requires_grad_(False)` | the weight stays fixed | it still takes part in the forward pass |
| Gradient as a value | `torch.autograd.grad(y, x)` | a tuple of gradients | doesn't touch `.grad` |

## Common mistakes

- Forgetting to zero gradients between steps, so they keep adding up.
- Calling `backward()` on a non-scalar tensor without reducing it first.
- Expecting `.grad` on intermediate (non-leaf) tensors.
- Calling `backward()` twice on the same graph.
- Assuming `torch.no_grad()` or `inference_mode()` changes dropout or batch norm (that's `model.eval()`).
- Using tensors created in `inference_mode()` for training.

## Exercises

### 1. Derivatives with autograd

Write `derivative(f, x)` that returns the derivative of a function `f` (which takes and returns a scalar tensor) at the Python float `x`, as a Python float, using autograd. Then set `slope`, the derivative of f(t) = t³ − 4t at t = 2.

Starter code:

```python
import torch

def derivative(f, x):
    pass

slope = None
print(derivative(lambda t: t ** 2, 3.0))   # 6.0
print(slope)
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** turn a Python number into a leaf tensor, run f, and read the gradient.
2. **Examples:** t² at 3 → 2·3 = 6.
3. **Brute force:** a finite difference (f(x + h) − f(x)) / h approximates it, with rounding error.
4. **Pattern:** **leaf with requires_grad → forward → backward → .grad**.
5. **Plan:** create t, call f(t).backward(), return t.grad.item().
6. **Code and test:** check sin at 0 (cos 0 = 1).

</details>

<details>
<summary>💡 Hint 1</summary>

Make the input a tensor that records gradients: `torch.tensor(x, requires_grad=True)`.

</details>

<details>
<summary>💡 Hint 2</summary>

Call `f(t)`, then `.backward()` on the result.

</details>

<details>
<summary>💡 Hint 3</summary>

The answer is in `t.grad`; `.item()` makes it a float.

</details>

### 2. Freeze and inspect

A tiny model has weights `w` and `b` (both require grad) and a frozen `scale`. Compute `loss = ((w * x + b) * scale - y).pow(2).mean()` for the given data, call backward, and set: `w_grad` and `b_grad` (Python floats from `.grad`), `scale_grad` (whatever `scale.grad` is after backward), and `loss_value` (a Python float). Then compute `pred`, the predictions `(w * x + b) * scale` **without** recording a graph.

Starter code:

```python
import torch

x = torch.tensor([1.0, 2.0, 3.0])
y = torch.tensor([3.0, 6.0, 9.0])
w = torch.tensor(1.5, requires_grad=True)
b = torch.tensor(0.5, requires_grad=True)
scale = torch.tensor(2.0)          # frozen: no requires_grad

w_grad = b_grad = scale_grad = loss_value = pred = None
print(w_grad, b_grad, scale_grad, loss_value, pred)
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** one forward pass and backward pass, then read gradients; a second forward pass without recording.
2. **Examples:** predictions (1.5x + 0.5)·2 = 4, 7, 10; every error is 1, so the loss is 1.
3. **Brute force:** derive the gradient formulas by hand: possible here, impossible for big models.
4. **Pattern:** **backward, read .grad, then no_grad for inference**.
5. **Plan:** loss → backward → items → no_grad prediction.
6. **Code and test:** check `pred.requires_grad` is False.

</details>

<details>
<summary>💡 Hint 1</summary>

Build `loss` from the formula, then `loss.backward()`.

</details>

<details>
<summary>💡 Hint 2</summary>

`w.grad.item()` gives a float. `scale.grad` is None because scale never asked for gradients.

</details>

<details>
<summary>💡 Hint 3</summary>

Wrap the prediction in `with torch.no_grad():` so `pred.requires_grad` is False.

</details>

**In the sandbox:** exercises 15–16. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Derivatives with autograd</summary>

```python
import torch

def derivative(f, x):
    t = torch.tensor(x, requires_grad=True)
    f(t).backward()
    return t.grad.item()

slope = derivative(lambda t: t ** 3 - 4 * t, 2.0)
print(derivative(lambda t: t ** 2, 3.0))
print(slope)
```

**Line by line**

- `torch.tensor(x, requires_grad=True)` makes a 0-D float32 leaf. A new tensor each call means `.grad` starts as None, so nothing accumulates between calls.
- `f(t)` builds the graph as it computes; the result is a scalar, so `.backward()` needs no arguments.
- `t.grad` holds df/dt at x; `.item()` returns a Python float.
- For t³ − 4t the derivative is 3t² − 4, which is 8 at t = 2.

**Common wrong approach:** creating `t` once outside the function and reusing it: the second call's gradient is added to the first.

</details>

<details>
<summary>✅ 2. Freeze and inspect</summary>

```python
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

**Line by line**

- The predictions are (1.5 · [1, 2, 3] + 0.5) · 2 = [4, 7, 10]; minus y = [3, 6, 9] gives errors e = [1, 1, 1], so the loss is mean(e²) = 1.
- By the chain rule, ∂loss/∂w = mean(2 · e · scale · x) = mean(4x) = 8, and ∂loss/∂b = mean(2 · e · scale) = 4. Autograd computes exactly these.
- `loss.backward()` fills `w.grad` and `b.grad`. `scale` was created without `requires_grad`, so autograd treats it as a constant and `scale.grad` stays `None`.
- Inside `torch.no_grad()`, the same expression produces a plain tensor: no `grad_fn`, `requires_grad=False`, no memory spent on a graph.

**Why freeze?** Fine-tuning often trains only the last layers of a big pretrained model: the frozen weights take part in the forward pass but get no gradients and aren't updated.

</details>

## Quick quiz

1. `x = torch.tensor(2.0, requires_grad=True); y = x ** 3; y.backward()`. What is `x.grad`?
   - A) `tensor(12.)`
   - B) `tensor(8.)`
   - C) `tensor(6.)`
   - D) `None`

2. You call `loss.backward()` in two training steps without zeroing gradients. What does each weight's `.grad` hold after the second call?
   - A) The sum of both steps' gradients
   - B) Only the second step's gradient
   - C) Only the first step's gradient
   - D) The average of the two gradients

3. Which tensor is a leaf?
   - A) `w = torch.randn(3, requires_grad=True)`
   - B) `y = w * 2`
   - C) `z = w.sum()`
   - D) `w.exp()`

4. `y` has shape `[5]` and requires grad. What does `y.backward()` do?
   - A) Raises "grad can be implicitly created only for scalar outputs"
   - B) Computes gradients of y.sum()
   - C) Computes gradients of y[0]
   - D) Nothing

5. What is the difference between `torch.no_grad()` and `torch.inference_mode()`?
   - A) Both stop recording; inference_mode is faster, but its tensors can't be used in autograd later
   - B) no_grad also switches dropout off
   - C) inference_mode still records the graph
   - D) There is no difference

6. Why does calling `loss.backward()` a second time on the same loss raise an error?
   - A) The graph's saved values were freed by the first backward()
   - B) Gradients can only be computed once per tensor
   - C) The loss became a leaf
   - D) requires_grad was reset to False

<details>
<summary>Quiz answers</summary>

1. **A) `tensor(12.)`**: dy/dx = 3x² = 12 at x = 2.
2. **A) The sum of both steps' gradients**: backward() accumulates into .grad; zero it (optimizer.zero_grad()) every step.
3. **A) `w = torch.randn(3, requires_grad=True)`**: Tensors you create directly are leaves; results of recorded operations have a grad_fn.
4. **A) Raises "grad can be implicitly created only for scalar outputs"**: Reduce to a scalar first (y.sum() or y.mean()), or pass gradient= with y's shape.
5. **A) Both stop recording; inference_mode is faster, but its tensors can't be used in autograd later**: Neither changes layer behaviour (that's model.eval()); inference_mode adds optimisations and restrictions.
6. **A) The graph's saved values were freed by the first backward()**: backward() frees the graph to save memory; recompute the forward pass, or use retain_graph=True.

</details>

---
Previous: [Lesson 7](07-devices.md) · Next: [Lesson 9: Gradient descent by hand](09-gradient-descent.md)
