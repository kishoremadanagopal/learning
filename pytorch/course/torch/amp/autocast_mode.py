"""torch.autocast: run chosen operations in a lower precision (float16 or bfloat16) inside a context.

As in PyTorch, matrix multiplications, linear layers and convolutions cast their floating-point inputs (except
float64) to the autocast dtype, while numerically sensitive operations (on CUDA: softmax, sums, exponentials,
logs, norms and losses; on the CPU: losses, prod and cdist) run in float32. Everything else runs in whatever
dtype its inputs have."""
import functools
import warnings

import torch
from .. import _core

_STATE = _core._AUTOCAST


def is_autocast_available(device_type):
    return device_type in ("cuda", "cpu", "mps", "xpu")


class autocast:
    """with torch.autocast(device_type="cuda", dtype=torch.float16): ..."""

    def __init__(self, device_type, dtype=None, enabled=True, cache_enabled=None):
        if not isinstance(device_type, str):
            raise ValueError(f"Expected `device_type` of type `str`, got: `{type(device_type)}`")
        self.fast_dtype = torch.get_autocast_dtype(device_type) if dtype is None else dtype
        self.device = device_type
        if not is_autocast_available(self.device) or device_type not in _STATE:
            raise RuntimeError(f"User specified an unsupported autocast device_type '{self.device}'")
        self._cache_enabled = True if cache_enabled is None else cache_enabled
        if enabled:
            if self.device == "cuda":
                if not torch.cuda.is_available():
                    warnings.warn("CUDA is not available or torch_xla is imported. Disabling autocast.", stacklevel=2)
                    enabled = False
            elif self.fast_dtype not in (torch.bfloat16, torch.float16):
                warnings.warn(f"In {self.device.upper()} autocast, but the target dtype is not supported. Disabling autocast.\n"
                              f"{self.device.upper()} Autocast only supports dtypes of torch.bfloat16, torch.float16 currently.", stacklevel=2)
                enabled = False
        self._enabled = enabled

    def __enter__(self):
        self.prev = list(_STATE[self.device])
        _STATE[self.device][0] = self._enabled
        _STATE[self.device][1] = self.fast_dtype
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        _STATE[self.device][:] = self.prev
        return False

    def __call__(self, func):
        @functools.wraps(func)
        def decorate_autocast(*args, **kwargs):
            with self:
                return func(*args, **kwargs)
        return decorate_autocast
