# Lesson 15: Sets

**You'll learn:** unique values, membership, union `|`, intersection `&`, difference `-`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python/#sets)**: run every example and check your exercise answers.

## Key terms

- **Set:** an unordered collection of unique values.
- **Union (`|`):** items in either set.
- **Intersection (`&`):** items in both sets.
- **Difference (`-`):** items in the first set but not the second.
- **Symmetric difference (`^`):** items in exactly one of the sets.
- **Hashing:** the technique that makes set and dict lookups fast.

A **set** is an unordered collection of **unique** values. Duplicates disappear automatically.

```python
tags = {"python", "code", "python", "fun"}
print(tags)
print(len(tags))

numbers = [1, 2, 2, 3, 3, 3]
print(set(numbers))       # remove duplicates
```

`{}` creates an empty **dictionary**, so use `set()` for an empty set.

## Fast membership tests

Checking `x in some_set` is very fast, even for millions of items, because sets use hashing (as dictionaries do). Checking `x in some_list` has to look at items one by one.

```python
seen = set()
for word in ["red", "blue", "red", "green", "blue"]:
    if word in seen:
        print("Duplicate:", word)
    seen.add(word)
```

## Set operations

```python
python_devs = {"Ana", "Ben", "Cy"}
java_devs = {"Ben", "Dee"}

print(python_devs | java_devs)   # union: in either
print(python_devs & java_devs)   # intersection: in both
print(python_devs - java_devs)   # difference: only Python
print(python_devs ^ java_devs)   # symmetric difference: in exactly one
```

![Four Venn diagrams of python_devs and java_devs: union shades everything, intersection only Ben, difference only Ana and Cy, symmetric difference everyone except Ben](../figures/set-operations.svg)

## Adding and removing

```python
s = {1, 2}
s.add(3)
s.discard(10)    # no error if missing (remove() would raise KeyError)
print(s, 2 in s)
```

Sets have no order and no indexes, so `s[0]` doesn't work. Convert to a sorted list when order matters: `sorted(s)`.

## Common mistakes

- Writing `{}` for an empty set. That's an empty dict; use `set()`.
- Indexing a set with `s[0]`. Sets have no order; use `sorted(s)` if you need one.
- Expecting a set to keep duplicates or insertion order.

## Exercises

### 1. Common interests

Write `shared(a, b)` that takes two lists of hobbies and returns a **sorted list** of the hobbies that appear in both, without duplicates.

Starter code:

```python
def shared(a, b):
    return []

print(shared(["chess", "hiking", "chess", "art"], ["art", "chess", "golf"]))
```

**In the sandbox:** exercise 23. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Convert both to sets, use &, then sorted(...).

</details>

<details>
<summary>Answers</summary>

**1. Common interests**

```python
def shared(a, b):
    return sorted(set(a) & set(b))

print(shared(["chess", "hiking", "chess", "art"], ["art", "chess", "golf"]))
```

</details>

## Quick quiz

1. What does `type({})` give?
   - A) dict
   - B) set

2. What is `{1, 2, 3} - {2, 4}`?
   - A) {1, 3, 4}
   - B) {4}
   - C) {1, 3}

<details>
<summary>Quiz answers</summary>

1. **A) dict**: Empty braces make an empty dictionary. Use `set()` for an empty set.
2. **C) {1, 3}**: Difference keeps items in the first set that aren't in the second.

</details>

---
Previous: [Lesson 14](14-dictionaries.md) · Next: [Lesson 16: Comprehensions](16-comprehensions.md)
