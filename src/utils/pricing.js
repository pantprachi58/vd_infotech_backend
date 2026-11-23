/**
 * Package pricing — the server-side twin of the website's
 * frontend/src/lib/packages.js. The two MUST give the same numbers: the site
 * shows prices with its copy, and checkout charges with this one (a browser
 * never gets to say what it pays). Change the rules in both places.
 *
 *   INR      base x hike, rounded to ₹100, plus GST when tax is included.
 *   others   the package's USD list price converted at rate / USD rate,
 *            snapped to a clean step, plus intlTax when tax is included.
 *   period   a recurring price is the monthly price x the period's months;
 *            a one-time price ignores the period.
 */

const stepFor = (amount) => (amount < 1000 ? 5 : amount < 10000 ? 10 : 100);

const findCurrency = (settings, code) => settings.currencies.find((c) => c.code === code) ?? null;
const findPeriod = (settings, id) => settings.billingPeriods.find((b) => b.id === id) ?? null;
const priceFor = (pkg, planId) => pkg.prices?.find((p) => p.plan === planId) ?? null;

/** The tax-exclusive monthly (or one-time) list price, or null when the plan has none. */
function listPrice(settings, pkg, planId, currency) {
  // A plan without an INR base is quoted, not priced — in every currency.
  const price = priceFor(pkg, planId);
  if (price?.inrBase == null) return null;

  if (currency.code === "INR") {
    return Math.round((price.inrBase * settings.pricing.hike) / 100) * 100;
  }

  const usdRate = findCurrency(settings, "USD")?.rate;
  if (price.usd == null || !usdRate) return null;
  const converted = (price.usd * currency.rate) / usdRate;
  return Math.round(converted / stepFor(converted)) * stepFor(converted);
}

/** Same as the site's computePrice(): the displayed amount, in major units. */
export function computePrice(settings, pkg, planId, { currency, withTax, period }) {
  const fx = findCurrency(settings, currency);
  if (!fx) return null;
  const listed = listPrice(settings, pkg, planId, fx);
  if (listed == null) return null;

  const rate = fx.code === "INR" ? settings.pricing.gst : settings.pricing.intlTax;
  const monthly = withTax ? Math.round(listed * (1 + rate)) : listed;
  if (pkg.billingType === "one_time") return monthly;
  return monthly * (findPeriod(settings, period) ?? settings.billingPeriods[0]).months;
}

/**
 * Everything a checkout needs for one package / plan / period / currency:
 * net, tax and total in major and minor units, plus the gateway's interval.
 * Throws an Error with `status` 400 for an unknown plan, currency or period,
 * or a plan that is quoted rather than priced.
 */
export function quote(settings, pkg, { plan, currency = "INR", period, withTax = true }) {
  const fail = (message) => Object.assign(new Error(message), { status: 400 });

  const tier = settings.plans.find((p) => p.id === plan);
  if (!tier) throw fail(`Unknown plan "${plan}"`);
  const fx = findCurrency(settings, String(currency).toUpperCase());
  if (!fx) throw fail(`Unsupported currency "${currency}"`);

  const recurring = pkg.billingType !== "one_time";
  const cycle = recurring ? findPeriod(settings, period ?? settings.billingPeriods[0].id) : null;
  if (recurring && !cycle) throw fail(`Unknown billing period "${period}"`);

  const options = { currency: fx.code, period: cycle?.id };
  const net = computePrice(settings, pkg, plan, { ...options, withTax: false });
  if (net == null) throw fail(`${tier.label} is quoted on request for this package`);
  const total = withTax ? computePrice(settings, pkg, plan, { ...options, withTax: true }) : net;
  const taxRate = withTax ? (fx.code === "INR" ? settings.pricing.gst : settings.pricing.intlTax) : 0;
  const toMinor = (amount) => Math.round(amount * 10 ** (fx.minorUnits ?? 2));

  return {
    package: pkg.slug,
    plan: tier.id,
    planLabel: tier.label,
    billingType: pkg.billingType,
    period: cycle ? { id: cycle.id, label: cycle.label, months: cycle.months, ...gatewayInterval(cycle.months) } : null,
    currency: fx.code,
    withTax: Boolean(withTax),
    taxRate,
    taxLabel: fx.code === "INR" ? "GST" : "Tax",
    amount: { net, tax: total - net, total },
    amountMinor: { net: toMinor(net), tax: toMinor(total) - toMinor(net), total: toMinor(total) },
  };
}

/** A cycle length as gateways express it: 12 months → yearly x1, 3 → monthly x3. */
export function gatewayInterval(months) {
  return months % 12 === 0 ? { interval: "year", intervalCount: months / 12 } : { interval: "month", intervalCount: months };
}
