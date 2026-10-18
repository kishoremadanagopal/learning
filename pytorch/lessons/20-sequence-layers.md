# Lesson 20: Recurrent layers and attention

**You'll learn:** sequence tensors and batch_first, nn.Embedding as a lookup table, recurrent layers (RNN, LSTM, GRU), hidden and cell states, output versus h_n and c_n, num_layers and bidirectional, classifying from the last hidden state, scaled dot-product attention, queries, keys and values, scaling by √d, causal and padding masks, nn.MultiheadAttention and its opposite boolean-mask convention, TransformerEncoderLayer and TransformerEncoder, positional embeddings, pre-norm.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/pytorch/#sequence-layers)**: run every example and check your exercise answers.

## Key terms

- **Embedding:** a learned lookup table that turns integer token ids into vectors.
- **Recurrent layer:** a layer that processes a sequence step by step, carrying a hidden state from one step to the next.
- **Hidden state:** the vector a recurrent layer carries between steps, summarising what it has read so far.
- **LSTM:** a recurrent layer with input, forget and output gates and a separate cell state, which remembers over long sequences.
- **GRU:** a simpler gated recurrent layer with reset and update gates.
- **Attention:** a weighted average of values, with weights from the softmax of query–key similarities.
- **Query, key, value:** the three projections of the input used by attention: what a position is looking for, what it offers to match, and what it passes on.
- **Causal mask:** a mask that stops each position attending to later positions.
- **Multi-head attention:** several attention operations in parallel on slices of the features, combined by a linear layer.
- **Transformer encoder layer:** self-attention plus a feed-forward network, each with a residual connection and LayerNorm.
- **Positional embedding:** information about each token's position, added to its embedding because attention ignores order.

Text, audio, sensor readings and time series are **sequences**: the order matters. Their tensors have a time (or position) dimension. With `batch_first=True` the layout is `[batch, length, features]`.

## From tokens to vectors: nn.Embedding

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

## Recurrent layers: RNN, LSTM and GRU

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

## Attention

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

## nn.MultiheadAttention

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

## Transformer encoder layers

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

## At a glance

| Concept | Code | Gives you | Remember |
|---|---|---|---|
| Tokens to vectors | `nn.Embedding(vocab, dim)` | `[N, L] → [N, L, dim]` | int64 ids |
| Recurrent layer | `nn.LSTM(in, hidden, batch_first=True)` | `output, (h_n, c_n)` | GRU/RNN return `output, h_n` |
| Classify a sequence | `head(h_n[-1])` | `[N, classes]` | top layer's last state |
| Attention | `F.scaled_dot_product_attention(q, k, v)` | softmax(QKᵀ / √d) V | fused, fast kernels |
| Causal | `is_causal=True` or `nn.Transformer.generate_square_subsequent_mask(L)` | no peeking ahead | float mask: -inf blocks |
| Multi-head | `nn.MultiheadAttention(E, heads, batch_first=True)` | `(output, weights)` | bool True = masked out |
| Transformer | `nn.TransformerEncoder(nn.TransformerEncoderLayer(d, h, batch_first=True), n)` | stacked layers | add positional embeddings first |

## Common mistakes

- Forgetting that h_n is `[layers × directions, N, hidden]` even with `batch_first=True`.
- Unpacking an LSTM's result as `output, h_n` (it's `output, (h_n, c_n)`).
- Using `output` (every step) where one vector per sequence is needed.
- Mixing up boolean mask meanings: True means "keep" in scaled_dot_product_attention but "mask out" in MultiheadAttention.
- Masking with 0 instead of -inf before softmax.
- Choosing `embed_dim` not divisible by `num_heads`.
- Forgetting positional information in a Transformer.

## Exercises

### 1. Classify sequences with an LSTM

