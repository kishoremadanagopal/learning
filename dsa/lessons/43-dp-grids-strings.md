# Lesson 43: DP on grids and strings

**You'll learn:** unique paths and obstacles, minimum path sum, one-row space saving, longest common subsequence and rebuilding it, edit distance and its uses, longest palindromic subsequence and substring, two-sequence DP patterns.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/dsa/#dp-grids-strings)**: run every example and check your exercise answers.

## Key terms

- **2-D DP:** a dynamic program whose state needs two indexes, dp[i][j].
- **Longest common subsequence (LCS):** the longest sequence appearing in order, with gaps allowed, in two strings.
- **Edit (Levenshtein) distance:** the fewest insertions, deletions and substitutions turning one string into another.
- **Prefix:** the first i characters of a string; two-string DP compares prefixes.
- **Backtracking a DP table:** walking back from the answer cell to rebuild the actual solution.
- **Palindrome:** a string that reads the same forwards and backwards.

When the state needs **two** numbers (a row and a column, or a position in each of two strings), the table becomes 2-D: `dp[i][j]`. The recipe is the same; the extra work is choosing the order so every cell's neighbours are ready.

## Paths through a grid

A robot starts at the top-left of an m × n grid and moves only **right** or **down**. How many different paths reach the bottom-right? Every cell is entered from above or from the left, so `paths[r][c] = paths[r − 1][c] + paths[r][c − 1]`.

```python
from math import comb

def unique_paths(m, n, blocked=()):
    paths = [[0] * n for _ in range(m)]
    for r in range(m):
        for c in range(n):
            if (r, c) in blocked:
                continue                         # no path goes through an obstacle
            if r == 0 and c == 0:
                paths[r][c] = 1
            else:
                paths[r][c] = (paths[r - 1][c] if r else 0) + (paths[r][c - 1] if c else 0)
    return paths[m - 1][n - 1]

print(unique_paths(3, 7), comb(3 + 7 - 2, 3 - 1))    # with no obstacles it's a binomial coefficient
print(unique_paths(3, 3, blocked={(1, 1)}))
```

Without obstacles there's a formula: choose which m − 1 of the m + n − 2 moves go down. With obstacles, or costs, you need the DP.

**Minimum path sum:** each cell has a cost, and you want the cheapest right/down path. Same shape, with `min` instead of `+`: `cost[r][c] = grid[r][c] + min(from above, from the left)`. That's the first exercise. Rows only depend on the row above, so **one row of memory** is enough: overwrite it left to right.

```python
def min_path_one_row(grid):
    cols = len(grid[0])
    row = [float("inf")] * cols
    row[0] = 0
    for r in range(len(grid)):
        for c in range(cols):
            left = row[c - 1] if c else float("inf")
            row[c] = grid[r][c] + min(row[c], left)   # row[c] still holds the value from the row above
    return row[-1]

print(min_path_one_row([[1, 3, 1], [1, 5, 1], [4, 2, 1]]))   # 1 → 3 → 1 → 1 → 1
```

## Longest common subsequence (LCS)

The longest sequence of characters appearing **in order** (gaps allowed) in both strings: "ABCBDAB" and "BDCABA" share "BCBA", length 4. State: `dp[i][j]` = LCS length of the first i characters of a and the first j characters of b.

- If `a[i−1] == b[j−1]`, that character extends the LCS of the shorter prefixes: `dp[i][j] = dp[i−1][j−1] + 1`.
- Otherwise drop the last character of one string or the other: `dp[i][j] = max(dp[i−1][j], dp[i][j−1])`.

![The LCS table for "ABCB" (rows) and "BDCB" (columns), with an extra row and column of zeros. Matching characters take the diagonal value plus one; others take the larger of the cell above and the cell to the left. The bottom-right cell is 3, and the highlighted path back through the matches spells "BCB"](../figures/lcs-table.svg)

