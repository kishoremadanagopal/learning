# Lesson 3: Embeddings and similarity

**You'll learn:** vectors and embeddings, meaning as direction, dot product, cosine similarity, Euclidean distance, normalisation, nearest-neighbour search, bag-of-words vectors versus learned embeddings, embedding APIs, uses of embeddings.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ai-engineering/#embeddings)**: run every example and check your exercise answers.

## Key terms

- **Vector:** a list of numbers; here, a point in a many-dimensional space.
- **Embedding:** a vector produced by a model so that similar meanings get similar vectors.
- **Dot product:** the sum of the products of matching coordinates.
- **Cosine similarity:** the dot product divided by both vectors' lengths: how closely two vectors point the same way.
- **Normalised vector:** a vector scaled to length 1.
- **Nearest-neighbour search:** finding the stored vectors most similar to a query vector.
- **Bag of words:** a vector of word counts; matches identical words but not meaning.

Inside a model, every token becomes a list of numbers called a **vector** or **embedding**. The numbers are learned during training so that texts with **similar meaning end up close together**: "dog" near "puppy", "invoice" near "receipt". Separate **embedding models** turn a whole sentence or document into one vector; comparing vectors then measures how related two texts are, which is the foundation of semantic search and RAG (Part 4).

![A 2-D map of word embeddings. Animal words (dog, puppy, cat, kitten) cluster in one corner, vehicle words (car, truck, bus) in another, and food words (pizza, pasta, bread) in a third. An arrow from "dog" to "puppy" has the same direction and length as the arrow from "cat" to "kitten"](../figures/embedding-space.svg)

Real embeddings have hundreds to a few thousand dimensions (often 256 to 3,072), not two; the picture squashes them down to show the idea.

## Measuring similarity

| Measure | Formula | Notes |
|---|---|---|
| **Dot product** | a · b = Σ aᵢ bᵢ | grows with vector length as well as direction |
| **Cosine similarity** | (a · b) / (‖a‖ ‖b‖) | the angle only: 1 = same direction, 0 = unrelated, −1 = opposite |
| **Euclidean distance** | √Σ (aᵢ − bᵢ)² | straight-line distance; smaller = more similar |

Most embedding models return **normalised** vectors (length 1), and then the dot product and cosine similarity are identical: the dot product is the cheapest to compute, so vector databases use it.

```python
import math

def dot(a, b):
    return sum(x * y for x, y in zip(a, b))

def norm(a):
    return math.sqrt(dot(a, a))

def cosine(a, b):
    return dot(a, b) / (norm(a) * norm(b))

dog, puppy, car = [0.9, 0.8, 0.1], [0.85, 0.9, 0.05], [0.1, 0.2, 0.95]
print(round(cosine(dog, puppy), 3), round(cosine(dog, car), 3))
print(round(cosine([1, 2, 3], [2, 4, 6]), 3), "(same direction, different length)")
```

With NumPy, the same maths runs on thousands of vectors at once:

```python
import numpy as np

docs = np.array([[0.9, 0.8, 0.1],      # "dog"
                 [0.85, 0.9, 0.05],    # "puppy"
                 [0.1, 0.2, 0.95],     # "car"
                 [0.2, 0.1, 0.9]])     # "truck"
names = ["dog", "puppy", "car", "truck"]
docs = docs / np.linalg.norm(docs, axis=1, keepdims=True)   # normalise each row to length 1

query = np.array([0.15, 0.15, 0.9])
query = query / np.linalg.norm(query)
scores = docs @ query                      # one matrix-vector product = all cosine similarities
for i in np.argsort(-scores):              # best first
    print(f"{names[i]:6} {scores[i]:.3f}")
```

## Where do the vectors come from?

A simple, transparent starting point is a **bag of words**: one dimension per vocabulary word, counting how often it appears. It captures shared words but not meaning ("car" and "automobile" share nothing). **Learned embeddings** from a neural model capture meaning, synonyms and even cross-language similarity.

```python
from collections import Counter
import math

def bag_of_words(text, vocab):
    counts = Counter(text.lower().split())
    return [counts[w] for w in vocab]

def cosine(a, b):
    d = sum(x * y for x, y in zip(a, b))
    return d / (math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b)) or 1)

docs = ["the cat sat on the mat", "a dog chased the cat", "stock prices fell sharply today"]
vocab = sorted({w for d in docs for w in d.split()})
vectors = [bag_of_words(d, vocab) for d in docs]
query = bag_of_words("where did the cat sit", vocab)
for d, v in zip(docs, vectors):
    print(f"{cosine(query, v):.2f}  {d}")
```

