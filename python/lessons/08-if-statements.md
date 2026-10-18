# Lesson 8: if, elif and else

**You'll learn:** `if`, `elif`, `else`, indentation, nesting, conditional expressions, `match`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python/#if-statements)**: run every example and check your exercise answers.

## Key terms

- **Condition:** the boolean expression an `if` tests.
- **Block:** a group of indented lines that belong together.
- **Indentation:** spaces at the start of a line. Python uses it to define blocks (4 spaces is standard).
- **Branch:** one of the paths an `if` / `elif` / `else` can take.
- **Conditional expression:** a one-line choice: `a if condition else b`.
- **match / case:** compares one value against several patterns (Python 3.10+).

An `if` statement runs a block of code only when its condition is true.

```python
temperature = 31
if temperature > 30:
    print("It's hot today.")
    print("Drink some water.")
print("Have a nice day!")
```

Two things to notice:

1. The line ends with a **colon** `:`.
2. The code that belongs to the `if` is **indented** (4 spaces is the standard). Indentation isn't decoration in Python; it's how Python knows which lines are inside the block. The last `print` isn't indented, so it always runs.

## else and elif

`else` runs when the condition is false. `elif` ("else if") checks another condition. Python checks the branches from top to bottom and runs **only the first** one that matches.

![A flowchart for score = 82: the test score >= 90 is false, score >= 80 is true, so grade becomes B and the remaining tests are skipped](../figures/if-elif.svg)

```python
score = 82
if score >= 90:
    grade = "A"
elif score >= 80:
    grade = "B"
elif score >= 70:
    grade = "C"
else:
    grade = "F"
print(f"Score {score} gets grade {grade}")
```

Order matters. If you checked `score >= 70` first, an 82 would get a C.

## Nested ifs

You can put an `if` inside another `if`. Keep nesting shallow; deeply nested code is hard to read. Often `and` can replace a level of nesting.

```python
logged_in = True
is_admin = False
if logged_in:
    if is_admin:
        print("Welcome to the admin panel")
    else:
        print("Welcome back")
else:
    print("Please log in")
```

## One-line conditional expressions

For choosing between two values, Python has a compact form: `value_if_true if condition else value_if_false`.

```python
n = 7
kind = "even" if n % 2 == 0 else "odd"
print(f"{n} is {kind}")
```

## match: checking one value against many options

Python 3.10 added `match`, which is tidy when you compare one value against several fixed options. `_` matches anything.

```python
command = "stop"
match command:
    case "start":
        print("Starting...")
    case "stop" | "quit":
        print("Stopping.")
    case _:
        print("Unknown command")
```

## Common mistakes

- Forgetting the colon at the end of `if`, `elif`, `else`.
- Mixing tabs and spaces, or indenting inconsistently, which causes `IndentationError`.
- Putting a broad condition first: check `score >= 90` before `score >= 80`, or the higher branch never runs.
- Writing a separate `if` instead of `elif`, so several branches run.

## Exercises

### 1. FizzBuzz for one number

Write code that sets `result` based on the number `n`:

- `"FizzBuzz"` if `n` is divisible by both 3 and 5
- `"Fizz"` if divisible by 3 only
- `"Buzz"` if divisible by 5 only
- otherwise the number as a string, like `"7"`

Wrap it in the function `fizzbuzz(n)` that's already started for you (you'll learn functions properly in Part 4; for now, just indent your code inside it and keep the `return`).

Starter code:

```python
def fizzbuzz(n):
    result = str(n)
    # your if / elif / else here

    return result

print(fizzbuzz(15), fizzbuzz(9), fizzbuzz(10), fizzbuzz(7))
```

### 2. Ticket price

Write `ticket_price(age)` that returns: `0` for children under 3, `8` for ages 3 to 12, `15` for ages 13 to 64, and `10` for 65 and over.

Starter code:

```python
def ticket_price(age):
    return 15

print(ticket_price(2), ticket_price(10), ticket_price(30), ticket_price(70))
```

**In the sandbox:** exercises 12–13. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Check the "both" case first (n % 15 == 0, or n % 3 == 0 and n % 5 == 0). Otherwise a 15 would stop at the Fizz branch.
2. Check from youngest to oldest: if age < 3 ... elif age <= 12 ... elif age <= 64 ... else ...

</details>

<details>
<summary>Answers</summary>

**1. FizzBuzz for one number**

```python
def fizzbuzz(n):
    if n % 15 == 0:
        result = "FizzBuzz"
    elif n % 3 == 0:
        result = "Fizz"
    elif n % 5 == 0:
        result = "Buzz"
    else:
        result = str(n)
    return result

print(fizzbuzz(15), fizzbuzz(9), fizzbuzz(10), fizzbuzz(7))
```

**2. Ticket price**

```python
def ticket_price(age):
    if age < 3:
        return 0
    elif age <= 12:
        return 8
    elif age <= 64:
        return 15
    else:
        return 10

print(ticket_price(2), ticket_price(10), ticket_price(30), ticket_price(70))
```

</details>

## Quick quiz

1. With `x = 5`, what does this print? `if x > 3: print("big")` then `elif x > 1: print("small")`
   - A) `big`, then `small`
   - B) `big`
   - C) `small`

2. What defines which lines belong to an `if` block?
   - A) The word `end`
   - B) Indentation
   - C) Curly braces

<details>
<summary>Quiz answers</summary>

1. **B) `big`**: Only the first matching branch runs. Once `x > 3` matches, the `elif` is skipped.
2. **B) Indentation**: Python uses indentation to group lines into blocks.

</details>

---
Previous: [Lesson 7](07-booleans-and-comparisons.md) · Next: [Lesson 9: while loops](09-while-loops.md)
