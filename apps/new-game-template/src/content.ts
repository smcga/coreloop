/** Replace this small teaching catalogue; framework implementation stays in workspace packages. */
export const starterContent = {
  modifiers: ["steady-hand", "bold-choice", "second-thought", "collector"],
  consumables: ["retry", "boost"],
  attachment: "starter:polished",
  specialRules: ["starter:limited-choice", "starter:rising-target"],
  loadouts: ["starter:balanced", "starter:bold"],
  reward: "starter:choice-reward",
  shop: "starter:main-pool",
} as const;
export const starterCustomEffectId = "starter:bank-last-choice";
export const starterCustomPolicyId = "starter:short-schedule";
