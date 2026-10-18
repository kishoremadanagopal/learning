# Lesson 20: Vector search and vector databases

**You'll learn:** semantic search, embedding documents and queries, input types, using one model for both, exact search as a matrix-vector product, memory costs, reducing dimensions, quantisation, approximate nearest-neighbour search, IVF, HNSW, product quantisation, recall, metadata filtering, pre-filtering and post-filtering, access control, pgvector, FAISS and vector databases.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ai-engineering/#vector-search)**: run every example and check your exercise answers.

## Key terms

- **Semantic search:** finding text by meaning, using embeddings, rather than by shared words.
- **Exact (brute-force) search:** scoring every vector; perfectly accurate, linear in the corpus size.
- **Approximate nearest-neighbour (ANN) search:** an index that finds nearly the best matches while scoring only some vectors.
- **IVF (inverted file index):** vectors grouped into buckets around centroids; a query searches the nearest buckets.
- **HNSW:** a layered graph of neighbouring vectors, searched by greedy walks.
- **Quantisation:** storing numbers with fewer bits to save memory.
- **Recall@k:** the share of the true top-k results that a search returns.
- **Vector database:** a store for vectors and metadata with indexes for similarity search and filtering.

Keyword search matches **words**; vector search matches **meaning**. Embed every chunk once (Lesson 3), embed each query when it arrives, and return the chunks whose vectors are closest. "My chain keeps falling off" then finds the chunk about "adjusting a derailleur so the chain doesn't drop", without a single shared keyword.

## Documents and queries

```python
import voyageai

vo = voyageai.Client()
chunk_vectors = vo.embed(chunk_texts, model="voyage-4", input_type="document").embeddings   # once, at ingestion
query_vector = vo.embed([question], model="voyage-4", input_type="query").embeddings[0]     # per question
```

- Use the **same model** for documents and queries; vectors from different models live in unrelated spaces. Changing model means re-embedding the whole corpus.
- Some models, including Voyage's, take an **input type**: questions and passages are phrased differently, and the model adjusts for it.
- Embed at ingestion and store the vectors; never re-embed the corpus per query.

## Exact search

With normalised vectors, cosine similarity is a dot product, so scoring **every** chunk at once is one matrix-vector product:

```python
import numpy as np

rng = np.random.default_rng(0)
vectors = rng.normal(size=(10_000, 256))                         # 10,000 chunks, 256 dimensions
vectors /= np.linalg.norm(vectors, axis=1, keepdims=True)        # normalise once, at ingestion

query = vectors[42] + 0.03 * rng.normal(size=256)                # a query near chunk 42
query /= np.linalg.norm(query)

scores = vectors @ query                                         # 10,000 cosine similarities
top = np.argsort(-scores)[:5]                                    # best five
print(top, np.round(scores[top], 3))
```

This **exact** (brute-force) search is perfectly accurate and, with NumPy, fast up to hundreds of thousands of vectors. Its cost grows linearly with the corpus, and so does memory:

| Chunks | Dimensions | float32 storage |
|---|---|---|
| 100,000 | 1,024 | 0.4 GB |
| 1,000,000 | 1,024 | 4 GB |
| 10,000,000 | 1,024 | 41 GB |

Two ways to shrink it: **fewer dimensions** (many current models, including Voyage 4, can output 256, 512, 1,024 or 2,048 dimensions, trading a little quality for size), and **quantisation** (storing each number in 8 bits or even 1 bit instead of 32).

## Approximate nearest-neighbour (ANN) search

For millions of vectors, indexes find **almost** the best matches while scoring only a small fraction of them. They trade a little **recall** (the share of the true top-k results found) for a lot of speed.

- **IVF (inverted file):** cluster the vectors into buckets around **centroids** ahead of time. At query time, find the few nearest centroids and score only the vectors in those buckets. More buckets probed means better recall and slower search (the second exercise).
- **HNSW (hierarchical navigable small world):** a graph linking each vector to its neighbours, in layers from sparse to dense. Search starts at the top layer and walks greedily towards the query, dropping a layer at a time. It's the most common index today: fast, with high recall, at the cost of extra memory for the graph.
- **Product quantisation (PQ):** compress vectors into short codes; often combined with IVF for billion-scale collections.

