"""The Optimizer base class: holds param_groups and per-parameter state."""
from collections import defaultdict

import numpy as np

from .. import _core
from .._core import Tensor


class _RequiredParameter:
    def __repr__(self):
        return "<required parameter>"


required = _RequiredParameter()


def _fma(a, alpha, b):
    """a + alpha * b with one rounding, as PyTorch's vectorized CPU kernels do (a fused multiply-add)."""
    if a.dtype == np.float32:
        return (a.astype(np.float64) + np.float64(np.float32(alpha)) * b.astype(np.float64)).astype(np.float32)
    return a + alpha * b


class Optimizer:
    def __init__(self, params, defaults):
        self.defaults = defaults
        self.state = defaultdict(dict)
        self.param_groups = []
        if isinstance(params, Tensor):
            raise TypeError("params argument given to the optimizer should be an iterable of Tensors or dicts, but got " + params.type())
        param_groups = list(params)
        if len(param_groups) == 0:
            raise ValueError("optimizer got an empty parameter list")
        if not isinstance(param_groups[0], dict):
            param_groups = [{"params": param_groups}]
        for g in param_groups:
            self.add_param_group(g)

    def add_param_group(self, param_group):
        params = param_group["params"]
        if isinstance(params, Tensor):
            param_group["params"] = [params]
        else:
            param_group["params"] = list(params)
        for p in param_group["params"]:
            if not isinstance(p, Tensor):
                raise TypeError("optimizer can only optimize Tensors, but one of the params is " + type(p).__name__)
            if not p.is_leaf:
                raise ValueError("can't optimize a non-leaf Tensor")
        for name, default in self.defaults.items():
            if default is required and name not in param_group:
                raise ValueError(f"parameter group didn't specify a value of required optimization parameter {name}")
            param_group.setdefault(name, default)
        group = {k: v for k, v in param_group.items() if k != "params"}
        group["params"] = param_group["params"]
        seen = {id(p) for g in self.param_groups for p in g["params"]}
        if any(id(p) in seen for p in group["params"]):
            raise ValueError("some parameters appear in more than one parameter group")
        self.param_groups.append(group)

    def zero_grad(self, set_to_none=True):
        for group in self.param_groups:
            for p in group["params"]:
                if p.grad is not None:
                    if set_to_none:
                        p.grad = None
                    else:
                        p.grad.zero_()

    def __repr__(self):
        s = self.__class__.__name__ + " ("
        for i, group in enumerate(self.param_groups):
            s += "\n"
            s += f"Parameter Group {i}\n"
            for key in sorted(group.keys()):
                if key != "params":
                    s += f"    {key}: {group[key]}\n"
        return s + ")"

    def state_dict(self):
        index, packed_groups, start = {}, [], 0
        for g in self.param_groups:
            packed = {k: v for k, v in g.items() if k != "params"}
            ids = list(range(start, start + len(g["params"])))
            for i, p in zip(ids, g["params"]):
                index[id(p)] = i
            packed["params"] = ids
            start += len(ids)
            packed_groups.append(packed)
        state = {index[id(p)]: v for g in self.param_groups for p in g["params"] for v in [self.state[p]] if v}
        return {"state": state, "param_groups": packed_groups}

    def load_state_dict(self, state_dict):
        groups = self.param_groups
        saved = state_dict["param_groups"]
        if len(groups) != len(saved):
            raise ValueError("loaded state dict has a different number of parameter groups")
        if any(len(g["params"]) != len(s["params"]) for g, s in zip(groups, saved)):
            raise ValueError("loaded state dict contains a parameter group that doesn't match the size of optimizer's group")
        id_map = {old: p for g, s in zip(groups, saved) for old, p in zip(s["params"], g["params"])}
        self.state = defaultdict(dict)
        for k, v in state_dict["state"].items():
            if k in id_map:
                p = id_map[k]
                self.state[p] = {name: (val.to(p.device) if isinstance(val, Tensor) and name != "step" else (val.clone() if isinstance(val, Tensor) else val)) for name, val in v.items()}
        for g, s in zip(groups, saved):
            for k, v in s.items():
                if k != "params":
                    g[k] = v

    def step(self, closure=None):
        raise NotImplementedError
