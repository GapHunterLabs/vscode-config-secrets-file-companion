import * as vscode from 'vscode';
import { scan } from './configLineScanner';
import { recordHit } from './reviewPrompt';

let diagnostics: vscode.DiagnosticCollection;

const MAX_FILE_LENGTH = 500_000; // avoids pathological cost on generated/huge files
const CONFIG_FILE_NAME = /^(\.env(\..+)?|[^.]+\.(properties|ya?ml))$/i;

function basename(uri: vscode.Uri): string {
  const path = uri.path;
  return path.slice(path.lastIndexOf('/') + 1);
}

function refresh(context: vscode.ExtensionContext, document: vscode.TextDocument): void {
  const name = basename(document.uri);
  if (!CONFIG_FILE_NAME.test(name)) {
    diagnostics.delete(document.uri);
    return;
  }

  const text = document.getText();
  if (text.length > MAX_FILE_LENGTH) {
    diagnostics.delete(document.uri);
    return;
  }

  const matches = scan(text);
  const result = matches.map((match) => {
    const line = match.line - 1;
    const range = new vscode.Range(line, match.valueStartCol, line, match.valueEndCol);
    const diagnostic = new vscode.Diagnostic(
      range,
      `Possible hardcoded secret: ${match.finding.description}`,
      vscode.DiagnosticSeverity.Warning,
    );
    diagnostic.source = 'Config Secrets File Companion';
    diagnostic.code = match.finding.kind;
    recordHit(context, `${document.uri.toString()}:${line}`);
    return diagnostic;
  });
  diagnostics.set(document.uri, result);
}

export function activate(context: vscode.ExtensionContext): void {
  diagnostics = vscode.languages.createDiagnosticCollection('configSecretsFileCompanion');
  context.subscriptions.push(diagnostics);

  vscode.workspace.textDocuments.forEach((document) => refresh(context, document));

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => refresh(context, document)),
    vscode.workspace.onDidChangeTextDocument((event) => refresh(context, event.document)),
    vscode.workspace.onDidCloseTextDocument((document) => diagnostics.delete(document.uri)),
  );
}

export function deactivate(): void {
  diagnostics?.dispose();
}
