@@@ part
id: 6
title: Modern Java
level: Advanced
blurb: Write concise, expressive code with lambdas, method references and streams, handle missing values with Optional, and use the features added in Java 10 to 17.

@@@ lesson
id: lambdas
title: Lambdas and functional interfaces
minutes: 15
summary: Pass behaviour as a value with lambdas and method references, and use Java's built-in functional interfaces.
---
A **lambda** is a short anonymous function you can pass around like a value. It's written `(parameters) -> expression`:

```java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<String> words = new ArrayList<>(List.of("banana", "Kiwi", "apple", "fig"));
        words.sort((a, b) -> a.length() - b.length());
        System.out.println(words);

        words.removeIf(w -> w.length() < 4);
        System.out.println(words);

        words.forEach(w -> System.out.println("- " + w));
    }
}
```

### Functional interfaces

A lambda needs a target type: a **functional interface**, meaning an interface with exactly **one** abstract method. The lambda becomes the implementation of that method. Java provides the common shapes in `java.util.function`:

| Interface | Method | Takes → returns | Example |
|---|---|---|---|
| `Function<T, R>` | `apply` | T → R | `s -> s.length()` |
| `Predicate<T>` | `test` | T → boolean | `n -> n > 0` |
| `Consumer<T>` | `accept` | T → nothing | `s -> System.out.println(s)` |
| `Supplier<T>` | `get` | nothing → T | `() -> new ArrayList<>()` |
| `BiFunction<T, U, R>` | `apply` | T, U → R | `(a, b) -> a + b` |
| `UnaryOperator<T>` | `apply` | T → T | `s -> s.trim()` |

```java
import java.util.function.*;

public class Main {
    public static void main(String[] args) {
        Function<String, Integer> length = s -> s.length();
        Predicate<Integer> isEven = n -> n % 2 == 0;
        Supplier<String> greeting = () -> "hello";
        BiFunction<Integer, Integer, Integer> add = (a, b) -> a + b;
        UnaryOperator<String> shout = s -> s.toUpperCase() + "!";

        System.out.println(length.apply("lambda"));
        System.out.println(isEven.test(4) + " " + isEven.negate().test(4));
        System.out.println(greeting.get() + " " + add.apply(2, 3));
        System.out.println(shout.andThen(s -> s + "!!").apply("hi"));
    }
}
```

### Lambda syntax variations

```java
import java.util.function.*;

public class Main {
    public static void main(String[] args) {
        Function<Integer, Integer> a = x -> x * 2;              // one parameter: no parentheses needed
        BiFunction<Integer, Integer, Integer> b = (x, y) -> x * y;
        Function<Integer, String> c = x -> {                    // a block body needs return
            if (x < 0) {
                return "negative";
            }
            return "non-negative";
        };
        Runnable r = () -> System.out.println("no parameters");
        System.out.println(a.apply(4) + " " + b.apply(3, 5) + " " + c.apply(-1));
        r.run();
    }
}
```

### Method references

When a lambda only calls an existing method, a **method reference** says the same thing more clearly:

| Lambda | Method reference |
|---|---|
| `s -> s.toUpperCase()` | `String::toUpperCase` |
| `s -> System.out.println(s)` | `System.out::println` |
| `s -> Integer.parseInt(s)` | `Integer::parseInt` |
| `() -> new ArrayList<>()` | `ArrayList::new` |

```java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<String> raw = List.of("3", "10", "7");
        List<Integer> nums = new ArrayList<>();
        raw.forEach(s -> nums.add(Integer.parseInt(s)));
        nums.sort(Integer::compare);
        nums.forEach(System.out::println);
    }
}
```

### Capturing variables

A lambda can use local variables from the surrounding method, but only if they're **effectively final** (never reassigned):

```java error
import java.util.*;

public class Main {
    public static void main(String[] args) {
        int total = 0;
        List.of(1, 2, 3).forEach(n -> total += n);     // compile error: total is reassigned
        System.out.println(total);
    }
}
```

The fix is usually a stream (next lesson) or a regular loop.

### Your own functional interface

