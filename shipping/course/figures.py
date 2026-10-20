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

# ---------------------------------------------------------------- Part 2: branches, GitHub and pull requests

def commit_dot(ax, x, y, text, color=TEAL, sub=None):
    ax.add_patch(Circle((x, y), 0.32, facecolor=SOFT[color], edgecolor=color, linewidth=1.8, zorder=3))
    label(ax, x, y, text, size=8.5, mono=True, bold=True)
    if sub:
        label(ax, x, y - 0.55, sub, size=8, color=MUTED)


def tag(ax, x, y, text, color=ORANGE, w=None):
    w = w or 0.22 + 0.105 * len(text)
    sbox(ax, x - w / 2, y - 0.2, w, 0.4, text, color=color, mono=True, fontsize=8.5)


def link(ax, x1, y1, x2, y2, color=INK):
    """An arrow from a commit to its parent (pointing back in time)."""
    ax.add_patch(FancyArrowPatch((x1, y1), (x2, y2), arrowstyle="-|>", mutation_scale=12, color=color, linewidth=1.4,
                                 shrinkA=17, shrinkB=17, zorder=2))


@fig("branches")
def branches_fig():
    f, ax = diag.canvas(11.0, 3.9)
    commit_dot(ax, 1.0, 1.6, "A")
    commit_dot(ax, 3.0, 1.6, "B")
    commit_dot(ax, 5.0, 1.6, "C", sub="Add opening hours")
    commit_dot(ax, 5.0, 3.0, "D", color=BLUE, sub=None)
    label(ax, 5.0, 3.55, "Add inner tubes", size=8, color=MUTED)
    link(ax, 3.0, 1.6, 1.0, 1.6)
    link(ax, 5.0, 1.6, 3.0, 1.6)
    link(ax, 5.0, 3.0, 3.0, 1.6, color=BLUE)
    tag(ax, 6.6, 1.6, "main")
    arrow(ax, 6.12, 1.6, 5.38, 1.6, color=ORANGE)
    tag(ax, 6.9, 3.0, "add-tubes", color=BLUE)
    arrow(ax, 6.28, 3.0, 5.38, 3.0, color=BLUE)
    tag(ax, 8.6, 3.0, "HEAD", color=PURPLE)
    arrow(ax, 8.2, 3.0, 7.55, 3.0, color=PURPLE)
    label(ax, 9.6, 1.95, "A branch is a pointer to a commit.", size=9, ha="center")
    label(ax, 9.6, 1.6, "Committing moves the branch HEAD", size=9, ha="center")
    label(ax, 9.6, 1.25, "points to; the others stay put.", size=9, ha="center")
    label(ax, 2.0, 0.55, "arrows point to each commit's parent", size=8.5, color=MUTED)
    return f


@fig("merge-types")
def merge_types_fig():
    f, ax = diag.canvas(11.0, 5.4)
    # fast-forward
    label(ax, 0.2, 5.05, "Fast-forward: main hasn't moved, so Git just moves the pointer", size=10, bold=True, ha="left")
    for x, t in [(1.0, "A"), (2.8, "B")]:
        commit_dot(ax, x, 3.9, t)
    commit_dot(ax, 4.6, 3.9, "C", color=BLUE)
    link(ax, 2.8, 3.9, 1.0, 3.9)
    link(ax, 4.6, 3.9, 2.8, 3.9, color=BLUE)
    tag(ax, 2.8, 3.05, "main before", color=GREY)
    arrow(ax, 2.8, 3.27, 2.8, 3.55, color=GREY)
    tag(ax, 4.6, 4.75, "main, add-tubes", color=ORANGE)
    arrow(ax, 4.6, 4.53, 4.6, 4.25, color=ORANGE)
    label(ax, 8.2, 3.9, "git merge add-tubes\nUpdating …  Fast-forward\n(no new commit)", size=9, mono=True)
    # three-way
    label(ax, 0.2, 2.6, "Three-way merge: both moved, so Git makes a merge commit with two parents", size=10, bold=True, ha="left")
    commit_dot(ax, 1.0, 1.3, "A")
    commit_dot(ax, 2.8, 1.3, "B")
    commit_dot(ax, 4.6, 0.6, "C", color=TEAL)
    commit_dot(ax, 4.6, 2.0, "D", color=BLUE)
    commit_dot(ax, 6.4, 1.3, "M", color=ORANGE)
    link(ax, 2.8, 1.3, 1.0, 1.3)
    link(ax, 4.6, 0.6, 2.8, 1.3)
    link(ax, 4.6, 2.0, 2.8, 1.3, color=BLUE)
    link(ax, 6.4, 1.3, 4.6, 0.6, color=ORANGE)
    link(ax, 6.4, 1.3, 4.6, 2.0, color=ORANGE)
    tag(ax, 7.6, 1.3, "main")
    arrow(ax, 7.15, 1.3, 6.75, 1.3, color=ORANGE)
    label(ax, 2.8, 0.55, "merge base", size=8, color=MUTED)
    label(ax, 9.5, 1.3, "Git combines the changes\nB→C and B→D;\nif both changed the same\nlines, that's a conflict", size=8.5)
    return f


