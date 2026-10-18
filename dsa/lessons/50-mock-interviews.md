# Lesson 50: Mock interviews

**You'll learn:** the 6-step method in a full interview, longest consecutive sequence with a hash set, a time-based key-value store with binary search, follow-up questions, trapping rain water with two pointers, minimum window substring with a sliding window, decoding nested strings with a stack, how to keep practising.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/dsa/#mock-interviews)**: run every example and check your exercise answers.

## Key terms

- **Mock interview:** practising a problem under interview conditions: timed, explained aloud, tested.
- **Follow-up question:** an interviewer's change to the problem to see how the design adapts.
- **Running maximum:** the largest value seen so far while scanning, updated in O(1) per step.
- **Variable-size sliding window:** a window that grows on the right until valid and shrinks on the left while it stays valid.
- **Mixed practice:** solving problems without being told which technique they need.

This last lesson puts everything together. Each worked problem follows the 6-step method exactly as you'd say it out loud in an interview: understand, examples, brute force, pattern, plan, code and test. Then it's your turn with three well-known problems that mix several techniques.

## Worked problem 1: longest consecutive sequence

> Given an unsorted list of integers, return the length of the longest run of **consecutive** values (in any order in the list). It must be O(n).

**1. Understand.** [100, 4, 200, 1, 3, 2] contains 1, 2, 3, 4: length 4. Duplicates may appear and count once; an empty list gives 0. The O(n) requirement rules out sorting.

**2. Examples.** [0, 3, 7, 2, 5, 8, 4, 6, 0, 1] → 0..8 → 9. [] → 0. [5, 5] → 1.

**3. Brute force.** Sort, then count runs: O(n log n), simple and a good thing to say first. Without sorting, checking `x + 1 in list` repeatedly is O(n²) or worse.

**4. Pattern.** "Is x + 1 present?" in O(1) means a **hash set**. The waste in the naive set version is counting the same run from every member; only start counting at a value whose predecessor **isn't** in the set: the start of a run.

**5. Plan.** Put everything in a set. For each value x with x − 1 not in the set, count upwards while x + 1, x + 2, … are present. Track the longest run.

**6. Code and test.**

```python
def longest_consecutive(nums):
    values = set(nums)
    best = 0
    for x in values:
        if x - 1 in values:
            continue                    # not the start of a run: it'll be counted from its start
        length = 1
        while x + length in values:
            length += 1
        best = max(best, length)
    return best

for test in ([100, 4, 200, 1, 3, 2], [0, 3, 7, 2, 5, 8, 4, 6, 0, 1], [], [5, 5], [-2, -1, 1]):
    print(test, longest_consecutive(test))
```

**Complexity, said out loud:** "Each value is the start of at most one counted run, and each step of a run's `while` loop visits a different value, so the inner loop runs at most n times **in total**: O(n) time, O(n) space for the set."

## Worked problem 2: a time-based key-value store

> Design `TimeMap` with `set(key, value, timestamp)` and `get(key, timestamp)`, which returns the value set for that key at the **latest timestamp ≤ the given one** (or "" if none). Timestamps passed to `set` are strictly increasing.

**1–2. Understand and examples.** set("foo", "bar", 1); get("foo", 1) → "bar"; get("foo", 3) → "bar"; set("foo", "bar2", 4); get("foo", 4) → "bar2"; get("foo", 3) → "bar"; get("foo", 0) → "".

**3. Brute force.** Store a list of (timestamp, value) per key and scan it backwards on every `get`: O(n) per query.

**4. Pattern.** Timestamps arrive **in increasing order**, so each key's list is already **sorted**: "the latest timestamp ≤ t" is a **binary search** (`bisect_right` − 1), O(log n). A dict of lists gives per-key storage.

**5–6. Plan, code and test.**

```python
from bisect import bisect_right
from collections import defaultdict

class TimeMap:
    def __init__(self):
        self.times = defaultdict(list)      # key -> sorted timestamps
        self.values = defaultdict(list)     # key -> values, in the same order

    def set(self, key, value, timestamp):
        self.times[key].append(timestamp)   # stays sorted: timestamps only increase
        self.values[key].append(value)

    def get(self, key, timestamp):
        i = bisect_right(self.times[key], timestamp) - 1   # the last timestamp <= the query
        return self.values[key][i] if i >= 0 else ""

tm = TimeMap()
tm.set("foo", "bar", 1)
print(repr(tm.get("foo", 1)), repr(tm.get("foo", 3)))
tm.set("foo", "bar2", 4)
print(repr(tm.get("foo", 4)), repr(tm.get("foo", 3)), repr(tm.get("foo", 0)), repr(tm.get("nope", 5)))
```

