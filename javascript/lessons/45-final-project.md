# Lesson 45: Final project: a typed shopping assistant

**You'll learn:** the shopping assistant's design, types for messages, blocks and tools, a JSON Schema validator (type, properties, required, additionalProperties, items, enum, minimum, maximum, minLength), validation errors as tool results, tool implementations calling the shop API, an assistant that keeps its history between questions, testing against a deterministic simulated model, evaluating real models, turning the project into a portfolio piece.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#final-project)**: run every example and check your exercise answers.

## Key terms

- **JSON Schema validation:** checking that a value has the types and constraints a schema describes.
- **Conversation state:** the history an assistant keeps and sends with each request.
- **Deterministic:** giving the same output every time for the same input, which makes testing exact.
- **Evaluation (eval):** measuring a model-based system's answers on a set of example questions.

This is the last lesson: everything comes together in one small, realistic program. The shopping assistant answers questions about products, places orders, asks for missing details, and recovers when the model makes a mistake. It uses:

| From | What |
|---|---|
| Part 2 and Part 6 | JSON, and TypeScript types for every message and block |
| Part 4 | `fetch` calls to the shop API and the model API |
| Lesson 35 | validating outside data before using it |
| Lessons 43 and 44 | the Messages API, tools and the agent loop |
| Lesson 39 | tests you can rerun after every change |

## The plan

```text
user ──ask()──▶ history ──▶ model ──tool_use──▶ validate input ──ok──▶ run tool (shop API)
                   ▲                                 │ invalid                │
                   │                                 ▼                        ▼
                   └──────────── tool_result (is_error when something failed) ┘
```

1. **Types** for messages, blocks and tool definitions.
2. **Tools** the model may use: `search_products` and `place_order`, each with a JSON Schema.
3. A **validator** that checks the model's input against the schema (the first exercise).
4. **Implementations** that call the shop API.
5. An **assistant** that keeps the conversation, runs the agent loop and turns every failure into a `tool_result` (the second exercise).

## Validating the model's input

Models usually produce valid input, but not always. The simulated model has one deliberate habit to show why validation matters: asked to order "a dozen" of something, its first `place_order` call sends `"qty": "12"`, a string, where the schema says integer. Without validation, that string goes to the shop API. With validation, your code replies with an error result, the model reads it, and it tries again with `12`:

```ts
const schema = { type: "integer", minimum: 1 } as const;
const fromModel: unknown = JSON.parse('{"qty": "12"}').qty;

function checkQty(value: unknown): string[] {
  if (!Number.isInteger(value)) return ["qty: must be an integer"];
  if ((value as number) < schema.minimum) return [`qty: must be at least ${schema.minimum}`];
  return [];
}
console.log(checkQty(fromModel), checkQty(12), checkQty(0));
```

The first exercise generalises this into a validator for a useful part of JSON Schema, the same subset that tool definitions typically use.

## Tools that act need limits

`place_order` has a side effect. In this project the shop API itself refuses impossible orders (unknown products, too little stock), and the tool's schema limits the quantity. In a real assistant you'd add a confirmation step before ordering (Lesson 44), so the model can prepare an order but only the user can place it.

## Remembering the conversation

The assistant keeps `messages` between calls to `ask`, so a follow-up works:

```text
you:       Please order a dozen inner tubes
assistant: Sure! What name should I put the order under?
you:       Ada
assistant: Done! Order 1002 is placed: 12 × Inner tube, £72.00 in total.
```

The model knows what "Ada" is for only because the earlier turns are in the history it receives.

## Testing it

The same `test` and `assert` from Lesson 39 test the whole assistant against the simulated model, which always answers the same way: that's how the second exercise is checked. With a real model, answers vary from run to run, so teams test the deterministic parts exactly (validation, tools, the loop) and evaluate the model's answers with sets of example questions and scoring, which the AI Engineering course covers in depth.

## From here to a portfolio project

- **A real model:** replace `llm.example` with the provider's URL and model name (or the SDK) and read the key from the environment, on a server.
- **A server:** put `ask` behind a `POST /api/chat` handler (Lesson 40), with a session id per user to keep their history.
- **A page:** a chat box that streams the reply as it's generated (Lessons 30 and 43).
- **Production habits:** a step limit, validation, logs of every tool call, confirmation before orders, tests in CI.

