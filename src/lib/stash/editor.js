import { Annotation, Compartment, EditorState, StateField, Transaction } from '@codemirror/state';
import { Decoration, EditorView, keymap, placeholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { highlightMarkdown } from './markdown.js';

const remote = Annotation.define();
const highlights = text => Decoration.set(highlightMarkdown(text).map(({ from, to, role }) => Decoration.mark({ class: `md-${role}` }).range(from, to)), true);
const highlighting = StateField.define({
  create: state => highlights(state.doc.toString()),
  update: (value, transaction) => transaction.docChanged ? highlights(transaction.newDoc.toString()) : value,
  provide: field => EditorView.decorations.from(field),
});

export function createEditor(parent, onChange, onBlur, onComposition) {
  const editable = new Compartment();
  let enabled = false;
  const extensions = [
    highlighting, history(), keymap.of([...defaultKeymap, ...historyKeymap]),
    EditorView.lineWrapping, placeholder('输入或粘贴 Markdown 文本'),
    editable.of([EditorState.readOnly.of(true), EditorView.editable.of(false)]),
    EditorView.contentAttributes.of(view => ({ 'aria-label': '暂存内容', 'aria-multiline': 'true', 'aria-disabled': String(view.state.readOnly), spellcheck: 'false', autocapitalize: 'off' })),
    EditorView.updateListener.of(update => {
      if (update.docChanged && !update.transactions.every(t => t.annotation(remote))) onChange();
    }),
    EditorView.domEventHandlers({
      blur: () => { onBlur(); },
      compositionstart: () => { onComposition(true); },
      compositionend: () => { onComposition(false); },
    }),
  ];
  const view = new EditorView({ parent, state: EditorState.create({ extensions }) });
  return {
    reset() { enabled = false; view.setState(EditorState.create({ extensions })); },
    get value() { return view.state.doc.toString(); },
    set value(value) {
      if (value !== view.state.doc.toString()) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value }, annotations: [remote.of(true), Transaction.addToHistory.of(false)] });
    },
    get focused() { return view.hasFocus; },
    set disabled(value) {
      if (enabled === !value) return;
      enabled = !value;
      view.dispatch({ effects: editable.reconfigure([EditorState.readOnly.of(value), EditorView.editable.of(!value)]) });
    },
  };
}
