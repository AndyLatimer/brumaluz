/** Materials made by a profession have their own workshop silhouette. */
export function craftingComponentDrawing(id:string):string|null {
 if(!id.startsWith('componente_'))return null;
 const job=id.slice(11,-2),ink='#65503b',light='#ecdbb1';
 const art:Record<string,string>={
  herreria:'<path fill="#a1adb0" d="m3 13 5-7 12 1 2 8-6 5-13-1Z"/><path fill="#c7d0cb" d="m3 13 13 1 6-7-14-1Z"/><path d="m16 14 0 6M6 15l7 1"/>',
  peleteria:'<path fill="#ac8058" d="m3 8 7-4 11 4-2 12-8 2-9-6Z"/><path fill="#d1ae7b" d="m3 8 8 5 10-5-11-4Z"/><path d="m11 13 0 9m-7-9 5 3m5 1 4-2"/>',
  sastreria:'<path fill="#b5a6b8" d="m3 8 7-5 12 5-3 13H7Z"/><path fill="#d7c8d8" d="m3 8 12 3 7-3-12-5Z"/><path d="m8 12 10 3m-9 1 8 2"/><path fill="#c5a368" d="M3 10h3v11H3Z"/>',
  carpinteria:'<path fill="#b88e59" d="m3 10 13-6 6 4v5L8 21l-5-4Z"/><path fill="#d8bb86" d="m3 10 5 5 14-7-6-4Z"/><path d="m8 15 0 6m3-5 9-5m-9-3 5-2"/>',
  ebanisteria:'<path fill="#b58b59" d="M4 4h15v5H9v12H4Z"/><path fill="#d6b77d" d="M9 9h10v4H9Z"/><path d="M6 6h11M6 11v8"/><path fill="#9d9f91" d="m12 16 9-3 1 3-9 4Z"/>',
  joyeria:'<path fill="none" stroke="#c2a161" stroke-width="3" d="M9 6a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm8 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z"/><path fill="#9ebbbb" d="m8 2 4 4-4 4-4-4Z"/>',
  alquimia:'<path fill="#9db59c" d="M8 3h6v6l6 9-3 4H5l-2-4 6-9Z"/><path fill="#778b62" d="M6 15h12l1 3-3 3H6l-2-3Z"/><path fill="#b18b59" d="M7 2h8v4H7Z"/><path d="m10 9-4 8" stroke="#f8efd8"/>',
  encantamiento:'<path fill="#d4bd8f" d="M5 3h15v17H5q-3-1-3-3V6q0-3 3-3Z"/><path fill="#ac94b9" d="m12 7 2 4 4 1-4 2-2 4-2-4-4-2 4-1Z"/><path d="M5 3v14H2"/>',
  cocina:'<path fill="#b08c5a" d="M2 12h20l-3 9H5Z"/><path fill="#d9c68e" d="M3 12q1-8 9-8t9 8Z"/><path d="m8 8 1 3m4-5 1 5m4-3-1 3" stroke="#f5dfae"/>',
 };
 return art[job]?`<ellipse cx="12" cy="21" rx="9" ry="1.3" fill="#58422c" opacity=".17"/><g stroke="${ink}" stroke-width=".8" stroke-linecap="round" stroke-linejoin="round">${art[job]}</g><path d="M5 22h14" stroke="${light}" stroke-width=".5"/>`:null;
}
