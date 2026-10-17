"""torch.accelerator: one device-agnostic way to ask "is there a GPU-like device, and which kind?"
(CUDA, MPS, XPU…). In the sandbox the accelerator is the pretend CUDA GPU."""
from . import _core, cuda as _cuda


def is_available():
    return _cuda.is_available()


def current_accelerator(check_available=False):
    if check_available and not is_available():
        return None
    return _core.device("cuda")


def device_count():
    return _cuda.device_count()


def current_device_index():
    return 0


current_device_idx = current_device_index


def set_device_index(idx):
    pass


set_device_idx = set_device_index


def synchronize(device=None):
    _cuda.synchronize()


def memory_allocated(device=None):
    return _cuda.memory_allocated()


def max_memory_allocated(device=None):
    return _cuda.max_memory_allocated()


def empty_cache():
    pass
