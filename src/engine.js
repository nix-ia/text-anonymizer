'use strict';

/* =============================================================
 * Text Anonymizer
 * Everything runs in this browser tab. No network request is ever
 * made, and the mapping table is kept in memory only: it disappears
 * on reload unless the user exports it as JSON.
 * ============================================================= */

/* ---------------------------------------------------------------
 * 1. Labels and reference data
 * ------------------------------------------------------------- */

const LABELS = {
  EMAIL: 'EMAIL',
  PHONE: 'TELEPHONE',
  PERSON: 'PERSONNE',
  ORG: 'SOCIETE',
  ADDRESS: 'ADRESSE',
  CITY: 'VILLE',
  IBAN: 'IBAN',
  CARD: 'CARTE',
  NIR: 'NIR',
  COMPANY_ID: 'IDENTIFIANT',
  IP: 'IP',
  MAC: 'MAC',
  URL: 'URL',
  DATE: 'DATE',
  SECRET: 'SECRET',
  PLATE: 'IMMATRICULATION',
  CUSTOM: 'TERME',
};

// Toggles shown in the options panel, in display order.
const TYPE_OPTIONS = [
  { key: 'EMAIL', label: 'Adresses e-mail', on: true },
  { key: 'PHONE', label: 'Numéros de téléphone', on: true },
  { key: 'PERSON', label: 'Noms de personnes (titre ou prénom connu)', on: true },
  { key: 'PERSON_LOOSE', label: 'Noms propres (mode large, plus de faux positifs)', on: false },
  { key: 'ORG', label: 'Sociétés / organisations', on: true },
  { key: 'ADDRESS', label: 'Adresses postales', on: true },
  { key: 'CITY', label: 'Code postal + ville', on: true },
  { key: 'IBAN', label: 'IBAN', on: true },
  { key: 'CARD', label: 'Cartes bancaires', on: true },
  { key: 'NIR', label: 'Numéros de sécurité sociale', on: true },
  { key: 'COMPANY_ID', label: 'SIRET / SIREN / TVA / RCS', on: true },
  { key: 'IP', label: 'Adresses IP', on: true },
  { key: 'MAC', label: 'Adresses MAC', on: true },
  { key: 'URL', label: 'URLs', on: true },
  { key: 'SECRET', label: 'Mots de passe, jetons, clés d’API', on: true },
  { key: 'PLATE', label: 'Plaques d’immatriculation', on: true },
  { key: 'DATE', label: 'Dates', on: false },
];

// Common French first names — the main signal for person detection.
const FIRST_NAMES = [
  'Adrien','Agathe','Alain','Albert','Alexandra','Alexandre','Alexis','Alice','Alicia','Amandine',
  'Amélie','Anaïs','André','Andréa','Angélique','Anne','Antoine','Arnaud','Arthur','Astrid',
  'Aurélie','Aurélien','Axel','Baptiste','Bastien','Benjamin','Benoît','Bernard','Bertrand','Brigitte',
  'Bruno','Camille','Carine','Caroline','Catherine','Cédric','Céline','Charles','Charlotte','Chloé',
  'Christelle','Christian','Christophe','Claire','Claude','Clara','Clément','Colette','Corinne','Cyril',
  'Damien','Daniel','David','Delphine','Denis','Didier','Dominique','Dorian','Édouard','Élodie',
  'Élise','Éliane','Emma','Emmanuel','Émilie','Enzo','Éric','Estelle','Étienne','Eva',
  'Fabien','Fabrice','Fanny','Florence','Florent','Florian','Francis','François','Françoise','Frédéric',
  'Gabriel','Gaël','Gaëlle','Geneviève','Georges','Gérard','Gilbert','Gilles','Grégory','Guillaume',
  'Guy','Gwenaëlle','Hélène','Henri','Hugo','Inès','Irène','Isabelle','Jacques','Jean',
  'Jeanne','Jérémy','Jérôme','Joël','Johan','Jonathan','Jordan','Joseph','Josette','Juliette',
  'Julie','Julien','Justine','Karim','Karine','Kevin','Laetitia','Laurence','Laurent','Léa',
  'Léo','Léon','Lilou','Line','Lise','Lorenzo','Louis','Louise','Luc','Lucas',
  'Lucie','Ludovic','Madeleine','Maël','Magali','Manon','Marc','Marceau','Marcel','Margaux',
  'Marie','Marine','Marion','Martin','Martine','Mathieu','Mathilde','Mathis','Maud','Maxime',
  'Mélanie','Mélissa','Michel','Michèle','Mickaël','Mohamed','Monique','Morgane','Nadia','Nadine',
  'Nathalie','Nathan','Nicolas','Noémie','Nolan','Olivier','Oscar','Pascal','Pascale','Patrice',
  'Patrick','Paul','Pauline','Philippe','Pierre','Quentin','Rachel','Raphaël','Raymond','Rémi',
  'Renaud','René','Richard','Robert','Romain','Romane','Roland','Sabine','Samir','Samuel',
  'Sandra','Sandrine','Sarah','Sébastien','Serge','Séverine','Simon','Sophie','Stéphane','Stéphanie',
  'Sylvain','Sylvie','Thibault','Thierry','Thomas','Timothée','Tom','Valentin','Valérie','Vanessa',
  'Véronique','Victor','Vincent','Virginie','Xavier','Yann','Yannick','Yasmine','Yves','Zoé',
];

