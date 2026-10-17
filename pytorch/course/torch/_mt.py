"""PyTorch's CPU random number generator: a Mersenne Twister (mt19937) seeded like torch.manual_seed, with the same
conversions to floats, normals and integers that ATen's CPU kernels use, so seeded results match real PyTorch."""
import math

import numpy as np

_N, _M = 624, 397
_MATRIX_A, _UPPER, _LOWER = 0x9908B0DF, 0x80000000, 0x7FFFFFFF


class MT19937:
    def __init__(self, seed=67280421310721):
        self.seed(seed)

    def seed(self, seed):
        seed = int(seed) & 0xFFFFFFFFFFFFFFFF
        self.initial_seed = seed
        s = seed & 0xFFFFFFFF                      # at::mt19937 keeps the low 32 bits
        st = [0] * _N
        st[0] = s
        for i in range(1, _N):
            st[i] = (1812433253 * (st[i - 1] ^ (st[i - 1] >> 30)) + i) & 0xFFFFFFFF
        self.state = np.array(st, dtype=np.uint32)
        self.index = _N
        self.next_double_normal = None
        self.next_float_normal = None

    def _twist(self):
        mt = self.state.astype(np.uint64)
        for i in range(_N):
            y = (int(mt[i]) & _UPPER) | (int(mt[(i + 1) % _N]) & _LOWER)
            v = int(mt[(i + _M) % _N]) ^ (y >> 1)
            if y & 1:
                v ^= _MATRIX_A
            mt[i] = v
        self.state = mt.astype(np.uint32)
        self.index = 0

    def _twist_fast(self):
        mt = self.state.astype(np.uint64)
        upper, lower, a = np.uint64(_UPPER), np.uint64(_LOWER), np.uint64(_MATRIX_A)
        # the standard twist in vectorized blocks of at most N-M, so each block only reads values updated in earlier blocks
        for start, stop in ((0, _N - _M), (_N - _M, 2 * (_N - _M)), (2 * (_N - _M), _N - 1)):
            i = np.arange(start, stop)
            y = (mt[i] & upper) | (mt[i + 1] & lower)
            src = mt[(i + _M) % _N]
            mt[i] = src ^ (y >> np.uint64(1)) ^ np.where(y & np.uint64(1), a, np.uint64(0))
        y = (mt[_N - 1] & upper) | (mt[0] & lower)
        mt[_N - 1] = mt[_M - 1] ^ (y >> np.uint64(1)) ^ (a if int(y) & 1 else np.uint64(0))
        self.state = mt.astype(np.uint32)
        self.index = 0

    def next_u32(self, count=1):
        """count raw 32-bit outputs, as a numpy uint64 array."""
        out = np.empty(count, dtype=np.uint64)
        filled = 0
        while filled < count:
            if self.index >= _N:
                self._twist_fast()
            take = min(count - filled, _N - self.index)
            y = self.state[self.index:self.index + take].astype(np.uint64)
            y ^= (y >> np.uint64(11))
            y ^= (y << np.uint64(7)) & np.uint64(0x9D2C5680)
            y ^= (y << np.uint64(15)) & np.uint64(0xEFC60000)
            y ^= (y >> np.uint64(18))
            out[filled:filled + take] = y & np.uint64(0xFFFFFFFF)
            filled += take
            self.index += take
        return out

    def next_u64(self, count=1):
        raw = self.next_u32(2 * count).reshape(count, 2)
        return (raw[:, 0] << np.uint64(32)) | raw[:, 1]

    # --- ATen's transformations
    def uniform(self, count, low=0.0, high=1.0, double=False):
        if double:
            v = (self.next_u64(count) & np.uint64((1 << 53) - 1)).astype(np.float64) * (1.0 / (1 << 53))
            return v * (high - low) + low
        v = (self.next_u32(count) & np.uint64((1 << 24) - 1)).astype(np.float32) * np.float32(1.0 / (1 << 24))
        return (v * np.float32(high - low) + np.float32(low)).astype(np.float32)

    def normal_double(self, mean=0.0, std=1.0):
        """at::normal_distribution<double>: Box-Muller, caching the second value."""
        if self.next_double_normal is not None:
            r = self.next_double_normal
            self.next_double_normal = None
            return r * std + mean
        u1 = float(self.uniform(1, double=True)[0])
        u2 = float(self.uniform(1, double=True)[0])
        r = math.sqrt(-2.0 * math.log1p(-u2))
        theta = 2.0 * math.pi * u1
        self.next_double_normal = r * math.sin(theta)
        return r * math.cos(theta) * std + mean

    def normal(self, count, mean=0.0, std=1.0, float32=True):
        """at::native normal_ on CPU: sizes of 16 or more use normal_fill (Box-Muller over blocks of 16), smaller ones
        draw one double normal at a time."""
        if count < 16:
            vals = np.array([self.normal_double(mean, std) for _ in range(count)], dtype=np.float64)
            return vals.astype(np.float32) if float32 else vals
        data = self.uniform(count, double=not float32).astype(np.float64 if not float32 else np.float32)
        dt = data.dtype

        def fill16(block):
            u1 = (1 - block[:8]).astype(dt)
            u2 = block[8:16]
            radius = np.sqrt(-2 * np.log(u1))
            theta = (2.0 * math.pi) * u2
            block[:8] = radius * np.cos(theta) * std + mean
            block[8:16] = radius * np.sin(theta) * std + mean

        for i in range(0, count - 15, 16):
            fill16(data[i:i + 16])
        if count % 16 != 0:
            tail = data[count - 16:]
            tail[:] = self.uniform(16, double=not float32).astype(dt)
            fill16(tail)
        return data

    def randint(self, count, low, high):
        rng = int(high) - int(low)
        if rng <= 0:
            raise RuntimeError(f"random_ expects 'from' to be less than 'to', but got from={low} >= to={high}")
        if rng >= 1 << 32:
            raw = self.next_u64(count)
        else:
            raw = self.next_u32(count)
        return (raw % np.uint64(rng)).astype(np.int64) + int(low)

    def randperm(self, n):
        r = list(range(n))
        if n < 2:
            return np.array(r, dtype=np.int64)
        for i in range(n - 1):
            z = int(self.next_u32(1)[0]) % (n - i)
            r[i], r[z + i] = r[z + i], r[i]
        return np.array(r, dtype=np.int64)

    def random_int64(self):
        """Tensor.random_() on an int64 tensor: random64() % (2**63 + 1)."""
        return int(self.next_u64(1)[0]) % ((1 << 63) + 1)

    def get_state(self):
        return (self.state.copy(), self.index, self.next_double_normal, self.initial_seed)

    def set_state(self, st):
        self.state, self.index, self.next_double_normal, self.initial_seed = st[0].copy(), st[1], st[2], st[3]
