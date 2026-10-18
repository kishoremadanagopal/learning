# Lesson 49: Recognising the pattern

**You'll learn:** input size and target complexity, clue words and the techniques they point to, choosing a data structure by its fastest operation, an edge-case checklist, the Python standard-library toolkit, talking through a problem in an interview.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/dsa/#problem-patterns)**: run every example and check your exercise answers.

## Key terms

- **Target complexity:** the running time the input limits allow, read from the largest n.
- **Clue word:** a phrase in a problem that points to a technique, such as "top k" → heap.
- **Edge case:** an unusual input, like an empty list or all-equal values, that often breaks code.
- **Bucket sort:** placing items into buckets by a small-range key (such as a count) instead of comparing them.
- **Prefix and suffix products:** running products from the left and right, combined per position.

After 48 lessons you know dozens of techniques. The hard part of a new problem is usually **step 4 of the 6-step method** (Lesson 2): spotting which technique it needs. This lesson collects the signals, so you can go from "I've never seen this" to "this is a sliding window" in a minute.

## Signal 1: the input size tells you the target complexity

Python manages very roughly 10⁷ simple steps per second (compiled languages perhaps 10⁸–10⁹). Coding judges usually allow about 1–2 seconds, so the limits on n say which complexity the intended solution has:

| Largest n | Target complexity | Typical techniques |
|---|---|---|
| ≤ 10 | O(n!) | permutations, backtracking |
| ≤ 20–25 | O(2ⁿ), O(2ⁿ · n) | subsets, bitmask DP, meet in the middle |
| ≤ 100–500 | O(n³) | Floyd-Warshall, interval DP |
| ≤ 2,000–5,000 | O(n²) | 2-D DP, all pairs |
| ≤ 10⁵–10⁶ | O(n log n) or O(n) | sorting, heaps, binary search, two pointers, hashing, sliding window |
| ≤ 10⁹ or more | O(log n) or O(1) | binary search on the answer, maths, fast exponentiation |

If n is 10⁵ and your idea is O(n²), it's the wrong idea, however correct it is.

## Signal 2: clue words

| Clue in the problem | Think of | Lessons |
|---|---|---|
| "sorted array", "find a pair", "in place" | two pointers, binary search | 7, 24 |
| "contiguous subarray / substring", "longest / shortest window" | sliding window | 8 |
| "sum of a range", "subarray sums to k" | prefix sums (+ hash map) | 9, 14 |
| "seen before", "duplicate", "count occurrences", "anagram" | hash set / dict / Counter | 13, 14 |
| "next greater", "previous smaller", "span" | monotonic stack | 18 |
| "matching brackets", "undo", "nested" | stack | 17 |
| "minimum / maximum of a sliding window" | monotonic deque | 19 |
| "recently used", "evict" | dict + linked list (OrderedDict) | 20 |
| "all subsets / permutations / combinations", "place n queens" | backtracking | 23 |
| "minimise the maximum", "smallest x such that…" | binary search on the answer | 25 |
| "k-th largest", "top k", "closest k", "merge k sorted" | heap | 32 |
| "running median" | two heaps | 32 |
| "prefix", "autocomplete", "dictionary of words" | trie | 33 |
| "range query with updates" | Fenwick or segment tree | 34 |
| "grid", "islands", "connected", "reach" | BFS / DFS | 35 |
| "shortest path", "fewest steps" (unweighted) | BFS | 36 |
| "prerequisites", "order of tasks", "dependencies" | topological sort | 37 |
| "cheapest route", "weighted" | Dijkstra, Bellman-Ford | 38 |
| "groups merge", "connect", "redundant edge" | union-find | 39 |
| "count the ways", "minimum cost", "is it possible", choices that affect later choices | dynamic programming | 41–44 |
| "intervals", "meetings", "overlap" | sort + sweep, heap | 46 |
| "appears once while others appear twice", "subsets of ≤ 20 items" | bit manipulation | 47 |
| "modulo 10⁹ + 7", "primes", "divisible" | number theory | 48 |

