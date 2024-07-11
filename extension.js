const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

function activate(context) {
    console.log(
        'Congratulations, your extension "file-readonly-toggler" is now active!'
    );

    let disposable = vscode.commands.registerCommand(
        'file-readonly-toggler.toggleReadonly',
        (uri, uris) => {
            let selectedUris = [];

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
            let readonlyInclude = config.get('readonlyInclude') || {};

            // Convert readonlyInclude keys to normalized paths
            const normalizedReadonlyInclude = Object.keys(
                readonlyInclude
            ).reduce((acc, key) => {
                acc[path.normalize(key)] = readonlyInclude[key];
                return acc;
            }, {});

            let addedCount = 0;
            let removedCount = 0;
            let ignoredCount = 0;

            selectedUris.forEach((uri) => {
                let normalizedPath = path.normalize(uri.fsPath);
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

                // Check if the path is already included in a parent folder
                const isIncludedInParent = Object.keys(
                    normalizedReadonlyInclude
                ).some((includedPath) => {
                    if (normalizedPath == includedPath) return false;
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
                        let message = [];
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

    context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate,
};
