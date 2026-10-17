"""nn.Module: the base class of every layer and model."""
from collections import OrderedDict, namedtuple

from ... import _core
from ..._core import Tensor
from ..parameter import Parameter

__all__ = ["Module"]


def _addindent(s_, numSpaces):
    s = s_.split("\n")
    if len(s) == 1:
        return s_
    first = s.pop(0)
    s = [(numSpaces * " ") + line for line in s]
    return first + "\n" + "\n".join(s)


class _IncompatibleKeys(namedtuple("IncompatibleKeys", ["missing_keys", "unexpected_keys"])):
    __slots__ = ()

    def __repr__(self):
        if not self.missing_keys and not self.unexpected_keys:
            return "<All keys matched successfully>"
        return super().__repr__()

    __str__ = __repr__


_IncompatibleKeys.__name__ = "_IncompatibleKeys"


class _RemovableHandle:
    def __init__(self, store, key):
        self._store, self._key = store, key

    def remove(self):
        self._store.pop(self._key, None)


_hook_ids = [0]


def _typename(v):
    if isinstance(v, Tensor):
        return "torch.nn.Parameter" if isinstance(v, Parameter) else "torch.FloatTensor" if v.dtype is _core.float32 else "torch." + _core._tname(v.dtype) + "Tensor"
    mod = type(v).__module__
    return (mod + "." if mod not in ("builtins", "__main__") else "") + type(v).__qualname__


