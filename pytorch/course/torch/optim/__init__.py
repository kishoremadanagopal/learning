"""torch.optim: optimizers that update parameters from their gradients."""
from .optimizer import Optimizer
from .sgd import SGD
from .adam import Adam, AdamW

for _c in (Optimizer, SGD, Adam, AdamW):
    _c.__module__ = "torch.optim." + {"Optimizer": "optimizer", "SGD": "sgd", "Adam": "adam", "AdamW": "adamw"}[_c.__name__]