Describe it on your CV the way you'd explain it in an interview: what it does, the agent loop, how it handles invalid model output, and how you tested it.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Check model input | recursive validate(schema, value, path) | O(size of value) | O(depth + errors) |
| Remember a conversation | closure holding messages, appended by each ask | O(history) per question | O(history) |
| Recover from bad input | validation errors as is_error tool results; the model retries | O(retries) | O(1) |

## Common mistakes

- Running a tool with model input that hasn't been validated.
- Reporting only the first validation error.
- Starting a new history for every question, so follow-ups lose their context.
- Testing a real model's wording exactly instead of testing the deterministic parts and evaluating the rest.
- Shipping without a step limit, logging or confirmation for orders.

## Exercises

### 1. Validate tool input

Write `validate(schema, value, path = "")` for this subset of JSON Schema, returning an array of error messages (empty when the value is valid):

- `type`: `"object"`, `"array"`, `"string"`, `"integer"` (a whole number), `"number"` (a finite number) or `"boolean"`. A wrong type gives one error, `<path>: must be <a/an> <type>` (`an object`, `an array`, `a string`, `an integer`, `a number`, `a boolean`), and nothing else is checked for that value;
- objects: each `required` key that's missing → `<path>: is required` (in the order listed); then each key in `properties` that's present is validated; with `additionalProperties: false`, each other key → `<path>: is not allowed`;
- arrays: each item is validated against `items`, with the path `<path>[<index>]`;
- `enum` → `<path>: must be one of "a", "b"` (each value as JSON, joined by `, `); `minimum` / `maximum` → `must be at least N` / `must be at most N`; `minLength` → `must be at least N characters`.

Paths join with `.` (`items[0].qty`); the top level is called `value`.

Starter code:

```ts
type Schema = {
  type: "object" | "array" | "string" | "integer" | "number" | "boolean";
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: Schema;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
};

function validate(schema: Schema, value: unknown, path = ""): string[] {
  return [];
}

const orderSchema: Schema = {
  type: "object",
  properties: {
    customer: { type: "string", minLength: 1 },
    productId: { type: "integer" },
    qty: { type: "integer", minimum: 1, maximum: 20 },
  },
  required: ["customer", "productId", "qty"],
  additionalProperties: false,
};
console.log(validate(orderSchema, { customer: "Ada", productId: 1, qty: "12" }));   // [ 'qty: must be an integer' ]
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a recursive check that reports every problem with its location.
2. **Examples:** `{}` against the order schema → three "is required"; `[{qty:0}]` → `items[0].qty: must be at least 1`.
3. **Brute force:** hand-written checks for one schema: works once, and must be rewritten for every tool.
4. **Pattern:** **recursion over the schema**, carrying the path.
5. **Plan:** type check → object rules → array items → enum → number bounds → string length → return all errors.
6. **Code and test:** the starter's call should print exactly one error.

</details>

<details>
<summary>💡 Hint 1</summary>

Start with the type: write `hasType(type, value)` with one case per type (remember `typeof null === "object"`, arrays are objects, and `Number.isInteger` / `Number.isFinite` for numbers). If it fails, return the single type error straight away.

</details>

<details>
<summary>💡 Hint 2</summary>

The path for messages is `path || "value"`; a child's path is `path ? \`${path}.${key}\` : key`, and an array item's is `\`${path}[${i}]\``. Recurse with `validate(subSchema, childValue, childPath)` and spread the result into your errors.

</details>

<details>
<summary>💡 Hint 3</summary>

For objects, check in this order: `required` (missing keys), `properties` (only the keys that are present), then `additionalProperties: false`. Then the checks that apply to any value: `enum`, `minimum`/`maximum` for numbers, `minLength` for strings.

</details>

### 2. The shopping assistant

Write `createAssistant()`. It returns `{ messages, ask }`, where `messages` is the conversation history (an array that grows with each question) and `ask(text)` adds the user's text to the history, runs the agent loop (at most 6 model calls) and returns the reply's text. For each `tool_use` block:

- unknown tool → error result `Unknown tool: <name>`;
- input that fails `validate` against the tool's `input_schema` → error result with the errors joined by `; ` (for example `qty: must be an integer`), **without** running the tool;
- otherwise run the tool's implementation and send its result; if it throws, send an error result with the message.

The types, the model call, the tools with their schemas and implementations, and a working `validate` are provided.

Starter code:

