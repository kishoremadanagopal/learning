# Lesson 11: Losses and optimizers

**You'll learn:** MSELoss, L1Loss and HuberLoss for regression, reduction, shape mismatches that broadcast, CrossEntropyLoss with logits and int64 class indices, NLLLoss and log_softmax, class weights, ignore_index and label smoothing, BCEWithLogitsLoss for binary and multi-label targets, BCELoss, torch.optim, SGD with momentum, Adam, AdamW and decoupled weight decay, zero_grad, the five-line training step.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/pytorch/#losses-and-optimizers)**: run every example and check your exercise answers.

## Key terms

- **Loss function:** a function of predictions and targets that measures error as one number to minimise.
- **CrossEntropyLoss:** log_softmax plus negative log-likelihood; takes logits and class indices.
- **Negative log-likelihood:** −log of the probability the model gave the correct class.
- **BCEWithLogitsLoss:** sigmoid plus binary cross-entropy in one stable step, for yes/no and multi-label targets.
- **Multi-label classification:** each sample can have several labels at once, each an independent yes/no.
- **reduction:** how a loss combines per-element values: `'mean'` (default), `'sum'` or `'none'`.
- **Optimizer:** an object that updates parameters from their gradients (`step()`) and clears gradients (`zero_grad()`).
- **Momentum:** a running average of past gradients used as the update direction, which smooths noisy steps.
- **Adam:** an optimizer with a per-parameter step size from running averages of the gradient and its square.
- **Weight decay:** shrinking weights slightly every step to reduce overfitting; decoupled from the gradient in AdamW.

A **loss function** turns the model's predictions and the true answers into one number to minimise. An **optimizer** uses the gradients to update the parameters. Choosing the right pair is part of the exam's "model development" and "fundamentals" domains.

## Regression losses

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

## Classification: CrossEntropyLoss

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

*This example raises an error on purpose.*

```python
import torch
from torch import nn

logits = torch.randn(4, 3)
labels = torch.tensor([0.0, 2.0, 1.0, 0.0])      # floats instead of int64
nn.CrossEntropyLoss()(logits, labels)
```

Useful options: `weight=` (a tensor of per-class weights for imbalanced data), `ignore_index=` (a label value to skip, -100 by default), `label_smoothing=0.1` (soften the targets to reduce overconfidence).

## Yes/no outputs: BCEWithLogitsLoss

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

## Optimizers

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

## One training step

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

## At a glance

| Concept | Code | Gives you | Remember |
|---|---|---|---|
| Regression | `nn.MSELoss()`, `nn.L1Loss()` | mean squared / absolute error | same shapes for pred and target |
| Multi-class | `nn.CrossEntropyLoss()(logits, labels)` | log_softmax + NLL | logits `[N, C]`, int64 labels `[N]` |
| Yes/no, multi-label | `nn.BCEWithLogitsLoss()` | sigmoid + BCE, stable | float 0/1 targets, same shape |
| Plain SGD | `optim.SGD(params, lr=0.1, momentum=0.9)` | p ← p − lr · grad (with velocity) | lr around 0.01–0.1 |
| Adaptive | `optim.Adam(params, lr=1e-3)`, `optim.AdamW(…, weight_decay=0.01)` | per-parameter step sizes | AdamW decouples weight decay |
| Training step | `pred = model(x); loss = …; opt.zero_grad(); loss.backward(); opt.step()` | one update | zero_grad sets `.grad` to None |

## Common mistakes

- Applying softmax before CrossEntropyLoss.
- Giving CrossEntropyLoss float, one-hot or `[batch, 1]` targets instead of int64 `[batch]`.
- Giving BCEWithLogitsLoss integer targets, or a sigmoid output.
- Comparing `[batch, 1]` predictions with `[batch]` targets in MSELoss.
- Calling `optimizer.step()` before `loss.backward()`, or forgetting `zero_grad()`.
- Storing loss tensors instead of `loss.item()`, keeping every graph in memory.

## Exercises

### 1. Pick the loss

Write `make_loss(task)` returning the right loss module for each task: `"regression"` → mean squared error, `"multiclass"` → cross-entropy, `"multilabel"` → binary cross-entropy on logits. Then compute `ce`: the cross-entropy loss (a Python float) for `logits` and `labels` below, after converting `labels` to the dtype the loss needs.

Starter code:

```python
import torch
from torch import nn

def make_loss(task):
    pass

logits = torch.tensor([[1.0, 2.0, 0.5], [0.3, 0.1, 2.0], [2.5, 0.0, 0.0]])
labels = torch.tensor([1.0, 2.0, 0.0])      # stored as floats by mistake
ce = None
print(make_loss("multiclass"), ce)
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** match tasks to losses, and fix the target dtype.
2. **Examples:** multiclass → CrossEntropyLoss; targets [1, 2, 0] as int64.
3. **Brute force:** if/elif works just as well.
4. **Pattern:** **task → output shape → target format → loss** (the table in the lesson).
5. **Plan:** a lookup dict; `.long()` on the labels; `.item()` on the loss.
6. **Code and test:** passing float labels raises "expected target dtype to be Long or Byte".

</details>

<details>
<summary>💡 Hint 1</summary>

A dict from task names to loss modules is enough.

</details>

<details>
<summary>💡 Hint 2</summary>

CrossEntropyLoss needs int64 class indices: `labels.long()`.

</details>

<details>
<summary>💡 Hint 3</summary>

Pass the raw logits; CrossEntropyLoss applies log_softmax itself. `.item()` gives the float.

</details>

### 2. Write the training step

Write `train_steps(model, x, y, loss_fn, optimizer, n)` that runs `n` training steps on the full batch `(x, y)` and returns a list of the `n` loss values (Python floats, the loss computed **before** each update).

Starter code:

```python
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

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** package the training step in a loop and record losses.
2. **Examples:** the first loss is the untrained model's error.
3. **Brute force:** there is no shortcut: this is the shortcut.
4. **Pattern:** **forward → loss → zero_grad → backward → step**.
5. **Plan:** loop n times, append `loss.item()`.
6. **Code and test:** the loss should fall towards 0, since the data is exactly linear.

