# Lesson 21: Hybrid search and reranking

**You'll learn:** hybrid search, the retrieval funnel, why scores from different retrievers can't be added, reciprocal rank fusion, weighted score fusion, min-max normalisation, bi-encoders and cross-encoders, rerankers, how many chunks to pass to the model, contextual retrieval results, query rewriting, multi-query retrieval, hypothetical document embeddings (HyDE), routing.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ai-engineering/#hybrid-and-reranking)**: run every example and check your exercise answers.

## Key terms

- **Hybrid search:** running keyword and vector search and merging their results.
- **Reciprocal rank fusion (RRF):** merging ranked lists by summing 1 ÷ (k + rank) for each document.
- **Min-max normalisation:** rescaling scores to 0–1 using the list's minimum and maximum.
- **Bi-encoder:** a model that embeds query and document separately; fast and precomputable.
- **Cross-encoder (reranker):** a model that reads query and document together and scores their relevance.
- **Query rewriting:** turning a question into a better search query, such as a standalone version of a follow-up.
- **HyDE:** searching with the embedding of a model-written hypothetical answer.

Keyword search finds exact terms; vector search finds meaning (Lessons 19–20). Each misses what the other catches, so strong RAG systems run **both** and merge the results: **hybrid search**. Then a slower, more accurate **reranker** re-orders the shortlist before it reaches the prompt.

## The retrieval funnel

![A funnel. At the top, keyword search and vector search each return about 100 candidates from the whole corpus. Fusion merges them into one list of about 150. A reranker reads each candidate together with the query and keeps the best 20. Those 20 chunks go into the prompt](../figures/retrieval-funnel.svg)

Each stage is more accurate and more expensive per item than the one before, so each handles fewer items. Anthropic's 2024 contextual-retrieval experiments followed this shape: retrieving 150 candidates, reranking, and passing the top 20 to the model, with 20 chunks working better than 5 or 10.

## Fusing two result lists

The scores can't simply be added: BM25 scores are unbounded (12.4 means nothing on its own), while cosine similarities sit between −1 and 1, and both shift from query to query. Two standard fixes:

**Reciprocal rank fusion (RRF)** ignores the scores and uses only each document's **rank** in each list:

```text
RRF(d) = Σ  1 / (k + rank_r(d))        with k = 60 by convention
         r
```

A document near the top of **both** lists beats one that tops only one. RRF needs no tuning, which makes it the usual default (the first exercise).

**Weighted score fusion** rescales each list's scores to 0–1 (for example with min-max normalisation) and blends them: `α × vector + (1 − α) × keyword`. It keeps information about **how much** better one result is, but needs α tuned on your evaluation set (the second exercise).

```python
keyword = ["sh-m8100-manual", "brake-pads", "lever-install"]    # BM25 ranking
vector = ["lever-install", "brake-bleeding", "sh-m8100-manual"]  # embedding ranking

scores = {}
for ranking in (keyword, vector):
    for rank, doc in enumerate(ranking, start=1):
        scores[doc] = scores.get(doc, 0) + 1 / (60 + rank)

for doc in sorted(scores, key=scores.get, reverse=True):
    print(f"{scores[doc]:.4f}  {doc}")
```

## Rerankers

An embedding model encodes the query and each document **separately** (a **bi-encoder**): fast, because document vectors are computed once in advance, but the model never sees them together. A **reranker** (a **cross-encoder**) reads the query and a candidate **together** and outputs a relevance score. It's far more accurate, and far too slow to run over a whole corpus, so it only re-orders the shortlist.

```python
import voyageai

vo = voyageai.Client()
result = vo.rerank(query=question, documents=candidate_texts, model="rerank-2.5", top_k=20)
for r in result.results:                     # best first
    print(r.index, round(r.relevance_score, 3), r.document[:60])
```

Options include Voyage's `rerank-2.5` and `rerank-2.5-lite`, Cohere Rerank, open-weight rerankers (such as the BGE rerankers on Hugging Face), or an LLM prompted to grade relevance. In Anthropic's experiments, adding contextual retrieval (Lesson 18), BM25 and a reranker together cut the top-20 retrieval failure rate from 5.7% to 1.9%, a 67% reduction.

## Fix the query, too

Retrieval can only be as good as the query you send it:

- **Rewrite follow-ups.** In a conversation, "What about helmets?" means nothing on its own. Have a model rewrite it into a standalone query ("What is the returns policy for helmets?") using the chat history.
- **Multiple queries.** Generate a few phrasings, search with each, and fuse the results (RRF again).
- **Hypothetical answers (HyDE).** Have a model write a plausible answer, embed **that**, and search with it: answers often look more like the documents than questions do.
- **Route.** Some questions need a database or a tool, not document search at all (Part 5).

