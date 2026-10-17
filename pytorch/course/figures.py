"""Draw the lesson diagrams for the PyTorch course into figures/*.svg (deterministic).

Run: python figures.py            (all figures)
     python figures.py broadcasting (one figure)
Palette (validated for colour-blind separation): blue, orange, teal, crimson, purple; text stays in ink.
"""
import math
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, FancyArrowPatch, Rectangle

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "figures"
sys.path.insert(0, str(ROOT.parents[1] / "tools"))
import diag  # noqa: E402
from diag import arrow, box, label  # noqa: E402

GREEN, BLUE, ORANGE, TEAL, CRIMSON, PURPLE = "#2e7d32", "#1f6fb2", "#e07b00", "#159a7f", "#b42357", "#7a5ac8"
GREY, INK, MUTED = "#9aa5b1", "#1f2933", "#52606d"
SOFT = {GREEN: "#e3f2e4", BLUE: "#e3eef8", ORANGE: "#fdecd6", TEAL: "#dcf3ee", CRIMSON: "#f8e1e8", PURPLE: "#ece6f8", GREY: "#eef1f4", INK: "#eef1f4"}

plt.rcParams.update({
    "svg.fonttype": "none", "font.family": "sans-serif",
    "font.sans-serif": ["DejaVu Sans", "Helvetica", "Arial"], "font.size": 11,
    "axes.spines.top": False, "axes.spines.right": False, "axes.titleweight": "bold",
    "axes.titlesize": 12.5, "axes.edgecolor": MUTED, "axes.labelcolor": INK,
    "xtick.color": MUTED, "ytick.color": MUTED, "figure.facecolor": "white",
    "axes.facecolor": "white", "savefig.facecolor": "white", "svg.hashsalt": "pytorch-course",
    "legend.frameon": False,
})
FIGS = {}


def fig(name):
    def deco(f):
        FIGS[name] = f
        return f
    return deco


def save(f, name):
    f.savefig(OUT / f"{name}.svg", bbox_inches="tight", metadata={"Date": None})
    plt.close(f)


def sbox(ax, x, y, w, h, text="", color=GREEN, **kw):
    box(ax, x, y, w, h, text, color=color, fill=SOFT.get(color, "white"), **kw)


def cells(ax, x, y, values, w=0.7, h=0.6, color=BLUE, highlight=None, mono=True, fontsize=11, idx=None, idx_y=None):
    """A row of boxes with optional index labels above; highlight: {i: color}."""
    highlight = highlight or {}
    for i, v in enumerate(values):
        c = highlight.get(i, color)
        sbox(ax, x + i * w, y, w - 0.06, h, str(v), color=c, mono=mono, fontsize=fontsize)
        if idx is not None:
            label(ax, x + i * w + (w - 0.06) / 2, idx_y if idx_y is not None else y + h + 0.22, str(idx[i] if idx != "auto" else i), size=9.5, color=MUTED, mono=True)


# ---------------------------------------------------------------- Part 1: tensors and devices

@fig("tensor-ranks")
def tensor_ranks_fig():
    f, ax = diag.canvas(11.4, 4.2)
    # scalar
    sbox(ax, 0.5, 1.6, 0.8, 0.7, "7", color=BLUE, mono=True)
    label(ax, 0.9, 3.4, "scalar", bold=True)
    label(ax, 0.9, 3.0, "0 dims", size=9.5, color=MUTED)
    label(ax, 0.9, 0.8, "torch.Size([])", size=9, mono=True, color=MUTED)
    # vector
    cells(ax, 2.1, 1.6, [1, 2, 3], w=0.75, h=0.7, color=TEAL)
    label(ax, 3.2, 3.4, "vector", bold=True)
    label(ax, 3.2, 3.0, "1 dim", size=9.5, color=MUTED)
    label(ax, 3.2, 0.8, "torch.Size([3])", size=9, mono=True, color=MUTED)
    # matrix
    for r, row in enumerate([[1, 2, 3], [4, 5, 6]]):
        cells(ax, 5.0, 2.0 - r * 0.75, row, w=0.75, h=0.7, color=ORANGE)
    label(ax, 6.1, 3.4, "matrix", bold=True)
    label(ax, 6.1, 3.0, "2 dims: rows × columns", size=9.5, color=MUTED)
    label(ax, 6.1, 0.8, "torch.Size([2, 3])", size=9, mono=True, color=MUTED)
    # 3-D
    for k, off in enumerate((0.36, 0.0)):
        for r in range(2):
            for c in range(3):
                sbox(ax, 8.1 + off + c * 0.75, 1.65 + off - r * 0.75, 0.69, 0.7, "", color=PURPLE)
    label(ax, 9.4, 3.4, "3-D tensor", bold=True)
    label(ax, 9.4, 3.0, "a stack of 2 matrices", size=9.5, color=MUTED)
    label(ax, 9.4, 0.8, "torch.Size([2, 2, 3])", size=9, mono=True, color=MUTED)
    label(ax, 5.7, 0.25, "an image batch is 4-D: [batch, channels, height, width]", size=9.5, color=INK, italic=True)
    return f


