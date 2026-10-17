"""Runs learner code and exercise checks. Used by the browser sandbox (Pyodide) and by build.py --test,
so lessons are tested with exactly the same rules they run under in the browser."""
import base64
import builtins
import io
import math
import os
import re
import sys
import traceback
import warnings

os.environ.setdefault("MPLBACKEND", "Agg")

_SETUP_DONE = False
DATA = {}          # filename -> bytes, restored before every run so lessons always start from clean files


def setup(data_files=None):
    """Configure pandas/matplotlib once. data_files: {name: bytes} copied into the working folder before each run."""
    global _SETUP_DONE
    if data_files:
        DATA.update(data_files)
    if _SETUP_DONE:
        return
    warnings.filterwarnings("ignore", message=".*non-interactive.*")
    warnings.filterwarnings("ignore", message=".*as_object_map.*")   # Pyodide-internal notice from threadpoolctl
    warnings.filterwarnings("ignore", category=DeprecationWarning)
    try:
        import pandas as pd
        pd.set_option("display.width", 100)
        pd.set_option("display.max_columns", 12)
        pd.set_option("display.max_rows", 20)
        pd.set_option("display.min_rows", 10)
        pd.set_option("display.max_colwidth", 30)
    except ImportError:
        pass
    _install_pure_cache()
    _SETUP_DONE = True


def _install_pure_cache():
    """Swap functools.cache / lru_cache for pure-Python versions with the same behaviour and API.
    In the browser, the C-coded wrapper uses a large slice of the JavaScript stack on every call, so recursion
    through @cache crashes Python after about 450 levels. Through a pure-Python wrapper, deep recursion ends in an
    ordinary RecursionError instead. (Used for local tests too, so both behave the same.)"""
    import functools
    from collections import OrderedDict
    if getattr(functools.lru_cache, "_pure", False):
        return
    CacheInfo, make_key = functools._CacheInfo, functools._make_key

    def lru_cache(maxsize=128, typed=False):
        if callable(maxsize) and not isinstance(maxsize, bool):     # @lru_cache with no parentheses
            return lru_cache(128, typed)(maxsize)
        if maxsize is not None and maxsize < 0:
            maxsize = 0

        def decorating(user_function):
            store = {} if maxsize is None else OrderedDict()
            hits = misses = 0

            def wrapper(*args, **kwds):
                nonlocal hits, misses
                key = make_key(args, kwds, typed)
                if key in store:
                    hits += 1
                    if maxsize is not None:
                        store.move_to_end(key)
                    return store[key]
                misses += 1
                result = user_function(*args, **kwds)
                if maxsize != 0:
                    store[key] = result
                    if maxsize is not None and len(store) > maxsize:
                        store.popitem(last=False)
                return result

            def cache_info():
                return CacheInfo(hits, misses, maxsize, len(store))

            def cache_clear():
                nonlocal hits, misses
                store.clear()
                hits = misses = 0

            wrapper.cache_info, wrapper.cache_clear = cache_info, cache_clear
            wrapper.cache_parameters = lambda: {"maxsize": maxsize, "typed": typed}
            return functools.update_wrapper(wrapper, user_function)
        return decorating

    def cache(user_function):
        return lru_cache(maxsize=None)(user_function)

    lru_cache._pure = True
    functools.lru_cache, functools.cache = lru_cache, cache


def _restore_data():
    """Start every run from a clean folder: remove files earlier runs created, restore the practice files."""
    if DATA:
        for name in os.listdir("."):
            if name not in DATA and os.path.isfile(name):
                os.remove(name)
    for name, blob in DATA.items():
        with open(name, "wb") as f:
            f.write(blob)


def _matplotlib_loaded():
    return "matplotlib.pyplot" in sys.modules


def _prepare_plots():
    if not _matplotlib_loaded():
        return
    import matplotlib.pyplot as plt
    plt.close("all")
    plt.show = lambda *a, **k: None


def _collect_figures(encode):
    if not _matplotlib_loaded():
        return []
    import matplotlib.pyplot as plt
    figs = []
    for num in plt.get_fignums():
        fig = plt.figure(num)
        if not fig.axes:
            continue
        if encode:
            buf = io.BytesIO()
            fig.savefig(buf, format="png", dpi=100, bbox_inches="tight")
            figs.append(base64.b64encode(buf.getvalue()).decode("ascii"))
        else:
            figs.append("figure")
    return figs


