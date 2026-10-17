import math

import numpy as np

from .. import _core
from .optimizer import Optimizer, _fma


class Adam(Optimizer):
    """Adam: per-parameter step sizes from running averages of the gradient (exp_avg) and its square (exp_avg_sq)."""

    def __init__(self, params, lr=1e-3, betas=(0.9, 0.999), eps=1e-8, weight_decay=0, amsgrad=False, *, foreach=None,
                 maximize=False, capturable=False, differentiable=False, fused=None, decoupled_weight_decay=False):
        if lr < 0.0:
            raise ValueError(f"Invalid learning rate: {lr}")
        if eps < 0.0:
            raise ValueError(f"Invalid epsilon value: {eps}")
        if not 0.0 <= betas[0] < 1.0:
            raise ValueError(f"Invalid beta parameter at index 0: {betas[0]}")
        if not 0.0 <= betas[1] < 1.0:
            raise ValueError(f"Invalid beta parameter at index 1: {betas[1]}")
        if weight_decay < 0.0:
            raise ValueError(f"Invalid weight_decay value: {weight_decay}")
        defaults = dict(lr=lr, betas=betas, eps=eps, weight_decay=weight_decay, amsgrad=amsgrad, maximize=maximize,
                        foreach=foreach, capturable=capturable, differentiable=differentiable, fused=fused,
                        decoupled_weight_decay=decoupled_weight_decay)
        super().__init__(params, defaults)

    def step(self, closure=None):
        loss = None
        if closure is not None:
            with _core.enable_grad():
                loss = closure()
        with _core.no_grad():
            for group in self.param_groups:
                lr, (b1, b2), eps, wd = group["lr"], group["betas"], group["eps"], group["weight_decay"]
                for p in group["params"]:
                    if p.grad is None:
                        continue
                    f = p._a.dtype.type
                    g = p.grad._a if not group["maximize"] else -p.grad._a
                    st = self.state[p]
                    if not st:
                        st["step"] = _core.tensor(0.0)
                        st["exp_avg"] = _core.zeros_like(p)
                        st["exp_avg_sq"] = _core.zeros_like(p)
                        if group["amsgrad"]:
                            st["max_exp_avg_sq"] = _core.zeros_like(p)
                    st["step"]._a[...] += 1
                    if wd != 0:
                        if group["decoupled_weight_decay"]:
                            p._a[...] = (p._a * f(1 - lr * wd)).astype(p._a.dtype)
                        else:
                            g = _fma(g, wd, p._a)
                    m, v = st["exp_avg"]._a, st["exp_avg_sq"]._a
                    w = f(1 - b1)
                    m[...] = _fma(m, w, (g - m).astype(m.dtype))                      # exp_avg.lerp_(grad, 1 - beta1)
                    v[...] = _fma((v * f(b2)).astype(v.dtype), 1 - b2, (g * g).astype(v.dtype))   # exp_avg_sq.mul_(beta2).addcmul_(grad, grad, value=1 - beta2)
                    step = float(st["step"]._a)
                    bc1 = 1 - b1 ** step
                    bc2 = 1 - b2 ** step
                    step_size = lr / bc1
                    bc2_sqrt = math.sqrt(bc2)
                    if group["amsgrad"]:
                        mx = st["max_exp_avg_sq"]._a
                        mx[...] = np.maximum(mx, v)
                        denom = (np.sqrt(mx) / f(bc2_sqrt) + f(eps)).astype(m.dtype)
                    else:
                        denom = (np.sqrt(v) / f(bc2_sqrt) + f(eps)).astype(m.dtype)
                    p._a[...] = (p._a + (f(-step_size) * m) / denom).astype(p._a.dtype)   # param.addcdiv_(exp_avg, denom, value=-step_size)
                    p._bump()
        return loss


class AdamW(Adam):
    """Adam with decoupled weight decay: the weights shrink by lr · weight_decay each step, separately from the gradient."""

    def __init__(self, params, lr=1e-3, betas=(0.9, 0.999), eps=1e-8, weight_decay=1e-2, amsgrad=False, *, maximize=False,
                 foreach=None, capturable=False, differentiable=False, fused=None):
        super().__init__(params, lr, betas, eps, weight_decay, amsgrad, foreach=foreach, maximize=maximize,
                         capturable=capturable, differentiable=differentiable, fused=fused, decoupled_weight_decay=True)