@fig("merge-vs-rebase")
def merge_vs_rebase_fig():
    f, ax = diag.canvas(11.0, 6.0)
    label(ax, 0.2, 5.7, "Before: your main and GitHub's main have diverged", size=10, bold=True, ha="left")
    commit_dot(ax, 1.0, 4.6, "A")
    commit_dot(ax, 2.8, 4.6, "B")
    commit_dot(ax, 4.6, 5.1, "G", color=PURPLE)
    commit_dot(ax, 4.6, 4.1, "Y", color=BLUE)
    link(ax, 2.8, 4.6, 1.0, 4.6)
    link(ax, 4.6, 5.1, 2.8, 4.6, color=PURPLE)
    link(ax, 4.6, 4.1, 2.8, 4.6, color=BLUE)
    tag(ax, 6.1, 5.1, "origin/main", color=PURPLE)
    tag(ax, 5.8, 4.1, "main", color=BLUE)
    label(ax, 8.8, 4.6, "G: Grace's commit (pushed)\nY: your commit (not pushed)", size=8.5)
    # merge
    label(ax, 0.2, 3.3, "git pull --no-rebase: a merge commit joins them", size=10, bold=True, ha="left")
    commit_dot(ax, 1.0, 2.2, "A")
    commit_dot(ax, 2.8, 2.2, "B")
    commit_dot(ax, 4.6, 2.7, "G", color=PURPLE)
    commit_dot(ax, 4.6, 1.7, "Y", color=BLUE)
    commit_dot(ax, 6.4, 2.2, "M", color=ORANGE)
    link(ax, 2.8, 2.2, 1.0, 2.2)
    link(ax, 4.6, 2.7, 2.8, 2.2, color=PURPLE)
    link(ax, 4.6, 1.7, 2.8, 2.2, color=BLUE)
    link(ax, 6.4, 2.2, 4.6, 2.7, color=ORANGE)
    link(ax, 6.4, 2.2, 4.6, 1.7, color=ORANGE)
    tag(ax, 7.6, 2.2, "main")
    # rebase
    label(ax, 0.2, 1.0, "git pull --rebase: your commit is replayed on top, as a new commit Y′", size=10, bold=True, ha="left")
    commit_dot(ax, 1.0, 0.0, "A")
    commit_dot(ax, 2.8, 0.0, "B")
    commit_dot(ax, 4.6, 0.0, "G", color=PURPLE)
    commit_dot(ax, 6.4, 0.0, "Y′", color=BLUE)
    link(ax, 2.8, 0.0, 1.0, 0.0)
    link(ax, 4.6, 0.0, 2.8, 0.0, color=PURPLE)
    link(ax, 6.4, 0.0, 4.6, 0.0, color=BLUE)
    tag(ax, 7.6, 0.0, "main")
    label(ax, 9.4, 0.0, "a straight line; Y′ has\na new id (Y is left behind)", size=8.5)
    ax.set_ylim(-0.7, 6.0)
    return f


@fig("remotes")
def remotes_fig():
    f, ax = diag.canvas(11.0, 4.6)
    sbox(ax, 0.2, 0.4, 4.4, 3.6, "", color=BLUE)
    label(ax, 2.4, 3.7, "your computer: ~/shop", size=10.5, bold=True, color=BLUE)
    sbox(ax, 0.5, 2.55, 3.8, 0.75, "main  (your branch)", color=BLUE, mono=True, fontsize=9)
    sbox(ax, 0.5, 1.45, 3.8, 0.75, "origin/main  (last seen on GitHub)", color=PURPLE, mono=True, fontsize=9)
    label(ax, 2.4, 0.85, "working tree + .git", size=8.5, color=MUTED)
    sbox(ax, 6.6, 0.9, 4.2, 2.6, "", color=TEAL)
    label(ax, 8.7, 3.2, "GitHub: ada/shop", size=10.5, bold=True, color=TEAL)
    sbox(ax, 7.0, 1.9, 3.4, 0.75, "main", color=TEAL, mono=True, fontsize=9)
    label(ax, 8.7, 1.35, "the remote called origin", size=8.5, color=MUTED)
    arrow(ax, 4.4, 3.0, 6.95, 2.4, color=INK)
    label(ax, 5.6, 3.05, "git push", size=9, mono=True, bold=True)
    arrow(ax, 6.95, 2.1, 4.4, 1.8, color=INK)
    label(ax, 5.6, 1.6, "git fetch", size=9, mono=True, bold=True)
    label(ax, 5.5, 0.05, "git pull = git fetch, then merge (or rebase) origin/main into main", size=9.5)
    return f


