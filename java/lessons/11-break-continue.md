# Lesson 11: break, continue and loop patterns

**You'll learn:** `break`, `continue`, search flags, labeled break, `while (true)`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/java/#break-continue)**: run every example and check your exercise answers.

## Key terms

- **break:** leaves the innermost loop immediately.
- **continue:** skips the rest of the current iteration.
- **Flag:** a boolean that records whether something was found.
- **Label:** a name on a loop so `break label;` can leave an outer loop.
- **Sentinel value:** a special input meaning "stop", like `quit`.

### break: leave the loop now

```java
public class Main {
    public static void main(String[] args) {
        int[] numbers = {4, 7, 12, -1, 8};
        for (int n : numbers) {
            if (n < 0) {
                System.out.println("Found a negative number, stopping.");
                break;
            }
            System.out.println("Processing " + n);
        }
    }
}
```

## continue: skip to the next iteration

```java
public class Main {
    public static void main(String[] args) {
        for (int n = 1; n <= 10; n++) {
            if (n % 3 == 0) {
                continue;
            }
            System.out.print(n + " ");
        }
        System.out.println();
    }
}
```

## Searching with a flag

A common pattern: assume something, loop to look for a counterexample, and `break` as soon as you find one.

```java
public class Main {
    public static void main(String[] args) {
        int n = 91;
        boolean prime = n >= 2;
        for (int d = 2; d * d <= n; d++) {
            if (n % d == 0) {
                prime = false;
                System.out.println(n + " is divisible by " + d);
                break;
            }
        }
        System.out.println(n + (prime ? " is prime" : " is not prime"));
    }
}
```

## Labeled break for nested loops

A plain `break` only leaves the innermost loop. To leave an outer loop, give it a **label**:

```java
public class Main {
    public static void main(String[] args) {
        int[][] grid = {{1, 2, 3}, {4, 42, 6}, {7, 8, 9}};
        search:
        for (int r = 0; r < grid.length; r++) {
            for (int c = 0; c < grid[r].length; c++) {
                if (grid[r][c] == 42) {
                    System.out.println("Found 42 at row " + r + ", column " + c);
                    break search;
                }
            }
        }
    }
}
```

Labels are rarely needed. Often, moving the loops into a method and using `return` is clearer.

## while (true) with break

*Input typed for this example: `hello`, `java`, `quit`*

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        while (true) {
            String line = in.nextLine();
            if (line.equals("quit")) {
                break;
            }
            System.out.println(line.toUpperCase());
        }
        System.out.println("Bye");
    }
}
```

## Common mistakes

- Expecting `break` in an inner loop to leave the outer loop as well.
- Placing `break` outside the `if`, so the loop always stops after one pass.
- Writing `while (true)` with no reachable `break`.

## Exercises

### 1. Is it prime?

Write `static boolean isPrime(int n)`. Numbers below 2 aren't prime. Test divisors only while `d * d <= n`, and stop as soon as you find one.

Starter code:

```java
public class Main {
    static boolean isPrime(int n) {
        return false;
    }

    public static void main(String[] args) {
        System.out.println(isPrime(97));
    }
}
```

**In the sandbox:** exercise 17. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Return false for n < 2. Loop d from 2 while d * d <= n; if n % d == 0 return false. After the loop, return true.

</details>

<details>
<summary>Answers</summary>

**1. Is it prime?**

```java
public class Main {
    static boolean isPrime(int n) {
        if (n < 2) {
            return false;
        }
        for (int d = 2; d * d <= n; d++) {
            if (n % d == 0) {
                return false;
            }
        }
        return true;
    }

    public static void main(String[] args) {
        System.out.println(isPrime(97));
    }
}
```

</details>

## Quick quiz

1. What does `continue` do?
   - A) Ends the loop
   - B) Restarts from the first iteration
   - C) Skips the rest of this iteration

2. A `break` inside an inner loop leaves…
   - A) only the inner loop
   - B) both loops
   - C) the whole method

<details>
<summary>Quiz answers</summary>

1. **C) Skips the rest of this iteration**: `continue` jumps to the next iteration; `break` ends the loop.
2. **A) only the inner loop**: Use a labeled break (or return) to leave an outer loop.

</details>

---
Previous: [Lesson 10](10-for-loops.md) · Next: [Lesson 12: Arrays](12-arrays.md)
