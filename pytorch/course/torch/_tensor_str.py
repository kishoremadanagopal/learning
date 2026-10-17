"""How tensors print: a port of PyTorch 2.14's torch/_tensor_str.py (dense tensors), working on NumPy arrays."""
import contextlib
import dataclasses
import math

import numpy as np


@dataclasses.dataclass
class __PrinterOptions:
    precision: int = 4
    threshold: float = 1000
    edgeitems: int = 3
    linewidth: int = 80
    sci_mode: object = None


PRINT_OPTS = __PrinterOptions()


def set_printoptions(precision=None, threshold=None, edgeitems=None, linewidth=None, profile=None, sci_mode=None):
    if profile is not None:
        if profile == "default":
            PRINT_OPTS.precision, PRINT_OPTS.threshold, PRINT_OPTS.edgeitems, PRINT_OPTS.linewidth = 4, 1000, 3, 80
        elif profile == "short":
            PRINT_OPTS.precision, PRINT_OPTS.threshold, PRINT_OPTS.edgeitems, PRINT_OPTS.linewidth = 2, 1000, 2, 80
        elif profile == "full":
            PRINT_OPTS.precision, PRINT_OPTS.threshold, PRINT_OPTS.edgeitems, PRINT_OPTS.linewidth = 4, math.inf, 3, 80
    if precision is not None:
        PRINT_OPTS.precision = precision
    if threshold is not None:
        PRINT_OPTS.threshold = threshold
    if edgeitems is not None:
        PRINT_OPTS.edgeitems = edgeitems
    if linewidth is not None:
        PRINT_OPTS.linewidth = linewidth
    PRINT_OPTS.sci_mode = sci_mode


def get_printoptions():
    return dataclasses.asdict(PRINT_OPTS)


@contextlib.contextmanager
def printoptions(**kwargs):
    old = get_printoptions()
    set_printoptions(**kwargs)
    try:
        yield
    finally:
        set_printoptions(**old)


class _Formatter:
    def __init__(self, arr, floating):
        self.floating_dtype = floating
        self.int_mode = True
        self.sci_mode = False
        self.max_width = 1
        flat = arr.reshape(-1)
        if not floating:
            for v in flat.tolist():
                self.max_width = max(self.max_width, len(f"{v}"))
            return
        vals = flat[np.isfinite(flat) & (flat != 0)]
        if vals.size == 0:
            return
        absd = np.abs(vals).astype(np.float64)
        mn, mx = float(absd.min()), float(absd.max())
        pyvals = vals.tolist()
        for v in pyvals:
            if v != math.ceil(v):
                self.int_mode = False
                break
        self.sci_mode = (mx / mn > 1000.0 or mx > 1.0e8 or mn < 1.0e-4) if PRINT_OPTS.sci_mode is None else PRINT_OPTS.sci_mode
        p = PRINT_OPTS.precision
        if self.int_mode:
            if self.sci_mode:
                for v in pyvals:
                    self.max_width = max(self.max_width, len(f"{{:.{p}e}}".format(v)))
            else:
                for v in pyvals:
                    self.max_width = max(self.max_width, len(f"{v:.0f}") + 1)
        else:
            fmt = f"{{:.{p}e}}" if self.sci_mode else f"{{:.{p}f}}"
            for v in pyvals:
                self.max_width = max(self.max_width, len(fmt.format(v)))

    def width(self):
        return self.max_width

    def format(self, value):
        if self.floating_dtype:
            if self.sci_mode:
                ret = f"{{:{self.max_width}.{PRINT_OPTS.precision}e}}".format(value)
            elif self.int_mode:
                ret = f"{value:.0f}"
                if not (math.isinf(value) or math.isnan(value)):
                    ret += "."
            else:
                ret = f"{{:.{PRINT_OPTS.precision}f}}".format(value)
        else:
            ret = f"{value}"
        return (self.max_width - len(ret)) * " " + ret


def _val(f1, f2, v):
    if f2 is None:
        return f1.format(v)
    real_str = f1.format(v.real)
    imag_str = (f2.format(v.imag) + "j").lstrip()
    if imag_str[0] in "+-":
        return real_str + imag_str
    return real_str + "+" + imag_str


