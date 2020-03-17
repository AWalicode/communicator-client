const { ipcRenderer } = require('electron')
const $ = require("jquery");

let idUser
let lastScrollTop = 0
let loaded=false;
let offset=0

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
  $("#messages").empty()
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
		if(message==null || message.trim()=="") return
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

function getPreviousMessages(){
  offset+=10
  ipcRenderer.send("load-prev-messages-channel", {"offset": offset})
}

ipcRenderer.on("load-prev-messages-response-channel", (e, response)=>{
  let data = JSON.parse(response)
	if(data.messages.length!=0){
		loadPrevMessages(data.messages)
		loaded = true;
	} else{
		loaded = false;
	}
})

function loadPrevMessages(mess){
	mess.forEach(m=> {
		let tr = createTdFromMessage(m)
		$("#messages").prepend(tr);
	})
	$("#message-container").scrollTop(700);
}

function addFoundedMessages(mess){
	$("#messages").empty()
  if(Array.isArray(mess)){
    mess.forEach(m=> {
      let tr = createTdFromMessage(m)
      $("#messages").prepend(tr);
    })
  }else{
    let tr = createTdFromMessage(mess)
    $("#messages").prepend(tr);
  }

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

$("#searchMessage").on("click", ()=>{
		let content = $("#searchText").val();
		if(content == null || content.trim() == "") {
      ipcRenderer.send("init-conversation-channel", {})
    }else{
      loaded = false;
      ipcRenderer.send("search-message-channel", {"content": content})

    }
})

$("#searchText").on("keyup", (event)=>{
  if (event.keyCode === 13) {
    event.preventDefault();
    let content = $("#searchText").val();
    if(content == null || content.trim() == "") content = "i";
    loaded = false;
    ipcRenderer.send("search-message-channel", {"content": content})
    return false;
  }
})
ipcRenderer.on("search-message-response-channel", (e, mess)=>{
  if(mess.length==0 || Object.keys(mess).length === 0){
    $("#messages").empty()
    offset=-10
    getPreviousMessages()
    loaded = false;
  } else{
    addFoundedMessages(mess)
    loaded = true;
  }
})
