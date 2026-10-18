# Lesson 9: Prefix sums and difference arrays

**You'll learn:** prefix-sum arrays, O(1) range sums, the leading zero, running left sums, pivot index, difference arrays for range updates, 2-D prefix sums.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/dsa/#prefix-sums)**: run every example and check your exercise answers.

## Key terms

- **Prefix sum:** the running total of the first k items; prefix[0] = 0.
- **Range sum:** the sum of items from index i to j; prefix[j + 1] − prefix[i].
- **Query:** a question asked of the data, such as a range sum.
- **Precomputation:** doing work once up front so that many later questions are cheap.
- **Pivot index:** an index where the sum to the left equals the sum to the right.
- **Difference array:** records where range updates start and stop; a prefix sum of it gives the final values.
- **Inclusion–exclusion:** adding and subtracting overlapping areas so each is counted once; used by 2-D prefix sums.

If you'll be asked "what's the sum from index i to j?" many times, adding up the range every time costs O(n) per question. A **prefix sum** array stores the running total, so every range sum becomes **one subtraction**.

![An array 3, 1, 4, 1, 5, 9 with its prefix array 0, 3, 4, 8, 9, 14, 23 underneath. The sum of indexes 2 to 4 (4 + 1 + 5 = 10) equals prefix[5] minus prefix[2] = 14 − 4](../figures/prefix-sums.svg)

`prefix[i]` = sum of the first `i` numbers (so `prefix[0] = 0`). Then:

> sum of `nums[i..j]` (inclusive) = `prefix[j + 1] - prefix[i]`

```python
from itertools import accumulate

nums = [3, 1, 4, 1, 5, 9]
prefix = [0]
for x in nums:
    prefix.append(prefix[-1] + x)
print(prefix)

def range_sum(i, j):                 # inclusive i..j, O(1)
    return prefix[j + 1] - prefix[i]

print(range_sum(2, 4), range_sum(0, 5), range_sum(3, 3))
print(list(accumulate(nums, initial=0)))    # the same prefix array in one line
```

Building the prefix array is O(n); each query is O(1). With q queries: O(n + q) instead of O(n·q).

The extra 0 at the front avoids special cases: without it, a range starting at index 0 needs an `if`.

## Pivot index: left sum equals right sum

Prefix sums also give "everything to the left" in O(1). The **pivot index** is where the sum of the numbers to the left equals the sum to the right:

```python
def pivot_index(nums):
    total = sum(nums)
    left = 0
    for i, x in enumerate(nums):
        if left == total - left - x:     # right sum = total - left - the pivot itself
            return i
        left += x
    return -1

print(pivot_index([1, 7, 3, 6, 5, 6]))   # 1 + 7 + 3 = 11 = 5 + 6
```

## Difference arrays: many range updates

The reverse problem: "add 5 to every item from i to j", many times, then read the final array. A **difference array** records only where changes start and stop: `diff[i] += v` and `diff[j + 1] -= v`, O(1) per update. A prefix sum over `diff` at the end rebuilds the array:

```python
from itertools import accumulate

n = 8
diff = [0] * (n + 1)
for i, j, v in [(1, 3, 5), (2, 6, 2), (0, 7, 1)]:    # add v to positions i..j
    diff[i] += v
    diff[j + 1] -= v
print(list(accumulate(diff[:n])))
```

Typical uses: booking systems (how many rooms are taken each night), counting how many intervals cover each point.

## 2-D prefix sums

For a grid, `P[r][c]` = sum of the rectangle from (0, 0) to (r − 1, c − 1). Any rectangle sum then takes four lookups (inclusion–exclusion):

```python
grid = [[1, 2, 3],
        [4, 5, 6],
        [7, 8, 9]]
R, C = len(grid), len(grid[0])
P = [[0] * (C + 1) for _ in range(R + 1)]
for r in range(R):
    for c in range(C):
        P[r + 1][c + 1] = grid[r][c] + P[r][c + 1] + P[r + 1][c] - P[r][c]

def rect_sum(r1, c1, r2, c2):        # inclusive corners
    return P[r2 + 1][c2 + 1] - P[r1][c2 + 1] - P[r2 + 1][c1] + P[r1][c1]

print(rect_sum(1, 1, 2, 2))          # 5 + 6 + 8 + 9
```

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Prefix sums | prefix[i] = sum of the first i items; a range sum is a difference | O(n) build, O(1) per query | O(n) |
| Pivot index | left sum vs total − left − current | O(n) | O(1) |
| Difference array | +v at start, −v after end; prefix-sum once at the end | O(1) per update, O(n) to finish | O(n) |
| 2-D prefix sums | inclusion–exclusion on a grid | O(r·c) build, O(1) per query | O(r·c) |

## Common mistakes

- Off-by-one errors from leaving out the leading 0, or using prefix[j] instead of prefix[j + 1].
- Rebuilding the prefix array for every query.
- Comparing the pivot after adding the current number to the left sum.

## Exercises

### 1. Many range sums

Write `range_sums(nums, queries)` where each query is a pair `(i, j)` (inclusive, `0 <= i <= j < len(nums)`). Return a list with the sum of `nums[i..j]` for each query, in order. It must be fast for 100,000 numbers and 100,000 queries.

Starter code:

