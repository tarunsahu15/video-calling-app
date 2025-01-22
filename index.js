const express = require("express");
const cors = require("cors"); // Import cors
const app = express();
const path = require("path");

const http = require("http");
const socketIO = require("socket.io");
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://5020-2409-40c4-f-2dec-7d81-afe6-eb8e-b4d2.ngrok-free.app",
      "http://127.0.0.1:4040",
      "https://5020-2409-40c4-f-2dec-7d81-afe6-eb8e-b4d2.ngrok-free.app", // Replace with your public URL after port forwarding
    ], // Allow requests from localhost:5173, ngrok URL, and your public URL
    methods: ["GET", "POST"],
  },
});

app.set("view engine", "ejs");
app.use(cors()); // Use cors middleware
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// app.get("/", (req, res) => {
//   res.render("index");
// });

let waitingusers = [];
let rooms = {}; // Store rooms as an object

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);
  console.log(`Total users connected: ${io.engine.clientsCount}.`);
  console.log(`Total rooms: ${Object.keys(rooms).length}`);
  
  // Notify all users of the total number of online users
  io.emit("totalUsers", io.engine.clientsCount);

  // Handle user joining a room
  socket.on("joinroom", () => {
    if (waitingusers.length > 0) {
      let partner = waitingusers.shift(); // Get the first waiting user
      const roomname = `${socket.id}-${partner.id}`;

      // Create a room as an object
      rooms[roomname] = {
        users: [socket.id, partner.id],
      };

      // Join both users to the room
      socket.join(roomname);
      partner.join(roomname);

      // Notify users of the room
      io.to(roomname).emit("joined", roomname);
      console.log(`Room created: ${roomname}. Total rooms: ${Object.keys(rooms).length}`); // Log total rooms after creation
    } else {
      waitingusers.push(socket);
    }
  });

  
  socket.on("skipped", (room) =>{
    // Find the room object
    console.log(room);
    console.log("Skipped triggered");
    io.to(room).emit("leave");
  })
  // Handle user disconnect
  socket.on("disconnect", () => {
    
    // Remove from waitingusers if applicable
    let waitingIndex = waitingusers.findIndex(
      (waitingUser) => waitingUser.id === socket.id
    );
    if (waitingIndex !== -1) {
      waitingusers.splice(waitingIndex, 1);
      console.log(`User ${socket.id} removed from waiting list`);
      return; // Stop if the user was only in the waiting list
    }

    // Find the room the user was part of
    let roomName = Object.keys(rooms).find((room) => rooms[room].users.includes(socket.id));
    if (roomName) {
      const room = rooms[roomName];
      const remainingUserID = room.users.find((id) => id !== socket.id);

      // Remove the room
      delete rooms[roomName];

      // Handle the remaining user
      const remainingUserSocket = io.sockets.sockets.get(remainingUserID);
      if (remainingUserSocket && remainingUserSocket.connected) {
        if (waitingusers.length > 0) {
          let newPartner = waitingusers.shift();
          const newRoomname = `${remainingUserID}-${newPartner.id}`;

          // Create a new room
          rooms[newRoomname] = {
            users: [remainingUserID, newPartner.id],
          };

          // Join both users to the new room
          remainingUserSocket.join(newRoomname);
          newPartner.join(newRoomname);

          // Notify users of the new room
          io.to(newRoomname).emit("joined", newRoomname);
          console.log(
            `New room created: ${newRoomname}. Total rooms: ${Object.keys(rooms).length}`
          ); // Log total rooms after creation
        } else {
          // Add remaining user to the waiting list
          waitingusers.push(remainingUserSocket);
          console.log(`User ${remainingUserID} added to waiting list`);
          console.log(`Total rooms: ${Object.keys(rooms).length}`);
        }
      }
    }
console.log(`User disconnected: ${socket.id} \n`);
console.log(
  `Total users connected: ${io.engine.clientsCount}. Total rooms: ${
    Object.keys(rooms).length
  }`
);

    // Notify all users of the total number of online users after a disconnect
    io.emit("totalUsers", io.engine.clientsCount);
  });

  socket.on("signalingMessage", function (data) {
    socket.broadcast.to(data.room).emit("signalingMessage", data.message);
  });
});

// Render the homepage
app.get("/", function (req, res) {
  res.render('index');
});

// app.get("/login",function (req, res) {
//   res.render('login');
// })
// Start the server
server.listen(process.env.PORT||3000, () => {
  console.log("Server is running on port 3000: http://localhost:3000");
});
