"""torch.compiler: helpers around torch.compile."""
import functools

_BACKENDS = ["cudagraphs", "inductor", "openxla", "tvm"]
_DEBUG_BACKENDS = ["eager", "aot_eager", "aot_eager_decomp_partition"]
_compiling = [False]


def list_backends(exclude_tags=("debug", "experimental")):
    return list(_BACKENDS) if exclude_tags else sorted(_BACKENDS + _DEBUG_BACKENDS)


def reset():
    """Clear every compiled graph cache (the sandbox has none)."""


def is_compiling():
    return _compiling[0]


def is_dynamo_compiling():
    return _compiling[0]


def disable(fn=None, recursive=True, *, reason=None):
    """Mark a function so torch.compile leaves it to run eagerly."""
    if fn is None:
        return lambda f: disable(f, recursive, reason=reason)
    return fn


def cudagraph_mark_step_begin():
    pass
