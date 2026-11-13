# Imali AI shop book: features and functionality

Live site: https://imali-ai-agentic-web.vercel.app/
Agent network file: https://imali-ai-agentic-web.vercel.app/imali_shop_book.network.json (listed in https://imali-ai-agentic-web.vercel.app/agent-manifest.json)
Partner site: https://imali-ai-agentic-supplier.vercel.app/ (network file `bonde_wholesale.network.json`)
Code: https://github.com/ebenworks-systems/imali-ai-agentic-web (Apache-2.0)

## What it does

Imali AI is Africa's smartest AI Business OS. Imali AI runs sales, stock and books on WhatsApp for shop owners and merchants, along with their suppliers, their funders and groups of companies.

This entry brings that idea to the open agentic web. A corner shop owner in Nakuru writes to her agent the way she talks, in Kiswahili or English: "Nimeuza mikate 3 na maziwa 2, pesa taslimu. Juma amechukua sukari 2 kwa deni." The agent turns that one message into three entries, shows each one in a confirmation dialog, and saves them to her book only when she agrees. She can then ask what she made this week, who owes her, or for a written statement of her trading for a landlord or lender.

When stock runs low, her agent asks her wholesaler's own agent network, published on another website, for prices and delivery terms. The two sites are separate origins with separate networks. The shop's browser shows a card with the request before any contact, runs the wholesaler's network on the visitor's own model, and keeps the priced order list in the book. Nothing is sent and nothing is paid.

## Features

- **An agent network published as data.** `imali_shop_book` has a front agent, `imali_bookkeeper`, and a specialist, `statement_writer`, described in a conforming `.json` network file with its manifest, `links.json`, `agent-mcp.json` and `.well-known` discovery files.
- **Runs in the browser.** The challenge's browser runtime loads the network and runs every agent in the visitor's browser. The site is static files, and no server of ours sits between the visitor and the model.
- **Bring your own key.** The visitor picks the model provider, model and key in the settings under the chat. The key stays in the visitor's browser and goes only to the provider they chose. The page holds no key.
- **Five site actions.** The agents read and write the book through `read_book`, `get_report`, `save_entries`, `save_order_list` and `close_day`. Every write opens a dialog with the exact entries, so nothing changes before the owner sees it.
- **Talks to other agentic websites.** The shop calls Bonde Wholesale's network by its full address after the visitor agrees on a consent card. Any other agentic website can call the shop's network the same way, at `https://imali-ai-agentic-web.vercel.app/imali_shop_book`, through its published action bridge.
- **Any language.** The agent replies in the language of the owner's latest message.
- **Safe by design.** The agent cannot send money, message anyone or delete an entry; a mistake is fixed with a new entry, as in any account book. Text from tools and other networks is treated as data, not as instructions.
- **A conformance checker for everyone.** `tools/check-site.mjs` checks any live agentic website against the specification's public-file rules: the manifest and its networks, the runtime's own network validator, CORS for callers on other origins, each partner down to its exact network name, the action bridge, the router and peer policy, HTTPS and key-shaped text. It sends no key and calls no model. Point it at your own site with `node tools/check-site.mjs <your site's base URL>`.

## What is new since 11 November 2026

All of it. The repository's first commit is from 13 November 2026, and every part of the entry was written for the challenge from then on: the shop book and its rules, the five site actions and their confirmation dialogs, the two agent networks, the Bonde Wholesale site, the tests and the conformance checker. On 13 November it moved to the challenge's newest runtime and linking design (partner named by full address, the template's peer and partner rules, and an action bridge for callers). It calls no Imali AI server and uses none of the Imali AI app's code; only the Imali AI name, logo and web fonts come from the product.
