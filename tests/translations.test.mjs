import test from 'node:test';
import assert from 'node:assert/strict';
import {labelsFor,uiTranslations} from '../src/translations.mjs';
test('Bulgarian and English label keys match',()=>{assert.deepEqual(Object.keys(uiTranslations.bg).sort(),Object.keys(uiTranslations.en).sort());assert.ok(Object.values(uiTranslations.bg).every(Boolean));assert.ok(Object.values(uiTranslations.en).every(Boolean));});
test('unsupported language falls back to Bulgarian',()=>{assert.equal(labelsFor('fr'),uiTranslations.bg);assert.equal(labelsFor('en'),uiTranslations.en);});
