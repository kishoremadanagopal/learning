# Lesson 25: The Model Context Protocol (MCP)

**You'll learn:** the integration problem, hosts, clients and servers, tools, resources and prompts, JSON-RPC 2.0 requests, responses, errors and notifications, stdio and Streamable HTTP transports, the 2026-07-28 specification, the Python SDK, connecting servers to hosts and the MCP connector, namespacing tools, too many tools and tool search, MCP security and tool poisoning, governance under the Agentic AI Foundation.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ai-engineering/#mcp)**: run every example and check your exercise answers.

## Key terms

- **Model Context Protocol (MCP):** an open standard for connecting AI applications to tools and data sources.
- **MCP host:** the application the user works in, which contains MCP clients.
- **MCP server:** a program exposing tools, resources and prompts from some system.
- **Resource:** data an MCP server offers for the application to read into context.
- **JSON-RPC 2.0:** the request-response message format MCP uses.
- **Transport:** how messages travel: stdio for local subprocesses, Streamable HTTP for web services.
- **Tool poisoning:** malicious instructions hidden in a tool's description or results.

Every AI application wants the same integrations: files, GitHub, Slack, databases, calendars, your internal APIs. Without a standard, each app writes its own connector for each service: M apps × N services. The **Model Context Protocol (MCP)** is an open standard for that connection, so a service written **once** as an MCP server works in every app that speaks MCP: M + N. It's often compared to **USB-C for AI**.

Anthropic released MCP in November 2024; OpenAI, Google, Microsoft and most AI tools have since adopted it, and in December 2025 Anthropic donated it to the **Agentic AI Foundation**, under the Linux Foundation.

## Hosts, clients and servers

![An MCP host application (such as a chat app, an IDE or an agent) containing the model and several MCP clients. Each client connects to one MCP server: a local filesystem server over stdio, and a GitHub server and a company database server over Streamable HTTP. Servers expose tools, resources and prompts](../figures/mcp-architecture.svg)

