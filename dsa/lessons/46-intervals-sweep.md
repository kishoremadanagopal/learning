# Lesson 46: Intervals and sweep lines

**You'll learn:** closed and half-open intervals, the overlap test, merging intervals, inserting an interval, intersecting two interval lists, fewest removals, meeting rooms with a heap or a sweep line, event sorting, difference arrays.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/dsa/#intervals-sweep)**: run every example and check your exercise answers.

## Key terms

- **Interval:** a range from a start to an end, such as a meeting or a booking.
- **Half-open interval [a, b):** includes a but not b, so [1, 3) and [3, 5) don't overlap.
- **Overlap test:** two intervals overlap when each starts before the other ends.
- **Sweep line:** processing sorted events in order along a line while keeping a running state.
- **Event:** a point where something changes, such as +1 at a meeting's start and −1 at its end.
- **Difference array:** an array of changes (+k at l, −k at r + 1) whose prefix sums give the final values.

Calendars, bookings, IP ranges, gene positions, video timestamps: **intervals** `[start, end]` are everywhere, and nearly every interval problem starts the same way: **sort them**, usually by start (or by end for scheduling problems), then make one pass.

## Do two intervals overlap?

Two intervals overlap exactly when **each starts before the other ends**. It's easier to check that than all the ways they can overlap.

```python
def overlaps(a, b):                       # closed intervals: [1, 3] and [3, 5] share the point 3
    return a[0] <= b[1] and b[0] <= a[1]

def overlaps_half_open(a, b):             # half-open [start, end): a meeting ending at 3 and one starting at 3 don't clash
    return a[0] < b[1] and b[0] < a[1]

print(overlaps([1, 3], [3, 5]), overlaps_half_open([1, 3], [3, 5]), overlaps([1, 2], [4, 6]))
```

Decide which convention the problem uses. Meetings and bookings are usually **half-open** (one can end at 3 and the next start at 3); "merge intervals" problems usually treat touching intervals as overlapping.

## Merging overlapping intervals

Sort by start. Walk through, and either **extend** the last merged interval (if the current one starts before it ends) or start a new one. That's the first exercise.

![Intervals [1, 3], [2, 6], [8, 10], [9, 12] and [15, 18] drawn on a number line, sorted by start. [1, 3] and [2, 6] overlap and merge into [1, 6]; [8, 10] and [9, 12] merge into [8, 12]; [15, 18] stays alone](../figures/merge-intervals.svg)

## Inserting into a sorted list of intervals

Given non-overlapping intervals sorted by start, insert a new one, merging where needed. Three phases in one pass: copy the intervals that end **before** it, absorb those that overlap it, copy the rest. O(n).

```python
def insert_interval(intervals, new):
    out, i, n = [], 0, len(intervals)
    start, end = new
    while i < n and intervals[i][1] < start:       # entirely before the new one
        out.append(intervals[i]); i += 1
    while i < n and intervals[i][0] <= end:        # overlapping: grow the new interval
        start = min(start, intervals[i][0])
        end = max(end, intervals[i][1])
        i += 1
    out.append([start, end])
    out.extend(intervals[i:])                      # entirely after
    return out

print(insert_interval([[1, 2], [3, 5], [6, 7], [8, 10], [12, 16]], [4, 8]))
```

## Intersecting two schedules

When are two people both free (or both busy)? With two sorted lists of non-overlapping intervals, use **two pointers**: the overlap of the current pair is `[max(starts), min(ends)]` if that's non-empty, then advance whichever interval ends first.

```python
def intersect(a, b):
    i = j = 0
    out = []
    while i < len(a) and j < len(b):
        lo = max(a[i][0], b[j][0])
        hi = min(a[i][1], b[j][1])
        if lo <= hi:
            out.append([lo, hi])
        if a[i][1] < b[j][1]:                      # the one that ends first can't overlap anything else
            i += 1
        else:
            j += 1
    return out

print(intersect([[0, 2], [5, 10], [13, 23], [24, 25]], [[1, 5], [8, 12], [15, 24], [25, 26]]))
```

## Fewest removals so nothing overlaps

Removing the fewest intervals is the same as **keeping the most** non-overlapping ones: activity selection from Lesson 45. Sort by **end**, keep each interval that starts at or after the last kept end, and count the rest.

