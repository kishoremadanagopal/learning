# Lesson 42: DP on sequences

**You'll learn:** fewest coins, counting combinations versus ordered sequences, why greedy coin change fails, Kadane's maximum subarray, maximum product subarray, longest increasing subsequence in O(n²) and O(n log n), rebuilding a subsequence, word break, decode ways.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/dsa/#dp-sequences)**: run every example and check your exercise answers.

## Key terms

- **Unbounded knapsack:** a DP where each item (such as a coin value) may be used any number of times.
- **Kadane's algorithm:** the O(n) maximum-subarray DP that tracks the best sum ending at each position.
- **Subsequence:** items kept in their original order, with gaps allowed.
- **Longest increasing subsequence (LIS):** the longest subsequence whose values strictly increase.
- **Patience sorting:** the O(n log n) LIS method that keeps the smallest tail for each length.
- **"Ending at i" state:** a DP state describing the best answer that finishes exactly at position i.

Many DP problems walk along a sequence (amounts, positions in a list, characters in a string) where `dp[i]` summarises everything about the first i items or the amount i. This lesson collects the patterns you'll meet most.

## Coin change: the fewest coins

Given coin values (with unlimited coins of each) and an amount, find the fewest coins that add up to it. State: `dp[a]` = fewest coins for amount a. The last coin used was some c, so `dp[a] = 1 + min(dp[a − c])` over the coins that fit.

```python
def fewest_coins(coins, amount):
    INF = float("inf")
    dp = [0] + [INF] * amount               # dp[0] = 0: no coins needed for 0
    for a in range(1, amount + 1):
        for c in coins:
            if c <= a and dp[a - c] + 1 < dp[a]:
                dp[a] = dp[a - c] + 1
    return dp[amount] if dp[amount] != INF else -1

print(fewest_coins([1, 3, 4], 6))      # 3 + 3
print(fewest_coins([2], 3))            # impossible
print(fewest_coins([1, 5, 10, 25], 63))
```

Why not just take the biggest coin each time? That **greedy** approach works for coin systems like 1, 5, 10, 25 but fails in general: with coins 1, 3, 4 and amount 6, greedy picks 4 + 1 + 1 (3 coins) while 3 + 3 uses 2. DP checks every last coin, so it's always right. (Lesson 45 shows when greedy is safe.)

## Coin change: the number of ways, and why loop order matters

"How many ways to make amount a?" counts **combinations** (2 + 1 and 1 + 2 are the same way) if you loop over **coins on the outside**: each coin is added to the counts only after the previous coins are finished, so coins always appear in one fixed order. Swap the loops and you count **ordered sequences** instead (like the stairs exercise).

```python
def ways_combinations(coins, amount):
    dp = [1] + [0] * amount
    for c in coins:                         # coins outside: each combination counted once
        for a in range(c, amount + 1):
            dp[a] += dp[a - c]
    return dp[amount]

def ways_sequences(coins, amount):
    dp = [1] + [0] * amount
    for a in range(1, amount + 1):          # amounts outside: every order counted
        for c in coins:
            if c <= a:
                dp[a] += dp[a - c]
    return dp[amount]

print(ways_combinations([1, 2, 5], 5), ways_sequences([1, 2, 5], 5))
```

## Maximum subarray: Kadane's algorithm

The largest sum of a **contiguous** run of numbers. State: `best_here` = the largest sum of a subarray **ending at** the current position. Either extend the previous run or start fresh at this number: `best_here = max(x, best_here + x)`. The answer is the largest `best_here` seen.

```python
def max_subarray(nums):
    best_here = best = nums[0]
    for x in nums[1:]:
        best_here = max(x, best_here + x)   # a negative running sum is worth dropping
        best = max(best, best_here)
    return best

print(max_subarray([-2, 1, -3, 4, -1, 2, 1, -5, 4]))   # 4 - 1 + 2 + 1
print(max_subarray([-3, -1, -2]))                      # all negative: the largest single number
```

"Ending at i" is one of the most useful state definitions: it turns "best subarray anywhere" into a simple left-to-right pass. For the maximum **product**, track both the largest and the smallest product ending here, because a negative number turns the smallest into the largest.

## Longest increasing subsequence (LIS)

