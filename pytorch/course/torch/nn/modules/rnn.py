"""RNN, LSTM and GRU: recurrent layers that read a sequence one step at a time, carrying a hidden state.
Written with ordinary tensor operations, so autograd differentiates them; same parameters, initialisation and
maths as PyTorch."""
import math

from ... import _core
from .. import functional as F, init
from ..parameter import Parameter
from .module import Module

__all__ = ["RNNBase", "RNN", "LSTM", "GRU"]


class RNNBase(Module):
    _gates = {"RNN_TANH": 1, "RNN_RELU": 1, "LSTM": 4, "GRU": 3}

    def __init__(self, mode, input_size, hidden_size, num_layers=1, bias=True, batch_first=False, dropout=0.0,
                 bidirectional=False, proj_size=0, device=None, dtype=None):
        super().__init__()
        if not isinstance(dropout, (int, float)) or isinstance(dropout, bool) or not 0 <= dropout <= 1:
            raise ValueError("dropout should be a number in range [0, 1] representing the probability of an element being zeroed")
        if not isinstance(hidden_size, int):
            raise TypeError(f"hidden_size should be of type int, got: {type(hidden_size).__name__}")
        if hidden_size <= 0:
            raise ValueError("hidden_size must be greater than zero")
        if num_layers <= 0:
            raise ValueError("num_layers must be greater than zero")
        if proj_size:
            raise ValueError("The sandbox's LSTM doesn't support proj_size.")
        if dropout > 0 and num_layers == 1:
            import warnings
            warnings.warn(f"dropout option adds dropout after all but last recurrent layer, so non-zero dropout expects num_layers greater than 1, but got dropout={dropout} and num_layers={num_layers}", UserWarning, stacklevel=3)
        self.mode, self.input_size, self.hidden_size, self.num_layers = mode, input_size, hidden_size, num_layers
        self.bias, self.batch_first, self.dropout, self.bidirectional, self.proj_size = bias, batch_first, float(dropout), bidirectional, proj_size
        num_dir = 2 if bidirectional else 1
        gate = self._gates[mode] * hidden_size
        self._flat_weights_names = []
        for layer in range(num_layers):
            for direction in range(num_dir):
                layer_in = input_size if layer == 0 else hidden_size * num_dir
                suffix = "_reverse" if direction == 1 else ""
                names = [f"weight_ih_l{layer}{suffix}", f"weight_hh_l{layer}{suffix}"]
                params = [Parameter(_core.empty((gate, layer_in), device=device, dtype=dtype)),
                          Parameter(_core.empty((gate, hidden_size), device=device, dtype=dtype))]
                if bias:
                    names += [f"bias_ih_l{layer}{suffix}", f"bias_hh_l{layer}{suffix}"]
                    params += [Parameter(_core.empty(gate, device=device, dtype=dtype)),
                               Parameter(_core.empty(gate, device=device, dtype=dtype))]
                for n, p in zip(names, params):
                    setattr(self, n, p)
                self._flat_weights_names += names
        self.reset_parameters()

    def reset_parameters(self):
        stdv = 1.0 / math.sqrt(self.hidden_size) if self.hidden_size > 0 else 0
        for weight in self.parameters():
            init.uniform_(weight, -stdv, stdv)

    def extra_repr(self):
        s = f"{self.input_size}, {self.hidden_size}"
        if self.num_layers != 1:
            s += f", num_layers={self.num_layers}"
        if self.bias is not True:
            s += f", bias={self.bias}"
        if self.batch_first is not False:
            s += f", batch_first={self.batch_first}"
        if self.dropout != 0:
            s += f", dropout={self.dropout}"
        if self.bidirectional is not False:
            s += f", bidirectional={self.bidirectional}"
        return s

    def _cell(self, x, state, w_ih, w_hh, b_ih, b_hh):
        raise NotImplementedError

    def forward(self, input, hx=None):
        is_lstm = self.mode == "LSTM"
        if input.dim() not in (2, 3):
            raise ValueError(f"{type(self).__name__}: Expected input to be 2D or 3D, got {input.dim()}D instead")
        batched = input.dim() == 3
        x = input if batched else input.unsqueeze(1)
        if self.batch_first and batched:
            x = x.transpose(0, 1)
        if x.size(-1) != self.input_size:
            raise RuntimeError(f"input.size(-1) must be equal to input_size. Expected {self.input_size}, got {x.size(-1)}")
        L, N = x.shape[0], x.shape[1]
        num_dir = 2 if self.bidirectional else 1
        if hx is None:
            zeros = _core.zeros(self.num_layers * num_dir, N, self.hidden_size, dtype=x.dtype, device=x.device)
            h0, c0 = zeros, (zeros if is_lstm else None)
        else:
            if is_lstm:
                h0, c0 = hx
            else:
                h0, c0 = hx, None
            if not batched:
                h0 = h0.unsqueeze(1)
                c0 = c0.unsqueeze(1) if c0 is not None else None
            expected = (self.num_layers * num_dir, N, self.hidden_size)
            if tuple(h0.shape) != expected:
                raise RuntimeError(f"Expected hidden size {expected}, got [{', '.join(map(str, h0.shape))}]")
        h_n, c_n = [], []
        layer_input = x
        for layer in range(self.num_layers):
            dir_outputs = []
            for direction in range(num_dir):
                idx = layer * num_dir + direction
                suffix = "_reverse" if direction == 1 else ""
                w_ih = getattr(self, f"weight_ih_l{layer}{suffix}")
                w_hh = getattr(self, f"weight_hh_l{layer}{suffix}")
                b_ih = getattr(self, f"bias_ih_l{layer}{suffix}", None) if self.bias else None
                b_hh = getattr(self, f"bias_hh_l{layer}{suffix}", None) if self.bias else None
                h = h0[idx]
                c = c0[idx] if is_lstm else None
                steps = range(L - 1, -1, -1) if direction == 1 else range(L)
                outs = [None] * L
                for t in steps:
                    if is_lstm:
                        h, c = self._cell(layer_input[t], (h, c), w_ih, w_hh, b_ih, b_hh)
                    else:
                        h = self._cell(layer_input[t], h, w_ih, w_hh, b_ih, b_hh)
                    outs[t] = h
                dir_outputs.append(_core.stack(outs, 0))
                h_n.append(h)
                if is_lstm:
                    c_n.append(c)
            layer_out = dir_outputs[0] if num_dir == 1 else _core.cat(dir_outputs, 2)
            if self.dropout > 0 and self.training and layer < self.num_layers - 1:
                layer_out = F.dropout(layer_out, self.dropout, training=True)
            layer_input = layer_out
        output = layer_input
        h_n = _core.stack(h_n, 0)
        c_n = _core.stack(c_n, 0) if is_lstm else None
        if self.batch_first and batched:
            output = output.transpose(0, 1)
        if not batched:
            output = output.squeeze(1)
            h_n = h_n.squeeze(1)
            c_n = c_n.squeeze(1) if is_lstm else None
        return (output, (h_n, c_n)) if is_lstm else (output, h_n)


