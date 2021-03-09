var name; // our username
var modalIndex = 0; // for modals to have unique id's
var activeChannel = "g"; // for chat
var HOST = location.origin.replace(/^http/, 'ws')
// connecting to our signaling server
var conn = new WebSocket(HOST);

conn.onopen = function () {
	console.log("Connected to the signaling server");
	getLocation();
};

conn.onerror = function (err) {
	console.log("Got error", err);
};

conn.onmessage = function (msg) {
	console.log("Got message", msg.data);

	var data = JSON.parse(msg.data);

	switch (data.type) {
		case "users":
			onUsersRefresh(data.users);
			break;
		case "login":
			handleLogin(data.success);
			break;
		case "message":
			handleMessage(data.message, data.sender, data.channel);
			break;
		// when somebody wants to call us
		case "offer":
			handleOffer(data.offer, data.name);
			break;
		case "answer":
			handleAnswer(data.answer, data.name);
			break;
		case "permission":
			handlePermission(data.name);
			break;
		case "accept":
			handleAccept(data.name);
			break;
		case "decline":
			handleDecline(data.name);
			break;
		// when a remote peer sends an ice candidate to us
		case "candidate":
			handleCandidate(data.candidate, data.name);
			break;
		case "leave":
			handleLeave(data.name);
			break;
		default:
			break;
	}
};

console.log(conn);


// using Google public stun server
var servers = {
	"iceServers": [
		{ urls: "stun:108.177.15.127:19302" },
		{
			urls: "turn:213.136.72.162:3478",
			username: 'fedec',
			credential: 'fedec123'
		}
	]
};

var peerConns = {};
var stream;

// for browser compability

RTCPeerConnection = (RTCPeerConnection ||
	webkitRTCPeerConnection ||
	mozRTCPeerConnection ||
	msRTCPeerConnection);

$("#checkUsersBtn").click(function (e) {
	send({ type: "users" });
});

function addVideoDiv(name) {
	$("#" + name + ".remoteVideo").parent().remove();
	$("#videoDiv").append('<div class="p-2 w-50 border">' + name + '<button type="button" class="close" aria-label="Close"><span aria-hidden="true">×</span></button><video controls id = "' + name + '" class="remoteVideo" autoplay></video></div>');
	$("#" + name + ".remoteVideo").parent().find(".close").click(function (e) {
		e.preventDefault();
		send({
			type: "leave",
			name: name
		});
		endPeerConn(name);
	});
}

function changeChannel(channel) {
	$("#chatAreaDiv ." + activeChannel).css("display", "none");
	activeChannel = channel;
	$("#channelName").text(activeChannel);
	$("#chatForm :text").focus();
	if ($("#channelList > :contains(" + activeChannel + ")").length == 0) {
		$("#chatAreaDiv").append('<table class="table-hover table ' + activeChannel + '" style="display: block"><tbody class="chatArea"></tbody></table>');
		$("#channelList").append('<a class="dropdown-item" href="#">' + activeChannel + '</a>').click(function (e) {
			e.preventDefault();
			changeChannel(e.target.innerHTML);
		});
	}
	else $("#chatAreaDiv ." + activeChannel).css("display", "block");
	$("#chatAreaDiv").scrollTop($("#chatAreaDiv ." + activeChannel).height());
}

$("#chatForm").submit(function (e) {
	e.preventDefault();
	var msg = $("input[name='message']").val();
	$("input[name='message']").val("");
	send({
		type: "message",
		message: msg,
		name: activeChannel
	});
	$("#chatAreaDiv ." + activeChannel)
		.append($("<tr>")
			.append($("<td>")
				.append(document.createTextNode(name + ": " + msg))
			)
		);
	$("#chatAreaDiv").scrollTop($("#chatAreaDiv ." + activeChannel).height());
});

// when user list gets refreshed
function onUsersRefresh(users) {
	$("#userList").empty();
	users.sort();
	for (var i = 0; i < users.length; i++) {
		$("#userList")
			.append($("<tr>")
				.append($("<td>")
					.append(document.createTextNode(users[i]))
				)
			);
	}
	$("#userList > tr").click(function (e) {
		e.preventDefault();
		var targetUser = e.target.innerHTML;
		load("modalTwoB.html", $("body"), function () {
			var modal = $("#modalTwoB").attr("id", "#modal" + modalIndex++);
			modal.find(".modal-title").text("Select action");
			modal.find(".modal-body").text("Do you want to call or message this user?");
			modal.find(".btn-secondary").text("Call");
			modal.find(".btn-secondary").click(function (e) {
				if (targetUser.length > 0) {
					send({
						type: "permission",
						name: targetUser
					});
				}
				modal.modal("hide");
			});
			modal.find(".btn-primary").text("Message");
			modal.find(".btn-primary").click(function (e) {
				changeChannel(targetUser);
				modal.modal("hide");
			});
			modal.on("hidden.bs.modal", function (e) {
				modal.remove();
			})
			modal.modal("show");
		});
	});
}