HINTS = {
    "KeyError": "Hint: a KeyError means that key isn't in the dictionary. Check with `key in d`, or use d.get(key, default).",
    "IndexError": "Hint: an index is past the end. A list of length n has indexes 0 to n - 1; check your loop bounds and empty inputs.",
    "RecursionError": "Hint: the recursion never stops (or goes too deep). Check that every path reaches a base case.",
    "ZeroDivisionError": "Hint: something was divided by zero. Is a count or length 0 for an empty input?",
    "ModuleNotFoundError": "Hint: the sandbox has Python's standard library, numpy, matplotlib and its own copy of PyTorch (torch). Packages such as torchvision, transformers or lightning aren't available here: try them on your own computer.",
    "FileNotFoundError": "Hint: check the file name. The practice files are listed in the Data files tab.",
    "SettingWithCopyWarning": "",
}


MESSAGE_HINTS = [
    ("Expected all tensors to be on the same device", "Hint: every tensor in one operation must be on the same device. Move them first, for example `x = x.to(device)` (and `model.to(device)` for a model)."),
    ("device type tensor to numpy", "Hint: NumPy only sees CPU memory. Copy the tensor back first: `t.cpu().numpy()` (or `t.detach().cpu().numpy()` if it requires grad)."),
    ("Can't call numpy() on Tensor that requires grad", "Hint: this tensor is tracked by autograd. Take a copy outside the graph first: `t.detach().numpy()`."),
    ("must match the size of tensor b", "Hint: broadcasting lines shapes up from the right; each pair of sizes must be equal, or one of them 1. Print both `.shape`s."),
    ("shapes cannot be multiplied", "Hint: for A @ B, A's last size must equal B's first size: (n×k) @ (k×m) gives (n×m). Print both `.shape`s; maybe one needs `.T`."),
    ("inconsistent tensor size", "Hint: a dot product needs two 1-D tensors of the same length. Print both `.shape`s."),
    ("view size is not compatible", "Hint: .view() needs contiguous memory (after .t(), .permute() or .transpose() it isn't). Use `.reshape(...)`, or `.contiguous().view(...)`."),
    ("is invalid for input of size", "Hint: the new shape must hold exactly as many elements as the tensor has (`.numel()`). At most one size can be -1."),
    ("leaf Variable that requires grad is being used in an in-place operation", "Hint: you can't change a tensor that requires grad in place while autograd records. Do weight updates inside `with torch.no_grad():`."),
    ("backward through the graph a second time", "Hint: backward() frees the graph it used. Recompute the forward pass (the loss) before each backward(), or pass retain_graph=True if you really need two."),
    ("grad can be implicitly created only for scalar outputs", "Hint: backward() needs a single number. Reduce first, e.g. `loss = y.sum()` or `y.mean()`, or pass `gradient=` with the same shape as y."),
    ("does not require grad and does not have a grad_fn", "Hint: nothing in this result is tracked. Create the input with `requires_grad=True`, and don't compute it inside `torch.no_grad()`."),
    ("Boolean value of Tensor with more than one value is ambiguous", "Hint: `if` needs one True/False, but this tensor holds several. Use `.any()`, `.all()`, or compare one element."),
    ("cannot be converted to Scalar", "Hint: .item() only works on a tensor with exactly one element. Use `.tolist()` for several, or pick one first (`t[0].item()`)."),
    ("to have the same dtype", "Hint: both sides need the same dtype. Convert one, e.g. `x.float()` or `x.to(w.dtype)`. Integer data such as `torch.tensor([1, 2])` is int64."),
    ("can't be cast to the desired output type", "Hint: an in-place operation (x += …, add_) keeps x's dtype, and a float result can't fit in an integer tensor. Write `x = x + …`, or make x a float tensor first."),
    ("Torch not compiled with CUDA enabled", "Hint: this machine has no CUDA GPU. Pick the device in code: `device = 'cuda' if torch.cuda.is_available() else 'cpu'`."),
    ("invalid device ordinal", "Hint: that GPU number doesn't exist. Count from 0: `torch.cuda.device_count()` says how many there are."),
    ("Dimension out of range", "Hint: dims count from 0 to ndim - 1 (or -1 for the last). Print `.shape` to see how many there are."),
    ("is out of bounds for dimension", "Hint: an index is past the end of that dimension. Indexes go from 0 to size - 1; print `.shape`."),
    ("dtype can require gradients", "Hint: only float (or complex) tensors can require gradients. Use float data, e.g. `torch.tensor([1., 2.])` or `dtype=torch.float32`."),
    ("modified by an inplace operation", "Hint: autograd saved this tensor for backward(), then an in-place operation changed it. Use an out-of-place version (`y = y + 1` instead of `y += 1`)."),
    ("Sizes of tensors must match except in dimension", "Hint: torch.cat joins along one dim; every other size must match. Print each `.shape`, or use torch.stack for a new dim."),
    ("stack expects each tensor to be equal size", "Hint: torch.stack needs tensors of exactly the same shape."),
    ("'NoneType' object", "Hint: something is None. Did a function forget to `return` its result, or does a variable point to nothing (like the end of a linked list)?"),
    ("maximum recursion depth", "Hint: the recursion never stops (or goes too deep). Check that every path reaches a base case."),
]


