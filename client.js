const socket = new WebSocket('ws://localhost:8080');

socket.onopen = () => console.log('Connected to signaling server cleanly!');
socket.onmessage = (event) => console.log('Received from peer:', event.data);
