import {expect} from 'chai';
import {Readable, Writable} from 'node:stream';
import {askForConfirmation} from '../../../../src/cli/commands/lock-release';

describe('askForConfirmation', () => {
    it('should return true when user types "y"', async () => {
        const mockStdin = new Readable({
            read() {
                this.push('y\n');
                this.push(null);
            }
        });

        const mockStdout = new Writable({
            write() {
                // Ignore output
            }
        });

        const result = await askForConfirmation('Test question: ', mockStdin, mockStdout);
        expect(result).to.be.true;
    });

    it('should return true when user types "yes"', async () => {
        const mockStdin = new Readable({
            read() {
                this.push('yes\n');
                this.push(null);
            }
        });

        const mockStdout = new Writable({
            write() {
                // Ignore output
            }
        });

        const result = await askForConfirmation('Test question: ', mockStdin, mockStdout);
        expect(result).to.be.true;
    });

    it('should return true when user types "Y" (uppercase)', async () => {
        const mockStdin = new Readable({
            read() {
                this.push('Y\n');
                this.push(null);
            }
        });

        const mockStdout = new Writable({
            write() {
                // Ignore output
            }
        });

        const result = await askForConfirmation('Test question: ', mockStdin, mockStdout);
        expect(result).to.be.true;
    });

    it('should return true when user types "YES" (uppercase)', async () => {
        const mockStdin = new Readable({
            read() {
                this.push('YES\n');
                this.push(null);
            }
        });

        const mockStdout = new Writable({
            write() {
                // Ignore output
            }
        });

        const result = await askForConfirmation('Test question: ', mockStdin, mockStdout);
        expect(result).to.be.true;
    });

    it('should return false when user types "n"', async () => {
        const mockStdin = new Readable({
            read() {
                this.push('n\n');
                this.push(null);
            }
        });

        const mockStdout = new Writable({
            write() {
                // Ignore output
            }
        });

        const result = await askForConfirmation('Test question: ', mockStdin, mockStdout);
        expect(result).to.be.false;
    });

    it('should return false when user types "no"', async () => {
        const mockStdin = new Readable({
            read() {
                this.push('no\n');
                this.push(null);
            }
        });

        const mockStdout = new Writable({
            write() {
                // Ignore output
            }
        });

        const result = await askForConfirmation('Test question: ', mockStdin, mockStdout);
        expect(result).to.be.false;
    });

    it('should return false when user presses enter (empty input)', async () => {
        const mockStdin = new Readable({
            read() {
                this.push('\n');
                this.push(null);
            }
        });

        const mockStdout = new Writable({
            write() {
                // Ignore output
            }
        });

        const result = await askForConfirmation('Test question: ', mockStdin, mockStdout);
        expect(result).to.be.false;
    });

    it('should trim whitespace and handle " y " as true', async () => {
        const mockStdin = new Readable({
            read() {
                this.push('  y  \n');
                this.push(null);
            }
        });

        const mockStdout = new Writable({
            write() {
                // Ignore output
            }
        });

        const result = await askForConfirmation('Test question: ', mockStdin, mockStdout);
        expect(result).to.be.true;
    });

    it('should return false for any other input', async () => {
        const mockStdin = new Readable({
            read() {
                this.push('maybe\n');
                this.push(null);
            }
        });

        const mockStdout = new Writable({
            write() {
                // Ignore output
            }
        });

        const result = await askForConfirmation('Test question: ', mockStdin, mockStdout);
        expect(result).to.be.false;
    });

    it('should use default output when not provided', async () => {
        // This tests the default parameter branch for output (line 119)
        // by explicitly passing undefined which triggers the || operator
        const mockStdin = new Readable({
            read() {
                this.push('n\n');
                this.push(null);
            }
        });

        // Call with undefined for output to trigger the || branch
        const result = await askForConfirmation('Test: ', mockStdin, undefined);
        expect(result).to.be.false;
    });

    it('should use default input when not provided', async () => {
        // This tests the default parameter branch for input (line 118)
        // by explicitly passing undefined which triggers the || operator
        const mockStdout = new Writable({
            write() {
                // Ignore output
            }
        });

        // Create a mock stdin
        const mockStdin = new Readable({
            read() {
                this.push('n\n');
                this.push(null);
            }
        });

        // Temporarily replace process.stdin for this test
        const originalStdin = Object.getOwnPropertyDescriptor(process, 'stdin');
        Object.defineProperty(process, 'stdin', {
            value: mockStdin,
            configurable: true,
            writable: true
        });

        try {
            // Call with undefined for input to trigger the || branch
            const result = await askForConfirmation('Test: ', undefined, mockStdout);
            expect(result).to.be.false;
        } finally {
            // Restore original stdin
            if (originalStdin) {
                Object.defineProperty(process, 'stdin', originalStdin);
            }
        }
    });

});

