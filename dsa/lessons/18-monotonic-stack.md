# Lesson 18: Monotonic stacks: next greater element

**You'll learn:** monotonic stacks, next greater and next smaller element, previous greater (stock span), largest rectangle in a histogram, trapping rain water, amortised O(n).

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/dsa/#monotonic-stack)**: run every example and check your exercise answers.

## Key terms

- **Monotonic stack:** a stack whose values stay in increasing or decreasing order; new items pop the ones that break the order.
- **Next greater element:** for each item, the first item to its right that is larger.
- **Previous greater element:** for each item, the nearest item to its left that is larger.
- **Stock span:** the number of consecutive days, ending today, with a price at most today's.
- **Histogram:** a row of bars of different heights.
- **Amortised analysis:** bounding the total cost of many operations, so an occasional expensive step averages out.

"For each day, how many days until a warmer one?" The brute force looks ahead from every day: O(n²). A **monotonic stack** answers it for every day in a single pass.

A monotonic stack is an ordinary stack with one rule: its contents stay in increasing (or decreasing) order. Before pushing a new item, you pop everything that would break the order. The trick is that **each pop answers a question**: the item being popped has just found its "next greater element", the new item.

![Daily temperatures 73, 74, 75, 71, 69, 72, 76, 73. The stack holds indexes of days still waiting for a warmer day, with temperatures decreasing from bottom to top. When 72 arrives, it pops 69 and 71, whose answers become 1 and 2 days; then 72 is pushed. When 76 arrives it pops 72 and 75](../figures/monotonic-stack.svg)

## The template: next greater element

```python
def next_greater(nums):
    answer = [-1] * len(nums)        # -1 means "no greater element to the right"
    stack = []                       # indexes whose answer we don't know yet; values decrease bottom→top
    for i, x in enumerate(nums):
        while stack and nums[stack[-1]] < x:
            answer[stack.pop()] = x  # x is the first greater value to the right of that index
        stack.append(i)
    return answer

print(next_greater([2, 1, 2, 4, 3]))
```

**Why it's O(n), not O(n²):** the `while` loop sits inside a `for` loop, which looks quadratic. But every index is pushed exactly once and popped at most once, so across the whole run there are at most n pops. Total work: O(n). This is an **amortised** argument, like the list append in Lesson 4.

Variations are small changes to the same template:

| Question | Loop over | Pop while the top is… |
|---|---|---|
| next **greater** to the right | left → right | smaller than x |
| next **smaller** to the right | left → right | larger than x |
| previous greater (to the left) | left → right; the answer is whatever is left on top after popping | smaller or equal |
| circular array | twice round (index `i % n`) | same as above |

## Stock span: the previous greater element

The **span** of a day's price is how many consecutive days (ending today) had a price less than or equal to today's. That's "distance to the previous greater element", read from the stack after popping:

```python
def stock_span(prices):
    span, stack = [], []                      # stack of indexes with decreasing prices
    for i, p in enumerate(prices):
        while stack and prices[stack[-1]] <= p:
            stack.pop()
        span.append(i - stack[-1] if stack else i + 1)
        stack.append(i)
    return span

print(stock_span([100, 80, 60, 70, 60, 75, 85]))
```

## Largest rectangle in a histogram

Given bar heights, what's the biggest rectangle that fits under them? For each bar, the widest rectangle of that bar's height stretches left and right until a **shorter** bar. With an **increasing** stack, when a bar is popped we know both edges at once: the new shorter bar on the right, and the bar now under it on the left.

```python
def largest_rectangle(heights):
    best, stack = 0, []                        # indexes of bars with increasing heights
    for i, h in enumerate(heights + [0]):      # a final 0 flushes the stack
        while stack and heights[stack[-1]] >= h:
            height = heights[stack.pop()]
            left = stack[-1] + 1 if stack else 0
            best = max(best, height * (i - left))
        stack.append(i)
    return best

print(largest_rectangle([2, 1, 5, 6, 2, 3]))   # 10: heights 5 and 6, width 2
```

O(n) time, O(n) space. The brute force (every pair of edges) is O(n²).

## Trapping rain water

Bars of different heights; how much rain is trapped between them? Water above each bar = min(tallest bar to its left, tallest to its right) − its own height. Two pointers do it in O(1) space: always move the side with the **lower** wall, because that side's water level is already decided.

```python
def trap(heights):
    left, right = 0, len(heights) - 1
    left_max = right_max = water = 0
    while left < right:
        if heights[left] < heights[right]:
            left_max = max(left_max, heights[left])
            water += left_max - heights[left]
            left += 1
        else:
            right_max = max(right_max, heights[right])
            water += right_max - heights[right]
            right -= 1
    return water

print(trap([0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]))   # 6
```

