import { describe, expect, it } from 'vitest';
import { selectRelevantPages, selectRelevantPassages } from './ragUtils';
import {
  extractDoiFromText,
  extractTitleCandidate,
  toBibtexEntry,
  authorsToArray,
  displayPaperTitle,
} from './biblioUtils';
import {
  resolveContextPapersForQuery,
  mapCitationFileToPaper,
  collectPapersInScope,
} from './corpusRetrieve';
import {
  chunkPageTexts,
  cosineSimilarity,
  lexicalScore,
  searchLibraryIndex,
  tokenize,
} from './libraryIndex';

describe('ragUtils', () => {
  const pages = [
    { page: 1, text: 'Introduction to lithium ion battery chemistry and cathodes.' },
    { page: 2, text: 'Methods for measuring ionic conductivity in solid electrolytes.' },
    { page: 3, text: 'Unrelated appendix about garden tomatoes and soil.' },
  ];

  it('selectRelevantPages ranks pages that overlap the query', () => {
    const selected = selectRelevantPages('battery cathode lithium', pages, { topN: 2, minScore: 0.01 });
    expect(selected[0].page).toBe(1);
    expect(selected.some((p) => p.page === 3)).toBe(false);
  });

  it('selectRelevantPassages returns excerpts under the char budget', () => {
    const passages = selectRelevantPassages('ionic conductivity electrolyte', pages, {
      topN: 2,
      maxExcerptChars: 80,
    });
    expect(passages.length).toBeGreaterThan(0);
    expect(passages[0].text.length).toBeLessThanOrEqual(90);
    expect(passages.some((p) => /conductivity|electrolyte/i.test(p.text))).toBe(true);
  });
});

describe('biblioUtils', () => {
  it('extracts DOI from page text', () => {
    expect(extractDoiFromText('See doi: 10.1038/s41586-020-2649-2 for details.')).toBe(
      '10.1038/s41586-020-2649-2'
    );
  });

  it('extracts a title candidate from first page lines', () => {
    const title = extractTitleCandidate(
      [{ page: 1, text: 'Abstract\nA Novel Solid State Battery\nJohn Doe\n' }],
      'file.pdf'
    );
    expect(title).toMatch(/Solid State Battery/i);
  });

  it('builds a bibtex entry', () => {
    const bib = toBibtexEntry(
      {
        title: 'Solid State Battery',
        authors: ['Ada Lovelace', 'Alan Turing'],
        year: '2020',
        doi: '10.1000/test',
        venue: 'Nature',
      },
      { name: 'solid-state.pdf' }
    );
    expect(bib).toContain('@article{');
    expect(bib).toContain('Solid State Battery');
    expect(bib).toContain('Ada Lovelace and Alan Turing');
    expect(bib).toContain('10.1000/test');
  });

  it('formats authors and display titles', () => {
    expect(authorsToArray('Ada Lovelace and Alan Turing')).toEqual(['Ada Lovelace', 'Alan Turing']);
    expect(displayPaperTitle({ name: 'file' }, { title: 'Real Title' })).toBe('Real Title');
  });
});

describe('corpusRetrieve', () => {
  const papers = [
    { id: 'a', name: 'Alpha' },
    { id: 'b', name: 'Beta' },
    { id: 'c', name: 'Gamma' },
  ];

  it('collects folder and library scopes', () => {
    expect(collectPapersInScope({ scopeMode: 'auto', activePaper: papers[0] })).toEqual([papers[0]]);
    expect(
      collectPapersInScope({
        scopeMode: 'folder',
        activeFolderPapers: papers.slice(0, 2),
      }).map((p) => p.id)
    ).toEqual(['a', 'b']);
    expect(
      collectPapersInScope({
        scopeMode: 'library',
        allPapers: papers,
      }).map((p) => p.id)
    ).toEqual(['a', 'b', 'c']);
  });

  it('maps citation file names to papers', () => {
    expect(mapCitationFileToPaper('Beta', papers)?.id).toBe('b');
    expect(mapCitationFileToPaper('Alpha.pdf', papers)?.id).toBe('a');
    expect(mapCitationFileToPaper('missing', papers)).toBeNull();
  });

  it('resolveContextPapersForQuery ranks via searchCorpus and stays bounded', async () => {
    const hits = await resolveContextPapersForQuery({
      query: 'battery',
      scopeMode: 'library',
      candidatePapers: papers,
      pinnedPapers: [papers[0]],
      limit: 2,
      searchCorpus: async () => [
        { paperId: 'c', paper: papers[2], score: 0.9 },
        { paperId: 'b', paper: papers[1], score: 0.8 },
      ],
    });
    expect(hits.map((p) => p.id)).toEqual(['a', 'c', 'b']);
  });

  it('resolveContextPapersForQuery keeps auto scope as-is', async () => {
    const hits = await resolveContextPapersForQuery({
      query: 'x',
      scopeMode: 'auto',
      candidatePapers: [papers[0]],
    });
    expect(hits).toEqual([papers[0]]);
  });
});

describe('libraryIndex', () => {
  it('tokenizes and scores lexically', () => {
    expect(tokenize('The battery cathode')).toEqual(['battery', 'cathode']);
    expect(lexicalScore(['battery'], 'solid state battery paper')).toBeGreaterThan(0);
  });

  it('chunks page texts', () => {
    const chunks = chunkPageTexts([{ page: 1, text: 'a'.repeat(2500) }], { maxChars: 1000 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].pageNum).toBe(1);
  });

  it('computes cosine similarity', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('searchLibraryIndex returns ranked papers', () => {
    const results = searchLibraryIndex({
      query: 'battery cathode',
      chunks: [
        {
          paperId: 'p1',
          folderId: 'f1',
          pageNum: 1,
          text: 'lithium ion battery cathode materials',
          embedding: null,
        },
        {
          paperId: 'p2',
          folderId: 'f1',
          pageNum: 1,
          text: 'tomato gardening tips',
          embedding: null,
        },
      ],
      papersById: {
        p1: { id: 'p1', name: 'Battery.pdf', folderId: 'f1' },
        p2: { id: 'p2', name: 'Garden.pdf', folderId: 'f1' },
      },
      metaById: {
        p1: { title: 'Battery Cathodes', authors: ['Doe'] },
      },
      foldersById: { f1: { id: 'f1', name: 'Energy' } },
      limit: 5,
    });
    expect(results[0].paperId).toBe('p1');
    expect(results[0].folderName).toBe('Energy');
  });
});