In practice you call an embedding model through an API (or run an open model locally). Anthropic recommends Voyage AI for embeddings; OpenAI, Google, Cohere and open-source models (such as those on Hugging Face) are common choices:

```python
import voyageai                                     # pip install voyageai
vo = voyageai.Client()                              # reads VOYAGE_API_KEY
result = vo.embed(["The cat sat on the mat.", "Stock prices fell."], model="voyage-4", input_type="document")
print(len(result.embeddings[0]))                    # the vector size

from openai import OpenAI                           # pip install openai
client = OpenAI()                                   # reads OPENAI_API_KEY
resp = client.embeddings.create(model="text-embedding-3-small", input=["The cat sat on the mat."])
print(len(resp.data[0].embedding))
```

Model names and sizes change; check the provider's documentation for the current recommended model.

## What embeddings are used for

| Use | How |
|---|---|
| **Semantic search** and **RAG** | embed documents once; embed each query; return the most similar documents |
| **Recommendations** | "more like this": nearest neighbours of an item's vector |
| **Clustering** | group similar support tickets or reviews (k-means on the vectors) |
| **Classification** | train a small classifier (logistic regression) on the vectors |
| **De-duplication** | near-identical vectors flag near-duplicate texts |
| **Anomaly detection** | a vector far from everything else is unusual |

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Cosine similarity | dot(a, b) / (‖a‖ · ‖b‖) | O(d) | O(1) |
| Similarity on normalised vectors | dot product | O(d) | O(1) |
| Exact top-k search | score every vector, keep the best k | O(n · d) per query | O(n) |
| Many similarities at once | matrix-vector product in NumPy | O(n · d) | O(n · d) |

## Common mistakes