// Capitalised words that must never be taken for a surname on their own.
const STOPWORDS = new Set([
  'Le','La','Les','Un','Une','Des','Du','De','Ce','Cet','Cette','Ces','Mon','Ma','Mes','Notre','Nos',
  'Votre','Vos','Leur','Leurs','Son','Sa','Ses','Je','Tu','Il','Elle','On','Nous','Vous','Ils','Elles',
  'Bonjour','Bonsoir','Salut','Merci','Cordialement','Sincèrement','Objet','Suite','Pour','Par','Avec',
  'Sans','Dans','Sur','Sous','Après','Avant','Depuis','Pendant','Lors','Afin','Donc','Mais','Car','Or',
  'Ni','Et','Ou','Si','Quand','Comme','Voici','Voilà','Cependant','Toutefois','Ainsi','Alors','Enfin',
  'Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche',
  'Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre',
  'Madame','Monsieur','Mademoiselle','Docteur','Maître','Cher','Chère','Chers','Bien','Très','Tous','Toute',
  'Ainsi','Aucun','Autre','Même','Plus','Moins','Tout','Rien','Tant','Trop','Peu','Beaucoup',
]);

/* ---------------------------------------------------------------
 * 2. Small helpers
 * ------------------------------------------------------------- */

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripAccents(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Unicode-safe word boundaries: \b only knows ASCII, which breaks on "Émile".
const UB_START = '(?<![\\p{L}\\p{N}_])';
const UB_END = '(?![\\p{L}\\p{N}_])';

function luhnValid(digits) {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

function ibanValid(raw) {
  const iban = raw.replace(/[\s-]/g, '').toUpperCase();
  if (iban.length < 15 || iban.length > 34) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    const part = code >= 65 && code <= 90 ? String(code - 55) : ch;
    if (!/^\d+$/.test(part)) return false;
    for (const digit of part) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

function ipv4Valid(value) {
  const host = value.split('/')[0];
  const parts = host.split('.');
  return parts.length === 4 && parts.every((p) => p.length <= 3 && Number(p) <= 255);
}

/* ---------------------------------------------------------------
 * 3. Detectors
 * Each one yields candidate spans; overlaps are resolved by priority
 * then by length, so an IBAN always wins over a phone number.
 * ------------------------------------------------------------- */

const firstNameAlt = FIRST_NAMES.slice()
  .sort((a, b) => b.length - a.length)
  .map(escapeRegExp)
  .join('|');

// Every quantifier below is bounded: an unbounded run such as [\p{L}'-]+ makes
// the engine rescan the same characters from each start position (quadratic),
// which freezes the page on a long paste.
const NAME_WORD = "\\p{Lu}[\\p{L}'’-]{1,40}";
// Dots only inside a word ("S.A"), so a sentence end ("Conseil. Admin") never
// glues the next sentence onto the name.
const ORG_WORD = "\\p{Lu}[\\p{L}\\p{N}&'’-]{0,40}(?:\\.[\\p{L}\\p{N}&'’-]{1,40}){0,5}";
const PARTICLE = '(?:de|du|des|la|le|van|von|der|di|el|al)';

// Words inside a name are separated by ONE space or hyphen, never by a newline
// or a run of spaces, so unrelated fragments are not glued into one "name".
const SP = '[ \\u00a0]';
const SEP_NAME = '(?:' + SP + '|-)';
const NAME_TAIL = '(?:(?:' + SP + PARTICLE + ')+' + SP + NAME_WORD + '|' + SEP_NAME + NAME_WORD + '){0,2}';

// A number must not be the tail of a longer one, but a sentence-final period
// ("appelle le 06 12 34 56 78.") must not disqualify it.
const NUM_START = '(?<!\\d)(?<!\\d\\.)';
const NUM_END = '(?!\\d)(?!\\.\\d)';

const TITLES = 'M\\.|MM\\.|Mme|Mmes|Mlle|Dr|Pr|Me|Monsieur|Madame|Mademoiselle|Docteur|Ma[iî]tre|Professeur';
const ORG_PREFIX = 'SARL|S\\.A\\.R\\.L\\.|SASU|SAS|EURL|SCI|SCOP|GIE|[Ss]oci[ée]t[ée]|[Ee]ntreprise|[Cc]abinet|[Gg]roupe|[Aa]ssociation|[Ff]ondation';
const ORG_SUFFIX = 'SARL|SASU|SAS|SA|EURL|SCI|GmbH|Ltd|LLC|Corp\\.?|Inc\\.?';
// Next word of an organisation name, possibly after "&" or a particle
// ("Cabinet Durand & Associés", "Association Les Amis du Vieux Lyon").
const ORG_LINK = '(?:' + SP + '+(?:(?:&|' + PARTICLE + ')' + SP + '+)?' + ORG_WORD + ')';
const STREET_KIND = 'rue|avenue|av\\.|boulevard|bd|impasse|allée|allee|chemin|route|place|quai|cours|square|résidence|residence|lotissement|villa|passage|sentier';
// Street name: whole words only (no punctuation), at most 5, stopping at a
// function word or at a postal code so the rest of the sentence and the city
// are left to their own detectors.
const STREET_WORD = "[\\p{L}\\p{N}'’-]{1,40}";
const STREET_STOP = '(?:et|ou|à|pour|car|mais|où|qui|que|puis|donc|dans|avec|sans|est|sont|il|elle|je|nous|vous|on)';
const STREET_NAME = STREET_WORD +
  '(?:' + SP + '(?!' + STREET_STOP + '(?![\\p{L}\\p{N}_]))(?!\\d{5}(?!\\d))' + STREET_WORD + '){0,4}';
const SECRET_LABEL = "mot[ ]de[ ]passe|mdp|password|passwd|pwd|passphrase|token|jeton|api[ _-]?key|cl[ée][ ]d['’]?API|cl[ée][ ]API|client[ _-]?secret|secret";
// Well-known credential shapes: OpenAI/Anthropic, GitHub, AWS, Slack, JWT, Bearer.
const TOKEN_SHAPES = [
  'sk-[A-Za-z0-9_-]{16,200}',
  'gh[pousr]_[A-Za-z0-9]{30,100}',
  'github_pat_[A-Za-z0-9_]{22,200}',
  'AKIA[0-9A-Z]{16}',
  'xox[baprs]-[A-Za-z0-9-]{10,200}',
  'eyJ[A-Za-z0-9_-]{8,2000}\\.[A-Za-z0-9_-]{8,2000}\\.[A-Za-z0-9_-]{8,2000}',
].join('|');
const PLATE_LETTER = '[A-HJ-NP-TV-Z]';
const MONTHS = 'janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre';

const DETECTORS = [
  {
    type: 'SECRET', priority: 99, group: 1,
    exact: true, // a password may end with "!" or "."
    regex: new RegExp('\\b(?:' + SECRET_LABEL + ')[ \\t]*[:=][ \\t]*([^\\s"\'<>]{4,200})', 'gi'),
  },
  {
    type: 'SECRET', priority: 98,
    regex: new RegExp('(?<![A-Za-z0-9_-])(?:(?:Bearer[ ]+)?(?:' + TOKEN_SHAPES + '))(?![A-Za-z0-9_-])', 'g'),
  },
  {
    type: 'IBAN', priority: 95,
    regex: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,3})?\b/gi,
    validate: ibanValid,
  },
  {
    type: 'COMPANY_ID', priority: 92, group: 1,
    // Exact shapes, not "digits and spaces": a loose class swallows the numbers
    // that follow. SIREN = 9 digits, SIRET = 14, VAT = country code + 8-12 chars.
    regex: /\b(?:SIRET|SIREN|RCS|TVA(?:[ \t]+intracommunautaire)?|N°[ \t]*TVA)[ \t]*(?:n°|numéro|:|=)?[ \t]*((?:(?:FR|BE|DE|ES|IT|LU|NL|GB|CH|PT|AT|IE)[ ]?[A-Z0-9]{2}[ .]?\d{3}[ .]?\d{3}[ .]?\d{3}|\d{3}[ .]?\d{3}[ .]?\d{3}(?:[ .]?\d{5})?)(?!\d))/gi,
  },
  {
    type: 'CARD', priority: 90,
    regex: new RegExp(NUM_START + '(?:\\d[ -]?){12,18}\\d' + NUM_END, 'g'),
    // Luhn, or the unmistakable "1234 5678 9012 3456" layout (a mistyped card
    // number is still sensitive).
    validate: (v) => {
      const digits = v.replace(/\D/g, '');
      if (digits.length < 13 || digits.length > 19) return false;
      return luhnValid(digits) || /^\d{4}([ -])\d{4}\1\d{4}\1\d{4}$/.test(v);
    },
  },
  {
    type: 'NIR', priority: 88,
    regex: /(?<!\d)[12][ . ]?\d{2}[ . ]?(?:0[1-9]|1[0-2])[ . ]?(?:\d{2}|2[AB])[ . ]?\d{3}[ . ]?\d{3}(?:[ . ]?\d{2})?(?!\d)/gi,
    validate: (v) => v.replace(/[^\dAB]/gi, '').length >= 13,
  },
  {
    type: 'EMAIL', priority: 80,
    // The lookbehind lets a match start only at the beginning of a run of
    // local-part characters, keeping the scan linear on long strings.
    regex: /(?<![A-Za-z0-9._%+'-])[A-Za-z0-9._%+'-]{1,254}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){0,8}\.[A-Za-z]{2,24}/g,
  },
  {
    type: 'URL', priority: 75,
    regex: /\b(?:https?:\/\/|www\.)[^\s<>"'()[\]{}]+/gi,
  },
  {
    type: 'MAC', priority: 70,
    regex: /\b[0-9a-f]{2}(?:[:-][0-9a-f]{2}){5}\b/gi,
  },
  {
    type: 'IP', priority: 68,
    regex: new RegExp(NUM_START + '(?:\\d{1,3}\\.){3}\\d{1,3}(?:\\/\\d{1,2})?' + NUM_END, 'g'),
    validate: ipv4Valid,
  },
  {
    type: 'IP', priority: 67,
    regex: /\b(?:[0-9a-f]{1,4}:){4,7}[0-9a-f]{1,4}\b/gi,
    validate: (v) => v.includes(':') && !/^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/i.test(v),
  },
  {
    type: 'IP', priority: 66,
    // Compressed IPv6 ("2001:db8::1"). A digit and two groups are required so
    // that code such as "std::vector" or "a::b" is left alone.
    regex: /(?<![\w:])(?:[0-9a-f]{1,4}:){1,6}:(?:[0-9a-f]{1,4}(?::[0-9a-f]{1,4}){0,5})?(?![\w:])/gi,
    validate: (v) => v.includes('::') && /\d/.test(v) && v.split(':').filter(Boolean).length >= 2,
  },
  {
    type: 'PHONE', priority: 64,
    // International numbers in any layout: "+44 20 7946 0958", "+1 (555) 123-4567".
    regex: /(?<![A-Za-z0-9+])\+\d{1,3}(?:[ .\u00a0-]?\(?\d{1,4}\)?){2,5}(?!\d)/g,
    validate: (v) => {
      const digits = v.replace(/\D/g, '');
      return digits.length >= 8 && digits.length <= 15 && (v.split('(').length === v.split(')').length);
    },
  },
  {
    type: 'PHONE', priority: 65,
    regex: new RegExp(
      NUM_START + '(?:(?:\\+|00)\\d{1,3}[ .\\u00a0-]?(?:\\(0\\)[ .\\u00a0-]?)?)?0?[1-9](?:[ .\\u00a0-]?\\d{2}){4}' + NUM_END,
      'g'
    ),
    validate: (v) => {
      const digits = v.replace(/\D/g, '');
      return digits.length >= 9 && digits.length <= 15;
    },
  },
  {
    type: 'ADDRESS', priority: 60,
    regex: new RegExp(
      '\\b\\d{1,4}(?:' + SP + '*(?:bis|ter|quater))?,?' + SP + '+(?:' + STREET_KIND + ')' + SP + '+' + STREET_NAME,
      'giu'
    ),
  },
  {
    type: 'PLATE', priority: 58,
    regex: new RegExp('\\b' + PLATE_LETTER + '{2}[- ]\\d{3}[- ]' + PLATE_LETTER + '{2}\\b', 'g'),
  },
  {
    type: 'CITY', priority: 55,
    regex: new RegExp(
      '\\b\\d{5}' + SP + '+' + NAME_WORD + '(?:' + SP + '(?:' + PARTICLE + SP + ')?' + NAME_WORD + '){0,3}' + UB_END,
      'gu'
    ),
  },
  {
    type: 'PERSON', priority: 50, group: 1,
    regex: new RegExp(UB_START + '(?:' + TITLES + ')' + SP + '+((?:' + PARTICLE + SP + '+)?' + NAME_WORD + NAME_TAIL + ')', 'gu'),
  },
  {
    type: 'PERSON', priority: 48,
    regex: new RegExp(UB_START + '(?=\\p{Lu})(?:' + firstNameAlt + ')' + NAME_TAIL + UB_END, 'gu'),
    // "Bonjour Claude," addresses the assistant, not a person to protect.
    validate: (v) => v !== 'Claude',
  },
  {
    type: 'PERSON', toggle: 'PERSON_LOOSE', priority: 45,
    regex: new RegExp(UB_START + NAME_WORD + SEP_NAME + NAME_WORD + UB_END, 'gu'),
    validate: (v) => v.split(/[\s-]+/).every((w) => !STOPWORDS.has(w)),
  },
  {
    type: 'ORG', priority: 42,
    regex: new RegExp(UB_START + '(?:' + ORG_PREFIX + ')' + SP + '+' + ORG_WORD + ORG_LINK + '{0,4}', 'gu'),
  },
  {
    type: 'ORG', priority: 41,
    regex: new RegExp(
      UB_START + ORG_WORD + '(?:' + SP + '+' + ORG_WORD + '){0,2}' + SP + '+(?:' + ORG_SUFFIX + ')' + UB_END,
      'gu'
    ),
  },
  {
    type: 'DATE', priority: 30,
    regex: new RegExp(
      '\\b(?:\\d{1,2}[\\/.-]\\d{1,2}[\\/.-]\\d{2,4}|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}(?:er)?' + SP + '+(?:' + MONTHS + ')' + SP + '+\\d{4})\\b',
      'gi'
    ),
  },
];

/* ---------------------------------------------------------------
 * 4. Pseudonym generation
 * ------------------------------------------------------------- */

const POOL = {
  PERSON: [
    'Camille Fontaine', 'Lucas Meyer', 'Sarah Bonnet', 'Thomas Ravel', 'Léa Marchand',
    'Hugo Delacroix', 'Nina Berger', 'Paul Lambert', 'Iris Chevalier', 'Noah Perrin',
    'Alba Riviere', 'Elias Garnier', 'Jade Mercier', 'Milan Faure', 'Olga Vasseur',
    'Simon Delattre', 'Nora Lemoine', 'Victor Aubry', 'Lena Pasquier', 'Ivan Sorel',
  ],
  ORG: [
    'Acme Solutions', 'Novatek', 'Orbitech', 'Cerisier Industries', 'Delta Nord',
    'Pyxis Group', 'Meridian Labs', 'Solvea', 'Kairos Systems', 'Alpaga Conseil',
  ],
  CITY: [
    '00000 Villeneuve', '00000 Saint-Clair', '00000 Beaumont', '00000 Rochefort',
    '00000 Montverne', '00000 Clairval', '00000 Fontaines', '00000 Prévert',
  ],
};

function pickFromPool(pool, n) {
  const base = pool[(n - 1) % pool.length];
  const round = Math.floor((n - 1) / pool.length);
  return round === 0 ? base : base + ' ' + (round + 1);
}

function padNum(n, len) {
  return String(n).padStart(len, '0');
}

function realisticPseudonym(type, n) {
  switch (type) {
    case 'PERSON':
      return pickFromPool(POOL.PERSON, n);
    case 'ORG':
      return pickFromPool(POOL.ORG, n);
    case 'CITY':
      return pickFromPool(POOL.CITY, n);
    case 'EMAIL': {
      const slug = stripAccents(pickFromPool(POOL.PERSON, n)).toLowerCase().replace(/\s+/g, '.');
      return slug + '@exemple.fr';
    }
    case 'PHONE':
      return '06 ' + String(10000000 + n * 1237).slice(-8).match(/.{2}/g).join(' ');
    case 'IP':
      return '10.0.' + (Math.floor((n - 1) / 254) % 256) + '.' + (((n - 1) % 254) + 1);
    case 'MAC':
      return '00:00:5e:00:' + padNum((((n - 1) >> 8) & 255).toString(16), 2) + ':' + padNum(((n - 1) & 255).toString(16), 2);
    case 'URL':
      return 'https://exemple-' + n + '.invalid/page';
    case 'ADDRESS':
      return n + ' rue des Acacias';
    case 'IBAN':
      return 'FR76 0000 0000 0000 0000 ' + padNum(n, 4) + ' 00';
    case 'CARD':
      return '4000 0000 0000 ' + padNum(n, 4);
    case 'NIR':
      return '1 99 01 99 999 ' + padNum(n, 3);
    case 'COMPANY_ID':
      return '000 000 ' + padNum(n, 3);
    case 'PLATE':
      return 'AA-' + padNum(n, 3) + '-AA';
    default:
      return null; // fall back to a bracket placeholder
  }
}

/* ---------------------------------------------------------------
 * 5. State
 * ------------------------------------------------------------- */

const state = {
  mode: 'placeholder',
  enabled: new Set(TYPE_OPTIONS.filter((t) => t.on).map((t) => t.key)),
  mapping: new Map(), // pseudonym -> { type, value, key }
  index: new Map(),   // "TYPE\u0000normalised value" -> pseudonym
  counters: Object.create(null), // type -> last number used
  exported: true,     // false as soon as the table changes after an export
};

// Key used to recognise "the same value" written in different ways.
function normalizeValue(type, value) {
  const collapsed = value.replace(/\s+/g, ' ').trim();
  switch (type) {
    case 'EMAIL':
    case 'URL':
    case 'MAC':
      return collapsed.toLowerCase();
    case 'IBAN':
    case 'CARD':
    case 'PHONE':
    case 'NIR':
    case 'COMPANY_ID':
    case 'PLATE':
      return collapsed.replace(/[\s.-]/g, '').toUpperCase();
    default:
      return collapsed;
  }
}

/* ---------------------------------------------------------------
 * Bracket pseudonyms: "[PERSONNE_1]"
 * A model may reformat them, so they are recognised tolerantly:
 *   [PERSONNE_1]  [ personne 1 ]  [PERSONNE-1]  [PERSONNE\_1]  PERSONNE_1
 * A bare "PERSONNE 1" (space, no brackets, no underscore) is deliberately NOT
 * restored: it is ordinary French ("Adresse 1", "Personne 2") and replacing it
 * would silently insert a wrong value.
 * ------------------------------------------------------------- */

const BRACKET_PSEUDO = /^\[([A-Z][A-Z_]*)_(\d+)\]$/;
const SEP_LOOSE = '(?:\\\\?_|[ -])?';   // inside brackets: _  \_  space  hyphen  or nothing
const SEP_BARE = '\\\\?_';              // without brackets: an underscore is required
const NOT_AFTER_WORD = '(?<![\\p{L}\\p{N}_])';
const NOT_BEFORE_WORD = '(?![\\p{L}\\p{N}_])';

function labelPattern(label, sep) {
  return label.split('_').map(escapeRegExp).join(sep);
}

function labelKey(text) {
  return text.replace(/[\\_ -]/g, '').toUpperCase();
}

// One regex for every bracket-style pseudonym whose label is in `labels`.
// Groups: 1/2 = label/number when bracketed, 3/4 = label/number when bare.
function bracketRegex(labels) {
  if (!labels.size) return null;
  const sorted = [...labels].sort((a, b) => b.length - a.length);
  const loose = sorted.map((l) => labelPattern(l, SEP_LOOSE)).join('|');
  const bare = sorted.map((l) => labelPattern(l, SEP_BARE)).join('|');
  return new RegExp(
    '\\[[ ]*(' + loose + ')' + SEP_LOOSE + '(\\d+)(?!\\d)[ ]*\\]|' +
    NOT_AFTER_WORD + '(' + bare + ')' + SEP_BARE + '(\\d+)(?!\\d)',
    'giu'
  );
}

function matchKey(m) {
  return labelKey(m[1] ?? m[3]) + '#' + Number(m[2] ?? m[4]);
}

// Same shapes as bracketRegex, but blind to what surrounds them. Replacing a
// neighbouring value changes the surroundings ("6467PERSONNE_3" becomes
// "[CARTE_1]PERSONNE_3"), so a literal that looked harmless in the source can
// look like a pseudonym in the output. Over-reserving only skips a number.
function reservedRegex(labels) {
  const sorted = [...labels].sort((a, b) => b.length - a.length);
  const loose = sorted.map((l) => labelPattern(l, SEP_LOOSE)).join('|');
  const bare = sorted.map((l) => labelPattern(l, SEP_BARE)).join('|');
  return new RegExp(
    '\\[[ ]*(' + loose + ')' + SEP_LOOSE + '(\\d+)[ ]*\\]|(' + bare + ')' + SEP_BARE + '(\\d+)',
    'giu'
  );
}

const OWN_LABELS = new Set(Object.values(LABELS));
const RESERVED_REGEX = reservedRegex(OWN_LABELS);

// Pseudonyms already present in the source text, as "LABEL#n" keys. Reusing
// one would make the restoration replace text the user actually wrote. Every
// prefix of a digit run is reserved too ("PERSONNE_306" also reserves 3 and 30).
function reservedKeys(text) {
  const keys = new Set();
  for (const m of text.matchAll(RESERVED_REGEX)) {
    const label = labelKey(m[1] ?? m[3]);
    const digits = m[2] ?? m[4];
    for (let len = 1; len <= digits.length; len++) keys.add(label + '#' + Number(digits.slice(0, len)));
  }
  return keys;
}

function isTaken(pseudo, n, context) {
  if (state.mapping.has(pseudo)) return true;
  if (!context) return false;
  const bracket = BRACKET_PSEUDO.exec(pseudo);
  return bracket
    ? context.reserved.has(labelKey(bracket[1]) + '#' + n)
    : context.text.includes(pseudo);
}

const MAX_REALISTIC_ATTEMPTS = 500;

function pseudonymFor(type, value, context) {
  const key = type + '\u0000' + normalizeValue(type, value);
  const existing = state.index.get(key);
  if (existing) return existing;

  // A realistic generator has a finite range. Should it run dry, fall back to the
  // bracket form, whose counter never repeats, so this loop always terminates.
  let n;
  let pseudo;
  let attempts = 0;
  do {
    n = (state.counters[type] = (state.counters[type] || 0) + 1);
    const realistic = state.mode === 'realistic' && attempts++ < MAX_REALISTIC_ATTEMPTS
      ? realisticPseudonym(type, n)
      : null;
    pseudo = realistic || '[' + (LABELS[type] || type) + '_' + n + ']';
  } while (isTaken(pseudo, n, context));

  state.index.set(key, pseudo);
  state.mapping.set(pseudo, { type, value, key, n });
  state.exported = false;
  return pseudo;
}

/* ---------------------------------------------------------------
 * 6. Anonymisation
 * ------------------------------------------------------------- */

function customTermDetector(customTerms) {
  const terms = String(customTerms || '')
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (!terms.length) return null;
  return {
    type: 'CUSTOM',
    priority: 100,
    exact: true, // the user typed it: never trim punctuation off the match
    regex: new RegExp(UB_START + '(?:' + terms.map(escapeRegExp).join('|') + ')' + UB_END, 'giu'),
  };
}

function isEnabled(detector) {
  return state.enabled.has(detector.toggle || detector.type);
}

function scan(text, customTerms) {
  const detectors = DETECTORS.filter(isEnabled);
  const custom = customTermDetector(customTerms);
  if (custom) detectors.unshift(custom);

  const candidates = [];
  for (const d of detectors) {
    for (const match of text.matchAll(d.regex)) {
      let value = match[0];
      let start = match.index;

      if (d.group) {
        const group = match[d.group];
        if (!group) continue;
        const offset = match[0].indexOf(group);
        if (offset < 0) continue;
        start += offset;
        value = group;
      }

      // Regexes are greedy on the right; drop trailing punctuation.
      if (!d.exact) value = value.replace(/[\s.,;:!?)\]]+$/u, '');
      if (!value) continue;
      if (d.validate && !d.validate(value)) continue;

      candidates.push({ start, end: start + value.length, type: d.type, priority: d.priority, value });
    }
  }

  // Highest priority wins, then the longest span.
  candidates.sort((a, b) => b.priority - a.priority || (b.end - b.start) - (a.end - a.start) || a.start - b.start);

  // Linear overlap resolution: mark the characters already claimed instead of
  // comparing every candidate with every accepted span (quadratic on big pastes).
  const claimed = new Uint8Array(text.length);
  const accepted = [];
  for (const c of candidates) {
    let free = true;
    for (let i = c.start; i < c.end; i++) {
      if (claimed[i]) { free = false; break; }
    }
    if (!free) continue;
    claimed.fill(1, c.start, c.end);
    accepted.push(c);
  }
  accepted.sort((a, b) => a.start - b.start);
  return accepted;
}

