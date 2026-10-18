# Lesson 13: Examples and structure

**You'll learn:** zero-shot and few-shot prompting, choosing relevant and diverse examples, how many examples, examples for thinking models, XML tags for instructions, documents, examples and inputs, the layout of a long prompt, documents first and question last, document metadata, grounding answers in quotes, tagged output, extracting tags with regular expressions.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ai-engineering/#examples-and-structure)**: run every example and check your exercise answers.

## Key terms

- **Zero-shot:** a prompt with instructions but no examples.
- **Few-shot:** a prompt that includes a few input and output examples.
- **XML tags:** named markers such as `<document>…</document>` that separate the parts of a prompt.
- **Grounding:** basing an answer on quoted evidence from the provided documents.
- **Non-greedy match:** a regex quantifier such as `.*?` that matches as little text as possible.

Instructions tell the model what you want; **examples** show it. And as prompts grow to include documents, examples and user input, **structure** keeps them from blurring together.

## Few-shot prompting

A prompt with no examples is **zero-shot**; with a few examples it's **few-shot**. Examples are the most reliable way to pin down format, tone and how to handle borderline cases, because the model copies patterns very closely.

```text
Classify each bike-shop review as positive, negative or mixed.

<examples>
<example>
<review>Fast service and a fair price. Will be back!</review>
<label>positive</label>
</example>
<example>
<review>Great repair, but it took three weeks.</review>
<label>mixed</label>
</example>
<example>
<review>They lost my wheel.</review>
<label>negative</label>
</example>
</examples>

<review>Friendly staff, though the shop was closed when the website said open.</review>
```

Good examples are:

- **Relevant:** realistic inputs like the ones you'll actually get.
- **Diverse:** cover each category and the tricky cases. If every example is short and positive, the model learns "short and positive".
- **Few but enough:** about **3–5** usually does it. More examples cost tokens on every call (cache them, Lesson 11).
- **Clearly marked**, in `<example>` tags, so the model doesn't confuse them with instructions or the real input.
- **Consistent:** every example must follow your own rules; the model will copy mistakes too.

With thinking models you can show the **method** as well as the answer: problem, the approach, then the result. The model uses the pattern in its own reasoning.

## XML tags

Wrapping each part of a prompt in descriptive tags (`<instructions>`, `<document>`, `<example>`, `<email>`) makes it unambiguous which text is which. There's nothing special about particular tag names; choose clear ones and use them consistently. Tags also let you refer to parts: "Using the policy in `<policy>` tags, answer the question in `<question>` tags."

