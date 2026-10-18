# Lesson 27: Efficient sorts: merge, quick and heap sort, quickselect

**You'll learn:** merge sort's trade-offs, quicksort with Lomuto partition and random pivots, the quicksort worst case, heap sort, introsort, quickselect, choosing an O(n log n) sort.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/dsa/#efficient-sorts)**: run every example and check your exercise answers.

## Key terms

- **Quicksort:** partition around a pivot, then sort each side recursively.
- **Pivot:** the item a partition splits around.
- **Lomuto partition:** a partition scheme that sweeps left to right, swapping smaller items to the front.
- **Randomised pivot:** choosing the pivot at random so no input is reliably bad.
- **Heap sort:** builds a max-heap in the array, then repeatedly moves the maximum to the end.
- **Introsort:** quicksort that switches to heap sort when recursion gets too deep.
- **Quickselect:** partition, then continue into only the side containing position k, to find the k-th smallest.
- **External sorting:** sorting data too big for memory by sorting chunks and merging them.

The simple sorts compare each item with many others: O(n²). The efficient sorts use divide and conquer, or a heap, to get down to **O(n log n)**: for a million items that's about 20 million steps instead of a trillion.

## Merge sort (recap)

You wrote it in Lesson 22: split in halves, sort each recursively, merge. Its strengths and weaknesses:

- **Always O(n log n)**, whatever the input.
- **Stable**, which is why Python's `sorted()` (Timsort) is built from merges.
- Needs **O(n) extra memory** for merging.
- Works well on data that doesn't fit in memory (**external sorting**: sort chunks, then merge the sorted chunk files), and on linked lists, where merging needs no extra array.

## Quicksort

Pick a **pivot**, **partition** the list so smaller items are on its left and bigger ones on its right (the pivot is then in its final place), and sort the two sides recursively. No merge step is needed.

![Partitioning [7, 2, 1, 8, 6, 3, 5, 4] around the pivot 4 (Lomuto scheme). The pointer i marks the end of the "smaller than the pivot" region; j scans left to right, swapping smaller items into that region. Finally the pivot swaps into position 3, with 2, 1, 3 on its left and 8, 6, 7, 5 on its right](../figures/quick-partition.svg)

```python
import random

def quicksort(nums, lo=0, hi=None):
    if hi is None:
        hi = len(nums) - 1
    if lo >= hi:
        return nums
    p = random.randint(lo, hi)                 # a random pivot avoids the worst case on sorted input
    nums[p], nums[hi] = nums[hi], nums[p]
    pivot, i = nums[hi], lo
    for j in range(lo, hi):                    # Lomuto partition
        if nums[j] < pivot:
            nums[i], nums[j] = nums[j], nums[i]
            i += 1
    nums[i], nums[hi] = nums[hi], nums[i]      # the pivot lands in its final position i
    quicksort(nums, lo, i - 1)
    quicksort(nums, i + 1, hi)
    return nums

random.seed(0)
print(quicksort([7, 2, 1, 8, 6, 3, 5, 4]))
```

- **Average O(n log n)**, and in practice often the fastest comparison sort: it works in place and moves through memory in order, which CPUs like.
- **Worst case O(n²)**: if the pivot is always the smallest or largest item (for example, always taking the first item of an already sorted list), each partition removes just one item. A **random pivot** (or "median of three") makes that astronomically unlikely.
- **In place**: O(log n) extra space for the recursion on average.
- **Not stable**.
- Many equal keys? A three-way partition (the Dutch flag from last lesson) groups all items equal to the pivot in one pass, so lists full of duplicates stay fast.

## Heap sort

Build a **max-heap** (Lesson 32) inside the list, then repeatedly swap the largest item to the end and restore the heap on the rest.

```python
def heap_sort(nums):
    n = len(nums)

    def sift_down(start, end):            # push nums[start] down until both children are smaller
        root = start
        while 2 * root + 1 < end:
            child = 2 * root + 1
            if child + 1 < end and nums[child + 1] > nums[child]:
                child += 1                # the bigger child
            if nums[root] >= nums[child]:
                return
            nums[root], nums[child] = nums[child], nums[root]
            root = child

    for start in range(n // 2 - 1, -1, -1):   # build the max-heap: O(n)
        sift_down(start, n)
    for end in range(n - 1, 0, -1):           # move the max to the end, shrink the heap
        nums[0], nums[end] = nums[end], nums[0]
        sift_down(0, end)
    return nums

print(heap_sort([12, 11, 13, 5, 6, 7]))
```

