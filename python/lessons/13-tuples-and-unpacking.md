# Lesson 13: Tuples and unpacking

**You'll learn:** tuples, immutability, unpacking, starred targets, returning several values.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python/#tuples-and-unpacking)**: run every example and check your exercise answers.

## Key terms

- **Tuple:** an ordered, unchangeable collection, usually written with parentheses.
- **Unpacking:** assigning the items of a sequence to several variables at once.
- **Starred target:** `*rest` in unpacking, which collects the remaining items into a list.
- **Hashable:** usable as a dict key or set member. Tuples of immutable values are hashable.

A **tuple** is like a list that can't change. Use parentheses (or just commas):

```python
point = (3, 4)
rgb = 255, 128, 0
single = (42,)          # one-item tuple needs a trailing comma
print(point[0], rgb, type(single))
```

Trying to change a tuple fails:

*This example raises an error on purpose.*

```python
point = (3, 4)
point[0] = 10
```

## When to use a tuple

Use a tuple for a **fixed group of related values** where position has meaning: coordinates `(x, y)`, a date `(2026, 10, 2)`, an RGB color. Use a list for a **collection of similar items** that may grow or shrink.

Tuples are also slightly faster and can be used as dictionary keys (lists can't), as you'll see next lesson.

## Unpacking

Unpacking assigns each item of a sequence to its own variable:

```python
point = (3, 4)
x, y = point
print(x, y)

name, age, city = ["Ada", 36, "London"]
print(f"{name} ({age}) lives in {city}")
```

The number of variables must match the number of items, unless you use a **starred** variable to collect the rest:

```python
first, *middle, last = [1, 2, 3, 4, 5]
print(first, middle, last)

head, *tail = "python"
print(head, tail)
```

## Returning several values from a function

Functions can return a tuple, which the caller unpacks:

```python
def min_max(nums):
    return min(nums), max(nums)

low, high = min_max([7, 2, 9, 4])
print(low, high)
```

## Unpacking in loops

```python
pairs = [("Ana", 91), ("Ben", 78)]
for name, score in pairs:
    print(name, "scored", score)
```

## Common mistakes

- Writing `(5)` for a one-item tuple. It needs a comma: `(5,)`.
- Unpacking the wrong number of items: `a, b = [1, 2, 3]` raises `ValueError`.
- Trying to change a tuple item. Build a new tuple or use a list.

## Exercises

### 1. Distance between points

Write `distance(p1, p2)` where each point is a tuple `(x, y)`. Unpack the tuples and return the straight-line distance using `((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5`.

Starter code:

```python
def distance(p1, p2):
    return 0

print(distance((0, 0), (3, 4)))
```

**In the sandbox:** exercise 20. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Start with x1, y1 = p1 and x2, y2 = p2.

</details>

<details>
<summary>Answers</summary>

**1. Distance between points**

```python
def distance(p1, p2):
    x1, y1 = p1
    x2, y2 = p2
    return ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5

print(distance((0, 0), (3, 4)))
```

</details>

## Quick quiz

1. Which creates a tuple with one item?
   - A) `tuple 5`
   - B) `(5)`
   - C) `(5,)`

2. What is `b` after `a, *b = [1, 2, 3]`?
   - A) [2, 3]
   - B) (2, 3)
   - C) 2

<details>
<summary>Quiz answers</summary>

1. **C) `(5,)`**: `(5)` is just the number 5 in parentheses. The comma makes it a tuple.
2. **A) [2, 3]**: A starred target always collects the remaining items into a list.

</details>

---
Previous: [Lesson 12](12-lists.md) · Next: [Lesson 14: Dictionaries](14-dictionaries.md)
