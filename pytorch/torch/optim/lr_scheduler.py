"""torch.optim.lr_scheduler: learning-rate schedules. Ported, with only its imports changed, from PyTorch 2.14's
torch/optim/lr_scheduler.py (BSD-3-Clause, Copyright (c) PyTorch contributors), so schedules give exactly the same
numbers as PyTorch."""

from __future__ import annotations

import math
import types
import warnings
from bisect import bisect_right
from collections import Counter
from functools import partial, wraps
from typing import Any, cast, Literal, SupportsFloat, TYPE_CHECKING, TypedDict
Self = Any


def override(f):
    return f


from weakref import ref

from math import inf

from .._core import Tensor

from .optimizer import Optimizer


def _to_scalar(x):
    return x.reshape(()) if isinstance(x, Tensor) else x


if TYPE_CHECKING:
    from collections.abc import Callable, Iterable, Sequence


__all__ = [
    "LambdaLR",
    "MultiplicativeLR",
    "StepLR",
    "MultiStepLR",
    "ConstantLR",
    "LinearLR",
    "ExponentialLR",
    "SequentialLR",
    "CosineAnnealingLR",
    "ChainedScheduler",
    "ReduceLROnPlateau",
    "CyclicLR",
    "CosineAnnealingWarmRestarts",
    "OneCycleLR",
    "PolynomialLR",
    "LRScheduler",
]

EPOCH_DEPRECATION_WARNING = (
    "The epoch parameter in `scheduler.step()` was not necessary and is being "
    "deprecated where possible. Please use `scheduler.step()` to step the "
    "scheduler. During the deprecation, if epoch is different from None, the "
    "closed form is used instead of the new chainable form, where available. "
    "Please open an issue if you are unable to replicate your use case: "
    "https://github.com/pytorch/pytorch/issues/new/choose."
)


def _format_param(name: str, optimizer: Optimizer, param):

    def _copy(_param):
        return _param.clone() if isinstance(_param, Tensor) else _param

    if isinstance(param, (list, tuple)):
        if len(param) != len(optimizer.param_groups):
            raise ValueError(
                f"{name} must have the same length as optimizer.param_groups. "
                f"{name} has {len(param)} values, param_groups has {len(optimizer.param_groups)}."
            )
    else:
        param = [param] * len(optimizer.param_groups)

    return list(map(_copy, param))


def _param_groups_val_list(optimizer: Optimizer, key: str) -> list[Any]:
    return [
        group[key].clone() if isinstance(group[key], Tensor) else group[key]
        for group in optimizer.param_groups
    ]


def _update_param_group_val(
    param_group: dict[str, Any], key: str, val: float | Tensor
) -> None:
    if isinstance(param_group[key], Tensor):
        param_group[key].fill_(_to_scalar(val))
    else:
        param_group[key] = val


class LRScheduler:

    _get_lr_called_within_step: bool = False
    _is_initial: bool = False

    def __init__(
        self,
        optimizer: Optimizer,
        last_epoch: int = -1,
    ) -> None:
        if not isinstance(optimizer, Optimizer):
            raise TypeError(f"{type(optimizer).__name__} is not an Optimizer")
        self.optimizer = optimizer

        if last_epoch == -1:
            for group in optimizer.param_groups:
                initial_lr = group["lr"]
                if isinstance(initial_lr, Tensor):
                    initial_lr = initial_lr.clone()
                group.setdefault("initial_lr", initial_lr)
        else:
            for i, group in enumerate(optimizer.param_groups):
                if "initial_lr" not in group:
                    raise KeyError(
                        f"param 'initial_lr' is not specified in param_groups[{i}] when resuming scheduler with last_epoch >= 0.\n"
                        "This typically happens when:\n"
                        "1. You're trying to resume training from a checkpoint but haven't properly loaded the optimizer state\n"
                        "2. You're using last_epoch >= 0 for a fresh training run (not recommended)"
                    )
        self.base_lrs: list[float | Tensor] = _param_groups_val_list(
            optimizer, "initial_lr"
        )
        self.last_epoch = last_epoch

        def patch_track_step_called(opt: Optimizer):
            if hasattr(opt.step, "_wrapped_by_lr_sched"):
                return opt.step

            def wrap_step(step_fn):
                opt_ref = ref(self.optimizer)
                func = step_fn.__func__

                @wraps(func)
                def wrapper(*args, **kwargs):
                    opt = opt_ref()
                    opt._opt_called = True  # type: ignore[union-attr]
                    return func.__get__(opt, opt.__class__)(*args, **kwargs)

                wrapper._wrapped_by_lr_sched = True  # type: ignore[attr-defined]
                return wrapper

            opt.step = wrap_step(opt.step)  # type: ignore[method-assign]

        patch_track_step_called(self.optimizer)
        self._initial_step()

    def _initial_step(self) -> None:
        self._step_count = 0
        with _initial_mode(self):
            self.step()

    def state_dict(self) -> dict[str, Any]:
        return {
            key: value for key, value in self.__dict__.items() if key != "optimizer"
        }

    def load_state_dict(self, state_dict: dict[str, Any]) -> None:
        self.__dict__.update(state_dict)

    def get_last_lr(self) -> list[float | Tensor]:
        return self._last_lr

    def get_lr(self) -> list[float | Tensor]:
        raise NotImplementedError

    def step(self, epoch: int | None = None) -> None:
        if self._step_count == 1:
            if not hasattr(self.optimizer.step, "_wrapped_by_lr_sched"):
                warnings.warn(
                    "Seems like `optimizer.step()` has been overridden after learning rate scheduler "
                    "initialization. Please, make sure to call `optimizer.step()` before "
                    "`lr_scheduler.step()`. See more details at "
                    "https://pytorch.org/docs/stable/optim.html#how-to-adjust-learning-rate",
                    UserWarning,
                    stacklevel=2,
                )

            elif not getattr(self.optimizer, "_opt_called", False):
                warnings.warn(
                    "Detected call of `lr_scheduler.step()` before `optimizer.step()`. "
                    "In PyTorch 1.1.0 and later, you should call them in the opposite order: "
                    "`optimizer.step()` before `lr_scheduler.step()`.  Failure to do this "
                    "will result in PyTorch skipping the first value of the learning rate schedule. "
                    "See more details at "
                    "https://pytorch.org/docs/stable/optim.html#how-to-adjust-learning-rate",
                    UserWarning,
                    stacklevel=2,
                )

        self._step_count += 1
        if epoch is not None:
            warnings.warn(EPOCH_DEPRECATION_WARNING, UserWarning, stacklevel=2)
        self._update_lr(epoch)

    def _update_lr(self, epoch: int | None = None) -> None:
        with _enable_get_lr_call(self):
            if epoch is None:
                self.last_epoch += 1
                values = self.get_lr()
            else:
                self.last_epoch = epoch
                if hasattr(self, "_get_closed_form_lr"):
                    values = cast(list[float | Tensor], self._get_closed_form_lr())
                else:
                    values = self.get_lr()

        for param_group, lr in zip(self.optimizer.param_groups, values, strict=True):
            _update_param_group_val(param_group, "lr", lr)

        self._last_lr: list[float | Tensor] = _param_groups_val_list(
            self.optimizer, "lr"
        )


