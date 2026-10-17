"""torchvision.transforms.v2 in the sandbox: Compose, ToImage, ToDtype, ToPureTensor, Normalize, RandomHorizontalFlip,
RandomVerticalFlip, RandomCrop, CenterCrop, RandomApply, RandomChoice, Lambda (and the deprecated ToTensor).
They follow torchvision 0.29: the same random draws, the same outputs and the same errors."""
import numbers
import warnings

import numpy as np

import torch
from torch import nn
from torch._core import Tensor

from ...tv_tensors import Image, TVTensor
from . import functional as F

__all__ = ["Transform", "Compose", "ToImage", "ToDtype", "ToPureTensor", "ToTensor", "Normalize",
           "RandomHorizontalFlip", "RandomVerticalFlip", "RandomCrop", "CenterCrop", "RandomApply",
           "RandomChoice", "Lambda", "functional"]


def _flatten(x):
    if isinstance(x, (list, tuple)) and not isinstance(x, Tensor):
        flat, specs = [], []
        for item in x:
            f, s = _flatten(item)
            flat += f
            specs.append(s)
        return flat, (type(x), specs)
    if isinstance(x, dict):
        flat, specs = [], []
        for k, v in x.items():
            f, s = _flatten(v)
            flat += f
            specs.append((k, s))
        return flat, (dict, specs)
    return [x], None


def _unflatten(flat, spec):
    it = iter(flat)

    def build(s):
        if s is None:
            return next(it)
        kind, children = s
        if kind is dict:
            return {k: build(c) for k, c in children}
        items = [build(c) for c in children]
        return kind(items) if kind in (list, tuple) else kind(*items)
    return build(spec)


def _is_image_like(x):
    return isinstance(x, (Image, np.ndarray)) or (isinstance(x, Tensor) and not isinstance(x, TVTensor))


class Transform(nn.Module):
    """Base class: transforms the image-like parts of a sample and passes everything else (labels...) through.
    As in torchvision, if a sample has no tv_tensors.Image, its first plain tensor is treated as the image."""

    _transformed_types = (Tensor, np.ndarray)

    def __init__(self):
        super().__init__()

    def make_params(self, flat_inputs):
        return {}

    def transform(self, inpt, params):
        raise NotImplementedError

    def _needs_transform_list(self, flat_inputs):
        has_image = any(isinstance(x, Image) for x in flat_inputs)
        out, pure_seen = [], False
        for x in flat_inputs:
            if isinstance(x, Image):
                out.append(True)
            elif isinstance(x, Tensor) and not isinstance(x, TVTensor):
                out.append(not has_image and not pure_seen)       # the first plain tensor is the image
                pure_seen = True
            elif isinstance(x, np.ndarray) or hasattr(x, "getbands"):
                out.append(isinstance(self, ToImage))
            else:
                out.append(False)
        return out

    def forward(self, *inputs):
        inputs = inputs if len(inputs) > 1 else inputs[0]
        flat, spec = _flatten(inputs)
        needs = self._needs_transform_list(flat)
        params = self.make_params([x for x, n in zip(flat, needs) if n])
        out = [self.transform(x, params) if n else x for x, n in zip(flat, needs)]
        return _unflatten(out, spec)

    def extra_repr(self):
        return ""


def _keep_type(inpt, result):
    return Image(result) if isinstance(inpt, Image) else result


class Compose(Transform):
    """Apply transforms one after another."""

    def __init__(self, transforms):
        super().__init__()
        if not isinstance(transforms, (list, tuple)):
            raise TypeError("Argument transforms should be a sequence of callables")
        if not transforms:
            raise ValueError("Pass at least one transform")
        self.transforms = transforms

    def forward(self, *inputs):
        needs_unpacking = len(inputs) > 1
        for t in self.transforms:
            outputs = t(*inputs)
            inputs = outputs if needs_unpacking else (outputs,)
        return outputs

    def extra_repr(self):
        return "\n".join(f"    {t}" for t in self.transforms)


class ToImage(Transform):
    """A tensor, NumPy array (H × W × C) or PIL image → tv_tensors.Image (C × H × W), keeping the dtype."""

    def transform(self, inpt, params):
        return F.to_image(inpt)


class ToPureTensor(Transform):
    def _needs_transform_list(self, flat_inputs):
        return [isinstance(x, TVTensor) for x in flat_inputs]

    def transform(self, inpt, params):
        return Tensor._wrap(inpt._a, inpt.dtype, inpt.device)


class ToTensor(Transform):
    def __init__(self):
        warnings.warn("The transform `ToTensor()` is deprecated and will be removed in a future release. Instead, please use `v2.Compose([v2.ToImage(), v2.ToDtype(torch.float32, scale=True)])`.Output is equivalent up to float precision.", UserWarning, stacklevel=2)
        super().__init__()

    def transform(self, inpt, params):
        img = F.to_image(inpt)
        return Tensor._wrap(F.to_dtype(img, torch.float32, scale=True)._a, torch.float32, img.device)


class ToDtype(Transform):
    """Convert the image's dtype; scale=True also rescales the values (uint8 0–255 ↔ float 0–1)."""

    def __init__(self, dtype, scale=False):
        super().__init__()
        self.dtype = dtype
        self.scale = scale

    def transform(self, inpt, params):
        dtype = self.dtype[type(inpt)] if isinstance(self.dtype, dict) else self.dtype
        if dtype is None:
            return inpt
        return _keep_type(inpt, F.to_dtype(inpt, dtype, scale=self.scale))

    def extra_repr(self):
        return f"scale={self.scale}"


