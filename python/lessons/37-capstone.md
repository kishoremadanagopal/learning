# Lesson 37: Capstone: build an expense tracker

**You'll learn:** dataclasses, custom exceptions, CSV, generators and reports in one program.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/python/#capstone)**: run every example and check your exercise answers.

## Key terms

- **Capstone project:** a project that combines everything you've learned.
- **Validation:** checking data is correct before using it.
- **Alternative constructor:** a `@classmethod` that creates objects from another format, like CSV.
- **Virtual environment (venv):** an isolated folder of packages for one project.
- **Version control (Git):** a system that records every change to your code.

Time to put it all together. You'll build an **expense tracker** step by step: a dataclass for each expense, a tracker class that stores and analyses them, input validation with exceptions, CSV import and export, and a text report.

## The finished program

Read through the complete program, run it, and change things. Every piece uses something from an earlier lesson.

```python
from dataclasses import dataclass
from datetime import date
from collections import defaultdict
import csv
import io

class InvalidExpense(ValueError):
    """Raised when an expense has bad data."""

@dataclass(frozen=True)
class Expense:
    day: date
    category: str
    amount: float
    note: str = ""

    def __post_init__(self):
        if self.amount <= 0:
            raise InvalidExpense(f"amount must be positive, got {self.amount}")
        if not self.category.strip():
            raise InvalidExpense("category is required")

class Tracker:
    def __init__(self):
        self._expenses: list[Expense] = []

    def add(self, day: date, category: str, amount: float, note: str = "") -> Expense:
        expense = Expense(day, category.strip().lower(), round(amount, 2), note)
        self._expenses.append(expense)
        return expense

    def __len__(self) -> int:
        return len(self._expenses)

    def __iter__(self):
        return iter(sorted(self._expenses, key=lambda e: e.day))

    def total(self) -> float:
        return round(sum(e.amount for e in self._expenses), 2)

    def by_category(self) -> dict[str, float]:
        totals = defaultdict(float)
        for e in self._expenses:
            totals[e.category] += e.amount
        return {cat: round(v, 2) for cat, v in sorted(totals.items(), key=lambda kv: -kv[1])}

    def in_month(self, year: int, month: int):
        return (e for e in self if e.day.year == year and e.day.month == month)

    def to_csv(self) -> str:
        out = io.StringIO()
        writer = csv.writer(out)
        writer.writerow(["day", "category", "amount", "note"])
        for e in self:
            writer.writerow([e.day.isoformat(), e.category, f"{e.amount:.2f}", e.note])
        return out.getvalue()

    @classmethod
    def from_csv(cls, text: str) -> "Tracker":
        tracker = cls()
        for line_no, row in enumerate(csv.DictReader(io.StringIO(text)), start=2):
            try:
                tracker.add(date.fromisoformat(row["day"]), row["category"],
                            float(row["amount"]), row.get("note", ""))
            except (ValueError, KeyError) as err:
                print(f"skipping line {line_no}: {err}")
        return tracker

    def report(self) -> str:
        lines = [f"{'Category':<14}{'Amount':>10}{'Share':>8}", "-" * 32]
        total = self.total()
        for cat, amount in self.by_category().items():
            lines.append(f"{cat:<14}{amount:>10,.2f}{amount / total:>8.0%}")
        lines += ["-" * 32, f"{'TOTAL':<14}{total:>10,.2f}"]
        return "\n".join(lines)

data = """day,category,amount,note
2026-09-01,Rent,1200,September
2026-09-03,Groceries,84.20,
2026-09-07,Transport,32.5,bus pass
2026-09-12,Groceries,61.35,
2026-09-15,Fun,-20,typo
2026-09-20,Eating out,45.00,birthday dinner
2026-10-01,Rent,1200,October
"""

tracker = Tracker.from_csv(data)
print(f"Loaded {len(tracker)} expenses\n")
print(tracker.report())

september = list(tracker.in_month(2026, 9))
print(f"\nSeptember: {len(september)} expenses, {sum(e.amount for e in september):,.2f} total")
biggest = max(tracker, key=lambda e: e.amount)
print(f"Biggest: {biggest.category} {biggest.amount:,.2f} on {biggest.day:%d %b}")
```

## What each part demonstrates

| Feature | Lesson |
|---|---|
| `@dataclass(frozen=True)` with `__post_init__` validation | Properties and dataclasses |
| Custom exception `InvalidExpense` | Exceptions |
| `__len__` and `__iter__` | Special methods |
| `defaultdict`, `date` | Modules and the standard library |
| `csv` with `io.StringIO` | Files, CSV and JSON |
| `@classmethod` alternative constructor | Classes and objects |
| Generator expression in `in_month` | Iterators and generators |
| `sorted(..., key=lambda ...)`, `max(..., key=...)` | Lambdas |
| f-string format specs for the report | Strings |
| Type hints | Type hints |

## Your turn