```java
@FunctionalInterface
interface Discount {
    double apply(double price);
}

public class Main {
    static double checkout(double price, Discount discount) {
        return discount.apply(price);
    }

    public static void main(String[] args) {
        System.out.println(checkout(100, p -> p * 0.9));
        System.out.println(checkout(100, p -> Math.max(0, p - 15)));
    }
}
```

`@FunctionalInterface` makes the compiler check that the interface really has exactly one abstract method.

:::exercise Apply twice
Write `static <T> T applyTwice(UnaryOperator<T> f, T value)` that applies `f` to `value`, then applies it again to the result. Then in `main`, print `applyTwice(x -> x + 3, 10)`.
```java starter
import java.util.function.*;

public class Main {
    static <T> T applyTwice(UnaryOperator<T> f, T value) {
        return value;
    }

    public static void main(String[] args) {
    }
}
```
```java check
UnaryOperator<Integer> plus3 = x -> x + 3;
eq(16, call("applyTwice", plus3, 10), "applyTwice(x -> x + 3, 10)");
UnaryOperator<String> bang = s -> s + "!";
eq("hi!!", call("applyTwice", bang, "hi"), "applyTwice(s -> s + \"!\", \"hi\")");
check(output().strip().equals("16"), "main should print 16");
```
```java solution
import java.util.function.*;

public class Main {
    static <T> T applyTwice(UnaryOperator<T> f, T value) {
        return f.apply(f.apply(value));
    }

    public static void main(String[] args) {
        System.out.println(applyTwice(x -> x + 3, 10));
    }
}
```
hint: return f.apply(f.apply(value));
:::

:::exercise Filter with a predicate
Write `static List<String> keep(List<String> items, Predicate<String> rule)` that returns a new list of the items for which `rule` is true.
```java starter
import java.util.*;
import java.util.function.*;

public class Main {
    static List<String> keep(List<String> items, Predicate<String> rule) {
        return new ArrayList<>();
    }

    public static void main(String[] args) {
        System.out.println(keep(List.of("apple", "fig", "kiwi"), s -> s.length() > 3));
    }
}
```
```java check
Predicate<String> longer = s -> s.length() > 3;
eq(List.of("apple", "kiwi"), call("keep", List.of("apple", "fig", "kiwi"), longer), "keep(..., s -> s.length() > 3)");
Predicate<String> startsK = s -> s.startsWith("k");
eq(List.of("kiwi"), call("keep", List.of("apple", "fig", "kiwi"), startsK), "keep(..., s -> s.startsWith(\"k\"))");
```
```java solution
import java.util.*;
import java.util.function.*;

public class Main {
    static List<String> keep(List<String> items, Predicate<String> rule) {
        List<String> result = new ArrayList<>();
        for (String item : items) {
            if (rule.test(item)) {
                result.add(item);
            }
        }
        return result;
    }

    public static void main(String[] args) {
        System.out.println(keep(List.of("apple", "fig", "kiwi"), s -> s.length() > 3));
    }
}
```
hint: Loop over items and add each one where rule.test(item) is true.
:::

:::quiz
? What makes an interface a functional interface?
+ It has exactly one abstract method
- It's annotated with @FunctionalInterface
- It has no methods
= The annotation only asks the compiler to check; the single abstract method is what counts.

? Which method reference matches `s -> s.toUpperCase()`?
+ `String::toUpperCase`
- `String.toUpperCase()`
- `toUpperCase::String`
= `Type::method` calls the method on the lambda's argument.

? Which functional interface fits `n -> n > 0`?
+ Predicate<Integer>
- Supplier<Integer>
- Consumer<Integer>
= It takes a value and returns a boolean.
:::

@@@ lesson
id: streams
title: Streams
minutes: 18
summary: Process collections declaratively with filter, map, reduce and collect, and group data with Collectors.
---
A **stream** is a pipeline that processes a sequence of elements: start from a source, apply **intermediate** operations, and finish with a **terminal** operation.

```java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<Integer> nums = List.of(5, 12, 7, 20, 3, 18);

        List<Integer> bigDoubled = nums.stream()
            .filter(n -> n > 6)          // keep some elements
            .map(n -> n * 2)             // transform each one
            .sorted()                    // order them
            .toList();                   // terminal: collect into a list
        System.out.println(bigDoubled);

        int sum = nums.stream().mapToInt(Integer::intValue).sum();
        long count = nums.stream().filter(n -> n % 2 == 0).count();
        System.out.println(sum + " " + count);
    }
}
```

