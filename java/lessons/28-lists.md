# Lesson 28: Lists

**You'll learn:** `ArrayList`, `List.of`, add/get/set/remove, iteration, `removeIf`, `ArrayList` vs `LinkedList`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/java/#lists)**: run every example and check your exercise answers.

## Key terms

- **List:** an ordered collection that allows duplicates.
- **ArrayList:** a resizable list backed by an array.
- **List.of:** creates an unmodifiable list.
- **Iterator:** an object that walks a collection and can remove items safely.
- **ConcurrentModificationException:** thrown when a collection changes while being iterated.

A **List** is an ordered collection that can grow and shrink. `List` is an interface; `ArrayList` is the implementation you'll use most.

```java
import java.util.ArrayList;
import java.util.List;

public class Main {
    public static void main(String[] args) {
        List<String> tasks = new ArrayList<>();
        tasks.add("email");
        tasks.add("code review");
        tasks.add(0, "coffee");                  // insert at a position
        System.out.println(tasks);
        System.out.println(tasks.size() + " tasks, first is " + tasks.get(0));

        tasks.set(1, "reply to email");          // replace
        tasks.remove("code review");             // remove by value
        String done = tasks.remove(0);           // remove by index, returns it
        System.out.println("Done: " + done + ", left: " + tasks);
        System.out.println(tasks.contains("reply to email") + " " + tasks.indexOf("lunch"));
    }
}
```

Declaring the variable as `List<String>` (the interface) rather than `ArrayList<String>` is good practice: the code then works with any kind of list.

## Common methods

| Method | What it does |
|---|---|
| `add(x)` / `add(i, x)` | append / insert |
| `get(i)` / `set(i, x)` | read / replace |
| `remove(i)` / `remove(x)` | by index / by value |
| `size()`, `isEmpty()` | count, empty? |
| `contains(x)`, `indexOf(x)` | search (uses `equals`) |
| `clear()` | remove everything |
| `addAll(other)` | append another collection |

## Creating lists quickly

```java
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

public class Main {
    public static void main(String[] args) {
        List<Integer> fixed = List.of(3, 1, 2);          // immutable
        List<Integer> nums = new ArrayList<>(fixed);      // a modifiable copy
        Collections.sort(nums);
        System.out.println(nums);
        Collections.reverse(nums);
        System.out.println(nums + " max=" + Collections.max(nums));
        List<String> fromArray = new ArrayList<>(Arrays.asList("b", "a"));
        fromArray.sort(null);                             // natural order
        System.out.println(fromArray);
    }
}
```

`List.of(...)` creates an **unmodifiable** list. Calling `add` on it throws `UnsupportedOperationException`. Wrap it in `new ArrayList<>(...)` when you need to change it.

## The remove(int) trap with Integer lists

For a `List<Integer>`, `remove(1)` removes **index** 1, not the value 1. Use `remove(Integer.valueOf(1))` for the value:

```java
import java.util.ArrayList;
import java.util.List;

public class Main {
    public static void main(String[] args) {
        List<Integer> nums = new ArrayList<>(List.of(10, 1, 20, 1));
        nums.remove(1);                       // removes the element at index 1
        System.out.println(nums);
        nums.remove(Integer.valueOf(1));      // removes the value 1
        System.out.println(nums);
    }
}
```

## Removing while iterating

Changing a list while a for-each loop walks over it throws `ConcurrentModificationException`. Use `removeIf`, or an explicit `Iterator`:

```java
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

public class Main {
    public static void main(String[] args) {
        List<Integer> nums = new ArrayList<>(List.of(1, 2, 3, 4, 5, 6));
        nums.removeIf(n -> n % 2 == 0);       // a lambda; Part 6 explains them
        System.out.println(nums);

        Iterator<Integer> it = nums.iterator();
        while (it.hasNext()) {
            if (it.next() > 3) {
                it.remove();
            }
        }
        System.out.println(nums);
    }
}
```

## ArrayList or LinkedList?