def _report(e, src, err):
    src_lines = src.splitlines()
    frames = [fr for fr in traceback.extract_tb(e.__traceback__) if fr.filename == "main.py"]
    parts = []
    if frames:
        parts.append("Traceback (most recent call last):\n")
        for fr in frames:
            parts.append(f'  File "main.py", line {fr.lineno}, in {fr.name}\n')
            line = fr.line or (src_lines[fr.lineno - 1] if fr.lineno and 0 < fr.lineno <= len(src_lines) else "")
            if line:
                parts.append("    " + line.strip() + "\n")
    e.__context__ = None
    msg = "".join(traceback.format_exception_only(type(e), e))
    parts.append(msg)
    hint = HINTS.get(type(e).__name__)
    text = str(e)
    for needle, h in MESSAGE_HINTS:
        if needle in text:
            hint = h
            break
    if hint:
        parts.append(hint + "\n")
    err.append("".join(parts))


class _Sink(io.TextIOBase):
    def __init__(self, parts, kind):
        self.parts, self.kind = parts, kind

    def write(self, s):
        s = str(s)
        if s:
            if self.parts and self.parts[-1][0] == self.kind:
                self.parts[-1][1] += s
            else:
                self.parts.append([self.kind, s])
        return len(s)

    def flush(self):
        pass


def _reset_torch():
    """Each run starts like a fresh `python` process: PyTorch's default seed, dtype, print options and grad mode."""
    torch = sys.modules.get("torch")
    if torch is not None and hasattr(torch, "_sandbox_reset"):
        torch._sandbox_reset()


def _execute(src, stdin_text=""):
    setup()
    _restore_data()
    _prepare_plots()
    _reset_torch()
    parts = []
    lines = iter(stdin_text.split("\n")) if stdin_text else iter(())

    def _input(prompt=""):
        sys.stdout.write(str(prompt))
        try:
            value = next(lines)
        except StopIteration:
            raise EOFError("input() ran out of lines. Add one per call in the Input box.") from None
        sys.stdout.write(value + "\n")
        return value

    saved = (sys.stdout, sys.stderr, builtins.input)
    sys.stdout, sys.stderr = _Sink(parts, "out"), _Sink(parts, "err")
    builtins.input = _input
    ns = {"__name__": "__main__", "input": _input}
    ok = True
    err = []
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", DeprecationWarning)
            exec(compile(src, "main.py", "exec"), ns)
    except SystemExit:
        pass
    except BaseException as e:  # noqa: BLE001
        ok = False
        _report(e, src, err)
    finally:
        sys.stdout, sys.stderr, builtins.input = saved
    if err:
        parts.append(["err", err[0]])
    return ok, ns, parts


_SCALARS = (int, float, complex, str, bytes, bool, type(None))


