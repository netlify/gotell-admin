import React, {Component} from "react";
import { inject, observer } from 'mobx-react';
import {Modal, Button} from 'semantic-ui-react';


class Login extends Component {
  handleClick = (e) => {
    e.preventDefault();
    this.props.github.authenticate();
  }

  render() {
    return <Modal open={true} size="small">
     <Modal.Header>Login</Modal.Header>
     <Modal.Content>
      <Button loading={this.props.github.loading} onClick={this.handleClick}>Login with GitHub</Button>
     </Modal.Content>
   </Modal>;
  }
}

export default inject('github')(observer(Login));
