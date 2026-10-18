# Lesson 23: Exceptions and error handling

**You'll learn:** tracebacks, `try`/`except`/`else`/`finally`, `raise`, custom exceptions, EAFP.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python/#exceptions)**: run every example and check your exercise answers.

## Key terms

- **Exception:** an error that happens while the program runs.
- **Traceback:** the error report showing the exception and the chain of calls that led to it.
- **try / except:** run code and handle specific exceptions if they happen.
- **finally:** a block that always runs, used for cleanup.
- **raise:** trigger an exception yourself.
- **Custom exception:** your own exception class, inheriting from `Exception`.
- **EAFP:** "Easier to Ask Forgiveness than Permission": try the operation and handle failure.

An **exception** is Python's way of saying "something went wrong while running". If nothing handles it, the program stops and prints a **traceback**.

*This example raises an error on purpose.*

```python
def divide(a, b):
    return a / b

print(divide(10, 2))
print(divide(1, 0))
```

## Reading a traceback

Read tracebacks from the **bottom up**:

1. The last line names the exception type and message: `ZeroDivisionError: division by zero`.
2. The lines above show the chain of calls, ending at the line that failed.

Common exceptions you'll meet:

| Exception | Typical cause |
|---|---|
| `NameError` | using a variable that doesn't exist (often a typo) |
| `TypeError` | wrong type, like `"a" + 1` |
| `ValueError` | right type, wrong value, like `int("abc")` |
| `IndexError` | list index out of range |
| `KeyError` | missing dictionary key |
| `AttributeError` | method or attribute doesn't exist, like `[].push(1)` |
| `ZeroDivisionError` | dividing by zero |

## Catching exceptions with try/except

Put risky code in `try`. If an exception happens, Python jumps to the matching `except` block instead of crashing:

```python
for text in ["42", "3.5", "abc"]:
    try:
        number = int(text)
        print("Got", number)
    except ValueError:
        print(f"{text!r} is not a whole number")
```

Catch **specific** exceptions. A bare `except:` hides real bugs, including typos in your own code.

## Several excepts, else and finally

```python
def safe_divide(a, b):
    try:
        result = a / b
    except ZeroDivisionError:
        print("Can't divide by zero")
        return None
    except TypeError as err:          # 'as' gives you the exception object
        print("Bad input:", err)
        return None
    else:
        print("Division worked")      # runs only if no exception
        return result
    finally:
        print("-- done --")           # always runs

print(safe_divide(10, 4))
print(safe_divide(1, 0))
print(safe_divide("a", 2))
```

![try runs the risky code; with no error the else block runs, with an error the matching except runs; finally runs either way](../figures/try-except-flow.svg)

`finally` is for cleanup that must always happen, like closing a file or a network connection.

## Raising exceptions

Use `raise` when your function receives something it can't handle. Failing loudly and early is better than returning a wrong answer quietly.

```python
def set_age(age):
    if not isinstance(age, int):
        raise TypeError("age must be an integer")
    if age < 0:
        raise ValueError(f"age can't be negative (got {age})")
    return age

try:
    set_age(-5)
except ValueError as e:
    print("Error:", e)
```

## Custom exceptions

For your own programs, create exception classes by inheriting from `Exception` (classes are covered in Part 6):

```python
class InsufficientFunds(Exception):
    pass

def withdraw(balance, amount):
    if amount > balance:
        raise InsufficientFunds(f"Need {amount - balance} more")
    return balance - amount

try:
    withdraw(50, 80)
except InsufficientFunds as e:
    print("Declined:", e)
```

## EAFP vs LBYL

Python style prefers **EAFP**: "Easier to Ask Forgiveness than Permission". Just try the operation and handle the failure, rather than checking every condition first (**LBYL**, "Look Before You Leap"):

```python
config = {"theme": "dark"}

# LBYL
if "font" in config:
    font = config["font"]
else:
    font = "default"

# EAFP
try:
    font = config["font"]
except KeyError:
    font = "default"
print(font)
```

## Common mistakes

- Using a bare `except:` that hides every error, including typos in your code.
- Wrapping huge blocks in `try`. Keep the `try` around just the line that can fail.
- Catching an exception and doing nothing (`pass`) so the problem disappears silently.
- Reading a traceback from the top. Start at the bottom line.

## Exercises

### 1. Safe number parser

Write `parse_number(text)` that returns an `int` if the text is a whole number, a `float` if it's a decimal number, and `None` if it's neither. Use `try/except`, not string checks.

`parse_number("42")` → `42`, `parse_number("2.5")` → `2.5`, `parse_number("hi")` → `None`

Starter code:

```python
def parse_number(text):
    return int(text)

print(parse_number("42"), parse_number("2.5"), parse_number("hi"))
```

### 2. Validate an order

Write `validate_quantity(qty)` that returns `qty` if it's an `int` from 1 to 100. Otherwise it should **raise** `ValueError` with a helpful message.

Starter code:

```python
def validate_quantity(qty):
    return qty

print(validate_quantity(5))
```

**In the sandbox:** exercises 37–38. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Try int(text) first and return it. If that raises ValueError, try float(text). If that fails too, return None.
2. if not isinstance(qty, int) or not 1 <= qty <= 100: raise ValueError("...")

</details>

<details>
<summary>Answers</summary>

**1. Safe number parser**

```python
def parse_number(text):
    try:
        return int(text)
    except ValueError:
        pass
    try:
        return float(text)
    except ValueError:
        return None

print(parse_number("42"), parse_number("2.5"), parse_number("hi"))
```

**2. Validate an order**

```python
def validate_quantity(qty):
    if not isinstance(qty, int) or not 1 <= qty <= 100:
        raise ValueError(f"quantity must be a whole number from 1 to 100, got {qty!r}")
    return qty

print(validate_quantity(5))
```

</details>

## Quick quiz

1. Which part of a try statement always runs?
   - A) except
   - B) finally
   - C) else

2. What does `int("12a")` raise?
   - A) TypeError
   - B) SyntaxError
   - C) ValueError

3. Where should you start reading a traceback?
   - A) The middle
   - B) The first line
   - C) The last line

<details>
<summary>Quiz answers</summary>

1. **B) finally**: `finally` runs whether or not an exception happened.
2. **C) ValueError**: The type (str) is acceptable, but the value can't be converted.
3. **C) The last line**: The bottom line names the error; the lines above show how the program got there.

</details>

---
Previous: [Lesson 22](22-recursion.md) · Next: [Lesson 24: Modules and the standard library](24-modules-and-stdlib.md)
