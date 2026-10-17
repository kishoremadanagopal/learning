"""How tensors are pickled by torch.save. The names match PyTorch's (torch._utils._rebuild_tensor_v2 and
_rebuild_parameter), so torch.load's weights_only checks allow exactly these."""
import numpy as np

from . import _core


def _tensor_payload(t):
    a = np.array(t._a, order="C", copy=True)          # keeps 0-d tensors 0-d (ascontiguousarray would not)
    return (a.tobytes(), t.dtype.name, tuple(a.shape), str(t.device))


def _rebuild_tensor_v2(payload, requires_grad=False, map_location=None):
    raw, dtname, shape, dev = payload
    dt = _core._dtype_by_name(dtname)
    arr = np.frombuffer(raw, dtype=dt.np).reshape(shape).copy()
    dev = _map_device(dev, map_location)
    t = _core.Tensor._wrap(arr, dt, dev)
    if requires_grad:
        t.requires_grad = True
    return t


def _rebuild_parameter(payload, requires_grad=True, map_location=None):
    from .nn.parameter import Parameter
    return Parameter(_rebuild_tensor_v2(payload, False, map_location), requires_grad=requires_grad)


_LOAD_MAP = [None]


def _map_device(dev, map_location=None):
    loc = map_location if map_location is not None else _LOAD_MAP[0]
    if callable(loc) and not isinstance(loc, (str, _core.device)):
        loc = None
    if isinstance(loc, dict):
        loc = loc.get(dev, dev)
    if loc is not None:
        return _core._parse_device(loc)
    d = _core.device(dev)
    if d.type == "cuda" and not _core._GPU["available"]:
        raise RuntimeError("Attempting to deserialize object on a CUDA device but torch.cuda.is_available() is False. If you are running on a CPU-only machine, please use torch.load with map_location=torch.device('cpu') to map your storages to the CPU.")
    return _core._parse_device(d)
