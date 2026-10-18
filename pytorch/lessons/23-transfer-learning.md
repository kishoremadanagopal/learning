# Lesson 23: Transfer learning and modifying models

**You'll learn:** transfer learning, feature extraction versus fine-tuning, torchvision pretrained models and their weights' transforms, inspecting models with named_children, named_modules, named_parameters and get_submodule, freezing with requires_grad_(False), replacing the head, optimizing only trainable parameters, smaller learning rates for pretrained layers, frozen BatchNorm statistics, partial loading with strict=False and filtered state dicts, forward hooks and handles.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/pytorch/#transfer-learning)**: run every example and check your exercise answers.

## Key terms

- **Transfer learning:** starting from a model trained on a large dataset and adapting it to a new task.
- **Backbone:** the pretrained part of a model that extracts general features.
- **Head:** the final task-specific layers, usually replaced for a new task.
- **Feature extraction:** training only a new head on top of a frozen backbone.
- **Fine-tuning:** training some or all pretrained layers too, usually with a smaller learning rate.
- **Freezing:** setting `requires_grad=False` so a parameter isn't updated.
- **Forward hook:** a function called after a module's forward pass with its inputs and output.
- **named_modules():** iterates over every submodule at every depth, with dotted names.

Training a large model from scratch needs a lot of data and compute. **Transfer learning** starts instead from a model already trained on a big dataset (ImageNet images, or web text), whose early layers have learned general features (edges, textures, word meanings), and adapts it to your task with far less data.

![A pretrained backbone of four blocks, frozen with requires_grad=False, holding general features learned on a big dataset, followed by a new trainable head nn.Linear(f, classes). Then optionally unfreeze the last blocks with a smaller learning rate (fine-tuning)](../figures/transfer-learning.svg)

Two strategies, often used one after the other:

1. **Feature extraction:** freeze the whole pretrained **backbone** and train only a new **head** (the final layer, sized for your classes). Fast, and robust with little data.
2. **Fine-tuning:** also unfreeze some or all backbone layers and train them with a **smaller** learning rate, so the pretrained features adjust gently.

In real projects the pretrained model usually comes from a library:

```python
from torchvision.models import resnet18, ResNet18_Weights

weights = ResNet18_Weights.DEFAULT
model = resnet18(weights=weights)            # downloads the ImageNet weights
preprocess = weights.transforms()            # the exact resizing and normalisation they were trained with
model.fc = nn.Linear(model.fc.in_features, 5)   # replace the 1000-class head with a 5-class one
```

