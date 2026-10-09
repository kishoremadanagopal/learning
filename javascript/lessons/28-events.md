# Lesson 28: Events

**You'll learn:** addEventListener, the event object, target and currentTarget, click, input, change, keydown and event.key, focus and blur, pointer events, default actions and preventDefault, capture and bubbling, stopPropagation, event delegation with closest, once, passive and signal options, removeEventListener, AbortController for listeners, CustomEvent and dispatchEvent, inline onclick attributes, accessible buttons.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#events)**: run every example and check your exercise answers.

## Key terms

- **Event:** something that happens in the page, such as a click or a key press, which code can listen for.
- **Event listener:** a function called each time an event happens on an element.
- **Event object:** the argument a listener receives, describing the event (`type`, `target`, `key`…).
- **`target`:** the element where the event happened.
- **`currentTarget`:** the element whose listener is currently running.
- **Default action:** what the browser does after the listeners run, like following a link; cancelled with `preventDefault()`.
- **Bubbling:** an event travelling up from its target through every ancestor.
- **Capture phase:** the event travelling down from `window` to the target, before bubbling.
- **Event delegation:** handling events for many children with one listener on their container.
- **`CustomEvent`:** an event your own code creates and dispatches, with data in `detail`.

A page waits for things to happen: a click, a key press, text typed into a box. Each of these is an **event**, and your code reacts by **listening** for it.

## Listening

```html
<button id="like">Like</button>
<p id="count">0 likes</p>
<script>
  let likes = 0;
  const button = document.querySelector("#like");

  button.addEventListener("click", (event) => {
    likes++;
    document.querySelector("#count").textContent = `${likes} like${likes === 1 ? "" : "s"}`;
    console.log(event.type, "on", event.target.id);
  });
</script>
```

`addEventListener(type, handler)` calls `handler` every time the event happens, with an **event object** describing it. The handler runs later, whenever the user clicks: this is the event loop from Lesson 21 at work.

You'll also see `<button onclick="like()">` in old code and tutorials. Avoid it: it mixes code into the HTML, allows only one handler, and is blocked by the security policies (CSP) many sites use.

## Common events

| Event | Fires when | Useful properties |
|---|---|---|
| `click` | a button or element is activated (mouse, tap, or Enter/Space on a button) | `target` |
| `input` | the value of an input, textarea or select changes, on every keystroke | `target.value` |
| `change` | the value is committed (input loses focus, checkbox toggled, option picked) | `target.value`, `target.checked` |
| `keydown` | a key is pressed | `key` (`"Enter"`, `"a"`, `"ArrowUp"`), `ctrlKey`, `metaKey`, `shiftKey` |
| `submit` | a form is submitted (Lesson 29) | |
| `focus` / `blur` | an element gains / loses focus (`focusin` / `focusout` bubble) | |
| `pointerdown`, `pointermove` | mouse, pen or touch (one API for all three) | `clientX`, `clientY` |
| `DOMContentLoaded`, `load` | the HTML is parsed / everything has loaded | |

```html
<input id="search" placeholder="Type, then press Enter">
<script>
  const search = document.querySelector("#search");
  search.addEventListener("input", (e) => console.log("input:", e.target.value));
  search.addEventListener("keydown", (e) => {
    if (e.key === "Enter") console.log("search for", search.value);
    if (e.key === "Escape") search.value = "";
  });
</script>
```

Type in the preview to see an `input` event per keystroke. Use `e.key` (the character or key name); the old `keyCode` numbers are deprecated.

## Default actions and preventDefault

Some events have a **default action** the browser performs after your listeners run: a link navigates, a form submits and reloads the page, a key types a character. `event.preventDefault()` cancels it:

```html
<a id="help" href="https://example.com/help">Help</a>
<input id="digits" placeholder="Digits only">
<script>
  document.querySelector("#help").addEventListener("click", (e) => {
    e.preventDefault();                       // stay on this page
    console.log("Showing help here instead of leaving.");
  });
  document.querySelector("#digits").addEventListener("keydown", (e) => {
    if (e.key.length === 1 && !/\d/.test(e.key)) e.preventDefault();   // block letters
  });
</script>
```

## Bubbling: events travel through the tree

An event doesn't only happen on the element you clicked. It travels **down** from `window` to the target (the **capture** phase), then back **up** through every ancestor (the **bubble** phase). Listeners run in the bubble phase unless you ask for capture.