@fig("pr-flow")
def pr_flow_fig():
    f, ax = diag.canvas(7.4, 5.3)
    steps = [("1", "branch", "git switch -c\nadd-tubes", BLUE), ("2", "push", "git push -u\norigin add-tubes", BLUE),
             ("3", "open a PR", "gh pr create", TEAL), ("4", "review", "gh pr review\n+ CI checks", PURPLE),
             ("5", "merge", "gh pr merge\n--squash -d", ORANGE), ("6", "update", "git switch main\ngit pull", BLUE)]
    w, h, gap = 2.0, 1.75, 0.45
    for i, (n, title, cmd, c) in enumerate(steps):
        col = i if i < 3 else 5 - i            # snake: 1 2 3 on top, then 4 5 6 right to left
        x = 0.25 + col * (w + gap)
        y = 3.1 if i < 3 else 0.75
        sbox(ax, x, y, w, h, "", color=c)
        label(ax, x + w / 2, y + h - 0.32, f"{n}. {title}", size=11, bold=True, color=c)
        label(ax, x + w / 2, y + 0.7, cmd, size=10, mono=True)
        if i in (1, 2):
            arrow(ax, x - gap + 0.04, y + h / 2, x - 0.04, y + h / 2, color=INK)
        if i in (4, 5):
            arrow(ax, x + w + gap - 0.04, y + h / 2, x + w + 0.04, y + h / 2, color=INK)
        if i == 3:
            arrow(ax, x + w / 2, 3.1 - 0.04, x + w / 2, y + h + 0.04, color=INK)
    label(ax, 3.7, 0.3, "Changes reach main only through a reviewed pull request", size=11, color=MUTED)
    return f


@fig("actions-anatomy")
def actions_anatomy_fig():
    f, ax = diag.canvas(7.6, 6.6)
    sbox(ax, 2.55, 5.55, 2.5, 0.85, "", color=ORANGE)
    label(ax, 3.8, 6.12, "event", size=11, bold=True, color=ORANGE)
    label(ax, 3.8, 5.78, "push to main", size=10, mono=True)
    arrow(ax, 3.8, 5.5, 3.8, 5.12, color=INK)
    sbox(ax, 0.15, 0.55, 7.3, 4.5, "", color=BLUE)
    label(ax, 3.8, 4.72, "workflow: .github/workflows/ci.yml", size=10.5, bold=True, color=BLUE, mono=True)
    for x, title, runner, steps, color in [(0.4, "job: test", "runs on ubuntu-24.04", ["checkout", "setup-node", "npm test"], TEAL),
                                           (4.0, "job: deploy", "needs: test", ["download-artifact", "deploy-pages", "curl the site"], PURPLE)]:
        sbox(ax, x, 0.8, 3.2, 3.6, "", color=color)
        label(ax, x + 1.6, 4.05, title, size=11, bold=True, color=color, mono=True)
        label(ax, x + 1.6, 3.65, runner, size=9.5, color=MUTED, mono=True)
        for k, step in enumerate(steps):
            sbox(ax, x + 0.25, 2.65 - k * 0.7, 2.7, 0.55, step, color=GREY, mono=True, fontsize=10)
    arrow(ax, 3.62, 2.6, 3.98, 2.6, color=INK)
    label(ax, 3.8, 0.18, "Each job gets a fresh runner and runs its steps in order.", size=10, color=MUTED)
    return f


@fig("ci-cd-stages")
def ci_cd_stages_fig():
    f, ax = diag.canvas(7.6, 6.0)
    stages = [("commit", "git push", BLUE), ("build & test", "npm ci, npm test", TEAL), ("artifact", "a tested build", ORANGE), ("deploy", "to production", PURPLE)]
    ys = [4.8, 3.45, 2.1, 0.75]
    for (title, sub, color), y in zip(stages, ys):
        sbox(ax, 0.2, y, 2.9, 0.95, "", color=color)
        label(ax, 1.65, y + 0.63, title, size=11, bold=True, color=color)
        label(ax, 1.65, y + 0.27, sub, size=9.5, mono=title != "artifact" and title != "deploy")
    for y1, y2 in zip(ys, ys[1:]):
        arrow(ax, 1.65, y1 - 0.03, 1.65, y2 + 0.98, color=INK)
    def bracket(x, bottom_row, lines, color):
        top, bottom = ys[0] + 0.9, ys[bottom_row] + 0.47
        ax.plot([x - 0.12, x, x, 4.1], [top, top, bottom, bottom], color=color, lw=1.6)
        for k, line in enumerate(lines):
            label(ax, 4.2, bottom + 0.2 - k * 0.4, line, size=10, color=color, bold=k == 0, ha="left")
    bracket(3.35, 1, ["continuous integration", "every change built and tested"], TEAL)
    bracket(3.6, 2, ["continuous delivery", "ready to ship; a person deploys"], ORANGE)
    bracket(3.85, 3, ["continuous deployment", "every passing change ships"], PURPLE)
    return f


