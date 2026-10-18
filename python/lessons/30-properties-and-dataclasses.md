# Lesson 30: Properties and dataclasses

**You'll learn:** `@property`, setters, validation, `@dataclass`, `field`, `frozen`, `order`, `__post_init__`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python/#properties-and-dataclasses)**: run every example and check your exercise answers.

## Key terms

- **Property:** a method accessed like an attribute, created with `@property`.
- **Setter:** a method that runs when a property is assigned.
- **Encapsulation:** keeping an object's data valid by controlling access to it.
- **Dataclass:** a class whose `__init__`, `__repr__` and `__eq__` are generated from annotated fields.
- **field(default_factory=...):** gives each object its own fresh default, like a new list.
- **Frozen dataclass:** a dataclass whose objects can't be changed after creation.

### Properties: attributes with rules

Sometimes setting an attribute should run a check, or an attribute should be calculated. A **property** looks like a plain attribute from the outside but runs a method behind the scenes.

```python
class Thermostat:
    def __init__(self, celsius):
        self.celsius = celsius          # goes through the setter below

    @property
    def celsius(self):
        return self._celsius

    @celsius.setter
    def celsius(self, value):
        if value < -273.15:
            raise ValueError("Below absolute zero!")
        self._celsius = value

    @property
    def fahrenheit(self):               # read-only, calculated
        return self._celsius * 9 / 5 + 32

t = Thermostat(21)
t.celsius = 25
print(t.celsius, t.fahrenheit)
try:
    t.celsius = -300
except ValueError as e:
    print("Rejected:", e)
```

A leading underscore (`_celsius`) is a convention meaning "internal; don't touch from outside". Python doesn't enforce it, but other programmers respect it.

Start with plain attributes. You can switch to a property later without changing any code that uses the class. This is why Python code rarely has `get_x()` / `set_x()` methods.

## Dataclasses: less boilerplate

Many classes mostly hold data. Writing `__init__`, `__repr__` and `__eq__` by hand gets repetitive. The `@dataclass` decorator generates them from **type-annotated** class attributes:

```python
from dataclasses import dataclass, field

@dataclass
class Product:
    name: str
    price: float
    tags: list = field(default_factory=list)   # a fresh list per object

    def discounted(self, percent):
        return round(self.price * (1 - percent / 100), 2)

p = Product("Lamp", 40.0)
p.tags.append("home")
print(p)
print(p == Product("Lamp", 40.0, ["home"]))
print(p.discounted(25))
```

`field(default_factory=list)` avoids the shared mutable default trap from Part 4.

## Useful dataclass options

```python
from dataclasses import dataclass

@dataclass(frozen=True, order=True)
class Point:
    x: int
    y: int = 0

points = [Point(3, 1), Point(1, 5), Point(1, 2)]
print(sorted(points))           # order=True compares fields in order

p = Point(1, 2)
try:
    p.x = 10                    # frozen=True makes objects immutable
except Exception as e:
    print(type(e).__name__)
```

Frozen dataclasses can be used as dictionary keys and set members, just like tuples.

## __post_init__: validation in dataclasses

```python
from dataclasses import dataclass

@dataclass
class Order:
    item: str
    qty: int

    def __post_init__(self):
        if self.qty < 1:
            raise ValueError("qty must be at least 1")

print(Order("pen", 3))
try:
    Order("pen", 0)
except ValueError as e:
    print("Error:", e)
```

## Common mistakes

- Naming the stored attribute the same as the property (`self.celsius` inside the `celsius` setter), causing infinite recursion. Store it as `self._celsius`.
- Using `tags: list = []` in a dataclass. Use `field(default_factory=list)`.
- Forgetting type annotations in a dataclass. Fields without annotations are ignored.

## Exercises

### 1. Student record

Create a dataclass `Student` with `name: str` and `grades: list` (default: a new empty list). Add a property `average` that returns the mean grade, or `0` when there are no grades.

Starter code:

```python
from dataclasses import dataclass, field

class Student:
    pass

s = Student("Ana", [90, 80])
print(s, s.average)
```

**In the sandbox:** exercise 50. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Put @dataclass above the class, declare name: str and grades: list = field(default_factory=list), then add an @property method named average.

</details>

<details>
<summary>Answers</summary>

**1. Student record**

```python
from dataclasses import dataclass, field

@dataclass
class Student:
    name: str
    grades: list = field(default_factory=list)

    @property
    def average(self):
        if not self.grades:
            return 0
        return sum(self.grades) / len(self.grades)

s = Student("Ana", [90, 80])
print(s, s.average)
```

</details>

## Quick quiz

1. What does `@property` let you do?
   - A) Speed up attribute access
   - B) Make an attribute private
   - C) Run a method when an attribute is read, while keeping attribute syntax

2. Which methods does `@dataclass` generate by default?
   - A) Only `__init__`
   - B) `__str__` and `__hash__` only
   - C) `__init__`, `__repr__` and `__eq__`

<details>
<summary>Quiz answers</summary>

1. **C) Run a method when an attribute is read, while keeping attribute syntax**: `t.fahrenheit` looks like an attribute but calls a method.
2. **C) `__init__`, `__repr__` and `__eq__`**: Those three are always generated; others depend on options like `order=True`.

</details>

---
Previous: [Lesson 29](29-special-methods.md) · Next: [Lesson 31: Iterators and generators](31-iterators-and-generators.md)
