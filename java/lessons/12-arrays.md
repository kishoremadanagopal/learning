# Lesson 12: Arrays

**You'll learn:** creating arrays, indexing, `length`, default values, `Arrays.toString`, `Arrays.sort`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/java/#arrays)**: run every example and check your exercise answers.

## Key terms

- **Array:** a fixed-size sequence of values of one type.
- **Element:** one value in an array.
- **length:** an array's size (a field, so no parentheses).
- **Default value:** what new array elements start as: 0, false or null.
- **ArrayIndexOutOfBoundsException:** thrown when using an index outside 0 to length - 1.
- **Arrays class:** helpers like `toString`, `sort`, `fill`, `copyOf` and `equals`.
- **Reference:** a variable's link to an object, such as an array.

An **array** holds a fixed number of values of the same type. Each value is an **element**, reached by its index starting at 0.

```java
public class Main {
    public static void main(String[] args) {
        int[] scores = {90, 72, 85};
        String[] names = {"Ana", "Ben", "Cy"};

        System.out.println(scores[0]);
        System.out.println(names[2]);
        System.out.println("There are " + scores.length + " scores");

        scores[1] = 75;             // change an element
        System.out.println(scores[1]);
    }
}
```

Note `scores.length` has no parentheses: for arrays it's a field, while for strings it's a method, `s.length()`.

![The array scores holds 90, 72 and 85 at indexes 0, 1 and 2; its length is 3, so scores[3] is out of bounds](../figures/array.svg)

## Creating an empty array

`new int[5]` makes an array of 5 elements filled with default values: `0` for numbers, `false` for booleans, `'\u0000'` for chars and `null` for objects like strings.

```java
public class Main {
    public static void main(String[] args) {
        int[] squares = new int[5];
        for (int i = 0; i < squares.length; i++) {
            squares[i] = i * i;
        }
        for (int s : squares) {
            System.out.print(s + " ");
        }
        System.out.println();

        String[] empty = new String[2];
        System.out.println(empty[0]);
    }
}
```

An array's size is fixed once created. When you need a list that grows and shrinks, use `ArrayList` (Part 5).

## Out of bounds

Using an index outside `0` to `length - 1` throws an exception at runtime:

*This example raises an error on purpose.*

```java
public class Main {
    public static void main(String[] args) {
        int[] a = {1, 2, 3};
        System.out.println(a[3]);
    }
}
```

## Common array algorithms

```java
public class Main {
    public static void main(String[] args) {
        int[] nums = {4, 9, 2, 7, 5};

        int sum = 0;
        int max = nums[0];
        for (int n : nums) {
            sum += n;
            if (n > max) {
                max = n;
            }
        }
        double average = (double) sum / nums.length;
        System.out.println("sum=" + sum + " max=" + max + " avg=" + average);

        int target = 7;
        int found = -1;
        for (int i = 0; i < nums.length; i++) {
            if (nums[i] == target) {
                found = i;
                break;
            }
        }
        System.out.println("7 is at index " + found);
    }
}
```

## The Arrays helper class

`java.util.Arrays` has ready-made tools:

```java
import java.util.Arrays;

public class Main {
    public static void main(String[] args) {
        int[] nums = {4, 9, 2, 7, 5};
        System.out.println(nums);                    // not helpful: a memory reference
        System.out.println(Arrays.toString(nums));   // readable

        int[] copy = Arrays.copyOf(nums, nums.length);
        Arrays.sort(copy);
        System.out.println(Arrays.toString(copy));
        System.out.println(Arrays.toString(nums));   // original unchanged

        int[] filled = new int[4];
        Arrays.fill(filled, 7);
        System.out.println(Arrays.toString(filled));
        System.out.println(Arrays.equals(new int[]{1, 2}, new int[]{1, 2}));
    }
}
```

## Arrays are references

An array variable holds a **reference** to the array. Assigning it to another variable doesn't copy the array; both names point at the same one:

