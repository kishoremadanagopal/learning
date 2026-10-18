# Lesson 20: Designing a data structure: the LRU cache

**You'll learn:** caches and eviction, LRU design with a hash map and a doubly linked list, OrderedDict, functools.lru_cache and cache, LFU caches, how to approach design questions.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/dsa/#lru-cache)**: run every example and check your exercise answers.

## Key terms

- **Cache:** fast storage that keeps recent or frequent results so they don't have to be recomputed or fetched again.
- **Eviction:** removing an item from a full cache to make room.
- **LRU (least recently used):** evicts the item that hasn't been used for the longest time.
- **LFU (least frequently used):** evicts the item used the fewest times.
- **Cache hit / miss:** the item was in the cache / it wasn't.
- **OrderedDict:** a dict that remembers order and can move a key to either end in O(1).
- **Memoisation:** caching a function's results by its arguments.
- **@lru_cache / @cache:** Python decorators that memoise a function (bounded with LRU eviction / unbounded).

A **cache** keeps recent results close at hand so you don't recompute or re-download them. It has limited room, so when it's full something must go. **Least Recently Used (LRU)** eviction throws out the item that hasn't been used for the longest time. Browsers, databases, CDNs and operating systems all use it, and "design an LRU cache" is one of the most common interview design questions.

The requirement: `get(key)` and `put(key, value)` both in **O(1)**, where any access makes that key the most recently used.

## Why one structure isn't enough

- A **dict** finds a key in O(1), but has no cheap way to find the least recently used item.
- A **list** ordered by recency knows the oldest item, but moving an item to the end is O(n) (find it, remove it, append it).
- A **doubly linked list** can move or remove a node in O(1)... if you already hold that node.

So combine them: the dict maps each key **to its node** in a doubly linked list ordered from least to most recently used.

![An LRU cache with capacity 3. A dictionary maps keys a, b and c to nodes in a doubly linked list between head and tail sentinels; the node next to head is the least recently used (evicted first) and the node next to tail is the most recently used. A get(a) unlinks a's node and re-inserts it next to the tail](../figures/lru-cache.svg)

## The full design

```python
class Node:
    def __init__(self, key=None, value=None):
        self.key, self.value = key, value
        self.prev = self.next = None

class LRUCache:
    def __init__(self, capacity):
        self.capacity = capacity
        self.map = {}                              # key -> node
        self.head, self.tail = Node(), Node()      # sentinels: head.next is the LEAST recent
        self.head.next, self.tail.prev = self.tail, self.head

    def _unlink(self, node):                       # O(1)
        node.prev.next, node.next.prev = node.next, node.prev

    def _add_recent(self, node):                   # O(1): insert just before the tail
        node.prev, node.next = self.tail.prev, self.tail
        self.tail.prev.next = node
        self.tail.prev = node

    def get(self, key):
        node = self.map.get(key)
        if node is None:
            return -1
        self._unlink(node)                         # touched: move to most recent
        self._add_recent(node)
        return node.value

    def put(self, key, value):
        if key in self.map:
            self._unlink(self.map[key])
        node = Node(key, value)
        self.map[key] = node
        self._add_recent(node)
        if len(self.map) > self.capacity:          # evict the least recent
            oldest = self.head.next
            self._unlink(oldest)
            del self.map[oldest.key]               # this is why nodes store their key

cache = LRUCache(2)
cache.put("a", 1); cache.put("b", 2)
cache.get("a")                 # a is now the most recent
cache.put("c", 3)              # full: evicts b, the least recent
print(cache.get("b"), cache.get("a"), cache.get("c"))
```

Every step is a dict operation or a fixed number of pointer changes: **O(1) time** per call, **O(capacity) space**.

## The Python shortcut: OrderedDict

`collections.OrderedDict` is exactly a dict plus a doubly linked list inside, and gives you `move_to_end` and `popitem(last=False)` in O(1). In an interview, mention it, but expect to be asked to build the real thing.

```python
from collections import OrderedDict

class LRU:
    def __init__(self, capacity):
        self.capacity, self.data = capacity, OrderedDict()

    def get(self, key):
        if key not in self.data:
            return -1
        self.data.move_to_end(key)           # most recent at the end
        return self.data[key]

    def put(self, key, value):
        self.data[key] = value
        self.data.move_to_end(key)
        if len(self.data) > self.capacity:
            self.data.popitem(last=False)    # the first item is the least recent

c = LRU(2)
c.put(1, "one"); c.put(2, "two"); c.get(1); c.put(3, "three")
print(list(c.data.items()))
```

## Caching function results: functools

For caching a **function's** results (memoisation, which you'll use a lot in dynamic programming), Python has it built in:

```python
from functools import lru_cache, cache
import time

@lru_cache(maxsize=1024)          # LRU eviction after 1,024 distinct arguments
def slow_square(n):
    time.sleep(0.01)              # pretend this is expensive
    return n * n

t = time.perf_counter()
slow_square(12); slow_square(12); slow_square(12)
print(f"3 calls took {time.perf_counter() - t:.3f} s")
print(slow_square.cache_info())

@cache                            # unbounded cache (Python 3.9+)
def fib(n):
    return n if n < 2 else fib(n - 1) + fib(n - 2)
print(fib(90))
```

Arguments must be hashable (no lists), because they become dict keys.

## LFU: evict the least frequently used

**Least Frequently Used** evicts the key used the fewest times (ties broken by least recent). The O(1) design keeps a count per key and, for each count, an `OrderedDict` of keys in recency order, plus the current minimum count:

```python
from collections import defaultdict, OrderedDict

class LFUCache:
    def __init__(self, capacity):
        self.capacity = capacity
        self.vals, self.freq = {}, {}                  # key -> value, key -> use count
        self.buckets = defaultdict(OrderedDict)        # count -> keys in recency order
        self.min_freq = 0

    def _touch(self, key):
        f = self.freq[key]
        del self.buckets[f][key]
        if not self.buckets[f] and self.min_freq == f:
            self.min_freq += 1
        self.freq[key] = f + 1
        self.buckets[f + 1][key] = None

    def get(self, key):
        if key not in self.vals:
            return -1
        self._touch(key)
        return self.vals[key]

    def put(self, key, value):
        if self.capacity == 0:
            return
        if key in self.vals:
            self.vals[key] = value
            self._touch(key)
            return
        if len(self.vals) == self.capacity:            # evict from the lowest count, oldest first
            old, _ = self.buckets[self.min_freq].popitem(last=False)
            del self.vals[old], self.freq[old]
        self.vals[key], self.freq[key] = value, 1
        self.buckets[1][key] = None
        self.min_freq = 1

lfu = LFUCache(2)
lfu.put("a", 1); lfu.put("b", 2); lfu.get("a")   # a used twice, b once
lfu.put("c", 3)                                   # evicts b (lowest count)
print(lfu.get("b"), lfu.get("a"), lfu.get("c"))
```

## How to approach any "design a data structure" question

1. **List the operations and their required costs** (e.g. get O(1), put O(1), evict the oldest O(1)).
2. **For each operation, pick the structure that makes it fast**: lookup → hash map; order or oldest/newest → linked list, deque or heap; min/max → heap or extra stored state.
3. **Link the structures** so they stay in sync (the dict stores node references; nodes store their keys).
4. **Walk through an example** by hand, including the full and empty edge cases.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| LRU get / put | dict of key → node + doubly linked list in recency order | O(1) | O(capacity) |
| LRU with OrderedDict | move_to_end and popitem(last=False) | O(1) | O(capacity) |
| Memoise a function | @lru_cache(maxsize) or @cache | O(1) per repeated call | O(distinct arguments) |
| LFU get / put | count per key + OrderedDict per count + minimum count | O(1) | O(capacity) |

## Common mistakes

