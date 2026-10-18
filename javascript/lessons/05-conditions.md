# Lesson 5: Comparisons and conditions

**You'll learn:** comparison operators, strict and loose equality, comparing objects by identity, truthy and falsy values, logical operators and short-circuiting, defaults with || and ??, nullish assignment ??=, optional chaining ?., if / else if / else, the conditional (ternary) operator, switch and fall-through.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#conditions)**: run every example and check your exercise answers.

## Key terms

- **Strict equality (`===`):** true when both values have the same type and value.
- **Loose equality (`==`):** compares after converting types; best avoided.
- **Truthy / falsy:** how a value behaves when JavaScript needs true or false; falsy values are `false`, `0`, `-0`, `0n`, `""`, `null`, `undefined` and `NaN`.
- **Short-circuiting:** `&&` and `||` stop evaluating as soon as the result is known.
- **Nullish coalescing (`??`):** gives the right-hand value only when the left is `null` or `undefined`.
- **Optional chaining (`?.`):** reads a property or calls a method only if the value before it isn't `null` or `undefined`.
- **Ternary operator:** `condition ? a : b`, an expression that picks one of two values.
- **Fall-through:** in a switch, running on into the next case when there's no `break` or `return`.

Programs make decisions by comparing values and branching on the result.

## Comparisons

| Operator | Means |
|---|---|
| `===`, `!==` | strictly equal / not equal: same type **and** same value |
| `==`, `!=` | loosely equal: converts types first (avoid) |
| `<`, `>`, `<=`, `>=` | ordering |

```js
console.log(5 === 5, 5 === "5", 5 == "5");
console.log(0 == "", null == undefined, null === undefined);
console.log("10" < "9", 10 < 9);       // strings compare character by character
```

**Always use `===` and `!==`.** Loose `==` converts types by complicated rules (`0 == ""` is `true`!). The one common exception some style guides allow is `x == null`, which is true for both `null` and `undefined`.

Objects (including arrays) compare by **identity**, not contents: `[1] === [1]` is `false`, because they're two different arrays (Part 2).

## Truthy and falsy

Anywhere JavaScript expects a true/false value, it converts. Exactly these values are **falsy**:

`false`, `0`, `-0`, `0n`, `""`, `null`, `undefined`, `NaN`

Everything else is **truthy**, including `"0"`, `"false"`, `[]` and `{}`.

```js
const answers = [0, "", "0", [], null, "hi", NaN];
for (const v of answers) {
  const shown = typeof v === "string" ? `"${v}"` : v;
  console.log(shown, v ? "truthy" : "falsy");
}
```

## Logical operators

`&&` (and), `||` (or) and `!` (not) combine conditions. They **short-circuit**: the right side runs only if needed, and the result is one of the operands, not necessarily `true` or `false`:

```js
console.log(true && "yes", 0 && "yes");       // && gives the first falsy value, or the last value
console.log("" || "default", "set" || "default");   // || gives the first truthy value
console.log(!true, !!"text");                 // !! converts to a boolean
```

## Defaults: `||` versus `??`

`a || b` falls back for **any** falsy `a`, including `0` and `""`, which are often real values. The **nullish coalescing** operator `a ?? b` falls back only when `a` is `null` or `undefined`:

```js
const order = { quantity: 0, note: "" };
console.log(order.quantity || 1, order.quantity ?? 1);   // 1 versus 0
console.log(order.note || "(none)", order.note ?? "(none)");
let discount;
discount ??= 0.1;              // assign only if null or undefined
console.log(discount);
```

## Optional chaining: `?.`

Reading a property of `undefined` throws a `TypeError`. `?.` stops early and gives `undefined` instead:

```js
const customer = { name: "Ada", address: null };
console.log(customer.address?.city);           // undefined, no error
console.log(customer.address?.city ?? "unknown city");
console.log(customer.greet?.());               // call a method only if it exists
```

## if, else if, else

