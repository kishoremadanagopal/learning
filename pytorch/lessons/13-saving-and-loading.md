# Lesson 13: Saving, loading and using a model

**You'll learn:** model and optimizer state_dicts, buffers in state_dicts, torch.save and torch.load, saving the state_dict versus the whole model, weights_only=True by default since PyTorch 2.6 and why, load_state_dict and strict, missing, unexpected and size-mismatched keys, checkpoints for resuming training, map_location, making predictions with eval, inference_mode, a batch dimension, softmax and argmax.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/pytorch/#saving-and-loading)**: run every example and check your exercise answers.

## Key terms

- **state_dict:** an ordered dict mapping parameter and buffer names to tensors (or, for optimizers, their state and settings).
- **Buffer:** a tensor registered with a module that is saved and moved with it but not trained, such as BatchNorm's running mean.
- **torch.save / torch.load:** write and read pickled objects of tensors and containers to files.
- **weights_only:** a torch.load option (True by default since PyTorch 2.6) that only unpickles tensors and plain containers, for safety.
- **load_state_dict:** copies a state_dict's tensors into a module's parameters and buffers, checking names and shapes.
- **Checkpoint:** a saved dict with everything needed to resume training: model and optimizer state, epoch, loss.
- **map_location:** a torch.load argument that remaps saved tensors to another device, such as the CPU.
- **Inference:** using a trained model to make predictions.

Training can take hours or days. You **save** the result so you can use the model later, share it, or resume training if it's interrupted.

## state_dict

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

## torch.save and torch.load

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

## weights_only: why loading a whole model fails

`torch.save(model, path)` also works: it pickles the whole object, including a reference to its class. But since **PyTorch 2.6, `torch.load` uses `weights_only=True` by default**. It only unpickles tensors and plain containers, because unpickling arbitrary objects can run arbitrary code: a malicious `.pt` file could take over your computer. Loading a whole model therefore fails:

*This example raises an error on purpose.*

```python
import torch
from torch import nn

torch.save(nn.Linear(2, 1), "whole.pt")
model = torch.load("whole.pt")
```

You can pass `weights_only=False` for files **you trust**, but saving the state_dict avoids the problem and also survives renaming or moving your model's code. Loading a whole pickled model needs the class to be importable under the same name, which breaks easily.

## load_state_dict checks the keys and shapes

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

## Checkpoints: resuming training

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

## Loading on a different device

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

## Using a trained model

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

## At a glance

| Concept | Code | Gives you | Remember |
|---|---|---|---|
| Save | `torch.save(model.state_dict(), "model.pt")` | a portable weights file | the recommended way |
| Load | `model = Net(); model.load_state_dict(torch.load("model.pt"))` | the trained weights | build the same architecture first |
| Safety | `torch.load(path)` uses `weights_only=True` | refuses arbitrary objects | `weights_only=False` only for trusted files |
| Partial load | `load_state_dict(sd, strict=False)` | skips missing / extra keys | shapes must still match |
| Resume | save `{"model_state_dict", "optimizer_state_dict", "epoch", …}` | exact continuation | then `model.train()` |
| Other device | `torch.load(path, map_location="cpu")` | GPU checkpoint on a CPU | or `map_location=device` |
| Predict | `model.eval()`; `with torch.inference_mode(): model(x.unsqueeze(0)).argmax(1)` | a class index | softmax only for probabilities |

## Common mistakes

- Saving the whole model and then failing to load it with the default `weights_only=True`.
- Passing a file path to `load_state_dict` instead of `torch.load(path)`.
- Loading weights into a different architecture.
- Resuming training without the optimizer's state.
- Loading a GPU checkpoint on a CPU-only machine without `map_location`.
- Predicting without `model.eval()` or without a batch dimension.

## Exercises

### 1. Save and restore a model

Write `save_model(model, path)` that saves only the model's state_dict, and `load_model(path, make_model)` that builds a fresh model with the function `make_model()`, loads the saved weights into it, puts it in eval mode, and returns it.

Starter code:

```python
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

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** the recommended save/load pattern, wrapped in two functions.
2. **Examples:** the reloaded model gives identical outputs.
3. **Brute force:** `torch.save(model, path)`: then loading needs `weights_only=False`.
4. **Pattern:** **save the state_dict; rebuild, load, eval**.
5. **Plan:** one line to save; four lines to load.
6. **Code and test:** compare outputs on new data.

</details>

<details>
<summary>💡 Hint 1</summary>

`torch.save(model.state_dict(), path)`.

</details>

<details>
<summary>💡 Hint 2</summary>

Loading: `model = make_model()`, then `model.load_state_dict(torch.load(path))`.

</details>

<details>
<summary>💡 Hint 3</summary>

Finish with `model.eval()` and return the model (`eval()` also returns it).

</details>

### 2. Predict with a trained model

Write `predict(model, x, class_names)` that takes a single sample `x` (a 1-D tensor) **or** a batch (2-D), and returns a list of `(class_name, probability)` pairs, one per sample, where probability is a Python float rounded to 3 decimals. Run the model in eval mode without gradients and leave the model in eval mode.

Starter code:

```python
import torch
from torch import nn

def predict(model, x, class_names):
    pass

