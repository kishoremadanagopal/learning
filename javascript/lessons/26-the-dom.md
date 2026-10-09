# Lesson 26: Web pages and the DOM

**You'll learn:** what HTML, CSS and JavaScript each do, the page preview, the DOM tree, element and text nodes, document, where to put script tags (end of body, defer, type="module"), DOMContentLoaded and load, CSS selectors, querySelector and querySelectorAll, NodeList versus array, getElementById, textContent and innerText, attributes versus properties, data- attributes and dataset, closest, matches, parentElement, children and siblings.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#the-dom)**: run every example and check your exercise answers.

## Key terms

- **DOM (Document Object Model):** the tree of objects the browser builds from a page's HTML, which JavaScript reads and changes.
- **Node:** any item in the DOM tree: an element, a piece of text, a comment, or the document itself.
- **Element:** a node made from an HTML tag, such as `<li>`.
- **CSS selector:** a pattern that matches elements, like `#cart li.item`; used by CSS and by `querySelector`.
- **`querySelector`:** returns the first element matching a selector, or `null`.
- **`NodeList`:** the list `querySelectorAll` returns; it has `forEach` and `length` but not `map`.
- **`defer`:** a script attribute: download in parallel, run after the HTML has been parsed.
- **`DOMContentLoaded`:** the event fired when the HTML has been fully parsed.
- **`textContent`:** all the text inside an element, without tags.
- **`data-` attribute:** a custom attribute for your own data, read through `el.dataset`.
- **`closest`:** finds the nearest ancestor (or the element itself) matching a selector.

Until now your code printed text. In a browser, JavaScript's main job is the **page**: showing data, reacting to clicks, checking forms. A web page is built from three languages, each with its own job:

| Language | Job | Example |
|---|---|---|
| **HTML** | structure and content | `<button>Add to cart</button>` |
| **CSS** | how it looks | `button { color: white; background: teal; }` |
| **JavaScript** | behaviour | run code when the button is clicked |

## Your first page

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

## The DOM: the page as objects

When the browser reads HTML, it builds a tree of objects called the **DOM** (Document Object Model). Every tag becomes an **element node**, and the text inside becomes **text nodes**. JavaScript never edits the HTML file; it reads and changes this tree, and the browser redraws the page to match.

