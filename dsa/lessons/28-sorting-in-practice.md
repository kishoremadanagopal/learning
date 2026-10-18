# Lesson 28: Non-comparison sorts and sorting in practice

**You'll learn:** the n log n lower bound for comparison sorts, counting sort, radix sort, bucket sort, Timsort, sorted and list.sort, key functions and multi-key sorting, stability tricks, cmp_to_key, choosing a sort.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/dsa/#sorting-in-practice)**: run every example and check your exercise answers.

## Key terms

- **Comparison sort:** a sort that learns about the data only by comparing pairs of items.
- **Lower bound:** the least work any algorithm for a problem must do; Ω(n log n) for comparison sorts.
- **Counting sort:** counts how many times each small integer appears, then writes them out in order.
- **Radix sort:** sorts by one digit at a time, least significant first, with a stable sort per digit.
- **Bucket sort:** spreads evenly distributed values into buckets, sorts each bucket, and joins them.
- **Timsort:** Python's sorting algorithm: finds sorted runs and merges them; stable and adaptive.
- **Key function:** a function that gives the value to sort each item by, as in `sorted(items, key=len)`.
- **cmp_to_key:** turns an old-style comparison function into a key function.

### Why comparison sorts can't beat n log n

A sort that only learns about the data by comparing pairs ("is a < b?") is like a game of twenty questions: each comparison has two outcomes, and it must tell apart all n! possible orderings of the input. With k comparisons you can distinguish at most 2ᵏ cases, so you need 2ᵏ ≥ n!, which works out to k ≥ log₂(n!) ≈ n log₂ n. So **every comparison sort needs Ω(n log n) comparisons** in the worst case. Merge sort and heap sort are optimal.

To go faster, you must use more than comparisons: the **values themselves**.

## Counting sort

If the values are small integers (ages, grades, digits), count how many times each value appears, then write them back in order. O(n + k) for values from 0 to k − 1.

![Counting sort on [4, 2, 2, 8, 3, 3, 1]: a count array indexed 0 to 8 holds how many times each value appears (1 → 1, 2 → 2, 3 → 2, 4 → 1, 8 → 1); reading the counts in order writes 1, 2, 2, 3, 3, 4, 8](../figures/counting-sort.svg)

```python
def counting_sort(nums, max_value):
    counts = [0] * (max_value + 1)
    for x in nums:
        counts[x] += 1
    out = []
    for value, c in enumerate(counts):
        out.extend([value] * c)
    return out

print(counting_sort([4, 2, 2, 8, 3, 3, 1], 8))
```

It's only worth it when the range k isn't much bigger than n: sorting 10 numbers between 0 and a billion would need a billion counters. To sort **records** by a small key stably, turn the counts into starting positions (prefix sums) and place each record there; that stable version is what radix sort uses.

## Radix sort

Sort numbers digit by digit, from the **least significant** digit, using a stable sort for each digit. After processing the last digit, everything is in order. O(d · (n + b)) for d digits in base b: for fixed-size integers (like 32-bit IDs) that's linear in n.

```python
def radix_sort(nums):
    if not nums:
        return []
    place = 1
    while max(nums) // place > 0:
        buckets = [[] for _ in range(10)]      # one bucket per digit 0..9
        for x in nums:
            buckets[(x // place) % 10].append(x)   # appending keeps it stable
        nums = [x for b in buckets for x in b]
        place *= 10
    return nums

print(radix_sort([170, 45, 75, 90, 802, 24, 2, 66]))
```

## Bucket sort

For values spread evenly over a range (like random decimals between 0 and 1), drop each into one of n buckets by value, sort each small bucket, and concatenate: O(n) on average, O(n²) if everything lands in one bucket.

```python
def bucket_sort(values):
    n = len(values)
    buckets = [[] for _ in range(n)]
    for v in values:                       # 0 <= v < 1
        buckets[int(v * n)].append(v)
    return [v for b in buckets for v in sorted(b)]

print(bucket_sort([0.42, 0.32, 0.23, 0.52, 0.25, 0.47, 0.51]))
```

## How Python sorts: Timsort

`sorted()` and `list.sort()` use **Timsort** (since Python 3.11, with an improved "powersort" merge policy). It finds runs that are already in order, extends short runs with insertion sort, and merges runs like merge sort. Result: O(n log n) worst case, **O(n) on already sorted or nearly sorted data**, and **stable**. It's written in C, so a hand-written sort in Python is never faster for real work.

```python
words = ["banana", "Apple", "cherry", "apple"]
print(sorted(words))                      # by Unicode: capitals come first
print(sorted(words, key=str.lower))       # case-insensitive
print(sorted(words, key=len, reverse=True))

nums = [3, 1, 2]
nums.sort()                               # sorts in place, returns None
print(nums)
```

## Sorting by several keys

A `key` function can return a **tuple**: Python compares tuples item by item, so the first item is the main key and later items break ties. To reverse just one numeric key, negate it.

