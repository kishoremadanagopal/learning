# Lesson 17: Transforms and augmentation

**You'll learn:** what a transform is, torchvision.transforms.v2, tv_tensors.Image, ToImage, ToDtype with scale=True, Normalize with per-channel mean and std, Compose, the deprecated ToTensor, ImageNet normalisation statistics, computing statistics over the training set, data augmentation with RandomHorizontalFlip and RandomCrop, separate training and evaluation pipelines, transform and target_transform in a Dataset, transforms passing labels through.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/pytorch/#transforms)**: run every example and check your exercise answers.

## Key terms

- **Transform:** a function applied to each sample as it's loaded, to convert, scale or randomly change it.
- **torchvision.transforms.v2:** torchvision's current transforms API for images, boxes, masks and videos.
- **tv_tensors.Image:** a tensor subclass marking a tensor as a `[C, H, W]` image for v2 transforms.
- **ToDtype(scale=True):** converts dtype and rescales values, for example uint8 0–255 to float 0–1.
- **Normalize:** subtracts a per-channel mean and divides by a per-channel standard deviation.
- **Compose:** chains transforms into one pipeline applied in order.
- **Data augmentation:** random, label-preserving changes to training samples that act like extra data.
- **target_transform:** a transform applied to a sample's label instead of its input.

A **transform** is a function applied to each sample as it's loaded: converting it to a tensor, scaling it, or randomly changing it. For images, PyTorch's companion library **torchvision** provides them in `torchvision.transforms.v2` (the current API; the older `torchvision.transforms` still works but v2 is recommended).

The sandbox includes the core v2 transforms. Real torchvision has many more (resizing, colour jitter, rotations, `RandomResizedCrop`, `AutoAugment`), all used the same way.

## Turning an image into a model input

Images usually arrive as uint8 values 0–255 in height × width × channels order (that's how PIL and NumPy store them). Models want float32, channels first, and roughly zero-centred values. Three transforms do that:

| Transform | Does |
|---|---|
| `v2.ToImage()` | NumPy array, PIL image or tensor → `tv_tensors.Image`, channels first `[C, H, W]` (dtype unchanged) |
| `v2.ToDtype(torch.float32, scale=True)` | uint8 0–255 → float32 0–1 (`scale=True` divides by 255) |
| `v2.Normalize(mean, std)` | `(x − mean) / std` for each channel |

`v2.Compose([...])` chains them.

```python
import numpy as np
import torch
from torchvision.transforms import v2

pixels = np.array([[[255, 0, 0], [0, 255, 0]],
                   [[0, 0, 255], [128, 128, 128]]], dtype=np.uint8)   # a 2 × 2 RGB image, H × W × C
img = v2.ToImage()(pixels)
print(type(img).__name__, img.shape, img.dtype)
scaled = v2.ToDtype(torch.float32, scale=True)(img)
print(scaled[0])                                    # the red channel, 0 to 1
normalize = v2.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5])
print(normalize(scaled)[0])                         # now -1 to 1

to_model = v2.Compose([v2.ToImage(), v2.ToDtype(torch.float32, scale=True), normalize])
print(to_model)
```

`tv_tensors.Image` is a tensor subclass that tells the transforms "this is an image" (others mark bounding boxes and masks, so geometry transforms move them together). Do maths on it like any tensor; the result of most operations is a plain tensor.

Normalize needs a float image; on uint8 it raises an error, so `ToDtype` always comes first:

*This example raises an error on purpose.*

```python
import torch
from torchvision.transforms import v2

v2.Normalize([0.5], [0.5])(torch.zeros(1, 2, 2, dtype=torch.uint8))
```

The older `transforms.ToTensor()` did ToImage and ToDtype in one step. In v2 it's deprecated: use `v2.Compose([v2.ToImage(), v2.ToDtype(torch.float32, scale=True)])`.

## Normalisation statistics

`mean` and `std` are **per channel**, computed over the **training** images (after scaling to 0–1). The widely copied values `mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]` are ImageNet's: use them when fine-tuning a model pretrained on ImageNet, so your inputs match what it learned on.

```python
import torch

torch.manual_seed(0)
images = torch.randint(0, 256, (100, 3, 8, 8), dtype=torch.uint8)    # stand-in training images
x = images.float() / 255
mean = x.mean(dim=(0, 2, 3))                 # average over images, height and width: one per channel
std = x.std(dim=(0, 2, 3))
print(mean, std)
```

## Data augmentation

**Augmentation** applies small random changes to training images, so the model sees a slightly different version of each image every epoch. It acts like extra data and reduces overfitting. The changes must keep the label true: a horizontally flipped cat is still a cat, but a flipped "6" might read as something else, so choose augmentations that suit the data.

```python
import torch
from torchvision.transforms import v2

img = torch.arange(16, dtype=torch.uint8).view(1, 4, 4)     # 1 channel, 4 × 4
torch.manual_seed(0)
flip = v2.RandomHorizontalFlip(p=0.5)                         # flips with probability 0.5
for _ in range(3):
    print(flip(img)[0, 0].tolist())                           # the first row: flipped or not
crop = v2.RandomCrop(size=3, padding=1)                       # pad by 1 pixel, then cut a random 3 × 3
print(crop(img))
```

Random transforms draw from PyTorch's random generator, so `torch.manual_seed` makes them repeatable (inside DataLoader workers, each worker's own seed is used).

