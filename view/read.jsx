const ReactDOM = require('react-dom')
const React = require('react')

let ipc

class ReadUI extends React.Component {
  constructor () {
    super()
    this.state = {}
    this.handleClose = this.handleClose.bind(this)
  }
  handleClose () {
    window.close()
  }
  componentWillMount () {
    this.componentWillReceiveProps(this.props, true)
  }
  componentWillReceiveProps (np, it) {
    if (!this.props || it || np.what !== this.props.what) {
      let what = np.what
      try {
        let html = require('../doc/reads/' + what + '.md')
        this.setState({error: null, content: html})
      } catch (e) {
        this.setState({error: 'Content ' + what + " dosen't exist.",
        content: null})
      }
    }
  }
  render () {
    return (
      <div className='readUI'>
        <div className='content'>
          {this.state.content
            ? (
            <div dangerouslySetInnerHTML={{__html: this.state.content}} />
            )
            : (
            this.state.error
              ? (<div className='error'>
                {this.state.error}
              </div>)
              : (<div className='loading'>
                Just a moment...
              </div>)
            )}
        </div>
        <button className='close' onClick={this.handleClose}>
          Close
        </button>
      </div>
    )
  }
}

module.exports = (mount, _ipc) => {
  ipc = _ipc
  ipc.on('readwhat', (event, arg) => {
    ReactDOM.render(
      <ReadUI what={arg} />,
      mount
    )
  })
}