// alias for sending JSON encoded messages
function send(message) {
	conn.send(JSON.stringify(message));
};

function handleAccept(name) {
	if (!peerConns.hasOwnProperty(name)) {
		addVideoDiv(name);
		//$("#" + name + ".remoteVideo").parent().hide();
		console.log(stream);

		peerConns[name] = new RTCPeerConnection(servers);
		console.log(peerConns[name]);

		// setup stream listening
		if (stream) {
			peerConns[name].addStream(stream);
		}

		// when a remote user adds stream to the peer connection, we display it
		peerConns[name].onaddstream = function (e) {
			//var video = $("#" + name + ".remoteVideo");
			var video = document.getElementById(name);
			video.srcObject = e.stream;
			//video.attr("src", window.URL.createObjectURL(e.stream));
			//video[0].load();
			$("#" + name + ".remoteVideo").parent().show();
		};

		// setup ice handling
		peerConns[name].onicecandidate = function (e) {
			if (e.candidate) {
				send({
					type: "candidate",
					candidate: e.candidate,
					name: name
				});
			}
		};
	}

	//create an offer
	peerConns[name].createOffer(function (offer) {
		send({
			type: "offer",
			offer: offer,
			name: name
		});
		peerConns[name].setLocalDescription(offer);
	}, function (error) {
		console.log("Error when creating an offer");
	});
}

function handleOffer(offer, name) {
	if (!peerConns.hasOwnProperty(name)) {
		addVideoDiv(name);
		$("#" + name + ".remoteVideo").parent().hide();

		peerConns[name] = new RTCPeerConnection(servers);
		console.log(peerConns[name]);

		// setup stream listening
		if (stream) peerConns[name].addStream(stream);

		// when a remote user adds stream to the peer connection, we display it
		peerConns[name].onaddstream = function (e) {
			var video = document.getElementById(name);
			video.srcObject = e.stream;
			$("#" + name + ".remoteVideo").parent().show();
		};

		// setup ice handling
		peerConns[name].onicecandidate = function (e) {
			if (e.candidate) {
				send({
					type: "candidate",
					candidate: e.candidate,
					name: name
				});
			}
		};
	}

	peerConns[name].setRemoteDescription(new RTCSessionDescription(offer));

	// create an answer to an offer
	peerConns[name].createAnswer(function (answer) {
		peerConns[name].setLocalDescription(answer);

		send({
			type: "answer",
			answer: answer,
			name: name
		});

	}, function (error) {
		console.log("Error when creating an answer");
	});
}

function endPeerConn(name) {
	$("#" + name + ".remoteVideo").parent().remove();
	peerConns[name].close();
	delete peerConns[name];
}

$("#loginForm").submit(function (e) {
	e.preventDefault();
	name = $("#loginForm :text").val();

	send({
		type: "login",
		name: name
	});
});


function handleLogin(success) {
	if (success === false) {
		$("#loginForm :text").popover("enable").popover("show").popover("disable");
		setTimeout(function () {
			$("#loginForm :text").popover("hide");
		}, 1500);

	} else {
		$(".dropdown-item > :contains(text(g)").click(function (e) {
			e.preventDefault();
			changeChannel(e.target.innerHTML);
		});

		send({ type: "users" });
		// ping server for user list every 30s
		setInterval(function () {
			send({ type: "users" });
		}, 30000);

		$("#loginPage").css("display", "none");
		$("#callPage").css("display", "block");
		resize();


		// displaying local video stream on the page

		if (navigator.mediaDevices === undefined) {

			navigator.getUserMedia = (navigator.getUserMedia ||
				navigator.webkitGetUserMedia ||
				navigator.mozGetUserMedia ||
				navigator.msGetUserMedia);

			console.log(navigator);
			// getting local video stream
			navigator.getUserMedia({ video: true, audio: true }, function (myStream) {
				stream = myStream;

				$("#videoDiv").append('<div class="p-2 w-50 border">You<video controls id="localVideo" autoplay muted></video></div>');
				// displaying local video stream on the page

				var attr = $("#localVideo").attr('srcObject');

				if (typeof attr !== typeof undefined && attr !== false) {
					try {
						$("#localVideo").srcObject(stream);
					} catch (err) {
						console.log(err);
						$("#localVideo").attr("src", window.URL.createObjectURL(stream));
					}
				} else {
					//$("#localVideo")[0].setAttribute("srcObject",stream);
					document.getElementById("localVideo").srcObject = stream;
				}

				$("#localVideo")[0].load();
				//$("#localVideo")[0].play();
			}, function (error) {
				console.log(error);
			});

		}

		else {
			navigator.mediaDevices.getUserMedia({ audio: true, video: true })
				.then(function (myStream) {
					stream = myStream;
					$("#videoDiv").append('<div class="p-2 w-50 border">You<video controls muted id="localVideo" autoplay></video></div>');
					var video = document.getElementById('localVideo');
					// Older browsers may not have srcObject
					if ("srcObject" in video) {
						video.srcObject = stream;
					} else {
						// Avoid using this in new browsers, as it is going away.
						video.src = window.URL.createObjectURL(stream);
					}
					video.onloadedmetadata = function (e) {
						video.play();
					};
				})
				.catch(function (err) {
					console.log(err.name + ": " + err.message);
				});
		}
	}
}