**Guaranteed O(n log n)** and **in place** (O(1) extra space), but not stable and usually slower than quicksort in practice because it jumps around memory. Introsort (C++'s `std::sort`) starts with quicksort and switches to heap sort if the recursion gets suspiciously deep, getting quicksort's speed with heap sort's guarantee.

## Quickselect: the k-th smallest without sorting

To find the median or the k-th smallest item you don't need everything sorted. Partition once: if the pivot lands at position k, done; otherwise recurse into **only the side** that contains position k. On average the sizes go n + n/2 + n/4 + … = 2n: **O(n)** average (O(n²) worst case, made unlikely by a random pivot).

```python
import random

def kth_smallest(nums, k):                 # k is 1-based: k = 1 is the minimum
    nums = list(nums)
    target = k - 1
    lo, hi = 0, len(nums) - 1
    while True:
        p = random.randint(lo, hi)
        nums[p], nums[hi] = nums[hi], nums[p]
        pivot, i = nums[hi], lo
        for j in range(lo, hi):
            if nums[j] < pivot:
                nums[i], nums[j] = nums[j], nums[i]
                i += 1
        nums[i], nums[hi] = nums[hi], nums[i]
        if i == target:
            return nums[i]
        if i < target:
            lo = i + 1                     # the answer is on the right
        else:
            hi = i - 1                     # the answer is on the left

random.seed(2)
print(kth_smallest([7, 10, 4, 3, 20, 15], 3), kth_smallest([7, 10, 4, 3, 20, 15], 1))
```

`heapq.nsmallest(k, nums)` and `heapq.nlargest(k, nums)` give the k smallest or largest in O(n log k), often the simplest choice (Lesson 32).

## Choosing an O(n log n) sort

| | Merge sort | Quicksort | Heap sort |
|---|---|---|---|
| Average | O(n log n) | O(n log n) | O(n log n) |
| Worst | O(n log n) | O(n²) (rare with a random pivot) | O(n log n) |
| Extra space | O(n) | O(log n) | O(1) |
| Stable | yes | no | no |
| In practice | linked lists, external sorting, Timsort | fastest general in-memory sort | guaranteed bound, little memory |

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Merge sort | split, sort halves, merge | O(n log n) always | O(n) |
| Quicksort | random pivot, partition, recurse both sides | O(n log n) average, O(n²) worst | O(log n) |
| Heap sort | build a max-heap, swap the max to the end, sift down | O(n log n) always | O(1) |
| Quickselect (k-th smallest) | partition, keep only the side holding k | O(n) average, O(n²) worst | O(1) |
| 3-way quicksort (many duplicates) | Dutch-flag partition around the pivot | O(n log n), O(n) if all equal | O(log n) |

## Common mistakes

- Always using the first or last item as the pivot, which is O(n²) on sorted input.
- Recursing into both sides in quickselect (that's just quicksort).
- Forgetting that quicksort and heap sort aren't stable.
- Deep recursion in Python: recurse on the smaller side and loop on the larger one.

## Exercises

### 1. Quicksort

Write `quick_sort(nums)` that sorts the list **in place** with quicksort (partition around a pivot, recurse on both sides) and returns it. Don't use `sorted()`, `.sort()` or `heapq`. It must handle 50,000 numbers that are **already sorted**, where a "first item" pivot breaks down.

Starter code:

```python
import random

def quick_sort(nums):
    pass

print(quick_sort([7, 2, 1, 8, 6, 3, 5, 4]))
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** in place; return the list; must survive sorted input of 50,000 items.
2. **Examples:** [7, 2, 1, 8, 6, 3, 5, 4] → [1..8]; [5, 5, 5, 5] stays.
3. **Brute force:** a simple O(n²) sort is far too slow for 50,000 items.
4. **Pattern:** **divide and conquer by partitioning**, with a **random pivot**.
5. **Plan:** helper sort(lo, hi); random pivot to hi; Lomuto partition; recurse on both sides.
6. **Code and test:** empty, duplicates, already sorted, reversed.

</details>

<details>
<summary>💡 Hint 1</summary>

Partition: choose a pivot, move smaller items to its left and bigger ones to its right. Then the two sides are independent, smaller problems.

</details>

<details>
<summary>💡 Hint 2</summary>

Lomuto partition: put the pivot at `hi`; keep `i` as the next slot for a smaller item; for each j in `lo..hi-1`, if `nums[j] < pivot`, swap it to `i` and move `i`. Finally swap the pivot into `i`.

</details>

<details>
<summary>💡 Hint 3</summary>

Use `random.randint(lo, hi)` for the pivot and swap it to `hi` first. To keep recursion shallow, recurse on the smaller side and loop on the bigger one.

</details>

### 2. K-th smallest with quickselect

Write `kth_smallest(nums, k)` returning the k-th smallest number (k = 1 is the minimum) using **quickselect**: partition, then continue on one side only. Don't sort (no `sorted`, `.sort` or `heapq`). Must handle 300,000 numbers.

Starter code:

```python
import random

def kth_smallest(nums, k):
    pass

print(kth_smallest([7, 10, 4, 3, 20, 15], 3))   # 7
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** 1-based k; duplicates allowed; O(n) average required for 300,000 numbers.
2. **Examples:** [7, 10, 4, 3, 20, 15], k = 3 → 7 (sorted: 3, 4, 7, 10, 15, 20).
3. **Brute force:** sort and index: O(n log n) (fine in real life, but banned here); removing the minimum k times: O(n·k).
4. **Pattern:** **quickselect**: quicksort's partition, but recurse into one side only.
5. **Plan:** loop: random pivot, partition, compare its position with k − 1, shrink to one side.
6. **Code and test:** k = 1, k = n, duplicates.

</details>

<details>
<summary>💡 Hint 1</summary>

After one partition, the pivot sits at its final sorted position i. Compare i with k − 1: what does that tell you?

</details>

<details>
<summary>💡 Hint 2</summary>

If i == k − 1, the pivot is the answer. If i < k − 1, the answer is to the right; otherwise to the left. You never need the other side.

</details>

<details>
<summary>💡 Hint 3</summary>

Loop with `lo` and `hi`: random pivot to `hi`, Lomuto partition, then return `nums[i]` or move `lo = i + 1` / `hi = i - 1`. Copy the list first if you don't want to change the caller's list.

</details>

**In the sandbox:** exercises 57–58. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Quicksort</summary>

```python
import random

def quick_sort(nums):
    def sort(lo, hi):
        while lo < hi:
            p = random.randint(lo, hi)              # random pivot, moved to the end
            nums[p], nums[hi] = nums[hi], nums[p]
            pivot, i = nums[hi], lo
            for j in range(lo, hi):
                if nums[j] < pivot:
                    nums[i], nums[j] = nums[j], nums[i]
                    i += 1
            nums[i], nums[hi] = nums[hi], nums[i]   # pivot in its final place
            if i - lo < hi - i:                     # recurse on the smaller side,
                sort(lo, i - 1)                     # loop on the bigger one: depth O(log n)
                lo = i + 1
            else:
                sort(i + 1, hi)
                hi = i - 1

    sort(0, len(nums) - 1)
    return nums

print(quick_sort([7, 2, 1, 8, 6, 3, 5, 4]))
```

**Line by line**

- A random pivot makes the "always the smallest" split astronomically unlikely, whatever order the input is in.
- After the partition loop, `nums[lo:i]` are smaller than the pivot and `nums[i:hi]` are not; swapping the pivot into `i` puts it exactly where it belongs in the sorted list. It never moves again.
- Recursing on the smaller side and looping on the bigger one (a manual tail-call) keeps the recursion depth O(log n), so Python's recursion limit is never a problem, even with unlucky pivots.

**Trace** of one partition on [7, 2, 1, 8, 6, 3, 5, 4] with pivot 4 at the end:

| j | nums[j] | < 4? | i after | list |
|---|---|---|---|---|
| 0 | 7 | no | 0 | |
| 1 | 2 | yes, swap with 7 | 1 | [2, 7, 1, …] |
| 2 | 1 | yes, swap with 7 | 2 | [2, 1, 7, …] |
| 3–4 | 8, 6 | no | 2 | |
| 5 | 3 | yes, swap with 7 | 3 | [2, 1, 3, 8, 6, 7, 5, 4] |
| 6 | 5 | no | 3 | |
| end | | pivot ↔ position 3 | | [2, 1, 3, **4**, 6, 7, 5, 8] |

**Complexity:** O(n log n) average time, O(n²) worst case (very unlikely with random pivots); O(log n) stack space.

**Common wrong approach:** always taking the first or last item as the pivot. On sorted input every partition is lopsided, so it's O(n²) and the recursion goes n levels deep (a RecursionError in Python).

</details>

<details>
<summary>✅ 2. K-th smallest with quickselect</summary>

```python
import random

def kth_smallest(nums, k):
    nums = list(nums)                       # work on a copy
    target = k - 1                          # 0-based position we want
    lo, hi = 0, len(nums) - 1
    while True:
        p = random.randint(lo, hi)
        nums[p], nums[hi] = nums[hi], nums[p]
        pivot, i = nums[hi], lo
        for j in range(lo, hi):
            if nums[j] < pivot:
                nums[i], nums[j] = nums[j], nums[i]
                i += 1
        nums[i], nums[hi] = nums[hi], nums[i]
        if i == target:
            return nums[i]
        if i < target:
            lo = i + 1                      # only the right side can contain it
        else:
            hi = i - 1                      # only the left side can contain it

print(kth_smallest([7, 10, 4, 3, 20, 15], 3))
```

**Line by line**

- The partition is identical to quicksort's: the pivot ends at index `i`, with smaller items before it.
- So the pivot is the (i + 1)-th smallest. If that's what we want, we're done.
- Otherwise, only one side can contain the answer, and the other side is dropped entirely. That's the difference from quicksort, which recurses into both sides.
- On average each round keeps about half, so the work is n + n/2 + n/4 + … ≈ 2n: O(n).
- Duplicates are fine: items equal to the pivot go to the right side, and the position checks still hold.

**Trace** for [7, 10, 4, 3, 20, 15], k = 3 (target index 2), supposing the pivot chosen is 10:

| step | partition result | pivot index | action |
|---|---|---|---|
| 1 | [7, 4, 3, **10**, 20, 15] | 3 | 3 > 2 → keep the left side 0..2 |
| 2 | pivot 4: [3, **4**, 7] | 1 | 1 < 2 → keep the right side 2..2 |
| 3 | pivot 7 | 2 | found: 7 |

**Complexity:** O(n) average, O(n²) worst case (unlikely with a random pivot), O(1) extra space besides the copy.

**Common wrong approach:** recursing into both sides, which turns it back into a full O(n log n) quicksort.

</details>

## Quick quiz

1. Which sort is stable and always O(n log n), but needs O(n) extra memory?
   - A) Merge sort
   - B) Heap sort
   - C) Quicksort

2. When does quicksort with "first item as pivot" hit O(n²)?
   - A) When the list has negative numbers
   - B) On already sorted (or reversed) input, where each partition removes only one item
   - C) On random input

3. Quickselect is faster on average than sorting because:
   - A) It doesn't compare numbers
   - B) After each partition it continues into only one side
   - C) It uses a heap

4. Which O(n log n) sort uses O(1) extra space and has no bad worst case?
   - A) Merge sort
   - B) Quicksort
   - C) Heap sort

<details>
<summary>Quiz answers</summary>

1. **A) Merge sort**: Merging needs a temporary array; in exchange, it never degrades and keeps equal items in order.
2. **B) On already sorted (or reversed) input, where each partition removes only one item**: A random pivot avoids this pattern.
3. **B) After each partition it continues into only one side**: n + n/2 + n/4 + ... adds up to about 2n.
4. **C) Heap sort**: It sorts inside the array using a heap, guaranteed O(n log n).

</details>

---
Previous: [Lesson 26](26-simple-sorts.md) · Next: [Lesson 28: Non-comparison sorts and sorting in practice](28-sorting-in-practice.md)
