# Lesson 15: Dates and times

**You'll learn:** timestamps and the Unix epoch, the Date object, zero-based months, mutation, local time versus UTC, unreliable parsing, overflow, ISO 8601, Intl.DateTimeFormat and Intl.RelativeTimeFormat, the Temporal API, PlainDate, PlainTime, PlainDateTime, ZonedDateTime, Instant and Duration, calendar arithmetic, time zones and daylight saving, browser support and polyfills.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#dates-and-time)**: run every example and check your exercise answers.

## Key terms

- **Timestamp:** a moment in time as a number, such as milliseconds since 1 January 1970 UTC.
- **UTC:** Coordinated Universal Time, the reference time zone with no daylight saving.
- **ISO 8601:** the international standard text format for dates and times, such as `2026-10-08T14:30:00Z`.
- **Time zone:** a region's rules for its offset from UTC, including daylight-saving changes, such as `Europe/London`.
- **Temporal:** the modern JavaScript API for dates and times, with immutable objects and separate types for dates, times and zones.
- **`Temporal.PlainDate`:** a calendar date with no time or time zone.
- **`Temporal.ZonedDateTime`:** a date and time in a specific time zone.
- **Polyfill:** code that adds a missing feature to older environments.

Dates are one of the hardest parts of programming: months of different lengths, leap years, time zones, daylight-saving changes, and formats that differ by country. JavaScript has two tools: the old **Date** object and the new **Temporal** API.

## Timestamps and Date

A `Date` stores one moment in time as a **timestamp**: milliseconds since 1 January 1970 UTC (the "Unix epoch").

```js
const moment = new Date(Date.UTC(2026, 9, 8, 14, 30));    // 8 October 2026, 14:30 UTC
console.log(moment.getTime());                               // the timestamp in milliseconds
console.log(moment.toISOString());                           // the standard text form, always UTC
console.log(moment.getUTCFullYear(), moment.getUTCMonth(), moment.getUTCDate(), moment.getUTCDay());
console.log(Date.now() > moment.getTime() ? "in the past" : "in the future");
```

`Date` has notorious traps:

- **Months start at 0**: `9` means October. Days of the month start at 1. `getDay()` is the weekday (0 = Sunday).
- **Dates are mutable**: `setMonth` changes the object in place, so a Date shared between two parts of your code can change under one of them.
- **Local versus UTC**: `getMonth()`, `getHours()` and friends use the **computer's time zone**; `getUTCMonth()` and friends use UTC. The same code can print different dates on different machines.
- **Parsing is unreliable** for anything except ISO 8601: `new Date("2026-10-08")` is read as UTC midnight, but `new Date("2026-10-08T00:00")` as local midnight, and formats like `"10/08/2026"` depend on the browser.
- **Overflow rolls over silently**:

```js
const d = new Date(2026, 0, 31);       // 31 January 2026 (local time)
d.setMonth(1);                         // "31 February" → rolls over into March
console.log(d.toDateString());
```

## ISO 8601: the one format to use

`2026-10-08T14:30:00Z` (date, `T`, time, `Z` for UTC, or an offset like `+01:00`) is **ISO 8601**. Use it in JSON, APIs, databases and file names: it's unambiguous, and sorts correctly as text.

## Formatting for people

```js
const moment = new Date(Date.UTC(2026, 9, 8, 14, 30));
const opts = { dateStyle: "full", timeStyle: "short", timeZone: "Europe/London" };
console.log(new Intl.DateTimeFormat("en-GB", opts).format(moment));
console.log(new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "America/New_York" }).format(moment));
console.log(moment.toLocaleDateString("de-DE", { timeZone: "UTC" }));
console.log(new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(-1, "day"));
```

`Intl` formats dates, numbers, lists and relative times ("yesterday", "in 3 hours") for any language and region, with no library needed. Always pass `timeZone` when the output must be the same for every user.

## Temporal: dates done right

**Temporal** is the modern replacement for `Date`, designed after years of lessons from libraries such as Moment.js. It reached the final stage of standardisation (Stage 4) in March 2026. Its objects are **immutable**, months start at **1**, and it has separate types for separate ideas:

| Type | Represents | Example |
|---|---|---|
| `Temporal.PlainDate` | a calendar date, no time or zone | a birthday: `2026-10-08` |
| `Temporal.PlainTime` | a wall-clock time | opening time: `09:30` |
| `Temporal.PlainDateTime` | date and time, no zone | a local appointment |
| `Temporal.ZonedDateTime` | date, time and time zone | a meeting in London |
| `Temporal.Instant` | an exact moment (like a timestamp) | when an order was placed |
| `Temporal.Duration` | a length of time | 2 hours 30 minutes |

