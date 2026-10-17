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


# ---------------------------------------------------------------- convolution and pooling

def _ntuple(v, n, name="kernel_size"):
    if isinstance(v, (tuple, list)):
        if len(v) == 1:
            return tuple(v) * n
        return tuple(int(x) for x in v)
    return (int(v),) * n


def _windows(xp, k, s, d, out):
    """A strided view of every window: shape xp.shape[:2] + out + k (no copy)."""
    st = xp.strides
    nsp = len(k)
    shape = xp.shape[:2] + tuple(out) + tuple(k)
    strides = st[:2] + tuple(st[2 + i] * s[i] for i in range(nsp)) + tuple(st[2 + i] * d[i] for i in range(nsp))
    return np.lib.stride_tricks.as_strided(xp, shape=shape, strides=strides, writeable=False)


def _convnd(input, weight, bias, stride, padding, dilation, groups, nsp):
    name = f"conv{nsp}d"
    unbatched = input.dim() == nsp + 1
    if input.dim() not in (nsp + 1, nsp + 2):
        raise RuntimeError(f"Expected {nsp + 1}D (unbatched) or {nsp + 2}D (batched) input to {name}, but got input of size: [{', '.join(map(str, input.shape))}]")
    x = input.unsqueeze(0) if unbatched else input
    if x.device != weight.device:
        ttype = lambda t: ("torch.cuda." if t.is_cuda else "torch.") + _tname(t.dtype) + "Tensor"
        raise RuntimeError(f"Input type ({ttype(x)}) and weight type ({ttype(weight)}) should be the same or input should be a MKLDNN tensor and weight is a dense tensor")
    if x.dtype is not weight.dtype:
        ctype = {"float32": "float", "float64": "double", "float16": "c10::Half", "bfloat16": "c10::BFloat16", "uint8": "unsigned char", "int8": "signed char", "int16": "short int", "int32": "int", "int64": "long int", "bool": "bool"}
        other = "bias" if bias is not None else "weight"
        raise RuntimeError(f"Input type ({ctype[x.dtype.name]}) and {other} type ({ctype[weight.dtype.name]}) should be the same")
    N, C = x.shape[0], x.shape[1]
    O, Cg = weight.shape[0], weight.shape[1]
    k = tuple(weight.shape[2:])
    s, d = _ntuple(stride, nsp), _ntuple(dilation, nsp)
    if C != Cg * groups:
        raise RuntimeError(f"Given groups={groups}, weight of size [{', '.join(map(str, weight.shape))}], expected input[{', '.join(map(str, x.shape))}] to have {Cg * groups} channels, but got {C} channels instead")
    if isinstance(padding, str):
        if padding == "valid":
            pads = [(0, 0)] * nsp
        elif padding == "same":
            if any(v != 1 for v in s):
                raise RuntimeError("padding='same' is not supported for strided convolutions")
            pads = []
            for i in range(nsp):
                total = d[i] * (k[i] - 1)
                pads.append((total // 2, total - total // 2))
        else:
            raise RuntimeError(f"Invalid padding string: '{padding}'")
    else:
        p = _ntuple(padding, nsp)
        pads = [(v, v) for v in p]
    sp = x.shape[2:]
    padded = [sp[i] + pads[i][0] + pads[i][1] for i in range(nsp)]
    eff = [d[i] * (k[i] - 1) + 1 for i in range(nsp)]
    if any(padded[i] < eff[i] for i in range(nsp)):
        raise RuntimeError(f"Calculated padded input size per channel: ({' x '.join(map(str, padded))}). Kernel size: ({' x '.join(map(str, eff))}). Kernel size can't be greater than actual input size")
    out = [(padded[i] - eff[i]) // s[i] + 1 for i in range(nsp)]
    X = x._a.astype(np.float64)
    W = weight._a.astype(np.float64)
    xp = np.pad(X, [(0, 0), (0, 0)] + pads)
    cols = _windows(xp, k, s, d, out)                                 # [N, C, *out, *k]
    cols_g = cols.reshape((N, groups, Cg) + tuple(out) + k)
    Wg = W.reshape((groups, O // groups, Cg) + k)
    sp_in = "hw"[:nsp] if nsp == 2 else "w"
    kk = "ij"[:nsp] if nsp == 2 else "j"
    r = np.einsum(f"ngc{sp_in}{kk},goc{kk}->ngo{sp_in}", cols_g, Wg, optimize=True).reshape((N, O) + tuple(out))
    if bias is not None:
        r = r + bias._a.astype(np.float64).reshape((1, O) + (1,) * nsp)
    dt = x._a.dtype

    def bw(g):
        g = np.asarray(g, dtype=np.float64).reshape((N, groups, O // groups) + tuple(out))
        gw = np.einsum(f"ngo{sp_in},ngc{sp_in}{kk}->goc{kk}", g, cols_g, optimize=True).reshape(W.shape)
        gcols = np.einsum(f"ngo{sp_in},goc{kk}->ngc{sp_in}{kk}", g, Wg, optimize=True).reshape((N, C) + tuple(out) + k)
        gxp = np.zeros(xp.shape)
        import itertools
        for idx in itertools.product(*[range(v) for v in k]):
            sl = tuple(slice(idx[i] * d[i], idx[i] * d[i] + s[i] * (out[i] - 1) + 1, s[i]) for i in range(nsp))
            gxp[(slice(None), slice(None)) + sl] += gcols[(Ellipsis,) + idx]
        crop = tuple(slice(pads[i][0], pads[i][0] + sp[i]) for i in range(nsp))
        gx = gxp[(slice(None), slice(None)) + crop]
        gb = g.sum(axis=(0,) + tuple(range(3, 3 + nsp))).reshape(O) if bias is not None else None
        return (gx.astype(dt), gw.astype(dt), None if gb is None else gb.astype(dt))
    res = _make_result(r.astype(dt), x.dtype, [x, weight, bias], "ConvolutionBackward0", bw, saved=[x, weight], dev=x.device)
    return res.squeeze(0) if unbatched else res


def conv2d(input, weight, bias=None, stride=1, padding=0, dilation=1, groups=1):
    """2-D convolution of [N, C_in, H, W] (or [C_in, H, W]) with weight [C_out, C_in / groups, kH, kW]."""
    return _convnd(input, weight, bias, stride, padding, dilation, groups, 2)


def conv1d(input, weight, bias=None, stride=1, padding=0, dilation=1, groups=1):
    """1-D convolution of [N, C_in, L] (or [C_in, L]) with weight [C_out, C_in / groups, k]."""
    return _convnd(input, weight, bias, stride, padding, dilation, groups, 1)


def _pool_out(size, k, s, p, d, ceil_mode):
    num = size + 2 * p - d * (k - 1) - 1
    o = (-(-num // s) if ceil_mode else num // s) + 1
    if ceil_mode and (o - 1) * s >= size + p:
        o -= 1
    return o


def _pool2d(input, kernel_size, stride, padding, dilation, ceil_mode, kind, count_include_pad=True, divisor_override=None, return_indices=False):
    unbatched = input.dim() == 3
    if input.dim() not in (3, 4):
        raise RuntimeError(f"non-empty 3D or 4D (batch mode) tensor expected for input")
    x = input.unsqueeze(0) if unbatched else input
    k = _ntuple(kernel_size, 2)
    s = _ntuple(stride if (stride is not None and stride != []) else kernel_size, 2)
    p = _ntuple(padding, 2)
    d = _ntuple(dilation, 2)
    if any(p[i] > k[i] // 2 for i in range(2)):
        raise RuntimeError(f"pad should be at most half of effective kernel size, but got pad={p[0]}, kernel_size={k[0]} and dilation={d[0]}")
    N, C, H, W = x.shape
    out = [_pool_out(x.shape[2 + i], k[i], s[i], p[i], d[i], ceil_mode) for i in range(2)]
    if any(o <= 0 for o in out):
        raise RuntimeError(f"Given input size: ({C}x{H}x{W}). Calculated output size: ({C}x{out[0]}x{out[1]}). Output size is too small")
    need = [(out[i] - 1) * s[i] + d[i] * (k[i] - 1) + 1 for i in range(2)]
    extra = [max(0, need[i] - (x.shape[2 + i] + 2 * p[i])) for i in range(2)]
    X = x._a
    fill = -np.inf if kind == "max" else 0.0
    xp = np.pad(X.astype(np.float64), [(0, 0), (0, 0), (p[0], p[0] + extra[0]), (p[1], p[1] + extra[1])], constant_values=fill)
    cols = _windows(xp, k, s, d, out).reshape(N, C, out[0], out[1], k[0] * k[1])
    dt = X.dtype
    if kind == "max":
        arg = cols.argmax(axis=-1)
        r = np.take_along_axis(cols, arg[..., None], axis=-1)[..., 0]

        def bw(g):
            g = np.asarray(g, dtype=np.float64)
            gxp = np.zeros(xp.shape)
            ki, kj = np.unravel_index(arg, k)
            oi = np.arange(out[0]).reshape(1, 1, -1, 1) * s[0] + ki * d[0]
            oj = np.arange(out[1]).reshape(1, 1, 1, -1) * s[1] + kj * d[1]
            n_i = np.arange(N).reshape(-1, 1, 1, 1)
            c_i = np.arange(C).reshape(1, -1, 1, 1)
            np.add.at(gxp, (np.broadcast_to(n_i, arg.shape), np.broadcast_to(c_i, arg.shape), oi, oj), g)
            return (gxp[:, :, p[0]:p[0] + H, p[1]:p[1] + W].astype(dt),)
        res = _make_result(r.astype(dt), x.dtype, [x], "MaxPool2DWithIndicesBackward0", bw, dev=x.device)
        if return_indices:
            ki, kj = np.unravel_index(arg, k)
            rows = np.arange(out[0]).reshape(1, 1, -1, 1) * s[0] + ki * d[0] - p[0]
            colsj = np.arange(out[1]).reshape(1, 1, 1, -1) * s[1] + kj * d[1] - p[1]
            idx = _core.Tensor._wrap((rows * W + colsj).astype(np.int64), _core.int64, x.device)
            return (res.squeeze(0), idx.squeeze(0)) if unbatched else (res, idx)
        return res.squeeze(0) if unbatched else res
    # average
    if divisor_override:
        div = np.full(out, float(divisor_override))
    elif count_include_pad:
        hs = np.arange(out[0]) * s[0] - p[0]
        ws = np.arange(out[1]) * s[1] - p[1]
        he = np.minimum(hs + k[0], H + p[0])
        we = np.minimum(ws + k[1], W + p[1])
        div = ((he - hs)[:, None] * (we - ws)[None, :]).astype(np.float64)
    else:
        hs = np.maximum(np.arange(out[0]) * s[0] - p[0], 0)
        ws = np.maximum(np.arange(out[1]) * s[1] - p[1], 0)
        he = np.minimum(np.arange(out[0]) * s[0] - p[0] + k[0], H)
        we = np.minimum(np.arange(out[1]) * s[1] - p[1] + k[1], W)
        div = ((he - hs)[:, None] * (we - ws)[None, :]).astype(np.float64)
    r = cols.sum(axis=-1) / div

    def bw(g):
        g = np.asarray(g, dtype=np.float64) / div
        gxp = np.zeros(xp.shape)
        for i in range(k[0]):
            for j in range(k[1]):
                gxp[:, :, i * d[0]: i * d[0] + s[0] * (out[0] - 1) + 1: s[0], j * d[1]: j * d[1] + s[1] * (out[1] - 1) + 1: s[1]] += g
        return (gxp[:, :, p[0]:p[0] + H, p[1]:p[1] + W].astype(dt),)
    res = _make_result(r.astype(dt), x.dtype, [x], "AvgPool2DBackward0", bw, dev=x.device)
    return res.squeeze(0) if unbatched else res


def max_pool2d(input, kernel_size, stride=None, padding=0, dilation=1, ceil_mode=False, return_indices=False):
    return _pool2d(input, kernel_size, stride, padding, dilation, ceil_mode, "max", return_indices=return_indices)


def avg_pool2d(input, kernel_size, stride=None, padding=0, ceil_mode=False, count_include_pad=True, divisor_override=None):
    return _pool2d(input, kernel_size, stride, padding, 1, ceil_mode, "avg", count_include_pad, divisor_override)


def _adaptive_bins(size, out):
    return [(int(np.floor(i * size / out)), int(np.ceil((i + 1) * size / out))) for i in range(out)]


def _adaptive2d(input, output_size, kind):
    unbatched = input.dim() == 3
    x = input.unsqueeze(0) if unbatched else input
    H, W = x.shape[2], x.shape[3]
    o = _ntuple(output_size, 2)
    o = (H if o[0] is None else o[0], W if o[1] is None else o[1])
    if kind == "avg" and o == (1, 1):
        res = x.mean(dim=(-2, -1), keepdim=True)
        return res.squeeze(0) if unbatched else res
    X = x._a.astype(np.float64)
    bh, bw_ = _adaptive_bins(H, o[0]), _adaptive_bins(W, o[1])
    r = np.zeros(X.shape[:2] + o)
    arg = {}
    for i, (h0, h1) in enumerate(bh):
        for j, (w0, w1) in enumerate(bw_):
            win = X[:, :, h0:h1, w0:w1]
            if kind == "avg":
                r[:, :, i, j] = win.mean(axis=(2, 3))
            else:
                flat = win.reshape(win.shape[0], win.shape[1], -1)
                a = flat.argmax(axis=-1)
                arg[i, j] = a
                r[:, :, i, j] = np.take_along_axis(flat, a[..., None], axis=-1)[..., 0]
    dt = x._a.dtype

    def bw(g):
        g = np.asarray(g, dtype=np.float64)
        gx = np.zeros(X.shape)
        for i, (h0, h1) in enumerate(bh):
            for j, (w0, w1) in enumerate(bw_):
                if kind == "avg":
                    gx[:, :, h0:h1, w0:w1] += g[:, :, i:i + 1, j:j + 1] / ((h1 - h0) * (w1 - w0))
                else:
                    a = arg[i, j]
                    ww = w1 - w0
                    for n in range(X.shape[0]):
                        for c in range(X.shape[1]):
                            gx[n, c, h0 + a[n, c] // ww, w0 + a[n, c] % ww] += g[n, c, i, j]
        return (gx.astype(dt),)
    res = _make_result(r.astype(dt), x.dtype, [x], "AdaptiveAvgPool2DBackward0" if kind == "avg" else "AdaptiveMaxPool2DBackward0", bw, dev=x.device)
    return res.squeeze(0) if unbatched else res


def adaptive_avg_pool2d(input, output_size):
    return _adaptive2d(input, output_size, "avg")


def adaptive_max_pool2d(input, output_size, return_indices=False):
    return _adaptive2d(input, output_size, "max")


# ---------------------------------------------------------------- attention

def scaled_dot_product_attention(query, key, value, attn_mask=None, dropout_p=0.0, is_causal=False, scale=None, enable_gqa=False):
    """softmax(Q Kᵀ / √d + mask) V. A boolean attn_mask marks the positions that MAY be attended to (True = keep)."""
    L, S = query.size(-2), key.size(-2)
    scale_factor = 1 / math.sqrt(query.size(-1)) if scale is None else scale
    bias = _core.zeros(L, S, dtype=query.dtype, device=query.device)
    if is_causal:
        if attn_mask is not None:
            raise RuntimeError("_scaled_dot_product_attention: Explicit attn_mask should not be set when is_causal=True")
        keep = _core.ones(L, S, dtype=_core.bool).tril(diagonal=0)
        bias = bias.masked_fill(keep.logical_not(), float("-inf"))
    if attn_mask is not None:
        if attn_mask.dtype is _core.bool:
            bias = bias.masked_fill(attn_mask.logical_not(), float("-inf"))
        else:
            bias = attn_mask + bias
    if enable_gqa:
        key = key.repeat_interleave(query.size(-3) // key.size(-3), -3)
        value = value.repeat_interleave(query.size(-3) // value.size(-3), -3)
    w = query @ key.transpose(-2, -1) * scale_factor
    w = w + bias
    w = w.softmax(dim=-1)
    if dropout_p > 0.0:
        w = dropout(w, dropout_p, training=True)
    out = w @ value
    if out.grad_fn is not None:
        out.grad_fn.__class__ = _node_class("ScaledDotProductFlashAttentionForCpuBackward0")
    return out


# ---------------------------------------------------------------- autocast op lists

linear = _core._autocast_op("lower")(linear)
_convnd = _core._autocast_op("lower")(_convnd)
scaled_dot_product_attention = _core._autocast_op("lower")(scaled_dot_product_attention)
for _name in ("mse_loss", "l1_loss", "smooth_l1_loss", "huber_loss", "binary_cross_entropy_with_logits", "nll_loss",
              "cross_entropy", "kl_div"):
    globals()[_name] = _core._autocast_op("fp32")(globals()[_name])
cosine_similarity = _core._autocast_op("fp32", ("cuda",))(cosine_similarity)
_bce = binary_cross_entropy


def binary_cross_entropy(input, target, weight=None, size_average=None, reduce=None, reduction="mean"):
    if _core._AUTOCAST["cuda"][0] and isinstance(input, Tensor) and input.device.type == "cuda":
        raise RuntimeError("torch.nn.functional.binary_cross_entropy and torch.nn.BCELoss are unsafe to autocast.\n"
                           "Many models use a sigmoid layer right before the binary cross entropy layer.\n"
                           "In this case, combine the two layers using torch.nn.functional.binary_cross_entropy_with_logits\n"
                           "or torch.nn.BCEWithLogitsLoss.  binary_cross_entropy_with_logits and BCEWithLogits are\n"
                           "safe to autocast.")
    return _core._autocast_op("fp32", ("cpu",))(_bce)(input, target, weight, size_average, reduce, reduction)


del _name