function anonymize(text, customTerms) {
  const spans = scan(text, customTerms);
  const context = { text, reserved: reservedKeys(text) };
  let out = '';
  let cursor = 0;
  const counts = {};

  for (const span of spans) {
    out += text.slice(cursor, span.start);
    out += pseudonymFor(span.type, span.value, context);
    cursor = span.end;
    counts[span.type] = (counts[span.type] || 0) + 1;
  }
  out += text.slice(cursor);
  return { text: out, spans, counts };
}

/* ---------------------------------------------------------------
 * 7. De-anonymisation
 * A single pass over the text: every pseudonym occurrence is located first,
 * then the output is rebuilt. A restored value is therefore never scanned
 * again, so it cannot be mistaken for another pseudonym.
 * ------------------------------------------------------------- */

// A pseudonym must not be a fragment of a longer token ("1 rue X" inside
// "11 rue X", "Lucas Meyer" inside "Lucas Meyers"). The guard only looks at the
// SAME kind of character (digit next to digit, letter next to letter): text glued
// to a value of another kind ("Paris06 12 …") is legitimate and must restore.
function edgeGuard(char, lookbehind) {
  const kind = /\p{L}/u.test(char) ? '\\p{L}' : /\p{N}/u.test(char) ? '\\p{N}' : null;
  if (!kind) return '';
  return (lookbehind ? '(?<!' : '(?!') + kind + ')';
}

