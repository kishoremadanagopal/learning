"""torch.save and torch.load. Since PyTorch 2.6, torch.load defaults to weights_only=True: it only unpickles
tensors, primitive types and containers, so a checkpoint can't run arbitrary code when you load it."""
import collections
import contextlib
import io
import os
import pickle

from . import _core, _utils

_MAGIC = b"PTSANDBOX1\n"
_SAFE = {
    ("torch._utils", "_rebuild_tensor_v2"), ("torch._utils", "_rebuild_parameter"),
    ("collections", "OrderedDict"), ("torch._core", "_dtype_by_name"), ("builtins", "set"), ("builtins", "frozenset"),
    ("builtins", "complex"), ("builtins", "slice"), ("builtins", "bytearray"), ("torch", "Size"),
}
_user_safe = {}


def add_safe_globals(safe_globals):
    for g in safe_globals:
        _user_safe[(g.__module__, g.__qualname__)] = g


def get_safe_globals():
    return list(_user_safe.values())


def clear_safe_globals():
    _user_safe.clear()


@contextlib.contextmanager
def safe_globals(safe_globals):
    saved = dict(_user_safe)
    add_safe_globals(safe_globals)
    try:
        yield
    finally:
        _user_safe.clear()
        _user_safe.update(saved)


class _WeightsUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        if (module, name) in _SAFE or (module, name) in _user_safe:
            return super().find_class(module, name)
        g = f"{module}.{name}"
        raise pickle.UnpicklingError(
            "Weights only load failed. This file can still be loaded, to do so you have two options, do those steps only if you trust the source of the checkpoint. \n"
            "\t(1) In PyTorch 2.6, we changed the default value of the `weights_only` argument in `torch.load` from `False` to `True`. Re-running `torch.load` with `weights_only` set to `False` will likely succeed, but it can result in arbitrary code execution. Do it only if you got the file from a trusted source.\n"
            "\t(2) Alternatively, to load with `weights_only=True` please check the recommended steps in the following error message.\n"
            f"\tWeightsUnpickler error: Unsupported global: GLOBAL {g} was not an allowed global by default. Please use `torch.serialization.add_safe_globals([{g}])` or the `torch.serialization.safe_globals([{g}])` context manager to allowlist this global if you trust this class/function.\n\n"
            "Check the documentation of torch.load to learn more about types accepted by default with weights_only https://pytorch.org/docs/stable/generated/torch.load.html.")


def save(obj, f, pickle_module=pickle, pickle_protocol=2, _use_new_zipfile_serialization=True):
    data = _MAGIC + pickle.dumps(obj, protocol=4)
    if isinstance(f, (str, os.PathLike)):
        with open(f, "wb") as fh:
            fh.write(data)
    else:
        f.write(data)


def load(f, map_location=None, pickle_module=None, *, weights_only=None, mmap=None, **pickle_load_args):
    if weights_only is None:
        weights_only = os.environ.get("TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD", "0") in ("0", "")
    if isinstance(f, (str, os.PathLike)):
        with open(f, "rb") as fh:
            data = fh.read()
    else:
        data = f.read()
    if not data.startswith(_MAGIC):
        raise pickle.UnpicklingError("invalid load key, '" + chr(data[0]) + "'." if data else "Ran out of input")
    body = io.BytesIO(data[len(_MAGIC):])
    _utils._LOAD_MAP[0] = map_location
    try:
        if weights_only:
            return _WeightsUnpickler(body).load()
        return pickle.Unpickler(body).load()
    finally:
        _utils._LOAD_MAP[0] = None
