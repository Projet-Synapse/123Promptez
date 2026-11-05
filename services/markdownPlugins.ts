/**
 * Extensions markdown-it alignées sur 123Écriture (lib/editor/markdownPlugins) :
 * - `[[cible]]` / `[[cible|alias]]` → token `wikilink`
 * Gras / italique / gras+italique restent ceux de markdown-it (`*`, `_`, `**`, `***`, `**_…_**`).
 */
import MarkdownIt from 'markdown-it';

// Contrat minimal (évite l'import type StateInline fragile selon les .d.ts markdown-it).
interface InlineRuleState {
  src: string;
  pos: number;
  push(type: string, tag: string, nesting: number): { content: string; meta: unknown };
}
type StateInline = InlineRuleState;

function wikilinkRule(state: StateInline, silent: boolean): boolean {
  const { src, pos } = state;
  if (src.charCodeAt(pos) !== 0x5b /* [ */ || src.charCodeAt(pos + 1) !== 0x5b) return false;

  const end = src.indexOf(']]', pos + 2);
  if (end === -1) return false;
  const inner = src.slice(pos + 2, end).trim();
  if (!inner) return false;

  if (!silent) {
    const [target, alias] = inner.split('|');
    const token = state.push('wikilink', '', 0);
    token.content = (alias ?? target).trim();
    token.meta = { target: target.trim() };
  }
  state.pos = end + 2;
  return true;
}

/** Instance configurée pour le chat (html off, linkify on). */
export function createChatMarkdownIt(): MarkdownIt {
  const md = new MarkdownIt({ html: false, linkify: true, breaks: false, typographer: true });
  // Avant `link` pour que `[[…]]` ne soit pas mangé par la règle lien standard.
  md.inline.ruler.before('link', 'wikilink', wikilinkRule);
  return md;
}
