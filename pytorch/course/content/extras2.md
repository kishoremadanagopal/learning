@@ autograd
topics: gradients and why training needs them, requires_grad, backward() and .grad, the computation graph, grad_fn and next_functions, leaf tensors and retain_grad, gradients accumulating and zeroing them, backward on non-scalars, the graph freed after backward and retain_graph, detach, torch.no_grad, torch.inference_mode, freezing with requires_grad_(False), torch.autograd.grad
terms:
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
mistakes:
- Forgetting to zero gradients between steps, so they keep adding up.
- Calling `backward()` on a non-scalar tensor without reducing it first.
- Expecting `.grad` on intermediate (non-leaf) tensors.
- Calling `backward()` twice on the same graph.
- Assuming `torch.no_grad()` or `inference_mode()` changes dropout or batch norm (that's `model.eval()`).
- Using tensors created in `inference_mode()` for training.

glance:
- Track a tensor | `torch.tensor(…, requires_grad=True)` | its gradient after backward | only float or complex tensors
- Compute gradients | `loss.backward()` | `.grad` on every leaf | loss must be a scalar
- Read the graph | `y.grad_fn`, `.next_functions`, `.is_leaf` | how y was computed | leaves have no grad_fn
- Reset | `x.grad = None` or `x.grad.zero_()` | a clean slate | gradients accumulate otherwise
- Stop recording | `with torch.no_grad():`, `t.detach()` | no graph, less memory | inference_mode is faster still
- Freeze | `p.requires_grad_(False)` | the weight stays fixed | it still takes part in the forward pass
- Gradient as a value | `torch.autograd.grad(y, x)` | a tuple of gradients | doesn't touch `.grad`

@@ gradient-descent
topics: the gradient descent update rule, fitting a line with tensors and autograd, updating weights inside torch.no_grad, in-place updates versus reassignment, zeroing gradients, the learning rate (too small, good, diverging), the loss curve, full-batch versus mini-batch (stochastic) gradient descent, epochs
terms:
- **Gradient descent:** repeatedly moving each weight a small step against its gradient to reduce the loss.
- **Learning rate:** the step size of each gradient-descent update.
- **Step (iteration):** one update of the weights.
- **Divergence:** the loss growing (often to inf or nan) because the steps overshoot, usually from too high a learning rate.
- **Mean squared error (MSE):** the average of the squared differences between predictions and targets.
- **Mini-batch:** a small random subset of the training data used for one step.
- **Stochastic gradient descent (SGD):** gradient descent where each step uses a mini-batch instead of all the data.
- **Epoch:** one complete pass through the training data.
mistakes:
- Updating weights outside `torch.no_grad()`, which raises an in-place error on a leaf.
- Writing `w = w - lr * w.grad`, which replaces the leaf with a tensor that has no gradient.
- Forgetting to reset gradients each step.
- Using a learning rate so high the loss diverges, or so low it barely moves.

glance:
- Update rule | `w -= lr * w.grad` inside `torch.no_grad()` | one step downhill | in place, not `w = w - …`
- One step | forward → loss → backward → update → zero | a lower loss | the order matters
- Learning rate | try 0.1, 0.03, 0.01 … | fast, stable training | too high diverges (nan)
- Diagnose | plot `loss.item()` per step | the learning curve | log scale helps
- Mini-batches | a random subset per step | cheap, noisy gradients | an epoch = all batches once

@@ nn-module
topics: nn.Linear and y = xWᵀ + b, weight and bias shapes, default Kaiming-uniform initialisation, nn.Parameter, activation functions (ReLU, LeakyReLU, GELU, SiLU, Sigmoid, Tanh, Softmax) and torch.nn.functional, nn.Sequential, subclassing nn.Module with __init__ and forward, super().__init__(), calling the model, parameters and named_parameters, counting parameters, nn.ModuleList, moving a model with .to(device)
terms:
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
mistakes:
- Forgetting `super().__init__()` at the start of `__init__`.
- Creating layers inside `forward`, so they're new and untrained on every call.
- Keeping layers in a plain list or dict, hiding them from `parameters()`.
- Calling `model.forward(x)` instead of `model(x)`.
- Passing data as [features, samples] instead of [samples, features].
- Expecting `model.to(device)` to return a copy (modules move in place).

glance:
- Dense layer | `nn.Linear(in_f, out_f)` | `[…, in_f] → […, out_f]` | weight is `[out_f, in_f]`
- Parameter count | `in_f × out_f + out_f` | per Linear layer | `sum(p.numel() for p in model.parameters())`
- Non-linearity | `nn.ReLU()`, `F.relu(x)` | curved functions | no parameters
- Chain of layers | `nn.Sequential(…)` | a model in one line | index with `model[0]`
- Custom model | subclass `nn.Module`, `super().__init__()`, `forward` | any architecture | call it: `model(x)`
- Lists of layers | `nn.ModuleList([…])` | registered sub-modules | a plain list hides them
- Move | `model.to(device)` | parameters moved in place | before creating the optimizer

@@ losses-and-optimizers
topics: MSELoss, L1Loss and HuberLoss for regression, reduction, shape mismatches that broadcast, CrossEntropyLoss with logits and int64 class indices, NLLLoss and log_softmax, class weights, ignore_index and label smoothing, BCEWithLogitsLoss for binary and multi-label targets, BCELoss, torch.optim, SGD with momentum, Adam, AdamW and decoupled weight decay, zero_grad, the five-line training step
terms:
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
mistakes:
- Applying softmax before CrossEntropyLoss.
- Giving CrossEntropyLoss float, one-hot or `[batch, 1]` targets instead of int64 `[batch]`.
- Giving BCEWithLogitsLoss integer targets, or a sigmoid output.
- Comparing `[batch, 1]` predictions with `[batch]` targets in MSELoss.
- Calling `optimizer.step()` before `loss.backward()`, or forgetting `zero_grad()`.
- Storing loss tensors instead of `loss.item()`, keeping every graph in memory.

glance:
- Regression | `nn.MSELoss()`, `nn.L1Loss()` | mean squared / absolute error | same shapes for pred and target
- Multi-class | `nn.CrossEntropyLoss()(logits, labels)` | log_softmax + NLL | logits `[N, C]`, int64 labels `[N]`
- Yes/no, multi-label | `nn.BCEWithLogitsLoss()` | sigmoid + BCE, stable | float 0/1 targets, same shape
- Plain SGD | `optim.SGD(params, lr=0.1, momentum=0.9)` | p ← p − lr · grad (with velocity) | lr around 0.01–0.1
- Adaptive | `optim.Adam(params, lr=1e-3)`, `optim.AdamW(…, weight_decay=0.01)` | per-parameter step sizes | AdamW decouples weight decay
- Training step | `pred = model(x); loss = …; opt.zero_grad(); loss.backward(); opt.step()` | one update | zero_grad sets `.grad` to None

@@ training-loop
topics: training, validation and test sets, generalisation and overfitting, epochs and shuffled mini-batches, a complete classification training loop, model.train() and model.eval(), dropout and batch norm in each mode, evaluating under torch.no_grad, accuracy from argmax, reading training and validation curves, underfitting, early stopping and keeping the best weights with deepcopy, training on a GPU
terms:
- **Training set:** the data the optimizer learns from.
- **Validation set:** held-out data for measuring generalisation and choosing settings during development.
- **Test set:** data used once at the end for an unbiased final score.
- **Generalisation:** how well a model performs on data it wasn't trained on.
- **Overfitting:** fitting the training data so closely that performance on new data gets worse.
- **Underfitting:** a model too simple, or trained too little, to fit even the training data.
- **model.train() / model.eval():** switch layers such as dropout and batch norm between training and evaluation behaviour.
- **Dropout:** randomly zeroing activations during training to reduce overfitting.
- **Batch normalisation:** normalising activations with batch statistics in training and running averages in evaluation.
- **Early stopping:** keeping the weights from the epoch with the best validation score.
- **Accuracy:** the fraction of samples whose predicted class matches the label.
mistakes:
- Evaluating without `model.eval()`, so dropout and batch norm behave as in training.
- Thinking `model.eval()` turns off gradient tracking; use `torch.no_grad()` as well.
- Forgetting `model.train()` after evaluating in the middle of training.
- Not shuffling the training data each epoch.
- Keeping `model.state_dict()` as the "best" weights without copying it.
- Tuning settings on the test set instead of the validation set.

glance:
- Split data | `perm = torch.randperm(n)`; slice train / val | honest validation | shuffle before splitting
- Epoch loop | `for epoch …: model.train(); for batch …: step` | many updates | reshuffle each epoch
- Evaluate | `model.eval()` + `with torch.no_grad():` | deterministic, cheap metrics | then `model.train()` again
- Accuracy | `(logits.argmax(1) == y).float().mean()` | fraction correct | bools must be cast to float
- Dropout / BatchNorm | behave differently in train and eval | regularisation, normalisation | BatchNorm needs batches > 1 in training
- Early stopping | `best = copy.deepcopy(model.state_dict())` | the best epoch's weights | state_dict shares memory
- On a GPU | `model.to(device)` once; `xb.to(device)` per batch | the same loop, faster | move the model before the optimizer

@@ saving-and-loading
topics: model and optimizer state_dicts, buffers in state_dicts, torch.save and torch.load, saving the state_dict versus the whole model, weights_only=True by default since PyTorch 2.6 and why, load_state_dict and strict, missing, unexpected and size-mismatched keys, checkpoints for resuming training, map_location, making predictions with eval, inference_mode, a batch dimension, softmax and argmax
terms:
- **state_dict:** an ordered dict mapping parameter and buffer names to tensors (or, for optimizers, their state and settings).
- **Buffer:** a tensor registered with a module that is saved and moved with it but not trained, such as BatchNorm's running mean.
- **torch.save / torch.load:** write and read pickled objects of tensors and containers to files.
- **weights_only:** a torch.load option (True by default since PyTorch 2.6) that only unpickles tensors and plain containers, for safety.
- **load_state_dict:** copies a state_dict's tensors into a module's parameters and buffers, checking names and shapes.
- **Checkpoint:** a saved dict with everything needed to resume training: model and optimizer state, epoch, loss.
- **map_location:** a torch.load argument that remaps saved tensors to another device, such as the CPU.
- **Inference:** using a trained model to make predictions.
mistakes:
- Saving the whole model and then failing to load it with the default `weights_only=True`.
- Passing a file path to `load_state_dict` instead of `torch.load(path)`.
- Loading weights into a different architecture.
- Resuming training without the optimizer's state.
- Loading a GPU checkpoint on a CPU-only machine without `map_location`.
- Predicting without `model.eval()` or without a batch dimension.

glance:
- Save | `torch.save(model.state_dict(), "model.pt")` | a portable weights file | the recommended way
- Load | `model = Net(); model.load_state_dict(torch.load("model.pt"))` | the trained weights | build the same architecture first
- Safety | `torch.load(path)` uses `weights_only=True` | refuses arbitrary objects | `weights_only=False` only for trusted files
- Partial load | `load_state_dict(sd, strict=False)` | skips missing / extra keys | shapes must still match
- Resume | save `{"model_state_dict", "optimizer_state_dict", "epoch", …}` | exact continuation | then `model.train()`
- Other device | `torch.load(path, map_location="cpu")` | GPU checkpoint on a CPU | or `map_location=device`
- Predict | `model.eval()`; `with torch.inference_mode(): model(x.unsqueeze(0)).argmax(1)` | a class index | softmax only for probabilities
