import type { Race } from './data';

/** Shared by the creator and named residents. These are names, never biographies or titles. */
export const NAME_PARTS: Record<Race, [string[], string[]]> = {
  humano: [
    ['Al', 'Ber', 'Cor', 'Dar', 'El', 'Gar', 'Is', 'Mar', 'Rod', 'Tor', 'Ali', 'Ro',
      'Ada', 'Ald', 'Ama', 'An', 'Ar', 'Bel', 'Bri', 'Cal', 'Car', 'Cel', 'Cla', 'Dami',
      'Ed', 'Eli', 'Em', 'Er', 'Est', 'Fab', 'Fel', 'Flor', 'Ga', 'Gil', 'Hel', 'Iri',
      'Jul', 'Le', 'Leo', 'Lis', 'Lor', 'Lu', 'Mal', 'Mer', 'Ner', 'Nor', 'Ol', 'Ori',
      'Or', 'Os', 'Per', 'Rai', 'Ren', 'Ros', 'Sal', 'Sel', 'Sil', 'Te', 'Val', 'Vir'],
    ['ric', 'an', 'ina', 'mundo', 'wen', 'eth', 'iel', 'do', 'berto', 'lia', 'sa',
      'a', 'al', 'aldo', 'anda', 'ante', 'ardo', 'asio', 'avia', 'ela', 'elio', 'ena',
      'enio', 'era', 'eria', 'ero', 'esa', 'eta', 'iana', 'icio', 'ida', 'ila', 'ilo',
      'inda', 'ino', 'ira', 'isa', 'ita', 'ito', 'ivia', 'lan', 'lina', 'lio', 'ma',
      'mina', 'mir', 'na', 'nela', 'nelo', 'nio', 'ona', 'ora', 'oro', 'osa', 'osio',
      'rico', 'rina', 'rino', 'sia', 'tina', 'tino', 'vina', 'vio'],
  ],
  elfo: [
    ['Ae', 'Ela', 'Fae', 'Gal', 'Ith', 'Lae', 'Syl', 'Thal', 'Ny', 'Ara',
      'Ael', 'Ari', 'Aur', 'Bel', 'Cael', 'Cele', 'Dael', 'Dae', 'Eir', 'Eli', 'Eri',
      'Fael', 'Fia', 'Fira', 'Gael', 'Gala', 'Gwen', 'Hae', 'Ila', 'Il', 'Iri',
      'Isil', 'Lia', 'Lir', 'Lora', 'Lua', 'Lys', 'Mael', 'Meli', 'Mira', 'Myr',
      'Nae', 'Nim', 'Nira', 'Oriel', 'Rae', 'Rhi', 'Sael', 'Sere', 'Shae', 'Sila',
      'Sira', 'Tael', 'Tiri', 'Vael', 'Vela', 'Vira', 'Yla', 'Yri', 'Zae'],
    ['driel', 'lindra', 'rion', 'wyn', 'thas', 'nora', 'vael', 'neth', 'lia',
      'a', 'ael', 'alas', 'anor', 'ara', 'arel', 'aria', 'arin', 'ath', 'athil',
      'dal', 'dan', 'del', 'dil', 'dir', 'dor', 'ea', 'el', 'ela', 'elis', 'en',
      'ena', 'erel', 'eth', 'ia', 'iel', 'ien', 'il', 'ina', 'ion', 'ira', 'is',
      'ith', 'la', 'lan', 'las', 'len', 'lil', 'lin', 'lith', 'lor', 'lune',
      'mir', 'na', 'nal', 'nel', 'nia', 'nor', 'ra', 'rel', 'ria', 'ril', 'rin',
      'sa', 'sel', 'sil', 'thel', 'thil', 'tir', 'wen'],
  ],
  lagto: [
    ["Sss'", 'Ka', 'Zith', 'Ish', 'Tol', 'Xa', 'Rek', 'Ssa',
      'Ak', 'Ar', 'Ash', 'Az', 'Ba', 'Bek', 'Dar', 'Daz', 'Drek', 'Ek', 'Ez',
      'Gek', 'Gor', 'Har', 'Haz', 'Ik', 'Ir', 'Iss', 'Jar', 'Jaz', 'Kes', 'Kez',
      'Kha', 'Khoz', 'Kri', 'Kro', 'Ksa', 'Lak', 'Maz', 'Nak', 'Nek', 'Or', 'Ras',
      'Raz', 'Res', 'Rik', 'Sak', 'Sek', 'Sha', 'Shoz', 'Sik', 'Skar', 'Sko',
      'Tak', 'Tar', 'Tek', 'Thar', 'Tik', 'Tza', 'Vak', 'Var', 'Vek', 'Zar', 'Zek', 'Zor'],
    ["'ra", 'ssik', 'tek', "'li", 'zar', 'ko', 'thiss',
      'ak', 'ar', 'ash', 'az', 'dak', 'dar', 'dek', 'dra', 'ek', 'esh', 'ez',
      'gar', 'gath', 'gik', 'ik', 'ir', 'ish', 'iss', 'ith', 'ka', 'kar', 'kash',
      'kat', 'kez', 'kir', 'kor', 'kri', 'lak', 'lar', 'lek', 'lik', 'lok',
      'nak', 'nar', 'nek', 'nik', 'rak', 'ras', 'rek', 'rik', 'rok', 'sa', 'sak',
      'sar', 'sek', 'sha', 'shik', 'sir', 'ska', 'sok', 'tak', 'tar', 'tash',
      'thak', 'thar', 'tik', 'tir', 'tok', 'vak', 'var', 'vek', 'zar', 'zik', 'zor'],
  ],
  pelso: [
    ['Mi', 'Nu', 'Pi', 'Ro', 'Ca', 'Mo', 'Tis', 'Lu', 'Fe',
      'Ami', 'Bai', 'Be', 'Bi', 'Bo', 'Cha', 'Chi', 'Ci', 'Clo', 'Da', 'Di',
      'Du', 'Eli', 'Fa', 'Fi', 'Fio', 'Fu', 'Gi', 'Gu', 'Ha', 'Hi', 'Iri', 'Ji',
      'Ju', 'Kai', 'Ki', 'Ko', 'La', 'Le', 'Li', 'Lo', 'Lumi', 'Mai', 'Ma', 'Me',
      'Mia', 'Miu', 'Na', 'Ne', 'Ni', 'No', 'Nui', 'Pa', 'Pe', 'Po', 'Pru', 'Pu',
      'Re', 'Ri', 'Ru', 'Sa', 'Se', 'Si', 'So', 'Su', 'Tai', 'Ta', 'Te', 'Ti',
      'To', 'Tu', 'Va', 'Vi', 'Ya', 'Yi', 'Yu', 'Za', 'Zi', 'Zu'],
    ['sha', 'ru', 'lo', 'mi', 'ki', 'fu', 'sia', 'nya', 'rra',
      'ba', 'bel', 'bi', 'bo', 'ca', 'cha', 'chi', 'cho', 'da', 'di', 'do',
      'fa', 'fei', 'fi', 'fo', 'ga', 'gi', 'go', 'la', 'lei', 'li', 'lia', 'lil',
      'lin', 'lina', 'lira', 'lisa', 'lita', 'lona', 'luma', 'luna', 'ma', 'mei',
      'mia', 'mila', 'mira', 'mo', 'mu', 'na', 'nei', 'ni', 'nia', 'nila', 'nira',
      'no', 'nu', 'pa', 'pi', 'po', 'ra', 'rei', 'ri', 'ria', 'rila', 'rina',
      'ro', 'sa', 'sei', 'si', 'so', 'su', 'ta', 'tei', 'ti', 'to', 'ya', 'yi', 'yo'],
  ],
};

/** Every possible name remains valid for character creation (3–16 letters/apostrophes). */
export function combineName(first: string, last: string) {
  return (first + last).replace(/'{2,}/g, "'");
}
export function namePool(race: Race): readonly string[] {
  const [first, last] = NAME_PARTS[race];
  return [...new Set(first.flatMap(a => last.map(b => combineName(a, b))))].filter(name => /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]{3,16}$/.test(name));
}
