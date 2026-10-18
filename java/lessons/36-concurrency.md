# Lesson 36: Concurrency basics

**You'll learn:** threads, `ExecutorService`, futures, race conditions, `synchronized`, atomics, `CompletableFuture`.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/java/#concurrency)**: run every example and check your exercise answers.

## Key terms

- **Thread:** an independent path of execution.
- **ExecutorService:** a managed pool of threads that runs submitted tasks.
- **Future:** a handle to a result that will be available later.
- **Race condition:** a bug where the result depends on how threads interleave.
- **synchronized:** lets only one thread at a time run a block for a given lock.
- **Atomic variable:** a variable with thread-safe single operations, like `AtomicInteger`.
- **CompletableFuture:** a future you can chain asynchronous steps onto.

**Concurrency** means several tasks making progress at the same time: downloading while the UI stays responsive, or splitting heavy work across processor cores.

## Threads

A **thread** is an independent path of execution. You give it a `Runnable` (often a lambda) and `start()` it:

```java
public class Main {
    public static void main(String[] args) throws InterruptedException {
        Thread worker = new Thread(() -> {
            for (int i = 1; i <= 3; i++) {
                System.out.println("worker step " + i);
            }
        });
        worker.start();                  // runs alongside main
        System.out.println("main keeps going");
        worker.join();                   // wait for it to finish
        System.out.println("worker finished");
    }
}
```

The order of output from different threads isn't guaranteed. Call `start()`, not `run()`; `run()` would just execute the code on the current thread.

## Executors and futures

Creating threads by hand is low-level. An **ExecutorService** manages a pool of threads; you submit tasks and get back **Futures** for their results:

```java
import java.util.*;
import java.util.concurrent.*;

public class Main {
    public static void main(String[] args) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(4);
        List<Future<Long>> results = new ArrayList<>();
        for (int chunk = 0; chunk < 4; chunk++) {
            final long start = chunk * 250_000L;
            results.add(pool.submit(() -> {
                long sum = 0;
                for (long n = start; n < start + 250_000; n++) {
                    sum += n;
                }
                return sum;
            }));
        }
        long total = 0;
        for (Future<Long> f : results) {
            total += f.get();            // waits for each task's result
        }
        pool.shutdown();
        System.out.println("Sum 0..999,999 = " + total);
    }
}
```

Always `shutdown()` an executor when you're done; its threads otherwise keep the program alive.

## Race conditions

When threads **share** changeable data, updates can interleave and get lost. `count++` is really three steps (read, add, write), and two threads can read the same old value:

```java
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

public class Main {
    static int unsafeCount = 0;
    static int safeCount = 0;
    static final AtomicInteger atomicCount = new AtomicInteger();

    static synchronized void safeIncrement() {
        safeCount++;
    }

    public static void main(String[] args) throws InterruptedException {
        List<Thread> threads = new ArrayList<>();
        for (int t = 0; t < 4; t++) {
            Thread th = new Thread(() -> {
                for (int i = 0; i < 10_000; i++) {
                    unsafeCount++;
                    safeIncrement();
                    atomicCount.incrementAndGet();
                }
            });
            threads.add(th);
            th.start();
        }
        for (Thread th : threads) {
            th.join();
        }
        System.out.println("synchronized: " + safeCount);
        System.out.println("atomic:       " + atomicCount.get());
        System.out.println("unsafe:       " + unsafeCount + " (may be less than 40000 on a multi-core JVM)");
    }
}
```

- `synchronized` lets only one thread at a time run the method (or block) for a given lock.
- **Atomic** classes (`AtomicInteger`, `AtomicLong`) do single updates safely without locks.
- In the browser, Java threads take turns on one core, so the race rarely shows up here. On a real multi-core machine, the unsafe count is often wrong.

## Thread-safe collections

`ArrayList` and `HashMap` aren't safe for concurrent changes. Use `ConcurrentHashMap`, `CopyOnWriteArrayList`, or a `BlockingQueue` for producer/consumer setups:

```java
import java.util.concurrent.*;

public class Main {
    public static void main(String[] args) throws Exception {
        ConcurrentHashMap<String, Integer> hits = new ConcurrentHashMap<>();
        ExecutorService pool = Executors.newFixedThreadPool(3);
        for (String page : new String[]{"home", "about", "home", "home", "about"}) {
            pool.submit(() -> hits.merge(page, 1, Integer::sum));
        }
        pool.shutdown();
        pool.awaitTermination(5, TimeUnit.SECONDS);
        System.out.println(new java.util.TreeMap<>(hits));
    }
}
```

