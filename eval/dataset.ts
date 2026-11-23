/**
 * Labeled change scenarios. `expectedFiles` is the ground-truth set of files a
 * human reviewer would expect to be flagged (direct changes + clear downstream
 * impact), used to compute precision / recall against the tool's predictions.
 */
export interface EvalCase {
  id: string;
  fixture: string; // key into fixtures
  changeRequest: string;
  expectedFiles: string[];
}

export const dataset: EvalCase[] = [
  // shop
  {
    id: "shop-coupon-pct",
    fixture: "shop",
    changeRequest: "Add percentage-based discount coupons to checkout",
    expectedFiles: ["src/checkout/coupon.ts", "src/checkout/cart.ts"],
  },
  {
    id: "shop-math-add-sig",
    fixture: "shop",
    changeRequest: "Change the signature of the add() function in math utils to accept an array of numbers",
    expectedFiles: ["src/utils/math.ts", "src/checkout/coupon.ts"],
  },
  {
    id: "shop-tax",
    fixture: "shop",
    changeRequest: "Add VAT tax calculation to orders",
    expectedFiles: ["src/checkout/tax.ts", "src/index.ts"],
  },
  {
    id: "shop-rename-cart",
    fixture: "shop",
    changeRequest: "Rename the Cart class to ShoppingCart",
    expectedFiles: ["src/checkout/cart.ts", "src/index.ts"],
  },

  // auth
  {
    id: "auth-jwt",
    fixture: "auth",
    changeRequest: "Switch from session cookies to JWT bearer tokens for authentication",
    expectedFiles: ["src/auth/token.ts", "src/auth/session.ts", "src/auth/login.ts", "src/middleware.ts"],
  },
  {
    id: "auth-refresh",
    fixture: "auth",
    changeRequest: "Add token expiry and a refresh flow",
    expectedFiles: ["src/auth/token.ts", "src/auth/login.ts"],
  },
  {
    id: "auth-profile-guard",
    fixture: "auth",
    changeRequest: "Require authentication on the profile route",
    expectedFiles: ["src/routes/profile.ts", "src/middleware.ts"],
  },
  {
    id: "auth-logout",
    fixture: "auth",
    changeRequest: "Add a logout function that destroys the session",
    expectedFiles: ["src/auth/login.ts", "src/auth/session.ts"],
  },

  // api
  {
    id: "api-pagination",
    fixture: "api",
    changeRequest: "Add pagination to the list users endpoint",
    expectedFiles: ["src/handlers/users.ts", "src/models/user.ts"],
  },
  {
    id: "api-user-email",
    fixture: "api",
    changeRequest: "Add an email field to the User model",
    expectedFiles: ["src/models/user.ts"],
  },
  {
    id: "api-delete-user",
    fixture: "api",
    changeRequest: "Add a DELETE user endpoint",
    expectedFiles: ["src/handlers/users.ts", "src/router.ts", "src/models/user.ts"],
  },
  {
    id: "api-db-pool",
    fixture: "api",
    changeRequest: "Change the query() helper in db to be async and return a promise",
    expectedFiles: ["src/db.ts", "src/models/user.ts"],
  },

  // ui
  {
    id: "ui-button-loading",
    fixture: "ui",
    changeRequest: "Add a loading spinner state to the Button component",
    expectedFiles: ["src/components/Button.ts"],
  },
  {
    id: "ui-modal-confirm",
    fixture: "ui",
    changeRequest: "Add a confirm variant to the Modal component",
    expectedFiles: ["src/components/Modal.ts"],
  },
  {
    id: "ui-button-prop",
    fixture: "ui",
    changeRequest: "Change the Button to take a props object instead of a label string",
    expectedFiles: ["src/components/Button.ts", "src/components/Modal.ts", "src/App.ts"],
  },

  // events
  {
    id: "events-once",
    fixture: "events",
    changeRequest: "Add a once() method to the emitter that removes the handler after the first call",
    expectedFiles: ["src/emitter.ts"],
  },
  {
    id: "events-wildcard",
    fixture: "events",
    changeRequest: "Add wildcard '*' event support to the emitter",
    expectedFiles: ["src/emitter.ts"],
  },
];
