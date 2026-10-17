"""MultiheadAttention, TransformerEncoderLayer and TransformerEncoder, following PyTorch's own Python code
(torch.nn.functional.multi_head_attention_forward and torch/nn/modules/transformer.py)."""
import copy
import math
import warnings

from ... import _core
from .. import functional as F, init
from ..parameter import Parameter
from .module import Module
from .linear import Linear
from .dropout import Dropout
from .normalization import LayerNorm
from .container import ModuleList

__all__ = ["MultiheadAttention", "TransformerEncoderLayer", "TransformerEncoder", "Transformer"]


class NonDynamicallyQuantizableLinear(Linear):
    pass


def _float_mask(mask, dtype):
    """A boolean mask (True = don't attend) becomes 0 / -inf; a float mask is used as it is."""
    if mask is None:
        return None
    if mask.dtype is _core.bool:
        return _core.zeros(mask.shape, dtype=dtype, device=mask.device).masked_fill(mask, float("-inf"))
    return mask


class MultiheadAttention(Module):
    """Attention with num_heads heads of size embed_dim // num_heads. Inputs are [L, N, E] ([N, L, E] with
    batch_first=True). Returns (output, attention weights averaged over the heads)."""

    def __init__(self, embed_dim, num_heads, dropout=0.0, bias=True, add_bias_kv=False, add_zero_attn=False, kdim=None,
                 vdim=None, batch_first=False, device=None, dtype=None):
        if embed_dim <= 0 or num_heads <= 0:
            raise ValueError(f"embed_dim and num_heads must be greater than 0, got embed_dim={embed_dim} and num_heads={num_heads} instead")
        super().__init__()
        if add_bias_kv or add_zero_attn or (kdim not in (None, embed_dim)) or (vdim not in (None, embed_dim)):
            raise ValueError("The sandbox's MultiheadAttention supports the standard options only (no kdim/vdim, add_bias_kv, add_zero_attn).")
        self.embed_dim, self.kdim, self.vdim = embed_dim, embed_dim, embed_dim
        self._qkv_same_embed_dim = True
        self.num_heads, self.dropout, self.batch_first = num_heads, dropout, batch_first
        self.head_dim = embed_dim // num_heads
        assert self.head_dim * num_heads == self.embed_dim, "embed_dim must be divisible by num_heads"
        self.in_proj_weight = Parameter(_core.empty((3 * embed_dim, embed_dim), device=device, dtype=dtype))
        self.register_parameter("q_proj_weight", None)
        self.register_parameter("k_proj_weight", None)
        self.register_parameter("v_proj_weight", None)
        if bias:
            self.in_proj_bias = Parameter(_core.empty(3 * embed_dim, device=device, dtype=dtype))
        else:
            self.register_parameter("in_proj_bias", None)
        self.out_proj = NonDynamicallyQuantizableLinear(embed_dim, embed_dim, bias=bias, device=device, dtype=dtype)
        self.bias_k = self.bias_v = None
        self.add_zero_attn = False
        self._reset_parameters()

    def _reset_parameters(self):
        init.xavier_uniform_(self.in_proj_weight)
        if self.in_proj_bias is not None:
            init.constant_(self.in_proj_bias, 0.0)
            init.constant_(self.out_proj.bias, 0.0)

    def forward(self, query, key, value, key_padding_mask=None, need_weights=True, attn_mask=None,
                average_attn_weights=True, is_causal=False):
        is_batched = query.dim() == 3
        if self.batch_first and is_batched:
            query, key, value = (x.transpose(1, 0) for x in (query, key, value))
        if not is_batched:
            query, key, value = query.unsqueeze(1), key.unsqueeze(1), value.unsqueeze(1)
            if key_padding_mask is not None:
                key_padding_mask = key_padding_mask.unsqueeze(0)
        if is_causal and attn_mask is None:
            raise RuntimeError("Need attn_mask if specifying the is_causal hint. You may use the Transformer module method `generate_square_subsequent_mask` to create this mask.")
        out, weights = self._mha(query, key, value, key_padding_mask, need_weights, attn_mask, average_attn_weights)
        if self.batch_first and is_batched:
            out = out.transpose(1, 0)
        if not is_batched:
            out = out.squeeze(1)
            if weights is not None:
                weights = weights.squeeze(0)
        return out, weights

    def _mha(self, query, key, value, key_padding_mask, need_weights, attn_mask, average_attn_weights):
        tgt_len, bsz, embed_dim = query.shape
        src_len = key.shape[0]
        if embed_dim != self.embed_dim:
            raise AssertionError(f"was expecting embedding dimension of {self.embed_dim}, but got {embed_dim}")
        H, hd = self.num_heads, self.head_dim
        w, b = self.in_proj_weight, self.in_proj_bias
        if query is key and key is value:
            proj = F.linear(query, w, b)
            proj = proj.unflatten(-1, (3, embed_dim)).unsqueeze(0).transpose(0, -2).squeeze(-2).contiguous()
            q, k, v = proj[0], proj[1], proj[2]
        else:
            wq, wk, wv = w.chunk(3)
            bq, bk, bv = b.chunk(3) if b is not None else (None, None, None)
            q, k, v = F.linear(query, wq, bq), F.linear(key, wk, bk), F.linear(value, wv, bv)
        mask = _float_mask(attn_mask, q.dtype)
        if mask is not None and mask.dim() == 2:
            if tuple(mask.shape) != (tgt_len, src_len):
                raise RuntimeError(f"The shape of the 2D attn_mask is {tuple(mask.shape)}, but should be {(tgt_len, src_len)}.")
            mask = mask.unsqueeze(0)
        q = q.view(tgt_len, bsz * H, hd).transpose(0, 1)
        k = k.view(k.shape[0], bsz * H, hd).transpose(0, 1)
        v = v.view(v.shape[0], bsz * H, hd).transpose(0, 1)
        if key_padding_mask is not None:
            kpm = _float_mask(key_padding_mask, q.dtype)
            if tuple(kpm.shape) != (bsz, src_len):
                raise AssertionError(f"expecting key_padding_mask shape of {(bsz, src_len)}, but got {tuple(kpm.shape)}")
            kpm = kpm.view(bsz, 1, 1, src_len).expand(-1, H, -1, -1).reshape(bsz * H, 1, src_len)
            mask = kpm if mask is None else mask + kpm
        dropout_p = self.dropout if self.training else 0.0
        if need_weights:
            q_scaled = q * math.sqrt(1.0 / float(hd))
            attn = q_scaled @ k.transpose(-2, -1)
            if mask is not None:
                attn = mask + attn
            attn = attn.softmax(dim=-1)
            if dropout_p > 0.0:
                attn = F.dropout(attn, p=dropout_p)
            out = attn @ v
            out = out.transpose(0, 1).contiguous().view(tgt_len * bsz, embed_dim)
            out = F.linear(out, self.out_proj.weight, self.out_proj.bias)
            out = out.view(tgt_len, bsz, out.size(1))
            attn = attn.view(bsz, H, tgt_len, src_len)
            if average_attn_weights:
                attn = attn.mean(dim=1)
            return out, attn
        if mask is not None:
            mask = mask.unsqueeze(0) if (mask.size(0) == 1 and mask.dim() == 3) else mask.view(bsz, H, -1, src_len)
        q = q.view(bsz, H, tgt_len, hd)
        k = k.view(bsz, H, src_len, hd)
        v = v.view(bsz, H, src_len, hd)
        out = F.scaled_dot_product_attention(q, k, v, mask, dropout_p)
        out = out.permute(2, 0, 1, 3).contiguous().view(bsz * tgt_len, embed_dim)
        out = F.linear(out, self.out_proj.weight, self.out_proj.bias)
        out = out.view(tgt_len, bsz, out.size(1))
        return out, None


