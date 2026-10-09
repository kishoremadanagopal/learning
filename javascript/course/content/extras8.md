@@ scope-closures-this
topics: var, let and const, hoisting, the temporal dead zone, closures, the loop-and-closure puzzle, private state with closures, the four rules for this, arrow functions and this, call, apply and bind, losing this in callbacks, prototypes and the prototype chain, what new does, == versus ===, typeof null and NaN, explaining answers in interviews
terms:
- **Hoisting:** declarations being processed before the code runs, so names exist in their whole scope.
- **Temporal dead zone (TDZ):** the part of a scope before a `let` or `const` line, where using the name throws.
- **Closure:** a function together with the variables it captured from the scope where it was created.
- **`this`:** the object a function is called on, decided by how the function is called.
- **`call` / `apply` / `bind`:** call a function with a chosen `this` (arguments listed / as an array), or make a new function with `this` fixed.
- **Prototype:** the object another object falls back to for properties it doesn't have itself.
- **Prototype chain:** the series of prototypes JavaScript searches when looking up a property.
- **Memoization:** remembering a function's results for arguments it has already seen.
mistakes:
- Passing a method as a callback and losing its `this`.
- Using a regular `function` callback inside a method and expecting the method's `this`.
- Creating closures in a `var` loop and expecting each to see a different value.
- Relying on `==` coercion rules instead of using `===`.
- Answering "what does this log?" without explaining why.

glance:
- Private state | closure over variables in a factory function | O(1) | O(state)
- Fix this for a callback | arrow function or fn.bind(obj) | O(1) | O(1)
- Cache results | memoize with a Map keyed by the arguments | O(1) per repeated call | O(distinct calls)

@@ interview-coding
topics: the six-step approach out loud, clarifying questions, stating complexity, common JavaScript interview tasks (debounce, throttle, Promise.all, memoize, bind, curry, deep clone, deep equality, flatten), structuredClone and flat, event-loop output puzzles, implementing an event emitter, an LRU cache with a Map, practising under interview conditions
terms:
- **Time complexity:** how an algorithm's running time grows with the input size, in big-O notation.
- **Space complexity:** how much extra memory an algorithm needs as the input grows.
- **Currying:** turning a function of several arguments into a chain of functions that each take some of them.
- **Deep equality:** comparing two values by their contents, recursively, rather than by identity.
- **Event emitter:** an object that lets code subscribe to named events and be called when they're emitted.
- **LRU cache:** a fixed-size cache that evicts the least recently used entry when it's full.
mistakes:
- Starting to code before clarifying the problem and its edge cases.
- Staying silent instead of explaining the approach as you go.
- Mutating a collection while iterating over it.
- Forgetting to state, or to check, the time and space complexity.
- Not testing the solution with the examples, including an edge case.

glance:
- Event emitter | Map of event → array of listeners; emit over a copy | O(listeners) per emit | O(listeners)
- LRU cache | Map insertion order; delete + set to mark use; evict first key | O(1) per get/set | O(capacity)
- Flatten | recursion or arr.flat(Infinity) | O(total items) | O(total items)

@@ llm-api
topics: chat model APIs, the simulated Messages API, model, max_tokens, system prompts and messages, content blocks, stop reasons, token usage and cost, the official TypeScript SDK, stateless conversations and history, error types and status codes, retrying 429 and 529 with backoff and retry-after, streaming with server-sent events, buffering and parsing a stream, TextDecoder with stream mode, asking for JSON and parsing it defensively, structured outputs, keeping API keys on a server
terms:
- **LLM (large language model):** a model that generates text, used through an API.
- **Token:** the unit models read and write, roughly 4 characters of English; usage and prices are counted in tokens.
- **`max_tokens`:** the most tokens a reply may contain; a longer reply is cut off.
- **Stop reason:** why the model stopped: `end_turn`, `max_tokens` or `tool_use`.
- **Stateless API:** an API that remembers nothing between requests, so each one carries the whole conversation.
- **Server-sent events (SSE):** a text format for streaming events over HTTP: `event:` and `data:` lines, separated by blank lines.
- **Streaming:** receiving a reply in pieces as it's generated.
- **Structured output:** model output in a machine-readable format such as JSON, ideally guaranteed to match a schema.
mistakes:
- Assuming `content[0]` is the text of a reply.
- Ignoring `stop_reason` and treating a cut-off reply as complete.
- Sending only the latest message and expecting the model to remember the conversation.
- Retrying 400 errors, or retrying 429s without waiting.
- Parsing each streamed chunk as if it were one complete event.
- Putting an API key in front-end code.

glance:
- One reply | POST messages → check status → join text blocks | O(reply) | O(history)
- Conversation | resend the full history each turn | O(history) per turn | O(history)
- Stream | buffer chunks, split on blank lines, parse data lines | O(reply) | O(one event)

@@ tools-and-agents
topics: tools and why models need them, tool definitions (name, description, input_schema), tool_use and tool_result blocks, the rules for tool calls in the history, the agent loop, step limits, parallel tool calls, errors as is_error results, validating tool inputs, typing blocks with discriminated unions and Extract, confirmation before side effects, prompt injection, logging tool calls, the Model Context Protocol (MCP)
terms:
- **Tool:** a function your program offers the model, described by a name, a description and an input schema.
- **Tool call (`tool_use` block):** the model's request to run a tool with a given input.
- **Tool result (`tool_result` block):** the output of a tool, sent back with the id of the call it answers.
- **Agent loop:** calling the model, running the tools it asks for, sending the results, and repeating until it answers.
- **Agent:** a program in which a model decides which actions (tool calls) to take to reach a goal.
- **Prompt injection:** instructions hidden in data the model reads, trying to make it do something else.
- **MCP (Model Context Protocol):** an open standard for offering tools and data to AI applications.
mistakes:
- Leaving a `tool_use` without a `tool_result` in the next message.
- Sending each tool result in a separate message.
- Letting a tool error crash the loop instead of returning it as a result.
- Running an agent loop without a step limit.
- Letting the model take irreversible actions without a person's confirmation.

glance:
- Answer a tool call | look up by name, run, wrap the result (or the error) in a tool_result | O(tool) | O(result)
- Agent loop | call → append → run every tool_use → append results → repeat, up to a limit | O(steps × history) | O(history)
- Unsafe actions | confirmation step + limits in code | — | —

@@ final-project
topics: the shopping assistant's design, types for messages, blocks and tools, a JSON Schema validator (type, properties, required, additionalProperties, items, enum, minimum, maximum, minLength), validation errors as tool results, tool implementations calling the shop API, an assistant that keeps its history between questions, testing against a deterministic simulated model, evaluating real models, turning the project into a portfolio piece
terms:
- **JSON Schema validation:** checking that a value has the types and constraints a schema describes.
- **Conversation state:** the history an assistant keeps and sends with each request.
- **Deterministic:** giving the same output every time for the same input, which makes testing exact.
- **Evaluation (eval):** measuring a model-based system's answers on a set of example questions.
mistakes:
- Running a tool with model input that hasn't been validated.
- Reporting only the first validation error.
- Starting a new history for every question, so follow-ups lose their context.
- Testing a real model's wording exactly instead of testing the deterministic parts and evaluating the rest.
- Shipping without a step limit, logging or confirmation for orders.

glance:
- Check model input | recursive validate(schema, value, path) | O(size of value) | O(depth + errors)
- Remember a conversation | closure holding messages, appended by each ask | O(history) per question | O(history)
- Recover from bad input | validation errors as is_error tool results; the model retries | O(retries) | O(1)
