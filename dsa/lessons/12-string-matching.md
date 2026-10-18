# Lesson 12: Pattern matching: naive, KMP and Rabin-Karp

**You'll learn:** substring search, naive O(n·m) matching, KMP and the LPS failure table, Rabin-Karp and rolling hashes, collisions, choosing a method, other algorithms.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/dsa/#string-matching)**: run every example and check your exercise answers.

## Key terms

- **Pattern matching:** finding where a pattern string occurs inside a text.
- **Naive search:** trying every start position and comparing character by character.
- **KMP (Knuth–Morris–Pratt):** a search that uses a table of the pattern's prefix-suffixes so it never re-reads the text; O(n + m).
- **LPS table:** for each prefix of the pattern, the length of its longest proper prefix that is also a suffix.
- **Proper prefix:** a prefix that isn't the whole string.
- **Rabin-Karp:** a search that compares hashes of windows, updated with a rolling hash.
- **Rolling hash:** a hash of a sliding window updated in O(1) as it moves.
- **Hash collision:** two different inputs with the same hash value.

"Does `pattern` occur in `text`, and where?" is behind search boxes, DNA analysis and plagiarism checks. Let n = length of the text and m = length of the pattern.

In everyday Python, `text.find(pattern)` and `pattern in text` are the right tools: they use a highly optimised C implementation. This lesson shows how such algorithms work, because the ideas (never repeating work, rolling hashes) appear in many other problems and interviews.

## 1. Naive: try every position, O(n·m)

```python
def naive_search(text, pattern):
    n, m = len(text), len(pattern)
    hits = []
    for i in range(n - m + 1):              # every possible start
        if text[i:i + m] == pattern:        # compare up to m characters
            hits.append(i)
    return hits

print(naive_search("abracadabra", "abra"))
print(naive_search("aaaaa", "aa"))          # overlapping matches count
```

Worst case (text `"aaaa…ab"`, pattern `"aaab"`): almost every start compares nearly m characters, O(n·m).

## 2. KMP (Knuth–Morris–Pratt): O(n + m)

When the naive method fails partway through a match, it throws away everything it learned and restarts one position later. **KMP** precomputes, for the pattern, the **longest proper prefix that is also a suffix** (the "LPS" or failure table) of every prefix. After a mismatch, it knows how much of the pattern is **already matched** and continues from there, never moving backwards in the text.

![The LPS table for the pattern "ababaca": 0 0 1 2 3 0 1. Under it, a text being matched: after matching "ababa" and failing on the next character, KMP slides the pattern so that its prefix "aba" lines up with the "aba" it just read, instead of starting again from scratch](../figures/kmp.svg)

```python
def build_lps(p):
    lps = [0] * len(p)
    length = 0                      # length of the current matching prefix-suffix
    i = 1
    while i < len(p):
        if p[i] == p[length]:
            length += 1
            lps[i] = length
            i += 1
        elif length > 0:
            length = lps[length - 1]   # fall back to a shorter prefix-suffix
        else:
            lps[i] = 0
            i += 1
    return lps

def kmp_search(text, pattern):
    if not pattern:
        return list(range(len(text) + 1))
    lps, hits, j = build_lps(pattern), [], 0       # j = characters of the pattern matched
    for i, ch in enumerate(text):
        while j > 0 and ch != pattern[j]:
            j = lps[j - 1]                         # reuse what's already matched
        if ch == pattern[j]:
            j += 1
        if j == len(pattern):
            hits.append(i - j + 1)
            j = lps[j - 1]                         # keep going: allows overlaps
    return hits

print(build_lps("ababaca"))
print(kmp_search("abababacabababaca", "ababaca"))
print(kmp_search("aaaaa", "aa"))
```

Cost: building LPS is O(m), the search is O(n). The text pointer `i` never moves back, and `j` can only drop as many times as it has risen, so the total work is linear.

## 3. Rabin-Karp: compare hashes, with a rolling hash

