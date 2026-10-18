# Lesson 4: Operators and math

**You'll learn:** arithmetic, integer division, `%`, casting, `Math`, overflow.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/java/#operators-and-math)**: run every example and check your exercise answers.

## Key terms

- **Operator:** a symbol such as `+`, `*` or `%` that computes a value.
- **Integer division:** dividing two ints, which drops the decimal part.
- **Modulo (`%`):** the remainder after division.
- **Cast:** converting a value to another type, like `(double) total`.
- **Widening / narrowing:** converting to a bigger type (automatic) / a smaller one (needs a cast).
- **Overflow:** a value too big for its type wraps around to the other end of the range.
- **Math class:** built-in math helpers like `Math.sqrt`, `Math.pow`, `Math.round`.

### Arithmetic operators

| Operator | Meaning | Example | Result |
|---|---|---|---|
| `+` `-` `*` | add, subtract, multiply | `7 * 2` | `14` |
| `/` | divide | `7 / 2` | `3` (both ints!) |
| `%` | remainder | `7 % 2` | `1` |

```java
public class Main {
    public static void main(String[] args) {
        System.out.println(7 / 2);
        System.out.println(7.0 / 2);
        System.out.println(7 % 2);
        System.out.println(2 + 3 * 4);
        System.out.println((2 + 3) * 4);
    }
}
```

## Integer division

When **both** sides of `/` are integers, Java does **integer division**: it throws away the decimal part. `7 / 2` is `3`, not `3.5`. This is one of the most common beginner bugs. If either side is a `double`, you get a decimal result.

```java
public class Main {
    public static void main(String[] args) {
        int total = 7;
        int people = 2;
        System.out.println(total / people);             // 3
        System.out.println((double) total / people);    // 3.5
        System.out.println(total / 2.0);                // 3.5
    }
}
```

## Casting

A **cast** converts a value to another type: `(double) total`. Converting to a "bigger" type (int to double) happens automatically. Converting to a "smaller" type (double to int) needs an explicit cast, because information can be lost: the decimals are cut off, not rounded.

```java
public class Main {
    public static void main(String[] args) {
        double price = 9.99;
        int whole = (int) price;
        long rounded = Math.round(price);
        System.out.println(whole + " " + rounded);

        char letter = 'A';
        int code = letter;              // chars are numbers underneath
        System.out.println(code + " " + (char) (code + 1));
    }
}
```

## Shortcut operators

```java
public class Main {
    public static void main(String[] args) {
        int x = 10;
        x += 5;   // x = x + 5
        x -= 3;   // x = x - 3
        x *= 2;   // x = x * 2
        x++;      // add 1
        x--;      // subtract 1
        System.out.println(x);
    }
}
```

## The Math class

```java
public class Main {
    public static void main(String[] args) {
        System.out.println(Math.sqrt(81));
        System.out.println(Math.pow(2, 10));
        System.out.println(Math.abs(-5));
        System.out.println(Math.max(3, 9) + " " + Math.min(3, 9));
        System.out.println(Math.round(2.5) + " " + Math.floor(2.7) + " " + Math.ceil(2.1));
        System.out.println(Math.PI);
    }
}
```

## Overflow and floating-point surprises

An `int` can only hold values up to 2,147,483,647. Going past that **overflows** and wraps around to a negative number, silently. Use `long` for big numbers.

```java
public class Main {
    public static void main(String[] args) {
        int big = Integer.MAX_VALUE;
        System.out.println(big + 1);
        long safe = (long) big + 1;
        System.out.println(safe);
        System.out.println(0.1 + 0.2);
    }
}
```

`0.1 + 0.2` isn't exactly `0.3` because computers store decimals in binary. For money in real applications, use `java.math.BigDecimal`.

## Common mistakes

- Expecting `7 / 2` to be `3.5`. Make one side a double: `7 / 2.0`.
- Casting after dividing: `(double) (a / b)` is still integer division. Write `(double) a / b`.
- Assuming `(int) 3.9` rounds. It cuts off the decimals and gives `3`.
- Using `int` for values that can exceed about 2.1 billion. Use `long`.

## Exercises

### 1. Split the bill

Three friends share a bill of `127` dollars plus a `15%` tip. Set `each` to the amount per person and print it with exactly two decimals using `System.out.printf("%.2f%n", each);`. The output should be `48.68`.

Starter code:

```java
public class Main {
    public static void main(String[] args) {
        int bill = 127;
        double tipRate = 0.15;
        int people = 3;
        double each = 0;
        System.out.printf("%.2f%n", each);
    }
}
```

### 2. Clock time

Convert `int seconds = 7384;` into hours, minutes and seconds using `/` and `%`, and print `2h 3m 4s`.

Starter code:

```java
public class Main {
    public static void main(String[] args) {
        int seconds = 7384;

    }
}
```

**In the sandbox:** exercises 5–6. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. The total with tip is bill * (1 + tipRate). Divide that by people. Because tipRate is a double, the result is a double.
2. An hour has 3600 seconds: hours = seconds / 3600. What's left is seconds % 3600; divide that by 60 for the minutes.

</details>

<details>
<summary>Answers</summary>

**1. Split the bill**

```java
public class Main {
    public static void main(String[] args) {
        int bill = 127;
        double tipRate = 0.15;
        int people = 3;
        double each = bill * (1 + tipRate) / people;
        System.out.printf("%.2f%n", each);
    }
}
```

**2. Clock time**

```java
public class Main {
    public static void main(String[] args) {
        int seconds = 7384;
        int hours = seconds / 3600;
        int minutes = seconds % 3600 / 60;
        int secs = seconds % 60;
        System.out.println(hours + "h " + minutes + "m " + secs + "s");
    }
}
```

</details>

## Quick quiz

1. What is `9 / 2` in Java?
   - A) 5
   - B) 4.5
   - C) 4

2. What is `(int) 3.99`?
   - A) 4
   - B) 3
   - C) A compile error

3. What is `17 % 5`?
   - A) 3
   - B) 2
   - C) 3.4

<details>
<summary>Quiz answers</summary>

1. **C) 4**: Both are ints, so Java uses integer division and drops the .5.
2. **B) 3**: Casting to int cuts off the decimal part. Use `Math.round` to round.
3. **B) 2**: 5 goes into 17 three times (15) with 2 left over.

</details>

---
Previous: [Lesson 3](03-variables-and-types.md) · Next: [Lesson 5: Strings](05-strings.md)