- Forgetting to remove the evicted key from the dict.
- Not treating `get` as a use, so recently read items get evicted.
- Creating a second node when updating an existing key instead of moving the existing one.
- Using @lru_cache on functions with list arguments (they aren't hashable).

## Exercises

### 1. Build an LRU cache

Complete `LRUCache(capacity)` with `get(key)` (the value, or `-1` if missing; counts as a use) and `put(key, value)` (insert or update, counts as a use; when over capacity, evict the least recently used key). Both must be O(1): 100,000 operations on a cache of 50,000 keys must be fast. Don't use `OrderedDict` here: build it with a dict and a doubly linked list.

Starter code:

```python
class Node:
    def __init__(self, key=None, value=None):
        self.key = key
        self.value = value
        self.prev = None
        self.next = None

class LRUCache:
    def __init__(self, capacity):
        self.capacity = capacity
        self.map = {}
        self.head = Node()
        self.tail = Node()
        self.head.next = self.tail
        self.tail.prev = self.head

    def get(self, key):
        pass

    def put(self, key, value):
        pass
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** get and put both count as a use; updating doesn't add a new key; evict exactly one least recent key when over capacity.
2. **Examples:** capacity 2: put 1, put 2, get 1 → 1, put 3 evicts 2, get 2 → −1.
3. **Brute force:** dict + a Python list of keys in recency order: `list.remove` is O(n).
4. **Pattern:** **hash map + doubly linked list** (the dict stores node references).
5. **Plan:** sentinels head/tail; helpers unlink / add_recent; get moves to recent; put updates or inserts, then evicts head.next if needed.
6. **Code and test:** capacity 1, updating an existing key, get counting as a use.

</details>

<details>
<summary>💡 Hint 1</summary>

You need two things in O(1): find a key, and find/move the least recently used one. Which structure is good at each?

</details>

<details>
<summary>💡 Hint 2</summary>

A dict for lookup, and a doubly linked list in recency order for moving and evicting. The dict's values are the **nodes**.

</details>

<details>
<summary>💡 Hint 3</summary>

Write `_unlink(node)` and `_add_recent(node)` (insert before the tail). `get`: if found, unlink + add_recent, return value. `put`: update or create, add_recent, and if over capacity remove `head.next` from the list **and** from the dict (that's why nodes store their key).

</details>

**In the sandbox:** exercise 41. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Build an LRU cache</summary>

```python
class Node:
    def __init__(self, key=None, value=None):
        self.key = key
        self.value = value
        self.prev = None
        self.next = None

class LRUCache:
    def __init__(self, capacity):
        self.capacity = capacity
        self.map = {}                    # key -> node
        self.head = Node()               # head.next = least recently used
        self.tail = Node()               # tail.prev = most recently used
        self.head.next = self.tail
        self.tail.prev = self.head

    def _unlink(self, node):
        node.prev.next = node.next
        node.next.prev = node.prev

    def _add_recent(self, node):
        node.prev = self.tail.prev
        node.next = self.tail
        self.tail.prev.next = node
        self.tail.prev = node

    def get(self, key):
        node = self.map.get(key)
        if node is None:
            return -1
        self._unlink(node)
        self._add_recent(node)
        return node.value

    def put(self, key, value):
        node = self.map.get(key)
        if node:                                 # update: change the value, mark as recent
            node.value = value
            self._unlink(node)
            self._add_recent(node)
            return
        node = Node(key, value)
        self.map[key] = node
        self._add_recent(node)
        if len(self.map) > self.capacity:
            lru = self.head.next                 # least recently used
            self._unlink(lru)
            del self.map[lru.key]
```

**Line by line**

- `self.map` maps each key to its **node**, so we can reach any node in O(1).
- The list runs from least recent (`head.next`) to most recent (`tail.prev`). Sentinels mean inserting and removing never need `if` checks for empty lists.
- `_unlink` connects a node's neighbours to each other; `_add_recent` splices the node in just before `tail`. Both are four pointer assignments at most.
- `get` on a hit moves the node to the recent end, because reading counts as a use.
- `put` on an existing key updates the value and moves it (no eviction needed: the size doesn't change).
- When the size exceeds capacity, `head.next` is the least recent node. Unlink it, and delete `lru.key` from the dict: the node must remember its own key, or we couldn't find the dict entry to delete.

**Trace** with capacity 2:

| operation | list (least → most recent) | returns |
|---|---|---|
| put 1, put 2 | 1 2 | |
| get 1 | 2 1 | 1 |
| put 3 | 2 1 3 → evict 2 → 1 3 | |
| get 2 | 1 3 | −1 |

**Complexity:** O(1) per operation, O(capacity) space.

**Common wrong approach:** forgetting to delete the evicted key from the dict, so `get` still finds a node that's no longer in the list (and the dict grows forever).

</details>

## Quick quiz

1. Why does an LRU cache need both a dict and a doubly linked list?
   - A) The dict finds a key in O(1); the list keeps recency order and moves or removes nodes in O(1)
   - B) A dict alone can evict the oldest key in O(1)
   - C) The dict stores values and the list stores keys, for no reason

2. Why does each node store its key?
   - A) When the oldest node is evicted, you need its key to delete it from the dict
   - B) Nodes are sorted by key
   - C) To compute the hash

3. What does @lru_cache do to a function?
   - A) Remembers the results for recent arguments and returns them without recomputing
   - B) Limits how often it can be called
   - C) Makes the function run in parallel

4. An LFU cache evicts:
   - A) The key used the fewest times (oldest first on ties)
   - B) A random key
   - C) The most recently used key

<details>
<summary>Quiz answers</summary>

1. **A) The dict finds a key in O(1); the list keeps recency order and moves or removes nodes in O(1)**: Each structure makes a different operation fast; together they make every operation O(1).
2. **A) When the oldest node is evicted, you need its key to delete it from the dict**: The list tells you which node is oldest; the key tells you which dict entry to remove.
3. **A) Remembers the results for recent arguments and returns them without recomputing**: It's memoisation with LRU eviction; arguments must be hashable.
4. **A) The key used the fewest times (oldest first on ties)**: Least Frequently Used counts uses; LRU only looks at recency.

</details>

---
Previous: [Lesson 19](19-queues-deques.md) · Next: [Lesson 21: Recursion and recursion trees](21-recursion.md)
