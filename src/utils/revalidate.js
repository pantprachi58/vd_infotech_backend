import { env } from "../config/env.js";

/**
 * Tells the Next.js site to drop one tag of cached data ("blog", "packages")
 * so an edit shows up at once rather than after the site's 60-second
 * revalidation window. Fire and forget: a site that is down must never fail
 * an API write.
 */
export function revalidateFrontend(tag = "blog") {
  if (!env.revalidateUrl || !env.revalidateSecret) return;

  fetch(env.revalidateUrl, {
    method: "POST",
    headers: { "content-type": "application/json", "x-revalidate-secret": env.revalidateSecret },
    body: JSON.stringify({ tag }),
    signal: AbortSignal.timeout(5000),
  })
    .then((res) => {
      if (!res.ok) console.warn(`Frontend revalidation (${tag}) returned ${res.status}`);
    })
    .catch((err) => console.warn(`Frontend revalidation (${tag}) failed: ${err.message}`));
}
