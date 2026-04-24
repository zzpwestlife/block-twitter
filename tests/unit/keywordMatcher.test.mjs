/**
 * Unit tests for KeywordMatcher.match
 * Run: node tests/unit/keywordMatcher.test.mjs
 * Requires Node 18+ (uses built-in node:test)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Inline KeywordMatcher from content.js to avoid browser-global dependencies
class KeywordMatcher {
  static match(text, keywords) {
    if (!text || !keywords || keywords.length === 0) return [];

    const lowercaseText = text.toLowerCase();
    const matched = [];

    for (const keyword of keywords) {
      if (!keyword || typeof keyword !== 'string') continue;

      const lowercaseKeyword = keyword.toLowerCase();
      // Non-ASCII (CJK, emoji, etc.) → substring match; ASCII → word boundary
      const hasNonAscii = /[^\x00-\x7F]/.test(keyword);

      let matches = false;
      if (hasNonAscii) {
        const stripObfuscation = (s) => s.replace(
          /[̀-ͯༀ-࿿​‌‎‏⁠-⁯︀-️]/g,
          ''
        );
        const normalize = (s) =>
          stripObfuscation(s).replace(/[^\S\n]*\n[^\S\n]*/g, '\n');
        matches = normalize(lowercaseText).includes(normalize(lowercaseKeyword));
      } else {
        const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        matches = regex.test(lowercaseText);
      }

      if (matches && !matched.includes(keyword)) matched.push(keyword);
    }

    return matched;
  }
}

describe('KeywordMatcher.match — emoji', () => {
  it('emoji 组合关键词命中文本中的相同 emoji', () => {
    const result = KeywordMatcher.match('大家好 🐷😊😄 今天天气', ['🐷😊😄']);
    assert.deepEqual(result, ['🐷😊😄']);
  });

  it('emoji 组合关键词不在文本中时返回空', () => {
    const result = KeywordMatcher.match('今天天气不错', ['🐷😊😄']);
    assert.deepEqual(result, []);
  });

  it('单个 emoji 关键词命中', () => {
    const result = KeywordMatcher.match('🐷😊😄 这个用户是水军', ['🐷']);
    assert.deepEqual(result, ['🐷']);
  });

  it('emoji + 中文混合关键词命中', () => {
    const result = KeywordMatcher.match('今天 🚫 水军 出没', ['🚫 水军']);
    assert.deepEqual(result, ['🚫 水军']);
  });

  it('部分 emoji 不误命中完整 emoji 组合', () => {
    // 文本里只有 🐷，关键词是 🐷😊😄，不应命中
    const result = KeywordMatcher.match('这里只有 🐷 一个猪', ['🐷😊😄']);
    assert.deepEqual(result, []);
  });
});

describe('KeywordMatcher.match — CJK（回归）', () => {
  it('中文关键词命中', () => {
    const result = KeywordMatcher.match('这是诈骗信息请注意', ['诈骗']);
    assert.deepEqual(result, ['诈骗']);
  });

  it('中文关键词不在文本中时返回空', () => {
    const result = KeywordMatcher.match('今天天气很好', ['诈骗']);
    assert.deepEqual(result, []);
  });
});

describe('KeywordMatcher.match — ASCII word boundary（回归）', () => {
  it('英文关键词精确命中', () => {
    const result = KeywordMatcher.match('this is a scam message', ['scam']);
    assert.deepEqual(result, ['scam']);
  });

  it('英文关键词不误命中子串（disclaimer 不含 claim）', () => {
    const result = KeywordMatcher.match('read the disclaimer', ['claim']);
    assert.deepEqual(result, []);
  });

  it('多关键词同时命中', () => {
    const result = KeywordMatcher.match('spam and scam detected', ['spam', 'scam']);
    assert.deepEqual(result, ['spam', 'scam']);
  });
});

describe('KeywordMatcher.match — obfuscation stripping', () => {
  it('Tibetan combining vowels between emoji are stripped (real spam case)', () => {
    // Twitter DOM contains 💛ྀུ🌿, keyword is plain 💛🌿
    const spamText = '\u{1F49B}ྀུ\u{1F33F}\n\u{1F437}\u{1F60A}\u{1F604}';
    const result = KeywordMatcher.match(spamText, ['💛🌿\n🐷😊😄']);
    assert.deepEqual(result, ['💛🌿\n🐷😊😄']);
  });

  it('ZWJ is preserved — compound emoji keyword still matches', () => {
    // 👨‍👩‍👧 uses ZWJ; should not be broken by stripping
    const result = KeywordMatcher.match('family \u{1F468}‍\u{1F469}‍\u{1F467} here', ['\u{1F468}‍\u{1F469}‍\u{1F467}']);
    assert.deepEqual(result, ['\u{1F468}‍\u{1F469}‍\u{1F467}']);
  });

  it('zero-width space between emoji is stripped', () => {
    const result = KeywordMatcher.match('💛​🌿', ['💛🌿']);
    assert.deepEqual(result, ['💛🌿']);
  });

  it('variation selector on emoji is stripped from both sides', () => {
    // Twitter img alt may include variation selector; keyword typically won't
    const result = KeywordMatcher.match('💛️🌿', ['💛🌿']);
    assert.deepEqual(result, ['💛🌿']);
  });
});

describe('KeywordMatcher.match — newline in keyword', () => {
  it('含换行的 emoji 组合命中（帖子只有5个emoji加回车）', () => {
    // Twitter <br> → \n 之后，提取的文本是 "💛🌿\n🐷😊😄"
    const postText = '💛🌿\n🐷😊😄';
    const result = KeywordMatcher.match(postText, ['💛🌿\n🐷😊😄']);
    assert.deepEqual(result, ['💛🌿\n🐷😊😄']);
  });

  it('换行前后有空格时仍然命中（normalize 空白）', () => {
    // Twitter DOM 里 <br> 前后可能有空白 text node
    const result = KeywordMatcher.match('💛🌿 \n 🐷😊😄', ['💛🌿\n🐷😊😄']);
    assert.deepEqual(result, ['💛🌿\n🐷😊😄']);
  });

  it('换行前后有 tab 时仍然命中', () => {
    const result = KeywordMatcher.match('💛🌿\t\n\t🐷😊😄', ['💛🌿\n🐷😊😄']);
    assert.deepEqual(result, ['💛🌿\n🐷😊😄']);
  });

  it('无换行的文本不命中含换行的关键词', () => {
    const result = KeywordMatcher.match('💛🌿🐷😊😄', ['💛🌿\n🐷😊😄']);
    assert.deepEqual(result, []);
  });

  it('含换行的关键词不命中顺序不同的文本', () => {
    const result = KeywordMatcher.match('🐷😊😄\n💛🌿', ['💛🌿\n🐷😊😄']);
    assert.deepEqual(result, []);
  });
});

describe('KeywordMatcher.match — edge cases', () => {
  it('空文本返回空', () => {
    assert.deepEqual(KeywordMatcher.match('', ['scam']), []);
  });

  it('空关键词列表返回空', () => {
    assert.deepEqual(KeywordMatcher.match('some text', []), []);
  });

  it('关键词去重', () => {
    const result = KeywordMatcher.match('🐷 here', ['🐷', '🐷']);
    assert.deepEqual(result, ['🐷']);
  });
});