## CompletableFuture: composing async work

`CompletableFuture` chains steps that run asynchronously, without blocking until you need the result:

```java
import java.util.concurrent.*;

public class Main {
    static String fetchUser(int id) {
        sleep(100);
        return "user" + id;
    }

    static int fetchScore(String user) {
        sleep(100);
        return user.length() * 10;
    }

    static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    public static void main(String[] args) {
        CompletableFuture<String> pipeline = CompletableFuture
            .supplyAsync(() -> fetchUser(7))
            .thenApply(Main::fetchScore)
            .thenApply(score -> "score=" + score);

        CompletableFuture<String> other = CompletableFuture.supplyAsync(() -> fetchUser(8));
        System.out.println(pipeline.join() + " " + other.join());
    }
}
```

## Rules of thumb

- Prefer executors over raw threads, and immutable data over shared mutable data.
- Protect shared mutable state with `synchronized`, locks or atomic classes.
- Never call `Thread.sleep` to "fix" a race condition.
- Java 21 added **virtual threads** for handling huge numbers of concurrent tasks cheaply.

## Common mistakes

- Calling `run()` instead of `start()` on a thread.
- Sharing mutable data between threads without synchronization.
- Forgetting to `shutdown()` an executor.
- Using `Thread.sleep` to hide a race condition.

## Exercises

### 1. Parallel sum

Write `static long parallelSum(int[] nums, int parts)` that splits the array into `parts` chunks, sums each chunk in a task on an `ExecutorService`, and adds up the results. Shut the executor down before returning.

Starter code:

```java
import java.util.*;
import java.util.concurrent.*;

public class Main {
    static long parallelSum(int[] nums, int parts) throws Exception {
        long sum = 0;
        for (int n : nums) {
            sum += n;
        }
        return sum;
    }

    public static void main(String[] args) throws Exception {
        int[] data = new int[1000];
        for (int i = 0; i < data.length; i++) {
            data[i] = i + 1;
        }
        System.out.println(parallelSum(data, 4));
    }
}
```

**In the sandbox:** exercise 53. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. Compute a chunk size of (nums.length + parts - 1) / parts. For each chunk, submit a lambda that sums from..to and returns a Long. Collect the Futures, add up f.get(), and call shutdown() in a finally block.

</details>

<details>
<summary>Answers</summary>

**1. Parallel sum**

```java
import java.util.*;
import java.util.concurrent.*;

public class Main {
    static long parallelSum(int[] nums, int parts) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(parts);
        try {
            List<Future<Long>> futures = new ArrayList<>();
            int chunk = (nums.length + parts - 1) / parts;
            for (int start = 0; start < nums.length; start += chunk) {
                final int from = start;
                final int to = Math.min(start + chunk, nums.length);
                futures.add(pool.submit(() -> {
                    long sum = 0;
                    for (int i = from; i < to; i++) {
                        sum += nums[i];
                    }
                    return sum;
                }));
            }
            long total = 0;
            for (Future<Long> f : futures) {
                total += f.get();
            }
            return total;
        } finally {
            pool.shutdown();
        }
    }

    public static void main(String[] args) throws Exception {
        int[] data = new int[1000];
        for (int i = 0; i < data.length; i++) {
            data[i] = i + 1;
        }
        System.out.println(parallelSum(data, 4));
    }
}
```

</details>

## Quick quiz

1. What's the difference between `thread.start()` and `thread.run()`?
   - A) `run()` starts two threads
   - B) `start()` runs the code on a new thread; `run()` runs it on the current thread
   - C) They are the same

2. Why can `count++` from several threads lose updates?
   - A) Threads can't change static fields
   - B) It's a read, an add and a write that can interleave
   - C) Integers can't be shared

3. What should you call when you're done with an ExecutorService?
   - A) Nothing
   - B) shutdown()
   - C) stop()

<details>
<summary>Quiz answers</summary>

1. **B) `start()` runs the code on a new thread; `run()` runs it on the current thread**: Only `start()` creates concurrency.
2. **B) It's a read, an add and a write that can interleave**: Two threads may read the same old value and both write old + 1.
3. **B) shutdown()**: Otherwise its threads can keep the program running.

</details>

---
Previous: [Lesson 35](35-files-and-io.md) · Next: [Lesson 37: Algorithms and Big-O](37-algorithms-and-big-o.md)
