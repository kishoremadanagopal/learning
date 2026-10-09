# Lesson 30: Project: a product browser

**You'll learn:** state and a single render function, loading, empty and error states, retry buttons, filtering loaded data in memory, debouncing search input, cancelling stale requests with AbortController, ARIA live regions, localStorage for preferences and its limits, how frameworks such as React, Vue and Svelte build on the same idea.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#product-browser)**: run every example and check your exercise answers.

## Key terms

- **State:** the data that determines what the page shows at any moment.
- **Render function:** a function that updates the page to match the current state.
- **Loading / empty / error states:** what the page shows while waiting, when there's nothing to show, and when something failed.
- **Stale response:** a response to an old request that arrives after a newer one.
- **`localStorage`:** small, persistent string storage per site, kept in the browser.
- **Framework:** a library such as React, Vue or Svelte that turns state into DOM updates for you.

Time to combine everything from Parts 4 and 5 into one small app: a product browser for the practice shop. It loads products from the API, shows loading and error states, filters by category and searches as you type.

## The plan: state, then render

Interactive pages get messy when every event handler changes the page directly. The approach that scales, and the idea behind every modern framework, is:

1. Keep everything the page shows in one **state** object.
2. Write one **`render()`** function that makes the page match the state.
3. Event handlers only **change the state** and call `render()`.

```js
const state = { status: "loading", products: [], query: "", error: null };

function render() {
  // read state, update the page; never the other way round
}

search.addEventListener("input", () => {
  state.query = search.value;     // 1. change the state
  render();                       // 2. redraw from it
});
```

The page can then only show combinations the state allows, and to find a display bug you look in one place.

## The whole app

Run it, then use it in the preview: search, change the category, and watch the output. Each part is explained below.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Parts</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 16px; }
    .bar { display: flex; gap: 8px; margin-bottom: 8px; }
    .out { opacity: .5; }
    .error { color: crimson; }
  </style>
