# Lesson 19: Keyword search with BM25

**You'll learn:** inverted indexes and postings lists, boolean AND queries, term frequency, inverse document frequency, the BM25 formula, saturation (k1) and length normalisation (b), Lucene's IDF variant, tokenising, stop words, stemming and lemmatisation, other languages, keyword versus vector search, BM25 tools and libraries.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ai-engineering/#keyword-search)**: run every example and check your exercise answers.

## Key terms

- **Inverted index:** a map from each word to the documents (and often positions) where it appears.
- **Postings list:** the list of documents for one word in an inverted index.
- **Term frequency (TF):** how often a word appears in a document.
- **Inverse document frequency (IDF):** a weight that is high for words found in few documents.
- **BM25:** a ranking formula combining IDF, saturated term frequency and document-length normalisation.
- **Stemming:** cutting words to a common root so variants match.
- **Lemmatisation:** mapping words to their dictionary form.

Before embeddings, search engines ranked documents by the **words** they share with the query, and the best of those methods, **BM25**, is still a strong baseline. It's fast, needs no model, explains its results, and is excellent at exact terms such as part numbers, error codes and names, where embeddings often struggle.

## The inverted index

Scanning every document for every query doesn't scale. An **inverted index** maps each word to the documents containing it, like the index at the back of a book:

```python
import re
from collections import defaultdict

docs = ["Puncture repair costs 12 pounds.",
        "Tubeless tyres rarely puncture.",
        "We repair frames and wheels. Frame repair takes a week.",
        "Opening hours: 9 to 5."]

index = defaultdict(set)
for doc_id, text in enumerate(docs):
    for word in re.findall(r"[a-z0-9]+", text.lower()):
        index[word].add(doc_id)

print("puncture ->", sorted(index["puncture"]))
print("repair   ->", sorted(index["repair"]))
both = index["puncture"] & index["repair"]       # documents containing both words
print("both     ->", sorted(both))
```

A query only touches the lists for its own words, so lookups stay fast even with millions of documents.

## Scoring: which matches matter most?

Two intuitions drive keyword ranking:

