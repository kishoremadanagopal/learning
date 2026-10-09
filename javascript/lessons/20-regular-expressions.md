# Lesson 20: Regular expressions

**You'll learn:** regex literals and the RegExp constructor, literal characters, character classes, quantifiers, anchors and word boundaries, alternation, flags (g, i, m, s, u, v, y, d), test, match, matchAll, replace and split, capturing, named and non-capturing groups, replacement strings and functions, greedy versus lazy quantifiers, lookahead and lookbehind, Unicode property escapes, RegExp.escape, catastrophic backtracking, when to use a parser instead.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#regular-expressions)**: run every example and check your exercise answers.

## Key terms

- **Regular expression:** a pattern that describes text to match.
- **Character class:** a set of characters in brackets, such as `[a-z]`, or a shorthand such as `\d`.
- **Quantifier:** how many times something repeats, such as `+`, `*`, `?` or `{2,4}`.
- **Anchor:** a position, such as `^` (start) or `$` (end), rather than a character.
- **Capturing group:** a bracketed part of a pattern whose matched text is saved.
- **Named group:** a capturing group with a name, `(?<name>…)`.
- **Greedy / lazy:** matching as much as possible, or (with `?`) as little as possible.
- **Lookahead / lookbehind:** a check on what follows or precedes a position, without including it in the match.
- **Flag:** a letter after the pattern that changes how it matches, such as `g` or `i`.

A **regular expression** (regex) is a pattern for matching text: "a run of digits", "an email-shaped word", "a date like 2026-10-08". JavaScript writes them between slashes, `/pattern/flags`, or builds them from strings with `new RegExp(text, flags)`.

## The building blocks

| Pattern | Matches |
|---|---|
| `abc` | the literal text "abc" |
| `.` | any one character (except a line break, unless the `s` flag is used) |
| `\d`, `\w`, `\s` | a digit; a "word" character (letter, digit, `_`); whitespace |
| `\D`, `\W`, `\S` | the opposite of each |
| `[abc]`, `[a-z]`, `[^0-9]` | one of these; a range; anything **except** these |
| `^`, `$` | the start and end of the text (or of each line with `m`) |
| `\b` | a word boundary |
| `*`, `+`, `?` | 0 or more; 1 or more; 0 or 1 (optional) |
| `{3}`, `{2,4}`, `{2,}` | exactly 3; 2 to 4; 2 or more |
| `a\|b` | `a` or `b` |
| `\.`, `\*`, `\\` | a literal `.`, `*` or backslash (escape special characters) |

```js
const postcode = /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i;    // a simplified UK postcode
for (const p of ["BS1 5TR", "sw1a1aa", "12345"]) console.log(p, postcode.test(p));
```

## Flags

| Flag | Effect |
|---|---|
| `g` | global: find **all** matches (for `matchAll`, `replace`, `match`) |
| `i` | ignore case |
| `m` | multi-line: `^` and `$` match at each line |
| `s` | "dotAll": `.` also matches line breaks |
| `u` / `v` | Unicode mode (`v` is the newer, more powerful version): needed for `\p{…}` and correct emoji handling |
| `y` | sticky: match only at `lastIndex` |
| `d` | record the start and end positions of each group |

## Using regular expressions

```js
const text = "Order 1042 shipped 2026-10-08; order 1043 due 2026-10-15.";
console.log(/\d{4}-\d{2}-\d{2}/.test(text));                  // is there a match?
console.log(text.match(/\d{4}-\d{2}-\d{2}/)[0]);              // the first match
console.log(text.match(/\b\d{4}\b/g));                        // every 4-digit number, years included (g flag)
for (const m of text.matchAll(/order (\d+)/gi)) {             // every match, with its groups
  console.log(m[0], "→ number", m[1], "at index", m.index);
}
console.log(text.replace(/\d{4}-\d{2}-\d{2}/g, "[date]"));
console.log("a, b;c  d".split(/[,;\s]+/));
```

## Groups

Brackets **capture** part of a match. **Named groups** `(?<name>…)` make results readable; `(?:…)` groups without capturing:

```js
const re = /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/;
const m = "Shipped on 2026-10-08".match(re);
console.log(m.groups.day, m.groups.month, m.groups.year);
console.log("2026-10-08".replace(re, "$<day>/$<month>/$<year>"));   // use groups in the replacement
console.log("price: 12 GBP, 30 EUR".replace(/(\d+) (GBP|EUR)/g, (whole, amount, cur) =>
  cur === "GBP" ? `£${amount}` : `€${amount}`));                     // or a function
console.log(/^(?:https?):\/\//.test("https://example.com"));
```

## Greedy and lazy

Quantifiers are **greedy**: they match as much as possible. Add `?` to make them **lazy** (as little as possible):

```js
const html = "<b>bold</b> and <i>italic</i>";
console.log(html.match(/<.+>/)[0]);        // greedy: from the first < to the LAST >
console.log(html.match(/<.+?>/g));         // lazy: each tag separately
```