</details>

<details>
<summary>💡 Hint 1</summary>

The loop body is the five lines: forward, loss, `optimizer.zero_grad()`, `loss.backward()`, `optimizer.step()`.

</details>

<details>
<summary>💡 Hint 2</summary>

Append `loss.item()`: a float, not the tensor (which would keep every step's graph alive).

</details>

<details>
<summary>💡 Hint 3</summary>

The loss you record is the one computed before `step()` changes the weights.

</details>

**In the sandbox:** exercises 21–22. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Pick the loss</summary>

```python
import torch
from torch import nn

def make_loss(task):
    return {"regression": nn.MSELoss(), "multiclass": nn.CrossEntropyLoss(), "multilabel": nn.BCEWithLogitsLoss()}[task]

logits = torch.tensor([[1.0, 2.0, 0.5], [0.3, 0.1, 2.0], [2.5, 0.0, 0.0]])
labels = torch.tensor([1.0, 2.0, 0.0])
ce = make_loss("multiclass")(logits, labels.long()).item()
print(make_loss("multiclass"), ce)
```

**Line by line**

- The dict maps each task to a new loss module. Losses have no parameters, so creating one is cheap.
- `labels.long()` converts 1.0, 2.0, 0.0 to the int64 indices 1, 2, 0. With float targets of shape `[3]` (not `[3, 3]`), CrossEntropyLoss refuses them: float targets are only accepted as class probabilities with the same shape as the logits.
- All three samples' highest logit is the correct class, so the loss is fairly small.

**Common wrong approach:** `nn.CrossEntropyLoss()(torch.softmax(logits, 1), labels.long())`: it runs, but applies softmax twice, which squashes the scores and slows learning.

</details>

<details>
<summary>✅ 2. Write the training step</summary>

```python
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

**Line by line**

- `loss_fn(model(x), y)` builds a fresh graph from the current weights.
- `optimizer.zero_grad()` sets every parameter's `.grad` to None, so `backward()` writes fresh gradients instead of adding to the last step's.
- `optimizer.step()` applies p ← p − lr · grad to the weight and bias.
- `losses.append(loss.item())` stores a plain float. Appending the tensor itself would keep each step's computation graph in memory, a classic slow memory leak.

**Common wrong approach:** calling `optimizer.step()` before `loss.backward()`: the first step does nothing (no gradients yet) and every later step uses the previous step's gradients.

</details>

## Quick quiz

1. A model outputs logits of shape `[64, 10]` for 10 classes. Which target does `nn.CrossEntropyLoss` expect?
   - A) An int64 tensor of shape `[10]`
   - B) A float tensor of shape `[64, 1]`
   - C) A one-hot int64 tensor of shape `[64, 10]`
   - D) An int64 tensor of shape `[64]` with values from 0 to 9

2. Why shouldn't you apply `softmax` to the model's outputs before `nn.CrossEntropyLoss`?
   - A) CrossEntropyLoss already applies log_softmax; adding softmax applies it twice
   - B) softmax changes the dtype
   - C) softmax outputs can't be differentiated
   - D) It would make the loss negative

3. Which loss suits a model that predicts several independent yes/no tags per image?
   - A) `nn.CrossEntropyLoss` with int64 targets
   - B) `nn.NLLLoss`
   - C) `nn.MSELoss` on class indices
   - D) `nn.BCEWithLogitsLoss` with float 0/1 targets of shape `[batch, n_tags]`

4. What does `optimizer.zero_grad()` do by default in current PyTorch?
   - A) Sets every parameter to 0
   - B) Fills each `.grad` with zeros
   - C) Sets each parameter's `.grad` to `None`
   - D) Sets the learning rate to 0

5. `pred` has shape `[32, 1]` and `y` has shape `[32]`. What happens with `nn.MSELoss()(pred, y)`?
   - A) It broadcasts to `[32, 32]`, gives a wrong loss, and warns about different sizes
   - B) It computes the right loss
   - C) It squeezes pred automatically
   - D) It raises a shape error

6. What does AdamW change compared with Adam?
   - A) Weight decay is applied directly to the weights (decoupled) instead of being added to the gradient
   - B) It has no learning rate
   - C) It doesn't use momentum
   - D) It uses a fixed step size for all parameters

<details>
<summary>Quiz answers</summary>

1. **D) An int64 tensor of shape `[64]` with values from 0 to 9**: Class indices, one per sample (float class probabilities of shape [64, 10] are also accepted).
2. **A) CrossEntropyLoss already applies log_softmax; adding softmax applies it twice**: CrossEntropyLoss expects raw logits.
3. **D) `nn.BCEWithLogitsLoss` with float 0/1 targets of shape `[batch, n_tags]`**: Multi-label: an independent sigmoid per output.
4. **C) Sets each parameter's `.grad` to `None`**: set_to_none=True has been the default since PyTorch 2.0; it saves memory.
5. **A) It broadcasts to `[32, 32]`, gives a wrong loss, and warns about different sizes**: Fix the shapes with pred.squeeze(1) or y.unsqueeze(1).
6. **A) Weight decay is applied directly to the weights (decoupled) instead of being added to the gradient**: Decoupled weight decay works better with adaptive step sizes; AdamW's default weight_decay is 0.01.

</details>

---
Previous: [Lesson 10](10-nn-module.md) · Next: [Lesson 12: The training and evaluation loop](12-training-loop.md)