![Points in a plane, coloured by which of four clusters they belong to, with a cross marking each cluster's centroid. A query star sits near the border of two clusters. The single nearest cluster is probed and shaded; one of the query's true nearest neighbours lies just across the border in an unprobed cluster, so it is missed. Probing two clusters would find it](../figures/ivf.svg)

Index settings (such as HNSW's `ef_search` or IVF's `n_probe`) tune the speed/recall trade-off. Measure recall against exact search on a sample of queries before trusting an index.

## Filtering

Real queries come with conditions: only this user's documents, only English, only the current product range. Store **metadata** with each vector and filter on it:

- **Pre-filtering** (apply the condition, then search what's left) always returns k results if enough match, but can be slow with an ANN index.
- **Post-filtering** (search, then drop non-matching results) is fast but can return **fewer than k**, even none, when the filter is selective.

Good vector databases filter **during** the index search. Access-control filters are not optional: retrieval must never surface a document the user isn't allowed to read.

## Where to store vectors

| Option | Good for |
|---|---|
| NumPy array or FAISS (a library) | prototypes, up to a few hundred thousand vectors in memory, or custom setups |
| **pgvector** (PostgreSQL extension) | apps already on Postgres: vectors next to your data, SQL filters, HNSW indexes |
| dedicated vector databases: Pinecone, Qdrant, Weaviate, Milvus, Chroma, LanceDB | large scale, managed hosting, built-in hybrid search and filtering |
| search engines with vector support: Elasticsearch, OpenSearch | when you also need strong keyword search |

```python
# pgvector: cosine distance is <=>, so the nearest rows come first
cur.execute("CREATE EXTENSION IF NOT EXISTS vector")
cur.execute("CREATE TABLE chunks (id bigserial PRIMARY KEY, lang text, body text, embedding vector(1024))")
cur.execute("CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops)")
cur.execute("SELECT body FROM chunks WHERE lang = %s ORDER BY embedding <=> %s::vector LIMIT 5",
            ("en", str(query_vector)))
```

Start simple: for most applications the database you already run is enough.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Exact vector search | normalise; matrix-vector product; argsort | O(n · d) | O(n · d) |
| Filtered search | pre-filter by metadata, then rank | O(n · d + m log m) | O(m) |
| IVF search | score centroids; search the n_probe nearest buckets | O(c · d + m · d) | O(n · d) |
| HNSW search | greedy walk through layered neighbour graphs | about O(log n) per query | O(n · d + links) |

## Common mistakes

- Embedding queries and documents with different models.
- Re-embedding the corpus on every query.
- Ranking by raw dot products of unnormalised vectors.
- Post-filtering with a fixed k and getting too few results.
- Trusting an ANN index without measuring its recall.

## Exercises

### 1. Vector search with a filter

Write `filtered_search(query, vectors, metadata, k, where=None)` returning the indexes of the `k` vectors most similar to `query` by **cosine similarity**, best first, among those whose metadata matches:

- `vectors` is a list of vectors (or a 2-D array); `metadata[i]` is a dict for vector `i`;
- `where` is a dict; a vector matches if its metadata has **every** key with an equal value (`None` means no filter);
- filter **first**, then rank (pre-filtering), so you return `k` results whenever at least `k` match;
- equal similarities keep the lower index first. Return a list of ints.

Starter code:

```python
import numpy as np

def filtered_search(query, vectors, metadata, k, where=None):
    pass

vectors = [[1, 0], [0.9, 0.1], [0, 1], [0.7, 0.7], [-1, 0]]
metadata = [{"lang": "en"}, {"lang": "fr"}, {"lang": "en"}, {"lang": "en"}, {"lang": "en"}]
print(filtered_search([1, 0], vectors, metadata, 2))                        # [0, 1]
print(filtered_search([1, 0], vectors, metadata, 2, where={"lang": "en"}))  # [0, 3]
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** filter → cosine-rank the survivors → top k → original indexes.
2. **Examples:** filter `lang = en` removes index 1, so the second-best becomes index 3 (0.707).
3. **Brute force:** compute every similarity, sort everything, then drop non-matches (post-filtering): same answer here, but in an ANN index post-filtering can lose results.
4. **Pattern:** **pre-filter, then exact search**.
5. **Plan:** matching indexes → candidate matrix → cosine scores → stable argsort → map back.
6. **Code and test:** no filter, empty result, k larger than the matches, unnormalised vectors, ties.

</details>

<details>
<summary>💡 Hint 1</summary>

First collect the indexes whose metadata matches: `all(meta.get(key) == value for key, value in where.items())` (true for every vector when there's no filter).

</details>

<details>
<summary>💡 Hint 2</summary>

Cosine similarity for many vectors at once: `candidates @ q / (np.linalg.norm(candidates, axis=1) * np.linalg.norm(q))`.

</details>

<details>
<summary>💡 Hint 3</summary>

`np.argsort(-scores, kind="stable")[:k]` gives positions within the candidates, best first; map them back with `keep[j]`.

</details>

### 2. An IVF index search

An **IVF** index has already clustered the (normalised) vectors: `centroids` is a list of centroid vectors and `assignments[i]` is the bucket of vector `i`. Write `ivf_search(query, centroids, assignments, vectors, k, n_probe)`:

1. Score every centroid by its dot product with the query; probe the `n_probe` best buckets (ties: lower bucket number first).
2. Score only the vectors in the probed buckets by dot product with the query.
3. Return the indexes of the best `k` of them, best first (ties: lower index first), as a list of ints.

Starter code:

```python
import numpy as np

def ivf_search(query, centroids, assignments, vectors, k, n_probe):
    pass

import math
angles = [0, 10, 20, 95, 100, 110, 185, 190, 200, 275]
vectors = [[math.cos(math.radians(a)), math.sin(math.radians(a))] for a in angles]
centroids = [[1, 0], [0, 1], [-1, 0], [0, -1]]
assignments = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3]
query = [0.643, 0.766]                      # 50 degrees: between buckets 0 and 1
print(ivf_search(query, centroids, assignments, vectors, 3, n_probe=1))   # [3, 4, 5]: misses the true best
print(ivf_search(query, centroids, assignments, vectors, 3, n_probe=2))   # [2, 1, 3]: the exact answer
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** coarse search over centroids, then exact search inside the chosen buckets.
2. **Examples:** the query at 50° is slightly closer to centroid 1 (at 90°) than centroid 0 (at 0°), but its true nearest vector (20°) lives in bucket 0.
3. **Brute force:** score every vector: exact, and what `n_probe` = number of buckets reproduces.
4. **Pattern:** **two-stage search**: cheap coarse filter, precise re-scoring.
5. **Plan:** centroid scores → probed set → candidates → candidate scores → top k → original indexes.
6. **Code and test:** border queries, small buckets, probing everything, centroid ties.

