# Lesson 17: String methods

**You'll learn:** `upper`/`lower`, `strip`, `split`/`join`, `find`/`replace`, `isdigit`, padding.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python/#string-methods)**: run every example and check your exercise answers.

## Key terms

- **String method:** a function called on a string, like `"hi".upper()`.
- **Whitespace:** spaces, tabs and new lines.
- **split():** breaks a string into a list of strings.
- **join():** glues a list of strings together with a separator.
- **Method chaining:** calling one method on the result of another: `s.strip().lower()`.

Strings come with many **methods**: functions you call with a dot after the value. Because strings are immutable, they always return a **new** string.

## Changing case

```python
s = "hello World"
print(s.upper(), s.lower(), s.title(), s.capitalize())
```

## Cleaning up whitespace

```python
raw = "   ada@example.com \n"
print(f"[{raw.strip()}]")
print(f"[{raw.lstrip()}]")
print("--title--".strip("-"))
```

## Split and join

`split` breaks a string into a list. `join` glues a list of strings together with a separator. You'll use these two constantly.

```python
line = "Ana,36,London"
parts = line.split(",")
print(parts)

words = "  many   spaces here ".split()   # no argument: split on any whitespace
print(words)

print(" - ".join(["red", "green", "blue"]))
print("".join(reversed("stressed")))
```

## Search and replace

```python
s = "the rain in Spain"
print(s.find("ain"))          # index of first match, -1 if none
print(s.count("ain"))
print(s.replace("ain", "AIN"))
print(s.startswith("the"), s.endswith("pain"))
```

## Testing what a string contains

```python
print("123".isdigit(), "abc".isalpha(), "abc123".isalnum())
print("   ".isspace(), "Hello".istitle())
```

## Padding and alignment

```python
print("7".zfill(3))
print("menu".center(12, "*"))
print("left".ljust(8) + "|", "right".rjust(8) + "|")
```

## Method chaining

Since each method returns a new string, you can chain them:

```python
messy = "  Hello, World!  "
slug = messy.strip().lower().replace(",", "").replace("!", "").replace(" ", "-")
print(slug)
```

## Common mistakes

- Expecting a method to change the string in place. Strings are immutable: write `s = s.upper()`.
- Calling `join` on the list: it's `", ".join(items)`, not `items.join(", ")`.
- Joining non-strings: `" ".join([1, 2])` fails. Convert with `map(str, items)` first.

## Exercises

### 1. Title case a headline

Write `headline(text)` that removes extra spaces between and around words and capitalises each word.

`headline("  the   quick brown  fox ")` → `"The Quick Brown Fox"`

Starter code:

```python
def headline(text):
    return text

print(headline("  the   quick brown  fox "))
```

### 2. Palindrome checker

Write `is_palindrome(text)` that returns `True` if the text reads the same forwards and backwards, **ignoring case, spaces and punctuation**. Keep only characters where `ch.isalnum()` is true.

`is_palindrome("A man, a plan, a canal: Panama!")` → `True`

Starter code:

```python
def is_palindrome(text):
    return False

print(is_palindrome("A man, a plan, a canal: Panama!"))
```

**In the sandbox:** exercises 26–27. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. text.split() removes all extra spaces. Capitalise each word, then " ".join(...) them back together.
2. Build cleaned = "".join(ch.lower() for ch in text if ch.isalnum()), then compare it with cleaned[::-1].

</details>

<details>
<summary>Answers</summary>

**1. Title case a headline**

```python
def headline(text):
    return " ".join(word.capitalize() for word in text.split())

print(headline("  the   quick brown  fox "))
```

**2. Palindrome checker**

```python
def is_palindrome(text):
    cleaned = "".join(ch.lower() for ch in text if ch.isalnum())
    return cleaned == cleaned[::-1]

print(is_palindrome("A man, a plan, a canal: Panama!"))
```

</details>

## Quick quiz

1. What does `"a,b,c".split(",")` return?
   - A) 'abc'
   - B) ['a', 'b', 'c']
   - C) ('a', 'b', 'c')

2. What does `"-".join(["x", "y", "z"])` return?
   - A) 'x-y-z-'
   - B) ['x-y-z']
   - C) 'x-y-z'

3. After `s = "hi"`, `s.upper()`, what is `s`?
   - A) 'HI'
   - B) 'hi'

<details>
<summary>Quiz answers</summary>

1. **B) ['a', 'b', 'c']**: `split` always returns a list of strings.
2. **C) 'x-y-z'**: The separator goes between items only.
3. **B) 'hi'**: String methods return new strings. To keep the result, write `s = s.upper()`.

</details>

---
Previous: [Lesson 16](16-comprehensions.md) · Next: [Lesson 18: Defining functions](18-functions-basics.md)
