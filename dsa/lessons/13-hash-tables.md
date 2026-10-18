# Lesson 13: How hash tables work

**You'll learn:** hash functions, buckets, collisions, separate chaining vs open addressing, load factor and resizing, average O(1) vs worst O(n), hash randomisation, hashable keys, building a hash map.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/dsa/#hash-tables)**: run every example and check your exercise answers.

## Key terms

- **Hash function:** turns a key into a number (its hash); the same key always gives the same hash.
- **Bucket:** a slot in a hash table's internal array where entries are stored.
- **Collision:** two different keys landing in the same bucket.
- **Separate chaining:** handling collisions by keeping a small list of entries in each bucket.
- **Open addressing:** handling collisions by probing other buckets until a free one is found; Python's dict does this.
- **Load factor:** number of entries ÷ number of buckets; higher means more collisions.
- **Resize (rehash):** moving every entry into a bigger table when the load factor gets too high.
- **Hash randomisation:** Python changes string hashes each run, so attackers can't force collisions.
- **frozenset:** an immutable set, usable as a dict key.

A list finds an item by its **position**. A **hash table** finds a value by its **key**, almost instantly, whatever the size. Python's `dict` and `set` are hash tables.

The idea: turn the key into a number with a **hash function**, and use that number to pick a **bucket** (a slot in an internal array) where the value is stored. Looking it up later repeats the same calculation and goes straight to that bucket.

![A hash table with 8 buckets. The key "cat" goes through the hash function, giving a big number; that number modulo 8 is 3, so "cat" is stored in bucket 3. The key "dog" lands in bucket 6. The key "owl" also hashes to bucket 3, a collision, so bucket 3 holds a short chain of two entries](../figures/hash-table.svg)

```python
for key in ["cat", "dog", 42, (1, 2)]:
    h = hash(key)
    print(f"{str(key):>6}  hash = {h:>22}  bucket in a table of 8: {h % 8}")
```

(String hashes change each time Python starts, a security feature called **hash randomisation**; numbers hash to themselves.)

## Collisions

Different keys can land in the **same bucket**: that's a **collision**, and it's unavoidable (there are infinitely many possible keys and only so many buckets). Two classic fixes:

| Strategy | How it works | Used by |
|---|---|---|
| **Separate chaining** | each bucket holds a small list of (key, value) pairs; search that list | Java's HashMap, many textbooks |
| **Open addressing** | if the bucket is taken, probe other buckets in a fixed sequence until a free one is found | Python's dict and set |

## Load factor and resizing

