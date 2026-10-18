# Lesson 30: Sorting with Comparable and Comparator

**You'll learn:** `Comparable`, `compareTo`, `Comparator.comparing`, `thenComparing`, `reversed`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/java/#sorting-and-comparators)**: run every example and check your exercise answers.

## Key terms

- **Comparable:** an interface giving a class its natural order through `compareTo`.
- **compareTo:** returns negative, zero or positive to order two objects.
- **Comparator:** a separate object that compares two values.
- **Key extractor:** a function that picks the value to sort by, like `Person::age`.
- **Stable sort:** a sort that keeps the original order of equal elements.

Sorting numbers and strings just works because those classes know how to compare themselves. For your own classes you decide the order.

## Comparable: a natural order

Implement `Comparable<T>` and its `compareTo` method, which returns a **negative** number if this object comes first, **zero** if equal, and **positive** if it comes after:

```java
import java.util.*;

class Version implements Comparable<Version> {
    final int major, minor;

    Version(int major, int minor) {
        this.major = major;
        this.minor = minor;
    }

    @Override
    public int compareTo(Version other) {
        if (major != other.major) {
            return Integer.compare(major, other.major);
        }
        return Integer.compare(minor, other.minor);
    }

    @Override
    public String toString() {
        return major + "." + minor;
    }
}

public class Main {
    public static void main(String[] args) {
        List<Version> versions = new ArrayList<>(List.of(new Version(1, 10), new Version(1, 2), new Version(0, 9)));
        Collections.sort(versions);
        System.out.println(versions);
        System.out.println(Collections.max(versions));
    }
}
```

Use `Integer.compare(a, b)` rather than `a - b`; subtraction can overflow for large values.

## Comparator: any order you want

A `Comparator` is a separate object that compares two values. The `Comparator.comparing` factory methods build them from **key extractors** (lambdas and method references, covered fully in Part 6):

```java
import java.util.*;

record Person(String name, int age, String city) { }

public class Main {
    public static void main(String[] args) {
        List<Person> people = new ArrayList<>(List.of(
            new Person("Cy", 35, "Lima"),
            new Person("Ana", 31, "Oslo"),
            new Person("Ben", 31, "Lima")
        ));

        people.sort(Comparator.comparing(Person::name));
        System.out.println(people.stream().map(Person::name).toList());

        people.sort(Comparator.comparingInt(Person::age).thenComparing(Person::name));
        System.out.println(people.stream().map(Person::name).toList());

        people.sort(Comparator.comparing(Person::city).reversed());
        System.out.println(people.stream().map(Person::city).toList());

        List<String> words = new ArrayList<>(List.of("banana", "Kiwi", "apple", "fig"));
        words.sort(String.CASE_INSENSITIVE_ORDER);
        System.out.println(words);
        words.sort(Comparator.comparingInt(String::length).thenComparing(Comparator.naturalOrder()));
        System.out.println(words);
    }
}
```

| Building block | Meaning |
|---|---|
| `Comparator.comparing(f)` | order by the key `f` returns |
| `comparingInt(f)` | the same for int keys, without boxing |
| `.thenComparing(g)` | tie-breaker |
| `.reversed()` | flip the order |
| `Comparator.naturalOrder()` | use `compareTo` |

## Sorting is stable

Java's object sorts are **stable**: elements that compare equal keep their original relative order. That's why sorting by a tie-breaker first and the main key second also works, though `thenComparing` states the intent more clearly.

## Common mistakes

- Writing `return a - b;` in `compareTo`, which can overflow.
- Trying to sort an unmodifiable `List.of(...)` in place.
- Forgetting `.reversed()` for highest-first order.

## Exercises

### 1. Leaderboard

Write `static List<String> leaderboard(List<Score> scores)` where `Score` is the record given. Return the names ordered by points **highest first**, breaking ties alphabetically by name.

Starter code:

```java
import java.util.*;

record Score(String name, int points) { }

public class Main {
    static List<String> leaderboard(List<Score> scores) {
        List<String> names = new ArrayList<>();
        for (Score s : scores) {
            names.add(s.name());
        }
        return names;
    }

    public static void main(String[] args) {
        System.out.println(leaderboard(List.of(new Score("Cy", 50), new Score("Ana", 70), new Score("Ben", 50))));
    }
}
```

**In the sandbox:** exercise 44. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Copy the list, then sort with Comparator.comparingInt(Score::points).reversed().thenComparing(Score::name). Copying matters because List.of(...) can't be sorted in place.

</details>

<details>
<summary>Answers</summary>

**1. Leaderboard**

```java
import java.util.*;

record Score(String name, int points) { }

public class Main {
    static List<String> leaderboard(List<Score> scores) {
        List<Score> sorted = new ArrayList<>(scores);
        sorted.sort(Comparator.comparingInt(Score::points).reversed().thenComparing(Score::name));
        List<String> names = new ArrayList<>();
        for (Score s : sorted) {
            names.add(s.name());
        }
        return names;
    }

    public static void main(String[] args) {
        System.out.println(leaderboard(List.of(new Score("Cy", 50), new Score("Ana", 70), new Score("Ben", 50))));
    }
}
```

</details>

## Quick quiz

1. What should `a.compareTo(b)` return when a comes before b?
   - A) A positive number
   - B) Zero
   - C) A negative number

2. How do you sort people by age, then by name for equal ages?
   - A) `Comparator.comparing(Person::name).thenComparing(Person::age)`
   - B) Sort twice by age
   - C) `Comparator.comparingInt(Person::age).thenComparing(Person::name)`

3. Why use `Integer.compare(a, b)` instead of `a - b` in compareTo?
   - A) It's required by the interface
   - B) Subtraction can overflow for large values
   - C) `a - b` doesn't compile

<details>
<summary>Quiz answers</summary>

1. **C) A negative number**: Negative: a first. Zero: equal. Positive: b first.
2. **C) `Comparator.comparingInt(Person::age).thenComparing(Person::name)`**: `thenComparing` adds a tie-breaker.
3. **B) Subtraction can overflow for large values**: With large positive and negative ints, `a - b` can wrap around and flip the sign.

</details>

---
Previous: [Lesson 29](29-sets-and-maps.md) · Next: [Lesson 31: Lambdas and functional interfaces](31-lambdas.md)