torch.manual_seed(0)
model = nn.Sequential(nn.Linear(2, 8), nn.ReLU(), nn.Dropout(0.3), nn.Linear(8, 3))
print(predict(model, torch.tensor([0.5, -0.2]), ["low", "mid", "high"]))
print(predict(model, torch.tensor([[0.5, -0.2], [2.0, 1.0]]), ["low", "mid", "high"]))
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a prediction helper: shape handling, inference mode, probabilities and labels.
2. **Examples:** a batch of 2 gives two (name, probability) pairs.
3. **Brute force:** call the model once per sample in a loop: slower and needs the same care.
4. **Pattern:** **add batch dim → eval → inference_mode → softmax → argmax**.
5. **Plan:** unsqueeze if 1-D; compute; build the list.
6. **Code and test:** the model has dropout, so predictions are random unless eval() is called.

</details>

<details>
<summary>💡 Hint 1</summary>

A 1-D sample needs a batch dimension: `x.unsqueeze(0)`.

</details>

<details>
<summary>💡 Hint 2</summary>

`model.eval()`, then inside `torch.inference_mode()` (or `no_grad`) compute `torch.softmax(model(x), dim=1)`.

</details>

<details>
<summary>💡 Hint 3</summary>

`probs.argmax(dim=1)` gives each sample's class index; read the probability at `probs[k, i]`.

</details>

**In the sandbox:** exercises 25–26. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Save and restore a model</summary>

```python
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

**Line by line**

- `model.state_dict()` holds the four tensors `0.weight`, `0.bias`, `2.weight`, `2.bias` (the Tanh at index 1 has none). `torch.save` pickles that dict.
- `make_model()` creates the same architecture with random weights; `load_state_dict` overwrites them, checking every name and shape.
- `torch.load(path)` works with the default `weights_only=True`, because the file only holds tensors in a dict.
- `model.eval()` is the right default for a model loaded for use; call `train()` if you're going to continue training.

**Common wrong approach:** `model.load_state_dict(path)`: it expects the dict, not a file path. Load the file first with `torch.load`.

</details>

<details>
<summary>✅ 2. Predict with a trained model</summary>

```python
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

**Line by line**

- Models expect a batch dimension: a `[2]` sample becomes `[1, 2]`.
- `model.eval()` switches the Dropout layer off, so predictions are deterministic.
- `torch.inference_mode()` skips all autograd bookkeeping; the results can't be used for training, which is fine here.
- `softmax(dim=1)` turns each row of logits into probabilities summing to 1; `argmax(dim=1)` picks the most likely class per row.
- `round(..., 3)` on the Python float gives three decimals.

**Common wrong approach:** forgetting the batch dimension. `nn.Linear` accepts a 1-D input, but `softmax(dim=1)` on a 1-D result raises "Dimension out of range".

</details>

## Quick quiz

1. What is the recommended way to save a trained model for later use?
   - A) `torch.save(model.state_dict(), "model.pt")`
   - B) `model.save("model.pt")`
   - C) `torch.save(model, "model.pt")`
   - D) `pickle.dump(model.parameters(), f)`

2. Since PyTorch 2.6, `torch.load("whole_model.pt")` on a file made with `torch.save(model, ...)` raises an error. Why?
   - A) torch.load defaults to weights_only=True, which refuses to unpickle arbitrary classes for security
   - B) Whole models can't be saved in PyTorch 2.6
   - C) The model must be on the GPU
   - D) The file must be loaded with model.load()

3. A checkpoint was saved on a GPU machine. How do you load it on a laptop without a GPU?
   - A) `torch.load(path, device="cpu")`
   - B) `torch.load(path).cpu()`
   - C) It can't be done
   - D) `torch.load(path, map_location="cpu")`

4. To resume training exactly, what should a checkpoint contain besides the model's state_dict?
   - A) The training data
   - B) Only the learning rate
   - C) The optimizer's state_dict (and the epoch and other loop state)
   - D) The model's class source code

5. `load_state_dict` raises "size mismatch for 0.weight". What does `strict=False` do about it?
   - A) It resizes the model's layer
   - B) Nothing: strict=False only allows missing or unexpected keys, not shape mismatches
   - C) It loads the tensor anyway, padding with zeros
   - D) It skips that tensor and continues

6. You predict a single sample of shape `[10]` with a model trained on batches of shape `[batch, 10]`. What should you do first?
   - A) Transpose it with `x.T`
   - B) Convert it to float64
   - C) Repeat it 32 times
   - D) Add a batch dimension: `x.unsqueeze(0)`

<details>
<summary>Quiz answers</summary>

1. **A) `torch.save(model.state_dict(), "model.pt")`**: Save the state_dict; rebuild the architecture in code and load_state_dict to restore it.
2. **A) torch.load defaults to weights_only=True, which refuses to unpickle arbitrary classes for security**: Pass weights_only=False only for files you trust, or save state_dicts instead.
3. **D) `torch.load(path, map_location="cpu")`**: map_location remaps the stored tensors' devices while loading.
4. **C) The optimizer's state_dict (and the epoch and other loop state)**: Optimizers such as Adam and SGD with momentum keep state that affects every future step.
5. **B) Nothing: strict=False only allows missing or unexpected keys, not shape mismatches**: Shapes must always match; build the right architecture.
6. **D) Add a batch dimension: `x.unsqueeze(0)`**: Models are written for batches; a batch of one has shape [1, 10].

</details>

---
Previous: [Lesson 12](12-training-loop.md) · Next: [Lesson 14: Datasets](14-datasets.md)
