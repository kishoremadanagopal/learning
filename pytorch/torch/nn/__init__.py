"""torch.nn: layers, losses and the Module base class."""
from .parameter import Parameter, Buffer
from .modules import *  # noqa: F401,F403
from .modules import Module
from . import functional, init, utils, modules  # noqa: F401
from . import parallel  # noqa: E402,F401
