# Lesson 34: Modern Java features (10–17)

**You'll learn:** `var`, text blocks, pattern matching for `instanceof`, records, sealed classes.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/java/#modern-java-features)**: run every example and check your exercise answers.

## Key terms

- **Text block:** a multi-line string written with triple quotes.
- **Pattern matching:** testing a type and binding a variable in one step: `o instanceof String s`.
- **Sealed class / interface:** a type that lists exactly which classes may extend it.
- **permits:** the clause naming a sealed type's allowed subclasses.

Java has gained many features since version 8 that make code shorter and safer. You've met several already; this lesson collects them and adds the rest, all available in Java 17.

## var (Java 10)

Local variables can use `var` when the type is obvious from the right-hand side:

```java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        var names = new ArrayList<String>();       // ArrayList<String>
        names.add("Ada");
        var counts = new HashMap<String, Integer>();
        counts.put("Ada", 1);
        for (var entry : counts.entrySet()) {
            System.out.println(entry.getKey() + "=" + entry.getValue());
        }
        var total = 0L;                            // long
        System.out.println(names + " " + total);
    }
}
```

`var` doesn't make Java dynamically typed: the variable's type is still fixed. Use it when the type is obvious; spell it out when it helps the reader.

## Text blocks (Java 15)

Multi-line strings use triple quotes. Indentation common to all lines is removed automatically:

```java
public class Main {
    public static void main(String[] args) {
        String json = """
            {
              "name": "Ada",
              "languages": ["Java", "Python"]
            }
            """;
        System.out.print(json);

        String html = """
            <p>Hello, %s!</p>""".formatted("world");
        System.out.println(html);
    }
}
```

## Switch expressions (Java 14)

Covered in Part 2: `case X ->` with no fall-through, and `yield` to return a value from a block.

## Pattern matching for instanceof (Java 16)

```java
public class Main {
    static String describe(Object o) {
        if (o instanceof Integer i && i > 100) {
            return "big int " + i;
        } else if (o instanceof Integer i) {
            return "int " + i;
        } else if (o instanceof String s && !s.isEmpty()) {
            return "text of length " + s.length();
        }
        return "something else";
    }

    public static void main(String[] args) {
        System.out.println(describe(500));
        System.out.println(describe(7));
        System.out.println(describe("hi"));
        System.out.println(describe(3.5));
    }
}
```

The pattern variable (`i`, `s`) is only in scope where the check is known to be true.

## Records (Java 16)

Covered in Part 4: concise, immutable data classes with generated `equals`, `hashCode` and `toString`.

## Sealed classes (Java 17)

A **sealed** class or interface lists exactly which classes may extend it. That documents a closed set of possibilities and lets the compiler check you've handled them all:

```java
sealed interface Shape permits Circle, Square, Triangle { }

record Circle(double radius) implements Shape { }
record Square(double side) implements Shape { }
record Triangle(double base, double height) implements Shape { }

public class Main {
    static double area(Shape s) {
        if (s instanceof Circle c) {
            return Math.PI * c.radius() * c.radius();
        } else if (s instanceof Square sq) {
            return sq.side() * sq.side();
        } else if (s instanceof Triangle t) {
            return 0.5 * t.base() * t.height();
        }
        throw new IllegalStateException("unknown shape");
    }

    public static void main(String[] args) {
        Shape[] shapes = {new Circle(1), new Square(2), new Triangle(3, 4)};
        for (Shape s : shapes) {
            System.out.printf("%s -> %.2f%n", s, area(s));
        }
    }
}
```

Subclasses of a sealed type must be `final`, `sealed` or `non-sealed`; records are final automatically.

## Newer String and collection helpers

```java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        System.out.println("  hi  ".strip() + "|" + "   ".isBlank() + "|" + "ab".repeat(3));
        "line1\nline2\nline3".lines().map(String::toUpperCase).forEach(System.out::println);
        List<Integer> nums = List.of(1, 2, 3);
        Map<String, Integer> ages = Map.of("Ada", 36);
        Set<String> tags = Set.of("java");
        System.out.println(nums + " " + ages + " " + tags);
        System.out.println(List.copyOf(new ArrayList<>(nums)));
    }
}
```

