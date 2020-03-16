const { ipcRenderer } = require('electron')
const $ = require("jquery");

let idUser
let loadedMessages = 0
var lastScrollTop = 0
let loaded=false;

ipcRenderer.send("init-conversation-channel", {})

ipcRenderer.on("message-comming-channel", (e, message)=>{
  showMessage(message)
})

function showMessage(message) {
	let tr = createTdFromMessage(message)
    $("#messages").append(tr);
	$("#message-container").scrollTop($('#message-container').prop("scrollHeight"));
}

ipcRenderer.on("init-conversation-response-channel", (e, response)=>{
  let data = JSON.parse(response)
  idUser = data.idUser
  loadPrevMessages(data.messages)
  loaded = true;
})

$("#message").on("keyup", (event)=>{
  if (event.keyCode === 13) {
    event.preventDefault();
    sendMessage();
  }
})

$("#sendMessageBtn").on("click", (event)=>{
  sendMessage()
})

function sendMessage() {
		let message = $("#message").val();
		$("#message").val('');
		if(message==null || message=="") return
	    ipcRenderer.send("send-message-channel", {"message": message})
}

$("#message-container").scroll(function() {
   var st = $(this).scrollTop();
   if (st < lastScrollTop){
	   if(200>$(this).scrollTop() && loaded){
    		loaded=false;
    		getPreviousMessages()
    	}
   }
   lastScrollTop = st;
});

function loadPrevMessages(mess){
	mess.forEach(m=> {
		let tr = createTdFromMessage(m)
		$("#messages").prepend(tr);
	})
	$("#message-container").scrollTop(700);
}

function addFoundedMessages(mess){
	$("#messages").empty()
	mess.forEach(m=> {
		let tr = createTdFromMessage(m)
		$("#messages").prepend(tr);
	})
}

function createTdFromMessage(message){
	let tr = document.createElement('tr');
	let td = document.createElement('td');
	let div = document.createElement('div');
	let time = document.createElement('span');
	let user = document.createElement('span');
	let content = document.createElement('div');
	let data = new Date(message.writeTime);
	time.textContent = data.toLocaleDateString() +" "+ data.toLocaleTimeString() + " "
	user.textContent = message.nick
	user.className+="bold"
	$(content).append($.parseHTML(message.content))
	div.className += "message "
	content.className += "message-content "
	if(message.idUser==idUser){
		content.className += "gray"
		div.className += "message-left";
		td.align = "left"
	}else{
		td.align = "right"
		content.className += "green"
		div.className += "message-right"
	}
	div.appendChild(time)
	div.appendChild(user)
	div.appendChild(content)
	td.appendChild(div)
	tr.appendChild(td)
	return tr;
}
