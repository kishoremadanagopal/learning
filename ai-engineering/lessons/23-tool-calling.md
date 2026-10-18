# Lesson 23: Tool calling

**You'll learn:** why models need tools, tool definitions with names, descriptions and JSON Schemas, the tool_use and tool_result cycle, stop_reason tool_use, returning errors with is_error, parallel tool calls, tool_choice and its limits on the newest models, strict tools, client tools and server tools, tool token overhead, designing tools a model uses well.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ai-engineering/#tool-calling)**: run every example and check your exercise answers.

## Key terms

- **Tool (function) calling:** the model requesting that your code run a named function with arguments it chooses.
- **Tool definition:** a tool's name, description and JSON Schema for its input.
- **tool_use block:** the part of a reply that names a tool, its arguments and a call id.
- **tool_result block:** your reply to a tool call, matched by `tool_use_id`, with the output or an error.
- **Parallel tool calls:** several tool calls requested in one reply.
- **Client tool:** a tool your application executes.
- **Server tool:** a tool the provider executes, such as web search or code execution.

A model on its own can only produce text. It can't look up today's stock level, check an order, do exact arithmetic on a big spreadsheet or send an email. **Tool calling** (also called **function calling**) lets it **ask your code** to do those things: the model decides which tool to call and with what arguments; your code runs it and sends back the result.

The model never runs anything itself. It writes a structured request; **you** decide whether and how to execute it. That's what makes tools both powerful and controllable.

## Defining a tool

A tool is a name, a description of when to use it, and a JSON Schema for its arguments (Lesson 9):

```python
get_stock = {
    "name": "get_stock",
    "description": "Look up how many units of a product are in stock at one of our shops. "
                   "Use it whenever a customer asks about availability.",
    "input_schema": {
        "type": "object",
        "properties": {
            "sku": {"type": "string", "description": "Product code, e.g. 'TYRE-29-24'"},
            "shop": {"type": "string", "enum": ["bristol", "bath"], "description": "Which shop"},
        },
        "required": ["sku", "shop"],
    },
}
print(get_stock["name"], "requires", get_stock["input_schema"]["required"])
```

The **description is a prompt**: it's how the model decides when the tool applies and what to pass. Say what the tool does, when to use it (and when not), what each argument means with an example, and what comes back.

## The cycle

![A sequence between your app and the model. 1: the app sends the question and the tool definitions. 2: the model replies with stop_reason tool_use and a tool_use block naming get_stock with its arguments. 3: the app runs the real function. 4: the app sends a tool_result block with the same id. 5: the model replies with a final answer using the result](../figures/tool-cycle.svg)

```python
import anthropic

client = anthropic.Anthropic()
messages = [{"role": "user", "content": "Do you have 29 x 2.4 tyres in Bath?"}]
response = client.messages.create(model="claude-sonnet-5-5", max_tokens=1024,
                                  tools=[get_stock], messages=messages)

if response.stop_reason == "tool_use":
    messages.append({"role": "assistant", "content": response.content})   # keep the whole reply
    results = []
    for block in response.content:
        if block.type == "tool_use":
            output = stock_lookup(**block.input)                           # your real code
            results.append({"type": "tool_result", "tool_use_id": block.id, "content": str(output)})
    messages.append({"role": "user", "content": results})
    response = client.messages.create(model="claude-sonnet-5-5", max_tokens=1024,
                                      tools=[get_stock], messages=messages)
print(response.content[-1].text)
```

Points that matter:

- The reply with `stop_reason: "tool_use"` contains one or more `tool_use` blocks, each with an `id`, the tool `name` and the `input` arguments. It may also contain text ("Let me check…") and thinking.
- Append the **whole** assistant reply to the history, unchanged (including thinking blocks), then a **user** message with a `tool_result` for **every** `tool_use`, matched by `tool_use_id`.
- **Errors are results too.** If the tool fails, return a `tool_result` with `"is_error": true` and a helpful message ("No product with code TYRE-29-42; codes look like TYRE-29-24"). The model can then correct itself or explain the problem.
- **Parallel calls:** the model may request several tools in one reply (for example stock in both shops). Run them (concurrently if you like) and return all the results in one message.

