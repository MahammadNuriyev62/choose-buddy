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

```
DUCK              GOOSE             BLOB              CAT
    __                 (·>            .----.           /\_/\
  <(· )___             ||            ( ·  · )        ( ·   ·)
   (  ._>            _(__)_          (      )        (  ω  )
    `--´              ^^^^            `----´         (")_(")

DRAGON            OCTOPUS           OWL               PENGUIN
  /^\  /^\          .----.           /\  /\          .---.
 <  ·  ·  >        ( ·  · )        ((·)(·))        (·>·)
 (   ~~   )        (______)        (  ><  )        /(   )\
  `-vvvv-´         /\/\/\/\         `----´          `---´

TURTLE            SNAIL             GHOST             AXOLOTL
   _,--._        ·    .--.          .----.        }~(______)~{
  ( ·  · )        \  ( @ )        / ·  · \       }~(· .. ·)~{
 /[______]\        \_`--´         |      |         ( .--. )
  ``    ``        ~~~~~~~         ~`~``~`~         (_/  \_)

CAPYBARA          CACTUS            ROBOT             RABBIT
  n______n       n  ____  n        .[||].           (\__/)
 ( ·    · )      | |·  ·| |      [ ·  · ]        ( ·  · )
 (   oo   )      |_|    |_|      [ ==== ]        =(  ..  )=
  `------´         |    |         `------´        (")__(" )

MUSHROOM          CHONK
 .-o-OO-o-.       /\    /\
(__________)     ( ·    · )
   |·  ·|        (   ..   )
   |____|         `------´
```

### Eyes

Each companion gets a random eye style: `·` `✦` `×` `◉` `@` `°`

### Hats

Non-common companions can wear hats:

```
crown     tophat    propeller   halo      wizard    beanie    tinyduck
\^^^/     [___]       -+-      (   )      /^\       (___)       ,>
```

### Rarities

common, uncommon, rare, epic, legendary

## After running

1. Restart Claude Code
2. Run `/buddy` to hatch your new companion

## How it works

Brute-forces a salt that makes the companion RNG land on your chosen species (and the best rarity it can find). Patches the Claude Code binary in place, keeping a `.original` backup. Installs a SessionStart hook so your choice persists across Claude Code updates automatically.

Use `--restore` to undo everything.
