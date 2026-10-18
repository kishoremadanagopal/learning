# Lesson 32: Heaps and priority queues

**You'll learn:** priority queues, the heap property, storing a complete tree in a list, sift up and sift down, heapify in O(n), heapq and its max-heap functions in Python 3.14, priorities and tie-breakers, top k, merging k sorted lists, the two-heap running median, lazy deletion.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/dsa/#heaps)**: run every example and check your exercise answers.

## Key terms

- **Priority queue:** a collection that always hands back the highest-priority item next.
- **Binary heap:** a complete binary tree where every parent is ≤ its children (min-heap) or ≥ them (max-heap).
- **Sift up / sift down:** swapping an item with its parent / smaller child until the heap property holds again.
- **Heapify:** turning a whole list into a heap in O(n), by sifting down from the last parent to the root.
- **heapq:** Python's module that treats an ordinary list as a min-heap.
- **Tie-breaker:** an extra value, such as a counter, that decides between equal priorities.
- **Top k:** finding the k largest or smallest items, typically with a heap of size k.
- **Lazy deletion:** marking items as removed and skipping them when they reach the top.

A **priority queue** hands back the **most important** item first (the smallest number, the earliest deadline, the shortest distance) rather than the oldest. The standard way to build one is a **binary heap**: a complete binary tree where every parent is ≤ its children (a **min-heap**) or ≥ its children (a **max-heap**). The smallest item is always at the root.

A heap is **not** sorted: siblings can be in any order. It only promises enough order to find and remove the minimum quickly.

## A tree stored in a list

Because a heap is a **complete** tree (every level full except the last, filled from the left), it fits in a plain list with no pointers. For the item at index i:

| Relative | Index |
|---|---|
| left child | 2i + 1 |
| right child | 2i + 2 |
| parent | (i − 1) // 2 |

![A min-heap drawn as a tree (1 at the root; 3 and 2 below; then 7, 4, 5, 8) and the same heap as a list [1, 3, 2, 7, 4, 5, 8] with indexes 0 to 6. Arrows show that index 1 (value 3) has children at indexes 3 and 4](../figures/heap-array.svg)

## Push and pop: sift up and sift down

- **Push:** append the new item at the end, then **sift up**: swap it with its parent while it's smaller. O(log n), the height of the tree.
- **Pop:** the minimum is at index 0. Move the **last** item to the root, then **sift down**: swap it with its smaller child while it's bigger than that child. O(log n).
- **Peek:** `heap[0]`, O(1).

```python
class MinHeap:
    def __init__(self):
        self.a = []

    def push(self, x):
        a = self.a
        a.append(x)
        i = len(a) - 1
        while i > 0 and a[i] < a[(i - 1) // 2]:       # smaller than its parent: swap upwards
            parent = (i - 1) // 2
            a[i], a[parent] = a[parent], a[i]
            i = parent

    def pop(self):
        a = self.a
        top = a[0]
        last = a.pop()
        if a:
            a[0] = last                               # fill the hole at the root with the last item
            i, n = 0, len(a)
            while True:
                smallest = i
                for child in (2 * i + 1, 2 * i + 2):
                    if child < n and a[child] < a[smallest]:
                        smallest = child
                if smallest == i:
                    break                             # both children are bigger: done
                a[i], a[smallest] = a[smallest], a[i]
                i = smallest
        return top

h = MinHeap()
for x in [5, 3, 8, 1, 9, 2]:
    h.push(x)
print("as a list:", h.a)
print("popped in order:", [h.pop() for _ in range(6)])
```

Popping every item gives them in sorted order: that's **heap sort**, O(n log n).

## Heapify in O(n)

