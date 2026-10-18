# Lesson 35: itertools and functools

**You'll learn:** `count`, `chain`, `product`, `combinations`, `groupby`, `reduce`, `partial`, `lru_cache`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python/#itertools-functools)**: run every example and check your exercise answers.

## Key terms

- **itertools:** the standard module of fast, lazy iteration tools.
- **Permutation:** an ordered arrangement of items.
- **Combination:** an unordered selection of items.
- **groupby:** groups consecutive items that share a key.
- **reduce:** combines items pairwise into a single value.
- **partial:** creates a function with some arguments pre-filled.

### itertools: building blocks for iteration

The `itertools` module provides fast, memory-efficient tools that return iterators.

**Counting, cycling and slicing**

```python
import itertools as it

print(list(it.islice(it.count(start=10, step=5), 4)))   # 10, 15, 20, 25
colors = it.cycle(["red", "green"])
print([next(colors) for _ in range(5)])
print(list(it.repeat("ha", 3)))
```

**Combining iterables**

```python
import itertools as it

print(list(it.chain([1, 2], (3, 4), "ab")))
print(list(it.zip_longest("abc", [1, 2], fillvalue="-")))
print(list(it.accumulate([3, 1, 4, 1, 5])))       # running totals
```

**Combinatorics**

```python
import itertools as it

print(list(it.product("AB", [1, 2])))             # every pairing
print(list(it.permutations("abc", 2)))            # ordered arrangements
print(list(it.combinations([1, 2, 3, 4], 2)))     # unordered selections
```

**Grouping consecutive items**

`groupby` groups **adjacent** items with the same key, so sort by that key first:

```python
import itertools as it

words = ["apple", "avocado", "banana", "blueberry", "cherry"]
for letter, group in it.groupby(sorted(words), key=lambda w: w[0]):
    print(letter, list(group))
```

**Filtering**

```python
import itertools as it

nums = [1, 4, 6, 3, 8, 2]
print(list(it.takewhile(lambda n: n < 5, nums)))   # stop at first failure
print(list(it.dropwhile(lambda n: n < 5, nums)))   # skip until first failure
```

## functools: tools for functions

```python
from functools import reduce, partial, lru_cache

# reduce: combine items pairwise into one value
print(reduce(lambda a, b: a * b, [1, 2, 3, 4, 5]))

# partial: pre-fill some arguments
def power(base, exp):
    return base ** exp
square = partial(power, exp=2)
cube = partial(power, exp=3)
print(square(9), cube(2))

# lru_cache: memoize expensive pure functions
@lru_cache(maxsize=None)
def ways_to_climb(steps):
    if steps <= 1:
        return 1
    return ways_to_climb(steps - 1) + ways_to_climb(steps - 2)

print(ways_to_climb(60))
print(ways_to_climb.cache_info())
```

## operator: functions for common operations

Instead of writing small lambdas, use ready-made functions from `operator`:

```python
from operator import itemgetter, attrgetter, mul
from functools import reduce

rows = [("ana", 31), ("ben", 25), ("cy", 35)]
print(sorted(rows, key=itemgetter(1)))
print(reduce(mul, [2, 3, 4]))
```

## Common mistakes

- Using `groupby` on unsorted data, which splits one key into several groups.
- Forgetting that itertools functions return iterators: wrap them in `list()` to see or reuse them.
- Caching functions with side effects or changing results with `lru_cache`.

## Exercises

### 1. Team pairings

Write `pairings(players)` that returns all unique pairs of players as a list of tuples, in the order `itertools.combinations` produces them. Then write `schedule_size(n)` returning how many pairs `n` players produce.

Starter code:

```python
import itertools

def pairings(players):
    return []

def schedule_size(n):
    return 0

print(pairings(["Ana", "Ben", "Cy"]), schedule_size(10))
```

### 2. Group by length

Write `group_by_length(words)` that returns a dict mapping each word length to a list of words with that length, using `itertools.groupby`. Words within a group should keep alphabetical order.

`group_by_length(["hi", "cat", "ox", "dog"])` → `{2: ['hi', 'ox'], 3: ['cat', 'dog']}`

Starter code:

```python
import itertools

def group_by_length(words):
    return {}

print(group_by_length(["hi", "cat", "ox", "dog"]))
```

**In the sandbox:** exercises 57–58. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. list(itertools.combinations(players, 2)). For schedule_size, count the pairings of range(n), or use the formula n * (n - 1) // 2.
2. Sort first with key=lambda w: (len(w), w), then groupby(ordered, key=len) and build a dict with list(group).

</details>

<details>
<summary>Answers</summary>

**1. Team pairings**

```python
import itertools

def pairings(players):
    return list(itertools.combinations(players, 2))

def schedule_size(n):
    return len(pairings(range(n)))

print(pairings(["Ana", "Ben", "Cy"]), schedule_size(10))
```

**2. Group by length**

```python
import itertools

def group_by_length(words):
    ordered = sorted(words, key=lambda w: (len(w), w))
    return {length: list(group) for length, group in itertools.groupby(ordered, key=len)}

print(group_by_length(["hi", "cat", "ox", "dog"]))
```

</details>

## Quick quiz

1. Why must you usually sort before `itertools.groupby`?
   - A) It only accepts sorted lists
   - B) It only groups items that are next to each other
   - C) It sorts in reverse otherwise

2. What does `partial(pow, 2)` create?
   - A) A copy of pow
   - B) The number 2
   - C) A function where the first argument of pow is fixed to 2

<details>
<summary>Quiz answers</summary>

1. **B) It only groups items that are next to each other**: Unsorted input produces several separate groups for the same key.
2. **C) A function where the first argument of pow is fixed to 2**: Calling it with x gives `pow(2, x)`.

</details>

---
Previous: [Lesson 34](34-type-hints.md) · Next: [Lesson 36: Algorithms and Big-O](36-algorithms-and-big-o.md)
