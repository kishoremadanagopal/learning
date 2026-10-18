"""torch.profiler in the sandbox: records which operations ran, how often and for how long (CPU time), and prints
the same summary table as PyTorch's profiler.

The times are those of the sandbox's own Python implementation, so they say nothing about real PyTorch speed,
and there is no GPU timeline (ProfilerActivity.CUDA records nothing here). The API, the event names (aten::…,
autograd::engine::evaluate_function: …, Optimizer.step#…) and the table layout follow PyTorch 2.14."""
import enum
import functools
import json
import os
import time

from .. import _core

__all__ = ["profile", "record_function", "ProfilerActivity", "ProfilerAction", "schedule", "tensorboard_trace_handler"]


class ProfilerActivity(enum.Enum):
    CPU = 0
    XPU = 1
    MTIA = 2
    CUDA = 3
    HPU = 4
    PrivateUse1 = 5

    def __repr__(self):
        return f"<ProfilerActivity.{self.name}: {self.value}>"

    def __str__(self):
        return f"ProfilerActivity.{self.name}"


class ProfilerAction(enum.Enum):
    NONE = 0
    WARMUP = 1
    RECORD = 2
    RECORD_AND_SAVE = 3


def schedule(*, wait, warmup, active, repeat=0, skip_first=0, skip_first_wait=0):
    """Profile in cycles of wait → warmup → active steps (prof.step() moves to the next step)."""
    def schedule_fn(step):
        if step < skip_first:
            return ProfilerAction.NONE
        step -= skip_first
        num_steps = wait + warmup + active
        if repeat > 0 and step / num_steps >= repeat:
            return ProfilerAction.NONE
        mod_step = step % num_steps
        if mod_step < wait:
            return ProfilerAction.NONE
        if mod_step < wait + warmup:
            return ProfilerAction.WARMUP
        return ProfilerAction.RECORD if mod_step < num_steps - 1 else ProfilerAction.RECORD_AND_SAVE
    return schedule_fn


class _Event:
    __slots__ = ("name", "start", "end", "children", "parent", "shapes")

    def __init__(self, name, start, parent, shapes):
        self.name, self.start, self.end, self.children, self.parent, self.shapes = name, start, None, [], parent, shapes


_active = [None]          # the profile currently recording


def _now_us():
    return time.perf_counter() * 1e6


class _Range:
    def __init__(self, name, shapes=None):
        self.name, self.shapes = name, shapes

    def __enter__(self):
        p = _active[0]
        if p is not None and p._recording:
            parent = p._stack[-1] if p._stack else None
            ev = _Event(self.name, _now_us(), parent, (self.shapes or []) if p.record_shapes else None)
            (parent.children if parent else p._roots).append(ev)
            p._stack.append(ev)
            self.ev = ev
        else:
            self.ev = None
        return self

    def __exit__(self, *a):
        if self.ev is not None:
            self.ev.end = _now_us()
            p = _active[0]
            if p is not None and p._stack and p._stack[-1] is self.ev:
                p._stack.pop()
        return False


class record_function(_Range):
    """Label a region: with record_function("data loading"): … (also usable as a decorator)."""

    def __init__(self, name, args=None):
        super().__init__(name)

    def __call__(self, fn):
        @functools.wraps(fn)
        def wrapper(*a, **k):
            with record_function(self.name):
                return fn(*a, **k)
        return wrapper


def _shapes(args):
    out = []
    for a in args:
        out.append(list(a.shape) if isinstance(a, _core.Tensor) else [])
    return out


def _wrap(fn, name):
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        p = _active[0]
        if p is None or not p._recording:
            return fn(*args, **kwargs)
        with _Range(name, _shapes(args)):
            return fn(*args, **kwargs)
    wrapper._profiled = fn
    return wrapper


def _wrap_matmul(fn):
    """aten::matmul dispatches to the kernel that fits the shapes (mm, bmm, mv or dot), which shows as its child."""
    @functools.wraps(fn)
    def wrapper(a, b, *args, **kwargs):
        p = _active[0]
        if p is None or not p._recording:
            return fn(a, b, *args, **kwargs)
        da, db = getattr(a, "ndim", 0), getattr(b, "ndim", 0)
        inner = {(1, 1): "aten::dot", (2, 1): "aten::mv", (2, 2): "aten::mm"}.get((da, db), "aten::mm" if db == 2 else "aten::bmm")
        with _Range("aten::matmul", _shapes((a, b))):
            with _Range(inner, _shapes((a, b))):
                return fn(a, b, *args, **kwargs)
    wrapper._profiled = fn
    return wrapper