def _warn_get_lr_called_within_step(lr_scheduler: LRScheduler) -> None:
    if not lr_scheduler._get_lr_called_within_step:
        warnings.warn(
            "To get the last learning rate computed by the scheduler, "
            "please use `get_last_lr()`.",
            UserWarning,
            stacklevel=2,
        )


class _LRScheduler(LRScheduler):
    pass


class _enable_get_lr_call:
    def __init__(self, o: LRScheduler) -> None:
        self.o = o

    def __enter__(self) -> Self:
        self.o._get_lr_called_within_step = True
        return self

    def __exit__(self, type, value, traceback) -> None:
        self.o._get_lr_called_within_step = False


class _initial_mode:
    def __init__(self, o: LRScheduler) -> None:
        self.o = o

    def __enter__(self):
        self.o._is_initial = True

    def __exit__(self, type, value, traceback):
        self.o._is_initial = False


class LambdaLR(LRScheduler):

    def __init__(
        self,
        optimizer: Optimizer,
        lr_lambda: Callable[[int], float] | list[Callable[[int], float]],
        last_epoch: int = -1,
    ) -> None:
        self.optimizer = optimizer

        self.lr_lambdas: list[Callable[[int], float]]
        if not isinstance(lr_lambda, list) and not isinstance(lr_lambda, tuple):
            self.lr_lambdas = [lr_lambda] * len(optimizer.param_groups)
        else:
            if len(lr_lambda) != len(optimizer.param_groups):
                raise ValueError(
                    f"Expected {len(optimizer.param_groups)} lr_lambdas, but got {len(lr_lambda)}"
                )
            self.lr_lambdas = list(lr_lambda)
        super().__init__(optimizer, last_epoch)

    @override
    def state_dict(self) -> dict[str, Any]:
        state_dict = {
            key: value
            for key, value in self.__dict__.items()
            if key not in ("optimizer", "lr_lambdas")
        }
        state_dict["lr_lambdas"] = [None] * len(self.lr_lambdas)

        for idx, fn in enumerate(self.lr_lambdas):
            if not isinstance(fn, types.FunctionType):
                state_dict["lr_lambdas"][idx] = fn.__dict__.copy()

        return state_dict

    @override
    def load_state_dict(self, state_dict: dict[str, Any]) -> None:
        lr_lambdas = state_dict.pop("lr_lambdas")
        self.__dict__.update(state_dict)
        state_dict["lr_lambdas"] = lr_lambdas

        for idx, fn in enumerate(lr_lambdas):
            if fn is not None:
                self.lr_lambdas[idx].__dict__.update(fn)

    @override
    def get_lr(self) -> list[float | Tensor]:
        _warn_get_lr_called_within_step(self)

        return [
            base_lr * lmbda(self.last_epoch)
            for lmbda, base_lr in zip(self.lr_lambdas, self.base_lrs, strict=True)
        ]


class MultiplicativeLR(LRScheduler):

    def __init__(
        self,
        optimizer: Optimizer,
        lr_lambda: Callable[[int], float] | list[Callable[[int], float]],
        last_epoch: int = -1,
    ) -> None:
        self.optimizer = optimizer

        self.lr_lambdas: list[Callable[[int], float]]
        if not isinstance(lr_lambda, list) and not isinstance(lr_lambda, tuple):
            self.lr_lambdas = [lr_lambda] * len(optimizer.param_groups)
        else:
            if len(lr_lambda) != len(optimizer.param_groups):
                raise ValueError(
                    f"Expected {len(optimizer.param_groups)} lr_lambdas, but got {len(lr_lambda)}"
                )
            self.lr_lambdas = list(lr_lambda)
        for lr_lambda in self.lr_lambdas:
            if not callable(lr_lambda):
                raise TypeError(
                    f"lr_lambda should be a function, but got {type(lr_lambda).__name__}"
                )
        super().__init__(optimizer, last_epoch)

    @override
    def state_dict(self) -> dict[str, Any]:
        state_dict = {
            key: value
            for key, value in self.__dict__.items()
            if key not in ("optimizer", "lr_lambdas")
        }
        state_dict["lr_lambdas"] = [None] * len(self.lr_lambdas)

        for idx, fn in enumerate(self.lr_lambdas):
            if not isinstance(fn, types.FunctionType):
                state_dict["lr_lambdas"][idx] = fn.__dict__.copy()

        return state_dict

    @override
    def load_state_dict(self, state_dict: dict[str, Any]) -> None:
        lr_lambdas = state_dict.pop("lr_lambdas")
        self.__dict__.update(state_dict)
        state_dict["lr_lambdas"] = lr_lambdas

        for idx, fn in enumerate(lr_lambdas):
            if fn is not None:
                self.lr_lambdas[idx].__dict__.update(fn)

    @override
    def get_lr(self) -> list[float | Tensor]:
        _warn_get_lr_called_within_step(self)

        if not self._is_initial:
            return [
                group["lr"] * lmbda(self.last_epoch)
                for lmbda, group in zip(
                    self.lr_lambdas, self.optimizer.param_groups, strict=True
                )
            ]
        else:
            return _param_groups_val_list(self.optimizer, "lr")


