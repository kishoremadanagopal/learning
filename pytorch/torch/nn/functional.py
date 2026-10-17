"""torch.nn.functional: layers and losses as plain functions (no weights stored)."""
import math
import warnings

import numpy as np

from .. import _core
from .._core import Tensor, _make_result, _node_class, _unbroadcast, _tname

__all__ = []


def _t(x):
    return x if isinstance(x, Tensor) else _core.tensor(x)


# ---------------------------------------------------------------- linear

def linear(input, weight, bias=None):
    """y = x Wᵀ + b, for x of shape [..., in_features] and W of shape [out_features, in_features]."""
    if input.dim() == 0:
        raise RuntimeError("both arguments to linear need to be at least 1D, but they are 0D and 2D")
    if bias is None:                        # PyTorch computes this case as input @ weight.t()
        return input.matmul(weight.t())
    lead = tuple(input.shape[:-1])
    x2 = input if input.dim() == 2 else input.reshape(-1, input.shape[-1])
    n, k = x2.shape
    out_f, in_f = weight.shape
    if bias is not None:
        devs = [bias.device, x2.device, weight.device]
        if len(set(map(str, devs))) > 1:
            other = x2.device if x2.device != bias.device else weight.device
            arg = "mat1" if x2.device != bias.device else "mat2"
            raise RuntimeError(f"Expected all tensors to be on the same device, but found at least two devices, {bias.device} and {other}! (when checking argument for argument {arg} in method wrapper_CUDA_addmm)")
    elif x2.device != weight.device:
        raise RuntimeError(f"Expected all tensors to be on the same device, but found at least two devices, {x2.device} and {weight.device}! (when checking argument for argument mat2 in method wrapper_CUDA_mm)")
    if x2.dtype is not weight.dtype:
        raise RuntimeError(f"mat1 and mat2 must have the same dtype, but got {_tname(x2.dtype)} and {_tname(weight.dtype)}")
    if k != in_f:
        raise RuntimeError(f"mat1 and mat2 shapes cannot be multiplied ({n}x{k} and {in_f}x{out_f})")
    X, W = x2._a, weight._a
    lowp = x2.dtype in (_core.float16, _core.bfloat16)
    Xc, Wc = (X.astype(np.float32), W.astype(np.float32)) if lowp else (X, W)
    r = Xc @ Wc.T
    if bias is not None:
        r = r + (bias._a.astype(np.float32) if lowp else bias._a)

    def bw(g):
        g = np.asarray(g)
        gc = g.astype(np.float32) if lowp else g
        gb = gc.sum(axis=0) if bias is not None else None
        return ((gb,) if bias is not None else ()) + (gc @ Wc, gc.T @ Xc)
    inputs = ([bias] if bias is not None else []) + [x2, weight]
    out = _make_result(r, x2.dtype, inputs, "AddmmBackward0" if bias is not None else "MmBackward0", bw, saved=[x2, weight], dev=x2.device)
    if input.dim() != 2:
        out = out.view(*lead, out_f)
    return out


def bilinear(*a, **k):
    raise NotImplementedError("bilinear isn't in the sandbox's PyTorch")


# ---------------------------------------------------------------- activations

def relu(input, inplace=False):
    out = input.relu()
    return input._inplace(out) if inplace else out


def relu6(input, inplace=False):
    return hardtanh(input, 0.0, 6.0)


def hardtanh(input, min_val=-1.0, max_val=1.0, inplace=False):
    x = input._a
    r = np.clip(x, min_val, max_val).astype(x.dtype)
    return _make_result(r, input.dtype, [input], "HardtanhBackward0", lambda g: (np.where((x > min_val) & (x < max_val), g, 0).astype(x.dtype),), saved=[input])


def leaky_relu(input, negative_slope=0.01, inplace=False):
    x = input._a
    r = np.where(x > 0, x, x * negative_slope).astype(x.dtype)
    out = _make_result(r, input.dtype, [input], "LeakyReluBackward0", lambda g: (np.where(x > 0, g, g * negative_slope).astype(x.dtype),), saved=[input])
    return input._inplace(out) if inplace else out


def elu(input, alpha=1.0, inplace=False):
    x = input._a
    r = np.where(x > 0, x, alpha * np.expm1(x)).astype(x.dtype)
    return _make_result(r, input.dtype, [input], "EluBackward0", lambda g: (np.where(x > 0, g, g * (r + alpha)).astype(x.dtype),), save_out=True)