Write a class `SeqClassifier(nn.Module)` whose constructor takes `vocab_size` and `n_classes`. Create `self.embed` = Embedding(vocab_size, 16), `self.lstm` = LSTM(16, 32, batch_first=True) and `self.head` = Linear(32, n_classes). `forward(tokens)` takes int64 token ids of shape `[N, L]` and returns logits of shape `[N, n_classes]` computed from the LSTM's last hidden state `h_n[-1]`.

Starter code:

```python
import torch
from torch import nn

class SeqClassifier(nn.Module):
    pass

model = SeqClassifier(vocab_size=100, n_classes=3)
print(model(torch.randint(0, 100, (4, 7))).shape)    # torch.Size([4, 3])
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** embed, run the recurrence, classify from a fixed-size summary.
2. **Examples:** `[3, 6]` ids → `[3, 6, 16]` → h_n `[1, 3, 32]` → `[3, 4]` logits.
3. **Brute force:** averaging `output` over time also gives a fixed size and works, but the task asks for the last state.
4. **Pattern:** **sequence → last hidden state → linear head**.
5. **Plan:** three layers in `__init__`; unpack the LSTM's two outputs in `forward`.
6. **Code and test:** change the first token and check the output changes.

</details>

<details>
<summary>💡 Hint 1</summary>

Embedding turns `[N, L]` ids into `[N, L, 16]` vectors.

</details>

<details>
<summary>💡 Hint 2</summary>

An LSTM returns `output, (h_n, c_n)`; `h_n` has shape `[num_layers, N, 32]`.

</details>

<details>
<summary>💡 Hint 3</summary>

`h_n[-1]` is the top layer's final state, shape `[N, 32]`: feed it to the head.

</details>

### 2. Causal attention by hand

Write `causal_attention(q, k, v)` for tensors of shape `[..., L, d]` that returns `softmax(q kᵀ / √d) v` where position i may only attend to positions 0 … i. Don't call `scaled_dot_product_attention`: build the mask yourself (a lower-triangular boolean matrix, or -inf above the diagonal).

Starter code:

```python
import math
import torch

def causal_attention(q, k, v):
    pass

torch.manual_seed(0)
q, k, v = torch.randn(3, 4), torch.randn(3, 4), torch.randn(3, 4)
print(causal_attention(q, k, v))
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** ordinary attention plus a triangular mask.
2. **Examples:** row 0 can only see position 0, so its weights are [1, 0, 0, …].
3. **Brute force:** loop over positions, computing attention over the prefix each time.
4. **Pattern:** **mask with -inf before softmax**: e^(−∞) = 0, so masked positions get zero weight.
5. **Plan:** scores, mask, softmax, weighted sum.
6. **Code and test:** compare with `scaled_dot_product_attention(is_causal=True)`.

</details>

<details>
<summary>💡 Hint 1</summary>

Scores: `q @ k.transpose(-2, -1) / math.sqrt(d)`, shape `[..., L, L]`.

</details>

<details>
<summary>💡 Hint 2</summary>

`torch.ones(L, L, dtype=torch.bool).tril()` is True on and below the diagonal: the allowed positions.

</details>

<details>
<summary>💡 Hint 3</summary>

`scores.masked_fill(~allowed, float("-inf"))`, then softmax over the last dim, then `@ v`.

</details>

**In the sandbox:** exercises 39–40. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Classify sequences with an LSTM</summary>

```python
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

**Line by line**

- `self.embed(tokens)` looks up a 16-number vector per token.
- `self.lstm(x)` returns the per-step outputs and the final `(h_n, c_n)`. With one layer, `h_n[-1]` equals `output[:, -1]`; with more layers, `h_n[-1]` is the top layer's.
- `self.head(h_n[-1])` maps the 32-number summary to class scores.

**Why h_n and not output?** `output` is `[N, L, 32]`, one vector per step; a linear layer applied to it gives a prediction per step (useful for tagging each token, not for classifying the sequence).

**Common wrong approach:** `output, h_n = self.lstm(x)` and then using `h_n` as a tensor: for an LSTM the second item is the tuple `(h_n, c_n)`. (For nn.GRU and nn.RNN it is just `h_n`.)

</details>

<details>
<summary>✅ 2. Causal attention by hand</summary>

```python
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

