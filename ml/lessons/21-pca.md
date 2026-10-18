# Lesson 21: Dimensionality reduction with PCA

**You'll learn:** dimensionality reduction, principal components, explained variance ratio, scaling before PCA, 2-D pictures of many features, reading components_, choosing the number of components, t-SNE and UMAP.

▶ **Practise this lesson in the [sandbox](https://kishoremadanagopal.github.io/learning/ml/#pca)**: run every example and check your exercise answers.

## Key terms

- **Dimensionality reduction:** replacing many columns with a few new ones that keep most of the information.
- **Dimension:** a column (feature) of the data; 3 features means 3-dimensional data.
- **PCA (principal component analysis):** finds new axes (principal components) along which the data varies most.
- **Principal component:** a new column made as a weighted mix of the original features; PC1 holds the most variation.
- **Explained variance ratio:** the share of the total variation each component captures.
- **components_:** the weights each component gives to the original features.
- **n_components:** how many components to keep, or (between 0 and 1) what share of variation to keep.
- **t-SNE / UMAP:** non-linear methods for drawing complex data in 2-D; good for pictures, with axes that have no meaning.

You can plot two features on a chart. With 4, 50 or 1,000 features, you can't. **Dimensionality reduction** builds a few **new** columns that summarise many old ones. The classic method is **principal component analysis (PCA)**.

## The idea

When features are correlated, they partly repeat each other. Fruit width and weight go together; maths and science scores go together. PCA finds new axes, called **principal components**, along which the data varies most:

- **PC1** is the direction of the **most** variation in the data.
- **PC2** is the direction of the most remaining variation, at right angles to PC1.
- And so on: there are as many components as features, each capturing less than the one before.

Keeping just the first few components keeps most of the information in far fewer columns.

![Left: a cloud of points that stretches along a diagonal, with two arrows: a long arrow (PC1) along the stretch and a short arrow (PC2) across it. Right: the same points redrawn using PC1 as the x-axis and PC2 as the y-axis; almost all the spread is along PC1](../figures/pca-idea.svg)

## Fruit: from 3 columns to 2

```python
import pandas as pd
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA

fruit = pd.read_csv("fruit.csv")
X = fruit[["width_cm", "height_cm", "weight_g"]]

pca = make_pipeline(StandardScaler(), PCA())
pca.fit(X)
ratios = pca[-1].explained_variance_ratio_
print("share of variation per component:", ratios.round(3))
print("first two together:", ratios[:2].sum().round(3))
```

**Explained variance ratio** is the share of the total variation each component captures. The first two components keep about 98% of the fruits' variation, so a 2-D picture loses almost nothing:

```python
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA

fruit = pd.read_csv("fruit.csv")
X = fruit[["width_cm", "height_cm", "weight_g"]]
coords = make_pipeline(StandardScaler(), PCA(n_components=2)).fit_transform(X)

for kind, colour in [("apple", "tab:red"), ("orange", "tab:orange"), ("lemon", "gold")]:
    rows = (fruit["fruit"] == kind).to_numpy()
    plt.scatter(coords[rows, 0], coords[rows, 1], label=kind, color=colour, edgecolor="black", linewidth=0.3)
plt.xlabel("PC1")
plt.ylabel("PC2")
plt.legend()
plt.title("Three measurements, drawn in two dimensions")
plt.show()
```

PCA never saw the fruit names (it's unsupervised), yet lemons separate clearly, while apples and oranges overlap: the same difficulty every classifier in this course ran into.

Scale first: PCA looks for the directions of biggest variation, so unscaled, weight in grams (spread about 36) would swamp the centimetres (spread about 1) and become PC1 by itself.

## What do the components mean?

Each component is a weighted mix of the original features. The weights are in `components_`:

```python
import pandas as pd
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA

students = pd.read_csv("students.csv")
cols = ["hours_studied", "attendance_pct", "math", "science", "english"]
pca = make_pipeline(StandardScaler(), PCA(n_components=2)).fit(students[cols])

print(pd.DataFrame(pca[-1].components_, columns=cols, index=["PC1", "PC2"]).round(2))
print(pca[-1].explained_variance_ratio_.round(3))
```

PC1 has positive weights on everything, biggest on study hours, maths and science: it's an "overall effort and results" score, and it holds about 53% of the variation. Interpreting components is part science, part art; don't over-read small weights.

## Choosing how many components

Ask PCA to keep enough components for a share of the variation, by passing a number between 0 and 1:

```python
import pandas as pd
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA

housing = pd.read_csv("housing.csv")
cols = ["area_sqm", "bedrooms", "age_years", "distance_km", "price_k"]
pca = make_pipeline(StandardScaler(), PCA(n_components=0.9)).fit(housing[cols])
print("components kept:", pca[-1].n_components_)
print(pca[-1].explained_variance_ratio_.round(3), "total", pca[-1].explained_variance_ratio_.sum().round(3))
```

Three components hold over 90% of the variation in five housing columns.

## What PCA is used for

- **Seeing** high-dimensional data in 2-D (like the fruit chart), to spot groups and odd points.
- **Simplifying** before another model, especially when there are many correlated features (it can reduce overfitting and speed up training).
- **Compressing** data, like images, by keeping only the strongest components.

Trade-off: components are mixtures, so a model built on them is harder to explain than one built on the original features. For pictures of very complex data (like word or image embeddings), non-linear methods such as **t-SNE** and **UMAP** often show groups more clearly, but their axes have no meaning at all.

## Common mistakes

- Running PCA on unscaled features, so the biggest-unit feature becomes PC1 by itself.
- Thinking PCA picks the features most useful for predicting a label. It ignores labels entirely.
- Fitting PCA on all the data before a train/test split. Like any learned step, put it in a pipeline.
- Over-interpreting small component weights.

## Exercises

### 1. Keep 95%

Fit `make_pipeline(StandardScaler(), PCA(n_components=0.95))` on the four numeric shopper columns below. Store the pipeline in `pca`, the number of components it kept in `n_kept`, and the transformed data in `reduced`.

Starter code:

```python
import pandas as pd
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA

shoppers = pd.read_csv("shoppers.csv")
X = shoppers[["annual_income_k", "spending_score", "age", "visits_per_month"]]

```

### 2. How much does PC1 hold?

Fit a scaled PCA (all components) on `area_sqm`, `bedrooms`, `age_years`, `distance_km` and `price_k` from `housing.csv`. Store the share of variation captured by the **first** component in `pc1_share`, and the name of the feature with the **largest absolute weight** in PC1 in `top_feature`.

Starter code:

```python
import pandas as pd
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA

housing = pd.read_csv("housing.csv")
cols = ["area_sqm", "bedrooms", "age_years", "distance_km", "price_k"]

```

**In the sandbox:** exercises 41–42. Press **Check** to test your answer.

<details>
<summary>Hints</summary>

1. `pca.fit_transform(X)` returns the reduced data; `pca[-1].n_components_` is the number kept.
2. `components_[0]` holds PC1's weights in the order of `cols`; put them in a Series and use `.abs().idxmax()`.

</details>

<details>
<summary>Answers</summary>

**1. Keep 95%**

```python
import pandas as pd
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA

shoppers = pd.read_csv("shoppers.csv")
X = shoppers[["annual_income_k", "spending_score", "age", "visits_per_month"]]

pca = make_pipeline(StandardScaler(), PCA(n_components=0.95))
reduced = pca.fit_transform(X)
n_kept = pca[-1].n_components_
print(n_kept, reduced.shape)
```

**2. How much does PC1 hold?**

```python
import pandas as pd
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA

housing = pd.read_csv("housing.csv")
cols = ["area_sqm", "bedrooms", "age_years", "distance_km", "price_k"]

pca = make_pipeline(StandardScaler(), PCA()).fit(housing[cols])
pc1_share = pca[-1].explained_variance_ratio_[0]
weights = pd.Series(pca[-1].components_[0], index=cols)
top_feature = weights.abs().idxmax()
print(round(pc1_share, 3))
print(weights.round(2))
```

</details>

## Quick quiz

1. What is the first principal component?
   - A) The first column of the data
   - B) The direction in which the data varies the most
   - C) The most important feature for predicting the label

2. PCA's explained_variance_ratio_ is [0.73, 0.25, 0.02]. Keeping two components keeps:
   - A) About 98% of the variation
   - B) About 73%
   - C) Two thirds of the rows

3. Why scale before PCA?
   - A) Scaling removes outliers
   - B) PCA only works on values between 0 and 1
   - C) Otherwise the feature with the biggest units dominates the first component

4. A downside of training a model on PCA components is:
   - A) It always lowers accuracy
   - B) The components are mixtures of features, so the model is harder to explain
   - C) It leaks the test set

<details>
<summary>Quiz answers</summary>

1. **B) The direction in which the data varies the most**: PCA finds directions of biggest variation; it never looks at a label.
2. **A) About 98% of the variation**: Add the first two shares.
3. **C) Otherwise the feature with the biggest units dominates the first component**: PCA looks for large variation, and unscaled grams vary far more than centimetres.
4. **B) The components are mixtures of features, so the model is harder to explain**: You trade some interpretability for fewer columns.

</details>

---
Previous: [Lesson 20](20-kmeans.md) · Next: [Lesson 22: Classifying text](22-text-classification.md)
