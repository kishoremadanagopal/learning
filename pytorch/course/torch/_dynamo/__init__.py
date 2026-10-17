"""torch._dynamo: the graph-capture part of torch.compile (only the commonly used helpers here)."""
from ..compiler import reset, list_backends, disable  # noqa: F401
from . import eval_frame  # noqa: F401
from .eval_frame import OptimizedModule  # noqa: F401


class _Config:
    cache_size_limit = 8
    recompile_limit = 8
    suppress_errors = False


config = _Config()


class InvalidBackend(RuntimeError):
    pass


InvalidBackend.__module__ = "torch._dynamo.exc"