@fig("float-formats")
def float_formats_fig():
    f, ax = diag.canvas(10.6, 3.9)
    rows = [("float32", 1, 8, 23, "±3.4e38, ~7 digits", BLUE),
            ("bfloat16", 1, 8, 7, "±3.4e38, ~2–3 digits", TEAL),
            ("float16", 1, 5, 10, "±65504, ~3 digits", ORANGE)]
    scale = 0.205
    for i, (name, s, e, m, note, color) in enumerate(rows):
        y = 2.9 - i * 1.05
        label(ax, 0.2, y + 0.3, name, ha="left", bold=True, mono=True, color=color)
        x = 1.6
        for part, n, col in (("sign", s, CRIMSON), ("exponent", e, PURPLE), ("mantissa", m, color)):
            w = n * scale
            sbox(ax, x, y, w - 0.03, 0.6, str(n) if n > 1 else "1", color=col, fontsize=9.5)
            if i == 0:
                label(ax, x + w / 2, y + 0.82, part, size=9, color=MUTED)
            x += w
        label(ax, 8.4, y + 0.3, note, ha="left", size=9.5, color=INK)
    label(ax, 5.2, 0.2, "the exponent's bits decide the range, the mantissa's bits decide the precision", size=9.5, color=MUTED, italic=True)
    return f


@fig("view-storage")
def view_storage_fig():
    f, ax = diag.canvas(10.8, 4.6)
    label(ax, 0.3, 4.25, "one block of memory (storage)", ha="left", bold=True)
    cells(ax, 0.3, 3.3, [0, 1, 2, 3, 4, 5], w=0.72, h=0.62, color=GREY)
    # a: 2x3
    label(ax, 0.3, 2.55, "a = torch.arange(6).view(2, 3)", ha="left", mono=True, size=9.5)
    for r in range(2):
        cells(ax, 0.3, 1.65 - r * 0.62, [3 * r + c for c in range(3)], w=0.62, h=0.56, color=BLUE)
    label(ax, 0.3, 0.55, "stride (3, 1): contiguous", ha="left", size=9.2, color=MUTED)
    # t: transposed view
    label(ax, 3.8, 2.55, "t = a.t()   (a view)", ha="left", mono=True, size=9.5)
    for r in range(3):
        cells(ax, 3.8, 1.75 - r * 0.56, [r, r + 3], w=0.62, h=0.5, color=ORANGE)
    label(ax, 3.8, 0.12, "stride (1, 3): not contiguous", ha="left", size=9.2, color=MUTED)
    arrow(ax, 1.6, 2.35, 1.6, 3.2, color=BLUE)
    arrow(ax, 4.6, 2.4, 3.0, 3.2, color=ORANGE)
    # clone
    label(ax, 7.0, 4.25, "c = a.clone()", ha="left", mono=True, size=9.5, bold=True)
    cells(ax, 7.0, 3.3, [0, 1, 2, 3, 4, 5], w=0.55, h=0.62, color=TEAL)
    label(ax, 7.0, 2.85, "its own memory: changing c\nleaves a alone", ha="left", size=9.2, color=MUTED)
    label(ax, 7.0, 1.6, "views share memory: a[0, 0] = 9\nchanges t[0, 0] too", ha="left", size=9.6, color=INK)
    return f


