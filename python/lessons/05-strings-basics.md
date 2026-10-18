# Lesson 5: Strings and f-strings

**You'll learn:** indexing, slicing, `len()`, `+` and `*`, immutability, f-strings and format specs.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python/#strings-basics)**: run every example and check your exercise answers.

## Key terms

- **Index:** the position of an item, starting at 0. Negative indexes count from the end.
- **Slice:** part of a sequence, `s[start:stop:step]`. The stop position isn't included.
- **len():** returns how many items (characters) something has.
- **Immutable:** can't be changed after it's created. Strings are immutable.
- **f-string:** a string starting with `f` where `{expressions}` are filled in.
- **Format spec:** formatting after a colon in an f-string, like `{price:.2f}`.

A **string** is a sequence of characters. You can use single or double quotes; pick whichever avoids clashing with quotes inside the text.

```python
a = 'She said "hi"'
b = "It's sunny"
c = """Triple quotes
let text span
several lines."""
print(a)
print(b)
print(c)
```

## Length, joining and repeating

```python
word = "Python"
print(len(word))
print(word + "!")
print("ha" * 3)
```

## Indexing: getting one character

Each character has a position called an **index**. Counting starts at **0**. Negative indexes count from the end.

![The letters of "Python" with their positions: 0 to 5 counting from the front, and -6 to -1 counting from the end](../figures/string-index.svg)

```text
 P  y  t  h  o  n
 0  1  2  3  4  5
-6 -5 -4 -3 -2 -1
```

```python
word = "Python"
print(word[0])
print(word[5])
print(word[-1])
```

Asking for `word[6]` causes an `IndexError` because there is no position 6.

## Slicing: getting part of a string

`word[start:stop]` gives the characters from `start` up to, but **not including**, `stop`. Leave a side empty to mean "from the beginning" or "to the end". An optional third number is the step.

![Slice positions sit between the characters: word[0:2] cuts before P and after y, giving "Py"](../figures/string-slice.svg)

```python
word = "Python"
print(word[0:2])
print(word[2:])
print(word[:-1])
print(word[::2])
print(word[::-1])   # step -1 reverses
```

## Strings can't be changed

Strings are **immutable**: you can't change a character in place. `word[0] = "J"` is an error. Instead, build a new string:

```python
word = "Python"
new_word = "J" + word[1:]
print(new_word)
```

## f-strings: the best way to build messages

Put an `f` before the opening quote, then write any variable or expression inside `{}`:

```python
name = "Ada"
items = 3
price = 4.5
print(f"{name} bought {items} items for ${items * price}")
```

After a colon you can add a **format spec** to control how a value looks:

```python
pi = 3.14159265
print(f"{pi:.2f}")        # 2 decimal places
print(f"{1234567:,}")     # thousands separator
print(f"{0.256:.1%}")     # percentage
print(f"[{'left':<8}]")   # pad to 8, align left
print(f"[{'right':>8}]")  # align right
print(f"{pi=}")           # show the expression too (debugging)
```

Mixing types with `+` fails: `"Age: " + 36` is a `TypeError`. f-strings handle the conversion for you, which is one more reason to use them.

## Common mistakes

- Off-by-one indexes: the last character of `"Python"` is `s[5]` or `s[-1]`, not `s[6]`.
- Forgetting that the slice stop is excluded: `"Python"[0:2]` is `"Py"`.
- Trying to change a character: `s[0] = "J"` fails. Build a new string instead.
- Forgetting the `f`: `"Hi {name}"` prints the braces literally.
- Joining text and a number with `+`: `"Age: " + 36` is a `TypeError`. Use an f-string.

## Exercises

### 1. Initials

Given `first = "grace"` and `last = "hopper"`, build the string `"G.H."` and store it in `initials`. Use indexing and the `.upper()` method (for example, `"g".upper()` gives `"G"`).

Starter code:

```python
first = "grace"
last = "hopper"

initials = ""
print(initials)
```

### 2. Price tag

Write a function-free program that sets `product = "Notebook"` and `price = 3.5`, then prints exactly:

```text
Notebook ...... $3.50
```

Use an f-string with `:.2f` for the price.

Starter code:

```python
product = "Notebook"
price = 3.5

```

**In the sandbox:** exercises 8–9. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. first[0] is "g". Uppercase it, then join everything with + and add the dots.
2. print(f"{product} ...... ${price:.2f}") — the $ is just a normal character before the braces.

</details>

<details>
<summary>Answers</summary>

**1. Initials**

```python
first = "grace"
last = "hopper"

initials = first[0].upper() + "." + last[0].upper() + "."
print(initials)
```

**2. Price tag**

```python
product = "Notebook"
price = 3.5
print(f"{product} ...... ${price:.2f}")
```

</details>

## Quick quiz

1. What is `"banana"[1:4]`?
   - A) "ana"
   - B) "anan"
   - C) "ban"

2. What does `"abc"[-1]` give?
   - A) "a"
   - B) "c"
   - C) An error

3. What does `f"{7/2:.1f}"` produce?
   - A) "3.50"
   - B) "3"
   - C) "3.5"

<details>
<summary>Quiz answers</summary>

1. **A) "ana"**: Start at index 1 ('a') and stop *before* index 4, giving indexes 1, 2 and 3.
2. **B) "c"**: Negative indexes count from the end; -1 is the last character.
3. **C) "3.5"**: `.1f` means one digit after the decimal point.

</details>

---
Previous: [Lesson 4](04-numbers-and-math.md) · Next: [Lesson 6: Input and type conversion](06-input-and-conversion.md)