## Signal 3: which operation must be fast?

Often the brute force is fine except for **one** repeated operation. Pick the structure that makes that operation cheap:

| Repeated operation | Structure | Cost |
|---|---|---|
| "Is x here?", "how many times?" | `set`, `dict`, `Counter` | O(1) |
| Smallest / largest, with inserts | heap | O(log n) |
| Items in sorted order, with inserts and "next bigger than x" | sorted list + `bisect`, or `SortedList` | O(log n) search |
| Add / remove at both ends | `deque` | O(1) |
| Last in, first out | list as a stack | O(1) |
| Range sums on fixed data | prefix sums | O(1) per query |
| "Are a and b connected?" while merging groups | union-find | ~O(1) |
| Strings by prefix | trie | O(length) |

## Edge-case checklist

Run through this list before you say "done":

- **Empty** input, a **single** item, **two** items.
- All items **equal**; already **sorted**; sorted in **reverse**.
- **Negative** numbers, **zero**, very **large** numbers (and overflow in other languages).
- **Duplicates**, where the problem assumed distinct values.
- The answer at the **very start** or **very end**; **no** valid answer (−1, None, empty list).
- Off-by-one: inclusive vs exclusive ranges, `<` vs `<=` in loops and binary search.
- Deep recursion on the largest input (use a loop or an explicit stack).

## The Python interview toolkit

Knowing the standard library saves minutes and bugs. These are the pieces used most in this course:

```python
from collections import Counter, defaultdict, deque
from itertools import accumulate, combinations, pairwise, groupby
from bisect import bisect_left, insort
from functools import cache
import heapq, math

words = "the quick cat and the lazy dog and the cat".split()
print(Counter(words).most_common(2))                     # counting
groups = defaultdict(list)
for w in words:
    groups[len(w)].append(w)                             # grouping without key checks
print(dict(groups))
print(list(accumulate([3, 1, 4, 1, 5])))                 # prefix sums
print(list(pairwise([1, 4, 9, 16])))                     # neighbouring pairs (3.10+)
print([(k, len(list(g))) for k, g in groupby("aaabccdd")])   # run-length groups
print(list(combinations("abc", 2)))
q = deque([1, 2, 3]); q.appendleft(0); q.pop(); print(q)
s = [10, 20, 30]; insort(s, 25); print(s, bisect_left(s, 25))
print(heapq.nlargest(2, [5, 1, 9, 3]), math.inf > 10**100)
print(sorted(words, key=lambda w: (-len(w), w))[:3])     # sort by length descending, then alphabetically
```

| Need | Use |
|---|---|
| counts, most common | `Counter`, `.most_common(k)` |
| dict of lists / ints without key checks | `defaultdict(list)`, `defaultdict(int)` |
| queue / deque / sliding window | `deque`, `.popleft()`, `deque(maxlen=k)` |
| heap, top k | `heapq.heappush/heappop`, `nlargest`, `nsmallest`, `merge` |
| sorted insert, lower/upper bound | `bisect_left`, `bisect_right`, `insort` |
| prefix sums, pairs, groups | `accumulate`, `pairwise`, `groupby` |
| subsets, orders, grids of options | `combinations`, `permutations`, `product` |
| memoisation, custom sort | `@cache`, `cmp_to_key` |
| integer maths | `math.gcd`, `math.lcm`, `math.isqrt`, `math.comb`, `pow(a, b, m)` |
| infinity | `math.inf` or `float("inf")` |

## Talking through a problem

Interviewers grade **how** you get to the answer as much as the answer:

1. Restate the problem and ask about the input: sizes, sorted or not, duplicates, negative numbers, what to return when there's no answer.
2. Work through an example out loud.
3. State the brute force and its complexity **before** optimising: "Checking every pair is O(n²); n is 10⁵, so I need better."
4. Name the pattern and why it fits: "The array is sorted and we want a pair, so two pointers."
5. Code it cleanly with clear names; narrate the tricky lines.
6. Test with your example and an edge case; then give the final time and space complexity.

