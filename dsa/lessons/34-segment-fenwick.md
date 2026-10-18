# Lesson 34: Segment trees and Fenwick trees

**You'll learn:** range queries with updates, square-root decomposition, Fenwick trees and the lowest set bit, segment trees for sums, minimums and gcds, lazy propagation for range updates, sparse tables for static minimums, coordinate compression, counting smaller elements.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/dsa/#segment-fenwick)**: run every example and check your exercise answers.

## Key terms

- **Range query:** a question about a contiguous part of a list, such as its sum or minimum.
- **Point update:** changing a single item of the list.
- **Fenwick tree (binary indexed tree):** an array where position i stores the sum of a block ending at i, of length i & -i.
- **Lowest set bit:** the rightmost 1 bit of a number; `i & -i` in Python.
- **Segment tree:** a binary tree where each node stores the combined value of a range of the list.
- **Lazy propagation:** storing a pending range update at a node and passing it down only when needed.
- **Sparse table:** precomputed minimums of every power-of-two block, for O(1) static range-minimum queries.
- **Coordinate compression:** replacing values by their rank in sorted order, so they index a small array.

Prefix sums (Lesson 9) answer "sum of nums[l..r]" in O(1), but only while the data **doesn't change**: updating one item means rebuilding O(n) prefix sums. A plain list has the opposite problem: O(1) updates, O(n) sums. When there are **many updates and many queries**, both are too slow. Trees that store sums of **blocks** of the list give O(log n) for both.

| Approach | Update one item | Sum of a range | Notes |
|---|---|---|---|
| Plain list | O(1) | O(n) | |
| Prefix sums | O(n) | O(1) | best when nothing changes |
| Square-root decomposition | O(1) | O(√n) | blocks of √n items with stored sums |
| **Fenwick tree** (binary indexed tree) | O(log n) | O(log n) | short code; sums and other invertible operations |
| **Segment tree** | O(log n) | O(log n) | any combinable operation (min, max, gcd); range updates with lazy propagation |

## Fenwick tree (binary indexed tree)

A **Fenwick tree** is a list `tree[1..n]` (1-indexed) where `tree[i]` holds the sum of a block of items **ending at position i**, whose length is the **lowest set bit** of i: `i & -i`. Position 6 (binary 110) covers 2 items, 5 and 6; position 8 (1000) covers 8 items, 1 to 8; odd positions cover just themselves.

![Positions 1 to 8 of [5, 8, 6, 3, 2, 7, 2, 6] with a bar for each Fenwick cell showing the range it sums: tree[1] = 5 (item 1), tree[2] = 13 (items 1–2), tree[3] = 6, tree[4] = 22 (items 1–4), tree[5] = 2, tree[6] = 9 (items 5–6), tree[7] = 2, tree[8] = 39 (items 1–8). The prefix sum of the first 7 items is tree[7] + tree[6] + tree[4] = 2 + 9 + 22 = 33](../figures/fenwick.svg)

- **Prefix sum of the first i items:** add `tree[i]`, then jump to `i - (i & -i)` (drop the lowest bit) until i is 0. At most log₂ n jumps.
- **Update position i by delta:** add delta to `tree[i]`, then jump to `i + (i & -i)`, the next block that also contains position i.

`i & -i` works because in two's complement, `-i` flips every bit above the lowest 1, so the AND keeps only that bit:

| i | binary | i & -i | tree[i] covers |
|---|---|---|---|
| 6 | 110 | 2 (010) | items 5–6 |
| 7 | 111 | 1 (001) | item 7 |
| 8 | 1000 | 8 (1000) | items 1–8 |
| 12 | 1100 | 4 (0100) | items 9–12 |

```python
class Fenwick:
    def __init__(self, nums):
        self.n = len(nums)
        self.tree = [0] + list(nums)              # 1-indexed; position 0 is unused
        for i in range(1, self.n + 1):            # O(n) build: push each block's sum to its parent block
            j = i + (i & -i)
            if j <= self.n:
                self.tree[j] += self.tree[i]

    def add(self, i, delta):                      # i is a 0-based index into nums
        i += 1
        while i <= self.n:
            self.tree[i] += delta
            i += i & -i

    def prefix(self, i):                          # sum of the first i items
        total = 0
        while i > 0:
            total += self.tree[i]
            i -= i & -i
        return total

    def range_sum(self, l, r):                    # sum of nums[l..r], inclusive, 0-based
        return self.prefix(r + 1) - self.prefix(l)

nums = [5, 8, 6, 3, 2, 7, 2, 6]
f = Fenwick(nums)
print("tree:", f.tree[1:])
print("first 7:", f.prefix(7), "| nums[2..6]:", f.range_sum(2, 6))
f.add(3, 10)                                      # nums[3] goes from 3 to 13
print("after the update, nums[2..6]:", f.range_sum(2, 6))
```

