# Banner Factory

Personalised retargeting hero banners for Elgiganten, made on demand from the
product feed. A visitor looked at a product and left; when they come back, the
home page hero speaks to them.

My answer to the [Digital Fans challenge](docs/challenge.md). It picks the
product, writes the copy, lays out the banner and renders it at 2048 × 768 —
then measures what it made, tests alternatives against it, and rewrites its own
agents' instructions from the results.

## Run it

**You need:** Node 20+, a Gemini API key, and Google Chrome (or any Chromium).
The banner is HTML and CSS, and a headless browser turns it into the PNG; the
usual install paths are found automatically, otherwise set `CHROME_PATH`.

```bash
npm install
cp .env.example .env          # your key goes in GOOGLE_GENERATIVE_AI_API_KEY
npm run tag                   # build the product store from the feed — free, no model calls
npm run dev
```

Open <http://localhost:3000>, search for a product, pick a language, press
**Generate now**. The board shows the run as it happens.

The demo shop — a plain HTML page that shows a banner the way a real site
would — is at <http://localhost:3000/demo/index.html>.

## Sign in

Firebase comes configured: [`config/firebase.json`](config/firebase.json) is in
the repository, so this clone talks to the same project as mine. Two accounts
exist for trying the roles:

| Account | Role | Judges |
|---|---|---|
| `adm@email.com` | Admin | the product, the words, the layout |
| `da@email.com` | Art director | the layout only |

The password for both is in the message I sent with this repository.

Sign in at `/sign-in` and open `/profile`. On any finished banner the art
director gets thumbs on **The layout** and a read-only mark on the other two —
and that is not a screen trick: the token is verified on the server against
Google's public certificates, so a verdict outside your craft is refused
however the request is made.

## How a banner is made

Four stages. Two are code, two are models, and the split is the design: **what
must be true is computed, what needs judgement is asked.**

```
seed product
    ├─ 1. CHOOSE ── recommend workflow ───── which product to show
    ├─ 2. TRUTH ─── facts layer (no model) ─ what may be said at all
    ├─ 3. WRITE ─── copywriter + strategist  headline, support, button
    └─ 4. DRAW ──── art director + Chrome ── HTML screenshotted, no image model
```

**Choosing** has two modes. Seed out of stock: find the nearest thing actually
available. Seed in stock: the customer can already buy that, so offer something
else worth seeing. A free promo shortcut resolves 3.5% of seeds with no model
call, a brand-derived cluster covers 10.6% more, and only then does a model read
the customer profile and pick which sections of the shop to draw from.

**The truth layer** is the part I would keep if I threw everything else away. It
reads only feed values and decides which claims are permitted at all — including
refusing a saving when the feed contradicts itself, which 56 products here do.
A number the copywriter invents anyway is caught before the banner is drawn.

**The business policy** is the only place "what should we promote" lives:
sentences on the Rules screen, dragged into priority order, compiled into a
prompt by one agent and applied by another. There is no discount threshold in
the source, because that is the shop's decision and not mine.

## What it does

**Generation** — search 28,231 products, queue several, three languages (the
language changes the text, never the market: prices stay in DKK). Live progress
on the board. Three layouts, chosen by a hash of the SKU, so a product looks the
same every time and the set looks varied.

**Not paying twice** — before anything is spent, the factory looks for a banner
it already made for this seed or for a top candidate. A stored banner is reused
only while every fact it prints still holds; a price that moved expires it. When
reuse was possible and refused, the card says why. Cost per banner is total spend
over banners delivered, so it falls each time the factory answers without working.

**Knowing whether it worked** — three verdicts per banner (the product, the
words, the layout), because each belongs to a different agent. Dragging a card
back redoes that stage and records a rejection, marked as revealed rather than
stated. `/measure` shows click rate against the other banners with a p-value and
refuses to call anything under 500 impressions. A banner that is measurably
behind gets a UX researcher's variant — one change, one hypothesis — judged with
Wilson intervals, a two-sided pooled z-test, and a sample size fixed when the
test opens, so an earlier reading is reported as a peek and not a finding.

