@@ cnn-layers
topics: why images need convolutions, kernels and weight sharing, nn.Conv2d and its arguments (stride, padding, "same", dilation, groups, bias), the output-size formula, counting convolution parameters, channel-mismatch errors, MaxPool2d, AvgPool2d and AdaptiveAvgPool2d (global average pooling), BatchNorm2d and the Conv–BN–ReLU block, Conv1d, tracing shapes through a CNN, flattening into a linear layer, training a small CNN
terms:
- **Convolution:** sliding a small grid of learned weights over the input and computing a weighted sum at each position.
- **Kernel (filter):** the grid of weights a convolution slides; each output channel has its own kernel spanning all input channels.
- **Feature map:** one output channel of a convolution: where its pattern appears in the input.
- **Stride:** the step between kernel positions; stride 2 halves height and width.
- **Padding:** extra values (zeros) around the input's border, so the output can keep the input's size.
- **Pooling:** summarising each window with its maximum or average, with no learned parameters.
- **Global average pooling:** averaging each whole feature map to one number (`AdaptiveAvgPool2d(1)`).
- **Weight sharing:** using the same kernel weights at every position, which keeps convolutions small and position-independent.
- **CNN:** a convolutional neural network: stacked convolution, activation and pooling layers, then a classifier.
mistakes:
- Getting the flattened size wrong in the first linear layer after the convolutions.
- Flattening the batch dimension too (`x.view(-1)` instead of `x.flatten(1)`).
- Passing images channels-last (`[N, H, W, C]`) to Conv2d, which expects `[N, C, H, W]`.
- Mismatching `in_channels` with the input's channel count (grayscale into an RGB layer).
- Forgetting that pooling and stride round the output size down.
- Keeping a conv bias right before BatchNorm, where it's redundant.

glance:
- Convolution | `nn.Conv2d(c_in, c_out, k, stride, padding)` | `[N, c_out, H', W']` | H' = ⌊(H + 2p − d(k − 1) − 1) / s⌋ + 1
- Keep the size | `kernel_size=3, padding=1` (or `padding="same"`) | same H and W | "same" needs stride 1
- Parameters | c_out × (c_in / groups) × kH × kW + c_out | independent of image size | far fewer than a dense layer
- Downsample | `nn.MaxPool2d(2)` / `stride=2` | half the height and width | pooling has no parameters
- Any input size | `nn.AdaptiveAvgPool2d(1)` + `nn.Flatten()` | `[N, C]` | global average pooling
- Normalise feature maps | `Conv2d(bias=False) → BatchNorm2d → ReLU` | stable, faster training | per channel; train vs eval behaviour
- Sequences | `nn.Conv1d(c_in, c_out, k)` on `[N, C, L]` | `[N, c_out, L']` | channels before length

@@ sequence-layers
topics: sequence tensors and batch_first, nn.Embedding as a lookup table, recurrent layers (RNN, LSTM, GRU), hidden and cell states, output versus h_n and c_n, num_layers and bidirectional, classifying from the last hidden state, scaled dot-product attention, queries, keys and values, scaling by √d, causal and padding masks, nn.MultiheadAttention and its opposite boolean-mask convention, TransformerEncoderLayer and TransformerEncoder, positional embeddings, pre-norm
terms:
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
mistakes:
- Forgetting that h_n is `[layers × directions, N, hidden]` even with `batch_first=True`.
- Unpacking an LSTM's result as `output, h_n` (it's `output, (h_n, c_n)`).
- Using `output` (every step) where one vector per sequence is needed.
- Mixing up boolean mask meanings: True means "keep" in scaled_dot_product_attention but "mask out" in MultiheadAttention.
- Masking with 0 instead of -inf before softmax.
- Choosing `embed_dim` not divisible by `num_heads`.
- Forgetting positional information in a Transformer.

