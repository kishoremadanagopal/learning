"""Max, average and adaptive pooling over 2-D feature maps."""
from .. import functional as F
from .module import Module

__all__ = ["MaxPool2d", "AvgPool2d", "AdaptiveAvgPool2d", "AdaptiveMaxPool2d"]


class MaxPool2d(Module):
    """The largest value in each kernel_size window (stride defaults to kernel_size, halving 2×2 maps)."""

    def __init__(self, kernel_size, stride=None, padding=0, dilation=1, return_indices=False, ceil_mode=False):
        super().__init__()
        self.kernel_size = kernel_size
        self.stride = stride if (stride is not None) else kernel_size
        self.padding, self.dilation, self.return_indices, self.ceil_mode = padding, dilation, return_indices, ceil_mode

    def forward(self, input):
        return F.max_pool2d(input, self.kernel_size, self.stride, self.padding, self.dilation, ceil_mode=self.ceil_mode, return_indices=self.return_indices)

    def extra_repr(self):
        return f"kernel_size={self.kernel_size}, stride={self.stride}, padding={self.padding}, dilation={self.dilation}, ceil_mode={self.ceil_mode}"


class AvgPool2d(Module):
    """The average of each kernel_size window."""

    def __init__(self, kernel_size, stride=None, padding=0, ceil_mode=False, count_include_pad=True, divisor_override=None):
        super().__init__()
        self.kernel_size = kernel_size
        self.stride = stride if (stride is not None) else kernel_size
        self.padding, self.ceil_mode, self.count_include_pad, self.divisor_override = padding, ceil_mode, count_include_pad, divisor_override

    def forward(self, input):
        return F.avg_pool2d(input, self.kernel_size, self.stride, self.padding, self.ceil_mode, self.count_include_pad, self.divisor_override)

    def extra_repr(self):
        return f"kernel_size={self.kernel_size}, stride={self.stride}, padding={self.padding}"


class AdaptiveAvgPool2d(Module):
    """Averages down to a fixed output_size whatever the input size: AdaptiveAvgPool2d(1) is global average pooling."""

    def __init__(self, output_size):
        super().__init__()
        self.output_size = output_size

    def forward(self, input):
        return F.adaptive_avg_pool2d(input, self.output_size)

    def extra_repr(self):
        return f"output_size={self.output_size}"


class AdaptiveMaxPool2d(Module):
    def __init__(self, output_size, return_indices=False):
        super().__init__()
        self.output_size, self.return_indices = output_size, return_indices

    def forward(self, input):
        return F.adaptive_max_pool2d(input, self.output_size, self.return_indices)

    def extra_repr(self):
        return f"output_size={self.output_size}"


for _c in (MaxPool2d, AvgPool2d, AdaptiveAvgPool2d, AdaptiveMaxPool2d):
    _c.__module__ = "torch.nn.modules.pooling"
