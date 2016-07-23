const nodeRequire = window.require;
const ReactDOM = require('react-dom');
const React = require('react');
const electron = nodeRequire('electron');
const win = electron.remote.getCurrentWindow();

class MidLogin extends React.Component {
    constructor() {
        super();
        this.state = {
            loginWay: null
        };
    }
    render() {
        if (this.state.loginWay == null) {
            return (
                <div className="mid waitLogin selectMethod">
                    <div className="askLoginWay">
                        {"Do you know how to get your "}
                        <span className="cookie">Cookie</span>
                        {"s on Shanbay?"}
                    </div>
                    <button className="yes">Yes, use my Cookie!</button>
                    <button className="no">No, use my login and password.</button>
                    <div>
                        <a>What is Cookie?</a>
                        <a>Try a demo</a>
                        <a>Disclaimer</a>
                    </div>
                </div>
            );
        }
    }
}

class LoginPenal extends React.Component {
    constructor() {
        super();
        this.state = {};
        this.handleCancel = this.handleCancel.bind(this);
    }
    handleCancel() {
        window.close();
    }
    render() {
        let countClass = "";
        let midContent = null;
        let stubAnimation = false;
        let showLoginButton = false;
        switch (this.props.show) {
            case 'attempting':
                countClass = "onebtn";
                stubAnimation = true;
                midContent = (
                    <div className="mid attempting">
                        Attemping to connect with stored login...
                    </div>
                );
                break;
            case 'requireLogin':
                countClass = "onebtn";
                midContent = (
                    <MidLogin />
                )
        }
        return (
            <div className="loginPanel">
                <div className="top-mid-border">
                    <div className={"stub" + (stubAnimation ? ' animate' : '')} />
                </div>
                {midContent}
                <div className={"bottom " + countClass}>
                    <button onClick={this.handleCancel}>Cancel</button>
                    {showLoginButton ?
                            (<button>Login</button>)
                            : null}
                </div>
            </div>
        );
    }
}

class LoginUI extends React.Component {
    constructor() {
        super();
        this.state = {
            showing: 'attempting',
            errmsg: null
        };
    }
    render() {
        return (
            <div className="loginUI">
                <div className="top">
                    <h1>Shanbay Desktop</h1>
                    <div className="for">For Shanbay Words</div>
                    <div className="author">By Mao Wtm, NOT official</div>
                </div>
                <LoginPenal show={this.state.showing} errmsg={null} />
            </div>
        );
    }
}

module.exports = (mount, ipc) => {
    let uiComp = ReactDOM.render(
        <LoginUI />,
        mount
    );
    ipc.on('requireLogin', (event, arg) => {
        uiComp.setState({showing: 'requireLogin', errmsg: arg.errmsg});
    });
};
