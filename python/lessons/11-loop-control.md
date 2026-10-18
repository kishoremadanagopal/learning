# Lesson 11: break, continue and loop else

**You'll learn:** `break`, `continue`, `while True`, loop `else`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python/#loop-control)**: run every example and check your exercise answers.

## Key terms

- **break:** exits the loop immediately.
- **continue:** skips the rest of this iteration and moves to the next.
- **while True:** an intentionally infinite loop that ends with `break`.
- **Loop else:** a block that runs only if the loop finished without `break`.
- **Sentinel value:** a special input that means "stop", like `"done"`.

Sometimes you need to leave a loop early or skip part of it.

## break: stop the loop now

```python
numbers = [4, 7, 12, -1, 8]
for n in numbers:
    if n < 0:
        print("Found a negative number, stopping.")
        break
    print("Processing", n)
```

## continue: skip to the next iteration

```python
for n in range(1, 11):
    if n % 3 == 0:
        continue          # skip multiples of 3
    print(n, end=" ")
print()
```

## while True with break

A popular pattern for menus and input loops is an infinite loop with a `break` inside:

*Input typed for this example: `5`, `abc`, `-3`, `12`*

```python
while True:
    text = input("Enter a positive number: ")
    if text.isdigit() and int(text) > 0:
        print("Thanks, you entered", text)
        break
    print("That's not a positive whole number, try again.")
```

## The loop else clause

A loop can have an `else` block. It runs only if the loop finished **without** hitting `break`. It's perfect for searches:

```python
def first_divisor(n):
    for d in range(2, n):
        if n % d == 0:
            print(f"{n} is divisible by {d}")
            break
    else:
        print(f"{n} is prime")

first_divisor(91)
first_divisor(97)
```

Read the `else` as "if no break". Many programmers don't know this feature, so add a comment when you use it.

## Common mistakes

- Putting `break` outside the `if`, so the loop always stops after one pass.
- Forgetting that `else` on a loop runs when there was *no* `break`. Add a comment when you use it.
- Writing `while True` without any reachable `break`.

## Exercises

### 1. Is it prime?

Write `is_prime(n)` that returns `True` if `n` is a prime number and `False` otherwise. Numbers below 2 are not prime. Use a loop with an early exit.

To keep it fast, you only need to test divisors up to the square root of `n`: `d * d <= n`.

Starter code:

```python
def is_prime(n):
    return False

print([n for n in range(20) if is_prime(n)])
```

**In the sandbox:** exercise 17. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Return False right away for n < 2. Then loop d from 2 while d * d <= n; if n % d == 0, return False. If the loop finishes, return True.

</details>

<details>
<summary>Answers</summary>

**1. Is it prime?**

```python
def is_prime(n):
    if n < 2:
        return False
    d = 2
    while d * d <= n:
        if n % d == 0:
            return False
        d += 1
    return True

print([n for n in range(20) if is_prime(n)])
```

</details>

## Quick quiz

1. What does `continue` do?
   - A) Ends the loop
   - B) Restarts the loop from the beginning
   - C) Skips the rest of this iteration and moves to the next

2. When does a `for ... else` block run?
   - A) Only if the loop body never ran
   - B) Always
   - C) When the loop ends without `break`

<details>
<summary>Quiz answers</summary>

1. **C) Skips the rest of this iteration and moves to the next**: `continue` jumps straight to the next item; `break` ends the loop.
2. **C) When the loop ends without `break`**: The `else` is skipped only when `break` exits the loop.

</details>

---
Previous: [Lesson 10](10-for-loops.md) · Next: [Lesson 12: Lists](12-lists.md)