```python
def min_removals(intervals):
    kept, last_end = 0, float("-inf")
    for start, end in sorted(intervals, key=lambda iv: iv[1]):
        if start >= last_end:
            kept += 1
            last_end = end
    return len(intervals) - kept

print(min_removals([[1, 2], [2, 3], [3, 4], [1, 3]]), min_removals([[1, 2], [1, 2], [1, 2]]))
```

## How many meeting rooms? Two ways

The fewest rooms needed equals the **largest number of meetings happening at the same moment**.

**Heap of end times:** process meetings by start time; the heap holds the end times of rooms in use. If the earliest-ending room is free by the time the next meeting starts, reuse it (pop); then push this meeting's end. The heap's largest size is the answer.

**Sweep line:** turn each meeting into two **events**, +1 at its start and −1 at its end, sort them, and sweep left to right keeping a running count. With half-open meetings, an end and a start at the same time must process the **end first**; sorting `(time, change)` does that automatically, because −1 sorts before +1.

![A timeline with meetings [0, 30], [5, 10] and [15, 20]. Below it, the running count of meetings in progress steps up and down at each start and end: 1, then 2 at time 5, back to 1 at 10, 2 again at 15, and 1 at 20. Its peak of 2 is the number of rooms needed](../figures/sweep-line.svg)

```python
import heapq

def rooms_heap(meetings):
    ends = []                                       # end times of rooms currently in use
    for start, end in sorted(meetings):
        if ends and ends[0] <= start:
            heapq.heapreplace(ends, end)            # the earliest-ending room is free: reuse it
        else:
            heapq.heappush(ends, end)               # every room is busy: open another
    return len(ends)

def rooms_sweep(meetings):
    events = [(s, +1) for s, e in meetings] + [(e, -1) for s, e in meetings]
    in_use = peak = 0
    for time, change in sorted(events):             # at equal times, -1 (an end) sorts first
        in_use += change
        peak = max(peak, in_use)
    return peak

meetings = [[0, 30], [5, 10], [15, 20]]
print(rooms_heap(meetings), rooms_sweep(meetings), rooms_sweep([[1, 5], [5, 10]]))
```

The sweep line generalises: sort events along a line and keep running state. It finds the busiest moment of a server, the maximum number of overlapping bookings, the total length covered by a set of intervals, and (with a heap of heights) the city **skyline** outline.

## Difference arrays: many range updates at once

"Add k to every position from l to r", repeated many times, then read the final values. Updating each range directly is O(length) per update. A **difference array** records only the **changes**: `diff[l] += k` and `diff[r + 1] -= k`. A single prefix sum at the end turns the changes back into values: O(1) per update plus O(n) once.

```python
from itertools import accumulate

def car_pooling(trips, capacity):            # trips: (passengers, from, to); passengers leave at `to`
    last = max(to for _, _, to in trips)
    diff = [0] * (last + 1)
    for people, start, end in trips:
        diff[start] += people                 # they get in here
        diff[end] -= people                   # and out here
    load = list(accumulate(diff))             # prefix sums: passengers on board at each stop
    return max(load) <= capacity, load

print(car_pooling([(2, 1, 5), (3, 3, 7)], 4))
print(car_pooling([(2, 1, 5), (3, 5, 7)], 3))
```

It's the reverse of Lesson 9's prefix sums: prefix sums answer many range **queries** on fixed data; difference arrays apply many range **updates** before one read. (When updates and queries are mixed, use a Fenwick or segment tree with lazy propagation, Lesson 34.)

## Interval patterns at a glance

| Question | Sort by | Then |
|---|---|---|
| Merge overlapping intervals | start | extend the last merged interval or start a new one |
| Insert one interval | (already sorted) | before / overlapping / after, in one pass |
| Intersections of two lists | (already sorted) | two pointers, advance the earlier end |
| Most non-overlapping / fewest removals | end | greedy activity selection |
| Rooms needed / maximum overlap | start, or events | heap of end times, or sweep line |
| Many range additions, then read | — | difference array + prefix sum |

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Overlap test | a.start ≤ b.end and b.start ≤ a.end (strict for half-open) | O(1) | O(1) |
| Merge intervals | sort by start; extend the last or append | O(n log n) | O(n) |
| Insert into sorted intervals | copy before, absorb overlapping, copy after | O(n) | O(n) |
| Intersect two sorted lists | two pointers; advance the earlier end | O(m + n) | O(m + n) |
| Fewest removals for no overlap | n − (activity selection by end) | O(n log n) | O(1) extra |
| Meeting rooms / maximum overlap | heap of end times, or sorted ±1 events | O(n log n) | O(n) |
| Many range additions | difference array + one prefix sum | O(n + updates) | O(n) |