(A monotonic-stack version also exists: it fills water layer by layer whenever a taller bar closes a dip.)

## Spotting a monotonic-stack problem

Clue words: "next greater", "next smaller", "previous", "how many days until", "span", "the nearest bar that's shorter", "visible" (who can see over whom). If the brute force is "for each item, scan forward or backward until something bigger or smaller", a monotonic stack usually makes it O(n).

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Next greater element | decreasing stack of indexes; a bigger value pops and answers them | O(n) | O(n) |
| Daily temperatures | next greater, answer = index distance | O(n) | O(n) |
| Stock span (previous greater) | pop smaller or equal, distance to the new top | O(n) | O(n) |
| Largest rectangle in a histogram | increasing stack; a popped bar's width runs from the bar below it to i | O(n) | O(n) |
| Trapping rain water | two pointers, move the lower wall | O(n) | O(1) |

## Common mistakes

- Pushing values instead of indexes when you need distances or widths.
- Using `<=` where `<` is needed (or the reverse), which mishandles equal values.
- Forgetting to flush the stack at the end (a sentinel 0 bar), so some items never get an answer.
- Thinking the nested while loop makes it O(n²); count total pushes and pops instead.

## Exercises

### 1. Daily temperatures

Write `daily_temperatures(temps)` returning a list where entry `i` is how many days you'd wait after day `i` for a **warmer** temperature, or `0` if no warmer day comes. Must handle 100,000 days.

Starter code:

```python
def daily_temperatures(temps):
    pass

print(daily_temperatures([73, 74, 75, 71, 69, 72, 76, 73]))
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** strictly warmer; the answer is a distance in days; 0 if none.
2. **Examples:** [73, 74, 75, 71, 69, 72, 76, 73] → [1, 1, 4, 2, 1, 1, 0, 0]. Equal temperatures don't count.
3. **Brute force:** for each day, scan forward to the first warmer day: O(n²) when temperatures keep falling.
4. **Pattern:** "how many days until a warmer one" = **next greater element** → monotonic (decreasing) stack.
5. **Plan:** answers default to 0; stack of waiting indexes; each day pops the colder days it answers, then waits itself.
6. **Code and test:** equal temperatures, all falling, one day, empty.

</details>

<details>
<summary>💡 Hint 1</summary>

Instead of each day looking forward, let each new day answer the earlier days that were waiting for it.

</details>

<details>
<summary>💡 Hint 2</summary>

Keep a stack of **indexes** of days still waiting. Their temperatures decrease from bottom to top, so a warm new day pops from the top.

</details>

<details>
<summary>💡 Hint 3</summary>

For each `i, t`: while the stack's top day is colder than `t`, pop `j` and set `answer[j] = i - j`. Then push `i`. Days never popped keep 0.

</details>

### 2. Largest rectangle in a histogram

Write `largest_rectangle(heights)` returning the area of the largest rectangle that fits under the bars (each bar has width 1). Must handle 100,000 bars.

Starter code:

```python
def largest_rectangle(heights):
    pass

print(largest_rectangle([2, 1, 5, 6, 2, 3]))   # 10
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** width 1 per bar; the rectangle's height is the shortest bar it covers; return the area.
2. **Examples:** [2, 1, 5, 6, 2, 3] → 10 (5 and 6, width 2); [3, 3, 3, 3] → 12; [] → 0.
3. **Brute force:** every pair of edges, tracking the minimum height: O(n²).
4. **Pattern:** "nearest shorter bar on each side" → **monotonic (increasing) stack**.
5. **Plan:** loop over heights plus a sentinel 0; pop bars taller than or equal to the current one, computing their rectangles; push the index.
6. **Code and test:** increasing, decreasing, equal heights, zeros, empty.

</details>

<details>
<summary>💡 Hint 1</summary>

For each bar, imagine the widest rectangle exactly as tall as that bar. Where does it stop on the left and on the right?

</details>

<details>
<summary>💡 Hint 2</summary>

It stops at the first **shorter** bar on each side. Keep an increasing stack of indexes: a bar is popped exactly when its right edge (a shorter bar) arrives.

</details>

<details>
<summary>💡 Hint 3</summary>

When you pop index `top` at position `i`: height = heights[top]; left edge = (new stack top + 1) or 0 if empty; width = i − left. Append a 0 to the heights to flush the stack at the end.

</details>

**In the sandbox:** exercises 37–38. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Daily temperatures</summary>

```python
def daily_temperatures(temps):
    answer = [0] * len(temps)
    waiting = []                                   # indexes of days with no warmer day yet (temps decreasing)
    for i, t in enumerate(temps):
        while waiting and temps[waiting[-1]] < t:  # today is warmer than those days
            j = waiting.pop()
            answer[j] = i - j
        waiting.append(i)
    return answer

print(daily_temperatures([73, 74, 75, 71, 69, 72, 76, 73]))
```

