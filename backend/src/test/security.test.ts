import { describe, it, expect } from 'vitest';
import {
  sanitizeInput,
  detectSqlInjection,
  detectXss,
  validateProjectName,
  validateEmail,
  validateFileType,
  validateFileSize,
} from '../middleware/security';

describe('Security Utilities', () => {
  describe('sanitizeInput', () => {
    it('should remove script tags', () => {
      expect(sanitizeInput('<script>alert("xss")</script>hello')).toBe('hello');
    });

    it('should remove iframe tags', () => {
      expect(sanitizeInput('<iframe src="evil.com"></iframe>safe')).toBe('safe');
    });

    it('should remove javascript: protocol', () => {
      expect(sanitizeInput('javascript:alert(1)')).toBe('alert(1)');
    });

    it('should trim whitespace', () => {
      expect(sanitizeInput('  hello  ')).toBe('hello');
    });
  });

  describe('detectSqlInjection', () => {
    it('should detect UNION SELECT', () => {
      expect(detectSqlInjection('1 UNION SELECT * FROM users')).toBe(true);
    });

    it('should detect OR injection', () => {
      expect(detectSqlInjection("' OR '1'='1")).toBe(true);
    });

    it('should not flag normal text', () => {
      expect(detectSqlInjection('My Project Name')).toBe(false);
    });
  });

  describe('detectXss', () => {
    it('should detect script tags', () => {
      expect(detectXss('<script>alert(1)</script>')).toBe(true);
    });

    it('should detect event handlers', () => {
      expect(detectXss('<img onload="alert(1)">')).toBe(true);
    });

    it('should not flag normal text', () => {
      expect(detectXss('Hello World')).toBe(false);
    });
  });

  describe('validateProjectName', () => {
    it('should accept valid name', () => {
      expect(validateProjectName('My PDF Project').valid).toBe(true);
    });

    it('should reject empty name', () => {
      expect(validateProjectName('').valid).toBe(false);
    });

    it('should reject name with SQL injection', () => {
      expect(validateProjectName('test UNION SELECT * FROM users').valid).toBe(false);
    });

    it('should reject name with XSS', () => {
      expect(validateProjectName('<script>alert(1)</script>').valid).toBe(false);
    });

    it('should reject name over 255 chars', () => {
      expect(validateProjectName('a'.repeat(256)).valid).toBe(false);
    });
  });

  describe('validateEmail', () => {
    it('should accept valid email', () => {
      expect(validateEmail('user@example.com').valid).toBe(true);
    });

    it('should reject invalid email', () => {
      expect(validateEmail('not-an-email').valid).toBe(false);
    });

    it('should reject email without domain', () => {
      expect(validateEmail('user@').valid).toBe(false);
    });
  });

  describe('validateFileType', () => {
    it('should accept PDF', () => {
      expect(validateFileType('application/pdf')).toBe(true);
    });

    it('should reject non-PDF by default', () => {
      expect(validateFileType('image/png')).toBe(false);
    });

    it('should accept images when allowed', () => {
      expect(validateFileType('image/png', true)).toBe(true);
    });
  });

  describe('validateFileSize', () => {
    it('should accept valid size', () => {
      expect(validateFileSize(1024)).toBe(true);
    });

    it('should reject zero size', () => {
      expect(validateFileSize(0)).toBe(false);
    });

    it('should reject over 50MB', () => {
      expect(validateFileSize(51 * 1024 * 1024)).toBe(false);
    });
  });
});