If you're stuck, say what you've ruled out and why; ask for a hint early rather than late; and offer the brute force rather than nothing.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| n ≤ 10 / 20 / 500 / 5,000 / 10⁶ / 10⁹ | n! / 2ⁿ / n³ / n² / n log n / log n | — | — |
| Product of all others, no division | left products × right products | O(n) | O(1) extra |
| Top k frequent | Counter + buckets by count (or most_common(k)) | O(n) (O(n log k)) | O(n) |
| Counting / grouping | Counter, defaultdict | O(n) | O(n) |
| Sorted inserts and lower bounds | bisect_left, insort | O(log n) search, O(n) insert | O(n) |

## Common mistakes

- Optimising before having any correct solution.
- Ignoring the input limits, which say which complexity is needed.
- Testing only the given example and skipping the edge cases.
- Coding silently in an interview instead of explaining the approach and trade-offs.

## Exercises

### 1. Product of everything else

Write `product_except_self(nums)` returning a list where item i is the product of every number in `nums` **except** `nums[i]`. Don't use division (the list may contain zeros), and make it O(n): 100,000 numbers in well under a second.

Starter code:

```python
def product_except_self(nums):
    pass

print(product_except_self([1, 2, 3, 4]))       # [24, 12, 8, 6]
print(product_except_self([-1, 1, 0, -3, 3]))  # [0, 0, 9, 0, 0]
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** no division; zeros and negatives allowed; the output has the same length.
2. **Examples:** [1, 2, 3, 4] → [24, 12, 8, 6].
3. **Brute force:** for each i, multiply all the others: O(n²). Dividing the total by `nums[i]` fails on zeros (and is banned here).
4. **Pattern:** **prefix and suffix products**.
5. **Plan:** a left-to-right pass storing left products, then a right-to-left pass multiplying in right products.
6. **Code and test:** one zero, two zeros, two numbers, negatives.

</details>

<details>
<summary>💡 Hint 1</summary>

The product of everything except `nums[i]` splits into two parts. Which?

</details>

<details>
<summary>💡 Hint 2</summary>

The product of everything to the **left** of i times the product of everything to the **right** of i. Both can be built as running products, like prefix sums (Lesson 9).

</details>

<details>
<summary>💡 Hint 3</summary>

First pass left to right: `answer[i] = left; left *= nums[i]`. Second pass right to left: `answer[i] *= right; right *= nums[i]`.

</details>

### 2. Top k frequent

Write `top_k_frequent(nums, k)` returning the `k` most frequent values in `nums`, in any order. The answer is guaranteed to be unique (no ties at the cut-off).

Starter code:

```python
from collections import Counter

def top_k_frequent(nums, k):
    pass

print(top_k_frequent([1, 1, 1, 2, 2, 3], 2))   # [1, 2] in any order
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** k values with the highest counts; any order; no ties at the boundary.
2. **Examples:** [1, 1, 1, 2, 2, 3], k = 2 → [1, 2].
3. **Brute force:** count, then sort the distinct values by count: O(n log n), already acceptable.
4. **Pattern:** **counting + bucket sort** (or a heap of size k).
5. **Plan:** Counter, buckets indexed by frequency, read from the top.
6. **Code and test:** k = 1, k = number of distinct values, negatives.

</details>

<details>
<summary>💡 Hint 1</summary>

First count how often each value appears. Then you need the k values with the largest counts.

</details>

<details>
<summary>💡 Hint 2</summary>

`Counter(nums).most_common(k)` does it (O(n log n) or O(n log k)). A heap of size k works too. For O(n), use **bucket sort**: a frequency can't exceed n.

</details>

<details>
<summary>💡 Hint 3</summary>

Make `buckets[f]` = the values appearing f times, for f from 0 to n. Walk f from n down to 1, collecting values until you have k.

</details>

**In the sandbox:** exercises 101–102. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Product of everything else</summary>