```python
def lcs(a, b):
    m, n = len(a), len(b)
    dp = [[0] * (n + 1) for _ in range(m + 1)]       # row 0 and column 0: empty prefixes
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    out, i, j = [], m, n                              # walk back from the corner to rebuild one LCS
    while i and j:
        if a[i - 1] == b[j - 1]:
            out.append(a[i - 1])
            i, j = i - 1, j - 1
        elif dp[i - 1][j] >= dp[i][j - 1]:
            i -= 1
        else:
            j -= 1
    return dp[m][n], "".join(reversed(out))

print(lcs("ABCBDAB", "BDCABA"))
print(lcs("kitten", "sitting"))
```

The **diff** tools in Git compare files line by line with algorithms based on this idea, and the same DP aligns DNA sequences in bioinformatics.

## Edit distance (Levenshtein distance)

The fewest **insertions, deletions and substitutions** that turn one string into another: "kitten" → "sitting" takes 3 (k→s, e→i, insert g). State: `dp[i][j]` = edits to turn the first i characters of a into the first j characters of b.

- Base cases: `dp[i][0] = i` (delete everything), `dp[0][j] = j` (insert everything).
- If the last characters match, no edit is needed: `dp[i][j] = dp[i−1][j−1]`.
- Otherwise 1 + the best of: **replace** (`dp[i−1][j−1]`), **delete** from a (`dp[i−1][j]`), **insert** into a (`dp[i][j−1]`).

It's the second exercise. Edit distance powers spell checkers ("did you mean…?"), fuzzy search, record de-duplication, and the **word error rate** used to score speech recognition and translation systems (edit distance counted in words instead of characters).

## Palindromes

The **longest palindromic subsequence** of s is the LCS of s and s reversed. The longest palindromic **substring** (contiguous) is easier without a table: expand outwards from each of the 2n − 1 possible centres, O(n²) time and O(1) space.

```python
def longest_palindrome_substring(s):
    best = ""
    for centre in range(2 * len(s) - 1):
        lo, hi = centre // 2, (centre + 1) // 2      # odd centres (a letter) and even centres (between letters)
        while lo >= 0 and hi < len(s) and s[lo] == s[hi]:
            lo, hi = lo - 1, hi + 1
        if hi - lo - 1 > len(best):
            best = s[lo + 1:hi]
    return best

def lcs_length(a, b):
    prev = [0] * (len(b) + 1)
    for x in a:
        cur = [0]
        for j, y in enumerate(b, 1):
            cur.append(prev[j - 1] + 1 if x == y else max(prev[j], cur[j - 1]))
        prev = cur
    return prev[-1]

s = "character"
print(longest_palindrome_substring("babad"), longest_palindrome_substring("cbbd"))
print("longest palindromic subsequence of", s, "=", lcs_length(s, s[::-1]))   # "carac"
```

## Two-sequence DP in general

| Problem | dp[i][j] means | Match | No match |
|---|---|---|---|
| LCS | LCS of prefixes | dp[i−1][j−1] + 1 | max(dp[i−1][j], dp[i][j−1]) |
| Edit distance | edits between prefixes | dp[i−1][j−1] | 1 + min(three neighbours) |
| Distinct subsequences | ways b's prefix appears in a's prefix | dp[i−1][j−1] + dp[i−1][j] | dp[i−1][j] |
| Wildcard / regex match | does a's prefix match the pattern prefix | dp[i−1][j−1] | depends on `*` / `?` |

All are O(m × n) time; since each row only needs the previous one, space can drop to O(min(m, n)).

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Unique paths (right/down) | paths[r][c] = above + left; or C(m + n − 2, m − 1) | O(m · n) | O(n) |
| Minimum path sum | cost[r][c] = grid[r][c] + min(above, left) | O(m · n) | O(n) with one row |
| Longest common subsequence | match: diagonal + 1; else max(above, left) | O(m · n) | O(m · n), O(n) for the length only |
| Edit distance | match: diagonal; else 1 + min(diagonal, above, left) | O(m · n) | O(n) with two rows |
| Longest palindromic subsequence | LCS(s, reversed s) | O(n²) | O(n) |
| Longest palindromic substring | expand around 2n − 1 centres | O(n²) | O(1) |

## Common mistakes

