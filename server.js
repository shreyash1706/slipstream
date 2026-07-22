import WebSocket, { WebSocketServer} from 'ws';

const PORT = process.env.PORT || 8080;

const wss = new WebSocketServer({
	port: PORT
});
console.log(`Signaling server running on port ${PORT}`);


wss.on('connection', function connection(ws) {
	console.log('Client connected');

	ws.on('message', function message(data, isBinary){
		wss.clients.forEach(function each(client){
			if (client!=ws && client.readyState == WebSocket.OPEN) {
				client.send( data, { binary: isBinary});
			}
		});
	});
	
	ws.on('close', () => {
		console.log('Client disconnected cleanly');
	    });

	ws.on('error', (err) => {
		console.error('Socket error:', err);
		ws.terminate(); // Force-kill hanging sockets
	    });

});


