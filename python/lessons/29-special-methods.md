# Lesson 29: Special (dunder) methods

**You'll learn:** `__str__`, `__repr__`, `__eq__`, `__lt__`, `__add__`, `__len__`, `__iter__`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python/#special-methods)**: run every example and check your exercise answers.

## Key terms

- **Special (dunder) method:** a method with double underscores that Python calls for built-in syntax.
- **`__str__`:** the readable string for users (`print`, `str`).
- **`__repr__`:** the unambiguous string for developers, ideally code that recreates the object.
- **`__eq__` / `__lt__`:** define `==` and `<`.
- **Operator overloading:** defining what operators like `+` mean for your class.
- **Protocol:** a set of methods that make an object behave a certain way, like `__iter__` for iteration.

Methods with double underscores, like `__init__`, are called **special** or **dunder** methods. Python calls them for you when you use built-in syntax. Implementing them makes your objects behave like built-in types.

## __str__ and __repr__: how objects print

```python
class Book:
    def __init__(self, title, author):
        self.title = title
        self.author = author

    def __str__(self):          # for users: print(), str(), f-strings
        return f"{self.title} by {self.author}"

    def __repr__(self):         # for developers: the console, inside lists
        return f"Book({self.title!r}, {self.author!r})"

b = Book("Dune", "Frank Herbert")
print(b)
print([b])
print(repr(b))
```

Always write a `__repr__`. A good one looks like the code that would recreate the object.

## Comparison: __eq__ and __lt__

By default, `==` checks whether two variables refer to the **same object**. Define `__eq__` to compare by value. Defining `__lt__` (less than) makes `sorted()` work:

```python
class Version:
    def __init__(self, text):
        self.parts = tuple(int(p) for p in text.split("."))

    def __eq__(self, other):
        return self.parts == other.parts

    def __lt__(self, other):
        return self.parts < other.parts

    def __repr__(self):
        return "v" + ".".join(map(str, self.parts))

print(Version("1.10.0") > Version("1.9.3"))
print(sorted([Version("2.0"), Version("1.10"), Version("1.2")]))
print(Version("3.1") == Version("3.1"))
```

Python works out `>` from your `__lt__` by swapping the sides. `functools.total_ordering` can fill in the rest (`<=`, `>=`) for you.

## Arithmetic: __add__ and friends

```python
class Vector:
    def __init__(self, x, y):
        self.x, self.y = x, y

    def __add__(self, other):
        return Vector(self.x + other.x, self.y + other.y)

    def __mul__(self, scalar):
        return Vector(self.x * scalar, self.y * scalar)

    def __abs__(self):
        return (self.x ** 2 + self.y ** 2) ** 0.5

    def __repr__(self):
        return f"Vector({self.x}, {self.y})"

v = Vector(3, 4)
print(v + Vector(1, 1))
print(v * 2)
print(abs(v))
```

## Containers: __len__, __getitem__, __contains__, __iter__

```python
class Playlist:
    def __init__(self, *songs):
        self.songs = list(songs)

    def __len__(self):
        return len(self.songs)

    def __getitem__(self, index):
        return self.songs[index]

    def __contains__(self, song):
        return song in self.songs

    def __iter__(self):
        return iter(self.songs)

mix = Playlist("Intro", "Groove", "Outro")
print(len(mix), mix[1], "Groove" in mix)
for song in mix:
    print("-", song)
```

## A quick reference

| You write | Python calls |
|---|---|
| `str(x)`, `print(x)` | `x.__str__()` |
| `repr(x)` | `x.__repr__()` |
| `x == y` | `x.__eq__(y)` |
| `x < y` | `x.__lt__(y)` |
| `x + y` | `x.__add__(y)` |
| `len(x)` | `x.__len__()` |
| `x[i]` | `x.__getitem__(i)` |
| `item in x` | `x.__contains__(item)` |
| `for i in x` | `x.__iter__()` |
| `x()` | `x.__call__()` |
| `with x:` | `x.__enter__()` / `x.__exit__()` |

## Common mistakes

- Returning something other than a string from `__str__` or `__repr__`.
- Changing an object in `__add__` instead of returning a new one.
- Defining `__eq__` and expecting objects to still work in sets. Defining `__eq__` removes the default `__hash__`.

## Exercises

### 1. Money class

Create a `Money` class holding `amount` and `currency`, with:

- `__repr__` returning like `Money(10.5, 'USD')`
- `__str__` returning like `10.50 USD`
- `__eq__` comparing amount and currency
- `__add__` that adds two Money values of the **same** currency and raises `ValueError` for different currencies

Starter code:

```python
class Money:
    def __init__(self, amount, currency):
        self.amount = amount
        self.currency = currency

a = Money(10.5, "USD")
print(a, repr(a), a + Money(2, "USD"))
```

**In the sandbox:** exercise 49. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Use !r inside the f-string for repr: f"Money({self.amount!r}, {self.currency!r})". __add__ should return a new Money object.

</details>

<details>
<summary>Answers</summary>

**1. Money class**

```python
class Money:
    def __init__(self, amount, currency):
        self.amount = amount
        self.currency = currency

    def __repr__(self):
        return f"Money({self.amount!r}, {self.currency!r})"

    def __str__(self):
        return f"{self.amount:.2f} {self.currency}"

    def __eq__(self, other):
        return self.amount == other.amount and self.currency == other.currency

    def __add__(self, other):
        if self.currency != other.currency:
            raise ValueError("Can't add different currencies")
        return Money(self.amount + other.amount, self.currency)

a = Money(10.5, "USD")
print(a, repr(a), a + Money(2, "USD"))
```

</details>

## Quick quiz

1. Which method does `print(obj)` use first?
   - A) `__repr__`
   - B) `__print__`
   - C) `__str__`

2. Which method makes `len(obj)` work?
   - A) `__length__`
   - B) `__size__`
   - C) `__len__`

3. Without `__eq__`, what does `a == b` compare for two objects?
   - A) All their attributes
   - B) Their string forms
   - C) Whether they're the same object

<details>
<summary>Quiz answers</summary>

1. **C) `__str__`**: print uses `__str__`, falling back to `__repr__` if `__str__` isn't defined.
2. **C) `__len__`**: `len()` calls `__len__`.
3. **C) Whether they're the same object**: The default equality is identity, like `a is b`.

</details>

---
Previous: [Lesson 28](28-inheritance.md) · Next: [Lesson 30: Properties and dataclasses](30-properties-and-dataclasses.md)
