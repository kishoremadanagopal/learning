# Lesson 10: Reasoning, images and documents

**You'll learn:** reasoning models, adaptive thinking, the effort parameter, thinking tokens and billing, max tokens and thinking, thinking display options, passing thinking blocks back, model differences, image content blocks, supported image formats and limits, estimating image tokens, the Files API, PDF document blocks, how PDFs are processed, vision limitations.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ai-engineering/#reasoning-and-multimodal)**: run every example and check your exercise answers.

## Key terms

- **Reasoning model:** a model that can generate intermediate reasoning (thinking) before its answer.
- **Adaptive thinking:** the model decides per request whether and how much to think.
- **Effort:** a setting that trades quality for speed and cost across all output tokens.
- **Thinking block:** a content block holding the model's reasoning (or an omitted or summarised form of it).
- **Base64:** a way to encode binary data such as images as text, about a third larger than the original.
- **Media type:** the standard label for a file format, such as `image/png` or `application/pdf`.
- **Document block:** a content block carrying a PDF or other document.

Two features change what a single call can do: models that **think** before answering, and models that **see** images and documents.

## Thinking models

A **reasoning model** can write out intermediate reasoning (**thinking**) before its final answer. Working through a problem step by step makes it much better at maths, code, planning and multi-step analysis, at the cost of more output tokens and more time.

On current Claude models thinking is **adaptive**: the model decides per request whether and how much to think, so a simple question gets a quick answer and a hard one gets careful reasoning. You steer it with the **effort** setting:

```python
response = client.messages.create(
    model="claude-opus-5-5",
    max_tokens=16000,                       # includes thinking tokens, so leave room
    output_config={"effort": "high"},       # low, medium, high, xhigh or max
    messages=[{"role": "user", "content": "Plan a database migration that avoids downtime."}],
)
print(response.usage.output_tokens)         # billed output, including all thinking
```

| Effort | Use for |
|---|---|
| `low` | simple, high-volume tasks where speed and cost matter most |
| `medium` | a balanced default (the default on Opus 5.5) |
| `high` | complex reasoning, coding and agent work (the default on most other models) |
| `xhigh`, `max` | the hardest problems, when quality matters far more than time and cost |

Effort affects **all** output, not just thinking: lower effort also means shorter answers and fewer tool calls. Start at the default, then try a lower level on your evaluation set (Part 6); keep it if quality holds.

Details that trip people up (current as of late 2026; check the docs for your model):

- `max_tokens` **includes** thinking. Set it too low and the reply can stop at `max_tokens` before any answer appears.
- You are billed for **all** the thinking tokens. By default the newest Claude models return thinking blocks with the text **omitted**; `thinking={"type": "adaptive", "display": "summarized"}` returns a readable summary instead. Either way the cost is the same.
- When you send a conversation back (especially with tools), **pass thinking blocks back unchanged**: they carry the reasoning behind earlier steps.
- Thinking can't be switched off on Opus 5.5 or Fable 5.1 (effort is the control). Sonnet 5.5 can skip up-front thinking with `thinking={"type": "between_tools"}`. Haiku 4.5 is the reverse: thinking is off unless you turn it on with a token budget.
- Don't ask a thinking model to "think step by step" in the prompt for things it already reasons about; tell it **what** a good answer looks like instead (Part 3).

## Images

Vision models accept images as content blocks, from a URL, base64 data, or a file uploaded with the Files API:

```python
import base64

with open("receipt.jpg", "rb") as f:
    data = base64.standard_b64encode(f.read()).decode("ascii")

response = client.messages.create(
    model="claude-sonnet-5-5",
    max_tokens=1024,
    messages=[{"role": "user", "content": [
        {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": data}},
        {"type": "text", "text": "List each item and price on this receipt as JSON."},
    ]}],
)
```

- Formats: **JPEG, PNG, GIF** (first frame only) and **WebP**. Up to 10 MB per image (base64) on the Claude API.
- Put images **before** the question; it tends to work best.
- Images cost tokens. Claude splits an image into 28×28-pixel patches: about ⌈width ÷ 28⌉ × ⌈height ÷ 28⌉ tokens. Large images are scaled down first (on Claude 4.7 and later, to at most 2,576 pixels on the long edge and 4,784 tokens). The first exercise estimates it.
- Base64 is about a third bigger than the raw bytes; for repeated use, upload once with the **Files API** and reference the `file_id`.
- Limits: counting many small objects and precise positions are approximate; small, blurry or rotated text may be misread; models don't identify real people from their faces. Check important readings.

## PDFs and documents

A PDF goes in a `document` block. Claude reads each page **both** as extracted text and as an image, so it understands charts, tables and layout, not just the words:

```python
response = client.messages.create(
    model="claude-sonnet-5-5",
    max_tokens=2048,
    messages=[{"role": "user", "content": [
        {"type": "document", "source": {"type": "url", "url": "https://example.com/annual-report.pdf"}},
        {"type": "text", "text": "Summarise the revenue trend shown in the charts."},
    ]}],
)
```

Expect roughly **1,500–3,000 text tokens per page plus the page image**, so a long PDF is expensive: cache it (Lesson 11) when you ask several questions about the same document, or extract only the pages you need. Plain-text formats (Markdown, CSV, code) are cheapest sent as text.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Image token estimate | scale to the maximum edge; ceil(w ÷ 28) × ceil(h ÷ 28); cap | O(1) | O(1) |
| Build a multimodal message | files as blocks first, question text last | O(total bytes) | O(total bytes) |
| Choose effort | start at the default; lower it while evaluations hold | — | — |

## Common mistakes

- Setting `max_tokens` too low for a thinking model, so the answer never arrives.
- Assuming hidden thinking is free.
- Editing or dropping thinking blocks when sending a conversation back.
- Sending huge images when a smaller version would do.
- Relying on precise counts, positions or tiny text read from an image without checking.

## Exercises

### 1. Estimate an image's tokens

Write `image_tokens(width, height, max_edge=2576, max_tokens=4784)` estimating how many tokens an image costs:

1. If the longer side is more than `max_edge`, scale **both** sides by `max_edge / longer side` (keep them as floats).
2. The estimate is `ceil(width / 28) * ceil(height / 28)`, capped at `max_tokens`.

Starter code:

```python
import math

def image_tokens(width, height, max_edge=2576, max_tokens=4784):
    pass

print(image_tokens(1000, 1000))   # 1296
print(image_tokens(3840, 2160))   # 4784 (a 4K screenshot is scaled down first)
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** scale down only when too big, keep the aspect ratio, count 28-pixel patches rounded up, then cap.
2. **Examples:** 3840×2160 → scale 2576/3840 → 2576×1449 → 92 × 52 = 4784.
3. **Brute force:** not needed: it's a formula.
4. **Pattern:** **clamp, then compute**.
5. **Plan:** longest side → optional scale → ceil × ceil → min with the cap.
6. **Code and test:** exactly at the edge, just over a patch, tall images, the cap.

</details>

<details>
<summary>💡 Hint 1</summary>

First decide whether the image needs shrinking: compare `max(width, height)` with `max_edge`.

</details>

<details>
<summary>💡 Hint 2</summary>

Shrinking multiplies both sides by the same factor, `max_edge / longest`, which keeps the shape. Partial patches still count, so round **up** with `math.ceil`.

</details>

<details>
<summary>💡 Hint 3</summary>

`min(max_tokens, math.ceil(width / 28) * math.ceil(height / 28))`.

</details>

### 2. Build a multimodal message

Write `build_content(files, question)` turning a list of `(filename, data)` pairs (`data` is `bytes`) and a question into a list of content blocks: one block per file **in order**, then a text block with the question.

- `.png`, `.jpg`/`.jpeg`, `.gif`, `.webp` → `{"type": "image", "source": {"type": "base64", "media_type": ..., "data": ...}}` with media types `image/png`, `image/jpeg`, `image/gif`, `image/webp`.
- `.pdf` → the same shape with `"type": "document"` and `application/pdf`.
- The extension check ignores case (`PHOTO.JPG` is fine). `data` is `base64.b64encode(data).decode("ascii")`.
- Any other extension → `raise ValueError(f"unsupported file: {filename}")`.

Starter code:

```python
import base64

def build_content(files, question):
    pass

blocks = build_content([("chart.png", b"\x89PNG..."), ("report.pdf", b"%PDF-1.7")], "What changed?")
for block in blocks:
    print(block["type"], block.get("source", {}).get("media_type", ""))
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** files first (images before text works best), then the question; exact block shapes; reject unknown types loudly.
2. **Examples:** `PHOTO.JPG` → jpeg; `archive.png.zip` → zip → error.
3. **Brute force:** a chain of `if`/`elif` per extension: works but repetitive.
4. **Pattern:** **lookup table** plus a loop.
5. **Plan:** extension → table lookup or error → block → append question.
6. **Code and test:** no files, upper case, several dots, no extension.

</details>

<details>
<summary>💡 Hint 1</summary>

A dict from extension to `(block type, media type)` keeps the rules in one place.

</details>

<details>
<summary>💡 Hint 2</summary>

The extension is the text after the **last** dot: `filename.rsplit(".", 1)[-1].lower()`. A name with no dot has no extension.

</details>

<details>
<summary>💡 Hint 3</summary>