class StepLR(LRScheduler):

    def __init__(
        self,
        optimizer: Optimizer,
        step_size: int,
        gamma: float = 0.1,
        last_epoch: int = -1,
    ) -> None:
        self.step_size = step_size
        self.gamma = gamma
        super().__init__(optimizer, last_epoch)

    @override
    def get_lr(self) -> list[float | Tensor]:
        _warn_get_lr_called_within_step(self)

        if (self.last_epoch == 0) or (self.last_epoch % self.step_size != 0):
            return _param_groups_val_list(self.optimizer, "lr")
        return [group["lr"] * self.gamma for group in self.optimizer.param_groups]

    def _get_closed_form_lr(self) -> list[float | Tensor]:
        return [
            base_lr * self.gamma ** (self.last_epoch // self.step_size)
            for base_lr in self.base_lrs
        ]


class MultiStepLR(LRScheduler):

    def __init__(
        self,
        optimizer: Optimizer,
        milestones: Iterable[int],
        gamma: float = 0.1,
        last_epoch: int = -1,
    ) -> None:
        self.milestones = Counter(milestones)
        self.gamma = gamma
        super().__init__(optimizer, last_epoch)

    @override
    def get_lr(self) -> list[float | Tensor]:
        _warn_get_lr_called_within_step(self)

        if self.last_epoch not in self.milestones:
            return _param_groups_val_list(self.optimizer, "lr")
        return [
            group["lr"] * self.gamma ** self.milestones[self.last_epoch]
            for group in self.optimizer.param_groups
        ]

    def _get_closed_form_lr(self):
        milestones = sorted(self.milestones.elements())
        return [
            base_lr * self.gamma ** bisect_right(milestones, self.last_epoch)
            for base_lr in self.base_lrs
        ]


class ConstantLR(LRScheduler):

    def __init__(
        self,
        optimizer: Optimizer,
        factor: float = 1.0 / 3,
        total_iters: int = 5,
        last_epoch: int = -1,
    ) -> None:
        if factor > 1.0 or factor < 0:
            raise ValueError(
                "Constant multiplicative factor expected to be between 0 and 1."
            )

        self.factor = factor
        self.total_iters = total_iters
        super().__init__(optimizer, last_epoch)

    @override
    def get_lr(self) -> list[float | Tensor]:
        _warn_get_lr_called_within_step(self)

        if self.last_epoch == 0:
            return [group["lr"] * self.factor for group in self.optimizer.param_groups]

        if self.last_epoch != self.total_iters:
            return _param_groups_val_list(self.optimizer, "lr")

        return [
            group["lr"] * (1.0 / self.factor) for group in self.optimizer.param_groups
        ]

    def _get_closed_form_lr(self):
        return [
            base_lr
            * (self.factor + (self.last_epoch >= self.total_iters) * (1 - self.factor))
            for base_lr in self.base_lrs
        ]


class LinearLR(LRScheduler):

    def __init__(
        self,
        optimizer: Optimizer,
        start_factor: float = 1.0 / 3,
        end_factor: float = 1.0,
        total_iters: int = 5,
        last_epoch: int = -1,
    ) -> None:
        if start_factor > 1.0 or start_factor <= 0:
            raise ValueError(
                "Starting multiplicative factor expected to be greater than 0 and less or equal to 1."
            )

        if end_factor > 1.0 or end_factor < 0:
            raise ValueError(
                "Ending multiplicative factor expected to be between 0 and 1."
            )

        self.start_factor = start_factor
        self.end_factor = end_factor
        self.total_iters = total_iters
        super().__init__(optimizer, last_epoch)

    @override
    def get_lr(self) -> list[float | Tensor]:
        _warn_get_lr_called_within_step(self)

        if self.last_epoch == 0:
            return [
                group["lr"] * self.start_factor for group in self.optimizer.param_groups
            ]

        if self._is_initial or self.last_epoch > self.total_iters:
            return _param_groups_val_list(self.optimizer, "lr")

        return [
            group["lr"]
            * (
                1.0
                + (self.end_factor - self.start_factor)
                / (
                    self.total_iters * self.start_factor
                    + (self.last_epoch - 1) * (self.end_factor - self.start_factor)
                )
            )
            for group in self.optimizer.param_groups
        ]

    def _get_closed_form_lr(self):
        return [
            base_lr
            * (
                self.start_factor
                + (self.end_factor - self.start_factor)
                * min(self.total_iters, self.last_epoch)
                / self.total_iters
            )
            for base_lr in self.base_lrs
        ]


class ExponentialLR(LRScheduler):

    def __init__(
        self,
        optimizer: Optimizer,
        gamma: float,
        last_epoch: int = -1,
    ) -> None:
        self.gamma = gamma
        super().__init__(optimizer, last_epoch)

    @override
    def get_lr(self) -> list[float | Tensor]:
        _warn_get_lr_called_within_step(self)

        if self._is_initial:
            return _param_groups_val_list(self.optimizer, "lr")
        return [group["lr"] * self.gamma for group in self.optimizer.param_groups]

    def _get_closed_form_lr(self):
        return [base_lr * self.gamma**self.last_epoch for base_lr in self.base_lrs]


class SequentialLR(LRScheduler):

    def __init__(
        self,
        optimizer: Optimizer,
        schedulers: list[LRScheduler],
        milestones: list[int],
        last_epoch: int = -1,
    ) -> None:
        if len(schedulers) < 1:
            raise ValueError(
                f"{self.__class__.__name__} expects at least one scheduler, but got no scheduler."
            )

        for scheduler_idx, scheduler in enumerate(schedulers):
            if not hasattr(scheduler, "optimizer"):
                raise TypeError(
                    f"{self.__class__.__name__} at index {scheduler_idx} should have `optimizer` as its attribute."
                )
            if isinstance(scheduler, ReduceLROnPlateau):
                raise ValueError(
                    f"{self.__class__.__name__} does not support `ReduceLROnPlateau` scheduler as it "
                    "requires additional kwargs to be specified when calling `step`, "
                    f"but got one at index {scheduler_idx} in the given schedulers sequence."
                )
            if optimizer != scheduler.optimizer:
                raise ValueError(
                    f"{self.__class__.__name__} expects all schedulers to belong to the same optimizer, but "
                    f"got scheduler {scheduler.__class__.__name__} at index {scheduler_idx} has {scheduler.optimizer}, "
                    f"which is different from {optimizer.__class__.__name__}."
                )

        if len(milestones) != len(schedulers) - 1:
            raise ValueError(
                "Sequential Schedulers expects number of schedulers provided to be one more "
                f"than the number of milestone points, but got number of schedulers {len(schedulers)} and the "
                f"number of milestones to be equal to {len(milestones)}"
            )
        self._schedulers = schedulers
        self._milestones = milestones
        self.last_epoch = last_epoch + 1
        self.optimizer = optimizer

        for group in self.optimizer.param_groups:
            _update_param_group_val(group, "lr", group["initial_lr"])

        self.recursive_undo()

        idx = bisect_right(self._milestones, 0)
        self._schedulers[idx]._initial_step()

        self._last_lr = schedulers[idx].get_last_lr()

    def recursive_undo(self, sched=None) -> None:
        scheds = self if sched is None else sched

        if hasattr(scheds, "_schedulers"):
            for s in scheds._schedulers:
                self.recursive_undo(s)
        elif hasattr(scheds, "last_epoch"):
            scheds.last_epoch -= 1

    def step(self) -> None:  # type: ignore[override]
        self.last_epoch += 1
        idx = bisect_right(self._milestones, self.last_epoch)
        scheduler = self._schedulers[idx]
        if idx > 0 and self._milestones[idx - 1] == self.last_epoch:
            scheduler._update_lr(0)
        else:
            scheduler.step()

        self._last_lr = scheduler.get_last_lr()

    @override
    def state_dict(self) -> dict[str, Any]:
        state_dict = {
            key: value
            for key, value in self.__dict__.items()
            if key not in ("optimizer", "_schedulers")
        }
        state_dict["_schedulers"] = [None] * len(self._schedulers)

        for idx, s in enumerate(self._schedulers):
            state_dict["_schedulers"][idx] = s.state_dict()

        return state_dict

    @override
    def load_state_dict(self, state_dict: dict[str, Any]) -> None:
        _schedulers = state_dict.pop("_schedulers")
        self.__dict__.update(state_dict)
        state_dict["_schedulers"] = _schedulers

        for idx, s in enumerate(_schedulers):
            self._schedulers[idx].load_state_dict(s)


class PolynomialLR(LRScheduler):

    def __init__(
        self,
        optimizer: Optimizer,
        total_iters: int = 5,
        power: float = 1.0,
        last_epoch: int = -1,
    ) -> None:
        self.total_iters = total_iters
        self.power = power
        super().__init__(optimizer, last_epoch)

    @override
    def get_lr(self) -> list[float | Tensor]:
        _warn_get_lr_called_within_step(self)

        if self._is_initial or self.last_epoch > self.total_iters:
            return _param_groups_val_list(self.optimizer, "lr")

        decay_factor = (
            (1.0 - self.last_epoch / self.total_iters)
            / (1.0 - (self.last_epoch - 1) / self.total_iters)
        ) ** self.power
        return [group["lr"] * decay_factor for group in self.optimizer.param_groups]

    def _get_closed_form_lr(self) -> list[float | Tensor]:
        return [
            (
                base_lr
                * (1.0 - min(self.total_iters, self.last_epoch) / self.total_iters)
                ** self.power
            )
            for base_lr in self.base_lrs
        ]


class CosineAnnealingLR(LRScheduler):

    def __init__(
        self,
        optimizer: Optimizer,
        T_max: int,
        eta_min: float = 0.0,
        last_epoch: int = -1,
    ) -> None:
        self.T_max = T_max
        self.eta_min = eta_min
        super().__init__(optimizer, last_epoch)

    @override
    def get_lr(self) -> list[float | Tensor]:
        _warn_get_lr_called_within_step(self)

        if self._is_initial:
            return _param_groups_val_list(self.optimizer, "lr")
        elif self._step_count == 1 and self.last_epoch > 0:
            return [
                self.eta_min
                + (base_lr - self.eta_min)
                * (1 + math.cos((self.last_epoch) * math.pi / self.T_max))
                / 2
                for base_lr, group in zip(
                    self.base_lrs, self.optimizer.param_groups, strict=True
                )
            ]
        elif (self.last_epoch - 1 - self.T_max) % (2 * self.T_max) == 0:
            return [
                group["lr"]
                + (base_lr - self.eta_min) * (1 - math.cos(math.pi / self.T_max)) / 2
                for base_lr, group in zip(
                    self.base_lrs, self.optimizer.param_groups, strict=True
                )
            ]
        return [
            (1 + math.cos(math.pi * self.last_epoch / self.T_max))
            / (1 + math.cos(math.pi * (self.last_epoch - 1) / self.T_max))
            * (group["lr"] - self.eta_min)
            + self.eta_min
            for group in self.optimizer.param_groups
        ]

    def _get_closed_form_lr(self) -> list[float | Tensor]:
        return [
            self.eta_min
            + (base_lr - self.eta_min)
            * (1 + math.cos(math.pi * self.last_epoch / self.T_max))
            / 2
            for base_lr in self.base_lrs
        ]


class ChainedScheduler(LRScheduler):

    def __init__(
        self, schedulers: Sequence[LRScheduler], optimizer: Optimizer | None = None
    ) -> None:
        if len(schedulers) < 1:
            raise ValueError(
                f"{self.__class__.__name__} expects at least one scheduler to be chained, but got no scheduler."
            )

        optimizer = optimizer or schedulers[0].optimizer
        for scheduler_idx, scheduler in enumerate(schedulers):
            if not hasattr(scheduler, "optimizer"):
                raise TypeError(
                    f"{self.__class__.__name__} at index {scheduler_idx} should have `optimizer` as its attribute."
                )
            if isinstance(scheduler, ReduceLROnPlateau):
                raise ValueError(
                    f"{self.__class__.__name__} does not support `ReduceLROnPlateau` scheduler as it "
                    "requires additional kwargs to be specified when calling `step`, "
                    f"but got one at index {scheduler_idx} in the given schedulers sequence."
                )
            if optimizer != scheduler.optimizer:
                raise ValueError(
                    f"{self.__class__.__name__} expects all schedulers to belong to the same optimizer, but "
                    f"got scheduler {scheduler.__class__.__name__} at index {scheduler_idx} has {scheduler.optimizer}, "
                    f"which is different from {optimizer.__class__.__name__}."
                )
        self._schedulers = schedulers
        self.optimizer = optimizer
        self._last_lr = _param_groups_val_list(self._schedulers[-1].optimizer, "lr")

    def step(self) -> None:  # type: ignore[override]
        for scheduler in self._schedulers:
            scheduler.step()
        self._last_lr = _param_groups_val_list(self._schedulers[-1].optimizer, "lr")

    @override
    def state_dict(self) -> dict[str, Any]:
        state_dict = {
            key: value
            for key, value in self.__dict__.items()
            if key not in ("optimizer", "_schedulers")
        }
        state_dict["_schedulers"] = [None] * len(self._schedulers)

        for idx, s in enumerate(self._schedulers):
            state_dict["_schedulers"][idx] = s.state_dict()

        return state_dict

    @override
    def load_state_dict(self, state_dict: dict[str, Any]) -> None:
        _schedulers = state_dict.pop("_schedulers")
        self.__dict__.update(state_dict)
        state_dict["_schedulers"] = _schedulers

        for idx, s in enumerate(_schedulers):
            self._schedulers[idx].load_state_dict(s)


class ReduceLROnPlateau(LRScheduler):

    def __init__(
        self,
        optimizer: Optimizer,
        mode: Literal["min", "max"] = "min",
        factor: float = 0.1,
        patience: int = 10,
        threshold: float = 1e-4,
        threshold_mode: Literal["rel", "abs"] = "rel",
        cooldown: int = 0,
        min_lr: list[float] | float = 0,
        eps: float = 1e-8,
    ) -> None:
        if factor >= 1.0:
            raise ValueError("Factor should be < 1.0.")
        self.factor = factor

        if not isinstance(optimizer, Optimizer):
            raise TypeError(f"{type(optimizer).__name__} is not an Optimizer")
        self.optimizer = optimizer

        if isinstance(min_lr, (list, tuple)):
            if len(min_lr) != len(optimizer.param_groups):
                raise ValueError(
                    f"expected {len(optimizer.param_groups)} min_lrs, got {len(min_lr)}"
                )
            self.default_min_lr = None
            self.min_lrs = list(min_lr)
        else:
            self.default_min_lr = min_lr
            self.min_lrs = [min_lr] * len(optimizer.param_groups)

        self.patience = patience
        self.cooldown = cooldown
        self.eps = eps
        self.last_epoch = 0
        self._last_lr = _param_groups_val_list(self.optimizer, "lr")
        self._init_is_better(
            mode=mode, threshold=threshold, threshold_mode=threshold_mode
        )
        self._reset()

    def _reset(self) -> None:
        self.best = self.mode_worse
        self.cooldown_counter = 0
        self.num_bad_epochs = 0

    def step(self, metrics: SupportsFloat, epoch=None) -> None:  # type: ignore[override]
        current = float(metrics)
        if epoch is None:
            epoch = self.last_epoch + 1
        else:
            warnings.warn(EPOCH_DEPRECATION_WARNING, UserWarning, stacklevel=2)
        self.last_epoch = epoch

        if self._is_better(current, self.best):
            self.best = current
            self.num_bad_epochs = 0
        else:
            self.num_bad_epochs += 1

        if self.in_cooldown:
            self.cooldown_counter -= 1
            self.num_bad_epochs = 0  # ignore any bad epochs in cooldown

        if self.num_bad_epochs > self.patience:
            self._reduce_lr(epoch)
            self.cooldown_counter = self.cooldown
            self.num_bad_epochs = 0

        self._last_lr = _param_groups_val_list(self.optimizer, "lr")

    def _reduce_lr(self, epoch) -> None:
        if len(self.optimizer.param_groups) != len(self.min_lrs):
            if self.default_min_lr is None:
                raise RuntimeError(
                    "The number of param groups in the `optimizer` "
                    f"({len(self.optimizer.param_groups)}) differs "
                    f"from when `ReduceLROnPlateau` was initialized "
                    f"({len(self.min_lrs)}), usually due to a new "
                    "param group being added to the optimizer. Please "
                    "modify the `min_lrs` field to match the length "
                    "of the `optimizer` param groups."
                )
            else:
                self.min_lrs = [self.default_min_lr] * len(self.optimizer.param_groups)

        for i, param_group in enumerate(self.optimizer.param_groups):
            old_lr = float(param_group["lr"])
            new_lr = max(old_lr * self.factor, self.min_lrs[i])
            if old_lr - new_lr > self.eps:
                _update_param_group_val(param_group, "lr", new_lr)

    @property
    def in_cooldown(self):
        return self.cooldown_counter > 0

    def _is_better(self, a, best):
        if self.mode == "min" and self.threshold_mode == "rel":
            rel_epsilon = 1.0 - self.threshold
            return a < best * rel_epsilon

        elif self.mode == "min" and self.threshold_mode == "abs":
            return a < best - self.threshold

        elif self.mode == "max" and self.threshold_mode == "rel":
            rel_epsilon = self.threshold + 1.0
            return a > best * rel_epsilon

        else:  # mode == 'max' and epsilon_mode == 'abs':
            return a > best + self.threshold

    def _init_is_better(self, mode, threshold, threshold_mode) -> None:
        if mode not in {"min", "max"}:
            raise ValueError("mode " + mode + " is unknown!")
        if threshold_mode not in {"rel", "abs"}:
            raise ValueError("threshold mode " + threshold_mode + " is unknown!")

        if mode == "min":
            self.mode_worse = inf
        else:  # mode == 'max':
            self.mode_worse = -inf

        self.mode = mode
        self.threshold = threshold
        self.threshold_mode = threshold_mode

    @override
    def load_state_dict(self, state_dict: dict[str, Any]) -> None:
        self.__dict__.update(state_dict)
        self._init_is_better(
            mode=self.mode, threshold=self.threshold, threshold_mode=self.threshold_mode
        )


class CyclicLR(LRScheduler):

    def __init__(
        self,
        optimizer: Optimizer,
        base_lr: float | list[float],
        max_lr: float | list[float],
        step_size_up: int = 2000,
        step_size_down: int | None = None,
        mode: Literal["triangular", "triangular2", "exp_range"] = "triangular",
        gamma: float = 1.0,
        scale_fn: Callable[[float], float] | None = None,
        scale_mode: Literal["cycle", "iterations"] = "cycle",
        cycle_momentum: bool = True,
        base_momentum: float = 0.8,
        max_momentum: float = 0.9,
        last_epoch: int = -1,
    ) -> None:
        if not isinstance(optimizer, Optimizer):
            raise TypeError(f"{type(optimizer).__name__} is not an Optimizer")
        self.optimizer = optimizer

        base_lrs = _format_param("base_lr", optimizer, base_lr)
        if last_epoch == -1:
            for lr, group in zip(base_lrs, optimizer.param_groups, strict=True):
                _update_param_group_val(group, "lr", lr)

        self.max_lrs = _format_param("max_lr", optimizer, max_lr)

        step_size_up = float(step_size_up)
        step_size_down = (
            float(step_size_down) if step_size_down is not None else step_size_up
        )
        self.total_size = step_size_up + step_size_down
        self.step_ratio = step_size_up / self.total_size

        if mode not in ["triangular", "triangular2", "exp_range"] and scale_fn is None:
            raise ValueError("mode is invalid and scale_fn is None")

        self.mode = mode
        self.gamma = gamma

        self._scale_fn_ref: Callable[[float], float]
        self._scale_fn_custom = scale_fn
        self.scale_mode = scale_mode
        self._init_scale_fn()

        self.cycle_momentum = cycle_momentum
        if cycle_momentum:
            if (
                "momentum" not in optimizer.defaults
                and "betas" not in optimizer.defaults
            ):
                raise ValueError(
                    "optimizer must support momentum or beta1 with `cycle_momentum` option enabled"
                )

            self.use_beta1 = "betas" in self.optimizer.defaults
            self.base_momentums = _format_param(
                "base_momentum", optimizer, base_momentum
            )
            self.max_momentums = _format_param("max_momentum", optimizer, max_momentum)
            if last_epoch == -1:
                for m_momentum, b_momentum, group in zip(
                    self.max_momentums,
                    self.base_momentums,
                    optimizer.param_groups,
                    strict=True,
                ):
                    if self.use_beta1:
                        group["betas"] = (m_momentum, *group["betas"][1:])
                    else:
                        group["momentum"] = m_momentum
                    group["max_momentum"] = m_momentum
                    group["base_momentum"] = b_momentum

        super().__init__(optimizer, last_epoch)
        self.base_lrs = base_lrs

    def _init_scale_fn(self) -> None:
        if self._scale_fn_custom is not None:
            return
        if self.mode == "triangular":
            self._scale_fn_ref = self._triangular_scale_fn
            self.scale_mode = "cycle"
        elif self.mode == "triangular2":
            self._scale_fn_ref = self._triangular2_scale_fn
            self.scale_mode = "cycle"
        elif self.mode == "exp_range":
            self._scale_fn_ref = partial(self._exp_range_scale_fn, self.gamma)
            self.scale_mode = "iterations"

    def scale_fn(self, x) -> float:
        if self._scale_fn_custom is not None:
            return self._scale_fn_custom(x)
        else:
            return self._scale_fn_ref(x)  # static method

    @staticmethod
    def _triangular_scale_fn(x: float) -> float:
        return 1.0

    @staticmethod
    def _triangular2_scale_fn(x: float) -> float:
        return 1 / (2.0 ** (x - 1))

    @staticmethod
    def _exp_range_scale_fn(gamma: float, x: float) -> float:
        return gamma**x

    @override
    def get_lr(self) -> list[float | Tensor]:
        _warn_get_lr_called_within_step(self)

        cycle = math.floor(1 + self.last_epoch / self.total_size)
        x = 1.0 + self.last_epoch / self.total_size - cycle
        if x <= self.step_ratio:
            scale_factor = x / self.step_ratio
        else:
            scale_factor = (x - 1) / (self.step_ratio - 1)

        lrs = []
        for base_lr, max_lr in zip(self.base_lrs, self.max_lrs, strict=True):
            base_height = (max_lr - base_lr) * scale_factor
            if self.scale_mode == "cycle":
                lr = base_lr + base_height * self.scale_fn(cycle)
            else:
                lr = base_lr + base_height * self.scale_fn(self.last_epoch)
            lrs.append(lr)

        if self.cycle_momentum:
            momentums = []
            for base_momentum, max_momentum in zip(
                self.base_momentums, self.max_momentums, strict=True
            ):
                base_height = (max_momentum - base_momentum) * scale_factor
                if self.scale_mode == "cycle":
                    momentum = max_momentum - base_height * self.scale_fn(cycle)
                else:
                    momentum = max_momentum - base_height * self.scale_fn(
                        self.last_epoch
                    )
                momentums.append(momentum)
            for param_group, momentum in zip(
                self.optimizer.param_groups, momentums, strict=True
            ):
                if self.use_beta1:
                    param_group["betas"] = (momentum, *param_group["betas"][1:])
                else:
                    param_group["momentum"] = momentum

        return lrs

    @override
    def state_dict(self) -> dict[str, Any]:
        state = super().state_dict()
        state.pop("_scale_fn_ref", None)
        fn = state.pop("_scale_fn_custom")
        state["_scale_fn_custom"] = None
        if fn is not None and not isinstance(fn, types.FunctionType):
            state["_scale_fn_custom"] = fn.__dict__.copy()

        return state

    @override
    def load_state_dict(self, state_dict: dict[str, Any]) -> None:
        fn = state_dict.pop("_scale_fn_custom")
        super().load_state_dict(state_dict)
        if fn is not None:
            self._scale_fn_custom.__dict__.update(fn)
        self._init_scale_fn()


class CosineAnnealingWarmRestarts(LRScheduler):

    def __init__(
        self,
        optimizer: Optimizer,
        T_0: int,
        T_mult: int = 1,
        eta_min: float = 0.0,
        last_epoch: int = -1,
    ) -> None:
        if T_0 <= 0 or not isinstance(T_0, int):
            raise ValueError(f"Expected positive integer T_0, but got {T_0}")
        if T_mult < 1 or not isinstance(T_mult, int):
            raise ValueError(f"Expected integer T_mult >= 1, but got {T_mult}")
        if not isinstance(eta_min, (float, int)):
            raise ValueError(
                f"Expected float or int eta_min, but got {eta_min} of type {type(eta_min)}"
            )
        self.T_0 = T_0
        self.T_i = T_0
        self.T_mult = T_mult
        self.eta_min = eta_min
        self.T_cur = last_epoch
        super().__init__(optimizer, last_epoch)

    @override
    def get_lr(self) -> list[float | Tensor]:
        _warn_get_lr_called_within_step(self)

        return [
            self.eta_min
            + (base_lr - self.eta_min)
            * (1 + math.cos(math.pi * self.T_cur / self.T_i))
            / 2
            for base_lr in self.base_lrs
        ]

    @override
    def step(self, epoch=None) -> None:
        if epoch is None and self.last_epoch < 0:
            epoch = 0

        if epoch is None:
            epoch = self.last_epoch + 1
            self.T_cur = self.T_cur + 1
            if self.T_cur >= self.T_i:
                self.T_cur = self.T_cur % self.T_i
                self.T_i = self.T_i * self.T_mult
        else:
            if epoch < 0:
                raise ValueError(f"Expected non-negative epoch, but got {epoch}")
            if epoch >= self.T_0:
                if self.T_mult == 1:
                    self.T_cur = epoch % self.T_0
                else:
                    n = int(
                        math.log(
                            (epoch / self.T_0 * (self.T_mult - 1) + 1), self.T_mult
                        )
                    )
                    self.T_cur = epoch - self.T_0 * (self.T_mult**n - 1) / (
                        self.T_mult - 1
                    )
                    self.T_i = self.T_0 * self.T_mult ** (n)
            else:
                self.T_i = self.T_0
                self.T_cur = epoch
        self.last_epoch = math.floor(epoch)

        with _enable_get_lr_call(self):
            for param_group, lr in zip(
                self.optimizer.param_groups, self.get_lr(), strict=True
            ):
                _update_param_group_val(param_group, "lr", lr)

        self._last_lr = _param_groups_val_list(self.optimizer, "lr")


class _SchedulePhase(TypedDict):
    end_step: float
    start_lr: str
    end_lr: str
    start_momentum: str
    end_momentum: str


class OneCycleLR(LRScheduler):

    def __init__(
        self,
        optimizer: Optimizer,
        max_lr: float | list[float],
        total_steps: int | None = None,
        epochs: int | None = None,
        steps_per_epoch: int | None = None,
        pct_start: float = 0.3,
        anneal_strategy: Literal["cos", "linear"] = "cos",
        cycle_momentum: bool = True,
        base_momentum: float | list[float] = 0.85,
        max_momentum: float | list[float] = 0.95,
        div_factor: float = 25.0,
        final_div_factor: float = 1e4,
        three_phase: bool = False,
        last_epoch: int = -1,
    ) -> None:
        if not isinstance(optimizer, Optimizer):
            raise TypeError(f"{type(optimizer).__name__} is not an Optimizer")
        self.optimizer = optimizer

        if total_steps is not None:
            if total_steps <= 0 or not isinstance(total_steps, int):
                raise ValueError(
                    f"Expected positive integer total_steps, but got {total_steps}"
                )
            self.total_steps = total_steps
        elif epochs is not None and steps_per_epoch is not None:
            if not isinstance(epochs, int) or epochs <= 0:
                raise ValueError(f"Expected positive integer epochs, but got {epochs}")
            if not isinstance(steps_per_epoch, int) or steps_per_epoch <= 0:
                raise ValueError(
                    f"Expected positive integer steps_per_epoch, but got {steps_per_epoch}"
                )
            self.total_steps = epochs * steps_per_epoch
        else:
            raise ValueError(
                "You must define either total_steps OR (epochs AND steps_per_epoch)"
            )

        self._schedule_phases: list[_SchedulePhase]
        if three_phase:
            self._schedule_phases = [
                {
                    "end_step": float(pct_start * self.total_steps) - 1,
                    "start_lr": "initial_lr",
                    "end_lr": "max_lr",
                    "start_momentum": "max_momentum",
                    "end_momentum": "base_momentum",
                },
                {
                    "end_step": float(2 * pct_start * self.total_steps) - 2,
                    "start_lr": "max_lr",
                    "end_lr": "initial_lr",
                    "start_momentum": "base_momentum",
                    "end_momentum": "max_momentum",
                },
                {
                    "end_step": self.total_steps - 1,
                    "start_lr": "initial_lr",
                    "end_lr": "min_lr",
                    "start_momentum": "max_momentum",
                    "end_momentum": "max_momentum",
                },
            ]
        else:
            self._schedule_phases = [
                {
                    "end_step": float(pct_start * self.total_steps) - 1,
                    "start_lr": "initial_lr",
                    "end_lr": "max_lr",
                    "start_momentum": "max_momentum",
                    "end_momentum": "base_momentum",
                },
                {
                    "end_step": self.total_steps - 1,
                    "start_lr": "max_lr",
                    "end_lr": "min_lr",
                    "start_momentum": "base_momentum",
                    "end_momentum": "max_momentum",
                },
            ]

        if pct_start < 0 or pct_start > 1 or not isinstance(pct_start, float):
            raise ValueError(
                f"Expected float between 0 and 1 pct_start, but got {pct_start}"
            )

        if anneal_strategy not in ["cos", "linear"]:
            raise ValueError(
                f"anneal_strategy must be one of 'cos' or 'linear', instead got {anneal_strategy}"
            )
        else:
            self._anneal_func_type = anneal_strategy

        max_lrs = _format_param("max_lr", self.optimizer, max_lr)
        if last_epoch == -1:
            for idx, group in enumerate(self.optimizer.param_groups):
                group["initial_lr"] = max_lrs[idx] / div_factor
                group["max_lr"] = max_lrs[idx]
                group["min_lr"] = group["initial_lr"] / final_div_factor

        self.cycle_momentum = cycle_momentum
        if self.cycle_momentum:
            if (
                "momentum" not in self.optimizer.defaults
                and "betas" not in self.optimizer.defaults
            ):
                raise ValueError(
                    "optimizer must support momentum or beta1 with `cycle_momentum` option enabled"
                )
            self.use_beta1 = "betas" in self.optimizer.defaults
            max_momentums = _format_param("max_momentum", optimizer, max_momentum)
            base_momentums = _format_param("base_momentum", optimizer, base_momentum)
            if last_epoch == -1:
                for m_momentum, b_momentum, group in zip(
                    max_momentums, base_momentums, optimizer.param_groups, strict=True
                ):
                    if self.use_beta1:
                        group["betas"] = (m_momentum, *group["betas"][1:])
                    else:
                        group["momentum"] = m_momentum
                    group["max_momentum"] = m_momentum
                    group["base_momentum"] = b_momentum

        super().__init__(optimizer, last_epoch)

    def _anneal_func(self, *args, **kwargs):
        if hasattr(self, "_anneal_func_type"):
            if self._anneal_func_type == "cos":
                return self._annealing_cos(*args, **kwargs)
            elif self._anneal_func_type == "linear":
                return self._annealing_linear(*args, **kwargs)
            else:
                raise ValueError(f"Unknown _anneal_func_type: {self._anneal_func_type}")
        else:
            return self.anneal_func(*args, **kwargs)  # type: ignore[attr-defined]

    @staticmethod
    def _annealing_cos(start, end, pct):
        cos_out = math.cos(math.pi * pct) + 1
        return end + (start - end) / 2.0 * cos_out

    @staticmethod
    def _annealing_linear(start, end, pct):
        return (end - start) * pct + start

    @override
    def get_lr(self) -> list[float | Tensor]:
        _warn_get_lr_called_within_step(self)

        lrs = []
        step_num = self.last_epoch

        if step_num > self.total_steps:
            raise ValueError(
                f"Tried to step {step_num} times. The specified number of total steps is {self.total_steps}"
            )

        for group in self.optimizer.param_groups:
            start_step = 0.0
            for i, phase in enumerate(self._schedule_phases):
                end_step = phase["end_step"]
                if step_num <= end_step or i == len(self._schedule_phases) - 1:
                    pct = (step_num - start_step) / (end_step - start_step)
                    computed_lr = self._anneal_func(
                        group[phase["start_lr"]], group[phase["end_lr"]], pct
                    )
                    if self.cycle_momentum:
                        computed_momentum = self._anneal_func(
                            group[phase["start_momentum"]],
                            group[phase["end_momentum"]],
                            pct,
                        )
                    break
                start_step = phase["end_step"]

            lrs.append(computed_lr)  # type: ignore[possibly-undefined]
            if self.cycle_momentum:
                if self.use_beta1:
                    group["betas"] = (computed_momentum, *group["betas"][1:])  # type: ignore[possibly-undefined]
                else:
                    group["momentum"] = computed_momentum  # type: ignore[possibly-undefined]

        return lrs