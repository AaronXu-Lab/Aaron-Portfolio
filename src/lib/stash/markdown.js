// Port of Seal Note's MarkdownHighlighter semantic roles. UTF-16 offsets are
// shared by JavaScript strings, CodeMirror and the reference's NSRange values.
export function highlightMarkdown(text) {
  const spans = [];
  const add = (from, to, role) => { if (to > from) spans.push({ from, to, role }); };
  const lines = []; let offset = 0;
  for (const value of text.split('\n')) { lines.push({ value, from: offset, to: offset + value.length }); offset += value.length + 1; }
  const fences = lines.flatMap(line => {
    const match = /^([ \t]{0,3})(```|~~~)([^`~\n]*)$/.exec(line.value);
    return match ? [{ ...line, marker: line.from + match[1].length, token: match[2] }] : [];
  });
  const blocks = [];
  // Seal Note pairs fence lines; unmatched fences remain ordinary source text.
  for (let i = 0; i + 1 < fences.length; i += 2) {
    const open = fences[i], close = fences[i + 1];
    blocks.push({ from: open.marker, to: close.marker + 3 });
    add(open.marker, open.to, 'codeFenceMarker');
    if (close.value.trim() === close.token) add(close.marker, close.marker + 3, 'codeFenceMarker');
  }
  const overlaps = (from, to, ranges) => ranges.some(r => from < r.to && to > r.from);
  const inBlock = line => overlaps(line.from, line.to, blocks);
  const tableLines = new Set();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (inBlock(line) || !line.value.includes('|') || !line.value.includes('-') || line.value.replace(/[|:\-\s]/g, '')) continue;
    tableLines.add(i - 1); tableLines.add(i);
    for (let j = i + 1; j < lines.length && !inBlock(lines[j]) && lines[j].value.includes('|'); j++) tableLines.add(j);
  }
  for (let index = 0; index < lines.length; index++) {
    const { value: line, from: start, to } = lines[index];
    if (inBlock(lines[index])) continue;
    if (tableLines.has(index)) for (let i = 0; i < line.length; i++) if (line[i] === '|') add(start + i, start + i + 1, 'tableDelimiter');
    if (/^[-*_\s]+$/.test(line) && line.replace(/\s/g, '').length >= 3) { add(start, to, 'horizontalRule'); continue; }
    let match = /^(\s{0,3})(#{1,6})(\s+)(.*)$/.exec(line);
    if (match) {
      const markerEnd = start + match[1].length + match[2].length + match[3].length;
      add(start + match[1].length, markerEnd, 'headingMarker'); add(markerEnd, to, 'headingText');
    } else if (!tableLines.has(index) && (match = /^(\s*)([-*+])\s+\[([ xX])\]\s+/.exec(line))) {
      add(start + match[1].length, start + match[1].length + 1, 'listMarker');
      const bracket = line.indexOf('[', match[1].length); add(start + bracket, start + bracket + 3, 'taskMarker');
    } else if (!tableLines.has(index) && (match = /^(\s*)([-*+]|\d+[.)])\s+/.exec(line))) {
      add(start + match[1].length, start + match[1].length + match[2].length, 'listMarker');
    } else if ((match = /^(\s*)(>+)\s?/.exec(line))) add(start + match[1].length, start + match[1].length + match[2].length, 'quoteMarker');

    const excluded = [];
    const accept = (from, to) => !overlaps(from, to, excluded);
    const matches = (regex, apply) => {
      for (const m of line.matchAll(regex)) {
        const end = m.index + m[0].length;
        if (!accept(m.index, end) || apply(m) === false) continue;
        excluded.push({ from: m.index, to: end });
      }
    };
    const groups = (m, roles) => {
      let position = start + m.index;
      roles.forEach((role, i) => { add(position, position + m[i + 1].length, role); position += m[i + 1].length; });
    };
    matches(/^\s*(<!--.*?-->)\s*$/g, m => {
      const pos = start + m.index + m[0].indexOf('<!--'); add(pos, pos + m[1].length, 'htmlComment');
    });
    matches(/(!\[)([^\]]*)(\]\()([^)]*)(\))/g, m => groups(m, ['imageMarker', 'linkText', 'imageMarker', 'linkURL', 'imageMarker']));
    matches(/(?<!!)(\[)([^\]]+)(\]\()([^)]+)(\))/g, m => groups(m, ['emphasisMarker', 'linkText', 'emphasisMarker', 'linkURL', 'emphasisMarker']));
    matches(/`([^`\n]+?)`/g, m => {
      if (line[m.index - 1] === '`' || line[m.index + m[0].length] === '`') return false;
      add(start + m.index, start + m.index + m[0].length, 'inlineCode');
    });
    const paired = (delimiter, role, single = false) => {
      const positions = [];
      for (let i = 0; i < line.length;) {
        if (!line.startsWith(delimiter, i)) { i++; continue; }
        if (single && line.startsWith(delimiter + delimiter, i)) { i += 2; continue; }
        positions.push(i); i += delimiter.length;
      }
      for (let i = 0; i + 1 < positions.length;) {
        const from = positions[i], end = positions[i + 1], to = end + delimiter.length;
        if (end <= from + delimiter.length || !accept(from, to)) { i++; continue; }
        add(start + from, start + from + delimiter.length, 'emphasisMarker');
        add(start + from + delimiter.length, start + end, role); add(start + end, start + to, 'emphasisMarker');
        excluded.push({ from, to }); i += 2;
      }
    };
    paired('~~', 'strikeText');
    matches(/(<u>)([^<]+)(<\/u>)/gi, m => groups(m, ['emphasisMarker', 'underlineText', 'emphasisMarker']));
    paired('**', 'strongText'); paired('__', 'strongText');
    paired('*', 'italicText', true); paired('_', 'italicText', true);
  }
  return spans.sort((a, b) => a.from - b.from || b.to - a.to);
}
