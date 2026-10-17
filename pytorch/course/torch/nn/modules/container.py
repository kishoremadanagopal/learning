"""Containers: Sequential, ModuleList and ModuleDict."""
from collections import OrderedDict

from .module import Module, _addindent

__all__ = ["Sequential", "ModuleList", "ModuleDict"]


class Sequential(Module):
    """Runs its modules in order, feeding each one's output to the next."""

    def __init__(self, *args):
        super().__init__()
        if len(args) == 1 and isinstance(args[0], OrderedDict):
            for key, module in args[0].items():
                self.add_module(key, module)
        else:
            for idx, module in enumerate(args):
                self.add_module(str(idx), module)

    def _get_item_by_idx(self, idx):
        size = len(self)
        if not -size <= idx < size:
            raise IndexError(f"index {idx} is out of range")
        return list(self._modules.values())[idx % size]

    def __getitem__(self, idx):
        if isinstance(idx, slice):
            return self.__class__(OrderedDict(list(self._modules.items())[idx]))
        return self._get_item_by_idx(idx)

    def __setitem__(self, idx, module):
        key = list(self._modules.keys())[idx]
        setattr(self, key, module)

    def __delitem__(self, idx):
        keys = list(self._modules.keys())
        for key in (keys[idx] if isinstance(idx, slice) else [keys[idx]]):
            delattr(self, key)
        mods = list(self._modules.values())
        self._modules.clear()
        for i, m in enumerate(mods):
            self._modules[str(i)] = m

    def __len__(self):
        return len(self._modules)

    def __iter__(self):
        return iter(self._modules.values())

    def append(self, module):
        self.add_module(str(len(self)), module)
        return self

    def extend(self, modules):
        for m in modules:
            self.append(m)
        return self

    def insert(self, index, module):
        mods = list(self._modules.values())
        mods.insert(index, module)
        self._modules.clear()
        for i, m in enumerate(mods):
            self._modules[str(i)] = m
        return self

    def forward(self, input):
        for module in self:
            input = module(input)
        return input


class ModuleList(Module):
    """A list of modules that registers them (a plain Python list would hide them from parameters())."""

    def __init__(self, modules=None):
        super().__init__()
        if modules is not None:
            self.extend(modules)

    def __getitem__(self, idx):
        if isinstance(idx, slice):
            return self.__class__(list(self._modules.values())[idx])
        n = len(self)
        if not -n <= idx < n:
            raise IndexError(f"index {idx} is out of range")
        return self._modules[str(idx % n)]

    def __setitem__(self, idx, module):
        setattr(self, str(idx % len(self)), module)

    def __len__(self):
        return len(self._modules)

    def __iter__(self):
        return iter(self._modules.values())

    def __iadd__(self, modules):
        return self.extend(modules)

    def append(self, module):
        self.add_module(str(len(self)), module)
        return self

    def extend(self, modules):
        for m in modules:
            self.append(m)
        return self

    def insert(self, index, module):
        mods = list(self._modules.values())
        mods.insert(index, module)
        self._modules.clear()
        for i, m in enumerate(mods):
            self._modules[str(i)] = m

    def __repr__(self):
        # like PyTorch, repeated identical modules are shown once: (0-2): 3 x Linear(...)
        list_of_reprs = [repr(item) for item in self]
        if len(list_of_reprs) == 0:
            return self._get_name() + "()"
        start_end_indices = [[0, 0]]
        repeated_blocks = [list_of_reprs[0]]
        for i, r in enumerate(list_of_reprs[1:], 1):
            if r == repeated_blocks[-1]:
                start_end_indices[-1][1] += 1
                continue
            start_end_indices.append([i, i])
            repeated_blocks.append(r)
        lines = []
        main_str = self._get_name() + "("
        for (start_id, end_id), b in zip(start_end_indices, repeated_blocks):
            local_repr = f"({start_id}): {b}"
            if start_id != end_id:
                n = end_id - start_id + 1
                local_repr = f"({start_id}-{end_id}): {n} x {b}"
            local_repr = _addindent(local_repr, 2)
            lines.append(local_repr)
        main_str += "\n  " + "\n  ".join(lines) + "\n"
        return main_str + ")"

    def forward(self, *a):
        raise NotImplementedError("ModuleList has no forward(): loop over its modules in your own forward().")


class ModuleDict(Module):
    def __init__(self, modules=None):
        super().__init__()
        if modules is not None:
            for k, m in dict(modules).items():
                self.add_module(k, m)

    def __getitem__(self, key):
        return self._modules[key]

    def __setitem__(self, key, module):
        self.add_module(key, module)

    def __len__(self):
        return len(self._modules)

    def __iter__(self):
        return iter(self._modules)

    def __contains__(self, key):
        return key in self._modules

    def keys(self):
        return self._modules.keys()

    def items(self):
        return self._modules.items()

    def values(self):
        return self._modules.values()


for _c in (Sequential, ModuleList, ModuleDict):
    _c.__module__ = "torch.nn.modules.container"
