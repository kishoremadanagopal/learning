"""Dropout: randomly zeroes elements during training only."""
from .. import functional as F
from .module import Module

__all__ = ["Dropout"]


class Dropout(Module):
    """During training, zeroes each element with probability p and scales the rest by 1 / (1 - p).
    In eval mode it does nothing."""

    def __init__(self, p=0.5, inplace=False):
        super().__init__()
        if p < 0 or p > 1:
            raise ValueError(f"dropout probability has to be between 0 and 1, but got {p}")
        self.p, self.inplace = p, inplace

    def forward(self, input):
        return F.dropout(input, self.p, self.training, self.inplace)

    def extra_repr(self):
        return f"p={self.p}, inplace={self.inplace}"


Dropout.__module__ = "torch.nn.modules.dropout"
