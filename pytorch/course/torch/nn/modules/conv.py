"""Conv1d and Conv2d."""
import math

from ... import _core
from .. import functional as F, init
from ..parameter import Parameter
from .module import Module

__all__ = ["Conv1d", "Conv2d"]


class _ConvNd(Module):
    _n = 2

    def __init__(self, in_channels, out_channels, kernel_size, stride=1, padding=0, dilation=1, groups=1, bias=True,
                 padding_mode="zeros", device=None, dtype=None):
        super().__init__()
        n = self._n
        if groups <= 0:
            raise ValueError("groups must be a positive integer")
        if in_channels % groups != 0:
            raise ValueError("in_channels must be divisible by groups")
        if out_channels % groups != 0:
            raise ValueError("out_channels must be divisible by groups")
        if isinstance(padding, str):
            if padding not in ("same", "valid"):
                raise ValueError(f"Invalid padding string {padding!r}, should be one of {{'valid', 'same'}}")
            if padding == "same" and any(s != 1 for s in F._ntuple(stride, n)):
                raise ValueError("padding='same' is not supported for strided convolutions")
        if padding_mode != "zeros":
            raise ValueError("The sandbox's convolutions only support padding_mode='zeros'.")
        self.in_channels, self.out_channels = in_channels, out_channels
        self.kernel_size = F._ntuple(kernel_size, n)
        self.stride = F._ntuple(stride, n)
        self.padding = padding if isinstance(padding, str) else F._ntuple(padding, n)
        self.dilation = F._ntuple(dilation, n)
        self.groups, self.padding_mode = groups, padding_mode
        self.transposed, self.output_padding = False, (0,) * n
        self.weight = Parameter(_core.empty((out_channels, in_channels // groups) + self.kernel_size, device=device, dtype=dtype))
        if bias:
            self.bias = Parameter(_core.empty(out_channels, device=device, dtype=dtype))
        else:
            self.register_parameter("bias", None)
        self.reset_parameters()

    def reset_parameters(self):
        init.kaiming_uniform_(self.weight, a=math.sqrt(5))
        if self.bias is not None:
            fan_in, _ = init._calculate_fan_in_and_fan_out(self.weight)
            if fan_in != 0:
                bound = 1 / math.sqrt(fan_in)
                init.uniform_(self.bias, -bound, bound)

    def extra_repr(self):
        n = self._n
        s = f"{self.in_channels}, {self.out_channels}, kernel_size={self.kernel_size}, stride={self.stride}"
        if self.padding != (0,) * n:
            s += f", padding={self.padding}"
        if self.dilation != (1,) * n:
            s += f", dilation={self.dilation}"
        if self.groups != 1:
            s += f", groups={self.groups}"
        if self.bias is None:
            s += ", bias=False"
        return s


class Conv2d(_ConvNd):
    """Slides out_channels learned kernels of size kernel_size over [N, C, H, W] images.
    Output size per side: floor((size + 2·padding − dilation·(kernel − 1) − 1) / stride) + 1."""
    _n = 2

    def forward(self, input):
        return F.conv2d(input, self.weight, self.bias, self.stride, self.padding, self.dilation, self.groups)


class Conv1d(_ConvNd):
    """Slides learned kernels along sequences of shape [N, C, L]."""
    _n = 1

    def forward(self, input):
        return F.conv1d(input, self.weight, self.bias, self.stride, self.padding, self.dilation, self.groups)


Conv1d.__module__ = Conv2d.__module__ = "torch.nn.modules.conv"
