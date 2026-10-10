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


def main(names):
    OUT.mkdir(exist_ok=True)
    for name in names or FIGS:
        save(FIGS[name](), name)
    print(len(names or FIGS), "figures")


if __name__ == "__main__":
    main(sys.argv[1:])
