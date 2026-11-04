/* NUMMAZA — разбор выписок: PDF (Kaspi Gold, Halyk, Freedom) и CSV.
   Всё происходит на устройстве, файл никуда не отправляется. */
(function () {
  'use strict';
  const NZ = window.NZ;

  // Слова, которыми банк помечает тип операции (рус. и каз. выписки)
  const OPS = [
    ['Покупка', 'buy'], ['Покупки', 'buy'], ['Сатып алу', 'buy'], ['Оплата', 'buy'], ['Платеж', 'buy'], ['Платёж', 'buy'], ['Төлем', 'buy'],
    ['Перевод', 'transfer'], ['Переводы', 'transfer'], ['Аударым', 'transfer'], ['Аударымдар', 'transfer'],
    ['Пополнение', 'topup'], ['Пополнения', 'topup'], ['Толықтыру', 'topup'],
    ['Снятие', 'cash'], ['Снятия', 'cash'], ['Ақша алу', 'cash'], ['Ақшаны шешу', 'cash'],
    ['Разное', 'misc'], ['Әртүрлі', 'misc'], ['Purchase', 'buy'], ['Transfer', 'transfer'], ['Top-up', 'topup'], ['Withdrawal', 'cash']
  ];
  const OP_RE = new RegExp('^(' + OPS.map((o) => o[0].replace(/\s+/g, '\\s+')).join('|') + ')(?=\\s|$)\\s*(.*)$', 'i');
  const opKind = (word) => { const w = word.replace(/\s+/g, ' ').toLowerCase(); const f = OPS.find((o) => o[0].toLowerCase() === w); return f ? f[1] : 'misc'; };

  const SP = '[\\s\\u00a0\\u202f\\u2009]';
  // 05.10.24  - 2 650,00 ₸  Покупка  MAGNUM ...
  const ROW_RE = new RegExp('^(\\d{2}\\.\\d{2}\\.\\d{2,4})' + SP + '+([+\\-\\u2212\\u2013])' + SP + '*((?:\\d{1,3}(?:' + SP + '?\\d{3})*|\\d+)(?:[.,]\\d{1,2})?)' + SP + '*(?:₸|KZT|тг\\.?)?' + SP + '*(.*)$');

  NZ.parseAmount = function (s) {
    const clean = String(s).replace(/[\s   ₸]|KZT|тг\.?/g, '').replace(/[−–]/g, '-');
    // «1.234,56» и «1,234.56» и «1234,56»
    let n = clean;
    if (/,\d{1,2}$/.test(n)) n = n.replace(/\./g, '').replace(',', '.');
    else n = n.replace(/,/g, '');
    const v = parseFloat(n);
    return isNaN(v) ? null : v;
  };
  NZ.parseDate = function (s) {
    let m = /^(\d{2})\.(\d{2})\.(\d{2,4})$/.exec(s.trim());
    if (m) { let y = +m[3]; if (y < 100) y += 2000; return y + '-' + m[2] + '-' + m[1]; }
    m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.trim());
    if (m) return m[3] + '-' + m[2] + '-' + m[1];
    return null;
  };

  // Определяем категорию и «свой ли это перевод»
  NZ.classify = function (raw, op, amount, rules) {
    const text = String(raw || '');
    const low = text.toLowerCase();
    const key = NZ.merchantKey(text);
    const merchant = text.replace(/^(в|с|на|от|to|from)\s+/i, '').replace(/\s{2,}/g, ' ').trim().slice(0, 48) || '—';
    if (/kaspi\s*депозит|с\s*депозит|на\s*депозит|депозиттен|депозитке|между\s*своими|со\s*своего|на\s*свой|own\s*account|kaspi\s*gold\s*→|с\s*kaspi\s*gold|на\s*kaspi\s*gold/i.test(low)) {
      return { cat: amount > 0 ? 'transfer_in' : 'transfers', own: true, merchant, confidence: 0.95 };
    }
    if (rules && rules[key]) return { cat: rules[key], own: false, merchant, confidence: 1 };
    if (amount > 0) {
      if (/зарплат|заработн|жалақы|еңбекақы|salary|payroll|аванс/i.test(low)) return { cat: 'salary', own: false, merchant, confidence: 0.9 };
      if (/кэшбэк|кешбэк|cashback|бонус/i.test(low)) return { cat: 'cashback', own: false, merchant, confidence: 0.9 };
      if (/возврат|қайтару|refund/i.test(low)) return { cat: 'refund', own: false, merchant, confidence: 0.9 };
      if (op === 'transfer' || op === 'topup') return { cat: 'transfer_in', own: false, merchant, confidence: 0.7 };
      return { cat: 'other_in', own: false, merchant, confidence: 0.5 };
    }
    for (const [re, cat] of NZ.MERCHANT_RULES) if (re.test(text)) return { cat, own: false, merchant, confidence: 0.9 };
    if (op === 'transfer') return { cat: 'transfers', own: false, merchant, confidence: 0.75 };
    if (op === 'cash') return { cat: 'other', own: false, merchant, confidence: 0.6 };
    return { cat: 'other', own: false, merchant, confidence: 0.4 };
  };

  NZ.makeTx = function (date, amount, raw, op, source, rules) {
    const c = NZ.classify(raw, op, amount, rules);
    return { id: NZ.uid(), date, amount: Math.round(amount), raw: String(raw || '').trim(), op, cat: c.cat, own: c.own, merchant: c.merchant, confidence: c.confidence, source };
  };

  // Разбор строк текста выписки
  NZ.parseLines = function (lines, rules) {
    const joined = lines.join(' ');
    const bank = /kaspi/i.test(joined) ? 'Kaspi' : /halyk/i.test(joined) ? 'Halyk' : /freedom/i.test(joined) ? 'Freedom' : null;
    const txs = [];
    let last = null;
    lines.forEach((line) => {
      const l = line.replace(/\s+/g, ' ').trim();
      if (!l) return;
      const m = ROW_RE.exec(l);
      if (m) {
        const date = NZ.parseDate(m[1]);
        const sign = m[2] === '+' ? 1 : -1;
        const amt = NZ.parseAmount(m[3]);
        if (!date || amt === null) return;
        let rest = m[4].trim();
        let op = 'misc';
        const om = OP_RE.exec(rest);
        if (om) { op = opKind(om[1]); rest = om[2]; }
        last = { date, amount: sign * amt, raw: rest, op };
        txs.push(last);
      } else if (last && !/^(дата|күні|date|сумма|итого|барлығы|остаток|қалдық|баланс|страница|бет|page)(?=\s|$|:)/i.test(l) && l.length < 80 && !/^\d{2}\.\d{2}\.\d{2,4}/.test(l)) {
        // Перенос длинного описания на следующую строку
        if (last.raw.length < 60) last.raw = (last.raw + ' ' + l).trim();
      }
    });
    return { bank, txs: txs.map((t) => NZ.makeTx(t.date, t.amount, t.raw, t.op, 'statement', rules)) };
  };

  // PDF → строки (через pdf.js, на устройстве)
  NZ.pdfLines = async function (buf) {
    const lib = window.pdfjsLib;
    if (!lib) throw new Error('nopdf');
    const doc = await lib.getDocument({ data: buf, isEvalSupported: false, disableFontFace: true }).promise;
    const lines = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      const rows = [];
      tc.items.forEach((it) => {
        if (!it.str || !it.str.trim()) return;
        const y = it.transform[5];
        const x = it.transform[4];
        let row = rows.find((r) => Math.abs(r.y - y) < 3);
        if (!row) { row = { y, items: [] }; rows.push(row); }
        row.items.push({ x, s: it.str });
      });
      rows.sort((a, b) => b.y - a.y).forEach((r) => lines.push(r.items.sort((a, b) => a.x - b.x).map((i) => i.s).join(' ')));
    }
    return lines;
  };

  // CSV: ищем колонки «дата», «сумма» (или «приход/расход»), «описание»
  NZ.parseCsv = function (text, rules) {
    const first = text.split(/\r?\n/)[0] || '';
    const delim = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : first.includes('\t') ? '\t' : ',';
    const rows = [];
    let cur = ['']; let q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"' && text[i + 1] === '"') { cur[cur.length - 1] += '"'; i++; } else if (ch === '"') q = false; else cur[cur.length - 1] += ch; }
      else if (ch === '"') q = true;
      else if (ch === delim) cur.push('');
      else if (ch === '\n') { rows.push(cur); cur = ['']; }
      else if (ch !== '\r') cur[cur.length - 1] += ch;
    }
    if (cur.length > 1 || cur[0]) rows.push(cur);
    if (rows.length < 2) return { bank: null, txs: [] };
    const head = rows[0].map((h) => h.toLowerCase().trim());
    const find = (re) => head.findIndex((h) => re.test(h));
    const iDate = find(/дата|күні|date/);
    const iAmt = find(/^сумма|сома|amount|sum$/);
    const iIn = find(/приход|кіріс|credit|income/);
    const iOut = find(/расход|шығыс|debit|expense/);
    const iDesc = find(/описан|детал|операц|назнач|сипат|description|details|merchant|payee/);
    const iOp = find(/^операция|^тип|type|операция түрі/);
    if (iDate < 0 || (iAmt < 0 && iIn < 0 && iOut < 0)) return { bank: null, txs: [] };
    const txs = [];
    rows.slice(1).forEach((r) => {
      const date = NZ.parseDate(r[iDate] || '');
      if (!date) return;
      let amt = null;
      if (iAmt >= 0) amt = NZ.parseAmount(r[iAmt] || '');
      else { const a = NZ.parseAmount(r[iIn] || '') || 0; const b = NZ.parseAmount(r[iOut] || '') || 0; amt = a - Math.abs(b); }
      if (amt === null || amt === 0) return;
      const desc = (iDesc >= 0 ? r[iDesc] : r.filter((_, k) => k !== iDate && k !== iAmt).join(' ')) || '';
      const op = iOp >= 0 ? opKind((r[iOp] || '').trim()) : 'misc';
      txs.push(NZ.makeTx(date, amt, desc, op, 'statement', rules));
    });
    return { bank: /kaspi/i.test(text) ? 'Kaspi' : null, txs };
  };

  // Склейка: пропускаем дубликаты (дата + сумма + описание)
  NZ.mergeTxs = function (existing, incoming) {
    const seen = new Set(existing.map((t) => t.date + '|' + t.amount + '|' + NZ.merchantKey(t.raw)));
    const added = []; let dups = 0;
    incoming.forEach((t) => {
      const k = t.date + '|' + t.amount + '|' + NZ.merchantKey(t.raw);
      if (seen.has(k)) { dups++; return; }
      seen.add(k); added.push(t);
    });
    return { added, dups };
  };
})();
