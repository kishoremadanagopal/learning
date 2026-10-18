# Lesson 22: Evaluating RAG

**You'll learn:** measuring retrieval and generation separately, building an evaluation set, relevant chunk labels, reference answers, unanswerable and hard questions, generated questions, hit rate, recall@k, precision@k, mean reciprocal rank, nDCG, faithfulness, answer relevance, correctness, citation accuracy, refusal accuracy, LLM graders, Ragas and DeepEval, diagnosing failures, monitoring in production.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ai-engineering/#evaluating-rag)**: run every example and check your exercise answers.

## Key terms

- **Evaluation set:** a fixed collection of questions with the expected relevant chunks and answers.
- **Recall@k:** the share of relevant chunks that appear in the top k results.
- **Precision@k:** the share of the top k results that are relevant.
- **Mean reciprocal rank (MRR):** the average of 1 ÷ the rank of the first relevant result.
- **nDCG:** a ranking score that rewards relevant results near the top, allowing graded relevance.
- **Faithfulness (groundedness):** whether every claim in an answer is supported by the retrieved context.
- **Refusal accuracy:** whether the system declines exactly the questions it can't answer from its sources.

A RAG system has many settings: chunk size, overlap, embedding model, k, fusion, reranker, prompt. Without measurement, every change is a guess. And because a RAG answer can go wrong in two different places, you measure **both**:

1. **Retrieval:** did the right chunks reach the prompt?
2. **Generation:** did the model answer correctly, using only those chunks?

If retrieval missed, no prompt can fix the answer. If retrieval succeeded and the answer is still wrong, fix the prompt or the model, not the index.

## An evaluation set

Collect **50–200 realistic questions** (from real users if you can), and for each record:

- the **IDs of the chunks** that contain the answer (for retrieval metrics);
- a **reference answer**, or the key facts it must contain (for answer metrics);
- some **unanswerable** questions, whose correct response is "I don't know", to check the system doesn't invent answers;
- some **hard cases**: questions needing two documents, exact part numbers, follow-ups, other languages.

Writing this by hand is slow. A common shortcut is to have an LLM **generate questions from chunks** ("write a question this passage answers"), then have people review and edit them. Generated questions tend to reuse the chunk's wording, which flatters keyword search, so mix in real ones.

## Retrieval metrics

For one query, with the retrieved list (best first) and the set of relevant chunk IDs:

| Metric | Question it answers | Formula |
|---|---|---|
| hit rate@k | did **any** relevant chunk make the top k? | 1 or 0 |
| recall@k | what share of the relevant chunks made the top k? | relevant in top k ÷ all relevant |
| precision@k | what share of the top k is relevant? | relevant in top k ÷ k |
| MRR (mean reciprocal rank) | how high is the **first** relevant chunk? | 1 ÷ its rank (0 if absent) |
| nDCG@k | are the relevant chunks near the top, with graded relevance? | discounted gain ÷ ideal gain |

Average each over all queries. For RAG, **recall@k** usually matters most: the model can ignore an irrelevant chunk, but can't use one that never arrived. Precision still matters for cost and focus.

```python
retrieved = ["c7", "c2", "c9", "c4", "c1"]     # best first
relevant = {"c2", "c4", "c8"}
k = 3
top = retrieved[:k]
hits = [doc for doc in top if doc in relevant]
print("recall@3   ", round(len(hits) / len(relevant), 3))
print("precision@3", round(len(hits) / k, 3))
first = next((rank for rank, doc in enumerate(retrieved, start=1) if doc in relevant), None)
print("reciprocal rank", round(1 / first, 3) if first else 0)
```

## Answer metrics

| Metric | Question |
|---|---|
| **faithfulness (groundedness)** | is every claim in the answer supported by the retrieved chunks? |
| answer relevance | does it actually answer the question asked? |
| correctness | does it match the reference answer's key facts? |
| citation accuracy | do the cited chunks really support the sentences that cite them? |
| refusal accuracy | does it say "I don't know" for unanswerable questions, and only for them? |

