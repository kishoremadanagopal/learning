# Lesson 12: Lists

**You'll learn:** creating lists, indexing, `append`/`insert`/`remove`/`pop`, sorting, references, nested lists.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python/#lists)**: run every example and check your exercise answers.

## Key terms

- **List:** an ordered, changeable collection in square brackets.
- **Element (item):** one value in a list.
- **Mutable:** can be changed in place. Lists are mutable.
- **Method:** a function attached to a value, called with a dot: `items.append(x)`.
- **sorted() vs .sort():** `sorted()` returns a new list; `.sort()` sorts in place and returns `None`.
- **Reference:** a name pointing at an object. Two names can refer to the same list.
- **Shallow copy:** a new list with the same items, made with `.copy()`, `list(x)` or `x[:]`.

A **list** holds an ordered collection of values in square brackets. Lists can grow, shrink and change. They are **mutable**.

```python
fruits = ["apple", "banana", "cherry"]
numbers = [3, 1, 4, 1, 5]
mixed = ["Ada", 36, True]
empty = []
print(fruits, len(fruits))
```

## Reading items

Indexing and slicing work just like strings:

```python
fruits = ["apple", "banana", "cherry", "date"]
print(fruits[0], fruits[-1])
print(fruits[1:3])
```

## Changing items

Unlike strings, you can change list items in place:

```python
fruits = ["apple", "banana", "cherry"]
fruits[1] = "blueberry"
print(fruits)
```

## Adding and removing

| Method | What it does |
|---|---|
| `lst.append(x)` | add `x` to the end |
| `lst.insert(i, x)` | insert `x` at position `i` |
| `lst.extend(other)` | add every item from `other` |
| `lst.remove(x)` | remove the first `x` (error if missing) |
| `lst.pop()` | remove and return the last item |
| `lst.pop(i)` | remove and return item `i` |
| `del lst[i]` | delete item `i` |

```python
tasks = ["email"]
tasks.append("code review")
tasks.insert(0, "coffee")
tasks.extend(["lunch", "deploy"])
print(tasks)

done = tasks.pop(0)
tasks.remove("lunch")
print("Finished:", done)
print("Left:", tasks)
```

## Searching and counting

```python
nums = [3, 1, 4, 1, 5, 9]
print(4 in nums)
print(nums.index(5))     # position of the first 5
print(nums.count(1))
print(sum(nums), min(nums), max(nums))
```

## Sorting

`sorted(lst)` returns a **new** sorted list. `lst.sort()` sorts the list **in place** and returns `None`.

```python
nums = [3, 1, 4, 1, 5, 9]
print(sorted(nums))
print(sorted(nums, reverse=True))
print(nums)          # unchanged
nums.sort()
print(nums)          # now sorted
```

A classic bug is `nums = nums.sort()`, which sets `nums` to `None`.

## Lists are references

Assigning a list to another variable does **not** copy it. Both names refer to the same list:

![b = a gives the same list two names, so appending through b changes a; a.copy() makes a separate list](../figures/list-references.svg)

```python
a = [1, 2, 3]
b = a
b.append(4)
print(a)        # a changed too!

c = a.copy()    # or a[:] or list(a)
c.append(5)
print(a, c)
```

## Lists of lists

Lists can contain other lists, which is handy for grids and tables:

```python
grid = [
    [1, 2, 3],
    [4, 5, 6],
]
print(grid[1][2])
for row in grid:
    print(row)
```

## Common mistakes

- Writing `nums = nums.sort()`, which sets `nums` to `None`.
- Expecting `b = a` to copy a list. Both names refer to the same list; use `a.copy()`.
- Calling `.remove(x)` when `x` might be missing, which raises `ValueError`. Check with `in` first.
- Confusing `append` (adds one item) with `extend` (adds every item from another list).

## Exercises

### 1. Shopping list manager

Starting from `cart = ["bread", "milk"]`, write code that:

1. adds `"eggs"` to the end,
2. inserts `"coffee"` at the front,
3. removes `"milk"`,
4. sorts the list alphabetically in place.

The final list should be `['bread', 'coffee', 'eggs']`.

Starter code:

```python
cart = ["bread", "milk"]

print(cart)
```

### 2. Second largest

Write `second_largest(nums)` that returns the second largest **distinct** value. For `[4, 9, 2, 9, 7]` it returns `7`. You can assume there are at least two distinct values.

Starter code:

```python
def second_largest(nums):
    return max(nums)

print(second_largest([4, 9, 2, 9, 7]))
```

**In the sandbox:** exercises 18–19. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. cart.append("eggs"), cart.insert(0, "coffee"), cart.remove("milk"), cart.sort()
2. Remove duplicates with set(nums), sort the result with sorted(...), then take the item at index -2. (Sets come up two lessons from now.) You can also loop and track the top two values.

</details>

<details>
<summary>Answers</summary>

**1. Shopping list manager**

```python
cart = ["bread", "milk"]
cart.append("eggs")
cart.insert(0, "coffee")
cart.remove("milk")
cart.sort()
print(cart)
```

**2. Second largest**

```python
def second_largest(nums):
    unique = sorted(set(nums))
    return unique[-2]

print(second_largest([4, 9, 2, 9, 7]))
```

</details>

## Quick quiz

1. After `x = [1, 2]`, `y = x`, `y.append(3)`, what is `x`?
   - A) [1, 2, 3]
   - B) An error
   - C) [1, 2]

2. What does `[3, 1, 2].sort()` return?
   - A) [3, 2, 1]
   - B) [1, 2, 3]
   - C) None

3. How do you get the last item of a list `items`?
   - A) `items[len(items)]`
   - B) `items[-1]`
   - C) `items.last()`

<details>
<summary>Quiz answers</summary>

1. **A) [1, 2, 3]**: `y = x` doesn't copy; both names refer to the same list.
2. **C) None**: `.sort()` sorts in place and returns None. Use `sorted()` to get a new list back.
3. **B) `items[-1]`**: `items[len(items)]` is one past the end and raises IndexError.

</details>

---
Previous: [Lesson 11](11-loop-control.md) · Next: [Lesson 13: Tuples and unpacking](13-tuples-and-unpacking.md)
