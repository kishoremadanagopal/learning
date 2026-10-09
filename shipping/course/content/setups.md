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