class Normalize(Transform):
    """(image - mean) / std, per channel. Needs a float image."""

    def __init__(self, mean, std, inplace=False):
        super().__init__()
        self.mean, self.std, self.inplace = list(mean), list(std), inplace

    def transform(self, inpt, params):
        return _keep_type(inpt, F.normalize(inpt, self.mean, self.std))

    def extra_repr(self):
        return f"mean={self.mean}, std={self.std}, inplace={self.inplace}"


class _RandomApplyTransform(Transform):
    def __init__(self, p=0.5):
        if not (0.0 <= p <= 1.0):
            raise ValueError("`p` should be a floating point value in the interval [0.0, 1.0].")
        super().__init__()
        self.p = p

    def forward(self, *inputs):
        inputs = inputs if len(inputs) > 1 else inputs[0]
        if torch.rand(1) >= self.p:
            return inputs
        flat, spec = _flatten(inputs)
        needs = self._needs_transform_list(flat)
        params = self.make_params([x for x, n in zip(flat, needs) if n])
        out = [self.transform(x, params) if n else x for x, n in zip(flat, needs)]
        return _unflatten(out, spec)

    def extra_repr(self):
        return f"p={self.p}"


class RandomHorizontalFlip(_RandomApplyTransform):
    """Flip left-right with probability p."""

    def transform(self, inpt, params):
        return _keep_type(inpt, F.horizontal_flip(inpt))


class RandomVerticalFlip(_RandomApplyTransform):
    """Flip top-bottom with probability p."""

    def transform(self, inpt, params):
        return _keep_type(inpt, F.vertical_flip(inpt))


def _setup_size(size):
    if isinstance(size, numbers.Number):
        return (int(size), int(size))
    if len(size) == 1:
        return (size[0], size[0])
    return tuple(size)


def _padding4(padding):
    if padding is None:
        return None
    if isinstance(padding, int):
        return [padding] * 4
    padding = list(padding)
    if len(padding) == 1:
        return padding * 4
    if len(padding) == 2:
        return [padding[0], padding[1], padding[0], padding[1]]
    return padding


class RandomCrop(Transform):
    """Cut out a random size × size window (after optional zero padding around the edges)."""

    def __init__(self, size, padding=None, pad_if_needed=False, fill=0, padding_mode="constant"):
        super().__init__()
        self.size = _setup_size(size)
        self.padding = _padding4(padding)
        self.pad_if_needed, self.fill, self.padding_mode = pad_if_needed, fill, padding_mode

    def make_params(self, flat_inputs):
        h, w = flat_inputs[0].shape[-2:]
        pl, pt, pr, pb = (self.padding or [0, 0, 0, 0])
        ph, pw = h + pt + pb, w + pl + pr
        ch, cw = self.size
        if self.pad_if_needed:
            if ph < ch:
                d = ch - ph
                pt, pb, ph = pt + d, pb + d, ph + 2 * d
            if pw < cw:
                d = cw - pw
                pl, pr, pw = pl + d, pr + d, pw + 2 * d
        if ph < ch or pw < cw:
            raise ValueError(f"Required crop size {(ch, cw)} is larger than {'padded ' if self.padding is not None else ''}input image size {(ph, pw)}.")
        top = int(torch.randint(0, ph - ch + 1, size=())) if ph > ch else 0
        left = int(torch.randint(0, pw - cw + 1, size=())) if pw > cw else 0
        return dict(top=top, left=left, height=ch, width=cw, padding=[pl, pt, pr, pb])

    def transform(self, inpt, params):
        x = inpt
        if any(params["padding"]):
            x = F.pad(x, params["padding"], fill=self.fill)
        return _keep_type(inpt, F.crop(x, params["top"], params["left"], params["height"], params["width"]))

    def extra_repr(self):
        return f"size={self.size}, padding={self.padding}, pad_if_needed={self.pad_if_needed}, fill={self.fill}, padding_mode={self.padding_mode}"


class CenterCrop(Transform):
    """Cut out the central size × size window."""

    def __init__(self, size):
        super().__init__()
        self.size = _setup_size(size)

    def transform(self, inpt, params):
        return _keep_type(inpt, F.center_crop(inpt, list(self.size)))

    def extra_repr(self):
        return f"size={self.size}"


class RandomApply(Transform):
    """Apply all the transforms, with probability p."""

    def __init__(self, transforms, p=0.5):
        super().__init__()
        self.transforms = list(transforms)
        self.p = p

    def forward(self, *inputs):
        needs_unpacking = len(inputs) > 1
        if torch.rand(1) >= self.p:
            return inputs if needs_unpacking else inputs[0]
        for t in self.transforms:
            outputs = t(*inputs)
            inputs = outputs if needs_unpacking else (outputs,)
        return outputs

    def extra_repr(self):
        return "\n".join(f"    {t}" for t in self.transforms)


class RandomChoice(Transform):
    """Apply one of the transforms, picked at random."""

    def __init__(self, transforms, p=None):
        super().__init__()
        self.transforms = list(transforms)
        p = p or [1.0] * len(self.transforms)
        total = sum(p)
        self.p = [x / total for x in p]

    def forward(self, *inputs):
        idx = int(torch.multinomial(torch.tensor(self.p), 1))
        return self.transforms[idx](*inputs)


class Lambda(Transform):
    """Apply your own function."""

    def __init__(self, lambd, *types):
        super().__init__()
        self.lambd = lambd
        self.types = types or (object,)

    def _needs_transform_list(self, flat_inputs):
        return [isinstance(x, self.types) for x in flat_inputs]

    def transform(self, inpt, params):
        return self.lambd(inpt)

    def extra_repr(self):
        name = getattr(self.lambd, "__name__", type(self.lambd).__name__)
        return f"{name}, types={[t.__name__ for t in self.types]}"


for _c in list(globals().values()):
    if isinstance(_c, type) and issubclass(_c, Transform):
        _c.__module__ = "torchvision.transforms.v2"
