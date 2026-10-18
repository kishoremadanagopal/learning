# Lesson 14: Hashing patterns: counting, Two Sum, grouping

**You'll learn:** counting with Counter and dict.get, first unique character, Two Sum with complements, grouping with defaultdict, choosing a key, prefix sums with a hash map, longest consecutive sequence, pattern summary.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/dsa/#hashing-patterns)**: run every example and check your exercise answers.

## Key terms

- **Frequency count:** how many times each item appears, usually in a dict or Counter.
- **Counter:** a dict subclass from collections that counts items; missing keys count as 0.
- **defaultdict:** a dict that creates a default value (like an empty list) for missing keys.
- **Complement:** the value needed to complete a pair, such as target − x.
- **Grouping key:** a normalised form shared by everything that belongs together, like sorted letters for anagrams.
- **Prefix-sum count:** a dict from each prefix sum to how often it has appeared, used to count subarrays with a given sum.
- **Consecutive sequence:** integers that follow each other without gaps, like 3, 4, 5.

Whenever a brute force asks "have I seen this before?" or "how many times?", a hash map usually turns O(n²) into O(n). This lesson collects the patterns.

## 1. Counting with Counter

```python
from collections import Counter

words = "the cat and the hat and the bat".split()
counts = Counter(words)
print(counts)
print(counts["the"], counts["dog"])          # missing keys count as 0
print(counts.most_common(2))

# the same by hand, which is what Counter does
manual = {}
for w in words:
    manual[w] = manual.get(w, 0) + 1
print(manual)
```

First unique character: count everything, then scan again in order:

```python
from collections import Counter

def first_unique(s):
    counts = Counter(s)
    for i, ch in enumerate(s):
        if counts[ch] == 1:
            return i
    return -1

print(first_unique("leetcode"), first_unique("loveleetcode"), first_unique("aabb"))
```

## 2. "Have I seen the complement?": Two Sum

> Given numbers and a target, return the indexes of two numbers that add up to the target.

For each number `x`, the partner we need is `target - x` (its **complement**). Remember every number we've passed in a dict of value → index; then each check is O(1):

