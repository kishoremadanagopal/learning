# Lesson 21: Lambdas and higher-order functions

**You'll learn:** functions as values, `lambda`, `key=` for sorting, `map`, `filter`, `any`, `all`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python/#lambdas-and-higher-order)**: run every example and check your exercise answers.

## Key terms

- **First-class function:** a function treated as a value: stored, passed and returned.
- **Higher-order function:** a function that takes or returns another function.
- **lambda:** a small anonymous function written in one expression.
- **key function:** a function that tells `sorted`, `min` or `max` what to compare.
- **map() / filter():** apply a function to every item / keep items where it's truthy.

In Python, functions are **values**, just like numbers and strings. You can store them in variables, put them in lists and pass them to other functions.

```python
def shout(text):
    return text.upper() + "!"

def whisper(text):
    return text.lower() + "..."

for style in [shout, whisper]:
    print(style("Hello"))
```

A function that takes or returns another function is called a **higher-order function**.

## lambda: tiny anonymous functions

`lambda` creates a small function in one expression: `lambda parameters: expression`.

```python
square = lambda n: n * n
print(square(7))

add = lambda a, b: a + b
print(add(2, 3))
```

Lambdas are best used inline, as arguments. If you're assigning one to a name, a normal `def` is clearer.

## Sorting with a key

`sorted`, `min` and `max` accept a `key` function that decides **what to compare**:

```python
words = ["banana", "Kiwi", "apple", "fig"]
print(sorted(words))                      # capital letters sort first
print(sorted(words, key=str.lower))       # case-insensitive
print(sorted(words, key=len))             # by length

people = [("Ana", 31), ("Ben", 25), ("Cy", 35)]
print(sorted(people, key=lambda p: p[1]))
print(max(people, key=lambda p: p[1]))
```

Sort by several things by returning a tuple: `key=lambda p: (p.age, p.name)`.

## map and filter

`map(func, items)` applies a function to every item. `filter(func, items)` keeps items where the function returns something truthy. Both return lazy iterators, so wrap them in `list()` to see the results.

```python
nums = [1, 2, 3, 4, 5, 6]
print(list(map(lambda n: n * 10, nums)))
print(list(filter(lambda n: n % 2 == 0, nums)))
print(list(map(str.upper, ["a", "b"])))
```

Comprehensions usually read better than `map`/`filter` with lambdas: `[n * 10 for n in nums]`. Use whichever is clearer.

## any and all

```python
scores = [72, 88, 95, 61]
print(any(s > 90 for s in scores))
print(all(s >= 60 for s in scores))
```

## Dispatch tables

A dictionary of functions can replace a long `if/elif` chain:

```python
ops = {
    "+": lambda a, b: a + b,
    "-": lambda a, b: a - b,
    "*": lambda a, b: a * b,
}
print(ops["*"](6, 7))
```

## Common mistakes

- Calling the key function by accident: `sorted(words, key=len())` is wrong; pass `key=len`.
- Assigning lambdas to names (`square = lambda x: x * x`). Use `def` for named functions.
- Forgetting that `map` and `filter` are lazy. Wrap them in `list()` to see the results.

## Exercises

### 1. Leaderboard

Write `leaderboard(scores)` that takes a list of `(name, points)` tuples and returns the names sorted by points **highest first**. When points are tied, sort those names alphabetically.

`leaderboard([("Cy", 50), ("Ana", 70), ("Ben", 50)])` → `["Ana", "Ben", "Cy"]`

Starter code:

```python
def leaderboard(scores):
    return [name for name, points in scores]

print(leaderboard([("Cy", 50), ("Ana", 70), ("Ben", 50)]))
```

### 2. Apply twice

Write `apply_twice(func, value)` that calls `func` on `value`, then calls `func` again on the result.

`apply_twice(lambda x: x + 3, 10)` → `16`

Starter code:

```python
def apply_twice(func, value):
    return value

print(apply_twice(lambda x: x + 3, 10))
```

**In the sandbox:** exercises 33–34. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Sort with key=lambda s: (-s[1], s[0]). Negating the points puts the highest first while names stay A to Z.
2. return func(func(value))

</details>

<details>
<summary>Answers</summary>

**1. Leaderboard**

```python
def leaderboard(scores):
    ordered = sorted(scores, key=lambda s: (-s[1], s[0]))
    return [name for name, points in ordered]

print(leaderboard([("Cy", 50), ("Ana", 70), ("Ben", 50)]))
```

**2. Apply twice**

```python
def apply_twice(func, value):
    return func(func(value))

print(apply_twice(lambda x: x + 3, 10))
```

</details>

## Quick quiz

1. What does `sorted(["bb", "a", "ccc"], key=len)` return?
   - A) ['a', 'bb', 'ccc']
   - B) ['ccc', 'bb', 'a']
   - C) [1, 2, 3]

2. What does `list(filter(lambda x: x > 2, [1, 2, 3, 4]))` give?
   - A) [1, 2]
   - B) [3, 4]
   - C) [True, True]

<details>
<summary>Quiz answers</summary>

1. **A) ['a', 'bb', 'ccc']**: `key=len` compares lengths but returns the original strings.
2. **B) [3, 4]**: filter keeps the items for which the function returns True.

</details>

---
Previous: [Lesson 20](20-scope-and-closures.md) · Next: [Lesson 22: Recursion](22-recursion.md)
