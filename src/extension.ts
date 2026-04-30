import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext): void {
    console.log('Congratulations, your extension "file-utils" is now active!');

    let readOnlyDisposable = vscode.commands.registerCommand(
        'file-utils.toggleReadonly',
        (uri?: vscode.Uri, uris?: vscode.Uri[]) => {
            let selectedUris: vscode.Uri[] = [];

            if (uri) {
                // Called from explorer context menu
                selectedUris = uris || [uri];
            } else {
                // Called from editor context menu
                const activeEditor = vscode.window.activeTextEditor;
                if (activeEditor) {
                    selectedUris = [activeEditor.document.uri];
                }
            }

            if (selectedUris.length === 0) {
                vscode.window.showInformationMessage(
                    'No file or folder selected'
                );
                return;
            }

            // Get the current configuration
            const config = vscode.workspace.getConfiguration('files');
            let readonlyInclude =
                config.get<{ [key: string]: boolean }>('readonlyInclude') || {};

            const normalizedReadonlyInclude = { ...readonlyInclude };
            // Convert readonlyInclude keys to normalized paths
            // const normalizedReadonlyInclude: { [key: string]: boolean } =
            //     Object.keys(readonlyInclude).reduce(
            //         (acc: { [key: string]: boolean }, key) => {
            //             // acc[path.normalize(key)] = readonlyInclude[key];
            //             acc[key] = readonlyInclude[key];
            //             return acc;
            //         },
            //         {}
            //     );

            let addedCount = 0;
            let removedCount = 0;
            let ignoredCount = 0;

            selectedUris.forEach((uri) => {
                let normalizedPath = path.normalize(uri.fsPath);
                // let normalizedPath = path.normalize(uri.path);
                // let normalizedPath = uri.path;

                if (normalizedPath.includes('.vscode')) {
                    vscode.window.showWarningMessage(
                        `Due to security restrictions, changing the read-only status of this directory is not supported.`
                    );
                    return;
                }

                // Check if it's a directory
                const isDirectory = fs.statSync(normalizedPath).isDirectory();
                if (isDirectory) {
                    normalizedPath = path.join(normalizedPath, '**');
                }
                normalizedPath = normalizedPath.replace(/\\/g, '/');
                // Check if the path is already included in a parent folder
                const isIncludedInParent = Object.keys(
                    normalizedReadonlyInclude
                ).some((includedPath) => {
                    if (normalizedPath === includedPath) {
                        return false;
                    }
                    const isFolder = includedPath.endsWith('**');
                    const isInclude = normalizedPath.startsWith(
                        includedPath.slice(0, -3)
                    );
                    return isFolder && isInclude;
                });

                if (isIncludedInParent) {
                    vscode.window.showWarningMessage(
                        `${normalizedPath} is already included in a parent folder's read-only setting. Please change the parent folder's setting first.`
                    );
                    ignoredCount++;
                } else if (normalizedReadonlyInclude[normalizedPath]) {
                    // If the path is already in readonlyInclude, remove it
                    delete normalizedReadonlyInclude[normalizedPath];
                    removedCount++;
                } else {
                    // If the path is not in readonlyInclude, add it
                    normalizedReadonlyInclude[normalizedPath] = true;
                    addedCount++;
                }
            });

            // Update the configuration
            config
                .update(
                    'readonlyInclude',
                    normalizedReadonlyInclude,
                    vscode.ConfigurationTarget.Workspace
                )
                .then(
                    () => {
                        // Show summary message
                        let message: string[] = [];
                        if (addedCount > 0) {
                            message.push(
                                `Added ${addedCount} item(s) to readonly files.`
                            );
                        }
                        if (removedCount > 0) {
                            message.push(
                                `Removed ${removedCount} item(s) from readonly files.`
                            );
                        }
                        if (ignoredCount > 0) {
                            message.push(
                                `Ignored ${ignoredCount} item(s) due to parent folder settings.`
                            );
                        }

                        vscode.window.showInformationMessage(message.join(' '));
                    },
                    (error) => {
                        vscode.window.showErrorMessage(
                            `Failed to update readonly status: ${error}`
                        );
                    }
                );
        }
    );

    context.subscriptions.push(readOnlyDisposable);

    let disposable = vscode.commands.registerCommand(
        'file-utils.gitDiscardChanges',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active text editor');
                return;
            }

            // const choice = await vscode.window.showInformationMessage(
            //     'Do you want to discard changes in this file with git?',
            //     'Yes',
            //     'No'
            // );

            // // 检查用户的选择
            // if (choice === 'No') {
            //     return;
            // }

            try {
                await vscode.commands.executeCommand('git.clean');
                // vscode.window.showInformationMessage(
                //     'Changes discarded successfully'
                // );
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to discard changes: ${error}`
                );
            }
        }
    );

    context.subscriptions.push(disposable);
}

export function deactivate(): void {}
