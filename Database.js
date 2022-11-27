const { MongoClient, ObjectID, ObjectId } = require('mongodb');	// require the mongodb driver

/**
 * Uses mongodb v4.2+ - [API Documentation](http://mongodb.github.io/node-mongodb-native/4.2/)
 * Database wraps a mongoDB connection to provide a higher-level abstraction layer
 * for manipulating the objects in our cpen322 app.
 */
function Database(mongoUrl, dbName){
	if (!(this instanceof Database)) return new Database(mongoUrl, dbName);
	this.connected = new Promise((resolve, reject) => {
		MongoClient.connect(
			mongoUrl,
			{
				useNewUrlParser: true
			},
			(err, client) => {
				if (err) reject(err);
				else {
					console.log('[MongoClient] Connected to ' + mongoUrl + '/' + dbName);
					resolve(client.db(dbName));
				}
			}
		)
	});
	this.status = () => this.connected.then(
		db => ({ error: null, url: mongoUrl, db: dbName }),
		err => ({ error: err })
	);
}

Database.prototype.getRooms = function(){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			db.collection('chatrooms').find({})
			.toArray((err,rooms) => {
				if (err) reject(err);
				resolve(rooms);
			});
		})
	)
}

Database.prototype.getRoom = function(room_id){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
				const roomId = (typeof rooom_id === ObjectId || room_id.length !== 24) ? room_id : new ObjectId(room_id);
				db.collection('chatrooms').findOne({_id:roomId})
				.then(room => resolve(room))
				.catch(err => reject(err));
		})
	)
}

Database.prototype.addRoom = function(room){
	return this.connected.then(db => 
		new Promise((resolve, reject) => {
			/* TODO: insert a room in the "chatrooms" collection in `db`
			 * and resolve the newly added room */
			if (!room.name || room.name.trim().length === 0) return reject('name field required');
			db.collection('chatrooms').insertOne(room)
			.then(
				() => db.collection('chatrooms').findOne(room)
				.then(room => {
					resolve(room);
				}
			))
			.catch(err => reject(err));
		})
	)
}

Database.prototype.getLastConversation = function(room_id, before){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			let time = before || Date.now();
			db.collection('conversations').find({room_id})
			.toArray((err,conversations) => {
				if (err) reject(err);
				const sorted = conversations.sort((c1,c2) => c2.timestamp - c1.timestamp);
				const filtered = sorted.filter(c => c.timestamp < time);
				resolve({...filtered[0]});
			})
		})
	)
}

Database.prototype.addConversation = function(conversation){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			const {room_id,timestamp,messages} = conversation;
			if (!room_id || !timestamp || !messages) return reject('room_id, timestamp, messages required');

			db.collection('conversations').insertOne(conversation)
			.then(
				() => db.collection('conversations').findOne(conversation)
				.then(c => {
					resolve(c)
				})
			)
			.catch(err => reject(err));
		})
	)
}

Database.prototype.getUser = function(username){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
				db.collection('users').findOne({username})
				.then(room => resolve(room))
				.catch(err => reject(err));
		})
	)
}

module.exports = Database;