**Line by line**

- `k.transpose(-2, -1)` swaps the last two dims so `q @ kᵀ` has shape `[..., L, L]`: row i holds query i's similarity to every key. Using -2 and -1 makes it work with any number of batch or head dims in front.
- Dividing by √d keeps the scores' scale independent of the vector size, so softmax doesn't become too peaked as d grows.
- `tril()` keeps the lower triangle; `~allowed` marks the future positions; `masked_fill` puts -inf there; broadcasting applies the `[L, L]` mask to every batch.
- softmax turns each row into weights summing to 1, with exactly 0 on masked positions.

**Common wrong approach:** setting masked scores to 0 instead of -inf. e⁰ = 1, so the future positions would still get weight.

</details>

## Quick quiz

1. `lstm = nn.LSTM(10, 20, num_layers=2, batch_first=True)` receives `x` of shape `[8, 15, 10]`. What are the shapes of `output` and `h_n`?
   - A) `[8, 15, 20]` and `[2, 8, 20]`
   - B) `[8, 20]` and `[8, 20]`
   - C) `[15, 8, 20]` and `[2, 8, 20]`
   - D) `[8, 15, 20]` and `[8, 2, 20]`

2. What does `nn.Embedding(1000, 64)` do with an int64 tensor of shape `[4, 12]`?
   - A) Returns `[4, 64]`, averaging over the sequence
   - B) Raises an error because the input isn't float
   - C) One-hot encodes the ids into `[4, 12, 1000]`
   - D) Returns a `[4, 12, 64]` tensor, looking up a learned 64-dim row for each id

3. In `nn.MultiheadAttention`, what does `True` mean in a boolean `key_padding_mask`?
   - A) That key position is ignored (masked out)
   - B) It's invalid: masks must be float
   - C) That the query is padding
   - D) That key position is the only one attended to

4. Why is the attention score divided by √d (the size of the query and key vectors)?
   - A) To make the output a probability
   - B) To keep the scores' scale stable as d grows, so softmax doesn't become too peaked and gradients don't vanish
   - C) To reduce memory use
   - D) To normalise the values

5. `nn.MultiheadAttention(embed_dim=100, num_heads=8)` raises an error. Why?
   - A) batch_first is missing
   - B) num_heads must be a power of 2
   - C) embed_dim must be at most 64
   - D) embed_dim must be divisible by num_heads

6. What does a causal mask do?
   - A) Stops attention to padding tokens
   - B) Shuffles the sequence
   - C) Makes attention weights sum to 1
   - D) Stops each position from attending to later positions

<details>
<summary>Quiz answers</summary>

1. **A) `[8, 15, 20]` and `[2, 8, 20]`**: batch_first affects input and output only; h_n is always [num_layers × directions, batch, hidden].
2. **D) Returns a `[4, 12, 64]` tensor, looking up a learned 64-dim row for each id**: An embedding is a lookup table indexed by the integer ids.
3. **A) That key position is ignored (masked out)**: In MultiheadAttention a True entry blocks attention; in F.scaled_dot_product_attention a True entry allows it.
4. **B) To keep the scores' scale stable as d grows, so softmax doesn't become too peaked and gradients don't vanish**: Dot products of random d-dimensional vectors grow like √d; scaling compensates.
5. **D) embed_dim must be divisible by num_heads**: Each head gets embed_dim / num_heads features; 100 / 8 isn't a whole number.
6. **D) Stops each position from attending to later positions**: It's an upper-triangular block (-inf or False above the diagonal), used for left-to-right generation.

</details>

---
Previous: [Lesson 19](19-cnn-layers.md) · Next: [Lesson 21: Training deeper networks well](21-better-models.md)
