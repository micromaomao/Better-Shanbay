const nodeRequire = window.require;
require("./all.sass");
const electron = nodeRequire('electron');
const react = require('react');

const ipc = electron.ipcRenderer;
const mount = document.getElementsByClassName('react')[0];

ipc.once('view', (event, ctx) => {
    console.log(event, ctx);
    switch (ctx) {
        case "login":
            require("./login.jsx")(mount, ipc);
            break;
    }
});
