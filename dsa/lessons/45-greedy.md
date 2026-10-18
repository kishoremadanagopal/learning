# Lesson 45: Greedy algorithms

**You'll learn:** the greedy-choice property, exchange arguments, activity selection, greedy counterexamples, fractional knapsack, jump games, the gas station, Huffman coding, two-pointer pairing, testing greedy rules against brute force.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/dsa/#greedy)**: run every example and check your exercise answers.

## Key terms

- **Greedy algorithm:** an algorithm that makes the locally best choice at each step and never reconsiders.
- **Greedy-choice property:** some optimal solution begins with the greedy choice.
- **Exchange argument:** a proof that swapping the greedy choice into an optimal solution keeps it optimal.
- **Activity selection:** choosing the most non-overlapping intervals; solved by earliest end first.
- **Fractional knapsack:** a knapsack where items can be split; solved by value per weight.
- **Huffman coding:** an optimal prefix code built by repeatedly merging the two least frequent symbols.
- **Prefix code:** a set of codes where no code is the start of another, so decoding is unambiguous.

A **greedy algorithm** builds its answer one step at a time, always taking the choice that looks best **right now**, and never reconsidering. When it works, it's usually the simplest and fastest solution, often just a sort and a loop. The catch: it doesn't always work, and a wrong greedy looks just as convincing as a right one.

A greedy approach is correct when the problem has:

- **The greedy-choice property:** some optimal solution starts with the greedy choice.
- **Optimal substructure:** after making that choice, what's left is a smaller instance of the same problem.

The usual proof is an **exchange argument**: take any optimal solution that doesn't start with the greedy choice, swap the greedy choice in, and show the result is no worse. If you can't make that argument, suspect DP.

## Activity selection: the most non-overlapping meetings

Given meetings as (start, end), attend as many as possible with no two overlapping. The greedy rule that works: **always pick the meeting that ends first**, then the next one that starts after it ends, and so on.

![Meetings drawn as bars on a timeline from 0 to 10. Sorted by end time, the greedy picks the bar ending at 3, skips two that overlap it, picks the one from 3 to 5, skips another, and picks the one from 6 to 9: three meetings. Picking the longest or the earliest-starting meeting first would leave room for fewer](../figures/activity-selection.svg)

```python
def max_meetings(meetings):
    chosen, free_from = [], float("-inf")
    for start, end in sorted(meetings, key=lambda m: m[1]):   # earliest end first
        if start >= free_from:
            chosen.append((start, end))
            free_from = end
    return chosen

meetings = [(1, 3), (2, 5), (0, 4), (3, 5), (4, 7), (6, 9), (5, 9)]
print(max_meetings(meetings))
```

**Why it's right (exchange argument):** suppose an optimal schedule starts with some meeting M instead of the earliest-ending meeting G. G ends no later than M, so swapping M for G can't overlap anything that came after M. The new schedule is just as large and starts with G. Repeat for the rest.