## Training and evaluation pipelines

Augment only the **training** data. Validation and test data must be deterministic, so scores are comparable between epochs and reflect real use. Both pipelines share the conversion and the **same** normalisation:

```python
import torch
from torchvision.transforms import v2

mean, std = [0.5], [0.25]
train_tf = v2.Compose([
    v2.ToImage(),
    v2.RandomHorizontalFlip(),
    v2.RandomCrop(28, padding=2),
    v2.ToDtype(torch.float32, scale=True),
    v2.Normalize(mean, std),
])
eval_tf = v2.Compose([
    v2.ToImage(),
    v2.ToDtype(torch.float32, scale=True),
    v2.Normalize(mean, std),
])
print(eval_tf)
```

Geometric transforms such as flips and crops go **before** `ToDtype` and `Normalize` (they're cheaper on uint8, and padding then fills with true black, 0).

## Transforms inside a Dataset

The convention, followed by every torchvision dataset, is a `transform` argument applied to the input and a `target_transform` applied to the label, both inside `__getitem__`. Because they run per sample, a random transform gives a new variation every time the sample is loaded, which is every epoch.

```python
import torch
from torch.utils.data import Dataset, DataLoader
from torchvision.transforms import v2

class TinyImages(Dataset):
    def __init__(self, images, labels, transform=None, target_transform=None):
        self.images, self.labels = images, labels
        self.transform, self.target_transform = transform, target_transform

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, i):
        image, label = self.images[i], self.labels[i]
        if self.transform:
            image = self.transform(image)
        if self.target_transform:
            label = self.target_transform(label)
        return image, label

torch.manual_seed(0)
images = torch.randint(0, 256, (6, 1, 4, 4), dtype=torch.uint8)
labels = [0, 1, 0, 1, 1, 0]
tf = v2.Compose([v2.RandomHorizontalFlip(), v2.ToDtype(torch.float32, scale=True)])
ds = TinyImages(images, labels, transform=tf, target_transform=lambda y: torch.tensor(y, dtype=torch.float32))
xb, yb = next(iter(DataLoader(ds, batch_size=3)))
print(xb.shape, xb.dtype, yb)
```

A transform given only a plain tensor treats it as the image; given a sample like `(image, label)`, v2 transforms change the image and pass the label through untouched.

## At a glance

| Concept | Code | Gives you | Remember |
|---|---|---|---|
| To a model input | `v2.Compose([v2.ToImage(), v2.ToDtype(torch.float32, scale=True), v2.Normalize(mean, std)])` | float32 `[C, H, W]`, about mean 0 | Normalize needs floats |
| Channels first | `v2.ToImage()` | `[H, W, C]` array → `[C, H, W]` Image | dtype unchanged |
| Scale | `v2.ToDtype(torch.float32, scale=True)` | uint8 0–255 → 0–1 | replaces ToTensor |
| Statistics | `x.mean(dim=(0, 2, 3))`, `x.std(dim=(0, 2, 3))` | one value per channel | training images only |
| Augment | `v2.RandomHorizontalFlip()`, `v2.RandomCrop(28, padding=4)` | a new variation each epoch | training pipeline only |
| In a Dataset | `transform`, `target_transform` in `__getitem__` | per-sample processing | labels pass through v2 transforms |

## Common mistakes

- Normalising before converting uint8 to float (Normalize raises a TypeError).
- Augmenting validation or test data.
- Using different normalisation statistics for training and evaluation.
- Computing normalisation statistics on all the data instead of the training split.
- Choosing augmentations that change the label (flipping digits or text).
- Using the deprecated `ToTensor()` in new code instead of `ToImage()` + `ToDtype(torch.float32, scale=True)`.

## Exercises

### 1. Build the two pipelines

Make `train_tf` and `eval_tf` for 1-channel 28 × 28 images arriving as uint8 NumPy arrays of shape `(28, 28)`. Both must output a float32 tensor of shape `[1, 28, 28]` normalised with `mean=[0.2860]` and `std=[0.3530]`. `train_tf` also augments: a random horizontal flip, then `RandomCrop(28, padding=4)`. Put the augmentations before the dtype conversion.

Starter code:

```python
import numpy as np
import torch
from torchvision.transforms import v2

train_tf = None
eval_tf = None

img = np.random.default_rng(0).integers(0, 256, (28, 28), dtype=np.uint8)
print(eval_tf(img).shape, eval_tf(img).dtype)
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** two Compose pipelines sharing conversion and normalisation; only one augments.
2. **Examples:** a pixel of 255 → 1.0 → (1 − 0.286) / 0.353 ≈ 2.02.
3. **Brute force:** write the conversion by hand with NumPy and division: it works, but transforms compose and document themselves.
4. **Pattern:** **convert → augment → scale → normalise**, with augmentation only in training.
5. **Plan:** list the transforms in order inside `v2.Compose`.
6. **Code and test:** eval_tf twice gives the same result; train_tf varies.

</details>

<details>
<summary>💡 Hint 1</summary>

`v2.ToImage()` turns a `(28, 28)` array into an Image of shape `[1, 28, 28]`.

</details>

<details>
<summary>💡 Hint 2</summary>

The order for training: ToImage, RandomHorizontalFlip, RandomCrop, ToDtype, Normalize.

</details>

<details>
<summary>💡 Hint 3</summary>

The evaluation pipeline is the same without the two random transforms.

</details>

### 2. Compute per-channel statistics

Write `channel_stats(images)` where `images` is a uint8 tensor of shape `[N, C, H, W]`. Return `(mean, std)`: two float32 tensors of shape `[C]` with each channel's mean and standard deviation over all images and pixels, after scaling to 0–1 (divide by 255). Use the population standard deviation (`correction=0`).

Starter code:

```python
import torch

def channel_stats(images):
    pass

torch.manual_seed(0)
imgs = torch.randint(0, 256, (10, 3, 4, 4), dtype=torch.uint8)
print(channel_stats(imgs))
```

<details>
<summary>🧭 How to approach it</summary>

1. **Understand:** per-channel statistics over images, height and width.
2. **Examples:** half the images all black and half all white → mean 0.5, population std 0.5.
3. **Brute force:** loop over channels and compute each one: fine for 3 channels.
4. **Pattern:** **reduce over a tuple of dims**, keeping the channel dim.
5. **Plan:** scale to float; mean and std over dims 0, 2, 3.
6. **Code and test:** compare against a per-channel loop.

</details>

<details>
<summary>💡 Hint 1</summary>

Convert first: `images.float() / 255`. (`mean()` doesn't work on uint8.)

</details>

<details>
<summary>💡 Hint 2</summary>

To get one value per channel, reduce over every other dimension: `dim=(0, 2, 3)`.

</details>

<details>
<summary>💡 Hint 3</summary>

`x.std(dim=(0, 2, 3), correction=0)` gives the population standard deviation.

</details>

**In the sandbox:** exercises 33–34. Press **Check** to run the hidden tests.

### Answers and walkthroughs

Open these only after a real attempt. Each one explains the solution step by step.

<details>
<summary>✅ 1. Build the two pipelines</summary>

```python
import numpy as np
import torch
from torchvision.transforms import v2

mean, std = [0.2860], [0.3530]
train_tf = v2.Compose([
    v2.ToImage(),
    v2.RandomHorizontalFlip(),
    v2.RandomCrop(28, padding=4),
    v2.ToDtype(torch.float32, scale=True),
    v2.Normalize(mean, std),
])
eval_tf = v2.Compose([
    v2.ToImage(),
    v2.ToDtype(torch.float32, scale=True),
    v2.Normalize(mean, std),
])

img = np.random.default_rng(0).integers(0, 256, (28, 28), dtype=np.uint8)
print(eval_tf(img).shape, eval_tf(img).dtype)
```

**Line by line**

- `ToImage()` converts the NumPy array to a `tv_tensors.Image`, adding the channel dimension: `[1, 28, 28]`, still uint8.
- `RandomHorizontalFlip()` flips with probability 0.5; `RandomCrop(28, padding=4)` pads to 36 × 36 with zeros and cuts a random 28 × 28 window, so the digit or garment shifts by up to 4 pixels.
- `ToDtype(torch.float32, scale=True)` divides by 255; `Normalize` subtracts 0.2860 and divides by 0.3530.

**Why the same normalisation in both?** The model learns on normalised inputs; evaluating on differently scaled inputs would shift every value it sees.

**Common wrong approach:** augmenting the evaluation pipeline too. Validation scores then change from run to run and no longer measure performance on real, unaltered inputs.

</details>

<details>
<summary>✅ 2. Compute per-channel statistics</summary>

```python
import torch

def channel_stats(images):
    x = images.float() / 255
    mean = x.mean(dim=(0, 2, 3))
    std = x.std(dim=(0, 2, 3), correction=0)
    return mean, std

torch.manual_seed(0)
imgs = torch.randint(0, 256, (10, 3, 4, 4), dtype=torch.uint8)
print(channel_stats(imgs))
```

**Line by line**

- `images.float() / 255` gives float32 values in 0–1, matching what `ToDtype(..., scale=True)` produces, so the statistics apply to the transformed images.
- `dim=(0, 2, 3)` reduces over images, rows and columns at once; the channel dimension (1) is the only one left: shape `[C]`.
- `correction=0` divides by the number of values; PyTorch's default `std()` divides by n − 1, which barely differs with millions of pixels but matters on tiny tests.

**Big datasets:** when the images don't fit in memory together, add up the per-batch sums of `x` and `x ** 2` while looping over a DataLoader, then compute `mean = Σx / n` and `std = sqrt(Σx² / n − mean²)`.

**Common wrong approach:** `x.mean()` with no dim: one number for all channels, when red, green and blue usually have different averages.

</details>

## Quick quiz

1. What does `v2.ToDtype(torch.float32, scale=True)` do to a uint8 image?
   - A) Converts it to float32 and multiplies by 255
   - B) Converts it to float32 and divides by 255, so values are in 0–1
   - C) Converts it to float32 and leaves the values 0–255
   - D) Normalises it to mean 0 and standard deviation 1

2. Which transform belongs in the training pipeline but NOT the validation pipeline?
   - A) `v2.Normalize(mean, std)`
   - B) `v2.ToDtype(torch.float32, scale=True)`
   - C) `v2.ToImage()`
   - D) `v2.RandomHorizontalFlip()`

3. You fine-tune a model pretrained on ImageNet. Which normalisation should you use?
   - A) Your dataset's mean and std, computed over train and test together
   - B) No normalisation, because the model is pretrained
   - C) `mean=[0, 0, 0], std=[1, 1, 1]`
   - D) ImageNet's mean and std, `[0.485, 0.456, 0.406]` and `[0.229, 0.224, 0.225]`

4. Where is data augmentation usually applied?
   - A) Once, before training, saving the augmented images to disk
   - B) In the optimizer
   - C) In the Dataset's `__getitem__`, through its `transform`, so each epoch sees a new random variation
   - D) In the model's `forward`

5. An image tensor has shape `[3, 32, 32]` and dtype uint8. What happens with `v2.Normalize(mean, std)` applied directly?
   - A) It normalises the 0–255 values
   - B) A TypeError: Normalize needs a float tensor
   - C) It normalises only the first channel
   - D) It converts to float automatically

<details>
<summary>Quiz answers</summary>

1. **B) Converts it to float32 and divides by 255, so values are in 0–1**: scale=True rescales the value range between integer and float dtypes.
2. **D) `v2.RandomHorizontalFlip()`**: Random augmentation is for training only; conversion and normalisation must be identical in both.
3. **D) ImageNet's mean and std, `[0.485, 0.456, 0.406]` and `[0.229, 0.224, 0.225]`**: Inputs should match the distribution the pretrained weights were trained on.
4. **C) In the Dataset's `__getitem__`, through its `transform`, so each epoch sees a new random variation**: Per-sample, per-load transforms give fresh variations every epoch.
5. **B) A TypeError: Normalize needs a float tensor**: Convert with `ToDtype(torch.float32, scale=True)` first.

</details>

---
Previous: [Lesson 16](16-samplers-and-workers.md) · Next: [Lesson 18: Data quality and leakage](18-data-quality.md)
