import numpy as np

from .. import _core
from .optimizer import Optimizer, _fma


class RMSprop(Optimizer):
    """Divides each gradient by a running root-mean-square of recent gradients:
    square_avg ← α·square_avg + (1 − α)·grad², p ← p − lr · grad / (√square_avg + eps)."""

    def __init__(self, params, lr=1e-2, alpha=0.99, eps=1e-8, weight_decay=0, momentum=0, centered=False, capturable=False,
                 foreach=None, maximize=False, differentiable=False):
        if lr < 0.0:
            raise ValueError(f"Invalid learning rate: {lr}")
        if eps < 0.0:
            raise ValueError(f"Invalid epsilon value: {eps}")
        if momentum < 0.0:
            raise ValueError(f"Invalid momentum value: {momentum}")
        if weight_decay < 0.0:
            raise ValueError(f"Invalid weight_decay value: {weight_decay}")
        if alpha < 0.0:
            raise ValueError(f"Invalid alpha value: {alpha}")
        defaults = dict(lr=lr, momentum=momentum, alpha=alpha, eps=eps, centered=centered, weight_decay=weight_decay,
                        capturable=capturable, foreach=foreach, maximize=maximize, differentiable=differentiable)
        super().__init__(params, defaults)

    def step(self, closure=None):
        loss = None
        if closure is not None:
            with _core.enable_grad():
                loss = closure()
        with _core.no_grad():
            for group in self.param_groups:
                lr, alpha, eps, wd, mom, centered, maxi = (group[k] for k in ("lr", "alpha", "eps", "weight_decay", "momentum", "centered", "maximize"))
                for p in group["params"]:
                    if p.grad is None:
                        continue
                    g = p.grad._a if not maxi else -p.grad._a
                    dt = p._a.dtype
                    st = self.state[p]
                    if not st:
                        st["step"] = _core.tensor(0.0)
                        st["square_avg"] = _core.zeros_like(p)
                        if mom > 0:
                            st["momentum_buffer"] = _core.zeros_like(p)
                        if centered:
                            st["grad_avg"] = _core.zeros_like(p)
                    st["step"]._a = st["step"]._a + 1
                    if wd != 0:
                        g = _fma(g, wd, p._a)
                    sq = st["square_avg"]._a
                    sq[...] = _fma((sq * np.asarray(alpha, dtype=dt)).astype(dt), 1 - alpha, (g * g).astype(dt))
                    if centered:
                        ga = st["grad_avg"]._a
                        ga[...] = (ga + (g - ga) * np.asarray(1 - alpha, dtype=dt)).astype(dt)
                        avg = (np.sqrt(_fma(sq, -1, (ga * ga).astype(dt))) + np.asarray(eps, dtype=dt)).astype(dt)
                    else:
                        avg = (np.sqrt(sq) + np.asarray(eps, dtype=dt)).astype(dt)
                    if mom > 0:
                        buf = st["momentum_buffer"]._a
                        buf[...] = ((buf * np.asarray(mom, dtype=dt)) + (g / avg)).astype(dt)
                        p._a[...] = _fma(p._a, -lr, buf)
                    else:
                        p._a[...] = _fma(p._a, -lr, (g / avg).astype(dt))
                    p._bump()
        return loss
