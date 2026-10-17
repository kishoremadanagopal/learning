"""torch.cuda in the sandbox: one pretend NVIDIA L4 GPU.

Tensors on 'cuda' live in your browser's memory like everything else, but they follow CUDA's rules: they print
with device='cuda:0', they can't mix with CPU tensors, .numpy() refuses them, and memory_allocated() counts
them in 512-byte blocks like PyTorch's caching allocator. Turn the GPU off with torch.cuda._sandbox_gpu(False)
to see what your code does on a machine without one."""
import weakref

from .. import _core

_seed = 0


def __getattr__(name):
    if name == "OutOfMemoryError":
        import torch
        return torch.OutOfMemoryError
    raise AttributeError(f"module 'torch.cuda' has no attribute '{name}'")
_live = {}              # id of the root numpy buffer -> [bytes, number of tensors using it]
_peak = [0]
_allocated = [0]


def _root(arr):
    while arr.base is not None and hasattr(arr.base, "base") and hasattr(arr.base, "nbytes"):
        arr = arr.base
    return arr


def _track(t):
    root = _root(t._a)
    key = id(root)
    entry = _live.get(key)
    if entry is None:
        size = -(-root.nbytes // 512) * 512 if root.nbytes else 0
        entry = _live[key] = [size, 0, root]
        _allocated[0] += size
        _peak[0] = max(_peak[0], _allocated[0])
    entry[1] += 1
    weakref.finalize(t, _release, key)


def _release(key):
    entry = _live.get(key)
    if entry is None:
        return
    entry[1] -= 1
    if entry[1] <= 0:
        _allocated[0] -= entry[0]
        del _live[key]


_core._CUDA_TRACKER = _track


def _sandbox_gpu(on=True):
    """Sandbox only: pretend this machine does (True) or doesn't (False) have a CUDA GPU."""
    _core._GPU["available"] = bool(on)


def is_available():
    return _core._GPU["available"]


def device_count():
    return 1 if is_available() else 0


def _lazy_check():
    if not is_available():
        raise AssertionError("Torch not compiled with CUDA enabled")


def current_device():
    _lazy_check()
    return 0


def set_device(device):
    _lazy_check()


def get_device_name(device=None):
    _lazy_check()
    return _core._GPU["name"]


def get_device_capability(device=None):
    _lazy_check()
    return _core._GPU["capability"]


class _CudaDeviceProperties:
    def __init__(self):
        g = _core._GPU
        self.name = g["name"]
        self.major, self.minor = g["capability"]
        self.total_memory = g["memory"]
        self.multi_processor_count = 58
        self.is_integrated = False
        self.is_multi_gpu_board = False

    def __repr__(self):
        return (f"_CudaDeviceProperties(name='{self.name}', major={self.major}, minor={self.minor}, "
                f"total_memory={self.total_memory // (1024 * 1024)}MB, multi_processor_count={self.multi_processor_count})")


def get_device_properties(device=None):
    _lazy_check()
    return _CudaDeviceProperties()


def is_bf16_supported(including_emulation=True):
    return is_available()


def synchronize(device=None):
    _lazy_check()


def memory_allocated(device=None):
    return _allocated[0]


def max_memory_allocated(device=None):
    return _peak[0]


def memory_reserved(device=None):
    return -(-_peak[0] // (2 * 1024 * 1024)) * 2 * 1024 * 1024


def reset_peak_memory_stats(device=None):
    _peak[0] = _allocated[0]


def empty_cache():
    pass


def mem_get_info(device=None):
    _lazy_check()
    total = _core._GPU["memory"]
    return (total - memory_reserved(), total)


def manual_seed(seed):
    global _seed
    _seed = int(seed)


manual_seed_all = manual_seed


def initial_seed():
    return _seed


def is_initialized():
    return is_available()


class device:
    def __init__(self, device):
        self.idx = device

    def __enter__(self):
        _lazy_check()

    def __exit__(self, *a):
        return False


class Event:
    """A CUDA event, for timing GPU work: record() marks a point, elapsed_time() reads milliseconds between two."""

    def __init__(self, enable_timing=False, blocking=False, interprocess=False):
        self.enable_timing = enable_timing
        self._t = None

    def record(self, stream=None):
        import time
        self._t = time.perf_counter()

    def synchronize(self):
        pass

    def query(self):
        return True

    def elapsed_time(self, end):
        if not (self.enable_timing and end.enable_timing):
            raise RuntimeError("Both events must be created with argument 'enable_timing=True'.")
        return (end._t - self._t) * 1000.0


class _AmpModule:
    """torch.cuda.amp: the old names, kept for compatibility (deprecated in favour of torch.amp)."""

    @staticmethod
    def autocast(enabled=True, dtype=None, cache_enabled=True):
        import warnings
        import torch
        warnings.warn("`torch.cuda.amp.autocast(args...)` is deprecated. Please use `torch.amp.autocast('cuda', args...)` instead.", FutureWarning, stacklevel=2)
        return torch.amp.autocast("cuda", dtype=dtype or torch.float16, enabled=enabled, cache_enabled=cache_enabled)

    @staticmethod
    def GradScaler(init_scale=2.0 ** 16, growth_factor=2.0, backoff_factor=0.5, growth_interval=2000, enabled=True):
        import warnings
        import torch
        warnings.warn("`torch.cuda.amp.GradScaler(args...)` is deprecated. Please use `torch.amp.GradScaler('cuda', args...)` instead.", FutureWarning, stacklevel=2)
        return torch.amp.GradScaler("cuda", init_scale, growth_factor, backoff_factor, growth_interval, enabled)


amp = _AmpModule()
