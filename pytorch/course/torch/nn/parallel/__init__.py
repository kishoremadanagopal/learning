"""torch.nn.parallel: DistributedDataParallel."""
import contextlib

from ..modules.module import Module

__all__ = ["DistributedDataParallel"]


class DistributedDataParallel(Module):
    """Wraps a model for data-parallel training: every process holds a full copy, and backward() averages the
    gradients across processes (an all-reduce), so every copy takes the same optimizer step. The wrapped model is
    .module, so state_dict keys start with "module."."""

    def __init__(self, module, device_ids=None, output_device=None, dim=0, broadcast_buffers=True, process_group=None,
                 bucket_cap_mb=None, find_unused_parameters=False, check_reduction=False, gradient_as_bucket_view=False,
                 static_graph=False, delay_all_reduce_named_params=None, param_to_hook_all_reduce=None,
                 mixed_precision=None, device_mesh=None, skip_all_reduce_unused_params=False):
        from ... import distributed as dist
        super().__init__()
        dist._check()
        if not any(p.requires_grad for p in module.parameters()):
            raise RuntimeError("DistributedDataParallel is not needed when a module doesn't have any parameter that requires a gradient.")
        self.module = module
        self.device_ids = device_ids
        self.find_unused_parameters = find_unused_parameters
        self.require_backward_grad_sync = True

    def forward(self, *inputs, **kwargs):
        return self.module(*inputs, **kwargs)

    @contextlib.contextmanager
    def no_sync(self):
        """Skip the gradient all-reduce inside this block (for gradient accumulation)."""
        old = self.require_backward_grad_sync
        self.require_backward_grad_sync = False
        try:
            yield
        finally:
            self.require_backward_grad_sync = old


DistributedDataParallel.__module__ = "torch.nn.parallel.distributed"
