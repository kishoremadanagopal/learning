# Lesson 17: The RAG pipeline

**You'll learn:** knowledge cutoffs and private data, retrieval-augmented generation, ingestion (load, clean, chunk, index, metadata), query time (retrieve, augment, generate), a tiny end-to-end RAG system, instructions to use only the documents, saying "I don't know", citing sources, the citations API, when to put everything in the prompt instead, structured data and tools, per-user permissions.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ai-engineering/#rag-pipeline)**: run every example and check your exercise answers.

## Key terms

- **Retrieval-augmented generation (RAG):** retrieving relevant passages and adding them to the prompt so the model answers from them.
- **Corpus:** the whole collection of documents you search.
- **Chunk:** a passage of a document, the unit that is indexed and retrieved.
- **Ingestion:** loading, cleaning, chunking and indexing documents ahead of time.
- **Retriever:** the component that finds the chunks most relevant to a query.
- **Grounding:** basing an answer on provided evidence rather than the model's memory.
- **Citation:** a reference from a statement in the answer to the source that supports it.

A model knows only what was in its training data, up to its **knowledge cutoff**. It has never seen your product manual, your company's policies or yesterday's support tickets. Ask about them and it will either refuse or, worse, **make up** a plausible answer.

**Retrieval-augmented generation (RAG)** fixes this by looking up the relevant passages first and putting them in the prompt, so the model answers from evidence rather than memory. It's like an open-book exam: the model still needs to read and reason, but the facts are in front of it.

## The pipeline