</head>
<body>
  <div class="bar">
    <input id="q" type="search" placeholder="Search" aria-label="Search products">
    <select id="category" aria-label="Category">
      <option value="">All</option>
      <option value="parts">Parts</option>
      <option value="tools">Tools</option>
      <option value="accessories">Accessories</option>
    </select>
  </div>
  <p id="status" role="status"></p>
  <button id="retry" hidden>Try again</button>
  <ul id="list"></ul>

  <script>
    const API = "https://shop.example/api/products";
    const state = { status: "loading", products: [], query: "", category: "", error: "" };
    const $ = (sel) => document.querySelector(sel);
    const pounds = (pence) => `£${(pence / 100).toFixed(2)}`;

    function visibleProducts() {
      const q = state.query.trim().toLowerCase();
      return state.products.filter((p) => p.name.toLowerCase().includes(q));
    }

    function render() {
      const shown = visibleProducts();
      $("#retry").hidden = state.status !== "error";
      $("#status").className = state.status === "error" ? "error" : "";
      $("#status").textContent =
        state.status === "loading" ? "Loading…" :
        state.status === "error" ? `Couldn't load products: ${state.error}` :
        shown.length === 0 ? "No matches" :
        `${shown.length} product${shown.length === 1 ? "" : "s"}`;
      $("#list").replaceChildren(...(state.status === "ready" ? shown : []).map((p) => {
        const li = document.createElement("li");
        li.textContent = `${p.name}: ${pounds(p.price)}${p.stock === 0 ? " (sold out)" : ""}`;
        li.classList.toggle("out", p.stock === 0);
        return li;
      }));
    }

    let controller = null;
    async function load() {
      controller?.abort();                         // cancel a request that's still running
      controller = new AbortController();
      const { signal } = controller;
      state.status = "loading";
      render();
      try {
        const url = new URL(API);
        if (state.category) url.searchParams.set("category", state.category);
        const res = await fetch(url, { signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        state.products = await res.json();
        state.status = "ready";
      } catch (err) {
        if (err.name === "AbortError") return;     // replaced by a newer request: not an error
        state.status = "error";
        state.error = err.message;
      }
      render();
      console.log(`loaded ${state.category || "all"}: ${state.products.length} products`);
    }

    let timer;
    $("#q").addEventListener("input", (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => {                   // debounce: wait for a pause in typing
        state.query = e.target.value;
        render();
      }, 150);
    });
    $("#category").addEventListener("change", (e) => {
      state.category = e.target.value;
      load();
    });
    $("#retry").addEventListener("click", load);

    load();
  </script>
</body>
</html>
```

## Loading, empty and error states

A real request can be slow, can find nothing, or can fail. Users should always see which: an empty list with no explanation looks broken.

- **Loading:** set `state.status = "loading"` and render **before** awaiting, so "Loading…" appears at once.
- **Empty:** "No matches" is different from "nothing loaded yet".
- **Error:** say what went wrong and offer a way out: the **Try again** button just calls `load()` again.

`role="status"` on the message makes screen readers announce each change ("6 products", "No matches") without moving the user's focus; it's an ARIA **live region**.

## Searching as you type

The search filters products already loaded, in memory: no request per keystroke. Filtering is fast here, but the listener still **debounces** (Lesson 21): it waits until the user pauses for 150 ms before re-rendering. When each keystroke triggers something expensive, like a request, debouncing is essential.

Note that `render()` uses `textContent` for product names: they come from an API, so they're outside data (Lesson 27).

## Stale responses

Choose "Tools" and then quickly "Parts": two requests are now running, and nothing guarantees they finish in order. If the "Tools" response arrived last, the page would show tools under the "Parts" filter. `load()` prevents it by **aborting** the previous request (Lesson 25) before starting a new one; the aborted `fetch` rejects with an `AbortError`, which `load()` ignores because a newer request is on its way.

## Remembering preferences

`localStorage` keeps small strings in the browser across visits, per site:

```js
try {
  localStorage.setItem("category", state.category);            // strings only: JSON.stringify objects
  state.category = localStorage.getItem("category") ?? "";     // null when it was never saved
} catch {
  // storage can be disabled or full (private windows, sandboxed frames): the app must still work
}
```

It's synchronous, limited to about 5 MB, and readable by any script on the page, so never store passwords or tokens in it. The preview runs in a sandboxed frame without storage, so trying it there throws, which is exactly why the `try` is there.

## Where this leads

Frameworks such as **React**, **Vue**, **Svelte** and **Angular** are built on the same idea you just used: state goes in, a render function describes the page, and the framework updates the DOM efficiently when the state changes. They add components (reusable pieces with their own state), efficient updates, and routing. Learning the DOM first means you'll understand what they do for you, and you can still build small pages, like this one, without them. TypeScript (Part 6) and tooling such as Vite (Part 7) are what those projects are written and built with.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Keep the page consistent | state object + one render() | O(rendered items) per update | O(state) |
| Search loaded data | filter a copy, case-insensitive, on input | O(n) per search | O(matches) |
| Avoid stale results | abort the previous request before starting a new one | O(1) | O(1) |
| Remember a preference | localStorage.setItem / getItem inside try / catch | O(size) | O(size) |

## Common mistakes

- Changing the page from many places, so it can drift out of sync with the data.
- Showing an empty list while loading or after an error, with no explanation.
- Letting an old response overwrite newer results.
- Filtering the loaded data in place, losing items for the next search.
- Storing tokens or passwords in `localStorage`, or assuming it's always available.

## Exercises

### 1. Load with loading and error states

Write `async function loadProducts()` that:

1. sets `#status` to `Loading…` and hides `#retry` (its `hidden` property);
2. fetches `https://shop.example/api/products`;
3. on success, fills `<ul id="list">` with one `<li>` per product with the text `Name: £6.00` (replacing anything already there), and sets `#status` to `6 products` (the number loaded);
4. if the request fails or the status isn't OK, empties the list, sets `#status` to `Couldn't load products` and shows `#retry`.

Clicking `#retry` calls `loadProducts()` again. Call it once when the page loads.

Starter code:

```html
<!doctype html>
<html lang="en">
<body>
  <p id="status" role="status"></p>
  <button id="retry" hidden>Try again</button>
  <ul id="list"></ul>

  <script>
    async function loadProducts() {
      // your code here
    }

    // your code here
  </script>
</body>
</html>
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** three visible states (loading, loaded, failed) and a way back from failure.
2. **Examples:** server 500 → "Couldn't load products", retry visible, list empty; retry → 6 products.
3. **Brute force:** awaiting first and only then writing anything: the user sees nothing while waiting, and errors leave the old list on screen.
4. **Pattern:** **loading → try fetch and render → catch shows the error state**.
5. **Plan:** loading text, hide retry → fetch → check ok → json → render items and count; catch → empty, message, show retry.
6. **Code and test:** run it; then temporarily change the URL to `/api/nope` to see the error state.

</details>

<details>
<summary>💡 Hint 1</summary>

Set the loading text and `retry.hidden = true` **before** the first `await`, so they show while the request is in flight.

</details>

<details>
<summary>💡 Hint 2</summary>

Wrap the fetch in `try` / `catch`. Inside `try`, `if (!res.ok) throw new Error(...)` sends HTTP errors to the same `catch` as network failures.

</details>

<details>
<summary>💡 Hint 3</summary>

Build the `<li>`s with `textContent` and `replaceChildren(...items)`; in `catch`, `list.replaceChildren()` empties the list. Then `retry.addEventListener("click", loadProducts)` and call `loadProducts()`.

</details>

### 2. Search as you type

The page loads the products once. Make `#q` filter them as the user types: show an `<li>` with the name of each product whose name **contains** the search text, ignoring upper/lower case and spaces around the text, in their original order. Set `#count` to `4 products`, `1 product`, or `No matches`. An empty search shows every product.

You may debounce the input if you like; the checks wait for the page to update.

Starter code:

```html
<!doctype html>
<html lang="en">
<body>
  <input id="q" type="search" placeholder="Search" aria-label="Search products">
  <p id="count" role="status">Loading…</p>
  <ul id="list"></ul>

  <script>
    let products = [];

    function render() {
      // your code here
    }

    fetch("https://shop.example/api/products")
      .then((res) => res.json())
      .then((data) => {
        products = data;
        render();
      });
  </script>
</body>
</html>
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** derived view: the visible list and count are computed from `products` and the search text.
2. **Examples:** "b" → 4 (tube, bell, tyre, lock); "BELL" → 1; "zzz" → No matches; "" → all 6.
3. **Brute force:** hiding non-matching `<li>`s with `hidden`: works, but the count and order logic get spread around.
4. **Pattern:** **render from state**: filter the data, then rebuild the list.
5. **Plan:** term = trimmed lower-case input → filter → rebuild list → count text → render on every input.
6. **Code and test:** type in the preview, including capitals and spaces.

</details>

<details>
<summary>💡 Hint 1</summary>

In `render()`, read the search box, then `trim().toLowerCase()` it. Compare with `p.name.toLowerCase().includes(term)`; every name includes `""`, so an empty search keeps everything.

</details>

<details>
<summary>💡 Hint 2</summary>

Build `<li>` elements with `textContent` from the filtered array and put them in with `replaceChildren(...)`.

</details>

<details>
<summary>💡 Hint 3</summary>

Pick the count text with the length: `0` → "No matches", `1` → "1 product", otherwise "N products". Then `q.addEventListener("input", render)`.

</details>

**In the sandbox:** exercises 59–60. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Load with loading and error states</summary>

```html
<!doctype html>
<html lang="en">
<body>
  <p id="status" role="status"></p>
  <button id="retry" hidden>Try again</button>
  <ul id="list"></ul>

  <script>
    const status = document.querySelector("#status");
    const retry = document.querySelector("#retry");
    const list = document.querySelector("#list");

    async function loadProducts() {
      status.textContent = "Loading…";
      retry.hidden = true;
      try {
        const res = await fetch("https://shop.example/api/products");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const products = await res.json();
        list.replaceChildren(...products.map((p) => {
          const li = document.createElement("li");
          li.textContent = `${p.name}: £${(p.price / 100).toFixed(2)}`;
          return li;
        }));
        status.textContent = `${products.length} products`;
      } catch {
        list.replaceChildren();
        status.textContent = "Couldn't load products";
        retry.hidden = false;
      }
    }

    retry.addEventListener("click", loadProducts);
    loadProducts();
  </script>
</body>
</html>
```

**Line by line**

- The loading text and hidden retry button are set synchronously, before `await`, so they appear immediately.
- `if (!res.ok) throw` turns a 500 into an exception, because `fetch` only rejects on network failures (Lesson 24).
- `replaceChildren(...items)` replaces the old list, so retrying doesn't duplicate items.
- One `catch` handles both failure kinds: it empties the list, shows the message and reveals the retry button.
- The retry listener is `loadProducts` itself: a retry is just another load.

**Trace:** load → "Loading…" → 200 with 6 products → 6 items, "6 products". With a 500: "Loading…" → throw → empty list, error text, retry shown. Click retry → back to 6.

**Common wrong approach:** only catching network errors with `fetch(...).catch(...)` and never checking `res.ok`: a 500 response gets parsed and rendered as if it were products.

</details>

<details>
<summary>✅ 2. Search as you type</summary>

```html
<!doctype html>
<html lang="en">
<body>
  <input id="q" type="search" placeholder="Search" aria-label="Search products">
  <p id="count" role="status">Loading…</p>
  <ul id="list"></ul>

  <script>
    let products = [];
    const q = document.querySelector("#q");

    function render() {
      const term = q.value.trim().toLowerCase();
      const shown = products.filter((p) => p.name.toLowerCase().includes(term));
      document.querySelector("#list").replaceChildren(...shown.map((p) => {
        const li = document.createElement("li");
        li.textContent = p.name;
        return li;
      }));
      document.querySelector("#count").textContent =
        shown.length === 0 ? "No matches" : `${shown.length} product${shown.length === 1 ? "" : "s"}`;
    }

    q.addEventListener("input", render);

    fetch("https://shop.example/api/products")
      .then((res) => res.json())
      .then((data) => {
        products = data;
        render();
      });
  </script>
</body>
</html>
```

**Line by line**

- `render()` reads the current search text each time, so it works whoever calls it: the input listener or the initial load.
- `trim().toLowerCase()` on the search and `toLowerCase()` on the names make the match ignore case and surrounding spaces.
- `filter` keeps the original order of `products`.
- `replaceChildren` swaps in the new items in one update; `textContent` keeps names safe.
- The count message handles the three cases, including singular "product".
- Typing before the products arrive is fine: `products` is `[]`, then the load calls `render()` with the current search text.

**Trace:** "b" matches "Inner tu**b**e", "**B**ell", "Tu**b**eless tyre", "**B**ike lock" → "4 products".

**Common wrong approach:** filtering `products` in place (`products = products.filter(...)`): each search permanently removes products, so clearing the search can't bring them back. Keep the loaded data unchanged and derive the view from it.

</details>

## Quick quiz

1. In the state-and-render approach, what should an event handler do?
   - A) Update the state, then call render()
   - B) Change the elements it needs directly
   - C) Re-fetch the whole page

2. The user switches category twice quickly. Why abort the first request?
   - A) Its response could arrive last and overwrite the newer results
   - B) Browsers can't run two fetches at once
   - C) Aborting makes the second request faster

3. What does role="status" on a message element do?
   - A) Screen readers announce its changes without moving focus
   - B) It styles the element as a status bar
   - C) It makes the element update automatically

4. Which is safe to keep in localStorage?
   - A) The user's preferred category
   - B) A login token
   - C) A password, if it's encoded with btoa

<details>
<summary>Quiz answers</summary>

1. **A) Update the state, then call render()**: render() is the only code that changes the page, so the page always matches the state.
2. **A) Its response could arrive last and overwrite the newer results**: Responses can arrive in any order; cancelling stale ones keeps the page consistent.
3. **A) Screen readers announce its changes without moving focus**: It's an ARIA live region.
4. **A) The user's preferred category**: Any script on the page can read localStorage; keep secrets out of it.

</details>

---
Previous: [Lesson 29](29-forms.md) · Back to the [course home](../README.md)
