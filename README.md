# choose-buddy

Got a bullshit common pet while others got rare ones? Forget luck. Pick your own.

Works with Node.js 16+ or Bun. No dependencies.

## Usage

```bash
node choose-buddy.mjs <species>                     # Pick a species (finds best rarity)
node choose-buddy.mjs <species> --rarity <rarity>   # Pick species + exact rarity
node choose-buddy.mjs --list                         # List all species
node choose-buddy.mjs --info                         # Show your current companion
node choose-buddy.mjs --restore                      # Undo everything
```

## Quick install

```bash
curl -sL https://raw.githubusercontent.com/MahammadNuriyev62/choose-buddy/main/choose-buddy.mjs -o choose-buddy.mjs
node choose-buddy.mjs dragon
```

## Species

duck, goose, blob, cat, dragon, octopus, owl, penguin, turtle, snail, ghost, axolotl, capybara, cactus, robot, rabbit, mushroom, chonk

## Rarities

common, uncommon, rare, epic, legendary

## How it works

Brute-forces a salt that makes the companion RNG land on your chosen species (and the best rarity it can find). Patches the Claude Code binary in place, keeping a `.original` backup. Installs a SessionStart hook so your choice persists across Claude Code updates automatically.

Use `--restore` to undo everything.
