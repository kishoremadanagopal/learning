# Lesson 22: Divide and conquer

**You'll learn:** divide, conquer and combine, fast exponentiation, modular power, merge sort, counting inversions, maximum subarray by halves, the master theorem, when divide and conquer fits.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/dsa/#divide-and-conquer)**: run every example and check your exercise answers.

## Key terms

- **Divide and conquer:** split a problem into smaller independent subproblems, solve them recursively, combine the answers.
- **Fast (binary) exponentiation:** computing xⁿ by squaring, in O(log n) multiplications.
- **Modular arithmetic:** working with remainders after division by a modulus, to keep numbers small.
- **Merge sort:** sort each half recursively, then merge the sorted halves.
- **Inversion:** a pair of positions i < j whose values are out of order (nums[i] > nums[j]).
- **Recurrence relation:** an equation for an algorithm's cost in terms of its cost on smaller inputs, like T(n) = 2T(n/2) + n.
- **Master theorem:** a rule for solving recurrences of the form T(n) = a·T(n/b) + O(nᵈ).
- **Overlapping subproblems:** when the same subproblem is needed many times; a sign to use memoisation instead.

**Divide and conquer** is recursion with a particular shape:

1. **Divide** the problem into smaller subproblems, usually halves.
2. **Conquer** each subproblem recursively (tiny ones are base cases).
3. **Combine** the sub-answers into the answer.

Binary search (divide, then keep only one half), merge sort (sort both halves, merge them) and quicksort are all divide and conquer. The payoff is usually turning O(n) into O(log n), or O(n²) into O(n log n).

![Merge sort as divide and conquer on [38, 27, 43, 3, 9, 82, 10]: the top half of the picture splits the list in halves down to single items (divide); the bottom half merges sorted pairs back up into [3, 9, 10, 27, 38, 43, 82] (combine)](../figures/divide-conquer.svg)

## Fast exponentiation: O(log n) instead of O(n)

Computing xⁿ by multiplying n times is O(n). But xⁿ = (x^(n/2))² when n is even, and x · x^(n−1) when n is odd. Halving the exponent at every step needs only about log₂ n steps: 2^1,000,000 takes 20 squarings, not a million multiplications.

```python
def power(x, n):
    if n == 0:
        return 1
    half = power(x, n // 2)          # solve the half-sized problem ONCE
    if n % 2 == 0:
        return half * half
    return half * half * x

print(power(3, 13), 3 ** 13)
```

The same idea with a loop, reading the exponent's binary digits, and with a **modulus** to keep numbers small (as in cryptography and "answer modulo 10⁹ + 7" interview questions):

```python
def power_mod(x, n, mod):
    result = 1
    x %= mod
    while n > 0:
        if n & 1:                    # this binary digit of n is 1
            result = result * x % mod
        x = x * x % mod              # x, x², x⁴, x⁸, ...
        n >>= 1                      # next binary digit
    return result

print(power_mod(2, 10**18, 10**9 + 7), pow(2, 10**18, 10**9 + 7))   # Python's built-in pow does the same
```

Note `half` is computed once and squared. Writing `power(x, n // 2) * power(x, n // 2)` makes **two** recursive calls and loses all the benefit: it's back to O(n).

## Merge sort: the classic