A few of these can be checked with code: citation numbers (Lesson 17), required facts present (Lesson 12), a crude word-overlap groundedness score (the second exercise). Most need **judgement**, so teams use an LLM as a grader with a clear rubric, checked against human ratings (Part 6). Libraries such as **Ragas** and **DeepEval** package these metrics (faithfulness, answer relevancy, context precision and context recall, among others).

## Diagnosing failures

| Symptom | Likely cause | Try |
|---|---|---|
| the relevant chunk isn't retrieved at all | vocabulary mismatch; chunk lacks context; bad chunking | hybrid search, contextual retrieval, different chunk size |
| it's retrieved, but ranked below k | weak ranking | reranker, larger k |
| exact codes and names are missed | embeddings only | add BM25 (hybrid) |
| follow-up questions fail | query lacks context | query rewriting |
| right chunks, wrong answer | prompt, model, or conflicting chunks | clearer instructions, quotes first, a stronger model |
| confident answers to unanswerable questions | no permission to refuse | "say you don't know"; test refusals |
| outdated answers | stale index | re-ingest on change; store dates; prefer recent |

Change **one thing at a time** and re-run the whole evaluation; improving one kind of question often worsens another.

## In production

Log each query with the retrieved chunk IDs and scores, the answer and any user feedback (thumbs up or down, follow-up corrections). Watch for queries with **low retrieval scores** (gaps in the documents), documents that are **never retrieved**, and questions users keep rephrasing. Add the interesting failures to your evaluation set: it should grow with the product.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Recall and precision at k | hits in top k ÷ relevant, and ÷ k | O(queries × k) | O(k) |
| Mean reciprocal rank | 1 ÷ rank of the first hit, averaged | O(queries × k) | O(1) |
| Crude groundedness | content-word overlap with the best single source | O(sentences × sources × words) | O(words) |

## Common mistakes

- Judging a RAG system only by its final answers.
- Evaluating only on questions generated from the chunks themselves.
- Leaving out unanswerable questions.
- Changing several settings at once and re-running nothing.
- Treating a word-overlap score as proof of faithfulness.

## Exercises

### 1. Retrieval metrics

Write `retrieval_metrics(results, relevant, k)`. `results[i]` is the ranked list of chunk IDs retrieved for query `i` (best first); `relevant[i]` is the set of relevant IDs for that query. For each query, using only the **top k**:

- recall = relevant IDs in the top k ÷ number of relevant IDs;
- precision = relevant IDs in the top k ÷ k;
- reciprocal rank = 1 ÷ the rank (from 1) of the first relevant ID in the top k, or 0 if none.

Skip queries whose relevant set is empty. Return a dict with the averages: `{"recall": …, "precision": …, "mrr": …}`, or all `0.0` if no queries count.

Starter code:

```python
def retrieval_metrics(results, relevant, k):
    pass

results = [["c7", "c2", "c9", "c4", "c1"], ["c3", "c5", "c6"]]
relevant = [{"c2", "c4", "c8"}, {"c3"}]
print(retrieval_metrics(results, relevant, 3))
# recall (1/3 + 1)/2 ≈ 0.667, precision (1/3 + 1/3)/2 ≈ 0.333, mrr (1/2 + 1)/2 = 0.75
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** three per-query numbers from the top k, averaged over the queries that have relevant IDs.
2. **Examples:** query 1 top 3 = c7, c2, c9: one hit (c2, rank 2) → recall 1/3, precision 1/3, RR 1/2.
3. **Brute force:** this is already one pass per query.
4. **Pattern:** **per-query metrics, then macro-average**.
5. **Plan:** loop → skip empties → top k → hits → three numbers → averages.
6. **Code and test:** k = 1, a complete miss, fewer results than k, empty relevant sets, no queries.

</details>

<details>
<summary>💡 Hint 1</summary>

Walk the queries with `zip(results, relevant)`, skipping empty relevant sets, and work only with `retrieved[:k]`.

</details>

<details>
<summary>💡 Hint 2</summary>

The hits are the top-k IDs that are in the relevant set. Precision divides by `k` (not by the number retrieved).

</details>

<details>
<summary>💡 Hint 3</summary>

For the reciprocal rank, find the first `rank` (from 1) in the top k whose ID is relevant: `next((rank for rank, doc in enumerate(top, start=1) if doc in wanted), None)`.

</details>

### 2. A crude groundedness check

Before reaching for an LLM grader, a word-overlap check catches the worst unsupported sentences. Write `groundedness(answer, sources, threshold=0.5)` returning `(score, unsupported)`:

- Split the answer into sentences with `re.split(r"(?<=[.!?])\s+", answer.strip())`, ignoring empty pieces.
- A sentence's **content words** are its distinct tokens (`re.findall(r"[a-z0-9]+", sentence.lower())`) that have **4 or more characters** or contain a **digit**.
- A sentence is **supported** if, for at least one source, the fraction of its content words appearing in that source's tokens is at least `threshold`. Sentences with no content words are ignored.
- `score` is supported sentences ÷ counted sentences (`1.0` if none were counted); `unsupported` lists the unsupported sentences in order.

Starter code:

```python
import re

