# Lesson 16: Recursion

**You'll learn:** base case, recursive case, the call stack, `StackOverflowError`, divide and conquer.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/java/#recursion)**: run every example and check your exercise answers.

## Key terms

- **Recursion:** a method calling itself on a smaller version of the problem.
- **Base case:** the condition where the method answers without recursing.
- **Recursive case:** the part that calls the method again with a smaller input.
- **Call stack:** the chain of method calls waiting to finish.
- **StackOverflowError:** thrown when calls go too deep, usually because a base case is missing.
- **Divide and conquer:** splitting a problem into parts, solving each, and combining the results.

A **recursive** method calls itself to solve a smaller version of the same problem. It needs:

1. A **base case** that answers directly, without recursing.
2. A **recursive case** that moves towards the base case.

```java
public class Main {
    static void countdown(int n) {
        if (n == 0) {                 // base case
            System.out.println("Liftoff!");
            return;
        }
        System.out.println(n);
        countdown(n - 1);             // recursive case: a smaller problem
    }

    public static void main(String[] args) {
        countdown(3);
    }
}
```

## Factorial

`n! = n × (n-1) × … × 1`, and `n! = n × (n-1)!`, a recursive definition:

![factorial(4) calls factorial(3), which calls factorial(2), which calls factorial(1); then the answers 1, 2, 6 and 24 come back up](../figures/recursion-stack.svg)

```java
public class Main {
    static long factorial(int n) {
        if (n <= 1) {
            return 1;
        }
        return n * factorial(n - 1);
    }

    public static void main(String[] args) {
        System.out.println(factorial(5));
        System.out.println(factorial(20));
    }
}
```

Each call waits on the **call stack** for the smaller call to finish; then the results multiply back up. `long` is used because 20! is too big for an `int`.

## Forgetting the base case

Without a base case the calls never stop, and the stack overflows:

*This example raises an error on purpose.*

```java
public class Main {
    static int forever(int n) {
        return forever(n + 1);
    }

    public static void main(String[] args) {
        System.out.println(forever(0));
    }
}
```

## Recursion for divide and conquer

Recursion shines when a problem splits into smaller copies of itself, like **binary search** on a sorted array: look at the middle, then search only the half that can contain the target.

```java
public class Main {
    static int search(int[] a, int target, int low, int high) {
        if (low > high) {
            return -1;                          // not found
        }
        int mid = (low + high) / 2;
        if (a[mid] == target) {
            return mid;
        }
        if (a[mid] < target) {
            return search(a, target, mid + 1, high);
        }
        return search(a, target, low, mid - 1);
    }

    public static void main(String[] args) {
        int[] sorted = {2, 5, 8, 12, 16, 23, 38, 56, 72, 91};
        System.out.println(search(sorted, 23, 0, sorted.length - 1));
        System.out.println(search(sorted, 7, 0, sorted.length - 1));
    }
}
```

Many recursive methods can also be written as loops, which use less memory. Use recursion when it makes the code clearer: trees, nested structures and divide-and-conquer algorithms.

## Common mistakes

- Missing or unreachable base case.
- Calling `f(n)` instead of `f(n - 1)`, so the problem never shrinks.
- Forgetting to `return` the recursive call's result.

## Exercises

### 1. Sum of digits

Write a **recursive** `static int digitSum(int n)` for non-negative `n`. `digitSum(1234)` is `10`. The last digit is `n % 10`; the rest is `n / 10`.

Starter code:

```java
public class Main {
    static int digitSum(int n) {
        return 0;
    }

    public static void main(String[] args) {
        System.out.println(digitSum(1234));
    }
}
```

### 2. Power

Write a recursive `static long power(long base, int exp)` for `exp >= 0`, without `Math.pow`.

Starter code:

```java
public class Main {
    static long power(long base, int exp) {
        return 1;
    }

    public static void main(String[] args) {
        System.out.println(power(2, 10));
    }
}
```

**In the sandbox:** exercises 25–26. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Base case: if n < 10, return n. Otherwise return n % 10 + digitSum(n / 10).
2. Anything to the power 0 is 1. Otherwise base^exp = base * power(base, exp - 1).

</details>

<details>
<summary>Answers</summary>

**1. Sum of digits**

```java
public class Main {
    static int digitSum(int n) {
        if (n < 10) {
            return n;
        }
        return n % 10 + digitSum(n / 10);
    }

    public static void main(String[] args) {
        System.out.println(digitSum(1234));
    }
}
```

**2. Power**

```java
public class Main {
    static long power(long base, int exp) {
        if (exp == 0) {
            return 1;
        }
        return base * power(base, exp - 1);
    }

    public static void main(String[] args) {
        System.out.println(power(2, 10));
    }
}
```

</details>

## Quick quiz

1. What happens if a recursive method never reaches a base case?
   - A) It throws StackOverflowError
   - B) It returns 0
   - C) It runs forever without error

2. Why is `factorial` declared to return `long`?
   - A) It makes it faster
   - B) Recursion requires long
   - C) Factorials grow beyond the range of int quickly

<details>
<summary>Quiz answers</summary>

1. **A) It throws StackOverflowError**: Each call uses stack memory; eventually the stack runs out.
2. **C) Factorials grow beyond the range of int quickly**: 13! already exceeds int's maximum of about 2.1 billion.

</details>

---
Previous: [Lesson 15](15-overloading-and-scope.md) · Next: [Lesson 17: Classes and objects](17-classes-and-objects.md)
