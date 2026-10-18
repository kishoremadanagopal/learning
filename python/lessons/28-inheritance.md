# Lesson 28: Inheritance and polymorphism

**You'll learn:** subclasses, overriding, `super()`, polymorphism, duck typing, ABCs, composition.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python/#inheritance)**: run every example and check your exercise answers.

## Key terms

- **Inheritance:** creating a class that reuses and extends another.
- **Parent (base) class / child (sub) class:** the class inherited from / the class that inherits.
- **Override:** redefining a parent's method in the child.
- **super():** gives access to the parent class's methods.
- **Polymorphism:** different classes responding to the same method call in their own way.
- **Duck typing:** caring what an object can do, not what class it is.
- **Abstract base class:** a class that can't be instantiated and defines methods subclasses must implement.
- **Composition:** building objects that contain other objects ("has a").

**Inheritance** lets a new class (the **child** or subclass) reuse and extend an existing class (the **parent** or base class).

```python
class Animal:
    def __init__(self, name):
        self.name = name

    def speak(self):
        return "..."

    def introduce(self):
        return f"I am {self.name} and I say {self.speak()}"

class Dog(Animal):          # Dog inherits from Animal
    def speak(self):        # override the parent's method
        return "Woof"

class Cat(Animal):
    def speak(self):
        return "Meow"

for pet in [Dog("Rex"), Cat("Tom"), Animal("Generic")]:
    print(pet.introduce())
```

`Dog` and `Cat` didn't define `__init__` or `introduce`; they inherited them. They only changed what's different.

![Dog and Cat inherit from Animal: they get name and introduce() from Animal and replace speak() with their own](../figures/inheritance-tree.svg)

## super(): extending the parent's behaviour

When a child needs extra setup, call the parent's version with `super()` and then add to it:

```python
class Employee:
    def __init__(self, name, salary):
        self.name = name
        self.salary = salary

    def describe(self):
        return f"{self.name} earns {self.salary:,}"

class Manager(Employee):
    def __init__(self, name, salary, reports):
        super().__init__(name, salary)    # reuse the parent's setup
        self.reports = reports

    def describe(self):
        base = super().describe()
        return f"{base} and manages {len(self.reports)} people"

m = Manager("Ana", 120000, ["Ben", "Cy"])
print(m.describe())
print(isinstance(m, Employee))
```

## Polymorphism

**Polymorphism** means "many forms": different classes respond to the same method call in their own way. The loop above called `introduce()` without caring which animal it had.

Python goes further with **duck typing**: "if it walks like a duck and quacks like a duck, it's a duck." Objects don't even need a shared parent, only the methods you call:

```python
class Robot:
    def speak(self):
        return "Beep"

class Parrot:
    def speak(self):
        return "Hello!"

for thing in [Robot(), Parrot()]:
    print(thing.speak())
```

## Abstract base classes

To force subclasses to implement a method, use `abc.ABC` and `@abstractmethod`. You can't create an instance of a class that still has abstract methods:

```python
from abc import ABC, abstractmethod

class Shape(ABC):
    @abstractmethod
    def area(self):
        ...

    def describe(self):
        return f"{type(self).__name__} with area {self.area():.2f}"

class Square(Shape):
    def __init__(self, side):
        self.side = side

    def area(self):
        return self.side ** 2

print(Square(3).describe())
try:
    Shape()
except TypeError as e:
    print("TypeError:", e)
```

## Composition: often better than inheritance

Inheritance means "is a" (a Manager **is an** Employee). When the relationship is "has a", store another object as an attribute instead. A `Car` **has an** `Engine`; it isn't one.

```python
class Engine:
    def start(self):
        return "vroom"

class Car:
    def __init__(self):
        self.engine = Engine()    # composition

    def drive(self):
        return f"Engine goes {self.engine.start()}"

print(Car().drive())
```

A good rule of thumb: prefer composition, and use inheritance for genuine "is a" relationships.

## Common mistakes

- Forgetting to call `super().__init__(...)`, so the parent's attributes are never set.
- Using inheritance for "has a" relationships. A Car has an Engine; it isn't one.
- Building deep inheritance chains that are hard to follow. Keep hierarchies shallow.

## Exercises

### 1. Shape hierarchy

Complete the classes so that `Circle(radius)` and `Rect(w, h)` both inherit from `Shape` and implement `area()`. Then write `total_area(shapes)` that returns the sum of all areas. Use `math.pi` for circles.

Starter code:

```python
import math

class Shape:
    def area(self):
        raise NotImplementedError

class Circle(Shape):
    pass

class Rect(Shape):
    pass

def total_area(shapes):
    return 0

print(round(total_area([Circle(1), Rect(2, 3)]), 2))
```

### 2. Savings account

Given the `Account` class, create `SavingsAccount(Account)` that takes an extra `rate` argument and has `add_interest()`, which increases the balance by `balance * rate`. Use `super().__init__`.

Starter code:

```python
class Account:
    def __init__(self, owner, balance=0):
        self.owner = owner
        self.balance = balance

class SavingsAccount(Account):
    pass

s = SavingsAccount("Ana", 1000, 0.05)
s.add_interest()
print(s.owner, s.balance)
```

**In the sandbox:** exercises 47–48. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Each subclass needs its own __init__ to store its measurements and its own area(). total_area can be sum(s.area() for s in shapes).
2. def __init__(self, owner, balance, rate): super().__init__(owner, balance); self.rate = rate

</details>

<details>
<summary>Answers</summary>

**1. Shape hierarchy**

```python
import math

class Shape:
    def area(self):
        raise NotImplementedError

class Circle(Shape):
    def __init__(self, radius):
        self.radius = radius

    def area(self):
        return math.pi * self.radius ** 2

class Rect(Shape):
    def __init__(self, w, h):
        self.w = w
        self.h = h

    def area(self):
        return self.w * self.h

def total_area(shapes):
    return sum(shape.area() for shape in shapes)

print(round(total_area([Circle(1), Rect(2, 3)]), 2))
```

**2. Savings account**

```python
class Account:
    def __init__(self, owner, balance=0):
        self.owner = owner
        self.balance = balance

class SavingsAccount(Account):
    def __init__(self, owner, balance, rate):
        super().__init__(owner, balance)
        self.rate = rate

    def add_interest(self):
        self.balance += self.balance * self.rate

s = SavingsAccount("Ana", 1000, 0.05)
s.add_interest()
print(s.owner, s.balance)
```

</details>

## Quick quiz

1. What does `super().__init__(...)` do?
   - A) Runs the parent class's initializer
   - B) Deletes the child's attributes
   - C) Creates a new parent object

2. A Library *has* many Books. What's the better design?
   - A) `class Library(Book)`
   - B) `class Book(Library)`
   - C) A Library with a `books` list attribute

<details>
<summary>Quiz answers</summary>

1. **A) Runs the parent class's initializer**: It lets the child reuse the parent's setup before adding its own.
2. **C) A Library with a `books` list attribute**: That's a "has a" relationship, so composition fits better than inheritance.

</details>

---
Previous: [Lesson 27](27-classes-and-objects.md) · Next: [Lesson 29: Special (dunder) methods](29-special-methods.md)
