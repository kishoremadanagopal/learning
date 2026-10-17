"""torch.autograd: gradients. backward() lives on Tensor; grad() returns gradients without storing them in .grad."""
import numpy as _np

from .. import _core
from .._core import no_grad, enable_grad, set_grad_enabled, inference_mode  # noqa: F401


def backward(tensors, grad_tensors=None, retain_graph=None, create_graph=False, inputs=None):
    if isinstance(tensors, _core.Tensor):
        tensors = [tensors]
    grad_tensors = grad_tensors if grad_tensors is not None else [None] * len(tensors)
    if isinstance(grad_tensors, _core.Tensor):
        grad_tensors = [grad_tensors]
    for t, g in zip(tensors, grad_tensors):
        t.backward(g, retain_graph=retain_graph)


def grad(outputs, inputs, grad_outputs=None, retain_graph=None, create_graph=False, allow_unused=None):
    if create_graph:
        raise RuntimeError("The sandbox's PyTorch doesn't build graphs of gradients (create_graph=True): try higher-order gradients on your own computer.")
    single_out = isinstance(outputs, _core.Tensor)
    outputs = [outputs] if single_out else list(outputs)
    single_in = isinstance(inputs, _core.Tensor)
    inputs = [inputs] if single_in else list(inputs)
    gos = grad_outputs if grad_outputs is not None else [None] * len(outputs)
    if isinstance(gos, _core.Tensor):
        gos = [gos]
    gs = []
    for o, g in zip(outputs, gos):
        if not o.requires_grad:
            raise RuntimeError("element 0 of tensors does not require grad and does not have a grad_fn")
        if g is None:
            if o.numel() != 1:
                raise RuntimeError("grad can be implicitly created only for scalar outputs")
            gs.append(_np.ones(o._a.shape, dtype=o._a.dtype))
        else:
            gs.append(_np.asarray(g._a, dtype=o._a.dtype))
    for i, t in enumerate(inputs):
        if not t.requires_grad:
            raise RuntimeError(f"One of the differentiated Tensors does not require grad")
    res = _core._run_backward(outputs, gs, retain_graph=bool(retain_graph), inputs=inputs)
    out = []
    for t, r in zip(inputs, res):
        if r is None:
            if not allow_unused:
                raise RuntimeError("One of the differentiated Tensors appears to not have been used in the graph. Set allow_unused=True if this is the desired behavior.")
            out.append(None)
        else:
            out.append(_core.Tensor._wrap(_np.asarray(r, dtype=t._a.dtype).reshape(t._a.shape).copy(), t.dtype, t.device))
    return tuple(out)


class set_detect_anomaly:
    def __init__(self, mode, check_nan=True):
        self.mode = mode

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


detect_anomaly = set_detect_anomaly