def _dismantle(*roots, limit=2_000_000):
    """Free the learner's linked structures without deep recursion.
    In the browser (WebAssembly), CPython frees a long chain of objects (a linked list, or a tree thousands of levels
    deep) recursively and can overflow the JavaScript stack, which kills Python for the rest of the session.
    So first collect every instance of a class the learner defined that is reachable from the roots, empty their
    attributes, and only then drop them, one at a time."""
    seen, keep, stack = set(), [], list(roots)
    while stack and len(keep) < limit:
        o = stack.pop()
        t = type(o)
        if t in _SCALARS or id(o) in seen:
            continue
        if t is dict:
            seen.add(id(o)); keep.append(o)
            stack.extend(v for v in o.values() if type(v) not in _SCALARS)
        elif t in (list, tuple, set, frozenset) or t.__name__ == "deque":
            seen.add(id(o)); keep.append(o)
            if o and type(next(iter(o))) not in _SCALARS:
                stack.extend(o)
        elif getattr(t, "__module__", "") == "__main__" and not isinstance(o, type):
            seen.add(id(o)); keep.append(o)
            d = getattr(o, "__dict__", None)
            if d is not None:
                stack.extend(v for v in d.values() if type(v) not in _SCALARS)
            for k in getattr(t, "__slots__", ()):
                v = getattr(o, k, None) if isinstance(k, str) else None
                if v is not None and type(v) not in _SCALARS:
                    stack.append(v)
    for o in keep:                       # break every link while `keep` still holds each object
        try:
            if type(o).__module__ == "__main__" and not isinstance(o, (dict, list, tuple, set, frozenset)):
                d = getattr(o, "__dict__", None)
                if d is not None:
                    d.clear()
                for k in getattr(type(o), "__slots__", ()):
                    if isinstance(k, str) and hasattr(o, k):
                        delattr(o, k)
        except Exception:  # noqa: BLE001
            pass
    keep.clear()                         # now each object is freed on its own, with nothing below it


def run(src, stdin_text="", encode_figures=True):
    """Run learner code. Returns {ok, parts: [[kind, text], ...], figures: [png base64, ...]}."""
    ok, ns, parts = _execute(src, stdin_text)
    try:
        return {"ok": ok, "parts": parts, "figures": _collect_figures(encode_figures)}
    finally:
        _dismantle(ns)
        ns.clear()


# ---------------------------------------------------------------- check helpers

_MISSING = object()


def _short(value, limit=600):
    text = repr(value) if not hasattr(value, "to_string") else value.to_string(max_rows=12, max_cols=8)
    return text if len(text) <= limit else text[:limit] + " …"