def gelu(input, approximate="none"):
    x = input._a.astype(np.float64)
    if approximate == "tanh":
        k = math.sqrt(2 / math.pi)
        inner = k * (x + 0.044715 * x ** 3)
        t = np.tanh(inner)
        r = 0.5 * x * (1 + t)
        d = 0.5 * (1 + t) + 0.5 * x * (1 - t * t) * k * (1 + 3 * 0.044715 * x * x)
    else:
        erf = np.vectorize(math.erf)(x / math.sqrt(2)) if x.size else x
        r = 0.5 * x * (1 + erf)
        d = 0.5 * (1 + erf) + x * np.exp(-0.5 * x * x) / math.sqrt(2 * math.pi)
    dt = input._a.dtype
    return _make_result(r.astype(dt), input.dtype, [input], "GeluBackward0", lambda g: ((np.asarray(g) * d).astype(dt),), saved=[input])


def silu(input, inplace=False):
    x = input._a
    s = 1 / (1 + np.exp(-x))
    r = (x * s).astype(x.dtype)
    return _make_result(r, input.dtype, [input], "SiluBackward0", lambda g: ((np.asarray(g) * s * (1 + x * (1 - s))).astype(x.dtype),), saved=[input])


def softplus(input, beta=1.0, threshold=20.0):
    x = input._a
    bx = beta * x
    r = np.where(bx > threshold, x, np.log1p(np.exp(np.minimum(bx, threshold))) / beta).astype(x.dtype)
    s = 1 / (1 + np.exp(-bx))
    return _make_result(r, input.dtype, [input], "SoftplusBackward0", lambda g: (np.where(bx > threshold, g, g * s).astype(x.dtype),), saved=[input])


def sigmoid(input):
    return input.sigmoid()


def tanh(input):
    return input.tanh()


def _implicit_dim(name, ndim):
    warnings.warn(f"Implicit dimension choice for {name} has been deprecated. Change the call to include dim=X as an argument.", UserWarning, stacklevel=3)
    return 0 if ndim in (0, 1, 3) else 1


def softmax(input, dim=None, _stacklevel=3, dtype=None):
    if dim is None:
        dim = _implicit_dim("softmax", input.dim())
    return input.softmax(dim, dtype=dtype)


def log_softmax(input, dim=None, _stacklevel=3, dtype=None):
    if dim is None:
        dim = _implicit_dim("log_softmax", input.dim())
    return input.log_softmax(dim, dtype=dtype)


def dropout(input, p=0.5, training=True, inplace=False):
    if p < 0.0 or p > 1.0:
        raise ValueError(f"dropout probability has to be between 0 and 1, but got {p}")
    if not training or p == 0.0:
        return input
    if p == 1.0:
        return input * _core.zeros_like(input)
    keep = (_core._gen(None).uniform(input.numel(), double=input.dtype is _core.float64).reshape(input._a.shape) < (1 - p))
    noise = Tensor._wrap((keep / (1 - p)).astype(input._a.dtype), input.dtype, input.device)
    out = input * noise
    return input._inplace(out) if inplace else out


def one_hot(tensor, num_classes=-1):
    if tensor.dtype is not _core.int64:
        raise RuntimeError("one_hot is only applicable to index tensor of type LongTensor.")
    if num_classes == -1:
        num_classes = int(tensor._a.max()) + 1 if tensor.numel() else 0
    if tensor.numel() and (tensor._a.min() < 0 or tensor._a.max() >= num_classes):
        raise RuntimeError("Class values must be smaller than num_classes." if tensor._a.max() >= num_classes else "Class values must be non-negative.")
    return Tensor._wrap(np.eye(num_classes, dtype=np.int64)[tensor._a], _core.int64, tensor.device)


def normalize(input, p=2.0, dim=1, eps=1e-12):
    n = input.norm(p, dim=dim, keepdim=True).clamp_min(eps)
    return input / n


