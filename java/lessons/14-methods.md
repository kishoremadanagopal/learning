# Lesson 14: Methods

**You'll learn:** defining methods, parameters, return types, `void`, `static`, print vs return.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/java/#methods)**: run every example and check your exercise answers.

## Key terms

- **Method:** a named, reusable block of code.
- **Parameter:** a variable in the method header that receives a value.
- **Argument:** the value passed in a call.
- **Return type:** the type of value a method gives back; `void` means none.
- **return:** hands a value back and ends the method.
- **Method signature:** a method's name and parameter types.
- **static method:** a method that belongs to the class and can be called without an object.

A **method** is a named, reusable block of code. You've been calling methods all along: `println`, `length`, `Math.max`. Now you'll write your own.

```java
public class Main {
    static String greet(String name) {
        return "Hello, " + name + "!";
    }

    public static void main(String[] args) {
        String message = greet("Ada");
        System.out.println(message);
        System.out.println(greet("Alan"));
    }
}
```

The **method header** `static String greet(String name)` says:

- `static`: the method belongs to the class, so `main` can call it directly. (Part 4 explains non-static methods.)
- `String`: the **return type**, the type of value the method gives back.
- `greet`: the name, in camelCase.
- `(String name)`: the **parameters**, each with a type.

The values you pass when calling, like `"Ada"`, are called **arguments**.

## return and void

`return` hands a value back and ends the method immediately. A method that doesn't return anything has the return type `void`:

```java
public class Main {
    static void printBanner(String title, int width) {
        String line = "=".repeat(width);
        System.out.println(line);
        System.out.println(title);
        System.out.println(line);
    }

    static int area(int width, int height) {
        return width * height;
    }

    public static void main(String[] args) {
        printBanner("Report", 10);
        int a = area(4, 5);
        System.out.println("Area: " + a + ", double: " + area(4, 5) * 2);
    }
}
```

## print vs return

This trips up many beginners. `System.out.println` **shows** a value. `return` **hands it back** so the program can keep using it. A method that only prints can't be used in a calculation. Prefer returning values and let the caller decide what to print.

The compiler checks that a non-void method always returns a value:

*This example raises an error on purpose.*

```java
public class Main {
    static String sign(int n) {
        if (n > 0) {
            return "positive";
        } else if (n < 0) {
            return "negative";
        }
    }

    public static void main(String[] args) {
        System.out.println(sign(5));
    }
}
```

That's the error "missing return statement": what if `n` is 0? Adding a final `return "zero";` fixes it.

## Early returns keep code flat

```java
public class Main {
    static String describeAge(int age) {
        if (age < 0) {
            return "invalid";
        }
        if (age < 13) {
            return "child";
        }
        if (age < 20) {
            return "teenager";
        }
        return "adult";
    }

    public static void main(String[] args) {
        for (int a : new int[]{-1, 8, 15, 42}) {
            System.out.println(a + " " + describeAge(a));
        }
    }
}
```

## Why methods?

- **Reuse**: write once, call many times.
- **Readability**: `calculateTax(price)` explains itself.
- **Testing**: small methods are easy to check, which is exactly how this course's checker works.

## Common mistakes

- Printing a result instead of returning it, then trying to use it in a calculation.
- "missing return statement": some path through a non-void method doesn't return.
- Calling an instance method from `static main` without an object.
- Writing code after a `return`, which never runs.

## Exercises

### 1. Max of three

Write `static int maxOfThree(int a, int b, int c)` that returns the largest of the three, **without** using `Math.max`.

Starter code:

```java
public class Main {
    static int maxOfThree(int a, int b, int c) {
        return a;
    }

    public static void main(String[] args) {
        System.out.println(maxOfThree(3, 9, 4));
    }
}
```

### 2. BMI

Write `static double bmi(double weightKg, double heightM)` returning `weight / height²`, and `static String bmiCategory(double bmi)` returning `"underweight"` (below 18.5), `"normal"` (below 25), `"overweight"` (below 30) or `"obese"`.

Starter code:

```java
public class Main {
    static double bmi(double weightKg, double heightM) {
        return 0;
    }

    static String bmiCategory(double bmi) {
        return "";
    }

    public static void main(String[] args) {
        double b = bmi(70, 1.75);
        System.out.printf("%.1f %s%n", b, bmiCategory(b));
    }
}
```

**In the sandbox:** exercises 21–22. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Start with int max = a; then replace it with b or c if they're bigger.
2. bmi: return weightKg / (heightM * heightM). bmiCategory: a chain of if (bmi < ...) return ...; from low to high.

</details>

<details>
<summary>Answers</summary>

**1. Max of three**

```java
public class Main {
    static int maxOfThree(int a, int b, int c) {
        int max = a;
        if (b > max) {
            max = b;
        }
        if (c > max) {
            max = c;
        }
        return max;
    }

    public static void main(String[] args) {
        System.out.println(maxOfThree(3, 9, 4));
    }
}
```

**2. BMI**

```java
public class Main {
    static double bmi(double weightKg, double heightM) {
        return weightKg / (heightM * heightM);
    }

    static String bmiCategory(double bmi) {
        if (bmi < 18.5) {
            return "underweight";
        }
        if (bmi < 25) {
            return "normal";
        }
        if (bmi < 30) {
            return "overweight";
        }
        return "obese";
    }

    public static void main(String[] args) {
        double b = bmi(70, 1.75);
        System.out.printf("%.1f %s%n", b, bmiCategory(b));
    }
}
```

</details>

## Quick quiz

1. What does a `void` method return?
   - A) Nothing
   - B) 0
   - C) null

2. Why does "missing return statement" appear?
   - A) `return` must be the first line
   - B) Some path through a non-void method doesn't return a value
   - C) The method has too many returns

3. In `int area(int w, int h)`, what are `w` and `h`?
   - A) Return types
   - B) Arguments
   - C) Parameters

<details>
<summary>Quiz answers</summary>

1. **A) Nothing**: `void` means the method doesn't hand back a value.
2. **B) Some path through a non-void method doesn't return a value**: Every possible path must end in a `return` (or throw an exception).
3. **C) Parameters**: Parameters are in the definition; arguments are the values in a call.

</details>

---
Previous: [Lesson 13](13-two-d-arrays.md) · Next: [Lesson 15: Overloading, scope and pass-by-value](15-overloading-and-scope.md)
