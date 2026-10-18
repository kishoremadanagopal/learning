# Lesson 9: Random numbers and simulation

**You'll learn:** `default_rng`, seeds, `integers`, `random`, `normal`, `choice`, `permutation`, `binomial`, simulation.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python-data/#random-and-simulation)**: run every example and check your exercise answers.

## Key terms

- **Random generator:** an object, made with `np.random.default_rng()`, that produces random numbers.
- **Seed:** a starting number that makes a generator produce the same sequence every run.
- **Distribution:** how likely each possible value is.
- **Uniform distribution:** every value in a range is equally likely.
- **Normal distribution:** the bell curve: values cluster around the mean, with fewer far away.
- **Simulation:** answering a question by acting it out many times with random numbers and counting.
- **Train/test split:** dividing data so a model learns from one part and is tested on the other.

Random numbers are everywhere in data work: shuffling data before training a model, splitting it into training and test sets, creating test data, and **simulating** situations that are hard to calculate by hand.

## A random generator

NumPy's modern way is to create a **generator** first, then ask it for numbers:

```python
import numpy as np

rng = np.random.default_rng()
print(rng.integers(1, 7, size=10))    # 10 dice rolls (7 is not included)
print(rng.random(3))                  # 3 decimals between 0 and 1
```

Run it twice and you get different numbers each time.

## Seeds make results repeatable

Pass a **seed** (any whole number) and the generator produces the same "random" numbers every run. Always seed when someone else needs to reproduce your results, such as a model's training run or a lesson's examples:

```python
import numpy as np

rng = np.random.default_rng(42)
print(rng.integers(1, 7, size=5))

rng = np.random.default_rng(42)
print(rng.integers(1, 7, size=5))   # exactly the same
```

## Distributions

A **distribution** describes how likely each value is. Two you'll meet constantly:

- **uniform**: every value in a range is equally likely, like a fair dice;
- **normal** (the bell curve): most values sit near the average and fewer appear further away, like people's heights.

```python
import numpy as np

rng = np.random.default_rng(7)
heights = rng.normal(loc=170, scale=8, size=10_000)   # mean 170 cm, spread 8 cm
print(heights[:5].round(1))
print("mean", heights.mean().round(1), "std", heights.std().round(1))
print("share between 162 and 178:", ((heights > 162) & (heights < 178)).mean().round(3))
```

About 68% of normal values fall within one standard deviation of the mean. The simulation shows it without any formulas. `.mean()` of a true/false array gives the **share** that are true.

## Picking from a list

`rng.choice` picks items, with optional probabilities, and `rng.permutation` shuffles:

```python
import numpy as np

rng = np.random.default_rng(1)
regions = ["North", "South", "East", "West"]
print(rng.choice(regions, size=6))
print(rng.choice(regions, size=6, p=[0.4, 0.3, 0.2, 0.1]))
print(rng.choice(10, size=4, replace=False))   # 4 different numbers from 0-9
print(rng.permutation(regions))
```

## Simulation: let the computer try it

**Simulation** answers a probability question by acting it out many times and counting. What's the chance two dice add up to 7?

```python
import numpy as np

rng = np.random.default_rng(0)
n = 100_000
die1 = rng.integers(1, 7, size=n)
die2 = rng.integers(1, 7, size=n)
print("P(total is 7) is about", ((die1 + die2) == 7).mean().round(3))
print("Exact answer:", round(6 / 36, 3))
```

A business example: a shop gets between 20 and 40 customers a day, and each buys with a 30% chance. How many sales should it expect in a 30-day month, and how bad could it be?

```python
import numpy as np

rng = np.random.default_rng(3)
months = 10_000
customers = rng.integers(20, 41, size=(months, 30))   # 10,000 simulated months of 30 days
sales = rng.binomial(customers, 0.3)                  # each customer buys with chance 0.3
monthly = sales.sum(axis=1)
print("average month:", monthly.mean().round(1))
print("worst 5% of months: below", np.percentile(monthly, 5))
```

`rng.binomial(n, p)` counts successes out of `n` tries that each succeed with chance `p`.

## A train/test split

In machine learning you hide some data from the model to test it later. Shuffling positions does it:

```python
import numpy as np

rng = np.random.default_rng(10)
ids = np.arange(20)              # 20 rows of data
shuffled = rng.permutation(ids)
train, test = shuffled[:16], shuffled[16:]
print("train:", np.sort(train))
print("test: ", np.sort(test))
```

## Common mistakes

- Forgetting the seed, so your results change every run and nobody can reproduce them.
- Thinking `rng.integers(1, 6)` can return 6. The upper number is excluded; use `integers(1, 7)` for a dice.
- Running too few simulations. With 10 tries the answer is noisy; use thousands.

## Exercises

### 1. Coin flips

Create a generator with seed `2026`, simulate **1,000** coin flips with `rng.integers(0, 2, size=1000)` (1 means heads), and store the share of heads in `heads_share`.

Starter code:

```python
import numpy as np

```

### 2. A fair split

Shuffle the 50 row numbers in `ids` with a generator seeded with `5`, then put the first 40 in `train` and the last 10 in `test`.

Starter code:

```python
import numpy as np

ids = np.arange(50)

```

**In the sandbox:** exercises 17–18. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. The mean of an array of 0s and 1s is the share of 1s.
2. `rng = np.random.default_rng(5)`, then `shuffled = rng.permutation(ids)` and slice it.

</details>

<details>
<summary>Answers</summary>

**1. Coin flips**

```python
import numpy as np

rng = np.random.default_rng(2026)
flips = rng.integers(0, 2, size=1000)
heads_share = flips.mean()
print(heads_share)
```

**2. A fair split**

```python
import numpy as np

ids = np.arange(50)
rng = np.random.default_rng(5)
shuffled = rng.permutation(ids)
train = shuffled[:40]
test = shuffled[40:]
print(len(train), len(test))
```

</details>

## Quick quiz

1. Why give a random generator a seed?
   - A) To make the numbers more random
   - B) So the same "random" numbers come out every run, and results can be reproduced
   - C) To make it faster

2. What does `(rolls == 6).mean()` give for an array of dice rolls?
   - A) The average roll
   - B) The number of 6s
   - C) The share of rolls that were 6

3. Which describes the normal distribution?
   - A) Every value equally likely
   - B) Most values near the average, fewer further away
   - C) Only whole numbers

<details>
<summary>Quiz answers</summary>

1. **B) So the same "random" numbers come out every run, and results can be reproduced**: With a seed, anyone running your code gets the same results, which matters for experiments and models.
2. **C) The share of rolls that were 6**: The comparison makes True/False values; their mean is the fraction that are True.
3. **B) Most values near the average, fewer further away**: The normal "bell curve" clusters around the mean, with fewer values in the tails.

</details>

---
Previous: [Lesson 8](08-array-statistics.md) · Next: [Lesson 10: The Series](10-pandas-series.md)
