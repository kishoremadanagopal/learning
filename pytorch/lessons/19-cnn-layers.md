# Lesson 19: Convolutional networks

**You'll learn:** why images need convolutions, kernels and weight sharing, nn.Conv2d and its arguments (stride, padding, "same", dilation, groups, bias), the output-size formula, counting convolution parameters, channel-mismatch errors, MaxPool2d, AvgPool2d and AdaptiveAvgPool2d (global average pooling), BatchNorm2d and the Conv–BN–ReLU block, Conv1d, tracing shapes through a CNN, flattening into a linear layer, training a small CNN.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/pytorch/#cnn-layers)**: run every example and check your exercise answers.

## Key terms

- **Convolution:** sliding a small grid of learned weights over the input and computing a weighted sum at each position.
- **Kernel (filter):** the grid of weights a convolution slides; each output channel has its own kernel spanning all input channels.
- **Feature map:** one output channel of a convolution: where its pattern appears in the input.
- **Stride:** the step between kernel positions; stride 2 halves height and width.
- **Padding:** extra values (zeros) around the input's border, so the output can keep the input's size.
- **Pooling:** summarising each window with its maximum or average, with no learned parameters.
- **Global average pooling:** averaging each whole feature map to one number (`AdaptiveAvgPool2d(1)`).
- **Weight sharing:** using the same kernel weights at every position, which keeps convolutions small and position-independent.
- **CNN:** a convolutional neural network: stacked convolution, activation and pooling layers, then a classifier.

A linear layer connects every input to every output. For a 224 × 224 colour image that's 150,528 inputs per output, so it's huge, and it ignores the fact that nearby pixels belong together and that a cat's ear looks the same anywhere in the picture.

A **convolution** slides a small grid of weights, the **kernel** (or filter), across the image. At each position it multiplies the kernel by the patch underneath and adds up the result, giving one output value. The same weights are used at every position (**weight sharing**), so a 3 × 3 kernel has just 9 weights per input channel, and it finds the same pattern (an edge, a corner, a texture) wherever it appears.