Tags matter most when you insert **variable data** (a user's email, a retrieved document): the model can see exactly where the data starts and ends, which also helps against prompt injection (Lesson 16).

## Laying out a long prompt

![A prompt drawn as a stack of labelled sections, top to bottom: system prompt with role and rules; long documents, each in document tags with a source; examples in example tags; task instructions; and finally the user's question. Arrows note that stable content near the top can be cached, and that putting the question last improves answers on long inputs](../figures/prompt-layout.svg)

For long inputs (thousands of tokens and up):

- **Put long documents at the top**, before the instructions and the question. Anthropic reports that placing the query at the end can improve answer quality by up to 30% on long, multi-document inputs.
- **Wrap each document** in its own tags with metadata:

```text
<documents>
<document index="1">
<source>returns-policy.md</source>
<document_content>
Customers may return unused items within 30 days…
</document_content>
</document>
<document index="2">
<source>warranty.md</source>
<document_content>
Frames carry a lifetime warranty against manufacturing defects…
</document_content>
</document>
</documents>
```

- **Ask for quotes first.** "Find the quotes from the documents relevant to the question and put them in `<quotes>` tags. Then answer in `<answer>` tags, using only those quotes." Pulling out the evidence first keeps the answer focused and makes it checkable.

## Tagged output

Asking for output inside tags makes replies easy to process:

```python
import re

reply = """<quotes>
"Customers may return unused items within 30 days."
</quotes>
<answer>
Yes, if the helmet is unused and you bought it in the last 30 days.
</answer>"""

answer = re.search(r"<answer>(.*?)</answer>", reply, re.DOTALL).group(1).strip()
print(answer)
```

`.*?` is **non-greedy**: it stops at the first closing tag instead of the last. `re.DOTALL` lets `.` match newlines. For anything more structured than a few text fields, prefer structured outputs (Lesson 9).

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Few-shot prompt | instructions, examples in tags, then the input | O(text) | O(text) |
| Extract tagged sections | re.findall with (.*?) and DOTALL | O(n) | O(matches) |
| Long-context layout | documents first, instructions, question last | — | — |

## Common mistakes

- Examples that are all of one kind, teaching an accidental pattern.
- Examples that break your own rules.
- Putting the question before long documents.
- Mixing instructions and inserted data with no clear boundary.
- Extracting tags with a greedy `.*`.

## Exercises

### 1. Build a few-shot prompt

Write `few_shot_prompt(instructions, examples, query)`, where `examples` is a list of `(input, output)` pairs, returning **exactly** this layout (lines joined with `"\n"`):

```text
<instructions>
INSTRUCTIONS
</instructions>
<examples>
<example>
<input>INPUT 1</input>
<output>OUTPUT 1</output>
</example>
…one block per example…
</examples>
<input>QUERY</input>
```

With no examples, leave out the whole `<examples>` section.

Starter code:

```python
def few_shot_prompt(instructions, examples, query):
    pass

print(few_shot_prompt("Label the review as positive, negative or mixed.",
                      [("Fast and friendly!", "positive"), ("Took three weeks.", "negative")],
                      "Great repair, slow service."))
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** an exact text layout; the examples section is optional.
2. **Examples:** zero examples → instructions then the input line only.
3. **Brute force:** string concatenation with `+`: works, but easy to misplace a newline.
4. **Pattern:** **build a list of lines, then join**.
5. **Plan:** instructions block → optional examples block → query line → join.
6. **Code and test:** zero, one and several examples; multi-line text.

</details>

<details>
<summary>💡 Hint 1</summary>

Build a list of lines and finish with `"\n".join(lines)`; it's easier to get exactly right than adding strings together.

</details>

<details>
<summary>💡 Hint 2</summary>

Each example contributes four lines: `<example>`, the input line, the output line, `</example>`. Only add `<examples>` and `</examples>` if the list isn't empty.

</details>

<details>
<summary>💡 Hint 3</summary>

The query line is `f"<input>{query}</input>"`, always last.

</details>

### 2. Pull tagged sections out of a reply

Write `extract_tags(text, tag)` returning a list of the contents of **every** `<tag>…</tag>` section in `text`, in order, each with surrounding whitespace stripped. Contents may span several lines. Return `[]` if there are none, and ignore an opening tag that's never closed.

Starter code:

```python
import re

def extract_tags(text, tag):
    pass

reply = """<quote>Returns within 30 days.</quote>
<quote>
Items must be unused.
</quote>
<answer>Yes, if it's unused.</answer>"""
print(extract_tags(reply, "quote"))    # ['Returns within 30 days.', 'Items must be unused.']
print(extract_tags(reply, "answer"))   # ["Yes, if it's unused."]
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** all sections, in order, stripped; multi-line; unclosed tags ignored.
2. **Examples:** `<a>one</a> and <a>two</a>` → two matches, not one long one.
3. **Brute force:** repeated `str.find` for the opening and closing tags: works, more code.
4. **Pattern:** **non-greedy regex with DOTALL**.
5. **Plan:** build the pattern → `findall` → strip each.
6. **Code and test:** two on a line, multi-line, empty, unclosed, a similar longer tag.

</details>

<details>
<summary>💡 Hint 1</summary>

`re.findall` with one group returns a list of just that group's matches.

</details>

<details>
<summary>💡 Hint 2</summary>

Use a **non-greedy** `(.*?)` so each match stops at the nearest closing tag, and `re.DOTALL` so `.` can cross newlines.

</details>

<details>
<summary>💡 Hint 3</summary>

`re.findall(rf"<{tag}>(.*?)</{tag}>", text, re.DOTALL)`, then strip each match (`re.escape(tag)` is safer for unusual tag names).

</details>

**In the sandbox:** exercises 24–25. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Build a few-shot prompt</summary>

```python
def few_shot_prompt(instructions, examples, query):
    lines = ["<instructions>", instructions, "</instructions>"]
    if examples:
        lines.append("<examples>")
        for example_input, example_output in examples:
            lines += ["<example>",
                      f"<input>{example_input}</input>",
                      f"<output>{example_output}</output>",
                      "</example>"]
        lines.append("</examples>")
    lines.append(f"<input>{query}</input>")
    return "\n".join(lines)

print(few_shot_prompt("Label the review as positive, negative or mixed.",
                      [("Fast and friendly!", "positive"), ("Took three weeks.", "negative")],
                      "Great repair, slow service."))
```

**Line by line**

- Starting from a list of lines makes every newline explicit and avoids a stray blank line at the end.
- Unpacking `for example_input, example_output in examples` documents what each pair holds.
- The `if examples:` guard drops the empty `<examples></examples>` wrapper, which would only confuse.
- The real query uses the same `<input>` tag as the examples, so the model sees it as "one more of these".

**Trace** for one example: `<instructions>`, text, `</instructions>`, `<examples>`, `<example>`, input line, output line, `</example>`, `</examples>`, query line.

**Complexity:** O(total text length).

**Common wrong approach:** examples that are all the same kind (all positive, all short), so the model learns the wrong pattern. The code is the easy part; choosing diverse examples is the real work.

</details>

<details>
<summary>✅ 2. Pull tagged sections out of a reply</summary>

```python
import re

def extract_tags(text, tag):
    pattern = rf"<{re.escape(tag)}>(.*?)</{re.escape(tag)}>"
    return [match.strip() for match in re.findall(pattern, text, re.DOTALL)]

reply = """<quote>Returns within 30 days.</quote>
<quote>
Items must be unused.
</quote>
<answer>Yes, if it's unused.</answer>"""
print(extract_tags(reply, "quote"))
print(extract_tags(reply, "answer"))
```

**Line by line**

- `rf"..."` is a raw f-string: backslashes stay literal for the regex, and `{tag}` is filled in.
- `(.*?)` matches as little as possible, so `<a>one</a> and <a>two</a>` gives `one` and `two` rather than `one</a> and <a>two`.
- `re.DOTALL` makes `.` match newlines too, needed for multi-line sections.
- `<answers>` doesn't match `<answer>` because the pattern requires `>` straight after the name.

**Trace** on the first case: two `<quote>` sections → `"Returns within 30 days."` and `"\nItems must be unused.\n"` → stripped.

**Complexity:** O(n) for typical inputs.

**Common wrong approach:** a greedy `(.*)`, which swallows everything from the first opening tag to the **last** closing tag. (Regexes are fine for flat tags in model output; for nested tags or real XML, use a proper parser.)

</details>

## Quick quiz

1. Why should few-shot examples be diverse?
   - A) The model copies patterns closely, so similar examples teach it an accidental pattern
   - B) The API rejects repeated examples
   - C) Diverse examples use fewer tokens

2. Where should long documents go in a prompt?
   - A) In the examples
   - B) Near the top, before the instructions and the question
   - C) At the very end, after the question

3. What do XML tags in a prompt do?
   - A) Switch the model into XML mode
   - B) Make the request cheaper
   - C) Separate instructions, documents, examples and inputs so each part is unambiguous

4. Why is .*? used to extract tagged sections?
   - A) It ignores newlines
   - B) It's faster to type
   - C) It's non-greedy: it stops at the first closing tag

<details>
<summary>Quiz answers</summary>

1. **A) The model copies patterns closely, so similar examples teach it an accidental pattern**: Cover each category and the tricky cases.
2. **B) Near the top, before the instructions and the question**: Putting the question last helps on long inputs.
3. **C) Separate instructions, documents, examples and inputs so each part is unambiguous**: Any clear, consistent tag names work.
4. **C) It's non-greedy: it stops at the first closing tag**: A greedy .* runs to the last closing tag.

</details>

---
Previous: [Lesson 12](12-prompt-basics.md) · Next: [Lesson 14: Reasoning and prompt chains](14-reasoning-and-chaining.md)
