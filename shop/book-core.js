// The shop book: data and rules, with no page code, so the page's own forms, the agent's
// website_* tools and the Node tests all use the same functions.
//
// Everything here is fictional. Neema's Corner Shop, its stock, its customers and its
// history are made up for this demo and are generated on the visitor's device.

/** Readable labels for the kinds of entry the book keeps. */
export const ENTRY_KINDS = ["sale", "expense", "stock_in", "debt_payment"];

/** Expense categories a shop owner picks from. */
export const EXPENSE_CATEGORIES = ["transport", "rent", "electricity", "wages", "airtime", "repairs", "other"];

/** Periods the report can cover. */
export const REPORT_PERIODS = ["today", "yesterday", "last_7_days", "last_30_days"];

/** The fictional shop. */
export const SHOP = {
  name: "Neema's Corner Shop",
  town: "Nakuru, Kenya",
  owner: "Neema",
  currency: "KSh",
  demo: true,
};

/**
 * The stock list the book starts with. Prices and costs are whole Kenyan shillings.
 * localNames are the words a Kiswahili-speaking owner may type.
 */
export const CATALOG = [
  { id: "bread", name: "Bread, 400 g loaf", localNames: ["mkate"], price: 65, cost: 52, unit: "loaf", start: 30, reorderAt: 8 },
  { id: "milk", name: "Milk, 500 ml packet", localNames: ["maziwa"], price: 60, cost: 50, unit: "packet", start: 40, reorderAt: 10 },
  { id: "sugar", name: "Sugar, 1 kg", localNames: ["sukari"], price: 180, cost: 158, unit: "bag", start: 18, reorderAt: 5 },
  { id: "maize_flour", name: "Maize flour, 2 kg", localNames: ["unga"], price: 210, cost: 182, unit: "bag", start: 22, reorderAt: 6 },
  { id: "cooking_oil", name: "Cooking oil, 1 litre", localNames: ["mafuta"], price: 320, cost: 280, unit: "bottle", start: 12, reorderAt: 4 },
  { id: "eggs", name: "Eggs, each", localNames: ["mayai"], price: 17, cost: 13, unit: "egg", start: 90, reorderAt: 30 },
  { id: "soap", name: "Bar soap, 800 g", localNames: ["sabuni"], price: 150, cost: 125, unit: "bar", start: 15, reorderAt: 4 },
  { id: "tea_leaves", name: "Tea leaves, 250 g", localNames: ["majani ya chai"], price: 140, cost: 115, unit: "packet", start: 14, reorderAt: 4 },
];

/** Customers who buy on credit in the sample book. */
const SAMPLE_CUSTOMERS = ["Juma", "Wanjiru", "Otieno", "Achieng"];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Format a whole-shilling amount the way the page shows it.
 *
 * :param amount: Whole shillings.
 * :return: Text such as "KSh 1,250".
 */
export function money(amount) {
  const sign = amount < 0 ? "-" : "";
  return `${sign}KSh ${Math.abs(Math.round(amount)).toLocaleString("en-US")}`;
}

/**
 * The calendar day of a date in the visitor's time zone, as YYYY-MM-DD.
 *
 * :param date: A Date.
 * :return: The day key.
 */
export function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * A day key with its weekday, such as "Fri, 13 Nov 2026", so the model never works it out.
 *
 * :param key: A YYYY-MM-DD day key.
 * :return: The readable date.
 */
export function readableDay(key) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d, 12);
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

/**
 * The day key a number of days before another.
 *
 * :param key: A YYYY-MM-DD day key.
 * :param days: How many days back.
 * :return: The earlier day key.
 */
export function daysBefore(key, days) {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(new Date(y, m - 1, d, 12).getTime() - days * DAY_MS));
}

/**
 * A small seeded random generator, so the sample history is the same on every load.
 *
 * :param seed: A whole number.
 * :return: A function giving numbers from 0 up to 1.
 */
