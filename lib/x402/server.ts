import {
  HTTPFacilitatorClient,
  x402HTTPResourceServer,
  x402ResourceServer,
} from "@x402/core/server";
import type { RouteConfig } from "@x402/core/server";
import type { Network } from "@x402/core/types";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { bazaarResourceServerExtension } from "@x402/extensions/bazaar";
import {
  X402_FACILITATOR_URL,
  X402_NETWORK,
  X402_NETWORK_CANONICAL,
  X402_NETWORK_FULL,
} from "./config";

const facilitatorClient = new HTTPFacilitatorClient({
  url: X402_FACILITATOR_URL,
});

export const x402Server = new x402ResourceServer(facilitatorClient);

// Register the AVM exact scheme under every spelling of the network id we might
// see: the truncated CAIP-2 constant from @x402/avm, the full genesis-hash form
// the facilitator advertises, and whatever X402_NETWORK overrides it to.
// Registration is unconditional by design -- never guard it behind an env check.
const avmScheme = new ExactAvmScheme();
for (const network of new Set([
  X402_NETWORK,
  X402_NETWORK_FULL,
  X402_NETWORK_CANONICAL,
])) {
  x402Server.register(network as Network, avmScheme);
}

// Enriches each route's declared discovery block with the real HTTP method
// before it goes out in the 402 body. Without this the Bazaar entry is incomplete.
x402Server.registerExtension(bazaarResourceServerExtension);

/**
 * Builds an HTTP resource server that knows the route's real path.
 *
 * withX402 registers its config under the wildcard "*", which makes the Bazaar
 * entry advertise a routeTemplate of ":var1" instead of the actual endpoint.
 * Registering an explicit "METHOD /path" pattern keeps the catalog accurate.
 */
export function httpServerForRoute(
  pattern: string,
  routeConfig: RouteConfig
): x402HTTPResourceServer {
  return new x402HTTPResourceServer(x402Server, { [pattern]: routeConfig });
}