@fig("job-graph")
def job_graph_fig():
    f, ax = diag.canvas(7.6, 5.0)
    for k, v in enumerate(["22", "24", "26"]):
        sbox(ax, 0.2, 3.3 - k * 1.1, 2.0, 0.75, f"test ({v})", color=TEAL, mono=True, fontsize=10.5)
        arrow(ax, 2.25, 3.68 - k * 1.1, 2.95, 2.78 - k * 0.12, color=INK)
    label(ax, 1.2, 4.4, "matrix: node", size=10, color=TEAL, mono=True)
    sbox(ax, 3.0, 2.3, 1.8, 0.75, "build", color=ORANGE, mono=True, fontsize=10.5)
    label(ax, 3.9, 3.35, "needs: test", size=10, color=ORANGE, mono=True)
    arrow(ax, 4.85, 2.68, 5.45, 2.68, color=INK)
    sbox(ax, 5.5, 2.3, 1.9, 0.75, "deploy", color=PURPLE, mono=True, fontsize=10.5)
    label(ax, 6.45, 3.35, "needs: build", size=10, color=PURPLE, mono=True)
    label(ax, 6.45, 1.9, "if: on main", size=10, color=MUTED, mono=True)
    label(ax, 3.8, 0.2, "Jobs run in parallel unless needs: chains them.", size=10, color=MUTED)
    return f


@fig("containers-vs-vms")
def containers_vs_vms_fig():
    f, ax = diag.canvas(7.6, 5.4)
    def stack(x0, title, rows, apps, color):
        label(ax, x0 + 1.75, 5.15, title, size=11.5, bold=True, color=color)
        y = 0.3
        for text, c in rows:
            sbox(ax, x0, y, 3.5, 0.55, text, color=c, fontsize=10)
            y += 0.65
        w = (3.5 - 0.1 * (len(apps) - 1)) / len(apps)
        for k, layers in enumerate(apps):
            yy = y
            for text, c in layers:
                sbox(ax, x0 + k * (w + 0.1), yy, w, 0.55, text, color=c, fontsize=9, mono=text.startswith("app"))
                yy += 0.65
    stack(0.1, "Virtual machines", [("hardware", GREY), ("host operating system", BLUE), ("hypervisor", PURPLE)],
          [[("guest OS", CRIMSON), ("libraries", ORANGE), ("app A", TEAL)], [("guest OS", CRIMSON), ("libraries", ORANGE), ("app B", TEAL)]], PURPLE)
    stack(4.0, "Containers", [("hardware", GREY), ("host OS (Linux kernel)", BLUE), ("container engine", PURPLE)],
          [[("libraries", ORANGE), ("app A", TEAL)], [("libraries", ORANGE), ("app B", TEAL)], [("libraries", ORANGE), ("app C", TEAL)]], TEAL)
    label(ax, 1.85, 4.6, "each VM boots its own OS", size=9.5, color=MUTED)
    label(ax, 5.75, 3.95, "containers share the host's kernel", size=9.5, color=MUTED)
    return f


@fig("image-layers")
def image_layers_fig():
    f, ax = diag.canvas(7.6, 6.9)
    layers = [("ADD alpine-minirootfs (alpine 3.24)", "8.79MB", GREY), ("RUN install Node.js 24.22.0", "157MB", GREY), ("RUN install Yarn", "5.34MB", GREY),
              ("COPY docker-entrypoint.sh", "388B", GREY), ("WORKDIR /app", "0B", BLUE), ("COPY package*.json ./", "311B", BLUE),
              ("RUN npm ci --omit=dev", "4.1kB", BLUE), ("COPY . .", "2.18kB", ORANGE)]
    y = 0.35
    for text, size, color in layers:
        sbox(ax, 0.2, y, 4.6, 0.52, text, color=color, mono=True, fontsize=9.5)
        label(ax, 5.25, y + 0.26, size, size=9.5, color=MUTED, mono=True)
        y += 0.6
    sbox(ax, 0.2, y + 0.1, 4.6, 0.52, "container's writable layer", color=CRIMSON, fontsize=9.5)
    ax.plot([5.9, 6.0, 6.0, 5.9], [0.35, 0.35, 2.67, 2.67], color=GREY, lw=1.5)
    label(ax, 6.15, 1.5, "node:24-alpine", size=9.5, color=MUTED, mono=True, ha="left")
    ax.plot([5.9, 6.0, 6.0, 5.9], [2.75, 2.75, 5.07, 5.07], color=BLUE, lw=1.5)
    label(ax, 6.15, 4.08, "your build", size=9.5, color=BLUE, ha="left")
    label(ax, 6.15, 3.75, "steps", size=9.5, color=BLUE, ha="left")
    label(ax, 3.8, 6.6, "Each step adds a read-only layer; a change rebuilds", size=10, color=MUTED)
    label(ax, 3.8, 6.3, "from the first changed step upward.", size=10, color=MUTED)
    return f