@fig("reduce-dims")
def reduce_dims_fig():
    f, ax = diag.canvas(9.6, 4.4)
    vals = [[1, 2, 3], [4, 5, 6]]
    for r, row in enumerate(vals):
        cells(ax, 2.0, 2.6 - r * 0.75, row, w=0.8, h=0.7, color=BLUE)
    label(ax, 3.2, 3.75, "x  shape [2, 3]", mono=True, size=10)
    label(ax, 1.6, 3.0, "dim 0 ↓", size=9.5, color=ORANGE, ha="right")
    label(ax, 3.2, 3.45, "dim 1 →", size=9.5, color=TEAL)
    cells(ax, 2.0, 0.5, [5, 7, 9], w=0.8, h=0.7, color=ORANGE)
    arrow(ax, 3.2, 1.75, 3.2, 1.3, color=ORANGE)
    label(ax, 3.2, 0.15, "x.sum(dim=0) → shape [3]", mono=True, size=9.5, color=ORANGE)
    for r, v in enumerate((6, 15)):
        sbox(ax, 6.1, 2.6 - r * 0.75, 0.8, 0.7, str(v), color=TEAL, mono=True)
    arrow(ax, 4.5, 2.6, 5.9, 2.6, color=TEAL)
    label(ax, 6.5, 0.95, "x.sum(dim=1) → shape [2]", mono=True, size=9.5, color=TEAL)
    label(ax, 6.5, 0.6, "keepdim=True → shape [2, 1]", mono=True, size=9, color=MUTED)
    label(ax, 4.8, 4.2, "the dim you reduce over is the one that disappears", size=10, bold=True)
    return f


@fig("broadcasting")
def broadcasting_fig():
    f, ax = diag.canvas(10.6, 4.2)
    # a (3,1)
    for r in range(3):
        sbox(ax, 0.4, 2.6 - r * 0.62, 0.62, 0.56, str(r * 10), color=BLUE, mono=True)
    label(ax, 0.7, 3.5, "a  [3, 1]", mono=True, size=9.5)
    label(ax, 1.5, 2.0, "+", size=16)
    cells(ax, 1.9, 2.6, [0, 1, 2, 3], w=0.62, h=0.56, color=ORANGE)
    label(ax, 3.1, 3.5, "b  [4]", mono=True, size=9.5)
    label(ax, 4.6, 2.0, "=", size=16)
    for r in range(3):
        cells(ax, 5.0, 2.6 - r * 0.62, [r * 10 + c for c in range(4)], w=0.62, h=0.56, color=TEAL)
    label(ax, 6.2, 3.5, "result  [3, 4]", mono=True, size=9.5)
    rows = [("a", "3", "1"), ("b", " ", "4"), ("result", "3", "4")]
    diag.table(ax, 7.9, 3.5, ["", "dim -2", "dim -1"], rows, [0.8, 0.8, 0.8], color=PURPLE, fontsize=9.5)
    label(ax, 5.3, 0.35, "line shapes up from the right; each pair must be equal or 1 (a missing dim counts as 1)", size=9.5, color=MUTED, italic=True)
    return f


@fig("devices")
def devices_fig():
    f, ax = diag.canvas(10.6, 4.2)
    sbox(ax, 0.4, 0.9, 3.6, 2.6, "", color=BLUE)
    label(ax, 2.2, 3.15, "CPU memory (RAM)", bold=True, color=BLUE)
    label(ax, 2.2, 2.4, "x = torch.ones(3)", mono=True, size=9.5)
    label(ax, 2.2, 1.85, "x.numpy() works", size=9.5, color=MUTED)
    label(ax, 2.2, 1.35, "device='cpu'", mono=True, size=9.5, color=MUTED)
    sbox(ax, 6.6, 0.9, 3.6, 2.6, "", color=GREEN)
    label(ax, 8.4, 3.15, "GPU memory (VRAM)", bold=True, color=GREEN)
    label(ax, 8.4, 2.4, "g = x.to('cuda')", mono=True, size=9.5)
    label(ax, 8.4, 1.85, "fast maths, no .numpy()", size=9.5, color=MUTED)
    label(ax, 8.4, 1.35, "device='cuda:0'", mono=True, size=9.5, color=MUTED)
    arrow(ax, 4.1, 2.55, 6.5, 2.55, color=INK, text=".to('cuda')  ·  .cuda()")
    arrow(ax, 6.5, 1.75, 4.1, 1.75, color=INK, text=".to('cpu')  ·  .cpu()")
    label(ax, 5.3, 0.4, "each copy across takes time; x + g raises an error: every operand must be on the same device", size=9.5, color=CRIMSON)
    return f


# ---------------------------------------------------------------- Part 2: autograd and the model lifecycle

