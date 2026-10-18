# Lesson 32: Decorators

**You'll learn:** wrapping functions, `@` syntax, `*args, **kwargs`, `functools.wraps`, decorators with arguments.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python/#decorators)**: run every example and check your exercise answers.

## Key terms

- **Decorator:** a function that takes a function and returns a new function with extra behaviour.
- **Wrapper:** the inner function a decorator returns.
- **@ syntax:** `@deco` above `def f` means `f = deco(f)`.
- **functools.wraps:** copies the original function's name and docstring onto the wrapper.
- **Decorator factory:** a function that takes settings and returns a decorator, like `@repeat(3)`.

A **decorator** is a function that takes a function and returns a new function that usually wraps the original with extra behaviour. You've already used some: `@property`, `@dataclass`, `@lru_cache`.

It builds on two ideas from Part 4: functions are values, and inner functions can remember outer variables (closures).

## Building one step by step

```python
def shout(func):
    def wrapper():
        result = func()
        return result.upper() + "!"
    return wrapper

def greet():
    return "hello"

loud_greet = shout(greet)      # wrap it by hand
print(loud_greet())
```

The `@` syntax does the same wrapping at definition time. These two are equivalent:

```python
def shout(func):
    def wrapper():
        return func().upper() + "!"
    return wrapper

@shout
def greet():
    return "hello"
# same as: greet = shout(greet)

print(greet())
```

## Handling any arguments

Real decorators must work with functions of any signature, so the wrapper accepts `*args, **kwargs` and passes them through. `functools.wraps` copies the original function's name and docstring onto the wrapper.

```python
import functools

def log_calls(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        print(f"-> {func.__name__}{args} {kwargs}")
        result = func(*args, **kwargs)
        print(f"<- {func.__name__} returned {result!r}")
        return result
    return wrapper

@log_calls
def add(a, b, round_to=None):
    total = a + b
    return round(total, round_to) if round_to is not None else total

add(2, 3)
add(1.234, 2.5, round_to=1)
print(add.__name__)
```

## A timing decorator

```python
import functools, time

def timed(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        elapsed = (time.perf_counter() - start) * 1000
        print(f"{func.__name__} took {elapsed:.1f} ms")
        return result
    return wrapper

@timed
def slow_sum(n):
    return sum(i * i for i in range(n))

print(slow_sum(200_000))
```

## Decorators with arguments

To pass settings, add one more layer: a function that takes the settings and returns a decorator.

```python
import functools

def repeat(times):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            return [func(*args, **kwargs) for _ in range(times)]
        return wrapper
    return decorator

@repeat(3)
def roll():
    return "dice"

print(roll())
```

## Real-world uses

- **Caching**: `@functools.lru_cache` remembers results.
- **Web frameworks**: Flask and FastAPI use `@app.get("/users")` to map URLs to functions.
- **Access control**: check that a user is logged in before running a view.
- **Retrying**: re-run a function that failed because of a flaky network.

## Common mistakes

- Forgetting to return the wrapper from the decorator, so the function becomes `None`.
- Forgetting to return the result inside the wrapper.
- Not using `*args, **kwargs`, so the decorator only works for one signature.
- Writing `@repeat` instead of `@repeat(3)` for a decorator that takes arguments.

## Exercises

### 1. Call counter

Write a decorator `count_calls` that counts how many times the decorated function has been called. Store the count in an attribute named `calls` on the wrapper (`wrapper.calls = 0` before returning it) and increase it on each call.

Starter code:

```python
import functools

def count_calls(func):
    return func

@count_calls
def hello(name):
    return f"hi {name}"

hello("a")
hello("b")
print(hello.calls)
```

### 2. Validate positive

Write a decorator `positive_args` that raises `ValueError` if any **positional** argument is a number less than or equal to 0. Otherwise it calls the function normally.

Starter code:

```python
import functools

def positive_args(func):
    return func

@positive_args
def area(w, h):
    return w * h

print(area(3, 4))
```

**In the sandbox:** exercises 53–54. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Inside count_calls, define wrapper(*args, **kwargs) decorated with @functools.wraps(func). In it, do wrapper.calls += 1 and return func(*args, **kwargs). Set wrapper.calls = 0 before return wrapper.
2. In the wrapper, loop over args; if a number is <= 0, raise ValueError. Then return func(*args, **kwargs).

</details>

<details>
<summary>Answers</summary>

**1. Call counter**

```python
import functools

def count_calls(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        wrapper.calls += 1
        return func(*args, **kwargs)
    wrapper.calls = 0
    return wrapper

@count_calls
def hello(name):
    return f"hi {name}"

hello("a")
hello("b")
print(hello.calls)
```

**2. Validate positive**

```python
import functools

def positive_args(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        for value in args:
            if isinstance(value, (int, float)) and value <= 0:
                raise ValueError(f"{func.__name__} needs positive numbers, got {value}")
        return func(*args, **kwargs)
    return wrapper

@positive_args
def area(w, h):
    return w * h

print(area(3, 4))
```

</details>

## Quick quiz

1. What is `@deco` above `def f(): ...` equivalent to?
   - A) `f = deco`
   - B) `f = deco(f)`
   - C) `deco = f(deco)`

2. Why use `functools.wraps` in a decorator?
   - A) It makes the function faster
   - B) It's required for decorators to work
   - C) It keeps the original function's name and docstring

<details>
<summary>Quiz answers</summary>

1. **B) `f = deco(f)`**: The decorator receives the function and its return value replaces it.
2. **C) It keeps the original function's name and docstring**: Without it, the decorated function reports the wrapper's name, which confuses debugging and tools.

</details>

---
Previous: [Lesson 31](31-iterators-and-generators.md) · Next: [Lesson 33: Context managers](33-context-managers.md)
