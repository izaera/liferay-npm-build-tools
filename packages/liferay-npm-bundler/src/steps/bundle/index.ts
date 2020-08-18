/**
 * SPDX-FileCopyrightText: © 2020 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import {ProjectType} from 'liferay-js-toolkit-core';
import webpack from 'webpack';

import {project} from '../../globals';
import * as log from '../../log';
import {abort} from '../../util';
import adaptBundlerProject from '../adapt/bundler-project';
import adaptFragment from '../adapt/fragment';
import ExplainedError from './ExplainedError';
import configure from './configure';
import run from './run';
import writeResults from './write-results';

/**
 * Run configured rules.
 */
export default async function bundle(): Promise<webpack.Stats> {
	log.debug('Using webpack at', require.resolve('webpack'));

	log.info('Configuring webpack build...');

	const options = configure();

	log.info('Running webpack...');

	const stats = await run(options);

	if (stats.hasErrors()) {
		abortWithErrors(stats);
	}

	writeResults(stats);

	log.info('Adapting webpack output to Liferay platform...');

	if (project.probe.type === ProjectType.FRAGMENT) {
		await adaptFragment();
	} else {
		await adaptBundlerProject();
	}

	log.info('Webpack phase finished successfully');

	return stats;
}

function abortWithErrors(stats: webpack.Stats): void {
	const {errors} = stats.compilation;

	errors.forEach((err) =>
		log.error(`${new ExplainedError(err).toString()}\n`)
	);

	abort(`Build failed: webpack build finished with errors`);
}