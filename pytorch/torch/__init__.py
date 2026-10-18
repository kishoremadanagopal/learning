"""The course sandbox's PyTorch: a teaching copy of PyTorch 2.14 written in Python on NumPy, so lessons run in
your browser. It follows real PyTorch's names, printing, rules and error messages for everything the course
uses. It is slower than real PyTorch and has no real GPU (torch.cuda is a pretend NVIDIA L4)."""
import math as _math

from . import _core
from ._core import *            # noqa: F401,F403
from ._core import (Tensor, Size, device, dtype, Generator, default_generator, no_grad, enable_grad,
                    set_grad_enabled, inference_mode, is_grad_enabled, is_inference_mode_enabled, finfo, iinfo,
                    strided, contiguous_format, channels_last, preserve_format, _bool, _int, _float)
from ._core import bool, float, int  # noqa: A004  (torch.bool, torch.float and torch.int shadow the builtins, as in PyTorch)
from ._tensor_str import set_printoptions, get_printoptions, printoptions
from . import cuda, backends, accelerator, autograd, serialization
from .serialization import save, load

__version__ = "2.14.1+sandbox"
version = type("version", (), {"__version__": __version__, "cuda": "13.0", "git_version": "sandbox", "debug": False})

inf, nan, pi, e = _math.inf, _math.nan, _math.pi, _math.e
float16, bfloat16, float32, float64 = _core.float16, _core.bfloat16, _core.float32, _core.float64
long, half, double = _core.int64, _core.float16, _core.float64


def get_default_device():
    return _core._CPU


def _method(name):
    def fn(input, *args, **kwargs):
        if not isinstance(input, Tensor):
            input = tensor(input)
        return getattr(Tensor, name)(input, *args, **kwargs)
    fn.__name__ = name
    return fn


for _name in ("abs", "absolute", "neg", "negative", "exp", "log", "log2", "log10", "log1p", "expm1", "sqrt", "rsqrt",
              "sin", "cos", "tan", "tanh", "sigmoid", "reciprocal", "square", "erf", "asin", "acos", "atan",
              "sinh", "cosh", "round", "floor", "ceil", "trunc", "frac", "sign", "relu", "clamp", "clip",
              "maximum", "minimum", "isnan", "isinf", "isfinite", "logical_not", "logical_and", "logical_or",
              "logical_xor", "lerp", "addcmul", "addcdiv", "nan_to_num", "add", "sub", "subtract", "mul", "multiply",
              "div", "divide", "true_divide", "floor_divide", "remainder", "pow", "sum", "mean", "var", "std", "prod",
              "nansum", "nanmean", "max", "min", "argmax", "argmin", "amax", "amin", "norm", "cumsum", "cumprod",
              "any", "all", "count_nonzero", "std_mean", "logsumexp", "softmax", "log_softmax", "sort", "argsort",
              "topk", "unique", "bincount", "allclose", "isclose", "equal", "dot", "inner", "mm", "bmm", "mv",
              "outer", "diag", "trace", "tril", "triu", "cross", "eq", "ne", "lt", "le", "gt", "ge", "reshape",
              "flatten", "unflatten", "ravel", "squeeze", "unsqueeze", "permute", "transpose", "swapaxes", "swapdims",
              "t", "flip", "narrow", "select", "index_select", "masked_fill", "masked_select", "nonzero", "argwhere",
              "clone", "repeat_interleave", "bitwise_and", "bitwise_or", "bitwise_xor", "bitwise_not"):
    globals()[_name] = _method(_name)
del _name


class OutOfMemoryError(RuntimeError):
    """Raised when the GPU runs out of memory ("CUDA out of memory")."""


_deterministic = [False]


def use_deterministic_algorithms(mode, *, warn_only=False):
    _deterministic[0] = bool(mode)


def are_deterministic_algorithms_enabled():
    return _deterministic[0]


@_core._autocast_op("fp32")
def cdist(x1, x2, p=2.0):
    diff = x1.unsqueeze(-2) - x2.unsqueeze(-3)
    if p == 2.0:
        return (diff ** 2).sum(-1).sqrt()
    return (diff.abs() ** p).sum(-1) ** (1.0 / p)


def numel(input):
    return input.numel()


def is_nonzero(input):
    return _bool(input)


def _sandbox_reset():
    """Sandbox only: put PyTorch back the way a fresh `python` process starts it (the runner calls this before each run)."""
    import gc
    from . import _tensor_str
    _core.default_generator.seed()          # like real PyTorch: a new random seed each run, until you call manual_seed
    _core._WARNED_ONCE.clear()
    cuda._seed = 0
    _core._default_dtype[0] = _core.float32
    _core._GradMode.enabled, _core._GradMode.inference = True, False
    _tensor_str.set_printoptions(profile="default")
    _core._GPU["available"] = True
    _deterministic[0] = False
    distributed._state.update(initialized=False, backend=None)
    _core._AUTOCAST["cuda"][:] = [False, _core.float16]
    _core._AUTOCAST["cpu"][:] = [False, _core.bfloat16]
    _matmul_precision[0] = "highest"
    backends.cuda.matmul.allow_tf32 = False
    gc.collect()
    cuda._peak[0] = cuda._allocated[0]