def _vector_str(a, indent, summarize, f1, f2=None):
    element_length = f1.width() + 2
    if f2 is not None:
        element_length += f2.width() + 1
    per_line = max(1, math.floor((PRINT_OPTS.linewidth - indent) / element_length))
    e = PRINT_OPTS.edgeitems
    if summarize and not e:
        data = ["..."]
    elif summarize and a.shape[0] > 2 * e:
        data = [_val(f1, f2, v) for v in a[:e].tolist()] + [" ..."] + [_val(f1, f2, v) for v in a[-e:].tolist()]
    else:
        data = [_val(f1, f2, v) for v in a.tolist()]
    lines = [", ".join(data[i:i + per_line]) for i in range(0, len(data), per_line)]
    return "[" + ("," + "\n" + " " * (indent + 1)).join(lines) + "]"


def _with_formatter(a, indent, summarize, f1, f2=None):
    dim = a.ndim
    if dim == 0:
        return _val(f1, f2, a.item())
    if dim == 1:
        return _vector_str(a, indent, summarize, f1, f2)
    e = PRINT_OPTS.edgeitems
    if summarize and a.shape[0] > 2 * e:
        slices = ([_with_formatter(a[i], indent + 1, summarize, f1, f2) for i in range(e)] + ["..."]
                  + [_with_formatter(a[i], indent + 1, summarize, f1, f2) for i in range(len(a) - e, len(a))])
    else:
        slices = [_with_formatter(a[i], indent + 1, summarize, f1, f2) for i in range(a.shape[0])]
    return "[" + ("," + "\n" * (dim - 1) + " " * (indent + 1)).join(slices) + "]"


def _summarized(a):
    e = PRINT_OPTS.edgeitems
    if a.ndim == 0:
        return a
    if a.ndim == 1:
        return np.concatenate((a[:e], a[-e:])) if a.shape[0] > 2 * e else a
    if not e:
        return a[(slice(0, 0),) * a.ndim]
    if a.shape[0] > 2 * e:
        return np.stack([_summarized(x) for x in list(a[:e]) + list(a[-e:])])
    return np.stack([_summarized(x) for x in a])


def _tensor_str(t, indent):
    a = t._a
    if a.size == 0:
        return "[]"
    summarize = a.size > PRINT_OPTS.threshold
    if t.dtype.is_complex:
        fr = _Formatter(_summarized(a.real) if summarize else a.real, True)
        fi = _Formatter(_summarized(a.imag) if summarize else a.imag, True)
        return _with_formatter(a, indent, summarize, fr, fi)
    f = _Formatter(_summarized(a) if summarize else a, t.dtype.is_floating_point)
    return _with_formatter(a, indent, summarize, f)


def _add_suffixes(tensor_str, suffixes, indent, force_newline):
    out = [tensor_str]
    last_line_len = len(tensor_str) - tensor_str.rfind("\n") + 1
    for suffix in suffixes:
        if force_newline or last_line_len + len(suffix) + 2 > PRINT_OPTS.linewidth:
            out.append(",\n" + " " * indent + suffix)
            last_line_len = indent + len(suffix)
            force_newline = False
        else:
            out.append(", " + suffix)
            last_line_len += len(suffix) + 2
    out.append(")")
    return "".join(out)


def _str(t, *, tensor_contents=None):
    import torch
    prefix = "tensor("
    indent = len(prefix)
    suffixes = []
    if t.device.type != "cpu" and not (t.device.type == "meta"):
        suffixes.append("device='" + str(t.device) + "'")
    default = torch.get_default_dtype()
    default_complex = torch.cdouble if default is torch.double else torch.cfloat
    has_default = t.dtype in (default, default_complex, torch.int64, torch.bool)
    if t.device.type == "meta":
        suffixes.append("size=" + str(tuple(t.shape)))
        if t.dtype is not default:
            suffixes.append("dtype=" + str(t.dtype))
        tensor_str = "..."
    elif t.numel() == 0:
        if t.dim() != 1:
            suffixes.append("size=" + str(tuple(t.shape)))
        if t.dtype is not default:
            suffixes.append("dtype=" + str(t.dtype))
        tensor_str = "[]"
    else:
        if not PRINT_OPTS.edgeitems:
            suffixes.append("size=" + str(tuple(t.shape)))
        if not has_default:
            suffixes.append("dtype=" + str(t.dtype))
        tensor_str = _tensor_str(t, indent)
    if tensor_contents is not None:
        tensor_str = tensor_contents
    gf = t.__dict__.get("grad_fn")
    if gf is not None:
        suffixes.append(f"grad_fn=<{gf._name}>")
    elif t.requires_grad:
        suffixes.append("requires_grad=True")
    return _add_suffixes(prefix + tensor_str, suffixes, indent, force_newline=False)
