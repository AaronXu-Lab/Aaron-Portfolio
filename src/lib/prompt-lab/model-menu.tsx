import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Menu } from '@aaronxu-lab/aaron-ui';
import '@aaronxu-lab/aaron-ui/styles.css';

type Entry = { id: string; model: string; reasoningEffort?: string };
const families = [
  { label: 'ChatGPT', matches: (model: string) => model.startsWith('GPT-') },
  { label: 'Claude', matches: (model: string) => /^(Opus|Fable|Sonnet|Haiku) /.test(model) },
  { label: 'Grok', matches: (model: string) => model.startsWith('Grok ') },
  { label: 'Gemini', matches: (model: string) => model.startsWith('Gemini ') },
];
const label = (entry: Entry) => `${entry.model} · ${entry.reasoningEffort?.trim() || '未提供'}`;

export function mountModelMenu(element: HTMLElement, entries: Entry[], initialId: string, onSelect: (id: string) => void) {
  function ModelMenu() {
    const [selected, setSelected] = useState(initialId);
    const current = entries.find(entry => entry.id === selected);
    return <Menu.Root>
      <Menu.Trigger className="model-trigger" disabled={!entries.length} aria-label={current ? `选择模型：${label(current)}` : '暂无作品'}>
        <span>{current ? label(current) : '暂无作品'}</span><span aria-hidden="true">⌄</span>
      </Menu.Trigger>
      <Menu.Popup width="md" aria-label="模型系列">
        {families.map(family => <Menu.Submenu key={family.label} label={family.label} backLabel={`返回 ${family.label}`}>
          <Menu.RadioGroup value={selected} onValueChange={id => { setSelected(id); onSelect(id); }}>
            {entries.filter(entry => family.matches(entry.model)).map(entry =>
              <Menu.RadioItem key={entry.id} value={entry.id} closeOnClick>{label(entry)}</Menu.RadioItem>
            )}
          </Menu.RadioGroup>
        </Menu.Submenu>)}
      </Menu.Popup>
    </Menu.Root>;
  }
  createRoot(element).render(<ModelMenu />);
}