function literalRegex(pseudonyms) {
  const alternatives = pseudonyms
    .slice()
    .sort((a, b) => b.length - a.length)
    .map((p) => edgeGuard(p[0], true) + escapeRegExp(p) + edgeGuard(p[p.length - 1], false));
  return new RegExp(alternatives.join('|'), 'gu');
}

/* ---------------------------------------------------------------
 * Tabular replies (CSV / TSV)
 * Asked to "turn this into a CSV", an AI puts pseudonyms in cells. A real value
 * may contain the delimiter ("12, rue de la Paix") or a quote, which would
 * shift every following column once restored. Such blocks are located here so
 * that their cells can be restored and re-quoted one by one.
 * ------------------------------------------------------------- */

const DELIMITERS = [',', ';', '\t'];
const FENCE_LINE = /[ \t]*(?:```|~~~)/y;
// Lines that read as prose or Markdown rather than as a CSV record.
const PROSE_START = /^\s*(?:[-*+•>#]|\d{1,3}[.)])\s/u;
const PROSE_LABEL = /^\s*\p{L}[^:\n]{0,40}?\s?:\s/u;
const PROSE_END = /[.!?:…]\s*$/u;

function isBreak(ch) {
  return ch === '\n' || ch === '\r';
}

// Reads one field starting at `i`. A quote opens a quoted field only as the
// first character, and must be closed right before a delimiter or a line end;
// otherwise the field is read as plain text (lenient on malformed input).
function readField(text, i, to, delim) {
  if (text[i] === '"') {
    let j = i + 1;
    while (j < to) {
      if (text[j] === '"') {
        if (text[j + 1] === '"') { j += 2; continue; }
        break;
      }
      j++;
    }
    const after = j + 1;
    if (j < to && (after >= to || text[after] === delim || isBreak(text[after]))) {
      return { start: i, end: after, quoted: true, delim, value: text.slice(i + 1, j).replace(/""/g, '"') };
    }
  }
  let j = i;
  while (j < to && text[j] !== delim && !isBreak(text[j])) j++;
  return { start: i, end: j, quoted: false, delim, value: text.slice(i, j) };
}

function parseRecords(text, from, to, delim) {
  const records = [];
  let i = from;
  while (i < to) {
    const start = i;
    const fields = [];
    for (;;) {
      const field = readField(text, i, to, delim);
      fields.push(field);
      i = field.end;
      if (i < to && text[i] === delim) { i++; continue; }
      break;
    }
    records.push({ start, end: i, fields });
    if (text[i] === '\r' && text[i + 1] === '\n') i += 2;
    else if (isBreak(text[i])) i++;
  }
  return records;
}

function looksLikeProse(text, record) {
  const line = text.slice(record.start, record.end);
  const last = record.fields[record.fields.length - 1];
  return PROSE_START.test(line) || PROSE_LABEL.test(line) || (!last.quoted && PROSE_END.test(line));
}

// A block is a run of consecutive records with 2+ fields. It is tabular when
// most records share the same field count and most do not read as prose.
function isTabularBlock(text, block) {
  if (block.length < 2) return false;
  const counts = new Map();
  for (const r of block) counts.set(r.fields.length, (counts.get(r.fields.length) || 0) + 1);
  const modal = Math.max(...counts.values());
  if (modal < 2 || modal * 2 < block.length) return false;
  const prose = block.filter((r) => looksLikeProse(text, r)).length;
  if (prose * 2 >= block.length) return false;
  // Prose puts a space after "," or ";"; a CSV written by an AI does not.
  if (block[0].fields[0].delim === '\t') return true;
  let separators = 0;
  let spaced = 0;
  for (const r of block) {
    for (const f of r.fields.slice(1)) {
      separators++;
      if (!f.quoted && f.value.startsWith(' ')) spaced++;
    }
  }
  return spaced * 2 < separators;
}

function tabularBlocks(text, from, to, delim) {
  const blocks = [];
  let current = [];
  const flush = () => {
    if (isTabularBlock(text, current)) blocks.push(current);
    current = [];
  };
  for (const record of parseRecords(text, from, to, delim)) {
    if (record.fields.length >= 2) current.push(record);
    else flush();
  }
  flush();
  return blocks;
}

// Code fences never belong to a table: they split the text into regions.
function regions(text) {
  const out = [];
  let start = 0;
  let pos = 0;
  while (pos < text.length) {
    const nl = text.indexOf('\n', pos);
    const next = nl < 0 ? text.length : nl + 1;
    FENCE_LINE.lastIndex = pos;
    if (FENCE_LINE.test(text)) {
      if (pos > start) out.push([start, pos]);
      start = next;
    }
    pos = next;
  }
  if (start < text.length) out.push([start, text.length]);
  return out;
}

// Every cell of every CSV/TSV block in `text`, in order. In each region the
// delimiter whose blocks cover the most text wins.
function tabularCells(text) {
  const cells = [];
  for (const [from, to] of regions(text)) {
    let best = null;
    let bestSize = 0;
    for (const delim of DELIMITERS) {
      const at = text.indexOf(delim, from);
      if (at < 0 || at >= to) continue;
      const blocks = tabularBlocks(text, from, to, delim);
      const size = blocks.reduce((sum, b) => sum + b[b.length - 1].end - b[0].start, 0);
      if (size > bestSize) { best = blocks; bestSize = size; }
    }
    if (best) for (const block of best) for (const record of block) cells.push(...record.fields);
  }
  return cells;
}

// True when the whole text (blank edges aside) is a single CSV/TSV table.
function isTabular(text) {
  const cells = tabularCells(text);
  if (!cells.length) return false;
  return !text.slice(0, cells[0].start).trim() && !text.slice(cells[cells.length - 1].end).trim();
}

// Builds a function that restores every pseudonym of the current table in a
// string. The regexes are compiled once, so it can run on thousands of cells.
function buildRestorer() {
  const byKey = new Map();    // "LABEL#n" -> entry (bracket pseudonyms)
  const literal = new Map();  // pseudonym -> entry (realistic / imported)
  const labels = new Set();

  for (const [pseudo, entry] of state.mapping) {
    const bracket = BRACKET_PSEUDO.exec(pseudo);
    if (bracket) {
      labels.add(bracket[1]);
      byKey.set(labelKey(bracket[1]) + '#' + Number(bracket[2]), entry);
    } else {
      literal.set(pseudo, entry);
    }
  }

  const bracketRe = bracketRegex(labels);
  const literalRe = literal.size ? literalRegex([...literal.keys()]) : null;

  return function restore(text, restored) {
    const found = [];
    if (bracketRe) {
      for (const m of text.matchAll(bracketRe)) {
        const entry = byKey.get(matchKey(m));
        if (entry) found.push({ start: m.index, end: m.index + m[0].length, entry });
      }
    }
    if (literalRe) {
      for (const m of text.matchAll(literalRe)) {
        found.push({ start: m.index, end: m.index + m[0].length, entry: literal.get(m[0]) });
      }
    }
    if (!found.length) return { text, replaced: 0 };

    found.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

    let out = '';
    let cursor = 0;
    let replaced = 0;
    for (const f of found) {
      if (f.start < cursor) continue; // overlaps a longer match already used
      out += text.slice(cursor, f.start) + f.entry.value;
      cursor = f.end;
      replaced++;
      restored.add(f.entry);
    }
    return { text: out + text.slice(cursor), replaced };
  };
}

// RFC 4180 quoting, applied only when a restored value brings a delimiter, a
// quote or a line break that the cell did not already hold: a cell the
// restoration cannot break keeps its exact original text.
function specialChars(text, delim) {
  let n = 0;
  for (const ch of text) if (ch === delim || ch === '"' || isBreak(ch)) n++;
  return n;
}

function serializeCell(value, cell) {
  if (cell.quoted) return '"' + value.replace(/"/g, '""') + '"';
  if (specialChars(value, cell.delim) === specialChars(cell.value, cell.delim)) return value;
  return '"' + value.replace(/"/g, '""') + '"';
}

function deanonymize(text) {
  const restore = buildRestorer();
  const restored = new Set();
  let replaced = 0;
  const run = (chunk) => {
    const r = restore(chunk, restored);
    replaced += r.replaced;
    return r.text;
  };

  // Cells of a CSV/TSV block are restored one by one, then re-quoted if the
  // real value would otherwise break the columns. Everything else is plain text.
  const cells = tabularCells(text);
  let out = '';
  let cursor = 0;
  for (const cell of cells) {
    out += run(text.slice(cursor, cell.start));
    out += serializeCell(run(cell.value), cell);
    cursor = cell.end;
  }
  out += run(text.slice(cursor));

  const missing = [...state.mapping.values()].filter((entry) => !restored.has(entry)).length;
  return { text: out, replaced, missing, total: state.mapping.size, tabular: cells.length > 0 };
}

/* ---------------------------------------------------------------
 * 8. Table management (reset, export, import)
 * ------------------------------------------------------------- */

function clearMapping() {
  state.mapping.clear();
  state.index.clear();
  state.counters = Object.create(null);
  state.exported = true;
}

function buildExport() {
  return {
    format: 'text-anonymizer-mapping',
    version: 1,
    createdAt: new Date().toISOString(),
    mode: state.mode,
    entries: [...state.mapping.entries()].map(([pseudo, e]) => ({
      pseudonym: pseudo,
      type: e.type,
      value: e.value,
      n: e.n,
    })),
  };
}

const TYPE_BY_LABEL = new Map(Object.entries(LABELS).map(([type, label]) => [label, type]));
const VALID_TYPE = /^[A-Z][A-Z_]{0,31}$/;

// Returns the number of entries loaded. Throws an Error carrying a user-facing
// message when the payload is unusable; in that case the table is left
// untouched (the import is all-or-nothing).
function loadImport(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.entries)) {
    throw new Error('Fichier invalide : aucune liste « entries ».');
  }

  const valid = [];
  for (const entry of payload.entries) {
    if (!entry || typeof entry.pseudonym !== 'string' || typeof entry.value !== 'string') continue;
    if (!entry.pseudonym.trim() || !entry.value.trim()) continue;
    const type = typeof entry.type === 'string' && VALID_TYPE.test(entry.type) ? entry.type : 'CUSTOM';
    valid.push({ pseudonym: entry.pseudonym, type, value: entry.value, n: entry.n });
  }

  // Never overwrite a pseudonym that already stands for a different value:
  // it would silently change what earlier anonymised texts restore to.
  const conflicts = new Set();
  const inFile = new Map();
  for (const e of valid) {
    const current = state.mapping.get(e.pseudonym);
    if (current && current.value !== e.value) conflicts.add(e.pseudonym);
    if (inFile.has(e.pseudonym) && inFile.get(e.pseudonym) !== e.value) conflicts.add(e.pseudonym);
    inFile.set(e.pseudonym, e.value);
  }
  if (conflicts.size) {
    throw new Error(
      'Import annulé : ' + conflicts.size + ' pseudonyme(s) désignent déjà une autre valeur. ' +
      'Effacer la table avant d\'importer ce fichier.'
    );
  }

  const wasEmpty = state.mapping.size === 0;
  let created = 0;
  for (const e of valid) {
    const key = e.type + '\u0000' + normalizeValue(e.type, e.value);
    if (!state.mapping.has(e.pseudonym)) created++;
    state.mapping.set(e.pseudonym, { type: e.type, value: e.value, key, n: e.n });
    if (!state.index.has(key)) state.index.set(key, e.pseudonym);

    // Keep counters ahead of every imported number so new pseudonyms never collide.
    const bracket = BRACKET_PSEUDO.exec(e.pseudonym);
    const counterType = bracket ? TYPE_BY_LABEL.get(bracket[1]) || e.type : e.type;
    const n = bracket ? Number(bracket[2]) : Number(e.n) || 0;
    if (n > (state.counters[counterType] || 0)) state.counters[counterType] = n;
  }

  if (wasEmpty) {
    if (payload.mode === 'realistic' || payload.mode === 'placeholder') state.mode = payload.mode;
    state.exported = true; // the table is exactly the file being imported
  } else if (created > 0) {
    state.exported = false; // merged table no longer matches any exported file
  }
  return valid.length;
}

/* Node (tests) gets the API through require(); browsers use the globals. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LABELS, TYPE_OPTIONS, FIRST_NAMES, DETECTORS, state,
    luhnValid, ibanValid, ipv4Valid, normalizeValue,
    scan, anonymize, deanonymize, pseudonymFor, tabularCells, isTabular,
    clearMapping, buildExport, loadImport,
  };
}
