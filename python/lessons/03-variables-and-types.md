# Lesson 3: Variables and data types

**You'll learn:** `=`, naming rules, `int`, `float`, `str`, `bool`, `type()`, `None`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python/#variables-and-types)**: run every example and check your exercise answers.

## Key terms

- **Variable:** a name that refers to a value.
- **Assignment:** storing a value in a variable with `=`.
- **Data type:** the kind of value: `int`, `float`, `str`, `bool` and others.
- **int:** a whole number, like `42`.
- **float:** a number with a decimal point, like `3.14`.
- **str (string):** text, written in quotes.
- **bool (boolean):** `True` or `False`.
- **None:** a special value meaning "nothing" or "no value yet".
- **snake_case:** the Python naming style: lowercase words joined by underscores.
- **Concatenation:** joining strings with `+`.

A **variable** is a name that refers to a value. You create one with `=`, which means "assign", not "equals".

```python
name = "Ada"
age = 36
print(name, "is", age)
```

You can change what a variable refers to at any time. The newest assignment wins:

```python
score = 10
score = score + 5   # take the old value, add 5, store the result
print(score)
```

Read `score = score + 5` from right to left: Python works out `score + 5` first (15), then stores it in `score`.

![A variable is a name that points to a value: name points to the string "Ada" and age points to the integer 36](../figures/variables.svg)

## Naming rules

- Names can contain letters, digits and underscores, but can't start with a digit: `total_2` is fine, `2total` is not.
- Names are case-sensitive: `Age` and `age` are different variables.
- You can't use Python keywords such as `if`, `for` or `class` as names.
- By convention, Python uses **snake_case**: lowercase words joined by underscores, like `first_name`.

## The four basic types

Every value has a **type**, which decides what you can do with it.

| Type | Meaning | Examples |
|---|---|---|
| `int` | whole number | `7`, `-3`, `1_000_000` |
| `float` | decimal number | `3.14`, `-0.5`, `2.0` |
| `str` | text (a *string*) | `"hello"`, `'Python'` |
| `bool` | true or false | `True`, `False` |

Use `type()` to ask Python what type a value is:

```python
print(type(42))
print(type(3.5))
print(type("42"))
print(type(True))
```

`42` and `"42"` look similar but are different types. One is a number you can do math with; the other is text.

```python
print(42 + 8)
print("42" + "8")
```

Adding strings joins them together. This is called **concatenation**.

## Multiple assignment

You can assign several variables in one line, and even swap two values without a temporary variable:

```python
x, y = 1, 2
x, y = y, x
print(x, y)
```

## None: the "no value" value

`None` means "nothing here yet". It has its own type, `NoneType`.

```python
result = None
print(result, type(result))
```

## Common mistakes

- Reading `=` as "equals". It means "store this value in this name"; comparison is `==`.
- Quoting numbers by accident: `age = "36"` is text, so `age + 1` fails.
- Using a variable before assigning it, or misspelling it: `nmae` gives `NameError`.
- Writing `true` or `none` in lowercase. They're `True`, `False` and `None`.

## Exercises

### 1. Profile card

Create three variables: `name` set to `"Grace"`, `year` set to the number `1906`, and `is_programmer` set to `True`. Then print them on one line, separated by spaces.

### 2. Swap them

The variables `left` and `right` are in the wrong order. Swap their values using a single line of multiple assignment.

Starter code:

```python
left = "right"
right = "left"
# swap them here

print(left, right)
```

**In the sandbox:** exercises 4–5. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Numbers and True/False are written without quotes. Then use print(name, year, is_programmer).
2. left, right = right, left

</details>

<details>
<summary>Answers</summary>

**1. Profile card**

```python
name = "Grace"
year = 1906
is_programmer = True
print(name, year, is_programmer)
```

**2. Swap them**

```python
left = "right"
right = "left"
left, right = right, left
print(left, right)
```

</details>

## Quick quiz

1. What is the type of `"3.14"`?
   - A) int
   - B) float
   - C) str

2. After `a = 5`, `b = a`, `a = 10`, what is `b`?
   - A) An error
   - B) 5
   - C) 10

3. Which is a valid variable name?
   - A) `_total`
   - B) `my-score`
   - C) `2nd_place`

<details>
<summary>Quiz answers</summary>

1. **C) str**: It's in quotes, so it's text. `float("3.14")` would convert it to a number.
2. **B) 5**: `b = a` makes `b` refer to the value 5. Later pointing `a` at 10 doesn't change what `b` refers to.
3. **A) `_total`**: Names can start with an underscore. They can't start with a digit, and `-` means subtraction.

</details>

---
Previous: [Lesson 2](02-print-and-comments.md) · Next: [Lesson 4: Numbers and math](04-numbers-and-math.md)