function seeded(seed) {
  let value = seed >>> 0;
  return function next() {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

/**
 * The shop book: stock, entries, customers who owe, order lists and closed days.
 */
export class Book {
  /**
   * Create a book from saved data, or the sample book when there is none.
   *
   * :param saved: Data from toJSON(), or null.
   * :param now: A function giving the current Date, so tests can fix the day.
   */
  constructor(saved, now = () => new Date()) {
    this.now = now;
    const data = saved && saved.format === 1 ? saved : Book.sample(dayKey(now()));
    this.version = data.version;
    this.stock = data.stock;
    this.entries = data.entries;
    this.closedDays = data.closedDays;
    this.orderLists = data.orderLists;
    this.nextId = data.nextId;
  }

  /**
   * Build the sample book: 13 days of fictional trading before today.
   *
   * :param today: Today's day key.
   * :return: Data in the toJSON() shape.
   */
  static sample(today) {
    const random = seeded(20261121);
    const stock = {};
    for (const item of CATALOG) {
      stock[item.id] = item.start;
    }
    const entries = [];
    let id = 1;
    const closedDays = [];
    for (let back = 13; back >= 1; back -= 1) {
      const day = daysBefore(today, back);
      closedDays.push(day);
      // A delivery every few days keeps the shelves full.
      if (back % 4 === 1) {
        for (const item of CATALOG) {
          // The last delivery had no tea or cooking oil, so those run low today.
          if (back === 1 && (item.id === "tea_leaves" || item.id === "cooking_oil")) {
            continue;
          }
          const quantity = Math.max(item.reorderAt * 2, Math.round(item.start * 0.6));
          stock[item.id] += quantity;
          entries.push({ id: id++, day, time: "07:10", kind: "stock_in", itemId: item.id, quantity, unitCost: item.cost });
        }
      }
      const sales = 6 + Math.floor(random() * 7);
      for (let n = 0; n < sales; n += 1) {
        const item = CATALOG[Math.floor(random() * CATALOG.length)];
        const quantity = item.id === "eggs" ? 2 + Math.floor(random() * 10) : 1 + Math.floor(random() * 3);
        if (stock[item.id] < quantity) {
          continue;
        }
        stock[item.id] -= quantity;
        const credit = random() < 0.12;
        const hour = 8 + Math.floor((n / sales) * 11);
        entries.push({
          id: id++, day, time: `${String(hour).padStart(2, "0")}:${String(Math.floor(random() * 60)).padStart(2, "0")}`,
          kind: "sale", itemId: item.id, quantity, unitPrice: item.price,
          customer: credit ? SAMPLE_CUSTOMERS[Math.floor(random() * SAMPLE_CUSTOMERS.length)] : "",
          paid: !credit,
        });
      }
      if (back % 3 === 0) {
        entries.push({ id: id++, day, time: "18:30", kind: "expense", category: "transport", amount: 150 + Math.floor(random() * 4) * 50, note: "Matatu to the wholesaler" });
      }
      if (back === 7) {
        entries.push({ id: id++, day, time: "09:00", kind: "expense", category: "electricity", amount: 900, note: "Prepaid tokens" });
      }
      if (back === 5) {
        const debtor = entries.find((entry) => entry.kind === "sale" && !entry.paid);
        if (debtor) {
          entries.push({ id: id++, day, time: "17:45", kind: "debt_payment", customer: debtor.customer, amount: debtor.quantity * debtor.unitPrice });
        }
      }
    }
    return { format: 1, version: 1, stock, entries, closedDays, orderLists: [], nextId: id };
  }

  /**
   * The data to save in the browser.
   *
   * :return: Plain JSON data.
   */
  toJSON() {
    return {
      format: 1,
      version: this.version,
      stock: { ...this.stock },
      entries: this.entries.map((entry) => ({ ...entry })),
      closedDays: [...this.closedDays],
      orderLists: this.orderLists.map((list) => ({ ...list, lines: list.lines.map((line) => ({ ...line })) })),
      nextId: this.nextId,
    };
  }

  /** Today's day key. */
  today() {
    return dayKey(this.now());
  }

  /** The current time as HH:MM. */
  clock() {
    const date = this.now();
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  /** True when today's book is closed. */
  isClosedToday() {
    return this.closedDays.includes(this.today());
  }

  /**
   * The catalog item for an id.
   *
   * :param id: The item id.
   * :return: The item, or undefined.
   */
  static item(id) {
    return CATALOG.find((item) => item.id === id);
  }

  /**
   * What each customer still owes: credit sales less payments, over the whole book.
   *
   * :return: A list of {customer, owes}, largest first, without customers who owe nothing.
   */
  debts() {
    const owed = new Map();
    for (const entry of this.entries) {
      if (entry.kind === "sale" && !entry.paid) {
        const key = entry.customer;
        owed.set(key, (owed.get(key) || 0) + entry.quantity * entry.unitPrice);
      } else if (entry.kind === "debt_payment") {
        owed.set(entry.customer, (owed.get(entry.customer) || 0) - entry.amount);
      }
    }
    return [...owed.entries()]
      .filter(([, amount]) => amount > 0)
      .map(([customer, amount]) => ({ customer, owes: amount }))
      .sort((a, b) => b.owes - a.owes);
  }

  /**
   * Find a customer's name as the book spells it, ignoring case and spaces.
   *
   * :param name: The name typed.
   * :return: The book's spelling, or the trimmed name when the book does not know it.
   */
  customerName(name) {
    const wanted = String(name || "").trim().replace(/\s+/g, " ");
    const known = new Set(this.entries.filter((entry) => entry.customer).map((entry) => entry.customer));
    for (const customer of known) {
      if (customer.toLowerCase() === wanted.toLowerCase()) {
        return customer;
      }
    }
    return wanted;
  }

  /**
   * One readable line for an entry.
   *
   * :param entry: A saved or proposed entry.
   * :return: Text such as "Sale: 3 x Bread, 400 g loaf at KSh 65 = KSh 195, paid".
   */
  static describe(entry) {
    if (entry.kind === "sale") {
      const item = Book.item(entry.itemId);
      const total = entry.quantity * entry.unitPrice;
      const terms = entry.paid ? "paid" : `on credit to ${entry.customer}`;
      const buyer = entry.paid && entry.customer ? `, to ${entry.customer}` : "";
      return `Sale: ${entry.quantity} x ${item.name} at ${money(entry.unitPrice)} = ${money(total)}, ${terms}${buyer}`;
    }
    if (entry.kind === "stock_in") {
      const item = Book.item(entry.itemId);
      return `Stock in: ${entry.quantity} x ${item.name} at ${money(entry.unitCost)} = ${money(entry.quantity * entry.unitCost)}`;
    }
    if (entry.kind === "expense") {
      const note = entry.note ? ` (${entry.note})` : "";
      return `Expense: ${entry.category} ${money(entry.amount)}${note}`;
    }
    return `Payment received: ${entry.customer} paid ${money(entry.amount)} of what they owe`;
  }

  /**
   * Check proposed entries without changing anything. save() calls this first, and the
   * confirmation dialog calls it before it opens.
   *
   * :param args: {entries, expectedVersion}.
   * :return: {ok: true, entries, lines, cashIn, cashOut} with each entry filled in, or
   *   {ok: false, reason, field}.
   */
  checkEntries(args) {
    if (this.isClosedToday()) {
      return { ok: false, reason: `Today's book (${readableDay(this.today())}) is closed. Start the book again to keep trying entries.`, field: "entries" };
    }
    if (args.expectedVersion !== this.version) {
      return { ok: false, reason: `The book changed since it was read (version ${this.version} now, ${args.expectedVersion} given). Read the book again.`, field: "expectedVersion" };
    }
    const list = Array.isArray(args.entries) ? args.entries : [];
    if (list.length === 0) {
      return { ok: false, reason: "There is nothing to save.", field: "entries" };
    }
    const stockLeft = { ...this.stock };
    const owedLeft = new Map(this.debts().map((debt) => [debt.customer, debt.owes]));
    const filled = [];
    let cashIn = 0;
    let cashOut = 0;
    for (let index = 0; index < list.length; index += 1) {
      const raw = list[index];
      const where = list.length > 1 ? ` (entry ${index + 1})` : "";
      const kind = raw.kind;
      if (!ENTRY_KINDS.includes(kind)) {
        return { ok: false, reason: `Unknown entry kind${where}.`, field: "kind" };
      }
      if (kind === "sale" || kind === "stock_in") {
        const item = Book.item(raw.itemId);
        if (!item) {
          return { ok: false, reason: `That item is not in the stock list${where}.`, field: "itemId" };
        }
        const quantity = raw.quantity;
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
          return { ok: false, reason: `Give a whole quantity from 1 to 1,000${where}.`, field: "quantity" };
        }
        if (kind === "sale") {
          if (stockLeft[item.id] < quantity) {
            return { ok: false, reason: `Only ${stockLeft[item.id]} ${item.unit} of ${item.name} left in stock${where}. Record the stock that came in first.`, field: "quantity" };
          }
          const unitPrice = raw.unitPrice ?? item.price;
          if (!Number.isInteger(unitPrice) || unitPrice < 1 || unitPrice > 100000) {
            return { ok: false, reason: `Give a whole price from KSh 1 to KSh 100,000${where}.`, field: "unitPrice" };
          }
          const paid = raw.paid !== false;
          const customer = this.customerName(raw.customer);
          if (!paid && !customer) {
            return { ok: false, reason: `A sale on credit needs the customer's name${where}.`, field: "customer" };
          }
          if (customer.length > 40) {
            return { ok: false, reason: `Keep the customer's name to 40 characters${where}.`, field: "customer" };
          }
          stockLeft[item.id] -= quantity;
          if (paid) {
            cashIn += quantity * unitPrice;
          }
          filled.push({ kind, itemId: item.id, quantity, unitPrice, customer, paid });
        } else {
          const unitCost = raw.unitCost ?? item.cost;
          if (!Number.isInteger(unitCost) || unitCost < 1 || unitCost > 100000) {
            return { ok: false, reason: `Give a whole cost from KSh 1 to KSh 100,000${where}.`, field: "unitCost" };
          }
          stockLeft[item.id] += quantity;
          cashOut += quantity * unitCost;
          filled.push({ kind, itemId: item.id, quantity, unitCost });
        }
      } else if (kind === "expense") {
        if (!EXPENSE_CATEGORIES.includes(raw.category)) {
          return { ok: false, reason: `Pick an expense category: ${EXPENSE_CATEGORIES.join(", ")}${where}.`, field: "category" };
        }
        if (!Number.isInteger(raw.amount) || raw.amount < 1 || raw.amount > 1000000) {
          return { ok: false, reason: `Give a whole amount from KSh 1 to KSh 1,000,000${where}.`, field: "amount" };
        }
        const note = String(raw.note || "").trim().replace(/\s+/g, " ");
        if (note.length > 80) {
          return { ok: false, reason: `Keep the note to 80 characters${where}.`, field: "note" };
        }
        cashOut += raw.amount;
        filled.push({ kind, category: raw.category, amount: raw.amount, note });
      } else {
        const customer = this.customerName(raw.customer);
        const owes = owedLeft.get(customer) || 0;
        if (!customer) {
          return { ok: false, reason: `A payment needs the customer's name${where}.`, field: "customer" };
        }
        if (owes <= 0) {
          return { ok: false, reason: `${customer} owes nothing in this book${where}.`, field: "customer" };
        }
        if (!Number.isInteger(raw.amount) || raw.amount < 1 || raw.amount > owes) {
          return { ok: false, reason: `${customer} owes ${money(owes)}. Give a whole amount from KSh 1 up to that${where}.`, field: "amount" };
        }
        owedLeft.set(customer, owes - raw.amount);
        cashIn += raw.amount;
        filled.push({ kind, customer, amount: raw.amount });
      }
    }
    return { ok: true, entries: filled, lines: filled.map(Book.describe), cashIn, cashOut };
  }

  /**
   * Save entries in today's book. A saved entry stays in the book, as in any account
   * book: a mistake is corrected with a new entry, never by deleting one.
   *
   * :param args: {entries, expectedVersion}.
   * :return: {ok: true, saved, version} or {ok: false, reason, field}.
   */
  save(args) {
    const check = this.checkEntries(args);
    if (!check.ok) {
      return check;
    }
    const day = this.today();
    const time = this.clock();
    const saved = [];
    for (const entry of check.entries) {
      const stored = { id: this.nextId++, day, time, ...entry };
      if (entry.kind === "sale") {
        this.stock[entry.itemId] -= entry.quantity;
      } else if (entry.kind === "stock_in") {
        this.stock[entry.itemId] += entry.quantity;
      }
      this.entries.push(stored);
      saved.push({ id: stored.id, line: Book.describe(stored) });
    }
    this.version += 1;
    return { ok: true, saved, version: this.version, cashIn: money(check.cashIn), cashOut: money(check.cashOut) };
  }

  /**
   * Check that today's book can be closed, without changing anything.
   *
   * :param args: {expectedVersion}.
   * :return: {ok: true, day, totals} or {ok: false, reason, field}.
   */
  checkClose(args) {
    if (this.isClosedToday()) {
      return { ok: false, reason: `Today's book (${readableDay(this.today())}) is already closed.`, field: "expectedVersion" };
    }
    if (args.expectedVersion !== this.version) {
      return { ok: false, reason: `The book changed since it was read (version ${this.version} now, ${args.expectedVersion} given). Read the book again.`, field: "expectedVersion" };
    }
    return { ok: true, day: readableDay(this.today()), totals: this.report("today").totals };
  }

  /**
   * Close today's book. After this, no entry can be added for today.
   *
   * :param args: {expectedVersion}.
   * :return: {ok: true, closed, totals, version} or {ok: false, reason, field}.
   */
  closeDay(args) {
    const check = this.checkClose(args);
    if (!check.ok) {
      return check;
    }
    this.closedDays.push(this.today());
    this.version += 1;
    return { ok: true, closed: check.day, totals: check.totals, version: this.version };
  }

  /**
   * Check an order list for a supplier, without changing anything.
   *
   * :param args: {supplier, lines: [{itemId, quantity, unitPrice}], expectedVersion}.
   * :return: {ok: true, lines, total} or {ok: false, reason, field}.
   */
  checkOrderList(args) {
    if (args.expectedVersion !== this.version) {
      return { ok: false, reason: `The book changed since it was read (version ${this.version} now, ${args.expectedVersion} given). Read the book again.`, field: "expectedVersion" };
    }
    const supplier = String(args.supplier || "").trim().replace(/\s+/g, " ");
    if (!supplier || supplier.length > 60) {
      return { ok: false, reason: "Give the supplier's name, up to 60 characters.", field: "supplier" };
    }
    const lines = [];
    let total = 0;
    for (const raw of args.lines || []) {
      const item = Book.item(raw.itemId);
      if (!item) {
        return { ok: false, reason: "An order line names an item that is not in the stock list.", field: "itemId" };
      }
      if (!Number.isInteger(raw.quantity) || raw.quantity < 1 || raw.quantity > 1000) {
        return { ok: false, reason: `Give a whole quantity from 1 to 1,000 for ${item.name}.`, field: "quantity" };
      }
      if (!Number.isInteger(raw.unitPrice) || raw.unitPrice < 1 || raw.unitPrice > 100000) {
        return { ok: false, reason: `Give the supplier's whole price for ${item.name}, from KSh 1 to KSh 100,000.`, field: "unitPrice" };
      }
      total += raw.quantity * raw.unitPrice;
      lines.push({ itemId: item.id, name: item.name, quantity: raw.quantity, unitPrice: raw.unitPrice, lineTotal: raw.quantity * raw.unitPrice });
    }
    if (lines.length === 0) {
      return { ok: false, reason: "The order list is empty.", field: "lines" };
    }
    return { ok: true, supplier, lines, total };
  }

  /**
   * Save an order list in the book for the owner to send to the supplier. Nothing is
   * sent and nothing is paid.
   *
   * :param args: {supplier, lines, expectedVersion}.
   * :return: {ok: true, orderList, version} or {ok: false, reason, field}.
   */
  saveOrderList(args) {
    const check = this.checkOrderList(args);
    if (!check.ok) {
      return check;
    }
    const list = { id: `OL-${this.nextId++}`, day: this.today(), time: this.clock(), supplier: check.supplier, lines: check.lines, total: check.total, sent: false };
    this.orderLists.push(list);
    this.version += 1;
    return { ok: true, orderList: Book.describeOrderList(list), version: this.version };
  }

  /**
   * An order list in readable form.
   *
   * :param list: A saved order list.
   * :return: Plain data with amounts as text.
   */
  static describeOrderList(list) {
    return {
      id: list.id,
      date: readableDay(list.day),
      supplier: list.supplier,
      lines: list.lines.map((line) => `${line.quantity} x ${line.name} at ${money(line.unitPrice)} = ${money(line.lineTotal)}`),
      total: money(list.total),
      status: "Saved in the book for the owner to send. Not sent, not paid.",
    };
  }

  /**
   * Totals over a period, from the book's own entries.
   *
   * :param period: One of REPORT_PERIODS.
   * :return: The report as plain data, amounts as text and as numbers.
   */
  report(period) {
    const today = this.today();
    const spans = { today: [today, today], yesterday: [daysBefore(today, 1), daysBefore(today, 1)], last_7_days: [daysBefore(today, 6), today], last_30_days: [daysBefore(today, 29), today] };
    const [from, to] = spans[period] || spans.today;
    const inPeriod = this.entries.filter((entry) => entry.day >= from && entry.day <= to);
    let sales = 0;
    let creditSales = 0;
    let costOfSales = 0;
    let expenses = 0;
    let paymentsIn = 0;
    let stockBought = 0;
    const byItem = new Map();
    const byDay = new Map();
    for (const entry of inPeriod) {
      const day = byDay.get(entry.day) || { sales: 0, expenses: 0 };
      if (entry.kind === "sale") {
        const amount = entry.quantity * entry.unitPrice;
        sales += amount;
        if (!entry.paid) {
          creditSales += amount;
        }
        costOfSales += entry.quantity * Book.item(entry.itemId).cost;
        const row = byItem.get(entry.itemId) || { quantity: 0, sales: 0 };
        row.quantity += entry.quantity;
        row.sales += amount;
        byItem.set(entry.itemId, row);
        day.sales += amount;
      } else if (entry.kind === "expense") {
        expenses += entry.amount;
        day.expenses += entry.amount;
      } else if (entry.kind === "debt_payment") {
        paymentsIn += entry.amount;
      } else {
        stockBought += entry.quantity * entry.unitCost;
      }
      byDay.set(entry.day, day);
    }
    const grossProfit = sales - costOfSales;
    const totals = {
      sales: money(sales), salesAmount: sales,
      cashSales: money(sales - creditSales), creditSales: money(creditSales),
      costOfSales: money(costOfSales), grossProfit: money(grossProfit), grossProfitAmount: grossProfit,
      expenses: money(expenses), expensesAmount: expenses,
      profitAfterExpenses: money(grossProfit - expenses), profitAfterExpensesAmount: grossProfit - expenses,
      debtPaymentsIn: money(paymentsIn), stockBought: money(stockBought),
    };
    const days = [];
    for (let key = from; key <= to; key = daysBefore(key, -1)) {
      const day = byDay.get(key) || { sales: 0, expenses: 0 };
      days.push({ date: readableDay(key), sales: day.sales, expenses: day.expenses });
    }
    const topItems = [...byItem.entries()]
      .map(([id, row]) => ({ item: Book.item(id).name, quantity: row.quantity, sales: money(row.sales) }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
    return {
      shop: `${SHOP.name}, ${SHOP.town}`,
      period,
      from: readableDay(from),
      to: readableDay(to),
      daysWithEntries: [...byDay.keys()].length,
      entries: inPeriod.length,
      totals,
      topItems,
      days,
      basis: "Worked out from the entries in this book. Cost of sales uses each item's cost price. Not audited.",
    };
  }

  /**
   * The whole book as the agent and the page read it: plain copies, never live objects.
   *
   * :return: The book state.
   */
  state() {
    const today = this.today();
    const todays = this.entries.filter((entry) => entry.day === today);
    const report = this.report("today");
    let cash = 0;
    for (const entry of this.entries) {
      if (entry.kind === "sale" && entry.paid) cash += entry.quantity * entry.unitPrice;
      if (entry.kind === "debt_payment") cash += entry.amount;
      if (entry.kind === "expense") cash -= entry.amount;
      if (entry.kind === "stock_in") cash -= entry.quantity * entry.unitCost;
    }
    const debts = this.debts();
    return {
      shop: { ...SHOP },
      today: readableDay(today),
      dayStatus: this.isClosedToday() ? "closed" : "open",
      version: this.version,
      stock: CATALOG.map((item) => ({
        id: item.id, name: item.name, localNames: item.localNames, unit: item.unit,
        price: money(item.price), priceAmount: item.price, cost: money(item.cost), costAmount: item.cost,
        onHand: this.stock[item.id], low: this.stock[item.id] <= item.reorderAt,
      })),
      todayEntries: todays.map((entry) => ({ id: entry.id, time: entry.time, line: Book.describe(entry) })),
      todayTotals: report.totals,
      cashFromBook: money(cash + 25000),
      cashNote: "Opening float of KSh 25,000 plus every cash entry in the book.",
      owedToShop: debts.map((debt) => ({ customer: debt.customer, owes: money(debt.owes), owesAmount: debt.owes })),
      orderLists: this.orderLists.slice(-3).map(Book.describeOrderList),
    };
  }
}
