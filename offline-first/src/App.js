import React from 'react';
import logo from './logo.svg';
import './App.css';
import * as RxDB from 'rxdb';
import {QueryChangeDetector} from 'rxdb';
import {schema} from './Schema';
import {ToastContainer, toast} from "react-toastify";
import * as moment from 'moment';
//QueryChangeDetector.enable();
QueryChangeDetector.enableDebugging();
RxDB.plugin(require('pouchdb-adapter-idb'));
RxDB.plugin(require('pouchdb-adapter-http'));
const syncURL = 'http://localhost:5984/';
const dbName = 'chatdb';
require('events').EventEmitter.defaultMaxListeners = 0;


class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      newMessage: '',
      messages: []
    };
    this.subs = [];
  }

  componentDidMount = async () => {
    this.db = await this.createDatabase();

    const sub = this.db.messages.find().sort({id: 1}).$.subscribe(messages => {
      if(!messages) {
        return;
      }
      toast('Reloading messages');
      this.setState({messages: messages});
    });
    this.subs.push(sub);
  };

  componentWillUnmount() {
    this.subs.forEach(sub => {
      sub.unsubscribe()
    });
  }

  createDatabase = async () => {
    const db = await RxDB.create({
        name: dbName,
        adapter: 'idb',
        queryChangeDetection: true,
        password: '12345678'
      }
    );
    db.waitForLeadership().then(() => {
      document.title = '♛' + document.title;
    });
    const messagesCollection = await db.collection({
      name: 'messages',
      schema: schema
    });
    messagesCollection.sync({remote: syncURL + dbName + '/'});

    const replicationState = messagesCollection.sync({remote: syncURL + dbName + '/'});
    this.subs.push(
        replicationState.change$.subscribe(change => {
          toast('Replication change');
          console.dir(change);
        })
    );
    this.subs.push(
      replicationState.docs$.subscribe(docData => console.dir(docData))
    );
    this.subs.push(
      replicationState.active$.subscribe(active => toast(`Replication active: ${active}`))
    );
    this.subs.push(
      replicationState.complete$.subscribe(completed => toast(`Replication completed: ${completed}`))
    );
    this.subs.push(
      replicationState.error$.subscribe(error => {
        toast('Replication Error');
        console.dir(error)
      })
    );

    return db;
  };

  renderMessages = () => {
    return this.state.messages.map(({id, message}) => {
      const date = moment(id, 'x').fromNow();
      return (
          <div key={id}>
            <p>{date}</p>
            <p>{message}</p>
            <hr/>
          </div>
      );
    });
  };

  handleMessageChange = (event) => {
    this.setState({newMessage: event.target.value});
  };

  addMessage = async () => {
    const id = Date.now().toString();
    const newMessage = {id, message: this.state.newMessage};

    await this.db.messages.insert(newMessage);

    this.setState({newMessage: ''});
  };

  render() {
    return (
        <div className="App">
          <ToastContainer autoClose={3000}/>
          <div className="App-header">
            <img src={logo} className="App-logo" alt="logo"/>
            <h2>Welcome to React</h2>
          </div>

          <div>{this.renderMessages()}</div>

          <div id="add-message-div">
            <h3>Add Message</h3>
            <input type="text" placeholder="Message" value={this.state.newMessage} onChange={this.handleMessageChange}/>
            <button onClick={this.addMessage}>Add message</button>
          </div>
        </div>
    );
  }
}

export default App;
