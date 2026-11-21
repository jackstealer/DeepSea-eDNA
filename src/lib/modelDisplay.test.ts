import { expect, test } from 'vitest';
import { displayModelUri, formatModelVersion } from './utils';

test('versions get exactly one "v"', () => {
  expect(formatModelVersion('v2.1')).toBe('v2.1');
  expect(formatModelVersion('3')).toBe('v3');
  expect(formatModelVersion(2)).toBe('v2');
});

test('registry URIs are shown as-is', () => {
  expect(displayModelUri('models:/marine-edna-classifier@champion')).toBe('models:/marine-edna-classifier@champion');
  expect(displayModelUri('runs:/abc123/model')).toBe('runs:/abc123/model');
});

test('local file paths never expose the machine path or user name', () => {
  expect(displayModelUri(String.raw`C:\Users\ATUL\Desktop\DeepSea-eDNA-AI-main\ml_models\marine_model`)).toBe('…/ml_models/marine_model');
  expect(displayModelUri('/home/someone/app/ml_models/marine_model')).toBe('…/ml_models/marine_model');
  expect(displayModelUri('ml_models/marine_model')).toBe('ml_models/marine_model');
});
