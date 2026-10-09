# Lesson 29: Forms and user input

**You'll learn:** form controls and labels, name attributes, values are strings, valueAsNumber, checked, select and radio values, form.elements, FormData, Object.fromEntries and getAll, submit buttons and type="button", the submit event and preventDefault, required, type, min, max, pattern and minlength, checkValidity, reportValidity, validity and setCustomValidity, novalidate, :user-invalid, the input event for live feedback, sending forms with fetch, disabling the button while sending, server-side validation.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#forms)**: run every example and check your exercise answers.

## Key terms

- **Form control:** an input, select, textarea or button that a user can interact with.
- **`<label>`:** the visible name of a control; linked with `for`, it's read by screen readers and clickable.
- **`name` attribute:** the key a control's value is sent under, and how `form.elements` finds it.
- **`valueAsNumber`:** a number input's value as a number (`NaN` when empty).
- **`FormData`:** all of a form's named values, as the browser would send them.
- **Submit event:** fired on a form when it's submitted by a button or by Enter, after validation passes.
- **Constraint validation:** the browser's built-in checks from attributes like `required`, `min` and `pattern`.
- **`setCustomValidity`:** marks a control invalid with your own message (an empty string clears it).
- **Live region:** an element (such as `role="status"`) whose changes screen readers announce.

Forms are how users give a page information: a search box, a checkout, a login. HTML already does a lot of the work: controls, labels, keyboard support and validation. JavaScript reads the values, checks them and sends them.

## Controls and labels

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

## FormData: every value at once

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

## Handling submit

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

## Built-in validation

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

## Live feedback

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

## Sending a form with fetch

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

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Read one control | form.elements.name.value (or valueAsNumber, checked) | O(1) | O(1) |
| Read the whole form | Object.fromEntries(new FormData(form)) | O(controls) | O(controls) |
| Handle sending | submit listener + preventDefault + try / finally | O(1) + the request | O(1) |
| Validate | HTML attributes, checkValidity, setCustomValidity; again on the server | O(controls) | O(1) |

## Common mistakes

- Doing arithmetic with input values without converting them from strings.
- Handling the button's `click` instead of the form's `submit`.
- Forgetting `preventDefault()`, so the page reloads and the result disappears.
- Leaving the submit button enabled while a request is in flight, allowing duplicate orders.
- Relying on browser validation for security instead of validating on the server.

## Exercises

### 1. Live price

Show the price of the order as the user changes it. `#product` options have the product id as their `value` and the price in pence in `data-price`; `#qty` is the quantity.

Whenever either control changes (use the `input` event), set `#total` to the price × quantity in pounds, like `£18.00`. If the quantity isn't a whole number of at least 1 (for example empty, `0` or `2.5`), show `—` instead. Show the right total as soon as the page loads, too.

Starter code:

```html
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

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a derived value (total) that must follow two inputs, with an invalid state.
2. **Examples:** pump × 3 → £96.00; empty → —; 2.5 → —.
3. **Brute force:** separate listeners on each control with duplicated maths.
4. **Pattern:** **one render function** called on load and on every `input`.
5. **Plan:** read price from the selected option → read quantity as a number → validate → format → write.
6. **Code and test:** change both controls in the preview, including clearing the quantity.

</details>

<details>
<summary>💡 Hint 1</summary>

`product.selectedOptions[0]` is the chosen `<option>`; its `dataset.price` is the price as a string.

</details>

<details>
<summary>💡 Hint 2</summary>

`qty.valueAsNumber` is `NaN` when the box is empty. `Number.isInteger(n) && n >= 1` rules out `NaN`, `0` and `2.5` in one test.

</details>

<details>
<summary>💡 Hint 3</summary>

Put the calculation in a function, call it from an `input` listener (one on the form hears both controls, because `input` bubbles), and call it once at the start.

</details>

### 2. Send the order form

Make the form place an order with the practice API. On **submit**:

1. stop the page reloading and disable the submit button;
2. POST `{ customer, items: [{ productId, qty }] }` as JSON to `https://shop.example/api/orders`, with the trimmed customer name and the product id and quantity as **numbers**;
3. on success, set `#status` to `Order <id> placed` (for example `Order 1002 placed`) and remove the class `error` from it;
4. if the server answers with an error status, set `#status` to the `error` text from the response body and add the class `error`;
5. always re-enable the button at the end.

Starter code:

```html
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

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** submit → send JSON → show success or the server's error → always restore the button.
2. **Examples:** 2 tubes for Bo → "Order 1002 placed"; 50 pumps → "Only 7 Floor pump in stock" in red.
3. **Brute force:** a `click` listener on the button, without `preventDefault`: Enter in a field skips it, and the page reloads.
4. **Pattern:** **submit handler + try / catch / finally** around the request.
5. **Plan:** preventDefault → disable → build body (numbers!) → fetch → json → !ok throw → success text; catch → error text and class; finally → enable.
6. **Code and test:** a valid order, too many pumps, then a valid order again (the error class must go).

</details>

<details>
<summary>💡 Hint 1</summary>

`form.addEventListener("submit", async (e) => { e.preventDefault(); … })`. The listener can be `async`, so you can `await fetch` inside it.

</details>

<details>
<summary>💡 Hint 2</summary>

Build the body from `form.elements`: `.customer.value.trim()`, `Number(.product.value)` and `.qty.valueAsNumber`. Send it with `method: "POST"`, a JSON `Content-Type` header and `JSON.stringify`.

</details>

<details>
<summary>💡 Hint 3</summary>

Read `await res.json()`, `throw new Error(data.error)` when `!res.ok`, show the message and add the `error` class in `catch`, and set `button.disabled = false` in `finally`.

</details>

**In the sandbox:** exercises 57–58. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Live price</summary>

```html
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

**Line by line**

- `selectedOptions[0].dataset.price` reads the price from the chosen option; `Number` converts it.
- `valueAsNumber` gives a number directly for `type="number"`, or `NaN` when empty.
- `Number.isInteger(n)` is false for `NaN` and `2.5`, so together with `n < 1` it covers every invalid quantity.
- The listener is on the form: `input` events from the select and the number box both bubble to it.
- Calling `showTotal()` once at the end fills in the total before the user does anything.

**Trace:** load: tube × 1 → £6.00; qty 3 → £18.00; pump → 3200 × 3 = 9600 → £96.00; empty → —.

**Common wrong approach:** `price * qty.value`: it works for "3" (the `*` converts), but empty becomes 0 and shows "£0.00" instead of "—", and `2.5` shows a price for half a pump.

</details>

<details>
<summary>✅ 2. Send the order form</summary>

```html
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

**Line by line**

- `submit` fires for the button and for Enter, and only when the built-in validation passes (`required`, `min`).
- `preventDefault()` keeps the page; disabling the button prevents a second order while the first is in flight.
- `Number(form.elements.product.value)` and `valueAsNumber` send numbers: the API rejects `"2"` as a quantity.
- The API answers with JSON both times, so the body is read before checking `res.ok`; an error status becomes a thrown `Error` carrying the server's message.
- `catch` shows the message and adds `error`; the success path removes it, so an old error style doesn't stick.
- `finally` re-enables the button whether the order worked or not.

**Trace:** Bo, tube × 2 → 201 `{ id: 1002 }` → "Order 1002 placed". Pump × 50 → 409 → "Only 7 Floor pump in stock", red. Pump × 1 → 1003, red removed.

**Common wrong approach:** re-enabling the button only after success: after one error the button stays disabled forever. `finally` exists for exactly this.

</details>

## Quick quiz

1. An <input type="number"> shows 5. What is input.value?
   - A) "5" (a string)
   - B) 5 (a number)
   - C) undefined

2. Why listen for submit on the form instead of click on its button?
   - A) submit also fires when the user presses Enter, and only after validation passes
   - B) click doesn't work on buttons inside forms
   - C) submit is faster

3. What does Object.fromEntries(new FormData(form)) leave out?
   - A) Unchecked checkboxes (and all but one value of repeated names)
   - B) Number inputs
   - C) Select boxes

4. The form has required fields and pattern rules. Can the server skip validating the data?
   - A) No: client-side checks can be bypassed, so the server must check again
   - B) Yes, the browser already did it
   - C) Only if novalidate isn't set

<details>
<summary>Quiz answers</summary>

1. **A) "5" (a string)**: Every value is a string; use valueAsNumber or Number().
2. **A) submit also fires when the user presses Enter, and only after validation passes**: One submit listener covers every way of submitting.
3. **A) Unchecked checkboxes (and all but one value of repeated names)**: Use getAll for repeated names, and has to test checkboxes.
4. **A) No: client-side checks can be bypassed, so the server must check again**: Browser validation is a convenience for users, not security.

</details>

---
Previous: [Lesson 28](28-events.md) · Next: [Lesson 30: Project: a product browser](30-product-browser.md)
