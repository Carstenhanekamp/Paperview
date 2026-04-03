import { describe, expect, it } from 'vitest';
import {
  evictUnpinnedPayloads,
  materializeFullText,
  mergePaperWithPayload,
  stripPaperPayload,
} from './paperPayloadUtils';

describe('paperPayloadUtils', () => {
  it('materializes page text into the Paperview full-text format', () => {
    expect(
      materializeFullText([
        { page: 1, text: 'Abstract text' },
        { page: 2, text: '' },
      ])
    ).toBe('--- Page 1 ---\nAbstract text\n\n--- Page 2 ---\n[No extractable text on this page]');
  });

  it('removes heavy payload fields from long-lived paper descriptors', () => {
    expect(
      stripPaperPayload({
        id: 'p1',
        name: 'Paper',
        pdfBytes: new Uint8Array([1, 2, 3]),
        pageTexts: [{ page: 1, text: 'hello' }],
        fullText: 'hello',
        pages: 9,
      })
    ).toEqual({
      id: 'p1',
      name: 'Paper',
      pages: 9,
    });
  });

  it('evicts every payload that is not pinned', () => {
    expect(
      evictUnpinnedPayloads(
        {
          a: { pdfBytes: new Uint8Array([1]) },
          b: { pdfBytes: new Uint8Array([2]) },
          c: { pdfBytes: new Uint8Array([3]) },
        },
        ['b']
      )
    ).toEqual({
      b: { pdfBytes: new Uint8Array([2]) },
    });
  });

  it('merges transient payloads back onto a descriptor when needed', () => {
    expect(
      mergePaperWithPayload(
        { id: 'p1', name: 'Paper' },
        { pdfBytes: new Uint8Array([9]), pageTexts: [{ page: 1, text: 'x' }] }
      )
    ).toEqual({
      id: 'p1',
      name: 'Paper',
      pdfBytes: new Uint8Array([9]),
      pageTexts: [{ page: 1, text: 'x' }],
    });
  });
});
