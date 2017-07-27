import React, {Component} from 'react';
import { inject, observer } from 'mobx-react';
import { Link } from 'react-router-dom';
import { Dimmer, List } from 'semantic-ui-react'
import { withRouter } from 'react-router';

function renderThreads(threads) {
  return <List>
    {threads && threads.map((thread) => thread.comment ? <Comment comment={thread.comment}/> : <Thread thread={thread}/>)}
  </List>;
}

class Thread extends Component {
  render() {
    const {thread} = this.props;

    return <List.Item key={thread.sha}>
      <List.Icon name='folder' />
      <List.Content>
        <Link to={`/${thread.path}`}>{thread.name}</Link>
        {thread.threads && renderThreads(thread.threads)}
      </List.Content>
    </List.Item>
  }
}

class Comment extends Component {
  render() {
    const {comment} = this.props;

    return <List.Item key={comment.id}>
      <List.Icon name='file' />
      <List.Content>
        <strong>{comment.author}:</strong>
        <div>{comment.body}</div>
        <small>{comment.date} - {comment.ip}</small>
      </List.Content>
    </List.Item>
  }
}

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

  render() {
    const {threads, loading} = this.props.github;

    return <Dimmer.Dimmable>
      {loading &&  <div className="ui active inverted dimmer">
        <div className="ui loader"></div>
      </div>}
      {renderThreads(threads)}
    </Dimmer.Dimmable>
  }
}

export default inject('routing', 'github')(withRouter(observer(Threads)));