@fig("compose-network")
def compose_network_fig():
    f, ax = diag.canvas(7.6, 5.6)
    sbox(ax, 0.1, 4.2, 2.3, 0.9, "", color=GREY)
    label(ax, 1.25, 4.8, "your computer", size=10.5, bold=True)
    label(ax, 1.25, 4.45, "curl localhost:8080", size=9.5, mono=True)
    sbox(ax, 0.1, 0.35, 7.4, 3.35, "", color=BLUE)
    label(ax, 3.8, 3.4, "network shop_default", size=10.5, bold=True, color=BLUE, mono=True)
    sbox(ax, 0.45, 1.2, 2.6, 1.6, "", color=TEAL)
    label(ax, 1.75, 2.45, "web", size=11, bold=True, color=TEAL, mono=True)
    label(ax, 1.75, 2.05, "listens on 8080", size=9.5, color=MUTED)
    label(ax, 1.75, 1.6, "ports: 8080:8080", size=9.5, mono=True)
    sbox(ax, 4.3, 1.2, 2.8, 1.6, "", color=ORANGE)
    label(ax, 5.7, 2.45, "api", size=11, bold=True, color=ORANGE, mono=True)
    label(ax, 5.7, 2.05, "listens on 3000", size=9.5, color=MUTED)
    label(ax, 5.7, 1.6, "not published", size=9.5, color=MUTED)
    arrow(ax, 1.25, 4.15, 1.4, 2.85, color=INK)
    label(ax, 2.3, 3.95, "published port", size=9, color=MUTED)
    arrow(ax, 3.1, 2.0, 4.25, 2.0, color=INK)
    label(ax, 3.68, 2.25, "http://api:3000", size=8.5, mono=True)
    sbox(ax, 4.6, 0.5, 2.2, 0.5, "volume shop_data", color=PURPLE, fontsize=9, mono=True)
    ax.plot([5.7, 5.7], [1.0, 1.2], color=PURPLE, lw=1.6)
    label(ax, 3.8, 0.1, "Services find each other by name on the project's network.", size=9.5, color=MUTED)
    return f


# ---------------------------------------------------------------- Part 5: Kafka

KEYC = {"ada": BLUE, "grace": ORANGE, "linus": PURPLE}


@fig("kafka-log")
def kafka_log_fig():
    f, ax = diag.canvas(9.6, 5.0)
    # producers
    for y, name in ((3.3, "shop's API"), (1.7, "website")):
        sbox(ax, 0.1, y, 1.6, 0.7, name, color=GREY, fontsize=10)
    label(ax, 0.9, 4.45, "producers", size=10, bold=True, color=MUTED)
    # the topic
    sbox(ax, 2.2, 0.75, 4.75, 3.85, "", color=BLUE)
    label(ax, 2.35, 4.32, "topic orders", size=10.5, bold=True, color=BLUE, mono=True, ha="left")
    rows = [("partition 0", 6, 3.35), ("partition 1", 4, 2.3), ("partition 2", 5, 1.25)]
    for name, n, y in rows:
        label(ax, 2.35, y + 0.27, name, size=9, color=MUTED, mono=True, ha="left")
        cells(ax, 3.55, y, list(range(n)), w=0.5, h=0.55, color=BLUE, fontsize=9.5)
        arrow(ax, 3.55 + n * 0.5 + 0.05, y + 0.27, 3.55 + n * 0.5 + 0.45, y + 0.27, color=GREY, lw=1.3)
    label(ax, 6.2, 0.95, "new events go at the end", size=8.5, color=MUTED, italic=True)
    arrow(ax, 1.75, 3.65, 2.25, 3.4, color=INK)
    arrow(ax, 1.75, 2.05, 2.25, 2.3, color=INK)
    label(ax, 1.95, 2.85, "append", size=9, color=MUTED)
    # consumer groups
    sbox(ax, 7.55, 3.15, 1.95, 0.85, "", color=TEAL)
    label(ax, 8.52, 3.75, "group billing", size=9.5, bold=True, color=TEAL, mono=True)
    label(ax, 8.52, 3.4, "partition 0: next is 3", size=8.5, color=MUTED)
    sbox(ax, 7.55, 1.6, 1.95, 0.85, "", color=CRIMSON)
    label(ax, 8.52, 2.2, "group analytics", size=9.5, bold=True, color=CRIMSON, mono=True)
    label(ax, 8.52, 1.85, "partition 0: next is 1", size=8.5, color=MUTED)
    # where each group will read next in partition 0
    for x, name, c in ((5.27, "billing", TEAL), (4.27, "analytics", CRIMSON)):
        arrow(ax, x, 4.22, x, 3.93, color=c, lw=1.4)
        label(ax, x, 4.33, name, size=8, color=c, bold=True)
    label(ax, 8.52, 1.15, "each group reads", size=9, color=MUTED)
    label(ax, 8.52, 0.87, "at its own pace", size=9, color=MUTED)
    label(ax, 4.8, 0.3, "Reading doesn't remove events: they stay until the topic's retention period ends.", size=9.5, color=MUTED)
    return f


