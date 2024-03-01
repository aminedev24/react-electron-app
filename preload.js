const { ipcRenderer, remote } = require('electron');
const path = require('path');
const fs = require('fs');

window.ipcRenderer = ipcRenderer;
window.path = path;
window.fs = fs;
window.remote = remote;

