const requireNode = window.require;
require("./all.sass");
const electron = requireNode('electron');
const ipc = electron.ipcRenderer;
const react = require('react');

const ctx = electron.remote.getCurrentWindow().shanbay_context;
const mount = document.getElementsByClassName('react')[0];

switch (ctx) {
    case "login":
        require("./login.jsx")(mount);
        break;
}
