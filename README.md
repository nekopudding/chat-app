# chat-app
 
A fullstack chat application created as part of CPEN 322 that allows users to sign in, manage chat-rooms, and send/receive messages.

Techstack
- Backend - Created using Express NodeJS, WebSockets.
- Frontend - client sockets, HTML, CSS, vanilla JS.

Features
- Uses MongoDB to maintain persistent past chat messages.
- Utilizes cookies to maintain sessions and restricts user from accessing the chats while not logged in.
- defends against XSS attacks by sanitizing user input both in frontend and backend APIs.
