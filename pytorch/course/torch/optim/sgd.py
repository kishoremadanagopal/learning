import numpy as np

from .. import _core
from .optimizer import Optimizer, _fma


class SGD(Optimizer):
    """Stochastic gradient descent: p ← p − lr · grad, optionally with momentum, Nesterov momentum and weight decay."""

    def __init__(self, params, lr=1e-3, momentum=0, dampening=0, weight_decay=0, nesterov=False, *, maximize=False, foreach=None, differentiable=False, fused=None):
        if isinstance(lr, _core.Tensor) and lr.numel() != 1:
            raise ValueError("Tensor lr must be 1-element")
        if lr < 0.0:
            raise ValueError(f"Invalid learning rate: {lr}")
        if momentum < 0.0:
            raise ValueError(f"Invalid momentum value: {momentum}")
        if weight_decay < 0.0:
            raise ValueError(f"Invalid weight_decay value: {weight_decay}")
        defaults = dict(lr=lr, momentum=momentum, dampening=dampening, weight_decay=weight_decay, nesterov=nesterov,
                        maximize=maximize, foreach=foreach, differentiable=differentiable, fused=fused)
        if nesterov and (momentum <= 0 or dampening != 0):
            raise ValueError("Nesterov momentum requires a momentum and zero dampening")
        super().__init__(params, defaults)

    def step(self, closure=None):
        loss = None
        if closure is not None:
            with _core.enable_grad():
                loss = closure()
        with _core.no_grad():
            for group in self.param_groups:
                lr, mom, damp, wd, nest, maxi = (group[k] for k in ("lr", "momentum", "dampening", "weight_decay", "nesterov", "maximize"))
                for p in group["params"]:
                    if p.grad is None:
                        continue
                    g = p.grad._a if not maxi else -p.grad._a
                    if wd != 0:
                        g = _fma(g, wd, p._a)
                    if mom != 0:
                        st = self.state[p]
                        buf = st.get("momentum_buffer")
                        if buf is None:
                            buf = _core.Tensor._wrap(np.array(g, copy=True), p.dtype, p.device)
                            st["momentum_buffer"] = buf
                        else:
                            buf._a[...] = _fma((buf._a * np.asarray(mom, dtype=buf._a.dtype)).astype(buf._a.dtype), 1 - damp, g)
                        g = _fma(g, mom, buf._a) if nest else buf._a
                    p._a[...] = _fma(p._a, -lr, g)
                    p._bump()
        return loss
