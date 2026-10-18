# Lesson 26: Testing and debugging

**You'll learn:** debugging routine, debug prints, `assert`, test functions, `unittest`, edge cases.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python/#testing-and-debugging)**: run every example and check your exercise answers.

## Key terms

- **Bug:** a mistake in code that makes it behave wrongly.
- **Debugging:** finding and fixing bugs.
- **assert:** checks a condition and raises `AssertionError` if it's false.
- **Unit test:** a small test of one function or piece of behaviour.
- **Edge case:** an unusual input at the boundary, like an empty list or a negative number.
- **TDD (Test-Driven Development):** write a failing test first, then the code to pass it.

Every programmer writes bugs. The skill is finding and fixing them quickly, and catching them before your users do.

## A debugging routine

1. **Read the error message** carefully, bottom line first.
2. **Reproduce** the bug with the smallest possible input.
3. **Inspect** values: add `print()` calls (f-strings with `=` are great for this) to see what the program actually has, rather than what you assume.
4. **Form a hypothesis**, change one thing, and test again.
5. **Explain the code out loud**, line by line. "Rubber duck debugging" works surprisingly often.

```python
def average_positive(nums):
    positives = [n for n in nums if n > 0]
    print(f"{nums=} {positives=}")       # debug print, remove later
    return sum(positives) / len(nums)    # bug!

print(average_positive([4, -2, 6]))
```

The debug print shows `positives` has 2 items while we divide by 3. The fix is `len(positives)`.

## assert: check your assumptions

`assert condition, message` raises `AssertionError` if the condition is false. Use it to catch impossible situations early:

```python
def apply_discount(price, percent):
    assert 0 <= percent <= 100, f"percent out of range: {percent}"
    return price * (1 - percent / 100)

print(apply_discount(80, 25))
```

Asserts can be switched off when Python runs with optimisation, so don't use them to validate user input. Raise `ValueError` for that.

## Writing tests

A **test** is code that checks other code. The simplest tests are functions full of asserts:

```python
def slugify(title):
    return "-".join(title.lower().split())

def test_slugify():
    assert slugify("Hello World") == "hello-world"
    assert slugify("  Many   Spaces ") == "many-spaces"
    assert slugify("") == ""
    print("all slugify tests passed")

test_slugify()
```

Think about **edge cases**: empty input, one item, negative numbers, duplicates, very large values. Bugs live at the edges.

## unittest: the built-in test framework

`unittest` organises tests into classes and gives clear reports. (In real projects, many developers use `pytest`, which runs plain `assert` tests like the one above with nicer output.)

```python
import sys
import unittest

def is_leap_year(year):
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)

class TestLeapYear(unittest.TestCase):
    def test_typical_leap_year(self):
        self.assertTrue(is_leap_year(2024))

    def test_century_is_not_leap(self):
        self.assertFalse(is_leap_year(1900))

    def test_every_400_years_is_leap(self):
        self.assertTrue(is_leap_year(2000))

suite = unittest.defaultTestLoader.loadTestsFromTestCase(TestLeapYear)
result = unittest.TextTestRunner(stream=sys.stdout, verbosity=2).run(suite)
print("passed" if result.wasSuccessful() else "failed")
```

On your computer you'd normally run tests with `python -m unittest` or `pytest` from the terminal.

## Test-driven development (TDD)

A popular workflow: write a failing test that describes what you want, write just enough code to pass it, then tidy up ("red, green, refactor"). The exercises in this course work the same way: the checker is a set of tests.

## Common mistakes

- Changing several things at once while debugging, so you can't tell which change mattered.
- Only testing the "happy path". Test empty, single-item and negative inputs too.
- Using `assert` to validate user input. Asserts can be switched off; raise `ValueError` instead.
- Leaving debug prints in finished code.

## Exercises

### 1. Fix the bug

This function should return the largest number in a list, but it has a bug that only shows up for some inputs. Find and fix it.

Starter code:

```python
def largest(nums):
    biggest = 0
    for n in nums:
        if n > biggest:
            biggest = n
    return biggest

print(largest([3, 9, 4]))
print(largest([-5, -2, -8]))
```

### 2. Write the tests

The function `normalize_phone` is finished. Your job is to write `test_normalize_phone()` containing **at least four** `assert` statements that would catch bugs, then call it.

Expected behaviour: it keeps only digits, and returns `None` unless exactly 10 digits remain. `"(555) 123-4567"` → `"5551234567"`.

Starter code:

```python
def normalize_phone(text):
    digits = "".join(ch for ch in text if ch.isdigit())
    return digits if len(digits) == 10 else None

def test_normalize_phone():
    pass

test_normalize_phone()
print("tests passed")
```

**In the sandbox:** exercises 43–44. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Starting biggest at 0 breaks when every number is negative. Start it at nums[0] instead.
2. Test a formatted valid number, another valid format, a too-short number, an empty string and a too-long number.

</details>

<details>
<summary>Answers</summary>

**1. Fix the bug**

```python
def largest(nums):
    biggest = nums[0]
    for n in nums[1:]:
        if n > biggest:
            biggest = n
    return biggest

print(largest([3, 9, 4]))
print(largest([-5, -2, -8]))
```

**2. Write the tests**

```python
def normalize_phone(text):
    digits = "".join(ch for ch in text if ch.isdigit())
    return digits if len(digits) == 10 else None

def test_normalize_phone():
    assert normalize_phone("(555) 123-4567") == "5551234567"
    assert normalize_phone("555.123.4567") == "5551234567"
    assert normalize_phone("123") is None
    assert normalize_phone("") is None
    assert normalize_phone("555-123-45678") is None

test_normalize_phone()
print("tests passed")
```

</details>

## Quick quiz

1. What's the first thing to do when you see an error?
   - A) Rewrite the function from scratch
   - B) Add try/except around everything
   - C) Read the last line of the traceback

2. Why shouldn't you use `assert` to validate user input?
   - A) It's too slow
   - B) It only works with numbers
   - C) Asserts can be disabled when Python runs with optimisation

<details>
<summary>Quiz answers</summary>

1. **C) Read the last line of the traceback**: The message usually tells you exactly what went wrong and where.
2. **C) Asserts can be disabled when Python runs with optimisation**: With `python -O`, asserts are skipped. Raise ValueError for real validation.

</details>

---
Previous: [Lesson 25](25-files-csv-json.md) · Next: [Lesson 27: Classes and objects](27-classes-and-objects.md)