def _get_activation_fn(activation):
    if activation == "relu":
        return F.relu
    if activation == "gelu":
        return F.gelu
    if callable(activation):
        return activation
    raise RuntimeError(f"activation should be relu/gelu, not {activation}")


class TransformerEncoderLayer(Module):
    """Self-attention then a feed-forward network, each wrapped in a residual connection and LayerNorm
    (after the residual by default; before it with norm_first=True)."""

    def __init__(self, d_model, nhead, dim_feedforward=2048, dropout=0.1, activation=F.relu, layer_norm_eps=1e-5,
                 batch_first=False, norm_first=False, bias=True, device=None, dtype=None):
        super().__init__()
        self.self_attn = MultiheadAttention(d_model, nhead, dropout=dropout, bias=bias, batch_first=batch_first, device=device, dtype=dtype)
        self.linear1 = Linear(d_model, dim_feedforward, bias=bias, device=device, dtype=dtype)
        self.dropout = Dropout(dropout)
        self.linear2 = Linear(dim_feedforward, d_model, bias=bias, device=device, dtype=dtype)
        self.norm_first = norm_first
        self.norm1 = LayerNorm(d_model, eps=layer_norm_eps, bias=bias, device=device, dtype=dtype)
        self.norm2 = LayerNorm(d_model, eps=layer_norm_eps, bias=bias, device=device, dtype=dtype)
        self.dropout1 = Dropout(dropout)
        self.dropout2 = Dropout(dropout)
        if isinstance(activation, str):
            activation = _get_activation_fn(activation)
        self.activation = activation

    def forward(self, src, src_mask=None, src_key_padding_mask=None, is_causal=False):
        x = src
        if self.norm_first:
            x = x + self._sa_block(self.norm1(x), src_mask, src_key_padding_mask, is_causal)
            x = x + self._ff_block(self.norm2(x))
        else:
            x = self.norm1(x + self._sa_block(x, src_mask, src_key_padding_mask, is_causal))
            x = self.norm2(x + self._ff_block(x))
        return x

    def _sa_block(self, x, attn_mask, key_padding_mask, is_causal=False):
        x = self.self_attn(x, x, x, attn_mask=attn_mask, key_padding_mask=key_padding_mask, need_weights=False, is_causal=is_causal)[0]
        return self.dropout1(x)

    def _ff_block(self, x):
        x = self.linear2(self.dropout(self.activation(self.linear1(x))))
        return self.dropout2(x)


