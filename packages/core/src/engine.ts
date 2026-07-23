import { createRandom, randomInteger, type RandomState } from "./random";

export const ENCOUNTER_COUNT = 6;
export const CONTENT_VERSION = 1;
export type Rarity = "common" | "uncommon" | "rare";
export type ItemCategory = "modifier" | "consumable";
export type EffectType =
  | "tagged-bonus"
  | "pair-amplifier"
  | "perfect-reward"
  | "sequence-learner"
  | "first-echo"
  | "high-risk"
  | "refresh-tiles"
  | "extra-selection"
  | "score-boost";

export interface ItemDefinition {
  readonly id: string;
  readonly category: ItemCategory;
  readonly name: string;
  readonly description: string;
  readonly rarity: Rarity;
  readonly weight: number;
  readonly basePrice: number;
  readonly effectType: EffectType;
  readonly parameters: Readonly<Record<string, number | string>>;
}

export const ITEM_DEFINITIONS: readonly ItemDefinition[] = Object.freeze([
  {
    id: "cyan-focus",
    category: "modifier",
    name: "Cyan Focus",
    description: "+10 per selected cyan tile",
    rarity: "common",
    weight: 5,
    basePrice: 10,
    effectType: "tagged-bonus",
    parameters: { tag: "cyan", amount: 10 },
  },
  {
    id: "pair-amplifier",
    category: "modifier",
    name: "Pair Amplifier",
    description: "Pair bonus ×1.5",
    rarity: "common",
    weight: 4,
    basePrice: 12,
    effectType: "pair-amplifier",
    parameters: { multiplier: 1.5 },
  },
  {
    id: "perfect-reward",
    category: "modifier",
    name: "Perfect Reward",
    description: "+5 currency when scoring 20 over target",
    rarity: "uncommon",
    weight: 3,
    basePrice: 14,
    effectType: "perfect-reward",
    parameters: { margin: 20, currency: 5 },
  },
  {
    id: "sequence-learner",
    category: "modifier",
    name: "Sequence Learner",
    description: "Sequences permanently grow a +3 bonus",
    rarity: "uncommon",
    weight: 3,
    basePrice: 15,
    effectType: "sequence-learner",
    parameters: { growth: 3 },
  },
  {
    id: "first-echo",
    category: "modifier",
    name: "First Echo",
    description: "Repeat the first tile's value",
    rarity: "rare",
    weight: 2,
    basePrice: 17,
    effectType: "first-echo",
    parameters: {},
  },
  {
    id: "high-risk",
    category: "modifier",
    name: "High Risk",
    description: "One fewer selection; final score ×2",
    rarity: "rare",
    weight: 2,
    basePrice: 18,
    effectType: "high-risk",
    parameters: { multiplier: 2 },
  },
  {
    id: "tile-refresh",
    category: "consumable",
    name: "Tile Refresh",
    description: "Replace this encounter's tiles",
    rarity: "common",
    weight: 4,
    basePrice: 7,
    effectType: "refresh-tiles",
    parameters: {},
  },
  {
    id: "limit-pulse",
    category: "consumable",
    name: "Limit Pulse",
    description: "+1 selection this encounter",
    rarity: "common",
    weight: 4,
    basePrice: 6,
    effectType: "extra-selection",
    parameters: { amount: 1 },
  },
  {
    id: "score-pulse",
    category: "consumable",
    name: "Score Pulse",
    description: "+15 score this encounter",
    rarity: "uncommon",
    weight: 3,
    basePrice: 8,
    effectType: "score-boost",
    parameters: { amount: 15 },
  },
]);

