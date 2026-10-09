@@ the-dom
topics: what HTML, CSS and JavaScript each do, the page preview, the DOM tree, element and text nodes, document, where to put script tags (end of body, defer, type="module"), DOMContentLoaded and load, CSS selectors, querySelector and querySelectorAll, NodeList versus array, getElementById, textContent and innerText, attributes versus properties, data- attributes and dataset, closest, matches, parentElement, children and siblings
terms:
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
mistakes:
- Running a script before the elements it looks for exist, and getting `null`.
- Forgetting `#` or `.` in a selector (`querySelector("cart")` looks for a `<cart>` tag).
- Calling `map` or `filter` directly on a `NodeList`.
- Treating `data-` attribute values as numbers: `"0"` is truthy.
- Querying once and expecting the result to include elements added later.

glance:
- Find one element | querySelector(css) or getElementById(id) | O(n) elements in the worst case | O(1)
- Find all matches | [...querySelectorAll(css)] | O(n) | O(matches)
- Find the item a click belongs to | target.closest(selector) | O(depth) | O(1)
- Read custom data | el.dataset.name, then Number() if needed | O(1) | O(1)

@@ changing-the-page
topics: textContent for text, innerHTML and cross-site scripting, setHTML and sanitizing, createElement, append, prepend, before, after, replaceWith, replaceChildren and remove, moving and cloning elements, attributes versus properties, boolean attributes (hidden, disabled), classList add, remove, toggle and contains, inline styles and CSS custom properties, template elements, building lists in one update, layout thrashing
terms:
- **`innerHTML`:** an element's content as HTML text; setting it parses the string as HTML.
- **Cross-site scripting (XSS):** an attack where data inserted as HTML runs the attacker's code in your page.
- **Sanitize:** remove dangerous parts (scripts, event handlers) from HTML before inserting it.
- **`createElement`:** makes a new element that isn't in the page until you insert it.
- **`replaceChildren`:** replaces all of an element's children with the given nodes (or none).
- **Boolean attribute:** an attribute that's on when present, whatever its value, like `disabled` or `hidden`.
- **`classList`:** an element's classes, with `add`, `remove`, `toggle` and `contains`.
- **`<template>`:** HTML that isn't shown, kept to be cloned with `content.cloneNode(true)`.
- **Layout thrashing:** forcing the browser to recalculate layout repeatedly by mixing page changes and layout reads.
mistakes:
- Putting user or API data into `innerHTML`.
- Using `innerHTML +=` to add items, which re-parses everything and duplicates on re-render.
- Setting `setAttribute("disabled", "false")` and expecting the element to be enabled.
- Styling with many inline `style` assignments instead of toggling a class.
- Appending a template's `content` directly, which empties the template after the first use.

glance:
- Show outside data | el.textContent = value | O(length) | O(length)
- Render a list | build elements, then parent.replaceChildren(...items) | O(n) | O(n)
- Switch a visual state | el.classList.toggle(name, condition) | O(1) | O(1)
- Repeat a block of markup | clone a template's content and fill it | O(size of block) | O(size of block)

@@ events
topics: addEventListener, the event object, target and currentTarget, click, input, change, keydown and event.key, focus and blur, pointer events, default actions and preventDefault, capture and bubbling, stopPropagation, event delegation with closest, once, passive and signal options, removeEventListener, AbortController for listeners, CustomEvent and dispatchEvent, inline onclick attributes, accessible buttons
terms:
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
mistakes:
- Adding one listener per item instead of delegating, so items added later don't work.
- Checking `e.target` directly when the click may land on a child element; use `closest`.
- Trying to `removeEventListener` with a different (inline arrow) function.
- Using `stopPropagation` to fix problems, which breaks other listeners further up.
- Making clickable `<div>`s instead of `<button>`s.

glance:
- React to a click | el.addEventListener("click", handler) | O(1) per event | O(1)
- Many similar items | one listener on the container + closest | O(depth) per event | O(1) listeners
- Cancel the browser's action | event.preventDefault() | O(1) | O(1)
- Remove many listeners | pass { signal } and call controller.abort() | O(listeners) | O(1)

@@ forms
topics: form controls and labels, name attributes, values are strings, valueAsNumber, checked, select and radio values, form.elements, FormData, Object.fromEntries and getAll, submit buttons and type="button", the submit event and preventDefault, required, type, min, max, pattern and minlength, checkValidity, reportValidity, validity and setCustomValidity, novalidate, :user-invalid, the input event for live feedback, sending forms with fetch, disabling the button while sending, server-side validation
terms:
- **Form control:** an input, select, textarea or button that a user can interact with.
- **`<label>`:** the visible name of a control; linked with `for`, it's read by screen readers and clickable.
- **`name` attribute:** the key a control's value is sent under, and how `form.elements` finds it.
- **`valueAsNumber`:** a number input's value as a number (`NaN` when empty).
- **`FormData`:** all of a form's named values, as the browser would send them.
- **Submit event:** fired on a form when it's submitted by a button or by Enter, after validation passes.
- **Constraint validation:** the browser's built-in checks from attributes like `required`, `min` and `pattern`.
- **`setCustomValidity`:** marks a control invalid with your own message (an empty string clears it).
- **Live region:** an element (such as `role="status"`) whose changes screen readers announce.
mistakes:
- Doing arithmetic with input values without converting them from strings.
- Handling the button's `click` instead of the form's `submit`.
- Forgetting `preventDefault()`, so the page reloads and the result disappears.
- Leaving the submit button enabled while a request is in flight, allowing duplicate orders.
- Relying on browser validation for security instead of validating on the server.

glance:
- Read one control | form.elements.name.value (or valueAsNumber, checked) | O(1) | O(1)
- Read the whole form | Object.fromEntries(new FormData(form)) | O(controls) | O(controls)
- Handle sending | submit listener + preventDefault + try / finally | O(1) + the request | O(1)
- Validate | HTML attributes, checkValidity, setCustomValidity; again on the server | O(controls) | O(1)

@@ product-browser
topics: state and a single render function, loading, empty and error states, retry buttons, filtering loaded data in memory, debouncing search input, cancelling stale requests with AbortController, ARIA live regions, localStorage for preferences and its limits, how frameworks such as React, Vue and Svelte build on the same idea
terms:
- **State:** the data that determines what the page shows at any moment.
- **Render function:** a function that updates the page to match the current state.
- **Loading / empty / error states:** what the page shows while waiting, when there's nothing to show, and when something failed.
- **Stale response:** a response to an old request that arrives after a newer one.
- **`localStorage`:** small, persistent string storage per site, kept in the browser.
- **Framework:** a library such as React, Vue or Svelte that turns state into DOM updates for you.
mistakes:
- Changing the page from many places, so it can drift out of sync with the data.
- Showing an empty list while loading or after an error, with no explanation.
- Letting an old response overwrite newer results.
- Filtering the loaded data in place, losing items for the next search.
- Storing tokens or passwords in `localStorage`, or assuming it's always available.

glance:
- Keep the page consistent | state object + one render() | O(rendered items) per update | O(state)
- Search loaded data | filter a copy, case-insensitive, on input | O(n) per search | O(matches)
- Avoid stale results | abort the previous request before starting a new one | O(1) | O(1)
- Remember a preference | localStorage.setItem / getItem inside try / catch | O(size) | O(size)
