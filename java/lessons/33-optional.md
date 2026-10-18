# Lesson 33: Optional and null safety

**You'll learn:** `Optional`, `orElse`, `map`, `ifPresent`, null-safety helpers.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/java/#optional)**: run every example and check your exercise answers.

## Key terms

- **Optional:** a container that holds a value or is empty.
- **Optional.ofNullable:** wraps a value that might be null.
- **orElse / orElseGet / orElseThrow:** get the value or fall back.
- **Objects.requireNonNull:** fails fast with a clear message when a value is null.

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

## Creating and using Optionals

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

## Streams return Optionals

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

## Where to use it

- **Do** use `Optional` as a **return type** for methods that may have no result.
- **Don't** use it for fields, method parameters or collections; an empty list already means "nothing".

## Other null-safety tools

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

## Common mistakes

- Calling `get()` without checking that a value is present.
- Using Optional for fields or parameters.
- Returning `null` from a method that returns Optional.

## Exercises

### 1. Find the first long word

Write `static Optional<String> firstLongWord(List<String> words, int minLength)` returning the first word with at least `minLength` letters, or an empty Optional. Then write `static String describeFirstLong(List<String> words)` that returns `"found: WORD"` (uppercased) for `minLength` 6, or `"none"`, using `map` and `orElse`.

Starter code:

```java
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

**In the sandbox:** exercise 49. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. words.stream().filter(w -> w.length() >= minLength).findFirst() returns exactly the Optional you need. Then .map(...).orElse("none").

</details>

<details>
<summary>Answers</summary>

**1. Find the first long word**

```java
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

</details>

## Quick quiz

1. What's the best use of `Optional`?
   - A) As the type of every field
   - B) Instead of empty lists
   - C) As the return type of a method that might not find a result

2. What does `Optional.ofNullable(null).orElse("x")` return?
   - A) null
   - B) "x"
   - C) It throws

<details>
<summary>Quiz answers</summary>

1. **C) As the return type of a method that might not find a result**: It tells callers, in the type, that the result may be missing.
2. **B) "x"**: An empty Optional falls back to the given value.

</details>

---
Previous: [Lesson 32](32-streams.md) · Next: [Lesson 34: Modern Java features (10–17)](34-modern-java-features.md)
