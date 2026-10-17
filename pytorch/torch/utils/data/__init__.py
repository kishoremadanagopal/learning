"""torch.utils.data in the sandbox: datasets, samplers, DataLoader and collation, following PyTorch 2.14.

Random choices (shuffling, random_split, samplers) use the same generators and the same order of draws as
PyTorch, so seeded results match. Workers (num_workers > 0) can't start new processes in a browser, so the
sandbox runs each worker inside this process, with its own copy of the dataset, its own random seed
(base_seed + worker_id, like PyTorch) and get_worker_info(), handing out batches round-robin as PyTorch does.
The batches you get are the same; there is just no speed-up."""
import bisect
import collections.abc
import copy
import itertools
import math
import random as _pyrandom
import re
import warnings

import numpy as np

from ... import _core
from ..._core import Tensor

__all__ = ["Dataset", "IterableDataset", "TensorDataset", "StackDataset", "ConcatDataset", "ChainDataset", "Subset",
           "random_split", "Sampler", "SequentialSampler", "RandomSampler", "SubsetRandomSampler",
           "WeightedRandomSampler", "BatchSampler", "DataLoader", "default_collate", "default_convert",
           "get_worker_info"]


# ---------------------------------------------------------------- datasets

class Dataset:
    """A map-style dataset: subclasses define __getitem__(index) (and usually __len__)."""

    def __getitem__(self, index):
        raise NotImplementedError("Subclasses of Dataset should implement __getitem__.")

    def __add__(self, other):
        return ConcatDataset([self, other])


class IterableDataset(Dataset):
    """A stream of samples: subclasses define __iter__."""

    def __iter__(self):
        raise NotImplementedError("Subclasses of IterableDataset should implement __iter__.")

    def __add__(self, other):
        return ChainDataset([self, other])


class TensorDataset(Dataset):
    """Samples are the i-th rows of each tensor: dataset[i] == (t1[i], t2[i], ...)."""

    def __init__(self, *tensors):
        assert all(tensors[0].size(0) == tensor.size(0) for tensor in tensors), "Size mismatch between tensors"
        self.tensors = tensors

    def __getitem__(self, index):
        return tuple(tensor[index] for tensor in self.tensors)

    def __len__(self):
        return self.tensors[0].size(0)


class StackDataset(Dataset):
    def __init__(self, *args, **kwargs):
        if args and kwargs:
            raise ValueError("Supported either ``tuple``- (via ``args``) or``dict``- (via ``kwargs``) like input/output, but both types are given.")
        self._datasets = args or kwargs
        self._length = len(next(iter(self._datasets.values())) if kwargs else args[0])

    def __getitem__(self, index):
        if isinstance(self._datasets, dict):
            return {k: d[index] for k, d in self._datasets.items()}
        return tuple(d[index] for d in self._datasets)

    def __len__(self):
        return self._length


class ConcatDataset(Dataset):
    """Datasets joined end to end."""

    @staticmethod
    def cumsum(sequence):
        r, s = [], 0
        for e in sequence:
            s += len(e)
            r.append(s)
        return r

    def __init__(self, datasets):
        self.datasets = list(datasets)
        assert len(self.datasets) > 0, "datasets should not be an empty iterable"
        for d in self.datasets:
            assert not isinstance(d, IterableDataset), "ConcatDataset does not support IterableDataset"
        self.cumulative_sizes = self.cumsum(self.datasets)

    def __len__(self):
        return self.cumulative_sizes[-1]

    def __getitem__(self, idx):
        if idx < 0:
            if -idx > len(self):
                raise ValueError("absolute value of index should not exceed dataset length")
            idx = len(self) + idx
        dataset_idx = bisect.bisect_right(self.cumulative_sizes, idx)
        sample_idx = idx if dataset_idx == 0 else idx - self.cumulative_sizes[dataset_idx - 1]
        return self.datasets[dataset_idx][sample_idx]


class ChainDataset(IterableDataset):
    def __init__(self, datasets):
        self.datasets = datasets

    def __iter__(self):
        for d in self.datasets:
            yield from d

    def __len__(self):
        return sum(len(d) for d in self.datasets)


