/**
 * SPDX-FileCopyrightText: © 2020 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import fs from 'fs-extra';
import project, {PkgJson} from 'liferay-npm-build-tools-common/lib/project';
import path from 'path';

import {buildBundlerDir, buildGeneratedDir} from '../../dirs';
import * as log from '../../log';
import {findFiles} from '../../util/files';
import Renderer from '../../util/renderer';
import {SourceTransform, transformSourceFile} from '../../util/transform/js';
import wrapModule from '../../util/transform/js/operation/wrapModule';
import {transformJsonFile} from '../../util/transform/json';
import addPortletHeader from '../../util/transform/json/operation/addPortletHeader';
import {removeWebpackHash} from '../../util/webpack';
import exportModuleAsFunction from './transform/js/operation/exportModuleAsFunction';
import namespaceWepbackJsonp from './transform/js/operation/namespaceWepbackJsonp';

/**
 * Generate adapter modules based on templates.
 */
export async function processAdapterModules(): Promise<void> {
	const renderer = new Renderer(
		path.join(__dirname, project.probe.type, 'templates')
	);

	const {pkgJson} = project;

	await processAdapterModule(renderer, 'adapt-rt.js', {
		project,
	});
	await processAdapterModule(renderer, 'index.js', {
		pkgJson,
	});
}

/**
 * Process all webpack bundles to make them deployable.
 *
 * @param frameworkSpecificTransforms
 * underlying framework specific transforms to apply
 */
export async function processWebpackBundles(
	...frameworkSpecificTransforms: SourceTransform[]
): Promise<void> {
	const adaptBuildDir = project.dir.join(project.adapt.buildDir);

	const copiedBundles = findFiles(adaptBuildDir, ['static/js/*.js']);

	const {name, version} = project.pkgJson;

	await Promise.all(
		copiedBundles.map(async file => {
			const unhashedFile = removeWebpackHash(file);

			const fromFile = adaptBuildDir.join(file);
			const toFile = buildBundlerDir.join(unhashedFile);

			const moduleName = unhashedFile.asPosix.replace(/\.js$/g, '');

			await transformSourceFile(
				fromFile,
				toFile,
				...frameworkSpecificTransforms,
				namespaceWepbackJsonp(),
				exportModuleAsFunction(),
				wrapModule(`${name}@${version}/${moduleName}`)
			);
		})
	);

	log.debug(`Wrapped ${copiedBundles.length} webpack bundles`);
}

async function processAdapterModule(
	renderer: Renderer,
	templatePath: string,
	data: object
): Promise<void> {
	const fromFile = buildGeneratedDir.join(templatePath);
	const toFile = buildBundlerDir.join(templatePath);

	fs.writeFileSync(
		fromFile.asNative,
		await renderer.render(templatePath, data)
	);

	const {name, version} = project.pkgJson;

	const moduleName = templatePath.replace(/\.js$/i, '');

	await transformSourceFile(
		fromFile,
		toFile,
		wrapModule(`${name}@${version}/${moduleName}`)
	);

	log.debug(`Rendered ${templatePath} adapter module`);
}

export async function processPackageJson(
	cssPortletHeader: string
): Promise<void> {
	const fromFile = project.dir.join('package.json');
	const toFile = buildBundlerDir.join('package.json');

	await transformJsonFile<PkgJson>(
		fromFile,
		toFile,
		addPortletHeader(
			'com.liferay.portlet.header-portlet-css',
			cssPortletHeader
		)
	);
}