@@@ part
id: 4
title: Model Development
level: Intermediate
blurb: The building blocks of real networks and how to make them train well: convolution and pooling layers for images, recurrent layers and attention for sequences, activations, initialisation, normalisation and residual connections, optimizers and learning-rate schedules, and adapting a pretrained model with transfer learning.

@@@ lesson
id: cnn-layers
title: Convolutional networks
minutes: 30
summary: Why images need convolutions, nn.Conv2d (in and out channels, kernel_size, stride, padding, dilation, groups), the output-size formula, counting parameters, max and average pooling, AdaptiveAvgPool2d for any input size, BatchNorm2d, Conv1d for sequences, building a CNN and tracing the shape through every layer, and training it.
---
A linear layer connects every input to every output. For a 224 × 224 colour image that's 150,528 inputs per output, so it's huge, and it ignores the fact that nearby pixels belong together and that a cat's ear looks the same anywhere in the picture.

A **convolution** slides a small grid of weights, the **kernel** (or filter), across the image. At each position it multiplies the kernel by the patch underneath and adds up the result, giving one output value. The same weights are used at every position (**weight sharing**), so a 3 × 3 kernel has just 9 weights per input channel, and it finds the same pattern (an edge, a corner, a texture) wherever it appears.

![A 5 × 5 input surrounded by a ring of zero padding, a 3 × 3 kernel window highlighted at the top-left, the 3 × 3 kernel of weights, and the 5 × 5 output where the highlighted cell is that window's result. The formula: out = floor((in + 2·padding − dilation·(kernel − 1) − 1) / stride) + 1](figures/convolution.svg)

### nn.Conv2d

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

```python error
import torch
from torch import nn

conv = nn.Conv2d(3, 8, 3)
conv(torch.zeros(1, 1, 28, 28))      # a grayscale image into a layer built for RGB
```

### Pooling

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

### BatchNorm2d

`nn.BatchNorm2d(C)` normalises each channel using its mean and variance over the batch **and** every pixel, then scales and shifts it with learned `weight` and `bias`. Like BatchNorm1d (Part 2), it uses batch statistics in `train()` mode and its running averages in `eval()` mode. The usual block is Conv → BatchNorm → ReLU, with `bias=False` on the convolution (the BatchNorm's shift makes a conv bias redundant).

```python
import torch
from torch import nn

block = nn.Sequential(nn.Conv2d(3, 16, 3, padding=1, bias=False), nn.BatchNorm2d(16), nn.ReLU())
print(block)
out = block(torch.randn(8, 3, 10, 10))
print(out.shape, out.min().item() >= 0)                 # after ReLU: no negatives
```

### A complete CNN, shape by shape

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

### Training a CNN

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

:::exercise Predict convolution output sizes
Write `conv_out(size, kernel, stride=1, padding=0, dilation=1)` returning the output length along one side for a convolution (or pooling) with those settings, as an int. Then write `conv_params(c_in, c_out, kernel, groups=1, bias=True)` returning the number of parameters of an `nn.Conv2d` with a square `kernel`.
```python starter
def conv_out(size, kernel, stride=1, padding=0, dilation=1):
    pass

def conv_params(c_in, c_out, kernel, groups=1, bias=True):
    pass

print(conv_out(32, 3, padding=1), conv_out(32, 3, stride=2, padding=1), conv_params(3, 16, 3))
```
```python check
import torch
from torch import nn
co = need("conv_out"); cp = need("conv_params")
cases = [(32, 3, 1, 1, 1), (32, 3, 2, 1, 1), (28, 5, 1, 0, 1), (7, 3, 2, 0, 1), (10, 3, 1, 2, 2), (224, 7, 2, 3, 1), (5, 5, 1, 0, 1), (9, 2, 2, 0, 1)]
for size, k, s, p, d in cases:
    want = nn.Conv2d(1, 1, k, stride=s, padding=p, dilation=d)(torch.zeros(1, 1, size, size)).shape[-1]
    got = co(size, k, stride=s, padding=p, dilation=d)
    assert got == want and isinstance(got, int), f"conv_out({size}, {k}, stride={s}, padding={p}, dilation={d}) should be {want}, got {got!r}."
assert co(32, 3) == 30, "Check the defaults: conv_out(32, 3) should be 30."
for c_in, c_out, k, g, b in [(3, 16, 3, 1, True), (16, 32, 3, 1, False), (8, 8, 3, 8, True), (6, 12, 5, 3, True), (1, 1, 1, 1, True)]:
    want = sum(p.numel() for p in nn.Conv2d(c_in, c_out, k, groups=g, bias=b).parameters())
    got = cp(c_in, c_out, k, groups=g, bias=b)
    assert got == want, f"conv_params({c_in}, {c_out}, {k}, groups={g}, bias={b}) should be {want}, got {got!r}."
```
```python solution
def conv_out(size, kernel, stride=1, padding=0, dilation=1):
    return (size + 2 * padding - dilation * (kernel - 1) - 1) // stride + 1

def conv_params(c_in, c_out, kernel, groups=1, bias=True):
    weights = c_out * (c_in // groups) * kernel * kernel
    return weights + (c_out if bias else 0)

print(conv_out(32, 3, padding=1), conv_out(32, 3, stride=2, padding=1), conv_params(3, 16, 3))
```
hint: The formula is ⌊(size + 2·padding − dilation·(kernel − 1) − 1) ÷ stride⌋ + 1; `//` floors for positive numbers.
hint: Each output channel has one kernel of `(c_in // groups) × kernel × kernel` weights.
hint: Add `c_out` biases when `bias` is True.
approach:
1. **Understand:** two formulas worth knowing by heart for the exam.
2. **Examples:** 32 with kernel 3, padding 1, stride 2 → ⌊31 / 2⌋ + 1 = 16.
3. **Brute force:** build the layer and run a dummy tensor through it: what the check does, but slow and not possible on paper.
4. **Pattern:** **effective kernel** = dilation·(kernel − 1) + 1, then count the steps that fit.
5. **Plan:** one integer expression each.
6. **Code and test:** compare with real layers, including dilation and groups.
walkthrough:
**Line by line**

- `dilation * (kernel - 1) + 1` is the width the kernel really covers. Subtract it from the padded size, divide by the stride (rounding down: a window that would hang off the edge isn't used), and add 1 for the first position.
- A grouped convolution splits the input channels into `groups` sets; each output channel only looks at `c_in // groups` of them, so weights shrink by a factor of `groups`.

**Shortcuts worth remembering:** kernel 3 with padding 1 (stride 1) keeps the size; stride 2 halves it (rounding up for odd sizes with padding 1); a 2 × 2 max pool halves it (rounding down).

**Common wrong approach:** `round(...)` instead of floor division. PyTorch always rounds down (unless a pooling layer has `ceil_mode=True`).
:::

:::exercise Build a small CNN
Write a class `SmallCNN(nn.Module)` for 1 × 28 × 28 images and 10 classes. In `__init__` create, as attributes: `conv1` = Conv2d(1 → 8, kernel 3, padding 1), `conv2` = Conv2d(8 → 16, kernel 3, padding 1), `pool` = MaxPool2d(2), and `fc` = Linear(16 × 7 × 7 → 10). `forward` applies conv1, ReLU, pool, conv2, ReLU, pool, flattens everything except the batch dimension, and applies fc.
```python starter
import torch
from torch import nn

class SmallCNN(nn.Module):
    pass

model = SmallCNN()
print(model(torch.randn(2, 1, 28, 28)).shape)    # torch.Size([2, 10])
```
```python check
import torch
from torch import nn
import torch.nn.functional as F
cls = need("SmallCNN")
torch.manual_seed(0)
m = cls()
for name, kind in (("conv1", nn.Conv2d), ("conv2", nn.Conv2d), ("pool", nn.MaxPool2d), ("fc", nn.Linear)):
    assert isinstance(getattr(m, name, None), kind), f"Create self.{name} as an nn.{kind.__name__}."
assert sum(p.numel() for p in m.parameters()) == 9098, f"The model should have 9098 parameters, got {sum(p.numel() for p in m.parameters())}. Check the layer sizes."
x = torch.randn(3, 1, 28, 28)
out = m(x)
assert tuple(out.shape) == (3, 10), f"The output should have shape [3, 10], got {list(out.shape)}."
want = m.fc(torch.flatten(m.pool(F.relu(m.conv2(m.pool(F.relu(m.conv1(x)))))), 1))
same(out, want, "the model's output", tol=1e-5)
assert tuple(m(torch.randn(1, 1, 28, 28)).shape) == (1, 10), "A batch of one should give [1, 10] (flatten from dim 1, not everything)."
```
```python solution
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
hint: Call `super().__init__()` first, then assign the four layers to `self.`.
hint: In `forward`: `x = self.pool(torch.relu(self.conv1(x)))`, and the same with conv2.
hint: `torch.flatten(x, 1)` (or `x.flatten(1)`) keeps the batch dimension; then `self.fc(x)`.
approach:
1. **Understand:** a CNN as an nn.Module with explicit layers, and the shapes in between.
2. **Examples:** 28 → (conv, padding 1) 28 → (pool) 14 → 14 → 7, with 16 channels: 784 features.
3. **Brute force:** an nn.Sequential would also work, but the check wants named layers.
4. **Pattern:** **conv → activation → pool**, twice, then **flatten → linear**.
5. **Plan:** define layers in `__init__`, chain them in `forward`.
6. **Code and test:** batch sizes 1 and 3; 9098 parameters.
walkthrough:
**Line by line**

- Padding 1 with a 3 × 3 kernel keeps 28 × 28; the pool halves it to 14; the second conv keeps 14; the second pool gives 7. So the flattened size is 16 × 7 × 7 = 784.
- The same `pool` module is reused twice: it has no parameters, so sharing it is fine (reusing a layer *with* weights would share the weights too).
- `torch.flatten(x, 1)` turns `[N, 16, 7, 7]` into `[N, 784]`.
- Parameters: conv1 8·1·9 + 8 = 80; conv2 16·8·9 + 16 = 1168; fc 784·10 + 10 = 7850; total 9098.

**Common wrong approach:** `x.view(-1)` or `torch.flatten(x)` with no dim, which merges the batch into the features: `[N × 784]` instead of `[N, 784]`, and the linear layer then complains about the shape.
:::

:::quiz
? An input of shape `[16, 3, 64, 64]` goes through `nn.Conv2d(3, 32, kernel_size=3, stride=2, padding=1)`. What is the output shape?
+ `[16, 32, 32, 32]`
- `[16, 32, 64, 64]`
- `[16, 32, 31, 31]`
- `[16, 3, 32, 32]`
= ⌊(64 + 2 − 2 − 1) / 2⌋ + 1 = 32 per side, and 32 output channels.
? How many parameters does `nn.Conv2d(16, 32, kernel_size=3)` have?
+ 4,640
- 4,608
- 512
- 147,456
= 32 × 16 × 3 × 3 = 4,608 weights plus 32 biases.
? What does `nn.MaxPool2d(2)` do to a `[8, 64, 20, 20]` tensor?
+ Gives `[8, 64, 10, 10]`, keeping the largest value of each 2 × 2 window
- Gives `[8, 32, 20, 20]`, halving the channels
- Gives `[8, 64, 19, 19]`
- Adds 2 learned weights per channel
= Pooling works on each channel separately, has no parameters, and with stride = kernel_size halves height and width.
? Why do many CNNs end with `nn.AdaptiveAvgPool2d(1)` before the classifier?
+ It reduces each feature map to one value whatever the input's height and width, so the model accepts any image size
- It adds learnable parameters to the classifier
- It replaces the need for ReLU
- It normalises the batch
= Global average pooling gives a fixed [N, C, 1, 1] output, removing the dependence of the linear layer's input size on the image size.
? A grayscale `[1, 1, 28, 28]` image is passed to `nn.Conv2d(3, 8, 3)`. What happens?
+ A RuntimeError saying the weight expected the input to have 3 channels, but got 1
- PyTorch repeats the channel three times automatically
- It works and outputs `[1, 8, 26, 26]`
- It works and outputs `[1, 3, 26, 26]`
= in_channels must match the input's channel dimension (dim 1).
:::

@@@ lesson
id: sequence-layers
title: Recurrent layers and attention
minutes: 30
summary: Sequences as [batch, length, features], nn.Embedding for tokens, nn.RNN, nn.LSTM and nn.GRU (input and hidden sizes, batch_first, num_layers, bidirectional, the output versus h_n and c_n), classifying a sequence from its last hidden state, scaled dot-product attention, causal and padding masks (and their opposite boolean conventions), nn.MultiheadAttention, and nn.TransformerEncoderLayer and nn.TransformerEncoder.
---
Text, audio, sensor readings and time series are **sequences**: the order matters. Their tensors have a time (or position) dimension. With `batch_first=True` the layout is `[batch, length, features]`.

### From tokens to vectors: nn.Embedding

Text arrives as integer **token ids**. `nn.Embedding(num_embeddings, embedding_dim)` is a learnable lookup table: id `i` returns row `i` of its weight matrix.

```python
import torch
from torch import nn

torch.manual_seed(0)
embed = nn.Embedding(num_embeddings=10, embedding_dim=4)     # a vocabulary of 10 tokens
tokens = torch.tensor([[1, 5, 5, 0], [3, 2, 9, 0]])          # 2 sequences of 4 ids (0 = padding)
vectors = embed(tokens)
print(vectors.shape)                                          # [2, 4, 4]: batch, length, features
print(torch.equal(vectors[0, 1], embed.weight[5]))
```

### Recurrent layers: RNN, LSTM and GRU

A recurrent layer reads the sequence one step at a time, updating a **hidden state** that summarises what it has seen. **LSTM** (long short-term memory) and **GRU** (gated recurrent unit) add learned gates that decide what to keep and forget, so they remember over longer sequences than a plain RNN.

`nn.LSTM(input_size, hidden_size, num_layers=1, batch_first=False, bidirectional=False)` returns **two** things:

| Output | Shape (batch_first=True) | What it is |
|---|---|---|
| `output` | `[N, L, D × hidden]` | the top layer's hidden state at **every** step |
| `h_n` | `[layers × D, N, hidden]` | the **last** step's hidden state for **every** layer |
| `c_n` (LSTM only) | `[layers × D, N, hidden]` | the last cell state |

(D is 2 for a bidirectional layer, else 1. Note that `h_n` stays layers-first even with `batch_first=True`.)

```python
import torch
from torch import nn

torch.manual_seed(0)
lstm = nn.LSTM(input_size=4, hidden_size=3, num_layers=2, batch_first=True)
print(lstm)
x = torch.randn(2, 5, 4)                       # batch 2, length 5, 4 features
output, (h_n, c_n) = lstm(x)
print(output.shape, h_n.shape, c_n.shape)
print(torch.allclose(output[:, -1], h_n[-1]))  # the last step of output = the top layer's h_n
print([name for name, _ in lstm.named_parameters()][:4])
print(lstm.weight_ih_l0.shape)                 # 4 gates × hidden, input

gru = nn.GRU(4, 3, batch_first=True, bidirectional=True)
out, h = gru(x)
print(out.shape, h.shape)                      # both directions are concatenated in out
```

To classify a whole sequence, a common recipe is to feed the **last hidden state** of the top layer, `h_n[-1]`, to a linear layer. (With padding, the last real step differs between sequences; `nn.utils.rnn.pack_padded_sequence` handles that in real PyTorch.)

### Attention

Recurrent layers pass information step by step, which is slow and forgets over long distances. **Attention** lets every position look at every other position directly. Each position produces a **query**; every position also has a **key** and a **value**. A query's similarity to each key (a dot product, divided by √d) becomes a weight through softmax, and the output is the weighted average of the values:

`attention(Q, K, V) = softmax(Q Kᵀ / √d) V`

PyTorch computes this, with fast kernels, in `F.scaled_dot_product_attention(q, k, v)`. Two kinds of **mask** stop positions from attending where they shouldn't:

- a **causal** mask, so position i only sees positions ≤ i (for generating text left to right): `is_causal=True`;
- a **padding** mask, so nothing attends to padding tokens.

```python
import torch
import torch.nn.functional as F

torch.manual_seed(0)
q = torch.randn(1, 3, 4)                 # [batch, length, dim]
k = torch.randn(1, 3, 4)
v = torch.eye(3).unsqueeze(0)            # values = one-hot, so the output shows the weights
print(F.scaled_dot_product_attention(q, k, v))
print(F.scaled_dot_product_attention(q, k, v, is_causal=True))   # row i ignores later positions
weights = torch.softmax(q @ k.transpose(-2, -1) / 4 ** 0.5, dim=-1)
print(torch.allclose(weights @ v, F.scaled_dot_product_attention(q, k, v)))
```

### nn.MultiheadAttention

`nn.MultiheadAttention(embed_dim, num_heads)` learns the projections that make queries, keys and values from its inputs, runs `num_heads` attentions in parallel on `embed_dim / num_heads`-sized slices (each head can attend to different things), and combines them. It returns `(output, weights)`, with the weights averaged over heads by default.

Careful with **boolean masks**: their meaning is opposite in the two APIs.

| API | `True` in a boolean mask means |
|---|---|
| `F.scaled_dot_product_attention(attn_mask=...)` | this position **may** be attended to |
| `nn.MultiheadAttention(attn_mask=..., key_padding_mask=...)` | this position is **masked out** |

```python
import torch
from torch import nn

torch.manual_seed(0)
mha = nn.MultiheadAttention(embed_dim=8, num_heads=2, batch_first=True)
print(mha)
x = torch.randn(2, 4, 8)                                   # batch 2, length 4
pad = torch.tensor([[False, False, False, True],           # sequence 0: last token is padding
                    [False, False, False, False]])
out, w = mha(x, x, x, key_padding_mask=pad)
print(out.shape, w.shape)
print(w[0].sum(dim=-1))                                    # each query's weights sum to 1
print(w[0, :, 3])                                          # nobody attends to the padding
causal = nn.Transformer.generate_square_subsequent_mask(4)
print(causal)                                              # float mask: -inf = blocked
```

`embed_dim` must be divisible by `num_heads`; otherwise construction fails with `embed_dim must be divisible by num_heads`.

### Transformer encoder layers

A **Transformer encoder layer** is self-attention followed by a small feed-forward network, each wrapped in a residual connection and LayerNorm. `nn.TransformerEncoder` stacks copies of one. Attention itself doesn't know token order, so real models add **positional** information (learned or sinusoidal position embeddings) to the token embeddings first.

```python
import torch
from torch import nn

torch.manual_seed(0)
layer = nn.TransformerEncoderLayer(d_model=16, nhead=4, dim_feedforward=32, batch_first=True)
encoder = nn.TransformerEncoder(layer, num_layers=2)
tokens = torch.randint(0, 50, (2, 6))
embed = nn.Embedding(50, 16)
pos = nn.Embedding(6, 16)                                  # learned positions 0..5
h = embed(tokens) + pos(torch.arange(6))
out = encoder(h, src_key_padding_mask=(tokens == 0))
print(out.shape)
print(sum(p.numel() for p in encoder.parameters()))
```

`norm_first=True` moves each LayerNorm before its block ("pre-norm"), which most recent large models use because it trains more stably. `dim_feedforward` defaults to 2048 and dropout to 0.1, so set them for small models.

:::exercise Classify sequences with an LSTM
Write a class `SeqClassifier(nn.Module)` whose constructor takes `vocab_size` and `n_classes`. Create `self.embed` = Embedding(vocab_size, 16), `self.lstm` = LSTM(16, 32, batch_first=True) and `self.head` = Linear(32, n_classes). `forward(tokens)` takes int64 token ids of shape `[N, L]` and returns logits of shape `[N, n_classes]` computed from the LSTM's last hidden state `h_n[-1]`.
```python starter
import torch
from torch import nn

class SeqClassifier(nn.Module):
    pass

model = SeqClassifier(vocab_size=100, n_classes=3)
print(model(torch.randint(0, 100, (4, 7))).shape)    # torch.Size([4, 3])
```
```python check
import torch
from torch import nn
cls = need("SeqClassifier")
torch.manual_seed(0)
m = cls(vocab_size=50, n_classes=4)
assert isinstance(getattr(m, "embed", None), nn.Embedding) and isinstance(getattr(m, "lstm", None), nn.LSTM) and isinstance(getattr(m, "head", None), nn.Linear), "Create self.embed, self.lstm and self.head."
assert m.embed.weight.shape == (50, 16) and m.lstm.hidden_size == 32 and m.lstm.batch_first, "Use Embedding(vocab_size, 16) and LSTM(16, 32, batch_first=True)."
x = torch.randint(0, 50, (3, 6))
out = m(x)
assert tuple(out.shape) == (3, 4), f"The output should be [3, 4], got {list(out.shape)}."
_, (h, _) = m.lstm(m.embed(x))
same(out, m.head(h[-1]), "the logits (computed from h_n[-1])", tol=1e-5)
x2 = x.clone(); x2[:, 0] = (x2[:, 0] + 1) % 50
assert not torch.allclose(m(x2), out), "Changing the first token should change the output: use the last hidden state, which has read the whole sequence."
```
```python solution
import torch
from torch import nn

class SeqClassifier(nn.Module):
    def __init__(self, vocab_size, n_classes):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, 16)
        self.lstm = nn.LSTM(16, 32, batch_first=True)
        self.head = nn.Linear(32, n_classes)

    def forward(self, tokens):
        x = self.embed(tokens)              # [N, L, 16]
        output, (h_n, c_n) = self.lstm(x)   # h_n: [1, N, 32]
        return self.head(h_n[-1])           # [N, n_classes]

model = SeqClassifier(vocab_size=100, n_classes=3)
print(model(torch.randint(0, 100, (4, 7))).shape)
```
hint: Embedding turns `[N, L]` ids into `[N, L, 16]` vectors.
hint: An LSTM returns `output, (h_n, c_n)`; `h_n` has shape `[num_layers, N, 32]`.
hint: `h_n[-1]` is the top layer's final state, shape `[N, 32]`: feed it to the head.
approach:
1. **Understand:** embed, run the recurrence, classify from a fixed-size summary.
2. **Examples:** `[3, 6]` ids → `[3, 6, 16]` → h_n `[1, 3, 32]` → `[3, 4]` logits.
3. **Brute force:** averaging `output` over time also gives a fixed size and works, but the task asks for the last state.
4. **Pattern:** **sequence → last hidden state → linear head**.
5. **Plan:** three layers in `__init__`; unpack the LSTM's two outputs in `forward`.
6. **Code and test:** change the first token and check the output changes.
walkthrough:
**Line by line**

- `self.embed(tokens)` looks up a 16-number vector per token.
- `self.lstm(x)` returns the per-step outputs and the final `(h_n, c_n)`. With one layer, `h_n[-1]` equals `output[:, -1]`; with more layers, `h_n[-1]` is the top layer's.
- `self.head(h_n[-1])` maps the 32-number summary to class scores.

**Why h_n and not output?** `output` is `[N, L, 32]`, one vector per step; a linear layer applied to it gives a prediction per step (useful for tagging each token, not for classifying the sequence).

**Common wrong approach:** `output, h_n = self.lstm(x)` and then using `h_n` as a tensor: for an LSTM the second item is the tuple `(h_n, c_n)`. (For nn.GRU and nn.RNN it is just `h_n`.)
:::

:::exercise Causal attention by hand
Write `causal_attention(q, k, v)` for tensors of shape `[..., L, d]` that returns `softmax(q kᵀ / √d) v` where position i may only attend to positions 0 … i. Don't call `scaled_dot_product_attention`: build the mask yourself (a lower-triangular boolean matrix, or -inf above the diagonal).
```python starter
import math
import torch

def causal_attention(q, k, v):
    pass

torch.manual_seed(0)
q, k, v = torch.randn(3, 4), torch.randn(3, 4), torch.randn(3, 4)
print(causal_attention(q, k, v))
```
```python check
import torch
import torch.nn.functional as F
fn = need("causal_attention")
assert not uses("scaled_dot_product_attention"), "Build it yourself instead of calling scaled_dot_product_attention."
torch.manual_seed(5)
for shape in [(3, 4), (2, 5, 8), (2, 2, 6, 4)]:
    q, k, v = torch.randn(*shape), torch.randn(*shape), torch.randn(*shape)
    same(fn(q, k, v), F.scaled_dot_product_attention(q, k, v, is_causal=True), f"causal_attention on shape {list(shape)}", tol=1e-5)
q, k, v = torch.randn(4, 2), torch.randn(4, 2), torch.eye(4)
w = fn(q, k, v)
same(w.triu(1), torch.zeros(4, 4), "the weights above the diagonal (future positions)")
same(w[0], torch.tensor([1.0, 0.0, 0.0, 0.0]), "row 0, which can only see position 0")
```
```python solution
import math
import torch

def causal_attention(q, k, v):
    d = q.size(-1)
    L = q.size(-2)
    scores = q @ k.transpose(-2, -1) / math.sqrt(d)
    allowed = torch.ones(L, L, dtype=torch.bool).tril()
    scores = scores.masked_fill(~allowed, float("-inf"))
    return torch.softmax(scores, dim=-1) @ v

torch.manual_seed(0)
q, k, v = torch.randn(3, 4), torch.randn(3, 4), torch.randn(3, 4)
print(causal_attention(q, k, v))
```
hint: Scores: `q @ k.transpose(-2, -1) / math.sqrt(d)`, shape `[..., L, L]`.
hint: `torch.ones(L, L, dtype=torch.bool).tril()` is True on and below the diagonal: the allowed positions.
hint: `scores.masked_fill(~allowed, float("-inf"))`, then softmax over the last dim, then `@ v`.
approach:
1. **Understand:** ordinary attention plus a triangular mask.
2. **Examples:** row 0 can only see position 0, so its weights are [1, 0, 0, …].
3. **Brute force:** loop over positions, computing attention over the prefix each time.
4. **Pattern:** **mask with -inf before softmax**: e^(−∞) = 0, so masked positions get zero weight.
5. **Plan:** scores, mask, softmax, weighted sum.
6. **Code and test:** compare with `scaled_dot_product_attention(is_causal=True)`.
walkthrough:
**Line by line**

- `k.transpose(-2, -1)` swaps the last two dims so `q @ kᵀ` has shape `[..., L, L]`: row i holds query i's similarity to every key. Using -2 and -1 makes it work with any number of batch or head dims in front.
- Dividing by √d keeps the scores' scale independent of the vector size, so softmax doesn't become too peaked as d grows.
- `tril()` keeps the lower triangle; `~allowed` marks the future positions; `masked_fill` puts -inf there; broadcasting applies the `[L, L]` mask to every batch.
- softmax turns each row into weights summing to 1, with exactly 0 on masked positions.

**Common wrong approach:** setting masked scores to 0 instead of -inf. e⁰ = 1, so the future positions would still get weight.
:::

:::quiz
? `lstm = nn.LSTM(10, 20, num_layers=2, batch_first=True)` receives `x` of shape `[8, 15, 10]`. What are the shapes of `output` and `h_n`?
+ `[8, 15, 20]` and `[2, 8, 20]`
- `[8, 15, 20]` and `[8, 2, 20]`
- `[15, 8, 20]` and `[2, 8, 20]`
- `[8, 20]` and `[8, 20]`
= batch_first affects input and output only; h_n is always [num_layers × directions, batch, hidden].
? What does `nn.Embedding(1000, 64)` do with an int64 tensor of shape `[4, 12]`?
+ Returns a `[4, 12, 64]` tensor, looking up a learned 64-dim row for each id
- Returns `[4, 64]`, averaging over the sequence
- One-hot encodes the ids into `[4, 12, 1000]`
- Raises an error because the input isn't float
= An embedding is a lookup table indexed by the integer ids.
? In `nn.MultiheadAttention`, what does `True` mean in a boolean `key_padding_mask`?
+ That key position is ignored (masked out)
- That key position is the only one attended to
- That the query is padding
- It's invalid: masks must be float
= In MultiheadAttention a True entry blocks attention; in F.scaled_dot_product_attention a True entry allows it.
? Why is the attention score divided by √d (the size of the query and key vectors)?
+ To keep the scores' scale stable as d grows, so softmax doesn't become too peaked and gradients don't vanish
- To make the output a probability
- To normalise the values
- To reduce memory use
= Dot products of random d-dimensional vectors grow like √d; scaling compensates.
? `nn.MultiheadAttention(embed_dim=100, num_heads=8)` raises an error. Why?
+ embed_dim must be divisible by num_heads
- num_heads must be a power of 2
- embed_dim must be at most 64
- batch_first is missing
= Each head gets embed_dim / num_heads features; 100 / 8 isn't a whole number.
? What does a causal mask do?
+ Stops each position from attending to later positions
- Stops attention to padding tokens
- Makes attention weights sum to 1
- Shuffles the sequence
= It's an upper-triangular block (-inf or False above the diagonal), used for left-to-right generation.
:::

@@@ lesson
id: better-models
title: Training deeper networks well
minutes: 25
summary: Vanishing and exploding gradients, choosing activations (ReLU, LeakyReLU, GELU, SiLU), weight initialisation with nn.init (Kaiming for ReLU, Xavier for tanh) and model.apply, BatchNorm versus LayerNorm, residual connections, regularisation with dropout, weight decay and data augmentation, early stopping, and gradient clipping.
---
Stacking more layers lets a network learn more complex functions, but deep networks are hard to train unless a few things are right. Each technique here fixes a specific problem.

### Vanishing and exploding gradients

Backpropagation multiplies one factor per layer. If those factors are mostly below 1, the gradient reaching the first layers **vanishes** and they barely learn; if mostly above 1, it **explodes**. Sigmoid is a classic culprit: its slope is at most 0.25.

```python
import torch
from torch import nn

def first_layer_grad(activation, depth=20):
    torch.manual_seed(0)
    layers = []
    for _ in range(depth):
        layers += [nn.Linear(32, 32), activation()]
    net = nn.Sequential(*layers)
    net(torch.randn(16, 32)).sum().backward()
    return net[0].weight.grad.abs().mean().item()

print(f"sigmoid: {first_layer_grad(nn.Sigmoid):.2e}")
print(f"relu:    {first_layer_grad(nn.ReLU):.2e}")
```

### Activations

| Activation | Formula | Notes |
|---|---|---|
| `nn.ReLU()` | max(0, x) | fast, the default for CNNs; units can "die" (stay at 0) |
| `nn.LeakyReLU(0.01)` | x if x > 0 else 0.01·x | a small slope for negatives, so units can't die |
| `nn.GELU()` | x·Φ(x) | smooth; the standard in Transformers |
| `nn.SiLU()` | x·sigmoid(x) | smooth (also called Swish); common in modern CNNs and LLMs |
| `nn.Tanh()`, `nn.Sigmoid()` | squash to (−1, 1), (0, 1) | for outputs and gates; avoid stacking many |

```python
import torch
from torch import nn

x = torch.tensor([-2.0, -0.5, 0.0, 0.5, 2.0])
for act in (nn.ReLU(), nn.LeakyReLU(0.1), nn.GELU(), nn.SiLU()):
    print(f"{type(act).__name__:<10}", act(x))
```

### Initialisation

Weights must start at the right scale, so each layer's outputs have roughly the same spread as its inputs. PyTorch's layers already initialise sensibly (Linear and Conv use a Kaiming-uniform variant). When you build very deep networks, or want a specific scheme, `torch.nn.init` has the standard ones:

| Scheme | Spread | For |
|---|---|---|
| `kaiming_normal_(w, nonlinearity="relu")` | std = √(2 / fan_in) | ReLU-family networks |
| `xavier_uniform_(w)` (Glorot) | bound = √(6 / (fan_in + fan_out)) | tanh / sigmoid, attention projections |
| `zeros_(b)`, `ones_`, `constant_` | | biases, norm layers |

`model.apply(fn)` calls `fn` on every submodule, the usual way to initialise a whole model:

```python
import torch
from torch import nn

def init_weights(m):
    if isinstance(m, nn.Linear):
        nn.init.kaiming_normal_(m.weight, nonlinearity="relu")
        nn.init.zeros_(m.bias)

torch.manual_seed(0)
model = nn.Sequential(nn.Linear(256, 256), nn.ReLU(), nn.Linear(256, 10))
model.apply(init_weights)
print(round(model[0].weight.std().item(), 3), round((2 / 256) ** 0.5, 3))
print(model[2].bias)
```

Never initialise all weights to the **same** value (such as zeros): every unit in a layer would compute the same thing and receive the same gradient, so they'd stay identical forever.

### Normalisation layers

| Layer | Normalises over | Typical use |
|---|---|---|
| `nn.BatchNorm1d/2d` | the batch (and pixels), per feature or channel | CNNs with decent batch sizes; behaves differently in train and eval |
| `nn.LayerNorm(d)` | the features of each sample separately | Transformers and RNNs; same in train and eval; works with batch size 1 |

### Residual connections

A **residual connection** adds a block's input to its output: `out = x + F(x)`. The block only has to learn the *change* F(x), and gradients flow straight back through the addition. This is what made networks with 100+ layers trainable (ResNet, 2015), and every Transformer layer uses it.

![x passes through Linear or Conv, ReLU and another Linear or Conv to give F(x); a skip connection carries x around the block to a + node, so out = x + F(x). Gradients flow straight through the +, so very deep networks still train](figures/residual.svg)

```python
import torch
from torch import nn

class Residual(nn.Module):
    def __init__(self, dim):
        super().__init__()
        self.block = nn.Sequential(nn.Linear(dim, dim), nn.ReLU(), nn.Linear(dim, dim))

    def forward(self, x):
        return x + self.block(x)          # shapes must match for the addition

torch.manual_seed(0)
deep = nn.Sequential(*[Residual(32) for _ in range(20)], nn.Linear(32, 1))
deep(torch.randn(16, 32)).sum().backward()
print(f"first-layer gradient: {deep[0].block[0].weight.grad.abs().mean().item():.2e}")
```

### Regularisation: fighting overfitting

| Technique | How | Effect |
|---|---|---|
| more data, augmentation | Part 3 | the best fix when possible |
| dropout | `nn.Dropout(p)` between layers | randomly zeroes units in training, so no unit can rely on another |
| weight decay | `optim.AdamW(..., weight_decay=0.01)` | pulls weights towards 0 each step |
| early stopping | stop when validation loss stops improving, keep the best weights | uses the validation set to pick the epoch |
| smaller model | fewer layers or units | less capacity to memorise |

```python
import copy

def train_with_early_stopping(train_epoch, val_loss, model, patience=3, max_epochs=100):
    best, best_state, bad_epochs = float("inf"), None, 0
    for epoch in range(max_epochs):
        train_epoch()
        loss = val_loss()
        if loss < best:
            best, best_state, bad_epochs = loss, copy.deepcopy(model.state_dict()), 0
        else:
            bad_epochs += 1
            if bad_epochs >= patience:
                break
    model.load_state_dict(best_state)
    return best, epoch

losses = iter([0.9, 0.7, 0.6, 0.62, 0.61, 0.65, 0.5])
import torch
from torch import nn
m = nn.Linear(2, 1)
print(train_with_early_stopping(lambda: None, lambda: next(losses), m, patience=3))
```

### Gradient clipping

For exploding gradients (common in RNNs and large Transformers), rescale the gradients before the optimizer step so their combined norm is at most a limit:

```py-static
loss.backward()
torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
optimizer.step()
```

:::exercise A residual block
Write a class `ResidualBlock(nn.Module)` whose constructor takes `dim`. It has `self.norm` = LayerNorm(dim), `self.fc1` = Linear(dim, 4 × dim), `self.act` = GELU(), `self.fc2` = Linear(4 × dim, dim). `forward(x)` returns `x + fc2(act(fc1(norm(x))))`: a pre-norm residual feed-forward block, as in modern Transformers.
```python starter
import torch
from torch import nn

class ResidualBlock(nn.Module):
    pass

block = ResidualBlock(8)
print(block(torch.randn(2, 5, 8)).shape)
```
```python check
import torch
from torch import nn
cls = need("ResidualBlock")
torch.manual_seed(0)
b = cls(6)
for name, kind in (("norm", nn.LayerNorm), ("fc1", nn.Linear), ("act", nn.GELU), ("fc2", nn.Linear)):
    assert isinstance(getattr(b, name, None), kind), f"Create self.{name} as an nn.{kind.__name__}."
assert b.fc1.weight.shape == (24, 6) and b.fc2.weight.shape == (6, 24), "fc1 should map dim → 4·dim and fc2 back to dim."
x = torch.randn(3, 4, 6)
out = b(x)
same(out, x + b.fc2(b.act(b.fc1(b.norm(x)))), "the block's output", tol=1e-5)
with torch.no_grad():
    b.fc2.weight.zero_(); b.fc2.bias.zero_()
same(b(x), x, "the output when fc2 is all zeros (the block should then pass x through unchanged)")
```
```python solution
import torch
from torch import nn

class ResidualBlock(nn.Module):
    def __init__(self, dim):
        super().__init__()
        self.norm = nn.LayerNorm(dim)
        self.fc1 = nn.Linear(dim, 4 * dim)
        self.act = nn.GELU()
        self.fc2 = nn.Linear(4 * dim, dim)

    def forward(self, x):
        return x + self.fc2(self.act(self.fc1(self.norm(x))))

block = ResidualBlock(8)
print(block(torch.randn(2, 5, 8)).shape)
```
hint: Four layers in `__init__`, created after `super().__init__()`.
hint: The block computes `self.fc2(self.act(self.fc1(self.norm(x))))`.
hint: Return `x +` that: the skip connection.
approach:
1. **Understand:** a sub-network whose output is added to its input.
2. **Examples:** if fc2 outputs zeros, the block is the identity, which is why residual networks start out easy to train.
3. **Brute force:** no shortcut; it's four layers and one addition.
4. **Pattern:** **pre-norm residual**: normalise, transform, add back.
5. **Plan:** define layers; compose them; add x.
6. **Code and test:** zero fc2 and check the output equals the input.
walkthrough:
**Line by line**

- `LayerNorm(dim)` normalises each position's features; applying it *before* the block ("pre-norm") keeps the skip path completely untouched.
- `fc1` expands to 4 × dim, `GELU` adds the non-linearity, `fc2` projects back so the shapes match for the addition. That 4× expansion is the standard Transformer feed-forward size.
- `x + ...` is the residual connection. Its gradient with respect to x includes an identity term, so gradients reach earlier layers even if the block's own gradient is tiny.

**Common wrong approach:** `self.fc2(...) + self.norm(x)`, adding the *normalised* input. The skip should carry the original x.
:::

:::exercise Initialise a model for ReLU
Write `init_weights(m)` for use with `model.apply`: for every `nn.Linear` and `nn.Conv2d`, fill the weight with `nn.init.kaiming_normal_(..., nonlinearity="relu")` and set the bias (if it has one) to zeros; leave every other kind of module alone.
```python starter
import torch
from torch import nn

def init_weights(m):
    pass

torch.manual_seed(0)
model = nn.Sequential(nn.Conv2d(3, 16, 3), nn.ReLU(), nn.Flatten(), nn.Linear(16 * 30 * 30, 10))
model.apply(init_weights)
print(model[0].bias[:3], round(model[3].weight.std().item(), 4))
```
```python check
import math
import torch
from torch import nn
fn = need("init_weights")
torch.manual_seed(0)
model = nn.Sequential(nn.Conv2d(3, 64, 3), nn.BatchNorm2d(64), nn.ReLU(), nn.Flatten(), nn.Linear(4096, 512), nn.Linear(512, 10, bias=False), nn.LayerNorm(10))
model.apply(fn)
same(model[0].bias, torch.zeros(64), "the conv bias")
same(model[4].bias, torch.zeros(512), "the linear bias")
for i, fan_in in ((0, 27), (4, 4096), (5, 512)):
    std = model[i].weight.std().item()
    want = math.sqrt(2 / fan_in)
    assert abs(std - want) / want < 0.15, f"Layer {i}'s weight std should be about √(2 / {fan_in}) = {want:.4f} (Kaiming normal for ReLU), got {std:.4f}."
same(model[1].weight, torch.ones(64), "the BatchNorm weight (leave other modules alone)")
same(model[6].weight, torch.ones(10), "the LayerNorm weight (leave other modules alone)")
```
```python solution
import torch
from torch import nn

def init_weights(m):
    if isinstance(m, (nn.Linear, nn.Conv2d)):
        nn.init.kaiming_normal_(m.weight, nonlinearity="relu")
        if m.bias is not None:
            nn.init.zeros_(m.bias)

torch.manual_seed(0)
model = nn.Sequential(nn.Conv2d(3, 16, 3), nn.ReLU(), nn.Flatten(), nn.Linear(16 * 30 * 30, 10))
model.apply(init_weights)
print(model[0].bias[:3], round(model[3].weight.std().item(), 4))
```
hint: `isinstance(m, (nn.Linear, nn.Conv2d))` checks both types at once.
hint: `nn.init.kaiming_normal_(m.weight, nonlinearity="relu")` works in place (note the trailing underscore).
hint: Layers created with `bias=False` have `m.bias is None`: check before zeroing.
approach:
1. **Understand:** a function applied to every module; only some module types should change.
2. **Examples:** a Linear with 4096 inputs gets weights with std ≈ √(2/4096) ≈ 0.022.
3. **Brute force:** loop over `model.modules()` yourself: equivalent to `apply`.
4. **Pattern:** **type dispatch** inside an init function.
5. **Plan:** isinstance check; init weight; zero the bias if present.
6. **Code and test:** a layer without bias and norm layers that must stay untouched.
walkthrough:
**Line by line**

- `model.apply(fn)` visits every submodule (children first, then the module itself) and calls `fn` on it; Sequential, ReLU and the norm layers are visited too, so the type check matters.
- `kaiming_normal_` draws from a normal distribution with std = √(2 / fan_in): the factor 2 compensates for ReLU zeroing half its inputs, so the signal's variance stays constant through the layers. For a conv, fan_in = in_channels × kH × kW (3 × 3 × 3 = 27 here).
- `m.bias is not None` handles `bias=False` layers.

**Common wrong approach:** `nn.init.kaiming_normal(m.weight)` without the underscore (old, removed names), or initialising the norm layers' weights randomly. Norm layers start at weight 1, bias 0 so they begin as plain normalisation.
:::

:::quiz
? A 30-layer network with sigmoid activations barely learns: its first layers' gradients are near zero. What is this, and a standard fix?
+ Vanishing gradients; use ReLU-family activations, proper initialisation, normalisation and residual connections
- Exploding gradients; lower the batch size
- Overfitting; add dropout
- Underfitting; remove layers
= Sigmoid's slope is at most 0.25, and the factors multiply through every layer.
? Which initialisation suits layers followed by ReLU?
+ Kaiming (He): std = √(2 / fan_in)
- All zeros
- Xavier with gain 1 for every network
- A constant 0.01
= The factor 2 compensates for ReLU discarding the negative half of its inputs.
? Why are Transformers built with LayerNorm rather than BatchNorm?
+ LayerNorm normalises each sample's features on its own, so it doesn't depend on the batch, behaves the same in training and inference, and handles variable-length sequences
- LayerNorm has no learnable parameters
- BatchNorm can't be used on GPUs
- LayerNorm is faster to compute than a linear layer
= BatchNorm's statistics depend on the batch and on padding, which suits sequence models poorly.
? What does a residual connection compute?
+ `out = x + F(x)`
- `out = F(x) − x`
- `out = F(F(x))`
- `out = x · F(x)`
= The block learns a change to its input, and gradients pass through the addition unchanged.
? Validation loss stops improving after epoch 12 while training loss keeps falling. With early stopping (patience 3), which weights should you keep?
+ The weights from epoch 12, the best validation loss
- The weights from the last epoch
- The weights from epoch 15, when training stopped
- The initial weights
= Early stopping saves a copy of the best state_dict and restores it at the end.
:::

@@@ lesson
id: optimizers-and-schedules
title: Optimizers and learning-rate schedules
minutes: 30
summary: What an optimizer holds (param_groups and state), SGD with momentum and Nesterov, Adam and AdamW and why decoupled weight decay matters, RMSprop, different settings per parameter group, learning-rate schedulers (StepLR, MultiStepLR, ExponentialLR, CosineAnnealingLR, LinearLR warm-up, SequentialLR, OneCycleLR and ReduceLROnPlateau), when to call scheduler.step(), gradient accumulation, and saving optimizer and scheduler state.
---
Part 2 introduced the optimizer's job: `step()` updates every parameter using its `.grad`. This lesson looks at the choices that most affect how fast and how well a model trains.

### Inside an optimizer

An optimizer keeps a list of **parameter groups**, each a dict holding its parameters and settings (`lr`, `momentum`, `weight_decay`…), and per-parameter **state** (momentum buffers, Adam's running averages).

```python
import torch
from torch import nn, optim

torch.manual_seed(0)
model = nn.Linear(3, 1)
opt = optim.Adam(model.parameters(), lr=1e-3)
print(opt)
print(len(opt.param_groups), opt.param_groups[0]["lr"])
model(torch.randn(4, 3)).sum().backward()
opt.step()
state = opt.state[model.weight]
print(list(state.keys()), state["step"])
```

### The common optimizers

| Optimizer | Update idea | Typical lr |
|---|---|---|
| `SGD(lr)` | step against the gradient | 0.01–0.1 |
| `SGD(lr, momentum=0.9)` | keep a running velocity, so steps build up along consistent directions | 0.01–0.1 |
| `SGD(..., nesterov=True)` | look ahead along the velocity before taking the gradient | 0.01–0.1 |
| `RMSprop(lr)` | divide by a running root-mean-square of recent gradients | 0.001–0.01 |
| `Adam(lr)` | momentum **and** per-parameter scaling (adaptive learning rates) | 1e-4–1e-3 |
| `AdamW(lr, weight_decay=0.01)` | Adam with **decoupled** weight decay | 1e-4–1e-3 |

**Adam versus AdamW:** in `Adam`, `weight_decay` is added to the gradient, so Adam's per-parameter scaling weakens it for parameters with large gradients. `AdamW` applies the decay directly to the weights, separately from the gradient step (`w ← w − lr·wd·w`), which regularises consistently. AdamW is the default choice for Transformers and most modern training.

### Different settings per group

Pass a list of dicts to give parts of the model different settings. Two common uses: a smaller learning rate for pretrained layers (next lesson), and no weight decay on biases and normalisation weights.

```python
import torch
from torch import nn, optim

model = nn.Sequential(nn.Linear(4, 8), nn.LayerNorm(8), nn.ReLU(), nn.Linear(8, 2))
decay, no_decay = [], []
for name, p in model.named_parameters():
    (no_decay if p.ndim == 1 else decay).append(p)       # biases and norm weights are 1-D
opt = optim.AdamW([{"params": decay, "weight_decay": 0.01},
                   {"params": no_decay, "weight_decay": 0.0}], lr=3e-4)
for g in opt.param_groups:
    print(len(g["params"]), g["weight_decay"], g["lr"])
```

### Learning-rate schedules

A fixed learning rate is rarely best: a larger one early makes fast progress, a smaller one later settles into a good minimum. A **scheduler** changes `param_groups[i]["lr"]` each time you call `scheduler.step()`.

![Learning rate over 60 steps starting from 0.1: StepLR(step_size=20, gamma=0.5) halves it at steps 20 and 40; CosineAnnealingLR(T_max=60) follows a half cosine down to 0; a LinearLR warm-up rises from 0.005 to 0.1 over 10 steps and then follows a cosine down; OneCycleLR rises to max_lr and then anneals to near 0](figures/lr-schedules.svg)

| Scheduler | Schedule |
|---|---|
| `StepLR(opt, step_size, gamma=0.1)` | multiply by gamma every step_size steps |
| `MultiStepLR(opt, milestones=[30, 80], gamma=0.1)` | multiply by gamma at chosen steps |
| `ExponentialLR(opt, gamma)` | multiply by gamma every step |
| `CosineAnnealingLR(opt, T_max, eta_min=0)` | half a cosine from lr down to eta_min over T_max steps |
| `LinearLR(opt, start_factor, end_factor=1.0, total_iters)` | linear change, usually a **warm-up** from a small factor |
| `SequentialLR(opt, [s1, s2], milestones=[n])` | s1 for n steps, then s2 |
| `OneCycleLR(opt, max_lr, total_steps)` | warm up to max_lr then anneal; stepped **every batch** |
| `ReduceLROnPlateau(opt, factor=0.1, patience=10)` | cut the lr when a metric stops improving: `step(val_loss)` |

Call `optimizer.step()` **before** `scheduler.step()`, usually once per epoch (OneCycleLR and many warm-up schedules: once per batch). Calling them the other way round skips the first learning rate, and PyTorch warns:

```python
import torch
from torch import nn, optim

model = nn.Linear(2, 1)
opt = optim.SGD(model.parameters(), lr=0.1)
sched = optim.lr_scheduler.StepLR(opt, step_size=2, gamma=0.5)
for epoch in range(6):
    # ... train for one epoch: forward, loss, backward, opt.step() for every batch ...
    opt.step()
    sched.step()
    print(epoch, sched.get_last_lr())

sched2 = optim.lr_scheduler.StepLR(optim.SGD(model.parameters(), lr=0.1), step_size=2)
sched2.step()                                  # before any optimizer.step(): a warning
```

Warm-up followed by cosine decay is the standard recipe for Transformers:

```python
import torch
from torch import nn, optim

opt = optim.AdamW(nn.Linear(2, 1).parameters(), lr=1e-3)
warmup = optim.lr_scheduler.LinearLR(opt, start_factor=0.1, total_iters=3)
cosine = optim.lr_scheduler.CosineAnnealingLR(opt, T_max=5)
sched = optim.lr_scheduler.SequentialLR(opt, schedulers=[warmup, cosine], milestones=[3])
for step in range(8):
    print(step, f"{sched.get_last_lr()[0]:.6f}")
    opt.step()
    sched.step()
```

`ReduceLROnPlateau` is different: it reacts to a value you pass it, typically the validation loss.

```python
import torch
from torch import nn, optim

opt = optim.SGD(nn.Linear(2, 1).parameters(), lr=0.1)
sched = optim.lr_scheduler.ReduceLROnPlateau(opt, mode="min", factor=0.5, patience=1)
for val_loss in [1.0, 0.8, 0.85, 0.84, 0.9, 0.6]:
    sched.step(val_loss)
    print(val_loss, opt.param_groups[0]["lr"])
```

### Gradient accumulation

When the batch you want doesn't fit in memory, run several smaller **micro-batches**, call `backward()` on each (gradients add up in `.grad`), and step once. Divide each loss by the number of micro-batches so the gradient matches one big batch's mean loss.

```python
import torch
from torch import nn, optim

torch.manual_seed(0)
x, y = torch.randn(8, 3), torch.randn(8, 1)
model = nn.Linear(3, 1)
loss_fn = nn.MSELoss()

model.zero_grad()
loss_fn(model(x), y).backward()                 # one batch of 8
big = model.weight.grad.clone()

model.zero_grad()
for xb, yb in zip(x.split(2), y.split(2)):      # four micro-batches of 2
    (loss_fn(model(xb), yb) / 4).backward()
print(torch.allclose(big, model.weight.grad))
```

### Checkpoints include the optimizer and scheduler

To resume training exactly, save `optimizer.state_dict()` (momentum and Adam statistics) and `scheduler.state_dict()` alongside the model's (Part 2), and load all three.

```py-static
torch.save({"model": model.state_dict(), "optimizer": opt.state_dict(),
            "scheduler": sched.state_dict(), "epoch": epoch}, "checkpoint.pt")
```

:::exercise Warm-up then cosine
Write `make_scheduler(opt, warmup, total)` that returns a `SequentialLR` which runs `LinearLR(start_factor=0.1, total_iters=warmup)` for the first `warmup` steps, then `CosineAnnealingLR(T_max=total - warmup)`.
```python starter
import torch
from torch import nn, optim

def make_scheduler(opt, warmup, total):
    pass

opt = optim.AdamW(nn.Linear(2, 1).parameters(), lr=1e-3)
sched = make_scheduler(opt, warmup=2, total=6)
for _ in range(6):
    print(round(sched.get_last_lr()[0], 6))
    opt.step()
    sched.step()
```
```python check
import torch
from torch import nn, optim
fn = need("make_scheduler")
def lrs(make, steps):
    opt = optim.SGD(nn.Linear(2, 1).parameters(), lr=0.5)
    s = make(opt)
    out = []
    for _ in range(steps):
        out.append(opt.param_groups[0]["lr"]); opt.step(); s.step()
    return out, s
for warm, total in ((2, 6), (5, 20), (1, 4)):
    got, s = lrs(lambda o: fn(o, warm, total), total)
    assert isinstance(s, optim.lr_scheduler.SequentialLR), "Return a SequentialLR."
    want, _ = lrs(lambda o: optim.lr_scheduler.SequentialLR(o, [optim.lr_scheduler.LinearLR(o, start_factor=0.1, total_iters=warm), optim.lr_scheduler.CosineAnnealingLR(o, T_max=total - warm)], milestones=[warm]), total)
    assert all(abs(a - b) < 1e-12 for a, b in zip(got, want)), f"With warmup={warm}, total={total} the learning rates should be {[round(v, 4) for v in want]}, got {[round(v, 4) for v in got]}."
```
```python solution
import torch
from torch import nn, optim

def make_scheduler(opt, warmup, total):
    warm = optim.lr_scheduler.LinearLR(opt, start_factor=0.1, total_iters=warmup)
    cosine = optim.lr_scheduler.CosineAnnealingLR(opt, T_max=total - warmup)
    return optim.lr_scheduler.SequentialLR(opt, schedulers=[warm, cosine], milestones=[warmup])

opt = optim.AdamW(nn.Linear(2, 1).parameters(), lr=1e-3)
sched = make_scheduler(opt, warmup=2, total=6)
for _ in range(6):
    print(round(sched.get_last_lr()[0], 6))
    opt.step()
    sched.step()
```
hint: Build both schedulers on the same optimizer.
hint: `optim.lr_scheduler.SequentialLR(opt, schedulers=[warm, cosine], milestones=[warmup])`.
hint: The cosine part lasts the remaining `total - warmup` steps.
approach:
1. **Understand:** chain a linear warm-up into a cosine decay at a milestone.
2. **Examples:** lr 1e-3, warm-up 2: 1e-4, 5.5e-4, then the cosine from 1e-3 down.
3. **Brute force:** a `LambdaLR` with your own formula: works, but this combines tested pieces.
4. **Pattern:** **SequentialLR** switches schedulers at milestones.
5. **Plan:** two schedulers, then SequentialLR.
6. **Code and test:** print every step's learning rate.
walkthrough:
**Line by line**

- `LinearLR(start_factor=0.1, total_iters=warmup)` starts at 0.1 × lr and rises linearly to the full lr over `warmup` steps.
- `CosineAnnealingLR(T_max=total - warmup)` then decays from the full lr to 0 over the remaining steps.
- `SequentialLR(..., milestones=[warmup])` uses the first scheduler until step `warmup`, then switches.

**Why warm up?** At the start, Adam's statistics are unreliable and the weights are random, so large steps can push training somewhere bad. A few hundred to a few thousand steps of warm-up is standard for Transformers.

**Common wrong approach:** stepping both schedulers yourself in the loop. Each one changes the same `lr` in the param groups, so they'd fight; SequentialLR steps only the active one.
:::

:::exercise Accumulate gradients
Write `accumulated_step(model, loss_fn, opt, micro_batches, max_norm=1.0)` where `micro_batches` is a list of `(x, y)` pairs. It zeroes the gradients, calls `backward()` on each micro-batch's loss divided by the number of micro-batches, clips the total gradient norm to `max_norm` with `torch.nn.utils.clip_grad_norm_`, takes one optimizer step, and returns the average of the micro-batch losses as a Python float.
```python starter
import torch
from torch import nn, optim

def accumulated_step(model, loss_fn, opt, micro_batches, max_norm=1.0):
    pass

torch.manual_seed(0)
model = nn.Linear(3, 1)
opt = optim.SGD(model.parameters(), lr=0.1)
batches = [(torch.randn(4, 3), torch.randn(4, 1)) for _ in range(3)]
print(accumulated_step(model, nn.MSELoss(), opt, batches))
```
```python check
import copy
import torch
from torch import nn, optim
fn = need("accumulated_step")
torch.manual_seed(1)
model = nn.Linear(3, 2)
ref = copy.deepcopy(model)
batches = [(torch.randn(5, 3) * 3, torch.randn(5, 2)) for _ in range(4)]
loss_fn = nn.MSELoss()
model.weight.grad = torch.ones(2, 3)                          # stale gradients that must be cleared
got = fn(model, loss_fn, optim.SGD(model.parameters(), lr=0.1), batches, max_norm=0.5)
assert isinstance(got, float), "Return the average loss as a Python float."
opt = optim.SGD(ref.parameters(), lr=0.1)
opt.zero_grad()
losses = []
for x, y in batches:
    l = loss_fn(ref(x), y); losses.append(l.item()); (l / 4).backward()
torch.nn.utils.clip_grad_norm_(ref.parameters(), 0.5)
opt.step()
assert abs(got - sum(losses) / 4) < 1e-5, f"The returned loss should be the mean of the micro-batch losses, {sum(losses) / 4:.5f}, got {got:.5f}."
same(model.weight, ref.weight, "the weights after the step (zero_grad, scaled backward, clip, step)", tol=1e-5)
same(model.bias, ref.bias, "the bias after the step", tol=1e-5)
```
```python solution
import torch
from torch import nn, optim

def accumulated_step(model, loss_fn, opt, micro_batches, max_norm=1.0):
    opt.zero_grad()
    n = len(micro_batches)
    total = 0.0
    for x, y in micro_batches:
        loss = loss_fn(model(x), y)
        (loss / n).backward()
        total += loss.item()
    torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm)
    opt.step()
    return total / n

torch.manual_seed(0)
model = nn.Linear(3, 1)
opt = optim.SGD(model.parameters(), lr=0.1)
batches = [(torch.randn(4, 3), torch.randn(4, 1)) for _ in range(3)]
print(accumulated_step(model, nn.MSELoss(), opt, batches))
```
hint: `opt.zero_grad()` once at the start: the gradients from earlier steps must not leak in.
hint: Inside the loop, `(loss / n).backward()` adds each micro-batch's share into `.grad`; keep `loss.item()` for the return value.
hint: After the loop: `torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm)`, then `opt.step()`.
approach:
1. **Understand:** several backward passes, one update, the same result as one big batch.
2. **Examples:** 4 micro-batches of 5 ≈ one batch of 20 (exactly, for equal-sized micro-batches and a mean loss).
3. **Brute force:** concatenate the micro-batches into one: that's what accumulation avoids when memory is short.
4. **Pattern:** **zero once, backward many, clip, step once**.
5. **Plan:** zero_grad; loop with scaled backward; clip; step; return the mean.
6. **Code and test:** compare the updated weights with a reference.
walkthrough:
**Line by line**

- Gradients accumulate in `.grad` across `backward()` calls (Part 2), which is exactly what we want here, so zero only once.
- Dividing each loss by n makes the summed gradient the gradient of the *average* loss, as if one big batch had been used.
- Clipping happens after all the gradients are in, so it limits the norm of the full gradient.
- `opt.step()` applies one update; `total / n` reports the average loss (unscaled, for logging).

**Common wrong approach:** calling `opt.step()` (or `zero_grad()`) inside the loop, which turns it into n small updates instead of one large one.
:::

:::quiz
? What is the main difference between `Adam(weight_decay=...)` and `AdamW(weight_decay=...)`?
+ AdamW applies weight decay directly to the weights, decoupled from the adaptive gradient step; Adam adds it to the gradient
- AdamW doesn't use momentum
- Adam doesn't support weight decay
- AdamW uses a fixed learning rate
= Decoupled weight decay regularises every weight consistently, which is why AdamW is standard for Transformers.
? In which order should these be called in an epoch-based training loop?
+ `optimizer.step()` for each batch, then `scheduler.step()` once at the end of the epoch
- `scheduler.step()` then `optimizer.step()`
- `scheduler.step()` before `loss.backward()`
- Only `scheduler.step()`; it calls the optimizer itself
= Calling the scheduler first skips the initial learning rate, and PyTorch warns about it.
? `StepLR(opt, step_size=10, gamma=0.1)` with initial lr 0.1. What is the lr after 25 calls to `scheduler.step()`?
+ 0.001
- 0.01
- 0.0001
- 0.1
= It is multiplied by 0.1 after steps 10 and 20: 0.1 → 0.01 → 0.001.
? Which scheduler needs a metric passed to `step()`?
+ `ReduceLROnPlateau`
- `CosineAnnealingLR`
- `OneCycleLR`
- `LinearLR`
= It lowers the lr when the metric (usually validation loss) stops improving for `patience` steps.
? With gradient accumulation over 4 micro-batches, why divide each micro-batch's loss by 4?
+ So the accumulated gradient equals the gradient of the average loss over the whole batch
- To make training faster
- Because backward() can only be called on small values
- To avoid zeroing the gradients
= Gradients from each backward() add up; dividing by 4 turns the sum into a mean.
? What does an optimizer's `param_groups` let you do?
+ Use different hyperparameters (like lr or weight_decay) for different sets of parameters
- Train several models at once on different GPUs
- Group parameters by dtype
- Freeze parameters automatically
= Each group is a dict of parameters plus its own settings; schedulers update every group's lr.
:::

@@@ lesson
id: transfer-learning
title: Transfer learning and modifying models
minutes: 30
summary: Reusing a model trained on a large dataset, inspecting a model's structure (children, named_modules, named_parameters, get_submodule), freezing parameters with requires_grad_, replacing the final layer, giving the optimizer only trainable parameters, fine-tuning with smaller learning rates for pretrained layers, keeping frozen BatchNorm in eval mode, loading pretrained weights partially with strict=False, forward hooks to read intermediate features, and torchvision's pretrained models.
---
Training a large model from scratch needs a lot of data and compute. **Transfer learning** starts instead from a model already trained on a big dataset (ImageNet images, or web text), whose early layers have learned general features (edges, textures, word meanings), and adapts it to your task with far less data.

![A pretrained backbone of four blocks, frozen with requires_grad=False, holding general features learned on a big dataset, followed by a new trainable head nn.Linear(f, classes). Then optionally unfreeze the last blocks with a smaller learning rate (fine-tuning)](figures/transfer-learning.svg)

Two strategies, often used one after the other:

1. **Feature extraction:** freeze the whole pretrained **backbone** and train only a new **head** (the final layer, sized for your classes). Fast, and robust with little data.
2. **Fine-tuning:** also unfreeze some or all backbone layers and train them with a **smaller** learning rate, so the pretrained features adjust gently.

In real projects the pretrained model usually comes from a library:

```py-static
from torchvision.models import resnet18, ResNet18_Weights