A **subsequence** keeps the original order but may skip items: [3, 10, 2, 1, 20] contains the increasing subsequence 3, 10, 20 of length 3.

**O(n²) DP:** `dp[i]` = length of the longest increasing subsequence **ending at** i = 1 + the best `dp[j]` over earlier j with a smaller value.

```python
def lis_quadratic(nums):
    n = len(nums)
    dp, parent = [1] * n, [-1] * n
    for i in range(n):
        for j in range(i):
            if nums[j] < nums[i] and dp[j] + 1 > dp[i]:
                dp[i], parent[i] = dp[j] + 1, j
    end = max(range(n), key=dp.__getitem__)
    seq = []
    while end != -1:                        # follow parents to rebuild one LIS
        seq.append(nums[end])
        end = parent[end]
    return len(seq), seq[::-1]

print(lis_quadratic([10, 9, 2, 5, 3, 7, 101, 18]))
```

**O(n log n) with patience sorting:** keep a list `tails` where `tails[k]` is the **smallest possible last value** of an increasing subsequence of length k + 1. It's always sorted, so each new number finds its place by binary search: replace the first tail ≥ it, or append if it's bigger than all of them. The answer is `len(tails)`.

![Processing 10, 9, 2, 5, 3, 7, 101, 18. The tails list changes: [10], [9], [2], [2, 5], [2, 3], [2, 3, 7], [2, 3, 7, 101], [2, 3, 7, 18]. Its final length 4 is the LIS length](../figures/lis-tails.svg)

```python
from bisect import bisect_left

def lis_length(nums):
    tails = []
    for x in nums:
        i = bisect_left(tails, x)           # the first tail >= x
        if i == len(tails):
            tails.append(x)                 # x extends the longest subsequence so far
        else:
            tails[i] = x                    # x is a smaller ending for length i + 1
        print(f"{x:>4}: {tails}")
    return len(tails)

print("length:", lis_length([10, 9, 2, 5, 3, 7, 101, 18]))
```

`tails` is **not** itself an increasing subsequence of the input (its values may come from different subsequences); only its length is the answer. For **non-decreasing** subsequences, use `bisect_right`.

## Word break

Can a string be split into dictionary words? State: `ok[i]` = the first i characters can be split. `ok[i]` is true if some earlier split point j has `ok[j]` true and `s[j:i]` is a word.

```python
def word_break(s, words):
    words = set(words)
    longest = max(map(len, words), default=0)
    ok = [True] + [False] * len(s)              # the empty prefix can always be split
    for i in range(1, len(s) + 1):
        for j in range(max(0, i - longest), i): # only look back as far as the longest word
            if ok[j] and s[j:i] in words:
                ok[i] = True
                break
    return ok[len(s)]

print(word_break("applepenapple", ["apple", "pen"]), word_break("catsandog", ["cats", "dog", "sand", "and", "cat"]))
```

## Decode ways

Letters are encoded A = 1, …, Z = 26. How many ways can a digit string be decoded? "226" is BZ, VF or BBF. State: `dp[i]` = ways to decode the first i digits. The last letter used either one digit (1–9) or two digits (10–26).

```python
def decode_ways(s):
    dp = [1] + [0] * len(s)
    for i in range(1, len(s) + 1):
        if s[i - 1] != "0":
            dp[i] += dp[i - 1]                       # last letter from one digit
        if i >= 2 and "10" <= s[i - 2:i] <= "26":
            dp[i] += dp[i - 2]                       # last letter from two digits
    return dp[len(s)]

print(decode_ways("226"), decode_ways("12"), decode_ways("06"), decode_ways("11106"))
```

(The string comparison `"10" <= s[i-2:i] <= "26"` works because both sides are two-digit strings.)

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Fewest coins | dp[a] = 1 + min(dp[a − c]) | O(amount · coins) | O(amount) |
| Number of coin combinations | coins in the outer loop: dp[a] += dp[a − c] | O(amount · coins) | O(amount) |
| Maximum subarray (Kadane) | here = max(x, here + x); best = max(best, here) | O(n) | O(1) |
| LIS (simple) | dp[i] = 1 + max(dp[j]) for j < i with nums[j] < nums[i] | O(n²) | O(n) |
| LIS (fast) | tails + bisect_left | O(n log n) | O(n) |
| Word break | ok[i] = any(ok[j] and s[j:i] in words) | O(n · L) checks | O(n) |
| Decode ways | dp[i] = dp[i − 1] (valid 1 digit) + dp[i − 2] (10–26) | O(n) | O(n), or O(1) |