```python
def product_except_self(nums):
    n = len(nums)
    answer = [1] * n
    left = 1
    for i in range(n):
        answer[i] = left            # product of everything to the left of i
        left *= nums[i]
    right = 1
    for i in range(n - 1, -1, -1):
        answer[i] *= right          # times the product of everything to the right of i
        right *= nums[i]
    return answer

print(product_except_self([1, 2, 3, 4]))
print(product_except_self([-1, 1, 0, -3, 3]))
```

**Line by line**

- After the first loop, `answer[i]` is the product of `nums[0..i−1]` (1 for i = 0).
- The second loop walks backwards with `right` = the product of `nums[i+1..]`, multiplying it in.
- Each value is used in the running product only **after** being skipped for its own position, which is what "except self" needs.
- Two passes and one output list: no division anywhere, so zeros are handled naturally.

**Trace** on [1, 2, 3, 4]:

| i | left before | after pass 1 | right before | final answer[i] |
|---|---|---|---|---|
| 0 | 1 | 1 | 24 | 24 |
| 1 | 1 | 1 | 12 | 12 |
| 2 | 2 | 2 | 4 | 8 |
| 3 | 6 | 6 | 1 | 6 |

**Complexity:** O(n) time, O(1) extra space besides the output.

**Common wrong approach:** total product divided by `nums[i]`: it crashes (or is wrong) as soon as the list contains a zero.

</details>

<details>
<summary>✅ 2. Top k frequent</summary>

```python
from collections import Counter

def top_k_frequent(nums, k):
    counts = Counter(nums)
    buckets = [[] for _ in range(len(nums) + 1)]      # buckets[f]: values seen exactly f times
    for value, f in counts.items():
        buckets[f].append(value)
    result = []
    for f in range(len(nums), 0, -1):                 # from the highest frequency down
        for value in buckets[f]:
            result.append(value)
            if len(result) == k:
                return result
    return result

print(top_k_frequent([1, 1, 1, 2, 2, 3], 2))
```

**Line by line**

- `Counter` counts every value in O(n).
- Frequencies are between 1 and n, so a list of n + 1 buckets can hold every value at its frequency: no comparison sort needed.
- Reading buckets from the highest frequency down yields values in decreasing frequency; stop at k.

**Trace** on [1, 1, 1, 2, 2, 3], k = 2: counts {1: 3, 2: 2, 3: 1}; buckets[3] = [1], buckets[2] = [2], buckets[1] = [3]; reading down collects 1, then 2: done.

**Complexity:** O(n) time and space. `Counter.most_common(k)` uses a heap: O(n log k).

**Common wrong approach:** returning the first k distinct values or sorting the values themselves instead of their counts.

</details>

## Quick quiz

1. The input size is up to 10⁵. Which complexity should you aim for?
   - A) O(2ⁿ)
   - B) O(n log n) or better
   - C) O(n²)

2. "Find the minimum time such that all the work finishes" with a yes/no check that's easy for a given time suggests:
   - A) Binary search on the answer
   - B) Topological sort
   - C) A trie

3. You repeatedly need the smallest item while also inserting new ones. Which structure?
   - A) A heap
   - B) A stack
   - C) A sorted list rebuilt each time

4. Which of these is the best first move in an interview after understanding the question?
   - A) Ask for the answer
   - B) Work an example and state a brute-force solution with its complexity
   - C) Start coding the most optimised solution immediately

<details>
<summary>Quiz answers</summary>

1. **B) O(n log n) or better**: 10¹⁰ steps (n²) is far too slow; 10⁵ × 17 is fine.
2. **A) Binary search on the answer**: If time t works, any larger t also works: a monotonic test.
3. **A) A heap**: Push and pop-min are O(log n).
4. **B) Work an example and state a brute-force solution with its complexity**: A correct baseline and a clear complexity target guide the optimisation.

</details>

---
Previous: [Lesson 48](48-number-theory.md) · Next: [Lesson 50: Mock interviews](50-mock-interviews.md)