- **Host:** the application the user works in (Claude's apps, Claude Code, an IDE, your own agent).
- **Client:** the connector inside the host that talks to **one** server.
- **Server:** a program exposing capabilities from some system (files, a database, an API).

## What a server offers

| Primitive | Controlled by | What it is | Example |
|---|---|---|---|
| **tools** | the model | functions the model can call | `create_issue(title, body)` |
| **resources** | the application | data the app can read into context | `file:///docs/returns.md`, a database schema |
| **prompts** | the user | reusable prompt templates, often shown as commands | "/review-pull-request" |

Tools are by far the most used. A server describes each with a name, description and JSON Schema (`inputSchema`): the same idea as Lesson 23's tool definitions, so a host can pass them straight to the model.

## Messages and transports

MCP messages are **JSON-RPC 2.0**: a request carries a `method` and an `id`; the response carries the same `id` with either a `result` or an `error`.

```python
import json

list_request = {"jsonrpc": "2.0", "id": 1, "method": "tools/list"}
call_request = {"jsonrpc": "2.0", "id": 2, "method": "tools/call",
                "params": {"name": "get_stock", "arguments": {"sku": "TYRE-29-24", "shop": "bath"}}}
call_response = {"jsonrpc": "2.0", "id": 2,
                 "result": {"content": [{"type": "text", "text": "6"}], "isError": False}}
for message in (list_request, call_request, call_response):
    print(json.dumps(message))
```

Two standard **transports** carry them:

- **stdio:** the host starts the server as a local subprocess and talks over standard input and output. Simple and private; good for local tools such as filesystem access.
- **Streamable HTTP:** the server runs as a web service (local or remote), with standard HTTP authorisation (OAuth). Good for shared, hosted services.

The specification is versioned by date. The **2026-07-28** revision made requests **stateless** (each request carries its own protocol version and capabilities, so servers scale behind ordinary load balancers), moved long-running **tasks** and interactive **MCP Apps** into official extensions, tightened authorisation, and deprecated older features (such as server-initiated sampling and roots) with a migration window. Check the version your SDK targets.

## Writing a server

The official SDKs (Python, TypeScript and others) turn functions into MCP tools, with schemas generated from type hints and docstrings (like Lesson 23's first exercise):

```python
# server.py  (pip install "mcp[cli]")
from mcp.server import MCPServer

mcp = MCPServer("Bike shop")

@mcp.tool()
def get_stock(sku: str, shop: str) -> int:
    """Units of a product in stock at one shop ('bristol' or 'bath')."""
    return inventory.lookup(sku, shop)

@mcp.resource("policy://returns")
def returns_policy() -> str:
    """The current returns policy."""
    return open("returns.md").read()
```

```python
# Try it in the MCP Inspector:        uv run mcp dev server.py
# Serve it over Streamable HTTP:      uv run mcp run server.py --transport streamable-http

# Test it in memory, without any transport:
from mcp import Client
from server import mcp

async def check_stock():
    async with Client(mcp) as client:
        return await client.call_tool("get_stock", {"sku": "TYRE-29-24", "shop": "bath"})
```

Then add the server to a host: Claude's apps and Claude Code, IDEs and agent frameworks all accept MCP server configurations, and the Claude API's **MCP connector** can call remote MCP servers directly from a Messages request.

## Many servers, many tools

Connecting several servers raises practical problems:

- **Name clashes:** two servers may both offer `search`. Hosts usually **prefix** tool names with the server name (the second exercise).
- **Too many tools:** dozens of tool definitions cost tokens on every call and make the model's choice harder. Enable only the servers a task needs, or use **tool search**, where the model loads tool definitions on demand.
- **Large results:** a server returning a 50,000-token page fills the context. Good servers paginate and summarise.

## Security

An MCP server runs code and returns text that goes straight into the model's context, so:

- **Only install servers you trust**, from known publishers; pin versions. A malicious or compromised server can lie in its tool descriptions (**tool poisoning**) or return prompt-injection text (Lesson 16).
- **Least privilege:** give each server only the scopes it needs (read-only tokens where possible).
- **Watch the trifecta:** a server that reads private data, plus one that fetches untrusted content, plus one that can send messages is exactly the combination that enables data theft.
- **Confirm consequential actions** in the host (Lesson 27).

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| MCP request handling | route by method; echo the id; result or error | O(1) dispatch | O(tools) for a list |
| Namespaced tool names | server__tool; validate the pattern; reject duplicates | O(tools) | O(tools) |
| Pick a transport | local subprocess → stdio; shared or remote → Streamable HTTP | — | — |

## Common mistakes

- Installing MCP servers from unknown sources.
- Giving servers broader credentials than they need.
- Connecting dozens of servers so every request carries hundreds of tool definitions.
- Reporting tool failures as protocol errors, hiding them from the model.
- Letting tools from different servers clash by name.

## Exercises

### 1. A minimal MCP server

Write `handle_request(request, tools)`, the core of an MCP-style server. `tools` maps each tool name to `{"description": str, "input_schema": dict, "fn": function}`. Return the JSON-RPC response dict:

- Every response is `{"jsonrpc": "2.0", "id": <the request's id>, …}` plus either `"result"` or `"error"`.
- `"tools/list"` → `"result": {"tools": [{"name": …, "description": …, "inputSchema": …}, …]}` in the dict's order.
- `"tools/call"` with `params` `{"name": …, "arguments": {…}}` (arguments default to `{}`):
  - success → `"result": {"content": [{"type": "text", "text": str(output)}], "isError": False}`;
  - the tool raises `e` → the same shape with text `f"{type(e).__name__}: {e}"` and `"isError": True` (a tool failure is a **result** the model should see);
  - unknown tool → `"error": {"code": -32602, "message": "Unknown tool: <name>"}`.
- Any other method → `"error": {"code": -32601, "message": "Method not found"}`.
- A request **without** an `"id"` is a notification: return `None`.

Starter code:

```python
def handle_request(request, tools):
    pass

tools = {"get_stock": {"description": "Units in stock at a shop.",
                       "input_schema": {"type": "object", "properties": {"shop": {"type": "string"}}, "required": ["shop"]},
                       "fn": lambda shop: {"bath": 6, "bristol": 0}[shop]}}
print(handle_request({"jsonrpc": "2.0", "id": 1, "method": "tools/list"}, tools))
print(handle_request({"jsonrpc": "2.0", "id": 2, "method": "tools/call",
                      "params": {"name": "get_stock", "arguments": {"shop": "bath"}}}, tools))
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a dispatcher from method names to handlers, with JSON-RPC's response envelope and error codes.
2. **Examples:** a failing tool still gets a `result` (so the model sees the failure); an unknown method gets an `error`.
3. **Brute force:** this is already a direct dispatcher.
4. **Pattern:** **request router** with a fixed envelope.
5. **Plan:** notification check → envelope → `tools/list` / `tools/call` / method not found.
6. **Code and test:** list, call, tool failure, unknown tool, unknown method, notifications, string ids.

</details>

<details>
<summary>💡 Hint 1</summary>

Handle the notification case first (`"id" not in request`), then build the common part of the response and branch on `request["method"]`.

</details>

<details>
<summary>💡 Hint 2</summary>

For `tools/list`, note the key change: your dict uses `input_schema`, but MCP's wire format uses `inputSchema`.

</details>

<details>
<summary>💡 Hint 3</summary>

For `tools/call`, unknown tools are a protocol **error** (`-32602`); a tool that raises is a normal **result** with `"isError": True`. Use `params.get("arguments", {})`.

</details>

### 2. Namespace tools from several servers

A host connected to several MCP servers must give every tool a unique name the model can use. Write `namespace_tools(servers)`, where `servers` maps each server name to its list of tool names. Return a dict mapping `"<server>__<tool>"` (two underscores) to `(server, tool)`, in server order and then tool order.

Each combined name must match `^[a-zA-Z0-9_-]{1,64}$` (the Claude API's rule for tool names); otherwise raise `ValueError` mentioning the name. A combined name that appears twice also raises `ValueError`.

Starter code:

```python
import re

def namespace_tools(servers):
    pass

servers = {"github": ["search", "create_issue"], "docs": ["search"]}
print(namespace_tools(servers))
# {'github__search': ('github', 'search'), 'github__create_issue': ('github', 'create_issue'), 'docs__search': ('docs', 'search')}
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** unique, valid, reversible names: the dict maps back to the server and the original tool.
2. **Examples:** two `search` tools become `github__search` and `docs__search`.
3. **Brute force:** this is already linear.
4. **Pattern:** **namespacing** plus **validation at the boundary**.
5. **Plan:** loop → build the name → validate → check duplicates → store.
6. **Code and test:** clashes, invalid characters, the 64-character limit, duplicates, empty input.

</details>

<details>
<summary>💡 Hint 1</summary>

Two nested loops (servers, then their tools) visit everything in the right order; a dict keeps insertion order.

</details>

<details>
<summary>💡 Hint 2</summary>

Build `f"{server}__{tool}"` and test it with `re.match(r"^[a-zA-Z0-9_-]{1,64}$", name)`; the `{1,64}` limits the length.

</details>

<details>
<summary>💡 Hint 3</summary>

Before adding a name, check whether it's already in the result dict; raise `ValueError` for both problems.

</details>

**In the sandbox:** exercises 48–49. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. A minimal MCP server</summary>

```python
def handle_request(request, tools):
    if "id" not in request:
        return None                                        # notifications get no reply
    response = {"jsonrpc": "2.0", "id": request["id"]}
    method = request.get("method")
    params = request.get("params", {})

    if method == "tools/list":
        response["result"] = {"tools": [{"name": name, "description": t["description"], "inputSchema": t["input_schema"]}
                                        for name, t in tools.items()]}
    elif method == "tools/call":
        name = params.get("name")
        if name not in tools:
            response["error"] = {"code": -32602, "message": f"Unknown tool: {name}"}
        else:
            try:
                text, is_error = str(tools[name]["fn"](**params.get("arguments", {}))), False
            except Exception as e:
                text, is_error = f"{type(e).__name__}: {e}", True
            response["result"] = {"content": [{"type": "text", "text": text}], "isError": is_error}
    else:
        response["error"] = {"code": -32601, "message": "Method not found"}
    return response

tools = {"get_stock": {"description": "Units in stock at a shop.",
                       "input_schema": {"type": "object", "properties": {"shop": {"type": "string"}}, "required": ["shop"]},
                       "fn": lambda shop: {"bath": 6, "bristol": 0}[shop]}}
print(handle_request({"jsonrpc": "2.0", "id": 1, "method": "tools/list"}, tools))
print(handle_request({"jsonrpc": "2.0", "id": 2, "method": "tools/call",
                      "params": {"name": "get_stock", "arguments": {"shop": "bath"}}}, tools))
```

**Line by line**

- JSON-RPC notifications have no `id` and must not be answered; checking first keeps the rest simple.
- The response echoes the request's `id` exactly (numbers or strings), so the client can match replies to requests.
- `-32601` (method not found) and `-32602` (invalid params) are standard JSON-RPC error codes.
- Tool failures go in `result` with `isError: True` because they're information for the **model**, while protocol errors are for the **client** software.

**Trace:** `tools/call` for `get_stock` with `shop="leeds"` → the lambda raises `KeyError('leeds')` → result text `KeyError: 'leeds'`, `isError: True`.

**Complexity:** O(tools) for a list; O(1) dispatch plus the tool's own work for a call.

**Common wrong approach:** turning every tool failure into a protocol error. The host then can't show the model what went wrong, so the model can't recover. (Real servers also validate `arguments` against the schema before calling the function.)

</details>

<details>
<summary>✅ 2. Namespace tools from several servers</summary>

```python
import re

VALID_NAME = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")

def namespace_tools(servers):
    names = {}
    for server, tools in servers.items():
        for tool in tools:
            full = f"{server}__{tool}"
            if not VALID_NAME.match(full):
                raise ValueError(f"invalid tool name: {full!r}")
            if full in names:
                raise ValueError(f"duplicate tool name: {full!r}")
            names[full] = (server, tool)
    return names

servers = {"github": ["search", "create_issue"], "docs": ["search"]}
print(namespace_tools(servers))
```

**Line by line**

- The double underscore makes the boundary between server and tool easy to see; the mapping means you never have to split the name back apart.
- The regex's `^…$` anchors force the **whole** name to match, not just part of it.
- `{1,64}` enforces the length limit in the same check.
- Failing loudly at connection time is better than sending an invalid tool list and getting an API error on every request.

**Trace:** github → `github__search`, `github__create_issue`; docs → `docs__search` (different from `github__search`, so no clash).

**Complexity:** O(total tools).

**Common wrong approach:** letting the second `search` silently replace the first, so the model calls the wrong server's tool. When the model calls `docs__search`, the host looks up `("docs", "search")` and routes the call to that server.

</details>

## Quick quiz

1. What problem does MCP mainly solve?
   - A) Models being too slow
   - B) The cost of tokens
   - C) Every app needing its own connector for every service; with a standard, a server works in any MCP host

2. Which MCP primitive is controlled by the model?
   - A) Resources
   - B) Tools
   - C) Prompts

3. When would you use the stdio transport?
   - A) For a local server the host starts as a subprocess, such as filesystem access
   - B) For a public, shared web service
   - C) Only for prompts

4. Why should you only install MCP servers you trust?
   - A) Untrusted servers are slower
   - B) MCP forbids third-party servers
   - C) A server's tool descriptions and results go straight into the model's context and can carry injected instructions

<details>
<summary>Quiz answers</summary>

1. **C) Every app needing its own connector for every service; with a standard, a server works in any MCP host**: M × N integrations become M + N.
2. **B) Tools**: Resources are app-controlled; prompts are user-controlled.
3. **A) For a local server the host starts as a subprocess, such as filesystem access**: Remote and shared servers use Streamable HTTP.
4. **C) A server's tool descriptions and results go straight into the model's context and can carry injected instructions**: Tool poisoning and prompt injection are real risks.

</details>

---
Previous: [Lesson 24](24-agent-loop.md) · Next: [Lesson 26: Memory and context management](26-memory-and-context.md)