```js
function shippingCost(total) {
  if (total >= 50) {
    return 0;
  } else if (total >= 20) {
    return 2.99;
  } else {
    return 4.99;
  }
}
console.log(shippingCost(65), shippingCost(30), shippingCost(5));
```

Conditions are checked top to bottom, and the first true branch wins, so put the most specific conditions first. Always use braces `{ }`, even for one-line branches; it prevents a classic bug when a second line is added later.

## The conditional (ternary) operator

`condition ? a : b` is an **expression** that picks a value, handy inside template literals and assignments:

```js
const stock = 0;
console.log(`Status: ${stock > 0 ? "in stock" : "sold out"}`);
```

Keep ternaries short; nested ones are hard to read, so use `if` instead.

## switch

`switch` compares one value against several cases with `===`:

```js
function sizeLabel(code) {
  switch (code) {
    case "S":
      return "Small";
    case "M":
      return "Medium";
    case "L":
    case "XL":                 // two cases sharing one result
      return "Large";
    default:
      return "Unknown size";
  }
}
console.log(sizeLabel("M"), sizeLabel("XL"), sizeLabel("XXL"));
```

Without `return` or `break`, execution **falls through** into the next case. Forgetting `break` is a common bug; returning from each case, as above, avoids it.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Default for missing values | value ?? fallback | O(1) | O(1) |
| Safe nested read | a?.b?.c | O(depth) | O(1) |
| Ranges | guard invalid input, then thresholds from the top | O(cases) | O(1) |
| Many exact cases | switch with return in each case | O(cases) | O(1) |

## Common mistakes

- Using `==` and getting surprising matches such as `0 == ""`.
- Defaulting with `||` and losing valid values like `0` or `""`.
- Reading a nested property without `?.` and crashing on `undefined`.
- Forgetting `break` in a `switch`.
- Writing `if (x = 5)` (assignment) instead of `if (x === 5)`.

## Exercises

### 1. Grade a score

Write `grade(score)` returning a letter: `"A"` for 90–100, `"B"` for 80–89.99…, `"C"` for 70 up to 80, `"D"` for 60 up to 70, and `"F"` below 60. Scores outside 0–100, or anything that isn't a number (including `NaN`), give `"invalid"`.

Starter code:

```js
function grade(score) {
  // your code here
}

console.log(grade(95), grade(80), grade(79.5), grade(12), grade(101), grade("90"));
// A B C F invalid invalid
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** five bands plus an invalid case; boundaries belong to the higher grade.
2. **Examples:** exactly 80 → B; 79.5 → C.
3. **Brute force:** each band with both bounds (`score >= 80 && score < 90`): works, but repetitive.
4. **Pattern:** **guard clause, then ordered thresholds**.
5. **Plan:** validate → test thresholds from highest down → default F.
6. **Code and test:** every boundary, decimals, strings, NaN, undefined.

</details>

<details>
<summary>💡 Hint 1</summary>

Reject invalid input first, then check the bands from the top down.

</details>

<details>
<summary>💡 Hint 2</summary>

`typeof score !== "number"` rejects strings and `undefined`; `NaN` is a number, so test it with `Number.isNaN`.

</details>

<details>
<summary>💡 Hint 3</summary>

With the invalid cases gone, `if (score >= 90) return "A"; if (score >= 80) return "B"; …` works because each check only runs if the ones above failed.

</details>

### 2. Delivery details with defaults

An order object may be missing details. Write `deliveryLabel(order)` returning `"<name>: <city> (<days> days)"` where:

- `name` is `order.customer.name`, or `"Guest"` if the customer or name is missing;
- `city` is `order.customer.address.city`, or `"no address"` if any part is missing;
- `days` is `order.days`, defaulting to `3` **only** when it's `null` or `undefined` (0 is a valid number of days).

Starter code:

```js
function deliveryLabel(order) {
  // your code here
}