glance:
- Tokens to vectors | `nn.Embedding(vocab, dim)` | `[N, L] → [N, L, dim]` | int64 ids
- Recurrent layer | `nn.LSTM(in, hidden, batch_first=True)` | `output, (h_n, c_n)` | GRU/RNN return `output, h_n`
- Classify a sequence | `head(h_n[-1])` | `[N, classes]` | top layer's last state
- Attention | `F.scaled_dot_product_attention(q, k, v)` | softmax(QKᵀ / √d) V | fused, fast kernels
- Causal | `is_causal=True` or `nn.Transformer.generate_square_subsequent_mask(L)` | no peeking ahead | float mask: -inf blocks
- Multi-head | `nn.MultiheadAttention(E, heads, batch_first=True)` | `(output, weights)` | bool True = masked out
- Transformer | `nn.TransformerEncoder(nn.TransformerEncoderLayer(d, h, batch_first=True), n)` | stacked layers | add positional embeddings first

@@ better-models
topics: vanishing and exploding gradients, ReLU, LeakyReLU, GELU and SiLU, sigmoid and tanh saturation, Kaiming and Xavier initialisation, nn.init and model.apply, why not to initialise all weights equally, BatchNorm versus LayerNorm, residual connections and skip paths, pre-norm residual blocks, regularisation with dropout, weight decay, augmentation and smaller models, early stopping with the best weights, gradient clipping
terms:
- **Vanishing gradient:** gradients shrinking as they pass back through many layers, so early layers barely learn.
- **Exploding gradient:** gradients growing as they pass back through many layers, making training unstable.
- **GELU:** a smooth activation, x·Φ(x), standard in Transformers.
- **Kaiming (He) initialisation:** random weights with std √(2 / fan_in), suited to ReLU networks.
- **Xavier (Glorot) initialisation:** random weights scaled by fan_in and fan_out, suited to tanh and sigmoid.
- **Fan-in:** the number of inputs feeding each unit of a layer.
- **Residual (skip) connection:** adding a block's input to its output, `x + F(x)`.
- **Regularisation:** techniques that reduce overfitting, such as dropout, weight decay and augmentation.
- **Early stopping:** ending training when validation loss stops improving and keeping the best weights.
- **Gradient clipping:** rescaling gradients so their norm doesn't exceed a limit.
mistakes:
- Stacking many sigmoid or tanh layers in a deep network.
- Initialising all weights to the same value (zeros), so every unit learns the same thing.
- Calling init functions without the trailing underscore, or on norm layers.
- Writing a residual block whose output shape differs from its input's.
- Keeping the last epoch's weights instead of the best validation epoch's.
- Clipping gradients before `backward()` or after `step()`.

glance:
- Default activation | `nn.ReLU()` (CNNs), `nn.GELU()` (Transformers) | non-linearity without saturation | sigmoid's slope ≤ 0.25
- Initialise | `model.apply(fn)` with `nn.init.kaiming_normal_(w, nonlinearity="relu")` | stable activation scale | zeros_ for biases
- Normalise | BatchNorm for CNNs, LayerNorm for sequences | stable, faster training | LayerNorm is batch-independent
- Go deep | `x + block(x)` | trainable 100+ layer networks | shapes must match
- Regularise | Dropout, `AdamW(weight_decay=…)`, augmentation | less overfitting | only training behaviour changes
- Stop early | keep `copy.deepcopy(model.state_dict())` of the best epoch | best validation weights | patience = epochs to wait
- Clip | `clip_grad_norm_(params, 1.0)` between backward and step | bounded updates | returns the norm before clipping

@@ optimizers-and-schedules
topics: param_groups and optimizer state, SGD with momentum and Nesterov, RMSprop, Adam, AdamW and decoupled weight decay, per-group learning rates and weight decay, no decay on biases and norm weights, learning-rate schedulers (StepLR, MultiStepLR, ExponentialLR, CosineAnnealingLR, LinearLR, SequentialLR, OneCycleLR, ReduceLROnPlateau), the order of optimizer.step() and scheduler.step(), warm-up plus cosine decay, gradient accumulation, saving optimizer and scheduler state
terms:
- **Parameter group:** a set of parameters in an optimizer with its own hyperparameters such as lr and weight_decay.
- **Optimizer state:** per-parameter values an optimizer keeps between steps, such as momentum buffers and Adam's moment estimates.
- **Momentum:** a running average of past gradients that keeps updates moving in consistent directions.
- **Adaptive learning rate:** scaling each parameter's update by the history of its own gradients (RMSprop, Adam).
- **Decoupled weight decay:** shrinking weights directly, separately from the gradient update, as AdamW does.
- **Learning-rate scheduler:** an object that changes the optimizer's learning rate as training progresses.
- **Warm-up:** starting with a small learning rate and increasing it over the first steps.
- **Cosine annealing:** decreasing the learning rate along half a cosine curve.
- **Gradient accumulation:** summing gradients from several micro-batches before one optimizer step.
mistakes:
- Calling `scheduler.step()` before `optimizer.step()`.
- Stepping an epoch-based scheduler every batch (or OneCycleLR every epoch).
- Using `Adam(weight_decay=…)` expecting AdamW's decoupled decay.
- Forgetting to pass the metric to `ReduceLROnPlateau.step(val_loss)`.
- Not dividing the loss by the number of micro-batches when accumulating, or zeroing gradients between them.
- Resuming training without restoring the optimizer and scheduler state.

