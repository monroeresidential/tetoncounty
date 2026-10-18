#!/usr/bin/env node
/**
 * Read Teton Flats' public data bundles without executing downloaded code.
 * Emits an editorial-review snapshot to stdout; never overwrites curated listings.
 * Usage: node scripts/import-tetonflats.mjs > /tmp/tetonflats-candidates.json
 * Offline parser check: node scripts/import-tetonflats.mjs --from-dir /tmp
 */
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const origin = 'https://tetonflats.com';
const sourcePages = {
  trails: ['/victor-id-hiking-guide'],
  activities: ['/things-to-do-victor-idaho', '/things-to-do-driggs-idaho'],
  restaurants: ['/victor-idaho-restaurants', '/driggs-idaho-restaurants'],
};

// This parser accepts only data literals. Function calls, interpolation, and
// executable expressions are rejected instead of evaluated in a VM or with eval.
function parseLiteral(text, start) {
  let index = start;
  const whitespace = () => { while (/\s/.test(text[index] || '') && index < text.length) index++; };
  const expect = (char) => {
    whitespace();
    if (text[index++] !== char) throw new Error(`Expected ${char} at ${index - 1}`);
  };
  function string() {
    const quote = text[index++];
    let value = '';
    while (index < text.length) {
      let char = text[index++];
      if (char === quote) return value;
      if (quote === '`' && char === '$' && text[index] === '{') throw new Error('Interpolation is not data');
      if (char === '\\') {
        char = text[index++];
        const escapes = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '0': '\0' };
        if (char === 'u' || char === 'x') {
          const width = char === 'u' ? 4 : 2;
          const hex = text.slice(index, index + width);
          if (!new RegExp(`^[0-9a-fA-F]{${width}}$`).test(hex)) throw new Error('Unsupported string escape');
          value += String.fromCharCode(parseInt(hex, 16));
          index += width;
        } else value += escapes[char] ?? char;
      } else value += char;
    }
    throw new Error('Unterminated string');
  }
  function value() {
    whitespace();
    const char = text[index];
    if (['`', '"', "'"].includes(char)) return string();
    if (char === '[') {
      index++;
      const result = [];
      whitespace();
      while (text[index] !== ']') {
        result.push(value());
        whitespace();
        if (text[index] !== ',') break;
        index++;
      }
      expect(']');
      return result;
    }
    if (char === '{') {
      index++;
      const result = Object.create(null);
      whitespace();
      while (text[index] !== '}') {
        whitespace();
        let key;
        if (['`', '"', "'"].includes(text[index])) key = string();
        else {
          const match = /^[a-zA-Z_$][\w$]*/.exec(text.slice(index));
          if (!match) throw new Error(`Invalid property at ${index}`);
          key = match[0];
          index += key.length;
        }
        expect(':');
        result[key] = value();
        whitespace();
        if (text[index] !== ',') break;
        index++;
      }
      expect('}');
      return result;
    }
    const number = /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/i.exec(text.slice(index));
    if (number) { index += number[0].length; return Number(number[0]); }
    for (const [word, literal] of [['true', true], ['false', false], ['null', null]]) {
      if (text.slice(index, index + word.length) === word) { index += word.length; return literal; }
    }
    throw new Error(`Unsupported data expression at ${index}`);
  }
  return value();
}

function extractRecords(source) {
  return [...source.matchAll(/\{(?:id|name):[`"']/g)].map((match) => parseLiteral(source, match.index));
}

async function fetchText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${response.status} while fetching ${url}`);
  return response.text();
}

const fromDir = process.argv[2] === '--from-dir' ? process.argv[3] : null;
if (process.argv.length > 2 && !fromDir) throw new Error('Usage: import-tetonflats.mjs [--from-dir DIRECTORY]');
const homepage = fromDir ? null : await fetchText(origin);
const localFiles = fromDir ? await readdir(fromDir) : [];
const groups = {};
for (const group of Object.keys(sourcePages)) {
  let bundleUrl;
  let source;
  if (fromDir) {
    const file = localFiles.find((name) => new RegExp(`^(?:tetonflats-)?${group}-[\\w-]+\\.js$`).test(name));
    if (!file) throw new Error(`No ${group} bundle in ${fromDir}`);
    source = await readFile(join(fromDir, file), 'utf8');
    bundleUrl = null;
  } else {
    const match = new RegExp(`/assets/${group}-[\\w-]+\\.js`).exec(homepage);
    if (!match) throw new Error(`Could not discover the ${group} data bundle; inspect the source page`);
    bundleUrl = new URL(match[0], origin).href;
    source = await fetchText(bundleUrl);
  }
  const candidates = extractRecords(source).map((record) => {
    // Keep factual review fields and source URLs, without republishing the
    // source's long promotional prose, reviews, or star ratings.
    const fields = ['id', 'name', 'cat', 'town', 'townLabel', 'address', 'location', 'area', 'seasons', 'url', 'photo', 'lat', 'lng', 'length', 'gain', 'diff'];
    return Object.fromEntries(fields.filter((key) => record[key] !== undefined).map((key) => [key, record[key]]));
  });
  if (!candidates.length) throw new Error(`No records found in ${group}; source format may have changed`);
  groups[group] = { count: candidates.length, sourcePages: sourcePages[group].map((path) => origin + path), bundleUrl, candidates };
}
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), sourceStatus: 'source-listed', note: 'Review candidates against data/tetonflats.json before updating. Source presence is not confirmation of current operations.', groups }, null, 2));
