# Lesson 37: Topological sort and DAGs

**You'll learn:** dependencies as directed edges, directed acyclic graphs, Kahn's algorithm, smallest-first orders with a heap, the DFS method with white, grey and black, cycle detection in directed graphs, graphlib, critical paths and DP on DAGs.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/dsa/#topological-sort)**: run every example and check your exercise answers.

## Key terms

- **Topological order:** an ordering of a directed graph's vertices where every edge points forward.
- **DAG (directed acyclic graph):** a directed graph with no cycles; exactly the graphs with a topological order.
- **In-degree:** the number of edges coming into a vertex, such as unmet prerequisites.
- **Kahn's algorithm:** repeatedly take a vertex with in-degree 0 and remove its outgoing edges.
- **Grey vertex:** in DFS cycle detection, a vertex on the current path; reaching one again means a directed cycle.
- **Critical path:** the longest chain of dependent tasks; it decides the earliest finishing time of a project.

"Install the compiler before building; build before testing; test before deploying." When tasks depend on each other, you need an order that puts every task **after** everything it depends on. Draw each dependency as a directed edge `before → after`; such an order is a **topological order** (or topological sort) of that graph.

![A DAG of getting dressed: underwear → trousers → shoes, socks → shoes, shirt → tie → jacket, trousers → belt → jacket. Below it, one valid topological order: underwear, socks, shirt, trousers, tie, belt, shoes, jacket, where every arrow points from left to right](../figures/topological.svg)

- A topological order exists **if and only if** the graph has no directed cycle. A directed graph with no cycles is a **DAG** (directed acyclic graph). If A needs B and B needs A, no order works.
- There are often **many** valid orders; any one is a correct answer unless the problem asks for a specific one.

## Kahn's algorithm: repeatedly take what's ready

The **in-degree** of a task is how many tasks it still waits for. Tasks with in-degree 0 are ready. Take one, and "remove" its outgoing edges by decrementing its neighbours' in-degrees; any neighbour that reaches 0 becomes ready.

```python
from collections import deque

def kahn(n, edges):                          # edges: (before, after)
    graph = [[] for _ in range(n)]
    indegree = [0] * n
    for u, v in edges:
        graph[u].append(v)
        indegree[v] += 1
    ready = deque(i for i in range(n) if indegree[i] == 0)
    order = []
    while ready:
        u = ready.popleft()
        order.append(u)
        for v in graph[u]:
            indegree[v] -= 1
            if indegree[v] == 0:             # its last prerequisite is done
                ready.append(v)
    return order if len(order) == n else None   # leftovers mean a cycle

print(kahn(6, [(5, 2), (5, 0), (4, 0), (4, 1), (2, 3), (3, 1)]))
print(kahn(3, [(0, 1), (1, 2), (2, 0)]))     # a cycle: no order
```

If some vertices never reach in-degree 0, they're stuck on a cycle: **the same algorithm detects cycles**. O(V + E) time.

To get the **smallest** order alphabetically (or by number), swap the deque for a heap: `heapq.heappush(ready, v)` and `heapq.heappop(ready)`, at O((V + E) log V).

## The DFS method and three colours

A vertex finishes (all its descendants explored) only after everything it leads to. So the **reverse of the DFS finishing order** is a topological order. To spot cycles, colour vertices: **white** (unvisited), **grey** (on the current path), **black** (finished). Reaching a **grey** vertex again means you've gone round a loop.

```python
def topo_dfs(graph):
    WHITE, GREY, BLACK = 0, 1, 2
    colour = {v: WHITE for v in graph}
    finished = []

    def visit(u):
        colour[u] = GREY
        for v in graph[u]:
            if colour[v] == GREY:
                raise ValueError(f"cycle through {u} -> {v}")
            if colour[v] == WHITE:
                visit(v)
        colour[u] = BLACK
        finished.append(u)                   # u is done after all it leads to

    for u in graph:
        if colour[u] == WHITE:
            visit(u)
    return finished[::-1]

graph = {"wake": ["shower", "coffee"], "shower": ["dress"], "coffee": ["leave"], "dress": ["leave"], "leave": []}
print(topo_dfs(graph))
try:
    topo_dfs({"a": ["b"], "b": ["c"], "c": ["a"]})
except ValueError as e:
    print(e)
```

