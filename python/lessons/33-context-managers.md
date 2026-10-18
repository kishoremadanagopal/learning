# Lesson 33: Context managers

**You'll learn:** `with`, `__enter__`/`__exit__`, `@contextmanager`, cleanup on errors, `suppress`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python/#context-managers)**: run every example and check your exercise answers.

## Key terms

- **Context manager:** an object that runs setup and cleanup around a `with` block.
- **`__enter__` / `__exit__`:** the methods called at the start and end of the block.
- **@contextmanager:** turns a generator into a context manager; code before `yield` is setup, after it is cleanup.
- **Resource:** something that must be released: a file, a lock, a connection.

You've used `with open(...) as f:`. The `with` statement works with any **context manager**: an object that runs setup code at the start of the block and cleanup code at the end, **even if an error happens**.

Typical uses: closing files, releasing locks, committing or rolling back database transactions, restoring settings, timing a block.

## Writing one as a class

A context manager defines `__enter__` and `__exit__`:

```python
class Timer:
    def __enter__(self):
        import time
        self.start = time.perf_counter()
        return self                     # bound to the name after 'as'

    def __exit__(self, exc_type, exc_value, traceback):
        import time
        self.elapsed = time.perf_counter() - self.start
        print(f"block took {self.elapsed * 1000:.1f} ms")
        return False                    # don't suppress exceptions

with Timer() as t:
    total = sum(range(300_000))
print(total)
```

`__exit__` receives details of any exception raised inside the block. Returning `True` swallows the exception; returning `False` (or `None`) lets it continue.

## Writing one with contextlib

The `@contextmanager` decorator turns a generator into a context manager. Code before `yield` is setup, code after is cleanup. Wrap the `yield` in `try/finally` so cleanup always runs.

```python
from contextlib import contextmanager

@contextmanager
def html_tag(name):
    print(f"<{name}>")
    try:
        yield
    finally:
        print(f"</{name}>")

with html_tag("ul"):
    for item in ["tea", "coffee"]:
        with html_tag("li"):
            print(item)
```

## Cleanup happens even on errors

```python
from contextlib import contextmanager

@contextmanager
def transaction(db):
    snapshot = dict(db)
    try:
        yield db
        print("commit")
    except Exception:
        db.clear()
        db.update(snapshot)
        print("rollback")
        raise

accounts = {"ana": 100, "ben": 50}
try:
    with transaction(accounts) as db:
        db["ana"] -= 80
        db["ben"] += 80
        raise RuntimeError("power cut!")
except RuntimeError as e:
    print("Error:", e)
print(accounts)
```

The money wasn't lost: the context manager restored the original balances.

## Handy built-ins from contextlib

```python
from contextlib import suppress

data = {}
with suppress(KeyError):        # ignore one specific exception
    print(data["missing"])
print("carried on")
```

## Common mistakes

- Forgetting `try/finally` around `yield` in a `@contextmanager`, so cleanup is skipped on errors.
- Returning `True` from `__exit__` by accident, which silently swallows exceptions.
- Using the resource after the `with` block has closed it.

## Exercises

### 1. Indented printer

Write a context manager `indent()` using `@contextmanager` that increases a global indentation level by one for the duration of the block, and restores it afterwards (even if an error occurs). Use the provided `say()` function to print.

Starter code:

```python
from contextlib import contextmanager

level = 0

def say(text):
    print("  " * level + text)

def indent():
    pass

say("start")
with indent():
    say("inside")
    with indent():
        say("deeper")
say("end")
```

**In the sandbox:** exercise 55. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Decorate indent with @contextmanager. Inside: global level; level += 1; then try: yield finally: level -= 1.

</details>

<details>
<summary>Answers</summary>

**1. Indented printer**

```python
from contextlib import contextmanager

level = 0

def say(text):
    print("  " * level + text)

@contextmanager
def indent():
    global level
    level += 1
    try:
        yield
    finally:
        level -= 1

say("start")
with indent():
    say("inside")
    with indent():
        say("deeper")
say("end")
```

</details>

## Quick quiz

1. When does a context manager's cleanup code run?
   - A) When the program ends
   - B) Only if the block succeeds
   - C) When the block ends, whether or not an error occurred

2. In a `@contextmanager` generator, what separates setup from cleanup?
   - A) A `return`
   - B) The `yield`
   - C) The `with` keyword

<details>
<summary>Quiz answers</summary>

1. **C) When the block ends, whether or not an error occurred**: That guarantee is the whole point of `with`.
2. **B) The `yield`**: Code before `yield` runs on entry; code after it runs on exit.

</details>

---
Previous: [Lesson 32](32-decorators.md) · Next: [Lesson 34: Type hints](34-type-hints.md)