Turn each length-m window of the text into a number (a **hash**) and compare numbers instead of strings. The trick is the **rolling hash**: sliding the window one step updates the hash in O(1) (remove the leaving character's contribution, shift, add the new one), like the sliding window of Lesson 8.

```python
def rabin_karp(text, pattern, base=256, mod=1_000_000_007):
    n, m = len(text), len(pattern)
    if m > n:
        return []
    high = pow(base, m - 1, mod)                    # weight of the leaving character
    hp = ht = 0
    for i in range(m):
        hp = (hp * base + ord(pattern[i])) % mod
        ht = (ht * base + ord(text[i])) % mod
    hits = []
    for i in range(n - m + 1):
        if ht == hp and text[i:i + m] == pattern:   # confirm: different strings can share a hash
            hits.append(i)
        if i + m < n:                                # roll: drop text[i], add text[i + m]
            ht = ((ht - ord(text[i]) * high) * base + ord(text[i + m])) % mod
    return hits

print(rabin_karp("abracadabra", "abra"))
```

Two different strings can have the same hash (a **collision**), so a hash match is double-checked by comparing the strings. With a good large modulus, collisions are rare: O(n + m) on average, O(n·m) in the (very unlikely) worst case. Rabin-Karp shines when searching for **many patterns** of the same length at once: store their hashes in a set.

## Which to use?

| Method | Time | Extra space | Use when |
|---|---|---|---|
| `in`, `str.find` | fast in practice | small | everyday Python |
| Naive | O(n·m) worst | O(1) | tiny inputs, interview warm-up |
| KMP | O(n + m) guaranteed | O(m) | long texts, worst-case guarantees, streaming text |
| Rabin-Karp | O(n + m) average | O(1) | many patterns, plagiarism or duplicate detection |

(Other famous ones: the **Z-algorithm**, similar to KMP; **Boyer–Moore**, which skips ahead using the pattern's last character, used in `grep`; and **Aho–Corasick** for searching many patterns at once.)

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Naive matching | try the pattern at every position | O(n·m) | O(1) |
| KMP | prefix (failure) table lets the scan never move backwards | O(n + m) | O(m) |
| Rabin-Karp | rolling hash of each window; compare text only when hashes match | O(n + m) average, O(n·m) worst | O(1) |
| Python `in` / `str.find` | optimised built-in search | about O(n) in practice | O(1) |

## Common mistakes

- Skipping overlapping matches by jumping ahead by the pattern length after a hit.
- Trusting a Rabin-Karp hash match without comparing the strings.
- Restarting the LPS length at 0 after a mismatch instead of falling back to lps[length − 1].
- Writing your own search in production code when `in` and `find` already do it fast.

## Exercises

### 1. All occurrences

Write `find_all(text, pattern)` returning a list of every start index where `pattern` occurs in `text`, including **overlapping** occurrences. Assume the pattern isn't empty. Use any method (naive is fine here).

Starter code:

```python
def find_all(text, pattern):
    pass
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** every start index, overlaps included; empty result when there's no match.
2. **Examples:** "aaaaa", "aa" → [0, 1, 2, 3].
3. **Brute force:** naive search: every start, compare a slice. O(n·m), fine for these sizes.
4. **Pattern:** a **scan**, or repeated `find` with a moving start.
5. **Plan:** loop over starts (or call find repeatedly), collecting hits.
6. **Code and test:** check the pattern longer than the text (no starts at all).

</details>

<details>
<summary>💡 Hint 1</summary>

Try every possible start position i, from 0 to `len(text) - len(pattern)`.

</details>

<details>
<summary>💡 Hint 2</summary>

Compare `text[i:i + len(pattern)] == pattern`. Or use `text.find(pattern, start)` repeatedly.

</details>

<details>
<summary>💡 Hint 3</summary>

With `find`: after a hit at `start`, search again from `start + 1` (not `start + len(pattern)`), so overlapping matches are found.

</details>

### 2. Build the KMP table

Write `build_lps(p)` that returns the LPS table: `lps[i]` is the length of the longest **proper** prefix of `p[:i + 1]` that is also a suffix of it ("proper" means not the whole string). For `"ababaca"` it's `[0, 0, 1, 2, 3, 0, 1]`. Aim for O(m).

Starter code:

```python
def build_lps(p):
    pass
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** for every prefix of p, the longest proper prefix that is also its suffix.
2. **Examples:** "aaaa" → [0, 1, 2, 3]; "abcd" → all 0; "aabaaab" → [0, 1, 0, 1, 2, 2, 3].
3. **Brute force:** for each i, try every k: O(m²) comparisons of length up to m, O(m³).
4. **Pattern:** **reuse previous answers** (a taste of dynamic programming): the next entry extends or falls back from the current one.
5. **Plan:** length = 0; for i from 1: fall back while mismatched; extend on a match; store.
6. **Code and test:** "aabaaab" tests the fall-back: at i = 5 the match of length 2 breaks and falls back to 1.

</details>

<details>
<summary>💡 Hint 1</summary>

`lps[0]` is always 0. Keep `length`, the size of the current matching prefix-suffix, as you move `i` forward.

</details>

<details>
<summary>💡 Hint 2</summary>

If `p[i] == p[length]`, the match grows: `length += 1`. If not, don't restart from 0: fall back to `length = lps[length - 1]` and try again.

</details>

<details>
<summary>💡 Hint 3</summary>

`for i in 1..m-1: while length and p[i] != p[length]: length = lps[length - 1]`; `if p[i] == p[length]: length += 1`; `lps[i] = length`.

</details>

**In the sandbox:** exercises 23–24. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. All occurrences</summary>

```python
def find_all(text, pattern):
    hits = []
    start = text.find(pattern)
    while start != -1:
        hits.append(start)
        start = text.find(pattern, start + 1)     # +1 (not + len) so overlaps are found
    return hits
```

**Line by line**

- `text.find(pattern)` returns the first index or −1.
- `text.find(pattern, start + 1)` searches again from just after the previous hit. Jumping by `len(pattern)` would skip overlapping matches like the second "aa" in "aaa".

**Trace** on `("aaaaa", "aa")`:

| search from | found at |
|---|---|
| 0 | 0 |
| 1 | 1 |
| 2 | 2 |
| 3 | 3 |
| 4 | −1 → stop |

**Complexity:** each `find` is fast in practice; worst case O(n·m) overall. KMP gives a guaranteed O(n + m).

</details>

<details>
<summary>✅ 2. Build the KMP table</summary>

```python
def build_lps(p):
    lps = [0] * len(p)
    length = 0
    for i in range(1, len(p)):
        while length > 0 and p[i] != p[length]:
            length = lps[length - 1]
        if p[i] == p[length]:
            length += 1
        lps[i] = length
    return lps
```

**Line by line**

- `length` = length of the longest prefix of `p` that also ends at position `i - 1`.
- `while length > 0 and p[i] != p[length]: length = lps[length - 1]`: the current prefix-suffix can't be extended, so try the next-longest one, which is `lps[length - 1]`. This is the clever part: no restart from zero.
- `if p[i] == p[length]: length += 1` extends by one character.

**Trace** on `"aabaaab"`:

| i | p[i] | fall-backs | length | lps |
|---|---|---|---|---|
| 1 | a | | 1 | [0, 1] |
| 2 | b | 1 → lps[0] = 0 | 0 | [0, 1, 0] |
| 3 | a | | 1 | [0, 1, 0, 1] |
| 4 | a | | 2 | [0, 1, 0, 1, 2] |
| 5 | a | 2 → lps[1] = 1 | 2 | [0, 1, 0, 1, 2, 2] |
| 6 | b | | 3 | [0, 1, 0, 1, 2, 2, 3] |

**Complexity:** O(m) time: `length` goes up at most once per step and every fall-back lowers it, so the total number of fall-backs is at most m. O(m) space.

</details>

## Quick quiz

1. What is the naive pattern search's worst-case time?
   - A) O(n · m)
   - B) O(n + m)
   - C) O(log n)

2. What does KMP's LPS table let it avoid?
   - A) Re-reading text characters after a mismatch
   - B) Comparing characters
   - C) Building any table

3. Why does Rabin-Karp compare the strings when the hashes match?
   - A) Hashes are always wrong
   - B) To make it slower
   - C) Different strings can have the same hash (a collision)

4. For everyday Python code, which should you use to find a substring?
   - A) Rabin-Karp
   - B) Your own KMP
   - C) `pattern in text` or `text.find(pattern)`

<details>
<summary>Quiz answers</summary>

1. **A) O(n · m)**: Every start position may compare almost the whole pattern.
2. **A) Re-reading text characters after a mismatch**: It knows how much of the pattern is already matched and continues from there.
3. **C) Different strings can have the same hash (a collision)**: A hash match means "probably equal", so confirm it.
4. **C) `pattern in text` or `text.find(pattern)`**: The built-ins are implemented in optimised C.

</details>

---
Previous: [Lesson 11](11-strings.md) · Next: [Lesson 13: How hash tables work](13-hash-tables.md)
