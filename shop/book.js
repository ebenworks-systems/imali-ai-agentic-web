// The page object for the shop book. The page's own form and the agent's website_*
// tools call the same methods, so both follow one set of rules (book-core.js).
// It saves the book in this browser only. Nothing leaves the device except what the
// visitor's chosen LLM provider receives through the chat.
import { Book, CATALOG, EXPENSE_CATEGORIES, REPORT_PERIODS, money } from "./book-core.js";

const STORAGE_KEY = "imali-agentic-web-book-v1";

/**
 * Reads and saves the book, and tells the page when it changed.
 */
export class App {
  /**
   * Create the page object.
   *
   * :param storage: A Storage-like object, or null to keep the book in memory.
   * :param now: A function giving the current Date.
   */
  constructor(storage, now = () => new Date()) {
    this.storage = storage;
    this.now = now;
    this.book = new Book(App.load(storage), now);
    this.listeners = [];
  }

  /**
   * Read the saved book.
   *
   * :param storage: A Storage-like object, or null.
   * :return: Saved data, or null.
   */
  static load(storage) {
    try {
      const raw = storage?.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /** Save the book and tell the listeners. */
  changed() {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.book.toJSON()));
    } catch {
      // A full or blocked storage keeps the book for this visit only.
    }
    for (const listener of this.listeners) {
      listener(this);
    }
  }

  /**
   * Call a function after every change, such as the page's renderer.
   *
   * :param listener: Receives this page object.
   */
  onChange(listener) {
    this.listeners.push(listener);
  }

  /** The book as plain data. */
  getState() {
    return this.book.state();
  }

  /** Item ids, for the actions' schemas. */
  static itemIds() {
    return CATALOG.map((item) => item.id);
  }

  /** Expense categories, for the actions' schemas. */
  static expenseCategories() {
    return [...EXPENSE_CATEGORIES];
  }

  /** Report periods, for the actions' schemas. */
  static reportPeriods() {
    return [...REPORT_PERIODS];
  }

  /**
   * Totals for a period. Changes nothing.
   *
   * :param period: One of REPORT_PERIODS.
   * :return: The report.
   */
  report(period) {
    return this.book.report(period);
  }

  /**
   * Check entries without saving them.
   *
   * :param args: {entries, expectedVersion}.
   * :return: The check result.
   */
  checkEntries(args) {
    return this.book.checkEntries(args);
  }

  /**
   * Save entries in today's book.
   *
   * :param args: {entries, expectedVersion}.
   * :return: The receipt, or {ok: false, reason, field}.
   */
  saveEntries(args) {
    const result = this.book.save(args);
    if (result.ok) {
      this.changed();
    }
    return result;
  }

  /**
   * Check that today can be closed. Changes nothing.
   *
   * :param args: {expectedVersion}.
   * :return: The check result.
   */
  checkClose(args) {
    return this.book.checkClose(args);
  }

  /**
   * Close today's book.
   *
   * :param args: {expectedVersion}.
   * :return: The receipt, or {ok: false, reason, field}.
   */
  closeDay(args) {
    const result = this.book.closeDay(args);
    if (result.ok) {
      this.changed();
    }
    return result;
  }

  /**
   * Check an order list. Changes nothing.
   *
   * :param args: {supplier, lines, expectedVersion}.
   * :return: The check result.
   */
  checkOrderList(args) {
    return this.book.checkOrderList(args);
  }

  /**
   * Save an order list for the owner to send.
   *
   * :param args: {supplier, lines, expectedVersion}.
   * :return: The receipt, or {ok: false, reason, field}.
   */
  saveOrderList(args) {
    const result = this.book.saveOrderList(args);
    if (result.ok) {
      this.changed();
    }
    return result;
  }

  /** Throw the visitor's changes away and start again from the sample book. */
  reset() {
    this.book = new Book(null, this.now);
    this.changed();
  }
}

/** The one page object, shared by the page (view.js), site-actions.js and site.js. */
App.page = new App(typeof localStorage === "undefined" ? null : localStorage);
