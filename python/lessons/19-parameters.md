# Lesson 19: Parameters in depth

**You'll learn:** defaults, keyword arguments, `*args`, `**kwargs`, unpacking, keyword-only, mutable defaults.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python/#parameters)**: run every example and check your exercise answers.

## Key terms

- **Default value:** the value a parameter gets when no argument is given.
- **Positional argument:** matched to parameters by position.
- **Keyword argument:** matched to parameters by name.
- **`*args`:** collects extra positional arguments into a tuple.
- **`**kwargs`:** collects extra keyword arguments into a dict.
- **Keyword-only parameter:** a parameter after `*` that must be passed by name.

Python gives you flexible ways to pass arguments.

## Positional and keyword arguments

```python
def describe_pet(name, animal="dog"):
    return f"{name} is a {animal}"

print(describe_pet("Rex"))                     # uses the default
print(describe_pet("Tom", "cat"))              # positional
print(describe_pet(animal="parrot", name="Polly"))  # keywords, any order
```

Keyword arguments make calls self-explanatory: `connect(host="db", timeout=5)` is clearer than `connect("db", 5)`. Parameters with defaults must come after those without.

## *args: any number of positional arguments

A parameter with `*` collects extra positional arguments into a **tuple**:

```python
def total(*numbers):
    print("received", numbers)
    return sum(numbers)

print(total(1, 2))
print(total(5, 10, 15, 20))
```

## **kwargs: any number of keyword arguments

A parameter with `**` collects extra keyword arguments into a **dict**:

```python
def make_profile(name, **details):
    profile = {"name": name}
    profile.update(details)
    return profile

print(make_profile("Ada", job="mathematician", born=1815))
```

## Unpacking when calling

`*` and `**` also work the other way: they spread a list or dict into arguments.

```python
def volume(length, width, height):
    return length * width * height

dims = [2, 3, 4]
print(volume(*dims))

opts = {"length": 1, "width": 5, "height": 2}
print(volume(**opts))
```

## Keyword-only parameters

Parameters after a bare `*` must be passed by keyword. This prevents confusing calls:

```python
def resize(image, *, width, height):
    return f"{image} -> {width}x{height}"

print(resize("cat.png", width=200, height=100))
```

Calling `resize("cat.png", 200, 100)` would raise a `TypeError`.

## The mutable default trap

Default values are created **once**, when the function is defined, not each time it's called. A mutable default like `[]` is shared between calls:

```python
def add_item_buggy(item, basket=[]):
    basket.append(item)
    return basket

print(add_item_buggy("apple"))
print(add_item_buggy("pear"))    # surprise: apple is still there

def add_item(item, basket=None):
    if basket is None:
        basket = []
    basket.append(item)
    return basket

print(add_item("apple"))
print(add_item("pear"))
```

Use `None` as the default and create the list inside the function.

## Common mistakes

- Using a mutable default like `def f(items=[])`. The list is shared between calls; default to `None` instead.
- Putting a parameter without a default after one with a default.
- Passing arguments in the wrong order. Keyword arguments make calls clearer.

## Exercises

### 1. Flexible greeting

Write `greet(*names, greeting="Hello")` that returns one greeting for all names, joined by `" and "`.

- `greet("Ana")` → `"Hello, Ana!"`
- `greet("Ana", "Ben", greeting="Hi")` → `"Hi, Ana and Ben!"`
- `greet()` → `"Hello, nobody!"`

Starter code:

```python
def greet(names, greeting):
    pass

print(greet("Ana", "Ben", greeting="Hi"))
```

### 2. Fix the shared list

This function has the mutable default bug. Fix it so that every call without a `log` argument starts with a fresh list.

Starter code:

```python
def record(event, log=[]):
    log.append(event)
    return log

print(record("start"))
print(record("stop"))
```

**In the sandbox:** exercises 30–31. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Use def greet(*names, greeting="Hello"):. names is a tuple; " and ".join(names) joins it. An empty tuple is falsy.
2. Change the default to None, and inside the function write: if log is None: log = []

</details>

<details>
<summary>Answers</summary>

**1. Flexible greeting**

```python
def greet(*names, greeting="Hello"):
    who = " and ".join(names) if names else "nobody"
    return f"{greeting}, {who}!"

print(greet("Ana", "Ben", greeting="Hi"))
```

**2. Fix the shared list**

```python
def record(event, log=None):
    if log is None:
        log = []
    log.append(event)
    return log

print(record("start"))
print(record("stop"))
```

</details>

## Quick quiz

1. Inside `def f(*args)`, what type is `args`?
   - A) list
   - B) tuple
   - C) dict

2. What does `f(**{"a": 1, "b": 2})` do?
   - A) Passes one dict argument
   - B) Raises an error
   - C) Calls `f(a=1, b=2)`

3. Why is `def f(x=[])` risky?
   - A) It makes x a tuple
   - B) Lists can't be defaults
   - C) The same list is reused across calls

<details>
<summary>Quiz answers</summary>

1. **B) tuple**: `*args` collects positional arguments into a tuple.
2. **C) Calls `f(a=1, b=2)`**: `**` unpacks a dict into keyword arguments.
3. **C) The same list is reused across calls**: Defaults are evaluated once at definition time, so all calls share one list.

</details>

---
Previous: [Lesson 18](18-functions-basics.md) · Next: [Lesson 20: Scope and closures](20-scope-and-closures.md)
