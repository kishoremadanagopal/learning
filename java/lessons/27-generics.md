# Lesson 27: Generics

**You'll learn:** type parameters, generic classes and methods, the diamond, bounded types, wildcards.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/java/#generics)**: run every example and check your exercise answers.

## Key terms

- **Generics:** classes and methods that take type parameters, like `List<String>`.
- **Type parameter:** a placeholder type such as `T` in `class Box<T>`.
- **Diamond (`<>`):** lets the compiler infer type arguments: `new ArrayList<>()`.
- **Bounded type:** a type parameter with a limit, like `<T extends Comparable<T>>`.
- **Wildcard:** `?` for an unknown type, as in `List<? extends Number>`.

**Generics** let you write code that works with many types while the compiler still checks them. You've used them already: `ArrayList<String>` is a list that only holds Strings.

## Why generics?

Without generics, a container would hold plain `Object`s, and you'd need casts that can fail at runtime. With generics, mistakes become compile errors:

*This example raises an error on purpose.*

```java
import java.util.ArrayList;
import java.util.List;

public class Main {
    public static void main(String[] args) {
        List<String> names = new ArrayList<>();
        names.add("Ada");
        names.add(42);          // compile error: not a String
    }
}
```

## A generic class

A **type parameter** like `<T>` is a placeholder for a real type, filled in when you use the class:

```java
class Box<T> {
    private T value;

    Box(T value) {
        this.value = value;
    }

    T get() {
        return value;
    }

    boolean isEmpty() {
        return value == null;
    }
}

class Pair<A, B> {
    final A first;
    final B second;

    Pair(A first, B second) {
        this.first = first;
        this.second = second;
    }

    @Override
    public String toString() {
        return "(" + first + ", " + second + ")";
    }
}

public class Main {
    public static void main(String[] args) {
        Box<String> name = new Box<>("Ada");
        Box<Integer> age = new Box<>(36);
        String n = name.get();          // no cast needed
        int a = age.get();
        System.out.println(n + " " + a);
        System.out.println(new Pair<>("Ada", 1815));
    }
}
```

`new Box<>(...)` uses the **diamond** `<>`: the compiler infers the type from the variable.

## Generic methods

A method can declare its own type parameter before the return type:

```java
import java.util.List;

public class Main {
    static <T> T firstOrDefault(List<T> items, T fallback) {
        return items.isEmpty() ? fallback : items.get(0);
    }

    static <T extends Comparable<T>> T largest(List<T> items) {
        T best = items.get(0);
        for (T item : items) {
            if (item.compareTo(best) > 0) {
                best = item;
            }
        }
        return best;
    }

    public static void main(String[] args) {
        System.out.println(firstOrDefault(List.of("x", "y"), "none"));
        System.out.println(firstOrDefault(List.<String>of(), "none"));
        System.out.println(largest(List.of(3, 9, 4)));
        System.out.println(largest(List.of("pear", "apple", "zucchini")));
    }
}
```

`<T extends Comparable<T>>` is a **bounded type parameter**: T can be any type that can compare itself to another T, which is what `compareTo` needs.

## Wildcards

`List<?>` means "a list of some type". `List<? extends Number>` accepts a `List<Integer>` or a `List<Double>`, which a plain `List<Number>` parameter wouldn't:

```java
import java.util.List;

public class Main {
    static double sum(List<? extends Number> nums) {
        double total = 0;
        for (Number n : nums) {
            total += n.doubleValue();
        }
        return total;
    }

    public static void main(String[] args) {
        System.out.println(sum(List.of(1, 2, 3)));
        System.out.println(sum(List.of(1.5, 2.5)));
    }
}
```

Type parameter names are single capital letters by convention: `T` (type), `E` (element), `K`/`V` (key/value), `R` (result).

## Common mistakes

- Using raw types like `List` instead of `List<String>`, which loses type checking.
- Expecting `List<Integer>` to be accepted where `List<Number>` is required.
- Trying to use primitives as type arguments: `List<int>`.

## Exercises

### 1. Generic stack

Create a generic class `Stack<T>` backed by an `ArrayList<T>`, with `void push(T item)`, `T pop()` (removes and returns the top item; throw `IllegalStateException` if empty), `T peek()`, `boolean isEmpty()` and `int size()`.

Starter code:

```java
import java.util.ArrayList;

public class Main {
    public static void main(String[] args) {
        // Stack<String> s = new Stack<>();
        // s.push("a"); s.push("b");
        // System.out.println(s.pop());
    }
}
```

**In the sandbox:** exercise 39. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. class Stack<T> { private final ArrayList<T> items = new ArrayList<>(); ... } The top of the stack is the last element: items.get(items.size() - 1).

</details>

<details>
<summary>Answers</summary>

**1. Generic stack**

```java
import java.util.ArrayList;

class Stack<T> {
    private final ArrayList<T> items = new ArrayList<>();

    void push(T item) {
        items.add(item);
    }

    T pop() {
        if (items.isEmpty()) {
            throw new IllegalStateException("Stack is empty");
        }
        return items.remove(items.size() - 1);
    }

    T peek() {
        if (items.isEmpty()) {
            throw new IllegalStateException("Stack is empty");
        }
        return items.get(items.size() - 1);
    }

    boolean isEmpty() {
        return items.isEmpty();
    }

    int size() {
        return items.size();
    }
}

public class Main {
    public static void main(String[] args) {
        Stack<String> s = new Stack<>();
        s.push("a");
        s.push("b");
        System.out.println(s.pop());
    }
}
```

</details>

## Quick quiz

1. What does `<T>` in `class Box<T>` declare?
   - A) A field named T
   - B) A type parameter, filled in when Box is used
   - C) An interface

2. What is `new ArrayList<>()` called?
   - A) A raw type
   - B) The diamond operator; the type is inferred
   - C) A wildcard

3. Why does `List<? extends Number>` accept a `List<Integer>`?
   - A) Integer and Number are the same
   - B) The wildcard allows any subtype of Number
   - C) It doesn't

<details>
<summary>Quiz answers</summary>

1. **B) A type parameter, filled in when Box is used**: `Box<String>` replaces T with String.
2. **B) The diamond operator; the type is inferred**: The compiler infers the element type from the variable.
3. **B) The wildcard allows any subtype of Number**: `List<Integer>` isn't a `List<Number>`, but it fits `List<? extends Number>`.

</details>

---
Previous: [Lesson 26](26-exceptions.md) · Next: [Lesson 28: Lists](28-lists.md)
