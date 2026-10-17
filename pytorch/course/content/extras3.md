@@ datasets
topics: the Dataset and DataLoader split of responsibilities, the map-style Dataset protocol (__len__ and __getitem__), TensorDataset, a custom Dataset reading a CSV file, float32 features and int64 labels, eager versus lazy loading, torchvision's ready-made datasets, Subset, ConcatDataset, random_split with lengths or fractions and a seeded Generator
terms:
- **Dataset:** an object that returns one sample by index (`ds[i]`) and knows how many samples it has (`len(ds)`).
- **Map-style dataset:** a dataset that implements `__len__` and `__getitem__`, so any sample can be read by index.
- **TensorDataset:** a dataset wrapping tensors with the same first dimension; `ds[i]` is the tuple of their i-th rows.
- **Lazy loading:** reading each sample from disk only when `__getitem__` asks for it, instead of all at once.
- **Subset:** a dataset view made of some of another dataset's samples, chosen by index.
- **ConcatDataset:** several datasets joined end to end.
- **random_split:** splits a dataset into non-overlapping random Subsets of given lengths or fractions.
- **Training / validation / test split:** data to learn from, data to tune decisions on, and data for one final unbiased score.
mistakes:
- Returning Python numbers or float64 features from `__getitem__` instead of float32 tensors.
- Returning float class labels when `nn.CrossEntropyLoss` needs int64 class indexes.
- Loading a huge image dataset into memory in `__init__` instead of reading files in `__getitem__`.
- Splitting without a seeded generator, so the split changes every run.
- Giving `random_split` lengths that don't add up to the dataset's length.

glance:
- Data already in tensors | `TensorDataset(x, y)` | `ds[i] == (x[i], y[i])` | every tensor needs the same size of dim 0
- Your own data | `class MyData(Dataset)` with `__len__`, `__getitem__` | samples on demand | float32 features, int64 labels
- Big data on disk | store paths in `__init__`, read in `__getitem__` | low memory, parallel loading | lazy loading
- Some samples | `Subset(ds, indices)` | a view by index | indexes into the original dataset
- Join datasets | `ConcatDataset([a, b])` or `a + b` | one longer dataset | map-style only
- Split | `random_split(ds, [0.8, 0.1, 0.1], generator=g)` | Subsets | fractions round down; leftovers go to the first pieces

@@ dataloaders
topics: iterating a DataLoader, batch_size and the last smaller batch, drop_last, len(loader), shuffle=True and a new order every epoch, generator for reproducible shuffling, how iterating draws a base seed, default_collate's rules, Python floats becoming float64, custom collate_fn with pad_sequence, batch_size=None, a full training loop with training and validation loaders, moving batches to the device
terms:
- **DataLoader:** iterates over a dataset in batches, handling the sampling order, batching, collation and optional worker processes.
- **Batch size:** the number of samples combined into one batch and one training step.
- **drop_last:** skips the final batch if it's smaller than batch_size.
- **Epoch:** one full pass over the training data.
- **Shuffling:** visiting the samples in a new random order each epoch.
- **Collation:** combining a list of samples into one batch; `default_collate` stacks tensors and converts numbers.
- **collate_fn:** the function a DataLoader calls to turn a list of samples into a batch; replace it for data that can't simply be stacked.
- **Padding:** filling shorter sequences with a pad value so they can share one tensor.
- **pad_sequence:** pads a list of variable-length tensors to the longest one (`torch.nn.utils.rnn`).
mistakes:
- Shuffling the validation or test loader (harmless but pointless) or forgetting to shuffle the training loader.
- Averaging per-batch mean losses without weighting by batch size when the last batch is smaller.
- Returning Python floats from a dataset and getting float64 batches that a float32 model rejects.
- Using default_collate on variable-length sequences instead of a padding collate_fn.
- Moving the whole dataset to the GPU instead of each batch.
- Accumulating `loss` instead of `loss.item()`, which keeps every graph in memory.