</details>

<details>
<summary>💡 Hint 1</summary>

Two rounds of the same idea: score with a matrix-vector product, then take the best few with `np.argsort(-scores, kind="stable")`.

</details>

<details>
<summary>💡 Hint 2</summary>

Round one picks buckets: the top `n_probe` centroids. Round two considers only the vectors whose `assignments[i]` is one of those buckets.

</details>

<details>
<summary>💡 Hint 3</summary>

Keep the list of candidate indexes so you can map positions in the candidate scores back to original indexes: `[candidates[j] for j in order]`.

</details>

**In the sandbox:** exercises 38–39. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Vector search with a filter</summary>

```python
import numpy as np

def filtered_search(query, vectors, metadata, k, where=None):
    where = where or {}
    keep = [i for i, meta in enumerate(metadata)
            if all(meta.get(key) == value for key, value in where.items())]
    if not keep or k <= 0:
        return []
    candidates = np.asarray(vectors, dtype=float)[keep]
    q = np.asarray(query, dtype=float)
    scores = candidates @ q / (np.linalg.norm(candidates, axis=1) * np.linalg.norm(q))
    order = np.argsort(-scores, kind="stable")[:k]           # stable: ties keep the lower index
    return [keep[j] for j in order]

vectors = [[1, 0], [0.9, 0.1], [0, 1], [0.7, 0.7], [-1, 0]]
metadata = [{"lang": "en"}, {"lang": "fr"}, {"lang": "en"}, {"lang": "en"}, {"lang": "en"}]
print(filtered_search([1, 0], vectors, metadata, 2))
print(filtered_search([1, 0], vectors, metadata, 2, where={"lang": "en"}))
```

**Line by line**

