import assert = require('assert');
import * as fs from 'fs';
import * as Path from 'path';
import SpinOutputParser, { SpinStep, SpinStepError } from '../spinOutputParser';

suite('Spin Output Parser', () => {

	const PROJECT_ROOT = Path.join(__dirname, '../../');
	const DATA_ROOT = Path.join(PROJECT_ROOT, 'src/tests/data/');

	suite('basic', () => {
		const SAMPLE_OUTPUT = Path.join(DATA_ROOT, 'sampleOutput.txt');

		test('should parse the first step', () => {
			const spinOutput = fs.createReadStream(SAMPLE_OUTPUT);
			const spinParser = new SpinOutputParser();
			return new Promise((resolve, reject) => {
				spinOutput.pipe(spinParser)
				.once('data', (step: SpinStep) => {
					assert.deepEqual(step, <SpinStep>{
						step: 1,
						proc: 0,
						procID: 1,
						procName: 'test',
						program: 'src/tests/data/test.pml',
						line: 5,
						state: 1,
						updates: {
							global: {
								flag: 1
							},
							local: {}
						},
						rawOutput: '  1:\tproc  0 (test:1) src/tests/data/test.pml:5 (state 1)\t[flag = (1-flag)]\n\t\tflag = 1\n',
						error: false
					})
					resolve(true);
				})
			})
		});

		test('should parse all steps', () => {
			const spinOutput = fs.createReadStream(SAMPLE_OUTPUT);
			const spinParser = new SpinOutputParser();
			return new Promise((resolve, reject) => {
				let count = 0;
				spinOutput.pipe(spinParser)
					.on('data', (step: SpinStep) => { count++; })
					.once('end', () => {
						assert.equal(count, 10);
						resolve();
					})
			})
		});
	});

	suite('with error', () => {
		const SAMPLE_OUTPUT = Path.join(DATA_ROOT, 'sampleOutputWithError.txt');

		test('last step should be a error', () => {
			const spinOutput = fs.createReadStream(SAMPLE_OUTPUT);
			const spinParser = new SpinOutputParser();
			return new Promise((resolve, reject) => {
				let last: SpinStepError | SpinStep;
				spinOutput.pipe(spinParser)
					.on('data', (step: SpinStep | SpinStepError) => { last = step })
					.once('end', () => {
						assert.deepEqual(last, <SpinStepError>{
							program: 'tests/data/test.pml',
							line: 18,
							rawOutput: 'spin: tests/data/test.pml:18, Error: assertion violated\nspin: text of failed assertion: assert((ncrit==0))\n',
							error: true
						});
						resolve();
					})
			})
		});
	});
});