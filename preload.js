const { ipcRenderer, remote } = require('electron');
const path = require('path');
let { dialog } = require('electron').remote;
const fs = require('fs');

window.ipcRenderer = ipcRenderer;
window.path = path;
window.fs = fs;
window.remote = remote;
window.dialog = dialog;
