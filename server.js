import WebSocket, { WebSocketServer} from 'ws';

const PORT = process.env.PORT || 8080;

const wss = new WebSocketServer({
	port: PORT
});
console.log(`Signaling server running on port ${PORT}`);

const rooms = new Map();

wss.on('connection', function connection(ws) {
	console.log('Client connected');

	let currentRoom = null;
	
	ws.on('message', function message(message){

		try{
			const data = JSON.parse(message);

			if (data.type === 'join-room') {
				currentRoom = data.roomId;
				ws.roomId = currentRoom;

				if (!rooms.has(currentRoom)){
					rooms.set(currentRoom, new Set());
				}

				const roomClients = rooms.get(currentRoom);
				roomClients.forEach(client => {
					if (client!==ws && client.readyState == WebSocket.OPEN) {
						client.send(JSON.stringify({ type: 'user-joined' }));
					}
				});

				roomClients.add(ws);
				console.log(`Client joined ${currentRoom}. Total: ${roomClients.size}`);
				return;
			}

			if (currentRoom && rooms.has(currentRoom)) {
				rooms.get(currentRoom).forEach(client => {
					if (client !== ws && client.readyState == WebSocket.OPEN){
						client.send(JSON.stringify(data));
					}
				});
			}
		} catch (e) {
			console.error("Invalid message format",e);
		}
	});
	
	ws.on('close', () => {
        if (currentRoom && rooms.has(currentRoom)) {
            rooms.get(currentRoom).delete(ws);
            if (rooms.get(currentRoom).size === 0) {
                rooms.delete(currentRoom);
            }
        }
    });
	ws.on('error', (err) => {
		console.error('Socket error:', err);
		ws.terminate(); // Force-kill hanging sockets
	    });

});


