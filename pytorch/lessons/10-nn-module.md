# Lesson 10: Building models with nn.Module

**You'll learn:** nn.Linear and y = xWᵀ + b, weight and bias shapes, default Kaiming-uniform initialisation, nn.Parameter, activation functions (ReLU, LeakyReLU, GELU, SiLU, Sigmoid, Tanh, Softmax) and torch.nn.functional, nn.Sequential, subclassing nn.Module with __init__ and forward, super().__init__(), calling the model, parameters and named_parameters, counting parameters, nn.ModuleList, moving a model with .to(device).

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/pytorch/#nn-module)**: run every example and check your exercise answers.

## Key terms

- **nn.Module:** the base class for layers and models; it registers sub-modules and parameters assigned as attributes.
- **nn.Linear:** a fully connected layer computing x Wᵀ + b, with weight shape [out_features, in_features].
- **nn.Parameter:** a tensor registered as a learnable weight of a module (requires grad by default).
- **forward():** the method that defines a module's computation; run it by calling the module.
- **Activation function:** a non-linear function between layers, such as ReLU, that lets networks model curved relationships.
- **Logits:** a model's raw, unnormalised output scores.
- **nn.Sequential:** a container that runs its modules in order.
- **nn.ModuleList:** a list of modules that registers them, unlike a plain Python list.
- **Kaiming (He) initialisation:** random starting weights scaled by the number of inputs so activations keep a stable size.
- **torch.nn.functional (F):** the same operations as layers, as plain functions without stored weights.

Writing every weight by hand doesn't scale. `torch.nn` provides **layers** that create and own their weights, and **nn.Module**, the base class for layers and whole models.

## nn.Linear

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

## Activation functions

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

## nn.Sequential

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

## Your own nn.Module

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

*This example raises an error on purpose.*

```python
import torch
from torch import nn

class Broken(nn.Module):
    def __init__(self):
        self.fc = nn.Linear(2, 2)       # forgot super().__init__()

model = Broken()
```

## Parameters

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

## Moving a model to a device

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

## At a glance

| Concept | Code | Gives you | Remember |
|---|---|---|---|
| Dense layer | `nn.Linear(in_f, out_f)` | `[…, in_f] → […, out_f]` | weight is `[out_f, in_f]` |
| Parameter count | `in_f × out_f + out_f` | per Linear layer | `sum(p.numel() for p in model.parameters())` |
| Non-linearity | `nn.ReLU()`, `F.relu(x)` | curved functions | no parameters |
| Chain of layers | `nn.Sequential(…)` | a model in one line | index with `model[0]` |
| Custom model | subclass `nn.Module`, `super().__init__()`, `forward` | any architecture | call it: `model(x)` |
| Lists of layers | `nn.ModuleList([…])` | registered sub-modules | a plain list hides them |
| Move | `model.to(device)` | parameters moved in place | before creating the optimizer |

## Common mistakes

- Forgetting `super().__init__()` at the start of `__init__`.
- Creating layers inside `forward`, so they're new and untrained on every call.
- Keeping layers in a plain list or dict, hiding them from `parameters()`.
- Calling `model.forward(x)` instead of `model(x)`.
- Passing data as [features, samples] instead of [samples, features].
- Expecting `model.to(device)` to return a copy (modules move in place).

## Exercises

### 1. A two-layer network

Write a class `MLP(nn.Module)` whose constructor takes `n_in`, `n_hidden` and `n_out`, and whose forward pass is: Linear(n_in → n_hidden), ReLU, Linear(n_hidden → n_out). Name the layers `fc1` and `fc2`. Then write `count_params(model)` returning the total number of parameters as an int.

Starter code:

```python
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

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a Module subclass with two registered layers and a forward pass; a parameter counter.
2. **Examples:** MLP(10, 32, 2) has 10·32 + 32 + 32·2 + 2 = 418 parameters.
3. **Brute force:** compute the count from the sizes by hand: breaks for other architectures.
4. **Pattern:** **layers in `__init__`, computation in `forward`**; count with **parameters()**.
5. **Plan:** write the class, then the counter.
6. **Code and test:** call the model on a batch and check the shape.

</details>

<details>
<summary>💡 Hint 1</summary>

Start `__init__` with `super().__init__()`, then `self.fc1 = nn.Linear(n_in, n_hidden)` and `self.fc2 = nn.Linear(n_hidden, n_out)`.

</details>

<details>
<summary>💡 Hint 2</summary>

`forward(self, x)` returns `self.fc2(torch.relu(self.fc1(x)))`.

</details>

<details>
<summary>💡 Hint 3</summary>

`sum(p.numel() for p in model.parameters())` counts every weight and bias.

</details>

### 2. Read a layer's shapes

Without running a model, a lot can be worked out from shapes. Write `linear_output_shape(in_shape, layer)` that returns the shape (a tuple) of `layer(x)` for an `nn.Linear` `layer` and an input of shape `in_shape`, or `None` if the call would fail. Use `layer.in_features` and `layer.out_features`; don't call the layer.

Starter code:

```python
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

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** Linear maps `[..., in] → [..., out]`.
2. **Examples:** (4, 5, 8) → (4, 5, 3).
3. **Brute force:** call the layer and catch errors: not allowed here, and slow for big layers.
4. **Pattern:** **check the last dim, replace it**.
5. **Plan:** guard the empty shape and mismatch; build the tuple.
6. **Code and test:** features in the wrong position must fail.

