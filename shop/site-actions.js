// Registers the shop book's operations with the agent runtime.
// agent-manifest.json loads this module through "actions.module". Every name in
// "actions.agentTools" becomes a model tool called website_<name>.
//
// Each action wraps a method of App.page, the object the page's own form uses, so the
// agent and the form follow one set of rules. Every change to the book is marked
// "irreversible": the browser shows the visitor the exact entries and asks before
// anything is saved, and a saved entry is corrected with a new entry, never deleted.
import { App } from "./book.js";

/**
 * Describes the book's operations as actions the agents can call.
 */
class SiteActions {
  /**
   * Register every site action with the runtime.
   *
   * :param actions: The runtime registry facade with a register(definition) method.
   */
  static registerActions(actions) {
    actions.register(SiteActions.readBookAction());
    actions.register(SiteActions.reportAction());
    actions.register(SiteActions.saveEntriesAction());
    actions.register(SiteActions.saveOrderListAction());
    actions.register(SiteActions.closeDayAction());
  }

  /** The read action: the whole book as the page shows it. */
  static readBookAction() {
    return {
      name: "read_book",
      description: "Read the shop book: shop, today's date, open or closed, version, stock with ids, local names, prices and amounts on hand, today's entries and totals, cash from the book, who owes the shop, and recent order lists.",
      effect: "read",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      execute: () => App.page.getState(),
    };
  }

  /** The report action: totals over a period. */
  static reportAction() {
    return {
      name: "get_report",
      description: "Totals worked out from the book for one period: sales, cash and credit sales, cost of sales, gross profit, expenses, profit after expenses, debt payments, stock bought, top items and each day's sales and expenses. Changes nothing.",
      effect: "read",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["period"],
        properties: {
          period: { type: "string", enum: App.reportPeriods(), description: "The period to total." },
        },
      },
      execute: (args) => App.page.report(args.period),
    };
  }

  /** The entry action: save sales, expenses, stock in and debt payments. */
  static saveEntriesAction() {
    return {
      name: "save_entries",
      description: "Save one or more entries in today's book. The visitor sees the entries and confirms first. Returns the saved lines, or ok false with the reason.",
      effect: "irreversible",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["entries", "expectedVersion"],
        properties: {
          expectedVersion: { type: "integer", minimum: 0, description: "version from website_read_book, read in this turn." },
          entries: {
            type: "array",
            minItems: 1,
            maxItems: 12,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["kind"],
              properties: {
                kind: { type: "string", enum: ["sale", "expense", "stock_in", "debt_payment"], description: "sale: goods sold. expense: money spent on the business. stock_in: goods bought for the shelves. debt_payment: a customer paying what they owe." },
                itemId: { type: "string", enum: App.itemIds(), description: "Stock item id from website_read_book (sale, stock_in)." },
                quantity: { type: "integer", minimum: 1, maximum: 1000, description: "How many (sale, stock_in)." },
                unitPrice: { type: "integer", minimum: 1, maximum: 100000, description: "Selling price each in whole shillings, only when the owner gave one (sale). Leave out to use the list price." },
                unitCost: { type: "integer", minimum: 1, maximum: 100000, description: "Cost each in whole shillings, only when the owner gave one (stock_in)." },
                customer: { type: "string", maxLength: 60, description: "Customer's name as the owner wrote it (credit sale, debt_payment; optional for a paid sale)." },
                paid: { type: "boolean", description: "False when the customer took the goods on credit (sale). Default true." },
                category: { type: "string", enum: App.expenseCategories(), description: "Expense category (expense)." },
                amount: { type: "integer", minimum: 1, maximum: 1000000, description: "Whole shillings (expense, debt_payment)." },
                note: { type: "string", maxLength: 120, description: "Short note in the owner's words (expense)." },
              },
            },
          },
        },
      },
      execute: (args) => App.page.saveEntries(args),
    };
  }

  /** The order-list action: keep a supplier order list for the owner to send. */
  static saveOrderListAction() {
    return {
      name: "save_order_list",
      description: "Save an order list for a supplier in the book, with the supplier's prices, for the owner to send. It sends nothing and pays nothing. The visitor confirms first.",
      effect: "irreversible",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["supplier", "lines", "expectedVersion"],
        properties: {
          supplier: { type: "string", minLength: 1, maxLength: 80, description: "The supplier's name." },
          expectedVersion: { type: "integer", minimum: 0, description: "version from website_read_book, read in this turn." },
          lines: {
            type: "array",
            minItems: 1,
            maxItems: 8,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["itemId", "quantity", "unitPrice"],
              properties: {
                itemId: { type: "string", enum: App.itemIds(), description: "Stock item id from website_read_book." },
                quantity: { type: "integer", minimum: 1, maximum: 1000, description: "How many to order." },
                unitPrice: { type: "integer", minimum: 1, maximum: 100000, description: "The supplier's price each, in whole shillings, from the supplier's answer." },
              },
            },
          },
        },
      },
      execute: (args) => App.page.saveOrderList(args),
    };
  }

  /** The close action: close today's book. */
  static closeDayAction() {
    return {
      name: "close_day",
      description: "Close today's book with its totals. After this, nothing more can be saved for today. The visitor confirms first.",
      effect: "irreversible",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["expectedVersion"],
        properties: {
          expectedVersion: { type: "integer", minimum: 0, description: "version from website_read_book, read in this turn." },
        },
      },
      execute: (args) => App.page.closeDay(args),
    };
  }
}

// The runtime calls the module's registerActions export.
export const registerActions = SiteActions.registerActions;