weights = ResNet18_Weights.DEFAULT
model = resnet18(weights=weights)            # downloads the ImageNet weights
preprocess = weights.transforms()            # the exact resizing and normalisation they were trained with
model.fc = nn.Linear(model.fc.in_features, 5)   # replace the 1000-class head with a 5-class one
```

(The sandbox can't download weights, so the examples below "pretrain" a small model themselves.)

### Looking inside a model

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

### Freezing and replacing the head

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

### Fine-tuning with parameter groups

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

### A complete example

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

### Loading pretrained weights partially

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

### Reading intermediate features with hooks

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

:::exercise Freeze the backbone, replace the head
Write `prepare_for_finetune(model, n_classes)` for a model with two attributes: `features` (the backbone) and `classifier` (an `nn.Linear`). It freezes every parameter of `features`, replaces `classifier` with a new `nn.Linear` with the same number of inputs and `n_classes` outputs, and returns an `optim.Adam` optimizer with `lr=1e-3` over the trainable parameters only.
```python starter
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
```python check
import torch
from torch import nn, optim
fn = need("prepare_for_finetune")
class _Net(nn.Module):
    def __init__(self):
        super().__init__()
        self.features = nn.Sequential(nn.Conv2d(1, 6, 3), nn.ReLU(), nn.AdaptiveAvgPool2d(1), nn.Flatten(), nn.Linear(6, 12))
        self.classifier = nn.Linear(12, 50)
    def forward(self, x):
        return self.classifier(self.features(x))
torch.manual_seed(0)
m = _Net()
before = {k: v.clone() for k, v in m.features.state_dict().items()}
opt = fn(m, 7)
assert isinstance(opt, optim.Adam), f"Return an optim.Adam optimizer, got {type(opt).__name__}."
assert all(not p.requires_grad for p in m.features.parameters()), "Every parameter in features should have requires_grad=False."
assert isinstance(m.classifier, nn.Linear) and m.classifier.in_features == 12 and m.classifier.out_features == 7, f"classifier should be a new nn.Linear(12, 7), got {m.classifier}."
assert all(p.requires_grad for p in m.classifier.parameters()), "The new classifier should be trainable."
opt_params = [p for g in opt.param_groups for p in g["params"]]
assert len(opt_params) == 2 and all(any(p is q for q in m.classifier.parameters()) for p in opt_params), "The optimizer should hold only the new classifier's weight and bias."
assert opt.param_groups[0]["lr"] == 1e-3, "Use lr=1e-3."
x = torch.randn(4, 1, 6, 6)
for _ in range(3):
    opt.zero_grad(); m(x).pow(2).mean().backward(); opt.step()
for k, v in m.features.state_dict().items():
    assert torch.equal(v, before[k]), f"The backbone changed during training ({k}): it should be frozen."
```
```python solution
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
hint: `model.features.requires_grad_(False)` freezes the whole backbone in one call.
hint: `model.classifier.in_features` tells you how many inputs the new layer needs.
hint: Build the optimizer **after** replacing the head, from `[p for p in model.parameters() if p.requires_grad]`.
approach:
1. **Understand:** freeze, swap the head, optimise only what should change.
2. **Examples:** a 100-class head with 20 inputs → a 4-class head with 20 inputs: 84 trainable parameters.
3. **Brute force:** loop over `features.parameters()` setting `p.requires_grad = False`: the same as `requires_grad_(False)`.
4. **Pattern:** **feature extraction**: frozen backbone + new head.
5. **Plan:** freeze; replace; filter trainable parameters; create Adam.
6. **Code and test:** train a few steps and check the backbone's weights didn't move.
walkthrough:
**Line by line**

- `requires_grad_(False)` on a module sets the flag on all its parameters (recursively). Autograd then skips computing their gradients, which also saves time and memory.
- Assigning `model.classifier = nn.Linear(...)` registers the new layer in place of the old one; its parameters are freshly initialised and require grad.
- The optimizer must be created *after* the swap: an optimizer built earlier would hold the old head's parameters, and the new head would never be updated.

**Common wrong approach:** `optim.Adam(model.parameters())` before replacing the head, which leaves the new head untrained while the loss doesn't improve.
:::

:::exercise Extract features with a hook
Write `get_features(model, layer, x)` that runs `model(x)` and returns the output of the submodule `layer` from that forward pass (detached), using `register_forward_hook`. It must remove the hook before returning, so the model is left with no hooks attached.
```python starter
import torch
from torch import nn