</details>

<details>
<summary>💡 Hint 1</summary>

Only the **last** size matters: it must equal `in_features`.

</details>

<details>
<summary>💡 Hint 2</summary>

Every other size is kept; the last becomes `out_features`.

</details>

<details>
<summary>💡 Hint 3</summary>

A scalar input (shape `()`) has no last size: return None.

</details>

**In the sandbox:** exercises 19–20. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. A two-layer network</summary>

```python
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

**Line by line**

- `super().__init__()` sets up the module's internal registries; assigning `self.fc1 = nn.Linear(...)` then registers the layer and, through it, its weight and bias.
- `forward` composes the layers: `[batch, n_in] → [batch, n_hidden] → ReLU → [batch, n_out]`. Calling `model(x)` runs it.
- `model.parameters()` yields fc1.weight, fc1.bias, fc2.weight, fc2.bias; `numel()` counts each one's elements.

**Common wrong approach:** creating the layers inside `forward`. They'd be new, random and unregistered on every call, so nothing could ever be trained.

</details>

<details>
<summary>✅ 2. Read a layer's shapes</summary>

```python
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

**Line by line**

- A shape like `(32, 8)` means 32 samples of 8 features. Linear multiplies the last dimension by Wᵀ, which is `[in_features, out_features]`, so the last size must be `in_features`.
- `tuple(in_shape[:-1]) + (layer.out_features,)` keeps the leading sizes and swaps the last.
- `(8, 32)` fails even though it contains an 8: this is the classic mistake of passing data as `[features, samples]`, and the error PyTorch raises is `mat1 and mat2 shapes cannot be multiplied (8x32 and 8x3)`.

**Common wrong approach:** checking `layer.in_features in in_shape`, which accepts the wrong layout.

</details>

## Quick quiz

1. `layer = nn.Linear(20, 5)`. What is `layer.weight.shape`?
   - A) `torch.Size([5, 20])`
   - B) `torch.Size([20, 5])`
   - C) `torch.Size([5])`
   - D) `torch.Size([20])`

2. How many parameters does `nn.Linear(100, 10)` have?
   - A) 1010
   - B) 1000
   - C) 110
   - D) 10

3. A model's `__init__` creates its layers but doesn't call `super().__init__()`. What happens?
   - A) Assigning the first layer raises "cannot assign module before Module.__init__() call"
   - B) The model works but can't be moved to the GPU
   - C) The layers are created but not trained
   - D) Nothing; super().__init__() is optional

4. A model stores its layers as `self.layers = [nn.Linear(4, 4), nn.Linear(4, 4)]`. What does `list(model.parameters())` return?
   - A) An empty list: layers in a plain list aren't registered
   - B) The four weight and bias tensors
   - C) Two Linear modules
   - D) It raises an error

5. Why call `model(x)` rather than `model.forward(x)`?
   - A) Calling the module runs forward() together with PyTorch's hooks and bookkeeping
   - B) forward() doesn't exist on nn.Module
   - C) model(x) automatically moves x to the right device
   - D) model(x) disables gradients

6. What does `model.to("cuda")` return for an `nn.Module`?
   - A) The same module, whose parameters were moved in place
   - B) A copy of the model on the GPU, leaving the original on the CPU
   - C) None
   - D) A list of moved parameters

<details>
<summary>Quiz answers</summary>

1. **A) `torch.Size([5, 20])`**: The weight is [out_features, in_features]; the layer computes x @ weight.T + bias.
2. **A) 1010**: 100 × 10 weights + 10 biases.
3. **A) Assigning the first layer raises "cannot assign module before Module.__init__() call"**: nn.Module's registries are set up by its __init__; without them there's nowhere to register layers.
4. **A) An empty list: layers in a plain list aren't registered**: Use nn.ModuleList so the layers (and their parameters) are registered.
5. **A) Calling the module runs forward() together with PyTorch's hooks and bookkeeping**: Calling the module (__call__) runs registered hooks around forward().
6. **A) The same module, whose parameters were moved in place**: Modules move in place (and return self); tensors' .to() returns a new tensor.

</details>

---
Previous: [Lesson 9](09-gradient-descent.md) · Next: [Lesson 11: Losses and optimizers](11-losses-and-optimizers.md)
