"""torch.nn.utils.rnn: padding variable-length sequences into one tensor."""
from ... import _core


def pad_sequence(sequences, batch_first=False, padding_value=0.0, padding_side="right"):
    """Stack 1-D (or N-D) tensors of different lengths, padding the shorter ones with padding_value.
    Result: [max_len, batch, *] by default, or [batch, max_len, *] with batch_first=True."""
    if padding_side not in ("left", "right"):
        raise ValueError(f"Expected padding_side to be one of left or right, but got {padding_side}.")
    sequences = list(sequences)
    max_len = max(s.size(0) for s in sequences)
    trailing = tuple(sequences[0].shape[1:])
    out = _core.full((len(sequences), max_len) + trailing, padding_value, dtype=sequences[0].dtype,
                     device=sequences[0].device)
    for i, s in enumerate(sequences):
        n = s.size(0)
        if padding_side == "right":
            out[i, :n] = s
        else:
            out[i, max_len - n:] = s
    return out if batch_first else out.transpose(0, 1).contiguous()