_TENSOR_OPS = {"add": "aten::add", "__add__": "aten::add", "__radd__": "aten::add", "sub": "aten::sub", "__sub__": "aten::sub",
               "__rsub__": "aten::rsub", "mul": "aten::mul", "__mul__": "aten::mul", "__rmul__": "aten::mul", "div": "aten::div",
               "__truediv__": "aten::div", "pow": "aten::pow", "__pow__": "aten::pow",
               "sum": "aten::sum", "mean": "aten::mean", "relu": "aten::relu", "sigmoid": "aten::sigmoid", "tanh": "aten::tanh",
               "exp": "aten::exp", "softmax": "aten::softmax", "log_softmax": "aten::log_softmax", "to": "aten::to",
               "copy_": "aten::copy_", "zero_": "aten::zero_", "fill_": "aten::fill_", "clone": "aten::clone",
               "view": "aten::view", "reshape": "aten::reshape", "t": "aten::t", "transpose": "aten::transpose",
               "flatten": "aten::flatten", "argmax": "aten::argmax", "item": "aten::item", "eq": "aten::eq",
               "__eq__": "aten::eq", "max": "aten::max", "abs": "aten::abs", "sqrt": "aten::sqrt", "add_": "aten::add_",
               "mul_": "aten::mul_", "addcmul_": "aten::addcmul_", "addcdiv_": "aten::addcdiv_"}
_patched = []


def _install():
    import torch
    from ..nn import functional as F
    from ..nn.modules import normalization
    from ..optim.optimizer import Optimizer
    from ..utils.data import _DataLoaderIter

    def patch(owner, attr, new):
        _patched.append((owner, attr, owner.__dict__[attr] if attr in owner.__dict__ else getattr(owner, attr)))
        setattr(owner, attr, new)

    for attr, name in _TENSOR_OPS.items():
        if hasattr(_core.Tensor, attr):
            patch(_core.Tensor, attr, _wrap(getattr(_core.Tensor, attr), name))
    patch(_core, "matmul", _wrap_matmul(_core.matmul))
    patch(torch, "matmul", _wrap_matmul(torch.matmul))
    for attr, name in (("linear", "aten::linear"), ("max_pool2d", "aten::max_pool2d"), ("avg_pool2d", "aten::avg_pool2d"),
                       ("adaptive_avg_pool2d", "aten::adaptive_avg_pool2d"), ("cross_entropy", "aten::cross_entropy_loss"),
                       ("mse_loss", "aten::mse_loss"), ("dropout", "aten::dropout"), ("nll_loss", "aten::nll_loss"),
                       ("scaled_dot_product_attention", "aten::scaled_dot_product_attention"), ("embedding", "aten::embedding")):
        patch(F, attr, _wrap(getattr(F, attr), name))
    patch(F, "conv2d", _wrap(F.conv2d, "aten::conv2d"))
    patch(F, "conv1d", _wrap(F.conv1d, "aten::conv1d"))
    patch(normalization.LayerNorm, "forward", _wrap(normalization.LayerNorm.forward, "aten::layer_norm"))
    patch(normalization.BatchNorm1d, "forward", _wrap(normalization.BatchNorm1d.forward, "aten::batch_norm"))
    for fn_name in ("zeros", "ones", "randn", "rand", "empty", "tensor", "stack", "cat"):
        patch(torch, fn_name, _wrap(getattr(torch, fn_name), "aten::" + fn_name))

    def subclasses(c):
        for s in c.__subclasses__():
            yield s
            yield from subclasses(s)
    for cls in set(subclasses(Optimizer)):
        if "step" in cls.__dict__:
            patch(cls, "step", _wrap(cls.__dict__["step"], f"Optimizer.step#{cls.__name__}.step"))
    patch(Optimizer, "zero_grad", _named_by_type(Optimizer.zero_grad, "Optimizer.zero_grad#{}.zero_grad"))
    patch(_DataLoaderIter, "__next__", _wrap(_DataLoaderIter.__next__, "enumerate(DataLoader)#_SingleProcessDataLoaderIter.__next__"))


