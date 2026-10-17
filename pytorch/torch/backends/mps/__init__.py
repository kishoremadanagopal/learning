"""Apple-silicon GPUs (Metal Performance Shaders). The sandbox runs on Linux-style PyTorch, so MPS is not built."""


def is_available():
    return False


def is_built():
    return False