Other rules sound sensible but fail: "shortest meeting first" (a short meeting can overlap two others that don't overlap each other) and "earliest start first" (one long meeting can block everything).

## When greedy fails

| Problem | Tempting greedy | Counterexample | Use instead |
|---|---|---|---|
| Fewest coins | biggest coin first | coins 1, 3, 4, amount 6: 4 + 1 + 1 vs 3 + 3 | DP (Lesson 42) |
| 0/1 knapsack | best value per weight first | capacity 50, items (10, $60), (20, $100), (30, $120): greedy $160, best $220 | DP (Lesson 44) |
| Longest path, TSP | nearest unvisited city | easily misled by one cheap edge | DP / search |

## Fractional knapsack: where the ratio greedy works

If you may take **part** of an item (gold dust rather than gold bars), greedy by value per weight is optimal: the last item can be cut to fill the bag exactly, so no capacity is ever wasted.

```python
def fractional_knapsack(items, capacity):           # items: (weight, value)
    total = 0.0
    for weight, value in sorted(items, key=lambda it: it[1] / it[0], reverse=True):
        take = min(weight, capacity)
        total += value * take / weight
        capacity -= take
        if capacity == 0:
            break
    return total

print(fractional_knapsack([(10, 60), (20, 100), (30, 120)], 50))    # all of the first two, 2/3 of the third
```

## Jump game

`nums[i]` is the farthest you can jump forward from position i. **Can you reach the end?** Track the farthest position reachable so far; if you ever stand beyond it, you're stuck. O(n), no DP needed.

```python
def can_reach_end(nums):
    farthest = 0
    for i, jump in enumerate(nums):
        if i > farthest:
            return False                 # this position can't be reached
        farthest = max(farthest, i + jump)
    return True

print(can_reach_end([2, 3, 1, 1, 4]), can_reach_end([3, 2, 1, 0, 4]))
```

The harder version, the **fewest** jumps, is greedy too: think of it as BFS levels, where each jump's range is the next level. That's the first exercise.

## Gas station

Stations on a circular road have `gas[i]` fuel and it costs `cost[i]` to drive to the next one. From which station can you complete the loop (or −1)? Two facts make it O(n): if total gas < total cost, it's impossible; otherwise, whenever the tank goes negative starting from s, no station between s and the failure point can work either, so restart just after it.

```python
def gas_station(gas, cost):
    if sum(gas) < sum(cost):
        return -1
    start, tank = 0, 0
    for i in range(len(gas)):
        tank += gas[i] - cost[i]
        if tank < 0:                     # can't get past i from start: try starting after i
            start, tank = i + 1, 0
    return start

print(gas_station([1, 2, 3, 4, 5], [3, 4, 5, 1, 2]), gas_station([2, 3, 4], [3, 4, 3]))
```

## Huffman coding

To compress text, give frequent characters **short** codes and rare characters long ones, with no code being a prefix of another (so the bits can be decoded unambiguously). **Huffman's algorithm** is greedy: repeatedly merge the two **least frequent** symbols (or subtrees) into one, using a heap. The resulting tree's left/right branches spell each character's code, and the total length is provably the smallest possible for a prefix code.

![A Huffman tree for frequencies a: 45, b: 13, c: 12, d: 16, e: 9, f: 5. The two smallest (f: 5 and e: 9) merge into 14; then c and b into 25; then 14 and d into 30; then 25 and 30 into 55; finally a and 55 into 100. Reading 0 for left and 1 for right gives a = 0, and longer codes for the rarer letters](../figures/huffman.svg)

```python
import heapq
from collections import Counter
from itertools import count

def huffman_codes(text):
    tie = count()                                     # breaks ties so subtrees are never compared
    heap = [(freq, next(tie), ch) for ch, freq in Counter(text).items()]
    heapq.heapify(heap)
    while len(heap) > 1:
        f1, _, left = heapq.heappop(heap)             # the two least frequent
        f2, _, right = heapq.heappop(heap)
        heapq.heappush(heap, (f1 + f2, next(tie), (left, right)))
    codes = {}
    def walk(node, code):
        if isinstance(node, str):
            codes[node] = code or "0"                 # a one-letter text still needs one bit
        else:
            walk(node[0], code + "0")
            walk(node[1], code + "1")
    walk(heap[0][2], "")
    return codes

text = "abracadabra"
codes = huffman_codes(text)
print(codes)
bits = sum(len(codes[ch]) for ch in text)
print(f"{bits} bits instead of {8 * len(text)} with 8-bit characters")
```

Huffman coding is part of ZIP, gzip, PNG and JPEG.

## Two pointers as a greedy

**Boats:** each boat carries at most two people and a weight limit. Fewest boats? Sort; pair the **heaviest** person with the **lightest** if they fit, otherwise the heaviest goes alone. The heaviest person needs a boat anyway, and the lightest is the best possible partner.

```python
def boats(weights, limit):
    weights = sorted(weights)
    lo, hi, count = 0, len(weights) - 1, 0
    while lo <= hi:
        if weights[lo] + weights[hi] <= limit:
            lo += 1                       # the lightest rides with the heaviest
        hi -= 1                           # the heaviest always leaves on this boat
        count += 1
    return count

print(boats([3, 2, 2, 1], 3), boats([3, 5, 3, 4], 5))
```

## Testing a greedy idea

Before trusting a greedy rule, compare it with a brute-force (or DP) solution on **many small random inputs**. A counterexample usually turns up within seconds if one exists:

```python
import random
from itertools import product

def greedy_coins(coins, amount):
    n = 0
    for c in sorted(coins, reverse=True):
        n += amount // c
        amount %= c
    return n if amount == 0 else None

def best_coins(coins, amount):
    dp = [0] + [float("inf")] * amount
    for a in range(1, amount + 1):
        dp[a] = min((dp[a - c] + 1 for c in coins if c <= a), default=float("inf"))
    return dp[amount]

random.seed(4)
for _ in range(1000):
    coins = [1] + random.sample(range(2, 12), 2)
    amount = random.randint(1, 30)
    if greedy_coins(coins, amount) != best_coins(coins, amount):
        print("counterexample:", sorted(coins), amount, "greedy", greedy_coins(coins, amount), "best", best_coins(coins, amount))
        break
```

## Greedy at a glance

| Problem | Greedy rule | Time |
|---|---|---|
| Most non-overlapping intervals | earliest end first | O(n log n) |
| Fractional knapsack | best value per weight first | O(n log n) |
| Reach the end / fewest jumps | track the farthest reach / BFS levels | O(n) |
| Gas station | restart after each failure | O(n) |
| Huffman coding, cheapest merging | merge the two smallest (heap) | O(n log n) |
| Boats, pairing | heaviest with lightest (two pointers) | O(n log n) |
| Minimise total waiting time | shortest job first | O(n log n) |
| Minimise maximum lateness | earliest deadline first | O(n log n) |

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Activity selection | sort by end; take each interval starting after the last end | O(n log n) | O(1) extra |
| Fractional knapsack | sort by value / weight; take greedily, cut the last item | O(n log n) | O(1) extra |
| Can reach the end | track the farthest reachable index | O(n) | O(1) |
| Fewest jumps | BFS levels: count a jump when the current range ends | O(n) | O(1) |
| Gas station | impossible if total < 0; restart after each negative tank | O(n) | O(1) |
| Huffman coding / cheapest rope joining | heap: merge the two smallest | O(n log n) | O(n) |
| Boats (pairs under a limit) | sort; heaviest with lightest if they fit | O(n log n) | O(1) extra |

## Common mistakes

- Trusting a greedy rule because it works on the examples given.
- Sorting by the wrong key (start time or length instead of end time).
- Using ratio greedy for the 0/1 knapsack or largest-coin greedy for arbitrary coins.
- Forgetting to test against brute force on small random inputs.

## Exercises

### 1. Fewest jumps

`nums[i]` is the farthest you can jump forward from position i (you may jump any distance up to it). Starting at position 0, write `min_jumps(nums)` returning the fewest jumps needed to reach the last position. The end is always reachable. It must be O(n): 100,000 positions in well under a second.

Starter code:

```python
def min_jumps(nums):
    pass

print(min_jumps([2, 3, 1, 1, 4]))   # 2: 0 -> 1 -> 4
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** the minimum number of jumps; the end is reachable; a single position needs 0 jumps.
2. **Examples:** [2, 3, 1, 1, 4] → 0 → 1 → 4: 2 jumps.
3. **Brute force:** DP: best[i] = 1 + min best[j] over j that can reach i: O(n²).
4. **Pattern:** **greedy BFS by levels**: each jump extends the range as far as possible.
5. **Plan:** one pass, counting a jump every time the current range is used up.
6. **Code and test:** a single element, one huge first jump, all ones.

</details>

<details>
<summary>💡 Hint 1</summary>

Think of BFS: the positions reachable with 0 jumps, with 1 jump, with 2 jumps… form consecutive ranges. How do you find the next range from the current one?

</details>

<details>
<summary>💡 Hint 2</summary>

The next range ends at the farthest `i + nums[i]` over all positions i in the current range. Scan left to right, tracking that farthest point.

</details>

<details>
<summary>💡 Hint 3</summary>

Keep `current_end` and `farthest`. For i from 0 to n − 2: update `farthest`; when `i == current_end`, add a jump and set `current_end = farthest`. Return the jump count.

</details>

### 2. Cheapest way to join ropes

You have ropes of the given `lengths`. Joining two ropes of lengths a and b costs a + b and gives one rope of length a + b. Write `join_cost(lengths)` returning the minimum total cost to join all the ropes into one (0 for zero or one rope). It must handle 200,000 ropes quickly.

Starter code:

```python
import heapq

def join_cost(lengths):
    pass

print(join_cost([4, 3, 2, 6]))   # 29: (2+3)=5, (4+5)=9, (6+9)=15 -> 5 + 9 + 15
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** each join costs the new rope's length; minimise the total; 0 or 1 rope costs 0.
2. **Examples:** [4, 3, 2, 6] → 5 + 9 + 15 = 29.
3. **Brute force:** try every order of joins: exponential; or the greedy with a linear scan each time: O(n²).
4. **Pattern:** **Huffman's greedy** with a **min-heap**.
5. **Plan:** heapify; repeatedly pop two, add, push.
6. **Code and test:** empty, one rope, equal lengths, unsorted input.

</details>

<details>
<summary>💡 Hint 1</summary>

Each rope's length is paid again every time the rope it's part of is joined. Which ropes should be joined first, so their lengths are paid many times?

</details>

<details>
<summary>💡 Hint 2</summary>

Always join the two **shortest** ropes (Huffman's rule): long ropes then get joined fewer times. You need the two smallest values over and over.

</details>

<details>
<summary>💡 Hint 3</summary>

Put the lengths in a heap (`heapq.heapify`). While more than one rope remains: pop two, add their sum to the total, push the sum back.

</details>

**In the sandbox:** exercises 93–94. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Fewest jumps</summary>

```python
def min_jumps(nums):
    jumps = 0
    current_end = 0          # the farthest position reachable with `jumps` jumps
    farthest = 0             # the farthest reachable with one more jump
    for i in range(len(nums) - 1):          # no jump is needed from the last position
        farthest = max(farthest, i + nums[i])
        if i == current_end:                # we've used up this jump's range
            jumps += 1
            current_end = farthest
    return jumps

print(min_jumps([2, 3, 1, 1, 4]))
```

**Line by line**

- Positions 0..`current_end` can be reached with `jumps` jumps; `farthest` is how far one more jump can take you from any of them.
- When i reaches `current_end`, every position in the current range has been examined, so one more jump is needed and the new range ends at `farthest`.
- The loop stops before the last index: once you can stand there, no further jump is needed.

**Trace** on [2, 3, 1, 1, 4]:

| i | farthest | i == current_end? | jumps | current_end |
|---|---|---|---|---|
| 0 | 2 | yes | 1 | 2 |
| 1 | 4 | no | 1 | 2 |
| 2 | 4 | yes | 2 | 4 |
| 3 | 4 | no | 2 | 4 |

**Complexity:** O(n) time, O(1) space.

**Common wrong approach:** always jumping as far as possible from the current position. In [2, 3, 1, 1, 4], jumping straight to index 2 (value 1) needs 3 jumps in total; stopping at index 1, whose own reach is 4, needs only 2.

</details>

<details>
<summary>✅ 2. Cheapest way to join ropes</summary>

```python
import heapq

def join_cost(lengths):
    heap = list(lengths)
    heapq.heapify(heap)                  # O(n)
    total = 0
    while len(heap) > 1:
        a = heapq.heappop(heap)          # the two shortest ropes
        b = heapq.heappop(heap)
        total += a + b
        heapq.heappush(heap, a + b)      # the joined rope goes back in
    return total

print(join_cost([4, 3, 2, 6]))
```

**Line by line**

- `heapify` arranges the lengths so the shortest is always at the front, in O(n).
- Each round removes the two shortest ropes, pays their combined length, and puts the new rope back to be joined later.
- With n ropes there are n − 1 joins; the loop stops when one rope is left (or none was given).

**Trace** on [4, 3, 2, 6]:

| heap before | joined | cost so far |
|---|---|---|
| 2, 3, 4, 6 | 2 + 3 = 5 | 5 |
| 4, 5, 6 | 4 + 5 = 9 | 14 |
| 6, 9 | 6 + 9 = 15 | **29** |

**Complexity:** O(n log n) time, O(n) space.

**Common wrong approach:** sorting once and joining left to right (2 + 3, then + 4, then + 6). That ignores that a joined rope may become longer than an unjoined one: [1, 1, 1, 1] costs 8 the Huffman way, but 9 left to right.

</details>

## Quick quiz

1. What is the usual way to prove a greedy algorithm correct?
   - A) Showing it's faster than DP
   - B) An exchange argument: swapping the greedy choice into an optimal solution doesn't make it worse
   - C) Running it on one example

