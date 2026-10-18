# Lesson 24: Modules and the standard library

**You'll learn:** `import` forms, `random`, `datetime`, `collections`, `__name__ == "__main__"`, pip.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python/#modules-and-stdlib)**: run every example and check your exercise answers.

## Key terms

- **Module:** a `.py` file of reusable code.
- **Package:** a folder of modules.
- **Standard library:** the modules that come with Python.
- **import / from ... import / as:** ways to bring a module or its names into your code.
- **`__name__`:** the module's name; it's `"__main__"` when the file is run directly.
- **PyPI and pip:** the Python Package Index and the tool that installs packages from it.

A **module** is a file of Python code you can reuse. Python ships with a huge **standard library** ("batteries included"), so you rarely start from zero.

## Ways to import

```python
import math
print(math.sqrt(16))

from math import pi, floor
print(pi, floor(2.9))

import statistics as stats
print(stats.mean([2, 4, 9]))
```

- `import module` keeps names tidy: `math.sqrt` makes it obvious where `sqrt` comes from.
- `from module import name` is shorter for names you use often.
- `import module as alias` shortens long names. Some aliases are conventions, like `import numpy as np`.
- Avoid `from module import *`: it dumps unknown names into your file.

## A tour of useful modules

**random**: random numbers and choices

```python
import random
print(random.randint(1, 6))
print(random.choice(["rock", "paper", "scissors"]))
deck = list(range(1, 11))
random.shuffle(deck)
print(deck[:3])
```

Your output will differ every run. That's the point.

**datetime**: dates and times

```python
from datetime import date, timedelta
start = date(2026, 1, 15)
deadline = start + timedelta(days=45)
print(deadline, deadline.strftime("%A, %d %B %Y"))
print((deadline - start).days, "days")
```

**collections**: specialised containers

```python
from collections import Counter, defaultdict, deque

votes = Counter(["red", "blue", "red", "green", "red"])
print(votes.most_common(2))

groups = defaultdict(list)
for name in ["Ana", "Ben", "Alan", "Bea"]:
    groups[name[0]].append(name)
print(dict(groups))

queue = deque(["a", "b"])
queue.appendleft("first")
print(queue.popleft(), queue)
```

**string** and **textwrap**

```python
import string, textwrap
print(string.ascii_lowercase)
print(string.punctuation)
long_text = "Python is a programming language that lets you work quickly and integrate systems more effectively."
print(textwrap.fill(long_text, width=40))
```

**itertools** and **functools** have powerful tools for loops and functions; they get their own lesson in Part 7.

## Your own modules

Any `.py` file is a module. If you save functions in `helpers.py`, another file in the same folder can use `import helpers`. A folder of modules with an `__init__.py` file is a **package**.

## if __name__ == "__main__"

When Python runs a file directly, its `__name__` is `"__main__"`. When the file is imported, `__name__` is the module's name. This lets a file work both as a script and as an importable module:

```python
def main():
    print("Running as a script")

if __name__ == "__main__":
    main()
```

## Third-party packages

Beyond the standard library, the Python Package Index (PyPI) has over half a million packages, installed with `pip` on your own computer:

```bash
pip install requests
```

This browser editor can only use the standard library. The last lesson explains how to set Python up on your computer.

## Common mistakes

- Naming your own file after a module, like `random.py`, which then gets imported instead of the real one.
- Using `from module import *`, which hides where names come from.
- Running code at the top level of a module you also import. Put it under `if __name__ == "__main__":`.

## Exercises

### 1. Most common letters

Use `collections.Counter` to write `top_letters(text, n)` that returns the `n` most common **letters** (ignore case, spaces and punctuation) as a list of `(letter, count)` tuples.

`top_letters("Hello World", 2)` → `[('l', 3), ('o', 2)]`

Starter code:

```python
def top_letters(text, n):
    return []

print(top_letters("Hello World", 2))
```

### 2. Days until

Write `days_until(year, month, day, today)` that returns the number of days from the `date` object `today` to the given date (negative if it's in the past). Use `datetime.date`.

Starter code:

```python
from datetime import date

def days_until(year, month, day, today):
    return 0

print(days_until(2026, 12, 25, date(2026, 10, 2)))
```

**In the sandbox:** exercises 39–40. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Build a list of lowercase letters with a comprehension (ch.isalpha()), pass it to Counter, and call .most_common(n).
2. Subtracting two dates gives a timedelta; its .days attribute is the number of days.

</details>

<details>
<summary>Answers</summary>

**1. Most common letters**

```python
from collections import Counter

def top_letters(text, n):
    letters = [ch for ch in text.lower() if ch.isalpha()]
    return Counter(letters).most_common(n)

print(top_letters("Hello World", 2))
```

**2. Days until**

```python
from datetime import date

def days_until(year, month, day, today):
    return (date(year, month, day) - today).days

print(days_until(2026, 12, 25, date(2026, 10, 2)))
```

</details>

## Quick quiz

1. What does `if __name__ == "__main__":` check?
   - A) Whether Python is installed
   - B) Whether the file is being run directly rather than imported
   - C) Whether a function called main exists

2. Which import style is generally discouraged?
   - A) `from math import sqrt`
   - B) `import math`
   - C) `from math import *`

<details>
<summary>Quiz answers</summary>

1. **B) Whether the file is being run directly rather than imported**: `__name__` is "__main__" only for the file you run directly.
2. **C) `from math import *`**: Star imports pull in unknown names and make code harder to read.

</details>

---
Previous: [Lesson 23](23-exceptions.md) · Next: [Lesson 25: Files, CSV and JSON](25-files-csv-json.md)