- Comparing embeddings from two different models (their spaces don't match).
- Using the raw dot product on vectors that aren't normalised.
- Expecting bag-of-words vectors to match synonyms.
- Re-embedding the whole document collection for every query instead of once.

## Exercises

### 1. Cosine similarity

Write `cosine_similarity(a, b)` for two equal-length lists of numbers. Return 0.0 if either vector is all zeros (the formula would divide by zero).

Starter code:

```python
import math

def cosine_similarity(a, b):
    pass

print(cosine_similarity([1, 0], [0, 1]))      # 0.0: perpendicular
print(cosine_similarity([1, 2, 3], [2, 4, 6]))  # 1.0: same direction
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** angle-based similarity in [−1, 1]; zero vectors give 0.0.
2. **Examples:** [1, 2, 3] vs [2, 4, 6] → 1.0 (same direction).
3. **Brute force:** index loops: fine.
4. **Pattern:** **dot product / (norm × norm)**.
5. **Plan:** compute the dot and both norms, guard zeros, divide.
6. **Code and test:** perpendicular, opposite, zero vector.

</details>

<details>
<summary>💡 Hint 1</summary>

Cosine similarity is the dot product divided by the product of the two lengths.

</details>

<details>
<summary>💡 Hint 2</summary>

Dot product: `sum(x * y for x, y in zip(a, b))`. Length: `math.sqrt(sum(x * x for x in a))`.

</details>

<details>
<summary>💡 Hint 3</summary>

If either length is 0, return 0.0 before dividing.

</details>

### 2. Top-k nearest documents

`docs` maps a document name to its vector. Write `top_k(query, docs, k)` returning the names of the `k` documents most similar to `query` by cosine similarity, most similar first (ties broken alphabetically by name). Assume no zero vectors. This is the heart of semantic search.

Starter code:

```python
import math

def top_k(query, docs, k):
    pass

docs = {"dog": [0.9, 0.8, 0.1], "puppy": [0.85, 0.9, 0.05], "car": [0.1, 0.2, 0.95], "truck": [0.2, 0.1, 0.9]}
print(top_k([0.15, 0.15, 0.9], docs, 2))   # ['car', 'truck']
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** rank by cosine similarity, descending; ties by name; k may exceed the number of docs.
2. **Examples:** a "vehicle-like" query returns car, then truck.
3. **Brute force:** this **is** brute-force (exact) nearest-neighbour search: O(n · d) per query, perfect up to a few hundred thousand vectors.
4. **Pattern:** **score everything, sort, slice** (or a heap for top k).
5. **Plan:** cosine per doc → sort by (−score, name) → first k names.
6. **Code and test:** k = 0, k larger than n, ties.

</details>

<details>
<summary>💡 Hint 1</summary>

Score every document against the query, then keep the best k.

</details>

<details>
<summary>💡 Hint 2</summary>

Build a list of `(score, name)` pairs and sort it. To get the highest score first but alphabetical names on ties, sort by `(-score, name)`.

</details>

<details>
<summary>💡 Hint 3</summary>

`scored = sorted((-cosine(query, v), name) for name, v in docs.items())`, then `[name for _, name in scored[:k]]`. For huge collections, `heapq.nsmallest(k, ...)` avoids sorting everything.

</details>

**In the sandbox:** exercises 5–6. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Cosine similarity</summary>

```python
import math

def cosine_similarity(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0                              # undefined for a zero vector: treat as unrelated
    return dot / (norm_a * norm_b)

print(cosine_similarity([1, 0], [0, 1]))
print(cosine_similarity([1, 2, 3], [2, 4, 6]))
```

**Line by line**

- The dot product multiplies matching coordinates and adds them up.
- Each norm is the square root of a vector's dot product with itself, its length.
- Dividing by both lengths removes the effect of magnitude, leaving only direction.

**Trace** for [3, 4] and [4, 3]: dot = 12 + 12 = 24; norms 5 and 5; 24 / 25 = 0.96.

**Complexity:** O(d) for d dimensions.

**Common wrong approach:** returning the raw dot product, which rates long vectors as "more similar" just because they're longer.

</details>

<details>
<summary>✅ 2. Top-k nearest documents</summary>

```python
import math

def top_k(query, docs, k):
    def cosine(a, b):
        dot = sum(x * y for x, y in zip(a, b))
        return dot / (math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b)))
    scored = [(-cosine(query, vec), name) for name, vec in docs.items()]
    scored.sort()                                  # highest similarity first, then by name
    return [name for _, name in scored[:k]]

docs = {"dog": [0.9, 0.8, 0.1], "puppy": [0.85, 0.9, 0.05], "car": [0.1, 0.2, 0.95], "truck": [0.2, 0.1, 0.9]}
print(top_k([0.15, 0.15, 0.9], docs, 2))
```

**Line by line**

- Negating the score turns "highest first" into an ascending sort, so the tuple sort handles ties by name automatically.
- `scored[:k]` copes with k = 0 (empty list) and k > n (all documents).
- The cosine helper normalises both vectors, so magnitude doesn't matter: [2, 0] and [5, 0] score the same against [1, 0], and the name decides.

**Trace** for the query [1.0, 0.0] with a: [5, 0], b: [2, 0], c: [0, 1]: scores 1, 1, 0 → sorted (−1, a), (−1, b), (0, c) → ["a", "b"].

**Complexity:** O(n · d + n log n) per query. Vector databases use approximate indexes to avoid scoring every vector (Lesson 20).

**Common wrong approach:** sorting with `reverse=True` on `(score, name)`, which reverses the name order too, so ties come out in reverse alphabetical order.

</details>

## Quick quiz

1. What does it mean for two embeddings to have cosine similarity close to 1?
   - A) They contain exactly the same words
   - B) They have the same length
   - C) They point in nearly the same direction: the texts are closely related in meaning

2. Why are dot product and cosine similarity the same for normalised vectors?
   - A) Because both use subtraction
   - B) Normalised vectors have length 1, so dividing by the lengths changes nothing
   - C) They're never the same

3. Which representation knows that "car" and "automobile" are related?
   - A) A one-hot vector
   - B) A learned embedding from a neural model
   - C) A bag-of-words count vector

4. Which task is NOT a typical use of embeddings?
   - A) Clustering similar documents
   - B) Semantic search
   - C) Exact arithmetic on large numbers

<details>
<summary>Quiz answers</summary>

1. **C) They point in nearly the same direction: the texts are closely related in meaning**: Cosine similarity ignores length and measures the angle.
2. **B) Normalised vectors have length 1, so dividing by the lengths changes nothing**: That's why vector databases often just use the dot product.
3. **B) A learned embedding from a neural model**: Bag of words only matches identical words.
4. **C) Exact arithmetic on large numbers**: Embeddings capture meaning, not precise calculation.

</details>

---
Previous: [Lesson 2](02-tokens.md) · Next: [Lesson 4: Transformers and attention](04-attention.md)
