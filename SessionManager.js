const crypto = require('crypto');

class SessionError extends Error {};

function SessionManager (){
	// default session length - you might want to
	// set this to something small during development
	const CookieMaxAgeMs = 600000;

	// keeping the session data inside a closure to keep them protected
	const sessions = {};

	// might be worth thinking about why we create these functions
	// as anonymous functions (per each instance) and not as prototype methods
	this.createSession = (response, username, maxAge = CookieMaxAgeMs) => {
    const token = crypto.randomBytes(24).toString('hex');
    const sessionData = {username, timestamp: Date.now(), maxAge};
    sessions[token] = sessionData;
    response.cookie('cpen322-session', token,{maxAge});
    setTimeout(() => {
      delete sessions[token];
    },maxAge);
	};

	this.deleteSession = (request) => {
    const sessionId = request.session;
    delete sessions[sessionId];
		delete request.username;
    delete request.session;
	};

	this.middleware = (request, response, next) => {
    const cookie = request.headers.cookie;
    if (!cookie) {
      return next(new SessionError());
    }
    const sessionId = getSessionId(cookie);

    if (!sessions[sessionId]) {
      return next(new SessionError());
    }
    request.username = sessions[sessionId].username;
    request.session = sessionId;
    return next();
	};

	// this function is used by the test script.
	// you can use it if you want.
	this.getUsername = (token) => ((token in sessions) ? sessions[token].username : null);
  this.getSessionId = getSessionId;
};

function getSessionId(cookie) {
  const cookies = cookie.split(';').map(c => c.trim());
  const session = cookies.filter(c => c.indexOf('cpen322-session=') !== -1)[0];
  const sessionId = session.split('=')[1];
  return sessionId;
}

// SessionError class is available to other modules as "SessionManager.Error"
SessionManager.Error = SessionError;

module.exports = SessionManager;