glance:
- Batches | `DataLoader(ds, batch_size=32)` | tensors with a batch dim | last batch may be smaller
- Equal-sized batches | `drop_last=True` | len = n // batch_size | the leftover samples are skipped that epoch
- Training order | `shuffle=True` | a new permutation each epoch | don't shuffle validation or test
- Reproducible order | `generator=torch.Generator().manual_seed(0)` | the same shuffles every run | iterating also draws a base seed
- Default batching | `default_collate` | stacked tensors; ints → int64, floats → float64 | tuples come back as lists
- Variable lengths | `collate_fn=pad_batch` with `pad_sequence(..., batch_first=True)` | `[batch, longest]` | pad per batch, keep the lengths
- Training loop | `for xb, yb in train_loader:` then the five steps | one epoch | `xb.to(device)` inside the loop

@@ samplers-and-workers
topics: samplers and the order of indexes, SequentialSampler, RandomSampler with and without replacement, SubsetRandomSampler, BatchSampler, sampler and shuffle being mutually exclusive, WeightedRandomSampler for imbalanced classes, num_workers and parallel loading, worker processes with their own dataset copies and seeds, get_worker_info and worker_init_fn, IterableDataset and sharding a stream across workers, pin_memory with non_blocking copies, persistent_workers and prefetch_factor
terms:
- **Sampler:** an object that yields the indexes a DataLoader fetches, in order.
- **RandomSampler:** yields a random permutation of the indexes (or random indexes with replacement).
- **BatchSampler:** groups another sampler's indexes into lists of batch_size.
- **WeightedRandomSampler:** draws indexes with probability proportional to per-sample weights, usually with replacement.
- **Oversampling:** drawing rare-class samples more often so the classes are balanced during training.
- **num_workers:** how many worker processes load batches in parallel; 0 means the main process loads them.
- **get_worker_info():** inside a DataLoader worker, returns its id, num_workers, seed and dataset copy; None in the main process.
- **IterableDataset:** a dataset defined by `__iter__`, for data read as a stream rather than by index.
- **Sharding:** giving each worker a different part of the data so nothing is loaded twice.
- **Pinned memory:** page-locked CPU memory that makes copies to the GPU faster and allows non_blocking ones.
- **persistent_workers:** keeps worker processes alive between epochs instead of restarting them.
mistakes:
- Passing both `sampler=` and `shuffle=True`.
- Giving WeightedRandomSampler one weight per class instead of one per sample.
- Iterating an IterableDataset with several workers without sharding, so every sample repeats per worker.
- Expecting changes a worker makes to the dataset object to be visible in the main process.
- Setting num_workers far above the number of CPU cores.
- Using pin_memory without `non_blocking=True` copies (or the other way round) and expecting overlap.

glance:
- Choose the order | `sampler=RandomSampler(ds)` / `SequentialSampler(ds)` | the index order | can't combine with shuffle=
- Some indexes, shuffled | `SubsetRandomSampler(idx)` | a random order of chosen indexes | for manual splits
- Balance classes | `WeightedRandomSampler(1 / counts[labels], len(labels))` | rare classes drawn more | one weight per sample; repeats rare samples
- Parallel loading | `num_workers=4` | batches loaded in the background | each worker: own dataset copy, seed base_seed + id
- Who am I? | `get_worker_info()` | id, num_workers, seed, dataset | None in the main process
- Streams | `IterableDataset` with `__iter__` | data read in order | shard by `info.id` and `info.num_workers`
- Faster GPU copies | `pin_memory=True` + `.to(device, non_blocking=True)` | overlapped transfers | warns without an accelerator
- Reuse workers | `persistent_workers=True` | no restart each epoch | needs num_workers > 0

