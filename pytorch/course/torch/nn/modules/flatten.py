"""nn.Flatten and nn.Unflatten."""
from .module import Module

__all__ = ["Flatten", "Unflatten"]


class Flatten(Module):
    """Flattens dims start_dim to end_dim (by default everything but the batch dim)."""

    def __init__(self, start_dim=1, end_dim=-1):
        super().__init__()
        self.start_dim, self.end_dim = start_dim, end_dim

    def forward(self, input):
        return input.flatten(self.start_dim, self.end_dim)

    def extra_repr(self):
        return f"start_dim={self.start_dim}, end_dim={self.end_dim}"


class Unflatten(Module):
    def __init__(self, dim, unflattened_size):
        super().__init__()
        self.dim, self.unflattened_size = dim, tuple(unflattened_size)

    def forward(self, input):
        return input.unflatten(self.dim, self.unflattened_size)

    def extra_repr(self):
        return f"dim={self.dim}, unflattened_size={self.unflattened_size}"


for _c in (Flatten, Unflatten):
    _c.__module__ = "torch.nn.modules.flatten"