## Steering tool use

- `tool_choice` controls whether tools are used: `{"type": "auto"}` (the default: the model decides), `{"type": "none"}`, or forcing a call with `{"type": "any"}` or a named tool. Forcing isn't supported on the newest Claude models (Opus 5.5, Sonnet 5.5, Fable 5.1); use `auto` with clear instructions instead ("Always check stock with get_stock before answering availability questions").
- `"strict": true` on a tool guarantees its arguments match the schema (like structured outputs).
- Newer models follow tool instructions closely; "use get_stock when…" works better than "YOU MUST ALWAYS USE THIS TOOL", which can make them over-use it (Lesson 12).

## Client tools and server tools

| | Runs where | Examples |
|---|---|---|
| **client tools** | in your code | your own functions; Anthropic-defined tools you execute, such as bash, a text editor, computer use and a memory tool |
| **server tools** | on the provider's servers | web search, web fetch, code execution, tool search, remote MCP servers via the MCP connector |

Server tools return their results inside the same response, so there's no loop for you to write. Tools add tokens: their definitions are part of the input, plus a small system prompt that enables tool use (a few hundred tokens).

## Designing good tools

- **Few, clear, high-level tools** beat many tiny ones. `search_orders(customer, status)` is easier to use well than `list_orders` + `filter_orders` + `get_order`.
- **Unambiguous names and arguments:** `user_id`, not `user`; units in the name (`timeout_seconds`).
- **Return what the model needs, compactly:** relevant fields, not a 5,000-line JSON dump. Paginate or summarise large results.
- **Make errors actionable**, as above.
- **Validate everything** the model sends before acting: it's untrusted input (Lesson 16).
- **Test tools with the model:** run realistic tasks and read the transcripts to see where it hesitates or misuses a tool, then improve the descriptions.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Schema from a function | inspect the signature; map type hints; no default means required | O(parameters) | O(parameters) |
| Execute tool calls | dispatch table; one result per call; errors as is_error results | O(calls) | O(calls) |
| One tool round | reply with tool_use → run → tool_result message → call again | — | — |

## Common mistakes

- Vague tool descriptions that don't say when to use the tool.
- Dropping the assistant's tool_use reply or thinking blocks from the history.
- Leaving a tool_use without a tool_result after an error.
- Returning huge raw outputs instead of the fields the model needs.
- Executing tool arguments without validating them.

## Exercises

### 1. A tool schema from a Python function

SDKs (and MCP servers, Lesson 25) build tool definitions from ordinary functions. Write `tool_schema(func)` returning `{"name": …, "description": …, "input_schema": {"type": "object", "properties": {…}, "required": […]}}`:

- `name` is the function's name; `description` is the **first line** of its docstring, stripped (`""` if there's no docstring).
- Each parameter becomes a property `{"type": T}`, where the type hint maps `str` → `"string"`, `int` → `"integer"`, `float` → `"number"`, `bool` → `"boolean"`, `list` → `"array"`, `dict` → `"object"`.
- Parameters **without** a default value are `required`, in signature order.
- A parameter with no type hint, or an unsupported one, raises `TypeError`.

Use `inspect.signature(func).parameters`; each parameter has `.name`, `.annotation` and `.default` (which is `inspect.Parameter.empty` when missing).

Starter code:

