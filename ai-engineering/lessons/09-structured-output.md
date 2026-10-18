# Lesson 9: Getting reliable JSON out

**You'll learn:** why programs need structured data, asking for JSON in the prompt, defensive parsing, JSON Schema, constrained decoding and guaranteed structured outputs, output_config format, Pydantic models with the SDK, schema limitations, strict tool use, validating values, retrying with error feedback, designing schemas with descriptions, enums and nullable fields.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ai-engineering/#structured-output)**: run every example and check your exercise answers.

## Key terms

- **JSON:** a text format for data made of objects, arrays, strings, numbers, booleans and null.
- **JSON Schema:** a standard way to describe the allowed structure and types of JSON data.
- **Structured outputs:** an API feature that guarantees the reply matches a given schema.
- **Constrained decoding:** restricting which tokens the model may generate so the output always fits a grammar or schema.
- **Pydantic:** a Python library that defines data models with type hints and validates data against them.
- **Validation:** checking that data has the required fields, types and allowed values.
- **Enum:** a fixed list of allowed values for a field.

A person reads a reply; a **program** needs data it can rely on: a dict with the right keys and the right types, every time. Getting there takes three layers: **ask** for the structure, **constrain** the model to it where the API allows, and **validate** what comes back.

## Layer 1: ask for JSON and parse defensively

The simplest approach is to describe the format in the prompt and parse the reply. It works most of the time, but models sometimes wrap the JSON in a Markdown code fence or add a sentence before it, so parse defensively:

```python
import json

fence = "`" * 3                                     # a Markdown code fence
reply = f"""Here's the product:
{fence}json
{{"name": "Trail tyre 29x2.4", "price": 54.99, "in_stock": true}}
{fence}"""
print(reply)

start, end = reply.find("{"), reply.rfind("}")      # the outermost braces
data = json.loads(reply[start:end + 1])
print(data["name"], data["price"], type(data["in_stock"]).__name__)
```

JSON has its own spellings: `true`, `false` and `null` become Python's `True`, `False` and `None`, and every key is a string. `json.loads` raises `json.JSONDecodeError` (a subclass of `ValueError`) when the text isn't valid JSON, so always be ready to catch it. The first exercise builds a robust parser.

## Layer 2: constrain the output with a schema

**JSON Schema** is the standard way to describe the shape of JSON data: which fields exist, their types, which are required.

```python
schema = {
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "price": {"type": "number"},
        "in_stock": {"type": "boolean"},
        "tags": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["name", "price", "in_stock", "tags"],
    "additionalProperties": False,
}
print("fields:", list(schema["properties"]))
print("all required:", set(schema["required"]) == set(schema["properties"]))
```

Most providers can **guarantee** that the reply matches a schema: they restrict which tokens the model may generate at each step (constrained decoding), so the output always parses. With Claude, pass the schema in `output_config`:

```python
import json
import anthropic

client = anthropic.Anthropic()
response = client.messages.create(
    model="claude-sonnet-5-5",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Extract the product: 'Trail tyre 29x2.4, £54.99, in stock, tubeless-ready.'"}],
    output_config={"format": {"type": "json_schema", "schema": schema}},
)
text = next(block.text for block in response.content if block.type == "text")
product = json.loads(text)        # guaranteed to parse and match the schema
```

The SDK can build the schema from a **Pydantic** model and hand you a parsed object back:

```python
from pydantic import BaseModel

class Product(BaseModel):
    name: str
    price: float
    in_stock: bool
    tags: list[str]

response = client.messages.parse(
    model="claude-sonnet-5-5",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Extract the product: 'Trail tyre 29x2.4, £54.99, in stock, tubeless-ready.'"}],
    output_format=Product,
)
product = response.parsed_output   # a Product instance
print(product.price)
```

Things to know about guaranteed structured outputs:

- Not every JSON Schema feature is supported (for Claude, for example: no recursive schemas, no numeric ranges or string-length limits, and objects need `"additionalProperties": false`). The SDK adapts Pydantic models for you; check the docs for the current list.
- The format is guaranteed, **the values are not**. The model can still put the wrong price in a perfectly valid field.
- If the reply stops early (`stop_reason` is `max_tokens`) or the model refuses (`refusal`), the output may not match. Check the stop reason first.
- For tools (Part 5), `"strict": true` on a tool definition gives the same guarantee for the tool's arguments.
- Other providers have the same idea under names like *structured outputs* or *JSON mode*; JSON mode alone only guarantees valid JSON, not your schema.

## Layer 3: validate the values, and retry

Validation catches what the schema can't express: a negative price, an unknown category, an end date before a start date. Pydantic does type checks and lets you add your own rules; for simple cases a few lines of Python are enough (the second exercise). When validation fails, a common pattern is to **send the errors back** and ask the model to fix its answer, a limited number of times:

```python
import json

class FakeModel:
    """Returns a bad answer first, then a corrected one: enough to show the loop."""
    def __init__(self):
        self.replies = ['{"name": "Trail tyre", "price": "54.99"}',
                        '{"name": "Trail tyre", "price": 54.99}']
    def ask(self, messages):
        return self.replies.pop(0)