Pushing n items one by one costs O(n log n). **Heapify** does better: sift down every non-leaf node, starting from the last one and moving back to the root. Most nodes are near the bottom, where sifting is short (half the nodes are leaves and don't move at all), and the total work adds up to **O(n)**. `heapq.heapify(list)` does this in place.

## Python's heapq

`heapq` turns an ordinary list into a **min-heap**; the list *is* the heap.

| Call | What it does | Cost |
|---|---|---|
| `heapq.heapify(a)` | rearrange list `a` into a heap, in place | O(n) |
| `heapq.heappush(a, x)` | add x | O(log n) |
| `heapq.heappop(a)` | remove and return the smallest | O(log n) |
| `a[0]` | look at the smallest without removing it | O(1) |
| `heapq.heappushpop(a, x)` | push x, then pop the smallest (faster than both) | O(log n) |
| `heapq.heapreplace(a, x)` | pop the smallest, then push x | O(log n) |
| `heapq.nsmallest(k, it)` / `nlargest(k, it)` | the k smallest / largest items | O(n log k) |
| `heapq.merge(*sorted_iterables)` | lazily merge already-sorted inputs | O(n log k) |

```python
import heapq

tasks = [5, 1, 8, 3, 2]
heapq.heapify(tasks)
print(tasks, "smallest:", tasks[0])
heapq.heappush(tasks, 0)
print([heapq.heappop(tasks) for _ in range(3)], "left:", sorted(tasks))

# Priorities with tuples: compared by the first item, then the second...
jobs = []
heapq.heappush(jobs, (2, "write report"))
heapq.heappush(jobs, (1, "fix the outage"))
heapq.heappush(jobs, (3, "lunch"))
print(heapq.heappop(jobs))

# Max-heap: push negated keys
scores = [40, 95, 70]
neg = [-s for s in scores]
heapq.heapify(neg)
print("largest:", -heapq.heappop(neg))
```

**Ties and objects:** with `(priority, item)` tuples, two equal priorities make Python compare the items, which fails for things like dicts (`TypeError: '<' not supported`). Add a counter as a tie-breaker, `(priority, count, item)`; it also keeps equal priorities in first-in, first-out order.

```python
import heapq
from itertools import count

order = count()
heap = []
for priority, job in [(2, {"name": "b"}), (1, {"name": "a"}), (2, {"name": "c"})]:
    heapq.heappush(heap, (priority, next(order), job))   # the counter breaks ties before the dicts are compared
print([heapq.heappop(heap)[2]["name"] for _ in range(3)])
```

**New in Python 3.14:** `heapq` now has max-heap versions of its functions, so you don't have to negate numbers (handy for items that can't be negated, like strings):

```python
import heapq                                    # Python 3.14 or newer

a = [3, 9, 4]
heapq.heapify_max(a)
heapq.heappush_max(a, 7)
print(heapq.heappop_max(a))                     # 9
# also: heapq.heapreplace_max, heapq.heappushpop_max
```

Most coding-interview platforms still run older versions, so know the negation trick too.

## Top k: keep a heap of size k

To find the k **largest** of n items, keep a **min-heap of the k best so far**. Its root is the weakest of them; each new item that beats the root replaces it. That's O(n log k) time and O(k) memory, and it works on a stream too big to store. Sorting everything is O(n log n).

```python
import heapq

def k_largest(nums, k):
    heap = []
    for x in nums:
        if len(heap) < k:
            heapq.heappush(heap, x)
        elif x > heap[0]:                 # beats the weakest of the current top k
            heapq.heapreplace(heap, x)
    return sorted(heap, reverse=True)

nums = [7, 2, 9, 4, 11, 3, 8, 6]
print(k_largest(nums, 3), heapq.nlargest(3, nums))
print("3rd largest:", k_largest(nums, 3)[-1])
```

The same idea finds the k closest points, the k most frequent words (count with `Counter`, then a heap on the counts) or the k-th largest item (the root of the size-k heap).

## Merging k sorted lists

Put the **first** item of each list in a heap. Pop the smallest, output it, and push the next item from the same list. With N items in total across k lists: O(N log k).

```python
import heapq

def merge_k(lists):
    heap = [(lst[0], i, 0) for i, lst in enumerate(lists) if lst]   # (value, which list, position)
    heapq.heapify(heap)
    out = []
    while heap:
        value, i, j = heapq.heappop(heap)
        out.append(value)
        if j + 1 < len(lists[i]):
            heapq.heappush(heap, (lists[i][j + 1], i, j + 1))
    return out

lists = [[1, 4, 9], [2, 3, 10], [5, 6], []]
print(merge_k(lists))
print(list(heapq.merge(*lists)))          # the built-in does the same, lazily
```

## Running median with two heaps

To get the median of a growing stream, split the numbers into a **max-heap of the smaller half** and a **min-heap of the larger half**, keeping their sizes equal or the lower half one bigger. The median is then at the top of one or both heaps: O(log n) per number, O(1) per median.

![Two heaps side by side. The lower half [1, 2, 3] is a max-heap with 3 on top; the upper half [5, 8, 9] is a min-heap with 5 on top. The median is (3 + 5) / 2 = 4](../figures/two-heaps.svg)

The full code is the next exercise.

## Where heaps show up

| Problem | Heap holds | Cost |
|---|---|---|
| k largest / smallest, k closest | the k best so far | O(n log k) |
| Merge k sorted lists | the next item of each list | O(N log k) |
| Running median | two halves | O(log n) per item |
| Dijkstra's shortest paths (Part 8) | (distance, node) | O((V + E) log V) |
| Task scheduling, event simulation | (time, event) | O(log n) per event |
| Huffman coding (Part 9) | (frequency, subtree) | O(n log n) |