@fig("kafka-partitions")
def kafka_partitions_fig():
    f, ax = diag.canvas(9.4, 4.9)
    events = [("ada", 1), ("grace", 2), ("ada", 3), ("linus", 4), ("grace", 5), ("ada", 6)]
    label(ax, 0.9, 4.6, "events, in order sent", size=9.5, bold=True, color=MUTED)
    for i, (k, n) in enumerate(events):
        sbox(ax, 0.1, 3.85 - i * 0.62, 1.6, 0.5, f"{k} · #{n}", color=KEYC[k], mono=True, fontsize=9.5)
    sbox(ax, 2.45, 1.85, 2.0, 1.1, "", color=GREY)
    label(ax, 3.45, 2.6, "partitioner", size=10, bold=True)
    label(ax, 3.45, 2.2, "murmur2(key) % 3", size=9, mono=True)
    arrow(ax, 1.8, 2.4, 2.4, 2.4, color=INK)
    parts = [("partition 0", [("grace", 2), ("grace", 5)], 3.55), ("partition 1", [], 2.25), ("partition 2", [("ada", 1), ("ada", 3), ("linus", 4), ("ada", 6)], 0.95)]
    for name, recs, y in parts:
        sbox(ax, 5.15, y - 0.36, 4.15, 1.19, "", color=GREY)
        label(ax, 5.25, y + 0.68, name, size=8.5, color=MUTED, mono=True, ha="left")
        for j, (k, n) in enumerate(recs):
            sbox(ax, 5.3 + j * 0.98, y, 0.9, 0.5, f"{k}", color=KEYC[k], mono=True, fontsize=8.5)
        if not recs:
            label(ax, 7.2, y + 0.25, "(no key lands here yet)", size=9, color=MUTED, italic=True)
        arrow(ax, 4.5, 2.4, 5.1, y + 0.3, color=GREY, lw=1.3)
    for y, recs in ((3.55, 2), (0.95, 4)):
        for j in range(recs):
            label(ax, 5.3 + j * 0.98 + 0.45, y - 0.19, f"offset {j}", size=7.5, color=MUTED, mono=True)
    label(ax, 4.7, 0.2, "Each partition keeps its events in order; there's no order between partitions.", size=9.5, color=MUTED)
    return f


@fig("kafka-groups")
def kafka_groups_fig():
    f, ax = diag.canvas(10.2, 5.4)
    label(ax, 1.1, 5.15, "topic orders", size=10, bold=True, color=BLUE, mono=True)
    ys = {0: 4.1, 1: 2.95, 2: 1.8}
    for i, y in ys.items():
        sbox(ax, 0.2, y, 1.8, 0.65, f"partition {i}", color=BLUE, mono=True, fontsize=9.5)
    # billing: two members share the partitions
    sbox(ax, 3.2, 3.15, 2.8, 2.15, "", color=TEAL)
    label(ax, 4.6, 5.0, "group billing", size=10, bold=True, color=TEAL, mono=True)
    sbox(ax, 3.5, 4.15, 2.2, 0.6, "member A", color=TEAL, fontsize=9.5)
    sbox(ax, 3.5, 3.35, 2.2, 0.6, "member B", color=TEAL, fontsize=9.5)
    arrow(ax, 2.05, 4.45, 3.45, 4.5, color=TEAL)
    arrow(ax, 2.05, 3.3, 3.45, 4.3, color=TEAL)
    arrow(ax, 2.05, 2.1, 3.45, 3.6, color=TEAL)
    # analytics: one member reads everything
    sbox(ax, 3.2, 0.35, 2.8, 1.75, "", color=CRIMSON)
    label(ax, 4.6, 1.8, "group analytics", size=10, bold=True, color=CRIMSON, mono=True)
    sbox(ax, 3.5, 0.55, 2.2, 0.9, "one member,\nall 3 partitions", color=CRIMSON, fontsize=9.5)
    for y in ys.values():
        arrow(ax, 2.05, y + 0.2, 3.45, 1.0, color=CRIMSON, lw=1.1)
    # billing's lag on partition 2
    ax.plot([6.45, 6.45], [0.4, 5.2], color=GREY, lw=1, ls=(0, (4, 3)))
    label(ax, 8.35, 5.0, "billing on partition 2", size=10, bold=True)
    cells(ax, 6.85, 3.7, list(range(7)), w=0.42, h=0.5, color=BLUE, highlight={5: ORANGE, 6: ORANGE}, fontsize=9, idx=None)
    label(ax, 8.35, 4.45, "offsets", size=8.5, color=MUTED)
    arrow(ax, 9.13, 3.05, 9.13, 3.64, color=TEAL)
    label(ax, 9.05, 2.85, "committed: 5 (next to process)", size=8.5, color=TEAL, ha="right")
    arrow(ax, 9.79, 2.45, 9.79, 3.64, color=INK, lw=1.2)
    label(ax, 9.7, 2.3, "log end: 7", size=8.5, color=INK, ha="right")
    label(ax, 8.35, 1.7, "lag = 7 − 5 = 2", size=11, bold=True, color=ORANGE)
    label(ax, 8.35, 1.35, "events written but not yet", size=8.5, color=MUTED)
    label(ax, 8.35, 1.1, "processed by billing", size=8.5, color=MUTED)
    return f


