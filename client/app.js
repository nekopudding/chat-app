function emptyDOM (elem){
  while (elem.firstChild) elem.removeChild(elem.firstChild);
}

// Creates a DOM element from the given HTML string
function createDOM (htmlString){
  let template = document.createElement('template');
  template.innerHTML = htmlString.trim();
  return template.content.firstChild;
}

//https://stackoverflow.com/questions/2794137/sanitizing-user-input-before-adding-it-to-the-dom-in-javascript
function sanitize(msg) {
  const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      "/": '&#x2F;',
  };
  const reg = /[&<>"'/]/ig;
  const username = msg.username.replace(reg, (match)=>(map[match]));
  const text = msg.text.replace(reg, (match)=>(map[match]));
  const sanitized = msg.sanitized;
  //if already sanitized (by server broker), don't sanitize again
  return sanitized ? msg : {username,text,sanitized};
}


class ChatView {
  constructor(socket) {
    this.elem = createDOM(`
      <div class="content">
        <h4 class="room-name">Room Name</h4>
        <div class="message-list">
        </div>
        <div class="page-control">
          <textarea name="" id="" cols="30" rows="1" placeholder="Add message..."></textarea>
          <button type="submit">Send</button>
        </div>
      </div>
    `)
    this.titleElem = this.elem.querySelector('h4');
    this.chatElem = this.elem.querySelector('div.message-list');
    this.inputElem = this.elem.querySelector('textarea');
    this.buttonElem = this.elem.querySelector('button');

    this.room = null;
    const self = this; //the "this" context changes inside event listeners, assign self so that sendMessage can access class properties
    this.buttonElem.addEventListener('click',(e) => {
      self.sendMessage()
    });

    this.keyStatus = {}
    this.inputElem.addEventListener('keyup',(e) => {
      if(e.keyCode === 13 && !e.shiftKey) { //13 = ENTER key, and shift key not pressed
        self.sendMessage();
      }
    })
    this.socket = socket;
    this.chatElem.addEventListener('wheel',(e)=>{
      //call if scroll direction is up, and scrollbar at top
      if (e.deltaY < 0 && this.chatElem.scrollTop <= 0 && this.room.canLoadConversation) {
        this.room.getLastConversation.next();
      }
    })
  }
  sendMessage() {
    const message = this.inputElem.value;
    this.room.addMessage(profile.username,message);
    //send to server socket
    this.socket.send(JSON.stringify({
      roomId: this.room.id,
      text: message
    }))
    this.inputElem.value = '';
  }
  renderMessage(msg) {
    const sanitizedMessage = sanitize(msg);
    if (msg.username === profile.username) {
      this.chatElem.appendChild(createDOM(`
        <div class="message my-message">
          <span class="message-user">Me</span>
          <span class="message-text">${sanitizedMessage.text}</span>
        </div>
      `))
    } else {
      this.chatElem.appendChild(createDOM(`
        <div class="message">
          <span class="message-user">${sanitizedMessage.username}</span>
          <span class="message-text">${sanitizedMessage.text}</span>
        </div>
      `))
    }
  }
  renderMessageAtStart(msg) { //render at start of list
    const sanitizedMessage = sanitize(msg);
    if (msg.username === profile.username) {
      this.chatElem.prepend(createDOM(`
        <div class="message my-message">
          <span class="message-user">Me</span>
          <span class="message-text">${sanitizedMessage.text}</span>
        </div>
      `))
    } else {
      this.chatElem.prepend(createDOM(`
        <div class="message">
          <span class="message-user">${sanitizedMessage.username}</span>
          <span class="message-text">${sanitizedMessage.text}</span>
        </div>
      `))
    }
  }
  setRoom(room) {
    this.room = room;
    this.titleElem.innerHTML = room.name;
    emptyDOM(this.chatElem);

    //add old messages (username,text)
    this.room.messages.forEach(msg => {
      this.renderMessage(msg);
    })
    //allow auto rendering new messages - called by Room.addMessage()
    this.room.onNewMessage = (message) => {
      this.renderMessage(message);
    }
    this.room.onFetchConversation = (conversation) => {
      //reverse() modifies the original array
      const hb = this.chatElem.scrollHeight;
      let reversed = [...conversation.messages].reverse();
      reversed.forEach(m => {
        this.renderMessageAtStart(m);
      })
      this.chatElem.scrollTop = this.chatElem.scrollHeight - hb;

    }
  }
}

