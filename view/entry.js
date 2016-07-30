const nodeRequire = window.require;
require("./all.sass");
const electron = nodeRequire('electron');
const react = require('react');

const ipc = electron.ipcRenderer;
const mount = document.getElementsByClassName('react')[0];

ipc.once('view', (event, ctx) => {
    switch (ctx) {
        case "login":
            require("./login.jsx")(mount, ipc);
            break;
        case "main":
            require("./main.jsx")(mount, ipc);
            break;
        case "read":
            require("./read.jsx")(mount, ipc);
            break;
    }
});
