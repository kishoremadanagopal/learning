# Lesson 25: StringBuilder and wrapper classes

**You'll learn:** `StringBuilder`, wrapper classes, autoboxing, `parseInt`, the `Integer` == trap.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/java/#stringbuilder-and-wrappers)**: run every example and check your exercise answers.

## Key terms

- **StringBuilder:** a changeable string for building text efficiently.
- **Wrapper class:** an object version of a primitive, such as `Integer` or `Double`.
- **Autoboxing / unboxing:** automatic conversion between primitives and wrappers.
- **Integer cache:** Java reuses Integer objects from -128 to 127.

### StringBuilder

Strings are immutable, so `s = s + x` in a loop creates a brand-new string every time. For building text piece by piece, use a **StringBuilder**, which can change in place:

```java
public class Main {
    public static void main(String[] args) {
        StringBuilder sb = new StringBuilder();
        for (int i = 1; i <= 5; i++) {
            sb.append(i);
            if (i < 5) {
                sb.append(", ");
            }
        }
        System.out.println(sb.toString());

        StringBuilder word = new StringBuilder("stressed");
        System.out.println(word.reverse());
        word.reverse().insert(0, "[").append("]").setCharAt(1, 'S');
        System.out.println(word);
        System.out.println(word.length() + " " + word.indexOf("ss"));
    }
}
```

Most methods return the same builder, so calls can be **chained**. Call `toString()` when you need a real `String`.

## Wrapper classes

Every primitive has a **wrapper class** that represents it as an object:

| Primitive | Wrapper |
|---|---|
| `int` | `Integer` |
| `double` | `Double` |
| `boolean` | `Boolean` |
| `char` | `Character` |
| `long` | `Long` |

Wrappers matter because collections like `ArrayList` can only hold objects: you write `ArrayList<Integer>`, never `ArrayList<int>`. They also hold handy static methods:

```java
public class Main {
    public static void main(String[] args) {
        int n = Integer.parseInt("123");
        double d = Double.parseDouble("4.5");
        System.out.println(n + d);
        System.out.println(Integer.MAX_VALUE + " " + Integer.MIN_VALUE);
        System.out.println(Integer.toBinaryString(10) + " " + Integer.toHexString(255));
        System.out.println(Character.isDigit('7') + " " + Character.isLetter('x') + " " + Character.toUpperCase('q'));
        System.out.println(Integer.compare(3, 7) + " " + Double.isNaN(0.0 / 0.0));
    }
}
```

## Autoboxing

Java converts between primitives and wrappers automatically. Primitive to wrapper is **autoboxing**; wrapper to primitive is **unboxing**:

```java
import java.util.ArrayList;

public class Main {
    public static void main(String[] args) {
        ArrayList<Integer> list = new ArrayList<>();
        list.add(5);                 // int 5 autoboxed to Integer
        int first = list.get(0);     // unboxed back to int
        System.out.println(first * 2);

        Integer maybe = null;        // a wrapper can be null; a primitive can't
        System.out.println(maybe == null);
    }
}
```

Unboxing a `null` wrapper throws a `NullPointerException`.

## The Integer == trap

`==` on wrapper objects compares **references**, just like with strings. Java caches small Integer values (−128 to 127), so `==` *seems* to work for small numbers and then silently fails for big ones:

```java
public class Main {
    public static void main(String[] args) {
        Integer a = 100, b = 100;
        Integer c = 1000, d = 1000;
        System.out.println(a == b);        // true, thanks to the cache
        System.out.println(c == d);        // false!
        System.out.println(c.equals(d));   // true: always use equals
    }
}
```

Rule: compare wrapper objects with `equals`, or unbox them to primitives first.

## Common mistakes

- Comparing `Integer` objects with `==`. Use `equals` or compare as ints.
- Concatenating strings in a large loop instead of using a StringBuilder.
- Unboxing a `null` wrapper, which throws NullPointerException.

## Exercises

### 1. Join with a builder

Write `static String joinNumbers(int[] nums, String sep)` using a `StringBuilder`, returning the numbers separated by `sep`. `joinNumbers(new int[]{1, 2, 3}, "-")` returns `"1-2-3"`; an empty array gives `""`.

Starter code:

```java
public class Main {
    static String joinNumbers(int[] nums, String sep) {
        return "";
    }

    public static void main(String[] args) {
        System.out.println(joinNumbers(new int[]{1, 2, 3}, "-"));
    }
}
```

**In the sandbox:** exercise 36. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Append the separator before every number except the first (if (i > 0) sb.append(sep);), then append the number.

</details>

<details>
<summary>Answers</summary>

**1. Join with a builder**

```java
public class Main {
    static String joinNumbers(int[] nums, String sep) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < nums.length; i++) {
            if (i > 0) {
                sb.append(sep);
            }
            sb.append(nums[i]);
        }
        return sb.toString();
    }

    public static void main(String[] args) {
        System.out.println(joinNumbers(new int[]{1, 2, 3}, "-"));
    }
}
```

</details>

## Quick quiz

1. Why prefer StringBuilder for building text in a loop?
   - A) It changes in place instead of creating a new String each time
   - B) StringBuilder is the only way to add numbers to text
   - C) Strings can't be concatenated in loops

2. What does `Integer x = 500, y = 500; x == y` usually give?
   - A) true
   - B) false
   - C) A compile error

3. Why does `ArrayList<int>` not compile?
   - A) It does compile
   - B) Generic types need objects, so you write `ArrayList<Integer>`
   - C) ArrayList can only hold Strings

<details>
<summary>Quiz answers</summary>

1. **A) It changes in place instead of creating a new String each time**: Repeated `+` on Strings copies the text every time.
2. **B) false**: `==` compares references; values outside −128..127 aren't cached. Use `equals`.
3. **B) Generic types need objects, so you write `ArrayList<Integer>`**: Wrappers let primitives live in collections.

</details>

---
Previous: [Lesson 24](24-enums-and-records.md) · Next: [Lesson 26: Exceptions](26-exceptions.md)
