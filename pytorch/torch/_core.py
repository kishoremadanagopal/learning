"""The heart of the sandbox's PyTorch: dtypes, devices, torch.Size, Tensor and autograd, on top of NumPy.

It follows PyTorch 2.14's rules where a learner can see them: type promotion, broadcasting, views that share
memory, error messages, how tensors print, the random number generator, and gradients. It is a teaching
simulation: real PyTorch runs C++ and CUDA kernels; this runs NumPy in your browser."""
import builtins
import math
import numbers
import warnings
from collections import namedtuple

import numpy as np

from ._mt import MT19937

_bool, _int, _float, _slice, _max, _min, _sum, _abs, _round, _all, _any = (
    builtins.bool, builtins.int, builtins.float, builtins.slice, builtins.max, builtins.min, builtins.sum,
    builtins.abs, builtins.round, builtins.all, builtins.any)


# ---------------------------------------------------------------- dtypes

class dtype:
    __slots__ = ("name", "np", "is_floating_point", "is_complex", "is_signed", "itemsize", "_rank", "_kind")

    def __init__(self, name, np_dtype, kind, rank, itemsize, signed=True):
        self.name, self.np, self._kind, self._rank, self.itemsize = name, np.dtype(np_dtype), kind, rank, itemsize
        self.is_floating_point = kind == "f"
        self.is_complex = kind == "c"
        self.is_signed = signed

    def __repr__(self):
        return "torch." + self.name

    def __reduce__(self):
        return (_dtype_by_name, (self.name,))

    def to_real(self):
        return {"complex64": float32, "complex128": float64}.get(self.name, self)


bool = dtype("bool", np.bool_, "b", 0, 1, False)
uint8 = dtype("uint8", np.uint8, "i", 1, 1, False)
int8 = dtype("int8", np.int8, "i", 1, 1)
int16 = dtype("int16", np.int16, "i", 2, 2)
int32 = dtype("int32", np.int32, "i", 3, 4)
int64 = dtype("int64", np.int64, "i", 4, 8)
float16 = dtype("float16", np.float16, "f", 1, 2)
bfloat16 = dtype("bfloat16", np.float32, "f", 1, 2)        # stored as float32, rounded to bfloat16's 8-bit mantissa
float32 = dtype("float32", np.float32, "f", 3, 4)
float64 = dtype("float64", np.float64, "f", 4, 8)
complex64 = dtype("complex64", np.complex64, "c", 3, 8)
complex128 = dtype("complex128", np.complex128, "c", 4, 16)
half, float, double, short, int, long, cfloat, cdouble = float16, float32, float64, int16, int32, int64, complex64, complex128
_DTYPES = [bool, uint8, int8, int16, int32, int64, float16, bfloat16, float32, float64, complex64, complex128]
def _dtype_by_name(n):
    return {d.name: d for d in _DTYPES}[n]
_default_dtype = [float32]


def get_default_dtype():
    return _default_dtype[0]


def set_default_dtype(d):
    if not isinstance(d, dtype) or not d.is_floating_point:
        raise TypeError("only floating-point types are supported as the default type")
    _default_dtype[0] = d


def _from_np(npd):
    npd = np.dtype(npd)
    for d in _DTYPES:
        if d.np == npd and d is not bfloat16:
            return d
    if npd.kind == "U" or npd.kind == "O":
        raise TypeError(f"can't convert np.ndarray of type numpy.{'str_' if npd.kind == 'U' else 'object_'}. The only supported types are: float64, float32, float16, complex64, complex128, int64, int32, int16, int8, uint64, uint32, uint16, uint8, and bool.")
    raise TypeError(f"Got unsupported ScalarType {npd}")


def promote_types(a, b):
    if a is b:
        return a
    if a is bool:
        return b
    if b is bool:
        return a
    ka, kb = a._kind, b._kind
    if ka == "c" or kb == "c":
        r = _max(a._rank if ka == "c" else (4 if a is float64 else 3), b._rank if kb == "c" else (4 if b is float64 else 3))
        return complex128 if r == 4 else complex64
    if ka == "f" and kb == "f":
        if {a, b} == {float16, bfloat16}:
            return float32
        return a if a._rank >= b._rank else b
    if ka == "f":
        return a
    if kb == "f":
        return b
    # two integer types
    if a is uint8 or b is uint8:
        other = b if a is uint8 else a
        return int16 if other is int8 else other
    return a if a._rank >= b._rank else b


_CAT = {"b": 0, "i": 1, "f": 2, "c": 3}


def _result_type(*xs):
    """torch.result_type for operands: tensors with dims, zero-dim tensors, and Python numbers."""
    dim_t = zero_t = wrapped_t = None
    for x in xs:
        if isinstance(x, Tensor):
            if x.dim() > 0:
                dim_t = x.dtype if dim_t is None else promote_types(dim_t, x.dtype)
            else:
                zero_t = x.dtype if zero_t is None else promote_types(zero_t, x.dtype)
        else:
            t = _scalar_dtype(x)
            wrapped_t = t if wrapped_t is None else promote_types(wrapped_t, t)
    res = dim_t
    for other in (zero_t, wrapped_t):
        if other is None:
            continue
        if res is None:
            res = other
        elif _CAT[other._kind] > _CAT[res._kind]:
            if other is wrapped_t and other._kind == "f":
                res = get_default_dtype()
            elif other is wrapped_t and other._kind == "c":
                res = complex128 if get_default_dtype() is float64 else complex64
            else:
                res = other
    if res is None:
        res = get_default_dtype()
    return res


def _scalar_dtype(x):
    if isinstance(x, (_bool, np.bool_)):
        return bool
    if isinstance(x, (numbers.Integral, np.integer)):
        return int64
    if isinstance(x, (numbers.Real, np.floating)):
        return float64          # a wrapped Python float: its category counts, not its precision
    if isinstance(x, numbers.Complex):
        return complex128
    raise TypeError(f"unsupported operand type: {type(x).__name__}")


def _round_bf16(a):
    a = np.asarray(a, dtype=np.float32)
    u = a.view(np.uint32).astype(np.uint64)
    rounded = ((u + np.uint64(0x7FFF) + ((u >> np.uint64(16)) & np.uint64(1))) & np.uint64(0xFFFF0000)).astype(np.uint32)
    out = rounded.view(np.float32)
    return np.where(np.isnan(a), a, out)


def _cast(arr, d):
    """numpy array -> storage for dtype d"""
    if d is bfloat16:
        return _round_bf16(np.asarray(arr, dtype=np.float32))
    with np.errstate(all="ignore"):
        if d._kind == "i" and np.asarray(arr).dtype.kind == "f":
            a = np.asarray(arr)
            return np.trunc(np.nan_to_num(a, nan=0.0, posinf=0.0, neginf=0.0)).astype(d.np)
        return np.asarray(arr).astype(d.np, copy=False)


# ---------------------------------------------------------------- devices

class device:
    __slots__ = ("type", "index")

    def __init__(self, type, index=None):
        if isinstance(type, device):
            self.type, self.index = type.type, type.index
            return
        if isinstance(type, _int):
            type, index = "cuda", type
        if not isinstance(type, str):
            raise TypeError(f"device() received an invalid combination of arguments - got ({type.__class__.__name__})")
        if ":" in type:
            type, idx = type.split(":", 1)
            if not idx.isdigit():
                raise RuntimeError(f"Invalid device string: '{type}:{idx}'")
            index = _int(idx)
        if type not in ("cpu", "cuda", "mps", "meta", "xpu"):
            raise RuntimeError(f"Expected one of cpu, cuda, ipu, xpu, mkldnn, opengl, opencl, ideep, hip, ve, fpga, maia, xla, lazy, vulkan, mps, meta, hpu, mtia, privateuseone device type at start of device string: {type}")
        self.type, self.index = type, index

    def __repr__(self):
        return f"device(type='{self.type}')" if self.index is None else f"device(type='{self.type}', index={self.index})"

    def __str__(self):
        return self.type if self.index is None else f"{self.type}:{self.index}"

    def __eq__(self, other):
        return isinstance(other, device) and (self.type, self.index) == (other.type, other.index)

    def __hash__(self):
        return hash((self.type, self.index))


_CPU = device("cpu")
_CUDA_TRACKER = lambda t: None          # replaced by torch.cuda to count GPU memory
_GPU = {"available": True, "name": "NVIDIA L4", "memory": 23034 * 1024 * 1024, "capability": (8, 9)}   # the sandbox's pretend GPU


def _parse_device(d):
    if d is None:
        return _CPU
    dev = device(d) if not isinstance(d, device) else d
    if dev.type == "cuda":
        if not _GPU["available"]:
            raise AssertionError("Torch not compiled with CUDA enabled")
        idx = 0 if dev.index is None else dev.index
        if idx >= 1:
            raise RuntimeError("CUDA error: invalid device ordinal\nCUDA kernel errors might be asynchronously reported at some other API call, so the stacktrace below might be incorrect.\nFor debugging consider passing CUDA_LAUNCH_BLOCKING=1\nCompile with `TORCH_USE_CUDA_DSA` to enable device-side assertions.\n")
        return device("cuda", idx)
    if dev.type == "mps":
        raise NotImplementedError("Could not run 'aten::empty.memory_format' with arguments from the 'MPS' backend. This could be because the operator doesn't exist for this backend, or was omitted during the selective/custom build process (if using custom build).")
    if dev.type == "cpu":
        return _CPU
    return dev


class Size(tuple):
    def __repr__(self):
        return f"torch.Size([{', '.join(str(x) for x in self)}])"

    __str__ = __repr__

    def numel(self):
        n = 1
        for s in self:
            n *= s
        return n

    def __getitem__(self, i):
        r = tuple.__getitem__(self, i)
        return Size(r) if isinstance(i, _slice) else r

    def __add__(self, other):
        return Size(tuple(self) + tuple(other))


# ---------------------------------------------------------------- grad mode

_WARNED_ONCE = set()
_PROFILER_HOOK = [None]          # set by torch.profiler


class _GradMode:
    enabled = True
    inference = False


def is_grad_enabled():
    return _GradMode.enabled


def is_inference_mode_enabled():
    return _GradMode.inference


class _DecoratorContextManager:
    def __call__(self, fn):
        import functools

        @functools.wraps(fn)
        def wrapper(*a, **k):
            with self.__class__(*self._args):
                return fn(*a, **k)
        return wrapper


class no_grad(_DecoratorContextManager):
    _args = ()

    def __init__(self):
        self.prev = None

    def __enter__(self):
        self.prev = _GradMode.enabled
        _GradMode.enabled = False

    def __exit__(self, *a):
        _GradMode.enabled = self.prev


class enable_grad(_DecoratorContextManager):
    _args = ()

    def __enter__(self):
        self.prev = _GradMode.enabled
        _GradMode.enabled = True

    def __exit__(self, *a):
        _GradMode.enabled = self.prev


class set_grad_enabled(_DecoratorContextManager):
    def __init__(self, mode):
        self._args = (mode,)
        self.prev = _GradMode.enabled
        _GradMode.enabled = _bool(mode)

    def __enter__(self):
        pass

    def __exit__(self, *a):
        _GradMode.enabled = self.prev


class inference_mode(_DecoratorContextManager):
    def __init__(self, mode=True):
        self._args = (mode,)
        self.mode = mode

    def __enter__(self):
        self.prev = (_GradMode.enabled, _GradMode.inference)
        if self.mode:
            _GradMode.enabled, _GradMode.inference = False, True

    def __exit__(self, *a):
        _GradMode.enabled, _GradMode.inference = self.prev


# ---------------------------------------------------------------- random numbers

class Generator:
    def __init__(self, device="cpu"):
        self.device = _parse_device(device)
        self._mt = MT19937()

    def manual_seed(self, seed):
        self._mt.seed(seed)
        return self

    def initial_seed(self):
        return self._mt.initial_seed

    def seed(self):
        import random
        s = random.getrandbits(64)
        self._mt.seed(s)
        return s

    def get_state(self):
        return _RNGState(self._mt.get_state())

    def set_state(self, st):
        self._mt.set_state(st._st)
        return self


class _RNGState:
    def __init__(self, st):
        self._st = st


default_generator = Generator()
default_generator.seed()                 # PyTorch picks a fresh random seed at start-up


def manual_seed(seed):
    seed = _int(seed)
    default_generator.manual_seed(seed)
    from . import cuda as _cuda
    _cuda._seed = seed
    return default_generator


def seed():
    return default_generator.seed()


def initial_seed():
    return default_generator.initial_seed()


def get_rng_state():
    return default_generator.get_state()


def set_rng_state(st):
    default_generator.set_state(st)


def _gen(generator):
    return (generator or default_generator)._mt


# ---------------------------------------------------------------- autograd graph

class Node:
    """One step of the backward graph: what grad_fn shows."""
    _name = "Node"

    def __init__(self, inputs, backward, saved=()):
        self._inputs = inputs                      # the input tensors (or None) the gradients flow to
        self._backward = backward                  # grad_output (np) -> tuple of np grads, one per input
        self._saved = [(t, t._version[0], None) for t in saved if isinstance(t, Tensor)]   # None: name the tensor's grad_fn at backward time
        if _any(t._inference for t, _, _ in self._saved):
            raise RuntimeError("Inference tensors cannot be saved for backward. Please do not use Tensors created in inference mode in computation tracked by autograd. To work around this, you can make a clone to get a normal tensor and use it in autograd, or use `torch.no_grad()` instead of `torch.inference_mode()`.")
        self._freed = False
        self.metadata = {}
        self._hooks = []
        self.next_functions = tuple((_edge(t), 0) if t is not None else (None, 0) for t in inputs)

    def name(self):
        return self._name

    def __repr__(self):
        return f"<{self._name} object at 0x{id(self) & 0xFFFFFFFFFFFF:012x}>"

    def register_hook(self, fn):
        self._hooks.append(fn)


class AccumulateGrad(Node):
    _name = "AccumulateGrad"

    def name(self):
        return "torch::autograd::AccumulateGrad"

    def __init__(self, variable):
        self.variable = variable
        self._inputs, self._saved, self._freed, self.next_functions, self.metadata, self._hooks = (), [], False, (), {}, []


def _edge(t):
    if not isinstance(t, Tensor) or not t.requires_grad:
        return None
    if t.grad_fn is not None:
        return t.grad_fn
    if t._accumulator is None:
        t._accumulator = AccumulateGrad(t)
    return t._accumulator


_node_classes = {}


def _node_class(name):
    cls = _node_classes.get(name)
    if cls is None:
        cls = type(name, (Node,), {"_name": name})
        _node_classes[name] = cls
    return cls


def _make_result(arr, dt, inputs, name, backward, saved=(), dev=None, save_out=False):
    """Wrap a numpy result as a Tensor and, if grad mode is on and an input requires grad, attach its grad_fn.
    saved lists the inputs the backward formula reads (save_out: it reads the output), so that changing one of
    them in place before backward() raises PyTorch's "modified by an inplace operation" error."""
    out = Tensor._wrap(arr, dt, dev if dev is not None else _first_device(inputs))
    if _GradMode.enabled and _any(isinstance(t, Tensor) and t.requires_grad for t in inputs):
        if not (dt.is_floating_point or dt.is_complex):
            return out              # integer results (argmax, comparisons, rounding to int) don't carry gradients
        object.__setattr__(out, "requires_grad", True)
        node = _node_class(name)(inputs, backward, saved)
        if save_out:
            node._saved.append((out, out._version[0], name))
        out.grad_fn = node
    return out


def _first_device(inputs):
    for t in inputs:
        if isinstance(t, Tensor):
            return t.device
    return _CPU


def _unbroadcast(g, shape):
    """Sum a gradient back down to the shape of an input that was broadcast."""
    if g.shape == tuple(shape):
        return g
    while g.ndim > len(shape):
        g = g.sum(axis=0)
    for i, s in enumerate(shape):
        if s == 1 and g.shape[i] != 1:
            g = g.sum(axis=i, keepdims=True)
    return g.reshape(shape)