Each extra step adds latency and cost; add them when your evaluation (Lesson 22) shows retrieval failing on those kinds of question.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Reciprocal rank fusion | sum 1 ÷ (k + rank) per document; sort | O(entries + D log D) | O(D) |
| Weighted fusion | min-max each list; α·vector + (1 − α)·keyword | O(D log D) | O(D) |
| Rerank | score each shortlist item with a cross-encoder; keep the top n | O(shortlist) model calls | O(shortlist) |

## Common mistakes

- Adding raw scores from different retrievers.
- Running a reranker over the entire corpus.
- Passing only one or two chunks when the evaluation shows more help.
- Searching with an unrewritten follow-up question.
- Adding retrieval tricks without measuring whether they help.

## Exercises

### 1. Reciprocal rank fusion

Write `rrf(rankings, k=60)`. `rankings` is a list of ranked lists of document IDs (best first; ranks start at 1). Each document's score is the sum over the lists it appears in of `1 / (k + rank)`. Return all the document IDs sorted by score, highest first; ties keep the order in which the documents were **first seen** (reading the lists in order, each from its top).

Starter code:

```python
def rrf(rankings, k=60):
    pass

keyword = ["sh-m8100-manual", "brake-pads", "lever-install"]
vector = ["lever-install", "brake-bleeding", "sh-m8100-manual"]
print(rrf([keyword, vector]))
# ['sh-m8100-manual', 'lever-install', 'brake-pads', 'brake-bleeding']
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** sum of reciprocal ranks across lists; sort; stable ties.
2. **Examples:** `p` is first in one list (1/61 ≈ 0.0164); `s` is fourth in one and first in another (1/64 + 1/61 ≈ 0.0320), so `s` wins.
3. **Brute force:** for each document, search every list for its rank: O(D × L × n).
4. **Pattern:** **accumulate scores in a dict, then sort**.
5. **Plan:** loop lists and ranks → add → stable sort descending.
6. **Code and test:** ties, three lists, empty lists, a different k.

</details>

<details>
<summary>💡 Hint 1</summary>

Keep a dict from document ID to its running score; `enumerate(ranking, start=1)` gives each document's rank.

</details>

<details>
<summary>💡 Hint 2</summary>

Add `1 / (k + rank)` for every appearance. A Python dict remembers the order keys were first inserted.

</details>

<details>
<summary>💡 Hint 3</summary>

`sorted(scores, key=lambda d: scores[d], reverse=True)` is stable, so tied documents stay in first-seen order.

</details>

### 2. Weighted fusion with min-max scaling

Write `weighted_fusion(keyword_scores, vector_scores, alpha=0.5)`. Both arguments are dicts from document ID to a score (higher is better).

1. **Min-max normalise** each dict separately: `(score − min) / (max − min)`. If all of a dict's scores are equal, each becomes `1.0`.
2. A document's fused score is `alpha × vector + (1 − alpha) × keyword`, using `0` for a list it's missing from.
3. Return every document ID, sorted by fused score (highest first); ties by ID in alphabetical order.

Starter code:

```python
def weighted_fusion(keyword_scores, vector_scores, alpha=0.5):
    pass

keyword = {"d1": 12.0, "d2": 3.0, "d3": 0.5}
vector = {"d2": 0.82, "d3": 0.79, "d4": 0.40}
print(weighted_fusion(keyword, vector))             # ['d2', 'd1', 'd3', 'd4']
print(weighted_fusion(keyword, vector, alpha=0.9))  # ['d2', 'd3', 'd1', 'd4']
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** put both score lists on a 0–1 scale, blend, rank.
2. **Examples:** keyword d2 = (3 − 0.5) / 11.5 ≈ 0.217; vector d2 = 1.0 → fused 0.609, the best.
3. **Brute force:** adding raw scores: BM25's larger numbers would swamp the cosines.
4. **Pattern:** **normalise, then weighted sum**.
5. **Plan:** normalise each dict → union of IDs → blend → sort with a tuple key.
6. **Code and test:** α = 0 and 1, single entries, empty dicts, equal scores.

</details>

<details>
<summary>💡 Hint 1</summary>

Write a helper that min-max normalises one dict, handling the empty dict and the all-equal case.

</details>

<details>
<summary>💡 Hint 2</summary>

The documents to score are the union of both dicts' keys: `set(a) | set(b)`. Use `.get(doc, 0.0)` for missing ones.

</details>

<details>
<summary>💡 Hint 3</summary>

Sort with `key=lambda doc: (-fused[doc], doc)`: the minus sign puts high scores first, and the ID breaks ties alphabetically.

</details>

**In the sandbox:** exercises 40–41. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Reciprocal rank fusion</summary>

