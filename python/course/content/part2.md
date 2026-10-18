@@@ part
id: 2
title: Decisions and Loops
level: Beginner
blurb: Make programs react to data with if statements, and repeat work with while and for loops.

@@@ lesson
id: booleans-and-comparisons
title: Booleans and comparisons
minutes: 10
summary: Compare values, combine conditions with and, or, not, and understand truthiness.
---
Programs make decisions by asking yes/no questions. The answer is a **boolean**: `True` or `False`.

### Comparison operators

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

### Combining conditions

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

### Truthiness

Every value can act as a boolean. These are **falsy** (treated as `False`): `0`, `0.0`, `""` (empty string), `[]`, `{}`, `None` and `False`. Everything else is **truthy**.

```python
print(bool(0), bool(42))
print(bool(""), bool("hi"))
print(bool([]), bool([0]))
print(bool(None))
```

This lets you write `if name:` instead of `if name != "":`.

### `in`: membership tests

`in` checks whether something is inside something else:

```python
print("py" in "python")
print("z" in "python")
print(3 in [1, 2, 3])
```

:::exercise Can they ride?
A theme park ride requires a rider to be **at least 120 cm tall** and **under 200 kg**, *or* to have a `staff_pass`. Set `can_ride` to the correct boolean using the three variables. Don't use `if`; write a single boolean expression.
```python starter
height = 125
weight = 80
staff_pass = False

can_ride = False  # replace with a boolean expression
print(can_ride)
```
```python check
import re
expr_line = [ln for ln in __source__.splitlines() if ln.strip().startswith("can_ride")][0]
expr = expr_line.split("=", 1)[1].split("#")[0].strip()
for h, w, s, expected in [(125, 80, False, True), (110, 80, False, False), (125, 210, False, False), (100, 250, True, True), (120, 199, False, True)]:
    got = eval(expr, {"height": h, "weight": w, "staff_pass": s})
    assert got == expected, f"With height={h}, weight={w}, staff_pass={s} the answer should be {expected}, but your expression gives {got}"
```
```python solution
height = 125
weight = 80
staff_pass = False

can_ride = (height >= 120 and weight < 200) or staff_pass
print(can_ride)
```
hint: (height >= 120 and weight < 200) or staff_pass
:::

:::quiz
? What does `5 == 5.0` give?
+ True
- False
- An error
= Python compares the numeric values, and 5 equals 5.0.

? Which value is falsy?
- `"0"`
- `[0]`
+ `""`
= An empty string is falsy. `"0"` is a non-empty string and `[0]` is a non-empty list, so both are truthy.

? What is `not (3 > 2 and 2 > 5)`?
+ True
- False
= `3 > 2` is True, `2 > 5` is False, so the `and` is False and `not` flips it to True.
:::

@@@ lesson
id: if-statements
title: if, elif and else
minutes: 12
summary: Run code only when a condition is true and choose between several branches.
---
An `if` statement runs a block of code only when its condition is true.

```python
temperature = 31
if temperature > 30:
    print("It's hot today.")
    print("Drink some water.")
print("Have a nice day!")
```

Two things to notice:

1. The line ends with a **colon** `:`.
2. The code that belongs to the `if` is **indented** (4 spaces is the standard). Indentation isn't decoration in Python; it's how Python knows which lines are inside the block. The last `print` isn't indented, so it always runs.

### else and elif

`else` runs when the condition is false. `elif` ("else if") checks another condition. Python checks the branches from top to bottom and runs **only the first** one that matches.

![A flowchart for score = 82: the test score >= 90 is false, score >= 80 is true, so grade becomes B and the remaining tests are skipped](figures/if-elif.svg)

```python
score = 82
if score >= 90:
    grade = "A"
elif score >= 80:
    grade = "B"
elif score >= 70:
    grade = "C"
else:
    grade = "F"
print(f"Score {score} gets grade {grade}")
```

Order matters. If you checked `score >= 70` first, an 82 would get a C.

### Nested ifs

You can put an `if` inside another `if`. Keep nesting shallow; deeply nested code is hard to read. Often `and` can replace a level of nesting.

```python
logged_in = True
is_admin = False
if logged_in:
    if is_admin:
        print("Welcome to the admin panel")
    else:
        print("Welcome back")
else:
    print("Please log in")
```

### One-line conditional expressions