2. For selecting the most non-overlapping meetings, which meeting should be chosen first?
   - A) The one that ends earliest
   - B) The shortest one
   - C) The one that starts earliest

3. Why does greedy by value per weight work for the fractional knapsack but not the 0/1 knapsack?
   - A) With fractions, the last item can be cut to fill the bag exactly, so no capacity is wasted
   - B) Sorting doesn't work for 0/1
   - C) Fractional values are smaller

4. Huffman's algorithm repeatedly:
   - A) Sorts the symbols alphabetically
   - B) Gives the most frequent symbol the longest code
   - C) Merges the two least frequent symbols or subtrees

<details>
<summary>Quiz answers</summary>

1. **B) An exchange argument: swapping the greedy choice into an optimal solution doesn't make it worse**: If no exchange argument works, look for a counterexample, or use DP.
2. **A) The one that ends earliest**: Ending early leaves the most room for the rest.
3. **A) With fractions, the last item can be cut to fill the bag exactly, so no capacity is wasted**: In 0/1, a high-ratio item can leave unusable leftover space.
4. **C) Merges the two least frequent symbols or subtrees**: Rare symbols end up deep in the tree with long codes; frequent ones get short codes.

</details>

---
Previous: [Lesson 44](44-knapsack-and-more.md) · Next: [Lesson 46: Intervals and sweep lines](46-intervals-sweep.md)