@fig("autograd-graph")
def autograd_graph_fig():
    f, ax = diag.canvas(10.8, 5.0, ylim=(-0.6, 4.4))
    sbox(ax, 0.3, 3.2, 1.6, 0.7, "w  (leaf)", color=BLUE, mono=True)
    sbox(ax, 0.3, 1.9, 1.6, 0.7, "x  (data)", color=GREY, mono=True)
    sbox(ax, 0.3, 0.6, 1.6, 0.7, "b  (leaf)", color=BLUE, mono=True)
    sbox(ax, 2.9, 2.55, 2.0, 0.7, "MulBackward0", color=ORANGE, mono=True, fontsize=9.5)
    sbox(ax, 5.6, 1.6, 2.0, 0.7, "AddBackward0", color=ORANGE, mono=True, fontsize=9.5)
    sbox(ax, 8.3, 1.6, 2.2, 0.7, "loss", color=CRIMSON, mono=True)
    arrow(ax, 1.95, 3.5, 2.85, 3.0, color=INK)
    arrow(ax, 1.95, 2.25, 2.85, 2.8, color=INK)
    arrow(ax, 4.95, 2.85, 5.55, 2.1, color=INK)
    arrow(ax, 1.95, 0.95, 5.55, 1.8, color=INK)
    arrow(ax, 7.65, 1.95, 8.25, 1.95, color=INK)
    label(ax, 5.4, 4.3, "forward: PyTorch records each operation (grad_fn) as it runs", size=10, color=INK)
    arrow(ax, 9.3, 1.45, 1.2, 0.35, color=CRIMSON, rad=-0.1, style="-|>")
    label(ax, 5.2, -0.45, "loss.backward(): walk the graph backwards, chain rule at each node → w.grad, b.grad", size=9.5, color=CRIMSON)
    label(ax, 1.1, 4.05, "requires_grad=True", size=8.8, color=BLUE, mono=True)
    return f


@fig("gradient-descent")
def gradient_descent_fig():
    f, axes = plt.subplots(1, 3, figsize=(10.8, 3.3), sharey=True)
    loss = lambda w: (w - 3) ** 2
    xs = [i / 20 for i in range(-30, 141)]
    for ax, (lr, title, color) in zip(axes, [(0.05, "lr = 0.05: slow", BLUE), (0.3, "lr = 0.3: good", TEAL), (1.05, "lr = 1.05: diverges", CRIMSON)]):
        ax.plot(xs, [loss(x) for x in xs], color=GREY, lw=2)
        w, path = -1.0, [-1.0]
        for _ in range(6):
            w = w - lr * 2 * (w - 3)
            path.append(w)
        ax.plot(path, [loss(p) for p in path], "o-", color=color, ms=5, lw=1.4)
        ax.set_title(title, color=color)
        ax.set_xlim(-1.6, 7.1)
        ax.set_ylim(-1, 26)
        ax.set_xlabel("weight w")
    axes[0].set_ylabel("loss (w − 3)²")
    f.suptitle("six steps of w ← w − lr · dloss/dw, starting at w = −1", fontsize=11, y=1.03)
    f.tight_layout()
    return f


@fig("training-loop")
def training_loop_fig():
    f, ax = diag.canvas(11.6, 4.4)
    steps = [("1  forward", "pred = model(x)", BLUE), ("2  loss", "loss = loss_fn(pred, y)", ORANGE),
             ("3  zero_grad", "optimizer.zero_grad()", PURPLE), ("4  backward", "loss.backward()", CRIMSON),
             ("5  step", "optimizer.step()", TEAL)]
    xs = [0.1, 2.4, 4.7, 7.0, 9.3]
    for x, (name, code, color) in zip(xs, steps):
        sbox(ax, x, 2.0, 2.1, 1.2, "", color=color)
        label(ax, x + 1.05, 2.85, name, bold=True, color=color, size=10)
        label(ax, x + 1.05, 2.35, code, mono=True, size=7.4)
    for a, b in zip(xs, xs[1:]):
        arrow(ax, a + 2.12, 2.6, b - 0.03, 2.6, color=INK)
    arrow(ax, 10.3, 1.95, 1.1, 1.95, color=MUTED, rad=-0.25)
    label(ax, 5.7, 0.55, "repeat for every batch (one pass over the data = an epoch)", size=9.6, color=MUTED)
    label(ax, 5.7, 3.85, "model.train() first; evaluate with model.eval() and torch.no_grad()", size=9.8, color=INK)
    return f


