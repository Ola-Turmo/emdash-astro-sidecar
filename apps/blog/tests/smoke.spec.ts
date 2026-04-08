import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

test.describe('Blog Smoke Tests', () => {
  const distPath = join(process.cwd(), 'dist');
  
  test('dist directory exists and contains index.html', () => {
    expect(existsSync(distPath), 'dist directory should exist').toBe(true);
    
    const indexPath = join(distPath, 'index.html');
    expect(existsSync(indexPath), 'dist/index.html should exist').toBe(true);
  });

  test('index.html is valid and contains expected content', () => {
    const indexPath = join(distPath, 'index.html');
    const content = readFileSync(indexPath, 'utf-8');
    
    expect(content).toContain('<!DOCTYPE html>');
    expect(content).toContain('<title>EmDash Blog</title>');
    expect(content).toContain('EmDash');
  });

  test('index.html has proper meta tags', () => {
    const indexPath = join(distPath, 'index.html');
    const content = readFileSync(indexPath, 'utf-8');
    
    // Check essential meta tags
    expect(content).toContain('<meta charset="UTF-8">');
    expect(content).toContain('<meta name="viewport"');
    expect(content).toContain('og:title');
    expect(content).toContain('og:description');
  });

  test('index.html contains expected sections', () => {
    const indexPath = join(distPath, 'index.html');
    const content = readFileSync(indexPath, 'utf-8');
    
    // Check for main content sections
    expect(content).toContain('<header');
    expect(content).toContain('<main');
    expect(content).toContain('<footer');
    expect(content).toContain('Latest Articles');
  });
});