def groundedness(answer, sources, threshold=0.5):
    pass

sources = ["Puncture repairs cost £12 and are usually done the same day.",
           "Unused items can be returned within 30 days with a receipt."]
answer = "A puncture repair costs £12. It is usually done the same day. We also offer free tea."
print(groundedness(answer, sources))
# (0.6666666666666666, ['We also offer free tea.'])
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** per sentence, is most of its vocabulary present in one source? Then a ratio and the failures.
2. **Examples:** "A puncture repair costs £12." → content words {puncture, repair, costs, 12}; the repairs source has puncture and 12 (not "repair" or "costs") → 2/4 = 0.5 → supported at threshold 0.5.
3. **Brute force:** this is already direct.
4. **Pattern:** **lexical overlap as a cheap proxy** for support.
5. **Plan:** source token sets → for each sentence: content words → best overlap → compare with the threshold → score.
6. **Code and test:** invented sentences, wrong numbers, no content words, no sources, thresholds.

</details>

<details>
<summary>💡 Hint 1</summary>

Turn each source into a set of tokens once. For each sentence, build its set of content words (4+ characters, or containing a digit).

</details>

<details>
<summary>💡 Hint 2</summary>

A sentence's support is its **best** overlap with any single source: `max(len(words & src) / len(words) for src in source_tokens)`. Use `default=0.0` for no sources.

</details>

<details>
<summary>💡 Hint 3</summary>

Count only sentences with content words; the score is (counted − unsupported) ÷ counted, or 1.0 when nothing was counted.

</details>

**In the sandbox:** exercises 42–43. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Retrieval metrics</summary>

```python
def retrieval_metrics(results, relevant, k):
    recalls, precisions, reciprocal_ranks = [], [], []
    for retrieved, wanted in zip(results, relevant):
        if not wanted:
            continue                                   # nothing to find for this query
        top = retrieved[:k]
        hits = [doc for doc in top if doc in wanted]
        recalls.append(len(hits) / len(wanted))
        precisions.append(len(hits) / k)
        first = next((rank for rank, doc in enumerate(top, start=1) if doc in wanted), None)
        reciprocal_ranks.append(1 / first if first else 0.0)
    if not recalls:
        return {"recall": 0.0, "precision": 0.0, "mrr": 0.0}
    n = len(recalls)
    return {"recall": sum(recalls) / n, "precision": sum(precisions) / n, "mrr": sum(reciprocal_ranks) / n}

results = [["c7", "c2", "c9", "c4", "c1"], ["c3", "c5", "c6"]]
relevant = [{"c2", "c4", "c8"}, {"c3"}]
print(retrieval_metrics(results, relevant, 3))
```

**Line by line**

- Skipping queries with no relevant IDs avoids dividing by zero in recall (unanswerable questions are evaluated on the answer instead).
- Precision divides by `k` even when fewer than k results came back: empty slots count as misses.
- `next(..., None)` returns the first matching rank or `None`, giving a reciprocal rank of 0.
- Each metric is averaged over the same set of queries, so they're comparable.

