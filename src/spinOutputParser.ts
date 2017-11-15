import { Transform } from 'stream';
import * as bsplit from 'buffer-split';
import { Buffer } from 'buffer';

export interface SpinStepError {
	/** program executed at this step */
	program: string;
	/** line executed at this step */
	line: number;
	/** raw output related with this step */
	rawOutput: string,
	/** flag to indicate the step is a error step */
	error: true
}

export interface SpinStep {
	/** number of this step */
	step: number;
	/** PID of proc executed at this step*/
	proc: number;
	/** name of a proc executed at this step*/
	procName: string;
	/** ID of a proc executed at this step */
	procID: number;
	/** program executed at this step */
	program: string;
	/** line executed at this step */
	line: number;
	/** state where this step jumps to */
	state: number;
	/** A map of variables updated at this step */
	updates: {
		queues: { [key: number]: string[]; }
		global: { [key: string]: string | string[]; }
		local: { [key: string]: string | string[]; }
	},
	/** raw output related with this step */
	rawOutput: string,
	/** flag to indicate the step is a error step */
	error: false
}

export default class SpinOutputParser extends Transform {
	private _buffer = new Buffer(0);
	private _currentStep = <SpinStep | SpinStepError | null> null;

	private static LINE_REGEX = /([0-9]+):\s+proc\s+([0-9]+)\s+\((.*):([0-9]+)\)\s+(.*):([0-9]+)\s+\(state\s+([0-9]+)\)/;
	private static QUEUE_REGEX = /queue\s+([0-9]+)\s+\((.*)\):\s+((\[.*?\])*)/;
	private static ASSIG_REGEX = /\s*(.*)\s+=\s+(.*)/;
	private static LOCAL_REGEX = /\s*.*\([0-9]+\):(.*)/;

	constructor() {
		super();
		this['_writableState'].objectMode = false; // buffer input
		this['_readableState'].objectMode = true; // object output
	}

	private _processBuffer() {
		const buffers = <Buffer[]> bsplit(this._buffer, new Buffer('\n'), true);
		this._buffer = buffers[buffers.length-1];

		for(const bufferLine of buffers) {
			const line = bufferLine.toString();
			if (this._currentStep !== null) {
				if(!line.trim()) { // empty line
					this.push(this._currentStep); // push the step
					this._currentStep = null;
				} else if (line.trim().startsWith('spin:')) {
					this._currentStep.rawOutput += line;
				} else if (this._currentStep.error) {
					this.push(this._currentStep); // push the error step
					this._currentStep = null;
					this.end(); // close stream on error
					break;
				} else { // parse a data line
					this._currentStep.rawOutput += line;
					const updates = (<SpinStep>this._currentStep).updates;

					const queueMatch = line.match(SpinOutputParser.QUEUE_REGEX);
					if(queueMatch !== null ) {
						const [,queue, variable, data] = queueMatch;

						const values = data.split(']').filter(x => x).map(s => s.slice(1));

						updates.queues[parseInt(queue, 10)] = values;

						if (variable.match(SpinOutputParser.LOCAL_REGEX)) {
							const key = variable.split(':')[1].trim();
							updates.local[key] = values;
						} else {
							updates.global[variable.trim()] = values;
						}
					}

					const assigMatch = line.match(SpinOutputParser.ASSIG_REGEX);
					if (assigMatch !== null) {
						const [,variable, value] = assigMatch;

						if (variable.match(SpinOutputParser.LOCAL_REGEX)) {
							const key = variable.split(':')[1].trim();
							updates.local[key] = value;
						} else {
							updates.global[variable.trim()] = value;
						}
					}
				}
			} else if(line.trim() === '-------------') {
				this.end() // close stream at end mark
				break;
			} else if(line.trim().startsWith('spin:')) {
				if (line.toLowerCase().includes('error')) {
					const matches = line.match(/spin:\s+(.*):([0-9]+)/);
					if(matches != null)
					this._currentStep = <SpinStepError> {
						program: matches[1].trim(),
						line: parseInt(matches[2], 10),
						rawOutput: line,
						error: true
					}
				}
			} else { // parse a step description line
				const matches = line.match(SpinOutputParser.LINE_REGEX);
				if (matches === null) continue;

				const [, step, proc, procName, procID, program, programLine, state] = matches;
				this._currentStep = <SpinStep> {
					step: parseInt(step, 10),
					proc: parseInt(proc, 10),
					procName,
					procID: parseInt(procID, 10),
					program,
					line: parseInt(programLine, 10),
					state: parseInt(state),
					updates: { queues: {}, local: {}, global: {} },
					rawOutput: line,
					error: false
				}
			}
		}
	}

	_flush(callback: (error?: Error, outputChunk?: any) => void) {
		if (this._currentStep)
			this.push(this._currentStep);
		callback();
	}

	_transform(chunk: any, encoding: string, callback: (error?: Error, outputChunk?: any) => void) {
		this._buffer = Buffer.concat([this._buffer, chunk]);
		this._processBuffer();
		callback();
	}
}