## Lookarounds

Lookarounds check what comes before or after **without** including it in the match:

| Syntax | Means |
|---|---|
| `x(?=y)` | x followed by y |
| `x(?!y)` | x not followed by y |
| `(?<=y)x` | x preceded by y |
| `(?<!y)x` | x not preceded by y |

```js
console.log("£12 $30 £7".match(/(?<=£)\d+/g));                     // amounts after a £ sign
console.log("1234567".replace(/\B(?=(\d{3})+(?!\d))/g, ","));      // thousands separators (Lesson 4)
```

## Unicode

`\w` only matches the English letters A–Z. With the `u` (or `v`) flag, `\p{…}` matches by Unicode property, so patterns work for every language:

```js
console.log("Ünïcødé café 東京".match(/\w+/g));
console.log("Ünïcødé café 東京".match(/\p{L}+/gu));    // \p{L}: any letter in any script
```

## Building patterns from text safely

When a pattern contains text from a user or a variable, special characters like `.` or `*` must be escaped. `RegExp.escape` (ECMAScript 2025, in all current browsers) does it:

```js
const search = "1.5*2";
const naive = new RegExp(search);              // . and * are treated as pattern syntax!
const safe = new RegExp(RegExp.escape(search));
console.log(naive.test("135552"), safe.test("135552"), safe.test("the 1.5*2 rule"));
```

## When not to use a regular expression

Regexes are great for small, regular patterns. They're the wrong tool for nested structures (HTML, JSON, code: use a parser), for fully validating emails or URLs (use `new URL(text)` or a proper library, and for emails, send a confirmation link), and for anything a few string methods express more clearly. Complex patterns can also become extremely slow on certain inputs (**catastrophic backtracking**), so keep them simple, and test them on long, non-matching text.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Does it match? | /pattern/.test(text) | O(n) typically | O(1) |
| All matches with groups | text.matchAll(/(?<name>…)/g) | O(n) typically | O(matches) |
| Replace with logic | text.replace(/…/g, (m, …groups) => …) | O(n) | O(n) |
| Search for user text | new RegExp(RegExp.escape(term), "gi") | O(n) | O(term) |

## Common mistakes

- Forgetting the `g` flag and replacing only the first match.
- Building a RegExp from user text without escaping it.
- Using greedy `.+` where a lazy `.+?` was meant.
- Forgetting `^` and `$`, so a pattern matches part of the text.
- Parsing HTML or JSON with regular expressions.

## Exercises

### 1. Parse a log line

Log lines look like `2026-10-08 14:03:59 [ERROR] payment-service: Card declined (code 51)`. Write `parseLogLine(line)` returning `{ date, time, level, service, message }` (all strings), or `null` if the line doesn't have this shape. `level` is one of `DEBUG`, `INFO`, `WARN` or `ERROR`; the service name is letters, digits and hyphens; the message is everything after `": "` (and may be empty).

Starter code:

```js
function parseLogLine(line) {
  // your code here
}

console.log(parseLogLine("2026-10-08 14:03:59 [ERROR] payment-service: Card declined (code 51)"));
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a fixed layout; extract five fields; reject anything else.
2. **Examples:** the message can contain colons, so only the first `": "` after the service ends it.
3. **Brute force:** `split(" ")` and index juggling: fragile with spaces in messages.
4. **Pattern:** **one anchored regex with named groups**.
5. **Plan:** write the pattern part by part → `exec` → copy the groups.
6. **Code and test:** each level, empty messages, colons in messages, malformed dates, extra text.

</details>

<details>
<summary>💡 Hint 1</summary>

Use named groups for each part: `(?<date>\d{4}-\d{2}-\d{2})`, `(?<time>…)` and so on, with `^` and `$` so the whole line must match.

</details>

<details>
<summary>💡 Hint 2</summary>

The level is an alternation inside literal brackets: `\[(?<level>DEBUG|INFO|WARN|ERROR)\]` (square brackets must be escaped).

</details>

<details>
<summary>💡 Hint 3</summary>

The service is `(?<service>[A-Za-z0-9-]+)`, then `: `, then `(?<message>.*)` for the rest. Return `{ ...m.groups }`, or `null` when there's no match.

</details>

### 2. Highlight search terms

Write `highlight(text, term)` that wraps every occurrence of `term` in `text` with `<mark>` and `</mark>`, ignoring case but keeping the original text's capitals. The term may contain characters such as `.`, `*` or `(` that must be treated literally. An empty term returns the text unchanged.

Starter code:

```js
function highlight(text, term) {
  // your code here
}

console.log(highlight("Tubes, tubeless tyres and TUBE repairs", "tube"));
// <mark>Tube</mark>s, <mark>tube</mark>less tyres and <mark>TUBE</mark> repairs
console.log(highlight("Version 1.5 (beta), not 125", "1.5"));
// Version <mark>1.5</mark> (beta), not 125
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** case-insensitive search for literal text; keep the matched text exactly.
2. **Examples:** "1.5" must not match "125", which an unescaped `.` would.
3. **Brute force:** lower-case both and use `indexOf` in a loop, slicing the original: works, more code.
4. **Pattern:** **escaped dynamic regex + replacement function**.
5. **Plan:** empty check → escape → RegExp with g and i → replace with a function.
6. **Code and test:** case, dots, brackets, asterisks, dollar signs, no match, empty term.

</details>

<details>
<summary>💡 Hint 1</summary>

Build the pattern from the term with `new RegExp(…, "gi")`: `g` for every match, `i` to ignore case.

</details>

<details>
<summary>💡 Hint 2</summary>

Escape the term first so `.` and `(` are literal: `RegExp.escape(term)` in current browsers, or `term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")`.

</details>

<details>
<summary>💡 Hint 3</summary>

Replace with a function, `(match) => \`<mark>${match}</mark>\``, so the original capitals are kept. (A replacement string containing `$` would be read specially.)

</details>

**In the sandbox:** exercises 39–40. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Parse a log line</summary>

```js
const LOG_LINE = /^(?<date>\d{4}-\d{2}-\d{2}) (?<time>\d{2}:\d{2}:\d{2}) \[(?<level>DEBUG|INFO|WARN|ERROR)\] (?<service>[A-Za-z0-9-]+): (?<message>.*)$/;

function parseLogLine(line) {
  const m = LOG_LINE.exec(line);
  return m ? { ...m.groups } : null;
}

console.log(parseLogLine("2026-10-08 14:03:59 [ERROR] payment-service: Card declined (code 51)"));
```

**Line by line**

- `^` and `$` make the whole line match, so extra text at the start is rejected.
- `\[` and `\]` match literal square brackets; inside them, `DEBUG|INFO|WARN|ERROR` allows only the four levels.
- The service pattern `[A-Za-z0-9-]+` can't contain `:` or spaces, so the first `": "` after it is the separator.
- `.*` takes the rest of the line, including further colons or nothing at all.
- `{ ...m.groups }` copies the named groups into a plain object.

**Trace:** "…[ERROR] payment-service: Card declined (code 51)" → date, time, level ERROR, service payment-service, message "Card declined (code 51)".

**Common wrong approach:** `line.split(": ")`, which splits messages that contain ": " into pieces. A pattern that describes the whole line is both stricter and clearer.

</details>

<details>
<summary>✅ 2. Highlight search terms</summary>

```js
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");      // the same job as RegExp.escape
}

function highlight(text, term) {
  if (term === "") return text;
  const pattern = new RegExp(escapeRegex(term), "gi");
  return text.replace(pattern, (match) => `<mark>${match}</mark>`);
}

console.log(highlight("Tubes, tubeless tyres and TUBE repairs", "tube"));
console.log(highlight("Version 1.5 (beta), not 125", "1.5"));
```

**Line by line**

- Without escaping, `"1.5"` becomes the pattern "1, any character, 5", which matches "125".
- The escape pattern puts a backslash before each special character; `$&` in a replacement string means "the whole match".
- A replacement **function** receives the actual matched text ("Tube", "TUBE"), so capitals survive, and its return value is used literally, so a `$` in the matched text is safe.
- The empty-term check matters: `new RegExp("", "g")` matches between every character.

**Trace:** "Version 1.5 (beta), not 125" with "1.5" → pattern `1\.5` → only "1.5" matches → wrapped.

**Common wrong approach:** `new RegExp(term, "gi")` without escaping: search terms like "c++" or "(beta)" throw a `SyntaxError` or match the wrong things. In real pages, also escape the text for HTML before adding tags, or a term like `<script>` could inject markup (Part 5).

</details>

## Quick quiz

1. What does the g flag do?
   - A) Finds every match instead of only the first
   - B) Ignores case
   - C) Makes . match line breaks

2. On "<b>x</b>", what does /<.+>/ match?
   - A) The whole string, because + is greedy
   - B) Just <b>
   - C) Nothing

3. Why escape user text before putting it in a RegExp?
   - A) Characters like . * ( would be treated as pattern syntax
   - B) RegExp only accepts lower-case text
   - C) To make the match case-insensitive

4. Which pattern matches a letter in any language?
   - A) /\p{L}/u
   - B) /\w/
   - C) /[a-zA-Z]/

<details>
<summary>Quiz answers</summary>

1. **A) Finds every match instead of only the first**: Needed for matchAll and for replacing all matches.
2. **A) The whole string, because + is greedy**: Use <.+?> for the shortest match.
3. **A) Characters like . * ( would be treated as pattern syntax**: RegExp.escape or a small escape function does it.
4. **A) /\p{L}/u**: \w covers only A–Z, digits and _.

</details>

---
Previous: [Lesson 19](19-iterators-and-generators.md) · Next: [Lesson 21: The event loop](21-event-loop.md)
