"""torchvision.transforms.v2.functional: the kernels behind the transforms."""
import numpy as np

import torch
from torch._core import Tensor

from ...tv_tensors import Image

_MAX = {torch.uint8: 255, torch.int8: 127, torch.int16: 32767, torch.int32: 2147483647, torch.int64: 9223372036854775807}


def _plain(x):
    return Tensor._wrap(x._a, x.dtype, x.device)


def to_image(inpt):
    if isinstance(inpt, np.ndarray):
        arr = np.expand_dims(inpt, -1) if inpt.ndim == 2 else inpt
        return Image(torch.from_numpy(np.ascontiguousarray(arr)).permute(2, 0, 1).contiguous())
    if isinstance(inpt, Tensor):
        return Image(inpt)
    if hasattr(inpt, "getbands"):                          # a PIL image
        return to_image(np.asarray(inpt))
    raise TypeError(f"Input can either be a pure Tensor, a numpy array, or a PIL image, but got {type(inpt)} instead.")


def to_dtype(inpt, dtype=torch.float32, scale=False):
    x = _plain(inpt)
    if not scale or x.dtype is dtype:
        return x.to(dtype)
    float_in, float_out = x.dtype.is_floating_point, dtype.is_floating_point
    if float_in and float_out:
        return x.to(dtype)
    if float_in:                                           # float 0–1 → integers 0–max
        eps = 1e-3
        return x.mul(_MAX[dtype] + 1.0 - eps).to(dtype)
    if float_out:                                          # integers 0–max → float 0–1
        return x.to(dtype).div_(_MAX[x.dtype])
    num_in, num_out = _MAX[x.dtype].bit_length(), _MAX[dtype].bit_length()
    if num_in > num_out:
        return x.bitwise_right_shift(num_in - num_out).to(dtype) if hasattr(x, "bitwise_right_shift") else (x // 2 ** (num_in - num_out)).to(dtype)
    return x.to(dtype) * ((_MAX[dtype] + 1) // (_MAX[x.dtype] + 1))


def normalize(inpt, mean, std, inplace=False):
    x = _plain(inpt)
    if not x.dtype.is_floating_point:
        raise TypeError(f"Input tensor should be a float tensor. Got {x.dtype}.")
    if x.ndim < 3:
        raise ValueError(f"Expected tensor to be a tensor image of size (..., C, H, W). Got {tuple(x.shape)}.")
    m = torch.as_tensor(mean, dtype=x.dtype, device=x.device)
    s = torch.as_tensor(std, dtype=x.dtype, device=x.device)
    if (s == 0).any():
        raise ValueError("std evaluated to zero, leading to division by zero.")
    if m.ndim == 1:
        m = m.view(-1, 1, 1)
    if s.ndim == 1:
        s = s.view(-1, 1, 1)
    return (x - m) / s


def horizontal_flip(inpt):
    return _plain(inpt).flip(-1)


def vertical_flip(inpt):
    return _plain(inpt).flip(-2)


def crop(inpt, top, left, height, width):
    x = _plain(inpt)
    h, w = x.shape[-2:]
    right, bottom = left + width, top + height
    if left < 0 or top < 0 or right > w or bottom > h:
        pad = [max(-left, 0), max(-top, 0), max(right - w, 0), max(bottom - h, 0)]
        x = pad_fn(x, pad)
        top, left = top + pad[1], left + pad[0]
    return x[..., top:top + height, left:left + width].clone()


def pad(inpt, padding, fill=0, padding_mode="constant"):
    return pad_fn(_plain(inpt), padding, fill)


def pad_fn(x, padding, fill=0):
    if isinstance(padding, int):
        padding = [padding] * 4
    pl, pt, pr, pb = padding
    h, w = x.shape[-2:]
    out = torch.full(tuple(x.shape[:-2]) + (h + pt + pb, w + pl + pr), fill, dtype=x.dtype, device=x.device)
    out[..., pt:pt + h, pl:pl + w] = x
    return out


def center_crop(inpt, output_size):
    if isinstance(output_size, int):
        output_size = [output_size, output_size]
    elif len(output_size) == 1:
        output_size = [output_size[0], output_size[0]]
    x = _plain(inpt)
    h, w = x.shape[-2:]
    ch, cw = output_size
    if ch > h or cw > w:
        pad = [(cw - w) // 2 if cw > w else 0, (ch - h) // 2 if ch > h else 0,
               (cw - w + 1) // 2 if cw > w else 0, (ch - h + 1) // 2 if ch > h else 0]
        x = pad_fn(x, pad)
        h, w = x.shape[-2:]
        if ch == h and cw == w:
            return x
    top = int(round((h - ch) / 2.0))
    left = int(round((w - cw) / 2.0))
    return x[..., top:top + ch, left:left + cw].clone()