```python
people = [("Ana", "Sales", 52_000), ("Ben", "IT", 61_000), ("Cy", "Sales", 61_000), ("Dee", "IT", 58_000)]

by_dept_then_salary_desc = sorted(people, key=lambda p: (p[1], -p[2]))
for p in by_dept_then_salary_desc:
    print(p)
```

For keys you can't negate (like strings descending), use **stability**: sort by the secondary key first, then stably by the primary key.

```python
people = [("Ana", "Sales"), ("Ben", "IT"), ("Cy", "Sales"), ("Dee", "IT")]
step1 = sorted(people, key=lambda p: p[0], reverse=True)   # secondary: name, Z to A
step2 = sorted(step1, key=lambda p: p[1])                  # primary: department; ties keep step 1's order
print(step2)
```

## Custom comparisons: cmp_to_key

Sometimes the order is defined by comparing two items directly. The classic: arrange numbers to form the **largest number** ([3, 30, 34, 5, 9] → "9534330"). Put a before b if the string `a + b` beats `b + a`.

```python
from functools import cmp_to_key

def compare(a, b):
    if a + b > b + a:
        return -1          # a should come first
    if a + b < b + a:
        return 1
    return 0

nums = [3, 30, 34, 5, 9]
parts = sorted(map(str, nums), key=cmp_to_key(compare))
print("".join(parts))
```

A comparison function returns a negative number if a comes first, positive if b comes first, 0 if equal.

## Choosing a sort

| Situation | Use |
|---|---|
| Anything in Python | `sorted()` / `list.sort()` with a `key` |
| Small integer range (ages, scores 0–100) | counting sort, O(n + k) |
| Fixed-length integers or strings, huge n | radix sort, O(d · n) |
| Only the top k items | `heapq.nlargest(k, …)`, O(n log k) |
| The k-th item or the median | quickselect, O(n) average |
| Data bigger than memory | external merge sort |
| Need a guaranteed bound with O(1) memory | heap sort |

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Counting sort | count each value, write values in order | O(n + k) | O(n + k) |
| Radix sort (LSD) | stable bucket pass per digit, least significant first | O(d · (n + b)) | O(n + b) |
| Bucket sort | bucket by value, sort buckets, concatenate | O(n) average, O(n²) worst | O(n) |
| sorted() / list.sort() (Timsort) | merge natural runs; insertion sort for short runs | O(n log n), O(n) if nearly sorted | O(n) |
| Multi-key sort | key returns a tuple; negate numbers to reverse one key | O(n log n) | O(n) |
| Largest number from digits | sort strings with cmp: a + b vs b + a | O(L · n log n) | O(n · L) |
| Top k items | heapq.nlargest(k, items) | O(n log k) | O(k) |

## Common mistakes

