# Banner Factory Challenge

A coding challenge from Digital Fans.

Build a small application that generates a personalised retargeting banner for
an online electronics store, on demand, from real product data and real brand
material.

## Context

Elgiganten (Elkjøp) is the largest consumer electronics retailer in the Nordics.
The hero banner on its home page is the most valuable space on the site, and
today every visitor sees the same one.

We are working on changing that. A visitor looks at a product, leaves, and
comes back later. When they return, the home page hero should speak to them,
based on the product they looked at.

This challenge is that use case.

## What we want to prove

The point of this demo is to prove two things:

1. We can select a product and produce a banner **on demand**, customised to
   the product the visitor looked at and to the promotions running right now.
2. The banner follows the **basic design principles of the brand**.

Do not worry about making the design perfect. We know it can be refined later.

## The use case

1. The user picks a **seed product**: the product the visitor looked at.
2. The user picks a **language** for the banner: Danish, Swedish or English.
3. The user presses the **Generate banner** button.
4. The application decides **which product to show**:
   - the best product currently on promotion for this visitor, or
   - the seed product itself, as a plain retargeting banner, when nothing on
     promotion is a good match.
5. The application generates a **home page hero banner** for that product, in
   the chosen language, on brand.

## Requirements

### Must have

- Choose a seed product from the product feed.
- Choose a language.
- Generate a retargeting banner from those two inputs.
- The banner has, at minimum, a **title**, a **subtitle**, a **product image**
  and a **call to action**. Beyond that, you are free to design it however you
  like.
- The banner looks like it belongs on the Elgiganten home page. Use the
  references in [`examples/`](./examples/) and the live sites,
  [elgiganten.dk](https://www.elgiganten.dk) and
  [elgiganten.se](https://www.elgiganten.se). It should feel like the same
  family. It does not have to be identical.
- The banner is a home page hero: **2048 × 768 px** (8:3), the size of the
  production banners.
- Everything in the banner is true: the product, the price and the saving come
  from the feed and are never invented.
- The product shown is **in stock**. The seed product can be any product in the
  feed, including one that is out of stock; what to show in that case is part of
  your strategy.
- Prices are always shown in **DKK**, as they come from the feed, whatever the
  language. The language changes the text, not the market.

### The two sets of examples

- [`examples/production-banners/`](./examples/production-banners/) are real
  banners we took from the Elgiganten websites. They show what runs on the home
  page today.
- [`examples/design-references/`](./examples/design-references/) were made by
  our own team as a direction for personalised banners. Some of what they show,
  such as subscription prices and legal text, cannot be produced from the feed.

The two sets do not agree on everything, and neither do they agree with the
brand guide: the guide and our references use the diagonal "wing" shape and the
logo, and the production banners use neither. Both are optional here. Use the
examples as inspiration and the brand guide for the basics: colour, typography
and tone of voice.

### Stack

- **[Mastra](https://mastra.ai)** for the AI side: agents, tools, workflows.
- **[Next.js](https://nextjs.org)** or **[TanStack Start](https://tanstack.com/start)**
  for the application.
- A database is optional.

### Nice to have

None of these are required. All of them are welcome.

- Show a log or progress while the banner is being generated, so the user can
  follow the process and understand what is happening.
- Show the cost and the time spent on each banner.
- Show how banner generation could be optimised, in cost and in time.
- Anything else you think makes the banner factory better to use. The
  requirements above are the baseline: you are free to add to them and improve
  on them.

## Choosing the product

This is the heart of the challenge.

Product recommendation is normally done with ML/DL models trained on
behavioural data: what people viewed, bought and clicked. We do not have that
data here. All you have is the product feed.

So we want you to design a selection strategy that tries to answer one question:

> Given the seed product, the one this person visited, what is the best product
> I can show them on the home page?

The idea is to show something **on promotion** that fits the profile of a person
who looked at the seed product. Deciding to show the seed product itself is a
perfectly valid outcome. What matters is that the decision is deliberate and
that you can explain it.

## What we give you

| Path | What it is |
|---|---|
| [`brand/Elkjop_Design_Guide_V1_9.4.pdf`](./brand/Elkjop_Design_Guide_V1_9.4.pdf) | The Elkjøp / Elgiganten brand guidelines, 117 pages |
| [`brand/copywriting-guidelines.md`](./brand/copywriting-guidelines.md) | A short overview of the brand's tone of voice and copy style |
| [`brand/fonts/`](./brand/fonts/) | The brand fonts, with a ready `fonts.css` |
| [`brand/logo/`](./brand/logo/) | The Elgiganten logo in navy and white, SVG and PNG |
| [`data/`](./data/) | A snapshot of the Danish product feed from 2026-08-25, with 28,231 products, and a description of its fields |
| [`examples/production-banners/`](./examples/production-banners/) | 8 real hero banners taken from elgiganten.dk and elgiganten.se (2048 × 768) |
| [`examples/design-references/`](./examples/design-references/) | 4 reference banners, one per customer segment, made by our team (1792 × 640) |

The feed is real data and it is Danish. It has no category, brand or language
field. Explore it before you trust it.

## API key and budget

We will send you a **Gemini API key** directly. It carries a budget of
**USD 50**.

- The key is for **your application**: the model calls made while selecting a
  product and generating a banner. It is not for agentic coding.
- You are not tied to Gemini. Use any API and any model you like, anywhere in
  the process. We share this key only so that the challenge does not force you
  to spend your own money on APIs.
- Keep the key out of your repository. Load it from an environment variable.

If you would also like tokens for your coding agent (Codex, Claude Code or
similar), ask our team.

## Delivery

1. Clone this repository and host your copy in a GitHub repository of your own.
   A fork works too, but it is not required.
2. Build your solution there.
3. Include instructions for running it locally: prerequisites, environment
   variables, and the commands to install and start it.
4. Send us the link to your repository.

## Tips

- Start with the problem, not the interface. Build a small dataset of about
  **25 very different products** and use it to test and define your selection
  strategy and your banner generation. Once you have a solution that works well
  for those 25, build the interface and the on-demand flow.
- Use a component library such as [shadcn/ui](https://ui.shadcn.com) or
  [HeroUI](https://www.heroui.com).

## Use of the material

The brand guide, fonts, logo, banners and feed data belong to Elkjøp /
Elgiganten. They are provided only for this challenge and may not be used for
any other purpose.