To **set** an item to a new value, add the difference (new − old), keeping a copy of the values to know the old one.

## Segment tree

A **segment tree** is a binary tree over the list: each leaf is one item, and each internal node stores the combined value (sum, min, max…) of the range below it. A range query combines the few nodes that exactly cover the range, **at most about 2 per level**: O(log n).

![A segment tree for [5, 8, 6, 3, 2, 7, 2, 6]. The root holds 39 for range 0–7; its children hold 22 (0–3) and 17 (4–7); then 13, 9, 9, 8; then the eight leaves. For the query sum of indexes 2 to 6, the three highlighted nodes 9 (2–3), 9 (4–5) and 2 (6) add up to 20](../figures/segment-tree.svg)

The neatest way to code it stores the tree in a list of size 2n: the leaves at `t[n..2n-1]`, and each internal node `t[i]` combining `t[2i]` and `t[2i+1]`. Passing in the combining function makes one class work for sums, minimums, maximums or gcds:

```python
from math import gcd

class SegmentTree:
    def __init__(self, nums, combine, identity):
        self.n = n = len(nums)
        self.f, self.e = combine, identity       # identity: f(e, x) == x, e.g. 0 for sums, inf for min
        self.t = [identity] * n + list(nums)
        for i in range(n - 1, 0, -1):
            self.t[i] = combine(self.t[2 * i], self.t[2 * i + 1])

    def update(self, i, value):                   # set nums[i] = value
        i += self.n
        self.t[i] = value
        while i > 1:
            i //= 2
            self.t[i] = self.f(self.t[2 * i], self.t[2 * i + 1])

    def query(self, l, r):                        # combine nums[l..r], inclusive
        left = right = self.e
        l += self.n
        r += self.n + 1
        while l < r:
            if l & 1:                             # l is a right child: take it, step past it
                left = self.f(left, self.t[l])
                l += 1
            if r & 1:
                r -= 1
                right = self.f(self.t[r], right)
            l //= 2
            r //= 2
        return self.f(left, right)

nums = [5, 8, 6, 3, 2, 7, 2, 6]
sums = SegmentTree(nums, lambda a, b: a + b, 0)
mins = SegmentTree(nums, min, float("inf"))
gcds = SegmentTree([12, 18, 24, 9, 30], gcd, 0)
print(sums.query(2, 6), mins.query(0, 3), mins.query(4, 7), gcds.query(0, 2))
mins.update(5, 1)
print("min of 4..7 after setting index 5 to 1:", mins.query(4, 7))
```

Unlike the Fenwick tree, a segment tree doesn't need an inverse operation (there's no "un-min"), which is why it handles minimums and maximums.

## Lazy propagation: updating a whole range

"Add 5 to every item from l to r" would touch O(n) leaves. **Lazy propagation** stops at the O(log n) nodes that cover the range, updates their totals, and leaves a **pending** note for their children, which is passed down (pushed) only when a later operation needs to go below that node.

```python
class LazySegmentTree:
    def __init__(self, nums):
        self.n = len(nums)
        self.sum = [0] * (4 * self.n)
        self.pending = [0] * (4 * self.n)        # amount still to add to every item below this node
        self._build(1, 0, self.n - 1, nums)

    def _build(self, x, lo, hi, nums):
        if lo == hi:
            self.sum[x] = nums[lo]
            return
        mid = (lo + hi) // 2
        self._build(2 * x, lo, mid, nums)
        self._build(2 * x + 1, mid + 1, hi, nums)
        self.sum[x] = self.sum[2 * x] + self.sum[2 * x + 1]

    def _apply(self, x, lo, hi, v):              # add v to every item of this node's range
        self.sum[x] += v * (hi - lo + 1)
        self.pending[x] += v

    def _push(self, x, lo, hi):                  # hand the pending note down to the children
        if self.pending[x]:
            mid = (lo + hi) // 2
            self._apply(2 * x, lo, mid, self.pending[x])
            self._apply(2 * x + 1, mid + 1, hi, self.pending[x])
            self.pending[x] = 0

    def range_add(self, l, r, v, x=1, lo=0, hi=None):
        hi = self.n - 1 if hi is None else hi
        if r < lo or hi < l:
            return                               # no overlap
        if l <= lo and hi <= r:
            self._apply(x, lo, hi, v)            # fully covered: stop here, lazily
            return
        self._push(x, lo, hi)
        mid = (lo + hi) // 2
        self.range_add(l, r, v, 2 * x, lo, mid)
        self.range_add(l, r, v, 2 * x + 1, mid + 1, hi)
        self.sum[x] = self.sum[2 * x] + self.sum[2 * x + 1]

    def range_sum(self, l, r, x=1, lo=0, hi=None):
        hi = self.n - 1 if hi is None else hi
        if r < lo or hi < l:
            return 0
        if l <= lo and hi <= r:
            return self.sum[x]
        self._push(x, lo, hi)
        mid = (lo + hi) // 2
        return self.range_sum(l, r, 2 * x, lo, mid) + self.range_sum(l, r, 2 * x + 1, mid + 1, hi)

st = LazySegmentTree([5, 8, 6, 3, 2, 7, 2, 6])
print(st.range_sum(0, 7))
st.range_add(2, 5, 10)                           # add 10 to indexes 2, 3, 4, 5
print(st.range_sum(0, 7), st.range_sum(3, 3), st.range_sum(6, 7))
```