![Two rows. Ingestion, done ahead of time: documents are loaded and cleaned, split into chunks, embedded or indexed, and stored in a search index. Query time: the user's question is used to search the index, the top chunks are inserted into the prompt with the question, the model generates an answer citing the chunks, and the answer goes back to the user](../figures/rag-pipeline.svg)

**Ingestion** (ahead of time, and again whenever documents change):

1. **Load and clean** the documents: PDFs, web pages, wiki pages, tickets. Strip navigation menus, headers and footers; keep titles and dates.
2. **Chunk** them into passages of a few hundred tokens (Lesson 18).
3. **Index** the chunks: a keyword index (Lesson 19), embeddings in a vector index (Lesson 20), or both (Lesson 21). Keep **metadata** with each chunk: source, title, date, access permissions.

**Query time** (on every question):

1. **Retrieve** the chunks most relevant to the question.
2. **Augment** the prompt: insert the chunks, each tagged with its source, then the question (Lesson 13's layout).
3. **Generate** an answer that uses only the provided chunks and **cites** them.

## A tiny RAG system

Real systems use better retrieval, but the shape is the same:

```python
import re

chunks = [
    {"source": "returns.md", "text": "Unused items can be returned within 30 days with a receipt."},
    {"source": "warranty.md", "text": "Frames have a lifetime warranty against manufacturing defects."},
    {"source": "repairs.md", "text": "Puncture repairs cost £12 and are usually done the same day."},
]

STOP = {"a", "an", "the", "how", "much", "does", "do", "is", "are", "and", "with", "can"}

def words(text):
    return set(re.findall(r"[a-z0-9]+", text.lower())) - STOP     # ignore common words

def retrieve(question, k=2):
    q = words(question)
    scored = sorted(chunks, key=lambda c: len(q & words(c["text"])), reverse=True)
    return [c for c in scored[:k] if q & words(c["text"])]

def build_prompt(question, found):
    docs = "\n".join(f'<document index="{i}"><source>{c["source"]}</source>\n{c["text"]}\n</document>'
                     for i, c in enumerate(found, start=1))
    return (f"<documents>\n{docs}\n</documents>\n\n"
            "Answer using only the documents above, citing them like [1]. "
            "If they don't contain the answer, say you don't know.\n\n"
            f"<question>{question}</question>")

question = "How much does a puncture repair cost?"
print(build_prompt(question, retrieve(question)))
```

Try removing `- STOP`: the word "a" alone then matches the returns chunk, which gets retrieved for a question about punctures. Crude scoring like this is why Lessons 19–21 build better retrieval.

The instructions matter as much as the retrieval:

- **"Use only the documents"** keeps the model from mixing in guesses from its training data.
- **"Say you don't know"** gives it an honest way out when retrieval missed. Without it, the model is pushed to answer anyway.
- **"Cite your sources"** lets users check the answer and lets you measure **groundedness** (Lesson 22).

## Citations built into the API

Claude can produce citations itself: send each source as a `document` block with citations enabled, and the reply's text blocks carry the exact passages they rely on.

```python
response = client.messages.create(
    model="claude-sonnet-5-5",
    max_tokens=1024,
    messages=[{"role": "user", "content": [
        {"type": "document",
         "source": {"type": "text", "media_type": "text/plain", "data": returns_policy_text},
         "title": "returns.md",
         "citations": {"enabled": True}},
        {"type": "text", "text": "Can I return a helmet I've worn once?"},
    ]}],
)
for block in response.content:
    if block.type == "text":
        print(block.text, [c.cited_text for c in (block.citations or [])])
```

Each citation includes the quoted text and its location (character range for text, page range for PDFs). The quoted `cited_text` doesn't count towards output tokens. Citations can't be combined with structured outputs in the same request.

## When you don't need retrieval

Retrieval adds moving parts, and every part can fail. Consider simpler options first:

- **The knowledge fits in the prompt.** With context windows of hundreds of thousands of tokens, a few hundred pages of documentation can simply be included, with prompt caching (Lesson 11) to keep repeat calls cheap. Anthropic's own guidance suggests this for knowledge bases up to roughly 200,000 tokens.
- **The data is structured.** Prices, stock levels and order status belong in a database; give the model a tool to query it (Part 5) rather than embedding rows as text.
- **The model already knows it.** General knowledge doesn't need retrieval; your private or fast-changing information does.

RAG earns its place when the corpus is **large** (thousands of documents and up), **changes often**, or needs **per-user permissions** (a user should only retrieve what they're allowed to read).

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Word-overlap retrieval | score = shared distinct words; stable sort; top k | O(n · m + n log n) | O(n) |
| Check citations | regex for [n]; split sentences; set arithmetic | O(n) | O(n) |
| RAG query | retrieve → insert chunks with sources → question last → answer with citations | — | — |

## Common mistakes

- Building retrieval when the whole knowledge base would fit in the prompt.
- Not telling the model what to do when the documents don't contain the answer.
- Dropping source and permission metadata during ingestion.
- Embedding structured data such as prices or stock levels as text instead of querying it.
- Trusting citation numbers without checking them.

## Exercises

### 1. A word-overlap retriever

Write `retrieve(question, chunks, k)` returning up to `k` chunks (dicts with a `"text"` key), best first:

- Tokenise with `re.findall(r"[a-z0-9]+", text.lower())`, and drop the stop words in `STOP`.
- A chunk's **score** is the number of **distinct** question words that also appear in the chunk.
- Sort by score, highest first; equal scores keep their original order. Leave out chunks with a score of 0.

Starter code:

```python
import re

STOP = {"a", "an", "the", "is", "are", "to", "of", "and", "in", "on", "for", "my", "i",
        "do", "does", "can", "what", "how", "you", "your", "it", "much"}

def retrieve(question, chunks, k):
    pass

chunks = [{"source": "returns.md", "text": "Unused items can be returned within 30 days with a receipt."},
          {"source": "warranty.md", "text": "Frames have a lifetime warranty against manufacturing defects."},
          {"source": "repairs.md", "text": "Puncture repairs cost £12 and are usually done the same day."}]
print(retrieve("How much does a puncture repair cost?", chunks, 2))
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** score = shared distinct words; best first; stable ties; no zero scores; at most k.
2. **Examples:** "puncture repair cost" vs repairs.md: "puncture" and "cost" match, but "repair" doesn't match "repairs" (no stemming yet: Lesson 19).
3. **Brute force:** this is already a linear scan plus a sort.
4. **Pattern:** **score every document, sort, take the top k**: the skeleton of every retriever.
5. **Plan:** a `words` helper → scores → filter → stable sort → slice.
6. **Code and test:** ties, repeats, numbers, stop words, k = 0.

</details>

<details>
<summary>💡 Hint 1</summary>

Turn the question and each chunk into **sets** of words (minus `STOP`); the size of the intersection `&` is the score.

</details>

<details>
<summary>💡 Hint 2</summary>

Pair each chunk with its score, drop the zeros, then sort by score with `reverse=True`. Python's sort is **stable**, so equal scores keep their original order.

</details>

<details>
<summary>💡 Hint 3</summary>

`scored.sort(key=lambda pair: pair[0], reverse=True)`, then take the chunks from the first `k` pairs.

</details>

### 2. Check an answer's citations

The model was told to cite documents like `[1]`. Write `check_citations(answer, n_docs)` returning a dict:

- `"cited"`: the sorted, distinct citation numbers from 1 to `n_docs`;
- `"invalid"`: the sorted, distinct citation numbers outside that range;
- `"unsupported"`: the sentences that contain no citation at all, in order.

A citation is `[` digits `]`. Split sentences with `re.split(r"(?<=[.!?])\s+", answer.strip())`, ignoring empty pieces.

Starter code:

```python
import re

def check_citations(answer, n_docs):
    pass

answer = "Puncture repairs cost £12 [3]. They're usually same-day [3]. We also sell tubes."
print(check_citations(answer, 3))
# {'cited': [3], 'invalid': [], 'unsupported': ['We also sell tubes.']}
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** three facts about an answer: which sources it used, which numbers are bogus, which claims have no source.
2. **Examples:** "Yes! [1] Really? Yes [10]." splits into "Yes!", "[1] Really?" and "Yes [10]."; the `[1]` lands at the start of the second piece.
3. **Brute force:** scanning characters by hand: more code, same result.
4. **Pattern:** **regex extraction plus set arithmetic**.
5. **Plan:** numbers → valid/invalid; sentences → those without a citation.
6. **Code and test:** out-of-range numbers, repeats, empty answers, non-numeric brackets.

</details>

<details>
<summary>💡 Hint 1</summary>

`re.findall(r"\[(\d+)\]", answer)` returns the digits inside every citation, as strings.

</details>

<details>
<summary>💡 Hint 2</summary>

Put the numbers in a set (distinct), then split them into valid (`1 <= n <= n_docs`) and invalid, each sorted.

</details>

<details>
<summary>💡 Hint 3</summary>

Split the answer into sentences with the given regex, drop empty strings, and keep those where `re.search(r"\[\d+\]", sentence)` finds nothing.

</details>

**In the sandbox:** exercises 32–33. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. A word-overlap retriever</summary>

```python
import re

STOP = {"a", "an", "the", "is", "are", "to", "of", "and", "in", "on", "for", "my", "i",
        "do", "does", "can", "what", "how", "you", "your", "it", "much"}

def words(text):
    return set(re.findall(r"[a-z0-9]+", text.lower())) - STOP

def retrieve(question, chunks, k):
    query = words(question)
    scored = [(len(query & words(chunk["text"])), chunk) for chunk in chunks]
    scored = [pair for pair in scored if pair[0] > 0]
    scored.sort(key=lambda pair: pair[0], reverse=True)    # stable: ties keep their order
    return [chunk for _, chunk in scored[:k]]

chunks = [{"source": "returns.md", "text": "Unused items can be returned within 30 days with a receipt."},
          {"source": "warranty.md", "text": "Frames have a lifetime warranty against manufacturing defects."},
          {"source": "repairs.md", "text": "Puncture repairs cost £12 and are usually done the same day."}]
print(retrieve("How much does a puncture repair cost?", chunks, 2))
```

**Line by line**

- Sets make repeated words count once and make the overlap a single `&`.
- Removing stop words stops "the" and "is" from matching every chunk.
- `sort(..., reverse=True)` keeps ties in their original order, because Python's sort is stable even when reversed.
- Slicing `[:k]` handles `k` larger than the number of matches, and `k = 0`.

**Trace** on "Can I book repairs for the same day?": query words {book, repairs, same, day}; repairs.md matches {repairs, same, day} = 3; hours.md matches only {repairs} = 1, because "booked" isn't "book" → [repairs.md, hours.md].

**Complexity:** O(n · m + n log n) for n chunks of m words.

**Common wrong approach:** counting raw word occurrences, so a chunk that repeats "the bike" ten times outranks the one that answers the question. Real keyword search (BM25, Lesson 19) weighs rare words more and long chunks less.

</details>

<details>
<summary>✅ 2. Check an answer's citations</summary>

```python
import re

def check_citations(answer, n_docs):
    numbers = {int(n) for n in re.findall(r"\[(\d+)\]", answer)}
    sentences = [s for s in re.split(r"(?<=[.!?])\s+", answer.strip()) if s]
    return {
        "cited": sorted(n for n in numbers if 1 <= n <= n_docs),
        "invalid": sorted(n for n in numbers if not 1 <= n <= n_docs),
        "unsupported": [s for s in sentences if not re.search(r"\[\d+\]", s)],
    }

answer = "Puncture repairs cost £12 [3]. They're usually same-day [3]. We also sell tubes."
print(check_citations(answer, 3))
```

**Line by line**

- The capture group `(\d+)` returns just the digits; `int` converts them; the set removes repeats.
- `1 <= n <= n_docs` is a chained comparison, Python's neat way to test a range.
- The look-behind `(?<=[.!?])` splits **after** sentence-ending punctuation, keeping it in the sentence.
- `if s` drops the empty string that `re.split` returns for an empty answer.

**Trace** on the last-but-one case: the pieces are "Yes!", "[1] Really?" and "Yes [10]." The `[1]` was meant for "Yes!", but because it comes after the `!`, it lands in the next piece, so "Yes!" is reported as unsupported. With 12 documents, 1 and 10 are both valid.

That's a real limitation of splitting on punctuation: a citation placed **after** the full stop ("…same day. [3]") attaches to the following sentence. Prompt the model to put citations **before** the full stop, and treat this check as a cheap signal, not proof. (Lesson 22 measures groundedness properly.)

**Complexity:** O(n) for an answer of n characters.

**Common wrong approach:** trusting citations blindly. A citation number can be out of range, or point at a document that doesn't actually support the sentence; checking the numbers is the cheap first step.

</details>

## Quick quiz

1. What problem does RAG solve?
   - A) The model's context window is too small for any documents
   - B) The model lacks your private or recent information, so you retrieve it and put it in the prompt
   - C) The model is too slow

2. Why tell the model to say "I don't know" when the documents don't contain the answer?
   - A) It's required by the API
   - B) Otherwise it's pushed to answer anyway, often by making something up
   - C) It makes retrieval faster

3. Your whole knowledge base is 80 pages. What's a sensible first approach?
   - A) Fine-tune a model on it
   - B) Put it all in the prompt with prompt caching
   - C) Build a vector database with three rerankers

4. Why keep metadata such as source and permissions with each chunk?
   - A) To cite sources and to retrieve only what the user is allowed to see
   - B) Metadata makes embeddings more accurate
   - C) Vector databases require it

<details>
<summary>Quiz answers</summary>

1. **B) The model lacks your private or recent information, so you retrieve it and put it in the prompt**: It turns a closed-book exam into an open-book one.
2. **B) Otherwise it's pushed to answer anyway, often by making something up**: An honest way out reduces hallucinations when retrieval misses.
3. **B) Put it all in the prompt with prompt caching**: Retrieval adds moving parts; start simple when the content fits.
4. **A) To cite sources and to retrieve only what the user is allowed to see**: Citations and access control both depend on it.

</details>

---
Previous: [Lesson 16](16-prompt-injection.md) · Next: [Lesson 18: Chunking documents](18-chunking.md)