def is_autocast_enabled(device_type="cuda"):
    return _core._AUTOCAST.get(device_type, [False])[0]


def get_autocast_dtype(device_type):
    return _core._AUTOCAST[device_type][1]


def set_autocast_enabled(device_type, enabled):
    _core._AUTOCAST[device_type][0] = enabled


def set_autocast_dtype(device_type, dtype):
    _core._AUTOCAST[device_type][1] = dtype


def is_autocast_cache_enabled():
    return True


def set_autocast_cache_enabled(enabled):
    pass


def clear_autocast_cache():
    pass


def set_float32_matmul_precision(precision):
    """'highest' (pure float32), 'high' (TF32 or bf16-based on capable GPUs) or 'medium'. The sandbox records it."""
    if precision not in ("highest", "high", "medium"):
        raise RuntimeError(f"Invalid precision: {precision}")
    _matmul_precision[0] = precision
    backends.cuda.matmul.allow_tf32 = precision != "highest"


def get_float32_matmul_precision():
    return _matmul_precision[0]


_matmul_precision = ["highest"]

from . import amp  # noqa: E402
from .amp import autocast  # noqa: E402
from . import nn, optim, utils  # noqa: E402
from . import profiler  # noqa: E402
from . import compiler, _dynamo, distributed  # noqa: E402
from .distributed import fsdp as _fsdp  # noqa: E402,F401

_COMPILE_MODES = ["default", "lite", "reduce-overhead", "max-autotune-no-cudagraphs", "max-autotune"]


def compile(model=None, *, fullgraph=False, dynamic=None, backend="inductor", mode=None, options=None, disable=False):
    """Optimise a model or function: in real PyTorch, TorchDynamo captures its operations as a graph and TorchInductor
    generates fused kernels for it on the first call. The sandbox checks the arguments like PyTorch and returns the
    same kind of object, but runs the original code (same results, no speed-up)."""
    if model is None:
        def fn(model):
            return compile(model, fullgraph=fullgraph, dynamic=dynamic, backend=backend, mode=mode, options=options, disable=disable)
        return fn
    if mode is not None and options is not None:
        raise RuntimeError("Either mode or options can be specified, but both can't be specified at the same time.")
    if mode is not None and mode not in _COMPILE_MODES:
        raise RuntimeError(f"Unrecognized mode={mode}, should be one of: {', '.join(_COMPILE_MODES)}")
    if isinstance(backend, str) and backend not in compiler._BACKENDS + compiler._DEBUG_BACKENDS:
        raise _dynamo.InvalidBackend(f"Invalid backend: '{backend}'. See `torch._dynamo.list_backends()` for available backends.")
    if disable:
        return model
    if isinstance(model, nn.Module):
        return _dynamo.OptimizedModule(model)
    import functools

    @functools.wraps(model)
    def compiled(*args, **kwargs):
        return model(*args, **kwargs)
    return compiled
_core._PROFILER_HOOK[0] = profiler._backward_range


def _accept_python_dtypes():
    """Like PyTorch, accept Python's int, float and bool wherever a dtype goes: dtype=int means torch.int64,
    float means torch.float64 and bool means torch.bool (as in torch.zeros(2, dtype=int) or x.to(float))."""
    import builtins
    import functools
    import inspect
    py = {builtins.int: int64, builtins.float: float64, builtins.bool: bool}

    def fix(fn, positional=False):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            d = kwargs.get("dtype")
            if isinstance(d, type) and d in py:
                kwargs["dtype"] = py[d]
            if positional:
                args = tuple(py[a] if isinstance(a, type) and a in py else a for a in args)
            return fn(*args, **kwargs)
        return wrapper

    def takes_dtype(fn):
        try:
            return "dtype" in inspect.signature(fn).parameters
        except (TypeError, ValueError):
            return False

    g = globals()
    for name, obj in list(g.items()):
        if inspect.isfunction(obj) and not name.startswith("_") and takes_dtype(obj):
            g[name] = fix(obj)
    for name, obj in list(vars(_core.Tensor).items()):
        if inspect.isfunction(obj) and (name in ("to", "type") or takes_dtype(obj)):
            setattr(_core.Tensor, name, fix(obj, positional=name in ("to", "type")))


_accept_python_dtypes()

for _junk in ("np", "math", "numbers", "warnings", "namedtuple", "builtins", "MT19937", "Node", "AccumulateGrad"):
    globals().pop(_junk, None)
del _junk