In an **undirected** graph, seeing an already-visited vertex other than your parent means a cycle; in a **directed** graph, only a **grey** one does (a black one was reached by another route, which is fine). The recursive version needs one call per vertex on the longest path, so prefer Kahn's algorithm for big inputs.

## Python's graphlib

The standard library has had a topological sorter since Python 3.9. You give each node its **predecessors**:

```python
from graphlib import TopologicalSorter, CycleError

deps = {"deploy": {"test"}, "test": {"build"}, "build": {"install"}, "docs": {"install"}}
print(list(TopologicalSorter(deps).static_order()))

try:
    list(TopologicalSorter({"a": {"b"}, "b": {"a"}}).static_order())
except CycleError as e:
    print("cycle:", e.args[1])
```

It can also hand out tasks in batches that may run **in parallel** (`prepare()`, `get_ready()`, `done()`), which is how build tools and data pipelines schedule work.

## Dynamic programming on a DAG

Processing vertices in topological order guarantees that when you reach a vertex, everything before it is finished. That makes DAGs ideal for dynamic programming (Part 9). The **critical path** of a project, the earliest time everything can be finished when independent tasks run in parallel, is the **longest** path through the DAG weighted by task durations:

```python
from collections import deque

def earliest_finish(durations, deps):        # deps: (before, after)
    n = len(durations)
    graph, indegree = [[] for _ in range(n)], [0] * n
    for u, v in deps:
        graph[u].append(v)
        indegree[v] += 1
    start = [0] * n                          # earliest start time of each task
    ready = deque(i for i in range(n) if indegree[i] == 0)
    while ready:
        u = ready.popleft()
        for v in graph[u]:
            start[v] = max(start[v], start[u] + durations[u])   # v waits for its slowest prerequisite
            indegree[v] -= 1
            if indegree[v] == 0:
                ready.append(v)
    return max(s + d for s, d in zip(start, durations))

# 0: design (3 days), 1: backend (5), 2: frontend (4), 3: tests (2)
print(earliest_finish([3, 5, 4, 2], [(0, 1), (0, 2), (1, 3), (2, 3)]))   # 3 + 5 + 2
```

The same pattern gives **shortest** paths in a DAG even with negative weights, in O(V + E): relax each vertex's outgoing edges in topological order.

## Where topological order shows up

| Situation | Vertices | Edge u → v means |
|---|---|---|
| Course prerequisites | courses | take u before v |
| Build systems (make, Bazel), package installers | targets, packages | v depends on u |
| Spreadsheets | cells | v's formula uses u |
| Data pipelines (Airflow DAGs) | jobs | v needs u's output |
| Neural networks | operations | v uses u's result; backpropagation runs in **reverse** topological order |

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Topological sort (Kahn) | queue of in-degree-0 vertices; decrement neighbours | O(V + E) | O(V + E) |
| Topological sort (DFS) | reverse of the finishing order | O(V + E) | O(V) |
| Directed cycle check | Kahn leaves vertices out, or DFS meets a grey vertex | O(V + E) | O(V) |
| Smallest topological order | Kahn with a heap instead of a queue | O((V + E) log V) | O(V + E) |
| Earliest finish (critical path) | DP in topological order: start[v] = max(start[u] + time[u]) | O(V + E) | O(V) |
| Shortest path in a DAG (any weights) | relax edges in topological order | O(V + E) | O(V) |

## Common mistakes

- Reversing the edge direction (for `[a, b]` meaning "b before a", the edge is b → a).
- Treating any revisited vertex as a cycle in a directed graph (only grey ones count).
- Forgetting vertices with no edges, which must still appear in the order.
- Returning a partial order without checking that every vertex was included.

## Exercises