```js
const start = Temporal.PlainDate.from("2026-01-31");
console.log(start.add({ months: 1 }).toString());       // 2026-02-28: clamped to the end of February
console.log(start.month, start.dayOfWeek, start.daysInMonth);   // month 1 = January; 6 = Saturday

const today = Temporal.PlainDate.from("2026-10-08");
const xmas = Temporal.PlainDate.from("2026-12-25");
console.log(today.until(xmas).days, "days to go");
console.log(Temporal.PlainDate.compare(today, xmas));   // -1: today comes first

const meeting = Temporal.ZonedDateTime.from("2026-10-08T15:00[Europe/London]");
console.log(meeting.withTimeZone("America/New_York").toString());
const clocksChange = Temporal.ZonedDateTime.from("2026-03-29T00:30[Europe/London]");
console.log(clocksChange.add({ hours: 2 }).toString());   // 03:30 BST: daylight saving handled
console.log(Temporal.Duration.from({ hours: 1, minutes: 90 }).round({ largestUnit: "hours" }).toString());
```

**Browser support (autumn 2026):** Temporal works in Chrome and Edge (version 144 and later), Firefox (139 and later) and Node.js 26. Safari support is still in progress, so these examples fail there; check [caniuse.com](https://caniuse.com/temporal) before relying on it in a public site, or use the `@js-temporal/polyfill` package. The exercises in this lesson use `Date` with UTC, which works everywhere.

## Rules of thumb

- **Store and send** moments as ISO 8601 UTC strings (or timestamps).
- **Show** them in the user's time zone with `Intl.DateTimeFormat`, at the last moment.
- **Calendar dates** (birthdays, due dates) are dates without a time or zone: don't store them as midnight UTC, or they shift a day for users west of UTC. `Temporal.PlainDate` models this exactly.
- **Never do date arithmetic by adding 86,400,000 milliseconds** for "one day" in local time: days around clock changes are 23 or 25 hours long.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Store a moment | ISO 8601 UTC string or timestamp | O(1) | O(1) |
| Show a moment | Intl.DateTimeFormat(locale, { timeZone }) | O(1) | O(1) |
| Days between dates | UTC timestamps ÷ 86,400,000, or PlainDate.until | O(1) | O(1) |
| Add months safely | Temporal.PlainDate add({ months }) | O(1) | O(1) |

## Common mistakes

- Forgetting that `Date` months start at 0.
- Parsing non-ISO date strings with `new Date(text)`.
- Mixing local-time and UTC methods.
- Adding 24 hours of milliseconds for "one day" across a clock change.
- Storing calendar dates (like birthdays) as midnight UTC timestamps.

## Exercises

### 1. Days between two dates

Write `daysBetween(a, b)` for two dates written as `"YYYY-MM-DD"`, returning the number of days from `a` to `b` (negative if `b` is earlier). Work in UTC so the answer is the same in every time zone. Throw a `RangeError` if either string isn't in that exact format or isn't a real date (such as `"2026-02-30"`).

Starter code:

```js
function daysBetween(a, b) {
  // your code here
}

console.log(daysBetween("2026-10-08", "2026-12-25"), daysBetween("2026-03-01", "2026-02-01"));
// 78 -28
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** count calendar days without time zones getting involved; reject bad input loudly.
2. **Examples:** 2026-02-30 would roll over to 2 March, so it must be caught.
3. **Brute force:** `new Date(a)` and subtract: works for valid ISO dates, but accepts invalid ones and other formats.
4. **Pattern:** **parse strictly, compute in UTC, verify by round trip**.
5. **Plan:** helper: regex → Date.UTC → round-trip check → days; difference of two helpers.
6. **Code and test:** leap years, clock-change weekends, same day, invalid dates and formats.

</details>

<details>
<summary>💡 Hint 1</summary>

Read the year, month and day with a regular expression like `/^(\d{4})-(\d{2})-(\d{2})$/`, then build the moment with `Date.UTC(year, month - 1, day)` (Date's months start at 0).

</details>

<details>
<summary>💡 Hint 2</summary>

An impossible date such as 30 February rolls over silently. Build a Date from your timestamp and check that its UTC year, month and day are the ones you asked for.

</details>

<details>
<summary>💡 Hint 3</summary>

In UTC every day is exactly 86,400,000 ms, so `(msB - msA) / 86_400_000` is a whole number of days.

</details>

### 2. Format a duration

Write `formatDuration(totalMinutes)` returning a short, readable duration: `"2h 05m"` for 125, `"45m"` for 45 (no hours part when it's zero), `"1d 3h 00m"` for 1620 (days appear only when there's at least one), and `"0m"` for 0. Minutes are always two digits after an `h` part. Throw a `RangeError` for negative or non-integer input.

Starter code:

```js
function formatDuration(totalMinutes) {
  // your code here
}

console.log(formatDuration(125), formatDuration(45), formatDuration(1620), formatDuration(0));
// 2h 05m 45m 1d 3h 00m 0m
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** split minutes into d / h / m, then format by the largest unit present.
2. **Examples:** 1620 = 1 × 1440 + 180 → 1 day, 3 hours, 0 minutes → "1d 3h 00m".
3. **Brute force:** subtract 1440 in a loop to count days: works, but slow and clumsy.
4. **Pattern:** **unit conversion with floor and remainder** (as in Lesson 4's pence).
5. **Plan:** validate → days, hours, minutes → three output shapes.
6. **Code and test:** zero, exact hours and days, minutes only, invalid input.

</details>

<details>
<summary>💡 Hint 1</summary>

A day has 1,440 minutes and an hour 60. Use `Math.floor` for the bigger units and `%` for what's left.

</details>

<details>
<summary>💡 Hint 2</summary>

Pick the format by the largest non-zero unit: days, then hours, then minutes alone.

</details>

<details>
<summary>💡 Hint 3</summary>

`String(minutes).padStart(2, "0")` makes `5` into `"05"`.

</details>

**In the sandbox:** exercises 29–30. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Days between two dates</summary>

```js
function toUtcDay(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) throw new RangeError(`not a YYYY-MM-DD date: ${text}`);
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(year, month - 1, day);              // months start at 0 in Date
  const check = new Date(ms);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new RangeError(`no such date: ${text}`);           // e.g. 2026-02-30 rolled over
  }
  return ms / 86_400_000;                                    // whole days since 1970 (UTC has no clock changes)
}

function daysBetween(a, b) {
  return toUtcDay(b) - toUtcDay(a);
}

console.log(daysBetween("2026-10-08", "2026-12-25"), daysBetween("2026-03-01", "2026-02-01"));
```

**Line by line**

- The regular expression accepts exactly `YYYY-MM-DD` with two-digit months and days, rejecting `2026-1-5` and `08/10/2026`.
- `Date.UTC` returns a timestamp in UTC, so the computer's time zone never matters.
- The round-trip check catches impossible dates: `Date.UTC(2026, 1, 30)` is 2 March, whose month differs from the one requested.
- Dividing by 86,400,000 is safe in UTC, where every day has exactly 24 hours; in local time, a clock-change day doesn't.

**Trace:** 2026-03-28 → 2026-03-30 in UTC: exactly 2 × 86,400,000 ms → 2, even though UK clocks change on the 29th.

**Common wrong approach:** `new Date("2026-03-30") - new Date("2026-03-28")` mixed with local-time dates such as `new Date(2026, 2, 30)`: around clock changes the difference is 47 or 49 hours, and rounding errors creep in. With Temporal, `PlainDate.from(a).until(PlainDate.from(b)).days` does it all safely.

</details>

<details>
<summary>✅ 2. Format a duration</summary>

```js
function formatDuration(totalMinutes) {
  if (!Number.isInteger(totalMinutes) || totalMinutes < 0) {
    throw new RangeError(`expected a whole number of minutes, not ${totalMinutes}`);
  }
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  return `${minutes}m`;
}

console.log(formatDuration(125), formatDuration(45), formatDuration(1620), formatDuration(0));
```

**Line by line**

- `Math.floor(total / 1440)` counts whole days; `total % 1440` is what remains.
- `Math.floor(remaining / 60)` counts whole hours; `total % 60` gives the minutes (the same as `remaining % 60`).
- Returning early from the most specific case first keeps the formatting rules simple.
- `padStart` gives two-digit minutes whenever an hour part is shown.

**Trace:** 125 → days 0, hours 2, minutes 5 → "2h 05m".

**Common wrong approach:** `new Date(minutes * 60000).toISOString().slice(11, 16)`, which wraps after 24 hours (1620 minutes shows "03:00"). With Temporal, `Temporal.Duration.from({ minutes }).round({ largestUnit: "days" })` does the splitting.

</details>

## Quick quiz

1. What does new Date(2026, 9, 8) represent?
   - A) 8 October 2026, because months start at 0
   - B) 9 August 2026
   - C) 8 September 2026

2. What format should dates use in JSON and APIs?
   - A) ISO 8601, such as 2026-10-08T14:30:00Z
   - B) 10/08/2026
   - C) Thursday 8 October

3. Why not add 86,400,000 ms for "tomorrow" in local time?
   - A) Days around daylight-saving changes are 23 or 25 hours long
   - B) JavaScript doesn't allow adding numbers to timestamps
   - C) A day is 86,400 ms

4. Which Temporal type fits a birthday?
   - A) Temporal.PlainDate
   - B) Temporal.Instant
   - C) Temporal.ZonedDateTime

<details>
<summary>Quiz answers</summary>

1. **A) 8 October 2026, because months start at 0**: Months in Date are 0–11; Temporal uses 1–12.
2. **A) ISO 8601, such as 2026-10-08T14:30:00Z**: It's unambiguous and sorts correctly as text.
3. **A) Days around daylight-saving changes are 23 or 25 hours long**: Use calendar arithmetic (Temporal) or UTC.
4. **A) Temporal.PlainDate**: A calendar date has no time or time zone.

</details>

---
Previous: [Lesson 14](14-json.md) · Back to the [course home](../README.md)