**Follow-up questions to expect:** "What if timestamps can arrive out of order?" (insert with `insort`, O(n) per set, or use a balanced tree / `SortedList`); "What about memory for keys with millions of versions?" (keep only recent versions, or archive old ones). Thinking about follow-ups shows depth.

## Three practice problems

The exercises below are interview classics that combine techniques: **two pointers** with a running maximum, a **sliding window** with counts, and a **stack** (or recursion) for nested structure.

![The elevation map [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1] drawn as grey bars, with the trapped water shown in blue between them. Water above each bar reaches the smaller of the tallest bar on its left and the tallest on its right; 6 units are trapped in total](../figures/rain-water.svg)

## Keep practising

- **Mix your practice.** After a course organised by topic, the real skill is choosing the technique. Practise **mixed** problem sets where the topic isn't announced, and use the clue-word table from Lesson 49.
- **Space it out.** Re-solve problems you found hard after a few days, then a few weeks, without looking at your old solution.
- **Time yourself** (about 20–35 minutes per medium problem) and practise explaining aloud, as you would to an interviewer.
- **Write the brute force first** when stuck, then ask where it wastes work.
- **Use online judges** (LeetCode, HackerRank, Codeforces and similar) for a steady supply of problems with hidden tests, like the checks in this course.
- **Use AI assistants as a tutor, not a crutch:** ask for a hint or to explain a concept or a bug, but write the solution yourself; the skill only grows when you do the thinking.
- **Keep the cheat sheet and glossary** of this course nearby; they summarise every pattern and its complexity.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Longest consecutive sequence | set; count runs only from values with no predecessor | O(n) | O(n) |
| Time-based key-value store | dict of sorted lists + bisect_right | O(1) set, O(log n) get | O(n) |
| Trapping rain water | two pointers; move the lower side with its running max | O(n) | O(1) |
| Minimum window substring | sliding window with need counts and a missing counter | O(len(s) + len(t)) | O(alphabet) |
| Decode nested string | stack of (text before, count) | O(output) | O(depth + output) |

## Common mistakes

- Counting a consecutive run from every member instead of only from its start.
- Using a set where duplicates matter (minimum window needs counts).
- Reading only one digit of a multi-digit repeat count.
- Practising only one topic at a time and never choosing the technique yourself.

## Exercises

### 1. Trapping rain water

`heights` gives the heights of bars of width 1. Write `trap(heights)` returning how many units of rain water are trapped between the bars after it rains. It must be O(n): 200,000 bars in well under a second.

Starter code:

```python
def trap(heights):
    pass

print(trap([0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]))   # 6
print(trap([4, 2, 0, 3, 2, 5]))                     # 9
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** bars of width 1; water can't spill over the ends; return the total.
2. **Examples:** [3, 0, 3] → 3; [1, 2, 3, 4] → 0.
3. **Brute force:** for each bar, scan for the tallest on each side: O(n²).
4. **Pattern:** **prefix maximums**, refined into **two pointers** with running maximums.
5. **Plan:** pointers at both ends; process the lower side, adding `side_max - height`.
6. **Code and test:** empty, one bar, rising heights, a lower right wall.

</details>

<details>
<summary>💡 Hint 1</summary>

How much water sits above one bar? It depends on the tallest bar to its left and the tallest bar to its right.

</details>

<details>
<summary>💡 Hint 2</summary>

Water above bar i is `min(max_left, max_right) - heights[i]`. Precomputing both maximums as arrays gives O(n) time and O(n) space. Can two pointers avoid the arrays?

</details>

<details>
<summary>💡 Hint 3</summary>

Move pointers inwards from both ends, keeping `left_max` and `right_max`. Always move the side with the **lower** bar: that side's maximum is the limiting wall, because the other side is known to have something at least as tall.

</details>

### 2. Minimum window substring

Write `min_window(s, t)` returning the shortest substring of `s` that contains every character of `t` (counting duplicates: if t has two "a"s, the window needs two). Return "" if there's none; if several shortest windows exist, return the leftmost. It must be O(len(s) + len(t)): a 100,000-character `s` in well under a second.

Starter code:

```python
from collections import Counter

def min_window(s, t):
    pass

print(min_window("ADOBECODEBANC", "ABC"))   # "BANC"
print(min_window("a", "aa"))                # ""
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** counts matter (duplicates in t); shortest window; leftmost on ties; "" if impossible.
2. **Examples:** "ADOBECODEBANC", "ABC" → "BANC"; "a", "aa" → "".
3. **Brute force:** every start, extend until valid: O(n²) windows (each check also costs time).
4. **Pattern:** **sliding window with counts** and a `missing` counter for O(1) validity checks.
5. **Plan:** expand right; while valid, record and shrink from the left.
6. **Code and test:** duplicates in t, impossible cases, answer at the end, ties.

</details>

