# Lesson 9: while and do-while loops

**You'll learn:** `while`, `do-while`, counters, accumulators, infinite loops.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/java/#while-loops)**: run every example and check your exercise answers.

## Key terms

- **Loop:** code that repeats.
- **Iteration:** one pass through a loop.
- **while:** repeats while a condition is true, checking it before each pass.
- **do-while:** runs the body first, then checks the condition, so it runs at least once.
- **Accumulator:** a variable that builds up a result, like a running total.
- **Infinite loop:** a loop whose condition never becomes false.

A `while` loop repeats its body as long as its condition is `true`. The condition is checked **before** each pass.

```java
public class Main {
    public static void main(String[] args) {
        int count = 1;
        while (count <= 5) {
            System.out.println("Count is " + count);
            count++;
        }
        System.out.println("Done!");
    }
}
```

## Loops with an unknown number of steps

`while` is the natural choice when you don't know in advance how many passes you need:

```java
public class Main {
    public static void main(String[] args) {
        double balance = 1000;
        int years = 0;
        while (balance < 2000) {
            balance *= 1.07;
            years++;
        }
        System.out.printf("Doubled after %d years: $%.2f%n", years, balance);
    }
}
```

## Accumulators

```java
public class Main {
    public static void main(String[] args) {
        int n = 1;
        int total = 0;
        while (n <= 100) {
            total += n;
            n++;
        }
        System.out.println("Sum of 1..100 = " + total);
    }
}
```

## do-while: run at least once

A `do-while` checks its condition **after** the body, so the body always runs at least once. It's handy for "ask until valid" input:

*Input typed for this example: `-3`, `0`, `7`*

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int n;
        do {
            System.out.print("Enter a positive number: ");
            n = Integer.parseInt(in.nextLine());
            System.out.println(n);
        } while (n <= 0);
        System.out.println("Thanks!");
    }
}
```

## Infinite loops

If the condition never becomes false, the loop never ends. Forgetting `count++` above would do it. In this browser editor an infinite loop freezes the page; reload it if that happens (your progress is saved).

## Common mistakes

- Forgetting to update the loop variable, creating an infinite loop.
- Off-by-one conditions: `< 10` stops at 9; `<= 10` includes 10.
- Declaring the accumulator inside the loop, so it resets every pass.

## Exercises

### 1. Digit counter

Write `static int countDigits(int n)` that returns how many digits a non-negative number has, using a `while` loop that divides by 10. `countDigits(0)` should be `1`.

Starter code:

```java
public class Main {
    static int countDigits(int n) {
        return 0;
    }

    public static void main(String[] args) {
        System.out.println(countDigits(12345));
    }
}
```

### 2. Collatz steps

Write `static int collatzSteps(int n)`: if `n` is even, halve it; if odd, make it `3 * n + 1`. Count the steps until `n` reaches 1. `collatzSteps(6)` is `8`.

Starter code:

```java
public class Main {
    static int collatzSteps(int n) {
        int steps = 0;
        return steps;
    }

    public static void main(String[] args) {
        System.out.println(collatzSteps(6));
    }
}
```

**In the sandbox:** exercises 13–14. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Start at 1 digit. While n >= 10, divide n by 10 and add one to the count.
2. Loop while (n != 1). Inside, use if/else to update n, then steps++.

</details>

<details>
<summary>Answers</summary>

**1. Digit counter**

```java
public class Main {
    static int countDigits(int n) {
        int digits = 1;
        while (n >= 10) {
            n /= 10;
            digits++;
        }
        return digits;
    }

    public static void main(String[] args) {
        System.out.println(countDigits(12345));
    }
}
```

**2. Collatz steps**

```java
public class Main {
    static int collatzSteps(int n) {
        int steps = 0;
        while (n != 1) {
            if (n % 2 == 0) {
                n = n / 2;
            } else {
                n = 3 * n + 1;
            }
            steps++;
        }
        return steps;
    }

    public static void main(String[] args) {
        System.out.println(collatzSteps(6));
    }
}
```

</details>

## Quick quiz

1. What's the difference between `while` and `do-while`?
   - A) `do-while` always runs its body at least once
   - B) There is no difference
   - C) `while` always runs at least once

2. How many times does `int i = 0; while (i < 3) { i++; }` run its body?
   - A) 2
   - B) 3
   - C) 4

<details>
<summary>Quiz answers</summary>

1. **A) `do-while` always runs its body at least once**: `do-while` checks the condition after the body.
2. **B) 3**: For i = 0, 1 and 2. When i is 3 the condition is false.

</details>

---
Previous: [Lesson 8](08-switch.md) · Next: [Lesson 10: for loops](10-for-loops.md)
