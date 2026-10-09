"""Draw the lesson diagrams for Shipping software into figures/*.svg (deterministic).

Run: python figures.py            (all figures)
     python figures.py kmp          (one figure)
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
    "axes.facecolor": "white", "savefig.facecolor": "white", "svg.hashsalt": "shipping-course",
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


# ---------------------------------------------------------------- Part 1: JavaScript basics


# ---------------------------------------------------------------- Part 1: Git basics

@fig("three-areas")
def three_areas_fig():
    f, ax = diag.canvas(11.0, 4.4)
    cols = [(0.2, "working tree", "the files you edit", BLUE, ["README.md", "prices.txt  (changed)", "notes.txt  (new)"]),
            (4.05, "staging area (index)", "what the next commit will contain", ORANGE, ["README.md", "prices.txt  (changed)"]),
            (7.9, "repository (.git)", "every commit, forever", TEAL, ["a1b2c3d  Add prices", "9f8e7d6  Add README"])]
    for x, title, sub, c, items in cols:
        sbox(ax, x, 0.7, 3.0, 2.7, "", color=c)
        label(ax, x + 1.5, 3.1, title, size=11, bold=True, color=c)
        label(ax, x + 1.5, 2.72, sub, size=8.5, color=MUTED)
        for i, it in enumerate(items):
            sbox(ax, x + 0.25, 1.95 - i * 0.48, 2.5, 0.38, it, color=GREY, mono=True, fontsize=8.5)
    arrow(ax, 3.3, 2.05, 4.0, 2.05, color=INK)
    label(ax, 3.62, 2.35, "git add", size=9, mono=True, bold=True)
    arrow(ax, 7.15, 2.05, 7.85, 2.05, color=INK)
    label(ax, 7.5, 2.35, "git commit", size=9, mono=True, bold=True)
    ax.add_patch(FancyArrowPatch((9.4, 0.62), (1.7, 0.62), arrowstyle="-|>", mutation_scale=14, color=MUTED, linewidth=1.3,
                                 connectionstyle="arc3,rad=-0.12"))
    label(ax, 5.5, -0.05, "git restore / git switch: copy files back from the repository", size=9, color=MUTED)
    return f


@fig("commit-chain")
def commit_chain_fig():
    f, ax = diag.canvas(11.0, 3.4)
    xs = [0.6, 3.6, 6.6]
    msgs = [("9f8e7d6", "Add README"), ("a1b2c3d", "Add prices"), ("c4d5e6f", "Add the lock")]
    for i, (x, (h, m)) in enumerate(zip(xs, msgs)):
        sbox(ax, x, 1.1, 2.3, 1.1, "", color=TEAL)
        label(ax, x + 1.15, 1.85, h, size=10, mono=True, bold=True)
        label(ax, x + 1.15, 1.45, m, size=9)
        if i:
            arrow(ax, x - 0.05, 1.65, xs[i - 1] + 2.35, 1.65, color=INK)
    label(ax, 2.3, 0.75, "each commit points to its parent", size=8.5, color=MUTED)
    sbox(ax, 9.4, 1.35, 1.3, 0.6, "main", color=ORANGE, mono=True, fontsize=10)
    arrow(ax, 9.35, 1.65, 8.95, 1.65, color=ORANGE)
    sbox(ax, 9.4, 2.45, 1.3, 0.6, "HEAD", color=PURPLE, mono=True, fontsize=10)
    arrow(ax, 10.05, 2.4, 10.05, 2.0, color=PURPLE)
    label(ax, 5.5, 3.1, "a branch is a name pointing at a commit; HEAD is the branch you're on", size=9.5, bold=True)
    return f


@fig("git-objects")
def git_objects_fig():
    f, ax = diag.canvas(11.0, 4.0)
    sbox(ax, 0.3, 1.15, 2.8, 1.85, "", color=TEAL)
    label(ax, 1.7, 2.72, "commit c4d5e6f", size=10, bold=True, mono=True)
    for i, t in enumerate(["tree 7a1…", "parent a1b2c3d", "author Ada …", "", "Add the lock"]):
        label(ax, 0.5, 2.38 - i * 0.24, t, size=8, mono=True, ha="left")
    sbox(ax, 4.0, 1.5, 2.6, 1.3, "", color=ORANGE)
    label(ax, 5.3, 2.55, "tree 7a1…", size=10, bold=True, mono=True)
    label(ax, 4.2, 2.15, "blob 3b1…  README.md", size=8, mono=True, ha="left")
    label(ax, 4.2, 1.85, "blob 39c…  prices.txt", size=8, mono=True, ha="left")
    arrow(ax, 3.15, 2.15, 3.95, 2.15, color=INK)
    sbox(ax, 7.6, 2.4, 3.1, 0.9, "blob 3b1…\n# Bike shop", color=BLUE, mono=True, fontsize=8.5)
    sbox(ax, 7.6, 0.9, 3.1, 1.1, "blob 39c…\nbell 800\npump 3200 …", color=BLUE, mono=True, fontsize=8.5)
    arrow(ax, 6.65, 2.25, 7.55, 2.75, color=INK)
    arrow(ax, 6.65, 1.9, 7.55, 1.45, color=INK)
    label(ax, 5.5, 0.35, "Each object is stored under the SHA-1 hash of its content: the same content always has the same name", size=9.5)
    return f

def main(names):
    OUT.mkdir(exist_ok=True)
    for name in names or FIGS:
        save(FIGS[name](), name)
    print(len(names or FIGS), "figures")


if __name__ == "__main__":
    main(sys.argv[1:])