## Common mistakes

- Mixing up closed and half-open intervals at shared endpoints.
- Forgetting `max` when extending a merged interval that contains the next one.
- Sorting by start when a scheduling problem needs sorting by end (or the reverse).
- Processing starts before ends at the same time in a half-open sweep.

## Exercises

### 1. Merge intervals

Write `merge(intervals)` that merges all overlapping intervals (lists `[start, end]`, in any order; intervals that touch, like [1, 4] and [4, 5], count as overlapping) and returns the merged intervals sorted by start. Don't change the input list. It must handle 100,000 intervals quickly.

Starter code:

```python
def merge(intervals):
    pass

print(merge([[1, 3], [2, 6], [8, 10], [15, 18]]))   # [[1, 6], [8, 10], [15, 18]]
print(merge([[1, 4], [4, 5]]))                      # [[1, 5]]
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** any input order; touching counts as overlapping; output sorted; input unchanged.
2. **Examples:** [[1, 3], [2, 6]] → [[1, 6]]; [[1, 4], [2, 3]] → [[1, 4]] (contained).
3. **Brute force:** repeatedly merge any overlapping pair until none remain: O(n²) or worse.
4. **Pattern:** **sort by start, then a single sweep**.
5. **Plan:** sorted copy; extend or append; use `max` for the end because of contained intervals.
6. **Code and test:** touching, contained, unsorted, empty input.

</details>

<details>
<summary>💡 Hint 1</summary>

If the intervals were sorted by start, which merged interval could the next one possibly overlap?

</details>

<details>
<summary>💡 Hint 2</summary>

Only the **last** merged interval. So: sort by start, then for each interval either extend the last merged one (if `start <= last_end`) or append a new one.

</details>

<details>
<summary>💡 Hint 3</summary>

`for start, end in sorted(intervals):` if `merged` is non-empty and `start <= merged[-1][1]`, set `merged[-1][1] = max(merged[-1][1], end)`; otherwise append `[start, end]`.

</details>

### 2. Meeting rooms

Each meeting is `[start, end]` and occupies a room from `start` up to (but not including) `end`, so a meeting ending at 10 and one starting at 10 can share a room. Write `min_rooms(meetings)` returning the fewest rooms needed. It must handle 100,000 meetings quickly.

Starter code:

```python
import heapq

def min_rooms(meetings):
    pass

print(min_rooms([[0, 30], [5, 10], [15, 20]]))   # 2
print(min_rooms([[7, 10], [2, 4]]))              # 1
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** half-open meetings; an end at t frees the room for a start at t; empty → 0.
2. **Examples:** [[0, 30], [5, 10], [15, 20]] → 2.
3. **Brute force:** count the meetings running at each start time: O(n²).
4. **Pattern:** **sort by start + min-heap of end times** (or a sweep line of events).
5. **Plan:** reuse the earliest-freeing room when possible; otherwise add a room.
6. **Code and test:** back-to-back meetings, fully nested meetings, unsorted input.

</details>

<details>
<summary>💡 Hint 1</summary>

The number of rooms needed is the largest number of meetings in progress at the same moment. How can you track the meetings in progress as time moves forward?

</details>

<details>
<summary>💡 Hint 2</summary>

Process meetings in order of start time. Keep the end times of rooms in use in a min-heap: the smallest is the room that frees up first.

</details>

<details>
<summary>💡 Hint 3</summary>

For each meeting (sorted by start): if the heap's smallest end ≤ start, `heapreplace` it with this end (reuse the room); otherwise `heappush` the end (new room). Return the heap's size.

</details>

**In the sandbox:** exercises 95–96. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Merge intervals</summary>

```python
def merge(intervals):
    merged = []
    for start, end in sorted(intervals):          # sorted() copies, so the input is unchanged
        if merged and start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)   # overlaps the last one: extend it
        else:
            merged.append([start, end])           # a gap: start a new merged interval
    return merged

print(merge([[1, 3], [2, 6], [8, 10], [15, 18]]))
print(merge([[1, 4], [4, 5]]))
```