```python
import inspect

def tool_schema(func):
    pass

def get_stock(sku: str, shop: str, include_incoming: bool = False) -> int:
    """Look up units in stock at one shop.

    Returns a whole number."""

print(tool_schema(get_stock))
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** introspect the signature and docstring; map types; collect required parameters; reject what can't be described.
2. **Examples:** `include_incoming: bool = False` → `{"type": "boolean"}`, not required.
3. **Brute force:** hand-writing every schema: works, but drifts out of sync with the code.
4. **Pattern:** **reflection**: generate the description of code from the code itself.
5. **Plan:** loop over parameters → check hint → property → required? → docstring → assemble.
6. **Code and test:** defaults, no parameters, no docstring, missing and unsupported hints.

</details>

<details>
<summary>💡 Hint 1</summary>

`inspect.signature(func).parameters.values()` gives the parameters in order; each has `.name`, `.annotation` and `.default`.

</details>

<details>
<summary>💡 Hint 2</summary>

A dict from Python type to JSON type does the mapping. A missing hint shows up as `inspect.Parameter.empty`, which isn't in your dict, so one check covers both error cases.

</details>

<details>
<summary>💡 Hint 3</summary>

Required means `param.default is inspect.Parameter.empty`. For the description, `inspect.getdoc(func)` cleans up the docstring's indentation; take the first line.

</details>

### 2. Run the requested tools

Write `run_tool_calls(content, registry)`. `content` is an assistant reply's list of blocks; `registry` maps tool names to Python functions. For **each** `tool_use` block, in order, return a `tool_result` block:

- `{"type": "tool_result", "tool_use_id": <the block's id>, "content": str(result), "is_error": False}` after calling the function with the block's `input` as keyword arguments;
- if the tool name isn't in the registry: `"content": "Unknown tool: <name>"` and `"is_error": True`;
- if the function raises an exception `e`: `"content": f"{type(e).__name__}: {e}"` and `"is_error": True`.

Ignore other block types. One failing tool must not stop the others.

Starter code:

```python
def run_tool_calls(content, registry):
    pass

def get_stock(sku, shop):
    return {"TYRE-29-24": {"bath": 6, "bristol": 0}}[sku][shop]

reply = [{"type": "text", "text": "Let me check both shops."},
         {"type": "tool_use", "id": "t1", "name": "get_stock", "input": {"sku": "TYRE-29-24", "shop": "bath"}},
         {"type": "tool_use", "id": "t2", "name": "get_stock", "input": {"sku": "TYRE-29-42", "shop": "bath"}}]
for result in run_tool_calls(reply, {"get_stock": get_stock}):
    print(result)
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** one result per call, in order, matched by id; failures become error results, never crashes.
2. **Examples:** an unknown SKU raises `KeyError: 'TYRE-29-42'` → an error result the model can read.
3. **Brute force:** this is already direct.
4. **Pattern:** **dispatch table** plus **error isolation**.
5. **Plan:** filter blocks → look up → call in try → build the result → append.
6. **Code and test:** unknown tools, exceptions, wrong arguments, non-string results, no calls.

</details>

<details>
<summary>💡 Hint 1</summary>

Loop over the blocks and skip everything whose `"type"` isn't `"tool_use"`. Each tool call produces exactly one result, with the same id.

</details>

<details>
<summary>💡 Hint 2</summary>

`registry.get(name)` returns `None` for an unknown tool. `func(**block["input"])` passes the arguments by name.

</details>

<details>
<summary>💡 Hint 3</summary>

Wrap the call in `try` / `except Exception as e` and report `f"{type(e).__name__}: {e}"` with `"is_error": True`.

</details>

**In the sandbox:** exercises 44–45. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. A tool schema from a Python function</summary>

```python
import inspect

JSON_TYPES = {str: "string", int: "integer", float: "number", bool: "boolean", list: "array", dict: "object"}

def tool_schema(func):
    properties, required = {}, []
    for param in inspect.signature(func).parameters.values():
        if param.annotation not in JSON_TYPES:
            raise TypeError(f"parameter {param.name!r} needs a str, int, float, bool, list or dict type hint")
        properties[param.name] = {"type": JSON_TYPES[param.annotation]}
        if param.default is inspect.Parameter.empty:
            required.append(param.name)
    doc = inspect.getdoc(func) or ""
    return {
        "name": func.__name__,
        "description": doc.splitlines()[0].strip() if doc else "",
        "input_schema": {"type": "object", "properties": properties, "required": required},
    }

def get_stock(sku: str, shop: str, include_incoming: bool = False) -> int:
    """Look up units in stock at one shop.

    Returns a whole number."""

print(tool_schema(get_stock))
```

**Line by line**

- `param.annotation not in JSON_TYPES` rejects both a missing hint (`inspect.Parameter.empty`) and types JSON can't express directly.
- Dicts keep insertion order, so properties come out in signature order.
- `inspect.getdoc` removes the docstring's indentation; `splitlines()[0]` keeps the summary line, which is what a tool description needs.
- The `-> int` return hint is ignored: a tool's schema describes its **inputs**.

**Trace** for `quote`: `items: list` → array, required; `discount: float = 0.0` → number; `notes: dict = None` → object; the docstring's first line, stripped, is "Price a list of items.".

**Complexity:** O(parameters).

**Common wrong approach:** relying on the docstring alone. A one-line summary rarely tells the model enough; real tools need per-argument descriptions and examples, which libraries such as Pydantic and the MCP SDK let you add.

</details>

<details>
<summary>✅ 2. Run the requested tools</summary>

```python
def run_tool_calls(content, registry):
    results = []
    for block in content:
        if block["type"] != "tool_use":
            continue
        result = {"type": "tool_result", "tool_use_id": block["id"], "is_error": False}
        func = registry.get(block["name"])
        if func is None:
            result.update(content=f"Unknown tool: {block['name']}", is_error=True)
        else:
            try:
                result["content"] = str(func(**block["input"]))
            except Exception as e:                         # report the failure to the model
                result.update(content=f"{type(e).__name__}: {e}", is_error=True)
        results.append(result)
    return results

def get_stock(sku, shop):
    return {"TYRE-29-24": {"bath": 6, "bristol": 0}}[sku][shop]

reply = [{"type": "text", "text": "Let me check both shops."},
         {"type": "tool_use", "id": "t1", "name": "get_stock", "input": {"sku": "TYRE-29-24", "shop": "bath"}},
         {"type": "tool_use", "id": "t2", "name": "get_stock", "input": {"sku": "TYRE-29-42", "shop": "bath"}}]
for result in run_tool_calls(reply, {"get_stock": get_stock}):
    print(result)
```

**Line by line**

- Skipping text and thinking blocks leaves only the calls to execute.
- `registry.get` avoids a `KeyError` of your own for unknown tool names, which a model can produce.
- Catching `Exception` per call means one bad call can't prevent the other results from being returned; the API needs a result for **every** `tool_use` id.
- `str(...)` turns numbers and dicts into text; real tools often return JSON text instead.

**Trace** on the starter: t1 → `get_stock(sku="TYRE-29-24", shop="bath")` → "6"; t2 → `KeyError` → "KeyError: 'TYRE-29-42'" with `is_error: True`.

**Complexity:** O(calls), plus the tools' own work.

**Common wrong approach:** letting an exception propagate (the conversation is left with a `tool_use` and no result, which the API rejects), or returning raw stack traces full of internal details. Keep error messages short, actionable and free of secrets.

</details>

## Quick quiz

1. Who executes a client tool that the model calls?
   - A) Your application; the model only requests the call with arguments
   - B) The model runs the code itself
   - C) The user's browser

2. A tool raises an error. What should you send back?
   - A) The full stack trace with environment variables
   - B) Nothing; just call the model again
   - C) A tool_result with is_error true and a helpful message

3. Why does a tool's description matter so much?
   - A) The model uses it to decide when to call the tool and what arguments to pass
   - B) It sets the tool's timeout
   - C) It's shown to users

4. On the newest Claude models, how do you make the model call a tool when it should?
   - A) Raise the temperature
   - B) Set tool_choice to any
   - C) Use tool_choice auto with clear instructions on when to use the tool

<details>
<summary>Quiz answers</summary>

1. **A) Your application; the model only requests the call with arguments**: You stay in control of what actually runs.
2. **C) A tool_result with is_error true and a helpful message**: The model can correct its call or explain the problem.
3. **A) The model uses it to decide when to call the tool and what arguments to pass**: Descriptions are prompts.
4. **C) Use tool_choice auto with clear instructions on when to use the tool**: Forced tool choice isn't supported on Opus 5.5, Sonnet 5.5 and Fable 5.1.

</details>

---
Previous: [Lesson 22](22-evaluating-rag.md) · Next: [Lesson 24: The agent loop](24-agent-loop.md)
