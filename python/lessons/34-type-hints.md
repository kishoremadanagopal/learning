# Lesson 34: Type hints

**You'll learn:** annotations, `list[int]`, `dict[str, float]`, `Optional`, `X | None`, `Callable`, `TypeVar`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python/#type-hints)**: run every example and check your exercise answers.

## Key terms

- **Type hint (annotation):** a note saying what type a variable, parameter or return value should be.
- **Static type checker:** a tool like mypy or Pyright that checks hints without running code.
- **Optional[X]:** X or `None`, also written `X | None`.
- **Union:** one of several types, written `X | Y`.
- **Callable:** the type of a function.
- **Generic / TypeVar:** a placeholder type so one function works with many types.

**Type hints** describe what types a function expects and returns. Python doesn't enforce them at runtime, but they make code easier to read, and editors and tools like **mypy** and **Pyright** use them to catch bugs before you run anything.

```python
def greet(name: str, excited: bool = False) -> str:
    message = f"Hello, {name}"
    return message + "!" if excited else message + "."

print(greet("Ada"))
print(greet("Ada", excited=True))
```

Hints are not checked when the program runs. This still works, even though it breaks the promise:

```python
def double(n: int) -> int:
    return n * 2

print(double("ha"))     # a type checker would flag this line
```

## Common hints

```python
from typing import Optional, Union, Callable, Iterable

def total(prices: list[float]) -> float:
    return sum(prices)

def lookup(table: dict[str, int], key: str) -> Optional[int]:   # int or None
    return table.get(key)

def first_word(text: str | None) -> str:     # modern "or" syntax (3.10+)
    return text.split()[0] if text else ""

def apply(func: Callable[[int], int], values: Iterable[int]) -> list[int]:
    return [func(v) for v in values]

point: tuple[int, int] = (3, 4)
print(total([1.5, 2.5]), lookup({"a": 1}, "b"), first_word("hi there"), apply(abs, [-1, 2]))
```

| Hint | Meaning |
|---|---|
| `int`, `str`, `float`, `bool` | basic types |
| `list[int]` | list of ints |
| `dict[str, float]` | dict with str keys and float values |
| `tuple[int, str]` | exactly an int then a str |
| `tuple[int, ...]` | any number of ints |
| `X \| None` or `Optional[X]` | X or None |
| `X \| Y` or `Union[X, Y]` | either type |
| `Callable[[int], str]` | function taking an int, returning a str |
| `Any` | anything (turns off checking) |

## Hints in classes and dataclasses

Dataclasses rely on hints to know which fields exist:

```python
from dataclasses import dataclass

@dataclass
class Task:
    title: str
    priority: int = 3
    done: bool = False

    def complete(self) -> None:
        self.done = True

tasks: list[Task] = [Task("write tests", 1), Task("tidy desk")]
tasks[0].complete()
print(tasks)
```

## Generics: one function, many types

A `TypeVar` says "whatever type goes in, the same type comes out":

```python
from typing import TypeVar

T = TypeVar("T")

def last(items: list[T]) -> T:
    return items[-1]

print(last([1, 2, 3]), last(["a", "b"]))
```

## Should you use them?

For small scripts, hints are optional. For anything you'll maintain, share or grow, they're worth it: they're documentation that tools can verify. Most modern Python libraries ship with type hints.

## Common mistakes

- Expecting Python to enforce hints at runtime. It doesn't; use a type checker.
- Writing `def f(x: int = None)`. The hint should be `int | None`.
- Overusing `Any`, which switches checking off.

## Exercises

### 1. Annotate the function

Add type hints to `summarize` so that `scores` is a dict mapping `str` to a list of `int`, and the function returns a dict mapping `str` to `float`. The body is already correct.

Starter code:

```python
def summarize(scores):
    return {name: sum(vals) / len(vals) for name, vals in scores.items() if vals}

print(summarize({"ana": [90, 80], "ben": []}))
```

**In the sandbox:** exercise 56. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. def summarize(scores: dict[str, list[int]]) -> dict[str, float]:

</details>

<details>
<summary>Answers</summary>

**1. Annotate the function**

```python
def summarize(scores: dict[str, list[int]]) -> dict[str, float]:
    return {name: sum(vals) / len(vals) for name, vals in scores.items() if vals}

print(summarize({"ana": [90, 80], "ben": []}))
```

</details>

## Quick quiz

1. What happens if you pass a str to a function hinted as taking an int?
   - A) It runs anyway; hints aren't enforced at runtime
   - B) Python converts it automatically
   - C) Python raises TypeError

2. What does `Optional[str]` mean?
   - A) An optional argument
   - B) Any type
   - C) A str or None

<details>
<summary>Quiz answers</summary>

1. **A) It runs anyway; hints aren't enforced at runtime**: Hints are for readers and tools like mypy, not for the interpreter.
2. **C) A str or None**: It's the same as `str | None`. Whether the argument has a default is a separate matter.

</details>

---
Previous: [Lesson 33](33-context-managers.md) · Next: [Lesson 35: itertools and functools](35-itertools-functools.md)
