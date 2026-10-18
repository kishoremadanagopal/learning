# Lesson 5: Strings

**You'll learn:** `length`, `charAt`, `substring`, `indexOf`, immutability, `equals`, `printf`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/java/#strings)**: run every example and check your exercise answers.

## Key terms

- **String:** an immutable sequence of characters.
- **Index:** a character's position, starting at 0.
- **substring(start, end):** the characters from start up to, but not including, end.
- **Immutable:** can't be changed; String methods return new strings.
- **equals:** compares the text of two strings.
- **printf / String.format:** fill placeholders like `%s`, `%d` and `%.2f` in a template.

A `String` holds text. Strings are **objects**, so you use their **methods** with a dot.

```java
public class Main {
    public static void main(String[] args) {
        String word = "Python";
        System.out.println(word.length());
        System.out.println(word.charAt(0));
        System.out.println(word.toUpperCase());
        System.out.println(word.substring(0, 2));
        System.out.println(word.indexOf("th"));
        System.out.println(word.contains("yth"));
        System.out.println(word.replace("P", "J"));
    }
}
```

## Indexes start at 0

Each character has a position (an **index**), starting at **0**. The last index is `length() - 1`.

```text
 J  a  v  a
 0  1  2  3
```

`substring(start, end)` returns the characters from `start` up to, but **not including**, `end`. `substring(start)` goes to the end.

![The characters of "Hello, World" at indexes 0 to 11: substring(0, 5) gives "Hello" and substring(7) gives "World"](../figures/string-index.svg)

```java
public class Main {
    public static void main(String[] args) {
        String s = "Hello, World";
        System.out.println(s.substring(7));
        System.out.println(s.substring(0, 5));
        System.out.println(s.charAt(s.length() - 1));
    }
}
```

`charAt(12)` on a 12-character string throws a `StringIndexOutOfBoundsException` at runtime.

## Strings can't be changed

Strings are **immutable**: methods like `toUpperCase()` return a **new** string and leave the original alone.

```java
public class Main {
    public static void main(String[] args) {
        String name = "ada";
        name.toUpperCase();              // result thrown away
        System.out.println(name);
        name = name.toUpperCase();       // keep the result
        System.out.println(name);
    }
}
```

## Comparing strings: equals, not ==

This is one of the most important rules in Java. `==` checks whether two variables refer to the **same object**. `equals` checks whether two strings contain the **same text**. Always use `equals` for strings.

```java
public class Main {
    public static void main(String[] args) {
        String a = "hello";
        String b = new String("hello");
        System.out.println(a == b);              // false: different objects
        System.out.println(a.equals(b));         // true: same text
        System.out.println("HELLO".equalsIgnoreCase(a));
        System.out.println("apple".compareTo("banana") < 0);  // alphabetical order
    }
}
```

## Useful methods

| Method | Result |
|---|---|
| `s.trim()` / `s.strip()` | remove surrounding whitespace |
| `s.isEmpty()` / `s.isBlank()` | empty? only whitespace? |
| `s.startsWith(x)` / `s.endsWith(x)` | true/false |
| `s.split(",")` | array of parts |
| `String.join("-", parts)` | glue parts together |
| `s.repeat(3)` | repeat the text |
| `String.valueOf(42)` | turn anything into a String |

```java
public class Main {
    public static void main(String[] args) {
        String csv = "red,green,blue";
        String[] parts = csv.split(",");
        System.out.println(parts.length + " colors, first is " + parts[0]);
        System.out.println(String.join(" | ", parts));
        System.out.println("ha".repeat(3));
        System.out.println("  padded  ".strip() + "!");
    }
}
```

## Formatting with printf and String.format

`printf` fills placeholders in a template: `%s` for text, `%d` for whole numbers, `%f` for decimals, and `%n` for a new line.

```java
public class Main {
    public static void main(String[] args) {
        String item = "Notebook";
        int qty = 3;
        double price = 4.5;
        System.out.printf("%s x%d costs $%.2f%n", item, qty, qty * price);
        String line = String.format("[%-8s|%5d]", "left", 42);
        System.out.println(line);
        System.out.printf("%,d%n", 1234567);
    }
}
```

`%.2f` means two decimal places, `%-8s` pads text to 8 characters aligned left, `%5d` pads a number to 5 characters, and `%,d` adds thousands separators.

## Common mistakes

- Comparing strings with `==` instead of `.equals()`.
- Forgetting that `substring`'s end index is excluded.
- Calling `s.toUpperCase();` and expecting `s` to change. Write `s = s.toUpperCase();`.
- Using `charAt(s.length())`: the last index is `length() - 1`.

## Exercises

### 1. Initials

Given `first = "grace"` and `last = "hopper"`, build `"G.H."` and print it. Use `charAt` and `Character.toUpperCase`, or `substring` and `toUpperCase`.

Starter code:

```java
public class Main {
    public static void main(String[] args) {
        String first = "grace";
        String last = "hopper";
        String initials = "";
        System.out.println(initials);
    }
}
```

### 2. Is it a palindrome?

Write a method `static boolean isPalindrome(String s)` that returns true if `s` reads the same forwards and backwards, **ignoring case**. You can reverse a string with `new StringBuilder(s).reverse().toString()`.

Starter code:

```java
public class Main {
    static boolean isPalindrome(String s) {
        return false;
    }

    public static void main(String[] args) {
        System.out.println(isPalindrome("Racecar"));
    }
}
```

**In the sandbox:** exercises 7–8. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. first.substring(0, 1) is "g". Uppercase it, add ".", and do the same for last.
2. Lowercase the string first, reverse it, then compare the two with equals (not ==).

</details>

<details>
<summary>Answers</summary>

**1. Initials**

```java
public class Main {
    public static void main(String[] args) {
        String first = "grace";
        String last = "hopper";
        String initials = first.substring(0, 1).toUpperCase() + "." + last.substring(0, 1).toUpperCase() + ".";
        System.out.println(initials);
    }
}
```

**2. Is it a palindrome?**

```java
public class Main {
    static boolean isPalindrome(String s) {
        String lower = s.toLowerCase();
        String reversed = new StringBuilder(lower).reverse().toString();
        return lower.equals(reversed);
    }

    public static void main(String[] args) {
        System.out.println(isPalindrome("Racecar"));
    }
}
```

</details>

## Quick quiz

1. Why should you compare strings with `equals` instead of `==`?
   - A) `equals` is faster
   - B) `==` doesn't compile for strings
   - C) `==` checks if they are the same object; `equals` checks the text

2. What is `"Java".substring(1, 3)`?
   - A) "Jav"
   - B) "ava"
   - C) "av"

3. After `String s = "hi"; s.toUpperCase();`, what is `s`?
   - A) "hi"
   - B) "HI"

<details>
<summary>Quiz answers</summary>

1. **C) `==` checks if they are the same object; `equals` checks the text**: Two strings with the same text can be different objects, so `==` can be false.
2. **C) "av"**: It starts at index 1 ('a') and stops before index 3.
3. **A) "hi"**: Strings are immutable. Write `s = s.toUpperCase();` to keep the change.

</details>

---
Previous: [Lesson 4](04-operators-and-math.md) · Next: [Lesson 6: Reading input with Scanner](06-scanner-input.md)