Compare the loop version: a new list, a `for`, an `if`, an `add`, then a sort. The stream says **what** you want, not **how** to step through it.

![A stream pipeline: 5, 12, 7, 20, 3, 18 is filtered to values over 6, doubled, sorted to 14, 24, 36, 40, then collected into a List](figures/stream-pipeline.svg)

### Laziness

Intermediate operations don't run until a terminal operation asks for results, and then each element flows through the whole pipeline. A stream can be used only **once**.

### Common operations

| Intermediate | Does |
|---|---|
| `filter(pred)` | keeps matching elements |
| `map(f)` | transforms each element |
| `sorted()` / `sorted(cmp)` | orders them |
| `distinct()` | removes duplicates |
| `limit(n)` / `skip(n)` | takes / skips elements |
| `flatMap(f)` | flattens nested streams |

| Terminal | Returns |
|---|---|
| `toList()`, `collect(...)` | a collection |
| `count()`, `sum()`, `average()` | numbers (sum/average on IntStream etc.) |
| `min(cmp)`, `max(cmp)`, `findFirst()` | an `Optional` |
| `anyMatch`, `allMatch`, `noneMatch` | boolean |
| `forEach(action)` | nothing |
| `reduce(identity, op)` | one combined value |

```java
import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        List<String> words = List.of("stream", "lambda", "java", "map", "filter", "java");
        System.out.println(words.stream().distinct().map(String::toUpperCase).toList());
        System.out.println(words.stream().anyMatch(w -> w.startsWith("j")));
        System.out.println(words.stream().max(Comparator.comparingInt(String::length)).get());
        System.out.println(words.stream().map(String::length).reduce(0, Integer::sum));
        System.out.println(String.join(",", words.stream().sorted().limit(3).toList()));

        System.out.println(IntStream.rangeClosed(1, 5).map(i -> i * i).boxed().toList());
        System.out.println(Stream.of("a,b", "c").flatMap(s -> Arrays.stream(s.split(","))).toList());
        System.out.println(IntStream.of(3, 8, 1).summaryStatistics());
    }
}
```

### Collectors: grouping and joining

`collect(Collectors...)` gathers results into maps, strings and more:

```java
import java.util.*;
import java.util.stream.*;

record Employee(String name, String dept, double salary) { }

public class Main {
    public static void main(String[] args) {
        List<Employee> staff = List.of(
            new Employee("Ana", "Eng", 95000),
            new Employee("Ben", "Sales", 62000),
            new Employee("Cy", "Eng", 88000),
            new Employee("Dee", "Sales", 70000)
        );

        Map<String, List<String>> namesByDept = staff.stream()
            .collect(Collectors.groupingBy(Employee::dept, TreeMap::new,
                     Collectors.mapping(Employee::name, Collectors.toList())));
        System.out.println(namesByDept);

        Map<String, Double> avgByDept = staff.stream()
            .collect(Collectors.groupingBy(Employee::dept, TreeMap::new,
                     Collectors.averagingDouble(Employee::salary)));
        System.out.println(avgByDept);

        String names = staff.stream().map(Employee::name).collect(Collectors.joining(", ", "[", "]"));
        System.out.println(names);

        Map<Boolean, Long> highEarners = staff.stream()
            .collect(Collectors.partitioningBy(e -> e.salary() > 80000, Collectors.counting()));
        System.out.println(highEarners);
    }
}
```

### Streams or loops?

Streams are great for transforming and summarising collections. A plain loop is often clearer when you need to break early, update several variables, or handle checked exceptions. Use whichever reads better.

:::exercise Stream practice
Using streams, write:

