"""BatchNorm1d and LayerNorm."""
import numpy as np

from ... import _core
from ..._core import Tensor, _make_result
from ..parameter import Parameter
from .module import Module

__all__ = ["BatchNorm1d", "LayerNorm"]


class BatchNorm1d(Module):
    """Normalises each feature over the batch. In training it uses the batch's mean and variance and updates
    running estimates (momentum 0.1); in eval mode it uses the running estimates instead."""

    def __init__(self, num_features, eps=1e-5, momentum=0.1, affine=True, track_running_stats=True, device=None, dtype=None):
        super().__init__()
        self.num_features, self.eps, self.momentum = num_features, eps, momentum
        self.affine, self.track_running_stats = affine, track_running_stats
        if affine:
            self.weight = Parameter(_core.ones(num_features, device=device, dtype=dtype))
            self.bias = Parameter(_core.zeros(num_features, device=device, dtype=dtype))
        else:
            self.register_parameter("weight", None)
            self.register_parameter("bias", None)
        if track_running_stats:
            self.register_buffer("running_mean", _core.zeros(num_features, device=device, dtype=dtype))
            self.register_buffer("running_var", _core.ones(num_features, device=device, dtype=dtype))
            self.register_buffer("num_batches_tracked", _core.tensor(0, dtype=_core.int64, device=device))
        else:
            self.register_buffer("running_mean", None)
            self.register_buffer("running_var", None)
            self.register_buffer("num_batches_tracked", None)

    def extra_repr(self):
        return f"{self.num_features}, eps={self.eps}, momentum={self.momentum}, affine={self.affine}, bias={self.affine}, track_running_stats={self.track_running_stats}"

    def forward(self, input):
        if input.dim() not in (2, 3):
            raise ValueError(f"expected 2D or 3D input (got {input.dim()}D input)")
        if input.shape[1] != self.num_features:
            raise RuntimeError(f"running_mean should contain {input.shape[1]} elements not {self.num_features}")
        axes = (0,) if input.dim() == 2 else (0, 2)
        x = input._a.astype(np.float64)
        use_batch = self.training or not self.track_running_stats
        shape = [1, -1] + ([1] if input.dim() == 3 else [])
        if use_batch:
            n = x.size // x.shape[1]
            if self.training and n <= 1:
                raise ValueError(f"Expected more than 1 value per channel when training, got input size {input.shape}")
            mean = x.mean(axis=axes)
            var = x.var(axis=axes)
            if self.training and self.track_running_stats:
                self.num_batches_tracked._a[...] += 1
                m = self.momentum if self.momentum is not None else 1.0 / float(self.num_batches_tracked._a)
                unbiased = var * n / max(n - 1, 1)
                self.running_mean._a[...] = (1 - m) * self.running_mean._a + m * mean
                self.running_var._a[...] = (1 - m) * self.running_var._a + m * unbiased
        else:
            mean = self.running_mean._a.astype(np.float64)
            var = self.running_var._a.astype(np.float64)
        inv = 1.0 / np.sqrt(var + self.eps)
        xhat = (x - mean.reshape(shape)) * inv.reshape(shape)
        w = self.weight._a.astype(np.float64).reshape(shape) if self.affine else 1.0
        b = self.bias._a.astype(np.float64).reshape(shape) if self.affine else 0.0
        y = (xhat * w + b).astype(input._a.dtype)
        n = x.size // x.shape[1]

        def bw(g):
            g = np.asarray(g, dtype=np.float64)
            gw = (g * xhat).sum(axis=axes) if self.affine else None
            gb = g.sum(axis=axes) if self.affine else None
            gx = g * w
            if use_batch:
                gx = (inv.reshape(shape) / n) * (n * gx - gx.sum(axis=axes, keepdims=True) - xhat * (gx * xhat).sum(axis=axes, keepdims=True))
            else:
                gx = gx * inv.reshape(shape)
            dt = input._a.dtype
            return (gx.astype(dt), None if gw is None else gw.astype(dt), None if gb is None else gb.astype(dt))
        return _make_result(y, input.dtype, [input, self.weight, self.bias], "NativeBatchNormBackward0", bw, saved=[input])


class LayerNorm(Module):
    """Normalises over the last dims (normalized_shape) of each sample separately; the same in train and eval."""

    def __init__(self, normalized_shape, eps=1e-5, elementwise_affine=True, bias=True, device=None, dtype=None):
        super().__init__()
        if isinstance(normalized_shape, int):
            normalized_shape = (normalized_shape,)
        self.normalized_shape, self.eps, self.elementwise_affine = tuple(normalized_shape), eps, elementwise_affine
        if elementwise_affine:
            self.weight = Parameter(_core.ones(*self.normalized_shape, device=device, dtype=dtype))
            if bias:
                self.bias = Parameter(_core.zeros(*self.normalized_shape, device=device, dtype=dtype))
            else:
                self.register_parameter("bias", None)
        else:
            self.register_parameter("weight", None)
            self.register_parameter("bias", None)

    def extra_repr(self):
        return f"{self.normalized_shape}, eps={self.eps}, elementwise_affine={self.elementwise_affine}" + (f", bias={self.bias is not None}" if self.elementwise_affine else "")

    def forward(self, input):
        k = len(self.normalized_shape)
        if tuple(input.shape[-k:]) != self.normalized_shape:
            raise RuntimeError(f"Given normalized_shape={list(self.normalized_shape)}, expected input with shape [*, {', '.join(map(str, self.normalized_shape))}], but got input of size{list(input.shape)}")
        axes = tuple(range(input.dim() - k, input.dim()))
        x = input._a.astype(np.float64)
        mean = x.mean(axis=axes, keepdims=True)
        var = x.var(axis=axes, keepdims=True)
        inv = 1.0 / np.sqrt(var + self.eps)
        xhat = (x - mean) * inv
        w = self.weight._a.astype(np.float64) if self.weight is not None else 1.0
        b = self.bias._a.astype(np.float64) if self.bias is not None else 0.0
        y = (xhat * w + b).astype(input._a.dtype)
        n = int(np.prod(self.normalized_shape))
        lead = tuple(range(input.dim() - k))

        def bw(g):
            g = np.asarray(g, dtype=np.float64)
            gw = (g * xhat).sum(axis=lead) if self.weight is not None else None
            gb = g.sum(axis=lead) if self.bias is not None else None
            gx = g * w
            gx = (inv / n) * (n * gx - gx.sum(axis=axes, keepdims=True) - xhat * (gx * xhat).sum(axis=axes, keepdims=True))
            dt = input._a.dtype
            return (gx.astype(dt), None if gw is None else gw.astype(dt), None if gb is None else gb.astype(dt))
        return _make_result(y, input.dtype, [input, self.weight, self.bias], "NativeLayerNormBackward0", bw, saved=[input])


for _c in (BatchNorm1d, LayerNorm):
    _c.__module__ = "torch.nn.modules.batchnorm" if _c is BatchNorm1d else "torch.nn.modules.normalization"
