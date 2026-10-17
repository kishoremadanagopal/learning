"""nn.Parameter: a tensor that a Module registers as one of its learnable weights."""
from .. import _core
from .._core import Tensor


class Parameter(Tensor):
    """A Tensor subclass that requires grad by default. Assigning one to a Module attribute registers it, so it
    appears in model.parameters() and state_dict(). It shares memory with the tensor it was made from."""

    def __new__(cls, data=None, requires_grad=True):
        if data is None:
            data = _core.empty(0)
        p = object.__new__(cls)
        p._init(data._a, data.dtype, data.device)
        p._version = data._version
        p._is_param = True
        if requires_grad:
            if not (p.dtype.is_floating_point or p.dtype.is_complex):
                raise RuntimeError("Only Tensors of floating point and complex dtype can require gradients")
            object.__setattr__(p, "requires_grad", True)
        if p.device.type == "cuda":
            _core._CUDA_TRACKER(p)
        return p

    def __init__(self, data=None, requires_grad=True):
        pass

    def __repr__(self):
        return "Parameter containing:\n" + super().__repr__()

    def __reduce_ex__(self, proto):
        from .._utils import _rebuild_parameter, _tensor_payload
        return (_rebuild_parameter, (_tensor_payload(self), self.requires_grad))

    def __deepcopy__(self, memo):
        if id(self) in memo:
            return memo[id(self)]
        t = Tensor._wrap(self._a.copy(), self.dtype, self.device)
        p = Parameter(t, requires_grad=self.requires_grad)
        if self.grad is not None:
            p.grad = Tensor._wrap(self.grad._a.copy(), self.grad.dtype, self.grad.device)
        memo[id(self)] = p
        return p


Parameter.__module__ = "torch.nn.parameter"


class Buffer(Tensor):
    """Marks a tensor to register as a buffer: saved in state_dict and moved by .to(), but not trained."""

    def __new__(cls, data=None, *, persistent=True):
        data = _core.empty(0) if data is None else data
        b = Tensor._wrap(data._a, data.dtype, data.device)
        b.persistent = persistent
        return b