def _named_by_type(fn, pattern):
    @functools.wraps(fn)
    def wrapper(self, *args, **kwargs):
        p = _active[0]
        if p is None or not p._recording:
            return fn(self, *args, **kwargs)
        with _Range(pattern.format(type(self).__name__)):
            return fn(self, *args, **kwargs)
    return wrapper


def _uninstall():
    while _patched:
        owner, attr, old = _patched.pop()
        setattr(owner, attr, old)


def _backward_range(node_name):
    """Used by the autograd engine for each node it runs while profiling."""
    p = _active[0]
    if p is None or not p._recording:
        return None
    return _Range("autograd::engine::evaluate_function: " + node_name), _Range(node_name)


# ---------------------------------------------------------------- results

def _format_time(us):
    if us >= 1e6:
        return f"{us / 1e6:.3f}s"
    if us >= 1e3:
        return f"{us / 1e3:.3f}ms"
    return f"{us:.3f}us"


def _format_time_share(t, total):
    if total == 0:
        return "NaN"
    return f"{t * 100.0 / total:.2f}%"


class FunctionEventAvg:
    def __init__(self, key, input_shapes=None):
        self.key, self.input_shapes = key, input_shapes
        self.count = 0
        self.cpu_time_total = 0.0
        self.self_cpu_time_total = 0.0
        self.device_time_total = self.self_device_time_total = 0.0

    @property
    def cpu_time(self):
        return self.cpu_time_total / self.count if self.count else 0.0

    def __repr__(self):
        return (f"<FunctionEventAvg key={self.key} self_cpu_time={_format_time(self.self_cpu_time_total)} "
                f"cpu_time={_format_time(self.cpu_time)}  self_cuda_time=0.000us cuda_time=0.000us input_shapes={self.input_shapes} "
                f"cpu_memory_usage=0 cuda_memory_usage=0>")


class EventList(list):
    def table(self, sort_by=None, row_limit=100, max_src_column_width=75, max_name_column_width=55,
              max_shapes_column_width=80, header=None, top_level_events_only=False, time_unit=None):
        return _build_table(self, sort_by, row_limit, max_name_column_width, max_shapes_column_width, header, time_unit)

    def total_average(self):
        avg = FunctionEventAvg("Total")
        for e in self:
            avg.count += e.count
            avg.cpu_time_total += e.cpu_time_total
            avg.self_cpu_time_total += e.self_cpu_time_total
        return avg


def _build_table(events, sort_by, row_limit, max_name_column_width, max_shapes_column_width, header, time_unit):
    if len(events) == 0:
        return ""
    if sort_by is not None:
        key = sort_by.replace("cuda", "device").replace("xpu", "device")
        events = EventList(sorted(events, key=lambda e: getattr(e, key, 0), reverse=True))
    has_shapes = any(e.input_shapes for e in events)
    name_w = min(max(len(e.key) for e in events) + 4, max_name_column_width)
    shapes_w = min(max(len(str(e.input_shapes)) for e in events) + 4, max_shapes_column_width)
    headers = ["Name", "Self CPU %", "Self CPU", "CPU total %", "CPU total", "CPU time avg", "# of Calls"]
    widths = [name_w] + [12] * 6
    if has_shapes:
        headers.append("Input Shapes")
        widths.append(shapes_w)
    row_format = "".join("{: >" + str(w) + "}  " for w in widths)
    sep = "".join("-" * w + "  " for w in widths)
    line_length = sum(w + 2 for w in widths) - 2
    total = sum(e.self_cpu_time_total for e in events)

    def tu(t):
        if time_unit == "s":
            return f"{t / 1e6:.3f}s"
        if time_unit == "ms":
            return f"{t / 1e3:.3f}ms"
        if time_unit == "us":
            return f"{t:.3f}us"
        return _format_time(t)
    out = []
    if header is not None:
        out += ["=" * line_length, header]
    out += [sep, row_format.format(*headers), sep]
    for e in events[:row_limit]:
        name = e.key
        if len(name) >= max_name_column_width - 3:
            name = name[:max_name_column_width - 3] + "..."
        row = [name, _format_time_share(e.self_cpu_time_total, total), tu(e.self_cpu_time_total),
               _format_time_share(e.cpu_time_total, total), tu(e.cpu_time_total), tu(e.cpu_time), e.count]
        if has_shapes:
            row.append(str(e.input_shapes)[:shapes_w])
        out.append(row_format.format(*row))
    out.append(sep)
    out.append(f"Self CPU time total: {_format_time(total)}")
    return "\n".join(out) + "\n"


