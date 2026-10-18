# Lesson 22: Recursion

**You'll learn:** base case, recursive case, the call stack, `RecursionError`, memoization.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python/#recursion)**: run every example and check your exercise answers.

## Key terms

- **Recursion:** a function calling itself on a smaller version of the problem.
- **Base case:** the condition where the function returns without recursing.
- **Recursive case:** the part that calls the function again with a smaller input.
- **Call stack:** the list of function calls waiting to finish.
- **RecursionError:** raised when calls go too deep.
- **Memoization:** caching results so repeated calls are instant, e.g. with `@lru_cache`.

A **recursive** function calls itself to solve a smaller version of the same problem. Every recursive function needs:

1. A **base case** that returns an answer directly, without recursing.
2. A **recursive case** that moves towards the base case.

```python
def countdown(n):
    if n == 0:              # base case
        print("Liftoff!")
        return
    print(n)
    countdown(n - 1)        # recursive case: smaller problem

countdown(3)
```

## Factorial

The factorial of `n` (written `n!`) is `n × (n-1) × ... × 1`. Notice that `n! = n × (n-1)!`, which is a recursive definition:

![factorial(4) calls factorial(3), which calls factorial(2), which calls factorial(1); then the answers 1, 2, 6 and 24 come back up](../figures/recursion-stack.svg)

```python
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

print(factorial(5))
print(factorial(20))
```

Trace `factorial(3)`: it waits for `factorial(2)`, which waits for `factorial(1)`, which returns 1. Then the results multiply back up: 1, 2, 6. Each waiting call sits on the **call stack**.

## Forgetting the base case

Without a base case, the function calls itself until Python gives up with a `RecursionError`. Python limits the depth (usually about 1000 calls; less in this browser version) to protect your computer.

## Recursion fits tree-shaped data

Recursion is most useful when data contains smaller copies of itself, like folders inside folders, or lists inside lists:

```python
def flatten(items):
    result = []
    for item in items:
        if isinstance(item, list):
            result.extend(flatten(item))   # recurse into the sub-list
        else:
            result.append(item)
    return result

print(flatten([1, [2, [3, 4], 5], [[6]], 7]))
```

## Recursion vs loops

Many recursive functions can be written as loops, which are often faster in Python and have no depth limit. Use recursion when it makes the code clearer: trees, nested structures, divide-and-conquer algorithms like merge sort (Part 7).

## Memoization: remembering results

A naive recursive Fibonacci recomputes the same values again and again. Caching results makes it dramatically faster:

```python
from functools import lru_cache

@lru_cache(maxsize=None)
def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)

print(fib(80))
```

The `@lru_cache` line is a *decorator*; you'll learn how they work in Part 7.

## Common mistakes

- Missing or unreachable base case, causing `RecursionError`.
- Not moving towards the base case (calling `f(n)` instead of `f(n - 1)`).
- Forgetting to `return` the recursive call's result.

## Exercises

### 1. Sum of digits

Write a **recursive** `digit_sum(n)` that returns the sum of the digits of a non-negative integer. `digit_sum(1234)` → `10`.

Hint: the last digit is `n % 10`, and the rest is `n // 10`.

Starter code:

```python
def digit_sum(n):
    return 0

print(digit_sum(1234))
```

### 2. Power

Write a recursive `power(base, exp)` for non-negative integer exponents without using `**` or `pow`.

Starter code:

```python
def power(base, exp):
    return 1

print(power(2, 10))
```

**In the sandbox:** exercises 35–36. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Base case: if n < 10, return n. Otherwise return n % 10 + digit_sum(n // 10).
2. Anything to the power 0 is 1 (base case). Otherwise base ** exp equals base * power(base, exp - 1).

</details>

<details>
<summary>Answers</summary>

**1. Sum of digits**

```python
def digit_sum(n):
    if n < 10:
        return n
    return n % 10 + digit_sum(n // 10)

print(digit_sum(1234))
```

**2. Power**

```python
def power(base, exp):
    if exp == 0:
        return 1
    return base * power(base, exp - 1)

print(power(2, 10))
```

</details>

## Quick quiz

1. What happens if a recursive function has no base case?
   - A) It runs forever silently
   - B) It returns None
   - C) It raises RecursionError

2. Which problem is the most natural fit for recursion?
   - A) Printing a list
   - B) Walking through folders that contain folders
   - C) Adding numbers from 1 to 10

<details>
<summary>Quiz answers</summary>

1. **C) It raises RecursionError**: Python limits how deep calls can go and raises RecursionError when the limit is reached.
2. **B) Walking through folders that contain folders**: Nested, tree-shaped data maps naturally onto a function that calls itself for each sub-part.

</details>

---
Previous: [Lesson 21](21-lambdas-and-higher-order.md) · Next: [Lesson 23: Exceptions and error handling](23-exceptions.md)
