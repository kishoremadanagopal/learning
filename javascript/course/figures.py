"""Draw the lesson diagrams for JavaScript, TypeScript and JSON into figures/*.svg (deterministic).

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
    "axes.facecolor": "white", "savefig.facecolor": "white", "svg.hashsalt": "javascript-course",
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

@fig("where-js-runs")
def where_js_runs_fig():
    f, ax = diag.canvas(10.5, 4.7)
    sbox(ax, 3.9, 1.65, 2.7, 1.0, "your JavaScript", color=ORANGE, fontsize=12, bold=True)
    hosts = [(0.3, 3.0, "web browsers", "Chrome · Edge · Firefox · Safari\n+ the page, events, fetch", BLUE),
             (7.0, 3.0, "server runtimes", "Node.js · Deno · Bun\n+ files, network, processes", TEAL),
             (0.3, 0.2, "desktop apps", "Electron, e.g. VS Code\n+ windows and menus", PURPLE),
             (7.0, 0.2, "serverless and edge", "cloud functions\n+ requests and responses", CRIMSON)]
    for x, y, title, note, color in hosts:
        sbox(ax, x, y, 3.2, 1.0, "", color=color)
        label(ax, x + 1.6, y + 0.72, title, size=10.5, bold=True, color=color)
        label(ax, x + 1.6, y + 0.3, note, size=8.5, color=MUTED)
    arrow(ax, 4.2, 2.7, 3.0, 3.0, color=INK)
    arrow(ax, 6.3, 2.7, 7.5, 3.0, color=INK)
    arrow(ax, 4.2, 1.6, 3.0, 1.2, color=INK)
    arrow(ax, 6.3, 1.6, 7.5, 1.2, color=INK)
    label(ax, 5.25, 4.45, "one language (ECMAScript), many hosts, each adding its own extras", size=9.5, color=INK)
    return f


@fig("closure")
def closure_fig():
    f, ax = diag.canvas(10.5, 4.2)
    label(ax, 0.3, 3.95, "const counterA = makeCounter();   const counterB = makeCounter();", ha="left", size=9.5, mono=True)
    for i, (name, count, color) in enumerate([("counterA", "count = 2", BLUE), ("counterB", "count = 1", ORANGE)]):
        y = 2.25 - i * 1.75
        sbox(ax, 0.3, y, 2.4, 0.9, f"{name}\n() => {{ count++ … }}", color=color, fontsize=9, mono=True)
        sbox(ax, 4.3, y - 0.05, 3.2, 1.0, "", color=GREY)
        label(ax, 5.9, y + 0.7, f"scope of call {i + 1} to makeCounter", size=8.5, color=MUTED)
        label(ax, 5.9, y + 0.3, count, size=11, bold=True, color=color, mono=True)
        arrow(ax, 2.75, y + 0.45, 4.25, y + 0.45, color=color)
        label(ax, 3.5, y + 0.65, "remembers", size=8.5, color=color)
    label(ax, 8.0, 2.7, "counterA(); counterA();", ha="left", size=9, mono=True, color=BLUE)
    label(ax, 8.0, 2.35, "→ its own count is 2", ha="left", size=9, color=BLUE)
    label(ax, 8.0, 0.95, "counterB();", ha="left", size=9, mono=True, color=ORANGE)
    label(ax, 8.0, 0.6, "→ a separate count: 1", ha="left", size=9, color=ORANGE)
    return f



# ---------------------------------------------------------------- Part 2: working with data

@fig("reduce")
def reduce_fig():
    f, ax = diag.canvas(10.5, 3.6)
    label(ax, 0.3, 3.3, "[120, 35, 64].reduce((acc, t) => acc + t, 0)", ha="left", size=10, mono=True)
    steps = [(0, 120, 120), (120, 35, 155), (155, 64, 219)]
    for i, (acc, item, res) in enumerate(steps):
        x = 0.4 + i * 3.4
        sbox(ax, x, 1.75, 1.15, 0.7, f"acc\n{acc}", color=BLUE, fontsize=9.5, mono=True)
        label(ax, x + 1.38, 2.1, "+", size=13, bold=True)
        sbox(ax, x + 1.6, 1.75, 1.15, 0.7, f"item\n{item}", color=ORANGE, fontsize=9.5, mono=True)
        arrow(ax, x + 1.38, 1.7, x + 1.38, 1.0, color=INK)
        sbox(ax, x + 0.8, 0.25, 1.15, 0.7, f"{res}", color=TEAL if i < 2 else PURPLE, fontsize=11, mono=True, bold=True)
        label(ax, x + 1.38, 2.75, f"step {i + 1}", size=9, color=MUTED)
        if i < 2:
            ax.add_patch(FancyArrowPatch((x + 2.0, 0.6), (x + 3.4 + 0.05, 2.05), arrowstyle="-|>", mutation_scale=12,
                                         color=TEAL, linewidth=1.3, connectionstyle="arc3,rad=0.25"))
    label(ax, 9.25, 0.05, "result", size=9, color=PURPLE)
    return f


@fig("references")
def references_fig():
    f, ax = diag.canvas(11.0, 4.6)
    label(ax, 0.3, 4.35, "const b = a;   (one object, two names)", ha="left", size=10, bold=True)
    sbox(ax, 0.4, 3.2, 0.9, 0.55, "a", color=BLUE, mono=True)
    sbox(ax, 0.4, 2.45, 0.9, 0.55, "b", color=BLUE, mono=True)
    sbox(ax, 2.6, 2.7, 2.3, 0.85, "{ qty: 2 }", color=GREY, mono=True)
    arrow(ax, 1.35, 3.47, 2.55, 3.2, color=BLUE)
    arrow(ax, 1.35, 2.72, 2.55, 3.0, color=BLUE)
    label(ax, 3.75, 2.4, "b.qty = 2 changes what a sees", size=8.5, color=MUTED)

    label(ax, 5.7, 4.35, "shallow = { ...original }   vs   deep = structuredClone(original)", ha="left", size=10, bold=True)
    sbox(ax, 5.8, 3.2, 1.7, 0.6, "original", color=BLUE, mono=True, fontsize=9.5)
    sbox(ax, 5.8, 2.3, 1.7, 0.6, "shallow", color=ORANGE, mono=True, fontsize=9.5)
    sbox(ax, 5.8, 0.6, 1.7, 0.6, "deep", color=TEAL, mono=True, fontsize=9.5)
    sbox(ax, 8.6, 2.65, 2.2, 0.75, "address\n{ city }", color=GREY, mono=True, fontsize=9)
    sbox(ax, 8.6, 0.55, 2.2, 0.75, "address copy\n{ city }", color=TEAL, mono=True, fontsize=9)
    arrow(ax, 7.55, 3.5, 8.55, 3.15, color=BLUE)
    arrow(ax, 7.55, 2.6, 8.55, 2.9, color=ORANGE)
    arrow(ax, 7.55, 0.9, 8.55, 0.92, color=TEAL)
    label(ax, 9.7, 2.25, "shared!", size=9, bold=True, color=CRIMSON)
    label(ax, 9.7, 0.2, "its own copy", size=9, color=TEAL)
    return f



# ---------------------------------------------------------------- Part 4: asynchronous JavaScript

@fig("event-loop")
def event_loop_fig():
    f, ax = diag.canvas(11.0, 4.8)
    sbox(ax, 0.3, 1.0, 2.4, 2.9, "", color=BLUE)
    label(ax, 1.5, 3.6, "call stack", size=10.5, bold=True, color=BLUE)
    for i, t in enumerate(["main()", "handleClick()", "render()"]):
        sbox(ax, 0.55, 1.25 + i * 0.7, 1.9, 0.5, t, color=GREY, mono=True, fontsize=8.5)
    sbox(ax, 4.1, 2.6, 2.9, 1.3, "", color=PURPLE)
    label(ax, 5.55, 3.62, "runtime (browser / Node.js)", size=9.5, bold=True, color=PURPLE)
    label(ax, 5.55, 3.05, "timers · network · events", size=9, color=MUTED)
    arrow(ax, 2.75, 3.3, 4.05, 3.3, color=INK)
    label(ax, 3.4, 3.55, "setTimeout, fetch", size=8, color=MUTED)
    sbox(ax, 8.0, 3.0, 2.7, 0.8, "microtask queue\npromise callbacks", color=TEAL, fontsize=8.5)
    sbox(ax, 8.0, 1.6, 2.7, 0.8, "task queue\ntimers, events, I/O", color=ORANGE, fontsize=8.5)
    arrow(ax, 7.05, 3.1, 7.95, 3.35, color=TEAL)
    arrow(ax, 7.05, 2.75, 7.95, 2.05, color=ORANGE)
    ax.add_patch(FancyArrowPatch((9.35, 1.55), (2.0, 0.95), arrowstyle="-|>", mutation_scale=14, color=INK,
                                 linewidth=1.5, connectionstyle="arc3,rad=-0.25"))
    label(ax, 5.8, 0.25, "event loop: when the stack is empty, run ALL microtasks, then ONE task, repeat", size=9.5, bold=True)
    return f



# ---------------------------------------------------------------- Part 5: JavaScript in the browser

@fig("dom-tree")
def dom_tree_fig():
    f, ax = diag.canvas(11.0, 5.0)
    src = ['<body>', '  <h1>Shop</h1>', '  <ul id="list">', '    <li class="item">Bell</li>', '    <li class="item">Pump</li>', '  </ul>', '</body>']
    sbox(ax, 0.2, 0.7, 3.6, 3.9, "", color=GREY)
    label(ax, 2.0, 4.35, "the HTML you write", size=10, bold=True)
    for i, ln in enumerate(src):
        label(ax, 0.4, 3.85 - i * 0.45, ln, size=9, mono=True, ha="left")
    arrow(ax, 3.9, 2.6, 4.7, 2.6, color=INK)
    label(ax, 4.3, 2.9, "parse", size=8.5, color=MUTED)
    label(ax, 7.9, 4.75, "the DOM tree JavaScript works with", size=10, bold=True)
    nodes = {"body": (7.6, 4.0, BLUE), "h1": (5.9, 2.9, BLUE), "ul#list": (8.9, 2.9, BLUE),
             "li.item": (7.9, 1.7, BLUE), "li.item ": (9.9, 1.7, BLUE), '"Shop"': (5.9, 1.7, ORANGE),
             '"Bell"': (7.9, 0.55, ORANGE), '"Pump"': (9.9, 0.55, ORANGE)}
    for name, (x, y, c) in nodes.items():
        sbox(ax, x - 0.75, y - 0.25, 1.5, 0.5, name.strip(), color=c, mono=True, fontsize=9)
    for a, b in [("body", "h1"), ("body", "ul#list"), ("ul#list", "li.item"), ("ul#list", "li.item "),
                 ("h1", '"Shop"'), ("li.item", '"Bell"'), ("li.item ", '"Pump"')]:
        (x1, y1, _), (x2, y2, _) = nodes[a], nodes[b]
        arrow(ax, x1, y1 - 0.27, x2, y2 + 0.27, color=GREY, style="-")
    sbox(ax, 0.3, 0.12, 0.35, 0.25, "", color=BLUE)
    label(ax, 0.75, 0.245, "element node", size=8.5, ha="left", color=MUTED)
    sbox(ax, 2.2, 0.12, 0.35, 0.25, "", color=ORANGE)
    label(ax, 2.65, 0.245, "text node", size=8.5, ha="left", color=MUTED)
    return f


@fig("event-flow")
def event_flow_fig():
    f, ax = diag.canvas(11.0, 5.2)
    layers = [("window", 0.3, 0.3, 10.4, 3.9, GREY), ("document · body", 0.8, 0.6, 9.4, 3.1, GREY),
              ('ul id="list"', 1.3, 0.9, 8.4, 2.3, BLUE), ('li', 1.8, 1.2, 7.4, 1.5, BLUE)]
    for name, x, y, w, h, c in layers:
        sbox(ax, x, y, w, h, "", color=c)
        label(ax, x + 0.15, y + h - 0.22, name, size=9, mono=True, ha="left", color=MUTED)
    sbox(ax, 4.3, 1.45, 2.4, 0.6, "button (target)", color=ORANGE, mono=True, fontsize=9.5)
    ax.add_patch(FancyArrowPatch((2.6, 4.75), (4.25, 1.85), arrowstyle="-|>", mutation_scale=14, color=PURPLE, linewidth=1.6,
                                 connectionstyle="arc3,rad=0.15"))
    label(ax, 2.6, 4.98, "1. capture: down from window", size=9, color=PURPLE, bold=True)
    ax.add_patch(FancyArrowPatch((6.75, 1.85), (8.4, 4.75), arrowstyle="-|>", mutation_scale=14, color=TEAL, linewidth=1.6,
                                 connectionstyle="arc3,rad=0.15"))
    label(ax, 8.4, 4.98, "3. bubble: back up to window", size=9, color=TEAL, bold=True)
    label(ax, 5.5, 1.15, "2. target", size=9, color=ORANGE, bold=True)
    label(ax, 5.5, -0.05, "addEventListener listens in the bubble phase by default, so a listener on the ul hears clicks on every button inside it", size=9.5)
    return f


def main(names):
    OUT.mkdir(exist_ok=True)
    for name in names or FIGS:
        save(FIGS[name](), name)
    print(len(names or FIGS), "figures")


if __name__ == "__main__":
    main(sys.argv[1:])