![Nested boxes: window, document and body, a ul, an li, and a button inside it marked as the target. A purple arrow comes down from window to the button (1. capture), then a teal arrow goes back up from the button to window (3. bubble). By default listeners hear the event on the way up, so a listener on the ul hears clicks on every button inside it](../figures/event-flow.svg)

```html
<ul id="list">
  <li><button>Bell</button></li>
</ul>
<script>
  const log = (where) => (e) => console.log(`${where}: target=${e.target.tagName}, currentTarget=${e.currentTarget.tagName ?? "window"}`);
  document.querySelector("button").addEventListener("click", log("button"));
  document.querySelector("li").addEventListener("click", log("li"));
  document.querySelector("#list").addEventListener("click", log("ul"));
  document.querySelector("#list").addEventListener("click", log("ul, capture"), { capture: true });
  document.querySelector("button").click();       // click it from code: the same events fire
</script>
```

- `event.target` is the element where the event happened (the button), the same in every listener.
- `event.currentTarget` is the element whose listener is running now.
- `event.stopPropagation()` stops the event travelling further. It's rarely the right fix; it breaks other code that relies on bubbling, such as analytics and closing menus on outside clicks.

## Event delegation

Because clicks bubble, **one** listener on a container can handle clicks on all its children, including children added later. In the listener, find which item was clicked with `closest`:

```html
<ul id="products">
  <li data-id="2">Bell <button class="add">Add</button></li>
  <li data-id="4">Floor pump <button class="add">Add</button></li>
</ul>
<script>
  const list = document.querySelector("#products");
  list.addEventListener("click", (e) => {
    const button = e.target.closest("button.add");
    if (!button) return;                                  // a click somewhere else in the list
    const id = Number(button.closest("li").dataset.id);
    console.log("add product", id);
  });

  // Added later, and it still works: no new listener needed.
  list.insertAdjacentHTML("beforeend", '<li data-id="6">Puncture kit <button class="add">Add</button></li>');
  document.querySelector('[data-id="6"] .add').click();
</script>
```

