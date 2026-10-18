# Lesson 19: Encapsulation

**You'll learn:** `private` fields, access modifiers, getters and setters, validation, immutability.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/java/#encapsulation)**: run every example and check your exercise answers.

## Key terms

- **Encapsulation:** hiding an object's data and controlling access through methods.
- **Access modifier:** `private`, package-private (none), `protected` or `public`.
- **Getter / setter:** methods that read / change a field.
- **Invariant:** a rule an object always keeps true, like "balance is never negative".
- **Immutable object:** an object whose state can't change after construction.

**Encapsulation** means an object protects its own data. Other code shouldn't reach in and set fields to invalid values; it should ask the object through methods, and the object enforces its rules.

## Access modifiers

| Modifier | Visible to |
|---|---|
| `private` | only the same class |
| *(none)* | the same package |
| `protected` | the same package and subclasses |
| `public` | everyone |

The usual design: fields `private`, methods that others need `public`.

```java
class BankAccount {
    private final String owner;
    private double balance;

    public BankAccount(String owner, double opening) {
        if (opening < 0) {
            throw new IllegalArgumentException("Opening balance can't be negative");
        }
        this.owner = owner;
        this.balance = opening;
    }

    public void deposit(double amount) {
        if (amount <= 0) {
            throw new IllegalArgumentException("Deposit must be positive");
        }
        balance += amount;
    }

    public boolean withdraw(double amount) {
        if (amount <= 0 || amount > balance) {
            return false;
        }
        balance -= amount;
        return true;
    }

    public double getBalance() {
        return balance;
    }

    public String getOwner() {
        return owner;
    }
}

public class Main {
    public static void main(String[] args) {
        BankAccount acct = new BankAccount("Ana", 100);
        acct.deposit(50);
        System.out.println(acct.withdraw(500));
        System.out.println(acct.withdraw(30));
        System.out.println(acct.getOwner() + ": " + acct.getBalance());
        // acct.balance = 1_000_000;   // won't compile: balance is private
    }
}
```

Because `balance` is private, the only way to change it is through `deposit` and `withdraw`, so it can never go negative.

## Getters and setters

A **getter** returns a field (`getBalance()`); a **setter** changes one (`setName(...)`). Don't add a setter for every field automatically. Add one only when changing the field makes sense, and validate in it:

```java
class Person {
    private String name;
    private int age;

    public Person(String name, int age) {
        this.name = name;
        setAge(age);
    }

    public int getAge() {
        return age;
    }

    public void setAge(int age) {
        if (age < 0 || age > 150) {
            throw new IllegalArgumentException("Unrealistic age: " + age);
        }
        this.age = age;
    }

    public String getName() {
        return name;
    }
}

public class Main {
    public static void main(String[] args) {
        Person p = new Person("Grace", 85);
        p.setAge(86);
        System.out.println(p.getName() + " is " + p.getAge());
    }
}
```

By convention, a boolean getter is named `isSomething()`, like `isEmpty()`.

## Immutable objects

An object whose state can't change after construction is **immutable**: make the fields `private final` and provide no setters. `String` works this way. Immutable objects are simple to reason about and safe to share.

## Common mistakes

- Making fields public, so any code can put the object into an invalid state.
- Adding a setter for every field by reflex.
- Setters that don't validate their input.

## Exercises

### 1. Thermostat

Create a class `Thermostat` with a **private** `double` field `target`, a constructor `Thermostat(double target)`, `getTarget()`, and `setTarget(double t)` that throws `IllegalArgumentException` unless `t` is between `10` and `30` inclusive. The constructor should use the same rule.

Starter code:

```java
class Thermostat {
    double target;
}

public class Main {
    public static void main(String[] args) {
        // Thermostat t = new Thermostat(21);
    }
}
```

**In the sandbox:** exercise 29. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Make target private. In setTarget, throw new IllegalArgumentException(...) when t < 10 || t > 30. Have the constructor call setTarget(target) so the rule lives in one place.

</details>

<details>
<summary>Answers</summary>

**1. Thermostat**

```java
class Thermostat {
    private double target;

    public Thermostat(double target) {
        setTarget(target);
    }

    public double getTarget() {
        return target;
    }

    public void setTarget(double t) {
        if (t < 10 || t > 30) {
            throw new IllegalArgumentException("Target must be between 10 and 30");
        }
        target = t;
    }
}

public class Main {
    public static void main(String[] args) {
        Thermostat t = new Thermostat(21);
        t.setTarget(25.5);
        System.out.println(t.getTarget());
    }
}
```

</details>

## Quick quiz

1. Which modifier hides a field from every other class?
   - A) public
   - B) protected
   - C) private

2. Why make `balance` private and offer `deposit`/`withdraw`?
   - A) It's required for doubles
   - B) Private fields are faster
   - C) So the account can enforce its rules, like never going negative

<details>
<summary>Quiz answers</summary>

1. **C) private**: `private` members are visible only inside their own class.
2. **C) So the account can enforce its rules, like never going negative**: Methods can validate every change; direct field access can't.

</details>

---
Previous: [Lesson 18](18-constructors.md) · Next: [Lesson 20: Static fields and methods](20-static-members.md)
