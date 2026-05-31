export interface GameConfig {
  // Run Progression Scaling
  roomScalingHpMultiplierPerRoom: number;    // % HP increase per room explored
  roomScalingDmgMultiplierPerRoom: number;   // % Damage increase per room explored
  contaminationSpeedMultiplierMax: number;   // Max speed multiplier at 100% contamination

  // Reward Scaling
  depthRewardScoreMultiplierPerRoom: number; // Score bonus scaling factor per room explored
  depthRewardExpMultiplierPerRoom: number;   // EXP bonus scaling factor per room explored
  equipmentLevelMultiplierRate: number;      // Rate at which weapon upgrades scale by room depth
  weaponDamageScalePerLevel: number;         // Damage increase multiplier per weapon level

  // Build Balance: Heavy Crusher (Breaker)
  breakerWallSlamDamage: number;             // Base wall slam damage for Breaker mace
  nonBreakerWallSlamDamage: number;          // Base wall slam damage for other builds
  heavyImpactWallSlamMultiplier: number;     // Multiplier when heavy_impact upgrade is active

  // Build Balance: Swift Striker (Striker)
  strikerDashInvulnDurationMs: number;       // Duration of invincibility during dash for Striker

  // Build Balance: Cartographer (Cartographer)
  baseExpansionStaminaCost: number;          // Stamina cost for expanding a room
  cartographerExpansionCostMultiplier: number; // Expansion cost multiplier for Cartographer

  // Build Balance: Guardian (Guardian)
  guardianDamageReductionMultiplier: number; // Damage taken multiplier for Guardian build
  
  // Game Cooldowns & Recovery
  baseStaminaRegenRate: number;              // Base stamina recovered per second
  staminaFlowRegenMultiplier: number;        // Stamina flow upgrade multiplier
  staminaFlowAttackCostMultiplier: number;   // Stamina flow attack cost multiplier
  baseDashStaminaCost: number;               // Stamina cost to dash
}

export const gameConfig: GameConfig = {
  roomScalingHpMultiplierPerRoom: 0.04,      // +4% enemy HP per explored room
  roomScalingDmgMultiplierPerRoom: 0.03,     // +3% enemy damage per explored room
  contaminationSpeedMultiplierMax: 0.75,     // Up to +75% enemy speed at 100% contamination

  depthRewardScoreMultiplierPerRoom: 0.06,   // +6% gold/score rewards per room depth
  depthRewardExpMultiplierPerRoom: 0.05,     // +5% EXP rewards per room depth
  equipmentLevelMultiplierRate: 0.15,        // Deeper rooms yield higher weapon upgrades
  weaponDamageScalePerLevel: 0.12,           // +12% weapon damage per level

  breakerWallSlamDamage: 24,                 // Breaker mace deals massive wall slam damage
  nonBreakerWallSlamDamage: 12,              // Standard wall slam damage
  heavyImpactWallSlamMultiplier: 1.6,        // 60% extra slam damage with Heavy Impact upgrade

  strikerDashInvulnDurationMs: 160,          // Invincible for the entire 160ms dash duration

  baseExpansionStaminaCost: 15,              // Standard room expansion cost
  cartographerExpansionCostMultiplier: 0.4,  // Only costs 6 stamina (60% off) for Cartographer

  guardianDamageReductionMultiplier: 0.65,   // 35% damage reduction (takes 65% damage)

  baseStaminaRegenRate: 18,
  staminaFlowRegenMultiplier: 1.4,
  staminaFlowAttackCostMultiplier: 0.9,
  baseDashStaminaCost: 20
};
