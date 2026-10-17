"""torch.amp: automatic mixed precision (autocast and GradScaler)."""
from .autocast_mode import autocast, is_autocast_available  # noqa: F401
from .grad_scaler import GradScaler, OptState  # noqa: F401

autocast.__module__ = "torch.amp.autocast_mode"
GradScaler.__module__ = "torch.amp.grad_scaler"