def _run_backward(roots, grads, retain_graph=False, inputs=None):
    """The autograd engine: walk the graph from the roots, add up gradients per node, and accumulate into leaves.
    With inputs= (torch.autograd.grad), return the gradients for those tensors instead of accumulating."""
    # order the nodes so each one runs after every node that sends it a gradient
    order, seen = [], set()
    stack = [(r.grad_fn if r.grad_fn is not None else _edge(r), False) for r in roots]
    while stack:
        node, done = stack.pop()
        if node is None:
            continue
        if done:
            order.append(node)
            continue
        if id(node) in seen:
            continue
        seen.add(id(node))
        stack.append((node, True))
        for nxt, _ in node.next_functions:
            if nxt is not None and id(nxt) not in seen:
                stack.append((nxt, False))
    order.reverse()
    pending = {}
    for r, g in zip(roots, grads):
        node = r.grad_fn if r.grad_fn is not None else _edge(r)
        pending[id(node)] = pending.get(id(node), 0) + g
    wanted = {id(_edge(t)): None for t in inputs} if inputs is not None else None
    captured = {}
    for node in order:
        g = pending.pop(id(node), None)
        if g is None:
            continue
        for h in node._hooks:
            r = h(Tensor._wrap(np.asarray(g), _from_np(np.asarray(g).dtype)))
        if wanted is not None and id(node) in wanted:
            captured[id(node)] = g
            if isinstance(node, AccumulateGrad):
                continue
        if isinstance(node, AccumulateGrad):
            v = node.variable
            gt = np.asarray(g, dtype=v._a.dtype).reshape(v._a.shape)
            for h in v._hooks:
                r = h(Tensor._wrap(gt.copy(), v.dtype, v.device))
                if r is not None:
                    gt = r._a
            if v.grad is None:
                v.grad = Tensor._wrap(gt.copy(), v.dtype, v.device)
            else:
                v.grad._a = v.grad._a + gt
            continue
        if node._freed:
            raise RuntimeError("Trying to backward through the graph a second time (or directly access saved tensors after they have already been freed). Saved intermediate values of the graph are freed when you call .backward() or autograd.grad(). Specify retain_graph=True if you need to backward through the graph a second time or if you need to access saved tensors after calling backward.")
        for t, ver, made_by in node._saved:
            if t._version[0] != ver:
                shape = "[" + ", ".join(str(s) for s in t.shape) + "]"
                kind = {"float32": "FloatTensor", "float64": "DoubleTensor", "float16": "HalfTensor", "bfloat16": "BFloat16Tensor", "int64": "LongTensor"}.get(t.dtype.name, "Tensor")
                made_by = made_by or (t.grad_fn._name if t.grad_fn is not None else None)
                which = f", which is output 0 of {__import__('re').sub(r'Backward[0-9]+$', '', made_by)}," if made_by is not None else ""
                raise RuntimeError(f"one of the variables needed for gradient computation has been modified by an inplace operation: [torch.{kind} {shape}]{which} is at version {t._version[0]}; expected version {ver} instead. Hint: enable anomaly detection to find the operation that failed to compute its gradient, with torch.autograd.set_detect_anomaly(True, check_nan=False).")
        rng = _PROFILER_HOOK[0](node._name) if _PROFILER_HOOK[0] is not None else None
        if rng is not None:
            rng[0].__enter__(); rng[1].__enter__()
        try:
            with np.errstate(all="ignore"):            # inf/nan gradients are reported by the caller, not by NumPy
                in_grads = node._backward(g)
        finally:
            if rng is not None:
                rng[1].__exit__(); rng[0].__exit__()
        if not retain_graph:
            node._freed = True
        for (nxt, _), ig, inp in zip(node.next_functions, in_grads, node._inputs):
            if nxt is None or ig is None:
                continue
            if isinstance(inp, Tensor) and inp.dtype in (bfloat16, float16):     # low-precision gradients are rounded
                ig = _cast(np.asarray(ig, dtype=np.float32), inp.dtype)
            pending[id(nxt)] = pending.get(id(nxt), 0) + ig
        # tensors that asked to keep their gradient (retain_grad)
        for t in getattr(node, "_retainers", ()):
            pass
    if inputs is not None:
        return [captured.get(id(_edge(t))) for t in inputs]
    return None


# ---------------------------------------------------------------- Tensor

def _np_of(x):
    return x._a if isinstance(x, Tensor) else x


def _device_check(*xs):
    devs = [x.device for x in xs if isinstance(x, Tensor) and x.dim() > 0]
    zero = [x.device for x in xs if isinstance(x, Tensor) and x.dim() == 0]
    devs_set = []
    for d in devs:
        if d not in devs_set:
            devs_set.append(d)
    if len(devs_set) > 1:
        names = sorted({str(d) for d in devs_set}, key=lambda s: (s == "cpu", s))
        raise RuntimeError(f"Expected all tensors to be on the same device, but found at least two devices, {names[0]} and {names[1]}!")
    dev = devs_set[0] if devs_set else (zero[0] if zero else _CPU)
    for z in zero:          # a 0-dim CPU tensor may combine with tensors on any device
        if z != dev and z.type != "cpu" and dev.type == "cpu" and devs:
            raise RuntimeError(f"Expected all tensors to be on the same device, but found at least two devices, {z} and {dev}!")
    return dev


