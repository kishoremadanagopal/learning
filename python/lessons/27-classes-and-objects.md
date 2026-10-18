# Lesson 27: Classes and objects

**You'll learn:** `class`, `__init__`, `self`, attributes, methods, class attributes, `@classmethod`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python/#classes-and-objects)**: run every example and check your exercise answers.

## Key terms

- **Class:** a blueprint for creating objects of a new type.
- **Object (instance):** one value created from a class.
- **Attribute:** data stored on an object, like `self.name`.
- **Method:** a function defined in a class.
- **`__init__`:** the initializer that sets up a new object.
- **self:** the object a method is working on.
- **Class attribute:** a value shared by all instances.
- **classmethod / staticmethod:** methods that receive the class, or nothing, instead of an instance.

So far you've used Python's built-in types: `str`, `list`, `dict`. A **class** lets you create your own type. An **object** (or **instance**) is one particular value of that type.

Think of a class as a blueprint and objects as houses built from it. Every house has the same layout, but each has its own paint colour and furniture.

```python
class Dog:
    def __init__(self, name, age):
        self.name = name        # attributes: data stored on the object
        self.age = age

    def bark(self):             # method: a function that belongs to the class
        return f"{self.name} says woof!"

rex = Dog("Rex", 3)
fido = Dog("Fido", 7)
print(rex.bark())
print(fido.name, fido.age)
```

![The class Dog is a blueprint; Dog("Rex", 3) and Dog("Fido", 7) build two objects, each with its own name and age](../figures/class-objects.svg)

## What's going on

- `class Dog:` defines a new type. Class names use **CamelCase**.
- `__init__` is the **initializer**. Python calls it automatically when you create an object with `Dog(...)`.
- `self` is the object being created or used. `self.name = name` stores the value **on that object**.
- `rex.bark()` calls the method; Python passes `rex` as `self` automatically.

## Objects keep their own state

```python
class BankAccount:
    def __init__(self, owner, balance=0):
        self.owner = owner
        self.balance = balance

    def deposit(self, amount):
        if amount <= 0:
            raise ValueError("Deposit must be positive")
        self.balance += amount

    def withdraw(self, amount):
        if amount > self.balance:
            raise ValueError("Insufficient funds")
        self.balance -= amount

ana = BankAccount("Ana", 100)
ben = BankAccount("Ben")
ana.deposit(50)
ben.deposit(20)
ana.withdraw(30)
print(ana.owner, ana.balance)
print(ben.owner, ben.balance)
```

This is the core idea of **object-oriented programming (OOP)**: bundle data together with the functions that work on it, and protect the data's rules (like "no negative balance") inside the methods.

## Class attributes vs instance attributes

Attributes set on `self` belong to one object. Attributes defined directly in the class body are shared by all instances:

```python
class Circle:
    pi = 3.14159              # class attribute, shared

    def __init__(self, radius):
        self.radius = radius  # instance attribute, per object

    def area(self):
        return Circle.pi * self.radius ** 2

small, big = Circle(1), Circle(10)
print(small.area(), big.area())
```

## Class methods and static methods

A `@classmethod` receives the class itself (`cls`) instead of an instance. It's often used for alternative constructors. A `@staticmethod` receives neither; it's just a function grouped with the class.

```python
class Temperature:
    def __init__(self, celsius):
        self.celsius = celsius

    @classmethod
    def from_fahrenheit(cls, f):
        return cls((f - 32) * 5 / 9)

    @staticmethod
    def is_freezing(celsius):
        return celsius <= 0

t = Temperature.from_fahrenheit(212)
print(t.celsius, Temperature.is_freezing(t.celsius))
```

## Checking types

```python
class Cat:
    pass

tom = Cat()
print(isinstance(tom, Cat), isinstance(tom, str))
print(type(tom).__name__)
```

## Common mistakes

- Forgetting `self` as the first parameter of a method.
- Writing `name = name` instead of `self.name = name` in `__init__`, so nothing is stored.
- Calling a method without parentheses: `rex.bark` instead of `rex.bark()`.
- Creating mutable data (like a list) as a class attribute, so every object shares it.

## Exercises

### 1. Rectangle class

Create a class `Rectangle` with:

- `__init__(self, width, height)` storing both values
- `area()` returning width × height
- `perimeter()` returning 2 × (width + height)
- `is_square()` returning `True` when width equals height

Starter code:

```python
class Rectangle:
    pass

r = Rectangle(3, 4)
print(r.area(), r.perimeter(), r.is_square())
```

### 2. Shopping cart

Create a class `Cart` that starts empty. `add(item, price, qty=1)` adds an item; `total()` returns the sum of price × qty; `count()` returns the total number of units.

Starter code:

```python
class Cart:
    def __init__(self):
        pass

cart = Cart()
cart.add("pen", 1.5, 4)
cart.add("book", 12.0)
print(cart.total(), cart.count())
```

**In the sandbox:** exercises 45–46. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Every method takes self as its first parameter. Inside, use self.width and self.height.
2. In __init__, set self.items = []. add() appends a tuple (item, price, qty). total() and count() loop over self.items.

</details>

<details>
<summary>Answers</summary>

**1. Rectangle class**

```python
class Rectangle:
    def __init__(self, width, height):
        self.width = width
        self.height = height

    def area(self):
        return self.width * self.height

    def perimeter(self):
        return 2 * (self.width + self.height)

    def is_square(self):
        return self.width == self.height

r = Rectangle(3, 4)
print(r.area(), r.perimeter(), r.is_square())
```

**2. Shopping cart**

```python
class Cart:
    def __init__(self):
        self.items = []

    def add(self, item, price, qty=1):
        self.items.append((item, price, qty))

    def total(self):
        return sum(price * qty for _, price, qty in self.items)

    def count(self):
        return sum(qty for _, _, qty in self.items)

cart = Cart()
cart.add("pen", 1.5, 4)
cart.add("book", 12.0)
print(cart.total(), cart.count())
```

</details>

## Quick quiz

1. What is `self` in a method?
   - A) The class
   - B) The object the method was called on
   - C) A reserved keyword you can't rename

2. When does `__init__` run?
   - A) When the class is defined
   - B) When the program ends
   - C) Each time a new object is created

<details>
<summary>Quiz answers</summary>

1. **B) The object the method was called on**: Python passes the instance automatically. `self` is a convention, not a keyword.
2. **C) Each time a new object is created**: `Dog("Rex", 3)` creates an object and immediately calls `__init__` on it.

</details>

---
Previous: [Lesson 26](26-testing-and-debugging.md) · Next: [Lesson 28: Inheritance and polymorphism](28-inheritance.md)
