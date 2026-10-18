# Lesson 7: Booleans and comparisons

**You'll learn:** `==` `!=` `<` `>`, `and` / `or` / `not`, truthiness, `in`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python/#booleans-and-comparisons)**: run every example and check your exercise answers.

## Key terms

- **Boolean expression:** an expression that results in `True` or `False`.
- **Comparison operator:** `==`, `!=`, `<`, `>`, `<=`, `>=`.
- **Logical operator:** `and`, `or`, `not`, which combine or flip booleans.
- **Short-circuiting:** Python stops evaluating `and` / `or` as soon as the answer is known.
- **Truthy / falsy:** whether a value counts as `True` or `False`. `0`, `""`, `[]`, `{}` and `None` are falsy.
- **Membership test:** checking whether a value is inside another with `in`.

Programs make decisions by asking yes/no questions. The answer is a **boolean**: `True` or `False`.

## Comparison operators

| Operator | Meaning |
|---|---|
| `==` | equal to |
| `!=` | not equal to |
| `<` `>` | less than, greater than |
| `<=` `>=` | less or equal, greater or equal |

```python
age = 20
print(age >= 18)
print(age == 21)
print(age != 21)
print("apple" < "banana")   # strings compare alphabetically
```

**Common mistake:** `=` assigns a value, `==` compares. Writing `if age = 18:` is a syntax error.

Python lets you chain comparisons the way you would in math:

```python
temp = 22
print(18 <= temp <= 25)
```

## Combining conditions

- `and` is `True` only if **both** sides are true.
- `or` is `True` if **at least one** side is true.
- `not` flips `True` and `False`.

```python
has_ticket = True
is_vip = False
age = 16

print(has_ticket and age >= 18)
print(has_ticket or is_vip)
print(not is_vip)
```

Python stops evaluating as soon as it knows the answer. This is called **short-circuiting**: in `False and anything`, the right side never runs.

## Truthiness

Every value can act as a boolean. These are **falsy** (treated as `False`): `0`, `0.0`, `""` (empty string), `[]`, `{}`, `None` and `False`. Everything else is **truthy**.

```python
print(bool(0), bool(42))
print(bool(""), bool("hi"))
print(bool([]), bool([0]))
print(bool(None))
```

This lets you write `if name:` instead of `if name != "":`.

## `in`: membership tests

`in` checks whether something is inside something else:

```python
print("py" in "python")
print("z" in "python")
print(3 in [1, 2, 3])
```

## Common mistakes

- Using `=` instead of `==` in a condition.
- Writing `x == 1 or 2` instead of `x == 1 or x == 2` (or `x in (1, 2)`). The first is always true.
- Reading "at least 18" as `> 18`. "At least" is `>=`; "over" is `>`.
- Testing `if name != "":` when `if name:` says the same thing more clearly.

## Exercises

### 1. Can they ride?

A theme park ride requires a rider to be **at least 120 cm tall** and **under 200 kg**, *or* to have a `staff_pass`. Set `can_ride` to the correct boolean using the three variables. Don't use `if`; write a single boolean expression.

Starter code:

```python
height = 125
weight = 80
staff_pass = False

can_ride = False  # replace with a boolean expression
print(can_ride)
```

**In the sandbox:** exercise 11. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. (height >= 120 and weight < 200) or staff_pass

</details>

<details>
<summary>Answers</summary>

**1. Can they ride?**

```python
height = 125
weight = 80
staff_pass = False

can_ride = (height >= 120 and weight < 200) or staff_pass
print(can_ride)
```

</details>

## Quick quiz

1. What does `5 == 5.0` give?
   - A) True
   - B) False
   - C) An error

2. Which value is falsy?
   - A) `"0"`
   - B) `""`
   - C) `[0]`

3. What is `not (3 > 2 and 2 > 5)`?
   - A) True
   - B) False

<details>
<summary>Quiz answers</summary>

1. **A) True**: Python compares the numeric values, and 5 equals 5.0.
2. **B) `""`**: An empty string is falsy. `"0"` is a non-empty string and `[0]` is a non-empty list, so both are truthy.
3. **A) True**: `3 > 2` is True, `2 > 5` is False, so the `and` is False and `not` flips it to True.

</details>

---
Previous: [Lesson 6](06-input-and-conversion.md) · Next: [Lesson 8: if, elif and else](08-if-statements.md)