class Tensor:
    __array_priority__ = 1000

    def __init__(self, *args, **kw):
        # torch.Tensor(2, 3) makes an uninitialised float tensor; torch.Tensor([1, 2]) copies data as float32
        if len(args) == 1 and not isinstance(args[0], _int):
            src = tensor(args[0], dtype=get_default_dtype())
            self._init(src._a, src.dtype, _CPU)
        else:
            shape = tuple(args)
            self._init(np.zeros(shape, dtype=np.float32), float32, _CPU)

    def _init(self, arr, dt, dev):
        self._a = arr
        self._dtype = dt
        self._device = dev
        self.requires_grad = False
        self.grad = None
        self.grad_fn = None
        self._accumulator = None
        self._version = [0]
        self._base = None
        self._retains = False
        self._hooks = []
        self._is_param = False
        self._inference = False
        self.name = None

    @classmethod
    def _wrap(cls, arr, dt, dev=_CPU, base=None):
        t = object.__new__(cls)
        if not isinstance(arr, np.ndarray):
            arr = np.asarray(arr)
        if arr.dtype != dt.np or dt is bfloat16:
            arr = _cast(arr, dt)
        t._init(arr, dt, dev)
        if _GradMode.inference:
            t._inference = True
        if dev.type == "cuda":
            _CUDA_TRACKER(t)
        if base is not None:
            t._base = base
            t._version = base._version            # views share their base's version counter
        return t

    # ---- basic properties
    @property
    def dtype(self):
        return self._dtype

    @property
    def device(self):
        return self._device

    @property
    def is_cuda(self):
        return self._device.type == "cuda"

    @property
    def is_cpu(self):
        return self._device.type == "cpu"

    @property
    def is_mps(self):
        return self._device.type == "mps"

    @property
    def is_meta(self):
        return self._device.type == "meta"

    @property
    def is_sparse(self):
        return False

    @property
    def layout(self):
        return strided

    @property
    def shape(self):
        return Size(self._a.shape)

    @property
    def ndim(self):
        return self._a.ndim

    @property
    def data(self):
        t = Tensor._wrap(self._a, self.dtype, self.device, base=self)
        return t

    @data.setter
    def data(self, other):
        moved = other.device != self._device
        self._a = other._a
        self._dtype = other.dtype
        self._device = other.device
        if moved and other.device.type == "cuda":
            _CUDA_TRACKER(self)

    @property
    def is_leaf(self):
        return self.grad_fn is None

    @property
    def itemsize(self):
        return self.dtype.itemsize

    @property
    def nbytes(self):
        return self.numel() * self.dtype.itemsize

    @property
    def T(self):
        if self.dim() != 2 and "T" not in _WARNED_ONCE:        # a C++ TORCH_WARN_ONCE: once per process
            _WARNED_ONCE.add("T")
            warnings.warn("The use of `x.T` on tensors of dimension other than 2 to reverse their shape is deprecated and it will throw an error in a future release. Consider `x.mT` to transpose batches of matrices or `x.permute(*torch.arange(x.ndim - 1, -1, -1))` to reverse the dimensions of a tensor. (Triggered internally at /__w/pytorch/pytorch/aten/src/ATen/native/TensorShape.cpp:4320.)", UserWarning, stacklevel=2)
        return self.permute(*reversed(range(self.dim())))

    @property
    def mT(self):
        if self.dim() < 2:
            raise RuntimeError(f"tensor.mT is only supported on matrices or batches of matrices. Got {self.dim()}-D tensor.")
        return self.transpose(-2, -1)

    def size(self, dim=None):
        if dim is None:
            return self.shape
        return self._a.shape[self._dim(dim)]

    def dim(self):
        return self._a.ndim

    ndimension = dim

    def numel(self):
        return _int(self._a.size)

    nelement = numel

    def element_size(self):
        return self.dtype.itemsize

    def stride(self, dim=None):
        st = tuple(s // self._a.itemsize for s in self._a.strides) if self._a.size else self._contig_strides()
        return st if dim is None else st[self._dim(dim)]

    def _contig_strides(self):
        out, acc = [], 1
        for s in reversed(self._a.shape):
            out.append(acc)
            acc *= _max(s, 1)
        return tuple(reversed(out))

    def is_contiguous(self, memory_format=None):
        return _bool(self._a.flags["C_CONTIGUOUS"]) or self._a.size <= 1

    def storage_offset(self):
        return 0

    def data_ptr(self):
        return self._a.__array_interface__["data"][0]

    def untyped_storage(self):
        return _Storage(self)

    def get_device(self):
        return -1 if self.device.type == "cpu" else (self.device.index or 0)

    def _dim(self, d, n=None):
        n = self.dim() if n is None else n
        lo, hi = (-n, n - 1) if n > 0 else (-1, 0)
        if not isinstance(d, (_int, np.integer)) or isinstance(d, _bool):
            raise TypeError(f"dim must be an int, not {type(d).__name__}")
        if d < lo or d > hi:
            raise IndexError(f"Dimension out of range (expected to be in range of [{lo}, {hi}], but got {d})")
        return d % n if n > 0 else 0

    # ---- printing
    def __repr__(self, *, tensor_contents=None):
        from ._tensor_str import _str
        return _str(self, tensor_contents=tensor_contents)

    def __str__(self):
        return self.__repr__()

    def __format__(self, spec):
        if self.dim() == 0 and not self.is_meta:
            return self.item().__format__(spec)
        return object.__format__(self, spec) if spec else self.__repr__()

    def type(self, dtype=None):
        if dtype is None:
            names = {"float32": "FloatTensor", "float64": "DoubleTensor", "float16": "HalfTensor", "bfloat16": "BFloat16Tensor", "int64": "LongTensor", "int32": "IntTensor", "int16": "ShortTensor", "int8": "CharTensor", "uint8": "ByteTensor", "bool": "BoolTensor", "complex64": "ComplexFloatTensor", "complex128": "ComplexDoubleTensor"}
            return ("torch.cuda." if self.is_cuda else "torch.") + names[self.dtype.name]
        if isinstance(dtype, str):
            dtype = {"torch.FloatTensor": float32, "torch.DoubleTensor": float64, "torch.LongTensor": int64, "torch.IntTensor": int32}[dtype]
        return self.to(dtype)

    # ---- conversion
    def item(self):
        if self.numel() != 1:
            raise RuntimeError(f"a Tensor with {self.numel()} elements cannot be converted to Scalar")
        if self.is_meta:
            raise RuntimeError("Tensor.item() cannot be called on meta tensors")
        v = self._a.reshape(-1)[0]
        return v.item()

    def tolist(self):
        if self.dim() == 0:
            return self.item()
        return self._a.tolist()

    def numpy(self, *, force=False):
        if self.is_cuda and not force:
            raise TypeError(f"can't convert {self.device} device type tensor to numpy. Use Tensor.cpu() to copy the tensor to host memory first.")
        if self.requires_grad and not force:
            raise RuntimeError("Can't call numpy() on Tensor that requires grad. Use tensor.detach().numpy() instead.")
        if self.dtype is bfloat16:
            raise TypeError("Got unsupported ScalarType BFloat16")
        return self._a if not force else self._a.copy()

    def __array__(self, dtype=None, copy=None):
        if self.requires_grad:
            raise RuntimeError("Can't call numpy() on Tensor that requires grad. Use tensor.detach().numpy() instead.")
        if self.is_cuda:
            raise TypeError(f"can't convert {self.device} device type tensor to numpy. Use Tensor.cpu() to copy the tensor to host memory first.")
        return self._a if dtype is None else self._a.astype(dtype)

    def __bool__(self):
        if self.numel() == 0:
            raise RuntimeError("Boolean value of Tensor with no values is ambiguous")
        if self.numel() > 1:
            raise RuntimeError("Boolean value of Tensor with more than one value is ambiguous")
        return _bool(self.item())

    def __float__(self):
        return _float(self.item())

    def __int__(self):
        return _int(self.item())

    def __index__(self):
        if self.dtype._kind not in "ib" or self.numel() != 1:
            raise TypeError("only integer tensors of a single element can be converted to an index")
        return _int(self.item())

    def __complex__(self):
        return complex(self.item())

    def __len__(self):
        if self.dim() == 0:
            raise TypeError("len() of a 0-d tensor")
        return self._a.shape[0]

    def __iter__(self):
        if self.dim() == 0:
            raise TypeError("iteration over a 0-d tensor")
        return (self[i] for i in range(self._a.shape[0]))

    def __hash__(self):
        return id(self)

    def __reduce_ex__(self, proto):
        from ._utils import _rebuild_tensor_v2, _tensor_payload
        return (_rebuild_tensor_v2, (_tensor_payload(self), self.requires_grad))

    def __deepcopy__(self, memo):
        t = Tensor._wrap(self._a.copy(), self.dtype, self.device)
        t.requires_grad = self.requires_grad
        if self.grad is not None:
            t.grad = Tensor._wrap(self.grad._a.copy(), self.grad.dtype, self.grad.device)
        memo[id(self)] = t
        return t

    # ---- autograd
    def backward(self, gradient=None, retain_graph=None, create_graph=False, inputs=None):
        if not self.requires_grad:
            raise RuntimeError("element 0 of tensors does not require grad and does not have a grad_fn")
        if create_graph:
            raise RuntimeError("The sandbox's PyTorch doesn't build graphs of gradients (create_graph=True): try higher-order gradients on your own computer.")
        if gradient is None:
            if self.numel() != 1:
                raise RuntimeError("grad can be implicitly created only for scalar outputs")
            g = np.ones(self._a.shape, dtype=self._a.dtype)
        else:
            g = np.broadcast_to(_np_of(gradient), self._a.shape).astype(self._a.dtype)
        _run_backward([self], [g], retain_graph=_bool(retain_graph))
        self._fill_retained()

    def _fill_retained(self):
        pass

    def retain_grad(self):
        if not self.requires_grad:
            raise RuntimeError("can't retain_grad on Tensor that has requires_grad=False")
        if self.grad_fn is None:
            return
        self._retains = True
        node = self.grad_fn
        me = self
        orig = node._backward

        def backward(g, orig=orig):
            gt = np.asarray(g, dtype=me._a.dtype).reshape(me._a.shape)
            if me.grad is None:
                me.grad = Tensor._wrap(gt.copy(), me.dtype, me.device)
            else:
                me.grad._a = me.grad._a + gt
            return orig(g)
        node._backward = backward

    @property
    def retains_grad(self):
        return self._retains

    def register_hook(self, hook):
        if not self.requires_grad:
            raise RuntimeError("cannot register a hook on a tensor that doesn't require gradient")
        if self.grad_fn is None:
            self._hooks.append(hook)
        else:
            node = self.grad_fn
            orig = node._backward

            def backward(g, orig=orig):
                r = hook(Tensor._wrap(np.asarray(g).copy(), self.dtype, self.device))
                return orig(r._a if r is not None else g)
            node._backward = backward
        return _RemovableHandle()

    def is_inference(self):
        return self._inference

    def requires_grad_(self, requires_grad=True):
        if requires_grad and self._inference and not _GradMode.inference:
            raise RuntimeError("Setting requires_grad=True on inference tensor outside InferenceMode is not allowed.")
        if requires_grad and not (self.dtype.is_floating_point or self.dtype.is_complex):
            raise RuntimeError("only Tensors of floating point dtype can require gradients")
        if self.grad_fn is not None and not requires_grad:
            raise RuntimeError("you can only change requires_grad flags of leaf variables. If you want to use a computed variable in a subgraph that doesn't require differentiation use var_no_grad = var.detach().")
        self.requires_grad = requires_grad
        return self

    def detach(self):
        return Tensor._wrap(self._a, self.dtype, self.device, base=self)

    def detach_(self):
        self.grad_fn = None
        self.requires_grad = False
        return self

    def __setattr__(self, name, value):
        if name == "requires_grad" and value and self.__dict__.get("_inference") and not _GradMode.inference:
            raise RuntimeError("Setting requires_grad=True on inference tensor outside InferenceMode is not allowed.")
        if name == "requires_grad" and value and getattr(self, "_dtype", None) is not None and not (self._dtype.is_floating_point or self._dtype.is_complex):
            raise RuntimeError("only Tensors of floating point and complex dtype can require gradients")
        if name == "requires_grad" and getattr(self, "grad_fn", None) is not None and not value and "_dtype" in self.__dict__:
            raise RuntimeError("you can only change requires_grad flags of leaf variables. If you want to use a computed variable in a subgraph that doesn't require differentiation use var_no_grad = var.detach().")
        if name == "grad" and value is not None and "_a" in self.__dict__:
            if not isinstance(value, Tensor):
                raise TypeError(f"assigned grad expected to be a Tensor or None but got grad of type {type(value).__name__}")
            if tuple(value.shape) != tuple(self.shape):
                raise RuntimeError(f"attempting to assign a gradient of size '[{', '.join(map(str, value.shape))}]' to a tensor of size '[{', '.join(map(str, self.shape))}]'. Please ensure that the gradient and the tensor are the same size")
        object.__setattr__(self, name, value)

    def __getattribute__(self, name):
        if name == "grad":
            d = object.__getattribute__(self, "__dict__")
            if d.get("grad_fn") is not None and not d.get("_retains") and d.get("requires_grad"):
                warnings.warn("The .grad attribute of a Tensor that is not a leaf Tensor is being accessed. Its .grad attribute won't be populated during autograd.backward(). If you indeed want the .grad field to be populated for a non-leaf Tensor, use .retain_grad() on the non-leaf Tensor. If you access the non-leaf Tensor by mistake, make sure you access the leaf Tensor instead. See github.com/pytorch/pytorch/pull/30531 for more information. (Triggered internally at /__w/pytorch/pytorch/build/aten/src/ATen/core/TensorBody.h:488.)", UserWarning, stacklevel=2)
        return object.__getattribute__(self, name)

    # ---- moving between devices and types
    def to(self, *args, **kw):
        dev, dt = None, None
        non_blocking = kw.pop("non_blocking", False)
        copy = kw.pop("copy", False)
        kw.pop("memory_format", None)
        for a in args:
            if isinstance(a, dtype):
                dt = a
            elif isinstance(a, (str, device)):
                dev = a
            elif isinstance(a, Tensor):
                dev, dt = a.device, a.dtype
            elif isinstance(a, _int) and not isinstance(a, _bool):
                dev = device("cuda", a)
            elif isinstance(a, _bool):
                non_blocking = a
        dev = kw.pop("device", dev)
        dt = kw.pop("dtype", dt)
        if kw:
            raise TypeError(f"to() received an invalid combination of arguments - got unexpected keyword argument '{next(iter(kw))}'")
        new_dev = _parse_device(dev) if dev is not None else self.device
        new_dt = dt or self.dtype
        if new_dev == self.device and new_dt is self.dtype and not copy:
            return self
        arr = _cast(self._a, new_dt) if new_dt is not self.dtype else self._a.copy()
        if arr is self._a:
            arr = arr.copy()
        src_dt = self.dtype

        def bw(g):
            return (_cast(g, src_dt),)
        name = "ToCopyBackward0"
        return _make_result(arr, new_dt, [self], name, bw, dev=new_dev)

    def cuda(self, device=None, non_blocking=False):
        return self.to(_parse_device("cuda" if device is None else (f"cuda:{device}" if isinstance(device, _int) else device)))

    def cpu(self):
        return self.to("cpu")

    def float(self):
        return self.to(float32)

    def double(self):
        return self.to(float64)

    def half(self):
        return self.to(float16)

    def bfloat16(self):
        return self.to(bfloat16)

    def long(self):
        return self.to(int64)

    def int(self):
        return self.to(int32)

    def short(self):
        return self.to(int16)

    def bool(self):
        return self.to(bool)

    def byte(self):
        return self.to(uint8)

    def char(self):
        return self.to(int8)

    def type_as(self, other):
        return self.to(other.dtype)

    def clone(self, memory_format=None):
        return _make_result(self._a.copy(), self.dtype, [self], "CloneBackward0", lambda g: (g,))

    def contiguous(self, memory_format=None):
        if self.is_contiguous():
            return self
        return _make_result(np.ascontiguousarray(self._a), self.dtype, [self], "CloneBackward0", lambda g: (g,))

    def share_memory_(self):
        return self

    def new_tensor(self, data, dtype=None, device=None, requires_grad=False):
        return tensor(data, dtype=dtype or self.dtype, device=device or self.device, requires_grad=requires_grad)

    def new_zeros(self, *size, dtype=None, device=None, requires_grad=False):
        return zeros(*size, dtype=dtype or self.dtype, device=device or self.device, requires_grad=requires_grad)

    def new_ones(self, *size, dtype=None, device=None, requires_grad=False):
        return ones(*size, dtype=dtype or self.dtype, device=device or self.device, requires_grad=requires_grad)

    def new_full(self, size, fill_value, dtype=None, device=None, requires_grad=False):
        return full(size, fill_value, dtype=dtype or self.dtype, device=device or self.device, requires_grad=requires_grad)

    def new_empty(self, *size, dtype=None, device=None, requires_grad=False):
        return empty(*size, dtype=dtype or self.dtype, device=device or self.device, requires_grad=requires_grad)

    # ---- in-place helpers
    def _check_inplace(self):
        if self.requires_grad and self.grad_fn is None and _GradMode.enabled:
            raise RuntimeError("a leaf Variable that requires grad is being used in an in-place operation.")

    def _bump(self):
        self._version[0] += 1

    def _inplace(self, result):
        """Copy result (a Tensor) into self, keeping autograd connected."""
        self._check_inplace()
        if result.dtype is not self.dtype:
            if _CAT[result.dtype._kind] > _CAT[self.dtype._kind]:
                raise RuntimeError(f"result type {result.dtype.name.capitalize().replace('Float32', 'Float').replace('Float64', 'Double')} can't be cast to the desired output type {_tname(self.dtype)}")
        arr = _cast(result._a, self.dtype)
        try:
            np.copyto(self._a, np.broadcast_to(arr, self._a.shape), casting="unsafe")
        except ValueError:
            raise RuntimeError(f"output with shape [{', '.join(map(str, self.shape))}] doesn't match the broadcast shape [{', '.join(map(str, result.shape))}]") from None
        self._bump()
        if result.requires_grad and _GradMode.enabled:
            self.requires_grad = True
            self.grad_fn = result.grad_fn
        return self

    # ---- indexing
    def _index_np(self, idx):
        def conv(i):
            if isinstance(i, Tensor):
                if i.dtype is bool:
                    return i._a
                if i.dtype._kind == "i":
                    return i._a.astype(np.int64)
                raise IndexError("tensors used as indices must be long, int, byte or bool tensors")
            if isinstance(i, list) and i and _any(isinstance(x, Tensor) for x in i):
                return np.array([_int(x) for x in i])
            return i
        if isinstance(idx, tuple):
            return tuple(conv(i) for i in idx)
        return conv(idx)

    def __getitem__(self, idx):
        npidx = self._index_np(idx)
        try:
            out = self._a[npidx]
        except IndexError as e:
            msg = str(e)
            m = __import__("re").match(r"index (-?\d+) is out of bounds for axis (\d+) with size (\d+)", msg)
            if m:
                raise IndexError(f"index {m.group(1)} is out of bounds for dimension {m.group(2)} with size {m.group(3)}") from None
            if "too many indices" in msg:
                raise IndexError(f"too many indices for tensor of dimension {self.dim()}") from None
            raise IndexError(msg) from None
        is_view = isinstance(out, np.ndarray) and out.base is not None and np.shares_memory(out, self._a) if isinstance(out, np.ndarray) else False
        if not isinstance(out, np.ndarray):
            out = np.asarray(out)
            is_view = False
        shape = self._a.shape
        dt = self.dtype

        def bw(g):
            full_g = np.zeros(shape, dtype=np.asarray(g).dtype)
            np.add.at(full_g, npidx, g)
            return (full_g,)
        if is_view or out.ndim == 0 and _basic_index(idx):
            t = _make_result(out, dt, [self], _index_name(idx), bw)
            if is_view:
                t._base = self
                t._version = self._version
            return t
        return _make_result(out, dt, [self], "IndexBackward0", bw)

    def __setitem__(self, idx, value):
        if self.requires_grad and self.grad_fn is None and _GradMode.enabled:
            raise RuntimeError("a view of a leaf Variable that requires grad is being used in an in-place operation.")
        npidx = self._index_np(idx)
        v = value._a if isinstance(value, Tensor) else value
        if isinstance(value, Tensor) and value.device != self.device and value.dim() > 0:
            raise RuntimeError(f"Expected all tensors to be on the same device, but found at least two devices, {_cuda_first(value.device, self.device)}!")
        try:
            self._a[npidx] = _cast(np.asarray(v), self.dtype) if not isinstance(v, (_int, _float, _bool)) else v
        except ValueError as e:
            raise RuntimeError(str(e)) from None
        self._bump()
        if _GradMode.enabled and (self.requires_grad or isinstance(value, Tensor) and value.requires_grad):
            if not isinstance(value, Tensor):
                value = Tensor._wrap(np.asarray(v), self.dtype, self.device)
            prev = self.grad_fn
            vshape = value._a.shape

            def bw(g):
                gv = np.asarray(g)[npidx]
                g2 = np.array(g, copy=True)
                g2[npidx] = 0
                return (g2, _unbroadcast(gv, vshape))
            self.requires_grad = True
            src = Tensor._wrap(self._a, self.dtype, self.device)
            src.grad_fn, src.requires_grad = prev, prev is not None
            node = _node_class("CopySlices")([src if prev is not None else None, value], bw)
            node.name = lambda: "torch::autograd::CopySlices"
            self.grad_fn = node

    # ---- shape
    def view(self, *shape):
        if len(shape) == 1 and isinstance(shape[0], dtype):
            return Tensor._wrap(self._a.view(shape[0].np), shape[0], self.device, base=self)
        shape = _shape_arg(shape)
        shape = self._infer_shape(shape)
        v = self._viewed(shape)
        if v is None:
            raise RuntimeError("view size is not compatible with input tensor's size and stride (at least one dimension spans across two contiguous subspaces). Use .reshape(...) instead.")
        orig = self._a.shape
        t = _make_result(v, self.dtype, [self], "ViewBackward0", lambda g: (np.asarray(g).reshape(orig),))
        t._base, t._version = self, self._version
        return t

    def _infer_shape(self, shape):
        shape = list(shape)
        n = self.numel()
        if shape.count(-1) > 1:
            raise RuntimeError("only one dimension can be inferred")
        if -1 in shape:
            known = 1
            for s in shape:
                if s != -1:
                    known *= s
            if known == 0 or n % known:
                raise RuntimeError(f"shape '[{', '.join(map(str, shape))}]' is invalid for input of size {n}")
            shape[shape.index(-1)] = n // known
        if np.prod(shape, dtype=np.int64) != n:
            raise RuntimeError(f"shape '[{', '.join(map(str, shape))}]' is invalid for input of size {n}")
        return tuple(_int(s) for s in shape)

    def _viewed(self, shape):
        """The array in the new shape without copying, or None when the strides don't allow it (PyTorch's rule)."""
        v = self._a.view()
        try:
            v.shape = shape
        except AttributeError:
            return None
        return v

    def reshape(self, *shape):
        shape = self._infer_shape(_shape_arg(shape))
        if self._viewed(shape) is not None:
            return self.view(*shape)
        orig = self._a.shape
        return _make_result(np.ascontiguousarray(self._a).reshape(shape), self.dtype, [self], "UnsafeViewBackward0", lambda g: (np.asarray(g).reshape(orig),))

    def view_as(self, other):
        return self.view(*other.shape)

    def reshape_as(self, other):
        return self.reshape(*other.shape)

    def flatten(self, start_dim=0, end_dim=-1):
        if self.dim() == 0:
            return self.reshape(1)
        s, e = self._dim(start_dim), self._dim(end_dim)
        if s > e:
            raise RuntimeError("flatten() has invalid args: start_dim cannot come after end_dim")
        shape = self.shape
        new = list(shape[:s]) + [_int(np.prod(shape[s:e + 1], dtype=np.int64))] + list(shape[e + 1:])
        return self.reshape(*new)

    def unflatten(self, dim, sizes):
        d = self._dim(dim)
        shape = list(self.shape)
        return self.reshape(*(shape[:d] + list(sizes) + shape[d + 1:]))

    def ravel(self):
        return self.reshape(-1)

    def squeeze(self, dim=None):
        shape = self._a.shape
        if dim is None:
            new = tuple(s for s in shape if s != 1)
        else:
            dims = dim if isinstance(dim, (tuple, list)) else (dim,)
            ds = {self._dim(x) for x in dims} if self.dim() else set()
            new = tuple(s for i, s in enumerate(shape) if not (i in ds and s == 1))
        t = _make_result(self._a.reshape(new), self.dtype, [self], "SqueezeBackward0" if dim is None else "SqueezeBackward1", lambda g: (np.asarray(g).reshape(shape),))
        t._base, t._version = self, self._version
        return t

    def unsqueeze(self, dim):
        d = self._dim(dim, self.dim() + 1)
        shape = self._a.shape
        t = _make_result(np.expand_dims(self._a, d), self.dtype, [self], "UnsqueezeBackward0", lambda g: (np.asarray(g).reshape(shape),))
        t._base, t._version = self, self._version
        return t

    def permute(self, *dims):
        dims = _shape_arg(dims)
        if len(dims) != self.dim():
            raise RuntimeError(f"permute(sparse_coo): number of dimensions in the tensor input does not match the length of the desired ordering of dimensions i.e. input.dim() = {self.dim()} is not equal to len(dims) = {len(dims)}")
        dims = tuple(self._dim(d) for d in dims)
        if len(set(dims)) != len(dims):
            raise RuntimeError("permute(): duplicate dims are not allowed.")
        inv = tuple(np.argsort(dims))
        t = _make_result(self._a.transpose(dims), self.dtype, [self], "PermuteBackward0", lambda g: (np.asarray(g).transpose(inv),))
        t._base, t._version = self, self._version
        return t

    def transpose(self, dim0, dim1):
        d0, d1 = self._dim(dim0), self._dim(dim1)
        axes = list(range(self.dim()))
        axes[d0], axes[d1] = axes[d1], axes[d0]
        t = _make_result(self._a.transpose(axes), self.dtype, [self], "TransposeBackward0", lambda g: (np.asarray(g).transpose(axes),))
        t._base, t._version = self, self._version
        return t

    swapaxes = swapdims = transpose

    def t(self):
        if self.dim() > 2:
            raise RuntimeError(f"t() expects a tensor with <= 2 dimensions, but self is {self.dim()}D")
        if self.dim() < 2:
            t = _make_result(self._a, self.dtype, [self], "TBackward0", lambda g: (g,))
        else:
            t = _make_result(self._a.T, self.dtype, [self], "TBackward0", lambda g: (np.asarray(g).T,))
        t._base, t._version = self, self._version
        return t

    def expand(self, *sizes):
        sizes = _shape_arg(sizes)
        shape = self._a.shape
        lead = len(sizes) - len(shape)
        if lead < 0:
            raise RuntimeError(f"expand(torch.FloatTensor{{[{', '.join(map(str, shape))}]}}, size=[{', '.join(map(str, sizes))}]): the number of sizes provided ({len(sizes)}) must be greater or equal to the number of dimensions in the tensor ({len(shape)})")
        target = []
        for i, s in enumerate(sizes):
            if i < lead:
                target.append(s)
            else:
                cur = shape[i - lead]
                if s == -1:
                    target.append(cur)
                elif cur != 1 and cur != s:
                    raise RuntimeError(f"The expanded size of the tensor ({s}) must match the existing size ({cur}) at non-singleton dimension {i}.  Target sizes: [{', '.join(map(str, sizes))}].  Tensor sizes: [{', '.join(map(str, shape))}]")
                else:
                    target.append(s)
        t = _make_result(np.broadcast_to(self._a, target), self.dtype, [self], "ExpandBackward0", lambda g: (_unbroadcast(np.asarray(g), shape),))
        t._base, t._version = self, self._version
        return t

    def expand_as(self, other):
        return self.expand(*other.shape)

    def repeat(self, *sizes):
        sizes = _shape_arg(sizes)
        if len(sizes) < self.dim():
            raise RuntimeError("Number of dimensions of repeat dims can not be smaller than number of dimensions of tensor")
        a = self._a.reshape((1,) * (len(sizes) - self.dim()) + self._a.shape)
        shape = self._a.shape

        def bw(g):
            g = np.asarray(g)
            rs = []
            for r, s in zip(sizes, a.shape):
                rs += [r, s]
            return (g.reshape(rs).sum(axis=tuple(range(0, len(rs), 2))).reshape(shape),)
        return _make_result(np.tile(a, sizes), self.dtype, [self], "RepeatBackward0", bw)

    def repeat_interleave(self, repeats, dim=None):
        r = repeats._a if isinstance(repeats, Tensor) else repeats
        if dim is None:
            return Tensor._wrap(np.repeat(self._a.reshape(-1), r), self.dtype, self.device)
        return Tensor._wrap(np.repeat(self._a, r, axis=self._dim(dim)), self.dtype, self.device)

    def flip(self, *dims):
        dims = _shape_arg(dims)
        ax = tuple(self._dim(d) for d in dims)
        return _make_result(np.flip(self._a, ax).copy(), self.dtype, [self], "FlipBackward0", lambda g: (np.flip(np.asarray(g), ax),))

    def narrow(self, dim, start, length):
        d = self._dim(dim)
        idx = [_slice(None)] * self.dim()
        idx[d] = _slice(start, start + length)
        return self[tuple(idx)]

    def split(self, split_size, dim=0):
        return split(self, split_size, dim)

    def chunk(self, chunks, dim=0):
        return chunk(self, chunks, dim)

    def unbind(self, dim=0):
        d = self._dim(dim)
        return tuple(self.select(d, i) for i in range(self.shape[d]))

    def select(self, dim, index):
        d = self._dim(dim)
        idx = [_slice(None)] * self.dim()
        idx[d] = index
        return self[tuple(idx)]

    def index_select(self, dim, index):
        d = self._dim(dim)
        ix = index._a.astype(np.int64)
        shape = self._a.shape

        def bw(g):
            full_g = np.zeros(shape, dtype=np.asarray(g).dtype)
            np.add.at(np.moveaxis(full_g, d, 0), ix, np.moveaxis(np.asarray(g), d, 0))
            return (full_g,)
        return _make_result(np.take(self._a, ix, axis=d), self.dtype, [self], "IndexSelectBackward0", bw)

    def gather(self, dim, index):
        return gather(self, dim, index)

    def masked_fill(self, mask, value):
        v = value.item() if isinstance(value, Tensor) else value
        m = np.broadcast_to(mask._a, self._a.shape)
        return _make_result(np.where(m, _cast(np.asarray(v), self.dtype), self._a), self.dtype, [self], "MaskedFillBackward0", lambda g: (np.where(m, 0, g),))

    def masked_fill_(self, mask, value):
        return self._inplace(self.masked_fill(mask, value))

    def masked_select(self, mask):
        return self[mask]

    def nonzero(self, as_tuple=False):
        nz = np.nonzero(self._a)
        if as_tuple:
            return tuple(Tensor._wrap(x.astype(np.int64), int64, self.device) for x in nz)
        return Tensor._wrap(np.stack(nz, axis=1).astype(np.int64) if nz else np.zeros((0, 0), np.int64), int64, self.device)

    def argwhere(self):
        return self.nonzero()

    def where(self, condition, other):
        return where(condition, self, other)

    # ---- in-place fills
    def fill_(self, value):
        self._check_inplace()
        v = value.item() if isinstance(value, Tensor) else value
        self._a[...] = v
        self._bump()
        return self

    def zero_(self):
        return self.fill_(0)

    def copy_(self, src, non_blocking=False):
        self._check_inplace()
        s = src._a if isinstance(src, Tensor) else np.asarray(src)
        np.copyto(self._a, np.broadcast_to(_cast(s, self.dtype), self._a.shape), casting="unsafe")
        self._bump()
        if isinstance(src, Tensor) and src.requires_grad and _GradMode.enabled:
            self.requires_grad = True
            self.grad_fn = _node_class("CopyBackwards")([src], lambda g: (_unbroadcast(np.asarray(g), src._a.shape),))
        return self

    def uniform_(self, a=0.0, b=1.0, generator=None):
        self._check_inplace()
        self._a[...] = _gen(generator).uniform(self.numel(), a, b, double=self.dtype is float64).reshape(self._a.shape)
        self._bump()
        return self

    def normal_(self, mean=0.0, std=1.0, generator=None):
        self._check_inplace()
        self._a[...] = _gen(generator).normal(self.numel(), mean, std, float32=self.dtype is not float64).reshape(self._a.shape)
        self._bump()
        return self

    def random_(self, *args, generator=None):
        self._check_inplace()
        g = _gen(generator)
        if not args:
            if self.dtype is int64:
                vals = [g.random_int64() for _ in range(self.numel())]
            else:
                vals = g.randint(self.numel(), 0, 2 ** {"float32": 24, "float64": 53, "int32": 31, "int16": 15, "int8": 7, "uint8": 8, "bool": 1}.get(self.dtype.name, 24))
            self._a[...] = np.array(vals).reshape(self._a.shape)
        else:
            lo, hi = (0, args[0]) if len(args) == 1 else args
            self._a[...] = g.randint(self.numel(), lo, hi).reshape(self._a.shape)
        self._bump()
        return self

    def pin_memory(self, device=None):
        if self.device.type != "cpu":
            raise RuntimeError(f"cannot pin '{self.type()}' only dense CPU tensors can be pinned")
        t = Tensor._wrap(self._a.copy(), self.dtype, self.device)
        t._pinned = True
        return t

    def is_pinned(self, device=None):
        return _bool(self.__dict__.get("_pinned", False))

    def bernoulli_(self, p=0.5, generator=None):
        self._check_inplace()
        self._a[...] = (_gen(generator).uniform(self.numel()).reshape(self._a.shape) < p)
        self._bump()
        return self

    def exponential_(self, lambd=1.0, generator=None):
        u = _gen(generator).uniform(self.numel(), double=True)
        self._a[...] = (-np.log1p(-u) / lambd).reshape(self._a.shape)
        self._bump()
        return self

    # ---- reductions and the rest are attached below
    def __array_ufunc__(self, ufunc, method, *inputs, **kw):
        return NotImplemented

    def apply_(self, fn):
        flat = self._a.reshape(-1)
        for i in range(flat.size):
            flat[i] = fn(flat[i].item())
        self._bump()
        return self

    def map_(self, other, fn):
        flat, o = self._a.reshape(-1), np.broadcast_to(other._a, self._a.shape).reshape(-1)
        for i in range(flat.size):
            flat[i] = fn(flat[i].item(), o[i].item())
        return self

    def has_names(self):
        return False

    def is_floating_point(self):
        return self.dtype.is_floating_point

    def is_complex(self):
        return self.dtype.is_complex

    def is_signed(self):
        return self.dtype.is_signed

    def is_set_to(self, other):
        return self._a is other._a

    def is_shared(self):
        return False

    def __class_getitem__(cls, item):
        return cls


strided = type("layout", (), {"__repr__": lambda s: "torch.strided"})()
contiguous_format = type("memory_format", (), {"__repr__": lambda s: "torch.contiguous_format"})()
channels_last = type("memory_format", (), {"__repr__": lambda s: "torch.channels_last"})()
preserve_format = type("memory_format", (), {"__repr__": lambda s: "torch.preserve_format"})()


class _Storage:
    def __init__(self, t):
        self._t = t

    def data_ptr(self):
        base = self._t._a
        while isinstance(base.base, np.ndarray):
            base = base.base
        return base.__array_interface__["data"][0]

    def nbytes(self):
        base = self._t._a
        while isinstance(base.base, np.ndarray):
            base = base.base
        return base.nbytes

    def size(self):
        return self.nbytes()


class _RemovableHandle:
    _next = 0

    def __init__(self, store=None, key=None):
        self._store, self._key = store, key
        _RemovableHandle._next += 1
        self.id = _RemovableHandle._next

    def remove(self):
        if self._store is not None:
            self._store.pop(self._key, None)


def _rebuild(arr, dt, dev, rg):
    t = Tensor._wrap(arr, _dtype_by_name(dt), device(dev))
    t.requires_grad = rg
    return t


def _basic_index(idx):
    items = idx if isinstance(idx, tuple) else (idx,)
    return _all(isinstance(i, (_int, _slice, type(None), type(Ellipsis))) and not isinstance(i, _bool) for i in items)


def _index_name(idx):
    """PyTorch applies basic indexing one step at a time (full ':' slices are skipped), so grad_fn names the last step."""
    items = idx if isinstance(idx, tuple) else (idx,)
    steps = []
    for i in items:
        if i is Ellipsis or (isinstance(i, _slice) and i == _slice(None)):
            continue
        steps.append("UnsqueezeBackward0" if i is None else "SliceBackward0" if isinstance(i, _slice) else "SelectBackward0")
    return steps[-1] if steps else "SliceBackward0"


def _cuda_first(a, b):
    names = sorted({str(a), str(b)}, key=lambda s: (s == "cpu", s))
    return f"{names[0]} and {names[-1]}"


def _tname(d):
    return {"float32": "Float", "float64": "Double", "float16": "Half", "bfloat16": "BFloat16", "int64": "Long", "int32": "Int", "int16": "Short", "int8": "Char", "uint8": "Byte", "bool": "Bool", "complex64": "ComplexFloat", "complex128": "ComplexDouble"}[d.name]


def _shape_arg(shape):
    if len(shape) == 1 and isinstance(shape[0], (tuple, list, Size)):
        shape = tuple(shape[0])
    out = []
    for s in shape:
        if isinstance(s, Tensor):
            s = s.item()
        if not isinstance(s, (_int, np.integer)) or isinstance(s, _bool):
            raise TypeError(f"view(): argument 'size' (position 1) must be tuple of ints, but found element of type {type(s).__name__} at pos {len(out)}")
        out.append(_int(s))
    return tuple(out)


# ---------------------------------------------------------------- elementwise operations

def _as_operand(x, dt, dev):
    if isinstance(x, Tensor):
        return _cast(x._a, dt) if x.dtype is not dt else x._a
    return _cast(np.asarray(x), dt)


def _binary(a, b, name, fn, grad_a, grad_b, out_dtype=None, compute_dtype=None, reverse=False):
    if reverse:
        a, b = b, a
    if not isinstance(b, (Tensor, numbers.Number, np.number, np.bool_)):
        if isinstance(b, (list, tuple)):
            b = tensor(b)
        elif isinstance(b, np.ndarray):
            b = from_numpy(b)
        else:
            return NotImplemented
    if not isinstance(a, (Tensor, numbers.Number, np.number, np.bool_)):
        return NotImplemented
    dev = _device_check(a, b)
    rt = _result_type(a, b)
    cdt = compute_dtype(rt) if compute_dtype else rt
    x, y = _as_operand(a, cdt, dev), _as_operand(b, cdt, dev)
    if cdt in (float16, bfloat16):
        x, y = x.astype(np.float32), y.astype(np.float32)
    try:
        with np.errstate(all="ignore"):
            r = fn(x, y)
    except ValueError:
        sa = list(a.shape) if isinstance(a, Tensor) else []
        sb = list(b.shape) if isinstance(b, Tensor) else []
        _raise_broadcast(sa, sb)
    odt = out_dtype or cdt
    ta = a if isinstance(a, Tensor) else None
    tb = b if isinstance(b, Tensor) else None
    sa, sb = x.shape, y.shape
    track = _GradMode.enabled and _any(isinstance(t, Tensor) and t.requires_grad for t in (ta, tb))
    xs, ys = (x.copy(), y.copy()) if track else (x, y)
    ra = ta is not None and ta.requires_grad
    rb = tb is not None and tb.requires_grad
    if name == "MulBackward0":
        saved = [t for t, need in ((ta, rb), (tb, ra)) if t is not None and need]
    elif name == "DivBackward0":
        saved = [t for t, need in ((ta, rb), (tb, ra or rb)) if t is not None and need]
    elif name in ("PowBackward0", "PowBackward1", "PowBackward2", "MaximumBackward0", "MinimumBackward0", "RemainderBackward0"):
        saved = [t for t in (ta, tb) if t is not None]
    else:
        saved = []

    def bw(g):
        g = np.asarray(g)
        ga = _unbroadcast(grad_a(g, xs, ys, r), sa) if ta is not None and ta.requires_grad and grad_a else None
        gb = _unbroadcast(grad_b(g, xs, ys, r), sb) if tb is not None and tb.requires_grad and grad_b else None
        if ga is not None:
            ga = ga.astype(ta._a.dtype, copy=False)
        if gb is not None:
            gb = gb.astype(tb._a.dtype, copy=False)
        return (ga, gb)
    return _make_result(r, odt, [ta, tb], name, bw, saved=saved, dev=dev)


def _raise_broadcast(sa, sb):
    # find the first mismatching dimension from the right, like TensorIterator
    na, nb = len(sa), len(sb)
    n = _max(na, nb)
    for i in range(1, n + 1):
        da = sa[-i] if i <= na else 1
        db = sb[-i] if i <= nb else 1
        if da != db and da != 1 and db != 1:
            raise RuntimeError(f"The size of tensor a ({da}) must match the size of tensor b ({db}) at non-singleton dimension {n - i}")
    raise RuntimeError("shape mismatch")


def _true_div_dtype(rt):
    return rt if rt.is_floating_point or rt.is_complex else get_default_dtype()


def _unary(self, name, fn, grad, float_only=True, keep_int=False, save="in"):
    dt = self.dtype
    cdt = dt if (dt.is_floating_point or dt.is_complex or keep_int) else get_default_dtype()
    x = self._a if cdt is dt else _cast(self._a, cdt)
    with np.errstate(all="ignore"):
        r = fn(x.astype(np.float32) if cdt in (float16, bfloat16) else x)
    xs = x

    def bw(g):
        return (grad(np.asarray(g), xs, r).astype(self._a.dtype, copy=False),)
    return _make_result(r, cdt, [self], name, bw, saved=[self] if save == "in" else [], save_out=save == "out")


def _install_operators():
    T = Tensor
    ones_ = lambda g, x, y, r: g
    neg_ = lambda g, x, y, r: -g

    def add(self, other, *, alpha=1):
        if alpha != 1:
            other = other * alpha
        return _binary(self, other, "AddBackward0", lambda x, y: x + y, ones_, ones_)

    def sub(self, other, *, alpha=1):
        if isinstance(other, Tensor) and other.dtype is bool and self.dtype is bool:
            raise NotImplementedError("Subtraction, the `-` operator, with two bool tensors is not supported. Use the `^` or `logical_xor()` operator instead.")
        if isinstance(other, Tensor) and other.dtype is bool or self.dtype is bool:
            raise NotImplementedError("Subtraction, the `-` operator, with a bool tensor is not supported. If you are trying to invert a mask, use the `~` or `logical_not()` operator instead.")
        if alpha != 1:
            other = other * alpha
        return _binary(self, other, "SubBackward0", lambda x, y: x - y, ones_, neg_)

    def mul(self, other):
        return _binary(self, other, "MulBackward0", lambda x, y: x * y, lambda g, x, y, r: g * y, lambda g, x, y, r: g * x)

    def div(self, other, *, rounding_mode=None):
        if rounding_mode == "floor":
            return floor_divide(self, other)
        if rounding_mode == "trunc":
            return _binary(self, other, "DivBackward3", lambda x, y: np.trunc(x / y).astype(x.dtype) if x.dtype.kind == "f" else (np.trunc(x / y)).astype(x.dtype), None, None)
        return _binary(self, other, "DivBackward0", lambda x, y: x / y, lambda g, x, y, r: g / y, lambda g, x, y, r: -g * x / (y * y), compute_dtype=_true_div_dtype)

    def floor_divide(self, other):
        def fd(x, y):
            if x.dtype.kind in "iu" and np.any(y == 0):
                raise RuntimeError("ZeroDivisionError")
            return np.floor_divide(x, y)
        return _binary(self, other, "FloorDivideBackward0", fd, None, None)

    def remainder(self, other):
        def rem(x, y):
            if x.dtype.kind in "iu" and np.any(y == 0):
                raise RuntimeError("ZeroDivisionError")
            return np.mod(x, y)
        return _binary(self, other, "RemainderBackward0", rem, ones_, lambda g, x, y, r: -g * np.floor(x / y))

    def pow(self, exponent):
        if isinstance(exponent, Tensor):
            return _binary(self, exponent, "PowBackward1", lambda x, y: np.power(x, y),
                           lambda g, x, y, r: g * y * np.power(x, y - 1), lambda g, x, y, r: g * r * np.log(np.where(x > 0, x, 1)))
        e = exponent
        if self.dtype._kind == "i" and isinstance(e, (_int, np.integer)) and e < 0:
            raise RuntimeError("Integers to negative integer powers are not allowed.")
        return _binary(self, e, "PowBackward0", lambda x, y: np.power(x, y), lambda g, x, y, r: g * y * np.power(x, y - 1), None)

    def rpow(self, base):
        return _binary(base, self, "PowBackward2", lambda x, y: np.power(x, y), None, lambda g, x, y, r: g * r * np.log(x))

    def matmul_(self, other):
        return globals()["matmul"](self, other)

    T.add, T.sub, T.mul, T.div, T.true_divide, T.floor_divide, T.remainder, T.pow, T.matmul = add, sub, mul, div, div, floor_divide, remainder, pow, matmul_
    T.multiply, T.subtract, T.divide = mul, sub, div
    T.__add__ = T.__radd__ = lambda s, o: add(s, o)
    T.__sub__ = lambda s, o: sub(s, o)
    T.__rsub__ = lambda s, o: _binary(o, s, "RsubBackward1", lambda x, y: x - y, ones_, neg_) if not isinstance(o, Tensor) else sub(o, s)
    T.__mul__ = T.__rmul__ = lambda s, o: mul(s, o)
    T.__truediv__ = lambda s, o: div(s, o)
    T.__rtruediv__ = lambda s, o: s.reciprocal() * o if isinstance(o, (numbers.Number, np.number)) else _binary(o, s, "DivBackward0", lambda x, y: x / y, None, lambda g, x, y, r: -g * x / (y * y), compute_dtype=_true_div_dtype)
    T.__floordiv__ = lambda s, o: floor_divide(s, o)
    T.__rfloordiv__ = lambda s, o: _binary(o, s, "FloorDivideBackward0", np.floor_divide, None, None)
    T.__mod__ = lambda s, o: remainder(s, o)
    T.__rmod__ = lambda s, o: _binary(o, s, "RemainderBackward1", np.mod, None, None)
    T.__pow__ = lambda s, o: pow(s, o)
    T.__rpow__ = lambda s, o: rpow(s, o)
    T.__matmul__ = lambda s, o: globals()["matmul"](s, o)
    T.__rmatmul__ = lambda s, o: globals()["matmul"](tensor(o) if not isinstance(o, Tensor) else o, s)
    T.__neg__ = T.neg = T.negative = lambda s: _unary(s, "NegBackward0", np.negative, lambda g, x, r: -g, keep_int=True, save=None)
    T.__pos__ = T.positive = lambda s: s
    T.__abs__ = T.abs = T.absolute = lambda s: _unary(s, "AbsBackward0", np.abs, lambda g, x, r: g * np.sign(x), keep_int=True)
    T.__invert__ = T.bitwise_not = lambda s: Tensor._wrap(~s._a if s.dtype is not bool else ~s._a, s.dtype, s.device) if s.dtype._kind in "ib" else _raise(TypeError("~ (operator.invert) is only implemented on integer and Boolean-type tensors"))

    def logic(op, name):
        def f(s, o):
            if not isinstance(o, (Tensor, numbers.Number, np.number)):
                return NotImplemented
            dev = _device_check(s, o)
            rt = _result_type(s, o)
            if rt._kind not in "ib":
                raise NotImplementedError(f'"{name}_cpu" not implemented for \'{_tname(rt)}\'')
            return Tensor._wrap(op(_as_operand(s, rt, dev), _as_operand(o, rt, dev)), rt, dev)
        return f
    T.__and__ = T.__rand__ = T.bitwise_and = logic(np.bitwise_and, "bitwise_and")
    T.__or__ = T.__ror__ = T.bitwise_or = logic(np.bitwise_or, "bitwise_or")
    T.__xor__ = T.__rxor__ = T.bitwise_xor = logic(np.bitwise_xor, "bitwise_xor")

    def compare(op, name):
        def f(s, o):
            if isinstance(o, (list, tuple)):
                o = tensor(o)
            if not isinstance(o, (Tensor, numbers.Number, np.number, np.bool_)):
                return NotImplemented if name in ("lt", "le", "gt", "ge") else (op is np.not_equal)
            dev = _device_check(s, o)
            rt = _result_type(s, o)
            try:
                r = op(_as_operand(s, rt, dev), _as_operand(o, rt, dev))
            except ValueError:
                _raise_broadcast(list(s.shape), list(o.shape) if isinstance(o, Tensor) else [])
            return Tensor._wrap(np.asarray(r), bool, dev)
        return f
    T.__eq__, T.eq = compare(np.equal, "eq"), compare(np.equal, "eq")
    T.__ne__, T.ne, T.not_equal = compare(np.not_equal, "ne"), compare(np.not_equal, "ne"), compare(np.not_equal, "ne")
    T.__lt__ = T.lt = T.less = compare(np.less, "lt")
    T.__le__ = T.le = T.less_equal = compare(np.less_equal, "le")
    T.__gt__ = T.gt = T.greater = compare(np.greater, "gt")
    T.__ge__ = T.ge = T.greater_equal = compare(np.greater_equal, "ge")

    for nm in ("add", "sub", "mul", "div", "pow", "remainder", "floor_divide", "true_divide", "multiply", "subtract", "divide"):
        def inplace(s, o, *a, _nm=nm, **k):
            r = getattr(Tensor, _nm)(s, o, *a, **k)
            return s._inplace(r)
        setattr(T, nm + "_", inplace)
    T.__iadd__ = lambda s, o: s.add_(o)
    T.__isub__ = lambda s, o: s.sub_(o)
    T.__imul__ = lambda s, o: s.mul_(o)
    T.__itruediv__ = lambda s, o: s.div_(o)
    T.__ifloordiv__ = lambda s, o: s.floor_divide_(o)
    T.__imod__ = lambda s, o: s.remainder_(o)
    T.__ipow__ = lambda s, o: s.pow_(o)

    # elementwise math
    def u(name, fn, grad, bw_name=None, save="in"):
        def f(s):
            return _unary(s, bw_name or (name.capitalize() + "Backward0"), fn, grad, save=save)
        setattr(T, name, f)

        def fi(s):
            return s._inplace(f(s))
        setattr(T, name + "_", fi)
    u("exp", np.exp, lambda g, x, r: g * r, save="out")
    u("log", np.log, lambda g, x, r: g / x)
    u("log2", np.log2, lambda g, x, r: g / (x * math.log(2)))
    u("log10", np.log10, lambda g, x, r: g / (x * math.log(10)))
    u("log1p", np.log1p, lambda g, x, r: g / (1 + x))
    u("expm1", np.expm1, lambda g, x, r: g * (r + 1), save="out")
    u("sqrt", np.sqrt, lambda g, x, r: g / (2 * r), save="out")
    u("rsqrt", lambda x: 1 / np.sqrt(x), lambda g, x, r: -0.5 * g * r ** 3, save="out")
    u("sin", np.sin, lambda g, x, r: g * np.cos(x))
    u("cos", np.cos, lambda g, x, r: -g * np.sin(x))
    u("tan", np.tan, lambda g, x, r: g * (1 + r * r))
    u("tanh", np.tanh, lambda g, x, r: g * (1 - r * r), save="out")
    u("sigmoid", lambda x: 1 / (1 + np.exp(-x)), lambda g, x, r: g * r * (1 - r), save="out")
    u("reciprocal", lambda x: 1 / x, lambda g, x, r: -g * r * r, save="out")
    u("square", np.square, lambda g, x, r: 2 * g * x, "PowBackward0")
    u("erf", lambda x: np.vectorize(math.erf)(x).astype(x.dtype), lambda g, x, r: g * 2 / math.sqrt(math.pi) * np.exp(-x * x))
    u("asin", np.arcsin, lambda g, x, r: g / np.sqrt(1 - x * x))
    u("acos", np.arccos, lambda g, x, r: -g / np.sqrt(1 - x * x))
    u("atan", np.arctan, lambda g, x, r: g / (1 + x * x))
    u("sinh", np.sinh, lambda g, x, r: g * np.cosh(x))
    u("cosh", np.cosh, lambda g, x, r: g * np.sinh(x))
    T.arcsin, T.arccos, T.arctan = T.asin, T.acos, T.atan

    def rounding(name, fn):
        def f(s, *a, **k):
            if s.dtype._kind == "i":
                return s.clone()
            if name == "round" and (a or k):
                decimals = (a[0] if a else k.get("decimals", 0))
                return _unary(s, "RoundBackward1", lambda x: np.round(x, decimals), lambda g, x, r: g * 0)
            return _unary(s, name.capitalize() + "Backward0", fn, lambda g, x, r: g * 0)
        setattr(T, name, f)
        setattr(T, name + "_", lambda s, *a, **k: s._inplace(f(s, *a, **k)))
    rounding("round", np.round)          # rounds half to even, like PyTorch
    rounding("floor", np.floor)
    rounding("ceil", np.ceil)
    rounding("trunc", np.trunc)
    T.fix = T.trunc

    def frac(s):
        return s - s.trunc()
    T.frac = frac

    def sign(s):
        return _unary(s, "SignBackward0", np.sign, lambda g, x, r: g * 0, keep_int=True)
    T.sign = T.sgn = sign

    def relu(s):
        return _unary(s, "ReluBackward0", lambda x: np.maximum(x, 0).astype(x.dtype), lambda g, x, r: g * (r > 0), keep_int=True, save="out")
    T.relu = relu
    T.relu_ = lambda s: s._inplace(relu(s))

    def clamp(s, min=None, max=None):
        if min is None and max is None:
            raise RuntimeError("torch.clamp: At least one of 'min' or 'max' must not be None")
        lo = min._a if isinstance(min, Tensor) else min
        hi = max._a if isinstance(max, Tensor) else max
        rt = _result_type(s, *(v for v in (min, max) if v is not None))
        x = _cast(s._a, rt)

        def f(v):
            r = v
            if lo is not None:
                r = np.maximum(r, lo)
            if hi is not None:
                r = np.minimum(r, hi)
            return r.astype(v.dtype)
        r = f(x)

        def bw(g):
            m = np.ones_like(x, dtype=_bool)          # PyTorch passes no gradient at the clamp bounds themselves
            if lo is not None:
                m &= x > lo
            if hi is not None:
                m &= x < hi
            return (np.where(m, g, 0).astype(s._a.dtype),)
        return _make_result(r, rt, [s], "ClampBackward1", bw, saved=[s])
    T.clamp = T.clip = clamp
    T.clamp_ = T.clip_ = lambda s, min=None, max=None: s._inplace(clamp(s, min, max))
    T.clamp_min = lambda s, m: clamp(s, min=m)
    T.clamp_max = lambda s, m: clamp(s, max=m)

    def maximum(s, o):
        return _binary(s, o, "MaximumBackward0", np.maximum, lambda g, x, y, r: g * ((x > y) + 0.5 * (x == y)), lambda g, x, y, r: g * ((y > x) + 0.5 * (x == y)))
    T.maximum = maximum
    T.minimum = lambda s, o: _binary(s, o, "MinimumBackward0", np.minimum, lambda g, x, y, r: g * ((x < y) + 0.5 * (x == y)), lambda g, x, y, r: g * ((y < x) + 0.5 * (x == y)))

    T.isnan = lambda s: Tensor._wrap(np.isnan(s._a), bool, s.device)
    T.isinf = lambda s: Tensor._wrap(np.isinf(s._a), bool, s.device)
    T.isfinite = lambda s: Tensor._wrap(np.isfinite(s._a), bool, s.device)
    T.isposinf = lambda s: Tensor._wrap(np.isposinf(s._a), bool, s.device)
    T.logical_not = lambda s: Tensor._wrap(np.logical_not(s._a), bool, s.device)
    T.logical_and = lambda s, o: Tensor._wrap(np.logical_and(s._a, _np_of(o)), bool, s.device)
    T.logical_or = lambda s, o: Tensor._wrap(np.logical_or(s._a, _np_of(o)), bool, s.device)
    T.logical_xor = lambda s, o: Tensor._wrap(np.logical_xor(s._a, _np_of(o)), bool, s.device)
    T.lerp = lambda s, end, weight: s + weight * (end - s)
    T.addcmul = lambda s, t1, t2, value=1: s + value * t1 * t2
    T.addcdiv = lambda s, t1, t2, value=1: s + value * t1 / t2
    T.addcmul_ = lambda s, t1, t2, value=1: s._inplace(s + value * t1 * t2)
    T.addcdiv_ = lambda s, t1, t2, value=1: s._inplace(s + value * t1 / t2)
    T.lerp_ = lambda s, end, weight: s._inplace(s + weight * (end - s))
    T.nan_to_num = lambda s, nan=0.0, posinf=None, neginf=None: Tensor._wrap(np.nan_to_num(s._a, nan=nan, posinf=posinf, neginf=neginf), s.dtype, s.device)


def _raise(e):
    raise e


_install_operators()


# ---------------------------------------------------------------- reductions

_MaxResult = namedtuple("max", ["values", "indices"])
_MinResult = namedtuple("min", ["values", "indices"])
_SortResult = namedtuple("sort", ["values", "indices"])
_TopkResult = namedtuple("topk", ["values", "indices"])
_ModeResult = namedtuple("mode", ["values", "indices"])
_MedianResult = namedtuple("median", ["values", "indices"])
_StdMean = namedtuple("std_mean", ["std", "mean"])


def _ret_repr(nt, mod="torch.return_types"):
    def r(self):
        fields = ",\n".join(f"{f}={getattr(self, f)!r}" for f in self._fields)
        return f"{mod}.{type(self).__name__}(\n{fields})"
    nt.__repr__ = r
    return nt


for _nt in (_MaxResult, _MinResult, _SortResult, _TopkResult, _ModeResult, _MedianResult):
    _ret_repr(_nt)


def _axes(t, dim):
    if dim is None:
        return None
    if isinstance(dim, (tuple, list)):
        return tuple(t._dim(d) for d in dim)
    return (t._dim(dim),)


def _reduce(t, name, np_fn, grad, dim=None, keepdim=False, dtype=None, out_dtype=None, save=True):
    ax = _axes(t, dim)
    if dtype is not None:
        t = t.to(dtype)
    x = t._a
    if out_dtype is None:
        out_dtype = t.dtype
    cx = x.astype(np.float32) if t.dtype in (float16, bfloat16) else x
    with np.errstate(all="ignore"):
        r = np_fn(cx, axis=ax, keepdims=keepdim)
    shape = x.shape

    def bw(g):
        g = np.asarray(g)
        if not keepdim and ax is not None:
            g = np.expand_dims(g, ax)
        elif ax is None and not keepdim:
            g = g.reshape((1,) * len(shape))
        return (grad(np.broadcast_to(g, shape), cx, ax, r).astype(x.dtype, copy=False),)
    return _make_result(np.asarray(r), out_dtype, [t], name, bw, saved=[t] if save else [])


def _install_reductions():
    T = Tensor

    def sum_(s, dim=None, keepdim=False, *, dtype=None):
        od = dtype or (int64 if s.dtype._kind in "ib" else s.dtype)
        if s.dtype._kind in "ib" and dtype is None:
            s = s.to(int64) if s.dtype is not int64 else s
        return _reduce(s, "SumBackward0" if dim is None else "SumBackward1", np.sum, lambda g, x, ax, r: g, dim, keepdim, dtype, od, save=False)

    def mean(s, dim=None, keepdim=False, *, dtype=None):
        if not (s.dtype.is_floating_point or s.dtype.is_complex) and dtype is None:
            raise RuntimeError(f"mean(): could not infer output dtype. Input dtype must be either a floating point or complex dtype. Got: {_tname(s.dtype)}")
        n_of = lambda x, ax: x.size if ax is None else _int(np.prod([x.shape[a] for a in ax]))
        return _reduce(s, "MeanBackward0" if dim is None else "MeanBackward1", np.mean, lambda g, x, ax, r: g / n_of(x, ax), dim, keepdim, dtype, save=False)

    def var(s, dim=None, unbiased=None, keepdim=False, *, correction=None):
        if correction is None:
            correction = 1 if unbiased is None or unbiased else 0
        if isinstance(dim, _bool):
            correction, dim = (1 if dim else 0), None
        n_of = lambda x, ax: x.size if ax is None else _int(np.prod([x.shape[a] for a in ax]))

        def g(gr, x, ax, r):
            m = x.mean(axis=ax, keepdims=True)
            return gr * 2 * (x - m) / (n_of(x, ax) - correction)
        return _reduce(s, "VarBackward0", lambda x, axis, keepdims: np.var(x, axis=axis, keepdims=keepdims, ddof=correction), g, dim, keepdim)

    def std(s, dim=None, unbiased=None, keepdim=False, *, correction=None):
        if correction is None:
            correction = 1 if unbiased is None or unbiased else 0
        if isinstance(dim, _bool):
            correction, dim = (1 if dim else 0), None
        n_of = lambda x, ax: x.size if ax is None else _int(np.prod([x.shape[a] for a in ax]))

        def g(gr, x, ax, r):
            m = x.mean(axis=ax, keepdims=True)
            sd = np.std(x, axis=ax, keepdims=True, ddof=correction)
            return gr * (x - m) / ((n_of(x, ax) - correction) * sd)
        return _reduce(s, "StdBackward0", lambda x, axis, keepdims: np.std(x, axis=axis, keepdims=keepdims, ddof=correction), g, dim, keepdim)

    def prod(s, dim=None, keepdim=False, *, dtype=None):
        od = int64 if s.dtype._kind in "ib" and dtype is None else (dtype or s.dtype)
        return _reduce(s, "ProdBackward0" if dim is None else "ProdBackward1", np.prod, lambda g, x, ax, r: g * np.prod(x, axis=ax, keepdims=True) / x, dim, keepdim, dtype, od)

    def _maxmin(s, dim, keepdim, is_max, other=None):
        if isinstance(dim, Tensor):
            return Tensor.maximum(s, dim) if is_max else Tensor.minimum(s, dim)
        if dim is None:
            if s.numel() == 0:
                raise RuntimeError(f"{'max' if is_max else 'min'}(): Expected reduction dim to be specified for input.numel() == 0. Specify the reduction dim with the 'dim' argument.")
            fn = np.max if is_max else np.min

            def g(gr, x, ax, r):
                m = (x == r)
                return gr * m / m.sum()
            return _reduce(s, "MaxBackward1" if is_max else "MinBackward1", fn, g, None, False)
        d = s._dim(dim)
        x = s._a
        idx = (np.argmax if is_max else np.argmin)(np.where(np.isnan(x), -np.inf if not is_max else np.inf, x) if x.dtype.kind == "f" and False else x, axis=d)
        vals = np.take_along_axis(x, np.expand_dims(idx, d), axis=d)
        if not keepdim:
            vals = np.squeeze(vals, d)
        shape = x.shape

        def bw(g):
            g = np.asarray(g)
            full_g = np.zeros(shape, dtype=g.dtype)
            gi = g if keepdim else np.expand_dims(g, d)
            np.put_along_axis(full_g, np.expand_dims(idx, d), gi, axis=d)
            return (full_g,)
        v = _make_result(vals, s.dtype, [s], "MaxBackward0" if is_max else "MinBackward0", bw)
        i = Tensor._wrap((idx if not keepdim else np.expand_dims(idx, d)).astype(np.int64), int64, s.device)
        return (_MaxResult if is_max else _MinResult)(v, i)

    def argmax(s, dim=None, keepdim=False):
        if dim is None:
            return Tensor._wrap(np.asarray(np.argmax(s._a)).astype(np.int64), int64, s.device)
        d = s._dim(dim)
        r = np.argmax(s._a, axis=d)
        return Tensor._wrap((np.expand_dims(r, d) if keepdim else r).astype(np.int64), int64, s.device)

    def argmin(s, dim=None, keepdim=False):
        if dim is None:
            return Tensor._wrap(np.asarray(np.argmin(s._a)).astype(np.int64), int64, s.device)
        d = s._dim(dim)
        r = np.argmin(s._a, axis=d)
        return Tensor._wrap((np.expand_dims(r, d) if keepdim else r).astype(np.int64), int64, s.device)

    def amax(s, dim=(), keepdim=False):
        return _reduce(s, "AmaxBackward0", np.max, lambda g, x, ax, r: g * (x == r) / (x == r).sum(axis=ax, keepdims=True), dim if dim != () else None, keepdim)

    def amin(s, dim=(), keepdim=False):
        return _reduce(s, "AminBackward0", np.min, lambda g, x, ax, r: g * (x == r) / (x == r).sum(axis=ax, keepdims=True), dim if dim != () else None, keepdim)

    def norm(s, p="fro", dim=None, keepdim=False):
        if p in ("fro", 2):
            return _reduce(s, "NormBackward1" if dim is not None else "LinalgVectorNormBackward0", lambda x, axis, keepdims: np.sqrt((x * x).sum(axis=axis, keepdims=keepdims)), lambda g, x, ax, r: g * x / np.where(r == 0, 1, r), dim, keepdim)
        if p == 1:
            return _reduce(s, "LinalgVectorNormBackward0", lambda x, axis, keepdims: np.abs(x).sum(axis=axis, keepdims=keepdims), lambda g, x, ax, r: g * np.sign(x), dim, keepdim)
        if p == float("inf"):
            return _reduce(s, "LinalgVectorNormBackward0", lambda x, axis, keepdims: np.abs(x).max(axis=axis, keepdims=keepdims), lambda g, x, ax, r: g * 0, dim, keepdim)
        return _reduce(s, "LinalgVectorNormBackward0", lambda x, axis, keepdims: (np.abs(x) ** p).sum(axis=axis, keepdims=keepdims) ** (1 / p), lambda g, x, ax, r: g * 0, dim, keepdim)

    def cumsum(s, dim, *, dtype=None):
        d = s._dim(dim)
        od = dtype or (int64 if s.dtype._kind in "ib" else s.dtype)
        return _make_result(np.cumsum(s._a, axis=d), od, [s], "CumsumBackward0", lambda g: (np.flip(np.cumsum(np.flip(np.asarray(g), d), axis=d), d),))

    def cumprod(s, dim, *, dtype=None):
        d = s._dim(dim)
        return _make_result(np.cumprod(s._a, axis=d), dtype or (int64 if s.dtype._kind in "ib" else s.dtype), [s], "CumprodBackward0", lambda g: (g * 0,))

    def any_(s, dim=None, keepdim=False):
        r = np.any(s._a, axis=_axes(s, dim), keepdims=keepdim)
        return Tensor._wrap(np.asarray(r), bool if s.dtype is not uint8 else uint8, s.device)

    def all_(s, dim=None, keepdim=False):
        r = np.all(s._a, axis=_axes(s, dim), keepdims=keepdim)
        return Tensor._wrap(np.asarray(r), bool if s.dtype is not uint8 else uint8, s.device)

    def count_nonzero(s, dim=None):
        return Tensor._wrap(np.asarray(np.count_nonzero(s._a, axis=_axes(s, dim))).astype(np.int64), int64, s.device)

    T.sum, T.mean, T.var, T.std, T.prod = sum_, mean, var, std, prod
    T.nansum = lambda s, dim=None, keepdim=False: _reduce(s, "NansumBackward0", np.nansum, lambda g, x, ax, r: g * ~np.isnan(x), dim, keepdim)
    T.nanmean = lambda s, dim=None, keepdim=False: _reduce(s, "NanmeanBackward0", np.nanmean, lambda g, x, ax, r: g * 0, dim, keepdim)
    T.max = lambda s, dim=None, keepdim=False: _maxmin(s, dim, keepdim, True)
    T.min = lambda s, dim=None, keepdim=False: _maxmin(s, dim, keepdim, False)
    T.argmax, T.argmin, T.amax, T.amin, T.norm, T.cumsum, T.cumprod = argmax, argmin, amax, amin, norm, cumsum, cumprod
    T.any, T.all, T.count_nonzero = any_, all_, count_nonzero

    def std_mean(s, dim=None, keepdim=False, correction=1):
        return _StdMean(s.std(dim, keepdim=keepdim, correction=correction), s.mean(dim, keepdim=keepdim) if dim is not None else s.mean())
    T.std_mean = std_mean

    def logsumexp(s, dim, keepdim=False):
        return _reduce(s, "LogsumexpBackward0", lambda x, axis, keepdims: (lambda m: np.log(np.exp(x - m).sum(axis=axis, keepdims=True)) + m)(x.max(axis=axis, keepdims=True)).squeeze(axis) if not keepdims else (lambda m: np.log(np.exp(x - m).sum(axis=axis, keepdims=True)) + m)(x.max(axis=axis, keepdims=True)), lambda g, x, ax, r: g * np.exp(x - (r if r.ndim == x.ndim else np.expand_dims(r, ax))), dim, keepdim)
    T.logsumexp = logsumexp

    def softmax(s, dim=None, dtype=None):
        if dim is None:
            warnings.warn("Implicit dimension choice for softmax has been deprecated. Change the call to include dim=X as an argument.", UserWarning, stacklevel=3)
            dim = 0 if s.dim() in (0, 1, 3) else 1
        if dtype is not None:
            s = s.to(dtype)
        d = s._dim(dim)
        x = s._a.astype(np.float32) if s.dtype in (float16, bfloat16) else s._a
        e = np.exp(x - x.max(axis=d, keepdims=True))
        r = e / e.sum(axis=d, keepdims=True)
        return _make_result(r, s.dtype, [s], "SoftmaxBackward0", lambda g: (r * (np.asarray(g) - (np.asarray(g) * r).sum(axis=d, keepdims=True)),), save_out=True)

    def log_softmax(s, dim=None, dtype=None):
        if dim is None:
            warnings.warn("Implicit dimension choice for log_softmax has been deprecated. Change the call to include dim=X as an argument.", UserWarning, stacklevel=3)
            dim = 0 if s.dim() in (0, 1, 3) else 1
        if dtype is not None:
            s = s.to(dtype)
        d = s._dim(dim)
        x = s._a.astype(np.float32) if s.dtype in (float16, bfloat16) else s._a
        m = x.max(axis=d, keepdims=True)
        lse = np.log(np.exp(x - m).sum(axis=d, keepdims=True)) + m
        r = x - lse
        return _make_result(r, s.dtype, [s], "LogSoftmaxBackward0", lambda g: (np.asarray(g) - np.exp(r) * np.asarray(g).sum(axis=d, keepdims=True),), save_out=True)
    T.softmax, T.log_softmax = softmax, log_softmax

    def sort(s, dim=-1, descending=False, stable=False):
        d = s._dim(dim) if s.dim() else 0
        x = s._a
        idx = np.argsort(-x if descending and x.dtype.kind != "b" else (~x if descending else x), axis=d, kind="stable")
        vals = np.take_along_axis(x, idx, axis=d)
        shape = x.shape

        def bw(g):
            full_g = np.zeros(shape, dtype=np.asarray(g).dtype)
            np.put_along_axis(full_g, idx, np.asarray(g), axis=d)
            return (full_g,)
        return _SortResult(_make_result(vals, s.dtype, [s], "SortBackward0", bw), Tensor._wrap(idx.astype(np.int64), int64, s.device))

    def argsort(s, dim=-1, descending=False, stable=False):
        return sort(s, dim, descending, stable).indices

    def topk(s, k, dim=-1, largest=True, sorted=True):
        d = s._dim(dim)
        if k > s.shape[d]:
            raise RuntimeError("selected index k out of range")
        x = s._a
        idx = np.argsort(-x if largest else x, axis=d, kind="stable")
        idx = np.take(idx, np.arange(k), axis=d)
        vals = np.take_along_axis(x, idx, axis=d)
        shape = x.shape

        def bw(g):
            full_g = np.zeros(shape, dtype=np.asarray(g).dtype)
            np.put_along_axis(full_g, idx, np.asarray(g), axis=d)
            return (full_g,)
        return _TopkResult(_make_result(vals, s.dtype, [s], "TopkBackward0", bw), Tensor._wrap(idx.astype(np.int64), int64, s.device))

    T.sort, T.argsort, T.topk = sort, argsort, topk

    def unique(s, sorted=True, return_inverse=False, return_counts=False, dim=None):
        vals, inv, counts = np.unique(s._a, return_inverse=True, return_counts=True, axis=dim)
        out = [Tensor._wrap(vals, s.dtype, s.device)]
        if return_inverse:
            out.append(Tensor._wrap(inv.reshape(s._a.shape if dim is None else -1).astype(np.int64), int64, s.device))
        if return_counts:
            out.append(Tensor._wrap(counts.astype(np.int64), int64, s.device))
        return out[0] if len(out) == 1 else tuple(out)
    T.unique = unique

    def bincount(s, weights=None, minlength=0):
        return Tensor._wrap(np.bincount(s._a, weights=None if weights is None else weights._a, minlength=minlength).astype(np.int64 if weights is None else np.float64), int64 if weights is None else float64, s.device)
    T.bincount = bincount

    def allclose(s, other, rtol=1e-05, atol=1e-08, equal_nan=False):
        return _bool(np.allclose(s._a, other._a, rtol=rtol, atol=atol, equal_nan=equal_nan))
    T.allclose = allclose
    T.isclose = lambda s, o, rtol=1e-05, atol=1e-08, equal_nan=False: Tensor._wrap(np.isclose(s._a, _np_of(o), rtol=rtol, atol=atol, equal_nan=equal_nan), bool, s.device)
    T.equal = lambda s, o: _bool(s.shape == o.shape and np.array_equal(s._a, o._a))

    def dot(s, o):
        if s.dim() != 1 or o.dim() != 1:
            raise RuntimeError(f"1D tensors expected, but got {s.dim()}D and {o.dim()}D tensors")
        if s.numel() != o.numel():
            raise RuntimeError(f"inconsistent tensor size, expected tensor [{s.numel()}] and src [{o.numel()}] to have the same number of elements, but got {s.numel()} and {o.numel()} elements respectively")
        if s.dtype is not o.dtype:
            raise RuntimeError(f"dot : expected both vectors to have same dtype, but found {_tname(s.dtype)} and {_tname(o.dtype)}")
        return _make_result(np.asarray(np.dot(s._a, o._a)), s.dtype, [s, o], "DotBackward0", lambda g: (np.asarray(g) * o._a, np.asarray(g) * s._a), saved=[s, o])
    T.dot = T.inner = dot

    def mm(s, o):
        if s.dim() != 2:
            raise RuntimeError("self must be a matrix")
        if o.dim() != 2:
            raise RuntimeError("mat2 must be a matrix")
        return matmul(s, o, _name="MmBackward0")
    T.mm = mm

    def bmm(s, o):
        if s.dim() != 3:
            raise RuntimeError(f"batch1 must be a 3D tensor")
        if o.dim() != 3:
            raise RuntimeError(f"batch2 must be a 3D tensor")
        return matmul(s, o, _name="BmmBackward0")
    T.bmm = bmm
    T.mv = lambda s, v: matmul(s, v, _name="MvBackward0")
    T.outer = lambda s, o: s.unsqueeze(1) * o.unsqueeze(0)

    def diag(s, diagonal=0):
        if s.dim() == 1:
            return Tensor._wrap(np.diag(s._a, diagonal), s.dtype, s.device)
        return Tensor._wrap(np.diag(s._a, diagonal).copy(), s.dtype, s.device)
    T.diag = diag
    T.trace = lambda s: Tensor._wrap(np.asarray(np.trace(s._a)), s.dtype, s.device)
    T.tril = lambda s, diagonal=0: Tensor._wrap(np.tril(s._a, diagonal), s.dtype, s.device)
    T.triu = lambda s, diagonal=0: Tensor._wrap(np.triu(s._a, diagonal), s.dtype, s.device)
    T.cross = lambda s, o, dim=-1: Tensor._wrap(np.cross(s._a, o._a, axis=dim), s.dtype, s.device)


_install_reductions()


def matmul(a, b, _name=None):
    if not isinstance(a, Tensor) or not isinstance(b, Tensor):
        raise TypeError(f"matmul(): argument 'other' (position 1) must be Tensor, not {type(b).__name__}")
    if a.dim() == 0 or b.dim() == 0:
        raise RuntimeError(f"both arguments to matmul need to be at least 1D, but they are {a.dim()}D and {b.dim()}D")
    try:
        dev = _device_check(a, b)
    except RuntimeError as e:
        if a.dim() == 2 and b.dim() == 2:
            raise RuntimeError(f"{e} (when checking argument for argument mat2 in method wrapper_CUDA_mm)") from None
        raise
    if a.dtype is not b.dtype:
        raise RuntimeError(f"expected m1 and m2 to have the same dtype, but got: {a.dtype.name.replace('float32', 'float').replace('float64', 'double').replace('int64', 'long int')} != {b.dtype.name.replace('float32', 'float').replace('float64', 'double').replace('int64', 'long int')}")
    x, y = a._a, b._a
    if a.dtype in (float16, bfloat16):
        x, y = x.astype(np.float32), y.astype(np.float32)
    try:
        r = np.matmul(x, y)
    except ValueError:
        if a.dim() == 1 and b.dim() == 1:
            raise RuntimeError(f"inconsistent tensor size, expected tensor [{a.numel()}] and src [{b.numel()}] to have the same number of elements, but got {a.numel()} and {b.numel()} elements respectively") from None
        if a.dim() == 2 and b.dim() == 2:
            raise RuntimeError(f"mat1 and mat2 shapes cannot be multiplied ({a.shape[0]}x{a.shape[1]} and {b.shape[0]}x{b.shape[1]})") from None
        if a.dim() == 2 and b.dim() == 1:
            raise RuntimeError(f"size mismatch, got input ({a.shape[0]}), mat ({a.shape[0]}x{a.shape[1]}), vec ({b.shape[0]})") from None
        raise RuntimeError(f"Expected size for first two dimensions of batch2 tensor to be: [{b.shape[0] if b.dim() > 2 else 1}, {a.shape[-1]}] but got: [{b.shape[0] if b.dim() > 2 else 1}, {b.shape[-2]}].") from None
    name = _name or ("DotBackward0" if a.dim() == 1 and b.dim() == 1 else "MvBackward0" if a.dim() == 2 and b.dim() == 1 else "MmBackward0" if a.dim() == 2 and b.dim() == 2 else "SqueezeBackward4" if a.dim() == 1 else "UnsafeViewBackward0" if a.dim() > 2 and b.dim() <= 2 else "BmmBackward0" if a.dim() == 3 and b.dim() == 3 else "UnsafeViewBackward0")
    sa, sb = x.shape, y.shape

    def bw(g):
        g = np.asarray(g)
        xa = x.reshape(1, -1) if x.ndim == 1 else x
        yb = y.reshape(-1, 1) if y.ndim == 1 else y
        gg = g
        if x.ndim == 1:
            gg = np.expand_dims(gg, -2)
        if y.ndim == 1:
            gg = np.expand_dims(gg, -1)
        ga = np.matmul(gg, np.swapaxes(yb, -1, -2))
        gb = np.matmul(np.swapaxes(xa, -1, -2), gg)
        ga = _unbroadcast(ga, xa.shape) if ga.ndim >= len(xa.shape) else ga
        gb = _unbroadcast(gb, yb.shape) if gb.ndim >= len(yb.shape) else gb
        return (ga.reshape(sa).astype(a._a.dtype), gb.reshape(sb).astype(b._a.dtype))
    return _make_result(r, a.dtype, [a, b], name, bw, saved=[a, b], dev=dev)


# ---------------------------------------------------------------- creating tensors

def _infer_dtype(data):
    """The dtype torch.tensor infers from Python data."""
    if isinstance(data, Tensor):
        return data.dtype
    if isinstance(data, np.ndarray):
        return _from_np(data.dtype)
    if isinstance(data, (np.generic,)):
        return _from_np(np.asarray(data).dtype)
    kinds = set()

    def walk(x):
        if isinstance(x, (list, tuple)):
            for v in x:
                walk(v)
        elif isinstance(x, Tensor):
            kinds.add(x.dtype)
        elif isinstance(x, (_bool, np.bool_)):
            kinds.add("b")
        elif isinstance(x, (numbers.Integral,)):
            kinds.add("i")
        elif isinstance(x, (numbers.Real,)):
            kinds.add("f")
        elif isinstance(x, numbers.Complex):
            kinds.add("c")
        else:
            raise TypeError(f"new(): invalid data type '{type(x).__name__}'")
    walk(data)
    if "c" in kinds:
        return complex64
    if "f" in kinds or _any(isinstance(k, dtype) and k.is_floating_point for k in kinds):
        return get_default_dtype()
    if "i" in kinds:
        return int64
    if kinds == {"b"}:
        return bool
    if not kinds:
        return get_default_dtype()
    d = [k for k in kinds if isinstance(k, dtype)]
    return d[0] if d else int64


def _to_np(data):
    if isinstance(data, Tensor):
        return data._a
    if isinstance(data, (list, tuple)):
        if data and _any(isinstance(x, Tensor) for x in data):
            if _all(isinstance(x, Tensor) and x.numel() == 1 for x in data):
                return np.array([x.item() for x in data])
            raise ValueError("only one element tensors can be converted to Python scalars")
        try:
            arr = np.array(data, dtype=object if False else None)
        except ValueError:
            raise ValueError(_ragged_message(data)) from None
        if arr.dtype == object:
            raise ValueError(_ragged_message(data))
        return arr
    return np.asarray(data)


def _ragged_message(data):
    def depth_shape(x, d=0):
        if isinstance(x, (list, tuple)):
            return [len(x)] + (depth_shape(x[0], d + 1) if x else [])
        return []
    shape = depth_shape(data)
    # find the first sequence whose length differs
    def find(x, dim):
        if not isinstance(x, (list, tuple)) or not x or not isinstance(x[0], (list, tuple)):
            return None
        first = len(x[0])
        for item in x:
            if isinstance(item, (list, tuple)) and len(item) != first:
                return dim + 1, len(item), first
            r = find(item, dim + 1)
            if r:
                return r
        return None
    r = find(data, 0)
    if r:
        dim, got, expected = r
        return f"expected sequence of length {expected} at dim {dim} (got {got})"
    return "setting an array element with a sequence."


def tensor(data, dtype=None, device=None, requires_grad=False, pin_memory=False):
    if isinstance(data, Tensor):
        warnings.warn("To copy construct from a tensor, it is recommended to use sourceTensor.detach().clone() or sourceTensor.detach().clone().requires_grad_(True), rather than torch.tensor(sourceTensor).", UserWarning, stacklevel=2)
        arr = data._a.copy()
        dt = dtype or data.dtype
    else:
        dt = dtype or _infer_dtype(data)
        arr = _to_np(data)
        if isinstance(data, str):
            raise TypeError("new(): invalid data type 'str'")
    out = Tensor._wrap(_cast(arr, dt).copy(), dt, _parse_device(device))
    if requires_grad:
        if not (dt.is_floating_point or dt.is_complex):
            raise RuntimeError("Only Tensors of floating point and complex dtype can require gradients")
        out.requires_grad = True
    return out


def as_tensor(data, dtype=None, device=None):
    if isinstance(data, Tensor):
        return data.to(dtype=dtype or data.dtype, device=device or data.device)
    if isinstance(data, np.ndarray) and (dtype is None or dtype.np == data.dtype) and _parse_device(device).type == "cpu":
        return from_numpy(data)
    return tensor(data, dtype=dtype, device=device)


def asarray(obj, dtype=None, device=None, copy=None, requires_grad=False):
    t = as_tensor(obj, dtype=dtype, device=device)
    if copy:
        t = t.clone()
    if requires_grad:
        t.requires_grad_(True)
    return t


def from_numpy(arr):
    if not isinstance(arr, np.ndarray):
        raise TypeError(f"expected np.ndarray (got {type(arr).__name__})")
    dt = _from_np(arr.dtype)
    return Tensor._wrap(arr, dt, _CPU)


def _size_args(size):
    if len(size) == 1 and isinstance(size[0], (tuple, list, Size)):
        size = tuple(size[0])
    for s in size:
        if not isinstance(s, (_int, np.integer)) or isinstance(s, _bool):
            if isinstance(s, Tensor):
                continue
            raise TypeError(f"zeros(): argument 'size' (position 1) must be tuple of ints, but found element of type {type(s).__name__} at pos 0")
        if s < 0:
            raise RuntimeError(f"Trying to create tensor with negative dimension {s}: [{', '.join(map(str, size))}]")
    return tuple(_int(s) for s in size)


def _factory(arr, dt, device, requires_grad):
    out = Tensor._wrap(arr, dt, _parse_device(device))
    if requires_grad:
        if not (dt.is_floating_point or dt.is_complex):
            raise RuntimeError("Only Tensors of floating point and complex dtype can require gradients")
        out.requires_grad = True
    return out


def zeros(*size, dtype=None, device=None, requires_grad=False, out=None):
    dt = dtype or get_default_dtype()
    return _factory(np.zeros(_size_args(size), dtype=dt.np), dt, device, requires_grad)


def ones(*size, dtype=None, device=None, requires_grad=False, out=None):
    dt = dtype or get_default_dtype()
    return _factory(np.ones(_size_args(size), dtype=dt.np), dt, device, requires_grad)


def empty(*size, dtype=None, device=None, requires_grad=False, memory_format=None, out=None):
    return zeros(*size, dtype=dtype, device=device, requires_grad=requires_grad)


def full(size, fill_value, dtype=None, device=None, requires_grad=False):
    if dtype is None:
        dtype = _infer_dtype(fill_value) if not isinstance(fill_value, Tensor) else fill_value.dtype
    v = fill_value.item() if isinstance(fill_value, Tensor) else fill_value
    return _factory(_cast(np.full(_size_args((size,) if isinstance(size, _int) else (tuple(size),)), v), dtype), dtype, device, requires_grad)


def _like(t, dtype, device):
    return dtype or t.dtype, device or t.device


def zeros_like(t, dtype=None, device=None, requires_grad=False, memory_format=None):
    dt, dev = _like(t, dtype, device)
    return zeros(*t.shape, dtype=dt, device=dev, requires_grad=requires_grad)


def ones_like(t, dtype=None, device=None, requires_grad=False, memory_format=None):
    dt, dev = _like(t, dtype, device)
    return ones(*t.shape, dtype=dt, device=dev, requires_grad=requires_grad)


def empty_like(t, dtype=None, device=None, requires_grad=False, memory_format=None):
    return zeros_like(t, dtype=dtype, device=device, requires_grad=requires_grad)


def full_like(t, fill_value, dtype=None, device=None, requires_grad=False, memory_format=None):
    dt, dev = _like(t, dtype, device)
    return full(tuple(t.shape), fill_value, dtype=dt, device=dev, requires_grad=requires_grad)


def rand(*size, generator=None, dtype=None, device=None, requires_grad=False):
    dt = dtype or get_default_dtype()
    if not dt.is_floating_point:
        raise NotImplementedError(f'"check_uniform_bounds" not implemented for \'{_tname(dt)}\'')
    sz = _size_args(size)
    n = _int(np.prod(sz, dtype=np.int64))
    arr = _gen(generator).uniform(n, double=dt is float64).reshape(sz)
    return _factory(_cast(arr, dt), dt, device, requires_grad)


def randn(*size, generator=None, dtype=None, device=None, requires_grad=False):
    dt = dtype or get_default_dtype()
    if not dt.is_floating_point:
        raise NotImplementedError(f'"normal_kernel_cpu" not implemented for \'{_tname(dt)}\'')
    sz = _size_args(size)
    n = _int(np.prod(sz, dtype=np.int64))
    arr = _gen(generator).normal(n, float32=dt is not float64).reshape(sz)
    return _factory(_cast(arr, dt), dt, device, requires_grad)


def rand_like(t, dtype=None, device=None, requires_grad=False):
    return rand(*t.shape, dtype=dtype or t.dtype, device=device or t.device, requires_grad=requires_grad)


def randn_like(t, dtype=None, device=None, requires_grad=False):
    return randn(*t.shape, dtype=dtype or t.dtype, device=device or t.device, requires_grad=requires_grad)


def randint(low, high=None, size=None, *, generator=None, dtype=None, device=None, requires_grad=False):
    if size is None and isinstance(high, (tuple, list, Size)):
        low, high, size = 0, low, high
    elif high is None:
        raise TypeError("randint() received an invalid combination of arguments - got (int), but expected one of:\n * (int high, tuple of ints size, *, torch.Generator generator, tensor out = None, torch.dtype dtype = None, torch.layout layout = None, torch.device device = None, bool pin_memory = False, bool requires_grad = False)\n * (int low, int high, tuple of ints size, *, torch.Generator generator, tensor out = None, torch.dtype dtype = None, torch.layout layout = None, torch.device device = None, bool pin_memory = False, bool requires_grad = False)")
    if size is None:
        raise TypeError("randint() missing 1 required positional arguments: \"size\"")
    sz = _size_args((tuple(size),))
    n = _int(np.prod(sz, dtype=np.int64))
    dt = dtype or int64
    arr = _gen(generator).randint(n, low, high).reshape(sz)
    return _factory(_cast(arr, dt), dt, device, requires_grad)


def randint_like(t, low, high=None, dtype=None, device=None):
    if high is None:
        low, high = 0, low
    return randint(low, high, tuple(t.shape), dtype=dtype or t.dtype, device=device or t.device)


def randperm(n, *, generator=None, dtype=None, device=None, requires_grad=False):
    return _factory(_gen(generator).randperm(_int(n)), dtype or int64, device, requires_grad)


def normal(mean, std=1.0, size=None, *, generator=None, dtype=None, device=None):
    if isinstance(mean, Tensor) or isinstance(std, Tensor):
        m = mean if isinstance(mean, Tensor) else full_like(std, mean)
        s = std if isinstance(std, Tensor) else full_like(m, std)
        z = randn(*m.shape, generator=generator, dtype=m.dtype)
        return z * s + m
    return randn(*size, generator=generator, dtype=dtype, device=device) * std + mean


def bernoulli(input, p=None, generator=None):
    probs = input._a if p is None else np.full(input._a.shape, p)
    u = _gen(generator).uniform(input.numel(), double=input.dtype is float64).reshape(input._a.shape)
    return Tensor._wrap((u < probs).astype(input._a.dtype), input.dtype, input.device)


def multinomial(input, num_samples, replacement=False, *, generator=None):
    """Draw category indexes with probabilities proportional to input's rows.
    With replacement this follows ATen's CPU kernel (a cumulative sum and a binary search per uniform draw), so
    seeded results match PyTorch. Without replacement PyTorch draws exponential noise with an MKL kernel that the
    sandbox can't copy: the results are valid samples, but not the same numbers as real PyTorch."""
    if input.dim() not in (1, 2):
        raise RuntimeError("prob_dist must be 1 or 2 dim")
    if not input.dtype.is_floating_point:
        raise RuntimeError("multinomial only supports floating-point dtypes for input")
    if num_samples <= 0:
        raise RuntimeError("cannot sample n_sample <= 0 samples")
    p = input._a
    rows = p.reshape(-1, p.shape[-1])
    n_cat = rows.shape[1]
    if not replacement and num_samples > n_cat:
        raise RuntimeError("cannot sample n_sample > prob_dist.size(-1) samples without replacement")
    if (rows < 0).any() or not np.isfinite(rows).all():
        raise RuntimeError("probability tensor contains either `inf`, `nan` or element < 0")
    g = _gen(generator)
    out = np.zeros((rows.shape[0], num_samples), dtype=np.int64)
    for r, row in enumerate(rows):
        if row.sum() <= 0:
            raise RuntimeError("invalid multinomial distribution (sum of probabilities <= 0)")
        if replacement:
            cum = np.cumsum(row.astype(row.dtype))
            total = cum[-1]
            cum = cum / total
            for k in range(num_samples):
                u = _float(g.uniform(1, double=True)[0])
                lo, hi = 0, n_cat
                while hi - lo > 0:
                    mid = lo + (hi - lo) // 2
                    if cum[mid] < u:
                        lo = mid + 1
                    else:
                        hi = mid
                out[r, k] = lo
        else:
            q = -np.log1p(-g.uniform(n_cat, double=True))
            keys = np.where(row > 0, row / q, -1.0)
            out[r] = np.argsort(-keys, kind="stable")[:num_samples]
    return Tensor._wrap(out.reshape(p.shape[:-1] + (num_samples,)) if p.ndim > 1 else out[0], int64, input.device)

def arange(start, end=None, step=1, *, dtype=None, device=None, requires_grad=False):
    if end is None:
        start, end = 0, start
    vals = [x.item() if isinstance(x, Tensor) else x for x in (start, end, step)]
    if step == 0:
        raise RuntimeError("step must be nonzero")
    if dtype is None:
        dtype = get_default_dtype() if _any(isinstance(v, _float) for v in vals) else int64
    start, end, step = vals
    if (end - start) / step < 0:
        raise RuntimeError(f"upper bound and larger bound inconsistent with step sign")
    n = _int(math.ceil((end - start) / step))
    arr = (np.arange(n, dtype=np.float64) * step + start)
    return _factory(_cast(arr, dtype), dtype, device, requires_grad)


def linspace(start, end, steps, *, dtype=None, device=None, requires_grad=False):
    dt = dtype or get_default_dtype()
    if steps < 0:
        raise RuntimeError("number of steps must be non-negative")
    arr = np.linspace(start, end, steps, dtype=np.float64)
    if steps > 1 and dt.is_floating_point:
        # PyTorch's CPU kernel works in the output dtype: the first half counts up from start, the second half
        # counts down from end (so linspace(-1, 1, 7) has -2.9802e-08 in the middle, not 0)
        ft = np.float64 if dt is float64 else np.float32
        st, en = ft(start), ft(end)
        step = (en - st) / ft(steps - 1)
        half = steps // 2
        idx = np.arange(steps).astype(ft)
        wide = np.longdouble if ft is np.float64 else np.float64      # the vectorized kernel uses fused multiply-add
        k = np.arange(steps).astype(wide)
        stw, enw, stepw = wide(st), wide(en), wide(step)
        arr = np.where(np.arange(steps) < half, stw + stepw * k, enw - stepw * (wide(steps - 1) - k)).astype(ft)
    return _factory(_cast(arr, dt), dt, device, requires_grad)


def logspace(start, end, steps, base=10.0, *, dtype=None, device=None):
    return _factory(_cast(np.logspace(start, end, steps, base=base), dtype or get_default_dtype()), dtype or get_default_dtype(), device, False)


def eye(n, m=None, *, dtype=None, device=None, requires_grad=False):
    dt = dtype or get_default_dtype()
    return _factory(np.eye(n, m if m is not None else n, dtype=dt.np), dt, device, requires_grad)


# ---------------------------------------------------------------- joining and splitting

def cat(tensors, dim=0, *, out=None):
    tensors = list(tensors)
    if not tensors:
        raise RuntimeError("torch.cat(): expected a non-empty list of Tensors")
    for i, t in enumerate(tensors):
        if not isinstance(t, Tensor):
            raise TypeError(f"expected Tensor as element {i} in argument 0, but got {type(t).__name__}")
    nonempty = [t for t in tensors if not (t.dim() == 1 and t.numel() == 0)]
    ref = nonempty[0] if nonempty else tensors[0]
    if ref.dim() == 0:
        raise RuntimeError("zero-dimensional tensor (at position 0) cannot be concatenated")
    d = ref._dim(dim)
    _device_check(*nonempty) if len({str(t.device) for t in nonempty}) > 1 else None
    if len({str(t.device) for t in nonempty}) > 1:
        raise RuntimeError(f"Expected all tensors to be on the same device, but found at least two devices, {_cuda_first(nonempty[0].device, [t.device for t in nonempty if t.device != nonempty[0].device][0])}!")
    for i, t in enumerate(nonempty):
        if t.dim() != ref.dim():
            raise RuntimeError(f"Tensors must have same number of dimensions: got {ref.dim()} and {t.dim()}")
        for k in range(ref.dim()):
            if k != d and t.shape[k] != ref.shape[k]:
                raise RuntimeError(f"Sizes of tensors must match except in dimension {d}. Expected size {ref.shape[k]} but got size {t.shape[k]} for tensor number {i} in the list.")
    rt = nonempty[0].dtype
    for t in nonempty[1:]:
        rt = promote_types(rt, t.dtype)
    arr = np.concatenate([_cast(t._a, rt) for t in nonempty], axis=d)
    sizes = [t.shape[d] for t in nonempty]

    def bw(g):
        parts = np.split(np.asarray(g), np.cumsum(sizes)[:-1], axis=d)
        return tuple(parts)
    return _make_result(arr, rt, nonempty, "CatBackward0", bw)


concat = concatenate = cat


def stack(tensors, dim=0, *, out=None):
    tensors = list(tensors)
    if not tensors:
        raise RuntimeError("stack expects a non-empty TensorList")
    ref = tensors[0]
    for i, t in enumerate(tensors):
        if t.shape != ref.shape:
            raise RuntimeError(f"stack expects each tensor to be equal size, but got [{', '.join(map(str, ref.shape))}] at entry 0 and [{', '.join(map(str, t.shape))}] at entry {i}")
    d = ref._dim(dim, ref.dim() + 1)
    return cat([t.unsqueeze(d) for t in tensors], d) if False else _stack(tensors, d)


def _stack(tensors, d):
    rt = tensors[0].dtype
    for t in tensors[1:]:
        rt = promote_types(rt, t.dtype)
    if len({str(t.device) for t in tensors}) > 1:
        raise RuntimeError(f"Expected all tensors to be on the same device, but found at least two devices, {_cuda_first(tensors[0].device, [t.device for t in tensors if t.device != tensors[0].device][0])}!")
    arr = np.stack([_cast(t._a, rt) for t in tensors], axis=d)

    def bw(g):
        return tuple(np.take(np.asarray(g), i, axis=d) for i in range(len(tensors)))
    return _make_result(arr, rt, tensors, "StackBackward0", bw)


def hstack(tensors):
    return cat(tensors, 0 if tensors[0].dim() == 1 else 1)


def vstack(tensors):
    return cat([t.reshape(1, -1) if t.dim() == 1 else t for t in tensors], 0)


def split(t, split_size_or_sections, dim=0):
    d = t._dim(dim)
    n = t.shape[d]
    if isinstance(split_size_or_sections, _int):
        s = split_size_or_sections
        if s <= 0 and n > 0:
            raise RuntimeError(f"split_size can only be 0 if dimension size is 0, but got dimension size of {n}")
        bounds = list(range(0, n, s))
        sizes = [_min(s, n - b) for b in bounds]
    else:
        sizes = list(split_size_or_sections)
        if _sum(sizes) != n:
            raise RuntimeError(f"split_with_sizes expects split_sizes to sum exactly to {n} (input tensor's size at dimension {d}), but got split_sizes=[{', '.join(map(str, sizes))}]")
    out, start = [], 0
    for sz in sizes:
        out.append(t.narrow(d, start, sz))
        start += sz
    return tuple(out)


def chunk(t, chunks, dim=0):
    d = t._dim(dim)
    n = t.shape[d]
    size = -(-n // chunks) if chunks else n
    return split(t, size, d) if size > 0 else (t,)


def tensor_split(t, indices_or_sections, dim=0):
    d = t._dim(dim)
    parts = np.array_split(np.arange(t.shape[d]), indices_or_sections)
    return tuple(t.narrow(d, _int(p[0]) if len(p) else 0, len(p)) for p in parts)


def unbind(t, dim=0):
    return t.unbind(dim)


def where(condition, input=None, other=None):
    if input is None and other is None:
        return condition.nonzero(as_tuple=True)
    xs = [x for x in (input, other) if isinstance(x, Tensor)]
    dev = _device_check(condition, *xs)
    rt = _result_type(input, other)
    a, b = _as_operand(input, rt, dev), _as_operand(other, rt, dev)
    c = condition._a.astype(_bool)
    r = np.where(c, a, b)

    def bw(g):
        g = np.asarray(g)
        return (None, _unbroadcast(np.where(c, g, 0), a.shape) if isinstance(input, Tensor) else None, _unbroadcast(np.where(c, 0, g), b.shape) if isinstance(other, Tensor) else None)
    return _make_result(r, rt, [None, input if isinstance(input, Tensor) else None, other if isinstance(other, Tensor) else None], "WhereBackward0", bw, dev=dev)


def gather(input, dim, index):
    d = input._dim(dim)
    ix = index._a.astype(np.int64)
    r = np.take_along_axis(input._a, ix, axis=d)
    shape = input._a.shape

    def bw(g):
        full_g = np.zeros(shape, dtype=np.asarray(g).dtype)
        np.add.at(full_g, tuple(ix if k == d else np.indices(ix.shape)[k] for k in range(len(shape))), np.asarray(g))
        return (full_g,)
    return _make_result(r, input.dtype, [input], "GatherBackward0", bw)


def meshgrid(*tensors, indexing=None):
    if indexing is None:
        warnings.warn("torch.meshgrid: in an upcoming release, it will be required to pass the indexing argument.", UserWarning, stacklevel=2)
        indexing = "ij"
    if len(tensors) == 1 and isinstance(tensors[0], (list, tuple)):
        tensors = tensors[0]
    grids = np.meshgrid(*[t._a for t in tensors], indexing=indexing)
    return tuple(Tensor._wrap(g.copy(), tensors[0].dtype, tensors[0].device) for g in grids)


def is_tensor(obj):
    return isinstance(obj, Tensor)


def is_floating_point(t):
    return t.dtype.is_floating_point


def is_complex(t):
    return t.dtype.is_complex


def numel(t):
    return t.numel()


def result_type(a, b):
    return _result_type(a, b)


def can_cast(from_, to):
    return _CAT[from_._kind] <= _CAT[to._kind]


class finfo:
    _INFO = {"float32": (1.1920928955078125e-07, 3.4028234663852886e+38, 1.1754943508222875e-38, 6, 32),
             "float64": (2.220446049250313e-16, 1.7976931348623157e+308, 2.2250738585072014e-308, 15, 64),
             "float16": (0.0009765625, 65504.0, 6.103515625e-05, 3, 16),
             "bfloat16": (0.0078125, 3.3895313892515355e+38, 1.1754943508222875e-38, 2, 16)}

    def __init__(self, type=None):
        type = type or get_default_dtype()
        self.dtype = type.name
        self.eps, self.max, self.smallest_normal, self.resolution_digits, self.bits = self._INFO[type.name]
        self.min = -self.max
        self.tiny = self.smallest_normal
        self.resolution = 10.0 ** -self.resolution_digits

    def __repr__(self):
        return f"finfo(resolution={self.resolution:g}, min={self.min:g}, max={self.max:g}, eps={self.eps:g}, smallest_normal={self.smallest_normal:g}, tiny={self.tiny:g}, dtype={self.dtype})"


class iinfo:
    def __init__(self, type):
        i = np.iinfo(type.np) if type is not bool else None
        self.bits = type.itemsize * 8
        self.min, self.max = (_int(i.min), _int(i.max)) if i else (0, 1)
        self.dtype = type.name

    def __repr__(self):
        return f"iinfo(min={self.min:g}, max={self.max:g}, dtype={self.dtype})"


for _cls in (Tensor, Size, device, dtype, Generator, finfo, iinfo, no_grad, enable_grad, set_grad_enabled, inference_mode):
    _cls.__module__ = "torch"
del _cls


# ---------------------------------------------------------------- autocast (mixed precision)

_AUTOCAST = {"cuda": [False, float16], "cpu": [False, bfloat16]}


def _ac_cast(x, kind, devices):
    if not isinstance(x, Tensor):
        return x
    st = _AUTOCAST.get(x.device.type)
    if st is None or not st[0] or x.device.type not in devices:
        return x
    if not x.dtype.is_floating_point or x.dtype is float64:
        return x
    target = st[1] if kind == "lower" else float32
    return x if x.dtype is target else x.to(target)


def _autocast_op(kind, devices=("cuda", "cpu")):
    """Wrap an operation so that, inside torch.autocast, its tensor arguments are cast first (PyTorch's op lists)."""
    def deco(fn):
        import functools

        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            if not (_AUTOCAST["cuda"][0] or _AUTOCAST["cpu"][0]):
                return fn(*args, **kwargs)
            args = [_ac_cast(a, kind, devices) for a in args]
            kwargs = {k: _ac_cast(v, kind, devices) for k, v in kwargs.items()}
            return fn(*args, **kwargs)
        wrapper._autocast = kind
        return wrapper
    return deco


matmul = _autocast_op("lower")(matmul)
for _name in ("softmax", "log_softmax", "sum", "prod", "cumsum", "exp", "log", "log2", "log10", "log1p", "expm1",
              "pow", "__pow__", "reciprocal", "rsqrt", "tan", "sinh", "cosh", "asin", "acos", "norm"):
    setattr(Tensor, _name, _autocast_op("fp32", ("cuda",) if _name not in ("prod",) else ("cuda", "cpu"))(getattr(Tensor, _name)))
del _name