Heaps can't search for or remove an arbitrary item quickly (O(n)). When you need to, a common trick is **lazy deletion**: mark the item as removed and skip it when it reaches the top.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Push / pop | append + sift up / move last to root + sift down | O(log n) | O(1) |
| Peek at the minimum | heap[0] | O(1) | O(1) |
| Heapify a list | sift down from the last parent to the root | O(n) | O(1) |
| Heap sort | heapify, then pop n times | O(n log n) | O(1) in place |
| K largest / k closest | min-heap (or negated max-heap) of size k | O(n log k) | O(k) |
| K-th largest | root of a size-k min-heap | O(n log k) | O(k) |
| Merge k sorted lists | heap of (value, list, index) | O(N log k) | O(k) |
| Running median | max-heap of the lower half + min-heap of the upper half | O(log n) add, O(1) median | O(n) |

## Common mistakes

- Expecting a heap list to be sorted; only `heap[0]` is guaranteed to be the minimum.
- Forgetting that heapq is a min-heap (negate keys, or use the 3.14 `_max` functions, for a max-heap).
- Pushing `(priority, item)` where equal priorities make Python compare uncomparable items.
- Using a max-heap of all n items for "k largest" instead of a min-heap of size k.

## Exercises

### 1. K closest points to the origin

Write `k_closest(points, k)` returning the `k` points (lists `[x, y]`) closest to `(0, 0)`, in any order. Distance is the usual straight-line distance; you can compare squared distances `x*x + y*y` and skip the square root.

Starter code:

```python
import heapq

def k_closest(points, k):
    pass

print(k_closest([[1, 3], [-2, 2]], 1))           # [[-2, 2]]
print(k_closest([[3, 3], [5, -1], [-2, 4]], 2))  # [[3, 3], [-2, 4]] in any order
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** any order; squared distances compare the same way as real distances.
2. **Examples:** [[1, 3], [-2, 2]], k = 1 → [[-2, 2]] (8 < 10).
3. **Brute force:** sort by distance and take the first k: O(n log n), perfectly fine for small inputs. `heapq.nsmallest(k, points, key=...)` is a one-line version.
4. **Pattern:** **top k with a heap of size k**; we want the smallest distances, so the heap keeps the largest of them on top (a max-heap via negation).
5. **Plan:** loop, push or replace, return the heap's points.
6. **Code and test:** k = n, a point at the origin, negative coordinates.

</details>

<details>
<summary>💡 Hint 1</summary>

Sorting all points by distance works in O(n log n). Can you keep just k points as you go?

</details>

<details>
<summary>💡 Hint 2</summary>

Keep the k closest points seen so far in a heap whose **top is the farthest** of them, so you can kick it out when a closer point arrives. heapq is a min-heap, so store the **negated** squared distance.

</details>

<details>
<summary>💡 Hint 3</summary>

For each point: push `(-d, x, y)` while the heap has fewer than k items; otherwise, if `-d > heap[0][0]` (it's closer than the farthest kept), `heapreplace`. Finally return the points in the heap.

</details>

### 2. Running median

Complete `MedianFinder` with `add(num)` and `median()`, which returns the median of all numbers added so far: the middle value, or the average of the two middle values when the count is even. Both must be fast: 100,000 adds, each followed by a `median()` call, should take well under a second.

Starter code:

```python
import heapq

class MedianFinder:
    def __init__(self):
        pass

    def add(self, num):
        pass

    def median(self):
        pass

m = MedianFinder()
for x in [5, 15, 1, 3]:
    m.add(x)
    print(m.median())      # 5, 10.0, 5, 4.0
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** median after every add; even counts average the two middle values; many calls, so each must be fast.
2. **Examples:** add 5 → 5; add 15 → 10.0; add 1 → 5; add 3 → 4.0.
3. **Brute force:** sort on every `median()` call: O(n log n) each. Keeping a sorted list with `bisect.insort` is better (O(n) per add, but a fast memory move).
4. **Pattern:** **two heaps** that split the data at the median.
5. **Plan:** every number passes through low into high, then sizes are rebalanced; median from the tops.
6. **Code and test:** one number, equal numbers, increasing and decreasing streams.

</details>

<details>
<summary>💡 Hint 1</summary>

The median only depends on the one or two numbers in the middle. What if the smaller half and the larger half were kept separately?

</details>

<details>
<summary>💡 Hint 2</summary>

Keep the smaller half in a **max-heap** (its top is the biggest of the small numbers) and the larger half in a **min-heap** (its top is the smallest of the big numbers). Keep their sizes equal, or the smaller half one bigger.

</details>

<details>
<summary>💡 Hint 3</summary>

To add: push onto the low heap (negated), move low's top to high, and if high is now bigger than low, move high's top back. The median is low's top (odd count) or the average of both tops (even count).

</details>

**In the sandbox:** exercises 67–68. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. K closest points to the origin</summary>