Split in half, sort each half recursively, merge the two sorted halves in linear time (Lesson 7's merge).

```python
def merge_sort(nums):
    if len(nums) <= 1:
        return nums
    mid = len(nums) // 2
    left, right = merge_sort(nums[:mid]), merge_sort(nums[mid:])
    merged, i, j = [], 0, 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            merged.append(left[i]); i += 1
        else:
            merged.append(right[j]); j += 1
    return merged + left[i:] + right[j:]

print(merge_sort([38, 27, 43, 3, 9, 82, 10]))
```

There are log₂ n levels of splitting, and each level does O(n) work merging, so merge sort is **O(n log n)** time and O(n) extra space. Lesson 27 compares it with quicksort and heapsort.

## Counting inversions: piggy-backing on merge sort

An **inversion** is a pair i < j with nums[i] > nums[j]: how "unsorted" a list is (used to compare rankings, like two people's top-10 lists). Checking every pair is O(n²). During merge sort's merge, whenever an item from the **right** half is placed before items still waiting in the left half, it forms an inversion with **each** of them: count them all at once.

```python
def sort_and_count(nums):
    if len(nums) <= 1:
        return nums, 0
    mid = len(nums) // 2
    left, a = sort_and_count(nums[:mid])
    right, b = sort_and_count(nums[mid:])
    merged, i, j, count = [], 0, 0, a + b
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            merged.append(left[i]); i += 1
        else:
            merged.append(right[j]); j += 1
            count += len(left) - i       # right[j] jumps ahead of every remaining left item
    return merged + left[i:] + right[j:], count

print(sort_and_count([2, 4, 1, 3, 5])[1])   # (2,1), (4,1), (4,3) -> 3
```

O(n log n) time, like merge sort.

## Maximum subarray, divide and conquer style

"The contiguous stretch with the largest sum" splits nicely: the best stretch is entirely in the left half, entirely in the right half, or **crosses the middle** (best suffix of the left + best prefix of the right). That's O(n log n). Kadane's algorithm (Lesson 42) later does it in O(n), but this version shows how a "crossing" case completes a divide-and-conquer solution.

```python
def max_subarray(nums, lo=0, hi=None):
    if hi is None:
        hi = len(nums) - 1
    if lo == hi:
        return nums[lo]
    mid = (lo + hi) // 2
    best_left_suffix, s = float("-inf"), 0
    for i in range(mid, lo - 1, -1):
        s += nums[i]; best_left_suffix = max(best_left_suffix, s)
    best_right_prefix, s = float("-inf"), 0
    for i in range(mid + 1, hi + 1):
        s += nums[i]; best_right_prefix = max(best_right_prefix, s)
    return max(max_subarray(nums, lo, mid), max_subarray(nums, mid + 1, hi),
               best_left_suffix + best_right_prefix)

print(max_subarray([-2, 1, -3, 4, -1, 2, 1, -5, 4]))   # 4 + -1 + 2 + 1 = 6
```

## The master theorem, in plain words

Many divide-and-conquer algorithms have a cost of the form T(n) = a·T(n/b) + O(n^d): **a** subproblems, each **1/b** the size, plus **O(n^d)** work to divide and combine. Compare the work at the top level with how fast the number of subproblems grows:

| Recurrence | Algorithm | Which wins | Result |
|---|---|---|---|
| T(n) = T(n/2) + O(1) | binary search | every level costs the same | **O(log n)** |
| T(n) = 2T(n/2) + O(n) | merge sort | every level costs the same | **O(n log n)** |
| T(n) = 2T(n/2) + O(1) | tree traversal, max of a list by halves | the leaves (bottom) dominate | **O(n)** |
| T(n) = T(n/2) + O(n) | quickselect (on average) | the top level dominates | **O(n)** |
| T(n) = 3T(n/2) + O(n) | Karatsuba multiplication | the leaves dominate | **O(n^1.58)** |
| T(n) = 2T(n − 1) + O(1) | Tower of Hanoi (not halving!) | — | **O(2ⁿ)** |

The rule behind the table: if a = bᵈ, every level does the same work, giving O(nᵈ log n); if a < bᵈ, the top level dominates, giving O(nᵈ); if a > bᵈ, the leaves dominate, giving O(n^(log_b a)). You rarely need the formula itself. Drawing the recursion tree and adding up the work per level gets the same answer.

## When divide and conquer fits

- The problem splits into **independent** subproblems of the same kind (unlike Fibonacci, whose subproblems overlap: that's dynamic programming's job).
- Combining sub-answers is cheaper than solving the whole problem directly.
- Bonus: independent halves can run **in parallel**, which is how big data frameworks (MapReduce, Spark) process huge datasets.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Fast power xⁿ | square the half-power; multiply in x when n is odd | O(log n) | O(1) loop / O(log n) recursive |
| Merge sort | sort halves recursively, merge | O(n log n) | O(n) |
| Count inversions | count during merge sort's merge: add len(left) − i | O(n log n) | O(n) |
| Maximum subarray (D&C) | best of left, right, and crossing the middle | O(n log n) | O(log n) |
| Master theorem | compare a with bᵈ: same → nᵈ log n; smaller → nᵈ; larger → n^(log_b a) | — | — |

## Common mistakes

- Calling the recursive half twice (`f(n // 2) * f(n // 2)`), which throws away the speed-up.
- Forgetting the "crossing the middle" case when combining halves.
- Using divide and conquer on overlapping subproblems (like Fibonacci) without memoisation.
- Not taking the modulus after every multiplication, so numbers grow huge.

## Exercises

### 1. Fast modular power

Write `fast_pow(x, n, mod)` returning xⁿ mod `mod` for integers x ≥ 0, n ≥ 0 and mod ≥ 2, using O(log n) multiplications. Don't use Python's built-in three-argument `pow` or `**` with a big exponent: the point is to write the halving yourself.

Starter code:

```python
def fast_pow(x, n, mod):
    pass

print(fast_pow(3, 13, 1000))   # 3^13 = 1594323, so 323
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** huge exponents (up to 10¹⁵ in the speed test), answer modulo `mod`, n = 0 gives 1.
2. **Examples:** 3¹³ mod 1000 = 323; 2¹⁰ mod 1000 = 24; 5⁰ = 1.
3. **Brute force:** multiply n times: O(n), impossible for n = 10¹⁵.
4. **Pattern:** **divide and conquer**: halve the exponent (binary exponentiation).
5. **Plan:** result = 1; while n: if n is odd, result *= x; x = x²; n //= 2 (all mod `mod`).
6. **Code and test:** n = 0, n = 1, x larger than mod.

</details>

<details>
<summary>💡 Hint 1</summary>

If you already know x^(n/2), how do you get xⁿ in one more multiplication?

</details>

<details>
<summary>💡 Hint 2</summary>

Square it: xⁿ = (x^(n/2))² when n is even; when n is odd, multiply in one extra x. Each step halves n.

</details>

<details>
<summary>💡 Hint 3</summary>

Loop: `if n % 2: result = result * x % mod`; then `x = x * x % mod; n //= 2`. Take `% mod` after **every** multiplication to keep numbers small.

</details>

### 2. Count inversions

Write `count_inversions(nums)` returning the number of pairs `i < j` with `nums[i] > nums[j]`. Must handle 100,000 numbers.

Starter code:

```python
def count_inversions(nums):
    pass

print(count_inversions([2, 4, 1, 3, 5]))   # 3
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** count pairs out of order; equal values don't count; up to 100,000 numbers.
2. **Examples:** [2, 4, 1, 3, 5] → 3: (2,1), (4,1), (4,3). [4, 3, 2, 1] → 6.
3. **Brute force:** every pair: O(n²), about 5 billion checks for 100,000 numbers.
4. **Pattern:** **divide and conquer** riding on **merge sort**.
5. **Plan:** helper returns (sorted, count); count = left count + right count + cross count found during the merge.
6. **Code and test:** sorted, reversed, duplicates (use `<=` so equal values aren't counted).

</details>

<details>
<summary>💡 Hint 1</summary>

Split the list in half. Inversions are either inside the left half, inside the right half, or across the halves. The first two are smaller copies of the problem.

</details>

<details>
<summary>💡 Hint 2</summary>

If both halves are **sorted**, cross inversions are easy to count while merging them.

</details>

<details>
<summary>💡 Hint 3</summary>

Merge as in merge sort; when you take `right[j]` before `left[i]`, it's smaller than **all** of `left[i:]`, so add `len(left) - i`. Return (sorted list, count) from the recursive helper.

</details>

**In the sandbox:** exercises 44–45. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Fast modular power</summary>

```python
def fast_pow(x, n, mod):
    result = 1
    x %= mod
    while n > 0:
        if n % 2 == 1:          # odd exponent: take one x into the result
            result = result * x % mod
        x = x * x % mod         # square the base
        n //= 2                 # halve the exponent
    return result

print(fast_pow(3, 13, 1000))
```

**Line by line**

- Write n in binary: 13 = 1101₂ = 8 + 4 + 1, so x¹³ = x⁸ · x⁴ · x¹.
- `x` takes the values x, x², x⁴, x⁸… by squaring each round.
- When the current binary digit of n is 1 (`n % 2 == 1`), that power of x is part of the answer, so multiply it into `result`.
- `n //= 2` moves to the next binary digit. The loop runs once per binary digit: about log₂ n times.
- `% mod` after each multiplication keeps every number below mod², so the arithmetic stays fast.

**Trace** of 3¹³ mod 1000:

| n (binary) | odd? | result | x after squaring |
|---|---|---|---|
| 13 (1101) | yes | 3 | 9 |
| 6 (110) | no | 3 | 81 |
| 3 (11) | yes | 243 | 6561 % 1000 = 561 |
| 1 (1) | yes | 243 × 561 % 1000 = 323 | … |

**Complexity:** O(log n) time, O(1) space.

**Common wrong approach:** recursing as `fast_pow(x, n // 2, mod) * fast_pow(x, n // 2, mod)`: two half-sized calls per level add up to n calls, so it's O(n) again.

</details>

<details>
<summary>✅ 2. Count inversions</summary>

```python
def count_inversions(nums):
    def sort_count(a):
        if len(a) <= 1:
            return a, 0
        mid = len(a) // 2
        left, x = sort_count(a[:mid])
        right, y = sort_count(a[mid:])
        merged, i, j, count = [], 0, 0, x + y
        while i < len(left) and j < len(right):
            if left[i] <= right[j]:
                merged.append(left[i]); i += 1
            else:
                merged.append(right[j]); j += 1
                count += len(left) - i     # right[j] is smaller than all remaining left items
        return merged + left[i:] + right[j:], count

    return sort_count(list(nums))[1]

print(count_inversions([2, 4, 1, 3, 5]))
```

**Line by line**

- `sort_count` returns two things: the sorted list (needed for the merge above it) and the number of inversions inside it.
- Inversions within each half are counted by the recursive calls (`x` and `y`).
- During the merge, both halves are sorted. Taking `right[j]` while `left[i:]` is still waiting means every one of those waiting items is bigger than `right[j]` and sits before it in the original list: `len(left) - i` inversions at once.
- `left[i] <= right[j]` takes the left item on ties, so equal values are never counted.

**Trace** of the top-level merge for [2, 4, 1, 3, 5], with halves [2, 4] (sorted, 0 inside) and [1, 3, 5] (sorted, 0 inside):

| left waiting | right[j] | take | count added |
|---|---|---|---|
| 2, 4 | 1 | 1 (right) | 2 (beats 2 and 4) |
| 2, 4 | 3 | 2 (left) | 0 |
| 4 | 3 | 3 (right) | 1 (beats 4) |
| 4 | 5 | 4 (left) | 0 |

Total: 3.

**Complexity:** O(n log n) time, O(n) space.

**Common wrong approach:** adding just 1 when a right item is taken, which misses the inversions with the other items still waiting in the left half.

</details>

## Quick quiz

1. What are the three steps of divide and conquer?
   - A) Guess, check, repeat
   - B) Divide into smaller subproblems, solve them recursively, combine their answers
   - C) Sort, search, return

2. Why does fast exponentiation compute the half-power only once?
   - A) To avoid integer overflow
   - B) Python caches it automatically
   - C) Calling it twice would double the work at every level, bringing it back to O(n)

3. Merge sort's recurrence is T(n) = 2T(n/2) + O(n). Its cost is:
   - A) O(n²)
   - B) O(n)
   - C) O(n log n)

4. Which problem is NOT a good fit for plain divide and conquer?
   - A) Sorting a list
   - B) Fibonacci, because its subproblems overlap and get recomputed
   - C) Searching a sorted list

<details>
<summary>Quiz answers</summary>

1. **B) Divide into smaller subproblems, solve them recursively, combine their answers**: Binary search, merge sort and fast power all follow this shape.
2. **C) Calling it twice would double the work at every level, bringing it back to O(n)**: One call per level gives log n levels of O(1) work.
3. **C) O(n log n)**: log n levels, each doing O(n) merging work.
4. **B) Fibonacci, because its subproblems overlap and get recomputed**: Overlapping subproblems call for memoisation or dynamic programming instead.

</details>

---
Previous: [Lesson 21](21-recursion.md) · Next: [Lesson 23: Backtracking: subsets, permutations, N-Queens](23-backtracking.md)