@fig("train-val-curves")
def train_val_curves_fig():
    import math as _m
    f, ax = plt.subplots(figsize=(7.4, 3.6))
    ep = list(range(1, 41))
    train = [0.9 * _m.exp(-e / 7) + 0.05 for e in ep]
    val = [0.9 * _m.exp(-e / 7) + 0.12 + 0.0009 * max(0, e - 12) ** 2 * 0.6 for e in ep]
    ax.plot(ep, train, color=BLUE, lw=2, label="training loss")
    ax.plot(ep, val, color=ORANGE, lw=2, label="validation loss")
    best = min(range(len(val)), key=lambda i: val[i])
    ax.axvline(ep[best], color=GREY, ls="--", lw=1.2)
    ax.annotate("best epoch:\nsave this checkpoint", (ep[best], val[best]), (ep[best] + 4, 0.65), fontsize=9.5, color=INK,
                arrowprops=dict(arrowstyle="->", color=MUTED))
    ax.text(31, 0.47, "overfitting:\nvalidation rises\nwhile training falls", fontsize=9.5, color=CRIMSON, ha="center")
    ax.set_xlabel("epoch")
    ax.set_ylabel("loss")
    ax.legend(loc="upper right")
    return f


# ---------------------------------------------------------------- Part 3: data handling

@fig("data-pipeline")
def data_pipeline_fig():
    f, ax = diag.canvas(11.6, 4.4)
    steps = [("Sampler", "which indexes?\nSequential / Random", ORANGE),
             ("BatchSampler", "groups of batch_size\n[7, 2, 9, 4]", PURPLE),
             ("Dataset", "dataset[i] for each i\n(x, y) samples", BLUE),
             ("collate_fn", "stack into tensors\nx [4, ...], y [4]", TEAL)]
    for i, (name, note, color) in enumerate(steps):
        x = 0.3 + i * 2.75
        sbox(ax, x, 1.5, 2.3, 1.6, "", color=color)
        label(ax, x + 1.15, 2.7, name, bold=True, color=color, mono=True)
        label(ax, x + 1.15, 2.05, note, size=9, color=INK)
        if i < 3:
            arrow(ax, x + 2.35, 2.3, x + 2.7, 2.3, color=MUTED)
    label(ax, 5.8, 3.9, "for x, y in DataLoader(dataset, batch_size=4, shuffle=True):", mono=True, size=10)
    label(ax, 5.8, 0.85, "shuffle=True swaps in a RandomSampler; a new order is drawn every epoch", size=9.5, color=MUTED)
    label(ax, 5.8, 0.4, "num_workers > 0 runs the Dataset and collate steps in worker processes", size=9.5, color=MUTED)
    return f


@fig("workers")
def workers_fig():
    f, ax = diag.canvas(10.6, 4.4)
    sbox(ax, 0.3, 1.2, 2.4, 2.0, "", color=BLUE)
    label(ax, 1.5, 2.85, "main process", bold=True, color=BLUE)
    label(ax, 1.5, 2.25, "sampler: picks\nthe batch indexes", size=9)
    label(ax, 1.5, 1.55, "training loop", size=9, color=MUTED)
    for k, (y, color) in enumerate(((3.0, ORANGE), (1.0, TEAL))):
        sbox(ax, 4.2, y - 0.45, 2.6, 1.15, "", color=color)
        label(ax, 5.5, y + 0.4, f"worker {k}", bold=True, color=color)
        label(ax, 5.5, y - 0.05, f"seed = base_seed + {k}\nown copy of the dataset", size=8.8)
        arrow(ax, 2.8, 2.2, 4.1, y + 0.1, color=MUTED)
    for j, (k, color) in enumerate(((0, ORANGE), (1, TEAL), (0, ORANGE), (1, TEAL))):
        sbox(ax, 7.6 + j * 0.72, 1.9, 0.62, 0.6, f"b{j}", color=color, mono=True, fontsize=9.5)
    arrow(ax, 6.9, 3.1, 7.7, 2.6, color=MUTED)
    arrow(ax, 6.9, 1.1, 7.7, 1.85, color=MUTED)
    label(ax, 9.05, 2.9, "batches return in order", size=9.2)
    label(ax, 5.3, 0.15, "workers take turns: batch 0 → worker 0, batch 1 → worker 1, batch 2 → worker 0…", size=9.4, color=MUTED, italic=True)
    return f