```ts
type Schema = {
  type: "object" | "array" | "string" | "integer" | "number" | "boolean";
  properties?: Record<string, Schema>; required?: string[]; additionalProperties?: boolean;
  items?: Schema; enum?: unknown[]; minimum?: number; maximum?: number; minLength?: number;
};
type Block =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };
type ToolUse = Extract<Block, { type: "tool_use" }>;
type ToolResult = Extract<Block, { type: "tool_result" }>;
type Message = { role: "user" | "assistant"; content: string | Block[] };
type Tool = { name: string; description: string; input_schema: Schema; run: (input: Record<string, unknown>) => Promise<unknown> };

const SHOP = "https://shop.example/api";

const TOOLS: Tool[] = [
  {
    name: "search_products",
    description: "Search the bike shop's products by words in their name and/or a maximum price in pence.",
    input_schema: { type: "object", properties: { query: { type: "string" }, maxPrice: { type: "integer", minimum: 0 } }, additionalProperties: false },
    async run(input) {
      const url = new URL(`${SHOP}/products`);
      if (typeof input.query === "string") url.searchParams.set("q", input.query);
      if (typeof input.maxPrice === "number") url.searchParams.set("maxPrice", String(input.maxPrice));
      return (await fetch(url)).json();
    },
  },
  {
    name: "place_order",
    description: "Place an order for one product. Only call this when the customer has asked to buy and given their name.",
    input_schema: {
      type: "object",
      properties: { customer: { type: "string", minLength: 1 }, productId: { type: "integer" }, qty: { type: "integer", minimum: 1, maximum: 20 } },
      required: ["customer", "productId", "qty"],
      additionalProperties: false,
    },
    async run(input) {
      const res = await fetch(`${SHOP}/orders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ customer: input.customer, items: [{ productId: input.productId, qty: input.qty }] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data;
    },
  },
];

