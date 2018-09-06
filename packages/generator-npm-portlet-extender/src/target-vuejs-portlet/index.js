import Generator from 'yeoman-generator';

/**
 *
 */
export default class extends Generator {
	/**
	 *
	 */
	initializing() {
		this.composeWith(require.resolve('../facet-project'));
		this.composeWith(require.resolve('../facet-portlet'));
		this.composeWith(require.resolve('../facet-deploy'));
		this.composeWith(require.resolve('./vue'));
	}

	/**
	 */
	writing() {}

	/**
	 */
	install() {
		this.installDependencies({
			bower: false,
		});
	}
}