class profile:
    """with torch.profiler.profile(activities=[ProfilerActivity.CPU], record_shapes=True) as prof: …"""

    def __init__(self, *, activities=None, schedule=None, on_trace_ready=None, record_shapes=False, profile_memory=False,
                 with_stack=False, with_flops=False, with_modules=False, experimental_config=None, execution_trace_observer=None,
                 acc_events=False, use_cuda=None, custom_trace_id_callback=None):
        self.activities = set(activities) if activities else {ProfilerActivity.CPU}
        self.schedule = schedule
        self.on_trace_ready = on_trace_ready
        self.record_shapes, self.profile_memory, self.with_stack = record_shapes, profile_memory, with_stack
        self.step_num = 0
        self._roots, self._stack = [], []
        self._recording = False
        self._saved = None

    def _action(self):
        return self.schedule(self.step_num) if self.schedule else ProfilerAction.RECORD

    def __enter__(self):
        self.start()
        return self

    def __exit__(self, *a):
        self.stop()
        return False

    def start(self):
        if _active[0] is not None:
            raise RuntimeError("Profiler is already enabled on this thread")
        _active[0] = self
        _install()
        self._recording = self._action() in (ProfilerAction.RECORD, ProfilerAction.RECORD_AND_SAVE)

    def stop(self):
        while self._stack:
            ev = self._stack.pop()
            ev.end = _now_us()
        if self.schedule is None:
            self._saved = list(self._roots)
        elif self._action() in (ProfilerAction.RECORD, ProfilerAction.RECORD_AND_SAVE) and self._roots:
            self._finish_cycle()
        self._recording = False
        _uninstall()
        _active[0] = None
        if self.schedule is None and self.on_trace_ready is not None:
            self.on_trace_ready(self)

    def step(self):
        prev = self._action()
        self.step_num += 1
        if prev == ProfilerAction.RECORD_AND_SAVE:
            self._finish_cycle()
        self._recording = self._action() in (ProfilerAction.RECORD, ProfilerAction.RECORD_AND_SAVE)

    def _finish_cycle(self):
        self._saved = list(self._roots)
        self._roots = []
        if self.on_trace_ready is not None:
            self.on_trace_ready(self)

    def _all_events(self):
        out = []

        def walk(e):
            out.append(e)
            for c in e.children:
                walk(c)
        for r in (self._saved if self._saved is not None else self._roots):
            walk(r)
        return out

    def events(self):
        return self._all_events()

    def key_averages(self, group_by_input_shape=False, group_by_stack_n=0, group_by_overload_name=False):
        groups = {}
        for e in self._all_events():
            if e.end is None:
                continue
            key = (e.name, str(e.shapes) if group_by_input_shape else None)
            avg = groups.get(key)
            if avg is None:
                avg = groups[key] = FunctionEventAvg(e.name, e.shapes if group_by_input_shape else None)
            dur = e.end - e.start
            child = sum((c.end or c.start) - c.start for c in e.children)
            avg.count += 1
            avg.cpu_time_total += dur
            avg.self_cpu_time_total += max(dur - child, 0.0)
        return EventList(groups.values())

    def export_chrome_trace(self, path):
        trace = {"traceEvents": [{"ph": "X", "cat": "cpu_op", "name": e.name, "pid": 0, "tid": 0, "ts": e.start,
                                  "dur": (e.end or e.start) - e.start, "args": {"Input Dims": e.shapes or []}}
                                 for e in self._all_events()]}
        with open(path, "w") as f:
            json.dump(trace, f)
        return path


def tensorboard_trace_handler(dir_name, worker_name=None, use_gzip=False):
    """An on_trace_ready handler that writes each trace as a .pt.trace.json file TensorBoard can open."""
    def handler_fn(prof):
        os.makedirs(dir_name, exist_ok=True)
        name = worker_name or "sandbox"
        prof.export_chrome_trace(os.path.join(dir_name, f"{name}.{int(time.time() * 1000)}.pt.trace.json"))
    return handler_fn


ProfilerActivity.__module__ = "torch._C._profiler"