(`insertAdjacentHTML` parses HTML like `innerHTML` does, so it's fine here with HTML we wrote, and never with outside data.)

Delegation means fewer listeners, and lists that are re-rendered (Lesson 27) keep working without re-attaching anything.

## Removing listeners

```html
<button id="once">Only the first click counts</button>
<button id="stop">Stop listening</button>
<script>
  document.querySelector("#once").addEventListener("click", () => console.log("first click!"), { once: true });

  const controller = new AbortController();
  window.addEventListener("keydown", (e) => console.log("key", e.key), { signal: controller.signal });
  window.addEventListener("pointerdown", () => console.log("pointer down"), { signal: controller.signal });
  document.querySelector("#stop").addEventListener("click", () => {
    controller.abort();                                   // removes both listeners at once
    console.log("stopped listening to keys and pointers");
  });
</script>
```

- `{ once: true }` removes the listener after it runs once.
- `{ signal }` ties listeners to an `AbortController` (Lesson 25): `abort()` removes them all, the cleanest way to tidy up when a component or dialog closes.
- `removeEventListener(type, handler)` needs the **same function object**, so it can't remove an arrow function written inline.
- `{ passive: true }` promises you won't call `preventDefault`, which lets the browser scroll smoothly while `scroll`, `wheel` and touch listeners run.

## Custom events

Your own code can announce things with `CustomEvent`; `detail` carries the data:

```html
<p id="badge">Cart: 0</p>
<script>
  document.addEventListener("cart:change", (e) => {
    document.querySelector("#badge").textContent = `Cart: ${e.detail.count}`;
    console.log("cart changed", e.detail);
  });
  document.dispatchEvent(new CustomEvent("cart:change", { detail: { count: 3 } }));
</script>
```

This keeps parts of a page independent: the cart announces changes, and the badge listens, without either knowing about the other.

## Make clickable things buttons

Use a `<button>` for anything that does something when clicked, and a link (`<a href>`) for anything that goes somewhere. A `<div>` with a click listener can't be reached with the Tab key, doesn't respond to Enter or Space, and isn't announced as a button by screen readers. A `<button>` does all of that for free; style it however you like with CSS.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| React to a click | el.addEventListener("click", handler) | O(1) per event | O(1) |
| Many similar items | one listener on the container + closest | O(depth) per event | O(1) listeners |
| Cancel the browser's action | event.preventDefault() | O(1) | O(1) |
| Remove many listeners | pass { signal } and call controller.abort() | O(listeners) | O(1) |

## Common mistakes

- Adding one listener per item instead of delegating, so items added later don't work.
- Checking `e.target` directly when the click may land on a child element; use `closest`.
- Trying to `removeEventListener` with a different (inline arrow) function.
- Using `stopPropagation` to fix problems, which breaks other listeners further up.
- Making clickable `<div>`s instead of `<button>`s.

## Exercises

### 1. A quantity stepper

Make the stepper work. Clicking `#plus` adds 1 to the quantity shown in `#qty`, and `#minus` subtracts 1, but the quantity must stay between **1** and **10**. At the limits, disable the button that would go past them (at 1, `#minus` is disabled; at 10, `#plus` is). The page starts at 1, with `#minus` disabled.

Starter code:

```html
<!doctype html>
<html lang="en">
<body>
  <button id="minus" aria-label="Less">−</button>
  <output id="qty">1</output>
  <button id="plus" aria-label="More">+</button>

  <script>
    // your code here
  </script>
</body>
</html>
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a number with limits, two buttons, and button states that follow the number.
2. **Examples:** 1 → + → 2 (minus enabled); 10 → + → still 10.
3. **Brute force:** updating the text and each button separately inside both listeners: duplicated and easy to get out of sync.
4. **Pattern:** **state + render**: change the state, then call one function that makes the page match it.
5. **Plan:** `qty` → `show()` sets text and disabled flags → listeners clamp and call `show()` → call `show()` once at the start.
6. **Code and test:** click to both limits in the preview.

</details>

<details>
<summary>💡 Hint 1</summary>

Keep the quantity in a variable (`let qty = 1`) rather than reading it back from the page each time.

</details>

<details>
<summary>💡 Hint 2</summary>

Write one `show()` function that writes `qty` into `#qty` and sets both buttons' `disabled` (`minus.disabled = qty <= 1`). Call it at the start and after every change.

</details>

<details>
<summary>💡 Hint 3</summary>

In each click listener, change `qty` but clamp it: `Math.min(10, qty + 1)` and `Math.max(1, qty - 1)`.

</details>

### 2. Add to cart with one listener

Each product has an **Add** button. Use **event delegation**: a **single** `addEventListener` call on `#products` that handles clicks on any `.add` button, including buttons added to the list later.

When a button is clicked, add 1 to that product's count in the `cart` Map (product id as a **number** → quantity), and show the total number of items in `#cart-count` (for example `3 items`, or `1 item`). Clicks elsewhere in the list do nothing.

Starter code:

```html
<!doctype html>
<html lang="en">
<body>
  <ul id="products">
    <li data-id="2">Bell <button class="add">Add</button></li>
    <li data-id="4">Floor pump <button class="add">Add</button></li>
    <li data-id="6">Puncture kit <button class="add">Add</button></li>
  </ul>
  <p id="cart-count">0 items</p>

  <script>
    const cart = new Map();

    // your code here
  </script>
</body>
</html>
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** one listener for many buttons, counts per product, and a total shown on the page.
2. **Examples:** bell, pump, bell → Map {2 → 2, 4 → 1}, "3 items"; clicking the li text → nothing.
3. **Brute force:** `querySelectorAll(".add").forEach(b => b.addEventListener(…))`: one listener per button, and new buttons get none.
4. **Pattern:** **event delegation**: listen on the container, find the button with `closest`.
5. **Plan:** listener on the list → closest button or return → id → increment in the Map → recount and show.
6. **Code and test:** click in the preview; add an `<li>` with a button to the HTML and click it too.

</details>

<details>
<summary>💡 Hint 1</summary>

Put the listener on `#products`. Inside it, `e.target.closest("button.add")` is the clicked Add button, or `null` if the click was somewhere else: `return` early in that case.

</details>

<details>
<summary>💡 Hint 2</summary>

From the button, `button.closest("li").dataset.id` is the id as a string: convert it with `Number()` before using it as a Map key (`2` and `"2"` are different keys).

</details>

<details>
<summary>💡 Hint 3</summary>

`cart.set(id, (cart.get(id) ?? 0) + 1)`, then add up `cart.values()` for the count, with `item` for exactly 1 and `items` otherwise.

</details>

**In the sandbox:** exercises 55–56. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. A quantity stepper</summary>

```html
<!doctype html>
<html lang="en">
<body>
  <button id="minus" aria-label="Less">−</button>
  <output id="qty">1</output>
  <button id="plus" aria-label="More">+</button>

  <script>
    const MIN = 1, MAX = 10;
    let qty = 1;
    const minus = document.querySelector("#minus");
    const plus = document.querySelector("#plus");

    function show() {
      document.querySelector("#qty").textContent = qty;
      minus.disabled = qty <= MIN;
      plus.disabled = qty >= MAX;
    }

    minus.addEventListener("click", () => { qty = Math.max(MIN, qty - 1); show(); });
    plus.addEventListener("click", () => { qty = Math.min(MAX, qty + 1); show(); });
    show();
  </script>
</body>
</html>
```

**Line by line**

- `qty` is the single source of truth; the page only displays it.
- `show()` writes the number and sets `disabled` from conditions, so the buttons can never disagree with the number.
- `Math.max(MIN, qty - 1)` and `Math.min(MAX, qty + 1)` clamp, which also protects against clicks that arrive while a button is being disabled.
- Calling `show()` at the start makes the initial state (minus disabled at 1) come from the same code.

**Trace:** 1 → + → 2 → + → 3 → − → 2; twelve clicks on + stop at 10 and disable +.

**Common wrong approach:** `qty = Number(qtyEl.textContent) + 1` without clamping, and disabling buttons only in some branches: the number escapes the range, or a button stays disabled after coming back from the limit.

</details>

<details>
<summary>✅ 2. Add to cart with one listener</summary>

```html
<!doctype html>
<html lang="en">
<body>
  <ul id="products">
    <li data-id="2">Bell <button class="add">Add</button></li>
    <li data-id="4">Floor pump <button class="add">Add</button></li>
    <li data-id="6">Puncture kit <button class="add">Add</button></li>
  </ul>
  <p id="cart-count">0 items</p>

  <script>
    const cart = new Map();

    function showCount() {
      let n = 0;
      for (const qty of cart.values()) n += qty;
      document.querySelector("#cart-count").textContent = `${n} item${n === 1 ? "" : "s"}`;
    }

    document.querySelector("#products").addEventListener("click", (e) => {
      const button = e.target.closest("button.add");
      if (!button) return;
      const id = Number(button.closest("li").dataset.id);
      cart.set(id, (cart.get(id) ?? 0) + 1);
      showCount();
    });
  </script>
</body>
</html>
```

**Line by line**

- The single listener on `#products` hears every click inside the list, because clicks bubble up from the button.
- `e.target` may be the button, or something inside it; `closest("button.add")` handles both, and returns `null` for clicks on the text, so the early `return` ignores them.
- `button.closest("li").dataset.id` reads the product id from the item; `Number` makes it a number key.
- `(cart.get(id) ?? 0) + 1` starts a new product at 1 (Lesson 13's counting pattern).
- `showCount` sums the quantities and chooses "item" or "items".

**Trace:** clicks on 2, 4, 2 → Map {2 → 2, 4 → 1}, total 3. The new `<li data-id="9">` needs no setup: its click bubbles to the same listener.

**Common wrong approach:** checking `e.target.tagName === "BUTTON"` instead of `closest`: it breaks as soon as the button contains an icon or a `<span>`, because the target is then the inner element.

</details>

## Quick quiz

1. A listener on a ul handles a click on a button inside an li. What are event.target and event.currentTarget?
   - A) target is the button, currentTarget is the ul
   - B) Both are the ul
   - C) target is the ul, currentTarget is the button

2. Why does event delegation work for elements added after the listener?
   - A) Their events bubble up to the container, which already has the listener
   - B) addEventListener watches for new elements automatically
   - C) The browser copies listeners to new elements

3. Which is the best way to remove several listeners when a dialog closes?
   - A) Pass the same AbortController's signal to each, then call abort()
   - B) Call stopPropagation in each listener
   - C) Set the elements' onclick to null

4. Why use a <button> instead of a <div> with a click listener?
   - A) Buttons work with the keyboard and are announced to screen readers
   - B) Divs can't have click listeners
   - C) Buttons are faster

<details>
<summary>Quiz answers</summary>

1. **A) target is the button, currentTarget is the ul**: target is where the event happened; currentTarget is whose listener is running.
2. **A) Their events bubble up to the container, which already has the listener**: The listener is on the container, which never changes.
3. **A) Pass the same AbortController's signal to each, then call abort()**: One abort() removes every listener registered with that signal.
4. **A) Buttons work with the keyboard and are announced to screen readers**: Divs get none of the keyboard and accessibility behaviour for free.

</details>

---
Previous: [Lesson 27](27-changing-the-page.md) · Next: [Lesson 29: Forms and user input](29-forms.md)
