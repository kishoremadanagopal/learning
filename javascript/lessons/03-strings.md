# Lesson 3: Strings and template literals

**You'll learn:** single, double and backtick quotes, template literals and ${…}, multi-line strings, escape sequences, length, indexes and at(), immutability, trim, case, includes, startsWith, endsWith, indexOf, slice, replace and replaceAll, padStart, repeat, split and join, comparing strings, UTF-16 and emoji length.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#strings)**: run every example and check your exercise answers.

## Key terms

- **String:** a sequence of characters: text.
- **Template literal:** a string in backticks that can span lines and insert values with `${…}`.
- **Escape sequence:** a backslash code for a special character, such as `\n` for a new line.
- **Index:** a position in a string or array, counting from 0.
- **Immutable:** can't be changed after it's created; string methods return new strings.
- **Method:** a function that belongs to a value, called with a dot: `text.trim()`.
- **UTF-16 code unit:** the 16-bit unit JavaScript strings are made of; some characters need two.

A **string** is text. You can write it with single quotes, double quotes or backticks:

```js
const a = 'single';
const b = "double";
const c = `backtick`;
console.log(a, b, c);
console.log("It's easy", 'Say "hi"', `Both ' and " work here`);
```

Single and double quotes are identical; pick one and be consistent (Prettier, Part 7, does this for you). Backticks are special: they make **template literals**.

## Template literals

Inside backticks, `${…}` inserts the value of any expression, and the string may span several lines:

```js
const item = "inner tube";
const price = 6;
const qty = 3;
console.log(`${qty} × ${item}: £${price * qty}`);
console.log(`Line one
Line two`);
```

Template literals are clearer than joining with `+`, and avoid the `"Total: " + 2 + 6` trap from Lesson 1.

## Escapes

| Escape | Means |
|---|---|
| `\n` | new line |
| `\t` | tab |
| `\\` | a backslash |
| `\'`, `\"`, `` \` `` | a quote character inside the same kind of quotes |
| `\u{1F6B2}` | a Unicode character by its code point (🚲) |

## Length and characters

```js
const word = "bicycle";
console.log(word.length);          // 7
console.log(word[0], word[6]);     // first and last characters
console.log(word.at(-1), word.at(-2));   // at() accepts negative positions, counting from the end
console.log(word[10]);             // undefined: no error
```

Positions (**indexes**) start at 0. `str.at(-1)` is the last character, like Python's `s[-1]`; plain `str[-1]` is `undefined` in JavaScript.

## Strings can't be changed

Strings are **immutable**: methods return a **new** string and leave the original alone.

```js
let name = "ada";
name.toUpperCase();          // makes "ADA", which is thrown away
console.log(name);           // still "ada"
name = name.toUpperCase();   // keep the result
console.log(name);
```

## Common methods

```js
const s = "  Spoke & Chain Bikes  ";
const t = s.trim();
console.log(`[${t}]`);
console.log(t.toLowerCase(), "|", t.toUpperCase());
console.log(t.includes("Chain"), t.startsWith("Spoke"), t.endsWith("s"));
console.log(t.indexOf("Chain"), t.indexOf("Wheel"));   // -1 means "not found"
console.log(t.slice(0, 5), "|", t.slice(-5));           // from 0 up to (not including) 5; the last 5
console.log(t.replace("Bikes", "Cycles"), "|", "a-b-c".replaceAll("-", "+"));
console.log("7".padStart(3, "0"), "ab".repeat(3));
console.log("red,green,blue".split(","), ["a", "b", "c"].join(" / "));
```

| Method | Does |
|---|---|
| `trim()`, `trimStart()`, `trimEnd()` | remove surrounding whitespace |
| `toLowerCase()`, `toUpperCase()` | change case |
| `includes(x)`, `startsWith(x)`, `endsWith(x)` | test for text; `true` or `false` |
| `indexOf(x)` | position of the first match, or `-1` |
| `slice(start, end)` | the part from `start` up to (not including) `end`; negative counts from the end |
| `replace(a, b)`, `replaceAll(a, b)` | replace the first match, or every match |
| `split(sep)`, `array.join(sep)` | text to an array of pieces, and back |
| `padStart(n, ch)`, `padEnd(n, ch)` | pad to length `n` |

