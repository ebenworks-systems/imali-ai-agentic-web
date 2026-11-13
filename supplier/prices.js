// Draws the price list and terms from the published network file, so the page and the
// sales desk agent always quote the same data.

/**
 * Fetch the network file and fill the price table and terms list.
 */
async function drawPrices() {
  const rows = document.getElementById("price-rows");
  try {
    const response = await fetch(new URL("bonde_wholesale.network.json", import.meta.url));
    const network = await response.json();
    const strings = network.commondefs.replacement_strings;
    const lines = strings.price_list.trim().split("\n").slice(1);
    rows.replaceChildren();
    for (const line of lines) {
      const [item, , pack, packPrice, each] = line.split("|").map((part) => part.trim());
      const tr = document.createElement("tr");
      // On a phone the Pack column folds into the item cell, under the item's name.
      const itemCell = document.createElement("td");
      const name = document.createElement("span");
      name.className = "item-name";
      name.textContent = item;
      const packUnder = document.createElement("span");
      packUnder.className = "pack-under";
      packUnder.textContent = pack;
      itemCell.append(name, packUnder);
      tr.append(itemCell);
      for (const [text, cls] of [[pack, "col-pack"], [`KSh ${Number(packPrice).toLocaleString("en-US")}`, "num"], [`KSh ${each}`, "num"]]) {
        const td = document.createElement("td");
        td.textContent = text;
        td.className = cls;
        tr.append(td);
      }
      rows.append(tr);
    }
    const terms = document.getElementById("terms");
    for (const line of strings.terms.trim().split("\n")) {
      const li = document.createElement("li");
      li.textContent = line;
      terms.append(li);
    }
  } catch (error) {
    rows.replaceChildren();
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.textContent = "The price list could not load. Reload the page.";
    tr.append(td);
    rows.append(tr);
    console.error("Price list failed to load", error);
  }
}

await drawPrices();