def _helpers(ns, output, source):
    import copy
    import math
    import time
    np = sys.modules.get("numpy")          # only if the learner's code imported it (keeps the sandbox light)
    pd = sys.modules.get("pandas")

    def need(name, kind=None):
        """Return the learner's variable `name`, failing with a friendly message if it's missing or the wrong type."""
        value = ns.get(name, _MISSING)
        if value is _MISSING:
            raise AssertionError(f"Create a variable called `{name}`.")
        if kind is not None and not isinstance(value, kind):
            kinds = kind if isinstance(kind, tuple) else (kind,)
            names = " or ".join(getattr(k, "__name__", str(k)) for k in kinds)
            raise AssertionError(f"`{name}` should be a {names}, but it's a {type(value).__name__}.")
        return value

    def same(actual, expected, what="Your result", ignore_index=False, ignore_order=False, ignore_dtype=True, tol=1e-6):
        """Assert that actual equals expected (numbers, arrays, Series, DataFrames, lists...)."""
        fail = None
        torch = sys.modules.get("torch")
        if torch is not None and isinstance(expected, torch.Tensor):
            if not isinstance(actual, torch.Tensor):
                raise AssertionError(f"{what} should be a tensor (torch.Tensor), but it's a {type(actual).__name__}.")
            if tuple(actual.shape) != tuple(expected.shape):
                raise AssertionError(f"{what} should have shape {expected.shape}, but has shape {actual.shape}.")
            if not ignore_dtype and actual.dtype != expected.dtype:
                raise AssertionError(f"{what} should have dtype {expected.dtype}, but has dtype {actual.dtype}.")
            if actual.device != expected.device:
                raise AssertionError(f"{what} should be on device '{expected.device}', but is on '{actual.device}'.")
            a = actual.detach().cpu().double() if actual.dtype.is_floating_point else actual.detach().cpu()
            b = expected.detach().cpu().double() if expected.dtype.is_floating_point else expected.detach().cpu()
            try:
                fail = not torch.allclose(a.double(), b.double(), rtol=tol, atol=1e-6, equal_nan=True)
            except (RuntimeError, TypeError):
                fail = not torch.equal(a, b)
        elif pd is not None and isinstance(expected, (pd.DataFrame, pd.Series)):
            if not isinstance(actual, type(expected)):
                raise AssertionError(f"{what} should be a {type(expected).__name__}, but it's a {type(actual).__name__}.")
            a, b = actual, expected
            if isinstance(b, pd.DataFrame) and list(a.columns) != list(b.columns):
                if sorted(map(str, a.columns)) == sorted(map(str, b.columns)) and ignore_order:
                    a = a[list(b.columns)]
                else:
                    raise AssertionError(f"{what} should have the columns {list(b.columns)}, but has {list(a.columns)}.")
            if len(a) != len(b):
                raise AssertionError(f"{what} should have {len(b)} rows, but has {len(a)}.")
            if ignore_order:
                key = list(b.columns) if isinstance(b, pd.DataFrame) else None
                if key is not None:
                    a = a.sort_values(key).reset_index(drop=ignore_index)
                    b = b.sort_values(key).reset_index(drop=ignore_index)
                else:
                    a = a.sort_values().reset_index(drop=ignore_index)
                    b = b.sort_values().reset_index(drop=ignore_index)
            if ignore_index:
                a, b = a.reset_index(drop=True), b.reset_index(drop=True)
            try:
                if isinstance(b, pd.DataFrame):
                    pd.testing.assert_frame_equal(a, b, check_dtype=not ignore_dtype, check_exact=False, rtol=tol,
                                                  check_names=False, check_index_type=False, check_column_type=False)
                else:
                    pd.testing.assert_series_equal(a, b, check_dtype=not ignore_dtype, check_exact=False, rtol=tol,
                                                   check_names=False, check_index_type=False)
            except AssertionError:
                fail = True
        elif np is not None and isinstance(expected, np.ndarray):
            arr = np.asarray(actual)
            if arr.shape != expected.shape:
                raise AssertionError(f"{what} should have shape {expected.shape}, but has shape {arr.shape}.")
            try:
                fail = not np.allclose(arr, expected, rtol=tol, equal_nan=True) if expected.dtype.kind in "fiub" else not (arr == expected).all()
            except TypeError:
                fail = True
        elif isinstance(expected, float) or isinstance(actual, float):
            try:
                fail = abs(float(actual) - float(expected)) > max(tol * abs(float(expected)), 1e-9)
            except (TypeError, ValueError):
                fail = True
        else:
            if hasattr(actual, "item") and not isinstance(actual, (list, dict, str)):
                try:
                    actual = actual.item()
                except (ValueError, AttributeError):
                    pass
            fail = actual != expected
        if fail:
            raise AssertionError(f"{what} isn't right yet.\nExpected:\n{_short(expected)}\nGot:\n{_short(actual)}")
        return True

    def printed(*texts):
        """True if every text appears in what the learner printed."""
        return all(str(t) in output for t in texts)

    def _code_only():
        return "\n".join(re.sub(r"#.*$", "", ln) for ln in source.splitlines())

    def uses(*snippets):
        """True if every snippet appears in the learner's code (comments ignored)."""
        code = _code_only()
        return all(s in code for s in snippets)

    def chart():
        """Return the Axes of the learner's chart (the most recent figure)."""
        if not _matplotlib_loaded():
            raise AssertionError("Draw a chart with matplotlib (import matplotlib.pyplot as plt).")
        import matplotlib.pyplot as plt
        nums = [n for n in plt.get_fignums() if plt.figure(n).axes]
        if not nums:
            raise AssertionError("No chart was drawn. Create one with plt.subplots() or df.plot().")
        return plt.figure(nums[-1]).axes[0]

    # ---- function tests (hidden test cases, like coding-interview sites) ----

    def _func(name):
        if callable(name):
            return name, getattr(name, "__name__", "your function")
        f = ns.get(name, _MISSING)
        if f is _MISSING:
            raise AssertionError(f"Define a function called `{name}` (it starts with `def {name}(`).")
        if not callable(f):
            raise AssertionError(f"`{name}` should be a function, but it's a {type(f).__name__}.")
        return f, name

    def _show(value, limit=90):
        text = repr(value)
        return text if len(text) <= limit else text[:limit] + " …"

    def _eq(got, expected):
        """Equality that tolerates float rounding, recursively through lists, tuples, dicts and NumPy arrays."""
        if hasattr(got, "tolist") and not isinstance(got, (str, bytes)):
            got = got.tolist()                       # NumPy arrays and scalars
        if hasattr(expected, "tolist") and not isinstance(expected, (str, bytes)):
            expected = expected.tolist()
        if isinstance(expected, bool) or isinstance(got, bool):
            return got == expected
        if isinstance(expected, float) or isinstance(got, float):
            try:
                return math.isclose(float(got), float(expected), rel_tol=1e-6, abs_tol=1e-9)
            except (TypeError, ValueError):
                return False
        if isinstance(expected, (list, tuple)) and isinstance(got, (list, tuple)):
            return len(got) == len(expected) and all(_eq(g, e) for g, e in zip(got, expected))
        if isinstance(expected, dict) and isinstance(got, dict):
            return got.keys() == expected.keys() and all(_eq(got[k], expected[k]) for k in expected)
        return got == expected

    def _verdict_ok(got, expected, args, valid, key):
        if valid is not None:
            return bool(valid(got, *copy.deepcopy(args)))
        if key is not None:
            try:
                return key(got) == key(expected)
            except Exception:  # noqa: BLE001
                return False
        return _eq(got, expected)

    def test(name, cases, valid=None, key=None, show=None):
        """Run the learner's function on hidden test cases: [(args, expected, "label"), ...].
        args is a tuple of arguments (a single non-tuple value is one argument).
        valid(got, *args) -> bool checks answers that have several right forms; key normalises both sides (e.g. sorted).
        show is an optional format string for the call shown on failure, e.g. "max_depth(build({0}))"."""
        f, fname = _func(name)
        total = len(cases)
        for done, case in enumerate(cases):
            args, expected = case[0], case[1]
            label = case[2] if len(case) > 2 else f"test {done + 1}"
            if not isinstance(args, tuple):
                args = (args,)
            shown = [_show(a, 60) for a in args]
            call = show.format(*shown) if show else f"{fname}({', '.join(shown)})"
            head = f"Passed {done} of {total} tests. Fails on {label}:\n  {call}\n"
            try:
                got = f(*copy.deepcopy(args))
            except RecursionError:
                raise AssertionError(head + "hit RecursionError: the recursion goes too deep or never reaches its base case.") from None
            except Exception as e:  # noqa: BLE001
                raise AssertionError(head + f"raised {type(e).__name__}: {e}") from None
            if not _verdict_ok(got, expected, args, valid, key):
                msg = head + (f"returned {_show(got)}, which isn't a correct answer (for example, {_show(expected)} is)." if valid
                              else f"should return {_show(expected)}, but returned {_show(got)}.")
                if got is None and expected is not None:
                    msg += "\nDid you forget to `return` the answer? Printing it isn't the same as returning it."
                raise AssertionError(msg)
        return True

    def _fresh(value):
        """A copy safe to hand to a function that might change it; fast for big flat lists of numbers or strings."""
        if isinstance(value, tuple):
            return tuple(_fresh(v) for v in value)
        if isinstance(value, list):
            if not value or not isinstance(value[0], (list, dict, set)):
                return list(value)
            return copy.deepcopy(value)
        if isinstance(value, (dict, set)):
            return copy.deepcopy(value)
        return value

    def speed(name, make_args, reference, sizes=(1_000, 10_000, 100_000), what="items", tip=None,
              valid=None, key=None, factor=30, floor=0.3):
        """Time the learner's function against a reference solution on growing inputs.
        Fails with a friendly "too slow" message as soon as it takes more than max(floor, factor x reference time).
        Before each bigger size, it also predicts the learner's time from the previous sizes: with the growth rate
        measured between the last two sizes when both timings are big enough to trust, otherwise assuming linear
        growth (the most optimistic case for anything that reads its input). If even that prediction is far over
        budget, it fails at once instead of making the learner wait minutes for a run that can only fail."""
        f, fname = _func(name)
        tip = tip or "Look for a way to avoid repeating work, such as a loop inside a loop."
        prev = before = None                          # (size, learner time) for the last two sizes
        for n in sizes:
            args = make_args(n)
            if not isinstance(args, tuple):
                args = (args,)
            a_ref, a_you = _fresh(args), _fresh(args)
            t0 = time.perf_counter()
            expected = reference(*a_ref)
            t_ref = time.perf_counter() - t0
            budget = max(floor, factor * t_ref)
            ref_txt = f"{t_ref * 1000:.0f} ms" if t_ref >= 0.001 else "under 1 ms"
            if prev and prev[1] >= 0.05 and 0 < prev[0] < n:
                growth = 1.0                          # assume linear growth unless measured otherwise
                if before and before[1] >= 0.005 and before[0] < prev[0]:
                    growth = min(3.0, max(1.0, math.log(prev[1] / before[1]) / math.log(prev[0] / before[0])))
                predicted = prev[1] * (n / prev[0]) ** growth
                if predicted > 3 * budget:
                    raise AssertionError(
                        f"Correct, but too slow: with {prev[0]:,} {what} your function took {prev[1]:.2f} s, so with "
                        f"{n:,} {what} it would take at least {_secs(predicted)}; a fast solution takes {ref_txt}.\n" + tip)
            t0 = time.perf_counter()
            try:
                got = f(*a_you)
            except RecursionError:
                raise AssertionError(f"With {n:,} {what}, your function hit RecursionError: the recursion is too deep for "
                                     "Python's limit (about 1,000 nested calls).\n" + tip) from None
            t = time.perf_counter() - t0
            if not _verdict_ok(got, expected, args, valid, key):
                raise AssertionError(f"Your function passes the small tests but gives a wrong answer on a big input ({n:,} {what}).")
            if t > budget:
                raise AssertionError(f"Correct, but too slow: with {n:,} {what} your function took {t:.2f} s; "
                                     f"a fast solution takes {ref_txt}.\n" + tip)
            before, prev = prev, (n, t)
        return True

    def _secs(seconds):
        for unit, size in (("year", 31_557_600), ("day", 86_400), ("hour", 3_600), ("minute", 60)):
            if seconds >= 2 * size:
                count = round(seconds / size)
                return f"{count:,} {unit}s" if unit != "year" or count < 1_000 else "thousands of years"
        count = max(1, round(seconds))
        return f"{count} second{'s' if count != 1 else ''}"

    return {"need": need, "same": same, "printed": printed, "uses": uses, "chart": chart, "test": test, "speed": speed}