class Subset(Dataset):
    """The samples of `dataset` at `indices`, in that order."""

    def __init__(self, dataset, indices):
        self.dataset = dataset
        self.indices = indices

    def __getitem__(self, idx):
        if isinstance(idx, list):
            return self.dataset[[self.indices[i] for i in idx]]
        return self.dataset[self.indices[idx]]

    def __getitems__(self, indices):
        if callable(getattr(self.dataset, "__getitems__", None)):
            return self.dataset.__getitems__([self.indices[idx] for idx in indices])
        return [self.dataset[self.indices[idx]] for idx in indices]

    def __len__(self):
        return len(self.indices)


def random_split(dataset, lengths, generator=None):
    """Split a dataset into non-overlapping random subsets of the given lengths (or fractions that sum to 1)."""
    if generator is None:
        generator = _core.default_generator
    if math.isclose(sum(lengths), 1) and sum(lengths) <= 1:
        subset_lengths = []
        for i, frac in enumerate(lengths):
            if frac < 0 or frac > 1:
                raise ValueError(f"Fraction at index {i} is not between 0 and 1")
            subset_lengths.append(math.floor(len(dataset) * frac))
        remainder = len(dataset) - sum(subset_lengths)
        for i in range(remainder):
            subset_lengths[i % len(subset_lengths)] += 1
        lengths = subset_lengths
        for i, length in enumerate(lengths):
            if length == 0:
                warnings.warn(f"Length of split at index {i} is 0. This might result in an empty dataset.", stacklevel=2)
    if sum(lengths) != len(dataset):
        raise ValueError("Sum of input lengths does not equal the length of the input dataset!")
    indices = _core.randperm(sum(lengths), generator=generator).tolist()
    return [Subset(dataset, indices[offset - length:offset])
            for offset, length in zip(itertools.accumulate(lengths), lengths)]


# ---------------------------------------------------------------- samplers

class Sampler:
    """Yields indexes (or lists of indexes) into a dataset."""

    def __init__(self, data_source=None):
        pass

    def __iter__(self):
        raise NotImplementedError


class SequentialSampler(Sampler):
    def __init__(self, data_source):
        self.data_source = data_source

    def __iter__(self):
        return iter(range(len(self.data_source)))

    def __len__(self):
        return len(self.data_source)


def _random_seed_from(generator=None):
    """int(torch.empty((), dtype=torch.int64).random_(generator=generator).item()), as PyTorch draws it."""
    return _core._gen(generator).random_int64()