export interface OwnedItem {
  readonly instanceId: string;
  readonly definitionId: string;
  readonly storedValues: Readonly<Record<string, number>>;
  readonly disabled: boolean;
}
export interface Inventory {
  readonly modifiers: readonly OwnedItem[];
  readonly consumables: readonly OwnedItem[];
  readonly modifierCapacity: number;
  readonly consumableCapacity: number;
}
export interface ShopOffer {
  readonly id: string;
  readonly definitionId: string;
  readonly category: ItemCategory;
  readonly price: number;
}
export interface ShopState {
  readonly offers: readonly ShopOffer[];
  readonly rerollCount: number;
  readonly rerollPrice: number;
}
export type SpecialRule = "reduced-limit" | "cyan-penalty";
export interface PlayableTile {
  readonly id: string;
  readonly value: number;
  readonly tags: readonly string[];
}
export interface EncounterBrief {
  readonly id: string;
  readonly number: number;
  readonly target: number;
  readonly selectionLimit: number;
  readonly tiles: readonly PlayableTile[];
  readonly specialRule: SpecialRule | null;
  readonly temporaryScoreBonus: number;
}
export interface GameplaySignal {
  readonly type: string;
  readonly sourceId?: string;
  readonly tags: readonly string[];
  readonly values: Readonly<Record<string, number>>;
}
export interface EncounterReport {
  readonly encounterId: string;
  readonly score: number;
  readonly tags: readonly string[];
  readonly metrics: Readonly<Record<string, number>>;
  readonly signals: readonly GameplaySignal[];
}
export interface ScoreLine {
  readonly label: string;
  readonly operation: "add" | "multiply" | "subtract" | "final";
  readonly value: number;
  readonly sourceId?: string;
}
export type RunPhase =
  | "idle"
  | "encounter-ready"
  | "encounter-active"
  | "reward"
  | "shop"
  | "run-complete"
  | "run-failed"
  | "abandoned";
export interface RunState {
  readonly phase: RunPhase;
  readonly seed: number | null;
  readonly rng: RandomState;
  readonly encounterNumber: number;
  readonly currentEncounter: EncounterBrief | null;
  readonly currency: number;
  readonly inventory: Inventory;
  readonly shop: ShopState | null;
  readonly nextInstanceId: number;
  readonly nextOfferId: number;
  readonly lastReport: EncounterReport | null;
  readonly scoreBreakdown: readonly ScoreLine[];
}
export type RunCommand =
  | { readonly type: "start-run"; readonly seed: number }
  | { readonly type: "start-encounter" }
  | { readonly type: "submit-encounter"; readonly report: EncounterReport }
  | { readonly type: "enter-shop" }
  | { readonly type: "buy-offer"; readonly offerId: string }
  | { readonly type: "sell-item"; readonly instanceId: string }
  | { readonly type: "use-consumable"; readonly instanceId: string }
  | { readonly type: "reroll-shop" }
  | { readonly type: "leave-shop" }
  | { readonly type: "abandon-run" }
  | { readonly type: "advance" };
export type RunEvent =
  | { readonly type: "run-started"; readonly seed: number }
  | { readonly type: "encounter-prepared"; readonly brief: EncounterBrief }
  | { readonly type: "encounter-started"; readonly encounterId: string }
  | { readonly type: "special-rule-introduced"; readonly rule: SpecialRule }
  | {
      readonly type: "encounter-won" | "encounter-lost";
      readonly encounterId: string;
      readonly score: number;
      readonly target: number;
    }
  | {
      readonly type: "currency-awarded";
      readonly amount: number;
      readonly total: number;
    }
  | {
      readonly type: "shop-entered" | "shop-rerolled";
      readonly offers: readonly ShopOffer[];
      readonly cost?: number;
    }
  | {
      readonly type: "item-purchased";
      readonly offerId: string;
      readonly instance: OwnedItem;
    }
  | {
      readonly type: "item-sold";
      readonly instanceId: string;
      readonly amount: number;
    }
  | {
      readonly type: "consumable-used";
      readonly instanceId: string;
      readonly effectType: EffectType;
    }
  | {
      readonly type: "modifier-triggered";
      readonly instanceId: string;
      readonly label: string;
    }
  | {
      readonly type: "stored-value-increased";
      readonly instanceId: string;
      readonly value: number;
    }
  | { readonly type: "run-completed"; readonly currency: number }
  | { readonly type: "run-failed"; readonly encounterNumber: number }
  | { readonly type: "run-abandoned" }
  | {
      readonly type: "command-rejected";
      readonly command: RunCommand["type"];
      readonly phase: RunPhase;
      readonly reason: string;
    };
export interface TransitionResult {
  readonly state: RunState;
  readonly events: readonly RunEvent[];
}