def get_features(model, layer, x):
    pass

torch.manual_seed(0)
model = nn.Sequential(nn.Linear(4, 8), nn.ReLU(), nn.Linear(8, 2))
print(get_features(model, model[1], torch.randn(3, 4)).shape)     # torch.Size([3, 8])
```
```python check
import torch
from torch import nn
fn = need("get_features")
torch.manual_seed(2)
model = nn.Sequential(nn.Linear(4, 8), nn.Tanh(), nn.Linear(8, 6), nn.ReLU(), nn.Linear(6, 2))
x = torch.randn(5, 4)
got = fn(model, model[2], x)
same(got, model[2](model[1](model[0](x))), "the output of model[2]", tol=1e-6)
assert not got.requires_grad, "Return the features detached from the graph (output.detach())."
assert len(model[2]._forward_hooks) == 0, "Remove the hook (handle.remove()) before returning."
got2 = fn(model, model[3], x)
assert tuple(got2.shape) == (5, 6) and (got2 >= 0).all(), "get_features on model[3] (the ReLU) should give its non-negative [5, 6] output."
assert all(len(m._forward_hooks) == 0 for m in model.modules()), "No hooks should remain anywhere in the model."
assert uses("register_forward_hook"), "Use register_forward_hook."
```
```python solution
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
hint: A forward hook has the signature `hook(module, inputs, output)`.
hint: Store `output.detach()` somewhere the outer function can read, such as a dict or a list.
hint: `handle = layer.register_forward_hook(hook)`, run the model, then `handle.remove()` (a `try`/`finally` removes it even if the forward pass fails).
approach:
1. **Understand:** observe one layer's output during a normal forward pass, without changing the model.
2. **Examples:** model[1] is the ReLU after the first linear layer: shape `[3, 8]`, all ≥ 0.
3. **Brute force:** call the layers one by one up to `layer`: only works for Sequential models.
4. **Pattern:** **forward hook + handle.remove()**.
5. **Plan:** define the hook; register; run; remove; return.
6. **Code and test:** check that no hooks are left on any module.
walkthrough:
**Line by line**