class LobbyView {
  constructor(lobby) {
    this.elem = createDOM(` 
      <div class="content">
        <ul class="room-list">
        </ul>
        <div class="page-control">
          <input type="text" name="" id="" placeholder="New Room Name"/>
          <button type="submit">Create</button>
        </div>
      </div>
    `)
    this.listElem = this.elem.querySelector('ul.room-list');
    this.inputElem = this.elem.querySelector('input');
    this.buttonElem = this.elem.querySelector('button');
    this.lastRoomId = 4;

    this.lobby = lobby;
    this.redrawList();
    const self = this;

    this.buttonElem.addEventListener('click',(e) => { //add a new room on click
      if (self.inputElem.value.trim()==='') return;
      const roomName = self.inputElem.value;
      Service.addRoom({name: roomName, image: 'assets/everyone-icon.png'})
      .then((res) => {
        this.lobby.addRoom(res._id,res.name,res.image);
      }).catch((err) => console.log(err));
      self.inputElem.value = ''
    })
    //allow auto rendering new rooms - called by Lobby.addRoom()
    this.lobby.onNewRoom = (room) => {
      this.renderRoom(room);
    }
  }
  redrawList() {
    emptyDOM(this.listElem);
    const rooms = this.lobby.rooms;
    for(let roomId in rooms) {
      this.renderRoom(rooms[roomId]);
    }
  }
  renderRoom(room) {
    this.listElem.appendChild(createDOM(`
        <li>
          <a href="#/chat/${room.id}" name=${room.name} id=${room.id}>${room.name}</a>
        </li>
    `))
  }
}
class ProfileView {
  constructor() {
    this.elem = createDOM(`
      <div class="content">
        <div class="profile-form">
          <div class="form-field">
            <label for=""></label>
            <input type="text" placeholder="Name"/>
          </div>
          <div class="form-field">
            <label for=""></label>
            <input type="password" placeholder="Password"/>
          </div>
          <div class="form-field">
            <label for=""></label>
            <input type="file"/>
          </div>
        </div>
        <div class="page-control">
          <button type="submit">Update Profile</button>
        </div>
      </div>
    `)
  }
}

class Room {
  constructor(id,name,image='assets/everyone-icon.png',messages=[]) {
    this.id = id;
    this.name = name;
    this.image = image;
    this.messages = messages;
    this.timestamp = Date.now();
    this.getLastConversation = makeConversationLoader(this);
    this.canLoadConversation = true;
  }
  addMessage(username,text,sanitized = false) {
    if (text.trim()==='') {
      return;
    }
    const message = {username,text,sanitized};
    this.messages.push(message);

    if (this.onNewMessage) this.onNewMessage(message);
  }
  addConversation(conversation) {
    const sortedMessages = conversation.messages;
    this.messages = [...sortedMessages,...this.messages]
    this.onFetchConversation(conversation);
  }
}

// D) In the Lobby class, add a method with the signature getRoom(roomId). 
// The method should search through the rooms and return the room with id = roomId if found.
class Lobby {
  constructor() {
    this.rooms = {}
  }
  getRoom(roomId) {
    return this.rooms[roomId];
  }
  addRoom(id,name,image,messages) {
    const newRoom = new Room(id,name,image,messages);
    this.rooms[newRoom.id] = newRoom;
    if (this.onNewRoom) this.onNewRoom(newRoom);
  }
}