**Line by line**

- `answer = [0] * len(temps)`: days that never find a warmer day keep 0.
- `waiting` holds indexes, not temperatures, because we need distances. Its temperatures always decrease from bottom to top: anything warmer would already have popped them.
- `while waiting and temps[waiting[-1]] < t`: today answers every waiting day that is colder. Use `<`, not `<=`, because an equal temperature isn't warmer.
- `answer[j] = i - j` is the distance in days.
- Every day is then pushed to wait for its own warmer day.

**Trace** on the first six days, [73, 74, 75, 71, 69, 72]:

| i | t | popped (answer set) | waiting after (temps) |
|---|---|---|---|
| 0 | 73 | — | 73 |
| 1 | 74 | day 0 → 1 | 74 |
| 2 | 75 | day 1 → 1 | 75 |
| 3 | 71 | — | 75 71 |
| 4 | 69 | — | 75 71 69 |
| 5 | 72 | day 4 → 1, day 3 → 2 | 75 72 |

**Complexity:** O(n) time (each index is pushed and popped at most once), O(n) space.

**Common wrong approach:** storing temperatures instead of indexes in the stack, which leaves no way to compute the distance.

</details>

<details>
<summary>✅ 2. Largest rectangle in a histogram</summary>

```python
def largest_rectangle(heights):
    best = 0
    stack = []                                   # indexes of bars, heights increasing bottom→top
    extended = heights + [0]                     # a final 0-height bar flushes everything left
    for i, h in enumerate(extended):
        while stack and extended[stack[-1]] >= h:
            height = extended[stack.pop()]       # this bar's rectangle can't extend past i
            left = stack[-1] + 1 if stack else 0 # ...nor past the shorter bar below it
            best = max(best, height * (i - left))
        stack.append(i)
    return best

print(largest_rectangle([2, 1, 5, 6, 2, 3]))
```

**Line by line**

- The stack holds indexes whose heights increase from bottom to top.
- When the current bar `h` is not taller than the top bar, that top bar's rectangle can't extend to the right any more: pop it.
- Its left edge is just after the bar now on top of the stack (that bar is shorter, which is why it's still there), or index 0 if the stack is empty.
- `width = i - left`, `area = height * width`.
- The sentinel 0 at the end is shorter than everything, so it pops every remaining bar.

**Trace** on [2, 1, 5, 6, 2, 3]:

| i | h | popped: height × width | stack after (heights) |
|---|---|---|---|
| 0 | 2 | — | 2 |
| 1 | 1 | 2 × 1 = 2 | 1 |
| 2 | 5 | — | 1 5 |
| 3 | 6 | — | 1 5 6 |
| 4 | 2 | 6 × 1 = 6; 5 × 2 = **10** | 1 2 |
| 5 | 3 | — | 1 2 3 |
| 6 | 0 | 3 × 1; 2 × 4 = 8; 1 × 6 = 6 | 0 |

**Complexity:** O(n) time, O(n) space.

**Common wrong approach:** forgetting the final flush (the sentinel 0), so bars still on the stack at the end, like the increasing run [1, 2, 3, 4, 5], are never measured.

</details>

## Quick quiz

1. Why is a monotonic stack algorithm O(n) even though it has a while loop inside a for loop?
   - A) The while loop runs at most once per step
   - B) Python optimises nested loops
   - C) Each index is pushed once and popped at most once, so all the pops together are at most n

2. For "next greater element to the right", what order do the values on the stack keep (bottom to top)?
   - A) Random
   - B) Increasing
   - C) Decreasing

3. In the largest-rectangle algorithm, when is a bar's rectangle complete?
   - A) When a taller bar arrives
   - B) When a shorter bar arrives on its right
   - C) Only at the end of the list

4. Which clue suggests a monotonic stack?
   - A) "Count the distinct words"
   - B) "Find the shortest path between two cities"
   - C) "For each day, how many days until a higher price?"

<details>
<summary>Quiz answers</summary>

1. **C) Each index is pushed once and popped at most once, so all the pops together are at most n**: Count the total pops across the whole run, not per step: that's amortised analysis.
2. **C) Decreasing**: A larger new value pops the smaller ones; whatever remains is larger than what sits above it.
3. **B) When a shorter bar arrives on its right**: A shorter bar stops it from extending further right; the bar below it on the stack marks the left edge.
4. **C) "For each day, how many days until a higher price?"**: "Next greater" or "previous smaller" questions are the classic monotonic-stack signal.

</details>

---
Previous: [Lesson 17](17-stacks.md) · Next: [Lesson 19: Queues, circular buffers and deques](19-queues-deques.md)
