/* eslint-env node */
import path from 'node:path';
import fs from 'node:fs';
import { parse } from 'yaml';

const PREFIXES = ['/', './', '../', 'http://', 'https://'];

const YAML_EXTS = ['.yaml', '.yml'];

const JSON_EXTS = ['.json'];

const isYAML = path => YAML_EXTS.some(ext => path.toLowerCase().endsWith(ext));

const isJSON = path => JSON_EXTS.some(ext => path.toLowerCase().endsWith(ext));

const EXTERNAL_ERROR = 'Import specifier must NOT be present in the Rollup external config. Please remove specifier from the Rollup external config.';

const isBare = str => ! PREFIXES.some(pre => str.startsWith(pre));

const isString = str => typeof str === 'string';

const validate = ({ imports }, { external } = {}) => Object.entries(imports).map(([key, value]) => {
	if (isBare(value)) {
		throw Error(`Import specifier can NOT be mapped to a bare import statement. Import specifier "${key}" is being wrongly mapped to "${value}"`);
	} else if (external instanceof Function && external(key)) {
		throw Error(EXTERNAL_ERROR);
	} else if (Array.isArray(external) && external.includes(key)) {
		throw Error(EXTERNAL_ERROR);
	} else {
		return { key, value };
	}
});

const getFile = (pathname = '', options = {}) => new Promise((resolve, reject) => {
	const filepath = path.normalize(pathname);
	fs.promises.readFile(filepath, { encoding: 'utf8' }).then(file => {
		try {
			if (isYAML(filepath)) {
				const obj = parse(file);
				resolve(validate(obj, options));
			} else if (isJSON(filepath)) {
				const obj = JSON.parse(file);
				resolve(validate(obj, options));
			} else {
				throw new Error('Unsupported file type.');
			}
		} catch (error) {
			reject(error);
		}
	}).catch(reject);
});

export function rollupImport(importMaps = []) {
	const cache = new Map();
	const maps = Array.isArray(importMaps) ? importMaps : [importMaps];

	return {
		name: '@shgysk8zer0/rollup-import',
		// @TODO: Add `load()`
		async buildStart(options) {
			const mappings = maps.map(entry => isString(entry)
				? getFile(entry, options)
				: validate(entry, options)
			);

			await Promise.all(mappings).then(entries => {
				entries.forEach(entry => {
					entry.forEach(({ key, value }) => cache.set(key, value));
				});
			});
		},
		resolveId(id) {
			// @TODO: Store `options.external` and use for return value?
			return cache.has(id) ? { id: cache.get(id), external: false } : null;
		},
	};
}