Both `range_add` and `range_sum` are O(log n). The 4n size is a safe upper bound on the number of nodes for any n.

## Sparse table: O(1) minimums on data that never changes

If the list is fixed and you need range **minimums** (or maximums), precompute the minimum of every block whose length is a power of two. Any range is covered by **two overlapping** such blocks, and overlap doesn't matter for min. O(n log n) to build, **O(1)** per query.

```python
def build_sparse(nums):
    table = [nums[:]]                                # table[j][i] = min of nums[i : i + 2**j]
    j = 1
    while (1 << j) <= len(nums):
        prev, half = table[-1], 1 << (j - 1)
        table.append([min(prev[i], prev[i + half]) for i in range(len(nums) - (1 << j) + 1)])
        j += 1
    return table

def range_min(table, l, r):
    j = (r - l + 1).bit_length() - 1                 # largest power of two that fits in the range
    return min(table[j][l], table[j][r - (1 << j) + 1])

table = build_sparse([5, 8, 6, 3, 2, 7, 2, 6])
print(range_min(table, 0, 2), range_min(table, 1, 4), range_min(table, 5, 7))
```

This trick doesn't work for sums, because overlapping blocks would count items twice.

## Choosing a range-query structure

| Situation | Use |
|---|---|
| Sums, data never changes | prefix sums: O(1) query |
| Min / max, data never changes | sparse table: O(1) query |
| Sums with single-item updates | Fenwick tree (short) or segment tree |
| Min / max / gcd with updates | segment tree |
| Updates to whole ranges | segment tree with lazy propagation (or a Fenwick tree over differences, for range-add / point-query) |
| Counting how many earlier values are smaller (inversions, rankings) | Fenwick tree over value ranks |

When values are huge or negative but there are only n of them, replace each value by its **rank** in sorted order first (**coordinate compression**), so the tree has n positions instead of one per possible value.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Fenwick: point add / prefix sum | climb with i += i & −i / descend with i −= i & −i | O(log n) each | O(n) |
| Fenwick: range sum | prefix(r + 1) − prefix(l) | O(log n) | O(n) |
| Segment tree (iterative, 2n list) | leaves at n..2n−1; combine pairs going up | O(log n) update and query | O(n) |
| Segment tree with lazy propagation | stop at covering nodes, store a pending update | O(log n) range update and query | O(n) |
| Sparse table (static min / max) | two overlapping power-of-two blocks | O(n log n) build, O(1) query | O(n log n) |
| Square-root decomposition | blocks of √n items with stored totals | O(1) update, O(√n) query | O(n) |
| Count smaller to the right / inversions | Fenwick tree over ranks, scanning right to left | O(n log n) | O(n) |

## Common mistakes

- Mixing 0-based list indexes with the Fenwick tree's 1-based positions.
- Treating "set nums[i] = val" as "add val" in a Fenwick tree (add the difference instead).
- Trying to answer range minimums with a Fenwick tree (minimum has no inverse).
- Sizing a recursive segment tree at 2n instead of 4n.

## Exercises

### 1. Range sums with updates

Complete `NumArray(nums)` with `update(i, val)` (set `nums[i] = val`) and `sum_range(l, r)` (the sum of `nums[l..r]`, inclusive). Both must be O(log n): 100,000 mixed operations on 100,000 numbers should take about a second at most.

Starter code:

```python
class NumArray:
    def __init__(self, nums):
        pass

    def update(self, i, val):
        pass

    def sum_range(self, l, r):
        pass

a = NumArray([1, 3, 5])
print(a.sum_range(0, 2))   # 9
a.update(1, 2)
print(a.sum_range(0, 2))   # 8
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** point **set** updates (not add), inclusive range sums, many of both.
2. **Examples:** [1, 3, 5]: sum(0, 2) = 9; set index 1 to 2; sum(0, 2) = 8.
3. **Brute force:** slice and sum per query (O(n)), or rebuild prefix sums per update (O(n)).
4. **Pattern:** **Fenwick tree** (or segment tree) for point updates and range sums.
5. **Plan:** build in O(n); update by the difference; a range is the difference of two prefix sums.
6. **Code and test:** one number, the same index updated twice, negative numbers.

</details>

<details>
<summary>💡 Hint 1</summary>

Summing a slice is O(n) per query; prefix sums make queries O(1) but updates O(n). You need something in between: O(log n) for both.

</details>

<details>
<summary>💡 Hint 2</summary>

A Fenwick tree stores sums of blocks whose lengths are powers of two. A prefix sum adds about log n blocks; an update changes about log n blocks. Remember an update **sets** a value, so add the difference `val - old`.

</details>

<details>
<summary>💡 Hint 3</summary>

Keep `self.nums` and a 1-indexed `self.tree`. Update: `i += 1`, then `while i <= n: tree[i] += delta; i += i & -i`. Prefix(i): `while i > 0: total += tree[i]; i -= i & -i`. `sum_range(l, r) = prefix(r + 1) - prefix(l)`.

</details>

### 2. Count smaller numbers to the right

Write `count_smaller(nums)` returning a list where item i is how many numbers **to the right** of `nums[i]` are strictly smaller than it. Aim for O(n log n): 50,000 numbers should take well under a second.

Starter code:

```python
def count_smaller(nums):
    pass

print(count_smaller([5, 2, 6, 1]))   # [2, 1, 1, 0]
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** strictly smaller, only to the right; duplicates and negatives allowed.
2. **Examples:** [5, 2, 6, 1] → [2, 1, 1, 0].
3. **Brute force:** for each i, scan everything to its right: O(n²).
4. **Pattern:** **Fenwick tree over ranks** (coordinate compression), scanning right to left. Merge sort with counting is the other O(n log n) way.
5. **Plan:** compress values to 1..m; for each item from the right, query the count of smaller ranks, then add the item.
6. **Code and test:** duplicates, decreasing order, a huge value, empty input.

</details>

<details>
<summary>💡 Hint 1</summary>

Go from right to left. When you reach nums[i], everything to its right has already been seen. What question do you need to ask about those seen values?

</details>

<details>
<summary>💡 Hint 2</summary>

"How many seen values are smaller than x?" is a prefix sum over counts indexed by value. A Fenwick tree gives that in O(log n), with an O(log n) update to record x. Values can be negative or huge, so index by **rank** instead.

</details>

<details>
<summary>💡 Hint 3</summary>

