"""The two fused kernels GradScaler relies on, written with plain tensor operations."""
import numpy as np


def non_finite_check_and_unscale_(grads, found_inf, inv_scale):
    """Multiply every gradient by inv_scale in place; set found_inf to 1 if any gradient holds inf or nan."""
    inv = inv_scale._a.astype(np.float32)
    for g in grads:
        if not np.isfinite(g._a).all():
            found_inf._a[...] = 1.0
        g._a[...] = (g._a * inv).astype(g._a.dtype)
        g._bump()


def update_scale_(scale, growth_tracker, found_inf, growth_factor, backoff_factor, growth_interval):
    """Back off after an overflow; otherwise grow the scale every growth_interval clean steps."""
    if float(found_inf._a) > 0:
        scale._a[...] = scale._a * np.float32(backoff_factor)
        growth_tracker._a[...] = 0
    else:
        successful = int(growth_tracker._a) + 1
        if successful == growth_interval:
            new = scale._a * np.float32(growth_factor)
            if np.isfinite(new):
                scale._a[...] = new
            growth_tracker._a[...] = 0
        else:
            growth_tracker._a[...] = successful
    return scale
