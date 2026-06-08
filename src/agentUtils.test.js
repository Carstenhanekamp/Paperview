import { describe, expect, it } from 'vitest';
import { normalizeParsedAgentResponse, normalizePaperResults, formatAvailableDocuments } from './agentUtils';

const opts = {
  targetChatId: 'chat1',
  normalizeUrl: (u) => (u ? (/^https?:\/\//i.test(u) ? u : `https://${u}`) : ''),
  summarize: (s) => String(s || '').slice(0, 10),
  isPdf: (u) => /\.pdf(?:[?#]|$)/i.test(String(u || '')),
};

describe('normalizeParsedAgentResponse', () => {
  it('parses a clean JSON answer object', () => {
    const result = normalizeParsedAgentResponse({ output_text: '{"answer":"hi","citations":[]}' });
    expect(result.parsedJson).toBe(true);
    expect(result.parsed.answer).toBe('hi');
  });

  it('recovers JSON when the model prefixes prose containing braces', () => {
    const raw = 'Here are the {EEG markers} I found: {"answer":"real","citations":[]}';
    const result = normalizeParsedAgentResponse({ output_text: raw });
    expect(result.parsedJson).toBe(true);
    expect(result.parsed.answer).toBe('real');
  });

  it('falls back to raw text when no valid JSON is present', () => {
    const result = normalizeParsedAgentResponse({ output_text: '```json\nnot really json\n```' });
    expect(result.parsedJson).toBe(false);
    expect(result.parsed.answer).toBe('not really json');
    expect(result.parsed.citations).toEqual([]);
  });
});

describe('normalizePaperResults', () => {
  it('normalises fields, parses authors, and keeps only PDF urls as pdfUrl', () => {
    const [paper] = normalizePaperResults(
      [{ title: 'A Study', authors: 'Smith, Jones', year: 2021, pdf_url: 'arxiv.org/x.pdf', source_url: 'arxiv.org/abs/x' }],
      opts
    );
    expect(paper.title).toBe('A Study');
    expect(paper.authors).toEqual(['Smith', 'Jones']);
    expect(paper.year).toBe('2021');
    expect(paper.pdfUrl).toBe('https://arxiv.org/x.pdf');
    expect(paper.sourceUrl).toBe('https://arxiv.org/abs/x');
  });

  it('clears pdfUrl when the url is not a direct PDF', () => {
    const [paper] = normalizePaperResults([{ title: 'Has html', pdf_url: 'example.com/landing' }], opts);
    expect(paper.pdfUrl).toBe('');
    expect(paper.title).toBe('Has html');
  });

  it('supplies a default title so entries are retained', () => {
    const results = normalizePaperResults([{ source_url: 'arxiv.org/abs/y' }], opts);
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Paper 1');
  });
});

describe('formatAvailableDocuments', () => {
  it('quotes and joins paper names', () => {
    expect(formatAvailableDocuments([{ name: 'a.pdf' }, { name: 'b.pdf' }])).toBe('"a.pdf", "b.pdf"');
  });

  it('returns "none" for an empty list', () => {
    expect(formatAvailableDocuments([])).toBe('none');
  });
});
