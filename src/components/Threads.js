import React, {Component} from 'react';
import { inject, observer } from 'mobx-react';
import { Link } from 'react-router-dom';
import { Dimmer, List } from 'semantic-ui-react'
import { withRouter } from 'react-router';


class Threads extends Component {
  constructor(props) {
    super(props);
    this.state = {pathname: this.props.routing.location.pathname};
  }

  componentDidMount() {
    const {pathname} = this.props.routing.location;
    this.loadThread(pathname);
  }

  componentWillReceiveProps(nextProps) {
    const {pathname} = nextProps.routing.location;
    if (pathname !== this.state.pathname) {
      this.setState({pathname});
      this.loadThread(pathname);
    }
  }

  loadThread(pathname) {
    const m = pathname.match(/threads(?:\/(.+))?/);
    if (m) {
      this.props.github.loadThread(m[1] || '');
    }
  }

  renderThreads(threads) {
    return <List>
      {threads && threads.map((thread) => (
        <List.Item key={thread.sha}>
          <List.Icon name='folder' />
          <List.Content>
            <Link to={`/${thread.path}`}>{thread.name}</Link>
            {thread.threads && this.renderThreads(thread.threads)}
          </List.Content>
        </List.Item>
      ))}
    </List>;
  }

  render() {
    const {threads, loading} = this.props.github;

    return <Dimmer.Dimmable>
      {loading &&  <div className="ui active inverted dimmer">
        <div className="ui loader"></div>
      </div>}
      {this.renderThreads(threads)}
    </Dimmer.Dimmable>
  }
}

export default inject('routing', 'github')(withRouter(observer(Threads)));
