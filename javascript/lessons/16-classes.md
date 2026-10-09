# Lesson 16: Classes and this

**You'll learn:** classes and instances, constructors, methods, public fields, private fields with #, getters and setters, static members, chaining by returning this, inheritance with extends and super, overriding methods, instanceof, composition versus inheritance, how this is decided, losing this in callbacks, arrow functions and bind, prototypes and the prototype chain.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/javascript/#classes)**: run every example and check your exercise answers.

## Key terms

- **Class:** a blueprint for creating objects with the same fields and methods.
- **Instance:** an object created from a class with `new`.
- **Constructor:** the method that runs when an instance is created, setting up its fields.
- **Private field:** a field written `#name`, accessible only inside the class.
- **Getter / setter:** methods that run when a property is read or assigned.
- **Static member:** a field or method that belongs to the class itself, not to instances.
- **Inheritance:** a class extending another and reusing its fields and methods.
- **`super`:** calls the parent class's constructor or methods.
- **`this`:** the object a method was called on, decided at call time for ordinary functions.
- **Prototype:** the object another object inherits properties from.

A **class** is a blueprint for creating objects that share the same shape and behaviour. Each object made from it is an **instance**.

```js
class Product {
  constructor(name, price) {           // runs when you write new Product(...)
    this.name = name;                  // this is the new instance
    this.price = price;
  }

  withVat() {                          // a method, shared by every instance
    return this.price * 1.2;
  }

  toString() {
    return `${this.name} (£${this.price})`;
  }
}

const tube = new Product("Inner tube", 10);
const bell = new Product("Bell", 8);
console.log(tube.withVat(), `${bell}`, tube instanceof Product);
```

## Fields, private fields and accessors

```js
class Account {
  owner;                               // a public field
  #balance = 0;                        // a PRIVATE field: only code inside the class can see it
  static count = 0;                    // a static field: belongs to the class, not each instance

  constructor(owner) {
    this.owner = owner;
    Account.count++;
  }

  deposit(amount) {
    if (amount <= 0) throw new RangeError("Deposits must be positive");
    this.#balance += amount;
    return this;                       // returning this lets calls chain
  }

  get balance() {                      // a getter: read like a property, no brackets
    return this.#balance;
  }
}

const acc = new Account("Ada").deposit(50).deposit(25);
console.log(acc.balance, acc.owner, Account.count);
console.log(Object.keys(acc));         // the private field isn't visible
```

- **Private fields** (`#name`) are truly private: code outside the class gets a syntax error if it even mentions them. They're how a class protects its rules (here: the balance only changes through `deposit`).
- **Getters and setters** (`get x()`, `set x(value)`) look like properties to callers but run code.
- **Static** members belong to the class itself: `Account.count`, or helpers like `Product.fromJSON(data)`.

## Inheritance

A class can **extend** another, inheriting its fields and methods and adding or overriding some:

```js
class Product {
  constructor(name, price) { this.name = name; this.price = price; }
  label() { return `${this.name}: £${this.price}`; }
}

class Bike extends Product {
  constructor(name, price, frameSize) {
    super(name, price);                // call the parent constructor first
    this.frameSize = frameSize;
  }
  label() {                            // override, reusing the parent's version
    return `${super.label()} (frame ${this.frameSize})`;
  }
}

const bike = new Bike("Trail 29", 899, "L");
console.log(bike.label(), bike instanceof Bike, bike instanceof Product);
```

Inheritance is useful for genuine "is a kind of" relationships, but deep hierarchies get hard to change. Often it's simpler to **compose**: give an object other objects that do part of the work.

## How `this` is decided

`this` isn't fixed when a function is written; for ordinary functions and methods it depends on **how the function is called**:

```js
const cart = {
  items: [6, 12],
  total() { return this.items.reduce((a, b) => a + b, 0); },
};
console.log(cart.total());          // called as cart.total(): this is cart

const loose = cart.total;           // the same function, detached from cart
try {
  loose();                          // called on its own: this is undefined (strict mode)
} catch (e) {
  console.log("Lost this:", e.message);
}

const bound = cart.total.bind(cart);   // bind fixes this permanently
console.log(bound());
```

This bites most often when you pass a method as a **callback** (to `setTimeout`, an event listener or `map`). Two fixes:

- **Arrow functions** don't have their own `this`; they use the `this` of the code around them. A class field holding an arrow function keeps its instance:

```js
class Counter {
  count = 0;
  increment = () => { this.count++; };      // an arrow function in a field: always this instance
}
const c = new Counter();
const fn = c.increment;                      // detached, but still works
fn(); fn();
console.log(c.count);
```

