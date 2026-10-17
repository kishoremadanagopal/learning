"""torch.utils.benchmark: timing code properly (warm-up, many runs, statistics, GPU synchronisation)."""
import statistics
import time
import timeit as _timeit

__all__ = ["Timer", "Measurement"]


def _fmt(t):
    for unit, scale in (("s", 1.0), ("ms", 1e-3), ("us", 1e-6), ("ns", 1e-9)):
        if t >= scale:
            return f"{t / scale:.2f} {unit}", unit, scale
    return f"{t / 1e-9:.2f} ns", "ns", 1e-9


class Measurement:
    """The result of Timer.timeit / blocked_autorange: times are per run, in seconds."""

    def __init__(self, number_per_run, raw_times, task_spec, num_threads=1):
        self.number_per_run = number_per_run
        self.raw_times = raw_times
        self.task_spec = task_spec
        self.num_threads = num_threads

    @property
    def times(self):
        return [t / self.number_per_run for t in self.raw_times]

    @property
    def mean(self):
        return statistics.mean(self.times)

    @property
    def median(self):
        return statistics.median(self.times)

    @property
    def iqr(self):
        if len(self.times) < 2:
            return 0.0
        q = statistics.quantiles(self.times, n=4)
        return q[2] - q[0]

    def __repr__(self):
        lines = [f"<torch.utils.benchmark.utils.common.Measurement object at 0x{id(self) & 0xFFFFFFFFFFFF:012x}>"]
        lines.append(self.task_spec.get("label") or self.task_spec["stmt"])
        n = len(self.times)
        runs = "runs" if self.number_per_run != 1 else "run"
        threads = "thread" if self.num_threads == 1 else "threads"
        if n == 1:
            lines.append(f"  {_fmt(self.median)[0]}")
            lines.append(f"  1 measurement, {self.number_per_run} {runs} , {self.num_threads} {threads}")
        else:
            text, unit, scale = _fmt(self.median)
            q = statistics.quantiles(self.times, n=4)
            lines.append(f"  Median: {text}")
            lines.append(f"  IQR:    {(q[2] - q[0]) / scale:.2f} ({q[0] / scale:.2f} to {q[2] / scale:.2f})")
            lines.append(f"  {n} measurements, {self.number_per_run} {runs} per measurement, {self.num_threads} {threads}")
        return "\n".join(lines)


class Timer:
    """Timer(stmt="model(x)", globals={...}). Unlike timeit, it synchronises CUDA around each measurement."""

    def __init__(self, stmt="pass", setup="pass", global_setup="", timer=time.perf_counter, globals=None, label=None,
                 sub_label=None, description=None, env=None, num_threads=1, language="python"):
        self._stmt, self._setup = stmt, setup
        self._globals = dict(globals or {})
        self._label, self._sub_label, self._description = label, sub_label, description
        self._num_threads = num_threads
        self._timer = _timeit.Timer(stmt=stmt, setup=setup, timer=timer, globals=self._globals)

    def _spec(self):
        return {"stmt": self._stmt, "label": self._label}

    def _run(self, number):
        import torch
        if torch.cuda.is_available():
            torch.cuda.synchronize()
        t = self._timer.timeit(number)
        if torch.cuda.is_available():
            torch.cuda.synchronize()
        return t

    def timeit(self, number=1000000):
        self._run(max(1, min(number // 100, 2)))      # warm-up
        return Measurement(number, [self._run(number)], self._spec(), self._num_threads)

    def blocked_autorange(self, callback=None, min_run_time=0.2):
        number = 1
        while True:                                     # pick a block size that takes at least ~0.01 s
            t = self._run(number)
            if t >= 0.01 or number >= 10 ** 6:
                break
            number *= 10
        times, total = [], 0.0
        while total < min_run_time or len(times) < 3:
            t = self._run(number)
            times.append(t)
            total += t
        return Measurement(number, times, self._spec(), self._num_threads)

    def adaptive_autorange(self, threshold=0.1, *, min_run_time=0.01, max_run_time=10.0, callback=None):
        return self.blocked_autorange(min_run_time=max(min_run_time, 0.2))