`rank = {v: i + 1 for i, v in enumerate(sorted(set(nums)))}`. Right to left: `result[i] = prefix(rank[x] - 1)`, then `add(rank[x], 1)`. (A merge sort that counts, like Lesson 22's inversions, also works.)

</details>

**In the sandbox:** exercises 71–72. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Range sums with updates</summary>

```python
class NumArray:
    def __init__(self, nums):
        self.n = len(nums)
        self.nums = list(nums)                    # current values, to work out update differences
        self.tree = [0] + list(nums)              # Fenwick tree, 1-indexed
        for i in range(1, self.n + 1):
            j = i + (i & -i)                      # the next block that contains position i
            if j <= self.n:
                self.tree[j] += self.tree[i]

    def update(self, i, val):
        delta = val - self.nums[i]
        self.nums[i] = val
        i += 1
        while i <= self.n:
            self.tree[i] += delta
            i += i & -i                           # move to the next block covering this position

    def _prefix(self, i):                         # sum of the first i numbers
        total = 0
        while i > 0:
            total += self.tree[i]
            i -= i & -i                           # drop the lowest set bit
        return total

    def sum_range(self, l, r):
        return self._prefix(r + 1) - self._prefix(l)

a = NumArray([1, 3, 5])
print(a.sum_range(0, 2))
a.update(1, 2)
print(a.sum_range(0, 2))
```

**Line by line**

- `self.tree = [0] + list(nums)` puts each number at its 1-based position; the build loop then adds each block's total into the next larger block that contains it, so the tree is ready in O(n).
- `update` converts "set" into "add `delta`", then climbs with `i += i & -i` through every block containing position i.
- `_prefix(i)` walks down with `i -= i & -i`, adding disjoint blocks that together cover positions 1..i.
- `sum_range(l, r)` is prefix(r + 1) − prefix(l), the same subtraction as with ordinary prefix sums.

**Trace** on [1, 3, 5]: the tree after building is [_, 1, 4, 5] (tree[2] = 1 + 3).

| operation | steps | result |
|---|---|---|
| sum_range(0, 2) | prefix(3) = tree[3] + tree[2] = 5 + 4 = 9; prefix(0) = 0 | 9 |
| update(1, 2) | delta = −1; i = 2: tree[2] = 3; i = 4 > 3, stop | — |
| sum_range(0, 2) | prefix(3) = tree[3] + tree[2] = 5 + 3 = 8 | 8 |

**Complexity:** O(n) to build, O(log n) per update and per query, O(n) space.

**Common wrong approach:** treating `update(i, val)` as "add val" instead of "set to val", or mixing 0-based and 1-based indexes, which silently skips `tree[0]` or loops forever at i = 0.

</details>

<details>
<summary>✅ 2. Count smaller numbers to the right</summary>

```python
def count_smaller(nums):
    rank = {v: i + 1 for i, v in enumerate(sorted(set(nums)))}   # coordinate compression: values -> 1..m
    m = len(rank)
    tree = [0] * (m + 1)                       # Fenwick tree of counts per rank
    result = [0] * len(nums)
    for i in range(len(nums) - 1, -1, -1):     # right to left: the tree holds everything to the right
        r = rank[nums[i]] - 1                  # count values with a smaller rank
        smaller = 0
        while r > 0:
            smaller += tree[r]
            r -= r & -r
        result[i] = smaller
        r = rank[nums[i]]                      # then record this value
        while r <= m:
            tree[r] += 1
            r += r & -r
    return result

print(count_smaller([5, 2, 6, 1]))
```

**Line by line**

- `sorted(set(nums))` lists the distinct values in order; each gets a rank from 1 to m, so the tree has at most n positions however big the values are.
- Scanning right to left, the tree contains exactly the numbers to the right of i.
- `prefix(rank - 1)` counts values with a smaller rank: strictly smaller values (equal values share a rank, so they're excluded).
- Adding 1 at `rank[x]` records x for the items further left.

**Trace** on [5, 2, 6, 1] (ranks: 1 → 1, 2 → 2, 5 → 3, 6 → 4):

| i | value (rank) | seen so far | smaller | result[i] |
|---|---|---|---|---|
| 3 | 1 (1) | — | count of ranks < 1 | 0 |
| 2 | 6 (4) | 1 | ranks < 4: {1} | 1 |
| 1 | 2 (2) | 1, 6 | ranks < 2: {1} | 1 |
| 0 | 5 (3) | 1, 6, 2 | ranks < 3: {1, 2} | 2 |

**Complexity:** O(n log n) time (sorting plus n Fenwick operations), O(n) space.

**Common wrong approach:** sizing the Fenwick tree by the largest value (10⁹ cells) instead of by rank, or counting `prefix(rank)`, which includes equal values.

</details>

## Quick quiz

1. What does `i & -i` give?
   - A) The lowest set bit of i, which is the length of the block tree[i] covers
   - B) i rounded down to a power of two
   - C) The highest set bit of i

2. Why can't a Fenwick tree easily answer range minimums?
   - A) Minimums need O(n) memory
   - B) Fenwick trees only store positive numbers
   - C) A range is found by subtracting two prefixes, and minimum has no "subtract"

3. What does lazy propagation make fast?
   - A) Sorting the array
   - B) Building the tree in O(1)
   - C) Updating every item in a range, in O(log n)

4. The data never changes and you need many range-minimum queries. What's fastest per query?
   - A) Scanning the range each time
   - B) A Fenwick tree
   - C) A sparse table: O(1) per query after O(n log n) preprocessing

<details>
<summary>Quiz answers</summary>

1. **A) The lowest set bit of i, which is the length of the block tree[i] covers**: For i = 12 (1100), i & -i = 4 (0100): tree[12] covers items 9–12.
2. **C) A range is found by subtracting two prefixes, and minimum has no "subtract"**: Segment trees combine covering nodes directly, so they handle min, max and gcd.
3. **C) Updating every item in a range, in O(log n)**: Fully covered nodes store a pending update instead of touching every leaf.
4. **C) A sparse table: O(1) per query after O(n log n) preprocessing**: Two overlapping power-of-two blocks cover any range; overlap doesn't affect a minimum.

</details>

---
Previous: [Lesson 33](33-tries.md) · Next: [Lesson 35: Graphs, BFS and DFS](35-graphs.md)