console.log(deliveryLabel({ customer: { name: "Ada", address: { city: "Bristol" } }, days: 0 }));
// Ada: Bristol (0 days)
console.log(deliveryLabel({}));
// Guest: no address (3 days)
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** safe nested reads, and defaults only for missing values.
2. **Examples:** `days: 0` must stay 0; `days: null` becomes 3.
3. **Brute force:** nested `if (order.customer && order.customer.address && …)` checks: works, but long.
4. **Pattern:** **optional chaining plus nullish coalescing**.
5. **Plan:** three safe reads with defaults → template literal.
6. **Code and test:** each missing level, null versus undefined, falsy-but-valid values.

</details>

<details>
<summary>💡 Hint 1</summary>

Optional chaining `?.` reads nested properties without crashing when something along the way is `null` or `undefined`.

</details>

<details>
<summary>💡 Hint 2</summary>

Use `??` (not `||`) for defaults, so `0` days and an empty-string name are kept.

</details>

<details>
<summary>💡 Hint 3</summary>

`const city = order.customer?.address?.city ?? "no address";`, then build the string with a template literal.

</details>

**In the sandbox:** exercises 9–10. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Grade a score</summary>

```js
function grade(score) {
  if (typeof score !== "number" || Number.isNaN(score) || score < 0 || score > 100) {
    return "invalid";
  }
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

console.log(grade(95), grade(80), grade(79.5), grade(12), grade(101), grade("90"));
```

**Line by line**

- The guard combines all invalid cases; `"90"` is rejected even though `"90" >= 90` would be `true` (JavaScript would convert it).
- Returning early means each later `if` only needs a lower bound: if `score >= 90` failed, the score is below 90.
- The final `return "F"` covers 0 up to 60.

**Trace:** `grade(79.5)` → valid → not ≥ 90, not ≥ 80, ≥ 70 → `"C"`.

**Common wrong approach:** checking `score > 90` instead of `>=`, so exactly 90 drops to B. Boundary values are where grading bugs live: always test them.

</details>

<details>
<summary>✅ 2. Delivery details with defaults</summary>

```js
function deliveryLabel(order) {
  const name = order.customer?.name ?? "Guest";
  const city = order.customer?.address?.city ?? "no address";
  const days = order.days ?? 3;
  return `${name}: ${city} (${days} days)`;
}

console.log(deliveryLabel({ customer: { name: "Ada", address: { city: "Bristol" } }, days: 0 }));
console.log(deliveryLabel({}));
```

**Line by line**

- `order.customer?.name` gives `undefined` (instead of throwing) when `customer` is `null` or `undefined`.
- `?? "Guest"` applies only when the result is `null` or `undefined`; an empty name `""` is kept, as the specification says.
- `order.days ?? 3` keeps `0`, where `order.days || 3` would wrongly replace it.

**Trace:** `{ customer: null, days: null }` → name: `null?.name` → `undefined` → "Guest"; city likewise → "no address"; days: `null ?? 3` → 3.

**Common wrong approach:** `order.days || 3`, which turns a same-day order (0 days) into 3 days. Use `||` only when every falsy value should be replaced.

</details>

## Quick quiz

1. Why prefer === over ==?
   - A) === is faster to type
   - B) == doesn't work on strings
   - C) === doesn't convert types, so there are no surprising matches like 0 == ""

2. Which of these is truthy?
   - A) 0
   - B) null
   - C) ""
   - D) "0"

3. What does 0 ?? 5 evaluate to?
   - A) null
   - B) 5
   - C) 0

4. What happens if a switch case has no break or return?
   - A) Execution falls through into the next case
   - B) It's a syntax error
   - C) JavaScript adds a break automatically

<details>
<summary>Quiz answers</summary>

1. **C) === doesn't convert types, so there are no surprising matches like 0 == ""**: Use === and !== everywhere.
2. **D) "0"**: Any non-empty string is truthy, even "0" and "false".
3. **C) 0**: ?? only falls back for null and undefined.
4. **A) Execution falls through into the next case**: Return from each case, or add break.

</details>

---
Previous: [Lesson 4](04-numbers.md) · Next: [Lesson 6: Loops](06-loops.md)
