// Draws the shop book on the page and wires the page's own entry form. The form saves
// through App.page, the same object the agent's tools use.
import { App } from "./book.js";
import { CATALOG, EXPENSE_CATEGORIES, money } from "./book-core.js";

/**
 * Draws the book and keeps it drawn.
 */
export class BookView {
  /**
   * Draw the book and redraw it after every change.
   *
   * :param app: The page object.
   * :param doc: The document.
   */
  constructor(app, doc) {
    this.app = app;
    this.doc = doc;
    app.onChange(() => this.render());
    this.wireForm();
    this.render();
  }

  /**
   * Find an element by id.
   *
   * :param id: The id.
   * :return: The element.
   */
  el(id) {
    return this.doc.getElementById(id);
  }

  /**
   * Make an element with text.
   *
   * :param tag: The tag name.
   * :param text: Its text, if any.
   * :param className: Its class, if any.
   * :return: The element.
   */
  make(tag, text, className) {
    const element = this.doc.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  /** Draw every panel from the current state. */
  render() {
    const state = this.app.getState();
    const week = this.app.report("last_7_days");
    this.el("book-date").textContent = state.today;
    const status = this.el("book-status");
    status.textContent = state.dayStatus === "open" ? "Open for entries" : "Closed for today";
    status.dataset.state = state.dayStatus;
    this.el("stat-sales").textContent = state.todayTotals.sales;
    this.el("stat-profit").textContent = state.todayTotals.profitAfterExpenses;
    this.el("stat-cash").textContent = state.cashFromBook;
    const owed = state.owedToShop.reduce((sum, row) => sum + row.owesAmount, 0);
    this.el("stat-owed").textContent = money(owed);
    this.el("stat-owed-who").textContent = state.owedToShop.length
      ? `${state.owedToShop.length} ${state.owedToShop.length === 1 ? "customer" : "customers"}`
      : "Nobody owes";
    this.renderEntries(state);
    this.renderStock(state);
    this.renderOwed(state);
    this.renderOrders(state);
    this.renderWeek(week);
    this.el("version").textContent = String(state.version);
    this.syncForm();
  }

  /**
   * Draw today's entries, newest first.
   *
   * :param state: The book state.
   */
  renderEntries(state) {
    const list = this.el("entries");
    list.replaceChildren();
    if (state.todayEntries.length === 0) {
      list.append(this.make("li", "No entries yet today. Tell the agent what you sold, or use the form.", "empty"));
    }
    for (const entry of [...state.todayEntries].reverse()) {
      const item = this.make("li");
      item.append(this.make("span", entry.time, "time"), this.make("span", entry.line, "line"));
      list.append(item);
    }
  }

  /**
   * Draw the stock table.
   *
   * :param state: The book state.
   */
  renderStock(state) {
    const rows = this.el("stock-rows");
    rows.replaceChildren();
    for (const row of state.stock) {
      const tr = this.make("tr");
      const name = this.make("td");
      name.append(this.make("span", row.name, "name"), this.make("span", row.localNames.join(", "), "local"));
      const onHand = this.make("td", row.low ? `${row.onHand} low` : String(row.onHand), row.low ? "num low" : "num");
      tr.append(name, this.make("td", row.price, "num"), onHand);
      rows.append(tr);
    }
  }

  /**
   * Draw who owes the shop.
   *
   * :param state: The book state.
   */
  renderOwed(state) {
    const list = this.el("owed");
    list.replaceChildren();
    if (state.owedToShop.length === 0) {
      list.append(this.make("li", "Nobody owes the shop.", "empty"));
    }
    for (const row of state.owedToShop) {
      const item = this.make("li");
      item.append(this.make("span", row.customer), this.make("span", row.owes, "num"));
      list.append(item);
    }
  }

  /**
   * Draw the saved order lists.
   *
   * :param state: The book state.
   */
  renderOrders(state) {
    const list = this.el("orders");
    list.replaceChildren();
    if (state.orderLists.length === 0) {
      list.append(this.make("li", "No order list yet. Ask the agent to check prices with Bonde Wholesale.", "empty"));
    }
    for (const order of [...state.orderLists].reverse()) {
      const item = this.make("li");
      item.append(this.make("strong", `${order.supplier}, ${order.date}: ${order.total}`));
      const lines = this.make("ul");
      for (const line of order.lines) lines.append(this.make("li", line));
      item.append(lines, this.make("span", order.status, "note"));
      list.append(item);
    }
  }

  /**
   * Draw the seven-day sales bars.
   *
   * :param week: The last_7_days report.
   */
  renderWeek(week) {
    const chart = this.el("week-chart");
    chart.replaceChildren();
    const top = Math.max(1, ...week.days.map((day) => day.sales));
    for (const day of week.days) {
      const bar = this.make("div");
      const fill = this.make("span", "", "bar");
      fill.style.setProperty("--h", `${Math.max(3, Math.round((day.sales / top) * 100))}%`);
      bar.title = `${day.date}: ${money(day.sales)}`;
      bar.append(fill, this.make("span", day.date.split(",")[0], "day"));
      bar.setAttribute("aria-hidden", "true");
      chart.append(bar);
    }
    this.el("week-total").textContent = week.totals.sales;
    this.el("week-profit").textContent = week.totals.profitAfterExpenses;
  }

  /** Fill the form's lists and wire its buttons. */
  wireForm() {
    const item = this.el("f-item");
    for (const row of CATALOG) {
      const option = this.make("option", `${row.name} (${money(row.price)})`);
      option.value = row.id;
      item.append(option);
    }
    const category = this.el("f-category");
    for (const name of EXPENSE_CATEGORIES) {
      const option = this.make("option", name[0].toUpperCase() + name.slice(1));
      option.value = name;
      category.append(option);
    }
    this.el("f-kind").addEventListener("change", () => this.syncForm());
    this.el("entry-form").addEventListener("submit", (event) => this.submit(event));
    this.el("reset-book").addEventListener("click", () => {
      this.app.reset();
      this.say("The sample book is back.", "ok");
    });
  }

  /** Show only the fields the chosen entry kind needs. */
  syncForm() {
    const kind = this.el("f-kind").value;
    for (const field of this.doc.querySelectorAll("[data-kinds]")) {
      field.hidden = !field.dataset.kinds.split(" ").includes(kind);
    }
  }

  /**
   * Show a message under the form.
   *
   * :param text: The message.
   * :param state: "ok" or "error".
   */
  say(text, state) {
    const message = this.el("form-message");
    message.textContent = text;
    message.dataset.state = state;
  }

  /**
   * Save the form's entry through the same method the agent uses.
   *
   * :param event: The submit event.
   */
  submit(event) {
    event.preventDefault();
    const value = (id) => this.el(id).value;
    const number = (id) => (value(id) === "" ? undefined : Number(value(id)));
    const kind = value("f-kind");
    const entry = { kind };
    if (kind === "sale" || kind === "stock_in") {
      entry.itemId = value("f-item");
      entry.quantity = number("f-quantity");
    }
    if (kind === "sale") {
      entry.unitPrice = number("f-price");
      entry.customer = value("f-customer");
      entry.paid = !this.el("f-credit").checked;
    }
    if (kind === "stock_in") entry.unitCost = number("f-price");
    if (kind === "expense") {
      entry.category = value("f-category");
      entry.amount = number("f-amount");
      entry.note = value("f-note");
    }
    if (kind === "debt_payment") {
      entry.customer = value("f-customer");
      entry.amount = number("f-amount");
    }
    const result = this.app.saveEntries({ entries: [entry], expectedVersion: this.app.getState().version });
    this.say(result.ok ? `Saved. ${result.saved[0].line}.` : result.reason, result.ok ? "ok" : "error");
  }
}

App.view = new BookView(App.page, document);
