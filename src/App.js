import React, { Component } from 'react';
import { inject, observer } from 'mobx-react';
import { withRouter, Route } from 'react-router';
import { NavLink } from 'react-router-dom';
import './App.css';
import Awaiting from './components/Awaiting';
import Comments from './components/Comments';
import Threads from './components/Threads';
import Login from './components/Login';
import {Menu, Dropdown, Icon} from 'semantic-ui-react';

class App extends Component {
  handleLogout = (e) => {
    e.preventDefault();
    this.props.github.logout();
  }

  render() {
    const {github} = this.props;

    if (!github.user) {
      return <div className="App">
        <Login/>
      </div>;
    }

    return (
      <div className="App">
        <Menu vertical fixed="left" inverted>
          <Menu.Item as={Dropdown} trigger={<span><Icon name="user"/>{github.user.login}</span>}>
            <Dropdown.Menu>
              <Dropdown.Item onClick={this.handleLogout}>Logout</Dropdown.Item>
            </Dropdown.Menu>
          </Menu.Item>
          <NavLink to="/" exact className="item">Awaiting Moderation</NavLink>
          <NavLink to="/comments" exact className="item">Accepted Comments</NavLink>
          <NavLink to="/threads" className="item">Browse threads</NavLink>
        </Menu>
        <div className="main">
          <Route path="/" exact component={Awaiting}/>
          <Route path="/comments" exact component={Comments}/>
          <Route path="/threads" component={Threads}/>
        </div>
      </div>
    );
  }
}

export default inject('routing', 'github')(withRouter(observer(App)));
