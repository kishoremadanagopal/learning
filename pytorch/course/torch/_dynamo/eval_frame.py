"""OptimizedModule: what torch.compile(model) returns."""
from ..nn.modules.module import Module


class OptimizedModule(Module):
    """Wraps the original module as _orig_mod and calls it. In real PyTorch the call runs compiled code; in the
    sandbox it runs the original module, so results are identical and there is no speed-up."""

    def __init__(self, mod, dynamo_ctx=None):
        super().__init__()
        self._orig_mod = mod
        self.dynamo_ctx = dynamo_ctx

    def forward(self, *args, **kwargs):
        from .. import compiler
        compiler._compiling[0] = False
        return self._orig_mod(*args, **kwargs)

    def __getattr__(self, name):
        try:
            return super().__getattr__(name)
        except AttributeError:
            return getattr(self.__dict__["_modules"]["_orig_mod"], name)


OptimizedModule.__module__ = "torch._dynamo.eval_frame"
