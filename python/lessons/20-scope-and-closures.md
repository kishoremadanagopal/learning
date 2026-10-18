# Lesson 20: Scope and closures

**You'll learn:** local vs global, the LEGB rule, `global`, `nonlocal`, closures.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python/#scope-and-closures)**: run every example and check your exercise answers.

## Key terms

- **Scope:** where in the code a name can be used.
- **Local variable:** created inside a function; exists only while it runs.
- **Global variable:** defined at the top level of a file.
- **LEGB rule:** the lookup order: Local, Enclosing, Global, Built-in.
- **global / nonlocal:** declare that an assignment refers to a global or enclosing variable.
- **Closure:** an inner function that remembers variables from the function that created it.

**Scope** is the region of code where a name is visible. Variables created inside a function are **local**: they exist only while the function runs.

```python
def make_greeting():
    message = "hi"          # local variable
    return message

print(make_greeting())
print("message" in dir())   # it doesn't exist out here
```

## The LEGB rule

When Python looks up a name, it searches four places in order:

1. **L**ocal: inside the current function
2. **E**nclosing: inside any outer functions
3. **G**lobal: at the top level of the file
4. **B**uilt-in: names like `print` and `len`

![Four nested scopes: local inside enclosing inside global inside built-in. Python searches for a name from the inside out](../figures/legb.svg)

```python
x = "global"

def outer():
    x = "enclosing"
    def inner():
        x = "local"
        print("inner sees:", x)
    inner()
    print("outer sees:", x)

outer()
print("module sees:", x)
```

## Reading vs assigning globals

A function can **read** a global variable, but assigning to a name inside a function creates a new local one instead:

```python
counter = 0

def bump():
    global counter      # say we mean the global one
    counter += 1

bump()
bump()
print(counter)
```

Use `global` sparingly. Functions that change globals are hard to test and reason about. Passing values in and returning results is almost always better.

## Closures: functions that remember

An inner function can use variables from the enclosing function, and it **keeps** them even after the outer function has returned. This is called a **closure**.

```python
def make_multiplier(factor):
    def multiply(n):
        return n * factor
    return multiply

double = make_multiplier(2)
triple = make_multiplier(3)
print(double(10), triple(10))
```

To **change** an enclosing variable, declare it `nonlocal`:

```python
def make_counter():
    count = 0
    def increment():
        nonlocal count
        count += 1
        return count
    return increment

clicks = make_counter()
clicks()
clicks()
print(clicks())
```

Each call to `make_counter()` creates a separate `count`, so you can have several independent counters. Closures are the foundation of decorators, which you'll meet in Part 7.

## Common mistakes

- Assigning to a global inside a function without `global`, which creates a new local instead, or raises `UnboundLocalError` with `+=`.
- Relying on global variables to pass data around. Pass arguments and return values instead.
- Naming a variable after a built-in, like `list = [1, 2]`, which hides the real `list`.

## Exercises

### 1. Running average

Write `make_averager()` that returns a function. Each time you call the returned function with a number, it returns the average of **all numbers passed so far**.

```text
avg = make_averager()
avg(10) -> 10.0
avg(20) -> 15.0
avg(30) -> 20.0
```

Starter code:

```python
def make_averager():
    pass

avg = make_averager()
print(avg(10), avg(20), avg(30))
```

**In the sandbox:** exercise 32. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Create values = [] inside make_averager, define an inner function that appends n and returns sum(values) / len(values), and return the inner function. Appending to a list doesn't need nonlocal.

</details>

<details>
<summary>Answers</summary>

**1. Running average**

```python
def make_averager():
    values = []
    def averager(n):
        values.append(n)
        return sum(values) / len(values)
    return averager

avg = make_averager()
print(avg(10), avg(20), avg(30))
```

</details>

## Quick quiz

1. In which order does Python look up names?
   - A) Local, Enclosing, Global, Built-in
   - B) Built-in, Global, Enclosing, Local
   - C) Global, Local, Built-in, Enclosing

2. What keyword lets an inner function reassign a variable of its outer function?
   - A) global
   - B) nonlocal
   - C) outer

<details>
<summary>Quiz answers</summary>

1. **A) Local, Enclosing, Global, Built-in**: That's the LEGB rule.
2. **B) nonlocal**: `nonlocal` refers to the enclosing function's variable; `global` refers to the module level.

</details>

---
Previous: [Lesson 19](19-parameters.md) · Next: [Lesson 21: Lambdas and higher-order functions](21-lambdas-and-higher-order.md)
