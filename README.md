# Anonymiseur de texte

Outil web local qui remplace les données sensibles d'un texte par des pseudonymes,
garde la table de correspondance **en mémoire**, et restaure les vraies valeurs
dans la réponse de l'IA.

Cas d'usage : préparer un texte avant de le coller dans ChatGPT / Claude, puis
remettre les vraies données dans la réponse obtenue.

```
texte réel ──► [Anonymiser] ──► texte pseudonymisé ──► copier dans l'IA
                                                            │
texte réel ◄── [Désanonymiser] ◄── réponse de l'IA ◄────────┘
```

## Garanties

- **Aucune requête réseau.** Tout le traitement est du JavaScript exécuté dans
  l'onglet. La CSP intégrée au fichier contient `connect-src 'none'` : même en
  cas de code malveillant injecté, le navigateur bloque toute sortie réseau.
- **Rien n'est persisté.** Pas de `localStorage`, pas de cookie, pas de base.
  La table vit dans la mémoire de l'onglet et disparaît au rechargement.
- **Export explicite.** La table ne touche le disque qu'après un clic sur
  « Exporter (.json) ». Seule la confirmation de fermeture du navigateur
  signale une table non exportée ; aucun bandeau dans la page.

> ⚠️ Le fichier `.json` exporté contient les **vraies données**. À traiter comme
> un secret : stockage chiffré, permissions `600`, jamais dans un dépôt Git
> (déjà couvert par le `.gitignore`).

## Lancer

Ouvrir `standalone/anonymiseur.html` dans le navigateur (double-clic). HTML,
CSS et JavaScript y sont fusionnés : aucun serveur, aucune installation, et le
fichier se copie tel quel sur une clé USB ou une autre machine.

Une CSP intégrée au fichier bloque toute requête sortante (`connect-src 'none'`)
et n'autorise que le code de la page, identifié par son empreinte SHA-256.

Si le navigateur refuse l'accès au presse-papiers, l'outil bascule sur une
copie par sélection.

### Modifier l'outil

Les sources sont dans `src/`. Après une modification, régénérer le fichier
autonome (Node.js requis, aucune dépendance) :

```bash
node scripts/build-standalone.js
```

## Utilisation

1. **Anonymiser** — coller le texte sensible à gauche, `🔒 Anonymiser`
   (ou `Ctrl+Entrée`), copier le résultat de droite.
2. **Exporter la table** si l'onglet risque d'être fermé avant la réponse.
3. **Désanonymiser** — coller la réponse de l'IA (ou `📂 Ouvrir un fichier`),
   `🔓 Restaurer` (ou `Ctrl+Entrée`), puis `📋 Copier` ou `⬇️ Télécharger`.

Onglet fermé entre-temps : réimporter le `.json` via `⬆️ Importer`, puis
désanonymiser.

### Réponse au format CSV

Cas typique : un long texte anonymisé, puis « convertis ça en CSV » dans l'IA.
Le CSV obtenu se restaure sans décaler les colonnes :