For choosing between two values, Python has a compact form: `value_if_true if condition else value_if_false`.

```python
n = 7
kind = "even" if n % 2 == 0 else "odd"
print(f"{n} is {kind}")
```

### match: checking one value against many options

Python 3.10 added `match`, which is tidy when you compare one value against several fixed options. `_` matches anything.

```python
command = "stop"
match command:
    case "start":
        print("Starting...")
    case "stop" | "quit":
        print("Stopping.")
    case _:
        print("Unknown command")
```

:::exercise FizzBuzz for one number
Write code that sets `result` based on the number `n`:

- `"FizzBuzz"` if `n` is divisible by both 3 and 5
- `"Fizz"` if divisible by 3 only
- `"Buzz"` if divisible by 5 only
- otherwise the number as a string, like `"7"`

Wrap it in the function `fizzbuzz(n)` that's already started for you (you'll learn functions properly in Part 4; for now, just indent your code inside it and keep the `return`).
```python starter
def fizzbuzz(n):
    result = str(n)
    # your if / elif / else here

    return result

print(fizzbuzz(15), fizzbuzz(9), fizzbuzz(10), fizzbuzz(7))
```
```python check
cases = {15: "FizzBuzz", 30: "FizzBuzz", 9: "Fizz", 3: "Fizz", 10: "Buzz", 5: "Buzz", 7: "7", 1: "1"}
for n, want in cases.items():
    got = fizzbuzz(n)
    assert got == want, f"fizzbuzz({n}) should be {want!r} but was {got!r}"
```
```python solution
def fizzbuzz(n):
    if n % 15 == 0:
        result = "FizzBuzz"
    elif n % 3 == 0:
        result = "Fizz"
    elif n % 5 == 0:
        result = "Buzz"
    else:
        result = str(n)
    return result

print(fizzbuzz(15), fizzbuzz(9), fizzbuzz(10), fizzbuzz(7))
```
hint: Check the "both" case first (n % 15 == 0, or n % 3 == 0 and n % 5 == 0). Otherwise a 15 would stop at the Fizz branch.
:::

:::exercise Ticket price
Write `ticket_price(age)` that returns: `0` for children under 3, `8` for ages 3 to 12, `15` for ages 13 to 64, and `10` for 65 and over.
```python starter
def ticket_price(age):
    return 15

print(ticket_price(2), ticket_price(10), ticket_price(30), ticket_price(70))
```
```python check
for age, want in [(0, 0), (2, 0), (3, 8), (12, 8), (13, 15), (64, 15), (65, 10), (90, 10)]:
    got = ticket_price(age)
    assert got == want, f"ticket_price({age}) should be {want} but was {got}"
```
```python solution
def ticket_price(age):
    if age < 3:
        return 0
    elif age <= 12:
        return 8
    elif age <= 64:
        return 15
    else:
        return 10

print(ticket_price(2), ticket_price(10), ticket_price(30), ticket_price(70))
```
hint: Check from youngest to oldest: if age < 3 ... elif age <= 12 ... elif age <= 64 ... else ...
:::

:::quiz
? With `x = 5`, what does this print? `if x > 3: print("big")` then `elif x > 1: print("small")`
+ `big`
- `small`
- `big`, then `small`
= Only the first matching branch runs. Once `x > 3` matches, the `elif` is skipped.

? What defines which lines belong to an `if` block?
- Curly braces
+ Indentation
- The word `end`
= Python uses indentation to group lines into blocks.
:::

@@@ lesson
id: while-loops
title: while loops
minutes: 10
summary: Repeat code as long as a condition stays true, and avoid infinite loops.
---
A `while` loop repeats its block **as long as** its condition is true. Python checks the condition before every pass (each pass is called an **iteration**).

```python
count = 1
while count <= 5:
    print("Count is", count)
    count += 1
print("Done!")
```

Trace it by hand: `count` starts at 1, the block runs and increases it, and when `count` becomes 6 the condition is false and the loop ends.

### The infinite loop trap

If the condition never becomes false, the loop runs forever. Forgetting `count += 1` above would do exactly that. (In this browser editor, an infinite loop freezes the tab. If that happens, reload the page; your progress is kept.)

### Loops with an unknown number of steps

`while` shines when you don't know in advance how many iterations you need:

```python
balance = 1000
years = 0
while balance < 2000:
    balance *= 1.07        # 7% growth per year
    years += 1
print(f"Your money doubles in {years} years: ${balance:.2f}")
```

