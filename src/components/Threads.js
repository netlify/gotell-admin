import React, {Component} from 'react';
import { inject, observer } from 'mobx-react';
import { Link } from 'react-router-dom';
import { Form, Modal, Button, Dimmer, List } from 'semantic-ui-react'
import { withRouter } from 'react-router';

function renderThreads(threads, onSave) {
  return <List>
    {threads && threads.map((thread) => thread.comment ?
        <Comment comment={thread.comment} thread={thread} onSave={onSave}/> :
        <Thread thread={thread} onSave={onSave}/>)}
  </List>;
}

class Thread extends Component {
  render() {
    const {thread} = this.props;

    return <List.Item key={thread.sha}>
      <List.Icon name='folder' />
      <List.Content>
        <Link to={`/${thread.path}`}>{thread.name}</Link>
        {thread.threads && renderThreads(thread.threads, this.props.onSave)}
      </List.Content>
    </List.Item>
  }
}

class Comment extends Component {
  constructor(props) {
    super(props);
    this.state = {comment: props.comment, editing: false};
  }

  handleToggleEdit = (e) => {
    e.preventDefault();
    console.log('setting editing...', this.state.editing);
    this.setState((state) => ({editing: !state.editing}));
  }

  handleChange = (e) => {
    const {comment} = this.state;
    const {name, value} = e.target;
    this.setState((state) => ({comment: {...comment, [name]: value}}));
  }

  handleSave = (e) => {
    e.preventDefault();
    this.props.onSave({comment: this.state.comment, thread: this.props.thread});
    this.setState({editing: false});
  }

  render() {
    const {comment} = this.state;

    return <List.Item key={comment.id}>
      <List.Icon name='file' />
      <List.Content>
        <strong>{comment.author}:</strong> <a href="#" onClick={this.handleToggleEdit}>Edit</a>
        <div>{comment.body}</div>
        <small>{comment.date} - {comment.ip}</small>
      </List.Content>
      <Modal open={this.state.editing} onClose={this.handleToggleEdit}>
       <Modal.Header>Editing Comment</Modal.Header>
        <Modal.Content>
          <Form>
            <Form.Field>
              <label>Author:</label>
              <input name="author" onChange={this.handleChange} value={comment.author}/>
            </Form.Field>
            <Form.Field>
              <label>Body:</label>
              <textarea name="body" onChange={this.handleChange} value={comment.body}/>
            </Form.Field>
          </Form>
        </Modal.Content>
        <Modal.Actions>
          <Button color='black' onClick={this.handleToggleEdit}>Nope</Button>
          <Button positive onClick={this.handleSave}>
            Save
          </Button>
        </Modal.Actions>
      </Modal>
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

  handleSave = (comment) => {
    this.props.github.commitComment(comment);
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
      {renderThreads(threads, this.handleSave)}
    </Dimmer.Dimmable>
  }
}

export default inject('routing', 'github')(withRouter(observer(Threads)));