async function callModel(messages: Message[]): Promise<{ content: Block[]; stop_reason: string }> {
  const res = await fetch("https://llm.example/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": "sk-sim-course" },
    body: JSON.stringify({
      model: "sim-1",
      max_tokens: 1000,
      system: "You are the bike shop's assistant. Use the tools for prices, stock and orders.",
      tools: TOOLS.map(({ name, description, input_schema }) => ({ name, description, input_schema })),
      messages,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${res.status}: ${data.error.message}`);
  return data;
}

function validate(schema: Schema, value: unknown, path = ""): string[] {
  const at = path || "value";
  const ok = schema.type === "object" ? typeof value === "object" && value !== null && !Array.isArray(value)
    : schema.type === "array" ? Array.isArray(value) : schema.type === "integer" ? Number.isInteger(value)
    : schema.type === "number" ? typeof value === "number" && Number.isFinite(value) : typeof value === schema.type;
  if (!ok) return [`${at}: must be ${/^[aeiou]/.test(schema.type) ? "an" : "a"} ${schema.type}`];
  const errors: string[] = [];
  const join = (k: string) => (path ? `${path}.${k}` : k);
  if (schema.type === "object") {
    const obj = value as Record<string, unknown>;
    for (const k of schema.required ?? []) if (!Object.hasOwn(obj, k)) errors.push(`${join(k)}: is required`);
    for (const [k, s] of Object.entries(schema.properties ?? {})) if (Object.hasOwn(obj, k)) errors.push(...validate(s, obj[k], join(k)));
    if (schema.additionalProperties === false) for (const k of Object.keys(obj)) if (!Object.hasOwn(schema.properties ?? {}, k)) errors.push(`${join(k)}: is not allowed`);
  }
  if (schema.type === "array" && schema.items) (value as unknown[]).forEach((x, i) => errors.push(...validate(schema.items!, x, `${path}[${i}]`)));
  if (schema.enum && !schema.enum.some((o) => Object.is(o, value))) errors.push(`${at}: must be one of ${schema.enum.map((o) => JSON.stringify(o)).join(", ")}`);
  if (typeof value === "number" && schema.minimum !== undefined && value < schema.minimum) errors.push(`${at}: must be at least ${schema.minimum}`);
  if (typeof value === "number" && schema.maximum !== undefined && value > schema.maximum) errors.push(`${at}: must be at most ${schema.maximum}`);
  if (typeof value === "string" && schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${at}: must be at least ${schema.minLength} characters`);
  return errors;
}

function createAssistant() {
  // your code here
}

const assistant = createAssistant();
for (const question of ["How much is the bell?", "Please order a dozen inner tubes", "Ada"]) {
  console.log("you:      ", question);
  console.log("assistant:", await assistant.ask(question));
}
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** the Lesson 44 loop, plus validation before running tools, plus a history that lives across questions.
2. **Examples:** "Ada" on its own means nothing, unless the history shows the assistant just asked for a name.
3. **Brute force:** a new history per `ask`: the order follow-up breaks, because the model never sees the earlier request.
4. **Pattern:** **a closure holding state** (the history) **and the agent loop**, with **validation at the boundary**.
5. **Plan:** messages array → runTool (find, validate, run, catch) → ask (push text, loop, return text) → return both.
6. **Code and test:** run the starter's three-question conversation and read the history.

</details>

<details>
<summary>💡 Hint 1</summary>

Inside `createAssistant`, create `const messages: Message[] = []` and define `ask` (and a `runTool` helper) as inner functions, then `return { messages, ask }`. Each call to `createAssistant` gets its own history: a closure again.

</details>

<details>
<summary>💡 Hint 2</summary>

`runTool(call)`: find the tool by name; `const errors = validate(tool.input_schema, call.input)`; if there are errors, return an error result with `errors.join("; ")` **without** calling `run`; otherwise `await tool.run(call.input)` inside `try`/`catch`, like Lesson 44's `runTool`.

</details>

<details>
<summary>💡 Hint 3</summary>

`ask(text)` pushes `{ role: "user", content: text }`, then runs the agent loop from Lesson 44 on the shared `messages`, with at most 6 model calls.

</details>

**In the sandbox:** exercises 89–90. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Validate tool input</summary>

```ts
type Schema = {
  type: "object" | "array" | "string" | "integer" | "number" | "boolean";
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: Schema;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
};

const NAMES = { object: "an object", array: "an array", string: "a string", integer: "an integer", number: "a number", boolean: "a boolean" };

function hasType(type: Schema["type"], value: unknown): boolean {
  switch (type) {
    case "object": return typeof value === "object" && value !== null && !Array.isArray(value);
    case "array": return Array.isArray(value);
    case "string": return typeof value === "string";
    case "integer": return Number.isInteger(value);
    case "number": return typeof value === "number" && Number.isFinite(value);
    case "boolean": return typeof value === "boolean";
  }
}

function validate(schema: Schema, value: unknown, path = ""): string[] {
  const at = path || "value";
  if (!hasType(schema.type, value)) return [`${at}: must be ${NAMES[schema.type]}`];
  const errors: string[] = [];
  const join = (key: string) => (path ? `${path}.${key}` : key);

  if (schema.type === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(obj, key)) errors.push(`${join(key)}: is required`);
    }
    for (const [key, sub] of Object.entries(schema.properties ?? {})) {
      if (Object.hasOwn(obj, key)) errors.push(...validate(sub, obj[key], join(key)));
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(obj)) {
        if (!Object.hasOwn(schema.properties ?? {}, key)) errors.push(`${join(key)}: is not allowed`);
      }
    }
  }
  if (schema.type === "array" && schema.items) {
    const items = schema.items;
    (value as unknown[]).forEach((item, i) => errors.push(...validate(items, item, `${path}[${i}]`)));
  }
  if (schema.enum && !schema.enum.some((option) => Object.is(option, value))) {
    errors.push(`${at}: must be one of ${schema.enum.map((option) => JSON.stringify(option)).join(", ")}`);
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${at}: must be at least ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${at}: must be at most ${schema.maximum}`);
  }
  if (typeof value === "string" && schema.minLength !== undefined && value.length < schema.minLength) {
    errors.push(`${at}: must be at least ${schema.minLength} characters`);
  }
  return errors;
}

