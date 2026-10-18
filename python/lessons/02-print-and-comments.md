# Lesson 2: Printing and comments

**You'll learn:** `print()` with several values, `sep`, `end`, escape sequences, `#` comments.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python/#print-and-comments)**: run every example and check your exercise answers.

## Key terms

- **Argument:** a value you pass to a function inside its parentheses.
- **Keyword argument:** an argument passed by name, like `sep="-"` or `end=""`.
- **sep:** the text `print` puts between values (a space by default).
- **end:** the text `print` puts after the last value (a new line by default).
- **Escape sequence:** a backslash code inside a string, like `\n` (new line) or `\t` (tab).
- **Comment:** text after `#` that Python ignores. Used to explain code.

`print` can show more than one value. Separate the values with commas and Python puts a space between them:

```python
print("Apples:", 5)
print("Total price:", 5 * 0.4, "dollars")
```

Notice that `5 * 0.4` was calculated first. Python works out each value, then prints it.

## Changing the separator and the ending

`print` has two optional settings, called **keyword arguments**:

- `sep` is what goes *between* values (a space by default).
- `end` is what goes *after* the last value (a new line by default).

```python
print("2026", "10", "02", sep="-")
print("Loading", end="")
print("...", end="")
print(" done!")
```

## Blank lines and special characters

`print()` with nothing inside prints an empty line. Inside text, a backslash starts an **escape sequence**: `\n` is a new line and `\t` is a tab.

```python
print("Line one\nLine two")
print()
print("Name:\tAda")
print("She said \"hi\"")
```

## Comments

A **comment** starts with `#`. Python ignores everything after the `#` on that line. Use comments to explain *why* the code does something, not to repeat what it obviously does.

```python
# Prices are in US dollars
price = 4.99
print(price)  # this comment sits at the end of a line
```

You can also "comment out" a line to switch it off temporarily while testing.

## Common mistakes

- Putting a `#` inside quotes and expecting a comment: `print("# hi")` prints `# hi`.
- Joining text and numbers with commas and expecting no space: `print("Total:", 5)` prints `Total: 5` with a space, because `sep` is a space.
- Writing comments that repeat the code (`x = 5  # set x to 5`). Explain *why*, not *what*.

## Exercises

### 1. Receipt line

Use **one** `print` call with the `sep` setting to print:

```text
milk|eggs|bread
```

Starter code:

```python
print("milk", "eggs", "bread")
```

### 2. Countdown on one line

Print `3... 2... 1... Liftoff!` on a single line using **four** separate `print` calls and the `end` setting.

Starter code:

```python
print("3...")
print("2...")
print("1...")
print("Liftoff!")
```

**In the sandbox:** exercises 2–3. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Add sep="|" inside the parentheses, after the last value.
2. Give the first three calls end=" " so they finish with a space instead of a new line.

</details>

<details>
<summary>Answers</summary>

**1. Receipt line**

```python
print("milk", "eggs", "bread", sep="|")
```

**2. Countdown on one line**

```python
print("3...", end=" ")
print("2...", end=" ")
print("1...", end=" ")
print("Liftoff!")
```

</details>

## Quick quiz

1. What does `print("a", "b", "c", sep="")` show?
   - A) a,b,c
   - B) a b c
   - C) abc

2. Which line is ignored completely by Python?
   - A) `# print("hello")`
   - B) `print("# hello")`
   - C) `print("hello") #`

<details>
<summary>Quiz answers</summary>

1. **C) abc**: `sep=""` puts nothing between the values.
2. **A) `# print("hello")`**: A `#` inside quotes is just a character. A `#` at the start of a line makes the whole line a comment. The third line still prints.

</details>

---
Previous: [Lesson 1](01-how-python-runs.md) · Next: [Lesson 3: Variables and data types](03-variables-and-types.md)
