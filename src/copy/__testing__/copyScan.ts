import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

/**
 * Shielded UX part B (spec §3.1, §6): what a screen SAYS, read from its source. Used by
 * `src/copy/__tests__/*.test.ts`; not a test itself (Jest runs every file under `__tests__`, so
 * this lives in `__testing__`, like `modules/shielded/a0/__testing__`). Never imported by the app.
 *
 * A user-visible string is a string literal, a template literal (its fixed parts) or JSX text,
 * EXCEPT where the code uses it as a token rather than as copy:
 *   - import / export specifiers and anything in a type position;
 *   - the JSX attributes in NON_COPY_ATTRIBUTES (test ids, class names, colours, enum props);
 *   - arguments of cn / clsx / require / console.* / jest.*;
 *   - an operand of === / !==, a `case` label, an object key;
 *   - a lower-case token with no space (`'shielded'`, `'transparent'`, `'slip10:0'`).
 * Comments are never strings. accessibilityLabel IS copy (a screen reader says it).
 */

/** spec §2: the words that disappear from user-visible copy. A word glued to `-`, `+`, `/` or a letter is a token (`accent-shielded`, `noctura+shielded:`). */
export const BANNED_WORDS = /(?<![\w+/-])(?:un)?shield(?:ed|ing|s)?(?![\w-])|(?<![\w+/-])(?:transparent|vaults?)(?![\w-])/i;

/** spec §2 "Forbidden": no new copy may say or imply these (the last three: what implies it — review M-2 / I-5). */
export const FORBIDDEN_NEW: readonly RegExp[] = [
  /anonymous/i,
  /untraceable/i,
  /invisible/i,
  /fully private/i,
  /no one can see/i,
  /can(?:'|no)?t be traced/i,
  /hidden from everyone/i,
  /stays? private on-?chain/i,
];

const MACHINE_TOKEN = /^[a-z0-9_.:/#@-]*$/;
const NON_COPY_ATTRIBUTES = new Set([
  'testID',
  'nativeID',
  'key',
  'className',
  'contentContainerClassName',
  'color',
  'fill',
  'stroke',
  'placeholderTextColor',
  'variant',
  'tone',
  'mode',
  'kind',
  'name',
]);
const NON_COPY_CALLS = /^(cn|clsx|require|console\.\w+|jest\.\w+)$/;

export interface VisibleString {
  line: number;
  text: string;
}

export function userVisibleStrings(fileName: string, source: string): VisibleString[] {
  const sf = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const out: VisibleString[] = [];
  const notCopy = (node: ts.Node): boolean => {
    for (let p: ts.Node | undefined = node.parent; p !== undefined; p = p.parent) {
      if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isTypeNode(p)) return true;
      if (ts.isJsxAttribute(p)) return NON_COPY_ATTRIBUTES.has(p.name.getText(sf));
      if (ts.isCallExpression(p) && NON_COPY_CALLS.test(p.expression.getText(sf))) return true;
      if (
        ts.isBinaryExpression(p) &&
        (p.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
          p.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken)
      ) {
        return true;
      }
      if (ts.isCaseClause(p)) return true;
      if (ts.isPropertyAssignment(p) && p.name === node) return true;
      if (ts.isStatement(p)) return false;
    }
    return false;
  };
  const visit = (node: ts.Node): void => {
    let text: string | null = null;
    let jsx = false;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      text = node.text;
    } else if (ts.isTemplateExpression(node)) {
      text = [node.head.text, ...node.templateSpans.map(s => s.literal.text)].join(' ');
    } else if (ts.isJsxText(node)) {
      text = node.text.trim();
      jsx = true;
    }
    // JSX text is always copy (a lower-case fragment like "vault" between two expressions too)
    if (text !== null && text !== '' && (jsx || !MACHINE_TOKEN.test(text)) && !notCopy(node)) {
      out.push({line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, text});
    }
    if (ts.isTemplateExpression(node)) {
      node.templateSpans.forEach(s => visit(s.expression));
    } else {
      ts.forEachChild(node, visit);
    }
  };
  visit(sf);
  return out;
}

/** The banned strings of one source file. */
export function bannedStrings(fileName: string, source: string): VisibleString[] {
  return userVisibleStrings(fileName, source).filter(s => BANNED_WORDS.test(s.text));
}

/** spec §2 "Forbidden", over the user-visible strings only (a comment may name what it forbids). */
export function forbiddenClaims(fileName: string, source: string): string[] {
  const said = userVisibleStrings(fileName, source).map(s => s.text).join('\n');
  return FORBIDDEN_NEW.filter(re => re.test(said)).map(re => re.source);
}

/** Every `.ts` / `.tsx` under `dir`, outside `__tests__` and `__testing__`. */
export function walkSources(dir: string): string[] {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' || e.name === '__testing__' ? [] : walkSources(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}
