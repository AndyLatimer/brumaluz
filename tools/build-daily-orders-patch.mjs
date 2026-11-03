// The isolated 2026-10-27 supply patch is obsolete: accepted commissions require
// provenance, shared recipes and the complete reviewed server helpers.
export const DAILY_BRANCH_START="elsif p_action like 'order\\_%' escape '\\' or p_action='daily_order' then";
export const DAILY_BRANCH_END="elsif p_action='buy_recipe' then";
export const dailyOrderBranch=''; // Legacy imports must reach the explicit retirement message.
export function dailyOrdersPatch(){throw new Error('The supply-only patch is retired. Prepare the complete reviewed update with node tools/build-cozy-life-patch.mjs; no database is contacted.');}
