export const NPC_BADGE_ID = /^[a-z][a-z0-9_-]{0,63}$/;
export const NPC_TYPES = {
  debug: { drawing: '<path d="m8 3 2 3m6-3-2 3M8 9h8v7a4 4 0 0 1-8 0Zm0 3H4m16 0h-4M8 16H3m18 0h-5M8 19l-3 3m11-3 3 3M12 10v10M9 9V8a3 3 0 0 1 6 0v1"/>' },
  merchant: { drawing: '<path d="M3 10h18l-2-7H5zM5 10v11h14V10M9 21v-7h6v7M3 10c0 4 5 4 5 0 0 4 8 4 8 0 0 4 5 4 5 0"/>' },
  resident: { drawing: '<path d="m3 11 9-8 9 8M5 9v12h14V9M9 21v-7h6v7"/>' },
  trainer: {drawing:'<path d="M3 5q5-2 9 1 4-3 9-1v15q-5-2-9 1-4-3-9-1ZM12 6v15M6 10h3m-3 4h3m6-4h3m-3 4h3"/>'},
  hostile: { drawing: '<path d="M4 13c0-5 3-9 8-9s8 4 8 9-3 8-8 8-8-3-8-8Zm4-2 2 2m6-2-2 2m-5 4h6"/>' },
} as const;
export type NpcType = keyof typeof NPC_TYPES;