class RandomSampler(Sampler):
    def __init__(self, data_source, replacement=False, num_samples=None, generator=None):
        self.data_source = data_source
        self.replacement = replacement
        self._num_samples = num_samples
        self.generator = generator
        if not isinstance(self.replacement, bool):
            raise TypeError(f"replacement should be a boolean value, but got replacement={self.replacement}")
        if not isinstance(self.num_samples, int) or self.num_samples <= 0:
            raise ValueError(f"num_samples should be a positive integer value, but got num_samples={self.num_samples}")

    @property
    def num_samples(self):
        return len(self.data_source) if self._num_samples is None else self._num_samples

    def __iter__(self):
        n = len(self.data_source)
        if self.generator is None:
            seed = _random_seed_from(None)
            generator = _core.Generator()
            generator.manual_seed(seed)
        else:
            generator = self.generator
        if self.replacement:
            for _ in range(self.num_samples // 32):
                yield from _core.randint(0, n, (32,), dtype=_core.int64, generator=generator).tolist()
            yield from _core.randint(0, n, (self.num_samples % 32,), dtype=_core.int64, generator=generator).tolist()
        else:
            for _ in range(self.num_samples // n):
                yield from _core.randperm(n, generator=generator).tolist()
            yield from _core.randperm(n, generator=generator).tolist()[:self.num_samples % n]

    def __len__(self):
        return self.num_samples


class SubsetRandomSampler(Sampler):
    def __init__(self, indices, generator=None):
        self.indices = indices
        self.generator = generator

    def __iter__(self):
        for i in _core.randperm(len(self.indices), generator=self.generator).tolist():
            yield self.indices[i]

    def __len__(self):
        return len(self.indices)


class WeightedRandomSampler(Sampler):
    """Draws num_samples indexes with probability proportional to weights (with replacement by default):
    the usual fix for an imbalanced dataset."""

    def __init__(self, weights, num_samples, replacement=True, generator=None):
        if not isinstance(num_samples, int) or isinstance(num_samples, bool) or num_samples <= 0:
            raise ValueError(f"num_samples should be a positive integer value, but got num_samples={num_samples}")
        if not isinstance(replacement, bool):
            raise ValueError(f"replacement should be a boolean value, but got replacement={replacement}")
        weights_tensor = _core.as_tensor(weights, dtype=_core.double)
        if len(weights_tensor.shape) != 1:
            raise ValueError(f"weights should be a 1d sequence but given weights have shape {tuple(weights_tensor.shape)}")
        self.weights = weights_tensor
        self.num_samples = num_samples
        self.replacement = replacement
        self.generator = generator

    def __iter__(self):
        rand_tensor = _core.multinomial(self.weights, self.num_samples, self.replacement, generator=self.generator)
        yield from iter(rand_tensor.tolist())

    def __len__(self):
        return self.num_samples


class BatchSampler(Sampler):
    """Groups another sampler's indexes into lists of batch_size."""

    def __init__(self, sampler, batch_size, drop_last):
        if not isinstance(batch_size, int) or isinstance(batch_size, bool) or batch_size <= 0:
            raise ValueError(f"batch_size should be a positive integer value, but got batch_size={batch_size}")
        if not isinstance(drop_last, bool):
            raise ValueError(f"drop_last should be a boolean value, but got drop_last={drop_last}")
        self.sampler = sampler
        self.batch_size = batch_size
        self.drop_last = drop_last

    def __iter__(self):
        sampler_iter = iter(self.sampler)
        if self.drop_last:
            args = [sampler_iter] * self.batch_size
            for batch_droplast in zip(*args):
                yield [*batch_droplast]
        else:
            batch = [*itertools.islice(sampler_iter, self.batch_size)]
            while batch:
                yield batch
                batch = [*itertools.islice(sampler_iter, self.batch_size)]

    def __len__(self):
        if self.drop_last:
            return len(self.sampler) // self.batch_size
        return (len(self.sampler) + self.batch_size - 1) // self.batch_size


class _InfiniteConstantSampler(Sampler):
    def __iter__(self):
        while True:
            yield None


# ---------------------------------------------------------------- collation

_np_str_obj_array_pattern = re.compile(r"[SaUO]")
_ERR = "default_collate: batch must contain tensors, numpy arrays, numbers, dicts or lists; found {}"


def default_convert(data):
    """batch_size=None: turn NumPy arrays and numbers inside a sample into tensors, without adding a batch dim."""
    if isinstance(data, Tensor):
        return data
    if isinstance(data, np.ndarray):
        if _np_str_obj_array_pattern.search(data.dtype.str) is not None:
            return data
        return _core.as_tensor(data)
    if isinstance(data, np.generic):
        return _core.as_tensor(data)
    if isinstance(data, collections.abc.Mapping):
        return {k: default_convert(v) for k, v in data.items()}
    if isinstance(data, tuple) and hasattr(data, "_fields"):
        return type(data)(*(default_convert(d) for d in data))
    if isinstance(data, tuple):
        return [default_convert(d) for d in data]
    if isinstance(data, collections.abc.Sequence) and not isinstance(data, (str, bytes)):
        return [default_convert(d) for d in data]
    return data


def default_collate(batch):
    """Combine a list of samples into a batch: tensors are stacked on a new dim 0, numbers become tensors,
    dicts, tuples and lists are collated field by field, strings are kept as a list."""
    elem = batch[0]
    if isinstance(elem, Tensor):
        return _core.stack(batch, 0)
    if isinstance(elem, np.ndarray) or isinstance(elem, np.generic):
        if isinstance(elem, np.ndarray) and _np_str_obj_array_pattern.search(elem.dtype.str) is not None:
            raise TypeError(_ERR.format(elem.dtype))
        if isinstance(elem, np.ndarray):
            return default_collate([_core.as_tensor(b) for b in batch])
        return _core.as_tensor(np.array(batch))
    if isinstance(elem, bool):
        return _core.tensor(batch)
    if isinstance(elem, float):
        return _core.tensor(batch, dtype=_core.float64)
    if isinstance(elem, int):
        return _core.tensor(batch)
    if isinstance(elem, (str, bytes)):
        return batch
    if isinstance(elem, collections.abc.Mapping):
        return {key: default_collate([d[key] for d in batch]) for key in elem}
    if isinstance(elem, tuple) and hasattr(elem, "_fields"):
        return type(elem)(*(default_collate(samples) for samples in zip(*batch)))
    if isinstance(elem, collections.abc.Sequence):
        it = iter(batch)
        elem_size = len(next(it))
        if not all(len(e) == elem_size for e in it):
            raise RuntimeError("each element in list of batch should be of equal size")
        transposed = list(zip(*batch))
        return [default_collate(samples) for samples in transposed]
    raise TypeError(_ERR.format(type(elem)))


# ---------------------------------------------------------------- workers (simulated in-process)

class WorkerInfo:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

    def __repr__(self):
        items = [f"{k}={getattr(self, k)!r}" for k in ("id", "num_workers", "seed", "dataset")]
        return f"WorkerInfo({', '.join(items)})"


_worker_info = None


def get_worker_info():
    """Inside a DataLoader worker: its id, num_workers, seed and dataset copy. In the main process: None."""
    return _worker_info


def _generate_state(base_seed, worker_id):
    """NumPy's per-worker seed, as torch/utils/data/_utils/worker.py computes it."""
    INIT_A, MULT_A, INIT_B, MULT_B = 0x43B0D7E5, 0x931E8875, 0x8B51F9DD, 0x58F38DED
    MIX_MULT_L, MIX_MULT_R, XSHIFT = 0xCA01F9DD, 0x4973F715, 4 * 8 // 2
    MASK32 = 0xFFFFFFFF
    entropy = [worker_id, base_seed & MASK32, base_seed >> 32, 0]
    pool = [0] * 4
    hash_const_A = INIT_A

    def hash(value):
        nonlocal hash_const_A
        value = (value ^ hash_const_A) & MASK32
        hash_const_A = (hash_const_A * MULT_A) & MASK32
        value = (value * hash_const_A) & MASK32
        value = (value ^ (value >> XSHIFT)) & MASK32
        return value

    def mix(x, y):
        result_x = (MIX_MULT_L * x) & MASK32
        result_y = (MIX_MULT_R * y) & MASK32
        result = (result_x - result_y) & MASK32
        result = (result ^ (result >> XSHIFT)) & MASK32
        return result

    for i in range(len(pool)):
        pool[i] = hash(entropy[i])
    for i_src in range(len(pool)):
        for i_dst in range(len(pool)):
            if i_src != i_dst:
                pool[i_dst] = mix(pool[i_dst], hash(pool[i_src]))
    hash_const_B = INIT_B
    state = []
    for i_dst in range(4):
        data_val = pool[i_dst]
        data_val = (data_val ^ hash_const_B) & MASK32
        hash_const_B = (hash_const_B * MULT_B) & MASK32
        data_val = (data_val * hash_const_B) & MASK32
        data_val = (data_val ^ (data_val >> XSHIFT)) & MASK32
        state.append(data_val)
    return state


class _Worker:
    """One simulated worker: a copy of the dataset and its own random state for torch, random and NumPy."""

    def __init__(self, loader, worker_id, base_seed):
        self.id = worker_id
        self.seed = base_seed + worker_id
        self.dataset = copy.deepcopy(loader.dataset)
        self.info = WorkerInfo(id=worker_id, num_workers=loader.num_workers, seed=self.seed, dataset=self.dataset)
        main = self._save()
        global _worker_info
        prev_info, _worker_info = _worker_info, self.info
        try:
            _pyrandom.seed(self.seed)
            _core.default_generator.manual_seed(self.seed)
            np.random.seed(_generate_state(base_seed, worker_id))
            if loader.worker_init_fn is not None:
                loader.worker_init_fn(worker_id)
            self.state = self._save()
        finally:
            _worker_info = prev_info
            self._restore(main)
        self.iterator = self.run(lambda: iter(self.dataset)) if loader._dataset_kind == "iterable" else None
        self.done = False

    @staticmethod
    def _save():
        return (_core.default_generator.get_state(), _pyrandom.getstate(), np.random.get_state())

    @staticmethod
    def _restore(st):
        _core.default_generator.set_state(st[0])
        _pyrandom.setstate(st[1])
        np.random.set_state(st[2])

    def run(self, fn):
        global _worker_info
        main = self._save()
        prev_info, _worker_info = _worker_info, self.info
        self._restore(self.state)
        try:
            return fn()
        finally:
            self.state = self._save()
            _worker_info = prev_info
            self._restore(main)


# ---------------------------------------------------------------- DataLoader

class DataLoader:
    """Iterates over a dataset in batches: picks indexes with a sampler, fetches the samples and collates them."""

    def __init__(self, dataset, batch_size=1, shuffle=None, sampler=None, batch_sampler=None, num_workers=0,
                 collate_fn=None, pin_memory=False, drop_last=False, timeout=0, worker_init_fn=None,
                 multiprocessing_context=None, generator=None, *, prefetch_factor=None, persistent_workers=False,
                 pin_memory_device="", in_order=True):
        if num_workers < 0:
            raise ValueError("num_workers option should be non-negative; use num_workers=0 to disable multiprocessing.")
        if timeout < 0:
            raise ValueError("timeout option should be non-negative")
        if num_workers == 0 and prefetch_factor is not None:
            raise ValueError("prefetch_factor option could only be specified in multiprocessing.let num_workers > 0 to enable multiprocessing, otherwise set prefetch_factor to None.")
        elif num_workers > 0 and prefetch_factor is None:
            prefetch_factor = 2
        elif prefetch_factor is not None and prefetch_factor < 0:
            raise ValueError("prefetch_factor option should be non-negative")
        if persistent_workers and num_workers == 0:
            raise ValueError("persistent_workers option needs num_workers > 0")
        self.dataset = dataset
        self.num_workers = num_workers
        self.prefetch_factor = prefetch_factor
        self.pin_memory = pin_memory
        self.pin_memory_device = pin_memory_device
        self.timeout = timeout
        self.worker_init_fn = worker_init_fn
        self.multiprocessing_context = multiprocessing_context
        self.in_order = in_order
        if isinstance(dataset, IterableDataset):
            self._dataset_kind = "iterable"
            if shuffle not in {False, None}:
                raise ValueError(f"DataLoader with IterableDataset: expected unspecified shuffle option, but got shuffle={shuffle}")
            if sampler is not None:
                raise ValueError(f"DataLoader with IterableDataset: expected unspecified sampler option, but got sampler={sampler}")
            if batch_sampler is not None:
                raise ValueError(f"DataLoader with IterableDataset: expected unspecified batch_sampler option, but got batch_sampler={batch_sampler}")
        else:
            shuffle = bool(shuffle)
            self._dataset_kind = "map"
        if sampler is not None and shuffle:
            raise ValueError("sampler option is mutually exclusive with shuffle")
        if batch_sampler is not None:
            if batch_size != 1 or shuffle or sampler is not None or drop_last:
                raise ValueError("batch_sampler option is mutually exclusive with batch_size, shuffle, sampler, and drop_last")
            batch_size = None
            drop_last = False
        elif batch_size is None:
            if drop_last:
                raise ValueError("batch_size=None option disables auto-batching and is mutually exclusive with drop_last")
        if sampler is None:
            if self._dataset_kind == "iterable":
                sampler = _InfiniteConstantSampler()
            elif shuffle:
                sampler = RandomSampler(dataset, generator=generator)
            else:
                sampler = SequentialSampler(dataset)
        if batch_size is not None and batch_sampler is None:
            batch_sampler = BatchSampler(sampler, batch_size, drop_last)
        self.batch_size = batch_size
        self.drop_last = drop_last
        self.sampler = sampler
        self.batch_sampler = batch_sampler
        self.generator = generator
        if collate_fn is None:
            collate_fn = default_collate if self._auto_collation else default_convert
        self.collate_fn = collate_fn
        self.persistent_workers = persistent_workers
        self._persistent_iter = None

    @property
    def _auto_collation(self):
        return self.batch_sampler is not None

    @property
    def _index_sampler(self):
        return self.batch_sampler if self._auto_collation else self.sampler

    def __iter__(self):
        if self.persistent_workers and self.num_workers > 0:
            if self._persistent_iter is None:
                self._persistent_iter = _DataLoaderIter(self)
            else:
                self._persistent_iter._reset(self)
            return self._persistent_iter
        return _DataLoaderIter(self)

    def __len__(self):
        if self._dataset_kind == "iterable":
            length = len(self.dataset)
            if self.batch_size is not None:
                length = length // self.batch_size if self.drop_last else math.ceil(length / self.batch_size)
            return length
        return len(self._index_sampler)

    def __repr__(self):
        return f"<torch.utils.data.dataloader.DataLoader object at 0x{id(self) & 0xFFFFFFFFFFFF:012x}>"


DataLoader.__module__ = "torch.utils.data.dataloader"


def _pin(data):
    if isinstance(data, Tensor):
        return data.pin_memory()
    if isinstance(data, collections.abc.Mapping):
        return {k: _pin(v) for k, v in data.items()}
    if isinstance(data, tuple) and hasattr(data, "_fields"):
        return type(data)(*(_pin(d) for d in data))
    if isinstance(data, (list, tuple)):
        return type(data)(_pin(d) for d in data)
    return data


class _DataLoaderIter:
    def __init__(self, loader):
        self._loader = loader
        if loader.pin_memory and loader.pin_memory_device:
            warnings.warn(f"pin_memory_device is deprecated, the current accelerator will be used as the device,ignore pin_memory_device='{loader.pin_memory_device}'.", stacklevel=3)
        if loader.pin_memory and not _core._GPU["available"]:
            warnings.warn("'pin_memory' argument is set as true but no accelerator is found, then device pinned memory won't be used.", stacklevel=3)
        self._pin_memory = loader.pin_memory and _core._GPU["available"]
        self._workers = None
        self._reset(loader, first=True)

    def _reset(self, loader, first=False):
        self._sampler_iter = iter(loader._index_sampler)
        if first or loader.num_workers == 0:
            self._base_seed = _random_seed_from(loader.generator)
        if loader.num_workers > 0:
            if self._workers is None:
                self._workers = [_Worker(loader, i, self._base_seed) for i in range(loader.num_workers)]
            for w in self._workers:
                if loader._dataset_kind == "iterable" and not first:
                    w.iterator, w.done = w.run(lambda w=w: iter(w.dataset)), False
            self._next_worker = 0
        self._num_yielded = 0

    def __iter__(self):
        return self

    def _fetch(self, dataset, index, iterator=None):
        loader = self._loader
        if loader._dataset_kind == "iterable":
            if loader._auto_collation:
                data = []
                for _ in index:
                    try:
                        data.append(next(iterator))
                    except StopIteration:
                        break
                if len(data) == 0 or (loader.drop_last and len(data) < len(index)):
                    raise StopIteration
            else:
                data = next(iterator)
        elif loader._auto_collation:
            if callable(getattr(dataset, "__getitems__", None)):
                data = dataset.__getitems__(index)
            else:
                data = [dataset[idx] for idx in index]
        else:
            data = dataset[index]
        return loader.collate_fn(data)

    def __next__(self):
        loader = self._loader
        if loader.num_workers == 0:
            index = next(self._sampler_iter)
            it = getattr(self, "_iterable", None)
            if loader._dataset_kind == "iterable" and it is None:
                it = self._iterable = iter(loader.dataset)
            data = self._fetch(loader.dataset, index, it)
        else:
            data = self._next_from_workers()
        self._num_yielded += 1
        return _pin(data) if self._pin_memory else data

    def _next_from_workers(self):
        loader = self._loader
        while True:
            active = [w for w in self._workers if not w.done]
            if not active:
                raise StopIteration
            index = next(self._sampler_iter)
            w = None
            for k in range(len(self._workers)):
                cand = self._workers[(self._next_worker + k) % len(self._workers)]
                if not cand.done:
                    w = cand
                    self._next_worker = (self._next_worker + k + 1) % len(self._workers)
                    break
            try:
                return w.run(lambda: self._fetch(w.dataset, index, w.iterator))
            except StopIteration:
                w.done = True
                continue

    def __len__(self):
        return len(self._loader)


from . import dataloader, dataset, sampler  # noqa: E402,F401
from . import distributed  # noqa: E402,F401
from .distributed import DistributedSampler  # noqa: E402,F401