- les blocs CSV (virgule, point-virgule ou tabulation) sont repérés dans la
  réponse, y compris dans un bloc ```` ```csv ```` entouré de texte ;
- chaque cellule est restaurée séparément ; si la vraie valeur contient le
  séparateur, un guillemet ou un saut de ligne (`12, rue de la Paix`), la
  cellule est mise entre guillemets selon la RFC 4180 ;
- une cellule que la restauration ne peut pas casser reste identique octet
  pour octet ;
- `⬇️ Télécharger` produit un `.csv` (ou `.tsv`) avec BOM UTF-8, pour que
  Excel affiche correctement les accents.

Le texte libre, les listes à puces et les lignes « Nom : valeur » ne sont pas
pris pour un CSV. Un CSV écrit avec une espace après chaque virgule (`a, b, c`)
n'est pas reconnu non plus : il est restauré comme du texte.

### Styles de pseudonyme

| Style | Rendu | Quand l'utiliser |
|---|---|---|
| **Balises** (défaut) | `[PERSONNE_1]`, `[EMAIL_2]` | Le plus fiable. L'IA comprend que c'est un marqueur et le recopie tel quel. La restauration tolère les reformulations courantes : `[ personne 1 ]`, `[PERSONNE-1]`, `personne_1`, `PERSONNE\_1` (souligné échappé en Markdown). |
| **Pseudos réalistes** | `Camille Fontaine`, `c.fontaine@exemple.fr` | Texte plus naturel à lire, mais l'IA peut décliner ou reformuler un nom et casser la restauration. |

### Types détectés

E-mails · téléphones (FR et international : `+44 20 7946 0958`,
`+1 (555) 123-4567`) · noms de personnes · sociétés · adresses postales ·
code postal + ville · IBAN (validé par clé mod-97, majuscules ou minuscules) ·
cartes bancaires (validées par Luhn, ou au format `1234 5678 9012 3456`) ·
numéros de sécurité sociale · SIRET / SIREN / TVA / RCS · adresses IP (v4, v6
complète ou abrégée `2001:db8::1`) · adresses MAC · URLs · **mots de passe,
jetons et clés d'API** (`mot de passe : …`, `api_key=…`, `sk-…`, `ghp_…`,
`AKIA…`, JWT, `Bearer …`) · plaques d'immatriculation (`AB-123-CD`) ·
dates (désactivé par défaut).

« Claude » seul (« Bonjour Claude ») n'est pas pris pour une personne ;
« Claude Bernard » l'est.

Chaque type se désactive dans **Options de détection**. Deux compléments :

- **Mode large** pour les noms propres : capture tout couple de mots
  capitalisés. Efficace, mais génère des faux positifs.
- **Termes toujours anonymisés** : un terme par ligne (nom de projet, de client,
  de produit). On peut aussi sélectionner du texte à gauche puis cliquer sur
  `➕ Anonymiser la sélection`.

## Décisions de conception

- **Un « Personne 1 » nu n'est jamais restauré.** Sans crochets, il faut un
  souligné (`PERSONNE_1`). « Personne 1 », « Adresse 2 » ou « Email 1 » sont du
  français ordinaire : les remplacer serait une erreur silencieuse, alors qu'un
  marqueur non restauré reste visible.
- **Restauration en une seule passe.** Une valeur restaurée n'est jamais
  rescannée, elle ne peut donc pas être prise pour un autre pseudonyme.
- **Collisions évitées.** Si le texte contient déjà `[EMAIL_1]` (ou `PERSONNE_3`,
  un nom du pool réaliste…), ce pseudonyme est sauté et le suivant est utilisé.
- **Import atomique.** Un fichier dont un pseudonyme désigne déjà une autre valeur
  est refusé en bloc plutôt que d'écraser silencieusement la table courante.
- **Mode réaliste : pas de correspondance au milieu d'un mot.** `Camille Fontaine`
  n'est pas restauré dans `Camille Fontaines`, ni `1 rue des Acacias` dans
  `11 rue des Acacias`.

## Limites connues

- La détection automatique est une **aide, pas une garantie**. Toujours relire
  le texte anonymisé avant de le coller dans un service externe — d'où la table
  affichée en entier.
- Un prénom seul et son nom complet reçoivent deux pseudonymes distincts
  (`Jean` → `[PERSONNE_3]`, `Jean Dupont` → `[PERSONNE_1]`). C'est volontaire :
  la restauration reste ainsi rigoureusement fidèle au texte d'origine.
- Un faux positif se corrige en supprimant sa ligne dans la table, puis en
  relançant l'anonymisation.
- Le **même numéro écrit de deux façons** (`06 12 34 56 78` / `06.12.34.56.78`,
  ou un e-mail en casses différentes) reçoit un seul pseudonyme et revient sous
  la première graphie rencontrée.
- Une **adresse** s'arrête au premier signe de ponctuation, mot-outil (`et`, `pour`…)
  ou code postal, avec 5 mots de rue au maximum. Un nom de rue exceptionnellement
  long peut donc n'être capturé qu'en partie : relire le texte anonymisé.
- Les noms de personnes reposent sur une liste d'environ 230 prénoms français
  et sur les titres (`M.`, `Mme`, `Dr`…). Un prénom absent de la liste n'est pas
  détecté sans le **mode large** ou un terme manuel.
- Les regex utilisent les assertions `(?<=…)` et `\p{L}` : navigateurs récents
  uniquement (Chrome/Edge 90+, Firefox 78+, Safari 16.4+).

## Structure

```
text-anonymizer/
├── README.md
├── .gitignore
├── standalone/
│   └── anonymiseur.html  # l'outil : un seul fichier, généré depuis src/
├── scripts/
│   └── build-standalone.js
└── src/
    ├── index.html
    ├── style.css
    ├── engine.js         # détection, pseudonymes, restauration, export/import (pur, sans DOM)
    └── app.js            # interface
```

## Licence

Usage personnel.
