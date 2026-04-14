let username = "";

// JOIN
function joinChat() {
  username = document.getElementById("username").value;

  if (!username) {
    alert("Enter name");
    return;
  }

  document.getElementById("loginBox").style.display = "none";

  socket.emit("join", username);
}

// SEND MESSAGE
function sendMessage() {
  const input = document.getElementById("msg-input");
  const text = input.value.trim();

  if (!text) return;

  socket.emit("sendMessage", text);

  input.value = "";
}

// RECEIVE MESSAGE
socket.on("message", (data) => {
  const messages = document.getElementById("messages");

  const div = document.createElement("div");

  if (data.user === "System") {
    div.style.textAlign = "center";
    div.style.color = "gray";
    div.innerText = data.text;
  } 
  else if (data.user === username) {
    div.className = "msg-row sent";
    div.innerHTML = `<div class="bubble sent">${data.text}</div>`;
  } 
  else {
    div.className = "msg-row received";
    div.innerHTML = `<div class="bubble received"><b>${data.user}</b><br>${data.text}</div>`;
  }

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
});

// BUTTON CLICK
document.getElementById("send-btn").addEventListener("click", sendMessage);

// ENTER KEY SEND
document.getElementById("msg-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});