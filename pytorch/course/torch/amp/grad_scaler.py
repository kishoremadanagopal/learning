"""torch.amp.GradScaler: loss scaling for float16 training. Ported, with only the device checks and two fused kernels
replaced, from PyTorch 2.14's torch/amp/grad_scaler.py (BSD-3-Clause, Copyright (c) PyTorch contributors)."""
from __future__ import annotations

import inspect
import warnings
from collections import abc, defaultdict
from enum import Enum
from typing import Any, cast, overload, TYPE_CHECKING

import torch
from . import _kernels


if TYPE_CHECKING:
    from collections.abc import Iterable


__all__ = ["OptState", "GradScaler"]


class _MultiDeviceReplicator:

    def __init__(self, master_tensor: torch.Tensor) -> None:
        self.master = master_tensor
        self._per_device_tensors: dict[torch.device, torch.Tensor] = {}

    def get(self, device: torch.device) -> torch.Tensor:
        retval = self._per_device_tensors.get(device, None)
        if retval is None:
            retval = self.master.to(device=device, non_blocking=True, copy=True)
            self._per_device_tensors[device] = retval
        return retval


class OptState(Enum):
    READY = 0
    UNSCALED = 1
    STEPPED = 2


def _refresh_per_optimizer_state() -> dict[str, Any]:
    return {"stage": OptState.READY, "found_inf_per_device": {}}


