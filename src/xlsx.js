// =============================================================================
// XLSX minimal, sans bibliothèque (le dépôt n'a aucune dépendance côté page).
// Écriture : un classeur de feuilles à en-tête, zip sans compression.
// Lecture : zip stocké ou déflaté (DecompressionStream, navigateurs récents),
// feuilles lues en texte (chaînes partagées et chaînes en ligne).
// =============================================================================
(function (racine) {
  'use strict';

  const enc = new TextEncoder();
  const dec = new TextDecoder('utf-8');

  // --- CRC32 (exigé par le format zip) ----------------------------------------
  const TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(octets) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < octets.length; i++) c = TABLE[(c ^ octets[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  const concat = (morceaux) => {
    const total = morceaux.reduce((n, m) => n + m.length, 0);
    const out = new Uint8Array(total);
    let p = 0;
    for (const m of morceaux) { out.set(m, p); p += m.length; }
    return out;
  };

  // --- Écriture du zip (fichiers stockés, sans compression) -------------------
  function ecrireZip(fichiers) {
    const parts = [], centraux = [];
    let offset = 0;
    for (const f of fichiers) {
      const nom = enc.encode(f.nom), data = enc.encode(f.texte), crc = crc32(data);
      const loc = new DataView(new ArrayBuffer(30));
      loc.setUint32(0, 0x04034b50, true); loc.setUint16(4, 20, true); loc.setUint16(6, 0x0800, true);
      loc.setUint16(8, 0, true); loc.setUint16(10, 0, true); loc.setUint16(12, 33, true);
      loc.setUint32(14, crc, true); loc.setUint32(18, data.length, true); loc.setUint32(22, data.length, true);
      loc.setUint16(26, nom.length, true); loc.setUint16(28, 0, true);
      parts.push(new Uint8Array(loc.buffer), nom, data);

      const cen = new DataView(new ArrayBuffer(46));
      cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true);
      cen.setUint16(8, 0x0800, true); cen.setUint16(10, 0, true); cen.setUint16(12, 0, true); cen.setUint16(14, 33, true);
      cen.setUint32(16, crc, true); cen.setUint32(20, data.length, true); cen.setUint32(24, data.length, true);
      cen.setUint16(28, nom.length, true); cen.setUint16(30, 0, true); cen.setUint16(32, 0, true);
      cen.setUint16(34, 0, true); cen.setUint16(36, 0, true); cen.setUint32(38, 0, true); cen.setUint32(42, offset, true);
      centraux.push(new Uint8Array(cen.buffer), nom);
      offset += 30 + nom.length + data.length;
    }
    const cd = concat(centraux);
    const fin = new DataView(new ArrayBuffer(22));
    fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, fichiers.length, true); fin.setUint16(10, fichiers.length, true);
    fin.setUint32(12, cd.length, true); fin.setUint32(16, offset, true);
    return concat([...parts, cd, new Uint8Array(fin.buffer)]);
  }

  // --- Lecture du zip ----------------------------------------------------------
  async function inflater(octets) {
    const flux = new Blob([octets]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(flux).arrayBuffer());
  }

  async function lireZip(octets) {
    const v = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
    let fin = -1;
    for (let i = octets.length - 22; i >= Math.max(0, octets.length - 65557); i--) {
      if (v.getUint32(i, true) === 0x06054b50) { fin = i; break; }
    }
    if (fin < 0) throw new Error('zip : fin introuvable');
    const nombre = v.getUint16(fin + 10, true);
    let p = v.getUint32(fin + 16, true);
    const fichiers = new Map();
    for (let k = 0; k < nombre; k++) {
      if (v.getUint32(p, true) !== 0x02014b50) throw new Error('zip : répertoire abîmé');
      const methode = v.getUint16(p + 10, true);
      const taille = v.getUint32(p + 20, true);
      const lnom = v.getUint16(p + 28, true), lext = v.getUint16(p + 30, true), lcom = v.getUint16(p + 32, true);
      const locOff = v.getUint32(p + 42, true);
      const nom = dec.decode(octets.subarray(p + 46, p + 46 + lnom));
      const debut = locOff + 30 + v.getUint16(locOff + 26, true) + v.getUint16(locOff + 28, true);
      const brut = octets.subarray(debut, debut + taille);
      if (methode === 0) fichiers.set(nom, brut);
      else if (methode === 8) fichiers.set(nom, await inflater(brut));
      else throw new Error('zip : méthode de compression non prise en charge');
      p += 46 + lnom + lext + lcom;
    }
    return fichiers;
  }

  // --- XML : échappement et lecture par motifs (fichiers produits par Excel) ---
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  // Décode les entités nommées et numériques (&#233; ou &#xE9;), l'esperluette en dernier.
  const desc = (s) => String(s)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, '\'').replace(/&amp;/g, '&');
  const attr = (balise, nom) => { const m = balise.match(new RegExp('\\b' + nom + '="([^"]*)"')); return m ? desc(m[1]) : ''; };
  const colonne = (lettres) => [...lettres].reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0) - 1;
  const textes = (xml) => [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join('');

  function lireFeuille(xml, sst) {
    const lignes = [];
    let suivante = 1;
    for (const m of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const numero = Number(attr(m[1], 'r')) || suivante;
      suivante = numero + 1;
      const cellules = [];
      for (const c of (m[2] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = attr(c[1], 'r');
        const type = attr(c[1], 't');
        const contenu = c[2] || '';
        let valeur = '';
        if (type === 's') valeur = sst[Number((contenu.match(/<v>([\s\S]*?)<\/v>/) || [])[1])] || '';
        else if (type === 'inlineStr') valeur = desc(textes(contenu));
        else { const v = contenu.match(/<v>([\s\S]*?)<\/v>/); valeur = v ? desc(v[1]) : ''; }
        cellules[colonne(ref.replace(/\d+$/, ''))] = valeur;
      }
      lignes[numero - 1] = Array.from(cellules, (x) => (x === undefined ? '' : x));
    }
    return Array.from(lignes, (l) => l || []);
  }

  // Lit un classeur : { nomFeuille: [[cellule, ...], ...] } ; la ligne n est à l'index n-1.
  async function lireClasseur(octets) {
    const fichiers = await lireZip(octets);
    const texte = (nom) => (fichiers.has(nom) ? dec.decode(fichiers.get(nom)) : null);
    const wb = texte('xl/workbook.xml'), rels = texte('xl/_rels/workbook.xml.rels');
    if (!wb || !rels) throw new Error('classeur : structure absente');
    const cibles = new Map();
    for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
      cibles.set(attr(m[0], 'Id'), attr(m[0], 'Target').replace(/^\/?(xl\/)?/, ''));
    }
    const chainesXml = texte('xl/sharedStrings.xml');
    const sst = chainesXml ? [...chainesXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => desc(textes(m[1]))) : [];
    const feuilles = {};
    for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
      const cible = cibles.get(attr(m[0], 'r:id'));
      feuilles[attr(m[0], 'name')] = lireFeuille(cible ? (texte('xl/' + cible) || '') : '', sst);
    }
    return feuilles;
  }

  // --- Écriture du classeur ----------------------------------------------------
  // feuille : { nom, lignes: [[texte,…],…], entete?: bool, largeurs?: [n,…], validations?: [...] }
  // validation : { sqref, type, operateur?, formule, formule2?, titre, message }
  const lettre = (i) => String.fromCharCode(65 + i);

  function xmlFeuille(f) {
    const lignesXml = f.lignes.map((ligne, r) => {
      const cellules = ligne.map((txt, c) => (txt === '' ? '' :
        `<c r="${lettre(c)}${r + 1}" t="inlineStr" s="${f.entete && r === 0 ? 1 : 0}"><is><t xml:space="preserve">${esc(txt)}</t></is></c>`)).join('');
      return `<row r="${r + 1}">${cellules}</row>`;
    }).join('');
    const cols = (f.largeurs || []).map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
    const vues = f.entete ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
    const validations = (f.validations || []).map((v) =>
      `<dataValidation type="${v.type}"${v.operateur ? ` operator="${v.operateur}"` : ''} allowBlank="1" showErrorMessage="1" errorStyle="stop" errorTitle="${esc(v.titre)}" error="${esc(v.message)}" sqref="${v.sqref}"><formula1>${esc(v.formule)}</formula1>${v.formule2 !== undefined ? `<formula2>${esc(v.formule2)}</formula2>` : ''}</dataValidation>`).join('');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      vues + (cols ? `<cols>${cols}</cols>` : '') + `<sheetData>${lignesXml}</sheetData>` +
      (validations ? `<dataValidations count="${(f.validations || []).length}">${validations}</dataValidations>` : '') +
      '</worksheet>';
  }

  const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  function ecrireClasseur(feuilles) {
    const n = feuilles.length;
    const fichiers = [
      { nom: '[Content_Types].xml', texte: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        feuilles.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
      { nom: '_rels/.rels', texte: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { nom: 'xl/workbook.xml', texte: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>' +
        feuilles.map((f, i) => `<sheet name="${esc(f.nom)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>' },
      { nom: 'xl/_rels/workbook.xml.rels', texte: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        feuilles.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
        `<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { nom: 'xl/styles.xml', texte: STYLES }
    ];
    feuilles.forEach((f, i) => fichiers.push({ nom: `xl/worksheets/sheet${i + 1}.xml`, texte: xmlFeuille(f) }));
    return ecrireZip(fichiers);
  }

  const api = { ecrireClasseur, lireClasseur, crc32 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.GM_xlsx = api;
})(this);
