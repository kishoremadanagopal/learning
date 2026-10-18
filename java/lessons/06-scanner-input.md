# Lesson 6: Reading input with Scanner

**You'll learn:** `Scanner`, `nextLine`, `nextInt`, the newline trap, `Integer.parseInt`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/java/#scanner-input)**: run every example and check your exercise answers.

## Key terms

- **Scanner:** a class that reads text and numbers from input.
- **import:** tells the compiler where a class lives, like `java.util.Scanner`.
- **nextLine / nextInt / nextDouble:** read a whole line / a whole number / a decimal.
- **Parsing:** converting text into a number with `Integer.parseInt` or `Double.parseDouble`.
- **NumberFormatException:** thrown when text can't be parsed as a number.
- **InputMismatchException:** thrown when `nextInt` meets something that isn't a number.

`Scanner` reads input. In this course, the **Input** box under the editor plays the keyboard: put one line for each value your program reads.

*Input typed for this example: `Ada`*

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        System.out.print("What is your name? ");
        String name = in.nextLine();
        System.out.println("Nice to meet you, " + name + "!");
    }
}
```

`import java.util.Scanner;` at the top tells the compiler where to find the `Scanner` class. Classes in `java.lang` (like `String`, `Math` and `System`) don't need importing.

## Reading numbers

| Method | Reads |
|---|---|
| `nextLine()` | the rest of the line, as a String |
| `next()` | the next word |
| `nextInt()` | the next whole number |
| `nextDouble()` | the next decimal number |
| `hasNextInt()` | true if the next thing is a whole number |

*Input typed for this example: `1990`*

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        System.out.print("Birth year? ");
        int year = in.nextInt();
        System.out.println("You are about " + (2026 - year) + " years old");
    }
}
```

If the user types something that isn't a number, `nextInt()` throws an `InputMismatchException`:

*Input typed for this example: `nineteen-ninety`*

*This example raises an error on purpose.*

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int year = in.nextInt();
        System.out.println(year);
    }
}
```

## The nextInt / nextLine trap

`nextInt()` reads the number but **leaves the end of the line** behind. A `nextLine()` right after it reads that leftover empty line instead of waiting for new text:

*Input typed for this example: `36`, `Ada`*

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int age = in.nextInt();
        String name = in.nextLine();        // reads the rest of the "36" line: ""
        System.out.println("[" + name + "] is " + age);

        // The fix: read whole lines and convert them yourself.
        Scanner in2 = new Scanner("36\nAda Lovelace\n");
        int age2 = Integer.parseInt(in2.nextLine());
        String name2 = in2.nextLine();
        System.out.println("[" + name2 + "] is " + age2);
    }
}
```

A reliable habit: read every line with `nextLine()`, then convert with `Integer.parseInt` or `Double.parseDouble`.

## Parsing strings into numbers

```java
public class Main {
    public static void main(String[] args) {
        int a = Integer.parseInt("42");
        double b = Double.parseDouble("2.5");
        String c = String.valueOf(a + b);
        System.out.println(a + b);
        System.out.println(c + "!");
    }
}
```

`Integer.parseInt("4.5")` and `Integer.parseInt("abc")` throw a `NumberFormatException`. You'll learn to catch exceptions in Part 5.

## Common mistakes

- Calling `nextLine()` right after `nextInt()` and getting an empty string. Read lines and parse them instead.
- Forgetting `import java.util.Scanner;`.
- Parsing `"4.5"` with `Integer.parseInt`. Use `Double.parseDouble`.

## Exercises

### 1. Temperature converter

Read a temperature in Celsius (one line, possibly a decimal), convert it with `F = C * 9 / 5 + 32`, and print it with one decimal place: `Fahrenheit: 98.6`.

The checker types `37`.

Starter code:

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);

    }
}
```

*The checker types: `37`*

**In the sandbox:** exercise 9. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Read the line with in.nextLine(), convert it with Double.parseDouble, then use printf with %.1f.

</details>

<details>
<summary>Answers</summary>

**1. Temperature converter**

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        double celsius = Double.parseDouble(in.nextLine());
        double fahrenheit = celsius * 9 / 5 + 32;
        System.out.printf("Fahrenheit: %.1f%n", fahrenheit);
    }
}
```

</details>

## Quick quiz

1. Why does `nextLine()` right after `nextInt()` often return an empty string?
   - A) `nextLine()` only works once
   - B) Scanner can't mix types
   - C) `nextInt()` leaves the end of the line unread

2. What does `Integer.parseInt("12") + 1` give?
   - A) "121"
   - B) 13
   - C) An error

3. Which class needs an import?
   - A) `java.util.Scanner`
   - B) `Math`
   - C) `String`

<details>
<summary>Quiz answers</summary>

1. **C) `nextInt()` leaves the end of the line unread**: The leftover newline is read as an empty line. Read whole lines and parse them instead.
2. **B) 13**: `parseInt` turns the text into the number 12.
3. **A) `java.util.Scanner`**: Classes in `java.lang` are available automatically; everything else needs an import.

</details>

---
Previous: [Lesson 5](05-strings.md) · Next: [Lesson 7: Booleans and if statements](07-conditions.md)
