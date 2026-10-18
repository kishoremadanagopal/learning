# Lesson 12: Writing clear prompts

**You'll learn:** what a prompt is in an application, the new-colleague test, giving context and reasons, specifying the output, positive instructions, ordered steps, matching prompt style to output style, calm wording for modern models, edge cases, roles and system prompts, prefill and sampling on the newest models, checking replies against the spec.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ai-engineering/#prompt-basics)**: run every example and check your exercise answers.

## Key terms

- **Prompt:** everything the model sees for a request: system prompt, conversation, documents and examples.
- **Prompt engineering:** designing, testing and refining prompts so a model does a task reliably.
- **System prompt:** the instructions and context that apply to the whole conversation.
- **Role prompt:** a sentence in the system prompt saying who the model is acting as and for whom.
- **Prefill:** starting the assistant's reply for it; not supported on the newest Claude models.
- **Linter:** a tool that flags likely problems using simple rules.

A **prompt** is everything the model sees: the system prompt, the conversation, any documents and examples. In an application you write it once and it runs thousands of times on inputs you've never seen, so **prompt engineering** is less about clever phrasing and more about clear specification, like writing a good brief for a colleague.

## The new-colleague test

Anthropic's guidance puts it well: think of the model as a **brilliant but new employee** who knows a lot about the world but nothing about your company, your users or what you meant. Before you ship a prompt, imagine handing it to a capable colleague with no background. **If they'd be confused, the model will be too.**

A vague prompt:

```text
Summarise this customer email.
```

A clear one:

```text
You'll summarise customer emails for our bike shop's support team, who skim
dozens a day and need to know quickly what to do next.

Write the summary as:
1. One sentence saying what the customer wants.
2. The order number, if one is given; otherwise "no order number".
3. The urgency: low, normal or high. High means safety problems or an order
   that's already late.

Keep it under 60 words, in plain sentences.
```

The second version answers the questions a newcomer would ask: who is this for, why, what exactly should come out, and how do I judge borderline cases?

## Principles

- **Give context and say why.** "Never use ellipses" is a rule; "this text is read aloud by a text-to-speech engine, so avoid ellipses because it can't pronounce them" is a rule the model can **generalise** from (it will also avoid other unpronounceable symbols).
- **Be specific about the output:** length, format, structure, tone, what to include. If a program will read it, use structured outputs (Lesson 9).
- **Say what to do, not only what not to do.** "Write in flowing prose paragraphs" works better than "don't use Markdown". Prohibitions alone leave the model guessing what you want instead.
- **Use ordered steps** (a numbered list) when the order matters.
- **Match the prompt's style to the output you want.** A prompt full of bullet points and headings invites bullet points and headings back.
- **Write calmly.** Older models sometimes needed "CRITICAL: you MUST…". Current models follow instructions closely, and shouting makes them **over-apply** a rule. "Use the search tool when the question is about stock levels" beats "ALWAYS USE THE SEARCH TOOL!!!".
- **Define the edge cases** you can foresee: missing information, off-topic requests, ambiguous inputs. Tell the model what to do in each ("If there's no order number, write…").

## Roles and the system prompt

The system prompt sets the scene for the whole conversation. Even one sentence of **role** focuses the model's tone and expertise:

```python
response = client.messages.create(
    model="claude-sonnet-5-5",
    max_tokens=1024,
    system="You are a friendly support assistant for Spoke & Chain, a bike shop in Bristol. "
           "Answer questions about our products, orders and repairs. For anything else, "
           "say politely that you can only help with the shop.",
    messages=[{"role": "user", "content": "My brakes squeal. Is that dangerous?"}],
)
```

A typical system prompt contains: the role and audience, the task and its goal, background knowledge (policies, product facts), rules and edge cases, and the output format. Keep the **user's specific request** in the user message, and put stable material in the system prompt where it can be cached (Lesson 11).

## Steering without old tricks

Two techniques from older tutorials no longer apply to the newest Claude models:

- **Prefilling** (starting the assistant's reply for it, such as `{`) isn't supported from Claude 4.6 onwards. Use structured outputs for JSON, or describe the format in the instructions.
- **Sampling settings** (temperature and friends) aren't available on Claude 4.7 and later (Lesson 5). Ask for variety or consistency in words, and use effort (Lesson 10) for depth.

## Prompts are code: check the output

Every rule in your prompt is something you can **test**. If you said "under 60 words" and "include the order number", write code that checks a reply against exactly that (the second exercise). Run your prompt over a set of realistic inputs, read the outputs, fix the prompt, repeat. Lesson 15 turns this into a routine, and Part 6 into a full evaluation process.

```python
prompt_v1 = "Summarise this customer email."
prompt_v2 = """You'll summarise customer emails for our bike shop's support team.
Write one sentence on what the customer wants, then the order number
(or "no order number"), then the urgency: low, normal or high.
Keep it under 60 words."""

for name, prompt in [("v1", prompt_v1), ("v2", prompt_v2)]:
    words = len(prompt.split())
    mentions_format = any(w in prompt.lower() for w in ("sentence", "words", "list", "json"))
    print(f"{name}: {words} words, says what the output looks like: {mentions_format}")
```

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Lint a prompt | split into words; set checks for shouting, vagueness, format | O(n) | O(n) |
| Check a reply | one check per rule in the spec; collect failures | O(n × rules) | O(rules) |
| Clear prompt | context and why, task, output format, edge cases | — | — |

## Common mistakes

- Writing a prompt only you could understand, with unstated context.
- Giving rules without the reasons behind them.
- Listing only what not to do.
- Shouting with capitals and "MUST", which makes modern models over-apply rules.
- Changing a prompt without re-checking its outputs.

## Exercises

### 1. Lint a prompt

A **linter** flags likely problems. Write `lint_prompt(prompt)` returning a list of warnings, in this order:

1. `"too short"` if the prompt has fewer than 8 words (split on whitespace).
2. `"shouting: WORD"` for each **distinct** all-capitals word of 4 or more letters, in order of first appearance. A word here is a run of letters (`re.findall(r"[A-Za-z]+", prompt)`); ignore the common acronyms `JSON`, `HTML`, `XML`, `CSV`, `HTTP`, `HTTPS`, `YAML`.
3. `"vague: etc"` if the word `etc` appears (any case).
4. `"no output format"` if none of these words appear (any case, as whole words): `format`, `json`, `list`, `table`, `sentence`, `sentences`, `words`, `bullet`, `bullets`, `paragraph`, `paragraphs`.

Starter code:

```python
import re

def lint_prompt(prompt):
    pass

print(lint_prompt("Summarise this email, etc."))
# ['too short', 'vague: etc', 'no output format']
print(lint_prompt("You MUST ALWAYS reply in JSON with the keys name and price. NEVER add other keys."))
# ['shouting: MUST', 'shouting: ALWAYS', 'shouting: NEVER']
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** four independent checks, reported in a fixed order; whole-word matching.
2. **Examples:** "bulleted" contains "bullet" as a substring, but not as a word, so it doesn't count.
3. **Brute force:** substring tests like `"list" in prompt.lower()`: wrong, because "listings" would match.
4. **Pattern:** **tokenise once, then run set-based checks**.
5. **Plan:** word count → shouted words with a `seen` set → lower-case word set → `etc` → format words.
6. **Code and test:** acronyms, repeated shouting, capitals under 4 letters, empty input.

</details>

<details>
<summary>💡 Hint 1</summary>

`re.findall(r"[A-Za-z]+", prompt)` splits the text into words of letters only, which handles punctuation like `IMPORTANT:` and `etc.` for you.

</details>

<details>
<summary>💡 Hint 2</summary>

A shouted word has `len(word) >= 4` and `word.isupper()`, isn't an acronym, and hasn't been reported already (keep a `seen` set). `ETC` has only 3 letters, so it's never shouting.

</details>

<details>
<summary>💡 Hint 3</summary>

Lower-case all the words into a set; then `"etc" in words` and `words & FORMAT_WORDS` (set intersection) answer the last two checks.

</details>

### 2. Check a reply against the spec

Your prompt promised a format; now verify it. Write `check_reply(reply, max_words=None, must_include=(), must_not_include=(), allowed_values=None)` returning a list of failures, in this order:

1. If `max_words` is set and the reply has more words (split on whitespace): `"too long: N words"`.
2. For each phrase in `must_include` that isn't in the reply (case-insensitive): `"missing: phrase"`.
3. For each phrase in `must_not_include` that **is** in the reply (case-insensitive): `"forbidden: phrase"`.
4. If `allowed_values` is set (for one-word answers such as a label) and the reply, stripped of surrounding whitespace and full stops and lower-cased, isn't one of them: `"not allowed: <the cleaned reply>"`.

Starter code:

```python
def check_reply(reply, max_words=None, must_include=(), must_not_include=(), allowed_values=None):
    pass

print(check_reply("The customer wants a refund for order 1182. Urgency: high.",
                  max_words=60, must_include=["order", "urgency"], must_not_include=["sorry"]))   # []
print(check_reply(" Urgent. ", allowed_values={"low", "normal", "high"}))   # ['not allowed: urgent']
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** each spec rule becomes one check; failures are collected, not raised.
2. **Examples:** " Urgent. " → "urgent" → not in {low, normal, high}.
3. **Brute force:** this is already direct.
4. **Pattern:** **spec → assertions**: the same idea as unit tests.
5. **Plan:** word count → required phrases → forbidden phrases → label check.
6. **Code and test:** the limit itself, any-case matching, a label with extra words.

</details>

<details>
<summary>💡 Hint 1</summary>

Compare in lower case: `phrase.lower() in reply.lower()`. Report the phrase as it was given.

</details>

<details>
<summary>💡 Hint 2</summary>

Check `max_words is not None` (not just `if max_words`), so a limit of 0 would still work.

</details>

<details>
<summary>💡 Hint 3</summary>

To clean a label: `reply.strip().strip(".").strip().lower()`: spaces, then full stops, then any spaces that were inside them.

</details>

**In the sandbox:** exercises 22–23. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Lint a prompt</summary>

```python
import re

ACRONYMS = {"JSON", "HTML", "XML", "CSV", "HTTP", "HTTPS", "YAML"}
FORMAT_WORDS = {"format", "json", "list", "table", "sentence", "sentences", "words",
                "bullet", "bullets", "paragraph", "paragraphs"}

def lint_prompt(prompt):
    warnings = []
    if len(prompt.split()) < 8:
        warnings.append("too short")
    words = re.findall(r"[A-Za-z]+", prompt)
    seen = set()
    for word in words:
        if len(word) >= 4 and word.isupper() and word not in ACRONYMS and word not in seen:
            seen.add(word)
            warnings.append(f"shouting: {word}")
    lower = {word.lower() for word in words}
    if "etc" in lower:
        warnings.append("vague: etc")
    if not lower & FORMAT_WORDS:
        warnings.append("no output format")
    return warnings

print(lint_prompt("Summarise this email, etc."))
print(lint_prompt("You MUST ALWAYS reply in JSON with the keys name and price. NEVER add other keys."))
```

**Line by line**

- `prompt.split()` counts whitespace-separated words for the length check, matching how a person would count.
- The regex gives letter-only words, so `"IMPORTANT:"` becomes `IMPORTANT` and `"etc."` becomes `etc`.
- The `seen` set reports each shouted word once while keeping first-appearance order (the list holds the order).
- Set intersection `lower & FORMAT_WORDS` is a whole-word check: `bulleted` and `formatting` aren't in the set.

**Trace** on the shouting example: 16 words, so not too short; the all-capitals words are MUST, ALWAYS, JSON and NEVER, and JSON is an allowed acronym; there's no `etc`; and `json` counts as a format word, so there's no format warning.

**Complexity:** O(n) for a prompt of n characters.

**Common wrong approach:** substring checks (`"list" in text`), which fire on "listings" and "blacklist". Remember a linter's rules are **heuristics**: they flag prompts worth a second look, not prompts that are definitely wrong.

</details>

<details>
<summary>✅ 2. Check a reply against the spec</summary>

```python
def check_reply(reply, max_words=None, must_include=(), must_not_include=(), allowed_values=None):
    failures = []
    words = len(reply.split())
    if max_words is not None and words > max_words:
        failures.append(f"too long: {words} words")
    text = reply.lower()
    for phrase in must_include:
        if phrase.lower() not in text:
            failures.append(f"missing: {phrase}")
    for phrase in must_not_include:
        if phrase.lower() in text:
            failures.append(f"forbidden: {phrase}")
    if allowed_values is not None:
        cleaned = reply.strip().strip(".").strip().lower()
        if cleaned not in allowed_values:
            failures.append(f"not allowed: {cleaned}")
    return failures

print(check_reply("The customer wants a refund for order 1182. Urgency: high.",
                  max_words=60, must_include=["order", "urgency"], must_not_include=["sorry"]))
print(check_reply(" Urgent. ", allowed_values={"low", "normal", "high"}))
```

**Line by line**

- Counting with `split()` matches how the limit was stated in the prompt ("under 60 words").
- Lower-casing both sides once makes every phrase check case-insensitive.
- The label check cleans only the edges: "high priority" stays two words and fails, as it should for a one-word label.
- Returning a list (rather than stopping at the first failure) shows everything that needs fixing at once.

**Trace** on the "everything at once" case: 6 words > 3; "x" missing; "a" present; cleaned "a b c d e f" not in {"y"}.

**Complexity:** O(len(reply) × number of phrases).

**Common wrong approach:** only eyeballing a few outputs. Checks like these run over hundreds of replies in seconds, and they catch the drift when you change a prompt or model.

</details>

## Quick quiz

1. What is the "new colleague" test for a prompt?
   - A) Is it shorter than a tweet?
   - B) Would a new model version accept it?
   - C) Would a capable person with no background on the task understand exactly what to do from it?

2. Why explain the reason behind an instruction?
   - A) Reasons are required by the API
   - B) It makes the prompt cheaper
   - C) The model can generalise from the reason to cases the rule didn't mention

3. Which instruction is likely to work best?
   - A) NEVER EVER USE BULLET POINTS!!!
   - B) Write the answer as two short prose paragraphs.
   - C) Don't use Markdown.

4. How do you get JSON from the newest Claude models now that prefilling is unsupported?
   - A) Use structured outputs, or describe the format in the instructions
   - B) Raise the temperature
   - C) Start the assistant message with a brace

<details>
<summary>Quiz answers</summary>

1. **C) Would a capable person with no background on the task understand exactly what to do from it?**: If a newcomer would be confused, the model will be too.
2. **C) The model can generalise from the reason to cases the rule didn't mention**: "Read aloud by text-to-speech" covers more than a single banned symbol.
3. **B) Write the answer as two short prose paragraphs.**: Say what you want; shouting makes modern models over-apply rules.
4. **A) Use structured outputs, or describe the format in the instructions**: Prefilling returns an error on Claude 4.6 and later.

</details>

---
Previous: [Lesson 11](11-cost-and-caching.md) · Next: [Lesson 13: Examples and structure](13-examples-and-structure.md)