function addStreamToVideo(videoId, stream) {
	var videoIdJQuery = '#' + videoId;
	if (navigator.mediaDevices === undefined) {

		navigator.getUserMedia = (navigator.getUserMedia ||
			navigator.webkitGetUserMedia ||
			navigator.mozGetUserMedia ||
			navigator.msGetUserMedia);

		// getting local video stream
		navigator.getUserMedia({ video: true, audio: true }, function (myStream) {
			stream = myStream;

			$("#videoDiv").append('<div class="p-2 w-50 border">You<video controls id="localVideo" autoplay muted></video></div>');
			// displaying local video stream on the page

			var attr = $(videoIdJQuery).attr('srcObject');

			if (typeof attr !== typeof undefined && attr !== false) {
				try {
					$(videoIdJQuery).srcObject(stream);
				} catch (err) {
					console.log(err);
					$(videoIdJQuery).attr("src", window.URL.createObjectURL(stream));
				}
			} else {
				//$("#localVideo")[0].setAttribute("srcObject",stream);
				document.getElementById(videoId).srcObject = stream;
			}

			$(videoIdJQuery)[0].load();
		}, function (error) {
			console.log(error);
		});
	} else {
		navigator.mediaDevices.getUserMedia({
			audio: true, video: {
				facingMode: 'environment'
			}
		}).then(function (stream) {
			$("#videoDiv").append('<div class="p-2 w-50 border">You<video controls muted id="localVideo" autoplay></video></div>');
			var video = document.getElementById(videoId);
			// Older browsers may not have srcObject
			if ("srcObject" in video) {
				video.srcObject = stream;
			} else {
				// Avoid using this in new browsers, as it is going away.
				video.src = window.URL.createObjectURL(stream);
			}
			video.onloadedmetadata = function (e) {
				video.play();
			};
		})
			.catch(function (err) {
				console.log(err.name + ": " + err.message);
			});
	}
}

function handleMessage(message, sender, channel) {
	if ($("#channelList > :contains(" + channel + ")").length == 0) {
		$("#chatAreaDiv").append('<table class="table-hover table ' + channel + '" style="display: none"><tbody class="chatArea"></tbody></table>');
		$("#channelList").append('<a class="dropdown-item" href="#">' + channel + '</a>').click(function (e) {
			e.preventDefault();
			changeChannel(e.target.innerHTML);
		});
	}
	$("#chatAreaDiv ." + channel)
		.append($("<tr>")
			.append($("<td>")
				.append(document.createTextNode(sender + ": " + message))
			)
		);
	if (channel === activeChannel) $("#chatAreaDiv").scrollTop($("#chatAreaDiv ." + activeChannel).height());
}

// when somebody sends us an offer
function handlePermission(name) {
	load("modalTwoB.html", $("body"), function () {
		var modal = $("#modalTwoB").attr("id", "#modal" + modalIndex++);
		modal.find(".modal-title").text("Incoming call");
		modal.find(".modal-body").text("From \"" + name + "\"");
		modal.find(".btn-secondary").text("Decline");
		modal.find(".btn-secondary").click(function (e) { modal.modal("hide"); });
		modal.find(".btn-primary").text("Accept");
		modal.find(".btn-primary").click(function (e) {
			modal.off("hide.bs.modal .decline");
			send({
				type: "accept",
				name: name
			});
			modal.modal("hide");
		});
		modal.on("hide.bs.modal .decline", function (e) {
			send({
				type: "decline",
				name: name
			});
		})
		modal.on("hidden.bs.modal", function (e) {
			modal.remove();
		})
		modal.modal("show");
	});
};