class Module:
    """Base class for all neural network modules. Subclass it, create layers in __init__ (after
    super().__init__()), and define forward(). Calling the module runs forward() (plus any hooks)."""

    training: bool
    _version = 1
    call_super_init = False

    def __init__(self, *args, **kwargs):
        if args or kwargs:
            raise TypeError(f"{type(self).__name__}.__init__() got an unexpected argument")
        sa = object.__setattr__
        sa(self, "training", True)
        sa(self, "_parameters", {})
        sa(self, "_buffers", {})
        sa(self, "_non_persistent_buffers_set", set())
        sa(self, "_modules", {})
        sa(self, "_forward_hooks", OrderedDict())
        sa(self, "_forward_pre_hooks", OrderedDict())
        sa(self, "_backward_hooks", OrderedDict())

    # ---- calling
    def forward(self, *input):
        raise NotImplementedError(f'Module [{type(self).__name__}] is missing the required "forward" function')

    def __call__(self, *args, **kwargs):
        for hook in list(self.__dict__.get("_forward_pre_hooks", {}).values()):
            r = hook(self, args)
            if r is not None:
                args = r if isinstance(r, tuple) else (r,)
        out = self.forward(*args, **kwargs)
        for hook in list(self.__dict__.get("_forward_hooks", {}).values()):
            r = hook(self, args, out)
            if r is not None:
                out = r
        return out

    _call_impl = __call__

    def register_forward_hook(self, hook, *, prepend=False, with_kwargs=False, always_call=False):
        _hook_ids[0] += 1
        self._forward_hooks[_hook_ids[0]] = hook
        return _RemovableHandle(self._forward_hooks, _hook_ids[0])

    def register_forward_pre_hook(self, hook, *, prepend=False, with_kwargs=False):
        _hook_ids[0] += 1
        self._forward_pre_hooks[_hook_ids[0]] = hook
        return _RemovableHandle(self._forward_pre_hooks, _hook_ids[0])

    # ---- registration
    def register_parameter(self, name, param):
        if "_parameters" not in self.__dict__:
            raise AttributeError("cannot assign parameter before Module.__init__() call")
        if not isinstance(name, str):
            raise TypeError(f"parameter name should be a string. Got {type(name).__name__}")
        if "." in name:
            raise KeyError('parameter name can\'t contain "."')
        if name == "":
            raise KeyError('parameter name can\'t be empty string ""')
        if hasattr(self, name) and name not in self._parameters:
            raise KeyError(f"attribute '{name}' already exists")
        if param is None:
            self._parameters[name] = None
            return
        if not isinstance(param, Parameter):
            raise TypeError(f"cannot assign '{_typename(param)}' object to parameter '{name}' (torch.nn.Parameter or None required)")
        if param.grad_fn is not None:
            raise ValueError(f"Cannot assign non-leaf Tensor to parameter '{name}'. Model parameters must be created explicitly. To express '{name}' as a function of another Tensor, compute the value in the forward() method.")
        self._parameters[name] = param

    def register_buffer(self, name, tensor, persistent=True):
        if "_buffers" not in self.__dict__:
            raise AttributeError("cannot assign buffer before Module.__init__() call")
        if "." in name:
            raise KeyError('buffer name can\'t contain "."')
        if hasattr(self, name) and name not in self._buffers:
            raise KeyError(f"attribute '{name}' already exists")
        if tensor is not None and not isinstance(tensor, Tensor):
            raise TypeError(f"cannot assign '{_typename(tensor)}' object to buffer '{name}' (torch Tensor or None required)")
        self._buffers[name] = tensor
        if persistent:
            self._non_persistent_buffers_set.discard(name)
        else:
            self._non_persistent_buffers_set.add(name)

    def add_module(self, name, module):
        if not isinstance(module, Module) and module is not None:
            raise TypeError(f"{_typename(module)} is not a Module subclass")
        if hasattr(self, name) and name not in self._modules:
            raise KeyError(f"attribute '{name}' already exists")
        if "." in name:
            raise KeyError(f'module name can\'t contain ".", got: {name}')
        self._modules[name] = module

    register_module = add_module

    def __setattr__(self, name, value):
        def remove_from(*dicts):
            for d in dicts:
                if name in d:
                    del d[name]
        params = self.__dict__.get("_parameters")
        if isinstance(value, Parameter):
            if params is None:
                raise AttributeError("cannot assign parameters before Module.__init__() call")
            remove_from(self.__dict__, self._buffers, self._modules, self._non_persistent_buffers_set)
            self.register_parameter(name, value)
        elif params is not None and name in params:
            if value is not None:
                raise TypeError(f"cannot assign '{_typename(value)}' as parameter '{name}' (torch.nn.Parameter or None expected)")
            self.register_parameter(name, value)
        else:
            modules = self.__dict__.get("_modules")
            if isinstance(value, Module):
                if modules is None:
                    raise AttributeError("cannot assign module before Module.__init__() call")
                remove_from(self.__dict__, self._parameters, self._buffers, self._non_persistent_buffers_set)
                modules[name] = value
            elif modules is not None and name in modules:
                if value is not None:
                    raise TypeError(f"cannot assign '{_typename(value)}' as child module '{name}' (torch.nn.Module or None expected)")
                modules[name] = value
            else:
                buffers = self.__dict__.get("_buffers")
                if buffers is not None and name in buffers:
                    if value is not None and not isinstance(value, Tensor):
                        raise TypeError(f"cannot assign '{_typename(value)}' as buffer '{name}' (torch.Tensor or None expected)")
                    buffers[name] = value
                else:
                    object.__setattr__(self, name, value)

    def __getattr__(self, name):
        d = self.__dict__
        for store in ("_parameters", "_buffers", "_modules"):
            s = d.get(store)
            if s is not None and name in s:
                return s[name]
        raise AttributeError(f"'{type(self).__name__}' object has no attribute '{name}'")

    def __delattr__(self, name):
        for store in ("_parameters", "_buffers", "_modules"):
            s = self.__dict__.get(store)
            if s is not None and name in s:
                del s[name]
                self._non_persistent_buffers_set.discard(name)
                return
        object.__delattr__(self, name)

    def __dir__(self):
        return sorted(set(object.__dir__(self)) | set(self._parameters) | set(self._modules) | set(self._buffers))

    def __getstate__(self):
        return self.__dict__.copy()

    def __setstate__(self, state):
        self.__dict__.update(state)

    # ---- walking the tree
    def named_modules(self, memo=None, prefix="", remove_duplicate=True):
        if memo is None:
            memo = set()
        if self not in memo:
            if remove_duplicate:
                memo.add(self)
            yield prefix, self
            for name, module in self._modules.items():
                if module is None:
                    continue
                sub = prefix + ("." if prefix else "") + name
                yield from module.named_modules(memo, sub, remove_duplicate)

    def modules(self):
        for _, m in self.named_modules():
            yield m

    def named_children(self):
        memo = set()
        for name, module in self._modules.items():
            if module is not None and module not in memo:
                memo.add(module)
                yield name, module

    def children(self):
        for _, m in self.named_children():
            yield m

    def _named_members(self, get, prefix="", recurse=True, remove_duplicate=True):
        memo = set()
        mods = self.named_modules(prefix=prefix, remove_duplicate=remove_duplicate) if recurse else [(prefix, self)]
        for mod_prefix, mod in mods:
            for k, v in get(mod):
                if v is None or (remove_duplicate and id(v) in memo):
                    continue
                if remove_duplicate:
                    memo.add(id(v))
                yield mod_prefix + ("." if mod_prefix else "") + k, v

    def named_parameters(self, prefix="", recurse=True, remove_duplicate=True):
        yield from self._named_members(lambda m: m._parameters.items(), prefix, recurse, remove_duplicate)

    def parameters(self, recurse=True):
        for _, p in self.named_parameters(recurse=recurse):
            yield p

    def named_buffers(self, prefix="", recurse=True, remove_duplicate=True):
        yield from self._named_members(lambda m: m._buffers.items(), prefix, recurse, remove_duplicate)

    def buffers(self, recurse=True):
        for _, b in self.named_buffers(recurse=recurse):
            yield b

    def get_submodule(self, target):
        mod = self
        for item in target.split(".") if target else []:
            if item not in mod._modules:
                raise AttributeError(f"{mod._get_name()} has no attribute `{item}`")
            mod = mod._modules[item]
        return mod

    def get_parameter(self, target):
        mod_path, _, name = target.rpartition(".")
        mod = self.get_submodule(mod_path)
        if name not in mod._parameters:
            raise AttributeError(f"{mod._get_name()} has no parameter `{name}`")
        return mod._parameters[name]

    def apply(self, fn):
        for m in self.children():
            m.apply(fn)
        fn(self)
        return self

    # ---- modes
    def train(self, mode=True):
        if not isinstance(mode, bool):
            raise ValueError("training mode is expected to be boolean")
        self.training = mode
        for m in self.children():
            m.train(mode)
        return self

    def eval(self):
        return self.train(False)

    def requires_grad_(self, requires_grad=True):
        for p in self.parameters():
            p.requires_grad_(requires_grad)
        return self

    def zero_grad(self, set_to_none=True):
        for p in self.parameters():
            if p.grad is not None:
                if set_to_none:
                    p.grad = None
                else:
                    p.grad.zero_()

    # ---- moving and converting
    def _apply(self, fn):
        for m in self.children():
            m._apply(fn)
        for key, p in self._parameters.items():
            if p is None:
                continue
            with _core.no_grad():
                new = fn(p)
            if new is not p:
                p.data = new
            if p.grad is not None:
                g = fn(p.grad)
                if g is not p.grad:
                    p.grad.data = g
        for key, b in self._buffers.items():
            if b is not None:
                self._buffers[key] = fn(b)
        return self

    def to(self, *args, **kwargs):
        dev, dt = None, None
        non_blocking = kwargs.pop("non_blocking", False)
        for a in args:
            if isinstance(a, _core.dtype):
                dt = a
            elif isinstance(a, (str, _core.device, int)) and not isinstance(a, bool):
                dev = a
            elif isinstance(a, Tensor):
                dev, dt = a.device, a.dtype
        dev = kwargs.pop("device", dev)
        dt = kwargs.pop("dtype", dt)
        if dt is not None and not (dt.is_floating_point or dt.is_complex):
            raise TypeError(f"nn.Module.to only accepts floating point or complex dtypes, but got desired dtype={dt}")
        if dev is not None:
            dev = _core._parse_device(dev)

        def convert(t):
            return t.to(dev if dev is not None else t.device, dt if (dt is not None and t.is_floating_point()) else t.dtype)
        return self._apply(convert)

    def cuda(self, device=None):
        return self.to("cuda" if device is None else (f"cuda:{device}" if isinstance(device, int) else device))

    def cpu(self):
        return self.to("cpu")

    def type(self, dst_type):
        return self._apply(lambda t: t.to(dst_type))

    def float(self):
        return self._apply(lambda t: t.float() if t.is_floating_point() else t)

    def double(self):
        return self._apply(lambda t: t.double() if t.is_floating_point() else t)

    def half(self):
        return self._apply(lambda t: t.half() if t.is_floating_point() else t)

    def bfloat16(self):
        return self._apply(lambda t: t.bfloat16() if t.is_floating_point() else t)

    def share_memory(self):
        return self

    # ---- state dicts
    def state_dict(self, *args, destination=None, prefix="", keep_vars=False):
        if destination is None:
            destination = OrderedDict()
        for name, p in self._parameters.items():
            if p is not None:
                destination[prefix + name] = p if keep_vars else p.detach()
        for name, b in self._buffers.items():
            if b is not None and name not in self._non_persistent_buffers_set:
                destination[prefix + name] = b if keep_vars else b.detach()
        for name, m in self._modules.items():
            if m is not None:
                m.state_dict(destination=destination, prefix=prefix + name + ".", keep_vars=keep_vars)
        return destination

    def load_state_dict(self, state_dict, strict=True, assign=False):
        if not isinstance(state_dict, dict):
            raise TypeError(f"Expected state_dict to be dict-like, got {type(state_dict)}.")
        missing, unexpected, errors = [], [], []
        own = self.state_dict(keep_vars=True)
        for key, target in own.items():
            if key not in state_dict:
                missing.append(key)
                continue
            src = state_dict[key]
            if not isinstance(src, Tensor):
                errors.append(f'While copying the parameter named "{key}", expected torch.Tensor or Tensor-like object from checkpoint but received {type(src)}')
                continue
            if tuple(src.shape) != tuple(target.shape):
                errors.append(f"size mismatch for {key}: copying a param with shape {src.shape} from checkpoint, the shape in current model is {target.shape}.")
                continue
            with _core.no_grad():
                target.copy_(src)
        for key in state_dict:
            if key not in own:
                unexpected.append(key)
        if strict:
            if unexpected:
                errors.insert(0, "Unexpected key(s) in state_dict: {}. ".format(", ".join(f'"{k}"' for k in unexpected)))
            if missing:
                errors.insert(0, "Missing key(s) in state_dict: {}. ".format(", ".join(f'"{k}"' for k in missing)))
        if errors:
            raise RuntimeError("Error(s) in loading state_dict for {}:\n\t{}".format(type(self).__name__, "\n\t".join(errors)))
        return _IncompatibleKeys(missing, unexpected)

    # ---- printing
    def extra_repr(self):
        return ""

    def _get_name(self):
        return type(self).__name__

    def __repr__(self):
        extra_lines = []
        extra = self.extra_repr()
        if extra:
            extra_lines = extra.split("\n")
        child_lines = []
        for key, module in self._modules.items():
            mod_str = _addindent(repr(module), 2)
            child_lines.append("(" + key + "): " + mod_str)
        lines = extra_lines + child_lines
        main = self._get_name() + "("
        if lines:
            if len(extra_lines) == 1 and not child_lines:
                main += extra_lines[0]
            else:
                main += "\n  " + "\n  ".join(lines) + "\n"
        return main + ")"


Module.__module__ = "torch.nn.modules.module"
