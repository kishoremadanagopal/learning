"""torch.backends: what this build of PyTorch supports. In the sandbox there is CUDA (the pretend GPU), no MPS."""
from . import mps, cuda, cudnn  # noqa: F401