@fig("kafka-replication")
def kafka_replication_fig():
    f, ax = diag.canvas(10.6, 5.3)
    reps = {0: [3, 1, 2], 1: [1, 2, 3], 2: [2, 3, 1]}
    colors = {0: BLUE, 1: ORANGE, 2: PURPLE}

    def panel(x0, title, down=None):
        label(ax, x0 + 2.45, 5.05, title, size=10.5, bold=True)
        sbox(ax, x0 + 1.35, 4.05, 2.2, 0.6, "controller (node 4)", color=GREY, fontsize=9)
        for b in (1, 2, 3):
            bx = x0 + (b - 1) * 1.65
            dead = b == down
            sbox(ax, bx, 0.75, 1.5, 2.95, "", color=GREY if dead else TEAL)
            label(ax, bx + 0.75, 3.42, f"broker {b}" + (" ✕" if dead else ""), size=9.5, bold=True, color=MUTED if dead else TEAL)
            for p in (0, 1, 2):
                lead = reps[p][0] if not (down and reps[p][0] == down) else [r for r in reps[p] if r != down][0]
                is_lead = b == lead and not dead
                y = 2.6 - p * 0.75
                c = GREY if dead else colors[p]
                box(ax, bx + 0.12, y, 1.26, 0.58, f"P{p} " + ("leader" if is_lead else "copy"), color=c,
                    fill=(c if is_lead else SOFT.get(c, "white")), textcolor=("white" if is_lead else (MUTED if dead else INK)), fontsize=8.5, bold=is_lead)
        isr = lambda p: ",".join(str(r) for r in reps[p] if r != down)
        label(ax, x0 + 2.45, 0.45, "ISR:  " + "   ".join(f"P{p} {isr(p)}" for p in (0, 1, 2)), size=8.5, color=MUTED, mono=True)

    panel(0.1, "All brokers up")
    panel(5.55, "Broker 3 stops", down=3)
    ax.plot([5.25, 5.25], [0.7, 5.0], color=GREY, lw=1, ls=(0, (4, 3)))
    label(ax, 5.3, 0.05, "Producers write to the leader, followers copy it; only in-sync replicas (ISR) can take over as leader.", size=9.5, color=MUTED)
    return f


@fig("kafka-listeners")
def kafka_listeners_fig():
    f, ax = diag.canvas(10.0, 6.6)
    # the working setup
    sbox(ax, 0.1, 5.3, 2.6, 0.95, "", color=GREY)
    label(ax, 1.4, 5.95, "your computer", size=10, bold=True)
    label(ax, 1.4, 5.55, "node send.js", size=9, mono=True)
    sbox(ax, 3.2, 2.55, 6.7, 3.85, "", color=BLUE)
    label(ax, 6.55, 6.1, "Compose network", size=10, bold=True, color=BLUE)
    for i, name in enumerate(("api", "billing")):
        sbox(ax, 3.45, 4.5 - i * 1.4, 1.6, 0.85, name, color=ORANGE, mono=True, fontsize=10)
    sbox(ax, 6.5, 2.75, 3.2, 3.05, "", color=TEAL)
    label(ax, 8.1, 5.5, "kafka", size=10.5, bold=True, color=TEAL, mono=True)
    box(ax, 6.7, 4.25, 2.8, 0.95, "", color=TEAL)
    label(ax, 8.1, 4.95, "INTERNAL :19092", size=9, bold=True, mono=True)
    label(ax, 8.1, 4.55, "advertises kafka:19092", size=8.5, mono=True, color=MUTED)
    box(ax, 6.7, 3.0, 2.8, 0.95, "", color=PURPLE)
    label(ax, 8.1, 3.7, "EXTERNAL :9092", size=9, bold=True, mono=True)
    label(ax, 8.1, 3.3, "advertises localhost:9092", size=8.5, mono=True, color=MUTED)
    arrow(ax, 5.1, 4.92, 6.65, 4.75, color=TEAL)
    arrow(ax, 5.1, 3.52, 6.65, 4.5, color=TEAL)
    label(ax, 5.85, 5.15, "kafka:19092", size=8.5, mono=True, color=TEAL)
    arrow(ax, 2.75, 5.6, 6.65, 3.55, color=PURPLE, rad=0.25)
    label(ax, 1.4, 4.95, "localhost:9092", size=8.5, mono=True, color=PURPLE)
    label(ax, 1.4, 4.65, "(published port)", size=8.5, color=MUTED)
    # the mistake
    label(ax, 5.0, 2.05, "The mistake: advertising localhost to containers", size=10, bold=True, color=CRIMSON)
    sbox(ax, 0.3, 0.3, 1.8, 0.85, "api", color=ORANGE, mono=True, fontsize=10)
    sbox(ax, 4.2, 0.3, 2.6, 0.85, "kafka :9092", color=TEAL, mono=True, fontsize=9.5)
    arrow(ax, 2.15, 0.92, 4.15, 0.92, color=INK, text="1. bootstrap kafka:9092 ✓", fontsize=8.5)
    arrow(ax, 4.15, 0.5, 2.15, 0.5, color=INK, text="2. \"I'm at localhost:9092\"", fontsize=8.5, text_offset=(0, -0.33))
    ax.add_patch(FancyArrowPatch((0.55, 1.2), (1.85, 1.2), arrowstyle="-|>", mutation_scale=12, color=CRIMSON, lw=1.5, connectionstyle="arc3,rad=-1.4"))
    label(ax, 8.4, 0.95, "3. connects to localhost:9092,", size=8.5, color=CRIMSON)
    label(ax, 8.4, 0.65, "which is the api container itself:", size=8.5, color=CRIMSON)
    label(ax, 8.4, 0.35, "connection refused ✕", size=8.5, color=CRIMSON, bold=True)
    return f


