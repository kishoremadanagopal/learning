# Lesson 22: Polymorphism and casting

**You'll learn:** parent-type variables, dynamic dispatch, `instanceof` patterns, casting.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/java/#polymorphism)**: run every example and check your exercise answers.

## Key terms

- **Polymorphism:** one variable type referring to objects of many subclasses.
- **Dynamic dispatch:** the object's actual class decides which overridden method runs.
- **Declared type / actual type:** the variable's type / the object's real class.
- **Upcast / downcast:** treating an object as its parent type / converting back to a subclass.
- **instanceof:** checks whether an object is of a type; `x instanceof Dog d` also casts.
- **ClassCastException:** thrown by an invalid downcast.

**Polymorphism** ("many forms") means a variable of a parent type can hold any subclass object, and calling a method runs the **object's** version.

```java
class Shape {
    double area() { return 0; }
    String name() { return "shape"; }
}

class Circle extends Shape {
    private final double r;
    Circle(double r) { this.r = r; }
    @Override double area() { return Math.PI * r * r; }
    @Override String name() { return "circle"; }
}

class Square extends Shape {
    private final double side;
    Square(double side) { this.side = side; }
    @Override double area() { return side * side; }
    @Override String name() { return "square"; }
}

public class Main {
    public static void main(String[] args) {
        Shape[] shapes = {new Circle(1), new Square(2), new Circle(0.5)};
        double total = 0;
        for (Shape s : shapes) {
            System.out.printf("%-7s %.2f%n", s.name(), s.area());
            total += s.area();
        }
        System.out.printf("total   %.2f%n", total);
    }
}
```

The loop doesn't know or care which shape it has. Java picks the right `area()` at runtime; this is called **dynamic dispatch**. Adding a `Triangle` later needs no change to the loop.

## Declared type vs actual type

In `Shape s = new Circle(1);` the **declared type** is `Shape` and the **actual type** is `Circle`:

- The **declared type** decides which methods you're *allowed* to call (checked at compile time).
- The **actual type** decides which version *runs* (at runtime).

## instanceof and casting

Sometimes you need a subclass-only method. Check the type with `instanceof`, then **cast**. Java 16 added **pattern matching**, which does both in one step:

*This example raises an error on purpose.*

```java
class Animal { }
class Dog extends Animal {
    String fetch() { return "fetching!"; }
}
class Cat extends Animal { }

public class Main {
    public static void main(String[] args) {
        Animal[] animals = {new Dog(), new Cat()};
        for (Animal a : animals) {
            if (a instanceof Dog d) {          // test and cast in one go
                System.out.println("Dog is " + d.fetch());
            } else {
                System.out.println(a.getClass().getSimpleName() + " can't fetch");
            }
        }

        Animal x = new Cat();
        Dog old = (Dog) x;                     // a wrong cast compiles but fails at runtime
    }
}
```

That last line compiles but throws `ClassCastException`, because a `Cat` isn't a `Dog`. Frequent `instanceof` checks often mean a method belongs in the parent class instead.

## Overloading vs overriding

| | Overloading | Overriding |
|---|---|---|
| What | same name, different parameters | same signature in a subclass |
| Chosen | at compile time, by argument types | at runtime, by the object's type |
| Example | `add(int, int)` / `add(double, double)` | `Dog.speak()` replacing `Animal.speak()` |

## Common mistakes

- Downcasting without checking the type first.
- Calling a subclass-only method on a parent-type variable.
- Long `instanceof` chains where an overridden method would be simpler.

## Exercises

### 1. Payroll

Create a class `Employee` with a `String name` and a method `double pay()` returning `0`. Create `Salaried extends Employee` (constructor `Salaried(String name, double annual)`, `pay()` returns `annual / 12`) and `Hourly extends Employee` (constructor `Hourly(String name, double rate, double hours)`, `pay()` returns `rate * hours`). Then write `static double totalPayroll(Employee[] staff)` in `Main`.

Starter code:

```java
class Employee {
    String name;

    Employee(String name) {
        this.name = name;
    }

    double pay() {
        return 0;
    }
}

public class Main {
    static double totalPayroll(Employee[] staff) {
        return 0;
    }

    public static void main(String[] args) {
    }
}
```

**In the sandbox:** exercise 32. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Each subclass calls super(name) and overrides pay(). totalPayroll loops over the array and adds up e.pay(); dynamic dispatch picks the right version.

</details>

<details>
<summary>Answers</summary>

**1. Payroll**

```java
class Employee {
    String name;

    Employee(String name) {
        this.name = name;
    }

    double pay() {
        return 0;
    }
}

class Salaried extends Employee {
    private final double annual;

    Salaried(String name, double annual) {
        super(name);
        this.annual = annual;
    }

    @Override
    double pay() {
        return annual / 12;
    }
}

class Hourly extends Employee {
    private final double rate;
    private final double hours;

    Hourly(String name, double rate, double hours) {
        super(name);
        this.rate = rate;
        this.hours = hours;
    }

    @Override
    double pay() {
        return rate * hours;
    }
}

public class Main {
    static double totalPayroll(Employee[] staff) {
        double total = 0;
        for (Employee e : staff) {
            total += e.pay();
        }
        return total;
    }

    public static void main(String[] args) {
        Employee[] staff = {new Salaried("Ana", 60000), new Hourly("Ben", 20, 10)};
        System.out.println(totalPayroll(staff));
    }
}
```

</details>

## Quick quiz

1. `Animal a = new Dog(); a.speak();` runs which `speak()`?
   - A) Both
   - B) Dog's
   - C) Animal's

2. What does `if (x instanceof Dog d)` do?
   - A) Creates a new Dog
   - B) Checks the type and, if it matches, makes `d` a Dog variable
   - C) Always casts, even if x isn't a Dog

3. A wrong downcast like `(Dog) someCat` causes…
   - A) Nothing
   - B) ClassCastException at runtime
   - C) A compile error

<details>
<summary>Quiz answers</summary>

1. **B) Dog's**: The object's actual type decides at runtime.
2. **B) Checks the type and, if it matches, makes `d` a Dog variable**: Pattern matching combines the type test and the cast.
3. **B) ClassCastException at runtime**: The compiler can't always know the actual type, so the check happens at runtime.

</details>

---
Previous: [Lesson 21](21-inheritance.md) · Next: [Lesson 23: Abstract classes and interfaces](23-abstract-and-interfaces.md)