<details>
<summary>💡 Hint 1</summary>

"Shortest substring containing…" is a variable-size **sliding window** (Lesson 8). When should the window grow, and when should it shrink?

</details>

<details>
<summary>💡 Hint 2</summary>

Grow the right edge until the window contains everything; then shrink from the left while it still does, recording the length each time. To check validity in O(1), keep `need` counts and a single number `missing` of characters still needed.

</details>

<details>
<summary>💡 Hint 3</summary>

`need = Counter(t)`, `missing = len(t)`. For each new char: if `need[ch] > 0`, `missing -= 1`; then `need[ch] -= 1`. While `missing == 0`: record the window, add the left char back (`need[s[left]] += 1`; if it becomes > 0, `missing += 1`), and move `left` on.

</details>

### 3. Decode string

Strings are encoded as `k[text]`, meaning `text` repeated k times; brackets can nest, and plain letters can appear anywhere. Write `decode(s)` returning the decoded string. For example "3[a2[c]]" → "accaccacc". k is a positive integer that may have several digits.

Starter code:

```python
def decode(s):
    pass

print(decode("3[a]2[bc]"))     # aaabcbc
print(decode("3[a2[c]]"))      # accaccacc
print(decode("2[abc]3[cd]ef")) # abcabccdcdcdef
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** nested groups; multi-digit counts; letters outside groups; empty input.
2. **Examples:** "3[a2[c]]": inner "2[c]" → "cc", so "acc" × 3.
3. **Brute force:** repeatedly find an innermost `k[...]` with a regular expression and expand it until none remain: correct, but each pass rebuilds the string.
4. **Pattern:** **stack for nested structure** (recursion works too).
5. **Plan:** scan once; digits build a number; `[` pushes state; `]` pops and repeats; letters append.
6. **Code and test:** two-digit counts, three nesting levels, text before and after groups.

</details>

<details>
<summary>💡 Hint 1</summary>

Brackets nest, like the bracket-matching problem in Lesson 17. What must you remember when you meet `[`, so you can finish the job at the matching `]`?

</details>

<details>
<summary>💡 Hint 2</summary>

At `[`, push the text built so far and the repeat count onto a stack, then start fresh. At `]`, pop them and set `current = text_before + current * count`.

</details>

<details>
<summary>💡 Hint 3</summary>

Keep `current` (the text being built) and `number` (digits read so far: `number = number * 10 + int(ch)`). Letters are appended to `current`. Return `current` at the end.

</details>

**In the sandbox:** exercises 103–105. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Trapping rain water</summary>

```python
def trap(heights):
    left, right = 0, len(heights) - 1
    left_max = right_max = 0
    water = 0
    while left < right:
        if heights[left] < heights[right]:
            # the right side has a bar at least this tall, so the left wall decides the water here
            left_max = max(left_max, heights[left])
            water += left_max - heights[left]
            left += 1
        else:
            right_max = max(right_max, heights[right])
            water += right_max - heights[right]
            right -= 1
    return water

print(trap([0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]))
print(trap([4, 2, 0, 3, 2, 5]))
```

**Line by line**

- If `heights[left] < heights[right]`, there's a bar on the right at least as tall as anything we need: the water at `left` is limited only by `left_max`, which we know exactly.
- Updating `left_max` first means a bar taller than everything before it adds 0 water and becomes the new wall.
- The symmetric branch handles the right side. Each step moves one pointer inwards, so the loop runs n − 1 times.

**Trace** on [4, 2, 0, 3, 2, 5]:

| left, right | lower side | side max | water added | total |
|---|---|---|---|---|
| 0, 5 | left (4 < 5) | 4 | 0 | 0 |
| 1, 5 | left (2) | 4 | 2 | 2 |
| 2, 5 | left (0) | 4 | 4 | 6 |
| 3, 5 | left (3) | 4 | 1 | 7 |
| 4, 5 | left (2) | 4 | 2 | **9** |

**Complexity:** O(n) time, O(1) space.

**Common wrong approach:** adding up dips between neighbouring bars only. Water depends on the tallest bars anywhere to the left and right, not on the neighbours.

</details>

<details>
<summary>✅ 2. Minimum window substring</summary>

```python
from collections import Counter

def min_window(s, t):
    need = Counter(t)             # how many more of each character the window needs (negative = spare)
    missing = len(t)              # characters of t still missing from the window
    left = 0
    best_len, best_start = float("inf"), 0
    for right, ch in enumerate(s):
        if need[ch] > 0:
            missing -= 1          # this character fills a real need
        need[ch] -= 1
        while missing == 0:       # the window s[left..right] is valid: try to shrink it
            if right - left + 1 < best_len:
                best_len, best_start = right - left + 1, left
            need[s[left]] += 1
            if need[s[left]] > 0:
                missing += 1      # removed a needed character: the window is no longer valid
            left += 1
    return "" if best_len == float("inf") else s[best_start:best_start + best_len]

