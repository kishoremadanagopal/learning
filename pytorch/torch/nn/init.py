"""torch.nn.init: fill weights in place with the starting values training begins from."""
import math
import warnings

from .. import _core


def calculate_gain(nonlinearity, param=None):
    linear_fns = ["linear", "conv1d", "conv2d", "conv3d", "conv_transpose1d", "conv_transpose2d", "conv_transpose3d"]
    if nonlinearity in linear_fns or nonlinearity == "sigmoid":
        return 1
    if nonlinearity == "tanh":
        return 5.0 / 3
    if nonlinearity == "relu":
        return math.sqrt(2.0)
    if nonlinearity == "leaky_relu":
        negative_slope = 0.01 if param is None else param
        return math.sqrt(2.0 / (1 + negative_slope ** 2))
    if nonlinearity == "selu":
        return 3.0 / 4
    raise ValueError(f"Unsupported nonlinearity {nonlinearity}")


def _calculate_fan_in_and_fan_out(tensor):
    dimensions = tensor.dim()
    if dimensions < 2:
        raise ValueError("Fan in and fan out can not be computed for tensor with fewer than 2 dimensions")
    num_input_fmaps = tensor.size(1)
    num_output_fmaps = tensor.size(0)
    receptive_field_size = 1
    if tensor.dim() > 2:
        for s in tensor.shape[2:]:
            receptive_field_size *= s
    return num_input_fmaps * receptive_field_size, num_output_fmaps * receptive_field_size


def _fan(tensor, mode):
    mode = mode.lower()
    if mode not in ("fan_in", "fan_out"):
        raise ValueError(f"Mode {mode} not supported, please use one of fan_in, fan_out")
    fan_in, fan_out = _calculate_fan_in_and_fan_out(tensor)
    return fan_in if mode == "fan_in" else fan_out


def uniform_(tensor, a=0.0, b=1.0, generator=None):
    with _core.no_grad():
        return tensor.uniform_(a, b, generator=generator)


def normal_(tensor, mean=0.0, std=1.0, generator=None):
    with _core.no_grad():
        return tensor.normal_(mean, std, generator=generator)


def constant_(tensor, val):
    with _core.no_grad():
        return tensor.fill_(val)


def ones_(tensor):
    return constant_(tensor, 1.0)


def zeros_(tensor):
    return constant_(tensor, 0.0)


def eye_(tensor):
    if tensor.dim() != 2:
        raise ValueError("Only tensors with 2 dimensions are supported")
    with _core.no_grad():
        tensor.copy_(_core.eye(*tensor.shape, dtype=tensor.dtype))
    return tensor


def xavier_uniform_(tensor, gain=1.0, generator=None):
    fan_in, fan_out = _calculate_fan_in_and_fan_out(tensor)
    std = gain * math.sqrt(2.0 / float(fan_in + fan_out))
    a = math.sqrt(3.0) * std
    return uniform_(tensor, -a, a, generator)


def xavier_normal_(tensor, gain=1.0, generator=None):
    fan_in, fan_out = _calculate_fan_in_and_fan_out(tensor)
    std = gain * math.sqrt(2.0 / float(fan_in + fan_out))
    return normal_(tensor, 0.0, std, generator)


def kaiming_uniform_(tensor, a=0, mode="fan_in", nonlinearity="leaky_relu", generator=None):
    if 0 in tensor.shape:
        warnings.warn("Initializing zero-element tensors is a no-op")
        return tensor
    fan = _fan(tensor, mode)
    gain = calculate_gain(nonlinearity, a)
    std = gain / math.sqrt(fan)
    bound = math.sqrt(3.0) * std
    with _core.no_grad():
        return tensor.uniform_(-bound, bound, generator=generator)


def kaiming_normal_(tensor, a=0, mode="fan_in", nonlinearity="leaky_relu", generator=None):
    if 0 in tensor.shape:
        warnings.warn("Initializing zero-element tensors is a no-op")
        return tensor
    fan = _fan(tensor, mode)
    gain = calculate_gain(nonlinearity, a)
    std = gain / math.sqrt(fan)
    with _core.no_grad():
        return tensor.normal_(0, std, generator=generator)


def trunc_normal_(tensor, mean=0.0, std=1.0, a=-2.0, b=2.0, generator=None):
    with _core.no_grad():
        vals = tensor.normal_(mean, std, generator=generator)
        tensor._a[...] = vals._a.clip(a, b)
        return tensor