### 1. Can all courses be finished?

There are `n` courses, numbered `0` to `n − 1`. `prerequisites` is a list of pairs `[a, b]` meaning "to take course `a` you must first take course `b`". Write `can_finish(n, prerequisites)` returning `True` if it's possible to take every course. It must be O(V + E): 100,000 courses in one long chain should take well under a second.

Starter code:

```python
from collections import deque

def can_finish(n, prerequisites):
    pass

print(can_finish(2, [[1, 0]]))            # True
print(can_finish(2, [[1, 0], [0, 1]]))    # False
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** `[a, b]` means b comes first; a course can depend on itself; courses with no pairs are free.
2. **Examples:** [[1, 0]] → True; [[1, 0], [0, 1]] → False.
3. **Brute force:** repeatedly look through all pairs for a course whose prerequisites are done: O(V × E).
4. **Pattern:** **topological sort (Kahn's algorithm)** = cycle detection in a directed graph.
5. **Plan:** in-degrees, a queue of ready courses, count how many get taken.
6. **Code and test:** a self-loop, a cycle hidden after a valid course, an empty prerequisite list.

</details>

<details>
<summary>💡 Hint 1</summary>

Draw each pair `[a, b]` as an edge b → a. When is it impossible to take every course?

</details>

<details>
<summary>💡 Hint 2</summary>

Exactly when the graph has a cycle. Kahn's algorithm finds out: count each course's unmet prerequisites (its in-degree), start with the courses that have none, and see how many courses you manage to take.

</details>

<details>
<summary>💡 Hint 3</summary>

Build `after[b].append(a)` and `waiting[a] += 1`. Queue every course with `waiting == 0`; each time you take one, decrement `waiting` for the courses after it and queue those that reach 0. Return `taken == n`.

</details>

### 2. Course order

Same input as before. Write `course_order(n, prerequisites)` returning a list of all `n` courses in an order in which they can be taken (any valid order is accepted), or `[]` if that's impossible.

Starter code:

```python
from collections import deque

def course_order(n, prerequisites):
    pass

print(course_order(4, [[1, 0], [2, 0], [3, 1], [3, 2]]))   # e.g. [0, 1, 2, 3] or [0, 2, 1, 3]
print(course_order(2, [[0, 1], [1, 0]]))                   # []
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** any valid order; include courses with no prerequisites; `[]` when a cycle exists.
2. **Examples:** the diamond allows [0, 1, 2, 3] or [0, 2, 1, 3].
3. **Brute force:** try permutations until one satisfies every pair: O(n! × E).
4. **Pattern:** **topological sort** with Kahn's algorithm.
5. **Plan:** in-degrees, ready queue, record the pop order, check its length.
6. **Code and test:** no prerequisites, backwards chains, a cycle not touching course 0.

</details>

<details>
<summary>💡 Hint 1</summary>

This is the previous exercise, but instead of counting the courses you take, record them.

</details>

<details>
<summary>💡 Hint 2</summary>

Kahn's algorithm produces a topological order: the order in which courses leave the ready queue.

</details>

<details>
<summary>💡 Hint 3</summary>

Append each popped course to `order`. At the end return `order` if it has all n courses, otherwise `[]` (a cycle stopped some courses).

</details>

**In the sandbox:** exercises 77–78. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Can all courses be finished?</summary>

```python
from collections import deque

def can_finish(n, prerequisites):
    after = [[] for _ in range(n)]       # after[b]: courses that need b
    waiting = [0] * n                    # in-degree: prerequisites not yet taken
    for a, b in prerequisites:
        after[b].append(a)
        waiting[a] += 1
    ready = deque(c for c in range(n) if waiting[c] == 0)
    taken = 0
    while ready:
        course = ready.popleft()
        taken += 1
        for nxt in after[course]:
            waiting[nxt] -= 1
            if waiting[nxt] == 0:        # all of nxt's prerequisites are done
                ready.append(nxt)
    return taken == n                    # anything left over is stuck on a cycle

print(can_finish(2, [[1, 0]]))
print(can_finish(2, [[1, 0], [0, 1]]))
```

