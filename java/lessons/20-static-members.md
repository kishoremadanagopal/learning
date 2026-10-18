# Lesson 20: Static fields and methods

**You'll learn:** static fields, static methods, constants, utility classes.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/java/#static-members)**: run every example and check your exercise answers.

## Key terms

- **static field:** one shared value that belongs to the class.
- **static method:** a method called on the class, with no `this`.
- **Constant:** a `static final` value, named in UPPER_SNAKE_CASE.
- **Utility class:** a class of static helper methods, like `Math`.

Everything you've declared without `static` belongs to **each object**. A `static` member belongs to the **class itself** and is shared by all objects.

```java
class Ticket {
    private static int nextNumber = 1;    // shared by every Ticket
    private final int number;             // each Ticket has its own

    Ticket() {
        number = nextNumber;
        nextNumber++;
    }

    int getNumber() {
        return number;
    }

    static int issued() {                 // called on the class: Ticket.issued()
        return nextNumber - 1;
    }
}

public class Main {
    public static void main(String[] args) {
        Ticket a = new Ticket();
        Ticket b = new Ticket();
        Ticket c = new Ticket();
        System.out.println(a.getNumber() + " " + b.getNumber() + " " + c.getNumber());
        System.out.println("Issued: " + Ticket.issued());
    }
}
```

## When to use static

- **Constants**: `static final double TAX = 0.08;`, like `Math.PI`.
- **Utility methods** that only work on their parameters: `Math.max`, `Integer.parseInt`, `Arrays.sort`.
- **Shared counters or caches**, like `nextNumber` above.

## What static code can't do

A static method has no `this`, because there's no current object. So it can't use instance fields or call instance methods directly:

*This example raises an error on purpose.*

```java
class Dog {
    String name = "Rex";

    static void bark() {
        System.out.println(name + " says woof");
    }
}

public class Main {
    public static void main(String[] args) {
        Dog.bark();
    }
}
```

That's why `main`, which is static, has been calling other static methods: it needs an object before it can call instance methods.

## A utility class

```java
final class Temperatures {
    private Temperatures() { }        // no objects needed

    static double toFahrenheit(double c) {
        return c * 9 / 5 + 32;
    }

    static double toCelsius(double f) {
        return (f - 32) * 5 / 9;
    }
}

public class Main {
    public static void main(String[] args) {
        System.out.println(Temperatures.toFahrenheit(100));
        System.out.println(Temperatures.toCelsius(212));
    }
}
```

The private constructor prevents anyone from creating pointless `Temperatures` objects.

## Common mistakes

- Using an instance field inside a static method.
- Making everything static to avoid creating objects.
- Expecting each object to have its own copy of a static field.

## Exercises

### 1. Instance counter

Create a class `Player` with a `name` field, a constructor `Player(String name)`, and a **static** method `count()` that returns how many `Player` objects have been created so far.

Starter code:

```java
class Player {
    String name;

    Player(String name) {
        this.name = name;
    }
}

public class Main {
    public static void main(String[] args) {
        new Player("Ana");
        new Player("Ben");
        // System.out.println(Player.count());
    }
}
```

**In the sandbox:** exercise 30. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Add private static int created = 0; increase it in the constructor, and return it from static int count().

</details>

<details>
<summary>Answers</summary>

**1. Instance counter**

```java
class Player {
    private static int created = 0;
    String name;

    Player(String name) {
        this.name = name;
        created++;
    }

    static int count() {
        return created;
    }
}

public class Main {
    public static void main(String[] args) {
        new Player("Ana");
        new Player("Ben");
        System.out.println(Player.count());
    }
}
```

</details>

## Quick quiz

1. How many copies of a static field exist?
   - A) One per object
   - B) One per method
   - C) One, shared by the class

2. Why can't a static method use `this`?
   - A) `this` is a reserved word
   - B) It isn't called on any particular object
   - C) It can, always

<details>
<summary>Quiz answers</summary>

1. **C) One, shared by the class**: Static members belong to the class, not to individual objects.
2. **B) It isn't called on any particular object**: There's no current object inside a static method.

</details>

---
Previous: [Lesson 19](19-encapsulation.md) · Next: [Lesson 21: Inheritance](21-inheritance.md)