@fig("leakage")
def leakage_fig():
    f, ax = diag.canvas(10.6, 4.0)
    label(ax, 2.6, 3.65, "right: statistics from training data only", bold=True, color=GREEN)
    sbox(ax, 0.3, 2.2, 3.2, 0.8, "training set", color=GREEN)
    sbox(ax, 3.7, 2.2, 1.3, 0.8, "val", color=BLUE)
    arrow(ax, 1.9, 2.15, 1.9, 1.45, color=GREEN)
    sbox(ax, 0.9, 0.7, 2.0, 0.7, "mean, std", color=GREEN, mono=True)
    arrow(ax, 2.95, 1.05, 4.3, 2.1, color=GREEN, text="apply", text_offset=(-0.45, 0.05))
    label(ax, 8.1, 3.65, "leak: statistics from all the data", bold=True, color=CRIMSON)
    sbox(ax, 5.8, 2.2, 3.2, 0.8, "training set", color=GREY)
    sbox(ax, 9.2, 2.2, 1.3, 0.8, "val", color=CRIMSON)
    arrow(ax, 7.4, 2.15, 7.6, 1.45, color=CRIMSON)
    arrow(ax, 9.85, 2.15, 8.2, 1.45, color=CRIMSON)
    sbox(ax, 6.9, 0.7, 2.0, 0.7, "mean, std", color=CRIMSON, mono=True)
    label(ax, 8.0, 0.3, "the validation score looks better than real use will be", size=9.2, color=CRIMSON)
    return f



# ---------------------------------------------------------------- Part 4: model development

@fig("convolution")
def convolution_fig():
    f, ax = diag.canvas(11.0, 4.6)
    # padded 5x5 input (with a ring of zeros) and a 3x3 kernel window
    n, cs, x0, y0 = 7, 0.42, 0.4, 0.9
    for r in range(n):
        for c in range(n):
            pad = r in (0, n - 1) or c in (0, n - 1)
            sbox(ax, x0 + c * cs, y0 + (n - 1 - r) * cs, cs - 0.04, cs - 0.04, "0" if pad else "", color=GREY if pad else BLUE, fontsize=7.5, mono=True)
    ax.add_patch(Rectangle((x0 - 0.03, y0 + 4 * cs - 0.03), 3 * cs + 0.02, 3 * cs + 0.02, fill=False, lw=2.4, edgecolor=ORANGE))
    label(ax, x0 + 3.5 * cs, y0 + n * cs + 0.3, "input 5 × 5, padding=1", size=9.5)
    # kernel
    kx = 4.0
    for r in range(3):
        for c in range(3):
            sbox(ax, kx + c * 0.45, 2.0 + (2 - r) * 0.45, 0.41, 0.41, "w", color=ORANGE, fontsize=8.5, mono=True)
    label(ax, kx + 0.67, 3.65, "kernel 3 × 3", size=9.5)
    label(ax, kx + 0.67, 1.65, "one weight per input\nchannel × position", size=8.5, color=MUTED)
    arrow(ax, 3.55, 2.65, 3.9, 2.65, color=MUTED)
    arrow(ax, 5.5, 2.65, 6.0, 2.65, color=MUTED)
    # output 5x5 (stride 1) with first cell highlighted
    ox = 6.2
    for r in range(5):
        for c in range(5):
            sbox(ax, ox + c * 0.42, 1.2 + (4 - r) * 0.42, 0.38, 0.38, "", color=ORANGE if (r, c) == (0, 0) else TEAL)
    label(ax, ox + 1.05, 3.6, "output 5 × 5 (stride 1)", size=9.5)
    label(ax, 5.5, 0.45, "out = ⌊(in + 2·padding − dilation·(kernel − 1) − 1) / stride⌋ + 1", size=10.5, mono=True)
    label(ax, 9.75, 2.3, "each output channel\nhas its own kernel\nacross all input channels", size=8.8, color=MUTED, ha="left")
    return f


@fig("lr-schedules")
def lr_schedules_fig():
    import torch
    from torch import nn, optim
    f, ax = plt.subplots(figsize=(8.6, 3.8))
    steps = 60

    def run(make):
        opt = optim.SGD(nn.Linear(1, 1).parameters(), lr=0.1)
        s = make(opt)
        out = []
        for _ in range(steps):
            out.append(opt.param_groups[0]["lr"])
            opt.step()
            s.step()
        return out
    curves = [
        ("StepLR(step_size=20, gamma=0.5)", lambda o: optim.lr_scheduler.StepLR(o, 20, 0.5), BLUE),
        ("CosineAnnealingLR(T_max=60)", lambda o: optim.lr_scheduler.CosineAnnealingLR(o, 60), ORANGE),
        ("LinearLR warm-up → cosine", lambda o: optim.lr_scheduler.SequentialLR(o, [optim.lr_scheduler.LinearLR(o, 0.05, total_iters=10), optim.lr_scheduler.CosineAnnealingLR(o, 50)], [10]), TEAL),
        ("OneCycleLR(max_lr=0.1)", lambda o: optim.lr_scheduler.OneCycleLR(o, max_lr=0.1, total_steps=steps), PURPLE),
    ]
    for name, make, color in curves:
        ax.plot(range(steps), run(make), label=name, color=color, lw=2)
    ax.set_xlabel("scheduler step (epoch, or batch for OneCycleLR)")
    ax.set_ylabel("learning rate")
    ax.legend(fontsize=8.5, loc="upper right")
    ax.set_title("Learning-rate schedules starting from lr = 0.1")
    return f