**Trace** for k = 5: query 1 top 5 has c2 (rank 2) and c4 (rank 4) → recall 2/3, precision 2/5, RR 1/2; query 2 → recall 1, precision 1/5, RR 1. Averages: 0.833, 0.3, 0.75.

**Complexity:** O(queries × k).

**Common wrong approach:** measuring only the final answers, so when quality drops you can't tell whether retrieval or generation broke.

</details>

<details>
<summary>✅ 2. A crude groundedness check</summary>

```python
import re

def tokens(text):
    return set(re.findall(r"[a-z0-9]+", text.lower()))

def content_words(sentence):
    return {w for w in tokens(sentence) if len(w) >= 4 or any(ch.isdigit() for ch in w)}

def groundedness(answer, sources, threshold=0.5):
    source_tokens = [tokens(s) for s in sources]
    counted, unsupported = 0, []
    for sentence in re.split(r"(?<=[.!?])\s+", answer.strip()):
        words = content_words(sentence)
        if not sentence or not words:
            continue
        counted += 1
        best = max((len(words & st) / len(words) for st in source_tokens), default=0.0)
        if best < threshold:
            unsupported.append(sentence)
    score = 1.0 if counted == 0 else (counted - len(unsupported)) / counted
    return score, unsupported

sources = ["Puncture repairs cost £12 and are usually done the same day.",
           "Unused items can be returned within 30 days with a receipt."]
answer = "A puncture repair costs £12. It is usually done the same day. We also offer free tea."
print(groundedness(answer, sources))
```

**Line by line**

- Counting tokens with digits as content words means numbers get checked: "Returns are accepted within 90 days." has content words {returns, accepted, within, 90, days}, and only "within" and "days" appear in the returns source (2/5 = 0.4), so it's flagged.
- Taking the **best single source** (not all sources pooled) avoids "supporting" a claim with words scattered across unrelated documents.
- Sentences like "Yes." have no content words and are skipped, rather than counted as unsupported.
- `max(..., default=0.0)` handles an empty source list.

**Trace** on the first case: sentence 1 overlaps 2/4 with the repairs source → supported; sentence 2 {usually, done, same} → all three present → supported; sentence 3 {also, offer, free} → nothing → unsupported. Score 2/3.

**Complexity:** O(sentences × sources × words).

**Common wrong approach:** treating this as proof. Word overlap misses paraphrases ("costs" versus "cost") and can't see contradictions that reuse the source's words ("returns are **not** accepted within 30 days" overlaps perfectly). Use it as a fast first filter, and an LLM judge or human review for the real verdict (Part 6).

</details>

## Quick quiz

1. Retrieval found the right chunk, but the answer is wrong. Where should you look?
   - A) The embedding model
   - B) The chunk size
   - C) The generation step: the prompt, the model, or conflicting chunks

2. Why does recall@k usually matter more than precision@k for RAG?
   - A) The model can ignore an irrelevant chunk but can't use a relevant one that was never retrieved
   - B) Recall is cheaper to compute
   - C) Precision can't be measured

3. Why include unanswerable questions in a RAG evaluation set?
   - A) To make the scores look better
   - B) Because every question must be unanswerable
   - C) To check the system says "I don't know" instead of inventing an answer

4. What's a weakness of word-overlap groundedness checks?
   - A) They're too slow
   - B) They miss paraphrases and can't detect contradictions that reuse the source's words
   - C) They need a GPU

<details>
<summary>Quiz answers</summary>

1. **C) The generation step: the prompt, the model, or conflicting chunks**: Diagnose which half failed before changing anything.
2. **A) The model can ignore an irrelevant chunk but can't use a relevant one that was never retrieved**: Missing evidence can't be recovered later in the pipeline.
3. **C) To check the system says "I don't know" instead of inventing an answer**: Refusal accuracy is part of quality.
4. **B) They miss paraphrases and can't detect contradictions that reuse the source's words**: Use them as a cheap filter, not a verdict.

</details>

---
Previous: [Lesson 21](21-hybrid-and-reranking.md) · Next: [Lesson 23: Tool calling](23-tool-calling.md)
