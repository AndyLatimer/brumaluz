// The encounter is taught through its animation and the existing action bar.
// Keep these hooks for story/session compatibility without adding tutorial UI.
export function resetCombatTutorial() {}
export function noteTutorialAction(_action: 'attack' | 'skill', _damage: number, _healing: number) {}
export function tickCombatTutorial() {}