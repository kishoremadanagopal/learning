"""CUDA settings, such as allowing TF32 for faster float32 matrix multiplies on Ampere and newer GPUs."""
from ... import _core


def is_built():
    return True


class _Matmul:
    allow_tf32 = False
    allow_fp16_reduced_precision_reduction = True
    allow_bf16_reduced_precision_reduction = True


matmul = _Matmul()