![An HTML snippet on the left, a body containing an h1 and a ul with two li items, and on the right the DOM tree the browser builds from it: body at the top, h1 and ul#list as its children, the li elements under the ul, and the text "Shop", "Bell" and "Pump" as text nodes at the leaves](../figures/dom-tree.svg)

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

## Where the script goes

A `<script>` runs **as soon as the browser reaches it**, and it can only find elements that are above it in the page. That gives three common choices:

```html
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

## Finding elements

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

## Reading what's there

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

## Moving around the tree

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

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Find one element | querySelector(css) or getElementById(id) | O(n) elements in the worst case | O(1) |
| Find all matches | [...querySelectorAll(css)] | O(n) | O(matches) |
| Find the item a click belongs to | target.closest(selector) | O(depth) | O(1) |
| Read custom data | el.dataset.name, then Number() if needed | O(1) | O(1) |

## Common mistakes

- Running a script before the elements it looks for exist, and getting `null`.
- Forgetting `#` or `.` in a selector (`querySelector("cart")` looks for a `<cart>` tag).
- Calling `map` or `filter` directly on a `NodeList`.
- Treating `data-` attribute values as numbers: `"0"` is truthy.
- Querying once and expecting the result to include elements added later.

## Exercises

### 1. Names in stock

The page lists products, each `<li>` with a `data-stock` attribute. Write `function inStock()` that returns an **array of the names** (each `<li>`'s text, trimmed) of the products whose stock is **more than 0**, in page order.

It must read the page **each time it's called**: the checks change the page and call it again. Keep your code in the normal `<script>` (not `type="module"`) so the checks can find your function.

Starter code:

```html
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

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** select the items, keep those with stock above 0, return their trimmed names.
2. **Examples:** stock "0" → left out; "  Bell  " → "Bell".
3. **Brute force:** a `for…of` loop over the NodeList, pushing names into an array. That works too.
4. **Pattern:** **select → filter → map**, the array pipeline from Lesson 10 applied to elements.
5. **Plan:** query inside the function → spread → filter on `Number(dataset.stock)` → map to trimmed text.
6. **Code and test:** run it, then add `data-stock="0"` to another item in the HTML and run again.

</details>

<details>
<summary>💡 Hint 1</summary>

`document.querySelectorAll("#products li")` finds every item. Spread it into an array (`[...]`) so you can use `filter` and `map`.

</details>

<details>
<summary>💡 Hint 2</summary>

`li.dataset.stock` is a **string**, and `"0"` is truthy. Convert it: `Number(li.dataset.stock) > 0`.

</details>

<details>
<summary>💡 Hint 3</summary>

`.map((li) => li.textContent.trim())`, and do the query **inside** the function so each call sees the current page.

</details>

### 2. Total of an order table

Each row of the order table has the product's price in pence in `data-price`, and the quantity as the text of its `.qty` cell. Write `function orderTotal()` that returns the order's total in pence (price × quantity, added up over every row in the `<tbody>`).

Starter code:

```html
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

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a sum over rows of price × quantity, read from the page.
2. **Examples:** 600×2 + 800×1 + 450×3 = 3350; an empty table → 0.
3. **Brute force:** reading every `<td>` and guessing which is which: fragile. Use the `.qty` class and `data-price`.
4. **Pattern:** **query rows, then query inside each row**, and convert strings to numbers.
5. **Plan:** total = 0 → for each body row: price, qty → total += price × qty → return.
6. **Code and test:** change a quantity in the HTML and run again.

</details>

<details>
<summary>💡 Hint 1</summary>

Loop over `document.querySelectorAll("#order tbody tr")` with `for…of` (NodeLists are iterable). Selecting inside `tbody` skips the header row.

</details>

<details>
<summary>💡 Hint 2</summary>

In each row, `row.dataset.price` is the price and `row.querySelector(".qty").textContent` is the quantity. Both are strings.

</details>

<details>
<summary>💡 Hint 3</summary>

Convert both with `Number()` (it ignores spaces around a number), multiply, and add to a total that starts at `0`.

</details>

**In the sandbox:** exercises 51–52. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Names in stock</summary>

```html
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

**Line by line**

- `document.querySelectorAll("#products li")` returns a NodeList of the `<li>` elements inside `#products`, in page order.
- `[...]` turns it into a real array, so `filter` and `map` are available.
- `Number(li.dataset.stock) > 0` reads `data-stock` as a string and converts it; comparing the string directly (`li.dataset.stock > 0`) happens to work through coercion, but `if (li.dataset.stock)` would keep `"0"`.
- `li.textContent.trim()` removes the spaces and line breaks around the name.

**Trace:** the first call keeps tube (42), pump (7) and kit (60). After the changes, pump is `"0"` and is dropped; the new bell (15) is added at the end: tube, kit, bell.

**Common wrong approach:** running `querySelectorAll` once at the top of the script and reusing the result: that list is a snapshot, so the bell added later is never seen.

</details>

<details>
<summary>✅ 2. Total of an order table</summary>

```html
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

**Line by line**

- `#order tbody tr` selects only the body rows, so the `<thead>` row (which has no price) is skipped.
- `row.querySelector(".qty")` searches **inside that row**, so each row finds its own quantity cell.
- `Number(" 4 ")` is 4: `Number` trims whitespace. (`parseInt` would also work here.)
- The total starts at the number `0`, so `+=` adds numbers.

**Trace:** 1200 + 800 + 1350 = 3350. After the changes: 1200 + 3200 + 1350 + 3200 = 8950. Empty body: the loop never runs, so 0.

**Common wrong approach:** `total += row.dataset.price * row.querySelector(".qty").textContent` happens to work because `*` converts strings, but writing `total = total + price` with an unconverted price string concatenates: `"0600800…"`. Convert explicitly.

</details>

## Quick quiz

1. A script in <head> without defer runs document.querySelector("#cart") for a <ul id="cart"> in the body. What does it get?
   - A) null, because the element hasn't been parsed yet
   - B) The ul element
   - C) An error: querySelector can't run in head

2. What does document.querySelector(".item") return when there are three .item elements?
   - A) The first one
   - B) All three, in a NodeList
   - C) The last one

3. li has data-stock="0". What is Boolean(li.dataset.stock)?
   - A) true, because "0" is a non-empty string
   - B) false
   - C) 0

4. Which finds the li that contains a clicked button?
   - A) button.closest("li")
   - B) button.parentElement.parentElement
   - C) document.querySelector("li")

<details>
<summary>Quiz answers</summary>

1. **A) null, because the element hasn't been parsed yet**: Scripts run when the parser reaches them. Move the script to the end of body, or add defer.
2. **A) The first one**: Use querySelectorAll for every match.
3. **A) true, because "0" is a non-empty string**: data- attributes are always strings; convert with Number() first.
4. **A) button.closest("li")**: closest walks up the tree to the nearest match, however deep the button is nested.

</details>

---
Previous: [Lesson 25](25-async-patterns.md) · Next: [Lesson 27: Changing the page](27-changing-the-page.md)
