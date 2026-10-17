"""nn.Linear and nn.Identity."""
import math

from ... import _core
from .. import functional as F, init
from ..parameter import Parameter
from .module import Module

__all__ = ["Identity", "Linear"]


class Identity(Module):
    """Returns its input unchanged: a placeholder, for example to remove a layer from a model."""

    def __init__(self, *args, **kwargs):
        super().__init__()

    def forward(self, input):
        return input


class Linear(Module):
    """y = x Wᵀ + b. weight has shape [out_features, in_features]; bias has shape [out_features]."""

    def __init__(self, in_features, out_features, bias=True, device=None, dtype=None):
        super().__init__()
        self.in_features = in_features
        self.out_features = out_features
        self.weight = Parameter(_core.empty((out_features, in_features), device=device, dtype=dtype))
        if bias:
            self.bias = Parameter(_core.empty(out_features, device=device, dtype=dtype))
        else:
            self.register_parameter("bias", None)
        self.reset_parameters()

    def reset_parameters(self):
        # PyTorch's default: Kaiming-uniform weights and a uniform bias, both within ±1/sqrt(in_features)
        init.kaiming_uniform_(self.weight, a=math.sqrt(5))
        if self.bias is not None:
            fan_in, _ = init._calculate_fan_in_and_fan_out(self.weight)
            bound = 1 / math.sqrt(fan_in) if fan_in > 0 else 0
            init.uniform_(self.bias, -bound, bound)

    def forward(self, input):
        return F.linear(input, self.weight, self.bias)

    def extra_repr(self):
        return f"in_features={self.in_features}, out_features={self.out_features}, bias={self.bias is not None}"


for _c in (Identity, Linear):
    _c.__module__ = "torch.nn.modules.linear"