- Calling `.sort()` and using its return value (it's None).
- Using counting sort on a huge value range.
- Sorting with `reverse=True` when only one of several keys should be descending.
- Comparing numbers as strings by accident ("10" < "9").

## Exercises

### 1. Counting sort

Write `counting_sort(nums, max_value)` returning a new sorted list of the integers in `nums`, all between 0 and `max_value`, using counting sort in O(n + max_value). Don't use `sorted()` or `.sort()`. Must handle a million numbers.

Starter code:

```python
def counting_sort(nums, max_value):
    pass

print(counting_sort([4, 2, 2, 8, 3, 3, 1], 8))
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** integers in 0..max_value; return a new list; linear time.
2. **Examples:** [4, 2, 2, 8, 3, 3, 1], 8 → [1, 2, 2, 3, 3, 4, 8].
3. **Brute force:** a comparison sort: O(n log n) at best, O(n²) for the simple ones.
4. **Pattern:** small integer range → **counting sort** (no comparisons).
5. **Plan:** count each value; output values in order, repeated by their counts.
6. **Code and test:** empty input, max_value 0, a large range with few numbers.

</details>

<details>
<summary>💡 Hint 1</summary>

The values are small integers. Instead of comparing them, what could you count?

</details>

<details>
<summary>💡 Hint 2</summary>

Make a list `counts` with one slot per possible value (0 to max_value). One pass fills it; then read it from 0 upward.

</details>

<details>
<summary>💡 Hint 3</summary>

`counts = [0] * (max_value + 1)`; `for x in nums: counts[x] += 1`; then for each value, `out.extend([value] * counts[value])`.

</details>

### 2. Largest number

Write `largest_number(nums)` that arranges a list of non-negative integers so that, written side by side, they form the largest possible number, returned as a string. If the result is all zeros, return `"0"`.

Starter code:

```python
from functools import cmp_to_key

def largest_number(nums):
    pass

print(largest_number([3, 30, 34, 5, 9]))   # "9534330"
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** order the numbers to maximise the concatenated string; return a string; all zeros → "0".
2. **Examples:** [10, 2] → "210"; [3, 30, 34, 5, 9] → "9534330"; [0, 0] → "0".
3. **Brute force:** try all n! orderings: hopeless beyond about 10 numbers.
4. **Pattern:** a **custom comparison sort** (the right order is defined pairwise).
5. **Plan:** strings; compare by a+b vs b+a; sort; join; fix the all-zeros case.
6. **Code and test:** prefixes like 121 and 12, zeros, a single number.

</details>

<details>
<summary>💡 Hint 1</summary>

Sorting the numbers in descending numeric order fails for [3, 30] ("303" < "330"). What should decide whether a goes before b?

</details>

<details>
<summary>💡 Hint 2</summary>

Compare the two possible joins: put a first if the string `a + b` is bigger than `b + a`. Use `functools.cmp_to_key` to sort with that rule.

</details>

<details>
<summary>💡 Hint 3</summary>

Convert to strings, sort with `key=cmp_to_key(compare)` where compare returns −1 if `a + b > b + a`, 1 if smaller, 0 if equal. Join, and turn a leading "0" result into "0".

</details>

**In the sandbox:** exercises 59–60. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Counting sort</summary>

```python
def counting_sort(nums, max_value):
    counts = [0] * (max_value + 1)      # one counter per possible value
    for x in nums:
        counts[x] += 1
    out = []
    for value in range(max_value + 1):
        out.extend([value] * counts[value])
    return out

print(counting_sort([4, 2, 2, 8, 3, 3, 1], 8))
```

**Line by line**

- `counts[x]` is the number of times value `x` appears; the list index **is** the value, which is why no comparisons are needed.
- Reading `counts` from 0 to max_value visits the values in increasing order.
- `out.extend([value] * counts[value])` writes each value the right number of times.

**Trace** on [2, 0, 2, 1] with max_value 2:

| step | counts (for 0, 1, 2) | out |
|---|---|---|
| count | [1, 1, 2] | |
| value 0 | | [0] |
| value 1 | | [0, 1] |
| value 2 | | [0, 1, 2, 2] |

**Complexity:** O(n + k) time and O(n + k) space, where k = max_value + 1.

**Common wrong approach:** calling `nums.count(value)` for each value: that rescans the whole list every time, O(n · k).

</details>

<details>
<summary>✅ 2. Largest number</summary>

```python
from functools import cmp_to_key

def largest_number(nums):
    def compare(a, b):
        if a + b > b + a:
            return -1        # a first makes a bigger number
        if a + b < b + a:
            return 1
        return 0

    parts = sorted(map(str, nums), key=cmp_to_key(compare))
    result = "".join(parts)
    return "0" if result[0] == "0" else result   # "00" -> "0"

print(largest_number([3, 30, 34, 5, 9]))
```

**Line by line**

- Working with strings makes `a + b` concatenation, and comparing equal-length strings compares them as numbers.
- `compare(a, b)` returns −1 when a should come first: joining a then b gives the bigger result.
- This pairwise rule is transitive, so sorting with it produces the best overall order.
- If the biggest piece is "0", every piece is "0", so return "0" instead of "000".

**Trace** comparing pairs from [3, 30, 34]:

| a | b | a+b | b+a | order |
|---|---|---|---|---|
| "3" | "30" | "330" | "303" | 3 before 30 |
| "34" | "3" | "343" | "334" | 34 before 3 |
| → sorted | | | | 34, 3, 30 → "34330" |

**Complexity:** O(n log n) comparisons, each O(L) for numbers with up to L digits: O(L · n log n). O(n · L) space.

**Common wrong approach:** sorting by numeric value descending, which puts 30 before 3 and gives "303" instead of "330".

</details>

## Quick quiz

1. Why can't any comparison sort beat O(n log n) in the worst case?
   - A) It must distinguish n! orderings, and k yes/no comparisons distinguish at most 2^k of them
   - B) Because computers are too slow
   - C) Because Python limits sorting

2. When is counting sort a good choice?
   - A) When memory is extremely limited and values span billions
   - B) When the values are integers in a small range compared with n
   - C) When the values are long strings

3. Python's sorted() on a list that's already sorted takes:
   - A) O(n²)
   - B) About O(n), because Timsort detects existing runs
   - C) O(n log n) always

4. How do you sort by department ascending, then salary descending?
   - A) sorted(people, key=lambda p: (p.dept, -p.salary))
   - B) sorted(people, key=lambda p: (p.dept, p.salary), reverse=True)
   - C) Sort twice by salary

<details>
<summary>Quiz answers</summary>

1. **A) It must distinguish n! orderings, and k yes/no comparisons distinguish at most 2^k of them**: 2^k >= n! requires k >= log2(n!), which is about n log n.
2. **B) When the values are integers in a small range compared with n**: Its cost is O(n + k); a huge range k makes it wasteful.
3. **B) About O(n), because Timsort detects existing runs**: Timsort is adaptive: sorted or nearly sorted input is fast.
4. **A) sorted(people, key=lambda p: (p.dept, -p.salary))**: Tuples compare item by item; negating the number reverses just that key.

</details>

---
Previous: [Lesson 27](27-efficient-sorts.md) · Next: [Lesson 29: Binary trees and traversals](29-binary-trees.md)
