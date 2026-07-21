const socket = new WebSocket('ws://localhost:8080');

socket.onopen = () => console.log('Connected to signaling server cleanly!');
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
connectPeerBtn.addEventListener('click',initiateCall)

async function startStream(){
	try{
		localStream = await navigator.mediaDevices.getDisplayMedia({
			//put MediaConstraints later
			video: { frameRate: { ideal: 60, max: 120 } },
		        audio: {
			echoCancellation: false,
			noiseSuppression: false,
			autoGainControl: false,
			channelCount: 2 // Enforces Stereo sound instead of Mono!
		        }
		});

		const track = localStream.getVideoTracks()[0];
		track.contentHint = 'motion';

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
		remoteVideo.srcObject = event.streams[0];
	}

	//const localStream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate : { ideal: 60 , max : 120}}});
	if (localStream){
		localStream.getTracks().forEach((track) => {
			peerConnection.addTrack(track,localStream);
		});
	}
}

//created an offer(how to communicate and details) sign it and send it over websocket 
async function initiateCall(){
	createPeerConnection();
	
	peerConnection.createOffer().then((offer) => peerConnection.setLocalDescription(offer)).then(() => {
		socket.send(JSON.stringify({
			type : 'offer',
			sdp : peerConnection.localDescription,
		}));
		console.log("Offer created and sent successfully");
	})
	.catch((e) => {
		console.error("Error Creating Offer", e);
	});
}

// signaling logic - handling incoming messages 
socket.onmessage = async (event) => {
	const message = JSON.parse(event.data);

	if (message.type == 'offer'){
		console.log("Received an offer! Creating answer...");

		createPeerConnection();
		peerConnection
			.setRemoteDescription(message.sdp)
			.then(()=> peerConnection.createAnswer()
				.then((answer) => peerConnection.setLocalDescription(answer)).then(() => {
					socket.send(JSON.stringify({
						type : 'answer',
						sdp : peerConnection.localDescription,
					}));
				}))

	} else if (message.type == 'answer') { 
		console.log("Received an answer! Establishing connection...");
		peerConnection.setRemoteDescription(message.sdp);

	} else if (message.type == 'ice-candidate'){
		console.log("Received an ICE candidate!");
		peerConnection.addIceCandidate(message.candidate).catch((e) => {
	      console.log(`Failure during addIceCandidate(): ${e.name}`);
	    });
	}
};


	