- Off-by-one errors between table indexes (i) and string indexes (i − 1).
- Forgetting the base row and column (empty prefixes).
- Treating edit distance as counting differing positions (Hamming distance).
- Overwriting a one-row table in an order that destroys values still needed.

## Exercises

### 1. Minimum path sum

`grid` is an m × n list of lists of non-negative integers. Starting at the top-left cell and moving only **right** or **down**, reach the bottom-right cell. Write `min_path_sum(grid)` returning the smallest possible sum of the cells on the path (including the first and last). It must handle a 300 × 300 grid quickly.

Starter code:

```python
def min_path_sum(grid):
    pass

print(min_path_sum([[1, 3, 1], [1, 5, 1], [4, 2, 1]]))   # 7
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** right/down only; both end cells count; costs ≥ 0.
2. **Examples:** the example's best path 1 → 3 → 1 → 1 → 1 = 7.
3. **Brute force:** recursion over every path: C(m + n − 2, m − 1) paths, exponential.
4. **Pattern:** **2-D grid DP**: each cell from its top and left neighbours.
5. **Plan:** a cost table filled row by row; edges get one neighbour.
6. **Code and test:** one cell, one row, one column, a route around expensive cells.

</details>

<details>
<summary>💡 Hint 1</summary>

The last move into a cell came either from above or from the left. If you knew the cheapest cost to reach those two cells, what's the cheapest cost to reach this one?

</details>

<details>
<summary>💡 Hint 2</summary>

`cost[r][c] = grid[r][c] + min(cost[r−1][c], cost[r][c−1])`, filled row by row from the top-left. The first row and column have only one way in.

</details>

<details>
<summary>💡 Hint 3</summary>

Make a `cost` table the size of the grid. Handle (0, 0), the first row (from the left only) and the first column (from above only), then apply the formula everywhere else. Return the bottom-right entry.

</details>

### 2. Edit distance

Write `edit_distance(a, b)` returning the fewest single-character **insertions, deletions or substitutions** needed to turn string `a` into string `b`. Two strings of 800 characters must take well under a second.

Starter code:

```python
def edit_distance(a, b):
    pass

print(edit_distance("horse", "ros"))              # 3
print(edit_distance("intention", "execution"))    # 5
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** three operations, each costing 1; either string may be empty.
2. **Examples:** horse → ros: replace h with r, delete r, delete e = 3.
3. **Brute force:** recursion trying all three edits: exponential.
4. **Pattern:** **two-sequence DP** over prefixes.
5. **Plan:** base row and column, the match / three-way minimum rule, answer in the corner.
6. **Code and test:** empty strings, identical strings, a swap.

</details>

<details>
<summary>💡 Hint 1</summary>

Look at the **last** characters of the two prefixes. If they're equal, what's the cost? If not, what are the three possible last edits?

</details>

<details>
<summary>💡 Hint 2</summary>

Let `dp[i][j]` be the edits between `a[:i]` and `b[:j]`. Equal last characters: `dp[i−1][j−1]`. Otherwise 1 + the minimum of replace `dp[i−1][j−1]`, delete `dp[i−1][j]` and insert `dp[i][j−1]`.

</details>

<details>
<summary>💡 Hint 3</summary>

The table is (m + 1) × (n + 1). Fill row 0 with 0..n and column 0 with 0..m, then fill the rest row by row and return `dp[m][n]`.

</details>

**In the sandbox:** exercises 89–90. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Minimum path sum</summary>

```python
def min_path_sum(grid):
    rows, cols = len(grid), len(grid[0])
    cost = [[0] * cols for _ in range(rows)]
    for r in range(rows):
        for c in range(cols):
            if r == 0 and c == 0:
                cost[r][c] = grid[0][0]
            elif r == 0:
                cost[r][c] = cost[r][c - 1] + grid[r][c]      # first row: only from the left
            elif c == 0:
                cost[r][c] = cost[r - 1][c] + grid[r][c]      # first column: only from above
            else:
                cost[r][c] = grid[r][c] + min(cost[r - 1][c], cost[r][c - 1])
    return cost[-1][-1]

print(min_path_sum([[1, 3, 1], [1, 5, 1], [4, 2, 1]]))
```