## Common mistakes

- Using greedy coin change for an arbitrary coin system.
- Putting the loops in the wrong order and counting sequences instead of combinations (or the reverse).
- Using `bisect_right` for a strictly increasing LIS.
- Treating the `tails` list as an actual longest increasing subsequence.

## Exercises

### 1. Coin change

Write `coin_change(coins, amount)` returning the **fewest** coins that add up to `amount` (unlimited coins of each value), or `-1` if it can't be done. It must handle amount = 10,000 quickly.

Starter code:

```python
def coin_change(coins, amount):
    pass

print(coin_change([1, 2, 5], 11))   # 3: 5 + 5 + 1
print(coin_change([2], 3))          # -1
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** unlimited coins; fewest count; amount 0 → 0; impossible → −1.
2. **Examples:** [1, 2, 5], 11 → 3; [1, 3, 4], 6 → 2 (not 3, as greedy would say).
3. **Brute force:** recursion over the last coin: exponential, recomputing the same amounts.
4. **Pattern:** **1-D DP over amounts** (unbounded knapsack, minimum version).
5. **Plan:** table of size amount + 1 with infinity; fill upwards; translate infinity to −1.
6. **Code and test:** 0, impossible, greedy traps, unsorted coins.

</details>

<details>
<summary>💡 Hint 1</summary>

Suppose you knew the fewest coins for every smaller amount. Which coin might be the **last** one used for `amount`?

</details>

<details>
<summary>💡 Hint 2</summary>

Any coin c that fits. Then the count is 1 + the fewest coins for `amount − c`. Take the smallest over all coins.

</details>

<details>
<summary>💡 Hint 3</summary>

`fewest = [0] + [inf] * amount`; for each a from 1 up, for each coin c ≤ a, update `fewest[a] = min(fewest[a], fewest[a - c] + 1)`. Return −1 if it's still infinity.

</details>

### 2. Longest increasing subsequence

Write `length_of_lis(nums)` returning the length of the longest **strictly** increasing subsequence. It must be O(n log n): 100,000 numbers in well under a second.

Starter code:

```python
from bisect import bisect_left

def length_of_lis(nums):
    pass

print(length_of_lis([10, 9, 2, 5, 3, 7, 101, 18]))   # 4: 2, 3, 7, 101
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** subsequence (gaps allowed, order kept); strictly increasing; only the length is needed.
2. **Examples:** [0, 1, 0, 3, 2, 3] → 4; [7, 7, 7] → 1.
3. **Brute force:** all 2ⁿ subsequences; the O(n²) DP is the standard improvement.
4. **Pattern:** **patience sorting**: a sorted `tails` list with binary search.
5. **Plan:** one pass, bisect_left, replace or append, return the length.
6. **Code and test:** equal values (need `bisect_left`), empty input, decreasing input.

</details>

<details>
<summary>💡 Hint 1</summary>

The O(n²) DP sets `dp[i]` = 1 + the best `dp[j]` for earlier, smaller `nums[j]`. To go faster, what do you really need to remember about the subsequences so far?

</details>

<details>
<summary>💡 Hint 2</summary>

For each possible length, only the **smallest ending value** matters: a smaller ending is easier to extend. Those smallest endings (`tails`) are always sorted.

</details>

<details>
<summary>💡 Hint 3</summary>

For each x: `i = bisect_left(tails, x)`. If `i == len(tails)` append x, otherwise set `tails[i] = x`. Return `len(tails)`.

</details>

**In the sandbox:** exercises 87–88. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Coin change</summary>

```python
def coin_change(coins, amount):
    INF = float("inf")
    fewest = [0] + [INF] * amount            # fewest[a]: fewest coins that make amount a
    for a in range(1, amount + 1):
        for c in coins:
            if c <= a and fewest[a - c] + 1 < fewest[a]:
                fewest[a] = fewest[a - c] + 1    # use c as the last coin
    return fewest[amount] if fewest[amount] != INF else -1

print(coin_change([1, 2, 5], 11))
print(coin_change([2], 3))
```

