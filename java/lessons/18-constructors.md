# Lesson 18: Constructors and this

**You'll learn:** constructors, `this`, overloaded constructors, `this(...)` chaining, validation.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/java/#constructors)**: run every example and check your exercise answers.

## Key terms

- **Constructor:** special code that initialises a new object; it has the class's name and no return type.
- **this:** a reference to the current object.
- **Default constructor:** the empty constructor Java adds only when a class declares none.
- **Constructor chaining:** one constructor calling another with `this(...)`.

Setting every field by hand after `new` is tedious and easy to forget. A **constructor** runs automatically when an object is created and sets it up properly.

```java
class Dog {
    String name;
    int age;

    Dog(String name, int age) {      // constructor: same name as the class, no return type
        this.name = name;
        this.age = age;
    }

    String describe() {
        return name + " (" + age + ")";
    }
}

public class Main {
    public static void main(String[] args) {
        Dog rex = new Dog("Rex", 3);
        System.out.println(rex.describe());
    }
}
```

## this

Inside a constructor or instance method, `this` means "the current object". `this.name = name;` copies the **parameter** `name` into the **field** `name`. Without `this`, `name = name;` would just assign the parameter to itself.

## Overloaded constructors and chaining

A class can have several constructors with different parameters. One constructor can call another with `this(...)`, which must be its first statement:

```java
class Coffee {
    String size;
    int shots;

    Coffee(String size, int shots) {
        this.size = size;
        this.shots = shots;
    }

    Coffee(String size) {
        this(size, 1);            // reuse the main constructor
    }

    Coffee() {
        this("medium");
    }

    @Override
    public String toString() {
        return size + " with " + shots + " shot(s)";
    }
}

public class Main {
    public static void main(String[] args) {
        System.out.println(new Coffee("large", 3));
        System.out.println(new Coffee("small"));
        System.out.println(new Coffee());
    }
}
```

## The default constructor

If you write **no** constructor, Java provides an empty one, which is why `new Dog()` worked in the previous lesson. As soon as you write any constructor, that free default disappears:

*This example raises an error on purpose.*

```java
class Dog {
    String name;

    Dog(String name) {
        this.name = name;
    }
}

public class Main {
    public static void main(String[] args) {
        Dog d = new Dog();
        System.out.println(d.name);
    }
}
```

## Validating in the constructor

Constructors are the perfect place to reject bad data, so invalid objects can never exist:

```java
class Temperature {
    double celsius;

    Temperature(double celsius) {
        if (celsius < -273.15) {
            throw new IllegalArgumentException("Below absolute zero: " + celsius);
        }
        this.celsius = celsius;
    }
}

public class Main {
    public static void main(String[] args) {
        System.out.println(new Temperature(21.5).celsius);
        try {
            new Temperature(-300);
        } catch (IllegalArgumentException e) {
            System.out.println("Rejected: " + e.getMessage());
        }
    }
}
```

`throw` and `try/catch` are covered in detail in Part 5.

## Common mistakes

- Writing `name = name;` instead of `this.name = name;`.
- Giving a constructor a return type such as `void`, which turns it into a method.
- Calling `new Dog()` after defining only `Dog(String name)`.
- Putting `this(...)` anywhere other than the first line.

## Exercises

### 1. Book

Create a class `Book` with fields `title`, `author` and `pages`, and two constructors: `Book(String title, String author, int pages)` and `Book(String title, String author)` which sets `pages` to `100` by calling the first one with `this(...)`. Add a `toString()` returning like `Dune by Frank Herbert (412 pages)`.

Starter code:

```java
class Book {

}

public class Main {
    public static void main(String[] args) {
        // System.out.println(new Book("Dune", "Frank Herbert", 412));
    }
}
```

**In the sandbox:** exercise 28. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. The two-argument constructor's body is just this(title, author, 100); and toString() must be declared public.

</details>

<details>
<summary>Answers</summary>

**1. Book**

```java
class Book {
    String title;
    String author;
    int pages;

    Book(String title, String author, int pages) {
        this.title = title;
        this.author = author;
        this.pages = pages;
    }

    Book(String title, String author) {
        this(title, author, 100);
    }

    @Override
    public String toString() {
        return title + " by " + author + " (" + pages + " pages)";
    }
}

public class Main {
    public static void main(String[] args) {
        System.out.println(new Book("Dune", "Frank Herbert", 412));
    }
}
```

</details>

## Quick quiz

1. What is special about a constructor's declaration?
   - A) It has the class's name and no return type
   - B) It must be static
   - C) It must be called init

2. In `this.name = name;`, what does `this.name` refer to?
   - A) A local variable
   - B) The parameter
   - C) The object's field

3. When does Java provide a default no-argument constructor?
   - A) Always
   - B) Only if the class declares no constructors at all
   - C) Never

<details>
<summary>Quiz answers</summary>

1. **A) It has the class's name and no return type**: `Dog(String name) { ... }`: same name as the class, no return type, not even void.
2. **C) The object's field**: `this.` picks the field; the plain `name` is the parameter.
3. **B) Only if the class declares no constructors at all**: Writing any constructor removes the automatic default one.

</details>

---
Previous: [Lesson 17](17-classes-and-objects.md) · Next: [Lesson 19: Encapsulation](19-encapsulation.md)
