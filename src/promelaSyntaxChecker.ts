import * as vscode from "vscode";
import * as os from "os";
import * as cp from "child_process";

function isFileUri(uri: vscode.Uri): boolean {
  return uri.scheme === "file";
}

export class PromelaSyntaxChecker {
  private diag: vscode.DiagnosticCollection;

  constructor(diagnostics: vscode.DiagnosticCollection) {
    this.diag = diagnostics;
  }

  public execute(document: vscode.TextDocument, onComplete?: () => void): void {
    if (
      document.languageId !== "promela" ||
      document.isUntitled ||
      !isFileUri(document.uri)
    ) {
      return;
    }

    const fileName = document.fileName;
    const uri = document.uri;

    let onDidExec = (error: Error, stdout: string, stderr: string) => {
      if (this.hasError(error, stderr)) {
        return;
      }

      // Cleanup Old Problems
      this.diag.delete(uri);
      const lines = stdout.split("\n");
      let diagnostics: vscode.Diagnostic[] = [];
      for (const line of lines) {
        const found = line.match(/spin: (.+):(\d+), Error: syntax error	(.*)/);
        if (found) {
          const linum = parseInt(found[2]);
          const message = found[3];
          const range = new vscode.Range(linum - 1, 0, linum - 1, 0);
          const diagnostic = new vscode.Diagnostic(
            range,
            message,
            vscode.DiagnosticSeverity.Error
          );
          diagnostics.push(diagnostic);
        }
      }

      this.diag.set(uri, diagnostics);
    };

    cp.exec(
      "spin -a " + fileName,
      {
        cwd: os.tmpdir(),
      },
      onDidExec
    );
  }

  public clear(document: vscode.TextDocument): void {
    let uri = document.uri;
    if (isFileUri(uri)) {
      this.diag.delete(uri);
    }
  }

  private hasError(error: Error, stderr: string): boolean {
    let errorOutput = stderr.toString();
    if (error && (<any>error).code === "ENOENT") {
      vscode.window.showWarningMessage(`SPIN is not executable`);
      return true;
    } else if (error && (<any>error).code === 127) {
      vscode.window.showWarningMessage(stderr);
      return true;
    } else if (errorOutput.length > 0) {
      vscode.window.showWarningMessage(stderr);
      return true;
    }

    return false;
  }
}
