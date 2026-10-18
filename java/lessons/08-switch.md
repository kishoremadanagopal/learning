# Lesson 8: switch statements and expressions

**You'll learn:** arrow-form `switch`, switch expressions, `yield`, classic switch and fall-through.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/java/#switch)**: run every example and check your exercise answers.

## Key terms

- **switch:** chooses a branch by comparing one value against several cases.
- **Arrow case (`->`):** a modern case that runs only its own code, with no fall-through.
- **Switch expression:** a switch that produces a value.
- **yield:** returns a value from a block inside a switch expression.
- **Fall-through:** in a classic switch, running into the next case when `break` is missing.
- **default:** the branch used when no case matches.

When you compare one value against several fixed options, `switch` is clearer than a long `if/else if` chain.

## Modern switch (Java 14+)

The arrow form is the one to use in new code. Each `case` runs only its own code, so there's no fall-through, and several values can share a case:

```java
public class Main {
    public static void main(String[] args) {
        String day = "SAT";
        switch (day) {
            case "SAT", "SUN" -> System.out.println("Weekend!");
            case "FRI" -> System.out.println("Almost there");
            default -> System.out.println("Weekday");
        }
    }
}
```

## switch as an expression

A switch can also **produce a value**. Every possible input must be covered, which is why `default` is required here:

```java
public class Main {
    public static void main(String[] args) {
        int month = 2;
        int days = switch (month) {
            case 4, 6, 9, 11 -> 30;
            case 2 -> 28;
            default -> 31;
        };
        System.out.println(days);

        String size = "M";
        double price = switch (size) {
            case "S" -> 2.50;
            case "M" -> 3.00;
            case "L" -> {
                double base = 3.00;
                yield base + 0.75;      // yield returns a value from a block
            }
            default -> throw new IllegalArgumentException("Unknown size: " + size);
        };
        System.out.println(price);
    }
}
```

## Classic switch and fall-through

You'll see the older colon form in existing code. Its trap: without `break`, execution **falls through** into the next case.

```java
public class Main {
    public static void main(String[] args) {
        int level = 2;
        switch (level) {
            case 1:
                System.out.println("Bronze");
                break;
            case 2:
                System.out.println("Silver");
                // missing break: falls through!
            case 3:
                System.out.println("Gold");
                break;
            default:
                System.out.println("None");
        }
    }
}
```

That prints both "Silver" and "Gold". Prefer the arrow form, which never falls through.

switch works with `int`, `char`, `String` and enums (Part 4), but not with `double` or `boolean`.

## Common mistakes

- Forgetting `break` in a classic switch, which falls through into the next case.
- Leaving out `default` in a switch expression that doesn't cover every value.
- Trying to switch on a `double` or `boolean`, which isn't allowed.

## Exercises

### 1. Day type

Write `static String dayType(String day)` using a **switch expression**: return `"weekend"` for `"SAT"` and `"SUN"`, `"weekday"` for `"MON"` to `"FRI"`, and `"invalid"` for anything else.

Starter code:

```java
public class Main {
    static String dayType(String day) {
        return "weekday";
    }

    public static void main(String[] args) {
        System.out.println(dayType("SUN"));
    }
}
```

**In the sandbox:** exercise 12. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. return switch (day) { case "SAT", "SUN" -> "weekend"; case "MON", "TUE", "WED", "THU", "FRI" -> "weekday"; default -> "invalid"; };

</details>

<details>
<summary>Answers</summary>

**1. Day type**

```java
public class Main {
    static String dayType(String day) {
        return switch (day) {
            case "SAT", "SUN" -> "weekend";
            case "MON", "TUE", "WED", "THU", "FRI" -> "weekday";
            default -> "invalid";
        };
    }

    public static void main(String[] args) {
        System.out.println(dayType("SUN"));
    }
}
```

</details>

## Quick quiz

1. What happens in a classic `case` without `break`?
   - A) Execution continues into the next case
   - B) The switch ends anyway
   - C) A compile error

2. Why does a switch *expression* need a `default`?
   - A) It's optional
   - B) Only for strings
   - C) It must produce a value for every possible input

<details>
<summary>Quiz answers</summary>

1. **A) Execution continues into the next case**: That's fall-through, the classic switch's biggest trap.
2. **C) It must produce a value for every possible input**: An expression always has to return something, so every case must be covered.

</details>

---
Previous: [Lesson 7](07-conditions.md) · Next: [Lesson 9: while and do-while loops](09-while-loops.md)
