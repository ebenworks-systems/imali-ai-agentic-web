# Imali AI shop book: an open agentic website

A shop owner writes what happened in the shop, in her own words and language, and an agent
network keeps her book: sales, stock, spending and who owes her. The agents run in the
visitor's browser on the model and key the visitor chooses, and they ask a wholesaler's own
agent network, published on another website, for prices.

This is Ebenworks' entry in Cognizant's Open Agentic Web Challenge. It follows the
[Minimum Viable Specification for a Worldwide Agentic Web](https://github.com/cognizant-ai-labs/agentic-web/blob/main/docs/worldwide_agentic_web_mvp_spec.md)
(MVP Profile 0.2). It is a separate demo from the [Imali AI](https://imali-ai.ebenworks.co/)
app and calls none of its servers. The shop, the wholesaler and every figure in the book are
made up and generated in the visitor's browser.

## The two sites

| Site | Folder | Network | Front agent |
| --- | --- | --- | --- |
| Imali AI shop book, `https://imali-ai-agentic-web.vercel.app/` | `shop/` | `imali_shop_book` | `imali_bookkeeper` |
| Bonde Wholesale, `https://imali-ai-agentic-supplier.vercel.app/` | `supplier/` | `bonde_wholesale` | `bonde_sales_desk` |

`imali_bookkeeper` reads and writes the book through five site actions, hands written
statements of trading to `statement_writer`, and calls Bonde Wholesale's network by its full
address, `https://imali-ai-agentic-supplier.vercel.app/bonde_wholesale`. The visitor approves
on a card before the browser contacts the second site, and the partner network runs in the
visitor's browser on the visitor's own model, within the shop's step limit.

| Action | Effect | What it does |
| --- | --- | --- |
| `read_book` | read | Shop, today, stock, today's entries and totals, cash, who owes, order lists |
| `get_report` | read | Totals for today, yesterday, the last 7 or the last 30 days |
| `save_entries` | irreversible | Sales, expenses, stock in and debt payments; the visitor sees each entry first |
| `save_order_list` | irreversible | Keeps an order list with the supplier's prices; sends nothing |
| `close_day` | irreversible | Closes today's book |

Every change to the book opens a confirmation dialog with the exact entries, so no write runs
before the visitor sees it (section 3.1). A saved entry is corrected with a new entry, as in
any account book.

## Linked site

The shop calls Bonde Wholesale, `https://imali-ai-agentic-supplier.vercel.app/bonde_wholesale`.
Before anything is sent, a card shows "Bonde Wholesale", its host and the first 140 characters
of the request; **Always allow** skips the card for that host until the page is reloaded. A
request holds only item names and quantities: the agent is told never to put names, emails,
phone numbers or codes in it, but the runtime does not filter it, so the visitor checks it on
the card. Bonde Wholesale's network runs in this browser on the visitor's key, with none of its
site's tools; it answers from its published price list and terms. A call costs more than the
card's token estimate. Other agentic websites can call the shop's network the same way, at
`https://imali-ai-agentic-web.vercel.app/imali_shop_book`; run there, it has no access to any
book and says so.

## Run it locally

Node.js 22 or newer and Python 3.

```shell
python3 tools/serve-local.py --shop-port 8746 --supplier-port 8747
```

Open http://127.0.0.1:8746/, open **BYOK / router settings** under the chat, enter a key,
a model and an OpenAI-compatible router that allows browser calls (OpenRouter is the
default), and choose **Apply, save & reload**. On loopback hosts the runtime also keeps the
key in a cookie that other local sites can read, so use a key with a low limit and delete
the saved setup afterwards. For a router that does not allow browser calls, add
`--proxy <router base URL>` and set the router to `http://127.0.0.1:8746/llm`: the local
server forwards your own key and adds none.

## Check it

```shell
node tools/vendor/build_network.mjs shop/imali_shop_book.hocon --manifest shop/agent-manifest.json --check
node tools/vendor/build_network.mjs supplier/bonde_wholesale.hocon --manifest supplier/agent-manifest.json --check
node --test "shop/tests/*.test.mjs"
node tools/check-site.mjs https://imali-ai-agentic-web.vercel.app/
```

`tools/check-site.mjs` checks any live or local agentic website against the spec's public-file
rules: the manifest and its networks, the runtime's own network validator, CORS for callers on
other origins, each published peer link down to the peer's exact network, the router and peer
policy, HTTPS and key-shaped text. It sends no key and calls no model. Point it at your own
site with `node tools/check-site.mjs <your site's base URL>`.

`tools/live-run.mjs` runs sample requests through the network in Node with a real model, using
the runtime's own runner and the site's own actions, with the key taken from the environment.

## Files

| Path | What it is |
| --- | --- |
| `shop/book-core.js` | The book's data and rules, shared by the page, the actions and the tests |
| `shop/book.js`, `shop/view.js` | The page object and the page's drawing and form |
| `shop/site-actions.js` | The site actions the agents call |
| `shop/site.js` | Boots the runtime and draws the confirmation dialog |
| `shop/imali_shop_book.hocon` | Source of the network; `imali_shop_book.network.json` is built from it |
| `shop/agent-manifest.json`, `shop/links.json` | The public manifest and the (empty) published link map |
| `shop/bridge/` | The action bridge other agentic sites load before they run this network; written by the build, shares no actions |
| `supplier/` | The wholesaler's site, network and price list |
| `*/runtime/` | The challenge's browser runtime (Apache-2.0, see its `LICENSE.txt`); its `README.md` lists every change, ours included |
| `tools/vendor/build_network.mjs`, `tools/templates/` | The challenge's network builder and the two templates it reads, unchanged (Apache-2.0) |

## Licence

Apache-2.0 (`LICENSE`). The runtime and the network builder come from
[cognizant-ai-labs/agentic-web](https://github.com/cognizant-ai-labs/agentic-web) at commit
`21b77cb` (13 Nov 2026) under Apache-2.0. The fonts are Plus Jakarta Sans, Space Grotesk and Space Mono
under the SIL Open Font License (`*/assets/fonts/OFL-*.txt`). The Imali AI name and logo
belong to Ebenworks.