`ArrayList` stores elements in an array: `get(i)` is instant, but inserting at the front shifts everything. `LinkedList` links nodes: adding and removing at the ends is fast, but `get(i)` walks the chain. In practice `ArrayList` is the right choice almost every time; for a queue, use `ArrayDeque`.

## Common mistakes

- Calling `add` on a `List.of(...)` list.
- `remove(1)` on a `List<Integer>` removes index 1, not the value 1.
- Removing items inside a for-each loop over the same list.
- Declaring variables as `ArrayList` instead of the `List` interface.

## Exercises

### 1. Shopping list

Write `static List<String> shoppingList()` that builds and returns a **modifiable** list by: adding `"bread"` and `"milk"`, inserting `"coffee"` at the front, adding `"eggs"`, removing `"milk"`, and finally sorting it alphabetically. The result is `[bread, coffee, eggs]`.

Starter code:

```java
import java.util.*;

public class Main {
    static List<String> shoppingList() {
        List<String> cart = new ArrayList<>();
        return cart;
    }

    public static void main(String[] args) {
        System.out.println(shoppingList());
    }
}
```

### 2. Remove duplicates, keep order

Write `static List<Integer> unique(List<Integer> nums)` returning a **new** list with duplicates removed, keeping the first occurrence order. `unique([3, 1, 3, 2, 1])` → `[3, 1, 2]`.

Starter code:

```java
import java.util.*;

public class Main {
    static List<Integer> unique(List<Integer> nums) {
        return nums;
    }

    public static void main(String[] args) {
        System.out.println(unique(List.of(3, 1, 3, 2, 1)));
    }
}
```

**In the sandbox:** exercises 40–41. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. cart.add("bread"); cart.add("milk"); cart.add(0, "coffee"); cart.add("eggs"); cart.remove("milk"); Collections.sort(cart);
2. Build a new ArrayList. Loop over nums and add each number only if result doesn't already contain it. (A LinkedHashSet, from the next lesson, does this in one line.)

</details>

<details>
<summary>Answers</summary>

**1. Shopping list**

```java
import java.util.*;

public class Main {
    static List<String> shoppingList() {
        List<String> cart = new ArrayList<>();
        cart.add("bread");
        cart.add("milk");
        cart.add(0, "coffee");
        cart.add("eggs");
        cart.remove("milk");
        Collections.sort(cart);
        return cart;
    }

    public static void main(String[] args) {
        System.out.println(shoppingList());
    }
}
```

**2. Remove duplicates, keep order**

```java
import java.util.*;

public class Main {
    static List<Integer> unique(List<Integer> nums) {
        List<Integer> result = new ArrayList<>();
        for (Integer n : nums) {
            if (!result.contains(n)) {
                result.add(n);
            }
        }
        return result;
    }

    public static void main(String[] args) {
        System.out.println(unique(List.of(3, 1, 3, 2, 1)));
    }
}
```

</details>

## Quick quiz

1. What does `List.of(1, 2).add(3)` do?
   - A) Throws UnsupportedOperationException
   - B) Doesn't compile
   - C) Returns [1, 2, 3]

2. For `List<Integer> list = [10, 20, 30]`, what does `list.remove(1)` remove?
   - A) The value 1
   - B) 20 (the element at index 1)
   - C) 10

3. What happens if you remove from a list inside a for-each loop over it?
   - A) It works fine
   - B) Elements are skipped silently, always
   - C) ConcurrentModificationException

<details>
<summary>Quiz answers</summary>

1. **A) Throws UnsupportedOperationException**: `List.of` lists are unmodifiable.
2. **B) 20 (the element at index 1)**: An int argument chooses `remove(int index)`. Use `remove(Integer.valueOf(1))` for the value.
3. **C) ConcurrentModificationException**: Use `removeIf` or an `Iterator`'s `remove` instead.

</details>

---
Previous: [Lesson 27](27-generics.md) · Next: [Lesson 29: Sets and maps](29-sets-and-maps.md)
