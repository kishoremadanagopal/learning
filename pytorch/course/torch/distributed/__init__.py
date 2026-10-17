"""torch.distributed in the sandbox: a single process (world size 1).

A browser can't start the several processes multi-GPU training needs, so init_process_group accepts
world_size=1 only. Every call then behaves as PyTorch's does with one process: all_reduce leaves tensors as they
are, get_rank() is 0, DistributedDataParallel wraps the model as module. Run multi-process code with torchrun on
your own computer."""
import enum
import os

from .. import _core

__all__ = ["is_available", "is_initialized", "init_process_group", "destroy_process_group", "get_rank", "get_world_size",
           "get_backend", "barrier", "all_reduce", "broadcast", "all_gather", "reduce", "ReduceOp", "is_torchelastic_launched"]

_state = {"initialized": False, "backend": None, "rank": 0, "world_size": 1}


class RedOpType(enum.Enum):
    SUM = 0
    AVG = 1
    PRODUCT = 2
    MIN = 3
    MAX = 4

    def __repr__(self):
        return f"<RedOpType.{self.name}: {self.value}>"

    def __str__(self):
        return f"RedOpType.{self.name}"


class ReduceOp:
    SUM, AVG, PRODUCT, MIN, MAX = RedOpType.SUM, RedOpType.AVG, RedOpType.PRODUCT, RedOpType.MIN, RedOpType.MAX
    RedOpType = RedOpType


def is_available():
    return True


def is_initialized():
    return _state["initialized"]


def is_torchelastic_launched():
    return os.environ.get("TORCHELASTIC_RUN_ID") is not None


def _env(name):
    v = os.environ.get(name)
    if v is None:
        raise ValueError(f"Error initializing torch.distributed using env:// rendezvous: environment variable {name} expected, but not set")
    return v


def init_process_group(backend=None, init_method=None, timeout=None, world_size=-1, rank=-1, store=None, group_name="",
                       pg_options=None, device_id=None):
    if _state["initialized"]:
        raise ValueError("trying to initialize the default process group twice!")
    if init_method is None and store is None:
        rank = int(_env("RANK")) if rank == -1 else rank
        world_size = int(_env("WORLD_SIZE")) if world_size == -1 else world_size
        _env("MASTER_ADDR")
        _env("MASTER_PORT")
    if world_size == -1:
        world_size = 1
    if rank == -1:
        rank = 0
    if world_size != 1 or rank != 0:
        raise RuntimeError("The sandbox runs a single process, so it supports world_size=1 (rank 0) only. "
                           "Launch real multi-process training with torchrun on your own computer.")
    backend = backend or ("cuda:nccl,cpu:gloo" if _core._GPU["available"] else "gloo")
    if backend not in ("gloo", "nccl", "cuda:nccl,cpu:gloo", "mpi"):
        raise ValueError(f"Invalid backend: '{backend}'")
    if backend == "nccl" and not _core._GPU["available"]:
        raise RuntimeError("ProcessGroupNCCL is only supported with GPUs, no GPUs found!")
    _state.update(initialized=True, backend=backend, rank=rank, world_size=world_size)


def _check():
    if not _state["initialized"]:
        raise ValueError("Default process group has not been initialized, please make sure to call init_process_group.")


def destroy_process_group(group=None):
    _check()
    _state.update(initialized=False, backend=None)


def get_rank(group=None):
    _check()
    return _state["rank"]


def get_world_size(group=None):
    _check()
    return _state["world_size"]


def get_backend(group=None):
    _check()
    return _state["backend"]


def barrier(group=None, async_op=False, device_ids=None):
    _check()


def all_reduce(tensor, op=ReduceOp.SUM, group=None, async_op=False):
    """Combine the tensor across every process in place (with one process it's unchanged)."""
    _check()


def reduce(tensor, dst=0, op=ReduceOp.SUM, group=None, async_op=False):
    _check()


def broadcast(tensor, src=0, group=None, async_op=False):
    _check()


def all_gather(tensor_list, tensor, group=None, async_op=False):
    _check()
    if len(tensor_list) != _state["world_size"]:
        raise ValueError("tensor_list must have one tensor per process")
    tensor_list[0].copy_(tensor)


def all_gather_object(object_list, obj, group=None):
    _check()
    object_list[0] = obj


def get_node_local_rank(fallback_rank=None):
    if "LOCAL_RANK" in os.environ:
        return int(os.environ["LOCAL_RANK"])
    if fallback_rank is not None:
        return int(fallback_rank)
    raise RuntimeError("LOCAL_RANK is not in the environment. Consider passing fallback_rank to allow `get_node_local_rank` to work, assuming you are not running in a multi-device context and want the code to run locally instead.")


RedOpType.__module__ = "torch._C._distributed_c10d.ReduceOp"