**Line by line**

- `cost[r][c]` means "the cheapest sum of a path from the top-left to (r, c), including both".
- Filling row by row, left to right, guarantees the cells above and to the left are already final.
- The first row can only be reached from the left, and the first column only from above, so they're running sums.
- The answer is the bottom-right entry.

**Trace** on [[1, 3, 1], [1, 5, 1], [4, 2, 1]]:

| | col 0 | col 1 | col 2 |
|---|---|---|---|
| row 0 | 1 | 4 | 5 |
| row 1 | 2 | 7 | 6 |
| row 2 | 6 | 8 | **7** |

**Complexity:** O(m × n) time; O(m × n) space as written, O(n) with a single row.

**Common wrong approach:** greedy, always stepping to the cheaper of the two next cells; a cheap step now can lead into an expensive region.

</details>

<details>
<summary>✅ 2. Edit distance</summary>

```python
def edit_distance(a, b):
    m, n = len(a), len(b)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1):
        dp[i][0] = i                      # delete all i characters
    for j in range(n + 1):
        dp[0][j] = j                      # insert all j characters
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]          # last characters match: free
            else:
                dp[i][j] = 1 + min(dp[i - 1][j - 1], # replace a's last character
                                   dp[i - 1][j],     # delete a's last character
                                   dp[i][j - 1])     # insert b's last character
    return dp[m][n]

print(edit_distance("horse", "ros"))
print(edit_distance("intention", "execution"))
```

**Line by line**

- `dp[i][0] = i` and `dp[0][j] = j` cover turning a prefix into nothing and nothing into a prefix.
- Equal last characters can be kept, so the cost is that of the shorter prefixes.
- Otherwise the last operation was a replace (both prefixes shrink), a delete (a's prefix shrinks) or an insert (b's prefix shrinks); add 1 to the cheapest.
- Row by row, left to right, makes the three neighbours ready.

**Trace** on "ab" → "ba" (rows: "", a, ab; columns: "", b, ba):

| | "" | b | ba |
|---|---|---|---|
| "" | 0 | 1 | 2 |
| a | 1 | 1 | 1 |
| ab | 2 | 1 | **2** |

**Complexity:** O(m × n) time; O(m × n) space, or O(n) keeping two rows.

**Common wrong approach:** counting the positions where the characters differ (Hamming distance). That ignores insertions and deletions: "abc" → "bc" is 1 edit, not 3.

</details>

## Quick quiz

1. In the grid "unique paths" DP, where does each cell's value come from?
   - A) The cell above plus the cell to the left
   - B) Only the diagonal neighbour
   - C) The cell below plus the cell to the right

2. In the LCS table, what happens when a[i−1] == b[j−1]?
   - A) dp[i][j] = 0
   - B) dp[i][j] = max(dp[i−1][j], dp[i][j−1])
   - C) dp[i][j] = dp[i−1][j−1] + 1

3. Which three neighbours does edit distance compare when the last characters differ?
   - A) The cells two steps away
   - B) Only the diagonal
   - C) Replace (diagonal), delete (above) and insert (left)

4. Two-string DP tables need O(m × n) memory. How can you usually reduce that?
   - A) Sort the strings first
   - B) Use recursion instead
   - C) Keep only the previous row (and the current one)

<details>
<summary>Quiz answers</summary>

1. **A) The cell above plus the cell to the left**: Moves are right or down, so each cell is entered from above or from the left.
2. **C) dp[i][j] = dp[i−1][j−1] + 1**: A shared last character extends the LCS of the shorter prefixes.
3. **C) Replace (diagonal), delete (above) and insert (left)**: Each corresponds to the last edit made.
4. **C) Keep only the previous row (and the current one)**: Each row depends only on the row above it.

</details>

---
Previous: [Lesson 42](42-dp-sequences.md) · Next: [Lesson 44: Knapsacks, intervals, bitmasks and trees](44-knapsack-and-more.md)
