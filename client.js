// ==========================================
// 1. WEBSOCKET SIGNALING & CONFIG
// ==========================================
const socket = new WebSocket('wss://slipstream-pyp0.onrender.com');

const rtcConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

let peerConnection = null;
let localStream = null;
let userStream = null;

socket.onopen = () => console.log('✅ Connected to signaling server cleanly!');

// ==========================================
// 2. ALPINE.JS REACTIVE APPLICATION SCOPE
// ==========================================
function meetApp() {
    return {
        // --- UI STATE ---
        roomId: 'room-101',
        inRoom: false,
        isMuted: false,
        isCamOff: false,
        isSharingScreen: false,
        isChatOpen: false,
        unreadCount: 0,
        chatInput: '',
        
        // --- MEDIA STATE ---
        peers: [],         // Array of connected users { id, name, stream, isLocal }
        pinnedPeer: null,  // Holds the peer object if someone is spotlighted
        messages: [],      // Array of chat messages { id, sender, text, isSelf }

        // --- INIT ---
        init() {
            console.log("🚀 Alpine MeetApp Initialized!");
            
            // 1. Wire up WebSocket message handling to talk to Alpine's state
            socket.onmessage = async (event) => {
                const message = JSON.parse(event.data);

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

		const incomingStream = event.streams[0]; 
		const uniquePeerId = `remote-${incomingStream.id}`;    
                // Check if this peer is already in our UI grid
                const existingPeer = this.peers.find(p => p.id === 'remote-viewer');
                if (!existingPeer) {
                    console.log("📺 Adding remote peer stream to Alpine grid!");
                    this.peers.push({
                        id: uniquePeerId,
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
		
	    if (userStream){
		userStream.getTracks().forEach(async (track) => {
                    const sender = peerConnection.addTrack(track, userStream);

		if (track.kind === 'video') {
                        try {
                            const params = sender.getParameters();
                            params.degradationPreference = 'balanced';

                            if (params.encodings && params.encodings.length >= 1) {
				    if (this.isSharingScreen){
					params.encodings[0].maxBitrate = 600000; 
				    } else{
					params.encodings[0].maxBitrate = 2000000; 
				    }
                            }
                            await sender.setParameters(params);
                            console.log("max bitrate cap at 600kbps!");
                        } catch (e) {
                            console.error("Failed to cap user bitrate:", e);
                        }
                    }
		if (track.kind === 'audio'){
			try{
				const params = sender.getParameters();
			    if (params.encodings && params.encodings.length >= 1) {
				    params.encodings[0].priority = "very-high";
			    }
				await sender.setParameters(params);
			} catch (e) {
				console.error("Failed to set high audio priority", e);
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
                    id: 'local-screen',
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
		// 1. Safety Check: Only adjust if we actually have an active call and webcam!
		if (peerConnection && userStream) {
		    try {
			// 2. Find the exact RTCRtpSender handling your physical webcam
			const camVideoTrack = userStream.getVideoTracks()[0];
			const camSender = peerConnection.getSenders().find(s => s.track === camVideoTrack);

			if (camSender) {
			    const params = camSender.getParameters();
			    if (params.encodings && params.encodings.length >= 1) {
				
				// 3. THE GEAR SHIFT: 
				// If Screen Share just turned ON -> Cap cam at 600 kbps to save bandwidth
				// If Screen Share just turned OFF -> Boost cam to 2 Mbps (2000000) for HD quality!
				if (this.isSharingScreen) {
				    params.encodings[0].maxBitrate = 600000;
				    console.log("🚦 Screen share active: Dropped webcam cap to 600 kbps");
				} else {
				    params.encodings[0].maxBitrate = 2000000;
				    console.log("🚀 Screen share stopped: Boosted webcam to 2 Mbps HD!");
				}
				
			    }
			    // 4. Apply the new rules live without dropping the call!
			    await camSender.setParameters(params);
			}
		    } catch (e) {
			console.error("Failed to dynamically shift webcam bitrate:", e);
		    }
		}
        },

        async initiateCall() {
            this.createPeerConnection();
            
            try {
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);
                
                socket.send(JSON.stringify({
                    type: 'offer',
			roomID: this.roomId,
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
            if (userStream) {
                userStream.getAudioTracks().forEach(t => t.enabled = !this.isMuted);
            }
        },

        toggleCam() {
            this.isCamOff = !this.isCamOff;
            if (userStream) {
                userStream.getVideoTracks().forEach(t => t.enabled = !this.isCamOff);
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

		    this.peers.push({
			id: 'local-host',
			name: 'You',
			stream: userStream,
			isLocal: true
		});

		    this.initiateCall();
	    } catch (e) {
		    console.error("Error accessing media devices.", error);
	    }
	    
		


        },

        leaveRoom() {
            window.location.reload();
        }
    };
}