## Looking ahead

Java keeps evolving: Java 21 finalised **pattern matching in switch** (`case Circle c ->`) and **virtual threads**. The sandbox runs Java 17, so this course sticks to Java 17 features, but everything here still works in newer versions.

## Common mistakes

- Using `var` where the type isn't obvious to a reader.
- Using a pattern variable outside the scope where the match is guaranteed.
- Forgetting that subclasses of a sealed type must be final, sealed or non-sealed.

## Exercises

### 1. Describe anything

Write `static String describe(Object o)` using pattern matching for `instanceof`:

- an `Integer` → `"int:"` followed by the number doubled, e.g. `"int:10"` for 5
- a non-empty `String` → `"string:"` followed by its length
- an empty `String` → `"empty"`
- a `List` → `"list of "` followed by its size
- anything else (including `null`) → `"unknown"`

Starter code:

```java
import java.util.*;

public class Main {
    static String describe(Object o) {
        return "unknown";
    }

    public static void main(String[] args) {
        System.out.println(describe(5) + " " + describe("hey") + " " + describe(List.of(1, 2)));
    }
}
```

### 2. Sealed results

Create a **sealed** interface `Result` that permits two records: `Ok(int value)` and `Err(String message)`. Then write `static String show(Result r)` in `Main` returning `"ok " + value` or `"error: " + message`.

Starter code:

```java
public class Main {
    public static void main(String[] args) {
        // System.out.println(show(new Ok(42)));
        // System.out.println(show(new Err("boom")));
    }
}
```

**In the sandbox:** exercises 50–51. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. if (o instanceof Integer i) { ... } else if (o instanceof String s) { ... } else if (o instanceof List<?> list) { ... }. instanceof is false for null, so null falls through to "unknown".
2. sealed interface Result permits Ok, Err { } then record Ok(int value) implements Result { } and the same for Err. In show, use instanceof patterns.

</details>

<details>
<summary>Answers</summary>

**1. Describe anything**

```java
import java.util.*;

public class Main {
    static String describe(Object o) {
        if (o instanceof Integer i) {
            return "int:" + i * 2;
        } else if (o instanceof String s) {
            return s.isEmpty() ? "empty" : "string:" + s.length();
        } else if (o instanceof List<?> list) {
            return "list of " + list.size();
        }
        return "unknown";
    }

    public static void main(String[] args) {
        System.out.println(describe(5) + " " + describe("hey") + " " + describe(List.of(1, 2)));
    }
}
```

**2. Sealed results**

```java
sealed interface Result permits Ok, Err { }

record Ok(int value) implements Result { }

record Err(String message) implements Result { }

public class Main {
    static String show(Result r) {
        if (r instanceof Ok ok) {
            return "ok " + ok.value();
        } else if (r instanceof Err err) {
            return "error: " + err.message();
        }
        throw new IllegalStateException();
    }

    public static void main(String[] args) {
        System.out.println(show(new Ok(42)));
        System.out.println(show(new Err("boom")));
    }
}
```

</details>

## Quick quiz

1. What does `var x = 5;` make x?
   - A) An int; var just lets the compiler infer it
   - B) An Object
   - C) A variable of any type

2. What does `sealed interface Shape permits Circle, Square` do?
   - A) Makes Shape final
   - B) Allows only Circle and Square to implement Shape
   - C) Hides Shape from other packages

3. In `if (o instanceof String s && s.length() > 3)`, where can `s` be used?
   - A) Only inside the parentheses
   - B) Wherever the instanceof test is known to be true
   - C) Everywhere in the method

<details>
<summary>Quiz answers</summary>

1. **A) An int; var just lets the compiler infer it**: The type is fixed at compile time.
2. **B) Allows only Circle and Square to implement Shape**: The set of implementations is closed and known to the compiler.
3. **B) Wherever the instanceof test is known to be true**: Pattern variables are scoped to where the match is guaranteed.

</details>

---
Previous: [Lesson 33](33-optional.md) · Next: [Lesson 35: Files and I/O](35-files-and-io.md)
