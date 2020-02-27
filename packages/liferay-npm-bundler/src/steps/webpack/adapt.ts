/**
 * © 2017 Liferay, Inc. <https://liferay.com>
 *
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import fs from 'fs-extra';
import FilePath from 'liferay-npm-build-tools-common/lib/file-path';
import project from 'liferay-npm-build-tools-common/lib/project';

import {buildBundlerDir, buildWebpackDir} from '../../dirs';
import * as log from '../../log';

const {pkgJson} = project;
const pkgId = `${pkgJson['name']}@${pkgJson['version']}`;

export default function adapt() {
	writeManifestModule();
	writeExportsModules();
	copyWebpackBundles();
	internalizeWebpackManifest();
	wrapBundles();
}

/**
 * Generates an AMD module to hold webpack manifest so that it is not placed in
 * `window["webpackJsonp"]`
 */
function writeManifestModule(): void {
	const selfModuleName = `${pkgId}/webpack.manifest`;

	fs.writeFileSync(
		buildBundlerDir.join(`webpack.manifest.js`).asNative,
		`Liferay.Loader.define(` +
			`'${selfModuleName}',` +
			`['module'],` +
			`function(module){\n` +
			`module.exports=[];\n` +
			`});`
	);

	log.debug(`Generated AMD module to hold webpack manifest`);
}

/**
 * Generates one AMD module per export. The generated module loads webpack's
 * runtime, the vendor bundle (common split) and the exported module itself.
 */
function writeExportsModules(): void {
	Object.entries(project.exports).forEach(([id, moduleName]) => {
		const moduleFile = buildBundlerDir.join(
			new FilePath(moduleName, {posix: true})
		);

		fs.ensureDirSync(moduleFile.dirname().asNative);

		const relativeBuildBundleDirPosixPath = moduleFile
			.dirname()
			.relative(buildBundlerDir).asPosix;

		const selfModuleName = `${pkgId}/${moduleName
			.replace('./', '')
			.replace(/\.js$/, '')}`;
		const runtimeBundleModuleName = `${relativeBuildBundleDirPosixPath}/runtime.bundle`;
		const vendorBundleModuleName = `${relativeBuildBundleDirPosixPath}/vendor.bundle`;
		const exportBundleModuleName = `${relativeBuildBundleDirPosixPath}/${id}.bundle`;

		fs.writeFileSync(
			moduleFile.asNative,
			`Liferay.Loader.define(` +
				`'${selfModuleName}',` +
				`[` +
				`'module',` +
				`'${runtimeBundleModuleName}',` +
				`'${vendorBundleModuleName}',` +
				`'${exportBundleModuleName}'` +
				`],` +
				`function(module,r,v,e){\n` +
				`module.exports=e;\n` +
				`});`
		);

		log.debug(`Generated AMD module ${moduleName}`);
	});
}

/**
 * Copy bundles generated by webpack from webpack's output dir to bundler's.
 */
function copyWebpackBundles() {
	['runtime', 'vendor', ...Object.keys(project.exports)].forEach(id => {
		const fileName = `${id}.bundle.js`;

		const content = fs
			.readFileSync(buildWebpackDir.join(fileName).asNative)
			.toString();

		fs.writeFileSync(buildBundlerDir.join(fileName).asNative, content);

		log.debug(`Copied ${id}.bundle.js to output directory`);
	});
}

/**
 * Internalize webpack manifest object (`window["webpackJsonp"]`) so that it is
 * contained in our generated AMD manifest module instead of polluting `window`
 */
function internalizeWebpackManifest(): void {
	const transform = (content: string): string =>
		content.replace(/window\["webpackJsonp"\]/g, '__WEBPACK_MANIFEST__');

	['runtime', 'vendor', ...Object.keys(project.exports)].forEach(id => {
		transformFile(`${id}.bundle.js`, transform);

		log.debug(`Internalized webpack manifest of ${id}.bundle.js`);
	});
}

/**
 * Wrap generated export bundles inside `Liferay.Loader.define()` calls.
 */
function wrapBundles(): void {
	['runtime', 'vendor', ...Object.keys(project.exports)].forEach(id => {
		const selfModuleName = `${pkgId}/${id}.bundle`;
		const webpackManifestModuleName = `./webpack.manifest`;

		const transform = (content: string): string =>
			`Liferay.Loader.define(` +
			`'${selfModuleName}',` +
			`[` +
			`'module',` +
			`'${webpackManifestModuleName}'` +
			`],` +
			`function(__MODULE__,__WEBPACK_MANIFEST__){\n` +
			content +
			`\n});`;

		transformFile(`${id}.bundle.js`, transform);

		log.debug(`Converted ${id}.bundle.js to AMD module`);
	});
}

/**
 * Helper function to transform a file inside bundle output directory.
 *
 * @param transform callback function to translate file content
 */
function transformFile(
	fileName: string,
	transform: {(content: string): string}
) {
	const content = fs
		.readFileSync(buildBundlerDir.join(fileName).asNative)
		.toString();

	fs.writeFileSync(
		buildBundlerDir.join(fileName).asNative,
		transform(content)
	);
}