![A 5 × 5 input surrounded by a ring of zero padding, a 3 × 3 kernel window highlighted at the top-left, the 3 × 3 kernel of weights, and the 5 × 5 output where the highlighted cell is that window's result. The formula: out = floor((in + 2·padding − dilation·(kernel − 1) − 1) / stride) + 1](../figures/convolution.svg)

## nn.Conv2d

`nn.Conv2d(in_channels, out_channels, kernel_size)` takes input of shape `[N, C_in, H, W]` and has `out_channels` kernels, each spanning **all** the input channels. Every kernel produces one output channel (a **feature map**).

| Argument | Default | Effect |
|---|---|---|
| `kernel_size` | (required) | the window, e.g. `3` (3 × 3) or `(3, 5)` |
| `stride` | 1 | step between windows; 2 halves the height and width |
| `padding` | 0 | zeros added around the edges; `padding=1` with a 3 × 3 kernel keeps the size; `"same"` does it for you |
| `dilation` | 1 | gaps inside the kernel, to see a wider area with the same weights |
| `groups` | 1 | split channels into independent groups (`groups=C_in` is a depthwise convolution) |
| `bias` | True | one bias per output channel |

```python
import torch
from torch import nn

torch.manual_seed(0)
conv = nn.Conv2d(in_channels=3, out_channels=8, kernel_size=3, padding=1)
print(conv)
print(conv.weight.shape, conv.bias.shape)        # [out, in, kH, kW], [out]
x = torch.randn(4, 3, 32, 32)                    # 4 RGB images, 32 × 32
print(conv(x).shape)
print(nn.Conv2d(3, 8, 3)(x).shape)               # no padding: 32 - 3 + 1 = 30
print(nn.Conv2d(3, 8, 3, stride=2, padding=1)(x).shape)   # stride 2 halves it
print(nn.Conv2d(3, 8, 5, padding="same")(x).shape)
```

The output size per side is ⌊(in + 2·padding − dilation·(kernel − 1) − 1) ÷ stride⌋ + 1. For the stride-2 example: ⌊(32 + 2 − 2 − 1) ÷ 2⌋ + 1 = 16.

**Parameters:** a Conv2d has out_channels × (in_channels ÷ groups) × kH × kW weights, plus out_channels biases. The count doesn't depend on the image size: that's the point.

```python
from torch import nn

conv = nn.Conv2d(3, 16, kernel_size=3)
print(sum(p.numel() for p in conv.parameters()))     # 16*3*3*3 + 16
fc = nn.Linear(3 * 32 * 32, 16)
print(sum(p.numel() for p in fc.parameters()))       # a dense layer on a 32 × 32 image
```

The classic mismatch error names the channels:

*This example raises an error on purpose.*

```python
import torch
from torch import nn

conv = nn.Conv2d(3, 8, 3)
conv(torch.zeros(1, 1, 28, 28))      # a grayscale image into a layer built for RGB
```

## Pooling

**Pooling** shrinks feature maps by summarising each window, which cuts computation and makes features less sensitive to small shifts. It has no parameters.

- `nn.MaxPool2d(2)`: the largest value in each 2 × 2 window (stride defaults to the kernel size, so height and width halve).
- `nn.AvgPool2d(2)`: the average of each window.
- `nn.AdaptiveAvgPool2d(output_size)`: averages down to a fixed size whatever the input size. `AdaptiveAvgPool2d(1)` is **global average pooling**: one number per channel. Modern CNNs end with it, so they accept any image size.

```python
import torch
from torch import nn

x = torch.arange(16.0).view(1, 1, 4, 4)
print(x[0, 0])
print(nn.MaxPool2d(2)(x)[0, 0])
print(nn.AvgPool2d(2)(x)[0, 0])
print(nn.AdaptiveAvgPool2d(1)(x).shape, nn.AdaptiveAvgPool2d(1)(x).flatten())
print(nn.AdaptiveAvgPool2d((2, 2))(torch.zeros(1, 5, 13, 9)).shape)
```

## BatchNorm2d

`nn.BatchNorm2d(C)` normalises each channel using its mean and variance over the batch **and** every pixel, then scales and shifts it with learned `weight` and `bias`. Like BatchNorm1d (Part 2), it uses batch statistics in `train()` mode and its running averages in `eval()` mode. The usual block is Conv → BatchNorm → ReLU, with `bias=False` on the convolution (the BatchNorm's shift makes a conv bias redundant).

```python
import torch
from torch import nn

block = nn.Sequential(nn.Conv2d(3, 16, 3, padding=1, bias=False), nn.BatchNorm2d(16), nn.ReLU())
print(block)
out = block(torch.randn(8, 3, 10, 10))
print(out.shape, out.min().item() >= 0)                 # after ReLU: no negatives
```

## A complete CNN, shape by shape

The standard pattern: a few blocks of convolutions that increase the channels while pooling reduces height and width, then flatten (or global-pool) and finish with linear layers. Tracing the shape through each layer is exactly what exam questions ask you to do.

```python
import torch
from torch import nn

torch.manual_seed(0)
model = nn.Sequential(
    nn.Conv2d(1, 8, kernel_size=3, padding=1),    # [N, 8, 28, 28]
    nn.ReLU(),
    nn.MaxPool2d(2),                              # [N, 8, 14, 14]
    nn.Conv2d(8, 16, kernel_size=3, padding=1),   # [N, 16, 14, 14]
    nn.ReLU(),
    nn.MaxPool2d(2),                              # [N, 16, 7, 7]
    nn.Flatten(),                                 # [N, 784]
    nn.Linear(16 * 7 * 7, 10),                    # [N, 10]
)
x = torch.randn(2, 1, 28, 28)
for layer in model:
    x = layer(x)
    print(f"{type(layer).__name__:<10} {tuple(x.shape)}")
print(sum(p.numel() for p in model.parameters()), "parameters")
```

The `16 * 7 * 7` in the last layer is where most CNN bugs live: change the image size or the pooling and that number changes. `nn.LazyLinear(10)` infers it on the first call (in real PyTorch), and global average pooling avoids it entirely.

`nn.Conv1d` works the same way along one dimension, for sequences of shape `[N, C, L]` (audio, sensor readings, or text embeddings with the embedding size as channels).

## Training a CNN

The training loop doesn't change: only the model does. Here a tiny CNN learns to tell 8 × 8 images with a horizontal bar from ones with a vertical bar.

```python
import torch
from torch import nn, optim
from torch.utils.data import TensorDataset, DataLoader

torch.manual_seed(0)
n = 256
images = torch.randn(n, 1, 8, 8) * 0.3
labels = torch.randint(0, 2, (n,))                 # 0 = horizontal bar, 1 = vertical bar
pos = torch.randint(1, 7, (n,))
for i in range(n):
    if labels[i] == 0:
        images[i, 0, pos[i], :] += 1.0
    else:
        images[i, 0, :, pos[i]] += 1.0

model = nn.Sequential(nn.Conv2d(1, 4, 3, padding=1), nn.ReLU(), nn.AdaptiveAvgPool2d(2),
                      nn.Flatten(), nn.Linear(16, 2))
opt = optim.Adam(model.parameters(), lr=0.02)
loss_fn = nn.CrossEntropyLoss()
loader = DataLoader(TensorDataset(images, labels), batch_size=32, shuffle=True)
for epoch in range(4):
    correct = 0
    for xb, yb in loader:
        opt.zero_grad()
        logits = model(xb)
        loss = loss_fn(logits, yb)
        loss.backward()
        opt.step()
        correct += (logits.argmax(1) == yb).sum().item()
    print(f"epoch {epoch}: loss {loss.item():.3f}, train accuracy {correct / n:.2f}")
```

## At a glance

| Concept | Code | Gives you | Remember |
|---|---|---|---|
| Convolution | `nn.Conv2d(c_in, c_out, k, stride, padding)` | `[N, c_out, H', W']` | H' = ⌊(H + 2p − d(k − 1) − 1) / s⌋ + 1 |
| Keep the size | `kernel_size=3, padding=1` (or `padding="same"`) | same H and W | "same" needs stride 1 |
| Parameters | c_out × (c_in / groups) × kH × kW + c_out | independent of image size | far fewer than a dense layer |
| Downsample | `nn.MaxPool2d(2)` / `stride=2` | half the height and width | pooling has no parameters |
| Any input size | `nn.AdaptiveAvgPool2d(1)` + `nn.Flatten()` | `[N, C]` | global average pooling |
| Normalise feature maps | `Conv2d(bias=False) → BatchNorm2d → ReLU` | stable, faster training | per channel; train vs eval behaviour |
| Sequences | `nn.Conv1d(c_in, c_out, k)` on `[N, C, L]` | `[N, c_out, L']` | channels before length |

## Common mistakes

- Getting the flattened size wrong in the first linear layer after the convolutions.
- Flattening the batch dimension too (`x.view(-1)` instead of `x.flatten(1)`).
- Passing images channels-last (`[N, H, W, C]`) to Conv2d, which expects `[N, C, H, W]`.
- Mismatching `in_channels` with the input's channel count (grayscale into an RGB layer).
- Forgetting that pooling and stride round the output size down.
- Keeping a conv bias right before BatchNorm, where it's redundant.

## Exercises

### 1. Predict convolution output sizes

Write `conv_out(size, kernel, stride=1, padding=0, dilation=1)` returning the output length along one side for a convolution (or pooling) with those settings, as an int. Then write `conv_params(c_in, c_out, kernel, groups=1, bias=True)` returning the number of parameters of an `nn.Conv2d` with a square `kernel`.

Starter code:

```python
def conv_out(size, kernel, stride=1, padding=0, dilation=1):
    pass

def conv_params(c_in, c_out, kernel, groups=1, bias=True):
    pass

print(conv_out(32, 3, padding=1), conv_out(32, 3, stride=2, padding=1), conv_params(3, 16, 3))
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** two formulas worth knowing by heart for the exam.
2. **Examples:** 32 with kernel 3, padding 1, stride 2 → ⌊31 / 2⌋ + 1 = 16.
3. **Brute force:** build the layer and run a dummy tensor through it: what the check does, but slow and not possible on paper.
4. **Pattern:** **effective kernel** = dilation·(kernel − 1) + 1, then count the steps that fit.
5. **Plan:** one integer expression each.
6. **Code and test:** compare with real layers, including dilation and groups.

</details>

<details>
<summary>💡 Hint 1</summary>

The formula is ⌊(size + 2·padding − dilation·(kernel − 1) − 1) ÷ stride⌋ + 1; `//` floors for positive numbers.

</details>

<details>
<summary>💡 Hint 2</summary>

Each output channel has one kernel of `(c_in // groups) × kernel × kernel` weights.

</details>

<details>
<summary>💡 Hint 3</summary>

Add `c_out` biases when `bias` is True.

</details>

### 2. Build a small CNN

Write a class `SmallCNN(nn.Module)` for 1 × 28 × 28 images and 10 classes. In `__init__` create, as attributes: `conv1` = Conv2d(1 → 8, kernel 3, padding 1), `conv2` = Conv2d(8 → 16, kernel 3, padding 1), `pool` = MaxPool2d(2), and `fc` = Linear(16 × 7 × 7 → 10). `forward` applies conv1, ReLU, pool, conv2, ReLU, pool, flattens everything except the batch dimension, and applies fc.

Starter code:

```python
import torch
from torch import nn

class SmallCNN(nn.Module):
    pass

model = SmallCNN()
print(model(torch.randn(2, 1, 28, 28)).shape)    # torch.Size([2, 10])
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a CNN as an nn.Module with explicit layers, and the shapes in between.
2. **Examples:** 28 → (conv, padding 1) 28 → (pool) 14 → 14 → 7, with 16 channels: 784 features.
3. **Brute force:** an nn.Sequential would also work, but the check wants named layers.
4. **Pattern:** **conv → activation → pool**, twice, then **flatten → linear**.
5. **Plan:** define layers in `__init__`, chain them in `forward`.
6. **Code and test:** batch sizes 1 and 3; 9098 parameters.

</details>

<details>
<summary>💡 Hint 1</summary>

Call `super().__init__()` first, then assign the four layers to `self.`.

</details>

<details>
<summary>💡 Hint 2</summary>

In `forward`: `x = self.pool(torch.relu(self.conv1(x)))`, and the same with conv2.

</details>

<details>
<summary>💡 Hint 3</summary>

`torch.flatten(x, 1)` (or `x.flatten(1)`) keeps the batch dimension; then `self.fc(x)`.

</details>

**In the sandbox:** exercises 37–38. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Predict convolution output sizes</summary>

```python
def conv_out(size, kernel, stride=1, padding=0, dilation=1):
    return (size + 2 * padding - dilation * (kernel - 1) - 1) // stride + 1

def conv_params(c_in, c_out, kernel, groups=1, bias=True):
    weights = c_out * (c_in // groups) * kernel * kernel
    return weights + (c_out if bias else 0)

print(conv_out(32, 3, padding=1), conv_out(32, 3, stride=2, padding=1), conv_params(3, 16, 3))
```

**Line by line**

- `dilation * (kernel - 1) + 1` is the width the kernel really covers. Subtract it from the padded size, divide by the stride (rounding down: a window that would hang off the edge isn't used), and add 1 for the first position.
- A grouped convolution splits the input channels into `groups` sets; each output channel only looks at `c_in // groups` of them, so weights shrink by a factor of `groups`.

**Shortcuts worth remembering:** kernel 3 with padding 1 (stride 1) keeps the size; stride 2 halves it (rounding up for odd sizes with padding 1); a 2 × 2 max pool halves it (rounding down).

**Common wrong approach:** `round(...)` instead of floor division. PyTorch always rounds down (unless a pooling layer has `ceil_mode=True`).

</details>

<details>
<summary>✅ 2. Build a small CNN</summary>

```python
import torch
from torch import nn

class SmallCNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv2d(1, 8, kernel_size=3, padding=1)
        self.conv2 = nn.Conv2d(8, 16, kernel_size=3, padding=1)
        self.pool = nn.MaxPool2d(2)
        self.fc = nn.Linear(16 * 7 * 7, 10)

    def forward(self, x):
        x = self.pool(torch.relu(self.conv1(x)))     # [N, 8, 14, 14]
        x = self.pool(torch.relu(self.conv2(x)))     # [N, 16, 7, 7]
        x = torch.flatten(x, 1)                      # [N, 784]
        return self.fc(x)

model = SmallCNN()
print(model(torch.randn(2, 1, 28, 28)).shape)
```

**Line by line**

- Padding 1 with a 3 × 3 kernel keeps 28 × 28; the pool halves it to 14; the second conv keeps 14; the second pool gives 7. So the flattened size is 16 × 7 × 7 = 784.
- The same `pool` module is reused twice: it has no parameters, so sharing it is fine (reusing a layer *with* weights would share the weights too).
- `torch.flatten(x, 1)` turns `[N, 16, 7, 7]` into `[N, 784]`.
- Parameters: conv1 8·1·9 + 8 = 80; conv2 16·8·9 + 16 = 1168; fc 784·10 + 10 = 7850; total 9098.

**Common wrong approach:** `x.view(-1)` or `torch.flatten(x)` with no dim, which merges the batch into the features: `[N × 784]` instead of `[N, 784]`, and the linear layer then complains about the shape.

</details>

## Quick quiz

1. An input of shape `[16, 3, 64, 64]` goes through `nn.Conv2d(3, 32, kernel_size=3, stride=2, padding=1)`. What is the output shape?
   - A) `[16, 32, 32, 32]`
   - B) `[16, 32, 64, 64]`
   - C) `[16, 32, 31, 31]`
   - D) `[16, 3, 32, 32]`