- **`bind`**: `button.addEventListener("click", this.handle.bind(this))`.

## Under the hood: prototypes

Classes are a clearer syntax over JavaScript's original mechanism, **prototypes**. Every object has a hidden link to a prototype object; when a property isn't found on the object, JavaScript looks it up the **prototype chain**. Methods live once on the prototype and are shared by every instance:

```js
class Product { label() { return "a product"; } }
const p = new Product();
console.log(Object.getPrototypeOf(p) === Product.prototype, Object.hasOwn(p, "label"), typeof p.label);
```

You rarely need to touch prototypes directly, but they explain why methods are shared and how `instanceof` works.

## At a glance

| Concept | Approach | Time | Space |
|---|---|---|---|
| Protect state | #private fields + validated methods + getters | O(1) | O(1) |
| Share behaviour | base class method calling an overridden method | O(1) | O(1) |
| Keep this in callbacks | arrow-function fields or .bind(this) | O(1) | O(1) |

## Common mistakes

- Using `this` in a subclass constructor before calling `super`.
- Passing a method as a callback and losing `this`.
- Exposing internal state as public fields that anyone can change.
- Building deep inheritance hierarchies instead of composing objects.
- Forgetting `new` when creating an instance.

## Exercises

### 1. A bank account class

Write a class `BankAccount` with:

- `constructor(owner, opening = 0)`: stores the owner and an opening balance (throw a `RangeError` if `opening` is negative);
- a **private** balance (`#balance`), readable through a getter `balance`;
- `deposit(amount)` and `withdraw(amount)`, which throw a `RangeError` if the amount isn't positive, and `withdraw` also if it's more than the balance; both return the account so calls can chain;
- `toString()` returning `"<owner>: £<balance with 2 decimals>"`.

Starter code:

```js
class BankAccount {
  // your code here
}

const acc = new BankAccount("Ada", 100);
acc.deposit(50).withdraw(30);
console.log(acc.balance, `${acc}`);   // 120 Ada: £120.00
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** an object that protects a rule (no negative balance) by hiding its data and offering methods.
2. **Examples:** withdrawing 50 from 10 must throw and leave the balance at 10.
3. **Brute force:** a plain object with a public `balance` property: anyone could set it to −1000.
4. **Pattern:** **encapsulation**: private state, validated methods, a read-only getter.
5. **Plan:** private field → constructor check → getter → deposit and withdraw with guards → toString.
6. **Code and test:** chaining, invalid amounts, refused withdrawals leave the balance unchanged.

</details>

<details>
<summary>💡 Hint 1</summary>

Declare the private field at the top of the class body: `#balance;`. Only methods inside the class can read or change it.

</details>

<details>
<summary>💡 Hint 2</summary>

A getter looks like `get balance() { return this.#balance; }`. Methods that should chain end with `return this;`.

</details>

<details>
<summary>💡 Hint 3</summary>

Check amounts before changing anything: `if (!(amount > 0)) throw new RangeError(...)` also rejects `NaN`. In `withdraw`, check against `this.#balance` too.

</details>

### 2. Shapes with inheritance

Write a base class `Shape` with a constructor taking a `name`, a method `area()` that throws an `Error` with the message `"area() not implemented"`, and a method `describe()` returning `"<name> with area <area rounded to 2 decimals>"` (using `toFixed(2)`). Then write `Circle extends Shape` (constructor `radius`, name `"circle"`) and `Rect extends Shape` (constructor `width, height`, name `"rectangle"`), each overriding `area()`.

Starter code:

```js
class Shape {
  // your code here
}

class Circle extends Shape {
  // your code here
}

class Rect extends Shape {
  // your code here
}

console.log(new Circle(1).describe(), new Rect(2, 3.5).describe());
// circle with area 3.14 rectangle with area 7.00
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** shared behaviour in the base class; each subclass supplies its own `area`.
2. **Examples:** `new Circle(1).describe()` uses Shape's describe with Circle's area.
3. **Brute force:** a `describe` in every class: duplicated code.
4. **Pattern:** **template method**: the base class defines the algorithm, subclasses fill in a step.
5. **Plan:** Shape (name, abstract area, describe) → Circle and Rect (super, area).
6. **Code and test:** both shapes, the base class's error, instanceof.

</details>

<details>
<summary>💡 Hint 1</summary>

In each subclass constructor, call `super("circle")` (or `"rectangle"`) **before** using `this`.

</details>

<details>
<summary>💡 Hint 2</summary>

`describe()` lives only in `Shape` and calls `this.area()`. When it runs on a Circle, `this.area` is the Circle's version.

</details>

<details>
<summary>💡 Hint 3</summary>

Circle's area is `Math.PI * this.radius ** 2`; Rect's is `this.width * this.height`.

</details>

**In the sandbox:** exercises 31–32. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. A bank account class</summary>

```js
class BankAccount {
  #balance;