- `static List<String> shortUpper(List<String> words)`: words with at most 4 letters, uppercased, in their original order.
- `static int sumOfSquaresOfOdds(List<Integer> nums)`: the sum of the squares of the odd numbers.
```java starter
import java.util.*;
import java.util.stream.*;

public class Main {
    static List<String> shortUpper(List<String> words) {
        return words;
    }

    static int sumOfSquaresOfOdds(List<Integer> nums) {
        return 0;
    }

    public static void main(String[] args) {
        System.out.println(shortUpper(List.of("java", "stream", "map", "lambda")));
        System.out.println(sumOfSquaresOfOdds(List.of(1, 2, 3, 4, 5)));
    }
}
```
```java check
eq(List.of("JAVA", "MAP"), call("shortUpper", List.of("java", "stream", "map", "lambda")), "shortUpper([java, stream, map, lambda])");
eq(List.of(), call("shortUpper", List.of("streams")), "shortUpper([streams])");
eq(35, call("sumOfSquaresOfOdds", List.of(1, 2, 3, 4, 5)), "sumOfSquaresOfOdds([1, 2, 3, 4, 5])");
eq(0, call("sumOfSquaresOfOdds", List.of(2, 4)), "sumOfSquaresOfOdds([2, 4])");
sourceHas(".stream()", "Use streams.");
```
```java solution
import java.util.*;
import java.util.stream.*;

public class Main {
    static List<String> shortUpper(List<String> words) {
        return words.stream()
            .filter(w -> w.length() <= 4)
            .map(String::toUpperCase)
            .toList();
    }

    static int sumOfSquaresOfOdds(List<Integer> nums) {
        return nums.stream()
            .filter(n -> n % 2 != 0)
            .mapToInt(n -> n * n)
            .sum();
    }

    public static void main(String[] args) {
        System.out.println(shortUpper(List.of("java", "stream", "map", "lambda")));
        System.out.println(sumOfSquaresOfOdds(List.of(1, 2, 3, 4, 5)));
    }
}
```
hint: words.stream().filter(...).map(String::toUpperCase).toList(); and nums.stream().filter(n -> n % 2 != 0).mapToInt(n -> n * n).sum();
:::

:::exercise Group by length
Write `static Map<Integer, List<String>> byLength(List<String> words)` that groups words by their length, using `Collectors.groupingBy` with a `TreeMap` so the keys are sorted. Words keep their original order inside each group.
```java starter
import java.util.*;
import java.util.stream.*;

public class Main {
    static Map<Integer, List<String>> byLength(List<String> words) {
        return new TreeMap<>();
    }

    public static void main(String[] args) {
        System.out.println(byLength(List.of("hi", "cat", "ox", "dog", "bird")));
    }
}
```
```java check
Object r = call("byLength", List.of("hi", "cat", "ox", "dog", "bird"));
check(r instanceof TreeMap, "Return a TreeMap (pass TreeMap::new to groupingBy).");
eq("{2=[hi, ox], 3=[cat, dog], 4=[bird]}", r.toString(), "byLength([hi, cat, ox, dog, bird])");
sourceHas("groupingBy", "Use Collectors.groupingBy.");
```
```java solution
import java.util.*;
import java.util.stream.*;

public class Main {
    static Map<Integer, List<String>> byLength(List<String> words) {
        return words.stream()
            .collect(Collectors.groupingBy(String::length, TreeMap::new, Collectors.toList()));
    }

    public static void main(String[] args) {
        System.out.println(byLength(List.of("hi", "cat", "ox", "dog", "bird")));
    }
}
```
hint: words.stream().collect(Collectors.groupingBy(String::length, TreeMap::new, Collectors.toList()))
:::

:::quiz
? When do a stream's intermediate operations run?
+ Only when a terminal operation is called
- Immediately, one after another
- When the stream is created
= Streams are lazy; `toList()`, `count()` and friends trigger the work.

? What does `.map(String::length)` do to a stream of strings?
+ Turns it into a stream of their lengths
- Filters out empty strings
- Sorts by length
= `map` transforms each element.

? Can you reuse a stream after a terminal operation?
- Yes
+ No, you get an IllegalStateException
= Create a new stream from the source each time.
:::

@@@ lesson
id: optional
title: Optional and null safety
minutes: 10
summary: Represent "maybe a value" explicitly with Optional instead of returning null.
---
Returning `null` for "nothing found" is the source of countless `NullPointerException`s, because callers forget to check. **`Optional<T>`** makes "might be empty" part of the type, so the caller can't ignore it.

