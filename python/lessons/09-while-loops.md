# Lesson 9: while loops

**You'll learn:** `while`, loop conditions, infinite loops, accumulators, input loops.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python/#while-loops)**: run every example and check your exercise answers.

## Key terms

- **Loop:** code that repeats.
- **Iteration:** one pass through a loop.
- **while loop:** repeats while its condition is true.
- **Infinite loop:** a loop whose condition never becomes false.
- **Accumulator:** a variable that collects a running result, like a total.
- **Counter:** a variable that counts iterations.

A `while` loop repeats its block **as long as** its condition is true. Python checks the condition before every pass (each pass is called an **iteration**).

```python
count = 1
while count <= 5:
    print("Count is", count)
    count += 1
print("Done!")
```

Trace it by hand: `count` starts at 1, the block runs and increases it, and when `count` becomes 6 the condition is false and the loop ends.

## The infinite loop trap

If the condition never becomes false, the loop runs forever. Forgetting `count += 1` above would do exactly that. (In this browser editor, an infinite loop freezes the tab. If that happens, reload the page; your progress is kept.)

## Loops with an unknown number of steps

`while` shines when you don't know in advance how many iterations you need:

```python
balance = 1000
years = 0
while balance < 2000:
    balance *= 1.07        # 7% growth per year
    years += 1
print(f"Your money doubles in {years} years: ${balance:.2f}")
```

## Collecting a running total

A common pattern is an **accumulator**: a variable that starts at zero and grows in each iteration.

```python
n = 1
total = 0
while n <= 100:
    total += n
    n += 1
print("Sum of 1..100 =", total)
```

## Reading input until a stop word

*Input typed for this example: `apple`, `kiwi`, `mango`, `done`*

```python
items = []
item = input("Item (or 'done'): ")
while item != "done":
    items.append(item)
    item = input("Item (or 'done'): ")
print("You entered:", items)
```

(`items.append(...)` adds to a list; Part 3 covers lists in detail.)

## Common mistakes

- Forgetting to update the loop variable (`count += 1`), creating an infinite loop.
- Off-by-one conditions: `while n < 10` stops at 9; `while n <= 10` includes 10.
- Initialising the accumulator inside the loop, so it resets every time.

## Exercises

### 1. Collatz steps

The Collatz rule: if `n` is even, divide it by 2; if odd, replace it with `3 * n + 1`. Repeat until `n` becomes 1.

Write `collatz_steps(n)` that returns **how many steps** it takes to reach 1. For example, 6 → 3 → 10 → 5 → 16 → 8 → 4 → 2 → 1 takes 8 steps.

Starter code:

```python
def collatz_steps(n):
    steps = 0
    # your while loop here

    return steps

print(collatz_steps(6))
```

**In the sandbox:** exercise 14. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Loop while n != 1. Inside, use if/else to update n, then add 1 to steps. Use // so n stays an int.

</details>

<details>
<summary>Answers</summary>

**1. Collatz steps**

```python
def collatz_steps(n):
    steps = 0
    while n != 1:
        if n % 2 == 0:
            n = n // 2
        else:
            n = 3 * n + 1
        steps += 1
    return steps

print(collatz_steps(6))
```

</details>

## Quick quiz

1. How many times does this print? `i = 0` / `while i < 3:` / `print(i)` / `i += 1`
   - A) 3
   - B) 4
   - C) 2

2. What's the most common cause of an infinite loop?
   - A) Indenting with 4 spaces
   - B) Using print inside a loop
   - C) The condition's variable is never updated inside the loop

<details>
<summary>Quiz answers</summary>

1. **A) 3**: It prints for i = 0, 1 and 2. When i reaches 3 the condition is false.
2. **C) The condition's variable is never updated inside the loop**: If nothing inside the loop moves the condition towards False, it stays True forever.

</details>

---
Previous: [Lesson 8](08-if-statements.md) · Next: [Lesson 10: for loops and range](10-for-loops.md)
