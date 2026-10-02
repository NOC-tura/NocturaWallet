import {CSS_LANGUAGE, isStylesheet, scanCss} from '../css-scan.mjs';

// Fix round 4: the vault page's sheets are read by a small tokenizer, not by patterns — the patterns
// skipped a quote inside quotes (`url("https://x/a'b")`) and a comment inside a name (`ur/**/l(`).
describe('scanCss', () => {
  it('reads url() targets: unquoted, single- and double-quoted, a quote inside the other quotes, escapes', () => {
    expect(scanCss('.a{background:url(https://x/a)}').urls).toEqual(['https://x/a']);
    expect(scanCss(".a{background:url( 'https://x/a' )}").urls).toEqual(['https://x/a']);
    expect(scanCss('.a{background:url("https://x/a\'b")}').urls).toEqual(["https://x/a'b"]);
    expect(scanCss(".a{background:url('https://x/a\"b')}").urls).toEqual(['https://x/a"b']);
    expect(scanCss('.a{background:url("https://x/a\\"b")}').urls).toEqual(['https://x/a"b']);
    expect(scanCss('.a{background:URL(https://x/a)}').urls).toEqual(['https://x/a']);
  });

  it('removes a comment to nothing, so a comment inside a name hides nothing', () => {
    expect(scanCss('.a{background:ur/**/l(https://x/a)}').urls).toEqual(['https://x/a']);
    expect(scanCss('@im/* x */port "a.css";').imports).toEqual(['a.css']);
    expect(scanCss('.a{background:image/**/-set("https://x/a" 1x)}').loaders).toEqual(['image-set']);
  });

  it('keeps an unquoted url() body whole — a comment inside it is part of the URL, as in CSS', () => {
    expect(scanCss('.a{background:url(/*x*/https://x/a)}').urls).toEqual(['/*x*/https://x/a']);
    expect(scanCss('.a{background:url(https://x/a').urls).toEqual(['https://x/a']);
  });

  it('a comment or a url( inside a string is text, not code', () => {
    expect(scanCss('.a::before{content:"url(https://x/a) @import /*"}.b{color:red}')).toEqual({imports: [], urls: [], loaders: [], escapes: false});
    expect(scanCss('.a{font-family:"/*"}.b{background:url(https://x/b)}').urls).toEqual(['https://x/b']);
  });

  it('reads @import in every form', () => {
    expect(scanCss("@import '../app/app.css';").imports).toEqual(['../app/app.css']);
    expect(scanCss('@import url("../app/app.css") screen;').imports).toEqual(['../app/app.css']);
    expect(scanCss('@IMPORT url(../app/app.css);').imports).toEqual(['../app/app.css']);
    expect(scanCss('@import layer(x);').imports).toEqual(['']);
  });

  it('names every other function that loads a URL without url()', () => {
    expect(scanCss('.a{background:image-set("a.png" 1x)}').loaders).toEqual(['image-set']);
    expect(scanCss('.a{background:-webkit-image-set("a.png" 1x)}').loaders).toEqual(['-webkit-image-set']);
    expect(scanCss('.a{background:image("a.png")}').loaders).toEqual(['image']);
    expect(scanCss('.a{background:cross-fade(url(a.png),url(b.png))}').loaders).toEqual(['cross-fade']);
    expect(scanCss('.a{background:src("a.png")}').loaders).toEqual(['src']);
  });

  it('flags any backslash: an escape can spell url( or @import', () => {
    expect(scanCss('.a{background:\\75rl(https://x/a)}').escapes).toBe(true);
    expect(scanCss('.a{content:"\\2014"}').escapes).toBe(true);
    expect(scanCss('.a{color:red}').escapes).toBe(false);
  });

  it('reads the real font faces as the two Geist urls and nothing else (negative control)', () => {
    const css = "@font-face{font-family:'Geist';src:url('/fonts/Geist-Variable.woff2') format('woff2-variations');}\n" +
      '@font-face{font-family:"Geist Mono";src:url("/fonts/GeistMono-Variable.woff2") format("woff2-variations")}\n.x{display:flex}';
    expect(scanCss(css)).toEqual({imports: [], urls: ['/fonts/Geist-Variable.woff2', '/fonts/GeistMono-Variable.woff2'], loaders: [], escapes: false});
  });
});

describe('isStylesheet', () => {
  it.each(['a.css', 'a.pcss', 'a.postcss', 'a.scss', 'a.sass', 'a.less', 'a.styl', 'a.stylus', 'a.sss', 'A.PCSS', 'a.module.scss'])('%s is a stylesheet', p => {
    expect(isStylesheet(p)).toBe(true);
  });

  it.each(['a.ts', 'a.css.ts', 'a.json', 'a.svg', 'acss'])('%s is not', p => {
    expect(isStylesheet(p)).toBe(false);
  });

  it('names every CSS language Vite compiles', () => {
    expect(CSS_LANGUAGE).toEqual(['css', 'pcss', 'postcss', 'scss', 'sass', 'less', 'styl', 'stylus', 'sss']);
  });
});
