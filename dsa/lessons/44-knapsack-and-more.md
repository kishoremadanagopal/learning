# Lesson 44: Knapsacks, intervals, bitmasks and trees

**You'll learn:** 0/1 knapsack in 2-D and 1-D, loop direction, unbounded knapsack, rebuilding the chosen items, pseudo-polynomial time, subset sum and equal partition, the big-integer bitset trick, interval DP and matrix-chain order, bitmask DP and the travelling salesman problem, DP on trees, choosing a DP shape.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/dsa/#knapsack-and-more)**: run every example and check your exercise answers.

## Key terms

- **0/1 knapsack:** choose items, each at most once, to maximise value within a weight limit.
- **Unbounded knapsack:** the same, but each item can be used any number of times.
- **Subset sum:** deciding whether some subset of numbers adds up to a target.
- **Pseudo-polynomial time:** polynomial in a number's value (like W) rather than in the input's length.
- **Interval DP:** DP over ranges i..j, splitting each range and combining the parts.
- **Bitmask DP:** DP whose state includes a set of items stored as the bits of an integer.
- **Held-Karp algorithm:** the O(2ⁿ · n²) bitmask DP for the travelling salesman problem.
- **Tree DP:** computing each node's answer from its children's answers, usually in postorder.

This lesson covers the DP families you'll meet after the sequence and grid classics. Each has a recognisable shape; once you know the shape, the code follows.

## 0/1 knapsack

Each item has a weight and a value, and the bag holds at most W. Each item can be taken **once or not at all** (hence 0/1). Maximise the total value. State: `dp[i][w]` = the best value using the first i items with capacity w. Item i is either skipped (`dp[i−1][w]`) or taken (`dp[i−1][w − weight] + value`).

```python
def knapsack_table(weights, values, W):
    n = len(weights)
    dp = [[0] * (W + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        wt, val = weights[i - 1], values[i - 1]
        for w in range(W + 1):
            dp[i][w] = dp[i - 1][w]                                   # skip item i
            if wt <= w:
                dp[i][w] = max(dp[i][w], dp[i - 1][w - wt] + val)     # take item i
    chosen, w = [], W                                                 # walk back to see which items were taken
    for i in range(n, 0, -1):
        if dp[i][w] != dp[i - 1][w]:
            chosen.append(i - 1)
            w -= weights[i - 1]
    return dp[n][W], sorted(chosen)

print(knapsack_table([1, 3, 4, 5], [1, 4, 5, 7], 7))      # items 1 and 2: weight 7, value 9
```

**One row is enough**, but you must loop capacities **downwards**. Going down, `dp[w − wt]` still holds the value from the previous item, so each item is used at most once. Going **upwards** would let the same item be added again and again, which is exactly the **unbounded** knapsack (and coin change).

```python
def knapsack_01(weights, values, W):
    dp = [0] * (W + 1)
    for wt, val in zip(weights, values):
        for w in range(W, wt - 1, -1):          # downwards: each item at most once
            dp[w] = max(dp[w], dp[w - wt] + val)
    return dp[W]

def knapsack_unbounded(weights, values, W):
    dp = [0] * (W + 1)
    for wt, val in zip(weights, values):
        for w in range(wt, W + 1):              # upwards: an item can be reused
            dp[w] = max(dp[w], dp[w - wt] + val)
    return dp[W]

print(knapsack_01([1, 3, 4, 5], [1, 4, 5, 7], 7), knapsack_unbounded([1, 3, 4, 5], [1, 4, 5, 7], 7))
```

![Two one-row knapsack tables after adding an item of weight 2 and value 3 to an empty bag with capacity 6. Looping capacities downwards gives 0, 0, 3, 3, 3, 3, 3: the item is used once. Looping upwards gives 0, 0, 3, 3, 6, 6, 9: the item was reused because dp[w − 2] had already been updated](../figures/knapsack-direction.svg)

**Pseudo-polynomial time:** O(n × W) looks polynomial, but W is a **number**, not a length: doubling the number of digits in W squares the work. That's why knapsack is NP-hard in general yet easy when capacities are moderate (up to around 10⁶).

## Subset sum and equal partition

"Can some of these numbers add up to exactly T?" is a knapsack where weight = value and only feasibility matters: `can[s]` = some subset sums to s, updated downwards for each number. "Can the list be split into two halves with equal sums?" is subset sum with T = total / 2 (and impossible if the total is odd).

Python's unlimited-size integers give a neat speed-up: store the reachable sums as **bits** of one integer. Adding a number x to every reachable sum is a single shift-and-OR, done by fast C code on whole machine words at a time:

```python
def subset_sums(nums):
    reach = 1                       # bit s is 1 if sum s is reachable; only 0 at first
    for x in nums:
        reach |= reach << x         # every old sum, plus the same sums with x added
    return reach

reach = subset_sums([3, 34, 4, 12, 5, 2])
print([s for s in range(15) if reach >> s & 1])
print("9 reachable?", bool(reach >> 9 & 1), "| 30 reachable?", bool(reach >> 30 & 1))
```

## Interval DP

When the answer for a range i..j comes from **splitting** it at some k and combining the two sides, the state is the interval: `dp[i][j]`. Compute **short intervals first**, so both sides of every split are ready.

The classic is **matrix-chain multiplication**: multiplying A (10 × 30), B (30 × 5) and C (5 × 60) costs 4,500 scalar multiplications as (AB)C but 27,000 as A(BC). Which order is cheapest for a long chain?

```python
def matrix_chain(dims):                      # matrix i has shape dims[i] x dims[i + 1]
    n = len(dims) - 1
    dp = [[0] * n for _ in range(n)]         # dp[i][j]: cheapest cost to multiply matrices i..j
    split = [[0] * n for _ in range(n)]
    for length in range(2, n + 1):           # short intervals first
        for i in range(n - length + 1):
            j = i + length - 1
            dp[i][j] = float("inf")
            for k in range(i, j):            # last multiplication: (i..k) times (k+1..j)
                cost = dp[i][k] + dp[k + 1][j] + dims[i] * dims[k + 1] * dims[j + 1]
                if cost < dp[i][j]:
                    dp[i][j], split[i][j] = cost, k

    def brackets(i, j):
        if i == j:
            return "ABCDEFGH"[i]
        k = split[i][j]
        return f"({brackets(i, k)}{brackets(k + 1, j)})"
    return dp[0][n - 1], brackets(0, n - 1)

print(matrix_chain([10, 30, 5, 60]))
print(matrix_chain([40, 20, 30, 10, 30]))
```

O(n³) time, O(n²) space. The same shape solves bursting balloons, merging stones, optimal binary search trees and cutting a stick at chosen points.

## Bitmask DP: the travelling salesman

The **travelling salesman problem (TSP)**: the shortest tour visiting every city once and returning home. Trying all (n − 1)! orders is hopeless beyond about 11 cities. The **Held-Karp** DP stores, for each **set** of visited cities and each current city, the shortest path: `dp[mask][j]`. A set of cities fits in an integer's bits (bit j set means city j has been visited), so there are 2ⁿ × n states.

```python
def tsp(dist):
    n = len(dist)
    INF = float("inf")
    dp = [[INF] * n for _ in range(1 << n)]
    dp[1][0] = 0                                     # start at city 0; only city 0 visited
    for mask in range(1 << n):
        for j in range(n):
            if dp[mask][j] == INF or not mask >> j & 1:
                continue
            for k in range(n):
                if mask >> k & 1:
                    continue                         # k already visited
                new = mask | 1 << k
                if dp[mask][j] + dist[j][k] < dp[new][k]:
                    dp[new][k] = dp[mask][j] + dist[j][k]
    full = (1 << n) - 1
    return min(dp[full][j] + dist[j][0] for j in range(1, n))   # return home

dist = [[0, 10, 15, 20],
        [10, 0, 35, 25],
        [15, 35, 0, 30],
        [20, 25, 30, 0]]
print(tsp(dist))                                     # 0 -> 1 -> 3 -> 2 -> 0
```

O(2ⁿ × n²): about 400 million steps for n = 20, versus 19! ≈ 10¹⁷ orders. Bitmask DP fits any problem with a small set of items where **which** items are used matters but their order doesn't (assigning n ≤ 20 tasks to people, covering a set of requirements). The bit tricks themselves are in Lesson 47.

## DP on trees

