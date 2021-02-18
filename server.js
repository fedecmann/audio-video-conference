var users = {};

var express = require('express');
var app = express();

var fs = require('fs');
var path = require('path');

const key = fs.readFileSync(path.join(__dirname + '/key-rsa.pem'));
const cert = fs.readFileSync(path.join(__dirname + '/cert.pem'));

const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

// viewed at http://localhost:8080
app.get('/', function (req, res) {
    console.log('hello world !');
    res.sendFile(path.join(__dirname + '/videoChat.html'));
});

app.get('/port', function (req, res) {
    console.log('sending port:', PORT);
    res.send({ port: PORT });
})

app.get('/stuff.js', function (req, res) {
    res.sendFile(path.join(__dirname + '/stuff.js'));
});
app.get('/notifications.js', function (req, res) {
    res.sendFile(path.join(__dirname + '/notifications.js'));
});
app.get('/videoClient.js', function (req, res) {
    res.sendFile(path.join(__dirname + '/videoClient.js'));
});
app.get('/modalOneB.html', function (req, res) {
    res.sendFile(path.join(__dirname + '/modalOneB.html'));
});
app.get('/modalTwoB.html', function (req, res) {
    res.sendFile(path.join(__dirname + '/modalTwoB.html'));
});


// var https = require('https');
// const srv = https.createServer({ key, cert }, app);

var http = require('http');
const srv = http.createServer(app);

const { Server } = require('ws');
const wss = new Server({ server: srv });

srv.listen(PORT, function () {
    console.log(`Listening on ${PORT}`);
});

// when a user connects to our sever
wss.on('connection', function (connection) {

    console.log("User connected");

    // when server gets a message from a connected user
    connection.on('message', function (message) {
        console.log("Got a message from user " + connection.name + ": ", message);

        var data;
        // accepting only JSON messages
        try {
            data = JSON.parse(message);
        } catch (e) {
            console.log("Invalid JSON");
            data = {};
        }

        // switching type of the user message
        switch (data.type) {

            case "users":
                var userList = [];
                for (var u in users) {
                    userList.push(u);
                }
                sendTo(connection, {
                    type: "users",
                    users: userList
                });

                break;

            // when a user tries to login
            case "login":
                // if anyone is logged in with this username then refuse
                if (!data.hasOwnProperty("name") || users[data.name] || data.name.length < 3 || data.name.length > 20 || !data.name.match(/^[a-zA-Z0-9]+$/)) {
                    sendTo(connection, {
                        type: "login",
                        success: false
                    });
                } else {
                    console.log("User logged", data.name);
                    // save user connection on the server
                    users[data.name] = connection;
                    connection.name = data.name;

                    sendTo(connection, {
                        type: "login",
                        success: true
                    });
                }

                break;

            case "message":
                console.log("Sending message to: ", data.name);
                if (data.name === "g") { // if global channel
                    // send msg to all users
                    for (var u in users) {
                        if (u === connection.name) continue; // dont send msg to sender
                        var conn = users[u];
                        if (conn != null) {
                            connection.otherName = u;
                            sendTo(conn, {
                                type: "message",
                                message: data.message,
                                sender: connection.name,
                                channel: "g"
                            });
                        }
                    }
                }
                else {
                    // if UserB exists then send him then message
                    var conn = users[data.name];
                    if (conn != null) {
                        // setting that UserA connected with UserB
                        connection.otherName = data.name;

                        sendTo(conn, {
                            type: "message",
                            message: data.message,
                            sender: connection.name,
                            channel: connection.name
                        });
                    }
                }

                break;

            case "offer":
                // for ex. UserA wants to call UserB
                console.log("Sending offer to: ", data.name);

                // if UserB exists then send him offer details
                var conn = users[data.name];

                if (conn != null) {
                    // setting that UserA connected with UserB
                    connection.otherName = data.name;

                    sendTo(conn, {
                        type: "offer",
                        offer: data.offer,
                        name: connection.name
                    });
                }

                break;

            case "permission":
                console.log("Asking for permission from: ", data.name);
                // for ex. UserB answers UserA
                var conn = users[data.name];

                if (conn != null) {
                    connection.otherName = data.name;
                    sendTo(conn, {
                        type: "permission",
                        name: connection.name
                    });
                }

                break;

            case "accept":
                console.log("Accepted call from: ", data.name);
                // for ex. UserB answers UserA
                var conn = users[data.name];

                if (conn != null) {
                    connection.otherName = data.name;
                    sendTo(conn, {
                        type: "accept",
                        name: connection.name
                    });
                }

                break;

            case "answer":
                console.log("Sending answer to: ", data.name);
                // for ex. UserB answers UserA
                var conn = users[data.name];

                if (conn != null) {
                    connection.otherName = data.name;
                    sendTo(conn, {
                        type: "answer",
                        answer: data.answer,
                        name: connection.name
                    });
                }

                break;

            case "decline":
                console.log("Sending decline to: ", data.name);
                // for ex. UserB declines UserA
                var conn = users[data.name];

                if (conn != null) {
                    connection.otherName = data.name;
                    sendTo(conn, {
                        type: "decline",
                        name: connection.name
                    });
                }

                break;

            case "candidate":
                console.log("Sending candidate to:", data.name);
                var conn = users[data.name];

                if (conn != null) {
                    sendTo(conn, {
                        type: "candidate",
                        candidate: data.candidate,
                        name: connection.name
                    });
                }

                break;

            case "leave":
                console.log("Disconnecting from", data.name);
                var conn = users[data.name];

                // notify the other user so he can disconnect his peer connection
                if (conn != null) {
                    conn.otherName = null;
                    sendTo(conn, {
                        type: "leave",
                        name: connection.name
                    });
                }

                break;

            default:
                sendTo(connection, {
                    type: "error",
                    message: "Command not found: " + data.type
                });

                break;
        }
    });

    // when user exits, for example closes a browser window
    // this may help if we are still in "offer", "answer" or "candidate" state
    connection.on("close", function () {
        if (connection.name) {
            delete users[connection.name];

            if (connection.otherName) {
                console.log("Disconnecting from ", connection.otherName);
                var conn = users[connection.otherName];
                if (conn) conn.otherName = null;

                if (conn != null) {
                    sendTo(conn, {
                        type: "leave"
                    });
                }
            }
        }
    });
});

function sendTo(connection, message) {
    connection.send(JSON.stringify(message));
}