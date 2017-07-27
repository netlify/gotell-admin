import React, {Component} from 'react';
import { inject, observer } from 'mobx-react';
import { Button, Checkbox, Dimmer, Icon, Table } from 'semantic-ui-react'
import distanceInWords from 'date-fns/distance_in_words_to_now';

class Comments extends Component {
  componentDidMount() {
    this.props.github.loadComments();
  }

  handleToggle = (e, obj) => {
    e.preventDefault();
    this.props.github.toggleComment(obj.id, obj.checked);
  }

  handleLoadMore = () => {
    this.props.github.loadComments(this.props.github.commentsPages.next);
  }

  handleTrash = (e) => {
    e.preventDefault();
    const comments = this.props.github.comments.filter((c) => c.checked);
    if (comments.length > 0) {
      if (window.confirm(`Delete ${comments.length} comments?`)) {
        this.props.github.deleteCheckedComments();
      }
    }
  }

  render() {
    const {github} = this.props;

    return <Dimmer.Dimmable>
      {github.loading &&  <div className="ui active inverted dimmer">
        <div className="ui loader"></div>
      </div>}
      <Table celled compact definition>
        <Table.Header fullWidth>
          <Table.Row>
            <Table.HeaderCell textAlign="center" className="actions-th">
              <Button onClick={this.handleTrash}><Icon name='trash outline'/></Button>
            </Table.HeaderCell>
            <Table.HeaderCell>Comment</Table.HeaderCell>
            <Table.HeaderCell>Date</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {github.comments && github.comments.map((comment) => (
            <Table.Row key={comment.sha}>
              <Table.Cell textAlign="center">
                <Checkbox onChange={this.handleToggle} id={comment.sha} checked={comment.checked}/>
              </Table.Cell>
              <Table.Cell>{comment.commit.message}</Table.Cell>
              <Table.Cell singleLine textAlign="right">{distanceInWords(comment.commit.author.date)} ago</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      {github.commentsPages.next && <Button onClick={this.handleLoadMore}>Load More</Button>}

    </Dimmer.Dimmable>
  }
}

export default inject('github')(observer(Comments));