def check(src, check_src, stdin_text="", encode_figures=True):
    """Run learner code, then the exercise's check code. Returns run() fields plus verdict {ok, msg}."""
    ok, ns, parts = _execute(src, stdin_text)
    env = {}
    try:
        return _check(ok, ns, parts, env, src, check_src, encode_figures)
    finally:
        _dismantle(env, ns)
        env.clear()
        ns.clear()


def _check(ok, ns, parts, env, src, check_src, encode_figures):
    figures = _collect_figures(encode_figures)
    if not ok:
        return {"ok": False, "parts": parts, "figures": figures,
                "verdict": {"ok": False, "msg": "Your code raised an error (see above). Fix it and check again."}}
    output = "".join(t for k, t in parts if k == "out")
    env.update(ns)
    env.update({"__output__": output, "__source__": src})
    env.update(_helpers(ns, output, src))
    saved = sys.stdout
    sys.stdout = io.StringIO()
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            exec(compile(check_src, "check.py", "exec"), env)
        verdict = {"ok": True, "msg": "All checks passed."}
    except AssertionError as e:
        verdict = {"ok": False, "msg": str(e) or "One of the checks failed."}
    except Exception as e:  # noqa: BLE001
        verdict = {"ok": False, "msg": f"Checking stopped with {type(e).__name__}: {e}"}
    finally:
        sys.stdout = saved
    return {"ok": True, "parts": parts, "figures": figures, "verdict": verdict}