def pad(input, pad, mode="constant", value=0.0):
    widths = [(0, 0)] * input.dim()
    for i in range(len(pad) // 2):
        widths[input.dim() - 1 - i] = (pad[2 * i], pad[2 * i + 1])
    r = np.pad(input._a, widths, mode="constant", constant_values=value)
    sl = tuple(slice(a, a + s) for (a, _), s in zip(widths, input._a.shape))
    return _make_result(r, input.dtype, [input], "ConstantPadNdBackward0", lambda g: (np.asarray(g)[sl],))


def embedding(input, weight, padding_idx=None):
    idx = input._a.astype(np.int64)
    if idx.size and (idx.min() < -weight.shape[0] or idx.max() >= weight.shape[0]):
        raise IndexError("index out of range in self")
    shape = weight._a.shape

    def bw(g):
        full = np.zeros(shape, dtype=np.asarray(g).dtype)
        np.add.at(full, idx.reshape(-1), np.asarray(g).reshape(-1, shape[1]))
        if padding_idx is not None:
            full[padding_idx] = 0
        return (full,)
    return _make_result(weight._a[idx], weight.dtype, [weight], "EmbeddingBackward0", bw, dev=weight.device)


# ---------------------------------------------------------------- losses

def _reduce_loss(arr, reduction):
    if reduction == "mean":
        return np.asarray(arr.mean(dtype=np.float64)).astype(arr.dtype)
    if reduction == "sum":
        return np.asarray(arr.sum(dtype=np.float64)).astype(arr.dtype)
    if reduction == "none":
        return arr
    raise ValueError(f"{reduction} is not a valid value for reduction")


def _size_warning(input, target, stacklevel=3):
    if tuple(target.shape) != tuple(input.shape):
        warnings.warn(f"Using a target size ({target.shape}) that is different to the input size ({input.shape}). This will likely lead to incorrect results due to broadcasting. Please ensure they have the same size.", UserWarning, stacklevel=stacklevel)


def _broadcast_pair(input, target):
    try:
        shape = np.broadcast_shapes(input._a.shape, target._a.shape)
    except ValueError:
        _core._raise_broadcast(list(input.shape), list(target.shape))
    return shape


def mse_loss(input, target, size_average=None, reduce=None, reduction="mean", weight=None):
    _size_warning(input, target)
    shape = _broadcast_pair(input, target)
    x, y = np.broadcast_to(input._a, shape), np.broadcast_to(target._a, shape)
    d = x - y
    r = _reduce_loss(d * d, reduction)
    n = d.size

    def bw(g):
        g = np.asarray(g)
        k = 2.0 / n if reduction == "mean" else 2.0
        gx = (g * k * d) if reduction != "none" else g * 2 * d
        gx = gx.astype(x.dtype)
        return (_unbroadcast(gx, input._a.shape) if input.requires_grad else None,
                _unbroadcast(-gx, target._a.shape) if target.requires_grad else None)
    return _make_result(r, input.dtype, [input, target], "MseLossBackward0", bw, saved=[input, target])


def l1_loss(input, target, size_average=None, reduce=None, reduction="mean"):
    _size_warning(input, target)
    d = (input - target).abs()
    return d.mean() if reduction == "mean" else d.sum() if reduction == "sum" else d


def smooth_l1_loss(input, target, size_average=None, reduce=None, reduction="mean", beta=1.0):
    return _piecewise_loss(input, target, reduction, beta, "SmoothL1LossBackward0", huber=False)


def huber_loss(input, target, reduction="mean", delta=1.0, weight=None):
    return _piecewise_loss(input, target, reduction, delta, "HuberLossBackward0", huber=True)


def _piecewise_loss(input, target, reduction, b, name, huber):
    _size_warning(input, target, 4)
    shape = _broadcast_pair(input, target)
    x, y = np.broadcast_to(input._a, shape), np.broadcast_to(target._a, shape)
    d = x - y
    a = np.abs(d)
    if huber:
        per = np.where(a < b, 0.5 * d * d, b * (a - 0.5 * b))
        grad = np.where(a < b, d, b * np.sign(d))
    else:
        per = np.where(a < b, 0.5 * d * d / b, a - 0.5 * b) if b > 0 else a
        grad = np.where(a < b, d / b, np.sign(d)) if b > 0 else np.sign(d)
    r = _reduce_loss(per.astype(x.dtype), reduction)
    n = d.size

    def bw(g):
        gx = (np.asarray(g) * grad / (n if reduction == "mean" else 1)).astype(x.dtype)
        return (_unbroadcast(gx, input._a.shape) if input.requires_grad else None, _unbroadcast(-gx, target._a.shape) if target.requires_grad else None)
    return _make_result(r, input.dtype, [input, target], name, bw, saved=[input, target])


def binary_cross_entropy(input, target, weight=None, size_average=None, reduce=None, reduction="mean"):
    if tuple(target.shape) != tuple(input.shape):
        raise ValueError(f"Using a target size ({target.shape}) that is different to the input size ({input.shape}) is deprecated. Please ensure they have the same size.")
    if target.dtype is not input.dtype:
        raise RuntimeError(f"Found dtype {_tname(target.dtype)} but expected {_tname(input.dtype)}")
    p, y = input._a, target._a
    if np.any((p < 0) | (p > 1)) or np.any(np.isnan(p)):
        raise RuntimeError("all elements of input should be between 0 and 1")
    with np.errstate(divide="ignore"):
        lp = np.maximum(np.log(p), -100)
        l1p = np.maximum(np.log1p(-p), -100)
    per = -(y * lp + (1 - y) * l1p)
    w = None if weight is None else np.broadcast_to(weight._a, per.shape)
    if w is not None:
        per = per * w
    r = _reduce_loss(per.astype(p.dtype), reduction)
    n = p.size

    def bw(g):
        eps = 1e-12
        gx = np.asarray(g) * (p - y) / np.maximum(p * (1 - p), eps)
        if w is not None:
            gx = gx * w
        if reduction == "mean":
            gx = gx / n
        return ((gx).astype(p.dtype), None)
    return _make_result(r, input.dtype, [input, target], "BinaryCrossEntropyBackward0", bw, saved=[input, target])


def binary_cross_entropy_with_logits(input, target, weight=None, size_average=None, reduce=None, reduction="mean", pos_weight=None):
    if tuple(target.shape) != tuple(input.shape):
        raise ValueError(f"Target size ({target.shape}) must be the same as input size ({input.shape})")
    if target.dtype._kind != "f" and input.dtype._kind == "f":
        raise RuntimeError(f"result type {_tname(input.dtype)} can't be cast to the desired output type {_tname(target.dtype)}")
    x, y = input._a.astype(np.float64), target._a.astype(np.float64)
    log_sig = -np.logaddexp(0, -x)          # log(sigmoid(x)), computed stably
    log_one_minus = -np.logaddexp(0, x)     # log(1 - sigmoid(x))
    if pos_weight is not None:
        pw = np.broadcast_to(pos_weight._a, x.shape)
        per = -(pw * y * log_sig + (1 - y) * log_one_minus)
    else:
        pw = None
        per = -(y * log_sig + (1 - y) * log_one_minus)
    w = None if weight is None else np.broadcast_to(weight._a, per.shape)
    if w is not None:
        per = per * w
    dt = input._a.dtype
    r = _reduce_loss(per.astype(dt), reduction)
    n = x.size

    def bw(g):
        s = 1 / (1 + np.exp(-x))
        gx = ((pw * y + 1 - y) * s - pw * y) if pw is not None else (s - y)
        if w is not None:
            gx = gx * w
        gx = np.asarray(g) * gx
        if reduction == "mean":
            gx = gx / n
        return (gx.astype(dt), None)
    return _make_result(r, input.dtype, [input, target], "BinaryCrossEntropyWithLogitsBackward0", bw, saved=[input, target])


def nll_loss(input, target, weight=None, size_average=None, ignore_index=-100, reduce=None, reduction="mean"):
    if target.dtype not in (_core.int64, _core.uint8):
        raise RuntimeError(f"expected target dtype to be Long or Byte, but got {_tname(target.dtype)}")
    if input.dim() == 1:
        if target.dim() != 0:
            raise RuntimeError("0D or 1D target tensor expected, multi-target not supported")
        out = nll_loss(input.unsqueeze(0), target.unsqueeze(0), weight, ignore_index=ignore_index, reduction=reduction)
        return out.squeeze(0) if reduction == "none" else out
    if input.dim() > 2:          # [N, C, d1, ...]: move classes last and flatten
        C = input.shape[1]
        perm = [0] + list(range(2, input.dim())) + [1]
        flat = input.permute(*perm).reshape(-1, C)
        out = nll_loss(flat, target.reshape(-1), weight, ignore_index=ignore_index, reduction=reduction)
        return out.view(*target.shape) if reduction == "none" else out
    if target.dim() != 1:
        raise RuntimeError("0D or 1D target tensor expected, multi-target not supported")
    N, C = input._a.shape
    if target.shape[0] != N:
        raise ValueError(f"Expected input batch_size ({N}) to match target batch_size ({target.shape[0]}).")
    t = target._a.astype(np.int64)
    valid = t != ignore_index
    for v in t[valid]:
        if v < 0 or v >= C:
            raise IndexError(f"Target {v} is out of bounds.")
    w = np.ones(C, dtype=np.float64) if weight is None else weight._a.astype(np.float64)
    x = input._a
    tw = np.where(valid, w[np.where(valid, t, 0)], 0.0)
    picked = np.where(valid, x[np.arange(N), np.where(valid, t, 0)], 0.0).astype(np.float64)
    per = -picked * tw
    if reduction == "none":
        r = per.astype(x.dtype)
        denom = None
    elif reduction == "sum":
        r = np.asarray(per.sum()).astype(x.dtype)
        denom = 1.0
    else:
        denom = tw.sum()
        r = np.asarray(per.sum() / denom if denom else np.nan).astype(x.dtype)

    def bw(g):
        g = np.asarray(g, dtype=np.float64)
        full = np.zeros_like(x, dtype=np.float64)
        coef = -tw * (g if reduction == "none" else g / denom)
        full[np.arange(N)[valid], t[valid]] = coef[valid]
        return (full.astype(x.dtype), None)
    return _make_result(r, input.dtype, [input, target], "NllLossBackward0", bw, saved=[input])


def cross_entropy(input, target, weight=None, size_average=None, ignore_index=-100, reduce=None, reduction="mean", label_smoothing=0.0):
    class_dim = 0 if input.dim() == 1 else 1
    if target.dtype.is_floating_point and tuple(target.shape) == tuple(input.shape):
        # class probabilities as targets
        ls = input.log_softmax(class_dim)
        C = input.shape[class_dim]
        tgt = target
        if label_smoothing > 0:
            tgt = target * (1 - label_smoothing) + label_smoothing / C
        prod = ls * tgt
        if weight is not None:
            shape = [1] * input.dim()
            shape[class_dim] = C
            prod = prod * weight.view(*shape)
        per = -prod.sum(class_dim)
        if reduction == "none":
            return per
        if reduction == "sum":
            return per.sum()
        n = input.numel() / C
        s = per.sum()
        return _make_result(np.asarray(s._a / np.float32(n)).astype(s._a.dtype), s.dtype, [s], "DivBackward1", lambda g: (np.asarray(g) / n,))
    if target.dtype.is_floating_point:
        raise RuntimeError(f"expected target dtype to be Long or Byte, but got {_tname(target.dtype)}")
    ls = input.log_softmax(class_dim)
    nll = nll_loss(ls, target, weight, ignore_index=ignore_index, reduction=reduction)
    if label_smoothing <= 0.0:
        return nll
    if not 0.0 <= label_smoothing <= 1.0:
        raise RuntimeError(f"label_smoothing must be between 0.0 and 1.0. Got: {label_smoothing}")
    C = input.shape[class_dim]
    mask = Tensor._wrap((target._a == ignore_index), _core.bool, target.device)
    smooth = -ls.sum(class_dim)
    smooth = smooth.masked_fill(mask, 0.0)
    if reduction == "mean":
        smooth = smooth.sum() / float((~mask).sum().item()) if weight is None else smooth.sum() / float(weight._a[target._a[~mask._a]].sum())
    elif reduction == "sum":
        smooth = smooth.sum()
    return nll * (1 - label_smoothing) + smooth * (label_smoothing / C)


def kl_div(input, target, size_average=None, reduce=None, reduction="mean", log_target=False):
    per = (target.exp() * (target - input)) if log_target else target * (target.clamp_min(1e-45).log() - input)
    if reduction == "mean":
        warnings.warn("reduction: 'mean' divides the total loss by both the batch size and the support size.'batchmean' divides only by the batch size, and aligns with the KL div math definition.'mean' will be changed to behave the same as 'batchmean' in the next major release.", UserWarning, stacklevel=2)
        return per.mean()
    if reduction == "batchmean":
        return per.sum() / input.shape[0]
    return per.sum() if reduction == "sum" else per


def cosine_similarity(x1, x2, dim=1, eps=1e-8):
    num = (x1 * x2).sum(dim)
    den = (x1.norm(dim=dim) * x2.norm(dim=dim)).clamp_min(eps)
    return num / den