def problems(data):
    errors = []
    if not isinstance(data.get("name"), str):
        errors.append("name should be a string")
    if isinstance(data.get("price"), bool) or not isinstance(data.get("price"), (int, float)):
        errors.append("price should be a number")
    return errors

def extract(model, text, attempts=3):
    messages = [{"role": "user", "content": f"Return JSON with name and price for: {text}"}]
    for _ in range(attempts):
        reply = model.ask(messages)
        try:
            data = json.loads(reply)
            errors = problems(data)
        except json.JSONDecodeError as e:
            errors = [f"invalid JSON: {e}"]
        if not errors:
            return data
        print("retrying because:", errors)
        messages += [{"role": "assistant", "content": reply},
                     {"role": "user", "content": "Please fix: " + "; ".join(errors)}]
    raise ValueError("no valid answer after retries")

print(extract(FakeModel(), "Trail tyre 29x2.4, £54.99"))
```

Design tips that make structured output more accurate:

- **Name fields clearly** and add a `description` to each property in the schema; the model reads them.
- Use **enums** (`{"enum": ["road", "gravel", "mtb"]}`) for categories, so the model can't invent new ones.
- Allow `null` (or an `"unknown"` option) for information that may be missing; otherwise the model is pushed to make something up.
- Put a free-text `"reasoning"` field **before** the answer fields if you want the model to think first; later fields are generated after earlier ones.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Parse JSON from a reply | slice first { to last }; json.loads; catch errors | O(n) | O(n) |
| Validate a record | check each schema field, then extra fields | O(fields) | O(problems) |
| Reliable structure | structured outputs, then validate values, then retry with feedback | — | — |

## Common mistakes

- Calling `json.loads` on a raw reply that may include a code fence or extra text.
- Trusting values just because the format is guaranteed.
- Forgetting that `bool` is a subclass of `int` in Python type checks.
- Requiring a value the input may not contain, which invites the model to invent one.
- Retrying invalid output forever instead of a fixed number of times.

## Exercises

### 1. Parse a JSON reply

Write `parse_json_reply(text)` that returns the **dict** in a model's reply, or `None` if there isn't a valid one. The reply may:

- be plain JSON,
- be wrapped in a Markdown code fence (three backticks, optionally followed by `json`),
- have extra text before or after the JSON.

Take the text from the first `{` to the last `}` and parse it with `json.loads`. Return `None` if there are no braces, the text isn't valid JSON, or the result isn't a dict.

Starter code:

```python
import json

def parse_json_reply(text):
    pass

print(parse_json_reply('Sure! {"name": "Bell", "price": 12.5} Hope that helps.'))
print(parse_json_reply("Sorry, I can't find a product in that text."))   # None
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** find the JSON object inside surrounding noise; anything unusable gives `None` rather than an exception.
2. **Examples:** a fenced reply → the slice between the braces is exactly the object.
3. **Brute force:** try `json.loads` on every substring: very slow and unnecessary.
4. **Pattern:** **locate, slice, parse, check** (defensive parsing).
5. **Plan:** `find` / `rfind` → guard → `try json.loads` → type check.
6. **Code and test:** no braces, reversed braces, invalid JSON, nested objects.

</details>

<details>
<summary>💡 Hint 1</summary>

`text.find("{")` gives the first index of `{` (or -1); `text.rfind("}")` gives the last index of `}`.

</details>

<details>
<summary>💡 Hint 2</summary>

Slice from the first `{` to the last `}` **inclusive** (`end + 1`), and handle the cases where either is missing or they're in the wrong order. The fence and any extra text are outside the slice, so they disappear.

</details>

<details>
<summary>💡 Hint 3</summary>

Wrap `json.loads` in `try` / `except json.JSONDecodeError: return None`, then check `isinstance(data, dict)`.

</details>

### 2. Validate a record

Write `validate(record, schema)` returning a **list of problems** (empty if the record is fine). `schema` maps each required field to a Python type: `str`, `int`, `float`, `bool` or `list`. Report, in this order:

1. For each field in the schema (in schema order): `"missing <field>"` if absent, or `"<field> should be <type name>"` if the value has the wrong type.
2. Then for each field in the record that isn't in the schema (in record order): `"unexpected <field>"`.