### Collecting a running total

A common pattern is an **accumulator**: a variable that starts at zero and grows in each iteration.

```python
n = 1
total = 0
while n <= 100:
    total += n
    n += 1
print("Sum of 1..100 =", total)
```

### Reading input until a stop word

```python stdin=apple|kiwi|mango|done
items = []
item = input("Item (or 'done'): ")
while item != "done":
    items.append(item)
    item = input("Item (or 'done'): ")
print("You entered:", items)
```

(`items.append(...)` adds to a list; Part 3 covers lists in detail.)

:::exercise Collatz steps
The Collatz rule: if `n` is even, divide it by 2; if odd, replace it with `3 * n + 1`. Repeat until `n` becomes 1.

Write `collatz_steps(n)` that returns **how many steps** it takes to reach 1. For example, 6 → 3 → 10 → 5 → 16 → 8 → 4 → 2 → 1 takes 8 steps.
```python starter
def collatz_steps(n):
    steps = 0
    # your while loop here

    return steps

print(collatz_steps(6))
```
```python check
for n, want in [(1, 0), (2, 1), (6, 8), (7, 16), (27, 111)]:
    got = collatz_steps(n)
    assert got == want, f"collatz_steps({n}) should be {want} but was {got}"
```
```python solution
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
hint: Loop while n != 1. Inside, use if/else to update n, then add 1 to steps. Use // so n stays an int.
:::

:::quiz
? How many times does this print? `i = 0` / `while i < 3:` / `print(i)` / `i += 1`
- 2
+ 3
- 4
= It prints for i = 0, 1 and 2. When i reaches 3 the condition is false.

? What's the most common cause of an infinite loop?
+ The condition's variable is never updated inside the loop
- Using print inside a loop
- Indenting with 4 spaces
= If nothing inside the loop moves the condition towards False, it stays True forever.
:::

@@@ lesson
id: for-loops
title: for loops and range
minutes: 12
summary: Loop over sequences and ranges of numbers, with enumerate and zip.
---
A `for` loop takes each item from a sequence, one at a time, and runs the block for it.

```python
for letter in "hey":
    print(letter)

for fruit in ["apple", "banana", "cherry"]:
    print(f"I like {fruit}")
```

The loop variable (`letter`, `fruit`) is created for you and refers to the current item.

![A for loop runs its body once for each item: round 1 with apple, round 2 with banana, round 3 with cherry](figures/for-loop.svg)

### range(): looping over numbers

`range` generates a sequence of numbers. Like slicing, the stop value is **not included**.

| Call | Numbers |
|---|---|
| `range(5)` | 0, 1, 2, 3, 4 |
| `range(2, 6)` | 2, 3, 4, 5 |
| `range(0, 10, 3)` | 0, 3, 6, 9 |
| `range(5, 0, -1)` | 5, 4, 3, 2, 1 |

```python
for i in range(1, 6):
    print(f"{i} x 7 = {i * 7}")
```

### for vs while

Use `for` when you're going through a collection or know how many times to repeat. Use `while` when you repeat until something happens. Most loops in real Python code are `for` loops.

### enumerate: item and position together

```python
players = ["Ana", "Ben", "Cy"]
for position, name in enumerate(players, start=1):
    print(position, name)
```

### zip: walk two lists side by side

```python
names = ["Ana", "Ben", "Cy"]
scores = [91, 78, 85]
for name, score in zip(names, scores):
    print(f"{name:<4} {score}")
```

### Nested loops

A loop inside a loop runs the inner loop completely for each pass of the outer loop:

```python
for row in range(1, 4):
    line = ""
    for col in range(1, 4):
        line += f"{row * col:4}"
    print(line)
```

### Using _ for unused variables

If you don't need the loop variable, name it `_` by convention:

```python
for _ in range(3):
    print("Hip hip hooray!")
```

:::exercise Sum of multiples
Write `sum_multiples(limit)` that returns the sum of all numbers **below** `limit` that are multiples of 3 or 5. For `limit = 10` that's 3 + 5 + 6 + 9 = 23.
```python starter
def sum_multiples(limit):
    total = 0

    return total

print(sum_multiples(10))
```
```python check
for limit, want in [(10, 23), (1, 0), (16, 60), (1000, 233168)]:
    got = sum_multiples(limit)
    assert got == want, f"sum_multiples({limit}) should be {want} but was {got}"
