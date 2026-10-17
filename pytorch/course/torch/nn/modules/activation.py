"""Activation layers."""
from .. import functional as F
from .module import Module

__all__ = ["ReLU", "ReLU6", "LeakyReLU", "ELU", "GELU", "SiLU", "Sigmoid", "Tanh", "Softmax", "LogSoftmax", "Softplus", "Hardtanh"]


class ReLU(Module):
    def __init__(self, inplace=False):
        super().__init__()
        self.inplace = inplace

    def forward(self, input):
        return F.relu(input, inplace=self.inplace)

    def extra_repr(self):
        return "inplace=True" if self.inplace else ""


class ReLU6(ReLU):
    def forward(self, input):
        return F.relu6(input)


class Hardtanh(Module):
    def __init__(self, min_val=-1.0, max_val=1.0, inplace=False):
        super().__init__()
        self.min_val, self.max_val, self.inplace = min_val, max_val, inplace

    def forward(self, input):
        return F.hardtanh(input, self.min_val, self.max_val)

    def extra_repr(self):
        return f"min_val={self.min_val}, max_val={self.max_val}"


class LeakyReLU(Module):
    def __init__(self, negative_slope=0.01, inplace=False):
        super().__init__()
        self.negative_slope, self.inplace = negative_slope, inplace

    def forward(self, input):
        return F.leaky_relu(input, self.negative_slope, self.inplace)

    def extra_repr(self):
        return f"negative_slope={self.negative_slope}" + (", inplace=True" if self.inplace else "")


class ELU(Module):
    def __init__(self, alpha=1.0, inplace=False):
        super().__init__()
        self.alpha, self.inplace = alpha, inplace

    def forward(self, input):
        return F.elu(input, self.alpha)

    def extra_repr(self):
        return f"alpha={self.alpha}" + (", inplace=True" if self.inplace else "")


class GELU(Module):
    def __init__(self, approximate="none"):
        super().__init__()
        self.approximate = approximate

    def forward(self, input):
        return F.gelu(input, approximate=self.approximate)

    def extra_repr(self):
        return f"approximate={self.approximate!r}"


class SiLU(Module):
    def __init__(self, inplace=False):
        super().__init__()
        self.inplace = inplace

    def forward(self, input):
        return F.silu(input)

    def extra_repr(self):
        return "inplace=True" if self.inplace else ""


class Sigmoid(Module):
    def forward(self, input):
        return input.sigmoid()


class Tanh(Module):
    def forward(self, input):
        return input.tanh()


class Softplus(Module):
    def __init__(self, beta=1.0, threshold=20.0):
        super().__init__()
        self.beta, self.threshold = beta, threshold

    def forward(self, input):
        return F.softplus(input, self.beta, self.threshold)

    def extra_repr(self):
        return f"beta={self.beta}, threshold={self.threshold}"


class Softmax(Module):
    def __init__(self, dim=None):
        super().__init__()
        self.dim = dim

    def forward(self, input):
        return F.softmax(input, self.dim, _stacklevel=5)

    def extra_repr(self):
        return f"dim={self.dim}"


class LogSoftmax(Module):
    def __init__(self, dim=None):
        super().__init__()
        self.dim = dim

    def forward(self, input):
        return F.log_softmax(input, self.dim, _stacklevel=5)

    def extra_repr(self):
        return f"dim={self.dim}"


for _n in __all__:
    globals()[_n].__module__ = "torch.nn.modules.activation"
