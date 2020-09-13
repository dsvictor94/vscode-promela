import * as vscode from "vscode";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import * as cp from "child_process";
import * as rimraf from 'rimraf';

function isFileUri(uri: vscode.Uri): boolean {
  return uri.scheme === "file";
}

export class PromelaSyntaxChecker {
  private diag: vscode.DiagnosticCollection;

  constructor(diagnostics: vscode.DiagnosticCollection) {
    this.diag = diagnostics;
  }

  public execute(document: vscode.TextDocument, onComplete?: () => void): void {
    const config = vscode.workspace.getConfiguration("promela");

    if (
      document.languageId !== "promela" ||
      document.isUntitled ||
      !isFileUri(document.uri) ||
      config.get("spin") === null
    ) {
      return;
    }

    const spinPath = config.get("spin", "spin");

    const fileName = document.fileName;
    const uri = document.uri;

    fs.mkdtemp(path.join(os.tmpdir(), 'promela-vscode-'), (err, tmpdir) => {
      if (err) {
        return;
      }

      const spinProcess = cp.spawn(
        spinPath,
        ["-a", fileName],
        {
          cwd: tmpdir,
        }
      );

      const spinOut: Buffer[] = [];
      spinProcess.stdout.on('data', (data: Buffer) => { spinOut.push(data); });

      const spinErr: Buffer[] = [];
      spinProcess.stderr.on('data', (data: Buffer) => { spinErr.push(data); });

      spinProcess.on('exit', (code, signal) => {
        rimraf(tmpdir, (err) => { if (err) { console.error(err); } });

        // extract the problems from output
        const diagnostics: vscode.Diagnostic[] = [];

        const errLines = Buffer.concat(spinErr).toString('utf8').split('\n');
        for (const line of errLines) {
          const found = line.match(/(.+):(\d+): error: (.*)/);
          if (found) {
            const linum = parseInt(found[2]);
            const message = found[3].trim();
            const range = new vscode.Range(linum - 1, 0, linum - 1, 0);
            const diagnostic = new vscode.Diagnostic(
              range,
              message,
              vscode.DiagnosticSeverity.Error
            );
            diagnostics.push(diagnostic);
          }
        }

        const outLines = Buffer.concat(spinOut).toString('utf8').split('\n');
        for (const line of outLines) {
          const found = line.match(/spin: (.+):(\d+), Error: ([^:]*)/);
          if (found) {
            const linum = parseInt(found[2]);
            const error = found[3].trim();
            const range = new vscode.Range(linum - 1, 0, linum - 1, Number.MAX_VALUE);

            let message = error;
            if (error.startsWith("syntax error")) {
              message = "syntax error";
            }

            const diagnostic = new vscode.Diagnostic(
              range,
              message,
              vscode.DiagnosticSeverity.Error
            );
            diagnostics.push(diagnostic);
          }
        }

        this.diag.set(uri, diagnostics);

        if (onComplete !== undefined) {
          onComplete();
        }
      });

      spinProcess.on('error', (error) => {
        vscode.window.showWarningMessage(`${spinPath} is not executable`, 'Configure spin path').then((item) => {
          if (!item) {
            return;
          }

          vscode.commands.executeCommand('workbench.action.openSettings', 'promela.spin');
        });
      });
    });
  }
}