@fig("residual")
def residual_fig():
    f, ax = diag.canvas(10.0, 4.2)
    sbox(ax, 0.3, 1.8, 1.2, 0.8, "x", color=BLUE, mono=True)
    xs = [2.1, 4.1, 6.1]
    for x, name in zip(xs, ("Linear / Conv", "ReLU", "Linear / Conv")):
        sbox(ax, x, 1.8, 1.5, 0.8, name, color=ORANGE, fontsize=9)
    for a, b in ((1.5, 2.1), (3.6, 4.1), (5.6, 6.1), (7.6, 8.05)):
        arrow(ax, a + 0.03, 2.2, b - 0.03, 2.2, color=MUTED)
    ax.add_patch(Circle((8.35, 2.2), 0.3, fill=True, facecolor=SOFT[TEAL], edgecolor=TEAL, lw=1.6))
    label(ax, 8.35, 2.2, "+", size=16, color=TEAL)
    arrow(ax, 0.9, 2.65, 8.35, 2.52, color=TEAL, rad=-0.3)
    label(ax, 4.6, 3.95, "skip connection: the input is added back unchanged", size=9.5, color=TEAL)
    arrow(ax, 8.68, 2.2, 9.5, 2.2, color=MUTED)
    label(ax, 4.6, 0.9, "out = x + F(x)", mono=True, size=11)
    label(ax, 4.6, 0.4, "gradients flow straight through the +, so very deep networks still train", size=9.2, color=MUTED)
    return f


@fig("transfer-learning")
def transfer_learning_fig():
    f, ax = diag.canvas(10.0, 3.9)
    for i in range(4):
        sbox(ax, 0.4 + i * 1.55, 1.7, 1.35, 1.0, f"block {i + 1}", color=GREY, fontsize=9.5)
        if i < 3:
            arrow(ax, 1.77 + i * 1.55, 2.2, 1.93 + i * 1.55, 2.2, color=MUTED)
    label(ax, 3.3, 3.25, "pretrained backbone: frozen (requires_grad=False)", size=9.5, color=MUTED)
    label(ax, 3.3, 1.25, "general features learned on a big dataset", size=8.8, color=MUTED, italic=True)
    arrow(ax, 6.6, 2.2, 7.1, 2.2, color=MUTED)
    sbox(ax, 7.2, 1.7, 2.2, 1.0, "new head\nnn.Linear(f, classes)", color=GREEN, fontsize=9)
    label(ax, 8.3, 3.25, "trained", size=9.5, color=GREEN, bold=True)
    label(ax, 5.0, 0.45, "then optionally unfreeze the last blocks with a smaller learning rate (fine-tuning)", size=9.3)
    return f



# ---------------------------------------------------------------- Part 5: performance

@fig("gpu-async")
def gpu_async_fig():
    f, ax = diag.canvas(10.6, 3.8)
    label(ax, 0.2, 3.1, "CPU (Python)", ha="left", bold=True, color=BLUE)
    label(ax, 0.2, 1.7, "GPU", ha="left", bold=True, color=GREEN)
    for i, name in enumerate(("launch A", "launch B", "launch C")):
        sbox(ax, 1.9 + i * 0.95, 2.85, 0.85, 0.5, name, color=BLUE, fontsize=8)
    sbox(ax, 4.85, 2.85, 1.0, 0.5, "t1 = clock", color=CRIMSON, fontsize=8)
    label(ax, 6.0, 3.1, "← stops too early: the GPU is still busy", ha="left", size=8.8, color=CRIMSON)
    for i, (name, w) in enumerate((("kernel A", 1.6), ("kernel B", 2.0), ("kernel C", 1.4))):
        x = 2.2 + sum((1.6, 2.0, 1.4)[:i])
        sbox(ax, x, 1.45, w - 0.08, 0.5, name, color=GREEN, fontsize=8.5)
    sbox(ax, 7.3, 0.55, 1.6, 0.5, "synchronize()", color=ORANGE, fontsize=8.5)
    arrow(ax, 7.2, 1.42, 7.6, 1.08, color=ORANGE)
    label(ax, 9.0, 0.8, "then read the clock", ha="left", size=8.8, color=ORANGE)
    label(ax, 5.3, 0.15, "PyTorch queues GPU work and returns at once; time it with torch.cuda.synchronize() or torch.utils.benchmark", size=9, color=MUTED, italic=True)
    return f