class GradScaler:

    def __init__(
        self,
        device: str = "cuda",
        init_scale: float = 2.0**16,
        growth_factor: float = 2.0,
        backoff_factor: float = 0.5,
        growth_interval: int = 2000,
        enabled: bool = True,
    ) -> None:
        self._device = device
        self._enabled = enabled
        if self._device == "cuda":
            if enabled and (not torch.cuda.is_available()):
                warnings.warn(
                    "torch.cuda.amp.GradScaler is enabled, but CUDA is not available.  Disabling.",
                    stacklevel=2,
                )
                self._enabled = False

        if self._enabled:
            if growth_factor <= 1.0:
                raise AssertionError("The growth factor must be > 1.0.")
            if backoff_factor >= 1.0:
                raise AssertionError("The backoff factor must be < 1.0.")

            self._init_scale = init_scale
            self._scale: torch.Tensor | None = None
            self._growth_factor = growth_factor
            self._backoff_factor = backoff_factor
            self._growth_interval = growth_interval
            self._init_growth_tracker = 0
            self._growth_tracker: torch.Tensor | None = None
            self._per_optimizer_states: dict[int, dict[str, Any]] = defaultdict(
                _refresh_per_optimizer_state
            )

    def _check_scale_growth_tracker(
        self, funcname: str
    ) -> tuple[torch.Tensor, torch.Tensor]:
        fix = "This may indicate your script did not use scaler.scale(loss or outputs) earlier in the iteration."
        if self._scale is None:
            raise AssertionError(f"Attempted {funcname} but _scale is None.  " + fix)
        if self._growth_tracker is None:
            raise AssertionError(
                f"Attempted {funcname} but _growth_tracker is None.  " + fix
            )
        return (self._scale, self._growth_tracker)

    def _lazy_init_scale_growth_tracker(self, dev: torch.device) -> None:
        if self._growth_tracker is not None:
            raise AssertionError("_growth_tracker initialized before _scale")
        self._scale = torch.full((), self._init_scale, dtype=torch.float32, device=dev)
        self._growth_tracker = torch.full(
            (), self._init_growth_tracker, dtype=torch.int32, device=dev
        )

    @overload
    def scale(self, outputs: torch.Tensor) -> torch.Tensor: ...

    @overload
    def scale(self, outputs: list[torch.Tensor]) -> list[torch.Tensor]: ...

    @overload
    def scale(self, outputs: tuple[torch.Tensor, ...]) -> tuple[torch.Tensor, ...]: ...

    @overload
    def scale(self, outputs: Iterable[torch.Tensor]) -> Iterable[torch.Tensor]: ...

    def scale(
        self,
        outputs: torch.Tensor | Iterable[torch.Tensor],
    ) -> torch.Tensor | Iterable[torch.Tensor]:
        if not self._enabled:
            return outputs

        if isinstance(outputs, torch.Tensor):
            if self._scale is None:
                self._lazy_init_scale_growth_tracker(outputs.device)
            scale = self._scale
            if scale is None:
                raise AssertionError("_scale should not be None after lazy init")
            return outputs * scale.to(device=outputs.device, non_blocking=True)

        stash: list[
            _MultiDeviceReplicator
        ] = []  # holds a reference that can be overwritten by apply_scale

        def apply_scale(val: torch.Tensor | Iterable[torch.Tensor]):
            if isinstance(val, torch.Tensor):
                if len(stash) == 0:
                    if self._scale is None:
                        self._lazy_init_scale_growth_tracker(val.device)
                    scale = self._scale
                    if scale is None:
                        raise AssertionError(
                            "_scale should not be None after lazy init"
                        )
                    stash.append(_MultiDeviceReplicator(scale))
                return val * stash[0].get(val.device)
            if isinstance(val, abc.Iterable):
                iterable = map(apply_scale, val)
                if isinstance(val, (list, tuple)):
                    return type(val)(iterable)
                return iterable
            raise ValueError("outputs must be a Tensor or an iterable of Tensors")

        return apply_scale(outputs)

    def _unscale_grads_(
        self,
        optimizer: torch.optim.Optimizer,
        inv_scale: torch.Tensor,
        found_inf: torch.Tensor,
        allow_fp16: bool,
    ) -> dict[torch.device, torch.Tensor]:
        per_device_inv_scale = _MultiDeviceReplicator(inv_scale)
        per_device_found_inf = _MultiDeviceReplicator(found_inf)


        per_device_and_dtype_grads: dict[
            torch.device, dict[torch.dtype, list[torch.Tensor]]
        ] = defaultdict(lambda: defaultdict(list))
        with torch.no_grad():
            for group in optimizer.param_groups:
                for param in group["params"]:
                    if not isinstance(param, torch.Tensor):
                        raise AssertionError(
                            f"expected param to be torch.Tensor, got {type(param).__name__}"
                        )
                    if param.grad is None:
                        continue
                    if (not allow_fp16) and param.grad.dtype == torch.float16:
                        raise ValueError("Attempting to unscale FP16 gradients.")
                    if param.grad.is_sparse:
                        if param.grad.dtype is torch.float16:
                            param.grad = param.grad.coalesce()
                        to_unscale = param.grad._values()
                    else:
                        to_unscale = param.grad

                    per_device_and_dtype_grads[to_unscale.device][
                        to_unscale.dtype
                    ].append(to_unscale)

            for device, per_dtype_grads in per_device_and_dtype_grads.items():
                for grads in per_dtype_grads.values():
                    _kernels.non_finite_check_and_unscale_(
                        grads,
                        per_device_found_inf.get(device),
                        per_device_inv_scale.get(device),
                    )

        return per_device_found_inf._per_device_tensors

    def unscale_(self, optimizer: torch.optim.Optimizer) -> None:
        if not self._enabled:
            return

        self._check_scale_growth_tracker("unscale_")

        optimizer_state = self._per_optimizer_states[id(optimizer)]

        if optimizer_state["stage"] is OptState.UNSCALED:
            raise RuntimeError(
                "unscale_() has already been called on this optimizer since the last update()."
            )
        elif optimizer_state["stage"] is OptState.STEPPED:
            raise RuntimeError("unscale_() is being called after step().")

        if self._scale is None:
            raise AssertionError("_scale is None in unscale_")
        inv_scale = (
            self._scale.double().reciprocal().float()
            if self._scale.device != torch.device("mps:0")
            else self._scale.reciprocal()
        )
        found_inf = torch.full((), 0.0, dtype=torch.float32, device=self._scale.device)

        optimizer_state["found_inf_per_device"] = self._unscale_grads_(
            optimizer, inv_scale, found_inf, False
        )
        optimizer_state["stage"] = OptState.UNSCALED

    def _maybe_opt_step(
        self,
        optimizer: torch.optim.Optimizer,
        optimizer_state: dict[str, Any],
        *args: Any,
        **kwargs: Any,
    ) -> float | None:
        retval: float | None = None
        if not sum(v.item() for v in optimizer_state["found_inf_per_device"].values()):
            retval = optimizer.step(*args, **kwargs)
        return retval

    def step(
        self, optimizer: torch.optim.Optimizer, *args: Any, **kwargs: Any
    ) -> float | None:
        if not self._enabled:
            return optimizer.step(*args, **kwargs)

        if "closure" in kwargs:
            raise RuntimeError(
                "Closure use is not currently supported if GradScaler is enabled."
            )

        self._check_scale_growth_tracker("step")

        optimizer_state = self._per_optimizer_states[id(optimizer)]

        if optimizer_state["stage"] is OptState.STEPPED:
            raise RuntimeError(
                "step() has already been called since the last update()."
            )

        retval: float | None = None

        if getattr(optimizer, "_step_supports_amp_scaling", False):
            kwargs_ = kwargs
            has_grad_scaler_kwarg = (
                "grad_scaler" in inspect.signature(optimizer.step).parameters
            )
            if has_grad_scaler_kwarg:
                warnings.warn(
                    "GradScaler is going to stop passing itself as a keyword argument to the passed "
                    "optimizer. In the near future GradScaler registers `grad_scale: Tensor` and "
                    "`found_inf: Tensor` to the passed optimizer and let the optimizer use them directly.",
                    FutureWarning,
                    stacklevel=2,
                )
                kwargs_.update({"grad_scaler": self})
            else:
                if optimizer_state["stage"] is OptState.READY:
                    self._check_inf_per_device(optimizer)
                scaler = self._get_scale_async()
                if scaler is None:
                    raise AssertionError("_get_scale_async returned None")
                found_inf = cast(
                    torch.Tensor,
                    sum(
                        [
                            t.to(scaler.device, non_blocking=True)
                            for t in optimizer_state["found_inf_per_device"].values()
                        ]
                    ),
                )
                optimizer.grad_scale = (  # type: ignore[attr-defined]
                    getattr(optimizer, "grad_scale", None)
                    if optimizer_state["stage"] == OptState.UNSCALED
                    else scaler * getattr(optimizer, "grad_scale", 1)
                )
                optimizer.found_inf = found_inf  # type: ignore[attr-defined]
            retval = optimizer.step(*args, **kwargs_)
            optimizer_state["stage"] = OptState.STEPPED
            if not has_grad_scaler_kwarg:
                del optimizer.grad_scale  # type: ignore[attr-defined]
                del optimizer.found_inf  # type: ignore[attr-defined]
            return retval

        if optimizer_state["stage"] is OptState.READY:
            self.unscale_(optimizer)

        if len(optimizer_state["found_inf_per_device"]) == 0:
            raise AssertionError("No inf checks were recorded for this optimizer.")

        retval = self._maybe_opt_step(optimizer, optimizer_state, *args, **kwargs)

        optimizer_state["stage"] = OptState.STEPPED

        return retval

    def update(self, new_scale: float | torch.Tensor | None = None) -> None:
        if not self._enabled:
            return

        _scale, _growth_tracker = self._check_scale_growth_tracker("update")

        if new_scale is not None:
            if self._scale is None:
                raise AssertionError("_scale is None in update")
            if isinstance(new_scale, float):
                self._scale.fill_(new_scale)
            else:
                reason = (
                    "new_scale should be a float or a 1-element torch.cuda.FloatTensor or "
                    "torch.FloatTensor with requires_grad=False."
                )
                if new_scale.device.type != self._device:
                    raise AssertionError(reason)
                if new_scale.numel() != 1:
                    raise AssertionError(reason)
                if new_scale.requires_grad is True:
                    raise AssertionError(reason)
                self._scale.copy_(new_scale)
        else:
            found_infs = [
                found_inf.to(device=_scale.device, non_blocking=True)
                for state in self._per_optimizer_states.values()
                for found_inf in state["found_inf_per_device"].values()
            ]

            if len(found_infs) == 0:
                raise AssertionError("No inf checks were recorded prior to update.")

            found_inf_combined = found_infs[0]
            if len(found_infs) > 1:
                for i in range(1, len(found_infs)):
                    found_inf_combined += found_infs[i]

            _kernels.update_scale_(
                _scale,
                _growth_tracker,
                found_inf_combined,
                self._growth_factor,
                self._backoff_factor,
                self._growth_interval,
            )

        self._per_optimizer_states = defaultdict(_refresh_per_optimizer_state)

    def _get_scale_async(self) -> torch.Tensor | None:
        return self._scale

    def get_scale(self) -> float:
        if self._enabled:
            return (
                self._init_scale
                if (scale := self._get_scale_async()) is None
                else cast(float, scale.item())
            )
        return 1.0

    def get_growth_factor(self) -> float:
        return self._growth_factor

    def set_growth_factor(self, new_factor: float) -> None:
        self._growth_factor = new_factor

    def get_backoff_factor(self) -> float:
        return self._backoff_factor

    def set_backoff_factor(self, new_factor: float) -> None:
        self._backoff_factor = new_factor

    def get_growth_interval(self) -> int:
        return self._growth_interval

    def set_growth_interval(self, new_interval: int) -> None:
        self._growth_interval = new_interval

    def _get_growth_tracker(self) -> int:
        if self._enabled:
            return (
                self._init_growth_tracker
                if self._growth_tracker is None
                else cast(int, self._growth_tracker.item())
            )
        return 0

    def is_enabled(self) -> bool:
        return self._enabled

    def state_dict(self) -> dict[str, Any]:
        if self._enabled:
            return {
                "scale": self.get_scale(),
                "growth_factor": self._growth_factor,
                "backoff_factor": self._backoff_factor,
                "growth_interval": self._growth_interval,
                "_growth_tracker": self._get_growth_tracker(),
            }
        return {}

    def load_state_dict(self, state_dict: dict[str, Any]) -> None:
        if not self._enabled:
            return

        if len(state_dict) == 0:
            raise RuntimeError(
                "The source state dict is empty, possibly because it was saved "
                "from a disabled instance of GradScaler."
            )

        self._init_scale = cast(float, state_dict["scale"])
        if self._scale is not None:
            self._scale.fill_(state_dict["scale"])
        self._growth_factor = cast(float, state_dict["growth_factor"])
        self._backoff_factor = cast(float, state_dict["backoff_factor"])
        self._growth_interval = cast(int, state_dict["growth_interval"])
        self._init_growth_tracker = cast(int, state_dict["_growth_tracker"])
        if self._growth_tracker is not None:
            self._growth_tracker.fill_(state_dict["_growth_tracker"])

    def __getstate__(self) -> dict[str, Any]:
        state = self.__dict__.copy()
        if self._enabled:
            if len(self._per_optimizer_states) != 0:
                raise AssertionError(
                    "A GradScaler instance may only be pickled at the beginning "
                    "of an iteration, or at the end after scaler.update()."
                )
            state["_init_scale"] = self.get_scale()
            state["_init_growth_tracker"] = self._get_growth_tracker()
            state["_scale"] = None
            state["_growth_tracker"] = None
        return state

    def __setstate__(self, state: dict[str, Any]) -> None:
        self.__dict__.update(state)

    def _check_inf_per_device(self, optimizer: torch.optim.Optimizer) -> dict[str, Any]:
        _scale, _ = self._check_scale_growth_tracker("_check_inf_per_device")

        dummy_inv_scale = torch.full((), 1.0, dtype=torch.float32, device=_scale.device)
        found_inf = torch.full((), 0.0, dtype=torch.float32, device=_scale.device)

        self._per_optimizer_states[id(optimizer)]["found_inf_per_device"] = (
            self._unscale_grads_(optimizer, dummy_inv_scale, found_inf, True)
        )

        return self._per_optimizer_states[id(optimizer)]["found_inf_per_device"]

    def _found_inf_per_device(self, optimizer: torch.optim.Optimizer) -> dict[str, Any]:
        return self._per_optimizer_states[id(optimizer)]["found_inf_per_device"]