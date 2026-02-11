/**
 * Unit tests for FormatDetector
 */

import { describe, it, expect } from 'vitest';
import { FormatDetector } from '../../../../src/capabilities/documents/FormatDetector.js';

describe('FormatDetector', () => {
  describe('detect', () => {
    it('should detect PDF format', () => {
      const result = FormatDetector.detect('report.pdf');
      expect(result.format).toBe('pdf');
      expect(result.family).toBe('pdf');
      expect(result.mimeType).toBe('application/pdf');
      expect(result.confidence).toBe('high');
    });

    it('should detect DOCX format', () => {
      const result = FormatDetector.detect('document.docx');
      expect(result.format).toBe('docx');
      expect(result.family).toBe('office');
    });

    it('should detect XLSX format', () => {
      const result = FormatDetector.detect('spreadsheet.xlsx');
      expect(result.format).toBe('xlsx');
      expect(result.family).toBe('spreadsheet');
    });

    it('should detect PPTX format', () => {
      const result = FormatDetector.detect('slides.pptx');
      expect(result.format).toBe('pptx');
      expect(result.family).toBe('office');
    });

    it('should detect CSV format', () => {
      const result = FormatDetector.detect('data.csv');
      expect(result.format).toBe('csv');
      expect(result.family).toBe('spreadsheet');
    });

    it('should detect markdown format', () => {
      const result = FormatDetector.detect('README.md');
      expect(result.format).toBe('md');
      expect(result.family).toBe('text');
    });

    it('should detect JSON format', () => {
      const result = FormatDetector.detect('config.json');
      expect(result.format).toBe('json');
      expect(result.family).toBe('text');
    });

    it('should detect image formats', () => {
      expect(FormatDetector.detect('photo.png').family).toBe('image');
      expect(FormatDetector.detect('photo.jpg').family).toBe('image');
      expect(FormatDetector.detect('photo.jpeg').family).toBe('image');
      expect(FormatDetector.detect('photo.gif').family).toBe('image');
      expect(FormatDetector.detect('photo.webp').family).toBe('image');
      expect(FormatDetector.detect('logo.svg').family).toBe('image');
    });

    it('should detect HTML format', () => {
      const result = FormatDetector.detect('page.html');
      expect(result.format).toBe('html');
      expect(result.family).toBe('html');
    });

    it('should handle .htm extension', () => {
      const result = FormatDetector.detect('page.htm');
      expect(result.format).toBe('html');
    });

    it('should default to txt for unknown extensions', () => {
      const result = FormatDetector.detect('file.unknown');
      expect(result.format).toBe('txt');
      expect(result.family).toBe('text');
      expect(result.confidence).toBe('low');
    });

    it('should handle case-insensitive extensions', () => {
      expect(FormatDetector.detect('FILE.PDF').format).toBe('pdf');
      expect(FormatDetector.detect('Doc.DOCX').format).toBe('docx');
    });

    it('should handle files with no extension', () => {
      const result = FormatDetector.detect('README');
      expect(result.format).toBe('txt');
      expect(result.confidence).toBe('low');
    });

    it('should detect ODF formats', () => {
      expect(FormatDetector.detect('doc.odt').family).toBe('office');
      expect(FormatDetector.detect('slides.odp').family).toBe('office');
      expect(FormatDetector.detect('sheet.ods').family).toBe('office');
    });

    it('should detect RTF format', () => {
      const result = FormatDetector.detect('document.rtf');
      expect(result.format).toBe('rtf');
      expect(result.family).toBe('office');
    });
  });

  describe('isDocumentFormat', () => {
    it('should recognize document extensions with dot', () => {
      expect(FormatDetector.isDocumentFormat('.pdf')).toBe(true);
      expect(FormatDetector.isDocumentFormat('.docx')).toBe(true);
      expect(FormatDetector.isDocumentFormat('.xlsx')).toBe(true);
      expect(FormatDetector.isDocumentFormat('.txt')).toBe(true);
    });

    it('should recognize document extensions without dot', () => {
      expect(FormatDetector.isDocumentFormat('pdf')).toBe(true);
      expect(FormatDetector.isDocumentFormat('docx')).toBe(true);
    });

    it('should reject non-document extensions', () => {
      expect(FormatDetector.isDocumentFormat('.exe')).toBe(false);
      expect(FormatDetector.isDocumentFormat('.zip')).toBe(false);
      expect(FormatDetector.isDocumentFormat('.mp4')).toBe(false);
    });
  });

  describe('isBinaryDocumentFormat', () => {
    it('should recognize binary document formats', () => {
      expect(FormatDetector.isBinaryDocumentFormat('.pdf')).toBe(true);
      expect(FormatDetector.isBinaryDocumentFormat('.docx')).toBe(true);
      expect(FormatDetector.isBinaryDocumentFormat('.xlsx')).toBe(true);
      expect(FormatDetector.isBinaryDocumentFormat('.pptx')).toBe(true);
      expect(FormatDetector.isBinaryDocumentFormat('.png')).toBe(true);
    });

    it('should not flag text formats as binary', () => {
      expect(FormatDetector.isBinaryDocumentFormat('.txt')).toBe(false);
      expect(FormatDetector.isBinaryDocumentFormat('.md')).toBe(false);
      expect(FormatDetector.isBinaryDocumentFormat('.html')).toBe(false);
      expect(FormatDetector.isBinaryDocumentFormat('.csv')).toBe(false);
      expect(FormatDetector.isBinaryDocumentFormat('.json')).toBe(false);
    });
  });

  describe('isDocumentMimeType', () => {
    it('should recognize document MIME types', () => {
      expect(FormatDetector.isDocumentMimeType('application/pdf')).toBe(true);
      expect(FormatDetector.isDocumentMimeType('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true);
      expect(FormatDetector.isDocumentMimeType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(true);
    });

    it('should handle MIME types with parameters', () => {
      expect(FormatDetector.isDocumentMimeType('application/pdf; charset=utf-8')).toBe(true);
      expect(FormatDetector.isDocumentMimeType('text/csv; charset=utf-8')).toBe(true);
    });

    it('should reject non-document MIME types', () => {
      expect(FormatDetector.isDocumentMimeType('text/html')).toBe(false);
      expect(FormatDetector.isDocumentMimeType('application/json')).toBe(false);
      expect(FormatDetector.isDocumentMimeType('image/png')).toBe(false);
    });
  });

  describe('detectFromMimeType', () => {
    it('should detect PDF from MIME type', () => {
      const result = FormatDetector.detectFromMimeType('application/pdf');
      expect(result).not.toBeNull();
      expect(result!.format).toBe('pdf');
      expect(result!.family).toBe('pdf');
    });

    it('should detect CSV from MIME type', () => {
      const result = FormatDetector.detectFromMimeType('text/csv');
      expect(result).not.toBeNull();
      expect(result!.format).toBe('csv');
      expect(result!.family).toBe('spreadsheet');
    });

    it('should return null for unknown MIME types', () => {
      expect(FormatDetector.detectFromMimeType('application/octet-stream')).toBeNull();
      expect(FormatDetector.detectFromMimeType('text/html')).toBeNull();
    });
  });

  describe('getSupportedExtensions', () => {
    it('should return all supported extensions', () => {
      const extensions = FormatDetector.getSupportedExtensions();
      expect(extensions).toContain('.pdf');
      expect(extensions).toContain('.docx');
      expect(extensions).toContain('.xlsx');
      expect(extensions).toContain('.txt');
      expect(extensions).toContain('.png');
      expect(extensions.length).toBeGreaterThan(20);
    });
  });

  describe('getExtension', () => {
    it('should extract extension from filename', () => {
      expect(FormatDetector.getExtension('report.pdf')).toBe('.pdf');
      expect(FormatDetector.getExtension('path/to/file.docx')).toBe('.docx');
    });

    it('should handle files with multiple dots', () => {
      expect(FormatDetector.getExtension('file.backup.pdf')).toBe('.pdf');
    });

    it('should return empty string for no extension', () => {
      expect(FormatDetector.getExtension('README')).toBe('');
    });

    it('should lowercase extensions', () => {
      expect(FormatDetector.getExtension('FILE.PDF')).toBe('.pdf');
    });
  });
});
