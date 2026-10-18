# Lesson 35: Files and I/O

**You'll learn:** `Path`, `Files.readString`/`writeString`, `Files.lines`, buffered readers, CSV parsing.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/java/#files-and-io)**: run every example and check your exercise answers.

## Key terms

- **Path:** names a file or folder.
- **Files:** utility methods for reading, writing and managing files.
- **IOException:** the checked exception for input/output failures.
- **BufferedReader / BufferedWriter:** read and write text efficiently, line by line.
- **CSV:** comma-separated values, a simple text format for tables.

Programs often load data from files and save results back. The modern API lives in **`java.nio.file`**: `Path` names a file and `Files` does the work. In this sandbox, files are stored in your browser, so the examples really run.

## Writing and reading a whole file

```java
import java.io.IOException;
import java.nio.file.*;
import java.util.List;

public class Main {
    public static void main(String[] args) throws IOException {
        Path notes = Path.of("notes.txt");
        Files.writeString(notes, "first line\nsecond line\n");
        Files.writeString(notes, "third line\n", StandardOpenOption.APPEND);

        String all = Files.readString(notes);
        System.out.print(all);

        List<String> lines = Files.readAllLines(notes);
        System.out.println(lines.size() + " lines, first: " + lines.get(0));
        System.out.println("exists: " + Files.exists(notes) + ", size: " + Files.size(notes) + " bytes");
    }
}
```

File operations throw the **checked** `IOException`, so `main` declares `throws IOException`. In a real application you'd catch it and show a helpful message.

## Processing lines one at a time

For large files, don't load everything at once. `Files.lines` streams lines lazily; use try-with-resources so the file is closed:

```java
import java.io.IOException;
import java.nio.file.*;
import java.util.stream.Stream;

public class Main {
    public static void main(String[] args) throws IOException {
        Path log = Path.of("app.log");
        Files.writeString(log, "INFO start\nERROR disk full\nINFO retry\nERROR timeout\n");

        try (Stream<String> lines = Files.lines(log)) {
            lines.filter(l -> l.startsWith("ERROR"))
                 .map(l -> l.substring(6))
                 .forEach(System.out::println);
        }
    }
}
```

## Buffered readers and writers

`BufferedReader` and `BufferedWriter` give fine-grained control, and work with any source, including text in memory, which makes them easy to test:

```java
import java.io.*;
import java.nio.file.*;

public class Main {
    public static void main(String[] args) throws IOException {
        Path out = Path.of("report.txt");
        try (BufferedWriter w = Files.newBufferedWriter(out)) {
            for (int i = 1; i <= 3; i++) {
                w.write("Row " + i);
                w.newLine();
            }
        }

        try (BufferedReader r = Files.newBufferedReader(out)) {
            String line;
            while ((line = r.readLine()) != null) {
                System.out.println("> " + line);
            }
        }

        BufferedReader fromText = new BufferedReader(new StringReader("a\nb"));
        System.out.println(fromText.readLine() + fromText.readLine());
    }
}
```

## Parsing CSV data

```java
import java.io.IOException;
import java.nio.file.*;
import java.util.*;

record Sale(String product, int qty, double price) {
    double total() { return qty * price; }
}

public class Main {
    public static void main(String[] args) throws IOException {
        Path csv = Path.of("sales.csv");
        Files.writeString(csv, """
            product,qty,price
            pen,10,1.50
            book,2,12.99
            pen,4,1.50
            """);

        List<Sale> sales = new ArrayList<>();
        List<String> lines = Files.readAllLines(csv);
        for (String line : lines.subList(1, lines.size())) {      // skip the header
            String[] f = line.split(",");
            sales.add(new Sale(f[0], Integer.parseInt(f[1]), Double.parseDouble(f[2])));
        }

        Map<String, Double> byProduct = new TreeMap<>();
        for (Sale s : sales) {
            byProduct.merge(s.product(), s.total(), Double::sum);
        }
        byProduct.forEach((p, t) -> System.out.printf("%-5s %6.2f%n", p, t));
    }
}
```

Simple `split(",")` breaks on values that contain commas inside quotes. For real CSV files, use a library such as OpenCSV or Apache Commons CSV.

## Paths and directories

```java
import java.io.IOException;
import java.nio.file.*;

public class Main {
    public static void main(String[] args) throws IOException {
        Path dir = Path.of("data", "2026");
        Files.createDirectories(dir);
        Path file = dir.resolve("summary.txt");
        Files.writeString(file, "ok");
        System.out.println(file + " -> " + file.getFileName() + " in " + file.getParent());
        try (var listing = Files.list(dir)) {
            listing.forEach(p -> System.out.println("found " + p.getFileName()));
        }
        Files.delete(file);
        System.out.println(Files.exists(file));
    }
}
```

## Common mistakes

- Not handling or declaring `IOException`.
- Forgetting to close streams from `Files.lines`. Use try-with-resources.
- Reading huge files entirely into memory instead of line by line.
- Splitting quoted CSV values with a plain `split(",")`.

## Exercises

### 1. Count words in a file

Write `static int countWords(Path file) throws IOException` that reads the file and returns the number of words (split each line on whitespace and ignore blank lines). The checker writes a test file and calls your method.

Starter code:

```java
import java.io.IOException;
import java.nio.file.*;

public class Main {
    static int countWords(Path file) throws IOException {
        return 0;
    }

    public static void main(String[] args) throws IOException {
        Path p = Path.of("poem.txt");
        Files.writeString(p, "roses are red\nviolets are blue\n");
        System.out.println(countWords(p));
    }
}
```

**In the sandbox:** exercise 52. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Loop over Files.readAllLines(file). Skip blank lines; for the others add line.trim().split("\\s+").length.

</details>

<details>
<summary>Answers</summary>

**1. Count words in a file**

```java
import java.io.IOException;
import java.nio.file.*;

public class Main {
    static int countWords(Path file) throws IOException {
        int count = 0;
        for (String line : Files.readAllLines(file)) {
            if (!line.isBlank()) {
                count += line.trim().split("\\s+").length;
            }
        }
        return count;
    }

    public static void main(String[] args) throws IOException {
        Path p = Path.of("poem.txt");
        Files.writeString(p, "roses are red\nviolets are blue\n");
        System.out.println(countWords(p));
    }
}
```

</details>

## Quick quiz

1. Why does `Files.readString` need `throws IOException` or a try/catch?
   - A) It always fails
   - B) IOException is a checked exception
   - C) Files is a deprecated class

2. Why use try-with-resources with `Files.lines(...)`?
   - A) It makes reading faster
   - B) So the file is closed when you're done
   - C) It's required to filter lines

<details>
<summary>Quiz answers</summary>

1. **B) IOException is a checked exception**: The compiler requires checked exceptions to be handled or declared.
2. **B) So the file is closed when you're done**: The stream holds the file open until it's closed.

</details>

---
Previous: [Lesson 34](34-modern-java-features.md) · Next: [Lesson 36: Concurrency basics](36-concurrency.md)