class RNN(RNNBase):
    """h_t = tanh(x_t W_ihᵀ + b_ih + h_{t−1} W_hhᵀ + b_hh)."""

    def __init__(self, *args, nonlinearity="tanh", **kwargs):
        if "nonlinearity" in kwargs:
            nonlinearity = kwargs.pop("nonlinearity")
        if nonlinearity not in ("tanh", "relu"):
            raise ValueError(f"Unknown nonlinearity '{nonlinearity}'. Select from 'tanh' or 'relu'.")
        self.nonlinearity = nonlinearity
        super().__init__("RNN_TANH" if nonlinearity == "tanh" else "RNN_RELU", *args, **kwargs)

    def _cell(self, x, h, w_ih, w_hh, b_ih, b_hh):
        z = F.linear(x, w_ih, b_ih) + F.linear(h, w_hh, b_hh)
        return z.tanh() if self.nonlinearity == "tanh" else z.relu()

    def extra_repr(self):
        s = super().extra_repr()
        if self.nonlinearity != "tanh":
            s += f", nonlinearity={self.nonlinearity}"
        return s


class LSTM(RNNBase):
    """Long short-term memory: input (i), forget (f), cell (g) and output (o) gates; returns (output, (h_n, c_n))."""

    def __init__(self, *args, **kwargs):
        super().__init__("LSTM", *args, **kwargs)

    def _cell(self, x, state, w_ih, w_hh, b_ih, b_hh):
        h, c = state
        gates = F.linear(x, w_ih, b_ih) + F.linear(h, w_hh, b_hh)
        i, f, g, o = gates.chunk(4, -1)
        i, f, g, o = i.sigmoid(), f.sigmoid(), g.tanh(), o.sigmoid()
        c = f * c + i * g
        h = o * c.tanh()
        return h, c


class GRU(RNNBase):
    """Gated recurrent unit: reset (r) and update (z) gates; returns (output, h_n)."""

    def __init__(self, *args, **kwargs):
        super().__init__("GRU", *args, **kwargs)

    def _cell(self, x, h, w_ih, w_hh, b_ih, b_hh):
        gi = F.linear(x, w_ih, b_ih)
        gh = F.linear(h, w_hh, b_hh)
        i_r, i_z, i_n = gi.chunk(3, -1)
        h_r, h_z, h_n = gh.chunk(3, -1)
        r = (i_r + h_r).sigmoid()
        z = (i_z + h_z).sigmoid()
        n = (i_n + r * h_n).tanh()
        return (1 - z) * n + z * h


for _c in (RNNBase, RNN, LSTM, GRU):
    _c.__module__ = "torch.nn.modules.rnn"