const initialInventory = (): Inventory => ({
  modifiers: [],
  consumables: [
    {
      instanceId: "item-1",
      definitionId: "score-pulse",
      storedValues: {},
      disabled: false,
    },
  ],
  modifierCapacity: 4,
  consumableCapacity: 2,
});
export function createInitialRunState(): RunState {
  return {
    phase: "idle",
    seed: null,
    rng: createRandom(0),
    encounterNumber: 0,
    currentEncounter: null,
    currency: 0,
    inventory: initialInventory(),
    shop: null,
    nextInstanceId: 2,
    nextOfferId: 1,
    lastReport: null,
    scoreBreakdown: [],
  };
}
export function targetForEncounter(number: number): number {
  return 25 + number * 4;
}
export function specialRuleForEncounter(number: number): SpecialRule | null {
  return number === 3 ? "reduced-limit" : number === 6 ? "cyan-penalty" : null;
}
export function definitionFor(id: string): ItemDefinition | undefined {
  return ITEM_DEFINITIONS.find((item) => item.id === id);
}

function generateTiles(
  state: RandomState,
  number: number,
): { rng: RandomState; tiles: PlayableTile[] } {
  let rng = state;
  const tags = ["cyan", "amber", "violet"] as const;
  const values = [7, 8, 9, 10, 11, 12, 7, 8, 9, 10, 11, 12];
  for (let index = values.length - 1; index > 0; index--) {
    const swap = randomInteger(rng, 0, index);
    rng = swap.state;
    [values[index], values[swap.value]] = [values[swap.value]!, values[index]!];
  }
  const tiles: PlayableTile[] = [];
  for (let index = 0; index < 12; index++) {
    const tag = randomInteger(rng, 0, 2);
    rng = tag.state;
    tiles.push({
      id: `e${number}-t${index + 1}`,
      value: values[index]!,
      tags: [tags[tag.value]!],
    });
  }
  return { rng, tiles };
}
function prepareEncounter(
  state: RandomState,
  number: number,
  inventory: Inventory,
) {
  const generated = generateTiles(state, number);
  const rule = specialRuleForEncounter(number);
  const risk = inventory.modifiers.some(
    (x) => definitionFor(x.definitionId)?.effectType === "high-risk",
  );
  return {
    rng: generated.rng,
    brief: {
      id: `encounter-${number}`,
      number,
      target: targetForEncounter(number),
      selectionLimit: 5 - (risk ? 1 : 0) - (rule === "reduced-limit" ? 1 : 0),
      tiles: generated.tiles,
      specialRule: rule,
      temporaryScoreBonus: 0,
    } satisfies EncounterBrief,
  };
}
function weightedDefinition(state: RandomState): {
  rng: RandomState;
  definition: ItemDefinition;
} {
  const total = ITEM_DEFINITIONS.reduce((s, x) => s + x.weight, 0);
  const roll = randomInteger(state, 1, total);
  let cursor = roll.value;
  for (const item of ITEM_DEFINITIONS) {
    cursor -= item.weight;
    if (cursor <= 0) return { rng: roll.state, definition: item };
  }
  return { rng: roll.state, definition: ITEM_DEFINITIONS[0]! };
}
function generateShop(
  state: RandomState,
  nextOfferId: number,
): { rng: RandomState; offers: ShopOffer[]; nextOfferId: number } {
  let rng = state;
  const offers: ShopOffer[] = [];
  let id = nextOfferId;
  while (offers.length < 3) {
    const choice = weightedDefinition(rng);
    rng = choice.rng;
    if (offers.some((x) => x.definitionId === choice.definition.id)) continue;
    offers.push({
      id: `offer-${id++}`,
      definitionId: choice.definition.id,
      category: choice.definition.category,
      price: choice.definition.basePrice,
    });
  }
  return { rng, offers, nextOfferId: id };
}
function reject(
  state: Readonly<RunState>,
  command: RunCommand,
  reason: string,
): TransitionResult {
  return {
    state,
    events: [
      {
        type: "command-rejected",
        command: command.type,
        phase: state.phase,
        reason,
      },
    ],
  };
}