function handleDecline(name) {
	load("modalOneB.html", $("body"), function () {
		var modal = $("#modalOneB").attr("id", "#modal" + modalIndex++);
		modal.find(".modal-title").text("Call declined");
		modal.find(".modal-body").text("User \"" + name + "\" declined your call");
		modal.find(".btn-secondary").text("OK");
		modal.on("hidden.bs.modal", function (e) {
			modal.remove();
		})
		modal.modal("show");
	});
}

// when we got an answer from a remote user
function handleAnswer(answer, name) {
	if (!peerConns.hasOwnProperty(name)) peerConns[name] = new RTCPeerConnection(servers);
	peerConns[name].setRemoteDescription(new RTCSessionDescription(answer));
};

// when we got an ice candidate from a remote user
function handleCandidate(candidate, name) {
	console.log(candidate, name);
	if (!peerConns.hasOwnProperty(name)) peerConns[name] = new RTCPeerConnection(servers);
	if (candidate) peerConns[name].addIceCandidate(new RTCIceCandidate(candidate));
}



function handleLeave(name) {
	endPeerConn(name);
};

function resize() {
	$("#userListDiv").height($("#row1").outerHeight() - $("#userListHeader").outerHeight() - $("#checkUsersBtn").outerHeight());
	$("#chatAreaDiv").height($("#row1").outerHeight() - $("#chatHeader").outerHeight() - $("#chatForm").outerHeight());
}
$(window).resize(function () {
	resize();
});

// geolocation ----------------------------------------------------------------------------------------

function getLocation() {
	if (navigator.geolocation) {
		navigator.geolocation.watchPosition(showPosition);
	} else {
		console.log('Geolocation is not supported by this browser.');
	}
}

function showPosition(position) {
	console.log(position);
}

//------------------------------------------------------------------------------------------------------
//photos

var width = 320;
var height = 0;

var streaming = false;

var video = document.getElementById("video");
var canvas = document.getElementById("canvas");
var photo = document.getElementById("photo");
var startButton = document.getElementById("startButton");
var switchFlashlight = document.getElementById("switchFlashlight");

var imageCapture;


// video streaming
navigator.mediaDevices
	.getUserMedia({
		audio: false,
		video: {
			width: {
				ideal: 1280
			},
			height: {
				ideal: 1024,
			},
			facingMode: 'environment',
			// advanced: {
			//   torch: true
			// }
		},
	})
	.then((stream) => {
		video.srcObject = stream;

		const track = stream.getVideoTracks()[0];

		imageCapture = new ImageCapture(track);

		const photoCapabilities = imageCapture.getPhotoCapabilities()
			.then(() => {
				const btn = document.getElementById("switchFlashlight");
				btn.addEventListener('click', () => {
					let torchState = photoCapabilities.torch;
					track.applyConstraints({
						advanced: [{
							torch: !torchState
						}]
					})
				})
			})

		video.play();
	})
	.catch((err) => {
		console.log("An error occurred: " + err);
	});

// method to avoid blocking until video begins to flow
video.addEventListener(
	"canplay",
	() => {
		if (!streaming) {
			height = video.videoHeight / (video.videoWidth / width);

			video.setAttribute("width", width);
			video.setAttribute("height", height);

			canvas.setAttribute("width", width);
			canvas.setAttribute("height", height);

			streaming = true;
		}
	},
	false
);

// handle click on button

startButton.addEventListener(
	"click",
	(ev) => {
		takePicture();
		ev.preventDefault();
		console.log('takePicture');
	},
	false
);

clearPhoto()

// clearing the photo box
function clearPhoto() {
	var context = canvas.getContext('2d');
	context.fillStyle = "#AAA";
	context.fillRect(0, 0, canvas.width, canvas.height);

	var data = canvas.toDataURL('image/png');
	photo.setAttribute('src', data);
}

// taking the photo
function takePicture() {

	imageCapture.takePhoto()
		.then(blob => createImageBitmap(blob))
		.then(imageBitmap => {
			drawCanvas(canvas, imageBitmap)
		})
}

function drawCanvas(canvas, img) {
	canvas.width = getComputedStyle(canvas).width.split('px')[0];
	canvas.height = getComputedStyle(canvas).height.split('px')[0];
	let ratio = Math.min(canvas.width / img.width, canvas.height / img.height);
	let x = (canvas.width - img.width * ratio) / 2;
	let y = (canvas.height - img.height * ratio) / 2;
	clearPhoto();
	canvas.getContext('2d').drawImage(img, 0, 0, img.width, img.height, x, y, img.width * ratio, img.height * ratio);
}

async function getDevices() {
	const devices = await navigator.mediaDevices.enumerateDevices();
	console.log('devices: ', devices);
}

//------------------------------------------------------------------------------------------------------------------