class TransformerEncoder(Module):
    """num_layers deep copies of encoder_layer, applied in turn (plus an optional final norm)."""

    def __init__(self, encoder_layer, num_layers, norm=None, enable_nested_tensor=True, mask_check=True):
        super().__init__()
        self.layers = ModuleList([copy.deepcopy(encoder_layer) for _ in range(num_layers)])
        self.num_layers = num_layers
        self.norm = norm
        self.enable_nested_tensor = enable_nested_tensor
        self.use_nested_tensor = False
        self.mask_check = mask_check
        if enable_nested_tensor and not encoder_layer.self_attn.batch_first:
            warnings.warn("enable_nested_tensor is True, but self.use_nested_tensor is False because encoder_layer.self_attn.batch_first was not True(use batch_first for better inference performance)", UserWarning, stacklevel=2)

    def forward(self, src, mask=None, src_key_padding_mask=None, is_causal=None):
        output = src
        for mod in self.layers:
            output = mod(output, src_mask=mask, is_causal=bool(is_causal), src_key_padding_mask=src_key_padding_mask)
        if self.norm is not None:
            output = self.norm(output)
        return output


class Transformer(Module):
    """Only the helper below is available in the sandbox; the full encoder-decoder model isn't."""

    def __init__(self, *args, **kwargs):
        raise NotImplementedError("The sandbox includes TransformerEncoderLayer and TransformerEncoder, but not the full encoder-decoder nn.Transformer: try it on your own computer.")

    @staticmethod
    def generate_square_subsequent_mask(sz, device=None, dtype=None):
        """A causal mask: 0 on and below the diagonal, -inf above it (position i may only look at positions ≤ i)."""
        return (_core.full((sz, sz), float("-inf"), dtype=dtype or _core.float32, device=device)).triu(diagonal=1)


MultiheadAttention.__module__ = "torch.nn.modules.activation"
NonDynamicallyQuantizableLinear.__module__ = "torch.nn.modules.linear"
for _c in (TransformerEncoderLayer, TransformerEncoder, Transformer):
    _c.__module__ = "torch.nn.modules.transformer"