(The sandbox can't download weights, so the examples below "pretrain" a small model themselves.)

## Looking inside a model

You need to know a model's parts before you can change them.

```python
import torch
from torch import nn

class Net(nn.Module):
    def __init__(self):
        super().__init__()
        self.features = nn.Sequential(nn.Conv2d(1, 8, 3, padding=1), nn.ReLU(), nn.AdaptiveAvgPool2d(1), nn.Flatten())
        self.classifier = nn.Linear(8, 10)

    def forward(self, x):
        return self.classifier(self.features(x))

model = Net()
for name, child in model.named_children():          # direct children only
    print(name, "->", type(child).__name__)
print([name for name, _ in model.named_modules()])  # everything, recursively ('' is the model itself)
print([(n, tuple(p.shape)) for n, p in model.named_parameters()])
print(model.get_submodule("features.0"))
```

## Freezing and replacing the head

Freezing a parameter means `requires_grad=False`: autograd stops computing its gradient, and the optimizer never changes it. `module.requires_grad_(False)` freezes everything in a module. Then assign a new layer to replace the head; new layers are trainable by default.

```python
import torch
from torch import nn, optim

torch.manual_seed(0)
model = nn.Sequential(nn.Linear(16, 32), nn.ReLU(), nn.Linear(32, 32), nn.ReLU(), nn.Linear(32, 10))
backbone, head_index = model[:4], 4
backbone.requires_grad_(False)                       # freeze the pretrained layers
model[head_index] = nn.Linear(32, 3)                 # a new head for 3 classes

trainable = [n for n, p in model.named_parameters() if p.requires_grad]
print(trainable)
print(sum(p.numel() for p in model.parameters() if p.requires_grad), "of", sum(p.numel() for p in model.parameters()))
opt = optim.Adam((p for p in model.parameters() if p.requires_grad), lr=1e-3)

x = torch.randn(4, 16)
model(x).sum().backward()
print(model[0].weight.grad, model[4].weight.grad.shape)   # frozen: no gradient at all
```

Passing only trainable parameters to the optimizer is the clean way (a frozen parameter with weight decay or momentum would otherwise still be touched in some optimizers).

**Frozen BatchNorm:** freezing its parameters doesn't stop `train()` mode from updating its running statistics. When a frozen backbone contains BatchNorm layers, put them in `eval()` mode after calling `model.train()`, or the statistics drift away from the pretrained ones.

## Fine-tuning with parameter groups

When you unfreeze the backbone, give it a smaller learning rate than the new head:

```python
import torch
from torch import nn, optim

model = nn.Sequential(nn.Linear(16, 32), nn.ReLU(), nn.Linear(32, 3))
backbone, head = model[:2], model[2]
backbone.requires_grad_(True)
opt = optim.AdamW([
    {"params": backbone.parameters(), "lr": 1e-5},     # gentle changes to pretrained weights
    {"params": head.parameters(), "lr": 1e-3},         # the new head learns faster
], weight_decay=0.01)
print([g["lr"] for g in opt.param_groups])
```

## A complete example

"Pretrain" a small network on one task (horizontal versus vertical bars), then reuse its feature extractor for a new task with only 40 labelled examples: is the bar in the top or bottom half? Only the new head trains.

```python
import torch
from torch import nn, optim

def bars(n, seed):
    g = torch.Generator().manual_seed(seed)
    x = torch.randn(n, 1, 8, 8, generator=g) * 0.3
    orient = torch.randint(0, 2, (n,), generator=g)
    pos = torch.randint(0, 8, (n,), generator=g)
    for i in range(n):
        if orient[i] == 0:
            x[i, 0, pos[i], :] += 1.0
        else:
            x[i, 0, :, pos[i]] += 1.0
    return x, orient, pos

def train(model, params, x, y, epochs, lr):
    opt = optim.Adam(params, lr=lr)
    for _ in range(epochs):
        opt.zero_grad()
        nn.functional.cross_entropy(model(x), y).backward()
        opt.step()
    return (model(x).argmax(1) == y).float().mean().item()

torch.manual_seed(0)
features = nn.Sequential(nn.Conv2d(1, 8, 3, padding=1), nn.ReLU(), nn.AdaptiveAvgPool2d(2), nn.Flatten())
x, orient, _ = bars(400, seed=1)
pre = nn.Sequential(features, nn.Linear(32, 2))
print("pretraining accuracy:", round(train(pre, pre.parameters(), x, orient, 60, 0.02), 2))

# new task, little data: horizontal bars, top half (0) or bottom half (1)?
x2, orient2, pos2 = bars(200, seed=2)
keep = orient2 == 0
x2, y2 = x2[keep][:40], (pos2[keep][:40] >= 4).long()
features.requires_grad_(False)
model = nn.Sequential(features, nn.Linear(32, 2))
print("new-task accuracy:", round(train(model, model[1].parameters(), x2, y2, 150, 0.05), 2))
```

## Loading pretrained weights partially

`load_state_dict(state, strict=False)` loads the keys that match and reports the rest instead of failing. Shapes must still match for every key it loads, so drop the old head's weights first when the number of classes changed.

```python
import torch
from torch import nn

old = nn.Sequential(nn.Linear(4, 8), nn.ReLU(), nn.Linear(8, 10))      # pretrained, 10 classes
new = nn.Sequential(nn.Linear(4, 8), nn.ReLU(), nn.Linear(8, 3))       # our task, 3 classes
state = {k: v for k, v in old.state_dict().items() if not k.startswith("2.")}
result = new.load_state_dict(state, strict=False)
print(result.missing_keys, result.unexpected_keys)
print(torch.equal(new[0].weight, old[0].weight))
```

## Reading intermediate features with hooks

A **forward hook** runs after a module's forward pass and receives its input and output. It's how you extract embeddings from the middle of a model, or inspect activations while debugging, without changing the model's code. `register_forward_hook` returns a handle: call `handle.remove()` when you're done.

```python
import torch
from torch import nn

torch.manual_seed(0)
model = nn.Sequential(nn.Linear(4, 8), nn.ReLU(), nn.Linear(8, 2))
captured = {}

def save_output(module, inputs, output):
    captured["hidden"] = output.detach()

handle = model[1].register_forward_hook(save_output)
out = model(torch.randn(3, 4))
handle.remove()
print(captured["hidden"].shape, (captured["hidden"] >= 0).all().item())
```

## At a glance

| Concept | Code | Gives you | Remember |
|---|---|---|---|
| Inspect | `named_children()`, `named_modules()`, `named_parameters()`, `get_submodule("a.0")` | a model's structure | named_modules recurses |
| Freeze | `backbone.requires_grad_(False)` | no gradients, no updates | BN statistics still update in train() |
| New head | `model.fc = nn.Linear(model.fc.in_features, n)` | trainable, right size | create the optimizer after this |
| Train only some | `optim.Adam(p for p in model.parameters() if p.requires_grad)` | updates the head only | feature extraction |
| Fine-tune | param groups: backbone lr 1e-5, head lr 1e-3 | gentle adaptation | unfreeze gradually |
| Partial load | `load_state_dict(filtered, strict=False)` | matching keys load | shapes must still match |
| Peek inside | `h = layer.register_forward_hook(fn)` … `h.remove()` | intermediate outputs | returning a value replaces the output |

## Common mistakes

- Creating the optimizer before replacing the head, so the new head is never trained.
- Freezing parameters but still letting BatchNorm update its running statistics in train mode.
- Fine-tuning pretrained layers with the same high learning rate as a new head.
- Loading a state dict with mismatched head shapes instead of dropping those keys.
- Forgetting the pretrained model's own preprocessing (resize and normalisation).
- Leaving forward hooks registered after use.

## Exercises

### 1. Freeze the backbone, replace the head

Write `prepare_for_finetune(model, n_classes)` for a model with two attributes: `features` (the backbone) and `classifier` (an `nn.Linear`). It freezes every parameter of `features`, replaces `classifier` with a new `nn.Linear` with the same number of inputs and `n_classes` outputs, and returns an `optim.Adam` optimizer with `lr=1e-3` over the trainable parameters only.

Starter code:

```python
import torch
from torch import nn, optim

def prepare_for_finetune(model, n_classes):
    pass

class Net(nn.Module):
    def __init__(self):
        super().__init__()
        self.features = nn.Sequential(nn.Linear(10, 20), nn.ReLU())
        self.classifier = nn.Linear(20, 100)
    def forward(self, x):
        return self.classifier(self.features(x))

model = Net()
opt = prepare_for_finetune(model, 4)
print(model.classifier, sum(p.numel() for p in model.parameters() if p.requires_grad))
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** freeze, swap the head, optimise only what should change.
2. **Examples:** a 100-class head with 20 inputs → a 4-class head with 20 inputs: 84 trainable parameters.
3. **Brute force:** loop over `features.parameters()` setting `p.requires_grad = False`: the same as `requires_grad_(False)`.
4. **Pattern:** **feature extraction**: frozen backbone + new head.
5. **Plan:** freeze; replace; filter trainable parameters; create Adam.
6. **Code and test:** train a few steps and check the backbone's weights didn't move.

</details>

<details>
<summary>💡 Hint 1</summary>

`model.features.requires_grad_(False)` freezes the whole backbone in one call.

</details>

<details>
<summary>💡 Hint 2</summary>

`model.classifier.in_features` tells you how many inputs the new layer needs.

</details>

<details>
<summary>💡 Hint 3</summary>

Build the optimizer **after** replacing the head, from `[p for p in model.parameters() if p.requires_grad]`.

</details>

### 2. Extract features with a hook

Write `get_features(model, layer, x)` that runs `model(x)` and returns the output of the submodule `layer` from that forward pass (detached), using `register_forward_hook`. It must remove the hook before returning, so the model is left with no hooks attached.

Starter code:

```python
import torch
from torch import nn

def get_features(model, layer, x):
    pass

torch.manual_seed(0)
model = nn.Sequential(nn.Linear(4, 8), nn.ReLU(), nn.Linear(8, 2))
print(get_features(model, model[1], torch.randn(3, 4)).shape)     # torch.Size([3, 8])
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** observe one layer's output during a normal forward pass, without changing the model.
2. **Examples:** model[1] is the ReLU after the first linear layer: shape `[3, 8]`, all ≥ 0.
3. **Brute force:** call the layers one by one up to `layer`: only works for Sequential models.
4. **Pattern:** **forward hook + handle.remove()**.
5. **Plan:** define the hook; register; run; remove; return.
6. **Code and test:** check that no hooks are left on any module.

</details>

<details>
<summary>💡 Hint 1</summary>

A forward hook has the signature `hook(module, inputs, output)`.

</details>

<details>
<summary>💡 Hint 2</summary>

Store `output.detach()` somewhere the outer function can read, such as a dict or a list.

</details>

<details>
<summary>💡 Hint 3</summary>

`handle = layer.register_forward_hook(hook)`, run the model, then `handle.remove()` (a `try`/`finally` removes it even if the forward pass fails).

</details>

**In the sandbox:** exercises 45–46. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Freeze the backbone, replace the head</summary>

```python
import torch
from torch import nn, optim

def prepare_for_finetune(model, n_classes):
    model.features.requires_grad_(False)
    model.classifier = nn.Linear(model.classifier.in_features, n_classes)
    trainable = [p for p in model.parameters() if p.requires_grad]
    return optim.Adam(trainable, lr=1e-3)

class Net(nn.Module):
    def __init__(self):
        super().__init__()
        self.features = nn.Sequential(nn.Linear(10, 20), nn.ReLU())
        self.classifier = nn.Linear(20, 100)
    def forward(self, x):
        return self.classifier(self.features(x))

model = Net()
opt = prepare_for_finetune(model, 4)
print(model.classifier, sum(p.numel() for p in model.parameters() if p.requires_grad))
```

**Line by line**

- `requires_grad_(False)` on a module sets the flag on all its parameters (recursively). Autograd then skips computing their gradients, which also saves time and memory.
- Assigning `model.classifier = nn.Linear(...)` registers the new layer in place of the old one; its parameters are freshly initialised and require grad.
- The optimizer must be created *after* the swap: an optimizer built earlier would hold the old head's parameters, and the new head would never be updated.

**Common wrong approach:** `optim.Adam(model.parameters())` before replacing the head, which leaves the new head untrained while the loss doesn't improve.

</details>

<details>
<summary>✅ 2. Extract features with a hook</summary>

```python
import torch
from torch import nn

def get_features(model, layer, x):
    saved = {}

    def hook(module, inputs, output):
        saved["out"] = output.detach()

    handle = layer.register_forward_hook(hook)
    try:
        model(x)
    finally:
        handle.remove()
    return saved["out"]

torch.manual_seed(0)
model = nn.Sequential(nn.Linear(4, 8), nn.ReLU(), nn.Linear(8, 2))
print(get_features(model, model[1], torch.randn(3, 4)).shape)
```

**Line by line**

- The hook is called by `layer`'s `__call__` right after its `forward`, with the module, its positional inputs (a tuple) and its output.
- `output.detach()` keeps the values without holding on to the computation graph.
- `handle.remove()` unregisters the hook. Forgotten hooks keep running on every later forward pass, slowing things down and filling memory.
- `try`/`finally` guarantees removal even when `model(x)` raises.

**Why it matters:** hooks work on any model, including ones you didn't write (torchvision, Hugging Face), which is how embedding extraction, feature visualisation and many debugging tools are built.

**Common wrong approach:** returning the hook's result from the hook (any non-None return value *replaces* the layer's output, changing the model's behaviour).

</details>

## Quick quiz

1. You freeze a pretrained backbone and replace its head. Which parameters should the optimizer receive?
   - A) All of `model.parameters()`, including the frozen ones, to keep their momentum
   - B) No parameters: frozen models don't need an optimizer
   - C) Only the parameters with `requires_grad=True` (the new head)
   - D) Only the backbone's parameters

