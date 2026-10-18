# Lesson 23: Abstract classes and interfaces

**You'll learn:** abstract classes, abstract methods, interfaces, `implements`, default methods.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/java/#abstract-and-interfaces)**: run every example and check your exercise answers.

## Key terms

- **Abstract class:** a class that can't be instantiated and may declare abstract methods.
- **Abstract method:** a method without a body that subclasses must implement.
- **Interface:** a set of methods a class promises to provide.
- **implements:** declares that a class fulfils an interface.
- **Default method:** an interface method with a body.

### Abstract classes

An **abstract** class is a partial blueprint. It can't be instantiated, and it can declare **abstract methods** that every concrete subclass must implement:

```java
abstract class Shape {
    abstract double area();                 // no body: subclasses must provide one

    String describe() {                     // normal methods are fine too
        return getClass().getSimpleName() + String.format(" with area %.2f", area());
    }
}

class Circle extends Shape {
    private final double r;
    Circle(double r) { this.r = r; }
    @Override double area() { return Math.PI * r * r; }
}

class Rect extends Shape {
    private final double w, h;
    Rect(double w, double h) { this.w = w; this.h = h; }
    @Override double area() { return w * h; }
}

public class Main {
    public static void main(String[] args) {
        Shape[] shapes = {new Circle(1), new Rect(2, 3)};
        for (Shape s : shapes) {
            System.out.println(s.describe());
        }
        // new Shape();   // won't compile: Shape is abstract
    }
}
```

## Interfaces

An **interface** describes a **capability**: a set of methods a class promises to provide. A class `implements` an interface, and unlike `extends`, a class can implement **many** interfaces.

```java
interface Payable {
    double amountDue();
}

interface Describable {
    String describe();

    default String shout() {                 // default method: has a body
        return describe().toUpperCase() + "!";
    }
}

class Invoice implements Payable, Describable {
    private final double total;
    Invoice(double total) { this.total = total; }
    public double amountDue() { return total; }
    public String describe() { return "invoice for " + total; }
}

class Salary implements Payable {
    public double amountDue() { return 3000; }
}

public class Main {
    public static void main(String[] args) {
        Payable[] bills = {new Invoice(120.5), new Salary()};
        double sum = 0;
        for (Payable p : bills) {
            sum += p.amountDue();
        }
        System.out.println("Total due: " + sum);
        System.out.println(new Invoice(9).shout());
    }
}
```

Interface methods are `public` automatically, so the implementing methods must be `public` too.

## Abstract class or interface?

| | Abstract class | Interface |
|---|---|---|
| Relationship | "is a" (shared identity) | "can do" (a capability) |
| A class can have | one parent | many interfaces |
| Fields | any | only constants |
| Constructors | yes | no |

Prefer interfaces for capabilities like `Comparable`, `Runnable` or `Payable`; use an abstract class when subclasses share real state and code.

## Interfaces you'll use constantly

- `Comparable<T>`: objects that know how to compare themselves (Part 5).
- `Runnable`, `Comparator`, `Function`: often written as lambdas (Part 6).
- `List`, `Set`, `Map`: the collection types (Part 5) are interfaces.

## Common mistakes

- Trying to `new` an abstract class or interface.
- Forgetting `public` on methods that implement an interface.
- Using an abstract class where an interface would allow more flexibility.

## Exercises

### 1. Shapes with an interface

Create an interface `HasArea` with `double area();`, and two classes implementing it: `Circle(double radius)` and `Rect(double width, double height)`. Then write `static double totalArea(HasArea[] items)` in `Main`.

Starter code:

```java
public class Main {
    static double totalArea(HasArea[] items) {
        return 0;
    }

    public static void main(String[] args) {
    }
}
```

**In the sandbox:** exercise 33. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. interface HasArea { double area(); } then class Circle implements HasArea { ... public double area() { ... } }. The implementing methods must be public.

</details>

<details>
<summary>Answers</summary>

**1. Shapes with an interface**

```java
interface HasArea {
    double area();
}

class Circle implements HasArea {
    private final double radius;

    Circle(double radius) {
        this.radius = radius;
    }

    public double area() {
        return Math.PI * radius * radius;
    }
}

class Rect implements HasArea {
    private final double width;
    private final double height;

    Rect(double width, double height) {
        this.width = width;
        this.height = height;
    }

    public double area() {
        return width * height;
    }
}

public class Main {
    static double totalArea(HasArea[] items) {
        double total = 0;
        for (HasArea item : items) {
            total += item.area();
        }
        return total;
    }

    public static void main(String[] args) {
        HasArea[] items = {new Circle(2), new Rect(2, 3)};
        System.out.println(totalArea(items));
    }
}
```

</details>

## Quick quiz

1. Can you create an object with `new` from an abstract class?
   - A) No
   - B) Yes

2. How many interfaces can a class implement?
   - A) Two
   - B) One
   - C) Any number

3. Why must a method implementing an interface method be `public`?
   - A) It's a style rule only
   - B) It doesn't have to be
   - C) Interface methods are implicitly public, and you can't reduce visibility

<details>
<summary>Quiz answers</summary>

1. **A) No**: Abstract classes are partial; only concrete subclasses can be instantiated.
2. **C) Any number**: `class A implements X, Y, Z` is fine.
3. **C) Interface methods are implicitly public, and you can't reduce visibility**: An override can't be less visible than the method it implements.

</details>

---
Previous: [Lesson 22](22-polymorphism.md) · Next: [Lesson 24: Enums and records](24-enums-and-records.md)
