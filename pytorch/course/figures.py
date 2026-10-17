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


def main(names):
    OUT.mkdir(exist_ok=True)
    for name in names or FIGS:
        save(FIGS[name](), name)
    print(len(names or FIGS), "figures")


if __name__ == "__main__":
    main(sys.argv[1:])