**Improving itself** — each agent's baseline instructions live in its source
file; promoted revisions layer on top and are read at call time. Once enough
feedback accumulates, a larger model reads the complaints *and the approvals* and
rewrites the instructions, or declines. A reviewer that never sees either prompt
compares them on real products, A/B and shuffled. A candidate that does not win
is rolled back and the window for the next attempt grows. A switch on `/prompts`
decides whether the reviewer may promote on its own or everything waits for a
person; a candidate the reviewer refuses never goes live either way.

**People** — five roles: admin, marketing, copywriter, strategist, art director.
Each judges their own craft; admin and marketing judge everything.

**Showing it** — a demo shop in plain HTML, and a tag that is two lines on any
page. It asks which banner to show, records the impression, and reports the click
with `sendBeacon` so it survives the navigation. No cookie, no identifier,
nothing about the visitor.

## The screens

| Path | For |
|---|---|
| `/` | Search the feed, queue products, generate |
| `/board` | One card per banner. Drag a card back to redo a stage |
| `/board/<id>` | One run in full: the choice and why, the timeline, the cost table, the feedback |
| `/banners` | Everything made, filtered by language, validity, origin and review |
| `/rules` | The business rules, written and dragged into order |
| `/measure` | How each banner performs, and the A/B tests |
| `/prompts` | The agents' instructions, the evidence, the candidate and its eval |
| `/profile` | Who you are, what you may judge, who else is on the team |

## The command line

```bash
npm run tag                      # build the product store from the feed (free)
npm run enrich -- --dry          # what the tagger still cannot categorise
npm run recommend -- 907583      # what the matcher would choose for a SKU
npm run compose -- 907583        # the copy and badges for a product
npm run brief -- 907583          # a brief, and a rendered PNG
npm run improve                  # what each prompt is waiting for
npm run traffic                  # what has been measured
npm run publish                  # mirror the product table to Firestore
```

`recommend`, `compose` and `brief` print their options when run with no SKU;
`enrich` and `publish` take `--help`.

## Configuration

| File | Holds |
|---|---|
| `.env` | The Gemini API key. Never committed |
| `config/firebase.json` | The Firebase web config — the public half, the one every web app ships in its bundle |
| `config/people.json` | Who starts with which role |
| `.cache/` | Everything the app produces: store, jobs, banners, rules, prompts, traffic. Never committed |
| `data/` | The feed snapshot and the taxonomy |

Models are chosen per agent by environment variable — `COPYWRITER_MODEL`,
`ART_DIRECTOR_MODEL`, `IMPROVER_MODEL` and so on — cheap for the agents that run
per banner, larger for the three that run rarely and think about the system.

## What is not built

- **Image generation.** The banner is drawn, not generated. That is a decision:
  everything on it must be exact, and an image model redraws what you give it —
  the product becomes a similar product and the price becomes similar-looking
  digits. The render costs nothing and is identical every time. What a model
  would buy is a real background instead of a gradient; the prompt for that is
  specified in [`docs/prompt-imagem.md`](docs/prompt-imagem.md), not wired up.
- **A brand reviewer agent**, which would check a finished banner against the
  guide.
- **The choice stage in the improvement loop.** Replaying a recommendation per
  eval case costs more than the rest of the loop together, and the rules that
  drive it are already editable as sentences.

## The process

The long version is in [`WORKLOG.md`](WORKLOG.md), the measurements behind it in
[`docs/detalhes-tecnicos.md`](docs/detalhes-tecnicos.md). Three habits run
through it: **measure before building** — the pool reaches to the department
because peripherals turned out to be siblings of a product's parent and not
children; **ask the model as little as possible** — closed answers by index,
batching, free shortcuts first, and lazy work, which took the pool needing a
model call from 28,042 to 15,308; and **write down what was refused** — a reuse
that was rejected, a saving the feed contradicts, a test that found nothing, a
prompt revision the reviewer turned down. Most of this system's value is in what
it declined to do.

## Use of the material

The brand guide, fonts, logo, banners and feed data belong to Elkjøp /
Elgiganten. They are provided only for this challenge and may not be used for
any other purpose. The demo shop is marked as a demo on every page for the same
reason.
