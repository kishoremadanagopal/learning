# Lesson 6: Input and type conversion

**You'll learn:** `input()`, `int()`, `float()`, `str()`, `ValueError`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python/#input-and-conversion)**: run every example and check your exercise answers.

## Key terms

- **input():** pauses the program, shows a prompt and returns what the user typed, always as a string.
- **Prompt:** the message shown to the user before they type.
- **Type conversion (casting):** turning a value into another type with `int()`, `float()`, `str()` or `bool()`.
- **ValueError:** raised when a value has the right type but can't be used, like `int("abc")`.
- **TypeError:** raised when an operation gets the wrong type, like `2026 - "1990"`.

`input()` pauses the program, shows a prompt and waits for the user to type something. It **always returns a string**.

In this course, the **Input** box under the editor plays the role of the keyboard: each line in it answers one `input()` call. The example below fills it in for you.

*Input typed for this example: `Ada`*

```python
name = input("What is your name? ")
print(f"Nice to meet you, {name}!")
```

## Converting types

Because `input()` returns text, you must convert it before doing math. These functions convert values:

| Function | Converts to | Example |
|---|---|---|
| `int()` | whole number | `int("42")` → `42` |
| `float()` | decimal | `float("2.5")` → `2.5` |
| `str()` | text | `str(42)` → `"42"` |
| `bool()` | True/False | `bool("")` → `False` |

*Input typed for this example: `1990`*

```python
year = input("Birth year? ")
print(type(year))
age = 2026 - int(year)
print(f"You are about {age} years old")
```

Forget the conversion and Python complains, because it can't subtract text from a number:

*Input typed for this example: `1990`*

*This example raises an error on purpose.*

```python
year = input("Birth year? ")
print(2026 - year)
```

## When conversion fails

`int("hello")` raises a `ValueError` because the text isn't a number. `int("3.7")` also fails: convert to `float` first, then to `int` (which cuts off the decimals).

```python
print(int(float("3.7")))
print(int(3.99))
print(round(3.7))
```

Later, in the Exceptions lesson, you'll learn how to catch these errors so a typo doesn't crash your program.

## Putting it together

*Input typed for this example: `4.5`, `3`*

```python
price = float(input("Price per item: "))
qty = int(input("Quantity: "))
print(f"Total: ${price * qty:.2f}")
```

## Common mistakes

- Doing math on `input()` directly. Convert first: `int(input("Age? "))`.
- Calling `int("3.5")`. Convert to `float` first, or use `float()` if decimals are allowed.
- Expecting `int(3.99)` to round. It cuts off the decimals and gives `3`; use `round()` to round.

## Exercises

### 1. Temperature converter

Read a temperature in Celsius with `input()`, convert it to Fahrenheit using `F = C * 9 / 5 + 32`, and print it with one decimal place, like `Fahrenheit: 98.6`.

The checker will type `37` into your program.

Starter code:

```python
celsius = input("Celsius: ")

```

*The checker types: `37`*

**In the sandbox:** exercise 10. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Wrap input(...) in float(...) so you can do math. Then print(f"Fahrenheit: {fahrenheit:.1f}").

</details>

<details>
<summary>Answers</summary>

**1. Temperature converter**

```python
celsius = float(input("Celsius: "))
fahrenheit = celsius * 9 / 5 + 32
print(f"Fahrenheit: {fahrenheit:.1f}")
```

</details>

## Quick quiz

1. What type does `input()` return?
   - A) Always str
   - B) It depends on what the user types
   - C) int

2. What does `int("12") + int("3")` give?
   - A) 15
   - B) An error
   - C) "123"

3. What happens with `int("3.5")`?
   - A) 4
   - B) 3
   - C) ValueError

<details>
<summary>Quiz answers</summary>

1. **A) Always str**: `input()` always returns a string, even if the user types digits.
2. **A) 15**: Both strings are converted to numbers first, so they add normally.
3. **C) ValueError**: `int()` can't read decimal text directly. Use `int(float("3.5"))`.

</details>

---
Previous: [Lesson 5](05-strings-basics.md) · Next: [Lesson 7: Booleans and comparisons](07-booleans-and-comparisons.md)