**Line by line**

- `sorted(intervals)` returns a new list ordered by start (then end), leaving the caller's list alone.
- After sorting, an interval can only overlap the most recent merged interval: everything earlier ended before that one began, or was merged into it.
- `max(merged[-1][1], end)` matters when the new interval lies inside the last one, like [2, 3] inside [1, 4].
- Appending `[start, end]` (a new list) means later extensions never change the input's lists.

**Trace** on [[1, 3], [2, 6], [8, 10], [15, 18]]:

| interval | last merged | action | merged |
|---|---|---|---|
| [1, 3] | — | append | [[1, 3]] |
| [2, 6] | [1, 3] | 2 ≤ 3: extend to 6 | [[1, 6]] |
| [8, 10] | [1, 6] | 8 > 6: append | [[1, 6], [8, 10]] |
| [15, 18] | [8, 10] | append | [[1, 6], [8, 10], [15, 18]] |

**Complexity:** O(n log n) time for the sort, O(n) for the output.

**Common wrong approach:** setting `merged[-1][1] = end` instead of the maximum, which shrinks [1, 4] to [1, 3] when [2, 3] follows.

</details>

<details>
<summary>✅ 2. Meeting rooms</summary>

```python
import heapq

def min_rooms(meetings):
    ends = []                                   # end times of the rooms in use
    for start, end in sorted(meetings):         # by start time
        if ends and ends[0] <= start:
            heapq.heapreplace(ends, end)        # the room that frees up first is free: reuse it
        else:
            heapq.heappush(ends, end)           # all rooms busy: open a new one
    return len(ends)                            # rooms are never closed, so this is the most ever needed

print(min_rooms([[0, 30], [5, 10], [15, 20]]))
print(min_rooms([[7, 10], [2, 4]]))
```

**Line by line**

- Sorting by start processes meetings in the order they begin.
- `ends[0]` is the earliest time any room becomes free. If it's free by this meeting's start (`<=`, because meetings are half-open), this meeting takes that room: `heapreplace` swaps in the new end time.
- Otherwise no room is free and a new one is opened.
- Rooms are never removed, so the heap size only grows when more rooms are needed at once: its final size is the peak.

**Trace** on [[0, 30], [5, 10], [15, 20]]:

| meeting | ends before | earliest free ≤ start? | ends after |
|---|---|---|---|
| [0, 30] | — | — | 30 |
| [5, 10] | 30 | no | 10, 30 |
| [15, 20] | 10, 30 | 10 ≤ 15: reuse | 20, 30 |

Two rooms.

**Complexity:** O(n log n) time, O(n) space.

**Common wrong approach:** comparing each meeting only with the previous one in sorted order, which misses a long meeting overlapping several later ones ([[1, 10], [2, 3], [4, 5]] needs 2 rooms, not 1, and nested meetings need more).

</details>

## Quick quiz

1. When do the closed intervals [a1, b1] and [a2, b2] overlap?
   - A) When a1 == a2
   - B) When b1 < a2
   - C) When a1 ≤ b2 and a2 ≤ b1

2. After sorting intervals by start, which merged interval can the next one overlap?
   - A) Only the first
   - B) Any of them
   - C) Only the last merged interval

3. In a sweep line for meeting rooms, why must an end event come before a start event at the same time?
   - A) To keep the list sorted
   - B) Because ends are more important
   - C) So a room freed at time t can be reused by a meeting starting at t

4. What does a difference array make cheap?
   - A) Applying many range additions before reading the values once
   - B) Sorting intervals
   - C) Answering many range-sum queries on fixed data

<details>
<summary>Quiz answers</summary>

1. **C) When a1 ≤ b2 and a2 ≤ b1**: Each must start before (or when) the other ends.
2. **C) Only the last merged interval**: Everything earlier ended before the last merged interval began.
3. **C) So a room freed at time t can be reused by a meeting starting at t**: Sorting (time, change) with −1 for ends puts them first automatically.
4. **A) Applying many range additions before reading the values once**: Each update touches two cells; one prefix-sum pass rebuilds the values.

</details>

---
Previous: [Lesson 45](45-greedy.md) · Next: [Lesson 47: Bit manipulation](47-bit-manipulation.md)
