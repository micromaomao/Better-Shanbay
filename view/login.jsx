const nodeRequire = window.require;
const ReactDOM = require('react-dom');
const React = require('react');
const electron = nodeRequire('electron');
const win = electron.remote.getCurrentWindow();

let canceled = [];
let ipc;

class CookiePaster extends React.Component {
    constructor() {
        super();
        this.state = {};
        this.handlePaste = this.handlePaste.bind(this);
    }
    handlePaste () {
        this.value = electron.clipboard.readText();
    }
    get value() {
        return this.input.value;
    }
    set value(v) {
        if (this.input.value == v) {
            return;
        }
        this.input.value = v;
        this.props.onChange(v);
    }
    render() {
        return (
            <div className="cookiePaster">
                <div className="cinput">
                    <input type="text" ref={(f) => this.input = f} onChange={(evt) => {
                        this.props.onChange(this.value);
                    }} />
                </div>
                <div className="cbutton">
                    <button className="emp" onClick={this.handlePaste}>Paste</button>
                </div>
            </div>
        );
    }
}

class LoginPenal extends React.Component {
    constructor() {
        super();
        this.state = {
            showing: null,
            loginMethod: null,
            cookie: "",
            attemptingFrom: null,
            errmsg: null,
            currentTrial: null,
            saveCheck: true
        };
        this.handleCancel = this.handleCancel.bind(this);
        this.handleUseCookie = this.handleUseCookie.bind(this);
        this.handleLogin = this.handleLogin.bind(this);
        this.handleBack = this.handleBack.bind(this);
        this.handleCookieInput = this.handleCookieInput.bind(this);
        this.handleClose = this.handleClose.bind(this);
        this.handleSaveCheckChange = this.handleSaveCheckChange.bind(this);
    }
    setState(newState) {
        if (newState.showing && newState.showing != "attempting") {
            newState = Object.assign({}, newState, {attemptingFrom: null});
        }
        super.setState(newState);
    }
    handleCancel() {
        let trial = this.state.currentTrial;
        canceled[trial] = true;
        this.setState({showing: 'requireLogin'});
    }
    handleClose() {
        window.close();
    }
    handleUseCookie() {
        this.setState({loginMethod: 'cookie', errmsg: null});
    }
    handleBack() {
        this.setState({loginMethod: null, errmsg: null});
    }
    handleLogin() {
        if (this.state.loginMethod == "cookie") {
            let cookie = this.state.cookie;
            let trial = canceled.push(false) - 1;
            this.setState({showing: "attempting", attemptingFrom: "cookie", currentTrial: trial});
            ipc.send('login', {loginMethod: 'cookie', cookie: cookie, trialId: trial, save: this.state.saveCheck});
        }
    }
    handleCookieInput(cookie) {
        this.setState({cookie: cookie});
    }
    handleSaveCheckChange() {
        let checked = this.saveCheckInput.checked;
        this.setState({saveCheck: checked});
        if (!checked) {
            ipc.send('rmStoredLogin');
        }
    }
    render() {
        let midContent = null;
        let stubAnimation = false;
        let showLoginButton = false;
        let midLogin = null;
        switch (this.state.showing) {
            case 'attempting':
                let loginMethod = "";
                stubAnimation = true;
                midContent = (
                    <div className="mid attempting">
                        Attemping to connect with {this.state.attemptingFrom}...
                    </div>
                );
                break;
            case 'requireLogin':
                midContent = null;
        }
        if (midContent == null) {
            let errmsg = null;
            if (this.state.errmsg) {
                errmsg = (
                    <div className="errmsg">{this.state.errmsg}</div>
                );
            }
            let saveCookieCheckbox = (
                <div className="cSaveCookieCheckbox">
                    <input type="checkbox" id="saveCookieCheck"
                        onChange={this.handleSaveCheckChange}
                        checked={this.state.saveCheck} ref={(f) => this.saveCheckInput = f} />
                    <label htmlFor="saveCookieCheck">
                        {"Save " + (
                            this.state.loginMethod == "cookie" ? "this cookie"
                                : "the session")} for further login.
                    </label>
                </div>
            )
            switch (this.state.loginMethod) {
                case null:
                    midLogin = (
                        <div className="mid waitLogin selectMethod">
                            <div className="askLoginWay">
                                {"Do you know how to get your "}
                                <span className="cookie">Cookie</span>
                                {"s on Shanbay?"}
                            </div>
                            <button className="yes" onClick={this.handleUseCookie}>Yes, use my Cookie!</button>
                            <button className="no">No, use my login and password.</button>
                            <div className="other">
                                <a>What is Cookie?</a>
                                <a>Try a demo</a>
                                <a>Disclaimer</a>
                            </div>
                            {errmsg}
                        </div>
                    );
                    break;
                case 'cookie':
                    showLoginButton = true;
                    midLogin = (
                        <div className="mid waitLogin cookieMethod">
                            <div className="askCookie">Please paste your cookie below:</div>
                            <CookiePaster onChange={this.handleCookieInput} ref={(f) => {
                                this.cookieInput = f;
                                if (f == null) return;
                                f.value = this.state.cookie;
                            }} />
                            {saveCookieCheckbox}
                            {errmsg}
                        </div>
                    )
                    break;
            }
        }
        let countClass = showLoginButton ? "twobtn" : "onebtn";
        return (
            <div className="loginPanel">
                <div className="top-mid-border">
                    <div className={"stub" + (stubAnimation ? ' animate' : '')} />
                </div>
                {midContent}
                {midLogin}
                <div className={"bottom " + countClass}>
                    <button onClick={showLoginButton ? this.handleBack : (
                        this.state.showing == "attempting" ? this.handleCancel : this.handleClose)}>
                        {showLoginButton ? "Back" : (
                            this.state.showing == "attempting" ? "Cancel" : "Close")}
                    </button>
                    {showLoginButton ?
                            (<button onClick={this.handleLogin}>Login</button>)
                            : null}
                </div>
            </div>
        );
    }
}

class LoginUI extends React.Component {
    constructor() {
        super();
        this.state = {};
    }
    render() {
        return (
            <div className="loginUI">
                <div className="top">
                    <h1>Shanbay Desktop</h1>
                    <div className="for">For Shanbay Words</div>
                    <div className="author">By Mao Wtm, NOT official</div>
                </div>
                <LoginPenal ref={(f) => this.panel = f} ipc={this.props.ipc} />
            </div>
        );
    }
}

module.exports = (mount, _ipc) => {
    ipc = _ipc;
    let uiComp = ReactDOM.render(
        <LoginUI />,
        mount
    );
    uiComp.panel.setState({showing: 'attempting', attemptingFrom: "stored login"});
    ipc.on('requireLogin', (event, arg) => {
        if (arg.trialId !== null && canceled[arg.trialId]) {
            return;
        }
        uiComp.panel.setState({showing: 'requireLogin', loginMethod: arg.method, errmsg: arg.errmsg});
    });
};