```python
import heapq

def k_closest(points, k):
    heap = []                                    # max-heap (by negated distance) of the k closest so far
    for x, y in points:
        d = x * x + y * y
        if len(heap) < k:
            heapq.heappush(heap, (-d, x, y))
        elif -d > heap[0][0]:                    # closer than the farthest point kept
            heapq.heapreplace(heap, (-d, x, y))
    return [[x, y] for _, x, y in heap]

print(k_closest([[1, 3], [-2, 2]], 1))
print(k_closest([[3, 3], [5, -1], [-2, 4]], 2))
```

**Line by line**

- `d = x*x + y*y` avoids `sqrt`, which is slower and would introduce floats.
- The heap stores `(-d, x, y)`: the most negative first item, the farthest kept point, sits at `heap[0]`.
- `-d > heap[0][0]` means `d < (farthest kept distance)`, so the new point deserves a place; `heapreplace` pops the farthest and pushes the new one in one O(log k) step.
- At the end the heap holds exactly the k closest points.

**Trace** on [[3, 3], [5, -1], [-2, 4]], k = 2:

| point | d | heap (as −d, x, y) | action |
|---|---|---|---|
| [3, 3] | 18 | (−18, 3, 3) | push |
| [5, −1] | 26 | (−26, 5, −1), (−18, 3, 3) | push |
| [−2, 4] | 20 | (−20, −2, 4), (−18, 3, 3) | −20 > −26: replace the farthest |

**Complexity:** O(n log k) time, O(k) space.

**Common wrong approach:** using a min-heap of distances and stopping after k pushes: that keeps the first k points, not the closest.

</details>

<details>
<summary>✅ 2. Running median</summary>

```python
import heapq

class MedianFinder:
    def __init__(self):
        self.low = []     # max-heap of the smaller half (numbers stored negated)
        self.high = []    # min-heap of the larger half

    def add(self, num):
        heapq.heappush(self.low, -num)
        heapq.heappush(self.high, -heapq.heappop(self.low))   # move low's largest across: halves stay ordered
        if len(self.high) > len(self.low):                    # rebalance: low may be bigger by one, never smaller
            heapq.heappush(self.low, -heapq.heappop(self.high))

    def median(self):
        if len(self.low) > len(self.high):
            return -self.low[0]
        return (-self.low[0] + self.high[0]) / 2

m = MedianFinder()
for x in [5, 15, 1, 3]:
    m.add(x)
    print(m.median())
```

**Line by line**

- `low` stores negated numbers, so `-self.low[0]` is the largest of the smaller half.
- Pushing into `low` and then moving low's top into `high` guarantees every number in `low` is ≤ every number in `high`, wherever the new number belongs.
- The size fix keeps `len(low)` equal to `len(high)` or one more, so with an odd count the median is the top of `low`.
- With an even count the median is the average of the two tops.

**Trace** adding 5, 15, 1, 3:

| add | low (real values) | high | median |
|---|---|---|---|
| 5 | [5] | [] | 5 |
| 15 | [5] | [15] | (5 + 15) / 2 = 10.0 |
| 1 | [1, 5] | [15] | 5 |
| 3 | [1, 3] | [5, 15] | (3 + 5) / 2 = 4.0 |

**Complexity:** O(log n) per `add`, O(1) per `median`, O(n) space.

**Common wrong approach:** pushing into whichever heap is smaller without moving numbers across, so a big number can end up in the low half and the tops no longer surround the middle.

</details>

## Quick quiz

1. In a list-based heap, where are the children of the item at index i?
   - A) i + 1 and i + 2
   - B) 2i and 2i − 1
   - C) 2i + 1 and 2i + 2

2. How long does heapq.heapify take on a list of n items?
   - A) O(n log n)
   - B) O(log n)
   - C) O(n)

3. To find the k largest of n numbers with a heap, which heap do you keep?
   - A) A max-heap of all n numbers
   - B) A min-heap of all n numbers
   - C) A min-heap of size k, whose root is the weakest of the current top k

4. Why add a counter to (priority, item) tuples in heapq?
   - A) So equal priorities don't fall back to comparing the items, which may not be comparable
   - B) To make the heap a max-heap
   - C) heapq requires exactly three values

<details>
<summary>Quiz answers</summary>

1. **C) 2i + 1 and 2i + 2**: And the parent is at (i − 1) // 2.
2. **C) O(n)**: Sifting down from the bottom up costs O(n) in total, because most nodes are near the leaves.
3. **C) A min-heap of size k, whose root is the weakest of the current top k**: Each new number only needs to beat the root. O(n log k) time, O(k) memory.
4. **A) So equal priorities don't fall back to comparing the items, which may not be comparable**: (priority, count, item) never reaches the item in a comparison, and keeps ties in insertion order.

</details>

---
Previous: [Lesson 31](31-bst.md) · Next: [Lesson 33: Tries (prefix trees)](33-tries.md)