![Walking through [2, 7, 11, 15] looking for target 9. At 2, the needed partner is 7, which hasn't been seen, so 2 is stored with index 0. At 7, the needed partner is 2, which is in the dict with index 0, so the answer is [0, 1]](../figures/two-sum.svg)

```python
def two_sum(nums, target):
    seen = {}                          # value -> index
    for i, x in enumerate(nums):
        need = target - x
        if need in seen:
            return [seen[need], i]
        seen[x] = i                    # store AFTER checking, so x can't pair with itself
    return []

print(two_sum([2, 7, 11, 15], 9), two_sum([3, 2, 4], 6), two_sum([3, 3], 6))
```

Compare with the two-pointer version in Lesson 7: that needs **sorted** input and O(1) space; this works on **any** order, with O(n) space.

## 3. Grouping by a key: anagrams

Words that are anagrams of each other share the same **sorted letters**. Use that as the dict key and collect the words in lists. `defaultdict(list)` creates an empty list the first time a key is used:

```python
from collections import defaultdict

def group_anagrams(words):
    groups = defaultdict(list)
    for w in words:
        groups["".join(sorted(w))].append(w)       # "eat", "tea", "ate" -> key "aet"
    return list(groups.values())

print(group_anagrams(["eat", "tea", "tan", "ate", "nat", "bat"]))
```

Choosing the right **key** is the whole trick. Others you'll see: the tuple of 26 letter counts (avoids sorting), a normalised form (lowercase, no spaces), or `(row // 3, col // 3)` for Sudoku boxes.

## 4. Prefix sums + hash map: subarray sum equals k

How many contiguous subarrays add up to k? Negative numbers rule out a sliding window. With prefix sums, a subarray `i..j` sums to k exactly when `prefix[j + 1] - prefix[i] == k`, so at each position, ask: **how many earlier prefix sums equal `current - k`?** Count prefix sums in a dict as you go.

```python
def count_subarrays_sum_k(nums, k):
    counts = {0: 1}            # the empty prefix (sum 0) has been seen once
    current = answer = 0
    for x in nums:
        current += x
        answer += counts.get(current - k, 0)      # subarrays ending here with sum k
        counts[current] = counts.get(current, 0) + 1
    return answer

print(count_subarrays_sum_k([1, 1, 1], 2))          # [1,1] twice
print(count_subarrays_sum_k([1, -1, 1, -1], 0))     # four subarrays sum to 0
```

## 5. Sets for O(1) "is it there?": longest consecutive sequence

Find the length of the longest run of consecutive integers (in any order) in O(n). Put everything in a set; only **start counting from numbers that begin a run** (whose predecessor isn't in the set), so each number is visited a constant number of times:

```python
def longest_consecutive(nums):
    values = set(nums)
    best = 0
    for x in values:
        if x - 1 not in values:            # x starts a run
            length = 1
            while x + length in values:
                length += 1
            best = max(best, length)
    return best

print(longest_consecutive([100, 4, 200, 1, 3, 2]))    # 1, 2, 3, 4
```

## Pattern summary

| Clue | Hash pattern | Key → value |
|---|---|---|
| "how many times", "most frequent" | counting | item → count |
| "two numbers that sum to", "pair with difference" | complement lookup | value → index |
| "group", "anagrams", "same pattern" | grouping | normalised key → list |
| "subarray sum equals k" (negatives allowed) | prefix sum counts | prefix sum → how many times |
| "consecutive", "is it present" | set membership | value (set) |
| "first unique", "first repeated" | count, then scan in order | item → count |

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Counting | Counter or dict.get(x, 0) + 1 | O(n) | O(k) distinct items |
| Two Sum | for each x, look up target − x among numbers already seen | O(n) | O(n) |
| Group anagrams | key = sorted letters; dict of lists | O(n·k log k) | O(n·k) |
| Subarray sum equals k | count earlier prefix sums equal to current − k | O(n) | O(n) |
| Longest consecutive sequence | set; start counting only at numbers whose x − 1 is missing | O(n) | O(n) |

## Common mistakes

- Storing a number before checking its complement, so it pairs with itself.
- Forgetting `counts = {0: 1}` when counting subarray sums.
- Starting a run count from every number in "longest consecutive", which makes it O(n²).
- Using a sliding window for subarray sums when numbers can be negative.

## Exercises

### 1. Two Sum

Write `two_sum(nums, target)` returning `[i, j]` with `i < j` and `nums[i] + nums[j] == target`, or `[]` if no pair exists. The list is **not** sorted. Make it fast for 100,000 numbers.

Starter code:

```python
def two_sum(nums, target):
    pass
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** unsorted input; two **different** positions; return their indexes (smaller first) or [].
2. **Examples:** `[2, 7, 11, 15]`, 9 → [0, 1]. `[3, 3]`, 6 → [0, 1]. `[3]`, 6 → [] (can't reuse the same 3).
3. **Brute force:** all pairs: O(n²).
4. **Pattern:** "two numbers that sum to" + unsorted → **complement lookup** in a hash map.
5. **Plan:** dict value → index; for each number, look up its complement; if found, done; else store the number.
6. **Code and test:** storing **after** the check is what stops `[3]`, 6 from pairing 3 with itself.

</details>

<details>
<summary>💡 Hint 1</summary>

For a number `x`, which partner would complete the pair?

</details>

<details>
<summary>💡 Hint 2</summary>

The partner is `target - x`. Keep a dict of the numbers you've already seen, mapping each value to its index.

</details>

<details>
<summary>💡 Hint 3</summary>

For each `i, x`: if `target - x` is in the dict, return `[seen[target - x], i]`; otherwise `seen[x] = i`. Check before storing.

</details>

### 2. Group the anagrams

Write `group_anagrams(words)` that groups words that are anagrams of each other. Return a list of groups (lists). The order of the groups and of words inside a group doesn't matter.

Starter code:

```python
def group_anagrams(words):
    pass
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** split words into groups of anagrams; any order is fine.
2. **Examples:** ["eat", "tea", "tan", "ate", "nat", "bat"] → [eat, tea, ate], [tan, nat], [bat].
3. **Brute force:** for each word, compare with a representative of every existing group: O(n × groups).
4. **Pattern:** **grouping by a normalised key** in a hash map.
5. **Plan:** key = sorted letters; dict key → list of words; return the lists.
6. **Code and test:** the empty word "" has key "", which is fine.

</details>

<details>
<summary>💡 Hint 1</summary>

What do "eat", "tea" and "ate" have in common that "tan" doesn't?

</details>

<details>
<summary>💡 Hint 2</summary>

Sort the letters: all three become "aet". Use that as a dictionary key.

</details>

<details>
<summary>💡 Hint 3</summary>

`groups = defaultdict(list)`; for each word: `groups["".join(sorted(w))].append(w)`; return `list(groups.values())`.

</details>

### 3. Subarrays that sum to k

Write `count_subarrays(nums, k)` returning how many **contiguous** subarrays add up to exactly `k`. Numbers can be negative. Make it O(n): fast for 100,000 numbers.

Starter code:

```python
def count_subarrays(nums, k):
    pass
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** count (not find) contiguous subarrays with sum exactly k; negatives allowed, so no sliding window.
2. **Examples:** `[1, 1, 1]`, k = 2 → 2. `[0, 0, 0]`, k = 0 → 6 (every subarray).
3. **Brute force:** every start, extend to every end, keeping a running total: O(n²).
4. **Pattern:** **prefix sums + hash map of counts**: turn "sum of a range" into "difference of two prefix sums".
5. **Plan:** running sum; at each step add how many earlier prefix sums equal current − k; then record the current prefix sum.
6. **Code and test:** the `{0: 1}` start is what counts subarrays that begin at index 0.

</details>

<details>
<summary>💡 Hint 1</summary>

A subarray `i..j` sums to k exactly when `prefix[j + 1] - prefix[i] == k`.

</details>

<details>
<summary>💡 Hint 2</summary>

So at each position, count how many **earlier** prefix sums equal `current - k`. Keep those counts in a dict as you go.

</details>

<details>
<summary>💡 Hint 3</summary>

Start with `counts = {0: 1}` (the empty prefix). For each x: `current += x`; `answer += counts.get(current - k, 0)`; then `counts[current] += 1` (with get).

</details>

**In the sandbox:** exercises 26–28. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Two Sum</summary>

```python
def two_sum(nums, target):
    seen = {}
    for i, x in enumerate(nums):
        need = target - x
        if need in seen:
            return [seen[need], i]
        seen[x] = i
    return []
```

**Line by line**

- `seen = {}` maps each value already passed to its index.
- `need = target - x` is the only number that can pair with `x`.
- `if need in seen:` is O(1). If true, the earlier index is `seen[need]` and the current one is `i`, already in the right order.
- `seen[x] = i` comes **after** the check, so a number can't pair with itself; for `[3, 3]`, the second 3 finds the first one.

**Trace** on `[3, 2, 4]`, target 6:

| i | x | need | in seen? | seen after |
|---|---|---|---|---|
| 0 | 3 | 3 | no (empty) | {3: 0} |
| 1 | 2 | 4 | no | {3: 0, 2: 1} |
| 2 | 4 | 2 | **yes**, index 1 | return [1, 2] |

**Complexity:** O(n) time, O(n) space.

**Interview talking point:** if the input were sorted, two pointers would need only O(1) space. Mention the trade-off.

</details>

<details>
<summary>✅ 2. Group the anagrams</summary>

```python
from collections import defaultdict

def group_anagrams(words):
    groups = defaultdict(list)
    for w in words:
        key = "".join(sorted(w))      # all anagrams share their sorted letters
        groups[key].append(w)
    return list(groups.values())
```

**Line by line**

- `defaultdict(list)`: looking up a new key creates an empty list, so `.append` always works.
- `"".join(sorted(w))`: `sorted("tea")` is `['a', 'e', 't']`; joining gives `"aet"`. Every anagram of "tea" gets the same key.
- `list(groups.values())`: the groups, in the order their keys first appeared.

**Trace:**

| word | key | groups |
|---|---|---|
| eat | aet | {aet: [eat]} |
| tea | aet | {aet: [eat, tea]} |
| tan | ant | {aet: [eat, tea], ant: [tan]} |
| ate | aet | {aet: [eat, tea, ate], ant: [tan]} |
| nat | ant | … ant: [tan, nat] |
| bat | abt | … abt: [bat] |

**Complexity:** O(n · k log k) time for n words of length up to k (sorting each word), O(n · k) space.

**Faster key:** a tuple of 26 letter counts makes each key O(k) instead of O(k log k): `counts = [0] * 26; for ch in w: counts[ord(ch) - 97] += 1; key = tuple(counts)`.

</details>

<details>
<summary>✅ 3. Subarrays that sum to k</summary>

```python
def count_subarrays(nums, k):
    counts = {0: 1}               # prefix sum -> how many times it has appeared
    current = answer = 0
    for x in nums:
        current += x
        answer += counts.get(current - k, 0)
        counts[current] = counts.get(current, 0) + 1
    return answer
```

**Line by line**

- `counts = {0: 1}`: before any number, the prefix sum 0 has occurred once (the empty prefix). It lets a subarray starting at index 0 be counted.
- `current += x`: the prefix sum up to and including this number.
- `answer += counts.get(current - k, 0)`: every earlier prefix equal to `current - k` marks a start where the subarray up to here sums to k.
- Recording `current` **after** counting stops a prefix from pairing with itself (which would mean an empty subarray when k = 0).

**Trace** on `[1, 2, 3]`, k = 3:

| x | current | current − k | earlier count | answer | counts after |
|---|---|---|---|---|---|
| 1 | 1 | −2 | 0 | 0 | {0:1, 1:1} |
| 2 | 3 | 0 | 1 ([1, 2]) | 1 | {0:1, 1:1, 3:1} |
| 3 | 6 | 3 | 1 ([3]) | **2** | … |

**Complexity:** O(n) time, O(n) space.

</details>

## Quick quiz

1. In Two Sum with a dict, why store the current number only after checking for its complement?
   - A) It's faster
   - B) Dicts can't be read and written in the same step
   - C) So a number can't pair with itself

2. What's a good key for grouping anagrams?
   - A) The word's letters in sorted order
   - B) The word's length
   - C) The first letter

3. Why does "subarray sum equals k" start with counts = {0: 1}?
   - A) It counts subarrays that start at index 0
   - B) Because k is never 0
   - C) To avoid a KeyError

4. In longest consecutive sequence, why only start counting from x when x − 1 isn't in the set?
   - A) So each run is counted once from its start, keeping the total O(n)
   - B) Because negative numbers aren't allowed
   - C) To sort the numbers

<details>
<summary>Quiz answers</summary>

1. **C) So a number can't pair with itself**: With target 6 and [3], checking first means 3 doesn't find itself.
2. **A) The word's letters in sorted order**: All anagrams share their sorted letters; non-anagrams don't.
3. **A) It counts subarrays that start at index 0**: The empty prefix has sum 0, so a prefix equal to k itself is a valid subarray.
4. **A) So each run is counted once from its start, keeping the total O(n)**: Starting from every number would recount the same run many times.

</details>

---
Previous: [Lesson 13](13-hash-tables.md) · Next: [Lesson 15: Linked lists](15-linked-lists.md)
