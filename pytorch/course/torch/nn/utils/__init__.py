"""torch.nn.utils: gradient clipping."""
import math

import numpy as np

from ... import _core


def _grads(parameters):
    if isinstance(parameters, _core.Tensor):
        parameters = [parameters]
    return [p.grad for p in parameters if p.grad is not None]


def clip_grad_norm_(parameters, max_norm, norm_type=2.0, error_if_nonfinite=False, foreach=None):
    """Scales all gradients together so their combined norm is at most max_norm. Returns the norm before clipping."""
    grads = _grads(parameters)
    if not grads:
        return _core.tensor(0.0)
    norm_type = float(norm_type)
    if norm_type == math.inf:
        total = max(float(np.abs(g._a).max()) for g in grads)
    else:
        total = sum(float((np.abs(g._a.astype(np.float64)) ** norm_type).sum()) for g in grads) ** (1.0 / norm_type)
    total_t = _core.tensor(total, dtype=grads[0].dtype, device=grads[0].device)
    if error_if_nonfinite and not math.isfinite(total):
        raise RuntimeError(f"The total norm of order {norm_type} for gradients from `parameters` is non-finite, so it cannot be clipped. To disable this error and scale the gradients by the non-finite norm anyway, set `error_if_nonfinite=False`")
    coef = float(max_norm) / (float(total_t) + 1e-6)
    if coef < 1:
        for g in grads:
            g._a[...] = g._a * np.float32(coef) if g._a.dtype == np.float32 else g._a * coef
    return total_t


def clip_grad_value_(parameters, clip_value, foreach=None):
    for g in _grads(parameters):
        np.clip(g._a, -clip_value, clip_value, out=g._a)


def parameters_to_vector(parameters):
    return _core.cat([p.reshape(-1) for p in parameters])
from . import rnn  # noqa: E402,F401