```python
def range_sums(nums, queries):
    return [sum(nums[i:j + 1]) for i, j in queries]
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** many (i, j) questions about one fixed array; inclusive ranges.
2. **Examples:** `[3, 1, 4, 1, 5, 9]`: (2, 4) → 4 + 1 + 5 = 10.
3. **Brute force:** the starter: sum each slice: O(n) per query, O(n·q) total.
4. **Pattern:** "many range-sum queries on fixed data" → **prefix sums**.
5. **Plan:** build prefix with a leading 0; answer each query with one subtraction.
6. **Code and test:** check a range that starts at 0 (uses `prefix[0] = 0`).

</details>

<details>
<summary>💡 Hint 1</summary>

The starter re-adds every range from scratch. Precompute something once instead.

</details>

<details>
<summary>💡 Hint 2</summary>

Build `prefix` where `prefix[k]` is the sum of the first k numbers, starting with `prefix[0] = 0`.

</details>

<details>
<summary>💡 Hint 3</summary>

Then the sum of `nums[i..j]` is `prefix[j + 1] - prefix[i]`.

</details>

### 2. Pivot index

Write `pivot_index(nums)` returning the first index where the sum of the numbers strictly to its left equals the sum strictly to its right (an empty side counts as 0), or `-1` if there's none. Make it O(n): fast for 100,000 numbers.

Starter code:

```python
def pivot_index(nums):
    pass
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** left side and right side exclude the pivot itself; empty side = 0; first pivot wins.
2. **Examples:** `[1, 7, 3, 6, 5, 6]` → 3 (11 = 11). `[2, 1, -1]` → 0 (left 0, right 1 + −1 = 0).
3. **Brute force:** for each i, sum both sides: O(n²).
4. **Pattern:** **running prefix** + the total.
5. **Plan:** total once; walk with a running left sum; compare before adding the current number.
6. **Code and test:** the order matters: compare **before** `left += x`.

</details>

<details>
<summary>💡 Hint 1</summary>

If you know the total and the sum to the left of i, you can work out the sum to the right without another loop.

</details>

<details>
<summary>💡 Hint 2</summary>

right = total − left − nums[i].

</details>

<details>
<summary>💡 Hint 3</summary>

`total = sum(nums)`, `left = 0`; for each i: if `left == total - left - nums[i]` return i; then `left += nums[i]`. Return −1.

</details>

**In the sandbox:** exercises 17–18. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Many range sums</summary>

```python
def range_sums(nums, queries):
    prefix = [0]
    for x in nums:
        prefix.append(prefix[-1] + x)
    return [prefix[j + 1] - prefix[i] for i, j in queries]
```

**Line by line**

- `prefix = [0]`: the sum of the first 0 numbers.
- `prefix.append(prefix[-1] + x)`: each entry is the previous total plus the next number.
- `prefix[j + 1] - prefix[i]`: (sum of the first j + 1 numbers) minus (sum of the first i numbers) leaves exactly `nums[i..j]`.

**Trace** for `nums = [3, 1, 4, 1, 5, 9]`:

| k | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|---|
| prefix[k] | 0 | 3 | 4 | 8 | 9 | 14 | 23 |

Query (2, 4): `prefix[5] - prefix[2]` = 14 − 4 = **10**.

**Complexity:** O(n + q) time, O(n) extra space. For 100,000 numbers and queries, that's about 200,000 steps instead of up to 10 billion.

</details>

<details>
<summary>✅ 2. Pivot index</summary>

```python
def pivot_index(nums):
    total = sum(nums)
    left = 0
    for i, x in enumerate(nums):
        if left == total - left - x:
            return i
        left += x
    return -1
```

**Line by line**

- `total = sum(nums)` once: O(n).
- At index i, `left` is the sum of `nums[0..i-1]`, because we add `x` only **after** the comparison.
- `total - left - x` is the right side: everything minus the left part minus the pivot itself.

**Trace** on `[1, 7, 3, 6, 5, 6]` (total 28):

| i | x | left | right = 28 − left − x | equal? |
|---|---|---|---|---|
| 0 | 1 | 0 | 27 | no |
| 1 | 7 | 1 | 20 | no |
| 2 | 3 | 8 | 17 | no |
| 3 | 6 | 11 | 11 | **yes** → 3 |

**Complexity:** O(n) time, O(1) space.

</details>

## Quick quiz

1. With `prefix[0] = 0` and `prefix[k]` = sum of the first k numbers, the sum of nums[i..j] inclusive is:
   - A) prefix[j] − prefix[i]
   - B) prefix[j] + prefix[i]
   - C) prefix[j + 1] − prefix[i]

2. What does a prefix-sum array cost to build and to query?
   - A) O(1) to build, O(n) per query
   - B) O(n log n) to build
   - C) O(n) to build, O(1) per query

3. A difference array makes which operation O(1)?
   - A) Adding a value to every item in a range
   - B) Sorting
   - C) Finding the maximum

4. How many lookups does a 2-D prefix sum need for any rectangle sum?
   - A) One per cell in the rectangle
   - B) Four
   - C) One

<details>
<summary>Quiz answers</summary>

1. **C) prefix[j + 1] − prefix[i]**: The first j + 1 numbers minus the first i numbers.
2. **C) O(n) to build, O(1) per query**: One pass to build, one subtraction per question.
3. **A) Adding a value to every item in a range**: Mark the start and the end of the change; a final prefix sum applies them all.
4. **B) Four**: Inclusion–exclusion: add the big rectangle, subtract two strips, add back the doubly subtracted corner.

</details>

---
Previous: [Lesson 8](08-sliding-window.md) · Next: [Lesson 10: 2-D grids and matrices](10-matrices.md)