function resolveScore(
  state: Readonly<RunState>,
  report: EncounterReport,
): {
  score: number;
  inventory: Inventory;
  events: RunEvent[];
  lines: ScoreLine[];
} {
  let score = report.score;
  const lines: ScoreLine[] = [
    { label: "Gameplay score", operation: "add", value: score },
  ];
  const events: RunEvent[] = [];
  let modifiers = [...state.inventory.modifiers];
  for (const owned of modifiers) {
    const def = definitionFor(owned.definitionId);
    if (!def || owned.disabled) continue;
    let add = 0;
    if (def.effectType === "tagged-bonus")
      add =
        (report.metrics[String(def.parameters.tag)] ?? 0) *
        Number(def.parameters.amount);
    if (def.effectType === "first-echo") add = report.metrics.firstValue ?? 0;
    if (def.effectType === "sequence-learner") {
      add = owned.storedValues.bonus ?? 0;
      if (report.tags.includes("sequence")) {
        const value = add + Number(def.parameters.growth);
        modifiers = modifiers.map((x) =>
          x.instanceId === owned.instanceId
            ? { ...x, storedValues: { ...x.storedValues, bonus: value } }
            : x,
        );
        events.push({
          type: "stored-value-increased",
          instanceId: owned.instanceId,
          value,
        });
      }
    }
    if (add) {
      score += add;
      lines.push({
        label: def.name,
        operation: "add",
        value: add,
        sourceId: owned.instanceId,
      });
      events.push({
        type: "modifier-triggered",
        instanceId: owned.instanceId,
        label: def.name,
      });
    }
  }
  for (const owned of modifiers) {
    const def = definitionFor(owned.definitionId);
    if (!def || owned.disabled) continue;
    let multiplier = 1;
    if (def.effectType === "pair-amplifier" && report.tags.includes("pair"))
      multiplier = Number(def.parameters.multiplier);
    if (def.effectType === "high-risk")
      multiplier = Number(def.parameters.multiplier);
    if (multiplier !== 1) {
      score = Math.floor(score * multiplier);
      lines.push({
        label: def.name,
        operation: "multiply",
        value: multiplier,
        sourceId: owned.instanceId,
      });
      events.push({
        type: "modifier-triggered",
        instanceId: owned.instanceId,
        label: def.name,
      });
    }
  }
  if (state.currentEncounter?.temporaryScoreBonus) {
    score += state.currentEncounter.temporaryScoreBonus;
    lines.push({
      label: "Score Pulse",
      operation: "add",
      value: state.currentEncounter.temporaryScoreBonus,
    });
  }
  if (state.currentEncounter?.specialRule === "cyan-penalty") {
    const penalty = (report.metrics.cyan ?? 0) * 5;
    score -= penalty;
    lines.push({
      label: "Boss: cyan penalty",
      operation: "subtract",
      value: penalty,
    });
  }
  lines.push({ label: "Final score", operation: "final", value: score });
  return { score, inventory: { ...state.inventory, modifiers }, events, lines };
}