```java
import java.util.Arrays;

public class Main {
    public static void main(String[] args) {
        int[] a = {1, 2, 3};
        int[] b = a;
        b[0] = 99;
        System.out.println(Arrays.toString(a));   // a changed too!

        int[] c = a.clone();
        c[0] = 1;
        System.out.println(Arrays.toString(a) + " " + Arrays.toString(c));
    }
}
```

## Common mistakes

- Printing an array directly and getting `[I@1b6d3586`. Use `Arrays.toString`.
- Writing `arr.length()` (that's for strings) instead of `arr.length`.
- Expecting `b = a` to copy an array. Use `a.clone()` or `Arrays.copyOf`.
- Comparing arrays with `==` instead of `Arrays.equals`.

## Exercises

### 1. Statistics

Write `static double average(int[] nums)` returning the mean (return `0` for an empty array), and `static int countAbove(int[] nums, int limit)` returning how many values are strictly greater than `limit`.

Starter code:

```java
public class Main {
    static double average(int[] nums) {
        return 0;
    }

    static int countAbove(int[] nums, int limit) {
        return 0;
    }

    public static void main(String[] args) {
        int[] data = {4, 9, 2, 7, 5};
        System.out.println(average(data) + " " + countAbove(data, 4));
    }
}
```

### 2. Reverse in place

Write `static void reverse(int[] a)` that reverses the array **in place** (change `a` itself, don't create a new array). Swap the first and last elements, then the second and second-to-last, and so on.

Starter code:

```java
import java.util.Arrays;

public class Main {
    static void reverse(int[] a) {

    }

    public static void main(String[] args) {
        int[] nums = {1, 2, 3, 4, 5};
        reverse(nums);
        System.out.println(Arrays.toString(nums));
    }
}
```

**In the sandbox:** exercises 18–19. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Add up the numbers in a loop, then divide by nums.length after casting the sum to double. Remember the empty-array case.
2. Use two indexes, i from the start and j from the end. Swap a[i] and a[j] with a temporary variable, then move them towards each other until they meet.

</details>

<details>
<summary>Answers</summary>

**1. Statistics**

```java
public class Main {
    static double average(int[] nums) {
        if (nums.length == 0) {
            return 0;
        }
        int sum = 0;
        for (int n : nums) {
            sum += n;
        }
        return (double) sum / nums.length;
    }

    static int countAbove(int[] nums, int limit) {
        int count = 0;
        for (int n : nums) {
            if (n > limit) {
                count++;
            }
        }
        return count;
    }

    public static void main(String[] args) {
        int[] data = {4, 9, 2, 7, 5};
        System.out.println(average(data) + " " + countAbove(data, 4));
    }
}
```

**2. Reverse in place**

```java
import java.util.Arrays;

public class Main {
    static void reverse(int[] a) {
        for (int i = 0, j = a.length - 1; i < j; i++, j--) {
            int temp = a[i];
            a[i] = a[j];
            a[j] = temp;
        }
    }

    public static void main(String[] args) {
        int[] nums = {1, 2, 3, 4, 5};
        reverse(nums);
        System.out.println(Arrays.toString(nums));
    }
}
```

</details>

## Quick quiz

1. What is the last valid index of `int[] a = new int[5];`?
   - A) 6
   - B) 5
   - C) 4

2. What does `new boolean[3]` contain?
   - A) true, true, true
   - B) false, false, false
   - C) null, null, null

3. What does `System.out.println(Arrays.toString(new int[]{3, 1}))` print?
   - A) [3, 1]
   - B) [I@1b6d3586
   - C) 3, 1

<details>
<summary>Quiz answers</summary>

1. **C) 4**: Indexes run from 0 to length - 1.
2. **B) false, false, false**: New arrays are filled with default values: false for booleans.
3. **A) [3, 1]**: `Arrays.toString` formats the elements. Printing the array directly shows a reference.

</details>

---
Previous: [Lesson 11](11-break-continue.md) · Next: [Lesson 13: 2D arrays](13-two-d-arrays.md)