  constructor(owner, opening = 0) {
    if (opening < 0) throw new RangeError("Opening balance can't be negative");
    this.owner = owner;
    this.#balance = opening;
  }

  get balance() {
    return this.#balance;
  }

  deposit(amount) {
    if (!(amount > 0)) throw new RangeError("Deposit must be positive");
    this.#balance += amount;
    return this;
  }

  withdraw(amount) {
    if (!(amount > 0)) throw new RangeError("Withdrawal must be positive");
    if (amount > this.#balance) throw new RangeError("Insufficient funds");
    this.#balance -= amount;
    return this;
  }

  toString() {
    return `${this.owner}: £${this.#balance.toFixed(2)}`;
  }
}

const acc = new BankAccount("Ada", 100);
acc.deposit(50).withdraw(30);
console.log(acc.balance, `${acc}`);
```

**Line by line**

- `#balance;` declares the private field; trying `acc.#balance` outside the class is a syntax error, and `acc.balance = 5` does nothing because there's only a getter (in strict mode it throws).
- Validating **before** changing state means a failed call leaves the account exactly as it was.
- `!(amount > 0)` is true for 0, negatives and `NaN`, where `amount <= 0` would let `NaN` through.
- `return this` makes `acc.deposit(50).withdraw(30)` work.
- `toString` is used automatically in template literals.

**Trace:** `new BankAccount("Ada", 100)` → 100; deposit 50 → 150; withdraw 30 → 120; `${acc}` → "Ada: £120.00".

**Common wrong approach:** a public `this.balance` field. It's easy, but any code can break the rules by assigning to it, and the class can no longer guarantee its own invariants. (Real money code would use whole pence, as in Lesson 4.)

</details>

<details>
<summary>✅ 2. Shapes with inheritance</summary>

```js
class Shape {
  constructor(name) {
    this.name = name;
  }
  area() {
    throw new Error("area() not implemented");
  }
  describe() {
    return `${this.name} with area ${this.area().toFixed(2)}`;
  }
}

class Circle extends Shape {
  constructor(radius) {
    super("circle");
    this.radius = radius;
  }
  area() {
    return Math.PI * this.radius ** 2;
  }
}

class Rect extends Shape {
  constructor(width, height) {
    super("rectangle");
    this.width = width;
    this.height = height;
  }
  area() {
    return this.width * this.height;
  }
}

console.log(new Circle(1).describe(), new Rect(2, 3.5).describe());
```

**Line by line**

- `super("circle")` runs Shape's constructor, which sets `this.name`; using `this` before `super` is a `ReferenceError`.
- Shape's `area()` throws, marking it as a method subclasses must provide (JavaScript has no `abstract` keyword; TypeScript does, Part 6).
- `this.area()` in `describe` calls whichever `area` the actual object has: the subclass's override. This is **polymorphism**.
- `toFixed(2)` formats the number for display.

**Trace:** `new Rect(2, 3.5).describe()` → Shape's describe → `this.area()` is Rect's → 7 → "rectangle with area 7.00".

**Common wrong approach:** checking the type inside `describe` (`if (this instanceof Circle) … else if …`). Every new shape would then need edits to the base class; overriding `area` keeps each shape's logic with the shape.

</details>

## Quick quiz

1. What does the # in #balance mean?
   - A) A private field, accessible only inside the class
   - B) A comment
   - C) A static field

2. const f = obj.method; f(); What is this inside method?
   - A) undefined (in strict mode), because the function was called on its own
   - B) obj
   - C) The global object, always

3. In a subclass constructor, what must happen before you use this?
   - A) Call super(...)
   - B) Call this.init()
   - C) Nothing; this is ready immediately

4. Why do arrow functions help with callbacks in classes?
   - A) They use the this of the surrounding code instead of having their own
   - B) They run faster
   - C) They can't be detached

<details>
<summary>Quiz answers</summary>

1. **A) A private field, accessible only inside the class**: Code outside the class can't read or write it.
2. **A) undefined (in strict mode), because the function was called on its own**: Use bind or an arrow function to keep this.
3. **A) Call super(...)**: super runs the parent's constructor.
4. **A) They use the this of the surrounding code instead of having their own**: An arrow function in a class field keeps its instance.

</details>

---
Previous: [Lesson 15](15-dates-and-time.md) · Next: [Lesson 17: Modules: import and export](17-modules.md)