export function handle(
  state: Readonly<RunState>,
  command: RunCommand,
): TransitionResult {
  switch (command.type) {
    case "start-run": {
      if (!Number.isSafeInteger(command.seed))
        return reject(state, command, "Seed must be a safe integer");
      const seed = command.seed >>> 0;
      const inventory = initialInventory();
      const generated = prepareEncounter(createRandom(seed), 1, inventory);
      const next: RunState = {
        ...createInitialRunState(),
        phase: "encounter-ready",
        seed,
        rng: generated.rng,
        encounterNumber: 1,
        currentEncounter: generated.brief,
        currency: 10,
        inventory,
      };
      return {
        state: next,
        events: [
          { type: "run-started", seed },
          { type: "encounter-prepared", brief: generated.brief },
        ],
      };
    }
    case "start-encounter": {
      if (state.phase !== "encounter-ready" || !state.currentEncounter)
        return reject(state, command, "No prepared encounter is available");
      return {
        state: {
          ...state,
          phase: "encounter-active",
          lastReport: null,
          scoreBreakdown: [],
        },
        events: [
          ...(state.currentEncounter.specialRule
            ? [
                {
                  type: "special-rule-introduced",
                  rule: state.currentEncounter.specialRule,
                } as const,
              ]
            : []),
          { type: "encounter-started", encounterId: state.currentEncounter.id },
        ],
      };
    }
    case "submit-encounter": {
      if (state.phase !== "encounter-active" || !state.currentEncounter)
        return reject(state, command, "An active encounter is required");
      if (command.report.encounterId !== state.currentEncounter.id)
        return reject(
          state,
          command,
          "Report does not match the active encounter",
        );
      const resolved = resolveScore(state, command.report);
      if (resolved.score < state.currentEncounter.target)
        return {
          state: {
            ...state,
            phase: "run-failed",
            inventory: resolved.inventory,
            lastReport: { ...command.report, score: resolved.score },
            scoreBreakdown: resolved.lines,
          },
          events: [
            ...resolved.events,
            {
              type: "encounter-lost",
              encounterId: state.currentEncounter.id,
              score: resolved.score,
              target: state.currentEncounter.target,
            },
            { type: "run-failed", encounterNumber: state.encounterNumber },
          ],
        };
      let reward = 10 + state.encounterNumber * 2;
      for (const owned of resolved.inventory.modifiers) {
        const def = definitionFor(owned.definitionId);
        if (
          def?.effectType === "perfect-reward" &&
          resolved.score >=
            state.currentEncounter.target + Number(def.parameters.margin)
        ) {
          reward += Number(def.parameters.currency);
          resolved.events.push({
            type: "modifier-triggered",
            instanceId: owned.instanceId,
            label: def.name,
          });
        }
      }
      const total = state.currency + reward;
      const complete = state.encounterNumber === ENCOUNTER_COUNT;
      return {
        state: {
          ...state,
          phase: complete ? "run-complete" : "reward",
          currency: total,
          inventory: resolved.inventory,
          lastReport: { ...command.report, score: resolved.score },
          scoreBreakdown: resolved.lines,
        },
        events: [
          ...resolved.events,
          {
            type: "encounter-won",
            encounterId: state.currentEncounter.id,
            score: resolved.score,
            target: state.currentEncounter.target,
          },
          { type: "currency-awarded", amount: reward, total },
          ...(complete
            ? [{ type: "run-completed", currency: total } as const]
            : []),
        ],
      };
    }
    case "enter-shop": {
      if (state.phase !== "reward")
        return reject(state, command, "A won encounter reward is required");
      const generated = generateShop(state.rng, state.nextOfferId);
      const shop = { offers: generated.offers, rerollCount: 0, rerollPrice: 5 };
      return {
        state: {
          ...state,
          phase: "shop",
          rng: generated.rng,
          shop,
          nextOfferId: generated.nextOfferId,
          currentEncounter: null,
        },
        events: [{ type: "shop-entered", offers: shop.offers }],
      };
    }
    case "reroll-shop": {
      if (state.phase !== "shop" || !state.shop)
        return reject(state, command, "An open shop is required");
      if (state.currency < state.shop.rerollPrice)
        return reject(state, command, "Insufficient currency");
      const generated = generateShop(state.rng, state.nextOfferId);
      const cost = state.shop.rerollPrice;
      const shop = {
        offers: generated.offers,
        rerollCount: state.shop.rerollCount + 1,
        rerollPrice: cost + 2,
      };
      return {
        state: {
          ...state,
          currency: state.currency - cost,
          rng: generated.rng,
          shop,
          nextOfferId: generated.nextOfferId,
        },
        events: [{ type: "shop-rerolled", offers: shop.offers, cost }],
      };
    }
    case "buy-offer": {
      if (state.phase !== "shop" || !state.shop)
        return reject(state, command, "An open shop is required");
      const offer = state.shop.offers.find((x) => x.id === command.offerId);
      if (!offer) return reject(state, command, "Offer was not found");
      if (state.currency < offer.price)
        return reject(state, command, "Insufficient currency");
      const list =
        offer.category === "modifier"
          ? state.inventory.modifiers
          : state.inventory.consumables;
      const capacity =
        offer.category === "modifier"
          ? state.inventory.modifierCapacity
          : state.inventory.consumableCapacity;
      if (list.length >= capacity)
        return reject(state, command, "Inventory is full");
      const instance = {
        instanceId: `item-${state.nextInstanceId}`,
        definitionId: offer.definitionId,
        storedValues: {},
        disabled: false,
      };
      const inventory = {
        ...state.inventory,
        [offer.category === "modifier" ? "modifiers" : "consumables"]: [
          ...list,
          instance,
        ],
      };
      return {
        state: {
          ...state,
          currency: state.currency - offer.price,
          inventory,
          nextInstanceId: state.nextInstanceId + 1,
          shop: {
            ...state.shop,
            offers: state.shop.offers.filter((x) => x.id !== offer.id),
          },
        },
        events: [{ type: "item-purchased", offerId: offer.id, instance }],
      };
    }
    case "sell-item": {
      if (state.phase !== "shop")
        return reject(state, command, "Items can only be sold in the shop");
      const owned = [
        ...state.inventory.modifiers,
        ...state.inventory.consumables,
      ].find((x) => x.instanceId === command.instanceId);
      if (!owned) return reject(state, command, "Item was not found");
      const def = definitionFor(owned.definitionId)!;
      const amount = Math.floor(def.basePrice / 2);
      return {
        state: {
          ...state,
          currency: state.currency + amount,
          inventory: {
            ...state.inventory,
            modifiers: state.inventory.modifiers.filter(
              (x) => x.instanceId !== owned.instanceId,
            ),
            consumables: state.inventory.consumables.filter(
              (x) => x.instanceId !== owned.instanceId,
            ),
          },
        },
        events: [{ type: "item-sold", instanceId: owned.instanceId, amount }],
      };
    }
    case "use-consumable": {
      if (state.phase !== "encounter-ready" || !state.currentEncounter)
        return reject(
          state,
          command,
          "Consumables are used before an encounter starts",
        );
      const owned = state.inventory.consumables.find(
        (x) => x.instanceId === command.instanceId,
      );
      if (!owned) return reject(state, command, "Consumable was not found");
      const def = definitionFor(owned.definitionId)!;
      let rng = state.rng;
      let encounter = state.currentEncounter;
      if (def.effectType === "refresh-tiles") {
        const generated = generateTiles(rng, state.encounterNumber);
        rng = generated.rng;
        encounter = { ...encounter, tiles: generated.tiles };
      } else if (def.effectType === "extra-selection")
        encounter = {
          ...encounter,
          selectionLimit:
            encounter.selectionLimit + Number(def.parameters.amount),
        };
      else if (def.effectType === "score-boost")
        encounter = {
          ...encounter,
          temporaryScoreBonus:
            encounter.temporaryScoreBonus + Number(def.parameters.amount),
        };
      else return reject(state, command, "Item is not a consumable");
      return {
        state: {
          ...state,
          rng,
          currentEncounter: encounter,
          inventory: {
            ...state.inventory,
            consumables: state.inventory.consumables.filter(
              (x) => x.instanceId !== owned.instanceId,
            ),
          },
        },
        events: [
          {
            type: "consumable-used",
            instanceId: owned.instanceId,
            effectType: def.effectType,
          },
        ],
      };
    }
    case "leave-shop":
    case "advance": {
      if (
        state.phase !== "shop" &&
        !(command.type === "advance" && state.phase === "reward")
      )
        return reject(state, command, "An open shop is required");
      const number = state.encounterNumber + 1;
      const generated = prepareEncounter(state.rng, number, state.inventory);
      return {
        state: {
          ...state,
          phase: "encounter-ready",
          rng: generated.rng,
          encounterNumber: number,
          currentEncounter: generated.brief,
          shop: null,
          lastReport: null,
          scoreBreakdown: [],
        },
        events: [{ type: "encounter-prepared", brief: generated.brief }],
      };
    }
    case "abandon-run": {
      if (state.phase === "idle" || state.phase === "abandoned")
        return reject(state, command, "No run is active");
      return {
        state: { ...createInitialRunState(), phase: "abandoned" },
        events: [{ type: "run-abandoned" }],
      };
    }
    default:
      return assertNever(command);
  }
}
function assertNever(value: never): never {
  throw new Error(`Unhandled command: ${JSON.stringify(value)}`);
}
