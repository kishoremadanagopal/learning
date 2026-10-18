# Lesson 7: Booleans and if statements

**You'll learn:** comparisons, `&&` `||` `!`, `if` / `else if` / `else`, the ternary operator.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/java/#conditions)**: run every example and check your exercise answers.

## Key terms

- **Boolean expression:** an expression that is `true` or `false`.
- **Comparison operators:** `==`, `!=`, `<`, `>`, `<=`, `>=`.
- **Logical operators:** `&&` (and), `||` (or), `!` (not).
- **Short-circuit evaluation:** `&&` and `||` skip the right side when the left side decides the result.
- **if / else if / else:** run the first branch whose condition is true.
- **Ternary operator:** `condition ? a : b` chooses between two values.

A **boolean** expression is either `true` or `false`. Comparison operators produce booleans:

| Operator | Meaning |
|---|---|
| `==` | equal (for primitives) |
| `!=` | not equal |
| `<` `>` `<=` `>=` | less / greater (or equal) |

```java
public class Main {
    public static void main(String[] args) {
        int age = 20;
        System.out.println(age >= 18);
        System.out.println(age == 21);
        System.out.println(age != 21);
    }
}
```

Remember from the Strings lesson: compare **strings** with `equals`, not `==`.

## if, else if, else

```java
public class Main {
    public static void main(String[] args) {
        int score = 82;
        String grade;
        if (score >= 90) {
            grade = "A";
        } else if (score >= 80) {
            grade = "B";
        } else if (score >= 70) {
            grade = "C";
        } else {
            grade = "F";
        }
        System.out.println("Score " + score + " gets " + grade);
    }
}
```

- The condition goes in **parentheses**, and the code to run goes in **braces**.
- Java checks the branches from top to bottom and runs **only the first** that is true. That's why `score >= 90` must come before `score >= 80`.
- The `else` branch is optional and runs when nothing else matched.

Braces are technically optional for a single statement, but always use them. Leaving them out is a classic source of bugs when someone later adds a second line.

## Combining conditions

- `a && b` (and) is true only if **both** are true.
- `a || b` (or) is true if **at least one** is true.
- `!a` (not) flips true and false.

```java
public class Main {
    public static void main(String[] args) {
        boolean hasTicket = true;
        boolean isVip = false;
        int age = 16;

        if (hasTicket && age >= 18) {
            System.out.println("Welcome in");
        } else if (hasTicket || isVip) {
            System.out.println("Welcome to the family area");
        }
        System.out.println(!isVip);
    }
}
```

`&&` and `||` **short-circuit**: if the left side already decides the answer, the right side isn't evaluated. That makes checks like `name != null && name.length() > 3` safe.

## The ternary operator

For choosing between two values, `condition ? valueIfTrue : valueIfFalse` is a compact form:

```java
public class Main {
    public static void main(String[] args) {
        int n = 7;
        String kind = (n % 2 == 0) ? "even" : "odd";
        System.out.println(n + " is " + kind);
    }
}
```

## Common mistakes

- Writing `=` (assignment) instead of `==` (comparison) in a condition.
- Putting a broad condition before a narrow one, so the narrow branch never runs.
- Leaving out braces and later adding a second line that isn't inside the if.
- Comparing strings with `==` in a condition.

## Exercises

### 1. Ticket price

Write `static int ticketPrice(int age)` returning `0` for under 3, `8` for ages 3 to 12, `15` for 13 to 64, and `10` for 65 and over.

Starter code:

```java
public class Main {
    static int ticketPrice(int age) {
        return 15;
    }

    public static void main(String[] args) {
        System.out.println(ticketPrice(10));
    }
}
```

### 2. Leap year

Write `static boolean isLeapYear(int year)`. A year is a leap year if it's divisible by 4, **except** years divisible by 100, which are leap years only if they're also divisible by 400.

Starter code:

```java
public class Main {
    static boolean isLeapYear(int year) {
        return year % 4 == 0;
    }

    public static void main(String[] args) {
        System.out.println(isLeapYear(2024));
    }
}
```

**In the sandbox:** exercises 10–11. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Check from youngest to oldest: if (age < 3) ... else if (age <= 12) ... else if (age <= 64) ... else ...
2. return year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);

</details>

<details>
<summary>Answers</summary>

**1. Ticket price**

```java
public class Main {
    static int ticketPrice(int age) {
        if (age < 3) {
            return 0;
        } else if (age <= 12) {
            return 8;
        } else if (age <= 64) {
            return 15;
        } else {
            return 10;
        }
    }

    public static void main(String[] args) {
        System.out.println(ticketPrice(10));
    }
}
```

**2. Leap year**

```java
public class Main {
    static boolean isLeapYear(int year) {
        return year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    }

    public static void main(String[] args) {
        System.out.println(isLeapYear(2024));
    }
}
```

</details>

## Quick quiz

1. With `int x = 5;`, what does `if (x > 3) {...} else if (x > 1) {...}` run?
   - A) Only the first branch
   - B) Only the second branch
   - C) Both branches

2. What is `true || (1 / 0 == 0)`?
   - A) An ArithmeticException
   - B) false
   - C) true, and the division never happens

3. What does `x > 0 ? "pos" : "non-pos"` give when x is 0?
   - A) "pos"
   - B) "non-pos"

<details>
<summary>Quiz answers</summary>

1. **A) Only the first branch**: Only the first true branch runs; the rest are skipped.
2. **C) true, and the division never happens**: `||` short-circuits: the left side is already true, so the right side isn't evaluated.
3. **B) "non-pos"**: `0 > 0` is false, so the value after the colon is used.

</details>

---
Previous: [Lesson 6](06-scanner-input.md) · Next: [Lesson 8: switch statements and expressions](08-switch.md)
