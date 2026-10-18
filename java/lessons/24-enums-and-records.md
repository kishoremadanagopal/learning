# Lesson 24: Enums and records

**You'll learn:** enums, enum fields and methods, `values()`, records, compact constructors.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/java/#enums-and-records)**: run every example and check your exercise answers.

## Key terms

- **Enum:** a type with a fixed set of named constants.
- **values():** returns all the constants of an enum.
- **Record:** a concise, immutable data class with generated constructor, accessors, `equals`, `hashCode` and `toString`.
- **Accessor:** a record's method for reading a component, like `p.x()`.
- **Compact constructor:** a record constructor without a parameter list, used for validation.

### Enums

An **enum** is a type with a fixed set of named values. It's safer than using strings or ints for things like days, sizes or states: a typo becomes a compile error.

```java
enum Size {
    SMALL, MEDIUM, LARGE
}

public class Main {
    static double price(Size size) {
        return switch (size) {
            case SMALL -> 2.50;
            case MEDIUM -> 3.00;
            case LARGE -> 3.75;
        };
    }

    public static void main(String[] args) {
        Size s = Size.MEDIUM;
        System.out.println(s + " costs " + price(s));
        for (Size each : Size.values()) {
            System.out.println(each.ordinal() + " " + each.name().toLowerCase());
        }
        System.out.println(Size.valueOf("LARGE") == Size.LARGE);
    }
}
```

Notice the switch needs no `default`: the compiler knows all three values are covered.

## Enums with fields and methods

Enums are full classes, so each value can carry data:

```java
enum Planet {
    MERCURY(3.303e23, 2.4397e6),
    EARTH(5.976e24, 6.37814e6),
    JUPITER(1.9e27, 7.1492e7);

    private final double mass;      // kg
    private final double radius;    // m

    Planet(double mass, double radius) {
        this.mass = mass;
        this.radius = radius;
    }

    double surfaceGravity() {
        return 6.67300E-11 * mass / (radius * radius);
    }
}

public class Main {
    public static void main(String[] args) {
        for (Planet p : Planet.values()) {
            System.out.printf("%-8s %5.2f m/s²%n", p, p.surfaceGravity());
        }
    }
}
```

## Records

Many classes just hold data. Writing the constructor, getters, `equals`, `hashCode` and `toString` by hand is repetitive. A **record** (Java 16) generates all of them from one line:

```java
record Point(int x, int y) { }

public class Main {
    public static void main(String[] args) {
        Point a = new Point(3, 4);
        Point b = new Point(3, 4);
        System.out.println(a);
        System.out.println(a.x() + " " + a.y());       // accessor methods, not getX()
        System.out.println(a.equals(b));               // compares the data
        System.out.println(a == b);                    // still different objects
    }
}
```

Records are **immutable**: their fields are `final`. You can add methods, static factories and validation in a **compact constructor**:

```java
record Money(long cents, String currency) {
    Money {                                         // compact constructor
        if (cents < 0) {
            throw new IllegalArgumentException("Negative money");
        }
        currency = currency.toUpperCase();
    }

    Money plus(Money other) {
        if (!currency.equals(other.currency)) {
            throw new IllegalArgumentException("Different currencies");
        }
        return new Money(cents + other.cents, currency);
    }

    String formatted() {
        return String.format("%d.%02d %s", cents / 100, cents % 100, currency);
    }
}

public class Main {
    public static void main(String[] args) {
        Money a = new Money(1050, "usd");
        Money b = new Money(275, "USD");
        System.out.println(a.plus(b).formatted());
        System.out.println(a);
    }
}
```

Use a record whenever a class is "just data". Use a normal class when objects need to change or hide internal state.

## Common mistakes

- Using strings or ints where an enum would catch typos at compile time.
- Calling `getX()` on a record. The accessor is `x()`.
- Trying to change a record's field after creation.

## Exercises

### 1. Traffic light

Create an enum `Light` with values `RED`, `YELLOW` and `GREEN`, and a method `Light next()` returning the next state in the cycle RED → GREEN → YELLOW → RED. Also add a method `int seconds()` returning 30 for RED, 25 for GREEN and 5 for YELLOW.

Starter code:

```java
public class Main {
    public static void main(String[] args) {
        // Light l = Light.RED;
        // System.out.println(l.next() + " " + l.seconds());
    }
}
```

### 2. Student record

Create a record `Student(String name, int[] scores)` with a method `double average()`, and a compact constructor that throws `IllegalArgumentException` if `name` is blank.

Starter code:

```java
public class Main {
    public static void main(String[] args) {
        // Student s = new Student("Ana", new int[]{90, 80});
        // System.out.println(s.average());
    }
}
```

**In the sandbox:** exercises 34–35. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Inside an enum method, this is the current value, so you can switch (this) { case RED -> GREEN; ... }.
2. record Student(String name, int[] scores) { Student { if (name.isBlank()) throw new IllegalArgumentException("..."); } double average() { ... } }

</details>

<details>
<summary>Answers</summary>

**1. Traffic light**

```java
enum Light {
    RED, YELLOW, GREEN;

    Light next() {
        return switch (this) {
            case RED -> GREEN;
            case GREEN -> YELLOW;
            case YELLOW -> RED;
        };
    }

    int seconds() {
        return switch (this) {
            case RED -> 30;
            case GREEN -> 25;
            case YELLOW -> 5;
        };
    }
}

public class Main {
    public static void main(String[] args) {
        Light l = Light.RED;
        System.out.println(l.next() + " " + l.seconds());
    }
}
```

**2. Student record**

```java
record Student(String name, int[] scores) {
    Student {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Name is required");
        }
    }

    double average() {
        if (scores.length == 0) {
            return 0;
        }
        int sum = 0;
        for (int s : scores) {
            sum += s;
        }
        return (double) sum / scores.length;
    }
}

public class Main {
    public static void main(String[] args) {
        Student s = new Student("Ana", new int[]{90, 80});
        System.out.println(s.average());
    }
}
```

</details>

## Quick quiz

1. What does a record generate automatically?
   - A) Setters for every field
   - B) Only a constructor
   - C) Constructor, accessors, equals, hashCode and toString

2. For `record Point(int x, int y)`, how do you read x?
   - A) `p.x()`
   - B) `p.getX()`
   - C) `p.x` from outside the record

3. Why use an enum instead of strings like "SMALL"?
   - A) Typos become compile errors and the set of values is fixed
   - B) Strings can't be used in switch
   - C) Enums use less memory

<details>
<summary>Quiz answers</summary>

1. **C) Constructor, accessors, equals, hashCode and toString**: Records are concise, immutable data carriers.
2. **A) `p.x()`**: Record accessors are named after the components.
3. **A) Typos become compile errors and the set of values is fixed**: The compiler knows every valid value.

</details>

---
Previous: [Lesson 23](23-abstract-and-interfaces.md) · Next: [Lesson 25: StringBuilder and wrapper classes](25-stringbuilder-and-wrappers.md)
