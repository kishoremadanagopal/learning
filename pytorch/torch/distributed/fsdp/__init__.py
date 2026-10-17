"""torch.distributed.fsdp: Fully Sharded Data Parallel. Sharding needs several processes and GPUs, so the sandbox
doesn't include it: run FSDP code with torchrun on your own GPUs."""


def fully_shard(module, *args, **kwargs):
    raise NotImplementedError("fully_shard (FSDP2) shards a model across several GPUs and can't run in the sandbox. "
                              "Try it with torchrun on a machine with GPUs.")


class MixedPrecisionPolicy:
    def __init__(self, param_dtype=None, reduce_dtype=None, output_dtype=None, cast_forward_inputs=True):
        self.param_dtype, self.reduce_dtype, self.output_dtype = param_dtype, reduce_dtype, output_dtype
        self.cast_forward_inputs = cast_forward_inputs

    def __repr__(self):
        return (f"MixedPrecisionPolicy(param_dtype={self.param_dtype}, reduce_dtype={self.reduce_dtype}, "
                f"output_dtype={self.output_dtype}, cast_forward_inputs={self.cast_forward_inputs})")