print(min_window("ADOBECODEBANC", "ABC"))
print(min_window("a", "aa"))
```

**Line by line**

- `need[c]` starts as the count of c in t; it goes negative when the window holds spare copies.
- `missing` counts characters of t not yet covered. A character only reduces it if it was still needed (`need[ch] > 0` before decrementing).
- While `missing == 0`, every window from `left` to `right` is valid; recording before shrinking means the shortest valid window ending at `right` is seen. Strict `<` keeps the leftmost on ties.
- Removing `s[left]` gives back one copy; if that makes its need positive, the window just lost a required character.
- Each index enters and leaves the window once: O(n).

**Trace** on s = "bba", t = "ab" (need a: 1, b: 1, missing 2):

| right | char | missing after | valid windows recorded | left after |
|---|---|---|---|---|
| 0 | b | 1 | — | 0 |
| 1 | b | 1 (spare b) | — | 0 |
| 2 | a | 0 | "bba" (3), then "ba" (2) | 2 |

**Complexity:** O(len(s) + len(t)) time, O(alphabet) space.

**Common wrong approach:** using a set of t's characters, which ignores duplicates ("aa" needs two a's), or checking the whole `Counter` for validity at every step, which multiplies the work by the alphabet size.

</details>

<details>
<summary>✅ 3. Decode string</summary>

```python
def decode(s):
    stack = []                     # (text before the bracket, repeat count) for each open bracket
    current, number = "", 0
    for ch in s:
        if ch.isdigit():
            number = number * 10 + int(ch)          # counts can have several digits
        elif ch == "[":
            stack.append((current, number))         # save where we were
            current, number = "", 0                 # start the text inside the brackets
        elif ch == "]":
            before, k = stack.pop()
            current = before + current * k          # finish the group and rejoin the outer text
        else:
            current += ch
    return current

print(decode("3[a]2[bc]"))
print(decode("3[a2[c]]"))
print(decode("2[abc]3[cd]ef"))
```

**Line by line**

- `number = number * 10 + int(ch)` turns consecutive digits like "10" into 10.
- At `[`, the outer text and the count are saved, and `current` restarts for the inside of the group.
- At `]`, the inner text is repeated and appended to the saved outer text, which becomes `current` again: exactly how nesting unwinds.
- Letters simply extend `current`, inside or outside brackets.

**Trace** on "3[a2[c]]":

| char | stack | current | number |
|---|---|---|---|
| 3 | | "" | 3 |
| [ | ("", 3) | "" | 0 |
| a | ("", 3) | "a" | 0 |
| 2 | ("", 3) | "a" | 2 |
| [ | ("", 3), ("a", 2) | "" | 0 |
| c | ("", 3), ("a", 2) | "c" | 0 |
| ] | ("", 3) | "a" + "c" × 2 = "acc" | 0 |
| ] | — | "" + "acc" × 3 = **"accaccacc"** | 0 |

**Complexity:** O(length of the output) time (building the repeated strings), O(nesting depth + output) space.

**Common wrong approach:** reading only one digit for the count, so "10[a]" becomes "0[a]" after a stray "1".

</details>

## Quick quiz

1. In "longest consecutive sequence", why only start counting at x when x − 1 isn't in the set?
   - A) To sort the numbers
   - B) So each run is counted once from its start, keeping the total work O(n)
   - C) Because negative numbers aren't allowed

2. Why is binary search valid in the TimeMap's get?
   - A) Timestamps are appended in increasing order, so each key's list is already sorted
   - B) Because keys are sorted
   - C) Python lists are always sorted

3. In the two-pointer rain-water solution, which side moves?
   - A) The side with the lower bar, because its own maximum limits the water there
   - B) The side with the taller bar
   - C) Always the left side

4. What is the best way to practise after finishing a topic-by-topic course?
   - A) Mixed problem sets where the technique isn't announced, revisited over time
   - B) Memorising solutions word for word
   - C) Re-reading the same lesson many times

<details>
<summary>Quiz answers</summary>

1. **B) So each run is counted once from its start, keeping the total work O(n)**: Counting from every member of a run would make it O(n²).
2. **A) Timestamps are appended in increasing order, so each key's list is already sorted**: "Latest timestamp ≤ t" is bisect_right − 1 on a sorted list.
3. **A) The side with the lower bar, because its own maximum limits the water there**: The other side is known to have a bar at least as tall.
4. **A) Mixed problem sets where the technique isn't announced, revisited over time**: Choosing the technique is the skill interviews test.

</details>

---
Previous: [Lesson 49](49-problem-patterns.md) · Back to the [course home](../README.md)
