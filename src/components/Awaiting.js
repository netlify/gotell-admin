import React, {Component} from 'react';
import { inject, observer } from 'mobx-react';

class AwaitingList extends Component {
  render() {
    const {awaiting_moderation} = this.props;
    if (!awaiting_moderation) { return null; }
    if (awaiting_moderation.length === 0) {
      return <div><h3>No Comments Awaiting Moderation</h3></div>;
    }

    return <div>
      <h3>Awaiting Moderation</h3>
      <ul>
        {awaiting_moderation.map((pr) => (
          <li>{JSON.stringify(pr)}</li>
        ))}
      </ul>
    </div>
  }
}


class Awaiting extends Component {
  componentDidMount() {
    this.props.github.loadAwaiting();
  }

  render() {
    const {github} = this.props;
    return github.loading ?
      <p>Loading...</p> :
      <div>
        <AwaitingList awaiting_moderation={github.awaiting_moderation}/>
      </div>
    ;
  }
}

export default inject('github')(observer(Awaiting));
