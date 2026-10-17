"""torch.optim: optimizers that update parameters from their gradients."""
from .optimizer import Optimizer
from .sgd import SGD
from .adam import Adam, AdamW
from .rmsprop import RMSprop
from . import lr_scheduler  # noqa: F401

for _c in (Optimizer, SGD, Adam, AdamW, RMSprop):
    _c.__module__ = "torch.optim." + {"Optimizer": "optimizer", "SGD": "sgd", "Adam": "adam", "AdamW": "adamw", "RMSprop": "rmsprop"}[_c.__name__]