Build each block, append the text block last, and `raise ValueError(f"unsupported file: {filename}")` for unknown extensions.

</details>

**In the sandbox:** exercises 18–19. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Estimate an image's tokens</summary>

```python
import math

def image_tokens(width, height, max_edge=2576, max_tokens=4784):
    longest = max(width, height)
    if longest > max_edge:
        scale = max_edge / longest
        width, height = width * scale, height * scale
    return min(max_tokens, math.ceil(width / 28) * math.ceil(height / 28))

print(image_tokens(1000, 1000))
print(image_tokens(3840, 2160))
```

**Line by line**

- Using the **longer** side for the scale factor guarantees both sides end up within `max_edge`.
- Scaling both sides by the same factor keeps the aspect ratio, as the real resizing does.
- `math.ceil` counts a partial patch as a whole one: a 29-pixel-wide image needs two columns of patches.
- `min(max_tokens, …)` applies the per-image token limit.

**Trace** for 1000×5152: the longest side 5152 > 2576, so scale by 0.5 → 500×2576 → ⌈500 / 28⌉ × ⌈2576 / 28⌉ = 18 × 92 = 1656.

**Complexity:** O(1).

**Common wrong approach:** rounding down (`//`), which undercounts every image whose sides aren't multiples of 28. Remember it's an **estimate**: the real resizer shrinks an image a little further when it's over the token limit (a 4K screenshot on older models costs 1,560 tokens, not the capped 1,568), so use the token-counting API for exact numbers.

</details>

<details>
<summary>✅ 2. Build a multimodal message</summary>

```python
import base64

MEDIA_TYPES = {
    "png": ("image", "image/png"),
    "jpg": ("image", "image/jpeg"),
    "jpeg": ("image", "image/jpeg"),
    "gif": ("image", "image/gif"),
    "webp": ("image", "image/webp"),
    "pdf": ("document", "application/pdf"),
}

def build_content(files, question):
    blocks = []
    for filename, data in files:
        extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if extension not in MEDIA_TYPES:
            raise ValueError(f"unsupported file: {filename}")
        kind, media_type = MEDIA_TYPES[extension]
        blocks.append({"type": kind, "source": {"type": "base64", "media_type": media_type,
                                                "data": base64.b64encode(data).decode("ascii")}})
    blocks.append({"type": "text", "text": question})   # the question goes after the files
    return blocks

blocks = build_content([("chart.png", b"\x89PNG..."), ("report.pdf", b"%PDF-1.7")], "What changed?")
for block in blocks:
    print(block["type"], block.get("source", {}).get("media_type", ""))
```

**Line by line**

- `rsplit(".", 1)[-1]` splits once from the right, so `my.photo.png` gives `png` and `archive.png.zip` gives `zip`.
- `.lower()` makes `JPG` and `jpg` the same.
- The table maps each extension to both the block type and the media type, so adding a format is a one-line change.
- `base64.b64encode` returns bytes; `.decode("ascii")` turns it into the string JSON needs.

**Trace:** `chart.png` → image/png block; `report.pdf` → document block; then the question text block.

**Complexity:** O(total bytes), for the encoding.

**Common wrong approach:** checking `"png" in filename`, which accepts `png_notes.txt`, or guessing the media type wrongly (`image/jpg` isn't a valid media type: it's `image/jpeg`).

</details>

## Quick quiz

1. Why can a reply hit max_tokens before any visible answer appears?
   - A) Thinking is free but slow
   - B) max_tokens includes the thinking tokens, which come first
   - C) Images use up max_tokens

2. What does lowering effort change?
   - A) All output: less thinking, shorter answers and fewer tool calls
   - B) Only the thinking display
   - C) Only the price per token

3. Thinking display is set to omitted. What do you pay for?
   - A) Only the summary
   - B) All the thinking tokens the model actually generated
   - C) Nothing for thinking

4. What is a sensible way to ask several questions about one long PDF?
   - A) Convert it to an image first
   - B) Send it base64-encoded twice for accuracy
   - C) Cache the document (prompt caching) or send only the relevant pages

<details>
<summary>Quiz answers</summary>

1. **B) max_tokens includes the thinking tokens, which come first**: Leave room for thinking plus the answer.
2. **A) All output: less thinking, shorter answers and fewer tool calls**: It trades quality for speed and cost across the whole response.
3. **B) All the thinking tokens the model actually generated**: Display changes what you see, not what you're billed.
4. **C) Cache the document (prompt caching) or send only the relevant pages**: Each page costs text tokens plus an image, so avoid paying for it repeatedly.

</details>

---
Previous: [Lesson 9](09-structured-output.md) · Next: [Lesson 11: Cost, caching and batches](11-cost-and-caching.md)
