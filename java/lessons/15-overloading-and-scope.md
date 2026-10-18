# Lesson 15: Overloading, scope and pass-by-value

**You'll learn:** overloading, scope, pass-by-value, varargs.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/java/#overloading-and-scope)**: run every example and check your exercise answers.

## Key terms

- **Overloading:** several methods with the same name and different parameter lists.
- **Scope:** the region of code where a variable exists.
- **Local variable:** a variable declared inside a method or block.
- **Pass-by-value:** Java passes copies of arguments; for objects, a copy of the reference.
- **Varargs:** a parameter like `int... nums` that accepts any number of arguments as an array.

### Overloading

Several methods can share a name if their **parameter lists differ**. Java picks the right one from the arguments you pass. `System.out.println` is overloaded for every type, which is why it prints ints, doubles and strings alike.

```java
public class Main {
    static int add(int a, int b) {
        return a + b;
    }

    static double add(double a, double b) {
        return a + b;
    }

    static int add(int a, int b, int c) {
        return a + b + c;
    }

    public static void main(String[] args) {
        System.out.println(add(2, 3));
        System.out.println(add(2.5, 3.1));
        System.out.println(add(1, 2, 3));
    }
}
```

The return type alone isn't enough to overload: two methods that differ only in return type won't compile.

## Scope: where variables live

A variable exists only inside the **block** `{ }` where it's declared. Variables declared inside a method are **local** to that method.

```java
public class Main {
    static int counter = 0;               // a static field: visible to every method in the class

    static void increment() {
        counter++;
        int temp = 5;                     // local to increment()
    }

    public static void main(String[] args) {
        increment();
        increment();
        System.out.println(counter);

        for (int i = 0; i < 2; i++) {
            int squared = i * i;          // exists only inside this loop body
        }
        // System.out.println(squared);  // would not compile: squared is out of scope
    }
}
```

Keep variables in the smallest scope that works. Fewer variables in view means fewer surprises.

## Pass-by-value

Java always passes **copies** of arguments. For primitives, the method gets its own copy, so changing it doesn't affect the caller:

```java
public class Main {
    static void tryToChange(int x) {
        x = 100;
    }

    static void changeArray(int[] arr) {
        arr[0] = 100;             // changes the array the caller also sees
    }

    static void replaceArray(int[] arr) {
        arr = new int[]{7, 7};    // only changes the local copy of the reference
    }

    public static void main(String[] args) {
        int n = 5;
        tryToChange(n);
        System.out.println(n);

        int[] data = {1, 2};
        changeArray(data);
        System.out.println(data[0]);
        replaceArray(data);
        System.out.println(data[0]);
    }
}
```

For arrays and objects, the copied value is a **reference**. The method can change the object it points to, but pointing its own copy at a new object doesn't affect the caller.

## Variable arguments

`int... nums` lets a method take any number of ints; inside, `nums` is an array:

```java
public class Main {
    static int sum(int... nums) {
        int total = 0;
        for (int n : nums) {
            total += n;
        }
        return total;
    }

    public static void main(String[] args) {
        System.out.println(sum());
        System.out.println(sum(4));
        System.out.println(sum(1, 2, 3, 4));
    }
}
```

## Common mistakes

- Trying to overload by return type alone.
- Using a variable outside the block where it was declared.
- Expecting a method to change the caller's primitive variable.
- Reassigning an array parameter and expecting the caller's array to change.

## Exercises

### 1. Describe overloads

Write two overloaded methods named `describe`: `describe(int n)` returns `"int: "` followed by the number, and `describe(String s)` returns `"text: "` followed by the text in uppercase.

Starter code:

```java
public class Main {

    public static void main(String[] args) {
        // System.out.println(describe(42));
        // System.out.println(describe("hi"));
    }
}
```

### 2. Average of any count

Write `static double average(double... values)` that returns the average of any number of values, or `0` when called with none.

Starter code:

```java
public class Main {
    static double average(double... values) {
        return 0;
    }

    public static void main(String[] args) {
        System.out.println(average(1, 2, 3, 4));
    }
}
```

**In the sandbox:** exercises 23–24. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Write static String describe(int n) { ... } and static String describe(String s) { ... } next to main.
2. Inside the method, values is an array. Check values.length == 0 first, then add them up and divide.

</details>

<details>
<summary>Answers</summary>

**1. Describe overloads**

```java
public class Main {
    static String describe(int n) {
        return "int: " + n;
    }

    static String describe(String s) {
        return "text: " + s.toUpperCase();
    }

    public static void main(String[] args) {
        System.out.println(describe(42));
        System.out.println(describe("hi"));
    }
}
```

**2. Average of any count**

```java
public class Main {
    static double average(double... values) {
        if (values.length == 0) {
            return 0;
        }
        double total = 0;
        for (double v : values) {
            total += v;
        }
        return total / values.length;
    }

    public static void main(String[] args) {
        System.out.println(average(1, 2, 3, 4));
    }
}
```

</details>

## Quick quiz

1. Can two methods differ only in their return type?
   - A) Yes
   - B) No, the parameter lists must differ

2. After `void f(int x) { x = 9; }` and `int n = 1; f(n);`, what is `n`?
   - A) 1
   - B) 9

3. A method receives an array and sets `arr[0] = 5`. Does the caller see it?
   - A) No, arrays are copied
   - B) Yes, both refer to the same array

<details>
<summary>Quiz answers</summary>

1. **B) No, the parameter lists must differ**: Java chooses an overload by its arguments, so the parameters must differ.
2. **A) 1**: Java passes a copy of the value; the method changes only its copy.
3. **B) Yes, both refer to the same array**: The reference is copied, but it points to the same array object.

</details>

---
Previous: [Lesson 14](14-methods.md) · Next: [Lesson 16: Recursion](16-recursion.md)