```java
import java.util.*;

public class Main {
    static Optional<String> findUser(int id) {
        Map<Integer, String> users = Map.of(1, "ada", 2, "alan");
        return Optional.ofNullable(users.get(id));
    }

    public static void main(String[] args) {
        Optional<String> found = findUser(1);
        Optional<String> missing = findUser(42);

        System.out.println(found.isPresent() + " " + missing.isEmpty());
        System.out.println(found.orElse("guest"));
        System.out.println(missing.orElse("guest"));
        System.out.println(found.map(String::toUpperCase).orElse("?"));
        found.ifPresent(name -> System.out.println("Hello, " + name));
        System.out.println(missing.map(String::length).orElseGet(() -> -1));
    }
}
```

### Creating and using Optionals

| Method | Meaning |
|---|---|
| `Optional.of(x)` | a value that must not be null |
| `Optional.ofNullable(x)` | empty if x is null |
| `Optional.empty()` | explicitly nothing |
| `orElse(fallback)` | the value, or the fallback |
| `orElseGet(supplier)` | the value, or compute a fallback |
| `orElseThrow()` | the value, or throw `NoSuchElementException` |
| `map(f)`, `filter(pred)` | transform or keep it, staying an Optional |
| `ifPresent(action)` | run code only if there's a value |

Avoid `get()` without checking first; it throws if the Optional is empty, which brings back the very problem Optional solves.

### Streams return Optionals

`min`, `max` and `findFirst` return `Optional` because the stream might be empty:

```java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<Integer> nums = List.of(4, 9, 2);
        System.out.println(nums.stream().max(Integer::compare).orElse(0));
        System.out.println(List.<Integer>of().stream().max(Integer::compare).orElse(0));
        System.out.println(nums.stream().filter(n -> n > 100).findFirst().isPresent());
    }
}
```

### Where to use it

- **Do** use `Optional` as a **return type** for methods that may have no result.
- **Don't** use it for fields, method parameters or collections; an empty list already means "nothing".

### Other null-safety tools

```java
import java.util.Objects;

public class Main {
    static String describe(String name) {
        Objects.requireNonNull(name, "name must not be null");     // fail fast with a clear message
        return "Name: " + name;
    }

    public static void main(String[] args) {
        String maybe = null;
        System.out.println(Objects.requireNonNullElse(maybe, "unknown"));
        System.out.println(Objects.equals(maybe, null));             // null-safe equals
        System.out.println(describe("Ada"));
    }
}
```

:::exercise Find the first long word
Write `static Optional<String> firstLongWord(List<String> words, int minLength)` returning the first word with at least `minLength` letters, or an empty Optional. Then write `static String describeFirstLong(List<String> words)` that returns `"found: WORD"` (uppercased) for `minLength` 6, or `"none"`, using `map` and `orElse`.
```java starter
import java.util.*;

public class Main {
    static Optional<String> firstLongWord(List<String> words, int minLength) {
        return Optional.empty();
    }

    static String describeFirstLong(List<String> words) {
        return "none";
    }

    public static void main(String[] args) {
        System.out.println(describeFirstLong(List.of("java", "stream", "lambda")));
    }
}
```
```java check
eq(Optional.of("stream"), call("firstLongWord", List.of("java", "stream", "lambda"), 6), "firstLongWord([java, stream, lambda], 6)");
eq(Optional.empty(), call("firstLongWord", List.of("a", "bb"), 3), "firstLongWord([a, bb], 3)");
eq("found: STREAM", call("describeFirstLong", List.of("java", "stream", "lambda")), "describeFirstLong([java, stream, lambda])");
eq("none", call("describeFirstLong", List.of("map", "set")), "describeFirstLong([map, set])");
```
```java solution
import java.util.*;

public class Main {
    static Optional<String> firstLongWord(List<String> words, int minLength) {
        return words.stream().filter(w -> w.length() >= minLength).findFirst();
    }

    static String describeFirstLong(List<String> words) {
        return firstLongWord(words, 6)
            .map(w -> "found: " + w.toUpperCase())
            .orElse("none");
    }

    public static void main(String[] args) {
        System.out.println(describeFirstLong(List.of("java", "stream", "lambda")));
    }
}
```
hint: words.stream().filter(w -> w.length() >= minLength).findFirst() returns exactly the Optional you need. Then .map(...).orElse("none").
:::

