# Lesson 36: Algorithms and Big-O

**You'll learn:** Big-O, lists vs sets, spotting O(n²), binary search, merge sort, operation costs.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python/#algorithms-and-big-o)**: run every example and check your exercise answers.

## Key terms

- **Algorithm:** a step-by-step method for solving a problem.
- **Big-O notation:** describes how running time grows with input size `n`.
- **Time complexity:** how the number of steps grows with input size.
- **Binary search:** finds a value in sorted data by halving the range each step: O(log n).
- **Divide and conquer:** split a problem in parts, solve each, combine the results.
- **Merge sort:** a divide-and-conquer sort that runs in O(n log n).

Two programs can give the same answer while one takes a second and the other takes a day. **Big-O notation** describes how the running time grows as the input size `n` grows.

| Big-O | Name | Example | 1,000 items → 1,000,000 items |
|---|---|---|---|
| O(1) | constant | dict lookup, list index | same time |
| O(log n) | logarithmic | binary search | 10 steps → 20 steps |
| O(n) | linear | loop over a list, `x in list` | 1,000× slower |
| O(n log n) | linearithmic | good sorting (`sorted`) | ~2,000× slower |
| O(n²) | quadratic | nested loops over the same data | 1,000,000× slower |

![Line chart of steps against number of items: O(1) and O(log n) stay almost flat, O(n) grows steadily, O(n log n) faster, and O(n squared) shoots up](../figures/big-o.svg)

Big-O ignores constants and focuses on the shape of growth. For small inputs, anything is fast. For big inputs, the shape is all that matters.

## The right data structure is the biggest win

Checking `x in some_list` looks at items one by one: O(n). Checking `x in some_set` uses hashing: O(1) on average. Watch the difference:

```python
import time

n = 20_000
as_list = list(range(n))
as_set = set(as_list)
targets = range(n - 2_000, n)     # values near the end

start = time.perf_counter()
hits = sum(1 for t in targets if t in as_list)
list_ms = (time.perf_counter() - start) * 1000

start = time.perf_counter()
hits = sum(1 for t in targets if t in as_set)
set_ms = (time.perf_counter() - start) * 1000

print(f"list: {list_ms:.1f} ms   set: {set_ms:.2f} ms")
```

## Spotting O(n²)

A loop inside a loop over the same data is the classic warning sign:

```python
def has_duplicates_slow(items):          # O(n²)
    for i in range(len(items)):
        for j in range(i + 1, len(items)):
            if items[i] == items[j]:
                return True
    return False

def has_duplicates_fast(items):          # O(n)
    seen = set()
    for item in items:
        if item in seen:
            return True
        seen.add(item)
    return False

data = [5, 3, 8, 1, 3]
print(has_duplicates_slow(data), has_duplicates_fast(data))
```

## Binary search: O(log n)

On **sorted** data you can find a value by repeatedly halving the search range. A million items take at most 20 steps.

```python
def binary_search(items, target):
    low, high = 0, len(items) - 1
    while low <= high:
        mid = (low + high) // 2
        if items[mid] == target:
            return mid
        if items[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return -1

nums = list(range(0, 1000, 7))
print(binary_search(nums, 693), binary_search(nums, 50))
```

The standard library's `bisect` module provides a well-tested version.

## Sorting: merge sort, O(n log n)

Merge sort splits the list in half, sorts each half recursively, then merges the two sorted halves. It's a classic **divide and conquer** algorithm:

```python
def merge_sort(items):
    if len(items) <= 1:
        return items
    mid = len(items) // 2
    left = merge_sort(items[:mid])
    right = merge_sort(items[mid:])

    merged, i, j = [], 0, 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            merged.append(left[i])
            i += 1
        else:
            merged.append(right[j])
            j += 1
    merged.extend(left[i:])
    merged.extend(right[j:])
    return merged

print(merge_sort([38, 27, 43, 3, 9, 82, 10]))
```

In real code, use `sorted()`. Python's built-in sort (Timsort) is O(n log n), stable and highly optimised. Learning how sorting works trains you to think about algorithms, and it comes up in technical interviews.

## Common operation costs

| Operation | list | dict / set |
|---|---|---|
| index / key lookup | O(1) | O(1) |
| `x in ...` | O(n) | O(1) |
| append / add | O(1) | O(1) |
| insert or remove at the front | O(n) | n/a |
| sort | O(n log n) | n/a |

Need fast adds and removes at both ends? Use `collections.deque`.

## Common mistakes

- Using `x in some_list` inside a loop over big data. Convert the list to a set first.
- Running binary search on unsorted data.
- Optimising before measuring. Make it correct first, then time it.

## Exercises

### 1. Two sum

Write `two_sum(nums, target)` that returns the indexes `(i, j)` with `i < j` of the two numbers that add up to `target`, or `None` if there are none. Make it **O(n)** with a dictionary that remembers numbers you've seen and their positions.

`two_sum([2, 7, 11, 15], 9)` → `(0, 1)`

Starter code:

```python
def two_sum(nums, target):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return (i, j)
    return None

print(two_sum([2, 7, 11, 15], 9))
```

### 2. Insertion sort

Implement `insertion_sort(items)` that returns a new sorted list without using `sorted` or `.sort`. Take each item and insert it into the correct position of a growing sorted list.

Starter code:

```python
def insertion_sort(items):
    return items

print(insertion_sort([5, 2, 9, 1, 5, 6]))
```

**In the sandbox:** exercises 59–60. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Loop once with enumerate. For each number n at index j, check whether target - n is already in a dict seen (number → index). If so, return (seen[target - n], j). Otherwise store seen[n] = j.
2. Start with result = []. For each item, walk backwards from the end of result while the previous element is bigger, then result.insert(i, item).

</details>

<details>
<summary>Answers</summary>

**1. Two sum**

```python
def two_sum(nums, target):
    seen = {}
    for j, n in enumerate(nums):
        need = target - n
        if need in seen:
            return (seen[need], j)
        seen[n] = j
    return None

print(two_sum([2, 7, 11, 15], 9))
```

**2. Insertion sort**

```python
def insertion_sort(items):
    result = []
    for item in items:
        i = len(result)
        while i > 0 and result[i - 1] > item:
            i -= 1
        result.insert(i, item)
    return result

print(insertion_sort([5, 2, 9, 1, 5, 6]))
```

</details>

## Quick quiz

1. What's the Big-O of checking `x in my_set`?
   - A) O(n)
   - B) O(1) on average
   - C) O(log n)

2. What's the Big-O of two nested loops over the same list?
   - A) O(2n)
   - B) O(n)
   - C) O(n²)

3. What does binary search require?
   - A) A set
   - B) Unique values
   - C) Sorted data

<details>
<summary>Quiz answers</summary>

1. **B) O(1) on average**: Sets use hash tables, so lookups don't depend on the size.
2. **C) O(n²)**: For each of n items you do up to n more steps.
3. **C) Sorted data**: Halving only works if you know which side the target must be on.

</details>

---
Previous: [Lesson 35](35-itertools-functools.md) · Next: [Lesson 37: Capstone: build an expense tracker](37-capstone.md)
