const socket = new WebSocket('ws://localhost:8080');

// holds our stream and connection 
let localStream;
let peerConnection;

//WebRTC config - pings a free Google STUN server to get IP
const rtcConfig = {
	iceServers: [{urls: 'stun:stun.l.google.com:19302'}]
};

const startStreamBtn = document.getElementById("start-stream")
const connectPeerBtn = document.getElementById('connect-peer')
const localVideo = document.getElementById("local-video")
const remoteVideo = document.getElementById('remote-video')

startStreamBtn.addEventListener('click',startStream)
connectPeerBtn.addEventListener('click',intiateCall)

async function startStream(){
	try{
		localStream = await navigator.mediaDevices.getDisplayMedia({
			//put MediaConstraints later
			video: true,
			audio: true
		});
		localVideo.srcObject = localStream;
		console.log("stream started succcessfully!");
	} catch (error) {
		 console.error("Error accessing display media:", error);
    	}
}

function createPeerConnection() { 
	peerConnection = new RTCPeerConnection(rtcConfig);

	peerConnection.onicecandidate = (event) => {
		if (event.candidate !== null) {
			//send ICE candidate over ws connection 
			socket.send(JSON.stringify({
				type: 'ice-candidate',
				candidate: (event.candidate)
			}));
		}
	};
	//pick the stream and push it to remote peer
	peerConnection.ontrack = (event) => {
		remotevideo.srcObject = event.streams[0];
	}

	const localStream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate : { ideal: 60 , max : 120}}});
	
	localStream.getTracks().forEach((track) = > {
		peerConnection.addTrack(track,localStream);
	});
}


async function initiateCall(){



socket.onopen = () => console.log('Connected to signaling server cleanly!');
socket.onmessage = (event) => console.log('Received from peer:', event.data);
