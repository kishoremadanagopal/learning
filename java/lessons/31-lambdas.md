# Lesson 31: Lambdas and functional interfaces

**You'll learn:** lambda syntax, functional interfaces, `Function`, `Predicate`, method references.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/java/#lambdas)**: run every example and check your exercise answers.

## Key terms

- **Lambda:** a short anonymous function: `(params) -> expression`.
- **Functional interface:** an interface with exactly one abstract method.
- **Function / Predicate / Consumer / Supplier:** built-in functional interfaces for common shapes.
- **Method reference:** shorthand for a lambda that calls one method, like `String::length`.
- **Effectively final:** a local variable that's never reassigned, so lambdas can use it.

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

## Functional interfaces

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

## Lambda syntax variations

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

## Method references

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

## Capturing variables

A lambda can use local variables from the surrounding method, but only if they're **effectively final** (never reassigned):

*This example raises an error on purpose.*

```java
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

## Your own functional interface

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

## Common mistakes

- Changing a captured local variable inside a lambda.
- Writing a block-bodied lambda without `return`.
- Using a lambda where the target type isn't a functional interface.

## Exercises

### 1. Apply twice

Write `static <T> T applyTwice(UnaryOperator<T> f, T value)` that applies `f` to `value`, then applies it again to the result. Then in `main`, print `applyTwice(x -> x + 3, 10)`.

Starter code:

```java
import java.util.function.*;

public class Main {
    static <T> T applyTwice(UnaryOperator<T> f, T value) {
        return value;
    }

    public static void main(String[] args) {
    }
}
```

### 2. Filter with a predicate

Write `static List<String> keep(List<String> items, Predicate<String> rule)` that returns a new list of the items for which `rule` is true.

Starter code:

```java
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

**In the sandbox:** exercises 45–46. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. return f.apply(f.apply(value));
2. Loop over items and add each one where rule.test(item) is true.

</details>

<details>
<summary>Answers</summary>

**1. Apply twice**

```java
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

**2. Filter with a predicate**

```java
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

</details>

## Quick quiz

1. What makes an interface a functional interface?
   - A) It has no methods
   - B) It has exactly one abstract method
   - C) It's annotated with @FunctionalInterface

2. Which method reference matches `s -> s.toUpperCase()`?
   - A) `String.toUpperCase()`
   - B) `String::toUpperCase`
   - C) `toUpperCase::String`

3. Which functional interface fits `n -> n > 0`?
   - A) Predicate<Integer>
   - B) Supplier<Integer>
   - C) Consumer<Integer>

<details>
<summary>Quiz answers</summary>

1. **B) It has exactly one abstract method**: The annotation only asks the compiler to check; the single abstract method is what counts.
2. **B) `String::toUpperCase`**: `Type::method` calls the method on the lambda's argument.
3. **A) Predicate<Integer>**: It takes a value and returns a boolean.

</details>

---
Previous: [Lesson 30](30-sorting-and-comparators.md) · Next: [Lesson 32: Streams](32-streams.md)