const orderSchema: Schema = {
  type: "object",
  properties: {
    customer: { type: "string", minLength: 1 },
    productId: { type: "integer" },
    qty: { type: "integer", minimum: 1, maximum: 20 },
  },
  required: ["customer", "productId", "qty"],
  additionalProperties: false,
};
console.log(validate(orderSchema, { customer: "Ada", productId: 1, qty: "12" }));
```

**Line by line**

- `hasType` is a `switch` over the type union; TypeScript knows every case returns, so no default is needed.
- A wrong type returns immediately: "qty: must be an integer" is more useful than also complaining that a string isn't at least 1.
- `join(key)` builds `customer` at the top level and `a.b` deeper; array items get `[i]` appended.
- Required keys are checked with `Object.hasOwn`, so a key present with the value `undefined` still counts as present, as in JSON Schema.
- Properties are validated only when present: an optional, missing property is fine.
- `enum` uses `Object.is` for exact matches; the message shows each option as JSON so strings appear in quotes.
- The `typeof value === "number"` and `"string"` guards make the bounds checks type-safe.

**Trace:** `{ customer: "", productId: 1, qty: 0, colour: "red" }` → object ok → required all present → customer: minLength → error → productId ok → qty: minimum → error → colour not in properties → error.

**Common wrong approach:** returning on the first error: the model then fixes one problem per round trip, wasting steps; reporting every error lets it fix them all at once.

</details>

<details>
<summary>✅ 2. The shopping assistant</summary>

```ts
type Schema = {
  type: "object" | "array" | "string" | "integer" | "number" | "boolean";
  properties?: Record<string, Schema>; required?: string[]; additionalProperties?: boolean;
  items?: Schema; enum?: unknown[]; minimum?: number; maximum?: number; minLength?: number;
};
type Block =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };
type ToolUse = Extract<Block, { type: "tool_use" }>;
type ToolResult = Extract<Block, { type: "tool_result" }>;
type Message = { role: "user" | "assistant"; content: string | Block[] };
type Tool = { name: string; description: string; input_schema: Schema; run: (input: Record<string, unknown>) => Promise<unknown> };

const SHOP = "https://shop.example/api";

