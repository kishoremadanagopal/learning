# Lesson 3: Variables and primitive types

**You'll learn:** declaring variables, `int`, `double`, `boolean`, `char`, `String`, `final`, `var`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/java/#variables-and-types)**: run every example and check your exercise answers.

## Key terms

- **Variable:** a named box holding a value of a fixed type.
- **Declaration:** creating a variable with its type, like `int age;`.
- **Primitive type:** one of Java's eight built-in value types: `int`, `long`, `double`, `float`, `boolean`, `char`, `byte`, `short`.
- **int / double:** whole numbers / decimal numbers.
- **boolean:** `true` or `false`.
- **char:** a single character in single quotes, like `'A'`.
- **String:** text in double quotes; a class, not a primitive.
- **final:** makes a variable a constant that can't be reassigned.
- **var:** lets the compiler infer a local variable's type (Java 10+).
- **Static typing:** every variable's type is fixed and checked at compile time.
- **camelCase:** the naming style for variables and methods, like `totalPrice`.

A **variable** is a named box that holds a value. In Java, every variable has a **type** that decides what it can hold, and you declare the type when you create the variable.

```java
public class Main {
    public static void main(String[] args) {
        int age = 36;
        double height = 1.68;
        boolean isStudent = false;
        char grade = 'A';
        String name = "Ada";

        System.out.println(name + " is " + age + " years old");
        System.out.println("Height: " + height + ", grade: " + grade + ", student: " + isStudent);
    }
}
```

Java is **statically typed**: the type is checked when you compile. Putting text into an `int` is a compile error, which catches many bugs early.

## The primitive types

Java has eight **primitive types** that hold simple values directly:

| Type | Holds | Example |
|---|---|---|
| `int` | whole numbers (about ±2.1 billion) | `42` |
| `long` | bigger whole numbers | `9_000_000_000L` |
| `double` | decimal numbers | `3.14` |
| `float` | less precise decimals | `3.14f` |
| `boolean` | `true` or `false` | `true` |
| `char` | one character, in single quotes | `'A'` |
| `byte`, `short` | small whole numbers | `(byte) 7` |

Most of the time you'll use `int`, `double`, `boolean` and `char`.

`String` is not a primitive; it's a **class** (that's why it starts with a capital letter). Strings use double quotes, chars use single quotes: `"A"` is a String, `'A'` is a char.

## Declaring, assigning, changing

```java
public class Main {
    public static void main(String[] args) {
        int score;          // declare
        score = 10;         // assign
        score = score + 5;  // change: read the old value, add 5, store it back
        System.out.println(score);

        int a = 1, b = 2;   // several at once
        int temp = a;       // swap two values with a temporary variable
        a = b;
        b = temp;
        System.out.println(a + " " + b);
    }
}
```

Java won't let you use a local variable before it has a value. That's another compile error that prevents bugs.

## Constants with final

`final` means the variable can't be changed after it's set. By convention, constants use UPPER_SNAKE_CASE:

```java
public class Main {
    public static void main(String[] args) {
        final double TAX_RATE = 0.08;
        double price = 50;
        System.out.println("Tax: " + price * TAX_RATE);
    }
}
```

## Naming conventions

- Variables and methods use **camelCase**: `firstName`, `totalPrice`.
- Classes use **PascalCase**: `Main`, `BankAccount`.
- Constants use **UPPER_SNAKE_CASE**: `MAX_SIZE`.
- Names can't start with a digit or be keywords like `class` or `int`.

## var: let the compiler infer the type

Since Java 10, you can write `var` for local variables when the type is obvious from the value. The variable still has a fixed type; the compiler just works it out for you.

```java
public class Main {
    public static void main(String[] args) {
        var count = 3;          // int
        var price = 4.99;       // double
        var city = "London";    // String
        System.out.println(count + " " + price + " " + city);
    }
}
```

## Common mistakes

- Putting a decimal into an `int`: `int price = 4.99;` doesn't compile.
- Mixing up `'A'` (a char) and `"A"` (a String).
- Using a local variable before giving it a value.
- Capitalising `string` or `Int`. It's `String` and `int`.

## Exercises

### 1. Profile card

Create these variables with the right types: `name` set to `"Grace"`, `year` set to `1906`, `height` set to `1.62`, and `isProgrammer` set to `true`. Then print them on one line separated by single spaces: `Grace 1906 1.62 true`.

Starter code:

```java
public class Main {
    public static void main(String[] args) {
        // declare the four variables here

    }
}
```

**In the sandbox:** exercise 4. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. String name = "Grace"; int year = 1906; ... then print them joined with + " " + between each.

</details>

<details>
<summary>Answers</summary>

**1. Profile card**

```java
public class Main {
    public static void main(String[] args) {
        String name = "Grace";
        int year = 1906;
        double height = 1.62;
        boolean isProgrammer = true;
        System.out.println(name + " " + year + " " + height + " " + isProgrammer);
    }
}
```

</details>

## Quick quiz

1. Which declaration is correct?
   - A) `char price = "4.99";`
   - B) `int price = 4.99;`
   - C) `double price = 4.99;`

2. What's the difference between `'A'` and `"A"`?
   - A) `'A'` is a String, `"A"` is a char
   - B) `'A'` is a char, `"A"` is a String
   - C) They are identical

3. What does `final int MAX = 5; MAX = 6;` do?
   - A) Sets MAX to 6
   - B) Causes a compile error
   - C) Causes a runtime error

<details>
<summary>Quiz answers</summary>

1. **C) `double price = 4.99;`**: An `int` can't hold decimals, and a `char` holds one character in single quotes.
2. **B) `'A'` is a char, `"A"` is a String**: Single quotes make a `char`; double quotes make a `String`.
3. **B) Causes a compile error**: A `final` variable can only be assigned once, and the compiler enforces it.

</details>

---
Previous: [Lesson 2](02-hello-world.md) · Next: [Lesson 4: Operators and math](04-operators-and-math.md)