glance:
- Default optimizer | `optim.AdamW(params, lr=3e-4, weight_decay=0.01)` | adaptive, decoupled decay | SGD + momentum still strong for CNNs
- Per-group settings | `optim.AdamW([{"params": a, "lr": 1e-5}, {"params": b}], lr=1e-3)` | different lr / decay per group | groups can't share parameters
- Epoch schedule | `StepLR`, `MultiStepLR`, `CosineAnnealingLR` | lr changes per `step()` | `opt.step()` first
- Warm-up + cosine | `SequentialLR(opt, [LinearLR(...), CosineAnnealingLR(...)], milestones=[w])` | the Transformer recipe | step per batch or epoch consistently
- One cycle | `OneCycleLR(opt, max_lr, total_steps)` | up then down | step every batch
- On plateau | `ReduceLROnPlateau(opt, factor=0.1, patience=10)` | lower lr when stuck | `sched.step(val_loss)`
- Big effective batch | `(loss / k).backward()` k times, then `opt.step()` | same gradient as one big batch | zero_grad once

@@ transfer-learning
topics: transfer learning, feature extraction versus fine-tuning, torchvision pretrained models and their weights' transforms, inspecting models with named_children, named_modules, named_parameters and get_submodule, freezing with requires_grad_(False), replacing the head, optimizing only trainable parameters, smaller learning rates for pretrained layers, frozen BatchNorm statistics, partial loading with strict=False and filtered state dicts, forward hooks and handles
terms:
- **Transfer learning:** starting from a model trained on a large dataset and adapting it to a new task.
- **Backbone:** the pretrained part of a model that extracts general features.
- **Head:** the final task-specific layers, usually replaced for a new task.
- **Feature extraction:** training only a new head on top of a frozen backbone.
- **Fine-tuning:** training some or all pretrained layers too, usually with a smaller learning rate.
- **Freezing:** setting `requires_grad=False` so a parameter isn't updated.
- **Forward hook:** a function called after a module's forward pass with its inputs and output.
- **named_modules():** iterates over every submodule at every depth, with dotted names.
mistakes:
- Creating the optimizer before replacing the head, so the new head is never trained.
- Freezing parameters but still letting BatchNorm update its running statistics in train mode.
- Fine-tuning pretrained layers with the same high learning rate as a new head.
- Loading a state dict with mismatched head shapes instead of dropping those keys.
- Forgetting the pretrained model's own preprocessing (resize and normalisation).
- Leaving forward hooks registered after use.

glance:
- Inspect | `named_children()`, `named_modules()`, `named_parameters()`, `get_submodule("a.0")` | a model's structure | named_modules recurses
- Freeze | `backbone.requires_grad_(False)` | no gradients, no updates | BN statistics still update in train()
- New head | `model.fc = nn.Linear(model.fc.in_features, n)` | trainable, right size | create the optimizer after this
- Train only some | `optim.Adam(p for p in model.parameters() if p.requires_grad)` | updates the head only | feature extraction
- Fine-tune | param groups: backbone lr 1e-5, head lr 1e-3 | gentle adaptation | unfreeze gradually
- Partial load | `load_state_dict(filtered, strict=False)` | matching keys load | shapes must still match
- Peek inside | `h = layer.register_forward_hook(fn)` … `h.remove()` | intermediate outputs | returning a value replaces the output