//-----------------------------------------------------------------------------//
//-------------------------- START OF EXECUTION -------------------------------//
//-----------------------------------------------------------------------------//
let profile = {
  username: 'Alice'
}
let Service = {
  origin: window.location.origin,
  getAllRooms: function() {
    let promise = fetch(`${this.origin}/chat`).then(
      //resolve
      async (res)=> {
      if (res.status === 200) {
        return res.json();
      } else { //server error
        const err = new Error(await res.text());
        return Promise.reject(err);
      }
    }).catch((err) => { //client network error
      console.log(err);
      return Promise.reject(err)
    });
    return promise;
  },
  addRoom: function(data) { //data={name, image}
    let promise = fetch(`${this.origin}/chat`,{
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(data)
    }).then(
      //resolve
      async (res) => {
      if (res.status === 200) {
        return res.json();
      } else { //server error
        const err = new Error(await res.text());
        return Promise.reject(err);
      }
    }).catch((err) => { //client network error
      return Promise.reject(err)
    });
    return promise;
  },
  getLastConversation: function(roomId,before) {
    let promise = fetch(`${this.origin}/chat/${roomId}/messages?before=${before}`).then(
      //resolve
      async (res) => {
      if (res.status === 200) {
        return res.json();
      } else { //server error
        const err = new Error(await res.text());
        return Promise.reject(err);
      }
    }).catch((err) => { //client network error
      return Promise.reject(err)
    });
    return promise;
  },
  getProfile: function () {
    let promise = fetch(`${this.origin}/profile`).then(
      //resolve
      async (res) => {
      if (res.status === 200) {
        return res.json();
      } else { //server error
        const err = new Error(await res.text());
        return Promise.reject(err);
      }
    }).catch((err) => { //client network error
      return Promise.reject(err)
    });
    return promise;
  }
};
function* makeConversationLoader(room) {
  let timestamp = room.timestamp;
  while (room.canLoadConversation) {
    room.canLoadConversation = false;
    yield new Promise((resolve,reject) => {
      Service.getLastConversation(room.id, timestamp)
      .then(c => {
        timestamp = c.timestamp;
        if (c) {
          room.canLoadConversation = true;
          room.addConversation(c);
        }

        resolve(c);
      }).catch(err => resolve(null));
    })
  }
}
function main() {
  /*--------------------------------------------------*/
  /*--------------------- SOCKET ---------------------*/
  /*--------------------------------------------------*/
  const socket = new WebSocket('ws://localhost:8000'); //server's port
  //retrieve messages
  socket.addEventListener('message', (e) => {
    const {roomId,username,text,sanitized} = JSON.parse(e.data);
    lobby.getRoom(roomId).addMessage(username,text,sanitized); //may need some error checking
  });

  const pageView = document.getElementById('page-view');
  const lobby = new Lobby();
  const lobbyView = new LobbyView(lobby);
  const profileView = new ProfileView();
  const chatView = new ChatView(socket);
  function renderRoute() {    
    const path = window.location.hash.split('/');
    switch (path[1]) {
      case '':
        //empty #page-view
        emptyDOM(pageView);
        pageView.appendChild(lobbyView.elem);
        break;
      case 'profile':
        //empty #page-view
        emptyDOM(pageView);
        pageView.appendChild(profileView.elem);
        break;
      case 'chat':
        emptyDOM(pageView);
        pageView.appendChild(chatView.elem);
        const room = lobby.getRoom(path[2]);
        if(room) chatView.setRoom(room);
        break;
      default:
        break;
    }
  }
  function refreshLobby() {
    Service.getAllRooms()
    //on success (in json)
    .then((res) => {
      const rooms = res; //array of rooms
      rooms.forEach(room => {
        if (lobby.getRoom(room._id)) {
          //update name and image
          lobby.rooms[room._id].name = room.name;
          lobby.rooms[room._id].image = room.image;
        } else {
          //create room
          lobby.addRoom(room._id,room.name,room.image,room.messages);
        }
      })
      renderRoute(); //rerender with the updated list
    })
    //on rejection
    .catch((reason) => {
      console.log(reason);
    })
  }

  window.addEventListener('popstate',renderRoute);
  renderRoute();
  refreshLobby();
  setInterval(refreshLobby, 60000);
  Service.getProfile()
  .then(p => {profile.username = p.username});

  cpen322.export(arguments.callee, { 
    renderRoute, lobbyView, chatView, profileView,
    lobby, refreshLobby, socket
  });
}

window.addEventListener('load',main);
