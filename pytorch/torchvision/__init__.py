"""The sandbox's torchvision: tv_tensors.Image and the core torchvision.transforms.v2 transforms (0.29), written
on the sandbox's torch. Datasets that download files (MNIST, CIFAR-10...) and resizing aren't included: use real
torchvision on your own computer for those."""
__version__ = "0.29.1+sandbox"
from . import tv_tensors, transforms  # noqa: E402,F401