- `where or {}` turns `None` into "no conditions", so `all(...)` over an empty dict is `True` for every vector.
- `meta.get(key)` returns `None` for a missing key, so a vector without that field doesn't match.
- Dividing by both norms makes this cosine similarity. Without it, a long vector wins just for being long: for the query `[1, 0]`, the raw dot product prefers `[10, 10]` (10 versus 0.5), but cosine correctly prefers `[0.5, 0.01]`, which points almost exactly the same way (0.9998 versus 0.707).
- `kind="stable"` keeps equal scores in index order; NumPy's default sort makes no such promise.

**Trace** with `where={"lang": "en"}`: keep = [0, 2, 3, 4]; their scores are [1, 0, 0.707, −1]; the best two **positions** are 0 and 2 → `keep[0]`, `keep[2]` → [0, 3].

**Complexity:** O(n · d) to filter and score, plus O(m log m) to sort m matches.

**Common wrong approach:** searching first and filtering afterwards with a fixed k, which can return far fewer than k results (even none) when the filter is selective.

</details>

<details>
<summary>✅ 2. An IVF index search</summary>

```python
import numpy as np

def ivf_search(query, centroids, assignments, vectors, k, n_probe):
    q = np.asarray(query, dtype=float)
    centroid_scores = np.asarray(centroids, dtype=float) @ q
    probed = set(np.argsort(-centroid_scores, kind="stable")[:n_probe].tolist())
    candidates = [i for i, bucket in enumerate(assignments) if bucket in probed]
    if not candidates:
        return []
    scores = np.asarray(vectors, dtype=float)[candidates] @ q
    order = np.argsort(-scores, kind="stable")[:k]
    return [candidates[j] for j in order]

import math
angles = [0, 10, 20, 95, 100, 110, 185, 190, 200, 275]
vectors = [[math.cos(math.radians(a)), math.sin(math.radians(a))] for a in angles]
centroids = [[1, 0], [0, 1], [-1, 0], [0, -1]]
assignments = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3]
query = [0.643, 0.766]
print(ivf_search(query, centroids, assignments, vectors, 3, n_probe=1))
print(ivf_search(query, centroids, assignments, vectors, 3, n_probe=2))
```

**Line by line**

- One small product (`centroids @ q`) chooses buckets, instead of scoring all vectors.
- A `set` of probed buckets makes the membership test fast.
- Only candidates are scored, which is where the speed comes from with thousands of buckets.
- Mapping `candidates[j]` restores the original vector indexes.

**Trace** for the border query, `n_probe=1`: centroid scores [0.643, 0.766, −0.643, −0.766] → bucket 1 → candidates [3, 4, 5] → best three are all of them. The true top three are [2, 1, 3]: recall = 1/3. With `n_probe=2`, buckets 1 and 0 are searched and the result is exact.

**Complexity:** O(c · d) for c centroids plus O(m · d) for m candidates, instead of O(n · d).

**Common wrong approach:** assuming an ANN index returns the true nearest neighbours. Measure recall against exact search and raise `n_probe` (or HNSW's `ef_search`) until it's high enough for your use.

</details>

## Quick quiz

1. You switch to a newer embedding model. What must you do?
   - A) Nothing: vectors are universal
   - B) Only embed new documents with the new model
   - C) Re-embed every document, because vectors from different models aren't comparable

2. What does an approximate nearest-neighbour index trade away?
   - A) The ability to filter
   - B) A little recall, for much faster search
   - C) All accuracy

3. Why can post-filtering return fewer than k results?
   - A) Filters are always buggy
   - B) k is ignored by vector databases
   - C) It drops non-matching results after the search has already picked its top candidates

4. Roughly how much memory do 1,000,000 vectors of 1,024 float32 numbers need?
   - A) About 4 MB
   - B) About 4 TB
   - C) About 4 GB

<details>
<summary>Quiz answers</summary>

1. **C) Re-embed every document, because vectors from different models aren't comparable**: Queries and documents must come from the same model.
2. **B) A little recall, for much faster search**: Measure recall against exact search.
3. **C) It drops non-matching results after the search has already picked its top candidates**: Pre-filter or filter during the search.
4. **C) About 4 GB**: 1,000,000 × 1,024 × 4 bytes ≈ 4.1 GB.

</details>

---
Previous: [Lesson 19](19-keyword-search.md) · Next: [Lesson 21: Hybrid search and reranking](21-hybrid-and-reranking.md)
