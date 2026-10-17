"""nn.Embedding: a lookup table of vectors, one row per token id."""
from ... import _core
from .. import functional as F, init
from ..parameter import Parameter
from .module import Module

__all__ = ["Embedding"]


class Embedding(Module):
    def __init__(self, num_embeddings, embedding_dim, padding_idx=None, device=None, dtype=None, **kw):
        super().__init__()
        self.num_embeddings, self.embedding_dim, self.padding_idx = num_embeddings, embedding_dim, padding_idx
        self.weight = Parameter(_core.empty((num_embeddings, embedding_dim), device=device, dtype=dtype))
        init.normal_(self.weight)
        if padding_idx is not None:
            with _core.no_grad():
                self.weight[padding_idx].fill_(0)

    def forward(self, input):
        return F.embedding(input, self.weight, self.padding_idx)

    def extra_repr(self):
        return f"{self.num_embeddings}, {self.embedding_dim}" + (f", padding_idx={self.padding_idx}" if self.padding_idx is not None else "")


Embedding.__module__ = "torch.nn.modules.sparse"