**Line by line**

- `after[b].append(a)` stores the edge b → a: finishing b may unlock a.
- `waiting[a]` counts a's prerequisites; a course with 0 can be taken right away.
- Taking a course decrements `waiting` for everything after it; a course joins the queue the moment its last prerequisite is done.
- Courses on a cycle wait for each other forever and never join the queue, so `taken < n`.

**Trace** on n = 4, [[1, 0], [2, 1], [3, 2], [1, 3]]:

| step | ready queue | taken | waiting |
|---|---|---|---|
| start | 0 | 0 | [0, 2, 1, 1] |
| take 0 | — | 1 | [0, 1, 1, 1] |

Courses 1, 2 and 3 wait for each other in a cycle; the queue is empty with 1 of 4 taken: False.

**Complexity:** O(V + E) time and space.

**Common wrong approach:** a DFS that treats any visited vertex as a cycle. In a directed graph a vertex reached a second time by another route (a diamond) is fine; only a vertex still on the current path (grey) means a cycle.

</details>

<details>
<summary>✅ 2. Course order</summary>

```python
from collections import deque

def course_order(n, prerequisites):
    after = [[] for _ in range(n)]
    waiting = [0] * n
    for a, b in prerequisites:
        after[b].append(a)
        waiting[a] += 1
    ready = deque(c for c in range(n) if waiting[c] == 0)
    order = []
    while ready:
        course = ready.popleft()
        order.append(course)                 # Kahn's algorithm: the order courses become ready
        for nxt in after[course]:
            waiting[nxt] -= 1
            if waiting[nxt] == 0:
                ready.append(nxt)
    return order if len(order) == n else []

print(course_order(4, [[1, 0], [2, 0], [3, 1], [3, 2]]))
print(course_order(2, [[0, 1], [1, 0]]))
```

**Line by line**

- The setup is identical to `can_finish`.
- `order.append(course)` records each course when it's taken; every prerequisite of it was taken earlier, because it only became ready after them.
- If the order is shorter than n, the missing courses are on (or behind) a cycle, so the answer is `[]`.

**Trace** on n = 4, [[1, 0], [2, 0], [3, 1], [3, 2]]:

| popped | order | newly ready |
|---|---|---|
| 0 | [0] | 1, 2 |
| 1 | [0, 1] | — (3 still waits for 2) |
| 2 | [0, 1, 2] | 3 |
| 3 | [0, 1, 2, 3] | — |

**Complexity:** O(V + E) time and space.

**Common wrong approach:** sorting the courses by how many prerequisites they have. A course with one prerequisite can still need to come after a course with three.

</details>

## Quick quiz

1. When does a directed graph have a topological order?
   - A) Only when it's a tree
   - B) Always
   - C) Exactly when it has no directed cycle (it's a DAG)

2. In Kahn's algorithm, which vertices go into the queue first?
   - A) The highest-numbered ones
   - B) Those with the most edges
   - C) Those with in-degree 0

3. How does Kahn's algorithm reveal a cycle?
   - A) Fewer than V vertices make it into the order
   - B) It raises an error immediately
   - C) The queue never empties

4. In DFS cycle detection on a directed graph, which kind of vertex signals a cycle?
   - A) A grey vertex, one still on the current path
   - B) Any visited vertex
   - C) A black vertex

<details>
<summary>Quiz answers</summary>

1. **C) Exactly when it has no directed cycle (it's a DAG)**: A cycle would require each task on it to come before itself.
2. **C) Those with in-degree 0**: Nothing has to come before them.
3. **A) Fewer than V vertices make it into the order**: Vertices on a cycle never reach in-degree 0.
4. **A) A grey vertex, one still on the current path**: A black vertex was finished by another route, which is fine (think of a diamond).

</details>

---
Previous: [Lesson 36](36-bfs-shortest.md) · Next: [Lesson 38: Weighted shortest paths](38-shortest-paths.md)
