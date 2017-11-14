/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert = require('assert');
import * as Path from 'path';
import {DebugClient} from 'vscode-debugadapter-testsupport';

suite('Node Debug Adapter', () => {

	const DEBUG_ADAPTER = './out/mockDebug.js';

	const PROJECT_ROOT = Path.join(__dirname, '../../');
	const DATA_ROOT = Path.join(PROJECT_ROOT, 'src/tests/data/');


	let dc: DebugClient;

	setup( () => {
		dc = new DebugClient('node', DEBUG_ADAPTER, 'mock');
		return dc.start();
	});

	teardown( () => dc.stop() );


	suite('basic', () => {

		test('unknown request should produce error', done => {
			dc.send('illegal_request').then(() => {
				done(new Error("does not report error on unknown request"));
			}).catch(() => {
				done();
			});
		});
	});

	suite('initialize', () => {

		test('should return supported features', () => {
			return dc.initializeRequest().then(response => {
				response.body = response.body || {};
				assert.equal(response.body.supportsConfigurationDoneRequest, true);
			});
		});

		test('should produce error for invalid \'pathFormat\'', done => {
			dc.initializeRequest({
				adapterID: 'mock',
				linesStartAt1: true,
				columnsStartAt1: true,
				pathFormat: 'url'
			}).then(response => {
				done(new Error("does not report error on invalid 'pathFormat' attribute"));
			}).catch(err => {
				// error expected
				done();
			});
		});
	});

	suite('launch', () => {

		test('should run program to the end', () => {

			const PROGRAM = Path.join(DATA_ROOT, 'test.pml');

			return Promise.all([
				dc.configurationSequence(),
				dc.launch({ program: PROGRAM, stepLimit: 500 }),
				dc.waitForEvent('terminated')
			]);
		});

		test('should stop on entry', () => {

			const PROGRAM = Path.join(DATA_ROOT, 'test.pml');
			const ENTRY_LINE = 10;

			return Promise.all([
				dc.configurationSequence(),
				dc.launch({ program: PROGRAM, stopOnEntry: true, stepLimit: 30 }),
				dc.assertStoppedLocation('entry', { line: ENTRY_LINE } )
			]);
		});
	});

	suite('setBreakpoints', () => {

		test('should stop on a breakpoint', () => {

			const PROGRAM = Path.join(DATA_ROOT, 'test.pml');
			const BREAKPOINT_LINE = 13;

			return dc.hitBreakpoint({ program: PROGRAM, stepLimit: 30 }, { path: PROGRAM, line: BREAKPOINT_LINE } );
		});
	});
});