The **load factor** is items ÷ buckets. As it grows, collisions grow too, and lookups slow down. So hash tables **resize**: when the load factor passes a threshold (Python's dict keeps it below about ⅔), they allocate a bigger array and re-insert every item. That one resize is O(n), but like a list's growth it happens rarely, so inserts are **amortised O(1)** (Lesson 4).

## Average O(1), worst case O(n)

With a good hash function, keys spread evenly, every bucket holds O(1) items, and lookups, inserts and deletes are **O(1) on average**. In the worst case, when every key collides, the table degrades to a list: O(n). Attackers once exploited this by sending web servers many colliding keys, which is why string hashes are now randomised.

## Build one yourself (chaining)

```python
class TinyHashMap:
    def __init__(self, size=8):
        self.buckets = [[] for _ in range(size)]
        self.count = 0

    def _bucket(self, key):
        return self.buckets[hash(key) % len(self.buckets)]

    def put(self, key, value):
        bucket = self._bucket(key)
        for pair in bucket:
            if pair[0] == key:          # key already there: update
                pair[1] = value
                return
        bucket.append([key, value])
        self.count += 1
        if self.count / len(self.buckets) > 0.75:
            self._resize()

    def get(self, key, default=None):
        for k, v in self._bucket(key):
            if k == key:
                return v
        return default

    def _resize(self):
        old = [pair for bucket in self.buckets for pair in bucket]
        self.buckets = [[] for _ in range(2 * len(self.buckets))]
        self.count = 0
        for k, v in old:
            self.put(k, v)

m = TinyHashMap()
for i, word in enumerate(["cat", "dog", "owl", "emu", "yak", "elk", "ant"]):
    m.put(word, i)
print(m.get("owl"), m.get("ant"), m.get("cow", "missing"), "buckets:", len(m.buckets))
```

## Why keys must be immutable

A key's hash decides where it's stored. If the key could change after insertion, its hash would change, and the table would look in the wrong bucket. So Python only allows **hashable** keys: numbers, strings, tuples (of hashable things), frozensets. Lists, dicts and sets can't be keys.

```python
locations = {(51.5, -0.1): "London"}      # a tuple works as a key
print(locations[(51.5, -0.1)])
try:
    bad = {[1, 2]: "no"}
except TypeError as e:
    print("TypeError:", e)
```

Need a list-like key? Convert it: `tuple(my_list)`. Need a set-like key? Use `frozenset`.

## Sets, dicts and their costs

| Operation | dict / set average | worst |
|---|---|---|
| insert, look up, delete, `in` | O(1) | O(n) |
| iterate over everything | O(n) | O(n) |
| build from n items | O(n) | O(n²) |

Since Python 3.7, a `dict` remembers **insertion order** (sets don't promise any order).

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Hash table | hash(key) % size picks a bucket | O(1) average per operation | O(n) |
| Collisions (chaining) | each bucket holds a small list of pairs | O(1) average, O(n) worst | O(n) |
| Resizing | grow and re-insert when the load factor is high | O(n) per resize, amortised O(1) | O(n) |
| Your own hash map | buckets of [key, value] pairs with put / get / remove | O(1) average | O(n) |

## Common mistakes

- Assuming hash tables are always O(1). It's the average; the worst case is O(n).
- Using a list or dict as a key; convert to a tuple or frozenset.
- In your own hash map, appending a new pair without first checking whether the key exists.
- Relying on set order; only dicts keep insertion order.

## Exercises

### 1. Your own hash map

Complete the class `MyHashMap` (using **separate chaining**, without using Python's `dict` or `set` inside it) with:
- `put(key, value)`: insert, or update if the key exists;
- `get(key)`: the value, or `-1` if the key is missing;
- `remove(key)`: delete the key if present.

Starter code:

```python
class MyHashMap:
    def __init__(self):
        self.size = 1000
        self.buckets = [[] for _ in range(self.size)]

    def put(self, key, value):
        pass

    def get(self, key):
        pass

    def remove(self, key):
        pass
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** three operations; missing keys give −1; keys can collide (1 and 1001).
2. **Examples:** put(1, 1), get(1) → 1; put(1, 5) then get(1) → 5; get(3) → −1.
3. **Brute force:** one big list of pairs, searched every time: O(n) per operation.
4. **Pattern:** **hashing + separate chaining**: the hash picks a short bucket; search only that.
5. **Plan:** a helper to find the bucket; put: search, update or append; get: search or −1; remove: search and pop.
6. **Code and test:** test two keys in the same bucket and removing one of them.

</details>

<details>
<summary>💡 Hint 1</summary>

Every method starts the same way: find the bucket with `self.buckets[hash(key) % self.size]`.

</details>

<details>
<summary>💡 Hint 2</summary>

A bucket is a list of `[key, value]` pairs. `put` updates the pair if the key is there, otherwise appends a new pair; `get` searches the bucket.

</details>

<details>
<summary>💡 Hint 3</summary>

For `remove`, find the pair's position in the bucket with `enumerate` and `bucket.pop(i)`. Only remove the pair whose key matches.

</details>

**In the sandbox:** exercise 25. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Your own hash map</summary>

```python
class MyHashMap:
    def __init__(self):
        self.size = 1000
        self.buckets = [[] for _ in range(self.size)]

    def _bucket(self, key):
        return self.buckets[hash(key) % self.size]

    def put(self, key, value):
        bucket = self._bucket(key)
        for pair in bucket:
            if pair[0] == key:
                pair[1] = value          # update in place
                return
        bucket.append([key, value])

    def get(self, key):
        for k, v in self._bucket(key):
            if k == key:
                return v
        return -1

    def remove(self, key):
        bucket = self._bucket(key)
        for i, pair in enumerate(bucket):
            if pair[0] == key:
                bucket.pop(i)
                return
```

**Line by line**

- `_bucket(key)`: `hash(key) % self.size` maps any key to a bucket index 0–999. A helper avoids repeating it.
- `put`: if a pair with this key exists, change its value (`pair[1] = value`, which works because the pair is a list) and stop; otherwise append a new pair. Without the search you'd store duplicate keys.
- `get`: scan only this bucket. Return −1 if the key isn't there.
- `remove`: `enumerate` gives the position; `bucket.pop(i)` deletes that pair only.

**Trace:** put(1, 1), put(1001, 7) (both hash to bucket 1), then remove(1):

| operation | bucket 1 |
|---|---|
| put(1, 1) | [[1, 1]] |
| put(1001, 7) | [[1, 1], [1001, 7]] |
| get(1001) | scan → 7 |
| remove(1) | [[1001, 7]] |

**Complexity:** O(1 + chain length) per operation. With 1,000 buckets and evenly spread keys, chains are short: O(1) on average. A production table would also resize as it fills (like `TinyHashMap` above) to keep chains short.

</details>

## Quick quiz

1. What does a hash function do in a hash table?
   - A) Sorts the keys
   - B) Encrypts the values
   - C) Turns a key into a number used to pick a bucket

2. Two different keys land in the same bucket. This is called:
   - A) A collision
   - B) A resize
   - C) A rehash attack

3. Why can't a list be a dict key?
   - A) Only strings can be keys
   - B) Lists are too long
   - C) Lists can change, which would change their hash and lose the entry

4. What keeps a hash table's operations O(1) on average as it grows?
   - A) Resizing when the load factor gets too high
   - B) Sorting the buckets
   - C) Using only integer keys

<details>
<summary>Quiz answers</summary>

1. **C) Turns a key into a number used to pick a bucket**: The same key always gives the same bucket, so lookups go straight there.
2. **A) A collision**: Collisions are normal; chaining or probing handles them.
3. **C) Lists can change, which would change their hash and lose the entry**: Keys must be hashable (immutable). Use a tuple instead.
4. **A) Resizing when the load factor gets too high**: Fewer items per bucket means short searches.

</details>

---
Previous: [Lesson 12](12-string-matching.md) · Next: [Lesson 14: Hashing patterns: counting, Two Sum, grouping](14-hashing-patterns.md)
