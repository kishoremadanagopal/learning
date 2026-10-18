# Lesson 10: for loops

**You'll learn:** `for`, counting patterns, looping over strings, the enhanced for loop, nested loops.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/java/#for-loops)**: run every example and check your exercise answers.

## Key terms

- **for loop:** a loop with start, condition and update in one header.
- **Loop variable:** the counter declared in the for header; it exists only inside the loop.
- **Enhanced for (for-each):** `for (Type item : collection)` visits each element.
- **Nested loop:** a loop inside another loop.
- **Off-by-one error:** looping one time too many or too few.

A `for` loop puts the three parts of a counting loop in one line: **start**, **condition** and **update**.

```java
public class Main {
    public static void main(String[] args) {
        for (int i = 1; i <= 5; i++) {
            System.out.println(i + " x 7 = " + i * 7);
        }
    }
}
```

Read it as: start with `i = 1`; while `i <= 5`, run the body, then do `i++`.

## Counting patterns

```java
public class Main {
    public static void main(String[] args) {
        for (int i = 0; i < 10; i += 3) System.out.print(i + " ");
        System.out.println();
        for (int i = 5; i > 0; i--) System.out.print(i + " ");
        System.out.println("Liftoff!");
    }
}
```

The loop variable `i` exists only inside the loop.

## Looping over a string

```java
public class Main {
    public static void main(String[] args) {
        String word = "banana";
        int count = 0;
        for (int i = 0; i < word.length(); i++) {
            if (word.charAt(i) == 'a') {
                count++;
            }
        }
        System.out.println("a appears " + count + " times");
    }
}
```

Notice `i < word.length()`, not `<=`. The last index is `length() - 1`; using `<=` causes an out-of-bounds error. This **off-by-one** mistake is extremely common.

## The enhanced for loop

When you just need each item and not its position, the **for-each** loop is simpler. It works on arrays (next part) and collections:

```java
public class Main {
    public static void main(String[] args) {
        String[] fruits = {"apple", "banana", "cherry"};
        for (String fruit : fruits) {
            System.out.println("I like " + fruit);
        }
        for (char c : "hey".toCharArray()) {
            System.out.print(c + "-");
        }
        System.out.println();
    }
}
```

## Nested loops

```java
public class Main {
    public static void main(String[] args) {
        for (int row = 1; row <= 3; row++) {
            for (int col = 1; col <= 4; col++) {
                System.out.printf("%4d", row * col);
            }
            System.out.println();
        }
    }
}
```

The inner loop runs completely for each pass of the outer loop: 3 rows × 4 columns = 12 numbers.

## Common mistakes

- Using `i <= s.length()` instead of `i < s.length()`, which goes past the last index.
- Changing a collection while a for-each loop walks over it.
- Reusing the same counter name in nested loops.

## Exercises

### 1. Sum of multiples

Write `static int sumMultiples(int limit)` returning the sum of all numbers **below** `limit` that are multiples of 3 or 5. For 10 that's 3 + 5 + 6 + 9 = 23.

Starter code:

```java
public class Main {
    static int sumMultiples(int limit) {
        int total = 0;
        return total;
    }

    public static void main(String[] args) {
        System.out.println(sumMultiples(10));
    }
}
```

### 2. Triangle

Print a right triangle of `*` with 4 rows using nested loops:

```text
*
**
***
****
```

Starter code:

```java
public class Main {
    public static void main(String[] args) {

    }
}
```

**In the sandbox:** exercises 15–16. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. for (int n = 0; n < limit; n++) and add n to total when n % 3 == 0 || n % 5 == 0.
2. The outer loop goes from 1 to 4. The inner loop prints row stars with print, then println() ends the line.

</details>

<details>
<summary>Answers</summary>

**1. Sum of multiples**

```java
public class Main {
    static int sumMultiples(int limit) {
        int total = 0;
        for (int n = 0; n < limit; n++) {
            if (n % 3 == 0 || n % 5 == 0) {
                total += n;
            }
        }
        return total;
    }

    public static void main(String[] args) {
        System.out.println(sumMultiples(10));
    }
}
```

**2. Triangle**

```java
public class Main {
    public static void main(String[] args) {
        for (int row = 1; row <= 4; row++) {
            for (int i = 0; i < row; i++) {
                System.out.print("*");
            }
            System.out.println();
        }
    }
}
```

</details>

## Quick quiz

1. What does `for (int i = 0; i < 3; i++)` produce for `i`?
   - A) 1, 2, 3
   - B) 0, 1, 2, 3
   - C) 0, 1, 2

2. When should you use the enhanced for loop?
   - A) When you need to change the index
   - B) When you need each item but not its index
   - C) Only for strings

<details>
<summary>Quiz answers</summary>

1. **C) 0, 1, 2**: It starts at 0 and stops before 3.
2. **B) When you need each item but not its index**: `for (String s : items)` reads cleaner when the position doesn't matter.

</details>

---
Previous: [Lesson 9](09-while-loops.md) · Next: [Lesson 11: break, continue and loop patterns](11-break-continue.md)
