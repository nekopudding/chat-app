const path = require('path');
const fs = require('fs');
const express = require('express');
const {Server, WebSocket} = require('ws');
const cpen322 = require('./cpen322-tester.js');
const Database = require('./Database.js');
const SessionManager = require('./SessionManager.js');
const crypto = require('crypto');

function logRequest(req, res, next){
	console.log(`${new Date()}  ${req.ip} : ${req.method} ${req.path}`);
	next();
}

function sanitize(str) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
		'"':'&quot;',
    "'": '&#x27',
    "/": '&#x2F;'
  }
  const reg = /[&<>"'/]/ig;
  return str.replace(reg,match => map[match]);
}

const host = 'localhost';
const port = 3000;
const clientApp = path.join(__dirname, 'client');
const sessionManager = new SessionManager();

// express app
let app = express();
let db = new Database('mongodb://localhost:27017','cpen322-messenger');
let messageBlockSize = 10;

//get rooms on startup
let messages = {};
db.getRooms().then((chatrooms) => {
	chatrooms.forEach(room => {
		messages[room._id] = [];
	})
})

app.use(express.json()) 						// to parse application/json
app.use(express.urlencoded({ extended: true })) // to parse application/x-www-form-urlencoded
app.use(logRequest);							// logging for debug

app.use((req,res,next) => {
	const path = (req.baseUrl + req.path).trim();
	if (path === '/login' || path === '/style.css' || path === '/login.html') {
		return next();
	}
	sessionManager.middleware(req,res,next)
});

app.route('/chat')
.get((req,res) => {
	db.getRooms().then(rooms => {
		const chats = rooms.map(room => Object.assign({
			messages: messages[room._id] 
		}, room));
		return res.status(200).json(chats);
	})
	.catch(err => res.status(500).end(err))
	
})
.post((req,res) => {
	const {name,image,_id} = req.body;
	const newRoom = {name,image,_id};
	db.addRoom(newRoom)
	.then(room => {
		messages[room._id] = [];
		return res.status(200).json(room)
	})
	.catch(err => res.status(400).end(err));
	
})

app.route('/chat/:room_id')
.get((req,res) => {
	db.getRoom(req.params.room_id).then(room => {
		if (!room) return res.status(404).end(`GET /chat/${req.params.room_id} - room not found`);
		return res.status(200).json(room);
	})
	.catch(err => res.status(500).end(err))
})

app.route('/chat/:room_id/messages')
.get((req,res) => {
	const {before} = req.query;
	const {room_id} = req.params;
	db.getLastConversation(room_id,before)
	.then(c => {
		return res.status(200).json(c);
	}).catch(err => {
		console.log(err)
		return res.status(400).end(err);
	})
})

app.route('/login')
.get((req,res) => {
	res.sendFile(clientApp+'/login.html');
})
.post((req,res) => {
	const {username,password} = req.body;
	db.getUser(username)
	.then(user => {
		if (!user) {
			return res.redirect('/login');
		}
		const saltedHash = user.password;
		if(isCorrectPassword(password,saltedHash)) {
			sessionManager.createSession(res,username);
			res.redirect('/');
		} else {
			res.redirect('/login');
		}
	})
})

app.route('/logout')
.get((req,res) => {
	sessionManager.deleteSession(req);
	return res.redirect('/login');
})

app.route('/profile')
.get((req,res) => {
	return res.status(200).json({username: req.username});
})

function isCorrectPassword(password,saltedHash) {
	const salt = saltedHash.substring(0,20);
	const hash = saltedHash.substring(20);
	const passwordHash = crypto.createHash('sha256')
	.update(password+salt) //salt appended to the password in the database
	.digest('base64')
	return passwordHash === hash;
}

// serve static files (client-side)
app.use('/', express.static(clientApp, { extensions: ['html'] }));

app.use((err, req, res, next) => {
	if (res.headersSent) return next(err);
  if (err instanceof SessionManager.Error) {
		if(req.headers.accept === 'application/json') {
			return res.status(401).end(err);
		} else
			return res.redirect('/login');
	}
  next(err);
})

app.listen(port, () => {
	console.log(`${new Date()}  App Started. Listening on ${host}:${port}, serving ${clientApp}`);
});

/*--------------------------------------------------*/
/*--------------------- SOCKET ---------------------*/
/*--------------------------------------------------*/
const broker = new Server({port:8000});
broker.on('connection', (ws,req) => {
	//ws is the client
	if (!req.headers.cookie) {
		return ws.close();
	}
	const sessionId = sessionManager.getSessionId(req.headers.cookie);
	const username = sessionManager.getUsername(sessionId);
	if (!sessionId || !username) {
		return ws.close();
	}
  ws.on('message', (data) => {
		let msg = JSON.parse(data);
		msg.username = sanitize(username);
		msg.text = sanitize(msg.text);
		broker.clients.forEach(c => {
			if (c !== ws && c.readyState === WebSocket.OPEN) {
				c.send(JSON.stringify({...msg,sanitized:true}));
			}
		})
		messages[msg.roomId].push(msg);
		if (messages[msg.roomId].length >= messageBlockSize) {
			db.addConversation({
				room_id: msg.roomId,
				timestamp: Date.now(),
				messages: messages[msg.roomId]
			}).then(() => {
				messages[msg.roomId] = [];
			})
		}
  });
});

cpen322.connect('http://52.43.220.29/cpen322/test-a5-server.js');
cpen322.export(__filename, { app, messages,broker,db,
	messageBlockSize,
	isCorrectPassword,
	sessionManager
 });