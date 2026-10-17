"""tv_tensors: tensor subclasses that tell torchvision.transforms.v2 what a tensor holds."""
import numpy as np

import torch
from torch._core import Tensor


class TVTensor(Tensor):
    def __new__(cls, data, *, dtype=None, device=None, requires_grad=None):
        t = data if isinstance(data, Tensor) else torch.as_tensor(data, dtype=dtype, device=device)
        if dtype is not None or device is not None:
            t = t.to(dtype=dtype or t.dtype, device=device or t.device)
        out = cls._wrap(t._a, t.dtype, t.device)
        out.requires_grad = bool(requires_grad) if requires_grad is not None else t.requires_grad
        return out

    def __init__(self, *args, **kwargs):
        pass

    def _make_repr(self, **kwargs):
        extra = ", ".join(f"{k}={v}" for k, v in kwargs.items())
        return f"{Tensor.__repr__(self)[:-1]}, {extra})"

    def __repr__(self, *, tensor_contents=None):
        return self._make_repr()

    def __str__(self):
        return self.__repr__()


class Image(TVTensor):
    """An image tensor: [..., channels, height, width]. A 2-D input gets a channel dimension of 1."""

    def __new__(cls, data, *, dtype=None, device=None, requires_grad=None):
        t = data if isinstance(data, Tensor) else torch.as_tensor(np.asarray(data), dtype=dtype, device=device)
        if t.ndim < 2:
            raise ValueError
        if t.ndim == 2:
            t = t.unsqueeze(0)
        return super().__new__(cls, t, dtype=dtype, device=device, requires_grad=requires_grad)


Image.__module__ = TVTensor.__module__ = "torchvision.tv_tensors"