2. Why use a smaller learning rate for pretrained layers than for a new head when fine-tuning?
   - A) To freeze them
   - B) Large updates would destroy the useful pretrained features; the new, random head needs to change much more
   - C) Pretrained layers can't have a learning rate above 1e-5
   - D) It makes the model smaller

3. `new.load_state_dict(state, strict=False)` where `state` lacks the head's keys. What happens?
   - A) It raises a RuntimeError for the missing keys
   - B) The matching keys load, and the result lists the head's keys under `missing_keys`
   - C) Nothing loads
   - D) The head is filled with zeros

4. A frozen backbone contains BatchNorm layers. What still changes during `model.train()` if you do nothing else?
   - A) Nothing
   - B) The convolution weights
   - C) The BatchNorm weight and bias
   - D) The BatchNorm running mean and variance

5. What does `module.register_forward_hook(fn)` give you?
   - A) The module's gradients during backward
   - B) A call to `fn(module, inputs, output)` after each forward pass of that module, and a handle to remove it
   - C) A way to change the module's forward code permanently
   - D) A copy of the module

6. Which method lists only a module's direct submodules, with their names?
   - A) `named_modules()`
   - B) `named_parameters()`
   - C) `state_dict()`
   - D) `named_children()`

<details>
<summary>Quiz answers</summary>

1. **C) Only the parameters with `requires_grad=True` (the new head)**: Passing only trainable parameters keeps the optimizer from touching frozen weights and saves memory.
2. **B) Large updates would destroy the useful pretrained features; the new, random head needs to change much more**: Discriminative learning rates adapt pretrained features gently.
3. **B) The matching keys load, and the result lists the head's keys under `missing_keys`**: strict=False tolerates missing and unexpected keys, but shape mismatches still raise an error.
4. **D) The BatchNorm running mean and variance**: Running statistics are buffers updated in train mode regardless of requires_grad; keep those layers in eval().
5. **B) A call to `fn(module, inputs, output)` after each forward pass of that module, and a handle to remove it**: Forward hooks observe (or, by returning a value, replace) a module's output.
6. **D) `named_children()`**: named_modules() recurses through every level; named_children() stops at the first.

</details>

---
Previous: [Lesson 22](22-optimizers-and-schedules.md) · Next: [Lesson 24: Measuring performance](24-measuring-performance.md)
