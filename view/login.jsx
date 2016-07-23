const nodeRequire = window.require;
const ReactDOM = require('react-dom');
const React = require('react');

class LoginPenal extends React.Component {
    constructor() {
        super();
        this.state = {
            show: 'attemping'
        };
        this.handleCancel = this.handleCancel.bind(this);
    }
    handleCancel() {
        window.close();
    }
    render() {
        let countClass = "";
        let midContent = null;
        switch (this.state.show) {
            case 'attemping':
                countClass = "onebtn";
                midContent = (
                    <div className="mid attemping">
                        Attemping to connect with stored login...
                    </div>
                );
                break;
        }
        return (
            <div className="loginPanel">
                {midContent}
                <div className={"bottom " + countClass}>
                    <button onClick={this.handleCancel}>Cancel</button>
                </div>
            </div>
        );
    }
}

class LoginUI extends React.Component {
    constructor() {
        super();
    }
    render() {
        return (
            <div className="loginUI">
                <div className="top">
                    <h1>Shanbay Desktop</h1>
                    <div className="for">For Shanbay Words</div>
                    <div className="author">By Mao Wtm, NOT official</div>
                </div>
                <LoginPenal />
            </div>
        );
    }
}

module.exports = (mount) => {
    ReactDOM.render(
        <LoginUI>Hello, world!</LoginUI>,
        mount
    );
}