@@ transforms
topics: what a transform is, torchvision.transforms.v2, tv_tensors.Image, ToImage, ToDtype with scale=True, Normalize with per-channel mean and std, Compose, the deprecated ToTensor, ImageNet normalisation statistics, computing statistics over the training set, data augmentation with RandomHorizontalFlip and RandomCrop, separate training and evaluation pipelines, transform and target_transform in a Dataset, transforms passing labels through
terms:
- **Transform:** a function applied to each sample as it's loaded, to convert, scale or randomly change it.
- **torchvision.transforms.v2:** torchvision's current transforms API for images, boxes, masks and videos.
- **tv_tensors.Image:** a tensor subclass marking a tensor as a `[C, H, W]` image for v2 transforms.
- **ToDtype(scale=True):** converts dtype and rescales values, for example uint8 0–255 to float 0–1.
- **Normalize:** subtracts a per-channel mean and divides by a per-channel standard deviation.
- **Compose:** chains transforms into one pipeline applied in order.
- **Data augmentation:** random, label-preserving changes to training samples that act like extra data.
- **target_transform:** a transform applied to a sample's label instead of its input.
mistakes:
- Normalising before converting uint8 to float (Normalize raises a TypeError).
- Augmenting validation or test data.
- Using different normalisation statistics for training and evaluation.
- Computing normalisation statistics on all the data instead of the training split.
- Choosing augmentations that change the label (flipping digits or text).
- Using the deprecated `ToTensor()` in new code instead of `ToImage()` + `ToDtype(torch.float32, scale=True)`.

glance:
- To a model input | `v2.Compose([v2.ToImage(), v2.ToDtype(torch.float32, scale=True), v2.Normalize(mean, std)])` | float32 `[C, H, W]`, about mean 0 | Normalize needs floats
- Channels first | `v2.ToImage()` | `[H, W, C]` array → `[C, H, W]` Image | dtype unchanged
- Scale | `v2.ToDtype(torch.float32, scale=True)` | uint8 0–255 → 0–1 | replaces ToTensor
- Statistics | `x.mean(dim=(0, 2, 3))`, `x.std(dim=(0, 2, 3))` | one value per channel | training images only
- Augment | `v2.RandomHorizontalFlip()`, `v2.RandomCrop(28, padding=4)` | a new variation each epoch | training pipeline only
- In a Dataset | `transform`, `target_transform` in `__getitem__` | per-sample processing | labels pass through v2 transforms

@@ data-quality
topics: silent data bugs, inspecting raw CSV data, missing values, impossible values, inconsistent labels, wrong units, duplicates, NaN and inf in tensors with isnan, isfinite and nan_to_num, data leakage from statistics, duplicates, augmentation and test-set reuse, stratified splits, class imbalance and class-weighted cross-entropy, accuracy on imbalanced data, sanity checks on a batch, overfitting one batch, the expected starting loss
terms:
- **Data leakage:** information from validation or test data reaching training, making scores look better than real performance.
- **Imputation:** filling a missing value with an estimate, such as the training set's mean.
- **Outlier:** a value far from the rest, often an error such as a wrong unit.
- **Stratified split:** a split that keeps each class's proportion the same in every subset.
- **Class imbalance:** some classes having far more samples than others.
- **Class weights:** per-class multipliers for the loss that make mistakes on rare classes cost more.
- **Overfitting one batch:** training on a single small batch until the loss is near zero, to prove the pipeline can learn.
mistakes:
- Turning raw data into tensors without checking for missing, impossible or inconsistent values.
- Fitting normalisation (or any preprocessing) on all the data before splitting.
- Removing duplicates after splitting, leaving copies on both sides.
- Splitting related records (frames, sentences, one patient's scans) across training and test sets.
- Judging an imbalanced classifier by overall accuracy alone.
- Starting a long training run without checking one batch's shapes, dtypes and values.

glance:
- Find gaps | `any(v.strip() == "" for v in row.values())` / `torch.isnan(x)` | rows to drop or impute | check before `float(...)`
- Non-finite values | `torch.isfinite(x).all()`, `torch.nan_to_num(x)` | catch NaN and inf | one NaN poisons the whole model
- Avoid leakage | fit mean / std on `train` only, apply to val and test | honest validation scores | dedupe before splitting
- Stratify | split each class's indexes separately | every class in every split | matters for small, imbalanced data
- Weight the loss | `nn.CrossEntropyLoss(weight=n / (k * counts))` | rare classes matter more | one weight per class
- Sanity check | inspect `next(iter(loader))`, overfit one batch | shapes, dtypes, ranges; loss → 0 | first loss ≈ ln(classes)