# ---------------------------------------------------------------- Part 6: Kubernetes

@fig("k8s-deployment")
def k8s_deployment_fig():
    f, ax = diag.canvas(10.2, 5.0)
    sbox(ax, 0.2, 3.9, 2.4, 0.7, "Deployment shop", color=TEAL, mono=True, fontsize=9.5)
    sbox(ax, 3.2, 3.9, 3.3, 0.7, "ReplicaSet shop-64f8dc496f", color=BLUE, mono=True, fontsize=9)
    sbox(ax, 7.2, 3.9, 2.8, 0.7, "ReplicaSet shop-664bf8b7f8", color=ORANGE, mono=True, fontsize=9)
    arrow(ax, 2.65, 4.25, 3.15, 4.25, color=INK)
    label(ax, 8.6, 3.6, "version 2: 0 pods now (kept for rollback)", size=8.5, color=ORANGE)
    label(ax, 4.85, 3.6, "version 1: 3 pods", size=8.5, color=BLUE)
    for i in range(3):
        x = 0.5 + i * 3.1
        sbox(ax, x, 0.7, 2.6, 2.2, "", color=BLUE)
        label(ax, x + 1.3, 2.55, f"pod {i + 1}", size=10, bold=True, color=BLUE)
        label(ax, x + 1.3, 2.15, "app=shop", size=9, mono=True)
        label(ax, x + 1.3, 1.8, "pod-template-hash=64f8dc496f", size=7.5, mono=True, color=MUTED)
        label(ax, x + 1.3, 1.1, "shop:1.0", size=9.5, mono=True)
        arrow(ax, 4.85, 3.85, x + 1.3, 2.95, color=BLUE, lw=1.1)
    label(ax, 5.0, 0.35, "A deleted pod is noticed by its ReplicaSet, which creates a replacement to keep three running.", size=8.5, color=MUTED)
    return f


@fig("k8s-service")
def k8s_service_fig():
    f, ax = diag.canvas(9.8, 5.0)
    sbox(ax, 0.2, 2.9, 3.0, 1.5, "", color=GREY)
    label(ax, 1.7, 4.1, "caller (any pod)", size=10, bold=True)
    label(ax, 1.7, 3.7, "http://shop:80", size=9.5, mono=True)
    label(ax, 1.7, 3.2, "cluster DNS: shop", size=8.5, color=MUTED)
    sbox(ax, 4.1, 2.9, 2.9, 1.5, "", color=TEAL)
    label(ax, 5.55, 4.1, "Service shop", size=10, bold=True, color=TEAL, mono=True)
    label(ax, 5.55, 3.7, "ClusterIP 10.96.143.166", size=8.5, mono=True)
    label(ax, 5.55, 3.25, "selector app=shop · 80 → 3000", size=8.5, mono=True)
    arrow(ax, 3.25, 3.65, 4.05, 3.65, color=INK)
    pods = [("10.244.0.5", True), ("10.244.0.7", True), ("10.244.0.9", False)]
    for i, (ip, ready) in enumerate(pods):
        x = 0.4 + i * 3.1
        sbox(ax, x, 0.35, 2.7, 1.6, "", color=BLUE if ready else GREY)
        label(ax, x + 1.35, 1.55, "shop pod", size=9.5, bold=True, color=BLUE if ready else MUTED)
        label(ax, x + 1.35, 1.15, ip + ":3000", size=8.5, mono=True)
        label(ax, x + 1.35, 0.7, "ready" if ready else "not ready: no traffic", size=8.5, color=BLUE if ready else CRIMSON)
        if ready:
            arrow(ax, 5.55, 2.85, x + 1.35, 1.98, color=TEAL, lw=1.1)
    label(ax, 4.9, 2.45, "endpoints: the ready pods only", size=8.5, color=MUTED)
    return f


def main(names):
    OUT.mkdir(exist_ok=True)
    for name in names or FIGS:
        save(FIGS[name](), name)
    print(len(names or FIGS), "figures")


if __name__ == "__main__":
    main(sys.argv[1:])