**Line by line**

- `fewest[0] = 0` is the base case; every other amount starts as "impossible" (infinity).
- For amount a, each coin c ≤ a offers the candidate `fewest[a - c] + 1`; if a − c is impossible, infinity + 1 is still infinity, so it never wins.
- Amounts are filled in increasing order, so `fewest[a - c]` is final when used.
- The final translation turns "still infinity" into −1.

**Trace** for coins [1, 3, 4], amount 6:

| a | via 1 | via 3 | via 4 | fewest[a] |
|---|---|---|---|---|
| 1 | 1 | — | — | 1 |
| 2 | 2 | — | — | 2 |
| 3 | 3 | 1 | — | 1 |
| 4 | 2 | 2 | 1 | 1 |
| 5 | 2 | 3 | 2 | 2 |
| 6 | 3 | **2** | 3 | 2 |

**Complexity:** O(amount × number of coins) time, O(amount) space.

**Common wrong approach:** greedy (largest coin first), which fails on [1, 3, 4] with amount 6.

</details>

<details>
<summary>✅ 2. Longest increasing subsequence</summary>

```python
from bisect import bisect_left

def length_of_lis(nums):
    tails = []                        # tails[k]: smallest ending of an increasing subsequence of length k + 1
    for x in nums:
        i = bisect_left(tails, x)     # first position whose tail is >= x
        if i == len(tails):
            tails.append(x)           # longer than every subsequence so far
        else:
            tails[i] = x              # a smaller ending for subsequences of length i + 1
    return len(tails)

print(length_of_lis([10, 9, 2, 5, 3, 7, 101, 18]))
```

**Line by line**

- `tails[k]` is the smallest value that can end an increasing subsequence of length k + 1 among the numbers seen so far. These values increase with k, so the list is sorted.
- `bisect_left` finds the first tail ≥ x. If none exists, x extends the longest subsequence: append.
- Otherwise x becomes a smaller (better) ending for that length. The length of `tails` never shrinks, and only grows when a longer subsequence really exists.
- `bisect_left` (not `bisect_right`) makes an equal value replace its twin rather than extend, which enforces **strictly** increasing.

**Trace** on [0, 1, 0, 3, 2, 3]:

| x | position | tails |
|---|---|---|
| 0 | append | [0] |
| 1 | append | [0, 1] |
| 0 | replace 0 | [0, 1] |
| 3 | append | [0, 1, 3] |
| 2 | replace 3 | [0, 1, 2] |
| 3 | append | [0, 1, 2, 3] → **4** |

**Complexity:** O(n log n) time, O(n) space.

**Common wrong approach:** returning `tails` as the subsequence itself. Its values can come from different subsequences; rebuilding an actual LIS needs extra parent pointers.

</details>

## Quick quiz

1. With coins [1, 3, 4] and amount 6, what does always taking the largest coin give?
   - A) 3 coins (4 + 1 + 1), while the best is 2 (3 + 3)
   - B) 2 coins, the best answer
   - C) No answer

2. To count coin combinations (order doesn't matter), which loop goes outside?
   - A) The loop over coin values
   - B) The loop over amounts
   - C) It makes no difference

3. In Kadane's algorithm, what does best_here represent?
   - A) The sum of all positive numbers
   - B) The largest sum seen anywhere so far
   - C) The largest sum of a subarray ending at the current position

4. In the O(n log n) LIS method, what does tails[k] hold?
   - A) The k-th number of the longest subsequence
   - B) The smallest last value of an increasing subsequence of length k + 1
   - C) The count of subsequences of length k

<details>
<summary>Quiz answers</summary>

1. **A) 3 coins (4 + 1 + 1), while the best is 2 (3 + 3)**: Greedy isn't safe for every coin system; DP checks every last coin.
2. **A) The loop over coin values**: With amounts outside, 1 + 2 and 2 + 1 are counted separately.
3. **C) The largest sum of a subarray ending at the current position**: Each step either extends the previous run or starts again at x.
4. **B) The smallest last value of an increasing subsequence of length k + 1**: Smaller endings are easier to extend, and the list stays sorted.

</details>

---
Previous: [Lesson 41](41-dp-intro.md) · Next: [Lesson 43: DP on grids and strings](43-dp-grids-strings.md)
