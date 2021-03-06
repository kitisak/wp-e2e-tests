import webdriver from 'selenium-webdriver';
import config from 'config';
import assert from 'assert';

import * as driverManager from './driver-manager';
import * as mediaHelper from './media-helper';

const until = webdriver.until;

export default class BaseContainer {
	constructor( driver, expectedElementSelector, visit = false, url = null ) {
		this.screenSize = driverManager.currentScreenSize().toUpperCase();
		this.explicitWaitMS = config.get( 'explicitWaitMS' );
		this.driver = driver;
		this.expectedElementSelector = expectedElementSelector;
		this.url = url;
		if ( visit === true ) {
			this.driver.get( this.url );
		}
		this.waitForPage();
		this.checkForUnknownABTestKeys();
	}

	takeScreenShot() {
		if ( config.get( 'saveAllScreenshots' ) === true ) {
			const prefix = `BASE-CONTAINER-${this.screenSize}`;
			try {
				return this.driver.takeScreenshot().then( ( data ) => {
					mediaHelper.writeScreenshot( data, prefix );
				} );
			} catch ( e ) {
				console.log( `Error when taking screenshot in base container: '${e}'` );
			}
		}
	}

	waitForPage() {
		this.driver.wait( until.elementLocated( this.expectedElementSelector ), this.explicitWaitMS, 'Could not locate the ' + this.expectedElementSelector.value + ' element. Check that is is displayed.' );
	}

	displayed() {
		return this.driver.isElementPresent( this.expectedElementSelector );
	}

	title() {
		return this.driver.getTitle();
	}

	urlDisplayed() {
		return this.driver.getCurrentUrl();
	}

	checkForUnknownABTestKeys() {
		const knownABTestKeys = config.get( 'knownABTestKeys' );

		return this.driver.executeScript( 'return window.localStorage.ABTests;' ).then( ( abtestsValue ) => {
			for ( let key in JSON.parse( abtestsValue ) ) {
				let testName = key.split( '_' )[0];
				if ( knownABTestKeys.indexOf( testName ) < 0 ) {
					throw new Error( `Found an AB Testing key in local storage that isn\'t known: '${testName}'` );
				}
			}
		} );
	}
	setABTestControlGroupsInLocalStorage( culture ) {
		const freeTrialKey = 'freeTrials_20160120';
		const freeTrialValue = 'notOffered';
		const freePlansDefaultKey = 'freePlansDefault_20160218';
		const freePlansDefaultValue = 'allPlans';
		const privacyCheckBoxKey = 'privacyCheckbox_20160310';
		const privacyCheckBoxValue = 'original';
		const freeTrialsSignupKey = 'freeTrialsInSignup_20160328';
		const freeTrialsSignupValue = 'disabled';
		const triforceSignupKey = 'triforce_20160421';
		const triforceSignupValue = 'original';
		const domainsWithPlanKey = 'domainsWithPlansOnly_20160427';
		const domainsWithPlanValue = 'original';
		const guidedToursKey = 'guidedTours_20160428';
		const guidedToursValue = 'original';

		const flow = '"main"';

		const expectedABTestValue = `{"${freeTrialKey}":"${freeTrialValue}","${freePlansDefaultKey}":"${freePlansDefaultValue}","${privacyCheckBoxKey}":"${privacyCheckBoxValue}","${freeTrialsSignupKey }":"${freeTrialsSignupValue}","${triforceSignupKey}":"${triforceSignupValue}","${domainsWithPlanKey}":"${domainsWithPlanValue}","${guidedToursKey}":"${guidedToursValue}"}`;

		this.driver.executeScript( `window.localStorage.setItem('ABTests','${expectedABTestValue}');` );

		this.driver.executeScript( `window.localStorage.setItem('signupFlowName','${flow}');` );

		this.driver.getCurrentUrl().then( ( currentUrl ) => {
			const culturePath = `/${culture}`;
			let newUrl = currentUrl.replace( 'free-trial/', '' ); // remove the free-trial path from url as this overides local storage
			newUrl = newUrl.replace( 'upgrade/', '' ); // remove the upgrade path as this overrides local storage
			newUrl = newUrl.replace( 'layout/survey', '' ); // remove the layout path as this indicates Headstart, which is not yet supported in these tests
			newUrl = newUrl.replace( 'domains-with-premium/themes', '' ); // remove the domains with plans path

			if ( culture.toLowerCase() !== 'en' ) {
				if ( !newUrl.endsWith( culturePath ) ) {
					newUrl = newUrl + culturePath;
				}
			}

			if ( currentUrl !== newUrl ) {
				console.log( `Changing URLs for upgrade/free-trial/headstart/domainsPlan AB tests: OLD URL: '${ currentUrl }' NEW URL: '${ newUrl }'` );
			}

			this.driver.get( newUrl );
		} );

		this.driver.executeScript( 'return window.localStorage.signupFlowName;' ).then( ( flowValue ) => {
			assert.equal( flowValue, flow, 'The local storage value for flow wasn\'t set correctly' );
		} );

		this.driver.executeScript( 'return window.localStorage.ABTests;' ).then( ( abtestsValue ) => {
			assert.equal( abtestsValue, expectedABTestValue, 'The local storage value for AB Tests wasn\'t set correctly' );
		} );

		return this.waitForPage();
	}
}
