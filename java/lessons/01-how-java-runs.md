# Lesson 1: How Java runs your code

**You'll learn:** what a Java program looks like, `javac` and the JVM, bytecode, compile vs runtime errors.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/java/#how-java-runs)**: run every example and check your exercise answers.

## Key terms

- **Program:** a list of instructions for a computer.
- **Source code:** the Java text you write, saved in `.java` files.
- **Compiler (`javac`):** checks your source code and translates it into bytecode.
- **Bytecode:** compact instructions in `.class` files that the JVM runs.
- **JVM (Java Virtual Machine):** the program that loads and runs bytecode on any platform.
- **JIT compiler:** the part of the JVM that turns frequently used bytecode into fast machine code while the program runs.
- **JDK (Java Development Kit):** the bundle you install to write Java: compiler, JVM and standard library.
- **Compile error:** a mistake found before the program runs, such as a missing semicolon.
- **Runtime error (exception):** a problem that happens while the program runs.

A **program** is a list of instructions for a computer. Here is a complete Java program. Press **Run** and watch the output panel.

```java
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, world!");
        System.out.println("I am learning Java.");
    }
}
```

That's a lot of words for two lines of output. Don't worry about all of them yet; each one is explained over the next few lessons. For now:

- `public class Main` creates a **class** named `Main`. In Java, all code lives inside classes.
- `public static void main(String[] args)` is the **main method**: the place where the program starts.
- `System.out.println(...)` prints a line of text.
- Every statement ends with a semicolon `;`, and curly braces `{ }` group code into blocks.

## Compile, then run

Java runs your code in two steps:

1. **Compile.** The Java compiler (`javac`) reads your source code, checks it for mistakes, and translates it into **bytecode**: compact instructions stored in a `.class` file.
2. **Run.** The **Java Virtual Machine (JVM)** loads the bytecode and runs it. The JVM translates bytecode into instructions for the real processor, and speeds up frequently used code with a **just-in-time (JIT) compiler**.

![Step 1, compile: javac turns Main.java into Main.class bytecode and catches compile errors. Step 2, run: the JVM runs the bytecode, where runtime exceptions can happen](../figures/compile-and-run.svg)

Because the bytecode targets the JVM rather than a particular processor, the same compiled program runs on Windows, macOS, Linux or, as in this course, inside your web browser. This idea is often summarised as "write once, run anywhere".

Open the **Bytecode** tab after running a program to see the bytecode the compiler produced for it. You won't need to read bytecode to write Java, but it's good to know it's there.

The bundle you install to write Java is called the **JDK** (Java Development Kit). It contains the compiler, the JVM and the standard library.

## Your first error

The compiler is strict, and that's a good thing: it finds many mistakes before your program ever runs. Run this and read the message:

*This example raises an error on purpose.*

```java
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello")
    }
}
```

The compiler tells you the file, the line number, and what it expected: a `;`. Add the semicolon and run it again.

There are two kinds of errors you'll meet:

- **Compile errors** happen before the program runs: a missing semicolon, a misspelled name, a type mismatch.
- **Runtime errors (exceptions)** happen while it runs: dividing a whole number by zero, or using a position that doesn't exist in a list.

## How to use this course

- Every code block has a **Run** button that loads it into the editor. Change the code and run it again.
- The first run takes a while (around 20 seconds) because the Java compiler itself has to load. After that, runs take a second or two.
- Each lesson ends with **exercises**. Write your answer in the editor and press **Check**.

## Common mistakes

- Forgetting the semicolon at the end of a statement.
- Mismatched braces: every `{` needs a `}`. Consistent indentation makes it easy to spot.
- Writing `system.out.println` or `Main.Java`: Java is case-sensitive.
- Panicking at red text. Read the first error message: it names the file, the line and what was expected.

## Exercises

### 1. Say hello

Change the program so it prints exactly these two lines:

```text
Hello, Java!
Let's learn together.
```

Starter code:

```java
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello");
    }
}
```

**In the sandbox:** exercise 1. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Use two System.out.println(...) lines. Each one needs the text in double quotes and a semicolon at the end.

</details>

<details>
<summary>Answers</summary>

**1. Say hello**

```java
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, Java!");
        System.out.println("Let's learn together.");
    }
}
```

</details>

## Quick quiz

1. What does the Java compiler (`javac`) produce?
   - A) Machine code for your processor
   - B) A web page
   - C) Bytecode in `.class` files

2. Where does a Java program start running?
   - A) At the first line of the file
   - B) In the last class of the file
   - C) In the `main` method

3. When is a missing semicolon reported?
   - A) Never; semicolons are optional
   - B) Only when that line runs
   - C) When the code is compiled, before it runs

<details>
<summary>Quiz answers</summary>

1. **C) Bytecode in `.class` files**: The compiler turns source code into bytecode. The JVM then runs that bytecode.
2. **C) In the `main` method**: The JVM looks for `public static void main(String[] args)` and starts there.
3. **C) When the code is compiled, before it runs**: It's a compile error, so the program doesn't run at all until you fix it.

</details>

---
Back to the [course home](../README.md) · Next: [Lesson 2: Printing, comments and structure](02-hello-world.md)
