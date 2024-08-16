const videoEl = document.querySelector(".stream");
const container = document.querySelector(".received");
const addTimeEL = document.querySelector("#add-time");
const timeleftEL = document.querySelector("#timeleft");
const socket = io("/");

const progressBar = document.getElementById('progress-bar');
const progressInput = document.getElementById('progress-input');
// Initialize with full progress
progressBar.style.height = '100%';
progressBar.textContent = '100%';


let timeleft = 50;
let intervalID;
let timeoutID;
function addTime() {
    timeleft = parseInt(timeleft + 10);
    timeleft = timeleft > 100 ? 100 : timeleft;
    // socket.emit("add-time", timeleft);
    console.log(timeleft);
    clearInterval(timeoutID);
    resetTime();
}
//close room after timeout
function resetTime() {
    timeoutID = setTimeout(() => {
        socket.emit("leave-room", { roomId: ROOM_ID });
        socket.disconnect();
        window.location.href = "/";
        peer.close();
        console.log("peer closed");
        clearTimeout(timeoutID);
        clearInterval(intervalID);
    }, timeleft * 1000);
}
resetTime();
intervalID = setInterval(() => {
    timeleft = timeleft - 1;
    timeleftEL.innerHTML = timeleft;

    const value = timeleft;
    progressBar.style.height = timeleft + '%';
    progressBar.textContent = timeleft + '%';

    // Change color based on the value
    if (value > 50) {
        progressBar.style.backgroundColor = 'rgb(0, 214, 0)';
    } else if (value > 25) {
        progressBar.style.backgroundColor = 'orange';
    } else {
        progressBar.style.backgroundColor = 'red';
    }
}, 1000);

socket.on("connection", () => console.log("Connected to server"));

const addVideo = (video, stream) => {
    video.srcObject = stream;
    video.addEventListener("loadedmetadata", () => {
        video.play();
    });
    video.classList.add("peers");
    container.appendChild(video);
};

const peers = {};
let selfId;

navigator.getUserMedia(
    {
        video: true,
        audio: true,
    },
    function (stream) {
        videoEl.srcObject = stream;
        videoEl.addEventListener("loadedmetadata", () => {
            videoEl.play();
        });

        socket.on("user-connected", (userId) => {
            if (userId === selfId) return;
            console.log("New user", userId);
            console.log("Call made");
            const call = peer.call(userId, stream);
            const video = document.createElement("video");
            call.on("stream", (userStream) => {
                console.log("Call answered");
                addVideo(video, userStream);
            });

            call.on("close", () => {
                console.log("Video removed");
                video.remove();
            });

            socket.on("user-disconnected", (userId) => {
                manualClose(userId);
                console.log("Disconnected", userId);
                if (peers[userId]) {
                    peers[userId].close();
                    peer[userId] = undefined;
                }
            });

            peers[userId] = call;
        });
    }
);

const peer = new Peer(undefined, {
    host: location.hostname,
    port: location.port,
    path: "/peerjs",
});

let callList = {};

peer.on("open", (id) => {
    selfId = id;
    console.log("Peer ID", id);
    socket.emit("join-room", { roomId: ROOM_ID, userId: id });
});

peer.on("call", (call) => {
    // console.log(call)
    console.log("Call answered");
    let newVid = document.createElement("video");
    navigator.getUserMedia(
        {
            video: true,
            audio: true,
        },
        function (stream) {
            call.answer(stream);
            call.on("stream", (stream) => {
                if (!callList[call.peer]) {
                    console.log("Received stream from", stream.id);
                    let parent = document.querySelector(".received");
                    parent.appendChild(newVid);
                    newVid.srcObject = stream;
                    newVid.addEventListener("loadedmetadata", () => {
                        newVid.play();
                    });
                    newVid.classList.add("peers");
                    newVid.id = call.peer;
                    newVid.dataset.peerId = call.peer;
                    callList[call.peer] = call;
                    peer[call.peer] = call;
                }
            });
        }
    );
});

socket.on("user-disconnected", (userId) => {
    manualClose(userId);
    console.log("Disconnected from", userId);
    if (peers[userId]) {
        peers[userId].close();
        peers[userId] = undefined;
    }
    // newVid.remove();
    const target = document.querySelector(`[data-peer-id='${userId}']`);
    target.remove();
});



function manualClose(TARGET_ID) {
    // close the peer connections
    for (let conns in peer.connections) {
        peer.connections[conns].forEach((conn, index, array) => {
            // Manually close the peerConnections b/c peerJs MediaConnect close not called bug: https://github.com/peers/peerjs/issues/636
            if (conn.peer === TARGET_ID) {
                console.log(
                    `closing ${conn.connectionId} peerConnection (${index + 1
                    }/${array.length})`,
                    conn.peerConnection
                );
                conn.peerConnection.close();

                // close it using peerjs methods
                if (conn.close) {
                    conn.close();
                }
            }
        });
    }
}