```
```python solution
def sum_multiples(limit):
    total = 0
    for n in range(limit):
        if n % 3 == 0 or n % 5 == 0:
            total += n
    return total

print(sum_multiples(10))
```
hint: for n in range(limit): then add n to total when n % 3 == 0 or n % 5 == 0.
:::

:::exercise Draw a triangle
Write `triangle(n)` that **prints** a right triangle of `*` with `n` rows. `triangle(4)` prints:

```output
*
**
***
****
```
```python starter
def triangle(n):
    pass  # replace with your loop

triangle(4)
```
```python check
import io, contextlib
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    triangle(4)
assert buf.getvalue().strip() == "*\n**\n***\n****", f"triangle(4) printed:\n{buf.getvalue()}"
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    triangle(1)
assert buf.getvalue().strip() == "*", "triangle(1) should print a single *"
```
```python solution
def triangle(n):
    for i in range(1, n + 1):
        print("*" * i)

triangle(4)
```
hint: Loop i from 1 to n with range(1, n + 1), and print "*" * i.
:::

:::quiz
? What does `list(range(2, 10, 3))` contain?
+ [2, 5, 8]
- [2, 5, 8, 11]
- [3, 6, 9]
= Start at 2, add 3 each time, stop before 10.

? What does `enumerate(["a", "b"])` produce?
- ("a", "b")
+ (0, "a") and (1, "b")
- (1, "a") and (2, "b")
= It pairs each item with its index, starting at 0 unless you pass `start=`.
:::

@@@ lesson
id: loop-control
title: break, continue and loop else
minutes: 8
summary: Exit a loop early, skip an iteration, and run code when a loop finishes without breaking.
---
Sometimes you need to leave a loop early or skip part of it.

### break: stop the loop now

```python
numbers = [4, 7, 12, -1, 8]
for n in numbers:
    if n < 0:
        print("Found a negative number, stopping.")
        break
    print("Processing", n)
```

### continue: skip to the next iteration

```python
for n in range(1, 11):
    if n % 3 == 0:
        continue          # skip multiples of 3
    print(n, end=" ")
print()
```

### while True with break

A popular pattern for menus and input loops is an infinite loop with a `break` inside:

```python stdin=5|abc|-3|12
while True:
    text = input("Enter a positive number: ")
    if text.isdigit() and int(text) > 0:
        print("Thanks, you entered", text)
        break
    print("That's not a positive whole number, try again.")
```

### The loop else clause

A loop can have an `else` block. It runs only if the loop finished **without** hitting `break`. It's perfect for searches:

```python
def first_divisor(n):
    for d in range(2, n):
        if n % d == 0:
            print(f"{n} is divisible by {d}")
            break
    else:
        print(f"{n} is prime")

first_divisor(91)
first_divisor(97)
```

Read the `else` as "if no break". Many programmers don't know this feature, so add a comment when you use it.

:::exercise Is it prime?
Write `is_prime(n)` that returns `True` if `n` is a prime number and `False` otherwise. Numbers below 2 are not prime. Use a loop with an early exit.

To keep it fast, you only need to test divisors up to the square root of `n`: `d * d <= n`.
```python starter
def is_prime(n):
    return False

print([n for n in range(20) if is_prime(n)])
```
```python check
primes = [n for n in range(60) if is_prime(n)]
expected = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59]
assert primes == expected, f"Primes below 60 should be {expected} but your function found {primes}"
assert is_prime(7919) is True, "7919 is prime"
assert is_prime(7917) is False, "7917 is not prime (3 x 2639)"
```
```python solution
def is_prime(n):
    if n < 2:
        return False
    d = 2
    while d * d <= n:
        if n % d == 0:
            return False
        d += 1
    return True

print([n for n in range(20) if is_prime(n)])
```
hint: Return False right away for n < 2. Then loop d from 2 while d * d <= n; if n % d == 0, return False. If the loop finishes, return True.
:::

:::quiz
? What does `continue` do?
- Ends the loop
+ Skips the rest of this iteration and moves to the next
- Restarts the loop from the beginning
= `continue` jumps straight to the next item; `break` ends the loop.

? When does a `for ... else` block run?
- Always
- Only if the loop body never ran
+ When the loop ends without `break`
= The `else` is skipped only when `break` exits the loop.
:::
