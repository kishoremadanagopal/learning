# Lesson 10: for loops and range

**You'll learn:** `for`, `range()`, `enumerate()`, `zip()`, nested loops.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python/#for-loops)**: run every example and check your exercise answers.

## Key terms

- **for loop:** runs once for each item of a sequence.
- **Iterable:** anything you can loop over: strings, lists, ranges, dicts and more.
- **range():** generates a sequence of numbers. The stop value isn't included.
- **enumerate():** gives each item together with its index.
- **zip():** walks several sequences side by side.
- **Nested loop:** a loop inside another loop.

A `for` loop takes each item from a sequence, one at a time, and runs the block for it.

```python
for letter in "hey":
    print(letter)

for fruit in ["apple", "banana", "cherry"]:
    print(f"I like {fruit}")
```

The loop variable (`letter`, `fruit`) is created for you and refers to the current item.

![A for loop runs its body once for each item: round 1 with apple, round 2 with banana, round 3 with cherry](../figures/for-loop.svg)

## range(): looping over numbers

`range` generates a sequence of numbers. Like slicing, the stop value is **not included**.

| Call | Numbers |
|---|---|
| `range(5)` | 0, 1, 2, 3, 4 |
| `range(2, 6)` | 2, 3, 4, 5 |
| `range(0, 10, 3)` | 0, 3, 6, 9 |
| `range(5, 0, -1)` | 5, 4, 3, 2, 1 |

```python
for i in range(1, 6):
    print(f"{i} x 7 = {i * 7}")
```

## for vs while

Use `for` when you're going through a collection or know how many times to repeat. Use `while` when you repeat until something happens. Most loops in real Python code are `for` loops.

## enumerate: item and position together

```python
players = ["Ana", "Ben", "Cy"]
for position, name in enumerate(players, start=1):
    print(position, name)
```

## zip: walk two lists side by side

```python
names = ["Ana", "Ben", "Cy"]
scores = [91, 78, 85]
for name, score in zip(names, scores):
    print(f"{name:<4} {score}")
```

## Nested loops

A loop inside a loop runs the inner loop completely for each pass of the outer loop:

```python
for row in range(1, 4):
    line = ""
    for col in range(1, 4):
        line += f"{row * col:4}"
    print(line)
```

## Using _ for unused variables

If you don't need the loop variable, name it `_` by convention:

```python
for _ in range(3):
    print("Hip hip hooray!")
```

## Common mistakes

- Expecting `range(1, 5)` to include 5. It gives 1, 2, 3, 4.
- Looping with `for i in range(len(items))` and then using `items[i]` when `for item in items` (or `enumerate`) is simpler.
- Changing a list while looping over it. Loop over a copy, or build a new list.

## Exercises

### 1. Sum of multiples

Write `sum_multiples(limit)` that returns the sum of all numbers **below** `limit` that are multiples of 3 or 5. For `limit = 10` that's 3 + 5 + 6 + 9 = 23.

Starter code:

```python
def sum_multiples(limit):
    total = 0

    return total

print(sum_multiples(10))
```

### 2. Draw a triangle

Write `triangle(n)` that **prints** a right triangle of `*` with `n` rows. `triangle(4)` prints:

```text
*
**
***
****
```

Starter code:

```python
def triangle(n):
    pass  # replace with your loop

triangle(4)
```

**In the sandbox:** exercises 15–16. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. for n in range(limit): then add n to total when n % 3 == 0 or n % 5 == 0.
2. Loop i from 1 to n with range(1, n + 1), and print "*" * i.

</details>

<details>
<summary>Answers</summary>

**1. Sum of multiples**

```python
def sum_multiples(limit):
    total = 0
    for n in range(limit):
        if n % 3 == 0 or n % 5 == 0:
            total += n
    return total

print(sum_multiples(10))
```

**2. Draw a triangle**

```python
def triangle(n):
    for i in range(1, n + 1):
        print("*" * i)

triangle(4)
```

</details>

## Quick quiz

1. What does `list(range(2, 10, 3))` contain?
   - A) [2, 5, 8]
   - B) [2, 5, 8, 11]
   - C) [3, 6, 9]

2. What does `enumerate(["a", "b"])` produce?
   - A) ("a", "b")
   - B) (1, "a") and (2, "b")
   - C) (0, "a") and (1, "b")

<details>
<summary>Quiz answers</summary>

1. **A) [2, 5, 8]**: Start at 2, add 3 each time, stop before 10.
2. **C) (0, "a") and (1, "b")**: It pairs each item with its index, starting at 0 unless you pass `start=`.

</details>

---
Previous: [Lesson 9](09-while-loops.md) · Next: [Lesson 11: break, continue and loop else](11-loop-control.md)
