# Lesson 31: Iterators and generators

**You'll learn:** `iter()`/`next()`, `yield`, laziness, generator expressions, pipelines, `yield from`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python/#iterators-and-generators)**: run every example and check your exercise answers.

## Key terms

- **Iterable:** an object you can loop over.
- **Iterator:** an object that produces items one at a time with `next()`.
- **StopIteration:** the exception an iterator raises when it has no more items.
- **Generator function:** a function with `yield`, which returns a generator.
- **Generator expression:** `(expr for x in items)`, a lazy comprehension.
- **Lazy evaluation:** computing values only when they're needed.

### How a for loop really works

Anything you can loop over is an **iterable**. When a `for` loop starts, it calls `iter()` on the iterable to get an **iterator**, then calls `next()` on it repeatedly until it raises `StopIteration`.

```python
colors = ["red", "green"]
it = iter(colors)
print(next(it))
print(next(it))
try:
    next(it)
except StopIteration:
    print("No more items: this is how the loop knows to stop")
```

## Generators: functions that yield

A **generator function** uses `yield` instead of `return`. Calling it doesn't run the body; it returns a generator object. Each `next()` runs the body until the next `yield`, then **pauses**, remembering where it was.

```python
def count_up_to(limit):
    print("  (starting)")
    n = 1
    while n <= limit:
        yield n
        n += 1
    print("  (finished)")

gen = count_up_to(3)
print(next(gen))
print(next(gen))
for value in gen:          # carries on from where it paused
    print(value)
```

## Why generators matter: laziness

A generator produces values **one at a time, on demand**. It never builds the whole sequence in memory. That makes it possible to work with huge or even infinite sequences:

```python
def fibonacci():
    a, b = 0, 1
    while True:            # infinite, but only computed as needed
        yield a
        a, b = b, a + b

for i, f in enumerate(fibonacci()):
    if i >= 10:
        break
    print(f, end=" ")
print()
```

## Generator expressions

Like a list comprehension, but with parentheses. It produces items lazily:

```python
squares_list = [n * n for n in range(10)]     # builds the whole list
squares_gen = (n * n for n in range(10))      # builds nothing yet
print(squares_list)
print(squares_gen)
print(sum(n * n for n in range(1_000_000)))   # no million-item list in memory
```

When you pass a generator expression as the only argument, you can drop the extra parentheses, as with `sum(...)` above.

## Generator pipelines

Generators chain together like an assembly line, each stage pulling items from the previous one. This is how you'd process a log file too big to fit in memory:

```python
log_lines = [
    "INFO start",
    "ERROR disk full",
    "INFO retry",
    "ERROR timeout",
    "WARN slow",
]

def read(lines):
    for line in lines:
        yield line.strip()

def only_errors(lines):
    for line in lines:
        if line.startswith("ERROR"):
            yield line

def messages(lines):
    for line in lines:
        yield line.split(" ", 1)[1]

for msg in messages(only_errors(read(log_lines))):
    print(msg)
```

## yield from

`yield from` hands over to another iterable, yielding all of its items:

```python
def walk(tree):
    for item in tree:
        if isinstance(item, list):
            yield from walk(item)
        else:
            yield item

print(list(walk([1, [2, [3, 4]], 5])))
```

## A generator is single-use

Once a generator is exhausted, it stays empty. Call the generator function again to get a fresh one.

```python
gen = (x for x in range(3))
print(list(gen))
print(list(gen))
```

## Common mistakes

- Reusing an exhausted generator. It stays empty; create a new one.
- Calling `len()` on a generator. It doesn't know its length; convert to a list if you need it.
- Using `return value` in a generator to produce items. Use `yield`.

## Exercises

### 1. Chunks

Write a generator `chunks(items, size)` that yields lists of at most `size` items.

`list(chunks([1, 2, 3, 4, 5], 2))` → `[[1, 2], [3, 4], [5]]`

Starter code:

```python
def chunks(items, size):
    return [items]

print(list(chunks([1, 2, 3, 4, 5], 2)))
```

### 2. Running total

Write a generator `running_total(nums)` that yields the cumulative sum after each number.

`list(running_total([3, 1, 4]))` → `[3, 4, 8]`

Starter code:

```python
def running_total(nums):
    pass

print(list(running_total([3, 1, 4])))
```

**In the sandbox:** exercises 51–52. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Collect items into a batch list. When it reaches size, yield it and start a new one. After the loop, yield any leftover batch.
2. Keep a total variable; for each n, add it and yield total.

</details>

<details>
<summary>Answers</summary>

**1. Chunks**

```python
def chunks(items, size):
    batch = []
    for item in items:
        batch.append(item)
        if len(batch) == size:
            yield batch
            batch = []
    if batch:
        yield batch

print(list(chunks([1, 2, 3, 4, 5], 2)))
```

**2. Running total**

```python
def running_total(nums):
    total = 0
    for n in nums:
        total += n
        yield total

print(list(running_total([3, 1, 4])))
```

</details>

## Quick quiz

1. What does calling a generator function return?
   - A) The first yielded value
   - B) A list of all values
   - C) A generator object, without running the body yet

2. What's the main benefit of `(x * 2 for x in data)` over `[x * 2 for x in data]`?
   - A) It can be reused many times
   - B) It doesn't build the whole result in memory
   - C) It's always faster

<details>
<summary>Quiz answers</summary>

1. **C) A generator object, without running the body yet**: The body only starts running when you ask for the first value with `next()` or a loop.
2. **B) It doesn't build the whole result in memory**: Generator expressions are lazy. They're single-use, though.

</details>

---
Previous: [Lesson 30](30-properties-and-dataclasses.md) · Next: [Lesson 32: Decorators](32-decorators.md)
