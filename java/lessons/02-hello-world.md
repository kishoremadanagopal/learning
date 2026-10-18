# Lesson 2: Printing, comments and structure

**You'll learn:** `println` vs `print`, escape sequences, comments, statements and blocks.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/java/#hello-world)**: run every example and check your exercise answers.

## Key terms

- **Statement:** one instruction, ending with a semicolon.
- **Block:** statements grouped in curly braces.
- **println / print:** print with or without moving to a new line afterwards.
- **Escape sequence:** a backslash code inside a string, such as `\n` (new line) or `\"` (a quote).
- **Comment:** text the compiler ignores: `// ...`, `/* ... */` or a Javadoc `/** ... */`.
- **Concatenation:** joining text with `+`.

### println and print

`System.out.println(x)` prints `x` and then moves to a new line. `System.out.print(x)` prints `x` and stays on the same line.

```java
public class Main {
    public static void main(String[] args) {
        System.out.print("Loading");
        System.out.print("...");
        System.out.println(" done!");
        System.out.println("Next line");
        System.out.println();
        System.out.println("After a blank line");
    }
}
```

You can join text and numbers with `+`:

```java
public class Main {
    public static void main(String[] args) {
        System.out.println("Apples: " + 5);
        System.out.println("Total: " + 5 * 2 + " dollars");
    }
}
```

## Escape sequences

Inside text, a backslash starts an **escape sequence**:

| Sequence | Meaning |
|---|---|
| `\n` | new line |
| `\t` | tab |
| `\"` | a double quote |
| `\\` | a backslash |

```java
public class Main {
    public static void main(String[] args) {
        System.out.println("Line one\nLine two");
        System.out.println("Name:\tAda");
        System.out.println("She said \"hi\"");
        System.out.println("C:\\Users\\ada");
    }
}
```

## Comments

Comments are notes for people; the compiler ignores them.

```java
public class Main {
    // A single-line comment starts with two slashes.

    /*
     * A block comment can span
     * several lines.
     */

    /** A Javadoc comment documents classes and methods. */
    public static void main(String[] args) {
        System.out.println("Comments don't print"); // comments can end a line too
    }
}
```

Write comments that explain *why* the code does something. Good names usually explain *what* it does.

## The rules of the layout

- Java is **case-sensitive**: `System` works, `system` doesn't.
- Statements end with `;`. Blocks are wrapped in `{ }`.
- Whitespace and indentation don't change the meaning, but consistent 4-space indentation makes code readable. Every Java programmer expects it.
- The public class name must match the file name: `public class Main` lives in `Main.java`.

## Common mistakes

- Expecting `print` to add a new line. Only `println` does.
- `"Sum: " + 2 + 3` prints `Sum: 23`. Add parentheses: `"Sum: " + (2 + 3)`.
- Writing a quote inside a string without escaping it: use `\"`.
- Naming the file differently from its public class.

## Exercises

### 1. Receipt

Print this receipt exactly, using `\t` between each item and its price:

```text
Coffee	3.50
Muffin	2.25
Total	5.75
```

Starter code:

```java
public class Main {
    public static void main(String[] args) {

    }
}
```

### 2. One line, three prints

Use **three** `System.out.print` calls (not `println`) followed by one empty `System.out.println()` to print `3... 2... 1...` on one line.

Starter code:

```java
public class Main {
    public static void main(String[] args) {
        System.out.println("3...");
        System.out.println("2...");
        System.out.println("1...");
    }
}
```

**In the sandbox:** exercises 2–3. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. System.out.println("Coffee\t3.50"); and so on for each line.
2. print doesn't add a new line, so put a space at the end of the first two pieces of text.

</details>

<details>
<summary>Answers</summary>

**1. Receipt**

```java
public class Main {
    public static void main(String[] args) {
        System.out.println("Coffee\t3.50");
        System.out.println("Muffin\t2.25");
        System.out.println("Total\t5.75");
    }
}
```

**2. One line, three prints**

```java
public class Main {
    public static void main(String[] args) {
        System.out.print("3... ");
        System.out.print("2... ");
        System.out.print("1...");
        System.out.println();
    }
}
```

</details>

## Quick quiz

1. What does `System.out.print("A"); System.out.print("B");` print?
   - A) AB
   - B) A B
   - C) A then B on separate lines

2. Which line is a valid Java comment?
   - A) `# total price`
   - B) `<!-- total price -->`
   - C) `// total price`

3. What does `System.out.println("Sum: " + 2 + 3);` print?
   - A) Sum: 5
   - B) An error
   - C) Sum: 23

<details>
<summary>Quiz answers</summary>

1. **A) AB**: `print` never adds a new line or a space.
2. **C) `// total price`**: Java uses `//` for single-line comments and `/* ... */` for blocks.
3. **C) Sum: 23**: Java works left to right. `"Sum: " + 2` is text, then `+ 3` adds the text "3". Write `"Sum: " + (2 + 3)` to get 5.

</details>

---
Previous: [Lesson 1](01-how-java-runs.md) · Next: [Lesson 3: Variables and primitive types](03-variables-and-types.md)