@fig("compile")
def compile_fig():
    f, ax = diag.canvas(11.0, 3.6)
    steps = [("Python code\nmodel(x)", BLUE), ("TorchDynamo\ncaptures an FX graph", ORANGE),
             ("TorchInductor\nfuses operations", PURPLE), ("generated kernels\nTriton (GPU) / C++ (CPU)", GREEN)]
    for i, (name, color) in enumerate(steps):
        x = 0.3 + i * 2.7
        sbox(ax, x, 1.6, 2.3, 1.1, name, color=color, fontsize=9)
        if i < 3:
            arrow(ax, x + 2.33, 2.15, x + 2.67, 2.15, color=MUTED)
    label(ax, 5.5, 3.25, "first call: compile (seconds to minutes) · later calls: reuse the cached kernels", size=9.5)
    label(ax, 5.5, 0.95, "graph break: code Dynamo can't trace (print, .item(), data-dependent if) runs in plain Python between graphs", size=9, color=CRIMSON)
    label(ax, 5.5, 0.45, "new input shapes or dtypes → a recompile (dynamic=True or mark_dynamic avoids repeats)", size=9, color=MUTED)
    return f


@fig("amp")
def amp_fig():
    f, ax = diag.canvas(11.0, 4.0)
    sbox(ax, 0.3, 2.4, 2.0, 0.9, "float32 weights\n(master copy)", color=BLUE, fontsize=9)
    sbox(ax, 2.9, 2.4, 2.4, 0.9, "autocast forward\nmatmul/conv in fp16\nsoftmax/loss in fp32", color=ORANGE, fontsize=8.5)
    sbox(ax, 5.9, 2.4, 1.9, 0.9, "loss × scale\n(GradScaler)", color=PURPLE, fontsize=9)
    sbox(ax, 8.4, 2.4, 2.3, 0.9, "backward:\nscaled fp16 grads", color=ORANGE, fontsize=9)
    sbox(ax, 8.4, 0.7, 2.3, 0.9, "unscale_: ÷ scale\ninf/nan? skip step", color=PURPLE, fontsize=9)
    sbox(ax, 5.3, 0.7, 2.5, 0.9, "optimizer.step()\non float32 weights", color=BLUE, fontsize=9)
    sbox(ax, 2.3, 0.7, 2.4, 0.9, "update(): halve the\nscale after inf, else\nslowly grow it", color=PURPLE, fontsize=8.3)
    for a, b in (((2.35, 2.85), (2.85, 2.85)), ((5.35, 2.85), (5.85, 2.85)), ((7.85, 2.85), (8.35, 2.85)), ((9.55, 2.35), (9.55, 1.65)), ((8.35, 1.15), (7.85, 1.15)), ((5.25, 1.15), (4.75, 1.15))):
        arrow(ax, a[0], a[1], b[0], b[1], color=MUTED)
    label(ax, 5.5, 3.75, "float16 needs loss scaling (small gradients underflow to 0); bfloat16 has float32's range and doesn't", size=9.3)
    return f


@fig("ddp")
def ddp_fig():
    f, ax = diag.canvas(11.0, 4.4)
    for r in range(4):
        x = 0.35 + r * 2.7
        sbox(ax, x, 2.4, 2.2, 1.3, "", color=GREEN)
        label(ax, x + 1.1, 3.4, f"GPU {r} · rank {r}", bold=True, color=GREEN, size=9.5)
        label(ax, x + 1.1, 2.95, "full model copy", size=8.8)
        label(ax, x + 1.1, 2.6, f"batch shard {r}", size=8.8, color=MUTED)
        arrow(ax, x + 1.1, 2.35, x + 1.1, 1.75, color=MUTED)
    sbox(ax, 0.35, 1.0, 10.3, 0.7, "all-reduce: average every gradient across the 4 processes (NCCL)", color=ORANGE, fontsize=9.5)
    label(ax, 5.5, 0.45, "each rank then takes the same optimizer step, so the copies stay identical; DistributedSampler gives each rank different data", size=9, color=MUTED)
    return f



def main(names):
    OUT.mkdir(exist_ok=True)
    for name in names or FIGS:
        save(FIGS[name](), name)
    print(len(names or FIGS), "figures")


if __name__ == "__main__":
    main(sys.argv[1:])