:::quiz
? What's the best use of `Optional`?
+ As the return type of a method that might not find a result
- As the type of every field
- Instead of empty lists
= It tells callers, in the type, that the result may be missing.

? What does `Optional.ofNullable(null).orElse("x")` return?
+ "x"
- null
- It throws
= An empty Optional falls back to the given value.
:::

@@@ lesson
id: modern-java-features
title: Modern Java features (10–17)
minutes: 15
summary: Use var, text blocks, switch expressions, records, pattern matching for instanceof, and sealed classes.
---
Java has gained many features since version 8 that make code shorter and safer. You've met several already; this lesson collects them and adds the rest, all available in Java 17.

### var (Java 10)

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

### Text blocks (Java 15)

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

### Switch expressions (Java 14)

Covered in Part 2: `case X ->` with no fall-through, and `yield` to return a value from a block.

### Pattern matching for instanceof (Java 16)

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

### Records (Java 16)

Covered in Part 4: concise, immutable data classes with generated `equals`, `hashCode` and `toString`.

### Sealed classes (Java 17)

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

### Newer String and collection helpers

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

### Looking ahead

Java keeps evolving: Java 21 finalised **pattern matching in switch** (`case Circle c ->`) and **virtual threads**. The sandbox runs Java 17, so this course sticks to Java 17 features, but everything here still works in newer versions.

:::exercise Describe anything
Write `static String describe(Object o)` using pattern matching for `instanceof`:

- an `Integer` → `"int:"` followed by the number doubled, e.g. `"int:10"` for 5
- a non-empty `String` → `"string:"` followed by its length
- an empty `String` → `"empty"`
- a `List` → `"list of "` followed by its size
- anything else (including `null`) → `"unknown"`
```java starter
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
```java check
eq("int:10", call("describe", 5), "describe(5)");
eq("string:3", call("describe", "hey"), "describe(\"hey\")");
eq("empty", call("describe", ""), "describe(\"\")");
eq("list of 2", call("describe", List.of(1, 2)), "describe(List.of(1, 2))");
eq("unknown", call("describe", 3.5), "describe(3.5)");
eq("unknown", call("describe", (Object) null), "describe(null)");
sourceHas("instanceof", "Use instanceof pattern matching.");
```
```java solution
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
hint: if (o instanceof Integer i) { ... } else if (o instanceof String s) { ... } else if (o instanceof List<?> list) { ... }. instanceof is false for null, so null falls through to "unknown".
:::

:::exercise Sealed results
Create a **sealed** interface `Result` that permits two records: `Ok(int value)` and `Err(String message)`. Then write `static String show(Result r)` in `Main` returning `"ok " + value` or `"error: " + message`.
```java starter
public class Main {
    public static void main(String[] args) {
        // System.out.println(show(new Ok(42)));
        // System.out.println(show(new Err("boom")));
    }
}
```
```java check
check(cls("Result").isSealed(), "Result should be a sealed interface.");
check(cls("Ok").isRecord() && cls("Err").isRecord(), "Ok and Err should be records.");
eq("ok 42", call("show", make("Ok", 42)), "show(new Ok(42))");
eq("error: boom", call("show", make("Err", "boom")), "show(new Err(\"boom\"))");
```
```java solution
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
hint: sealed interface Result permits Ok, Err { } then record Ok(int value) implements Result { } and the same for Err. In show, use instanceof patterns.
:::

:::quiz
? What does `var x = 5;` make x?
+ An int; var just lets the compiler infer it
- A variable of any type
- An Object
= The type is fixed at compile time.

? What does `sealed interface Shape permits Circle, Square` do?
+ Allows only Circle and Square to implement Shape
- Makes Shape final
- Hides Shape from other packages
= The set of implementations is closed and known to the compiler.

? In `if (o instanceof String s && s.length() > 3)`, where can `s` be used?
+ Wherever the instanceof test is known to be true
- Everywhere in the method
- Only inside the parentheses
= Pattern variables are scoped to where the match is guaranteed.
:::
