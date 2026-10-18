# Lesson 11: Working with strings

**You'll learn:** immutability, building strings with join, characters and ord/chr, counting letters, anagrams by sorting or counting, split and join, run-length encoding, reversing words.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/dsa/#strings)**: run every example and check your exercise answers.

## Key terms

- **Immutable:** can't be changed after creation; strings must be rebuilt instead.
- **join:** `sep.join(parts)` glues a list of strings together with sep between them, in one pass.
- **ord / chr:** convert a character to its code number and back.
- **Anagram:** a word made by rearranging all the letters of another.
- **Run-length encoding:** replacing runs of a repeated character with the character and its count.
- **Whitespace:** spaces, tabs and newlines.

Strings are **sequences of characters**: indexing, slicing, `len`, `in` and loops work like lists. The big difference: strings are **immutable**. You can't change a character; every "change" creates a new string.

```python
s = "hello"
try:
    s[0] = "H"
except TypeError as e:
    print("TypeError:", e)
s = "H" + s[1:]           # build a new string instead
print(s)
```

## Building strings efficiently

Because each `+` makes a new string, building a long string piece by piece can cost O(n²) in the worst case. The reliable idiom: collect pieces in a list, `"".join(...)` once.

```python
words = ["data", "structures", "and", "algorithms"]
print(" ".join(words))
print("-".join(w.upper() for w in words))
chars = list("hello")
chars[0] = "j"                     # lists are mutable
print("".join(chars))
```

(CPython sometimes optimises `s += piece` in a loop, but other Pythons don't, and it's an implementation detail. In interviews, use `join`.)

## Characters are numbers underneath

`ord(ch)` gives a character's code number; `chr(n)` goes back. Letters are consecutive, so `ord(ch) - ord("a")` maps "a"–"z" to 0–25, handy for fixed-size count arrays.

```python
print(ord("a"), ord("b"), ord("z"), chr(97))
counts = [0] * 26
for ch in "banana":
    counts[ord(ch) - ord("a")] += 1
print({chr(i + ord("a")): n for i, n in enumerate(counts) if n})
```

## Anagrams: two ways

Two words are **anagrams** if they use the same letters the same number of times.

```python
from collections import Counter

def is_anagram_sort(a, b):          # O(n log n)
    return sorted(a) == sorted(b)

def is_anagram_count(a, b):         # O(n)
    return len(a) == len(b) and Counter(a) == Counter(b)

print(is_anagram_sort("listen", "silent"), is_anagram_count("rat", "car"))
```

## Useful built-ins

| Method | Example | Result |
|---|---|---|
| `split()` | `"  a b  c ".split()` | `['a', 'b', 'c']` (any whitespace) |
| `strip()` | `"  hi ".strip()` | `'hi'` |
| `lower()`, `upper()` | `"Hi".lower()` | `'hi'` |
| `isalnum()`, `isalpha()`, `isdigit()` | `"a1".isalnum()` | `True` |
| `startswith`, `endswith` | `"data".startswith("da")` | `True` |
| `find(sub)` | `"banana".find("an")` | `1` (−1 if missing) |
| `replace(a, b)` | `"a-b".replace("-", " ")` | `'a b'` |
| `s[::-1]` | `"abc"[::-1]` | `'cba'` |

All of these are O(n): they look at the whole string.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Build a string | append pieces to a list, `''.join` once | O(n) | O(n) |
| Characters as numbers | `ord`/`chr`, counts in an array of 26 | O(1) per char | O(1) for a fixed alphabet |
| Anagram check | sort both, or compare Counters | O(n log n) or O(n) | O(n) |
| Run-length encoding | count runs of equal characters in one pass | O(n) | O(n) |
| Reverse the words | split, reverse the list, join | O(n) | O(n) |

## Common mistakes

- Trying to assign to a character, like `s[0] = "x"`.
- Building a big string with + in a loop instead of collecting parts and joining.
- Using `split(" ")`, which keeps empty strings between double spaces; `split()` handles any whitespace.
- Forgetting to output the last run when encoding runs.

## Exercises

### 1. Run-length encoding

Write `compress(s)` that replaces each run of the same character with the character followed by the run's length: `"aaabcc"` → `"a3b1c2"`. An empty string gives `""`. Build the result with a list and `join`.

Starter code:

```python
def compress(s):
    pass
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** consecutive equal characters form a run; output char + count for each run, in order.
2. **Examples:** "aaabcc" → "a3b1c2"; "aabaa" → "a2b1a2" (runs, not totals); "zzzzzzzzzzzz" → "z12".
3. **Brute force:** this is already one pass; the care is in the bookkeeping.
4. **Pattern:** **run tracking**: compare each item with the current run.
5. **Plan:** start a run with s[0]; for the rest: same → count up; different → save the run, start a new one; after the loop save the last run.
6. **Code and test:** empty string and one character are the edge cases.

</details>

<details>
<summary>💡 Hint 1</summary>

Walk through the string keeping the current run's character and its length.

</details>

<details>
<summary>💡 Hint 2</summary>

When the character changes, the previous run is finished: add `char + str(length)` to a list and start a new run.

</details>

<details>
<summary>💡 Hint 3</summary>

Don't forget the **last** run after the loop ends. Then `return "".join(parts)`.

</details>

### 2. Reverse the words

Write `reverse_words(s)` that returns the words of `s` in reverse order, separated by single spaces, with no leading or trailing spaces. Words are separated by one or more spaces.

Starter code:

```python
def reverse_words(s):
    pass
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** words, not characters, are reversed; extra spaces disappear.
2. **Examples:** "  hello world  " → "world hello"; "   " → "".
3. **Brute force:** scan characters, collect words manually: fine, but long.
4. **Pattern:** **split → transform → join**, the standard Python string pipeline.
5. **Plan:** `split()`, reverse, `" ".join`.
6. **Code and test:** `split()` (no argument) is the key: `split(" ")` would produce empty strings between double spaces.

</details>

<details>
<summary>💡 Hint 1</summary>

`split()` with no argument splits on any run of whitespace and ignores spaces at the ends.

</details>

<details>
<summary>💡 Hint 2</summary>

Reverse the list of words, then join them with single spaces.

</details>

<details>
<summary>💡 Hint 3</summary>

`return " ".join(reversed(s.split()))`.

</details>

**In the sandbox:** exercises 21–22. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Run-length encoding</summary>

```python
def compress(s):
    if not s:
        return ""
    parts = []
    run_char, run_len = s[0], 1
    for ch in s[1:]:
        if ch == run_char:
            run_len += 1
        else:
            parts.append(run_char + str(run_len))
            run_char, run_len = ch, 1
    parts.append(run_char + str(run_len))       # the last run
    return "".join(parts)
```

**Line by line**

- `if not s: return ""` because `s[0]` would fail on an empty string.
- `run_char, run_len = s[0], 1` starts the first run.
- When `ch` differs, the run ended: save it with `str(run_len)` (numbers must become text before joining).
- The final `parts.append(...)` after the loop: the last run never meets a "different" character, so the loop never saves it. Forgetting it is the most common bug.

**Trace** on `"aaabcc"`:

| ch | same as run? | run | parts |
|---|---|---|---|
| (start) | | a×1 | [] |
| a | yes | a×2 | [] |
| a | yes | a×3 | [] |
| b | no | b×1 | [a3] |
| c | no | c×1 | [a3, b1] |
| c | yes | c×2 | [a3, b1] |
| end | | | [a3, b1, c2] |

**Complexity:** O(n) time and space.

**Python shortcut:** `"".join(ch + str(len(list(g))) for ch, g in itertools.groupby(s))`: `groupby` groups consecutive equal items.

</details>

<details>
<summary>✅ 2. Reverse the words</summary>

```python
def reverse_words(s):
    return " ".join(reversed(s.split()))
```

**Line by line**

- `s.split()` with no argument splits on any whitespace and drops empty pieces: `"  a   b "` → `['a', 'b']`.
- `reversed(...)` walks the list backwards without copying.
- `" ".join(...)` puts exactly one space between words.

**Trace** on `"a good   example"`:

| step | value |
|---|---|
| split() | ['a', 'good', 'example'] |
| reversed | example, good, a |
| join | "example good a" |

**Common wrong approach:** `s.split(" ")`. For `"a  b"` it gives `['a', '', 'b']`, so the output gets double spaces.

**Complexity:** O(n) time and space.

**Interview follow-up:** "do it in place with O(1) extra space" (in languages with mutable strings): reverse the whole string, then reverse each word, the same three-reversal idea as rotating an array.

</details>

## Quick quiz

1. Why does `s[0] = "H"` fail for a string?
   - A) You must use s.set(0, "H")
   - B) Strings are immutable
   - C) Strings can't be indexed

2. What's the reliable way to build a long string from many parts?
   - A) Append the parts to a list and "".join(parts) once
   - B) Use += in a loop
   - C) Convert to an int

3. `ord(ch) - ord("a")` is useful because:
   - A) It maps "a"–"z" to 0–25, so a list of 26 counters can count letters
   - B) It removes spaces
   - C) It sorts letters

4. What does `"  a  b ".split()` return?
   - A) ['a', 'b']
   - B) ['', '', 'a', '', 'b', '']
   - C) ['a  b']

<details>
<summary>Quiz answers</summary>

1. **B) Strings are immutable**: Build a new string instead, e.g. "H" + s[1:].
2. **A) Append the parts to a list and "".join(parts) once**: join builds the result in one O(total length) pass.
3. **A) It maps "a"–"z" to 0–25, so a list of 26 counters can count letters**: Letters have consecutive codes.
4. **A) ['a', 'b']**: split() with no argument splits on runs of whitespace and ignores the ends.

</details>

---
Previous: [Lesson 10](10-matrices.md) · Next: [Lesson 12: Pattern matching: naive, KMP and Rabin-Karp](12-string-matching.md)
