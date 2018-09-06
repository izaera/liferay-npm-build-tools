import path from 'path';
import Generator from 'yeoman-generator';

import {Copier, PkgJsonModifier} from '../utils';

/**
 *
 */
export default class extends Generator {
	/**
	 */
	initializing() {
		this.sourceRoot(path.join(__dirname, 'templates'));
	}

	/**
	 */
	async prompting() {
		this.answers = await this.prompt([
			{
				type: 'confirm',
				name: 'createInitializer',
				message: 'Does your export bundle need an initializer?',
				default: false,
			},
		]);
	}

	/**
	 */
	writing() {
		if (!this.answers.createInitializer) {
			return;
		}

		const cp = new Copier(this);
		const pkgJson = new PkgJsonModifier(this);

		cp.copyFile('.babelrc');
		cp.copyFile('src/index.js', {
			context: {
				pkgJson: JSON.parse(this.fs.read('package.json')),
			},
		});

		pkgJson.addDevDependency('babel-cli', '^6.26.0');
		pkgJson.addDevDependency('babel-preset-env', '^1.7.0');
		pkgJson.addBuildStep('babel --source-maps -D -d build src');

		pkgJson.setMain('index.js');
	}
}
