import React, {Component} from 'react';
import { inject, observer } from 'mobx-react';
import { Button, Checkbox, Dimmer, Icon, Table } from 'semantic-ui-react'
import distanceInWords from 'date-fns/distance_in_words_to_now';


class Awaiting extends Component {
  componentDidMount() {
    this.props.github.loadAwaiting();
  }

  handleToggle = (e, obj) => {
    e.preventDefault();
    this.props.github.toggleAwaiting(obj.id, obj.checked);
  }

  handleTrash = (e) => {
    e.preventDefault();
    const awaiting = this.props.github.awaiting_moderation.filter((c) => c.checked);
    if (awaiting.length > 0) {
      if (window.confirm(`Delete ${awaiting.length} comments?`)) {
        this.props.github.deleteCheckedPRs();
      }
    }
  }

  handleApprove = (e) => {
    e.preventDefault();
    const awaiting = this.props.github.awaiting_moderation.filter((c) => c.checked);
    if (awaiting.length > 0) {
      if (window.confirm(`Approve ${awaiting.length} comments?`)) {
        this.props.github.approveCheckedPRs();
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
              <Button onClick={this.handleApprove}><Icon name='thumbs outline up'/></Button>
              <Button onClick={this.handleTrash}><Icon name='thumbs outline down'/></Button>
            </Table.HeaderCell>
            <Table.HeaderCell>Comment</Table.HeaderCell>
            <Table.HeaderCell>Date</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {github.awaiting_moderation && github.awaiting_moderation.map((pr) => (
            <Table.Row key={pr.id}>
              <Table.Cell textAlign="center">
                <Checkbox onChange={this.handleToggle} id={pr.id} checked={pr.checked}/>
              </Table.Cell>
              <Table.Cell>{pr.title}</Table.Cell>
              <Table.Cell singleLine textAlign="right">{distanceInWords(pr.created_at)} ago</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </Dimmer.Dimmable>;
  }
}

export default inject('github')(observer(Awaiting));