2. How many parameters does `nn.Conv2d(16, 32, kernel_size=3)` have?
   - A) 4,640
   - B) 4,608
   - C) 512
   - D) 147,456

3. What does `nn.MaxPool2d(2)` do to a `[8, 64, 20, 20]` tensor?
   - A) Gives `[8, 64, 10, 10]`, keeping the largest value of each 2 × 2 window
   - B) Gives `[8, 32, 20, 20]`, halving the channels
   - C) Gives `[8, 64, 19, 19]`
   - D) Adds 2 learned weights per channel

4. Why do many CNNs end with `nn.AdaptiveAvgPool2d(1)` before the classifier?
   - A) It reduces each feature map to one value whatever the input's height and width, so the model accepts any image size
   - B) It adds learnable parameters to the classifier
   - C) It replaces the need for ReLU
   - D) It normalises the batch

5. A grayscale `[1, 1, 28, 28]` image is passed to `nn.Conv2d(3, 8, 3)`. What happens?
   - A) A RuntimeError saying the weight expected the input to have 3 channels, but got 1
   - B) PyTorch repeats the channel three times automatically
   - C) It works and outputs `[1, 8, 26, 26]`
   - D) It works and outputs `[1, 3, 26, 26]`

<details>
<summary>Quiz answers</summary>

1. **A) `[16, 32, 32, 32]`**: ⌊(64 + 2 − 2 − 1) / 2⌋ + 1 = 32 per side, and 32 output channels.
2. **A) 4,640**: 32 × 16 × 3 × 3 = 4,608 weights plus 32 biases.
3. **A) Gives `[8, 64, 10, 10]`, keeping the largest value of each 2 × 2 window**: Pooling works on each channel separately, has no parameters, and with stride = kernel_size halves height and width.
4. **A) It reduces each feature map to one value whatever the input's height and width, so the model accepts any image size**: Global average pooling gives a fixed [N, C, 1, 1] output, removing the dependence of the linear layer's input size on the image size.
5. **A) A RuntimeError saying the weight expected the input to have 3 channels, but got 1**: in_channels must match the input's channel dimension (dim 1).

</details>

---
Previous: [Lesson 18](18-data-quality.md) · Next: [Lesson 20: Recurrent layers and attention](20-sequence-layers.md)