const TOOLS: Tool[] = [
  {
    name: "search_products",
    description: "Search the bike shop's products by words in their name and/or a maximum price in pence.",
    input_schema: { type: "object", properties: { query: { type: "string" }, maxPrice: { type: "integer", minimum: 0 } }, additionalProperties: false },
    async run(input) {
      const url = new URL(`${SHOP}/products`);
      if (typeof input.query === "string") url.searchParams.set("q", input.query);
      if (typeof input.maxPrice === "number") url.searchParams.set("maxPrice", String(input.maxPrice));
      return (await fetch(url)).json();
    },
  },
  {
    name: "place_order",
    description: "Place an order for one product. Only call this when the customer has asked to buy and given their name.",
    input_schema: {
      type: "object",
      properties: { customer: { type: "string", minLength: 1 }, productId: { type: "integer" }, qty: { type: "integer", minimum: 1, maximum: 20 } },
      required: ["customer", "productId", "qty"],
      additionalProperties: false,
    },
    async run(input) {
      const res = await fetch(`${SHOP}/orders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ customer: input.customer, items: [{ productId: input.productId, qty: input.qty }] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data;
    },
  },
];

async function callModel(messages: Message[]): Promise<{ content: Block[]; stop_reason: string }> {
  const res = await fetch("https://llm.example/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": "sk-sim-course" },
    body: JSON.stringify({
      model: "sim-1",
      max_tokens: 1000,
      system: "You are the bike shop's assistant. Use the tools for prices, stock and orders.",
      tools: TOOLS.map(({ name, description, input_schema }) => ({ name, description, input_schema })),
      messages,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${res.status}: ${data.error.message}`);
  return data;
}

function validate(schema: Schema, value: unknown, path = ""): string[] {
  const at = path || "value";
  const ok = schema.type === "object" ? typeof value === "object" && value !== null && !Array.isArray(value)
    : schema.type === "array" ? Array.isArray(value) : schema.type === "integer" ? Number.isInteger(value)
    : schema.type === "number" ? typeof value === "number" && Number.isFinite(value) : typeof value === schema.type;
  if (!ok) return [`${at}: must be ${/^[aeiou]/.test(schema.type) ? "an" : "a"} ${schema.type}`];
  const errors: string[] = [];
  const join = (k: string) => (path ? `${path}.${k}` : k);
  if (schema.type === "object") {
    const obj = value as Record<string, unknown>;
    for (const k of schema.required ?? []) if (!Object.hasOwn(obj, k)) errors.push(`${join(k)}: is required`);
    for (const [k, s] of Object.entries(schema.properties ?? {})) if (Object.hasOwn(obj, k)) errors.push(...validate(s, obj[k], join(k)));
    if (schema.additionalProperties === false) for (const k of Object.keys(obj)) if (!Object.hasOwn(schema.properties ?? {}, k)) errors.push(`${join(k)}: is not allowed`);
  }
  if (schema.type === "array" && schema.items) (value as unknown[]).forEach((x, i) => errors.push(...validate(schema.items!, x, `${path}[${i}]`)));
  if (schema.enum && !schema.enum.some((o) => Object.is(o, value))) errors.push(`${at}: must be one of ${schema.enum.map((o) => JSON.stringify(o)).join(", ")}`);
  if (typeof value === "number" && schema.minimum !== undefined && value < schema.minimum) errors.push(`${at}: must be at least ${schema.minimum}`);
  if (typeof value === "number" && schema.maximum !== undefined && value > schema.maximum) errors.push(`${at}: must be at most ${schema.maximum}`);
  if (typeof value === "string" && schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${at}: must be at least ${schema.minLength} characters`);
  return errors;
}

function createAssistant() {
  const messages: Message[] = [];
  const MAX_STEPS = 6;

  async function runTool(call: ToolUse): Promise<ToolResult> {
    const fail = (content: string): ToolResult => ({ type: "tool_result", tool_use_id: call.id, content, is_error: true });
    const tool = TOOLS.find((t) => t.name === call.name);
    if (!tool) return fail(`Unknown tool: ${call.name}`);
    const errors = validate(tool.input_schema, call.input);
    if (errors.length) return fail(errors.join("; "));
    try {
      const result = await tool.run(call.input);
      return { type: "tool_result", tool_use_id: call.id, content: JSON.stringify(result) ?? "null" };
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  }

  async function ask(text: string): Promise<string> {
    messages.push({ role: "user", content: text });
    for (let step = 0; step < MAX_STEPS; step++) {
      const reply = await callModel(messages);
      messages.push({ role: "assistant", content: reply.content });
      if (reply.stop_reason !== "tool_use") {
        return reply.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      }
      const results: ToolResult[] = [];
      for (const block of reply.content) {
        if (block.type === "tool_use") results.push(await runTool(block));
      }
      messages.push({ role: "user", content: results });
    }
    throw new Error("Too many steps");
  }

  return { messages, ask };
}

const assistant = createAssistant();
for (const question of ["How much is the bell?", "Please order a dozen inner tubes", "Ada"]) {
  console.log("you:      ", question);
  console.log("assistant:", await assistant.ask(question));
}
```

**Line by line**

- `messages` lives in `createAssistant`'s scope, so it persists between `ask` calls, and each assistant has its own.
- `runTool` refuses unknown tools, then validates: the dozen order's first call has `qty: "12"`, so `validate` returns `["qty: must be an integer"]` and the tool never runs.
- The model reads the error result, fixes the type and calls `place_order` again with `12`; the order goes through.
- Errors from the shop API itself (thrown by `run`) also become error results, so the conversation always stays valid.
- `ask` appends the user's text and loops exactly like `runAgent`, but on the shared history; returning `messages` lets callers (and tests) inspect the conversation.

**Trace:** "Please order a dozen inner tubes" → search tube → the model asks for a name (end of that `ask`). "Ada" → place_order with "12" → validation error → place_order with 12 → order 1002 → "Done! Order 1002 is placed: 12 × Inner tube, £72.00 in total."

**Common wrong approach:** sending the shop API's error instead of validating: the order happens to fail safely here, but with a less forgiving API a string or a missing field can do the wrong thing. Validate model output before acting on it, every time.

</details>

## Quick quiz

1. Why validate the model's tool input against the schema yourself?
   - A) Model output is outside data and can break the schema, so check it before acting
   - B) The API never checks anything
   - C) Validation makes the model faster

2. How does the assistant understand the answer "Ada" to its question?
   - A) The history sent with the request contains the earlier turns
   - B) The model remembers the earlier request on its servers
   - C) The tool remembers it

3. Why do validation errors list every problem instead of the first one?
   - A) So the model can fix everything in one more call
   - B) Because JSON Schema requires it
   - C) It makes the error shorter

4. What should change before this assistant goes live with a real model?
   - A) The key moves to a server, orders need the user's confirmation, and calls are logged
   - B) Nothing; it's ready
   - C) Remove the step limit

<details>
<summary>Quiz answers</summary>

1. **A) Model output is outside data and can break the schema, so check it before acting**: Send problems back as is_error results; the model can fix them.
2. **A) The history sent with the request contains the earlier turns**: The API is stateless; your code keeps and sends the history.
3. **A) So the model can fix everything in one more call**: Each round trip costs time and tokens.
4. **A) The key moves to a server, orders need the user's confirmation, and calls are logged**: Real models and real orders need these safeguards.

</details>

---
Previous: [Lesson 44](44-tools-and-agents.md) · Back to the [course home](../README.md)