## Comparing strings

`===` compares exactly, including case. `<` and `>` compare by character codes, so `"Zebra" < "apple"` is `true` (capital letters come first). To sort words the way people expect, use `a.localeCompare(b)` (Part 2).

## Emoji and other characters outside the basic range

JavaScript strings are sequences of **UTF-16 code units**. Most characters are one unit, but emoji and some rarer characters take two, so `.length` can surprise you:

```js
const bike = "🚲";
console.log(bike.length, [...bike].length);   // 2 code units, 1 character
console.log("café".length);
```

Spreading `[...text]` splits by real characters (code points). For user-facing text limits, count with `[...text].length`.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Insert values into text | `${value}` in a template literal | O(n) | O(n) |
| Find text | includes, indexOf (−1 if absent) | O(n·m) | O(1) |
| Words of a sentence | trim().split(/\s+/) | O(n) | O(n) |
| Count characters | [...text].length | O(n) | O(n) |

## Common mistakes

- Calling a string method without keeping its result.
- Using `str[-1]` for the last character (it's `undefined`; use `str.at(-1)`).
- Splitting on a single space when words may be separated by several.
- Treating `indexOf` returning 0 as "not found" (not found is -1).
- Counting emoji with `.length`.

## Exercises

### 1. Initials

Write `initials(fullName)` returning the upper-case first letter of each word, with no separators. Words are separated by one or more spaces, and there may be spaces at the start or end. An empty or all-space name gives `""`.

Starter code:

```js
function initials(fullName) {
  // your code here
}

console.log(initials("ada lovelace"), initials("  Grace  Brewster   Hopper "));
// AL GBH
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** words → first letters → upper case → joined; tolerate extra spaces.
2. **Examples:** `"  Grace  Brewster   Hopper "` → words Grace, Brewster, Hopper → GBH.
3. **Brute force:** loop over characters, taking each letter that follows a space: works, with more edge cases.
4. **Pattern:** **split, transform, join**.
5. **Plan:** trim → split on whitespace → drop empties → first letter of each → upper case → join.
6. **Code and test:** one word, empty, only spaces, accents.

</details>

<details>
<summary>💡 Hint 1</summary>

Trim first, then split on runs of spaces. `split(/\s+/)` splits on one or more whitespace characters.

</details>

<details>
<summary>💡 Hint 2</summary>

`"".split(/\s+/)` gives `[""]`, one empty word, so drop empty strings before taking first letters.

</details>

<details>
<summary>💡 Hint 3</summary>

For each word take `word[0].toUpperCase()`, then `join("")` the letters (`map` makes a new array from each item: Part 2).

</details>

### 2. Make a URL slug

Write `slugify(title)` turning a title into a URL-friendly **slug**:

1. lower-case it;
2. replace every run of characters that aren't `a`–`z` or `0`–`9` with a single hyphen;
3. remove hyphens from the start and end.

For example `"  Tubeless Tyres: A Beginner's Guide!  "` → `"tubeless-tyres-a-beginner-s-guide"`.

Starter code:

```js
function slugify(title) {
  // your code here
}

console.log(slugify("  Tubeless Tyres: A Beginner's Guide!  "));
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** a normalisation pipeline; every non-alphanumeric run collapses to one hyphen.
2. **Examples:** `": A "` is one run of three characters → one hyphen.
3. **Brute force:** loop over characters, tracking whether the last output was a hyphen: works, more code.
4. **Pattern:** **chained string transforms** with regular expressions.
5. **Plan:** lower-case → replace runs → trim hyphens.
6. **Code and test:** digits, hyphens at the ends, only punctuation, accents.

</details>

<details>
<summary>💡 Hint 1</summary>

Methods can be chained: each returns a new string you can call the next method on.

</details>

<details>
<summary>💡 Hint 2</summary>

The regular expression `/[^a-z0-9]+/g` matches every run (`+`) of characters that are not (`^` inside brackets) lower-case letters or digits; the `g` flag means "all matches".

</details>

<details>
<summary>💡 Hint 3</summary>

`.replace(/[^a-z0-9]+/g, "-")` then `.replace(/^-+|-+$/g, "")` to remove hyphens at the start (`^-+`) or end (`-+$`).

</details>

**In the sandbox:** exercises 5–6. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Initials</summary>

```js
function initials(fullName) {
  const words = fullName.trim().split(/\s+/).filter((w) => w !== "");
  return words.map((w) => w[0].toUpperCase()).join("");
}

console.log(initials("ada lovelace"), initials("  Grace  Brewster   Hopper "));
```

**Line by line**

- `trim()` removes the outer spaces, so splitting doesn't create empty words at the ends.
- `/\s+/` is a regular expression meaning "one or more whitespace characters" (Part 3), so double spaces don't make empty words.
- `filter((w) => w !== "")` handles the empty-name case, where `split` still returns `[""]`.
- `map` takes each word's first character and upper-cases it; `join("")` glues the letters together.

**Trace:** `"ada lovelace"` → `["ada", "lovelace"]` → `["A", "L"]` → `"AL"`.

**Common wrong approach:** `fullName.split(" ")`, which makes empty strings for double spaces, and then `""[0]` is `undefined`, so `.toUpperCase()` throws a `TypeError`.

</details>

<details>
<summary>✅ 2. Make a URL slug</summary>

```js
function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")    // every run of other characters → one hyphen
    .replace(/^-+|-+$/g, "");       // trim hyphens at both ends
}

console.log(slugify("  Tubeless Tyres: A Beginner's Guide!  "));
```

**Line by line**

- `toLowerCase()` first, so the character class only needs `a-z`.
- `[^a-z0-9]+` with the `g` flag finds every run of other characters, including spaces, punctuation and accented letters, and replaces each run with a single `-`.
- `^-+|-+$` matches hyphens at the very start or end (the `|` means "or"); replacing them with `""` removes them.

**Trace:** `"Hello World"` → `"hello world"` → `"hello-world"` → no hyphens at the ends → `"hello-world"`.

**Common wrong approach:** `title.replaceAll(" ", "-")`, which keeps punctuation (`tyres:-a`) and turns double spaces into double hyphens. Real slug libraries also convert accented letters to plain ones first (`é` → `e`) with `normalize("NFD")` (Part 2).

</details>

## Quick quiz

1. What does `${a + b}` do inside backticks?
   - A) Prints a dollar sign
   - B) Inserts the value of a + b into the string
   - C) Creates a variable

2. What does "bicycle".at(-1) return?
   - A) "e"
   - B) undefined
   - C) An error

3. Why does name.toUpperCase() alone not change name?
   - A) It needs to be awaited
   - B) Strings are immutable; the method returns a new string
   - C) toUpperCase only works on const strings

4. "🚲".length is 2. Why?
   - A) Emoji are stored as two characters by mistake
   - B) length counts bytes
   - C) The emoji takes two UTF-16 code units

<details>
<summary>Quiz answers</summary>

1. **B) Inserts the value of a + b into the string**: Template literals evaluate any expression inside ${…}.
2. **A) "e"**: at() counts negative positions from the end; plain [-1] is undefined.
3. **B) Strings are immutable; the method returns a new string**: Assign the result: name = name.toUpperCase().
4. **C) The emoji takes two UTF-16 code units**: [..."🚲"].length counts real characters.

</details>

---
Previous: [Lesson 2](02-variables-and-types.md) · Next: [Lesson 4: Numbers and maths](04-numbers.md)