Two JSON details: a `float` field also accepts an `int` (JSON doesn't distinguish `5` from `5.0`), and `True`/`False` are **not** valid for `int` or `float` fields (in Python, `bool` is a subclass of `int`).

Starter code:

```python
def validate(record, schema):
    pass

schema = {"name": str, "price": float, "in_stock": bool}
print(validate({"name": "Bell", "price": 12, "in_stock": True}, schema))   # []
print(validate({"name": "Bell", "price": "12", "colour": "red"}, schema))
# ['price should be float', 'missing in_stock', 'unexpected colour']
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** collect every problem (don't stop at the first), in a fixed order, with exact messages.
2. **Examples:** `"12"` for price → wrong type; `True` for price → also wrong.
3. **Brute force:** this is already linear; the work is in the edge cases.
4. **Pattern:** **schema-driven validation** with special cases for JSON numbers.
5. **Plan:** loop over the schema (missing → `continue`; type check) → loop over the record for extras.
6. **Code and test:** int for float, bool for int and float, `None`, empty record, extras order.

</details>

<details>
<summary>💡 Hint 1</summary>

Two loops: one over `schema.items()` for missing and wrong-typed fields, then one over `record` for unexpected fields.

</details>

<details>
<summary>💡 Hint 2</summary>

`isinstance(value, kind)` works for most types, but `isinstance(True, int)` is `True`. Handle `int` and `float` specially, excluding `bool`.

</details>

<details>
<summary>💡 Hint 3</summary>

For a `float` field: `isinstance(value, (int, float)) and not isinstance(value, bool)`. A type's name is `kind.__name__`.

</details>

**In the sandbox:** exercises 16–17. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Parse a JSON reply</summary>

```python
import json

def parse_json_reply(text):
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end < start:
        return None
    try:
        data = json.loads(text[start:end + 1])
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None

print(parse_json_reply('Sure! {"name": "Bell", "price": 12.5} Hope that helps.'))
print(parse_json_reply("Sorry, I can't find a product in that text."))
```

**Line by line**

- `find("{")` and `rfind("}")` take the **outermost** braces, so nested objects stay intact and any fence or chatter outside them is dropped.
- `end < start` covers text like `} oops {`, and `start == -1` covers replies with no object at all.
- `json.JSONDecodeError` is what `json.loads` raises on bad input; catching only that keeps real bugs visible.
- The final `isinstance` check makes the function's promise simple: a dict or `None`.

**Trace** on the code-fence case: the first `{` is just after the `json` line, the last `}` just before the closing fence; the slice is `{"ok": true, "n": null}` → `{"ok": True, "n": None}`.

**Complexity:** O(n) for a reply of length n.

**Common wrong approach:** `json.loads(text)` on the raw reply, which crashes whenever the model adds a fence or a friendly sentence. (With guaranteed structured outputs you can parse directly, but defensive parsing is still useful for other providers and older models.)

</details>

<details>
<summary>✅ 2. Validate a record</summary>

```python
def validate(record, schema):
    problems = []
    for field, kind in schema.items():
        if field not in record:
            problems.append(f"missing {field}")
            continue
        value = record[field]
        if kind is float:
            ok = isinstance(value, (int, float)) and not isinstance(value, bool)
        elif kind is int:
            ok = isinstance(value, int) and not isinstance(value, bool)
        else:
            ok = isinstance(value, kind)
        if not ok:
            problems.append(f"{field} should be {kind.__name__}")
    for field in record:
        if field not in schema:
            problems.append(f"unexpected {field}")
    return problems

schema = {"name": str, "price": float, "in_stock": bool}
print(validate({"name": "Bell", "price": 12, "in_stock": True}, schema))
print(validate({"name": "Bell", "price": "12", "colour": "red"}, schema))
```

**Line by line**

- `continue` after "missing" avoids reading a value that isn't there.
- `float` accepts `int` because JSON numbers like `12` parse as Python `int`.
- `not isinstance(value, bool)` is needed because `bool` is a subclass of `int`: without it, `True` would pass as a price of 1.
- The second loop reports fields the schema doesn't know, which often signal a typo in a field name (`"colour"` versus `"color"`).

**Trace** on the second example: name ok; price `"12"` is a str → "price should be float"; in_stock absent → "missing in_stock"; colour isn't in the schema → "unexpected colour".

**Complexity:** O(fields).

**Common wrong approach:** `type(value) == kind`, which rejects `12` for a float field, or plain `isinstance`, which lets `True` through as a number. In real projects, Pydantic handles these rules for you (and can be set to strict mode).

</details>

## Quick quiz

1. What does a guaranteed structured-output feature guarantee?
   - A) Every value in the reply will be factually correct
   - B) The reply will parse and match your schema's structure
   - C) The reply will be shorter

2. Why make a field nullable (or add an "unknown" option)?
   - A) Because JSON requires it
   - B) So the model isn't pushed to invent a value when the information is missing
   - C) To make parsing faster

3. In Python, why can True slip through a check for an int field?
   - A) JSON converts true to 1
   - B) isinstance is broken for numbers
   - C) bool is a subclass of int, so isinstance(True, int) is True

4. Validation fails on a model's JSON. What is a good next step?
   - A) Silently fill in default values
   - B) Send the specific errors back and ask the model to fix its answer, a limited number of times
   - C) Retry the identical request forever

<details>
<summary>Quiz answers</summary>

1. **B) The reply will parse and match your schema's structure**: Format, not correctness: still validate values that matter.
2. **B) So the model isn't pushed to invent a value when the information is missing**: Leaving no way to say "not given" invites made-up answers.
3. **C) bool is a subclass of int, so isinstance(True, int) is True**: Exclude bool explicitly when checking numbers.
4. **B) Send the specific errors back and ask the model to fix its answer, a limited number of times**: Feedback plus a retry limit fixes most cases without endless loops.

</details>

---
Previous: [Lesson 8](08-streaming-and-retries.md) · Next: [Lesson 10: Reasoning, images and documents](10-reasoning-and-multimodal.md)