The exercises below extend the tracker. Each one includes the code it needs, so you can solve them independently.

## Where to go next

You now know the core of Python. To keep growing:

**1. Install Python on your computer.** Download it from python.org, then install a code editor such as VS Code with its Python extension. Run your first script from the terminal with `python hello.py`.

**2. Learn your tools.** Create a *virtual environment* per project so each project has its own packages, and install packages with `pip`:

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install requests pytest
```

**3. Use version control.** Learn Git basics (`git add`, `git commit`, `git push`) and put every project on GitHub. A profile full of small, working projects is a strong portfolio.

**4. Pick a direction and build things:**

| Direction | Libraries to learn |
|---|---|
| Web APIs and backends | FastAPI, Flask, Django, SQLAlchemy |
| Data analysis | pandas, NumPy, Matplotlib, Jupyter |
| Machine learning and AI | scikit-learn, PyTorch, Hugging Face Transformers, LangChain |
| Automation and scripting | requests, BeautifulSoup, Playwright, pathlib |
| Testing | pytest, hypothesis |

**5. Practise regularly.** Small daily problems (Exercism, LeetCode, Advent of Code) build fluency. Reading other people's code on GitHub builds taste.

**6. Read the official docs.** The Python tutorial at docs.python.org is excellent, and the standard library reference answers most "is there a module for this?" questions.

Congratulations on finishing the course. Come back to the playground whenever you want to try an idea.

## Common mistakes

- Letting one bad record crash a whole import. Handle errors per row and report them.
- Mixing input parsing, calculations and output in one long function. Split them up.
- Skipping tests for the tricky parts (dates, money, empty data).

## Exercises

### 1. Monthly budget alert

Write `over_budget(expenses, budgets)` where `expenses` is a list of `(category, amount)` tuples and `budgets` maps category to its limit. Return a **sorted list** of categories whose total spending is **above** their budget. Categories without a budget are never over.

Starter code:

```python
def over_budget(expenses, budgets):
    return []

spent = [("food", 120), ("fun", 60), ("food", 95), ("rent", 1200), ("fun", 10)]
limits = {"food": 200, "fun": 100, "rent": 1200}
print(over_budget(spent, limits))
```

### 2. Spending streak

Write `longest_streak(days)` that takes a list of `datetime.date` objects (unsorted, may contain duplicates) on which money was spent, and returns the length of the longest run of **consecutive** days.

Starter code:

```python
from datetime import date, timedelta

def longest_streak(days):
    return 0

d = [date(2026, 9, 1), date(2026, 9, 2), date(2026, 9, 4), date(2026, 9, 3), date(2026, 9, 10)]
print(longest_streak(d))
```

**In the sandbox:** exercises 61–62. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. First total the spending per category in a dict. Then keep categories that are in budgets and whose total is greater than the limit, and sort them.
2. Remove duplicates and sort with sorted(set(days)). Walk through the dates; if a date is exactly one day after the previous one (timedelta(days=1)), extend the current streak, otherwise restart it at 1. Track the best.

</details>

<details>
<summary>Answers</summary>

**1. Monthly budget alert**

```python
def over_budget(expenses, budgets):
    totals = {}
    for category, amount in expenses:
        totals[category] = totals.get(category, 0) + amount
    return sorted(cat for cat, total in totals.items() if cat in budgets and total > budgets[cat])

spent = [("food", 120), ("fun", 60), ("food", 95), ("rent", 1200), ("fun", 10)]
limits = {"food": 200, "fun": 100, "rent": 1200}
print(over_budget(spent, limits))
```

**2. Spending streak**

```python
from datetime import date, timedelta

def longest_streak(days):
    unique = sorted(set(days))
    best = current = 0
    previous = None
    for day in unique:
        if previous is not None and day - previous == timedelta(days=1):
            current += 1
        else:
            current = 1
        best = max(best, current)
        previous = day
    return best

d = [date(2026, 9, 1), date(2026, 9, 2), date(2026, 9, 4), date(2026, 9, 3), date(2026, 9, 10)]
print(longest_streak(d))
```

</details>

## Quick quiz

1. In the tracker, why is `Expense` a frozen dataclass?
   - A) It's required for CSV export
   - B) Expenses shouldn't change after they're recorded, and frozen objects are safer to share
   - C) Frozen dataclasses are faster to print

2. Why does `from_csv` wrap each row in try/except instead of the whole loop?
   - A) Because try/except only works inside loops
   - B) So one bad row is skipped while the others still load
   - C) To make the code shorter

<details>
<summary>Quiz answers</summary>

1. **B) Expenses shouldn't change after they're recorded, and frozen objects are safer to share**: Immutability prevents accidental edits and makes objects hashable.
2. **B) So one bad row is skipped while the others still load**: Handling errors per row gives better results and clearer messages than failing the whole import.

</details>

---
Previous: [Lesson 36](36-algorithms-and-big-o.md) · Back to the [course home](../README.md)
