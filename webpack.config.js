const path = require('path');

module.exports = {
    entry: "./view/entry.js",
    output: {
        path: path.join(__dirname, 'dist/'),
        publicPath: 'dist/',
        filename: "bundle.js"
    },
    module: {
        loaders: [
            { test: /\.sass$/, loaders: ["style", "css", "sass"] },
            { test: /\.jsx$/, loader: 'babel' },
            { test: /\.md$/, loaders: ["html", "markdown"] },
            { test: /\.gif$/, loaders: ["file"] },
        ]
    }
};
