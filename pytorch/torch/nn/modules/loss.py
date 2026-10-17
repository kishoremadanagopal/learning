"""Loss modules: each wraps a function from torch.nn.functional."""
import warnings

from .. import functional as F
from .module import Module

__all__ = ["MSELoss", "L1Loss", "SmoothL1Loss", "HuberLoss", "CrossEntropyLoss", "NLLLoss", "BCELoss", "BCEWithLogitsLoss", "KLDivLoss"]


class _Loss(Module):
    def __init__(self, size_average=None, reduce=None, reduction="mean"):
        super().__init__()
        if reduction not in ("mean", "sum", "none", "batchmean"):
            raise ValueError(f"{reduction} is not a valid value for reduction")
        self.reduction = reduction


class _WeightedLoss(_Loss):
    def __init__(self, weight=None, size_average=None, reduce=None, reduction="mean"):
        super().__init__(size_average, reduce, reduction)
        self.register_buffer("weight", weight)


class MSELoss(_Loss):
    """Mean squared error: the average of (input - target)²."""

    def forward(self, input, target):
        return F.mse_loss(input, target, reduction=self.reduction)


class L1Loss(_Loss):
    """Mean absolute error: the average of |input - target|."""

    def forward(self, input, target):
        return F.l1_loss(input, target, reduction=self.reduction)


class SmoothL1Loss(_Loss):
    def __init__(self, size_average=None, reduce=None, reduction="mean", beta=1.0):
        super().__init__(size_average, reduce, reduction)
        self.beta = beta

    def forward(self, input, target):
        return F.smooth_l1_loss(input, target, reduction=self.reduction, beta=self.beta)


class HuberLoss(_Loss):
    def __init__(self, reduction="mean", delta=1.0):
        super().__init__(reduction=reduction)
        self.delta = delta

    def forward(self, input, target):
        return F.huber_loss(input, target, reduction=self.reduction, delta=self.delta)


class CrossEntropyLoss(_WeightedLoss):
    """For classification: takes raw scores (logits) of shape [batch, classes] and class indices of shape [batch]
    (int64), applies log_softmax and the negative log-likelihood in one step."""

    def __init__(self, weight=None, size_average=None, ignore_index=-100, reduce=None, reduction="mean", label_smoothing=0.0):
        super().__init__(weight, size_average, reduce, reduction)
        self.ignore_index, self.label_smoothing = ignore_index, label_smoothing

    def forward(self, input, target):
        return F.cross_entropy(input, target, weight=self.weight, ignore_index=self.ignore_index, reduction=self.reduction, label_smoothing=self.label_smoothing)


class NLLLoss(_WeightedLoss):
    def __init__(self, weight=None, size_average=None, ignore_index=-100, reduce=None, reduction="mean"):
        super().__init__(weight, size_average, reduce, reduction)
        self.ignore_index = ignore_index

    def forward(self, input, target):
        return F.nll_loss(input, target, weight=self.weight, ignore_index=self.ignore_index, reduction=self.reduction)


class BCELoss(_WeightedLoss):
    """Binary cross-entropy on probabilities (after a sigmoid). Prefer BCEWithLogitsLoss on raw scores."""

    def forward(self, input, target):
        return F.binary_cross_entropy(input, target, weight=self.weight, reduction=self.reduction)


class BCEWithLogitsLoss(_Loss):
    """Sigmoid plus binary cross-entropy in one numerically stable step, on raw scores (logits)."""

    def __init__(self, weight=None, size_average=None, reduce=None, reduction="mean", pos_weight=None):
        super().__init__(size_average, reduce, reduction)
        self.register_buffer("weight", weight)
        self.register_buffer("pos_weight", pos_weight)

    def forward(self, input, target):
        return F.binary_cross_entropy_with_logits(input, target, self.weight, pos_weight=self.pos_weight, reduction=self.reduction)


class KLDivLoss(_Loss):
    def __init__(self, size_average=None, reduce=None, reduction="mean", log_target=False):
        super().__init__(size_average, reduce, reduction)
        self.log_target = log_target

    def forward(self, input, target):
        return F.kl_div(input, target, reduction=self.reduction, log_target=self.log_target)


for _n in __all__:
    globals()[_n].__module__ = "torch.nn.modules.loss"