```python
def rrf(rankings, k=60):
    scores = {}                                   # dicts remember insertion (first-seen) order
    for ranking in rankings:
        for rank, doc in enumerate(ranking, start=1):
            scores[doc] = scores.get(doc, 0.0) + 1 / (k + rank)
    return sorted(scores, key=lambda doc: scores[doc], reverse=True)   # stable sort keeps ties in order

keyword = ["sh-m8100-manual", "brake-pads", "lever-install"]
vector = ["lever-install", "brake-bleeding", "sh-m8100-manual"]
print(rrf([keyword, vector]))
```

**Line by line**

- `scores.get(doc, 0.0)` starts a new document at zero.
- `start=1` makes the top result rank 1, so it adds `1 / 61` with the default k.
- Sorting with `reverse=True` is still stable in Python: equal scores keep the dict's insertion order.
- The constant k dampens the difference between rank 1 and rank 2, so agreement across lists matters more than one first place.

**Trace** on the lesson example: sh-m8100-manual = 1/61 + 1/63 ≈ 0.0323; lever-install = 1/63 + 1/61 (the same); brake-pads = 1/62; brake-bleeding = 1/62. Ties are broken by first appearance.

**Complexity:** O(total entries + D log D) for D distinct documents.

**Common wrong approach:** adding raw BM25 and cosine scores, so whichever scale is larger dominates the result.

</details>

<details>
<summary>✅ 2. Weighted fusion with min-max scaling</summary>

```python
def normalise(scores):
    if not scores:
        return {}
    low, high = min(scores.values()), max(scores.values())
    if high == low:
        return {doc: 1.0 for doc in scores}
    return {doc: (s - low) / (high - low) for doc, s in scores.items()}

def weighted_fusion(keyword_scores, vector_scores, alpha=0.5):
    kw, vec = normalise(keyword_scores), normalise(vector_scores)
    fused = {doc: alpha * vec.get(doc, 0.0) + (1 - alpha) * kw.get(doc, 0.0)
             for doc in set(kw) | set(vec)}
    return sorted(fused, key=lambda doc: (-fused[doc], doc))

keyword = {"d1": 12.0, "d2": 3.0, "d3": 0.5}
vector = {"d2": 0.82, "d3": 0.79, "d4": 0.40}
print(weighted_fusion(keyword, vector))
print(weighted_fusion(keyword, vector, alpha=0.9))
```

**Line by line**

- The helper returns `{}` for an empty dict, avoiding `min()` of nothing.
- When every score is equal, the formula would divide by zero; treating them all as 1.0 says "equally top of this list".
- `set(kw) | set(vec)` includes documents found by only one method.
- The tuple key `(-score, doc)` sorts by score descending, then ID ascending.

**Trace** with α = 0.9: d2 = 0.9 × 1.0 + 0.1 × 0.217 ≈ 0.922; d3 = 0.9 × 0.929 + 0.1 × 0 ≈ 0.836; d1 = 0.1 × 1.0 = 0.1; d4 = 0.

**Complexity:** O(D log D) for D documents.

**Common wrong approach:** forgetting that min-max scaling is per query: the top result always gets 1.0 even when nothing is really relevant. That's one reason RRF (which ignores scores) is the safer default, and why a reranker's absolute scores are useful for dropping weak results.

</details>

## Quick quiz

1. Why can't BM25 and cosine scores simply be added?
   - A) They're on different, query-dependent scales, so one would dominate
   - B) Python can't add floats from different libraries
   - C) BM25 scores are always negative

2. What makes a reranker more accurate than embedding similarity?
   - A) It reads the query and the document together instead of encoding them separately
   - B) It ignores the query
   - C) It uses bigger vectors

3. Why rerank only a shortlist?
   - A) The shortlist is always correct
   - B) Rerankers are too slow and costly to run over the whole corpus
   - C) Rerankers only accept 10 documents

4. A user asks "What about helmets?" after a question about returns. What should happen before retrieval?
   - A) Search for "What about helmets?" as is
   - B) Rewrite it into a standalone query using the conversation
   - C) Skip retrieval

<details>
<summary>Quiz answers</summary>

1. **A) They're on different, query-dependent scales, so one would dominate**: Fuse ranks (RRF) or normalise first.
2. **A) It reads the query and the document together instead of encoding them separately**: Cross-encoders compare directly; that's also why they're slow.
3. **B) Rerankers are too slow and costly to run over the whole corpus**: Each funnel stage is more accurate but costlier per item.
4. **B) Rewrite it into a standalone query using the conversation**: Follow-ups lack the context retrieval needs.

</details>

---
Previous: [Lesson 20](20-vector-search.md) · Next: [Lesson 22: Evaluating RAG](22-evaluating-rag.md)
