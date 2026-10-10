# Setups

Named scripts that prepare the sandbox before an example or exercise (`setup=name`). Each runs in a fresh sandbox, silently; the learner's commands then continue from where it ends (usually inside `~/shop`). On your own computer, run the same commands first.

## shop-history

A repository with five commits.

```sh
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
git add README.md && git commit -qm "Add README"
printf "bell 800\npump 3200\n" > prices.txt
git add prices.txt && git commit -qm "Add price list"
echo "lock 2900" >> prices.txt
git commit -qam "Add the bike lock"
sed -i "s/pump 3200/pump 3000/" prices.txt
git commit -qam "Lower the pump price"
echo "Open 9 to 5, Monday to Saturday." > hours.txt
git add hours.txt && git commit -qm "Add opening hours"
```

## shop-work-in-progress

The same repository with uncommitted work: a changed file, a staged file and a new file.

```sh
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt
echo "Open 9 to 5, Monday to Saturday." > hours.txt
git add . && git commit -qm "Start the shop"
echo "Open 9 to 6, Monday to Saturday." > hours.txt
git add hours.txt
echo "tube 600" >> prices.txt
echo "Ideas: sell gloves?" > ideas.txt
```

## shop-branches

A repository with a `main` branch and a branch `add-tubes` that has one extra commit (you're on `main`).

```sh
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt
git add . && git commit -qm "Start the shop"
git switch -qc add-tubes
echo "tube 600" >> prices.txt && git commit -qam "Add inner tubes"
git switch -q main
```

## shop-diverged-branches

`main` and `add-tubes` have both moved on since they split: `main` has new opening hours, `add-tubes` has new prices. They change different files.

```sh
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt
git add . && git commit -qm "Start the shop"
git switch -qc add-tubes
echo "tube 600" >> prices.txt && git commit -qam "Add inner tubes"
git switch -q main
echo "Open 9 to 5, Monday to Saturday." > hours.txt
git add hours.txt && git commit -qm "Add opening hours"
```

## shop-conflict

`main` and `cheaper-bell` both changed the bell's price, differently.

```sh
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt
git add . && git commit -qm "Start the shop"
git switch -qc cheaper-bell
sed -i "s/bell 800/bell 700/" prices.txt && git commit -qam "Lower the bell price"
git switch -q main
sed -i "s/bell 800/bell 850/" prices.txt && git commit -qam "Raise the bell price"
```

## shop-on-github

A repository with three commits, published to GitHub as `ada/shop` with `gh repo create` (you're logged in to the pretend GitHub as `ada`). On your own computer, `gh repo create` uses your own account.

```sh
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md && git add . && git commit -qm "Add README"
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt && git add . && git commit -qm "Add price list"
echo "Open 9 to 5, Monday to Saturday." > hours.txt && git add . && git commit -qm "Add opening hours"
gh repo create shop --public --source=. --push
```

## shop-teammate-pushed

`ada/shop` on GitHub, plus a commit your teammate Grace pushed after you last synced: she raised the bell price. Your copy in `~/shop` doesn't know yet. (Grace's copy lives in `/tmp/grace/shop`; on your own computer, a second clone in another folder plays the teammate.)

```sh
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md && git add . && git commit -qm "Add README"
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt && git add . && git commit -qm "Add price list"
echo "Open 9 to 5, Monday to Saturday." > hours.txt && git add . && git commit -qm "Add opening hours"
gh repo create shop --public --source=. --push
gh repo clone shop /tmp/grace/shop && cd /tmp/grace/shop
git config user.name "Grace Hopper" && git config user.email grace@example.com
sed -i "s/bell 800/bell 850/" prices.txt && git commit -qam "Raise the bell price"
git push
cd ~/shop
```

## shop-diverged

Like `shop-teammate-pushed`, and you've also made a commit of your own (the lock is cheaper) that isn't pushed yet: your `main` and GitHub's have diverged.

```sh
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md && git add . && git commit -qm "Add README"
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt && git add . && git commit -qm "Add price list"
echo "Open 9 to 5, Monday to Saturday." > hours.txt && git add . && git commit -qm "Add opening hours"
gh repo create shop --public --source=. --push
gh repo clone shop /tmp/grace/shop && cd /tmp/grace/shop
git config user.name "Grace Hopper" && git config user.email grace@example.com
sed -i "s/bell 800/bell 850/" prices.txt && git commit -qam "Raise the bell price"
git push
cd ~/shop
sed -i "s/lock 2900/lock 2700/" prices.txt && git commit -qam "Lower the lock price"
```

## shop-feature-behind

`ada/shop` on GitHub. You pushed a branch `add-tubes`; meanwhile Grace changed `main` on GitHub, touching the same line as your branch (the end of the price list).

```sh
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md && git add . && git commit -qm "Add README"
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt && git add . && git commit -qm "Add price list"
gh repo create shop --public --source=. --push
git switch -c add-tubes
echo "tube 600" >> prices.txt && git commit -qam "Add inner tubes"
git push -u origin add-tubes
gh repo clone shop /tmp/grace/shop && cd /tmp/grace/shop
git config user.name "Grace Hopper" && git config user.email grace@example.com
echo "helmet 4500" >> prices.txt && git commit -qam "Add helmets"
git push
cd ~/shop
```

## shop-pr-open

`ada/shop` on GitHub with an open pull request #1 from the branch `add-tubes`, written by you (`ada`), waiting for a review from `grace`. You're on `add-tubes`.

```sh
mkdir -p ~/shop && cd ~/shop && git init -q
echo "# Bike shop" > README.md && git add . && git commit -qm "Add README"
printf "bell 800\npump 3000\nlock 2900\n" > prices.txt && git add . && git commit -qm "Add price list"
gh repo create shop --public --source=. --push
git switch -c add-tubes
echo "tube 600" >> prices.txt && git commit -qam "Add inner tubes"
git push -u origin add-tubes
gh pr create --title "Add inner tubes to the price list" --body "Customers keep asking for spare tubes." --reviewer grace
```