On a tree, compute each node's answer from its children's answers in **postorder** (Lesson 30's "return information from children"). Often a node returns **two** numbers: the best with the node used, and the best with it unused. House robber on a tree ("you can't rob a parent and its child"):

```python
class TreeNode:
    def __init__(self, val, left=None, right=None):
        self.val, self.left, self.right = val, left, right

def rob_tree(root):
    def best(node):                          # returns (best if node is robbed, best if not)
        if node is None:
            return 0, 0
        l_take, l_skip = best(node.left)
        r_take, r_skip = best(node.right)
        take = node.val + l_skip + r_skip    # robbing it forbids robbing its children
        skip = max(l_take, l_skip) + max(r_take, r_skip)
        return take, skip
    return max(best(root))

root = TreeNode(3, TreeNode(4, TreeNode(1), TreeNode(3)), TreeNode(5, None, TreeNode(1)))
print(rob_tree(root))                        # 4 + 5
```

## Which DP shape is it?

| Clue in the problem | Shape | State |
|---|---|---|
| choose items under a weight/budget limit, each once | 0/1 knapsack | dp[capacity], capacities downwards |
| items can be reused | unbounded knapsack | dp[capacity], capacities upwards |
| reach an exact sum / split into equal halves | subset sum | can[sum] (or a bitset) |
| best way to split or merge a range | interval DP | dp[i][j], short intervals first |
| small set (n ≤ 20), which items are used matters | bitmask DP | dp[mask][last] |
| answer depends on children in a tree | tree DP | return a tuple from each subtree |
| count numbers up to N with a digit property | digit DP | dp[position][tight][state] |

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| 0/1 knapsack | dp[w] = max(dp[w], dp[w − wt] + val), w downwards | O(n · W) | O(W) |
| Unbounded knapsack | the same with w upwards | O(n · W) | O(W) |
| Subset sum / equal partition | can[s] = can[s] or can[s − x], s downwards; or a big-integer bitset shifted by x | O(n · S) | O(S) |
| Matrix-chain order (interval DP) | dp[i][j] = min over k of dp[i][k] + dp[k+1][j] + cost | O(n³) | O(n²) |
| Travelling salesman (Held-Karp) | dp[mask][j] over subsets | O(2ⁿ · n²) | O(2ⁿ · n) |
| House robber on a tree | each node returns (take, skip) | O(n) | O(h) |

## Common mistakes

- Looping capacities upwards in a 0/1 knapsack, which reuses items.
- Forgetting to reject an odd total in the equal-partition problem.
- Filling an interval table by start position instead of by interval length.
- Using a value-per-weight greedy for the 0/1 knapsack.

## Exercises

### 1. Partition into equal sums

Write `can_partition(nums)` returning `True` if the list of positive integers can be split into two groups with equal sums. It must handle 100 numbers up to 50 quickly.

Starter code:

```python
def can_partition(nums):
    pass

print(can_partition([1, 5, 11, 5]))   # True: [1, 5, 5] and [11]
print(can_partition([1, 2, 3, 5]))    # False
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** two groups, every number used, equal sums; positive integers.
2. **Examples:** [1, 5, 11, 5] → 11 = 1 + 5 + 5; [1, 2, 3, 5] (total 11) → False.
3. **Brute force:** try all 2ⁿ subsets.
4. **Pattern:** **subset sum** (0/1 knapsack with booleans).
5. **Plan:** odd-total check; boolean table up to total // 2; update downwards per number.
6. **Code and test:** a single number, an even total with no split, one dominant number.

</details>

<details>
<summary>💡 Hint 1</summary>

If the total is odd, it's impossible. If it's even, what single question decides the answer?

</details>

<details>
<summary>💡 Hint 2</summary>

"Is there a subset that adds up to exactly total / 2?" The other numbers then make up the other half. That's subset sum, a 0/1 knapsack.

</details>

<details>
<summary>💡 Hint 3</summary>

`can = [True] + [False] * target`. For each number x, loop s from `target` **down** to x and set `can[s] = True` if `can[s - x]`. Return `can[target]`.

</details>

### 2. 0/1 knapsack

Write `knapsack(weights, values, capacity)` returning the largest total value of items that fit in the bag, with each item taken at most once. It must handle 200 items and a capacity of 1,000 quickly.

Starter code:

```python
def knapsack(weights, values, capacity):
    pass

print(knapsack([1, 3, 4, 5], [1, 4, 5, 7], 7))   # 9: weights 3 + 4
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** each item at most once; total weight ≤ capacity; maximise value.
2. **Examples:** weights [1, 3, 4, 5], values [1, 4, 5, 7], capacity 7 → 9 (items of weight 3 and 4).
3. **Brute force:** all 2ⁿ subsets, or the take/skip recursion.
4. **Pattern:** **0/1 knapsack**, one row, capacities downwards.
5. **Plan:** `best` of size capacity + 1; process items one by one.
6. **Code and test:** nothing fits, zero capacity, two identical items.

</details>

<details>
<summary>💡 Hint 1</summary>

For each item there are two choices. What's the state that captures everything that matters about the choices made so far?

</details>

<details>
<summary>💡 Hint 2</summary>

Only the remaining capacity matters. Let `best[w]` be the most value achievable with capacity w using the items processed so far.

</details>

<details>
<summary>💡 Hint 3</summary>

For each item, loop w from `capacity` down to its weight: `best[w] = max(best[w], best[w - wt] + val)`. Return `best[capacity]`.

</details>

**In the sandbox:** exercises 91–92. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Partition into equal sums</summary>

```python
def can_partition(nums):
    total = sum(nums)
    if total % 2:
        return False                      # an odd total can't be split evenly
    target = total // 2
    can = [True] + [False] * target       # can[s]: some subset adds up to s
    for x in nums:
        for s in range(target, x - 1, -1):    # downwards, so each number is used once
            if can[s - x]:
                can[s] = True
    return can[target]

print(can_partition([1, 5, 11, 5]))
print(can_partition([1, 2, 3, 5]))
```

**Line by line**

- An odd total can't be split into two equal integers, so return False at once.
- `can[s]` records whether some subset of the numbers seen so far sums to s; the empty subset makes `can[0]` True.
- For each number x, a sum s becomes reachable if s − x was reachable **before** x was considered. Looping s downwards guarantees `can[s - x]` hasn't already been updated with x.
- The answer is whether half the total is reachable.

**Trace** on [1, 5, 11, 5] (target 11), listing the reachable sums:

| number | reachable sums ≤ 11 |
|---|---|
| start | 0 |
| 1 | 0, 1 |
| 5 | 0, 1, 5, 6 |
| 11 | 0, 1, 5, 6, **11** |
| 5 | 0, 1, 5, 6, 10, 11 |

**Complexity:** O(n × total) time, O(total) space; the bitset version runs the same idea on whole machine words.

**Common wrong approach:** looping s **upwards**, which lets one number be used several times: [2, 3] would wrongly reach 4 as 2 + 2.

</details>

<details>
<summary>✅ 2. 0/1 knapsack</summary>

```python
def knapsack(weights, values, capacity):
    best = [0] * (capacity + 1)                 # best[w]: most value within capacity w
    for wt, val in zip(weights, values):
        for w in range(capacity, wt - 1, -1):   # downwards: this item can't be counted twice
            if best[w - wt] + val > best[w]:
                best[w] = best[w - wt] + val    # take the item
    return best[capacity]

print(knapsack([1, 3, 4, 5], [1, 4, 5, 7], 7))
```

**Line by line**

- Before any items, every capacity has value 0.
- For an item (wt, val), the new best for capacity w is the old best (skip) or `best[w - wt] + val` (take), where `best[w - wt]` must be the value **without** this item.
- Looping w downwards means `best[w - wt]` (a smaller index) hasn't been updated for this item yet.
- After all items, `best[capacity]` is the answer.

**Trace** on the example (capacities 0 to 7):

| after item | best[0..7] |
|---|---|
| (1, 1) | 0 1 1 1 1 1 1 1 |
| (3, 4) | 0 1 1 4 5 5 5 5 |
| (4, 5) | 0 1 1 4 5 6 6 9 |
| (5, 7) | 0 1 1 4 5 7 8 **9** |

**Complexity:** O(n × capacity) time, O(capacity) space.

**Common wrong approach:** a greedy by value-per-weight. It's right for the **fractional** knapsack (Lesson 45) but not here: weights [10, 20, 30], values [60, 100, 120], capacity 50 → greedy takes 160, the best is 220.

</details>

## Quick quiz

1. In a one-row 0/1 knapsack, why must capacities be looped downwards?
   - A) So dp[w − weight] still holds the value from before this item, and the item is used at most once
   - B) To save memory
   - C) Because larger capacities are more important

2. Why is knapsack's O(n × W) called pseudo-polynomial?
   - A) W is a numeric value, so the time grows exponentially in the number of digits of W
   - B) Because it uses recursion
   - C) Because n is always small

3. In interval DP like matrix-chain order, which intervals are computed first?
   - A) The longest ones
   - B) The shortest ones
   - C) Those that start at 0

4. What does dp[mask][j] mean in the Held-Karp TSP algorithm?
   - A) The distance between cities mask and j
   - B) The shortest path that visits exactly the cities in mask and ends at city j
   - C) The number of tours through j

<details>
<summary>Quiz answers</summary>

1. **A) So dp[w − weight] still holds the value from before this item, and the item is used at most once**: Looping upwards allows reuse, which gives the unbounded knapsack.
2. **A) W is a numeric value, so the time grows exponentially in the number of digits of W**: Knapsack is NP-hard in general; the DP is fast only when W is moderate.
3. **B) The shortest ones**: Every split of a range needs both shorter sides to be done already.
4. **B) The shortest path that visits exactly the cities in mask and ends at city j**: Sets of visited cities are stored as the bits of mask.

</details>

---
Previous: [Lesson 43](43-dp-grids-strings.md) · Next: [Lesson 45: Greedy algorithms](45-greedy.md)
