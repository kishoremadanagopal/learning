# Lesson 13: 2D arrays

**You'll learn:** arrays of arrays, `grid[row][col]`, nested loops, `Arrays.deepToString`, jagged arrays.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/java/#two-d-arrays)**: run every example and check your exercise answers.

## Key terms

- **2D array:** an array whose elements are arrays, used for grids and tables.
- **Row / column:** the first and second index in `grid[row][col]`.
- **Jagged array:** a 2D array whose rows have different lengths.
- **Arrays.deepToString:** prints nested arrays readably.

A **2D array** is an array of arrays: perfect for grids, game boards and tables.

```java
public class Main {
    public static void main(String[] args) {
        int[][] grid = {
            {1, 2, 3},
            {4, 5, 6}
        };
        System.out.println(grid[1][2]);          // row 1, column 2
        System.out.println(grid.length + " rows, " + grid[0].length + " columns");
    }
}
```

`grid[row][col]`: the first index picks the row, the second picks the column.

![A grid of 2 rows and 3 columns holding 1 to 6: grid[1][2] is row 1, column 2, which is 6](../figures/two-d-array.svg)

## Looping over a grid

```java
public class Main {
    public static void main(String[] args) {
        int[][] grid = {
            {1, 2, 3},
            {4, 5, 6},
            {7, 8, 9}
        };
        int total = 0;
        for (int r = 0; r < grid.length; r++) {
            for (int c = 0; c < grid[r].length; c++) {
                System.out.print(grid[r][c] + " ");
                total += grid[r][c];
            }
            System.out.println();
        }
        System.out.println("total = " + total);

        for (int[] row : grid) {             // for-each works too
            System.out.println(java.util.Arrays.toString(row));
        }
    }
}
```

## Creating an empty grid

```java
import java.util.Arrays;

public class Main {
    public static void main(String[] args) {
        char[][] board = new char[3][3];
        for (char[] row : board) {
            Arrays.fill(row, '.');
        }
        board[1][1] = 'X';
        board[0][2] = 'O';
        for (char[] row : board) {
            System.out.println(new String(row));
        }
        System.out.println(Arrays.deepToString(new int[2][3]));
    }
}
```

`Arrays.deepToString` prints nested arrays. Rows don't even have to be the same length; such arrays are called **jagged**.

## Common mistakes

- Swapping row and column indexes.
- Using `grid.length` for the number of columns. That's `grid[row].length`.
- Printing a 2D array with `Arrays.toString` instead of `deepToString`.

## Exercises

### 1. Row sums

Write `static int[] rowSums(int[][] grid)` returning an array with the sum of each row. For `{{1, 2}, {3, 4}, {5, 6}}` it returns `{3, 7, 11}`.

Starter code:

```java
import java.util.Arrays;

public class Main {
    static int[] rowSums(int[][] grid) {
        return new int[0];
    }

    public static void main(String[] args) {
        int[][] g = {{1, 2}, {3, 4}, {5, 6}};
        System.out.println(Arrays.toString(rowSums(g)));
    }
}
```

**In the sandbox:** exercise 20. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Create int[] sums = new int[grid.length]. For each row r, add every value in grid[r] to sums[r].

</details>

<details>
<summary>Answers</summary>

**1. Row sums**

```java
import java.util.Arrays;

public class Main {
    static int[] rowSums(int[][] grid) {
        int[] sums = new int[grid.length];
        for (int r = 0; r < grid.length; r++) {
            for (int value : grid[r]) {
                sums[r] += value;
            }
        }
        return sums;
    }

    public static void main(String[] args) {
        int[][] g = {{1, 2}, {3, 4}, {5, 6}};
        System.out.println(Arrays.toString(rowSums(g)));
    }
}
```

</details>

## Quick quiz

1. In `int[][] g = new int[3][5];`, what is `g.length`?
   - A) 15
   - B) 5
   - C) 3

2. How do you print a 2D array readably?
   - A) `Arrays.deepToString(g)`
   - B) `System.out.println(g)`
   - C) `Arrays.toString(g)`

<details>
<summary>Quiz answers</summary>

1. **C) 3**: `g.length` is the number of rows; `g[0].length` is the number of columns.
2. **A) `Arrays.deepToString(g)`**: `deepToString` goes inside the nested arrays.

</details>

---
Previous: [Lesson 12](12-arrays.md) · Next: [Lesson 14: Methods](14-methods.md)
