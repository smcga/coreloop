import { effectDefinitions, resolveSignalBatch } from "../effects/transaction";
import { validateEffectDefinitions } from "../effects";
import { FrameworkError } from "../errors";
import { policyReferences } from "../policies";
import {
  EMPTY_CONFIGURATION,
  createInitialRunState,
  definitionFor,
  handleCommand,
} from "./lifecycle";
import type {
  RunCommand,
  RunConfiguration,
  RunState,
  TransitionResult,
} from "./contracts";

export {
  CONTENT_VERSION,
  createInitialRunState,
  definitionFor,
} from "./lifecycle";
export type * from "./contracts";

export function createRunEngine(configuration: RunConfiguration) {
  if (!configuration.policies)
    throw new FrameworkError(
      "invalid-policy",
      "createRunEngine requires an explicit policy set",
    );
  const effectErrors = validateEffectDefinitions(
    effectDefinitions(configuration, "core:validation"),
    configuration.effectHandlers,
  );
  if (effectErrors.length)
    throw new FrameworkError("unknown-custom-handler", effectErrors.join("; "));
  const references = Object.values(policyReferences(configuration.policies));
  if (new Set(references.map(({ id }) => id)).size !== references.length)
    throw new FrameworkError(
      "duplicate-id",
      "Each run policy role requires a distinct policy",
    );
  const providers = configuration.shopProviders ?? [];
  if (
    providers.some(
      (provider) =>
        !provider.id.includes(":") ||
        !Number.isSafeInteger(provider.version) ||
        provider.version < 1,
    )
  )
    throw new FrameworkError(
      "invalid-policy",
      "Shop provider IDs must be namespaced and versions must be positive integers",
    );
  if (
    new Set(providers.map((provider) => provider.id)).size !== providers.length
  )
    throw new FrameworkError(
      "duplicate-id",
      "Shop provider IDs must be unique",
    );
  const handleConfigured = (
    state: Readonly<RunState>,
    command: RunCommand,
  ): TransitionResult => handle(state, command, configuration);
  return {
    createInitialState: () => createInitialRunState(configuration),
    handle: handleConfigured,
    definitionFor: (id: string) => definitionFor(id, configuration),
    policyReferences: policyReferences(configuration.policies),
    configuration,
  } as const;
}
/** Runs a command and then resolves its lifecycle facts through the same effect queue. */
export function handle(
  state: Readonly<RunState>,
  command: RunCommand,
  configuration: RunConfiguration = EMPTY_CONFIGURATION,
): TransitionResult {
  const primary = handleCommand(state, command, configuration);
  if (
    primary.state === state ||
    primary.events.some((event) => event.type === "command-rejected")
  )
    return primary;
  if (
    command.type === "submit-encounter" ||
    command.type === "store-gameplay-session"
  )
    return sequenceEvents(primary);
  const signals: {
    type: string;
    sourceId: string;
    values: Record<string, number>;
  }[] = primary.events.flatMap((event) => {
    if (
      event.type === "effect-runtime" ||
      event.type === "shop-candidate-rejected"
    )
      return [];
    const values: Record<string, number> = {};
    if (event.type === "currency-awarded") values.amount = event.amount;
    if (event.type === "item-sold") values.amount = event.amount;
    return [{ type: event.type, sourceId: "core:lifecycle", values }];
  });
  const currencyChange = primary.state.currency - state.currency;
  if (currencyChange !== 0)
    signals.push({
      type: currencyChange > 0 ? "currency-gained" : "currency-spent",
      sourceId: "core:economy",
      values: { amount: Math.abs(currencyChange) },
    });
  if (!signals.length) return sequenceEvents(primary);
  const priorModifier = primary.state.effects.priceModifier;
  const resolved = resolveSignalBatch(
    primary.state,
    signals,
    configuration,
    primary.state.lastReport?.score ?? 0,
    primary.state.currentEncounter?.target ?? 0,
  );
  const priceDelta = resolved.state.effects.priceModifier - priorModifier;
  const nextState =
    priceDelta !== 0 && resolved.state.shop
      ? {
          ...resolved.state,
          shop: {
            ...resolved.state.shop,
            offers: resolved.state.shop.offers.map((offer) => ({
              ...offer,
              price: Math.max(0, Math.round(offer.price + priceDelta)),
            })),
          },
        }
      : resolved.state;
  return sequenceEvents({
    state: nextState,
    events: [
      ...primary.events,
      ...resolved.events.map((fact) => ({
        type: "effect-runtime" as const,
        fact,
      })),
    ],
  });
}

function sequenceEvents(result: TransitionResult): TransitionResult {
  let sequence = result.state.effects.nextEventSequence;
  const events = result.events.map((event) => ({
    ...event,
    sequence: sequence++,
  }));
  return {
    state: {
      ...result.state,
      effects: { ...result.state.effects, nextEventSequence: sequence },
    },
    events,
  };
}
