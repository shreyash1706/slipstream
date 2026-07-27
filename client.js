const socket = new WebSocket('wss://slipstream-pyp0.onrender.com');

socket.onopen = () => console.log('Connected to signaling server cleanly!');
// holds our stream and connection 
let localStream;
let peerConnection;

//WebRTC config - pings a free Google STUN server to get IP
const rtcConfig = {
	iceServers: [{urls: 'stun:stun.l.google.com:19302'}]
};

let peerConnection = null;
let localStream = null;
let userStream = null;

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
		        },
			surfaceSwitching: 'include',
			systemAudio: 'include',
			windowAudio: 'system'
		});

		//const track = localStream.getVideoTracks()[0];
		//track.contentHint = 'motion';

                if (message.type === 'offer') {
                    console.log("📥 Received an offer! Creating answer...");
                    this.createPeerConnection();
                    
                    await peerConnection.setRemoteDescription(message.sdp);
                    const answer = await peerConnection.createAnswer();
                    await peerConnection.setLocalDescription(answer);
                    
                    socket.send(JSON.stringify({
                        type: 'answer',
                        sdp: peerConnection.localDescription,
                    }));

                } else if (message.type === 'answer') {
                    console.log("📥 Received an answer! Establishing connection...");
                    await peerConnection.setRemoteDescription(message.sdp);

                } else if (message.type === 'ice-candidate') {
                    console.log("🧊 Received an ICE candidate!");
                    peerConnection.addIceCandidate(message.candidate).catch((e) => {
                        console.error(`Failure during addIceCandidate(): ${e.name}`);
                    });
                }
            };
        },

        // ==========================================
        // 3. CORE WEBRTC ENGINE (Your High-Quality Rules!)
        // ==========================================
        createPeerConnection() {
            peerConnection = new RTCPeerConnection(rtcConfig);

            // Send ICE candidates over WebSocket
            peerConnection.onicecandidate = (event) => {
                if (event.candidate !== null) {
                    socket.send(JSON.stringify({
                        type: 'ice-candidate',
                        candidate: event.candidate
                    }));
                }
            };

            // Catch incoming peer video/audio and push to Alpine UI!
            peerConnection.ontrack = (event) => {
                const receiver = event.receiver;

                // Apply our 250ms shock absorber for cellular jitter!
                if (receiver && 'jitterBufferTarget' in receiver) {
                    receiver.jitterBufferTarget = 250;
                    console.log(`🛡️ Jitter Buffer locked at 250ms for ${event.track.kind} track`);
                }

                // Check if this peer is already in our UI grid
                const existingPeer = this.peers.find(p => p.id === 'remote-viewer');
                if (!existingPeer) {
                    console.log("📺 Adding remote peer stream to Alpine grid!");
                    this.peers.push({
                        id: 'remote-viewer',
                        name: 'Connected Peer',
                        stream: event.streams[0],
                        isLocal: false
                    });
                } else {
                    existingPeer.stream = event.streams[0];
                }
            };

            // If we are already sharing a screen, attach those tracks to the connection
            if (localStream) {
                localStream.getTracks().forEach(async (track) => {
                    const sender = peerConnection.addTrack(track, localStream);

                    // Apply our 20 Mbps ceiling and 2 Mbps cellular safety floor!
                    if (track.kind === 'video') {
                        try {
                            const params = sender.getParameters();
                            params.degradationPreference = 'balanced';

                            if (params.encodings && params.encodings.length >= 1) {
                                params.encodings[0].maxBitrate = 20000000; // 20 Mbps Max
                                params.encodings[0].minBitrate = 2000000;  // 2 Mbps Floor
                                params.encodings[0].priority = "high";
                            }
                            await sender.setParameters(params);
                            console.log("⚡ 20Mbps bitrate & balanced degradation locked in!");
                        } catch (e) {
                            console.error("Failed to set high bitrate parameters:", e);
                        }
                    }
                });
            }
        },

        // ==========================================
        // 4. MEDIA & UI ACTIONS
        // ==========================================
        async toggleScreenShare() {
            // If already streaming, stop it
            if (this.isSharingScreen && localStream) {
                localStream.getTracks().forEach(track => track.stop());
                this.peers = this.peers.filter(p => !p.isLocal);
                this.isSharingScreen = false;
                console.log("🛑 Stopped screen share.");
                return;
            }

            try {
                // Launch high-framerate display capture
                localStream = await navigator.mediaDevices.getDisplayMedia({
                    video: { frameRate: { ideal: 60, max: 120 } },
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                        channelCount: 2 // Enforces Stereo sound instead of Mono!
                    },
                    surfaceSwitching: 'include',
                    systemAudio: 'include',
                    windowAudio: 'system'
                });

                this.isSharingScreen = true;

                // Push our local stream to the Alpine grid so you see yourself!
                this.peers.push({
                    id: 'local-host',
                    name: 'You (Streamer)',
                    stream: localStream,
                    isLocal: true
                });

                console.log("🚀 Screen share started successfully!");

                // Automatically initiate the call to waiting peers!
                this.initiateCall();

                // Handle user clicking "Stop sharing" via the native browser floating bar
                localStream.getVideoTracks()[0].onended = () => {
                    this.isSharingScreen = false;
                    this.peers = this.peers.filter(p => !p.isLocal);
                };

            } catch (error) {
                console.error("Error accessing display media:", error);
                this.isSharingScreen = false;
            }
        },

        async initiateCall() {
            this.createPeerConnection();
            
            try {
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);
                
                socket.send(JSON.stringify({
                    type: 'offer',
                    sdp: peerConnection.localDescription,
                }));
                console.log("📤 Offer created and sent successfully over WebSocket!");
            } catch (e) {
                console.error("Error Creating Offer:", e);
            }
        },

        pinPeer(peer) {
            // Toggle spotlight mode
            this.pinnedPeer = (this.pinnedPeer?.id === peer.id) ? null : peer;
        },

        toggleMic() {
            this.isMuted = !this.isMuted;
            const localPeer = this.peers.find(p => p.isLocal);
            if (localPeer && localPeer.stream) {
                localPeer.stream.getAudioTracks().forEach(t => t.enabled = !this.isMuted);
            }
        },

        toggleCam() {
            this.isCamOff = !this.isCamOff;
            const localPeer = this.peers.find(p => p.isLocal);
            if (localPeer && localPeer.stream) {
                localPeer.stream.getVideoTracks().forEach(t => t.enabled = !this.isCamOff);
            }
        },

        sendMessage() {
            if (!this.chatInput.trim()) return;
            
            this.messages.push({
                id: Date.now(),
                sender: 'You',
                text: this.chatInput,
                isSelf: true
            });
            
            this.chatInput = '';
        },

        async joinRoom() {
            if (!this.roomId) return;
            this.inRoom = true;
            console.log(`Joined room: ${this.roomId}`);

            try{
		    userStream = await navigator.mediaDevices.getUserMedia({
				video: true,
				audio: true
			});
	    } catch (e) {
		    console.error("Error accessing media devices.", error);
	    }
	    
		this.peers.push({
			id: 'local-host',
			name: 'You',
			stream: userStream,
			isLocal: true
		});


        },

        leaveRoom() {
            window.location.reload();
        }
    };
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
		const receiver = event.receiver;

		if  (receiver && 'jitterBufferTarget' in receiver){
			receiver.jitterBufferTarget = 250;
			console.log(`Jitter Buffer set to 250ms for ${event.track.kind} track`);
		}

		if (remoteVideo.srcObject !== event.streams[0]){
			remoteVideo.srcObject = event.streams[0];
		}
	};

	//const localStream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate : { ideal: 60 , max : 120}}});
	if (localStream){
		localStream.getTracks().forEach(async (track) => {
			// capture sender RTCRtpSender object
			const sender = peerConnection.addTrack(track,localStream);

			if (track.kind === 'video'){
				try {
					const params = sender.getParameters();

					params.degradationPreference = 'balanced';

					if (params.encodings.length >= 1){
						params.encodings[0].maxBitrate = 20000000;
						params.encodings[0].minBinrate = 2000000;
						params.encodings[0].priority = "high";
					}

					await sender.setParameters(params);
				}catch(e){
					console.error("Failed to set high bitrate parameters:", e);
				}
			}
			
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


	