- **Term frequency (TF):** a document that mentions "puncture" several times is probably more about punctures. But the tenth mention adds less than the first.
- **Inverse document frequency (IDF):** a word that appears in **few** documents ("tubeless") tells you much more than one that appears in nearly all ("bike" in a bike shop's documents).

**BM25** ("Best Matching 25") combines these, and also adjusts for document length, since a long document mentions everything more often. For a query with terms t:

```text
score(D) = Σ  IDF(t) × f(t, D) × (k1 + 1) / ( f(t, D) + k1 × (1 − b + b × |D| / avgdl) )
           t

IDF(t)   = ln( (N − n(t) + 0.5) / (n(t) + 0.5) + 1 )
```

| Symbol | Meaning |
|---|---|
| f(t, D) | how many times term t appears in document D |
| \|D\|, avgdl | D's length in words, and the average length of all documents |
| N, n(t) | the number of documents, and how many contain t |
| k1 | **saturation**, usually 1.2–2.0: how quickly extra mentions stop counting |
| b | **length normalisation**, usually 0.75: 0 ignores length, 1 fully normalises |

![A line chart of a term's score contribution against how many times it appears in a document, from 0 to 10. A straight line shows raw counting, growing without limit. Three BM25 curves for k1 = 0.5, 1.2 and 2.0 rise quickly and then flatten towards a ceiling of k1 + 1; smaller k1 saturates sooner](../figures/bm25-saturation.svg)

The `+ 1` inside the logarithm (the form used by Lucene, and so by Elasticsearch and OpenSearch) keeps IDF positive even for words in more than half the documents. Libraries differ in such details, so scores from different tools aren't directly comparable, but the rankings are usually similar.

## Tokenising: what counts as "the same word"?

BM25 matches **tokens**, so how text is split and normalised matters:

- **Lower-casing**, so "Puncture" matches "puncture".
- **Stop words:** very common words ("the", "and") can be dropped; IDF already gives them little weight.
- **Stemming** cuts words to a root so "repairs", "repaired" and "repairing" all match "repair" (the Porter and Snowball stemmers are common). **Lemmatisation** does this with a dictionary ("better" → "good").
- **Language:** other languages need their own rules; Chinese and Japanese need word segmentation, since they don't use spaces.

Without stemming, the scorer below misses "frames" when you search for "frame".

## Keyword or vector search?

| Query | Keyword search (BM25) | Vector search (Lesson 20) |
|---|---|---|
| `SH-M8100 brake lever` | ✅ exact part number | ❌ may match "brake lever" generally |
| `error E-504 on the motor` | ✅ | ❌ codes have little "meaning" |
| `my chain keeps falling off` | ⚠️ needs the same words | ✅ matches "chain drops" and "derailleur adjustment" |
| `bicycle` vs documents saying `bike` | ❌ no synonyms | ✅ |

Each fails where the other succeeds, which is why production systems often use **both** (Lesson 21). BM25 is available in Elasticsearch and OpenSearch, SQLite's FTS5 (`bm25()`), Tantivy and Lucene, and Python libraries such as `bm25s` and `rank_bm25`.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Build an inverted index | for each document, add its id to each distinct word's list | O(total tokens) | O(total tokens) |
| AND query | intersect the postings lists | O(sum of list lengths) | O(shortest list) |
| BM25 score | Σ IDF × f(k1 + 1) ÷ (f + k1(1 − b + b·len ÷ avgdl)) | O(query terms × postings) | O(documents) |

## Common mistakes

- Ranking by raw word counts, so long or repetitive documents win.
- Expecting keyword search to match synonyms or paraphrases.
- Forgetting stemming, so "frames" never matches "frame".
- Comparing BM25 scores from different tools or collections as if they were on one scale.
- Scanning every document at query time instead of using an index.

## Exercises

### 1. Build an inverted index

Write `build_index(docs)` returning a dict mapping each token to a **sorted list of the indexes** of the documents that contain it (each index once). Tokenise with `re.findall(r"[a-z0-9]+", text.lower())`. Then write `search_all(index, query)` returning the sorted indexes of the documents that contain **every** token of the query (an empty query gives `[]`).

Starter code:

```python
import re

def build_index(docs):
    pass

def search_all(index, query):
    pass

docs = ["Puncture repair costs 12 pounds.", "Tubeless tyres rarely puncture.",
        "We repair frames and wheels. Frame repair takes a week."]
index = build_index(docs)
print(index["repair"])                        # [0, 2]
print(search_all(index, "Puncture REPAIR"))   # [0]
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** word → which documents; then an AND query is an intersection of those lists.
2. **Examples:** "repair" → [0, 2]; "puncture" → [0, 1]; both → [0].
3. **Brute force:** for each query, scan every document's text: O(total text) per query.
4. **Pattern:** **inverted index + set intersection**.
5. **Plan:** tokenise once per document → postings lists → intersect per query.
6. **Code and test:** repeated words in a document, unknown words, empty query, punctuation.

</details>

<details>
<summary>💡 Hint 1</summary>

Loop over `enumerate(docs)`; for each **distinct** token in a document (a set), append the document's index to that token's list.

</details>

<details>
<summary>💡 Hint 2</summary>

`index.setdefault(word, []).append(doc_id)` creates the list the first time. Because you visit documents in order, each list is already sorted.

</details>

<details>
<summary>💡 Hint 3</summary>

For `search_all`, intersect the sets of document indexes for every query token (`&`); a missing token gives an empty set.

</details>

### 2. Score documents with BM25

Write `bm25_scores(query, docs, k1=1.5, b=0.75)` returning a list with each document's BM25 score for the query, using the formulas in the lesson:

- tokenise with `re.findall(r"[a-z0-9]+", text.lower())`;
- use each **distinct** query token once;
- a token that appears in no document adds nothing;
- `avgdl` is the average number of tokens per document;
- no documents → `[]`.

Starter code:

```python
import math
import re

def bm25_scores(query, docs, k1=1.5, b=0.75):
    pass

docs = ["Puncture repair costs 12 pounds.", "Tubeless tyres rarely puncture.",
        "We repair frames and wheels. Frame repair takes a week.", "Opening hours: 9 to 5."]
print([round(s, 4) for s in bm25_scores("puncture repair", docs)])
# [1.4987, 0.8155, 0.8155, 0.0]
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a sum over distinct query terms of IDF × saturated, length-normalised term frequency.
2. **Examples:** "puncture" is in 2 of 4 documents → IDF = ln(2.5/2.5 + 1) = ln 2 ≈ 0.693.
3. **Brute force:** this direct version is O(terms × total tokens), fine for small collections; an inverted index with stored counts makes it fast.
4. **Pattern:** **TF × IDF with saturation and length normalisation**.
5. **Plan:** tokenise → avgdl → per term: df, idf → per document: add the term's contribution.
6. **Code and test:** rare versus common words, repeated query words, b = 0, long documents, no documents.

</details>

<details>
<summary>💡 Hint 1</summary>

Tokenise every document once. You need each document's length, the average length, and for each query term the number of documents containing it.

</details>

<details>
<summary>💡 Hint 2</summary>

For each distinct query term with `df > 0`: `idf = math.log((N - df + 0.5) / (df + 0.5) + 1)`. Then for each document with `f = tokens.count(term)` > 0, add `idf * f * (k1 + 1) / (f + k1 * (1 - b + b * len(doc) / avgdl))`.

</details>

<details>
<summary>💡 Hint 3</summary>

Start from a list of zeros, one per document, and add each term's contribution.

</details>

**In the sandbox:** exercises 36–37. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Build an inverted index</summary>

```python
import re

def tokens(text):
    return re.findall(r"[a-z0-9]+", text.lower())

def build_index(docs):
    index = {}
    for doc_id, text in enumerate(docs):
        for word in set(tokens(text)):
            index.setdefault(word, []).append(doc_id)   # doc_ids arrive in order, so lists stay sorted
    return index

def search_all(index, query):
    words = set(tokens(query))
    if not words:
        return []
    result = None
    for word in words:
        found = set(index.get(word, []))
        result = found if result is None else result & found
    return sorted(result)

docs = ["Puncture repair costs 12 pounds.", "Tubeless tyres rarely puncture.",
        "We repair frames and wheels. Frame repair takes a week."]
index = build_index(docs)
print(index["repair"])
print(search_all(index, "Puncture REPAIR"))
```

**Line by line**

- `set(tokens(text))` ensures a document is added once per word, even if the word repeats.
- `setdefault` returns the existing list or inserts a new empty one.
- `index.get(word, [])` treats an unknown word as matching nothing, so the intersection becomes empty.
- Starting `result` as `None` lets the first word's set become the starting point.

**Trace:** "puncture repair" → {0, 1} & {0, 2} = {0} → [0].

**Complexity:** building is O(total tokens); a query is O(sum of its postings-list lengths).

**Common wrong approach:** storing the full text per word or scanning documents at query time, which throws away the index's whole advantage. (Real engines also store each word's **count** and positions per document, for scoring and phrase search.)

</details>

<details>
<summary>✅ 2. Score documents with BM25</summary>

```python
import math
import re

def tokens(text):
    return re.findall(r"[a-z0-9]+", text.lower())

def bm25_scores(query, docs, k1=1.5, b=0.75):
    if not docs:
        return []
    doc_tokens = [tokens(d) for d in docs]
    n_docs = len(docs)
    avgdl = sum(len(t) for t in doc_tokens) / n_docs
    scores = [0.0] * n_docs
    for term in set(tokens(query)):
        df = sum(1 for t in doc_tokens if term in t)            # documents containing the term
        if df == 0:
            continue
        idf = math.log((n_docs - df + 0.5) / (df + 0.5) + 1)
        for i, t in enumerate(doc_tokens):
            f = t.count(term)
            if f:
                norm = k1 * (1 - b + b * len(t) / avgdl)
                scores[i] += idf * f * (k1 + 1) / (f + norm)
    return scores

docs = ["Puncture repair costs 12 pounds.", "Tubeless tyres rarely puncture.",
        "We repair frames and wheels. Frame repair takes a week.", "Opening hours: 9 to 5."]
print([round(s, 4) for s in bm25_scores("puncture repair", docs)])
```

**Line by line**

- `set(tokens(query))` uses each query word once, matching the specification.
- `df` (document frequency) counts documents containing the term, not total mentions.
- The denominator `f + k1 × (…)` makes the contribution approach `idf × (k1 + 1)` as `f` grows: saturation.
- Longer-than-average documents get a larger denominator (when b > 0), so the same count is worth less.

**Trace** for "repair" in `["repair repair repair repair", "repair", "bike"]`: df = 2, IDF = ln(1.5/2.5 + 1) = ln 1.6 ≈ 0.470; avgdl = 2. Document 0: f = 4, norm = 1.5 × (0.25 + 0.75 × 4/2) = 2.625 → 0.470 × 10 / 6.625 ≈ 0.709. Document 1: f = 1, norm = 1.5 × (0.25 + 0.375) = 0.9375 → 0.470 × 2.5 / 1.9375 ≈ 0.607. Four mentions earned only about 17% more than one.

**Complexity:** O(q × T) here, for q query terms and T total tokens.

**Common wrong approach:** raw counts without IDF, so common words dominate, or without saturation, so keyword stuffing wins.

</details>

## Quick quiz

1. What does an inverted index map?
   - A) Each word to the documents that contain it
   - B) Each query to its answer
   - C) Each document to its embedding

2. Why does BM25 give a rare word more weight than a common one?
   - A) Rare words are longer
   - B) A word that appears in few documents tells you more about which documents are relevant (IDF)
   - C) Common words are always stop words

3. What does the k1 setting control?
   - A) The length of the query
   - B) The number of results
   - C) How quickly extra mentions of a word stop increasing the score

4. Which query is BM25 likely to handle better than vector search?
   - A) "my chain keeps falling off"
   - B) A question using synonyms of the document's words
   - C) An exact part number such as SH-M8100

<details>
<summary>Quiz answers</summary>

1. **A) Each word to the documents that contain it**: Like the index at the back of a book.
2. **B) A word that appears in few documents tells you more about which documents are relevant (IDF)**: Inverse document frequency rewards specificity.
3. **C) How quickly extra mentions of a word stop increasing the score**: Smaller k1 saturates sooner.
4. **C) An exact part number such as SH-M8100**: Exact identifiers carry little "meaning" for embeddings.

</details>

---
Previous: [Lesson 18](18-chunking.md) · Next: [Lesson 20: Vector search and vector databases](20-vector-search.md)