- The hook is called by `layer`'s `__call__` right after its `forward`, with the module, its positional inputs (a tuple) and its output.
- `output.detach()` keeps the values without holding on to the computation graph.
- `handle.remove()` unregisters the hook. Forgotten hooks keep running on every later forward pass, slowing things down and filling memory.
- `try`/`finally` guarantees removal even when `model(x)` raises.

**Why it matters:** hooks work on any model, including ones you didn't write (torchvision, Hugging Face), which is how embedding extraction, feature visualisation and many debugging tools are built.

**Common wrong approach:** returning the hook's result from the hook (any non-None return value *replaces* the layer's output, changing the model's behaviour).
:::

:::quiz
? You freeze a pretrained backbone and replace its head. Which parameters should the optimizer receive?
+ Only the parameters with `requires_grad=True` (the new head)
- All of `model.parameters()`, including the frozen ones, to keep their momentum
- Only the backbone's parameters
- No parameters: frozen models don't need an optimizer
= Passing only trainable parameters keeps the optimizer from touching frozen weights and saves memory.
? Why use a smaller learning rate for pretrained layers than for a new head when fine-tuning?
+ Large updates would destroy the useful pretrained features; the new, random head needs to change much more
- Pretrained layers can't have a learning rate above 1e-5
- It makes the model smaller
- To freeze them
= Discriminative learning rates adapt pretrained features gently.
? `new.load_state_dict(state, strict=False)` where `state` lacks the head's keys. What happens?
+ The matching keys load, and the result lists the head's keys under `missing_keys`
- It raises a RuntimeError for the missing keys
- Nothing loads
- The head is filled with zeros
= strict=False tolerates missing and unexpected keys, but shape mismatches still raise an error.
? A frozen backbone contains BatchNorm layers. What still changes during `model.train()` if you do nothing else?
+ The BatchNorm running mean and variance
- The BatchNorm weight and bias
- The convolution weights
- Nothing
= Running statistics are buffers updated in train mode regardless of requires_grad; keep those layers in eval().
? What does `module.register_forward_hook(fn)` give you?
+ A call to `fn(module, inputs, output)` after each forward pass of that module, and a handle to remove it
- A way to change the module's forward code permanently
- The module's gradients during backward
- A copy of the module
= Forward hooks observe (or, by returning a value, replace) a module's output.
? Which method lists only a module's direct submodules, with their names?
+ `named_children()`
- `named_modules()`
- `named_parameters()`
- `state_dict()`
= named_modules() recurses through every level; named_children() stops at the first.
:::
